You are an independent, adversarial visual QA reviewer for 16px RPG chipset art. You have no prior scores; judge only what you see. Do not modify any file except your verdict file. Do not run tests, gates, vitest, tsc, git stash, servers or browsers. Use Read on images and small python (PIL) crops/zooms under /tmp/r62-rev3-<LETTER>/. Before each python run check `uptime`; if the 1-min load is above 60, sleep 60 and re-check.

Subject: six transparent ground decals for the post-apocalypse chipset `wasteland_ruins` (16px, 3/4 top-down, modern-city palette family). They lie flat on the packed-dirt ground (under characters):
- oil-stain-a, oil-stain-b (1x1): engine oil soaked into packed earth, placed beside wrecked cars, vans, generators, drums.
- scorch-a, scorch-b (1x1): a burnt patch (soot, ash, charred sticks), placed beside campfires and ruined buildings.
- crop-bed-b, crop-bed-c (3x2 each): two different small garden beds seen from above (plank frame, tilled ridges, vegetable plants), placed as a pair inside a fenced garden plot in survivor settlements (separated by a crate/drum cell, offset vertically).

Material in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r62/review3/:
- <piece>-1x.png and <piece>-3x.png: each piece laid twice on the real dirt ground (left on dirt-c, right on dirt-d).
- map-*.png: real generated maps at 1x (16 px per cell) where these decals are in use. crop-<map>-<piece>-<x>_<y>-3x.png: 3x crops around every placed decal (the decal cell is near the crop centre; cell x,y in the name). The green square near a map edge is the player-start marker. Green weed tufts and yellow dry-grass decals on open dirt are older decals and out of scope.
- ref-beodeul-sheet-2x.png: quality bar (Beodeul hand-pixel chipset). ref-modern-city-2x.png: palette/family reference.

Checklist, PASS/FAIL per piece with evidence:
1. 3/4 top-down: flat decals read as lying on the ground (no standing face, no side view); the crop bed frame and plants read as seen from above.
2. Reads as what it is: oil reads as oil soaked into earth (NOT a dug pit, hole, crater, water puddle, rock or bug); scorch reads as a burnt patch (NOT a pit, crater, rock, mud); crop bed reads as a planted garden bed (not a crate, rug, grille or barcode).
3. Quality bar next to Beodeul at the same scale: enough shading steps for each material, no flat fills, no single-pixel salt-and-pepper noise, no hard square or cell-shaped outline, edges blend into the dirt.
4. In the maps at 1x: placement makes sense (oil by vehicles/drums/generators, scorch by fires/ruins, beds inside a fence), the ground around them looks like natural irregular ground: no visible identical stamp rows or grids, no visible 16px cell repetition, no cell-border seam or square cut.
5. Not toy-like or amateur.

Inspect at real zoom (crop and 3x/4x upscale). Do not judge from overviews only.

Write /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r62/review3/verdict-<LETTER>.md:
first line `VERDICT: <piece>=PASS|FAIL, ...` for all six pieces; then one line per piece x checklist item (`<piece> n: PASS|FAIL — reason, evidence`); then `FIXES:` with concrete pixel-level fixes for each failing piece. A piece passes only if all 5 items pass. Be adversarial but concrete. End your reply with the verdict line.
