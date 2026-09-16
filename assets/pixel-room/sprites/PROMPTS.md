# Frieren sprite generation prompts

Generated using the built-in imagegen tool. The first source used the user's two images as style and character references. The second pass changed only the background to chroma-key magenta because the first result contained a baked checkerboard. `prepare-frieren.mjs` converts the key to alpha, aligns foot baselines, and downsamples with nearest-neighbor filtering.

## Initial prompt

Use case: stylized-concept.
Asset type: production-ready 2D pixel-art character spritesheet for a 2.5D top-down room game.
Input images: first image is STYLE reference only (hand-pixelled RPG sprites with dark outlines, deliberate clusters of flat shaded pixels and beautiful compact shading). Second image is CHARACTER reference: Frieren from Frieren: Beyond Journey's End. Keep her ivory/silver side-parted hair, long curled twin ponytails, calm half-lidded green eyes, pointed elf ears, small red earrings, ivory gold-trimmed short cape and skirt, dark brown striped inner tunic, dark leggings, brown boots. EMPTY HANDS, NO STAFF, no weapons.
Create exactly ONE 1024 x 1024 RGBA spritesheet, transparent background, exactly 4 equal columns and 4 equal rows, 16 frames total, 256x256 per cell. Each frame is drawn on a 64x64 logical pixel grid then nearest-neighbor enlarged 4x, sharp aligned square pixels, no antialiasing, no smooth 3D render, no voxels. Detailed elegant Japanese RPG sprite, approximately 2.8 heads tall, consistent character size and palette in every cell.
ROW 1: facing camera / south (front view) in all four frames.
ROW 2: facing screen left / west (left side view) in all four frames.
ROW 3: facing screen right / east (right side view) in all four frames.
ROW 4: facing away / north (back of head and cape, NO face visible) in all four frames.
COLUMNS in EACH row: 1=standing idle both boots planted, 2=walking left boot forward right boot back with opposite arm motion, 3=walking passing pose feet beneath hips, 4=walking right boot forward left boot back with opposite arm motion. Subtle hair and skirt sway. Clear distinct foot poses, no enormous steps.
Position each frame centered horizontally in its cell at x=128 and with the lowest boot at local y=224. Sprite fits entirely inside local x=40..216 and local y=24..224. Same height, head size and foot baseline across the sheet. Keep generous transparent separation. Slight high-angle view suitable for RPG 3/4 overhead camera.
Palette: pearl ivory hair with muted lavender shadows, pale peach skin, green eyes, brown/gold clothing borders, white dress with blue-gray shadows, dark plum near-black outline. Shading baked into the drawing with a few clear tonal bands. No ground shadow (engine provides it), no backdrop, NO grid lines, NO labels, NO text, NO UI, NO checkerboard painted into the artwork. Genuine transparent alpha background.

## Background correction

Edit this game spritesheet for engine integration. Preserve ALL sixteen Frieren sprites exactly, their drawing style, colors, outlines, directional rows, dimensions and positions. Change ONLY the checkerboard background: replace EVERY gray/white checkerboard square with one perfectly uniform flat chroma-key magenta #FF00FF, including the empty spaces between ponytails and body. No checkerboard anywhere, no texture, no shadows on the backdrop, no magenta inside character silhouettes. This is an intermediate chroma-key source for lossless alpha conversion by the game build pipeline. Four equal rows by four equal columns, no text, no labels, no frame borders.
