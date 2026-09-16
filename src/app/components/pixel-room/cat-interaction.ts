import { PLAYER_CAT_CLEARANCE, distance, findPath, isWalkable, type Point } from './navigation';

export const CAT_INTERACTION_RANGE = 1.2;
export const PET_DURATION = 3.4;

/** Approach from either side with the cat slightly nearer the viewer. This
 * places the lowered hand at head height, without teleporting either actor. */
export function findPettingSpot(player: Point, cat: Point, right: Point, towardCamera: Point) {
  const obstacles = [{ ...cat, radius: PLAYER_CAT_CLEARANCE }];
  const candidates = [-1, 1].map(side => ({
    x: cat.x + right.x * side * .63 - towardCamera.x * .45,
    z: cat.z + right.z * side * .63 - towardCamera.z * .45,
    facingRight: side < 0,
  })).filter(point => {
    if (!isWalkable(point, obstacles)) return false;
    // Never offer a stroke through a cabinet or from the other side of a desk.
    for (let step = 0; step <= 12; step++) {
      const t = step / 12;
      if (!isWalkable({ x: point.x + (cat.x - point.x) * t, z: point.z + (cat.z - point.z) * t })) return false;
    }
    return distance(player, point) < .04 || findPath(player, point, obstacles).length > 0;
  });
  candidates.sort((a, b) => distance(player, a) - distance(player, b));
  return candidates[0] ?? null;
}
