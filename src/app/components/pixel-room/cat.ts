import { CircleGeometry, Mesh, MeshBasicMaterial, NearestFilter, Sprite, SRGBColorSpace, Vector3, type Camera, type Object3D, type Texture } from 'three';
import { ROOM, PLAYER_CAT_CLEARANCE, distance, findPath, moveWithCollisions, type Point } from './navigation';
import { spriteFacing, type Facing } from './person';
import { createUprightSpriteMaterial } from './sprite';

export type CatActivity = 'walk' | 'idle' | 'stretch' | 'groom' | 'happy';

/** Movement is independent from the drawings, so a held cat cannot wander out
 * from underneath the player's hand. Pauses freeze both movement and action time. */
export function createCatController(random: () => number = Math.random) {
  let position: Point = { ...ROOM.cat.spawn }, path: Point[] = [];
  let activity: CatActivity = 'idle', elapsed = 0, duration = 1.4, stride = 0;
  let patrolIndex = 0, stops = 0, held = false, waitingForPlayer = false;
  let movement: Point = { x: 0, z: 0 };
  const beginWalk = (player?: Point) => {
    for (let attempt = 0; attempt < ROOM.cat.patrol.length; attempt++) {
      patrolIndex = (patrolIndex + 1) % ROOM.cat.patrol.length;
      const target = ROOM.cat.patrol[patrolIndex];
      if (distance(position, target) < .15 || (player && distance(player, target) < 1)) continue;
      path = findPath(position, target);
      if (path.length) { activity = 'walk'; elapsed = 0; return; }
    }
    activity = 'idle'; elapsed = 0; duration = 1.5;
  };
  const settle = () => {
    const activities: CatActivity[] = ['stretch', 'groom', 'idle', 'groom', 'stretch', 'idle'];
    activity = activities[stops++ % activities.length];
    duration = activity === 'stretch' ? 3.8 : activity === 'groom' ? 5.2 : 2.1;
    elapsed = 0;
  };
  const blockedAction = () => {
    const choices = (['stretch', 'groom', 'idle'] as const).filter(action => action !== activity);
    activity = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    duration = (activity === 'stretch' ? 3.8 : activity === 'groom' ? 5.2 : 2.1) * (.85 + random() * .3);
    elapsed = 0;
  };
  const stopForPlayer = () => {
    if (held || waitingForPlayer) return;
    waitingForPlayer = true; path = []; movement = { x: 0, z: 0 };
    blockedAction();
  };
  return {
    get activity() { return activity; }, get elapsed() { return elapsed; },
    get stride() { return stride; }, get duration() { return duration; },
    get position() { return { ...position }; }, get movement() { return { ...movement }; },
    get waitingForPlayer() { return waitingForPlayer; },
    stopForPlayer,
    hold() { held = true; waitingForPlayer = false; path = []; activity = 'idle'; elapsed = 0; movement = { x: 0, z: 0 }; },
    pet() { held = true; activity = 'happy'; elapsed = 0; },
    release() { held = false; activity = 'idle'; elapsed = 0; duration = 1.8; },
    update(delta: number, paused: boolean, reducedMotion: boolean, player?: Point) {
      if (paused) return;
      movement = { x: 0, z: 0 };
      if (reducedMotion) return;
      const dt = Math.max(0, Math.min(delta, .05));
      elapsed += dt;
      if (held) return;
      if (waitingForPlayer) {
        if (elapsed >= duration) {
          if (player && distance(position, player) < PLAYER_CAT_CLEARANCE + .22) blockedAction();
          else { waitingForPlayer = false; beginWalk(player); }
        }
        return;
      }
      if (activity === 'walk') {
        const target = path[0];
        if (!target) settle();
        else {
          const d = distance(position, target);
          const amount = Math.min(dt * .69, d);
          const next = d < .025 ? { ...target } : moveWithCollisions(position, { x: (target.x - position.x) / d * amount, z: (target.z - position.z) / d * amount });
          if (player && distance(next, player) < PLAYER_CAT_CLEARANCE + .035 && distance(next, player) < distance(position, player)) {
            stopForPlayer();
          } else {
            // The same body clearance is used by player movement and pathfinding.
            if (player && distance(next, player) < PLAYER_CAT_CLEARANCE) { stopForPlayer(); return; }
            movement = { x: next.x - position.x, z: next.z - position.z };
            stride = (stride + distance(next, position) / .11) % 4;
            position = next;
            if (distance(position, target) < .001) { path.shift(); if (!path.length) settle(); }
          }
        }
      } else if (elapsed >= duration) beginWalk(player);
    },
  };
}

export function createCatSprite(cat: Object3D, texture: Texture, camera: Camera) {
  const controller = createCatController();
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.repeat.set(.25, 1 / 7);
  const material = createUprightSpriteMaterial(camera, { map: texture, alphaTest: .5, transparent: false, depthTest: true, depthWrite: true, toneMapped: false });
  const sprite = new Sprite(material);
  sprite.name = 'LuoxiaoheiSprite'; sprite.center.set(.5, 1 - 74 / 80); sprite.scale.set(1.05, 1.05, 1);
  cat.add(sprite); cat.rotation.set(0, 0, 0); cat.userData.character = 'luoxiaohei-sprite';
  const shadowMaterial = new MeshBasicMaterial({ color: 0x142127, transparent: true, opacity: .28, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.24, 16), shadowMaterial);
  shadow.name = 'CatContactShadow'; shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .7; shadow.position.y = .002; cat.add(shadow);
  const right = new Vector3(), up = new Vector3(), travel = new Vector3();
  let facing: Facing = 'front', happyFlip = false;
  const show = (row: number, col: number, flip = false) => {
    texture.repeat.x = (flip ? -1 : 1) / 4;
    texture.offset.set((col + Number(flip)) / 4, 1 - (row + 1) / 7);
    sprite.userData.frame = col; sprite.userData.row = row; sprite.userData.activity = controller.activity;
  };
  const draw = (reducedMotion: boolean) => {
    const state = controller.activity;
    if (state === 'happy') show(6, reducedMotion ? 2 : Math.min(3, Math.floor(controller.elapsed * 3)), happyFlip);
    else if (reducedMotion) show(0, 0);
    else if (state === 'stretch') show(4, [0, 1, 2, 2, 1, 0][Math.min(5, Math.floor(controller.elapsed / controller.duration * 6))]);
    else if (state === 'groom') show(5, controller.elapsed < .5 ? 0 : 1 + Math.floor(controller.elapsed * 3) % 3);
    else show(['front', 'left', 'right', 'back'].indexOf(facing), state === 'walk' && Math.hypot(controller.movement.x, controller.movement.z) > .00001 ? Math.floor(controller.stride) : 0);
    cat.position.set(controller.position.x, .112, controller.position.z);
  };
  draw(false);
  return {
    get position() { return controller.position; }, get activity() { return controller.activity; },
    stopForPlayer() { controller.stopForPlayer(); },
    hold() { controller.hold(); draw(false); },
    pet(playerFacingRight: boolean) { happyFlip = playerFacingRight; controller.pet(); draw(false); },
    release() { controller.release(); draw(false); },
    update(delta: number, paused: boolean, reducedMotion: boolean, player?: Point) {
      controller.update(delta, paused, reducedMotion, player);
      if (paused) return;
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      travel.set(controller.movement.x, 0, controller.movement.z);
      facing = spriteFacing(travel.dot(right), travel.dot(up), facing);
      draw(reducedMotion);
    },
    setNight(night: boolean) { material.color.set(night ? 0xe5e9f5 : 0xffffff); shadowMaterial.opacity = night ? .34 : .28; },
  };
}
