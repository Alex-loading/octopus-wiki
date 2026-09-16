import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, ZONES, PLAYER_CAT_CLEARANCE, distance, findFreePosition, findPath, moveWithCollisions, zoneAt, type Point, type ZoneId } from './navigation';
import { createPersonSprite } from './person';
import { createCatSprite, type CatActivity } from './cat';
import { CAT_INTERACTION_RANGE, PET_DURATION, findPettingSpot } from './cat-interaction';
import { createIllustratedMaterials, createIllustrationRenderer } from './illustration';

export type RoomEngine = {
  dispose: () => void;
  pause: (value: boolean) => void;
  setNight: (value: boolean) => void;
  goTo: (id: ZoneId) => void;
  reset: () => void;
  direction: (key: string, down: boolean) => void;
  petCat: () => void;
  goToCat: () => void;
};
export type CatInteractionState = {
  near: boolean; phase: 'idle' | 'approaching' | 'petting'; x: number; y: number;
  worldX: number; worldZ: number; activity: CatActivity;
};
type Options = {
  host: HTMLDivElement;
  signal: AbortSignal;
  onZone: (id: ZoneId | null) => void;
  onOpen: (id: ZoneId) => void;
  onPosition: (point: Point) => void;
  onCat: (state: CatInteractionState) => void;
  onLabels: (labels: { id: ZoneId; x: number; y: number }[]) => void;
  onFailure: () => void;
};

export async function createRoomEngine(options: Options): Promise<RoomEngine> {
  const { host, signal } = options;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '像素小屋。点击地面行走，WASD 或方向键移动，靠近家具或小黑后按 E 互动，Esc 起身。');
  host.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
  camera.position.set(11, 10, 14);
  camera.lookAt(0, 1.35, 0);
  let root: THREE.Group;
  const [spriteTexture, petTexture, catTexture] = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
  const textures = [spriteTexture, petTexture, catTexture], bitmaps: ImageBitmap[] = [];
  const disposeTextures = () => { textures.forEach(t => t.dispose()); bitmaps.forEach(b => b.close()); };
  try {
    const [response, ...sprites] = await Promise.all([
      '/models/octopus-room.glb', '/sprites/frieren.png', '/sprites/frieren-pet.png', '/sprites/luoxiaohei.png',
    ].map(url => fetch(url, { signal })));
    if (!response.ok || sprites.some(r => !r.ok)) throw new Error('房间资源加载失败');
    const buffer = await response.arrayBuffer();
    // ImageBitmap ignores Texture.flipY; flip during decode for atlas UVs.
    for (let i = 0; i < sprites.length; i++) {
      const bitmap = await createImageBitmap(await sprites[i].blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      bitmaps.push(bitmap); textures[i].image = bitmap; textures[i].needsUpdate = true;
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    root = (await new GLTFLoader().parseAsync(buffer, '/models/')).scene;
  } catch (error) { disposeTextures(); renderer.dispose(); canvas.remove(); throw error; }
  const player = root.getObjectByName('Player');
  const cat = root.getObjectByName('Cat');
  if (!cat || !player) {
    root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } });
    disposeTextures(); renderer.dispose(); canvas.remove(); throw new Error('房间角色位置标记缺失');
  }
  scene.add(root);
  const illustratedMaterials = createIllustratedMaterials();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== player && ancestor !== cat) ancestor = ancestor.parent;
    object.material = Array.isArray(object.material)
      ? object.material.map(material => illustratedMaterials.convert(material, ancestor === player))
      : illustratedMaterials.convert(object.material, ancestor === player);
  });
  illustratedMaterials.releaseSources();
  root.updateMatrixWorld(true);
  // Merge furniture by material, preserving both animated character hierarchies.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Object3D[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      // Solid voxels need only their back faces in the shadow map. Casting both
      // sides of thin floorboards produces speckled self-shadowing.
      material.shadowSide = THREE.BackSide;
      if (material.name === 'glass') material.depthWrite = false;
    }
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== player && ancestor !== cat) ancestor = ancestor.parent;
    // Tiny eyes and hair strands are smaller than a shadow-map texel. Keep the
    // portrait readable instead of projecting their shadows across the face.
    object.castShadow = object.userData.faceDetail !== true;
    object.receiveShadow = ancestor !== player;
    if (ancestor === player || ancestor === cat || Array.isArray(object.material)) return;
    const geometries = batches.get(object.material) ?? [];
    geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    batches.set(object.material, geometries); remove.push(object);
  });
  for (const object of remove) {
    object.removeFromParent();
    (object as THREE.Mesh).geometry.dispose();
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = material.name !== 'glass'; mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  // Add the already shaded 2D drawing after converting and batching room meshes.
  const walker = createPersonSprite(player, spriteTexture, camera, petTexture);
  const pet = createCatSprite(cat, catTexture, camera);
  player.position.set(ROOM.spawn.x, .112, ROOM.spawn.z);
  const ambient = new THREE.HemisphereLight(0xd4e6e5, 0x647b70, 1.15);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xffe3b2, 2.2);
  sunlight.position.set(-3, 8, 5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 25 });
  sunlight.shadow.bias = -.0002;
  sunlight.shadow.normalBias = .07;
  scene.add(sunlight);
  const lamp = new THREE.PointLight(0xffa349, 19, 6, 2);
  lamp.position.set(-1.07, 2.2, -2.93); scene.add(lamp);
  const libraryLight = new THREE.PointLight(0xffb768, 22, 6, 2);
  libraryLight.position.set(.73, 2.5, -2.5); scene.add(libraryLight);
  const collectionLight = new THREE.PointLight(0xffbb7e, 14, 5, 2);
  collectionLight.position.set(-3.3, 2.5, 1.65); scene.add(collectionLight);
  const windowLight = new THREE.PointLight(0x7697bc, 9, 6, 2);
  windowLight.position.set(-4, 2.4, -2); scene.add(windowLight);
  const backWindowLight = new THREE.PointLight(0xadd8db, 7, 6, 2);
  backWindowLight.position.set(-2.65, 3.1, -3.4); scene.add(backWindowLight);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.20, .24, 4), new THREE.MeshBasicMaterial({ color: 0xf0c078, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .13; ring.visible = false; scene.add(ring);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.35, .37, 32), new THREE.MeshBasicMaterial({ color: 0xe0be85, side: THREE.DoubleSide, transparent: true, opacity: .5 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = .13; scene.add(halo);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let position: Point = { ...ROOM.spawn }, path: Point[] = [], destination: ZoneId | null = null;
  let paused = false, disposed = false, activeZone: ZoneId | null = null;
  let petPhase: CatInteractionState['phase'] = 'idle', petElapsed = 0, petFacingRight = true, blockedTravel = 0;
  const catObstacle = () => [{ ...pet.position, radius: PLAYER_CAT_CLEARANCE }];
  const movePlayer = (delta: Point) => {
    const unobstructed = moveWithCollisions(position, delta);
    const next = moveWithCollisions(position, delta, catObstacle());
    const blocked = distance(unobstructed, next) > .00001;
    if (blocked) pet.stopForPlayer();
    position = next;
    return blocked;
  };
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const towardCamera = new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize();
  const rightPoint = { x: cameraRight.x, z: cameraRight.z }, towardPoint = { x: towardCamera.x, z: towardCamera.z };
  let frame = 0, last = 0, lastReport = 0, hidden = document.hidden;
  const keys = new Set<string>();
  const raycaster = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.09);
  const illustration = createIllustrationRenderer(renderer, scene, camera);
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height, size = Math.max(10.7, 13.8 / aspect);
    camera.left = -size * aspect / 2; camera.right = size * aspect / 2;
    camera.top = size / 2; camera.bottom = -size / 2; camera.updateProjectionMatrix();
    illustration.resize(width, height);
    const labels = ZONES.map(zone => {
      const p = new THREE.Vector3(...zone.anchor as [number, number, number]).project(camera);
      return { id: zone.id, x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
    });
    options.onLabels(labels);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const cancelPetting = () => {
    if (petPhase === 'idle') return;
    petPhase = 'idle'; petElapsed = 0; pet.release();
    path = []; destination = null; ring.visible = false;
    walker.update(0, 0, false, motionPreference.matches);
  };
  const beginPetting = (requireNear = true) => {
    if (paused || petPhase !== 'idle' || (requireNear && distance(position, pet.position) > CAT_INTERACTION_RANGE)) return;
    const spot = findPettingSpot(position, pet.position, rightPoint, towardPoint);
    if (!spot) return;
    clear(); destination = null; ring.visible = false; pet.hold();
    petPhase = 'approaching'; petElapsed = 0; petFacingRight = spot.facingRight;
    path = distance(position, spot) < .04 ? [] : findPath(position, spot, catObstacle());
    blockedTravel = 0;
    canvas.focus({ preventScroll: true });
  };
  const navigate = (to: Point, zone: ZoneId | null = null) => {
    if (paused) return;
    cancelPetting();
    path = findPath(position, to, catObstacle()); destination = path.length ? zone : null; blockedTravel = 0;
    ring.position.set(to.x, .13, to.z); ring.visible = path.length > 0;
  };
  const pointer = (event: PointerEvent) => {
    if (paused || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    if (raycaster.intersectObject(cat.getObjectByName('LuoxiaoheiSprite')!).length) { beginPetting(false); return; }
    const hit = raycaster.ray.intersectPlane(floor, new THREE.Vector3());
    if (hit) navigate({ x: hit.x, z: hit.z });
  };
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
  const direction = (key: string, down: boolean) => {
    if (down && !paused) { cancelPetting(); keys.add(key); path = []; destination = null; ring.visible = false; }
    else keys.delete(key);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || paused) return;
    const key = event.key.toLowerCase();
    if (movementKeys.includes(key)) { event.preventDefault(); direction(key, true); }
    if (key === 'escape') { event.preventDefault(); cancelPetting(); }
    if ((key === 'e' || key === 'enter') && !event.repeat) {
      event.preventDefault();
      if (petPhase !== 'idle') return;
      if (distance(position, pet.position) <= CAT_INTERACTION_RANGE && findPettingSpot(position, pet.position, rightPoint, towardPoint)) beginPetting();
      else if (activeZone) options.onOpen(activeZone);
    }
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const clear = () => { keys.clear(); };
  const visibility = () => { hidden = document.hidden; clear(); last = 0; };
  const contextLost = (event: Event) => { event.preventDefault(); options.onFailure(); };
  canvas.addEventListener('pointerdown', pointer);
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('blur', clear);
  canvas.addEventListener('webglcontextlost', contextLost);
  window.addEventListener('keyup', keyup); window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', visibility);
  const tick = (time: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min((time - (last || time)) / 1000, .04); last = time;
    if (hidden) return;
    const before = { ...position };
    if (!paused && petPhase !== 'petting') {
      const right = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
      if (right || forward) {
        const length = Math.hypot(right, forward);
        movePlayer({ x: (right * .786 - forward * .618) / length * dt * 2.15, z: (-right * .618 - forward * .786) / length * dt * 2.15 });
      } else if (path.length) {
        const target = path[0], d = distance(position, target);
        const amount = Math.min(dt * 2.15, d);
        const blocked = d > .00001 && movePlayer({ x: (target.x - position.x) / d * amount, z: (target.z - position.z) / d * amount });
        blockedTravel = blocked ? blockedTravel + dt : 0;
        if (distance(position, target) < .001) {
          path.shift();
          if (!path.length) { ring.visible = false; const arrival = destination; destination = null; if (arrival) options.onOpen(arrival); }
        } else if (blockedTravel > .25) {
          // A roaming cat may enter a previously clear route. Keep the original
          // goal and wait/replan, never snap across its body to the next point.
          const reroute = findPath(position, path[path.length - 1], catObstacle());
          if (reroute.length) path = reroute;
          blockedTravel = 0;
        }
      }
    }
    if (!paused && petPhase === 'approaching') {
      petElapsed += dt;
      if (!path.length) { petPhase = 'petting'; petElapsed = 0; pet.pet(petFacingRight); }
      else if (petElapsed > 8) cancelPetting();
    }
    if (!paused && petPhase === 'petting') {
      petElapsed += dt;
      if (petElapsed >= PET_DURATION) cancelPetting();
    }
    player.position.set(position.x, walker.update(position.x - before.x, position.z - before.z, paused, motionPreference.matches), position.z);
    pet.update(dt, paused, motionPreference.matches, position);
    if (petPhase === 'petting') walker.pet(petFacingRight, petElapsed, motionPreference.matches);
    halo.position.x = position.x; halo.position.z = position.z;
    const zone = zoneAt(position)?.id ?? null;
    if (zone !== activeZone) { activeZone = zone; options.onZone(zone); }
    if (time - lastReport > 100) {
      options.onPosition(position);
      const cp = pet.position, label = new THREE.Vector3(cp.x, 1.05, cp.z).project(camera);
      options.onCat({ near: distance(position, cp) <= CAT_INTERACTION_RANGE && !!findPettingSpot(position, cp, rightPoint, towardPoint),
        phase: petPhase, x: (label.x + 1) * host.clientWidth / 2, y: (1 - label.y) * host.clientHeight / 2,
        worldX: cp.x, worldZ: cp.z, activity: pet.activity });
      lastReport = time;
    }
    illustration.render();
  };
  frame = requestAnimationFrame(tick);
  const dispose = () => {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('keydown', keydown);
    canvas.removeEventListener('blur', clear); canvas.removeEventListener('webglcontextlost', contextLost);
    window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', visibility);
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      }
    });
    materials.forEach(m => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose(); m.dispose(); });
    disposeTextures();
    illustration.dispose(); illustratedMaterials.dispose();
    renderer.dispose(); canvas.remove();
  };
  if (signal.aborted) { dispose(); throw new DOMException('Aborted', 'AbortError'); }
  return {
    dispose, direction, petCat() { beginPetting(); }, goToCat() { beginPetting(false); },
    pause(value) { cancelPetting(); paused = value; clear(); path = []; destination = null; ring.visible = false; },
    setNight(value) {
      walker.setNight(value);
      pet.setNight(value);
      ambient.intensity = value ? .8 : 1.45; sunlight.intensity = value ? 2.1 : 3.0;
      lamp.intensity = value ? 5 : 2; libraryLight.intensity = value ? 4 : 1.5;
      collectionLight.intensity = value ? 4 : 1.5;
      windowLight.intensity = value ? 5 : 10; backWindowLight.intensity = value ? 4 : 9;
    },
    goTo(id) { const zone = ZONES.find(z => z.id === id); if (zone) { canvas.focus({ preventScroll: true }); navigate(zone, id); } },
    reset() { cancelPetting(); position = findFreePosition(ROOM.spawn, catObstacle()) ?? position; walker.reset(); clear(); path = []; destination = null; ring.visible = false; canvas.focus({ preventScroll: true }); },
  };
}
