import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// Asset preparation only: chroma key the generated sheet, then align its frames.
// Keep the source artwork intact and use one scale for the entire walk cycle.
const root = new URL('../../', import.meta.url);
const source = new URL('assets/pixel-room/sprites/frieren-source.png', root);
const { data, info } = await sharp(source.pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const [r, g, b] = data.subarray(i, i + 3);
  if (r > 110 && b > 110 && Math.min(r, b) - g > 60) data.fill(0, i, i + 4);
  else data[i + 3] = 255;
}
const tile = 80, baseline = 74, frames = [];
for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
  const left = Math.round(col * info.width / 4), top = Math.round(row * info.height / 4);
  const width = Math.round((col + 1) * info.width / 4) - left;
  const height = Math.round((row + 1) * info.height / 4) - top;
  const pixels = await sharp(data, { raw: info }).extract({ left, top, width, height }).raw().toBuffer();
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  frames.push({ row, col, pixels, width, height, minX, minY, maxX, maxY });
}
const scale = 64 / Math.max(...frames.map(f => f.maxY - f.minY + 1));
const composites = [];
for (const frame of frames) {
  // Anchor each row at the waist of its idle pose, so long side-view ponytails
  // do not pull the body away from its navigation position.
  const idle = frames[frame.row * 4];
  const waistY = Math.round(idle.minY + (idle.maxY - idle.minY) * .70);
  let waistLeft = idle.width, waistRight = 0;
  for (let x = 0; x < idle.width; x++) if (idle.pixels[(waistY * idle.width + x) * 4 + 3]) {
    waistLeft = Math.min(waistLeft, x); waistRight = Math.max(waistRight, x);
  }
  const anchorX = (waistLeft + waistRight) / 2;
  const width = Math.round((frame.maxX - frame.minX + 1) * scale);
  const height = Math.round((frame.maxY - frame.minY + 1) * scale);
  const input = await sharp(frame.pixels, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .extract({ left: frame.minX, top: frame.minY, width: frame.maxX - frame.minX + 1, height: frame.maxY - frame.minY + 1 })
    .resize(width, height, { kernel: 'nearest' }).png().toBuffer();
  const x = Math.round(tile / 2 + (frame.minX - anchorX) * scale);
  if (x < 2 || x + width > tile - 2) throw new Error(`Frame ${frame.row}/${frame.col} exceeds its padding`);
  composites.push({ input, left: frame.col * tile + x, top: frame.row * tile + baseline - height });
}
await mkdir(new URL('public/sprites/', root), { recursive: true });
const output = new URL('public/sprites/frieren.png', root);
await sharp({ create: { width: tile * 4, height: tile * 4, channels: 4, background: '#00000000' } })
  .composite(composites).png().toFile(output.pathname);
await writeFile(new URL('assets/pixel-room/sprites/atlas.json', root), JSON.stringify({
  image: '/sprites/frieren.png', columns: 4, rows: ['front', 'left', 'right', 'back'],
  tileSize: tile, baseline, drawnHeight: 64, columnsMeaning: ['idle', 'step-a', 'passing', 'step-b'],
}, null, 2) + '\n');
console.log(`Prepared ${output.pathname}: 16 transparent ${tile} × ${tile} frames`);
