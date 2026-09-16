import {
  CircleGeometry, Mesh, MeshBasicMaterial, NearestFilter, Sprite,
  SRGBColorSpace, Vector3, type Camera, type Object3D, type Texture,
} from 'three';
import { createUprightSpriteMaterial } from './sprite';

export const PERSON_ATLAS = { columns: 4, rows: 4, tile: 80, baseline: 74, worldSize: 2.08 };
export type Facing = 'front' | 'left' | 'right' | 'back';
const ROWS: Facing[] = ['front', 'left', 'right', 'back'];
const WALK = [1, 2, 3, 0];

/** Choose artwork by screen-space travel, independent of the room's world axes. */
export function spriteFacing(screenX: number, screenY: number, previous: Facing): Facing {
  if (Math.hypot(screenX, screenY) < .0001) return previous;
  // Retain the current axis near diagonals to avoid rapid facing changes while
  // following a path or sliding along the edge of a piece of furniture.
  const horizontal = Math.abs(screenX), vertical = Math.abs(screenY);
  const wasHorizontal = previous === 'left' || previous === 'right';
  if (horizontal > vertical * (wasHorizontal ? .82 : 1.18)) return screenX < 0 ? 'left' : 'right';
  return screenY < 0 ? 'front' : 'back';
}

export function createSpriteMotion() {
  let facing: Facing = 'front', phase = 0, column = 0;
  return {
    update(travelled: number, screenX: number, screenY: number, paused: boolean, reducedMotion: boolean) {
      if (!paused) {
        facing = spriteFacing(screenX, screenY, facing);
        if (travelled > .0001 && !reducedMotion) {
          // Distance, not wall time, drives the feet: blocked paths cannot march.
          phase = (phase + travelled / .22) % WALK.length;
          column = WALK[Math.floor(phase)];
        } else { column = 0; phase = 0; }
      }
      return { facing, column, row: ROWS.indexOf(facing) };
    },
    reset() { facing = 'front'; phase = 0; column = 0; },
  };
}

/** A flat, alpha-cut pixel drawing with a separate contact shadow, no body mesh. */
export function createPersonSprite(player: Object3D, texture: Texture, camera: Camera, petTexture?: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.repeat.set(1 / PERSON_ATLAS.columns, 1 / PERSON_ATLAS.rows);
  texture.offset.set(0, .75);
  if (petTexture) {
    petTexture.colorSpace = SRGBColorSpace;
    petTexture.minFilter = petTexture.magFilter = NearestFilter;
    petTexture.generateMipmaps = false;
    petTexture.repeat.set(.25, .5);
  }
  const material = createUprightSpriteMaterial(camera, {
    map: texture, alphaTest: .5, transparent: false, depthWrite: true, depthTest: true, toneMapped: false,
  });
  material.name = 'Frieren hand-painted pixels';
  const sprite = new Sprite(material);
  sprite.name = 'FrierenSprite';
  // Local origin is the common boot baseline, so frame changes never levitate.
  sprite.center.set(.5, 1 - PERSON_ATLAS.baseline / PERSON_ATLAS.tile);
  sprite.scale.set(PERSON_ATLAS.worldSize, PERSON_ATLAS.worldSize, 1);
  player.add(sprite);
  const shadowMaterial = new MeshBasicMaterial({ color: 0x18242b, transparent: true, opacity: .25, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.32, 16), shadowMaterial);
  shadow.name = 'SpriteContactShadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.y = .68;
  shadow.position.y = .002;
  player.add(shadow);
  player.userData.character = 'frieren-sprite';
  player.rotation.set(0, 0, 0);
  const motion = createSpriteMotion();
  const right = new Vector3(), up = new Vector3(), travel = new Vector3();
  const apply = (state: ReturnType<typeof motion.update>) => {
    material.map = texture;
    sprite.userData.action = 'walk';
    texture.offset.set(state.column / PERSON_ATLAS.columns, 1 - (state.row + 1) / PERSON_ATLAS.rows);
    sprite.userData.facing = state.facing;
    sprite.userData.frame = state.column;
  };
  return {
    update(dx: number, dz: number, paused: boolean, reducedMotion: boolean) {
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      travel.set(dx, 0, dz);
      apply(motion.update(travel.length(), travel.dot(right), travel.dot(up), paused, reducedMotion));
      return .112;
    },
    reset() { motion.reset(); apply(motion.update(0, 0, 0, false, false)); },
    pet(facingRight: boolean, elapsed: number, reducedMotion: boolean) {
      if (!petTexture) return;
      const column = reducedMotion ? 2 : elapsed < .18 ? 0 : elapsed < .38 ? 1
        : elapsed > 3.22 ? 0 : elapsed > 3.04 ? 1 : 2 + Math.floor((elapsed - .38) * 5) % 2;
      material.map = petTexture;
      petTexture.offset.set(column / 4, facingRight ? .5 : 0);
      sprite.userData.facing = facingRight ? 'right' : 'left';
      sprite.userData.frame = column;
      sprite.userData.action = 'pet';
    },
    setNight(night: boolean) {
      // Shared navbar theme only. Keep the drawing readable with a subtle tint.
      material.color.set(night ? 0xdce3f2 : 0xffffff);
      shadowMaterial.opacity = night ? .32 : .25;
    },
  };
}
