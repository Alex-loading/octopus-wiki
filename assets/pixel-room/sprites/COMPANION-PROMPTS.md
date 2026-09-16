# Companion sprites

Built-in imagegen was used for both delivered sources. The first generic cat draft was superseded by the user's Luo Xiaohei direction. The delivered cat has a real alpha channel. Sprite preparation preserves it, locates transparent row gutters, uses nearest-neighbor sampling and aligns floor baselines.

Character references: user-supplied `luoxiaohei-reference.png`; additional research at https://www.1905.com/mdb/film/2242929/?fr=mdbypk_zp and https://weibo.com/luoxiaohei .

## Luo Xiaohei

Production-ready 2D pixel RPG sprite sheet of LUO XIAOHEI / 罗小黑, his iconic BLACK CAT FORM. First image is the STRICT CHARACTER MODEL reference. Second image is the PIXEL-ART GAME STYLE reference only. This is NOT a realistic generic pet cat: faithfully retain Luo Xiaohei's enormous rounded black head, tiny compact body and short legs, oversized triangular ears with yellow-green inner ears, huge pale yellow-green oval eyes with gigantic black oval pupils dominating almost the whole face, tiny blue triangular nose/mouth mark, long simple smooth black tail. Almost solid black fur with only restrained charcoal edge highlight, warm dark brown outline. NO fluffy furry texture, NO pink inner ears, NO orange iris, NO white muzzle, NO anthropomorphic human body.
Exactly4 equal columns by7 equal rows, 28 frames total. Canvas1024x1792, eachcell256square. Grid layout strictly uniform. Same character scale in every frame, slight overhead RPG view. Crisp logical64px pixel art enlarged4x nearest-neighbor, clear dark contours and simple clean shaded clusters. Every frame within x24..232,y32..224 of cell, paw baseliney224; transparent gutters represented by uniform solid #FF00FF background. No checkerboard/no grid/no text/no labels/no ground shadows.
Rows1-4 are walking direction sets: row1 FRONT/south; row2 LEFT/west; row3 RIGHT/east; row4 BACK/north showing backs of head and ears, no eyes. Columns in these rows: standing, left step, passing, right step, distinct alternating short paw steps. Natural quadruped walking but huge head tiny body from reference.
Row5 LEFT-facing stretch: standing, beginning bow, forepaws extended play-bow with head lowered and tail/hips raised, recovering.
Row6 FRONT-three-quarter grooming: seated, raises paw, licking paw, wiping cheek.
Row7 RIGHT-facing HAPPY SEATED RESPONSE to being stroked: looks upward, closes eyes contentedly, leans head into unseen hand, relaxed content closed-eye sit. NO HUMAN HAND drawn and NO HEARTS. Keep all rows in the same scale. Luo Xiaohei cute proportions are essential and should be immediately recognizable even at tiny size.

## Frieren crouching / petting

Create an additional animation spritesheet for EXACTLY the same Frieren pixel-art avatar in the reference. Identity, hair, eyes, red earrings, white gold-trimmed clothing, dark tights, brown boots, pixel density and outline match the reference precisely. This is a hand-drawn 2D RPG sprite, not a 3D render.
Purpose: character crouches to pet a small cat on the floor. Draw ONLY the human, NO CAT, NO STAFF, no weapons.
Layout exactly 4 equal columns and 2 equal rows, sheet1024x512, eachcell256x256, solid uniform #FF00FF magenta chroma background, no transparency checkerboard/no text/no grid. Character scale remains fixed across all frames: the standing figure is about 190pixels tall. Boot/knee floor contact baseline in every cell is localy224. Keep art inside cell with empty gutters.
Top row: facing screen RIGHT. Columns: 1 starts bending knees, torso still mostly upright; 2 lowered into a deep squat/kneel with one hand beginning to reach forward; 3 SAME deep squat, torso leaning forward, right hand reaches DOWN AND FORWARD toward cat head at local x205,y182; 4 SAME deep squat and torso, hand shifts gently 8pixels left to stroke head. Head height in deep squat is about130px above ground, compared to190px standing, DO NOT scale down the whole character: physically bend knees and lean torso. Long twin ponytails droop naturally, keep same head size. Empty stroking hand clearly separated from skirt at the right edge.
Bottom row: exact same 4 stages mirrored to face LEFT; petting hand toward localx51,y182. Face soft calm happy expression in both directions.
Crisp pixel clusters, pearl hair with muted lavender shading, 2.8-heads standing proportions. Each figure anchored horizontally around localx128 at its hips/knees. No cat, heart, speech balloon, ground shadow, scenery, UI. Use same logical pixel resolution as reference and clear stepped edges.
