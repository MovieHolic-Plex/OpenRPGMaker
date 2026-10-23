verdict: FAIL

- Rule 1 (3/4): OK. Roof is a real top plane (rows 1-15, about 14 rows deep) above a south front wall (rows 16-30). Door and window sit on the front wall. No side faces.
- Rule 2 (quality): defect. The tarp ramp `otarp` tops out at amber (index 5 = amber0, index 6 = amber1). `tarp_sheet` uses t=5 for the back 20% of rows and adds +1 on every fold line, so the top third of the tarp and every fold highlight become saturated yellow. The yellow rope X (`K('dry',3)`) is the same yellow family, so the roof reads as orange/yellow mottled speckle. You cannot pick out tarp, folds or ropes. The rust patch on the lower-right front wall (rows 22-29, x 19-29) forms a solid salmon blob under the window that reads as a stray crate.
- Rule 3 (distinct): passes on colour alone. It is the only orange-roofed hut and clearly differs from shack-a/b/c and the other new pieces.
- Rule 4 (readability): fails. At 1x and 3x the roof is a yellow-orange smear. The "tarp tied with ropes and bricks" story does not come through. The bricks (dark 4x2 bars) read as slots or holes.

Fix (pixel-level):
1. In `tarp_sheet` for this piece, clamp to `otarp` indices 2..4 (brick ramp only). Back rows use t=2/3, body t=3, front 2 rows t=4. Fold highlight +1 may reach 4 at most. Never use 5/6 (amber) on the tarp body. Keep amber only for a single 1px front-hem highlight at row 14, if at all.
2. Ropes: draw two straight ropes running back-to-front (e.g. x=9 and x=21, rows 2-15) rather than a crossing X. Use a dark core (`dry` 1 or `bark` 2) with a 1px lit pixel on the left side every other row, so they read as cord against the orange. Where a rope crosses the front eave (row 15), add one dark knot pixel pair.
3. Bricks: give each brick a lit top row (brick 5) and a 1px dark shadow to the lower-right on the tarp (otarp 1). Then they read as objects sitting on the tarp, not as holes.
4. Lower-right wall: limit `rust_patch` density to 0.2 there, or exclude x 19-27 rows 24-29, so the window has clean corrugated sheet under it.
