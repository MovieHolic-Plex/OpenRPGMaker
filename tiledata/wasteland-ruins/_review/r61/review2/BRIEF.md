You are an independent, adversarial visual QA reviewer for 16px RPG chipset art. You have no prior scores; judge only what you see. Do not modify any file except your verdict file. Do not run tests, gates, vitest, tsc, git stash, servers or browsers. Use Read on images and small python (PIL) crops/zooms under /tmp/r61-rev2-<LETTER>/. Before each python run check `uptime`; if the 1-min load is above 40, sleep 60 and re-check.

Subject: five NEW transparent ground decals for the post-apocalypse chipset `wasteland_ruins` (16px, 3/4 top-down, modern-city palette family). They lie flat on the packed-dirt ground (layer 2, under characters):
- oil-stain-a, oil-stain-b (1x1): engine oil soaked into packed earth, placed beside wrecked cars, generators, drums.
- scorch-a, scorch-b (1x1): burnt patch with ash flecks and charred sticks, placed beside campfires and ruined buildings.
- crop-bed-c (3x2): a small garden bed seen from above, weathered plank frame around tilled ridges with bean plants, placed inside a fenced garden plot in survivor settlements (two beds per plot are separated by a drum/crate cell and offset vertically).

Material in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r61/review2/:
- <piece>-1x.png and <piece>-3x.png: each piece laid on the real dirt ground (the object-gate sample board).
- map-*.png: real generated maps at 1x (16 px per cell) where these decals are in use. Find them: dark oil blots next to cars/drums/generators, scorch patches next to campfires/ruins, the fenced garden (crop-bed) in settlement maps. Note: green weed tufts and dry-grass decals scattered on open dirt are a different, older decal and out of scope; do not mistake them for crop beds. Judge only these five decals and how they sit in the maps; other art is out of scope. The green square near a map edge is the player-start marker.
- ref-beodeul-sheet-2x.png: quality bar (Beodeul hand-pixel chipset). ref-modern-city-2x.png: palette/family reference.

Checklist, PASS/FAIL per piece with evidence:
1. 3/4 top-down: flat decals read as lying on the ground (no standing face, no side view); the crop bed frame and plants read as seen from above.
2. Reads as what it is: oil reads as oil soaked into earth (not a hole, pit, water puddle, shadow blob or bug); scorch reads as a burnt patch (not a hole, mud or rock); crop bed reads as a planted garden bed (not a crate, rug, grille or barcode).
3. Quality bar next to Beodeul at the same scale: enough shading steps for each material, no flat fills, no single-pixel salt-and-pepper noise, no hard square or cell-shaped outline, edges blend into the dirt.
4. In the maps at 1x: placement makes sense (oil by vehicles/drums/generators, scorch by fires/ruins, garden inside a fence), no visible identical stamp rows, no cell-border seam or square cut.
5. Not toy-like or amateur.

Inspect at real zoom (crop and 3x/4x upscale). Do not judge from overviews only.

Write /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r61/review2/verdict-<LETTER>.md:
first line `VERDICT: <piece>=PASS|FAIL, ...` for all five pieces; then one line per piece × checklist item (`<piece> n: PASS|FAIL — reason, evidence crop path`); then `FIXES:` with concrete pixel-level fixes for each failing piece. A piece passes only if all 5 items pass. Be adversarial but concrete. End your reply with the verdict line.
