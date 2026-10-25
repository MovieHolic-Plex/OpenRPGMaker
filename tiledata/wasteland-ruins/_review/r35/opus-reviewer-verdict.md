# Fresh adversarial Opus reviewer — final verdict (r35)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 65bce5d25cfbf8c62d501da551c02ea78850e05d34ea62202766e7fe89fa0697 (gate FAIL).

---

**Verdict: FAIL**

The wide slab area is good. The bites on its outline look irregular and natural. The bite dirt sits well against dirt-b, the south lips read as broken lips and not as a dotted line, and there is no dark outline all round. The 2x2 block, the single island and the T/end caps are acceptable.

The failure is in the one-cell strips, which are most of the left half of the composite. All coordinates are in the 4x composite. I measured edges on the 1x downsample.

1. **The strips have straight edges and repeat the same shape in every cell.** The vertical strip in column 5 is the right leg of the J, at 4x x≈330–375, y≈256–448. For about 7–9 rows of each cell its concrete runs between fixed columns: cell-local x=3 on the left and the seam at x=11 on the right. Only a 1px wiggle varies this. The exact same edge profile repeats at 1x y 64–79, 80–95 and 96–111. The horizontal strips behave the same way. Concrete height is a constant 10 per column at 4x y≈192–256, x≈200–500, and at 4x y≈448–512, x≈75–375. At 2x these read as straight rails with a fixed repeat.
2. **Every cell joint has a bulge that shows the 16px grid.** The concrete width jumps from 9 to 12–13 exactly at each cell boundary: 1x y=79/80, 95/96 and 111 in column 5, and at x=63/64 and 79/80 in the row-3 strip. This shows up as evenly spaced bulges along every strip.
3. **The outline falls on slab-a seams, so it reads as a straight cell edge.** The east side of the J's vertical leg (4x x≈364–368, y≈324–492, about 40px at 1x) follows the slab-a seam at cell-local x=11. The bites stop at x 12–15, so the dark seam becomes a straight ruled outline. A few loose 1px concrete specks sit outside it (4x x≈368–372, y≈392–408) and look like crumbs rather than a break. The west side of the J block (4x x≈204–208, y≈395–485) has the same problem: the seam is at local x=3. Its top edge (4x y≈392–396, x≈210–330) is a straight lit rim.
4. **The south lip of the bottom strip is a regular sawtooth.** At 4x x 75–375, y≈485–500 the teeth repeat at an even ~9px interval at 1x. It reads like a decorative zigzag, not a break.
5. Minor: the mask-15 cell in the sheet (cell (3,3), lower right) has three stray dark pixels. This only matters if a mask-15 cell is ever placed.

**Fix list**
- For masks 5 and 10, and the open sides of the other masks, vary bite depth along each side between about 1 and 6px. Avoid constant-depth runs longer than 3 pixels.
- At rows/columns 0 and 15, end each open side at a shared middle depth of about 3px instead of flaring out to 0–2. This removes the bulges at cell joints and keeps neighbouring cells continuous.
- Make the two variants actually differ on straight runs. If the position hash still produces runs of the same variant, add a third variant.
- Where slab-a seams fall at local x/y≈3 or 11, either push dirt past the seam every 4–6px or cover the seam pixels at the break, so the seam never becomes the outline. Delete the 1px concrete slivers left outside the seam.
- Make the south lip irregular: tooth widths of 2–6px with some flat or chipped stretches, not an even zigzag.
- Clear the stray pixels in sheet cell (3,3).
