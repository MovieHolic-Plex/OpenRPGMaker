# Fresh adversarial Opus reviewer — final verdict (r53)

Piece(s): asphalt-in-ne-nw, ne-se, nw-sw, se-sw, ne-nw-sw, ne-se-sw, ne-nw-se-sw. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): 1d376e02c1df (REFER), 9d74b7fa0bd5 (REFER), 42dee77fe9f2 (FAIL), dad405a120d2 (FAIL), e35072f83e4f (FAIL), 319ad06b4fcb (REFER), e070a48a3f35 (FAIL); gate PASS and dev-baked: ne-sw 031c6e8ad730, nw-se 377047cdd490, ne-nw-se 245aa078cd0e, nw-se-sw 44fa9f6b3d2b.

---

All seven pieces fail. The two south-side bites (`se`, `sw`) are the main problem: one is a 1-px black slash and the other is an outlined square notch. Every piece under review contains at least one of these or the square `nw` notch. At 2× the crossings look worse with the decals than without them.

Coordinates below are 1× pixels. For the `*-gate-4x.png` images, (x,y) is in the 112×112 board, so the centre cell is x48–63, y48–63. For `junctions-*-4x.png` it is the 224×192 board.

**1. The `se` bite is a 45° chamfer drawn as a black line (fatal).**
- In `asphalt-in-ne-nw-se-sw-gate-4x.png`, the darkest ledge colour (47,36,24) forms a 1-px diagonal at (63,59), (62,60), (61,61), (60,62).
- A dark-brown (74,56,40) band follows it at (62,59), (61,60), (60,61), with dirt below.
- The same stroke appears at (58–63, 58–63) in `ne-se`, `se-sw` and `ne-se-sw`. On the junction board it is at (58–63, 122–127) on the T and (58–63, 58–63) on the crossing.
- It reads as a drawn slash or crack, not a rounded broken edge. The arms' ledges are horizontal 2-row bands (dark brown over black at y60–61), and nowhere else in the base art is the black used as a 1-px line. So it looks like an outline.

**2. The `sw` bite is an outlined square notch (fatal).**
- In the same gate image, dirt fills a 3×4 rectangle at x48–50, y59–62.
- Dark brown runs along its top at (48–50, 58). A dark column runs down its right side at (51,60), (51,61) and black at (51,62).
- The result is an L-shaped outline around a square plumbing notch. The stems' vertical sides have no dark edge anywhere else, so the right column is a sticker outline.
- It is also not the mirror of `se`: `se` is a diagonal and `sw` is a box, so the two halves of one stem don't match. This appears in `nw-sw`, `se-sw`, `ne-nw-sw`, `ne-se-sw` and `ne-nw-se-sw`, and on the T at (48–51, 122–127).
- Asphalt crumbs at (48,63) and (50,63) sit in a single row directly against the next cell, so they read as noise rather than chips.

**3. The `nw` bite is a flat square block.**
- One flat dark-dirt colour (101,76,57) fills x48–50, y48–51.
- A straight column of lighter asphalt at (51,48–50) acts as the "broken lighter asphalt" rim, so the rim is a straight vertical line.
- The `ne` bite at (60–63, 48–53), by contrast, is irregular and mixes in light-asphalt chips at (61,50) and (62,53). It is the only bite that reads naturally, which makes `nw` and `ne` inconsistent with each other.

**4. Stray specks.**
- Single dark pixels in the road at (53,50) and (60,51) in the gate images.
- On the T in `junctions-with-corners-4x.png`: (53,125) and (58,125).
- They read as specks, not "a dirt fleck".

**5. They don't beat the version without corners.**
- At 2× (both crossings in `junctions-with-corners-4x.png` vs `junctions-no-corners-4x.png`), the four dark bites gather into a dark rosette or "X" knot at each crossing centre.
- Without corners, the centres read cleaner.
- On the T, the bare square inner corner is replaced by a slash on one side and an outlined box on the other. That is no better, and is less consistent with the arms' chipped rims.

`asphalt-in-ne-nw: FAIL`
`asphalt-in-ne-se: FAIL`
`asphalt-in-nw-sw: FAIL`
`asphalt-in-se-sw: FAIL`
`asphalt-in-ne-nw-sw: FAIL`
`asphalt-in-ne-se-sw: FAIL`
`asphalt-in-ne-nw-se-sw: FAIL`

`ne-nw` is the closest to passing: only its `nw` square block (item 3) and the specks hold it back.

**Fixes**
1. **South bites:** never draw a 1-px black outline. Make the ledge the same 2-row band as the arms (dark brown over black), continued from the arm ledge. Step it up toward the stem in 1–2 px stair runs that follow a rounded quarter-curve, with uneven step lengths, not a 45° line.
2. **`sw`:** remove the vertical dark column at x51. Rebuild it as the exact mirror of the fixed `se` (same curve, chips varied), so the two sides of a stem match.
3. **`nw`:** break the flat 3×3 dark-dirt block into the mixed dirt shades used by `ne`. Replace the straight lighter-asphalt column at x51 with scattered light chips along a curved boundary, like `ne` has.
4. **Specks:** remove the lone dark dots at (53,50) and (60,51), and on the T board (53,125) and (58,125). If a dirt fleck is wanted, use one 2-px mid-dirt mark next to a bite, not a dark dot in the open road.
5. **Bite colour:** keep bites at mid dirt, with the darkest values only in the ledge band. That should stop the dark rosette forming at + centres. Re-check the result at 2× against the no-corner board.
6. **Crumbs:** don't put asphalt crumbs in the cell's last pixel row (y63), where they butt straight onto the next cell.
