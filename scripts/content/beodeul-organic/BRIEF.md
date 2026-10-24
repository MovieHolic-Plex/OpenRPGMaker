# beodeul_organic — artist brief

Natural props for Beodeul fields and the B1 broadleaf woodland (Fallen Star forest uses it). Shared assets.
Code pixel art only: no generated images, no copying a Beodeul kit's pixels as a "new" drawing.

## Files
- `spec.json`: item id, cell size (w,h in 16px cells), layer, blocking cells, gate kind, family.
- `palette.json`: the locked palette. Every opaque colour is one the Beodeul kits already use. Do not add colours.
  Translucent pixels: only the ground shadow, key value `"s"` (alpha 42) or `"S"` (alpha 90).
- `draw.py`: write `art/<family>.py` with `ART = {id: (rows, keys)}`. rows = exactly h*16 strings of exactly w*16 chars. '.' = transparent.
- `python3 draw.py <module>` then `python3 check.py out <family>` (mechanical) then
  `python3 preview.py <family> /tmp/<you>.png 6` and Read that PNG (Beodeul references on the left, yours on the right, 1x row below).
- Reference crops (Read these first, at 6x): `/tmp/beodeul-organic-refs/*-6x.png`; per-kit PNGs at 1x are in the same folder.

## Style contract (Beodeul, measured)
- View: the chipset's fixed 3/4 top-down. Light from the upper left. Rocks show a lit top surface and a darker front/lower side;
  logs show a lit top band (often moss) and a bark front face; stumps show the cut ring top (an ellipse, foreshortened) and bark front.
- Outline: the material's own darkest tone (rock #1a2323/#262729, wood #1e150a/#2a1a0f, leaf #071d1b/#0a201c), never pure black.
  Inner contour lines where one lump overlaps another.
- Shading: 4-7 tones per material in clustered pixel groups (2-4 px clumps), not single-pixel noise and not smooth gradients/flat bands.
  Leafy masses = many small irregular lobes, dark holes between lobes, lit clumps on the upper-left, deep shadow lower-right. Not balls, eggs or domes.
  Silhouettes irregular and asymmetric; no geometric primitives (no perfect ellipse rock, no rectangle log body without bark texture).
- Ground contact: a soft ground shadow (s/S) 1-3 rows under the lower-right of standing objects (layer 3). Base not cut flat along a straight line for rocks/bushes.
- Leaf greens: use the Beodeul tree/bush ramp: #071d1b #063328 #104c2f #296535 #497f3c #94b353 (darker woodland), or the brighter bush ramp
  #071f1d #08372c #0a5134 #226b39 #418640 #8cbf5f, or the ground-decor ramp #0a201c #123624 #1e522a #347430 #5c983a #96c254. No olive/yellow-green leaves.
- Rock greys: #1a2323 #262729 #3e403d #595b58 #797a84 #929491 #c4c6c3 #dee0dd (cool) or the slag ramp #151019 #231c26 #3a2e38 #584a52 #7a6a6c #a09088.
- Wood: #1e150a #2a1a0f #452a17 #543719 #633712 #6f4725 #885a26 #b77541, cut faces #bcaaa0 #d9d2be.
- Scale: a character is 16x24. A 1x1 small rock is knee high; a 2x2 boulder is about chest high.
- Small walk-over decor (layer 2: flowers, tufts, ferns-s, mushrooms, pebbles) sits in the lower 2/3 of the cell, leave the top rows empty,
  keep it small and airy so grass shows through — like the Beodeul deep-forest-path wild/fern/toadstool cells.
- Vary: two items of the same family must not read as the same drawing recoloured.
- Sit naturally between the B1 woodland trees (bd-tree-1a786c, bd-tree-d43edd in trees-6x.png): same darkness and saturation, not brighter or cleaner.

## Self-check before you report
Compare every piece to the Beodeul references at 6x and at 1x. Ask for each: does it read as the named thing? Same outline darkness,
same tone count, same clumping? Fix silhouette first, then values, then detail. Do not report numbers as quality; report what you saw.

## Round-1 adversarial QA lessons (0/37 passed) — apply to every piece
1. **Lit edges have no black outline.** Beodeul bushes, crowns, caps and rock/log tops end in the material's own mid/dark tone on the
   upper-left (lit) side; only the lower-right/shadow side gets the darkest tone. A full dark ring makes a sticker.
2. **Warm materials.** Rocks: use the slag/warm ramp (#231c26 #3a2e38 #584a52 #7a6a6c #a09088) or the warm cool-mix of the snowfield rock
   (#262729 #3e403d #595b58 #929491 #c4c6c3) — not a cold charcoal. Cut wood / stump tops: warm cream-tan (#b77541 #bcaaa0 #d9d2be with
   #885a26 rings), never chalk-white or grey. Pale mushrooms: warm cream (#ecd6c6 #d9d2be #bcaaa0) with brown/violet shade (#8f6b61 #562945).
3. **Moss = the darker woodland leaf ramp** (#063328 #104c2f #296535 #497f3c, lit #94b353 sparingly), never the bright #96c254/#8cbf5f everywhere.
4. **No 1px noise, no 1px parallel lines.** Detail is 2-4 px clusters. No checkerboard leaflets, no comb/railing of 1px blades,
   no straight 1px vertical bark stripes, no isolated single highlight pixels, no stray floating pixels or green spikes on tops.
5. **Shadows/bases:** soft s/S shadow lies on the ground under the lower-right; no dark pillar under a stone, no flat black base line
   under mushrooms or grass, no flat-cut straight bottom.
6. **3/4 view:** rocks and slabs show a broad lit top plane flowing into a darker front with 2-3 intermediate tones (no hard horizontal
   split = "snow cap"). Stumps show a foreshortened warm ring top. Logs show a lit top band and a bark front, cut end warm (not a
   black-ringed eyeball).
7. **No templates/recolours.** Each flower colour gets its own blossom shape and stem layout (no 3x3 '+' stamp), grass-reeds is its own
   drawing with warm brown/ochre seed heads (#856234 #9b753d #cf9558), flowers-patch is an irregular overlapping clump, not a row.
8. **Silhouettes:** no egg/pill/ball/sausage/cucumber shapes. Asymmetric lumps with notches. Beodeul bushes: 3-4 px lobes, open edges.
9. **Scale:** hollow-tree trunk at most ~1.5x a Beodeul tree trunk wide... it may be stout but must not be a 3-cell-wide pillar of stripes;
   stump-l no wider than a big Beodeul tree base.
