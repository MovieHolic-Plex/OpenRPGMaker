verdict: FAIL

Reviewer: fresh adversarial Opus, r57 draft4, piece hut-tyre (2x3, 32x48). Inspected gate-4x (re-zoomed to 16x), new-vs-existing 1x/3x, modern-city ref, and a pixel dump of rows 26-47 plus `_hut_tyre` source.

## Rule 1 - 3/4 top-down: PASS
Roof is a lit plywood top plane about 25 rows deep (y2..27), with a lip line, then a south front wall y28..45 with the door. There are no side or iso faces. Light comes from the upper left. The proportions are fine.

## Rule 2 - quality: marginal
- The palette is locked and shading is multi-tone. There are no flat fills and no text.
- The roof seam at x17-18 is drawn as a full-height bright tan stripe, the brightest value on the piece. A plywood butt seam should read as a dark gap with a lit edge. As drawn it reads as a painted line or plank strip, and it pulls the eye off the door. This is a minor issue, not a FAIL on its own.
- The tread is `(i + row) % 3` dark dots on two rows. At 1x and 3x this becomes a dotted texture that reads as mortar or speckle, not as tread.

## Rule 3 - distinct: PASS
This is the only piece with a tan plank roof over a dark masonry-looking base. It does not get confused with shack-ply, the 2f shack or the stalls at 1x or 3x.

## Rule 4 - reads as stacked TYRES at 1x: FAIL (the real defect)
At 1x and 3x the front wall reads as a dark slate or rubble-stone (cinder) foundation. It does not read as a stack of tyres, and it does not match the `tyres` prop, whose identity comes from fat, round, navy-black rims around a lighter grey sidewall.

The cause is structural, in the code, not taste:
1. **The courses overlap, so the spec'd silhouette is destroyed.** Each tyre is 5 rows (`j in range(5)`) but courses are spaced every 4 rows (`y0 = 28 + row*4`). Each course's top rim (j=0) overwrites the previous course's darkest bottom rim (j=4). On top of that, the random `dy = 1` shift pushes some tyres down a further row into the next course. Result: the "darkest bottom rim" survives only intermittently (rows 32/36/44 in the dump), and the 2/1 px rounded ends are mostly painted over by the neighbouring course. Without that dark bottom arc each tyre turns into a flat rectangle, and flat dark rectangles in staggered courses are exactly what a stone or block wall looks like.
2. **There is no rubber-black mass.** The wall is mostly mid grey-blue (`h/i/j/k`, ~60-105 luminance) with scattered near-black dots. The `tyres` prop is dominated by the darkest rubber values with a grey top band. The wall's value structure is closer to the existing slate and stone than to the tyre prop. So rule 4's "consistent with the existing 'tyres' prop" is not met.
3. **The tread does not read as diagonal.** The tread rows are offset by only one pixel between the two rows, so they render as a dot field, which reinforces the mortar reading.
4. **The right flank is too narrow.** Beside the door only x27-30 (4 px) of wall remains, so those are tyre fragments that cannot show a rounded end. They read as stone chips.

## Fixes
- Give each course its own 5 rows (pitch 5, y0 = 28 + row*5). That fits 3 courses plus a dirt sill in y28..45, or use 4-row tyres at pitch 4 with no overlap. **Remove the `dy` jitter**, or apply it only as a horizontal offset, so no tyre overwrites another's bottom rim.
- Keep the j=4 darkest rim and the 2/1 px end cuts intact on every tyre, and put dirt only in the corner triangles. Each tyre should read as a lozenge with a dark lower arc.
- Shift the body darker toward the `tyres` prop ramp: rims at rubber 0-1, with only the single sidewall band at rubber 4-6.
- Make the tread a true diagonal: one dark pixel per 2-3 px, offset by 1 px per row across both rows (`/ / /`), with clear 2-px spacing, not a checker of dots.
- Fit whole tyres around the door, for example one short tyre (w ~5) right of the door with full end cuts, or move the door so each flank holds at least one complete tyre.
- Optional: draw the roof seam as a dark 1-px gap with a 1-px lit edge on one side, instead of a full bright stripe.
- Re-check at 1x beside the `tyres` prop. The wall should read as "stacked tyres" before the door does.
