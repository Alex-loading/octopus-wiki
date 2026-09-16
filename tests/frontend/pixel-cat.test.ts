import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import sharp from 'sharp';
import { Group, OrthographicCamera, Sprite, Texture } from 'three';
import { createCatController, createCatSprite, type CatActivity } from '../../src/app/components/pixel-room/cat.ts';
import { findPettingSpot } from '../../src/app/components/pixel-room/cat-interaction.ts';
import { ROOM, PLAYER_CAT_CLEARANCE, distance, findFreePosition, findPath, isWalkable, moveWithCollisions } from '../../src/app/components/pixel-room/navigation.ts';

const right = { x: .786, z: -.618 }, toward = { x: .618, z: .786 };

test('the 2D cat visits all patrol areas, stretches and grooms without crossing furniture', () => {
  const cat = createCatController(), activities = new Set<CatActivity>(), visited = new Set<number>();
  for (let frame = 0; frame < 9000; frame++) {
    cat.update(1 / 60, false, false);
    activities.add(cat.activity);
    assert.ok(isWalkable(cat.position));
    ROOM.cat.patrol.forEach((point, index) => { if (distance(point, cat.position) < .1) visited.add(index); });
  }
  assert.deepEqual([...activities].sort(), ['groom', 'idle', 'stretch', 'walk']);
  assert.equal(visited.size, ROOM.cat.patrol.length);
});

test('holding for petting freezes navigation and release resumes patrol', () => {
  const cat = createCatController();
  for (let i = 0; i < 180; i++) cat.update(1 / 60, false, false);
  cat.hold(); const position = cat.position;
  for (let i = 0; i < 60; i++) cat.update(1 / 60, false, false);
  assert.deepEqual(cat.position, position);
  cat.pet();
  for (let i = 0; i < 240; i++) cat.update(1 / 60, false, false);
  assert.equal(cat.activity, 'happy'); assert.deepEqual(cat.position, position);
  cat.release();
  for (let i = 0; i < 240; i++) cat.update(1 / 60, false, false);
  assert.notDeepEqual(cat.position, position);
});

test('pause freezes action time and reduced motion keeps the cat still', () => {
  const cat = createCatController();
  for (let i = 0; i < 200; i++) cat.update(1 / 60, false, false);
  const position = cat.position, time = cat.elapsed;
  for (let i = 0; i < 120; i++) cat.update(1 / 60, true, false);
  assert.deepEqual(cat.position, position); assert.equal(cat.elapsed, time);
  for (let i = 0; i < 120; i++) cat.update(1 / 60, false, true);
  assert.deepEqual(cat.position, position); assert.equal(cat.elapsed, time);
});

test('blocking the cat stops it, chooses random actions without restarting them, and lets it resume once clear', () => {
  const firstActions = new Set<CatActivity>();
  for (const roll of [0, .5, .99]) {
    const cat = createCatController(() => roll);
    for (let i = 0; i < 120; i++) cat.update(1 / 60, false, false);
    const here = cat.position, target = ROOM.cat.patrol[1], d = distance(here, target);
    const player = { x: here.x + (target.x - here.x) / d * (PLAYER_CAT_CLEARANCE + .04), z: here.z + (target.z - here.z) / d * (PLAYER_CAT_CLEARANCE + .04) };
    cat.update(1 / 60, false, false, player);
    assert.ok(cat.waitingForPlayer); assert.notEqual(cat.activity, 'walk'); firstActions.add(cat.activity);
    const stopped = cat.position;
    for (let i = 0; i < 600; i++) {
      cat.stopForPlayer(); // A held movement key must not reset the reaction each frame.
      cat.update(1 / 60, false, false, player);
      assert.deepEqual(cat.position, stopped);
      assert.ok(distance(cat.position, player) >= PLAYER_CAT_CLEARANCE);
    }
    assert.ok(cat.elapsed > 0);
    for (let i = 0; i < 600; i++) cat.update(1 / 60, false, false, { x: 4, z: 3 });
    assert.notDeepEqual(cat.position, stopped); assert.equal(cat.waitingForPlayer, false);
  }
  assert.deepEqual([...firstActions].sort(), ['groom', 'idle', 'stretch']);
});

test('keyboard movement cannot enter or tunnel through the cat from any side, and can still move away', () => {
  const cat = { x: 0, z: .3 }, obstacles = [{ ...cat, radius: PLAYER_CAT_CLEARANCE }];
  for (let direction = 0; direction < 16; direction++) {
    const angle = direction / 16 * Math.PI * 2;
    let player = { x: cat.x + Math.cos(angle) * 1.05, z: cat.z + Math.sin(angle) * 1.05 };
    for (let frame = 0; frame < 120; frame++) {
      const d = distance(player, cat);
      player = moveWithCollisions(player, { x: (cat.x - player.x) / d * .08, z: (cat.z - player.z) / d * .08 }, obstacles);
      assert.ok(distance(player, cat) >= PLAYER_CAT_CLEARANCE - 1e-8);
    }
    const d = distance(player, cat);
    const away = moveWithCollisions(player, { x: (player.x - cat.x) / d * .15, z: (player.z - cat.z) / d * .15 }, obstacles);
    assert.ok(distance(away, cat) > d);
  }
  const across = moveWithCollisions({ x: -1.4, z: cat.z }, { x: 2.8, z: 0 }, obstacles);
  assert.ok(across.x <= -PLAYER_CAT_CLEARANCE);
});

test('click navigation and petting approaches route around the cat, including the final approach', () => {
  const cat = { x: 0, z: .3 }, obstacles = [{ ...cat, radius: PLAYER_CAT_CLEARANCE }];
  const from = { x: -1.4, z: .3 }, to = { x: 1.4, z: .3 };
  const spot = findPettingSpot(from, cat, right, toward);
  assert.ok(spot);
  for (const target of [to, spot]) {
    const path = findPath(from, target, obstacles);
    assert.ok(path.length); let previous = from;
    for (const next of path) {
      for (let i = 0; i <= 100; i++) {
        const point = { x: previous.x + (next.x - previous.x) * i / 100, z: previous.z + (next.z - previous.z) * i / 100 };
        assert.ok(isWalkable(point, obstacles), 'no smoothed segment crosses the cat or furniture');
      }
      previous = next;
    }
    assert.deepEqual(previous, target);
  }
  assert.deepEqual(findPath(from, cat, obstacles), [], 'do not place the destination inside the cat');
});

test('returning to the room center chooses a free spot when the cat occupies the spawn', () => {
  const obstacles = [{ ...ROOM.spawn, radius: PLAYER_CAT_CLEARANCE }];
  const reset = findFreePosition(ROOM.spawn, obstacles);
  assert.ok(reset && isWalkable(reset, obstacles));
  assert.ok(distance(reset, ROOM.spawn) >= PLAYER_CAT_CLEARANCE);
});

test('petting spots are reachable beside the cat with a clear space for the hand', () => {
  for (const cat of ROOM.cat.patrol) {
    const spot = findPettingSpot(ROOM.spawn, cat, right, toward);
    assert.ok(spot, `no petting spot at ${JSON.stringify(cat)}`);
    assert.ok(isWalkable(spot)); assert.ok(findPath(ROOM.spawn, spot).length);
    assert.ok(distance(spot, cat) > .7 && distance(spot, cat) < .85);
    for (let i = 0; i <= 20; i++) assert.ok(isWalkable({ x: spot.x + (cat.x - spot.x) * i / 20, z: spot.z + (cat.z - spot.z) * i / 20 }));
  }
  assert.equal(findPettingSpot(ROOM.spawn, { x: 3.4, z: -2 }, right, toward), null, 'cannot stroke a cat through a bed');
});

test('Luo Xiaohei uses an upright 2D sprite and responds on the side facing the hand', () => {
  const root = new Group(), texture = new Texture(), camera = new OrthographicCamera();
  camera.position.set(11, 10, 14); camera.lookAt(0, 1.35, 0);
  const cat = createCatSprite(root, texture, camera);
  const sprite = root.getObjectByName('LuoxiaoheiSprite') as Sprite;
  assert.ok(sprite.isSprite);
  cat.hold(); cat.pet(true); cat.update(.05, false, true);
  assert.equal(sprite.userData.row, 6); assert.equal(sprite.userData.frame, 2);
  assert.equal(texture.repeat.x, -.25, 'cat turns left to meet the right-facing person');
  const position = root.position.clone();
  for (let i = 0; i < 120; i++) cat.update(.016, false, false);
  assert.ok(root.position.equals(position));
  cat.pet(false); assert.equal(texture.repeat.x, .25);
  cat.setNight(true); cat.setNight(false); assert.equal(sprite.material.color.getHex(), 0xffffff);
});

test('all cat and crouching frames have transparent gutters and one shared floor baseline', async () => {
  for (const [file, rows] of [['luoxiaohei.png', 7], ['frieren-pet.png', 2]] as const) {
    const input = readFileSync(new URL(`../../public/sprites/${file}`, import.meta.url));
    const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [320, rows * 80, 4]);
    for (let row = 0; row < rows; row++) for (let col = 0; col < 4; col++) {
      let count = 0, bottom = 0, top = 80;
      for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
        const alpha = data[((row * 80 + y) * 320 + col * 80 + x) * 4 + 3];
        assert.ok(alpha === 0 || alpha === 255);
        if (!alpha) continue;
        assert.ok(x > 0 && x < 79 && y > 0 && y < 79);
        count++; bottom = Math.max(bottom, y); top = Math.min(top, y);
      }
      assert.ok(count > 600, `${file} ${row}/${col} missing body`);
      assert.equal(bottom, 73); assert.ok(bottom - top > 35, `${file} ${row}/${col} clipped`);
    }
  }
});

test('walking frame changes keep the drawn cat aligned with its continuous world movement', async () => {
  const { data, info } = await sharp(readFileSync(new URL('../../public/sprites/luoxiaohei.png', import.meta.url))).raw().toBuffer({ resolveWithObject: true });
  // Measure the delivered artwork, independently of the runtime anchor data.
  // The upper head silhouette is stable; paws and tail deliberately move.
  const heads = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => {
    const opaque = (x: number, y: number) => data[((row * 80 + y) * info.width + col * 80 + x) * 4 + 3] > 127;
    let top = 80, bottom = 0;
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) if (opaque(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    let left = 80, right = 0;
    for (let y = top; y < top + Math.round((bottom - top + 1) * .4); y++) for (let x = 0; x < 80; x++) if (opaque(x, y)) { left = Math.min(left, x); right = Math.max(right, x); }
    return (left + right) / 2;
  }));
  const worst = [0, 0, 0, 0], loops = new Set<number>();
  for (const direction of [1, -1]) {
    const root = new Group(), camera = new OrthographicCamera();
    camera.position.set(11 * direction, 10, 14 * direction); camera.lookAt(0, 1.35, 0);
    const cat = createCatSprite(root, new Texture(), camera);
    const sprite = root.getObjectByName('LuoxiaoheiSprite') as Sprite;
    let previous: { row: number; col: number; offset: number } | undefined;
    for (let frame = 0; frame < 2400; frame++) {
      cat.update(1 / 60, false, false);
      const { row, frame: col } = sprite.userData;
      if (cat.activity !== 'walk') { previous = undefined; continue; }
      const offset = heads[row][col] - sprite.center.x * 80;
      if (previous && previous.row === row && previous.col !== col) {
        worst[row] = Math.max(worst[row], Math.abs(offset - previous.offset));
        if (previous.col === 3 && col === 0) loops.add(row);
      }
      previous = { row, col, offset };
    }
    cat.hold(); cat.pet(true);
    assert.equal(sprite.center.x, .5, 'walking offsets must not move the seated petting response');
  }
  assert.equal(loops.size, 4, 'exercise every direction, including the last-to-first frame transition');
  for (let row = 0; row < 4; row++) assert.ok(worst[row] <= 1, `${['down', 'left', 'right', 'up'][row]} artwork jumps ${worst[row]} pixels independently of movement`);
});
