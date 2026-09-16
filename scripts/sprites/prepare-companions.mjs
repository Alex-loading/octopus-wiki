import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const specs = [
  { source: 'luoxiaohei-source.png', output: 'luoxiaohei.png', rows: 7, drawnHeight: 54 },
  { source: 'frieren-pet-source.png', output: 'frieren-pet.png', rows: 2, drawnHeight: 56 },
];
for (const spec of specs) {
  const { data, info } = await sharp(new URL(`assets/pixel-room/sprites/${spec.source}`, root).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = data.subarray(i, i + 4);
    if (a < 128 || (r > 110 && b > 110 && Math.min(r, b) - g > 60)) data.fill(0, i, i + 4);
    else data[i + 3] = 255;
  }
  const tile = 80, baseline = 74, frames = [];
  // Generated rows can have unequal outer padding. Find their transparent
  // gutters before slicing, so a ponytail or ear cannot land in another frame.
  const bands = [];
  let bandStart = -1;
  for (let y = 0; y <= info.height; y++) {
    let count = 0;
    if (y < info.height) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]) count++;
    if (count > 5 && bandStart < 0) bandStart = y;
    if (count <= 5 && bandStart >= 0) {
      if (y - bandStart > 10) bands.push([Math.max(0, bandStart - 2), Math.min(info.height, y + 2)]);
      bandStart = -1;
    }
  }
  if (bands.length !== spec.rows) throw new Error(`Expected ${spec.rows} separated rows in ${spec.source}, got ${bands.length}`);
  for (let row = 0; row < spec.rows; row++) for (let col = 0; col < 4; col++) {
    const left = Math.round(col * info.width / 4), top = bands[row][0];
    const width = Math.round((col + 1) * info.width / 4) - left;
    const height = bands[row][1] - top;
    const pixels = await sharp(data, { raw: info }).extract({ left, top, width, height }).raw().toBuffer();
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (minX >= maxX) throw new Error(`Missing frame ${row}/${col}`);
    frames.push({ row, col, pixels, width, height, minX, minY, maxX, maxY });
  }
  const scale = spec.drawnHeight / Math.max(...frames.map(f => f.maxY - f.minY + 1));
  const composites = [];
  for (const f of frames) {
    const idle = frames[f.row * 4];
    let lowX = idle.width, highX = 0;
    for (let y = idle.maxY - Math.ceil((idle.maxY - idle.minY) * .08); y <= idle.maxY; y++)
      for (let x = 0; x < idle.width; x++) if (idle.pixels[(y * idle.width + x) * 4 + 3]) { lowX = Math.min(lowX, x); highX = Math.max(highX, x); }
    const anchorX = (lowX + highX) / 2;
    const width = Math.round((f.maxX - f.minX + 1) * scale), height = Math.round((f.maxY - f.minY + 1) * scale);
    const input = await sharp(f.pixels, { raw: { width: f.width, height: f.height, channels: 4 } })
      .extract({ left: f.minX, top: f.minY, width: f.maxX - f.minX + 1, height: f.maxY - f.minY + 1 })
      .resize(width, height, { kernel: 'nearest' }).png().toBuffer();
    const x = Math.round(tile / 2 + (f.minX - anchorX) * scale);
    if (x < 1 || x + width > tile - 1) throw new Error(`Frame exceeds gutter ${spec.output} ${f.row}/${f.col}`);
    composites.push({ input, left: f.col * tile + x, top: f.row * tile + baseline - height });
  }
  await sharp({ create: { width: tile * 4, height: tile * spec.rows, channels: 4, background: '#00000000' } })
    .composite(composites).png().toFile(new URL(`public/sprites/${spec.output}`, root).pathname);
  console.log(`Prepared ${spec.output}: ${spec.rows * 4} frames`);
}
await writeFile(new URL('assets/pixel-room/sprites/companions.json', root), JSON.stringify({ tile: 80, baseline: 74, columns: 4, assets: specs }, null, 2) + '\n');
