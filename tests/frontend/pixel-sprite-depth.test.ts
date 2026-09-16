import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrthographicCamera, Raycaster, Vector2, Vector3, ShaderLib, Texture } from 'three';
import { createUprightSpriteMaterial, uprightDepthSlope } from '../../src/app/components/pixel-room/sprite.ts';

test('standing pixels keep their screen position but use upright world depth near the real desk', async () => {
  const camera = new OrthographicCamera(-8, 8, 6, -6, .1, 100);
  camera.position.set(11, 10, 14); camera.lookAt(0, 1.35, 0); camera.updateMatrixWorld();
  const slope = uprightDepthSlope(camera);
  const material = createUprightSpriteMaterial(camera, {});
  const shader = { uniforms: {}, vertexShader: ShaderLib.sprite.vertexShader };
  material.onBeforeCompile(shader as never, {} as never);
  assert.match(shader.vertexShader, /mvPosition\.z \+= rotatedPosition\.y \* uprightDepthSlope/);
  const file = readFileSync(new URL('../../public/models/octopus-room.glb', import.meta.url));
  // This regression raycasts the real geometry. Embedded poster images do not
  // affect depth, so use texture placeholders without requiring a browser DOM.
  const loader = new GLTFLoader().register(() => ({ name: 'geometry-test-textures', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  scene.updateMatrixWorld(true);
  const desk = scene.getObjectByName('Desk')!;
  const { data } = await sharp(readFileSync(new URL('../../public/sprites/frieren.png', import.meta.url))).raw().toBuffer({ resolveWithObject: true });
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1), right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const foot = new Vector3(-2.4, .112, -1.65), raycaster = new Raycaster();
  let wrongCuts = 0, correctedCuts = 0;
  for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
    if (!data[((240 + y) * 320 + x) * 4 + 3]) continue;
    const sx = (x + .5 - 40) / 80 * 2.08, sy = (74 - y - .5) / 80 * 2.08;
    const flat = foot.clone().addScaledVector(right, sx).addScaledVector(up, sy);
    const view = flat.clone().applyMatrix4(camera.matrixWorldInverse); view.z += sy * slope;
    const corrected = view.applyMatrix4(camera.matrixWorld);
    const upright = foot.clone().addScaledVector(right, sx).add(new Vector3(0, sy / up.y, 0));
    assert.ok(corrected.distanceTo(upright) < 1e-10);
    const oldScreen = flat.clone().project(camera), newScreen = corrected.clone().project(camera);
    assert.ok(Math.abs(oldScreen.x - newScreen.x) + Math.abs(oldScreen.y - newScreen.y) < 1e-10);
    raycaster.setFromCamera(new Vector2(oldScreen.x, oldScreen.y), camera);
    const hit = raycaster.intersectObject(desk, true)[0];
    if (!hit) continue;
    const expectedVisible = hit.distance > raycaster.ray.origin.distanceTo(upright);
    if (expectedVisible && hit.distance < raycaster.ray.origin.distanceTo(flat)) wrongCuts++;
    if (expectedVisible && hit.distance < raycaster.ray.origin.distanceTo(corrected) - 1e-8) correctedCuts++;
  }
  assert.ok(wrongCuts > 50, 'reproduce the reported desk-edge cut on the original billboard');
  assert.equal(correctedCuts, 0, 'the upright depth fix must remove all false cuts');
});
