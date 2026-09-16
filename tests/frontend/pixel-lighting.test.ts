import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Box3, DirectionalLight, HemisphereLight, MeshStandardMaterial, PointLight, Scene, ShaderLib, SpotLight, Texture, Vector3, WebGLRenderTarget } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createIllustratedMaterials } from '../../src/app/components/pixel-room/illustration.ts';
import { createRoomLighting } from '../../src/app/components/pixel-room/lighting.ts';

test('night materials change existing shaders and restore the daytime palette without rebuilding', () => {
  const materials = createIllustratedMaterials();
  const source = new MeshStandardMaterial({ color: '#6cabb3', emissive: '#2277ff', emissiveIntensity: 1 });
  source.name = 'blue-led';
  const converted = materials.convert(source);
  const skySource = new MeshStandardMaterial(); skySource.name = 'sky';
  const sky = materials.convert(skySource), daySky = sky.color.clone();
  const dayEmission = converted.emissiveIntensity;
  const shader = { uniforms: {} as Record<string, { value: number }>, fragmentShader: ShaderLib.toon.fragmentShader };
  converted.onBeforeCompile(shader as never, {} as never);
  materials.setNight(true);
  assert.equal(shader.uniforms.roomNight.value, 1);
  assert.ok(converted.emissiveIntensity < dayEmission, 'accent LEDs must not dominate warm lamps at night');
  assert.ok(sky.color.r + sky.color.g + sky.color.b < daySky.r + daySky.g + daySky.b, 'the window becomes dark too');
  materials.setNight(false);
  assert.equal(shader.uniforms.roomNight.value, 0);
  assert.equal(converted.emissiveIntensity, dayEmission);
  assert.ok(sky.color.equals(daySky));
  assert.equal(materials.convert(source), converted, 'theme changes preserve batched material identity');
  materials.releaseSources(); converted.dispose(); sky.dispose(); materials.dispose();
});

test('real room fixtures light their targets, switch with the theme and release shadow maps', async () => {
  const file = readFileSync(new URL('../../public/models/octopus-room.glb', import.meta.url));
  const loader = new GLTFLoader().register(() => ({ name: 'lighting-test-textures', loadTexture: async () => new Texture() }));
  const { scene: root } = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const scene = new Scene(); scene.add(root); scene.updateMatrixWorld(true);
  const lighting = createRoomLighting(scene, root);
  const spots = scene.children.filter((object): object is SpotLight => object instanceof SpotLight);
  assert.equal(spots.length, 3);
  for (const light of spots) {
    const anchor = root.getObjectByName(`Light_${light.name}`)!;
    const aim = root.getObjectByName(`Aim_${light.name}`)!;
    assert.ok(light.position.distanceTo(anchor.getWorldPosition(new Vector3())) < 1e-6, 'fixture transforms also apply to the real light');
    assert.ok(light.target.position.distanceTo(aim.getWorldPosition(new Vector3())) < 1e-6);
    assert.ok(light.position.y > light.target.position.y, 'task lamps illuminate surfaces below their shade');
    assert.ok(light.position.distanceTo(light.target.position) < light.distance);
  }
  const reading = spots.find(light => light.name === 'ReadingLamp')!;
  assert.ok(new Box3().setFromObject(root.getObjectByName('Bed')!).containsPoint(reading.target.position), 'the shelf lamp must reach the bed');
  const ambient = scene.children.find((object): object is HemisphereLight => object instanceof HemisphereLight)!;
  const sun = scene.children.find((object): object is DirectionalLight => object instanceof DirectionalLight)!;
  const day = { ambient: ambient.intensity, sun: sun.intensity, lamps: spots.map(light => light.intensity) };
  lighting.setNight(true);
  assert.ok(ambient.intensity < day.ambient * .5 && sun.intensity < day.sun * .1, 'daylight must recede at night');
  assert.ok(!sun.castShadow && spots.every((light, i) => light.castShadow && light.intensity > day.lamps[i] * 5));
  for (const light of spots) {
    const bounce = scene.getObjectByName(`${light.name}Bounce`) as PointLight;
    assert.ok(bounce instanceof PointLight && bounce.intensity > 0, 'each fixture spills light in every direction');
    assert.ok(bounce.position.equals(light.position));
    assert.ok(bounce.color.r > bounce.color.b && ambient.color.r > ambient.color.b, 'lamp spill and reflected ambient light stay warm');
    assert.ok(bounce.distance > bounce.position.distanceTo(new Vector3(0, .12, 2.5)), 'warm spill reaches the front of the room');
  }
  lighting.setNight(false);
  assert.equal(ambient.intensity, day.ambient); assert.equal(sun.intensity, day.sun);
  assert.deepEqual(spots.map(light => light.intensity), day.lamps);
  assert.ok(sun.castShadow && spots.every(light => !light.castShadow));
  assert.ok(spots.every(light => (scene.getObjectByName(`${light.name}Bounce`) as PointLight).intensity === 0));
  let disposed = 0;
  for (const light of [...spots, sun]) {
    light.shadow.map = new WebGLRenderTarget(1, 1);
    light.shadow.map.addEventListener('dispose', () => disposed++);
  }
  lighting.dispose();
  assert.equal(disposed, 4);
  assert.deepEqual(scene.children, [root], 'unmount removes lights and targets without removing room content');
});
