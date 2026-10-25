verdict: FAIL

Reviewer: fresh adversarial Opus (did not draw it, no prior reviews seen). Inputs: hut-tyre-gate-4x.png (also nearest-upscaled to 12x), new-vs-existing-1x/3x.png, ref-modern-city-2x.png, wl_shanty.py `_hut_tyre`.

## Rule 1 — 3/4 top-down: PASS
- The plywood roof is a lit top plane 25 rows deep (y 2..26) with a slight trapezoid taper. Its front lip is a lit tan line over a dark line, and the south wall (y 28..46) sits below it with the door. There are no side or iso faces and it is not a pure elevation.
- The light direction matches: the stones and brick are lit on the upper-left and shadowed on the lower-right.

## Rule 2 — Quality: borderline PASS
- The colours are palette-locked, the roof is multi-tone with grain strokes, nail heads, a seam and rust, the outline is tinted and the ground shadow is present. There are no text or speckle artifacts.
- Weak spot: the roof's full-width bright tan eave line (y 26) and the bright tan door jamb are the two highest-value strokes on the piece. They pull the eye more than any material detail.
- Weak spot: the wall has a dark navy top band (soot line y 28) that reads as a separate trim strip rather than a shadow under the eave.

## Rule 3 — Distinct: PASS
- At 1x and 3x the silhouette (tall narrow plywood roof over a short grey wall) differs from the corrugated shacks, tents and stalls.
- It also differs from the other new pieces in the top row.

## Rule 4 — Reads as stacked TYRES at 1x: FAIL (real defect)
- At 1x, 3x and 12x the front wall reads as a **grey cut-stone / cinder-block masonry wall**. In the 1x strip it is indistinguishable from a stone foundation course.
- Cause 1: the bands use mid-grey `roof` ramp values 2..4 with a pale top row. That is a lit masonry face, not black rubber. The existing `tyres` prop at the end of the bottom row is near-black with a blue-teal sheen, so it uses a different, darker material language. The two pieces do not even agree on what a tyre looks like.
- Cause 2: each "tyre" is a 4-px-tall rectangle 8–10 px wide. The rounded ends drop only 2 corner pixels, so the shape stays a brick with chamfered corners. A tyre seen from the front has a visibly bulged, rounded profile, the darkest value at the top and bottom rims, and a lit band across the middle of the sidewall.
- Cause 3: the tread grooves (single `R(0)` pixels every 3 px on rows j=1 and j=2) are too sparse and too close in value to register. They read as stone pitting, not as a diagonal tread pattern.
- Cause 4: the dirt between the units shows as 1-px vertical joints plus 1-px horizontal gaps between rows. That is exactly a mortar grid, which reinforces brick/slate.

## Fixes (concrete)
1. Darken the wall material to near-black rubber, like the `tyres` prop:
   - Base it on the darkest 2–3 values of the roof ramp, or on the same ramp the `tyres` prop uses.
   - Keep only one thin highlight, in the lower-middle of the upper sidewall and toward the left of each tyre, not a full pale top row.
2. Make each tyre read as a rounded torus seen side-on:
   - Make the units 5 px tall: dark rim top, lit sidewall, dark groove line, darker tread, darkest rim bottom.
   - Round the ends over 2 px on both the top and bottom rows (cut 2 px, then 1 px).
   - Make the vertical ends convex, not square.
3. Make the tread unmistakable: run diagonal 1-px dark strokes (`/ / /`) across the tread row at a 2-px pitch.
4. Break the mortar grid:
   - Let tyres touch or slightly overlap their neighbours.
   - Put the dirt in the triangular gaps between the rounded ends, not in uniform 1-px lines.
   - Allow 1-px vertical offsets between adjacent stacks so the rows do not form a ruled grid.
5. Optional: tone down the bright tan eave line and the door jamb one step so the wall material carries the read.
6. Re-check at 1x next to the `tyres` prop. The two must look like the same object.
