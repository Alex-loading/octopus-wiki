import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);

/** Register walking drawings without repainting or resampling the sprite sheet. */
export async function writeCatWalkAnchors() {
  const tile = 80, rows = 4, columns = 4;
  const { data, info } = await sharp(new URL('public/sprites/luoxiaohei.png', root).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== tile * columns || info.height !== tile * 7) throw new Error('Unexpected Luo Xiaohei atlas dimensions');
  const offsetX = Array.from({ length: rows }, (_, row) => {
    const centers = Array.from({ length: columns }, (_, col) => {
      const opaque = (x, y) => data[((row * tile + y) * info.width + col * tile + x) * 4 + 3] > 127;
      let top = tile, bottom = -1;
      for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) if (opaque(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
      if (bottom < top) throw new Error(`Missing walking frame ${row}/${col}`);
      // Use the upper head, excluding the moving feet and the curling tail.
      let left = tile, right = -1;
      for (let y = top; y < top + Math.round((bottom - top + 1) * .4); y++)
        for (let x = 0; x < tile; x++) if (opaque(x, y)) { left = Math.min(left, x); right = Math.max(right, x); }
      return (left + right) / 2;
    });
    return centers.map(center => center - centers[0]);
  });
  await writeFile(new URL('assets/pixel-room/sprites/cat-walk-anchors.json', root), JSON.stringify({ tile, offsetX }, null, 2) + '\n');
  console.log('Registered cat walking anchors:', JSON.stringify(offsetX));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeCatWalkAnchors();
