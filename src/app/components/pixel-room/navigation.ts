import layout from '../../../../assets/pixel-room/layout.json';

export type Point = { x: number; z: number };
// Radius is the combined clearance of both actors, not just the obstacle.
export type ActorObstacle = Point & { radius: number };
export const PLAYER_CAT_CLEARANCE = .74;
export type ZoneId = 'articles' | 'lab' | 'collections' | 'about';
export type Zone = Point & { id: ZoneId; label: string; subtitle: string; number: string; radius: number; anchor: number[] };
export const ROOM = layout;
export const ZONES = layout.zones as Zone[];
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export function isWalkable(p: Point, actors: readonly ActorObstacle[] = []): boolean {
  const r = ROOM.radius;
  const b = ROOM.bounds;
  return Number.isFinite(p.x) && Number.isFinite(p.z)
    && p.x >= b.minX + r && p.x <= b.maxX - r && p.z >= b.minZ + r && p.z <= b.maxZ - r
    && !ROOM.obstacles.some(o => p.x > o.minX - r && p.x < o.maxX + r && p.z > o.minZ - r && p.z < o.maxZ + r)
    && actors.every(actor => distance(p, actor) >= actor.radius - 1e-8);
}

export function moveWithCollisions(from: Point, delta: Point, actors: readonly ActorObstacle[] = []): Point {
  let p = { ...from };
  // Substeps avoid tunneling through furniture after a slow frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / .09));
  for (let i = 0; i < steps; i++) {
    const x = { x: p.x + delta.x / steps, z: p.z };
    if (isWalkable(x, actors) && clearsActors(p, x, actors)) p = x;
    const z = { x: p.x, z: p.z + delta.z / steps };
    if (isWalkable(z, actors) && clearsActors(p, z, actors)) p = z;
  }
  return p;
}

export function zoneAt(p: Point): Zone | null {
  return ZONES.find(z => distance(p, z) <= z.radius) ?? null;
}

function clearsActors(a: Point, b: Point, actors: readonly ActorObstacle[]) {
  const dx = b.x - a.x, dz = b.z - a.z, lengthSquared = dx * dx + dz * dz;
  return actors.every(actor => {
    const t = lengthSquared ? Math.max(0, Math.min(1, ((actor.x - a.x) * dx + (actor.z - a.z) * dz) / lengthSquared)) : 0;
    return distance({ x: a.x + dx * t, z: a.z + dz * t }, actor) >= actor.radius - 1e-8;
  });
}

/** Reset safely even when the cat is standing on the usual spawn point. */
export function findFreePosition(origin: Point, actors: readonly ActorObstacle[]): Point | null {
  if (isWalkable(origin, actors)) return { ...origin };
  for (let radius = .15; radius <= 2; radius += .15) for (let step = 0; step < 32; step++) {
    const angle = step / 32 * Math.PI * 2;
    const candidate = { x: origin.x + Math.cos(angle) * radius, z: origin.z + Math.sin(angle) * radius };
    if (isWalkable(candidate, actors)) return candidate;
  }
  return null;
}

function clearSegment(a: Point, b: Point, actors: readonly ActorObstacle[]) {
  if (!isWalkable(a, actors) || !isWalkable(b, actors) || !clearsActors(a, b, actors)) return false;
  // Intersect the entire segment with inflated furniture rectangles. Sampling
  // can miss a corner by a few millimetres and leave a wider character stuck.
  return !ROOM.obstacles.some(obstacle => {
    let enter = 0, leave = 1;
    for (const [origin, delta, min, max] of [
      [a.x, b.x - a.x, obstacle.minX - ROOM.radius, obstacle.maxX + ROOM.radius],
      [a.z, b.z - a.z, obstacle.minZ - ROOM.radius, obstacle.maxZ + ROOM.radius],
    ]) {
      if (Math.abs(delta) < 1e-10) {
        if (origin <= min || origin >= max) return false;
      } else {
        const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
      if (enter >= leave - 1e-10) return false;
    }
    return true;
  });
}

/** A* on a small grid, then line-of-sight smoothing. No diagonal corner cutting. */
export function findPath(from: Point, to: Point, actors: readonly ActorObstacle[] = []): Point[] {
  if (!isWalkable(from, actors) || !isWalkable(to, actors)) return [];
  if (clearSegment(from, to, actors)) return [to];
  const step = .25;
  const gridPoint = (x: number, z: number): Point => ({ x: x * step, z: z * step });
  const key = (x: number, z: number) => `${x},${z}`;
  const start = { x: Math.round(from.x / step), z: Math.round(from.z / step) };
  // The rounded cell can touch furniture. Find a reachable nearby start.
  const candidates = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dz => ({ x: start.x + dx, z: start.z + dz })))
    .filter(p => clearSegment(from, gridPoint(p.x, p.z), actors))
    .sort((a, b) => distance(from, gridPoint(a.x, a.z)) - distance(from, gridPoint(b.x, b.z)));
  if (!candidates.length) return [];
  const first = candidates[0];
  type Node = { x: number; z: number; g: number; f: number; parent?: Node };
  const open: Node[] = [{ ...first, g: 0, f: 0 }];
  const costs = new Map<string, number>([[key(first.x, first.z), 0]]);
  let goal: Node | undefined;
  for (let visited = 0; open.length && visited < 2500; visited++) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const p = gridPoint(current.x, current.z);
    if (distance(p, to) < .4 && clearSegment(p, to, actors)) { goal = current; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = current.x + dx, z = current.z + dz, next = gridPoint(x, z);
      if (!clearSegment(p, next, actors)) continue;
      const g = current.g + Math.hypot(dx, dz) * step;
      if (g >= (costs.get(key(x, z)) ?? Infinity)) continue;
      costs.set(key(x, z), g);
      open.push({ x, z, g, f: g + distance(next, to), parent: current });
    }
  }
  if (!goal) return [];
  const path: Point[] = [to];
  for (let node: Node | undefined = goal; node; node = node.parent) path.unshift(gridPoint(node.x, node.z));
  const smooth: Point[] = [];
  let previous = from;
  for (let i = 0; i < path.length;) {
    let far = i;
    for (let j = i + 1; j < path.length; j++) {
      if (!clearSegment(previous, path[j], actors)) break;
      far = j;
    }
    smooth.push(path[far]); previous = path[far]; i = far + 1;
  }
  return smooth;
}
