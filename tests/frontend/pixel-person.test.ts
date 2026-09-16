import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import sharp from 'sharp';
import { Group, Mesh, NearestFilter, OrthographicCamera, Sprite, Texture, Vector3 } from 'three';
import { createPersonSprite, createSpriteMotion, PERSON_ATLAS, spriteFacing } from '../../src/app/components/pixel-room/person.ts';

test('walking artwork follows four screen directions and keeps its facing when stopped', () => {
  assert.equal(spriteFacing(1, 0, 'front'), 'right');
  assert.equal(spriteFacing(-1, 0, 'front'), 'left');
  assert.equal(spriteFacing(0, 1, 'front'), 'back');
  assert.equal(spriteFacing(0, -1, 'back'), 'front');
  assert.equal(spriteFacing(0, 0, 'left'), 'left');
  assert.equal(spriteFacing(1, 1.03, 'right'), 'right', 'small diagonal variations should not flicker');
  assert.equal(spriteFacing(.95, 1, 'back'), 'back');
});

test('walk frames follow actual travel; stopping, pausing and reduced motion keep feet still', () => {
  const motion = createSpriteMotion();
  const frames = new Set<number>();
  for (let n = 0; n < 60; n++) frames.add(motion.update(.03, 1, 0, false, false).column);
  assert.equal(frames.size, 4);
  const before = motion.update(.1, 0, -1, false, false);
  for (let n = 0; n < 60; n++) assert.deepEqual(motion.update(.03, -1, 0, true, false), before);
  assert.equal(motion.update(0, 0, 0, false, false).column, 0);
  for (let n = 0; n < 60; n++) assert.equal(motion.update(.03, -1, 0, false, true).column, 0);
  motion.reset();
  assert.deepEqual(motion.update(0, 0, 0, false, false), { facing: 'front', column: 0, row: 0 });
});

test('the avatar is a depth-tested 2D sprite, anchored to its boot baseline for all directions', () => {
  const camera = new OrthographicCamera(-8, 8, 6, -6, .1, 100);
  camera.position.set(11, 10, 14); camera.lookAt(0, 1.35, 0); camera.updateMatrixWorld();
  const player = new Group(), texture = new Texture();
  const avatar = createPersonSprite(player, texture, camera);
  const sprite = player.getObjectByName('FrierenSprite') as Sprite;
  assert.ok(sprite.isSprite);
  const meshes: Mesh[] = [];
  player.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
  assert.deepEqual(meshes.map(m => m.name), ['SpriteContactShadow'], 'there must be no 3D body or limbs');
  assert.equal(sprite.material.depthTest, true);
  assert.equal(sprite.material.depthWrite, true, 'furniture and cat must occlude the sprite normally');
  assert.equal(sprite.material.alphaTest, .5, 'transparent corners must not obscure the scene');
  assert.equal(texture.magFilter, NearestFilter);
  assert.equal(texture.generateMipmaps, false);
  assert.equal(sprite.center.y, 1 - PERSON_ATLAS.baseline / PERSON_ATLAS.tile);
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  avatar.update(right.x * .1, right.z * .1, false, false);
  assert.equal(sprite.userData.facing, 'right');
  assert.equal(texture.offset.y, .25);
  assert.equal(avatar.update(-.618, -.786, false, false), .112);
  assert.equal(sprite.userData.facing, 'back');
  assert.equal(texture.offset.y, 0);
  avatar.update(.618, .786, false, false);
  assert.equal(sprite.userData.facing, 'front');
  assert.equal(texture.offset.y, .75);
  const scale = sprite.scale.clone();
  avatar.setNight(true); avatar.setNight(false);
  assert.equal(sprite.material.color.getHex(), 0xffffff);
  assert.ok(sprite.scale.equals(scale));
  avatar.reset();
  assert.equal(sprite.userData.frame, 0);
});

test('the shipped atlas has real transparency, sixteen complete frames and aligned soles', async () => {
  const file = readFileSync(new URL('../../public/sprites/frieren.png', import.meta.url));
  assert.ok(file.length < 100_000);
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [320, 320, 4]);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    let bottom = 0, count = 0;
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
      const i = ((row * 80 + y) * info.width + col * 80 + x) * 4;
      const [r, g, b, a] = data.subarray(i, i + 4);
      assert.ok(a === 0 || a === 255, 'crisp edges without semi-transparent halos');
      if (!a) continue;
      assert.ok(x > 0 && x < 79 && y > 0 && y < 79, 'transparent gutters prevent adjacent-frame bleeding');
      assert.ok(!(r > 110 && b > 110 && Math.min(r, b) - g > 60), 'no chroma-key background remains');
      count++; bottom = Math.max(bottom, y);
    }
    assert.ok(count > 1300, 'every frame contains a full character');
    assert.equal(bottom, PERSON_ATLAS.baseline - 1, 'every frame rests on the same floor');
  }
});

test('petting uses separate crouching artwork and returns to the walking atlas on interruption', () => {
  const camera = new OrthographicCamera(); camera.position.set(11, 10, 14); camera.lookAt(0, 1.35, 0);
  const player = new Group(), walk = new Texture(), crouch = new Texture();
  const avatar = createPersonSprite(player, walk, camera, crouch);
  const sprite = player.getObjectByName('FrierenSprite') as Sprite;
  const scale = sprite.scale.clone(), baseline = sprite.center.clone();
  avatar.pet(true, .5, false);
  assert.equal(sprite.material.map, crouch); assert.equal(crouch.offset.y, .5);
  assert.equal(sprite.userData.frame, 2);
  avatar.pet(true, .7, false); assert.equal(sprite.userData.frame, 3);
  avatar.pet(false, 1, true); assert.equal(crouch.offset.y, 0); assert.equal(sprite.userData.frame, 2);
  assert.ok(sprite.scale.equals(scale), 'crouching is a drawn bent pose, not a vertically squashed person');
  assert.ok(sprite.center.equals(baseline), 'knees and boots retain the floor anchor');
  avatar.update(0, 0, false, false); assert.equal(sprite.material.map, walk);
});
