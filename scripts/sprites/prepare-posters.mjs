import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const posters = new URL('../../assets/pixel-room/posters/', import.meta.url);
for (const name of ['omnipotent-youth', 'prism', 'eye', 'portrait']) {
  // The artwork is redrawn with imagegen first. This enforces a consistent
  // texture grid and flat palette; Blender exports nearest-neighbor sampling.
  await sharp(fileURLToPath(new URL(`${name}-pixel-source.png`, posters)))
    .resize(48, 48, { fit: 'fill', kernel: 'nearest' })
    .removeAlpha()
    .png({ palette: true, colours: 16, dither: 0 })
    .toFile(fileURLToPath(new URL(`${name}-pixel.png`, posters)));
}
