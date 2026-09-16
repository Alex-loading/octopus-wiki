import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ROOM, ZONES, distance, findPath, isWalkable, moveWithCollisions, zoneAt } from '../../src/app/components/pixel-room/navigation.ts';

test('spawn and every interaction point have enough room for the character', () => {
  assert.ok(isWalkable(ROOM.spawn));
  assert.equal(zoneAt(ROOM.spawn), null);
  for (const zone of ZONES) {
    assert.ok(isWalkable(zone), zone.id);
    assert.equal(zoneAt(zone)?.id, zone.id);
  }
});

test('every room area is reachable from the entrance and every other area without crossing furniture', () => {
  for (const from of [ROOM.spawn, ...ZONES]) for (const to of ZONES) {
    const path = findPath(from, to);
    assert.ok(path.length, `${JSON.stringify(from)} -> ${to.id}`);
    let previous = from;
    for (const point of path) {
      const steps = Math.max(1, Math.ceil(distance(previous, point) / .02));
      for (let i = 0; i <= steps; i++) assert.ok(isWalkable({ x: previous.x + (point.x - previous.x) * i / steps, z: previous.z + (point.z - previous.z) * i / steps }), `blocked route to ${to.id}`);
      previous = point;
    }
    assert.ok(distance(previous, to) < .01);
  }
});

test('walking stops at furniture and walls, even when a frame has a large movement', () => {
  const bed = ROOM.obstacles.find(o => o.id === 'bed')!;
  const hitBed = moveWithCollisions({ x: 1.4, z: -1 }, { x: 4, z: 0 });
  assert.ok(hitBed.x <= bed.minX - ROOM.radius);
  assert.ok(isWalkable(hitBed));
  const hitWall = moveWithCollisions(ROOM.spawn, { x: 0, z: 100 });
  assert.ok(hitWall.z <= ROOM.bounds.maxZ - ROOM.radius);
  assert.ok(isWalkable(hitWall));
  const sliding = moveWithCollisions({ x: bed.minX - ROOM.radius - .03, z: -1.5 }, { x: 1, z: 1 });
  assert.ok(sliding.z > -.6);
  assert.ok(isWalkable(sliding));
});

test('clicks outside the room or inside furniture never produce a path', () => {
  for (const point of [{ x: 20, z: 20 }, { x: 3.4, z: -1 }, { x: 3.4, z: -3 }, { x: NaN, z: 0 }]) {
    assert.equal(isWalkable(point), false);
    assert.deepEqual(findPath(ROOM.spawn, point), []);
  }
});

test('interaction prompts appear only within the intended area', () => {
  for (const zone of ZONES) {
    assert.equal(zoneAt({ x: zone.x + zone.radius - .01, z: zone.z })?.id, zone.id);
    assert.notEqual(zoneAt({ x: zone.x + zone.radius + .05, z: zone.z })?.id, zone.id);
  }
});

test('delivered Blender GLB contains the sprite anchor, black cat and matching navigation anchors', () => {
  const file = readFileSync(new URL('../../public/models/octopus-room.glb', import.meta.url));
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + length));
  assert.match(gltf.asset.generator, /Blender/);
  for (const name of ['Player', 'Cat']) assert.ok(gltf.nodes.some((n: { name: string }) => n.name === name), name);
  assert.equal(gltf.nodes.find((n: { name: string }) => n.name === 'Cat').extras.character, 'luoxiaohei-sprite');
  assert.ok(!gltf.nodes.some((n: { name: string }) => ['CatBody', 'CatHead', 'CatFrontLeft'].includes(n.name)));
  assert.equal(gltf.nodes.find((n: { name: string }) => n.name === 'Player').extras.character, 'frieren-sprite');
  assert.ok(!gltf.nodes.some((n: { name: string }) => ['Character', 'CharacterHead', 'LegLeft', 'ArmLeft'].includes(n.name)), 'the old 3D person is absent from the shipped room');
  assert.ok(!gltf.nodes.some((n: { name: string }) => n.name === 'DeskChair' || n.name === 'Octopus'));
  for (const zone of ZONES) {
    const node = gltf.nodes.find((n: { name: string }) => n.name === `Zone_${zone.id}`);
    assert.ok(node, zone.id);
    assert.ok(Math.abs(node.translation[0] - zone.x) < .001);
    assert.ok(Math.abs(node.translation[2] - zone.z) < .001);
  }
  assert.ok(file.length < 1_500_000, 'Keep the room model small enough for mobile');
});
