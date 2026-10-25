# Fresh adversarial Opus reviewer — final verdict (r28)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 08b8655c2cf646b4a2adbc59d62d5e33b8cf83cc60cf1dc0a5d44131ed836abe (gate REFER).

---

**Verdict: FAIL**

The bites only break the outline in some places. On the north side of the narrow strips they bite in deep. On the west, east and south sides they are 1–2 px notches. On anything wider than one cell, those sides still read as straight cell edges, which the brief rules out. A player will see this at 1x and 2x.

**Defects (coordinates in the 4x composite, 1024×768)**

1. **Wide pad, west edge** at x≈778, y≈75–440: almost dead straight for about 5.5 cells. The notches are 1 px deep (4 px at 4x). It reads as a rectangle edge, and short dark rim ticks run down it like a ruled border.
2. **Wide pad, east edge** at x≈1010–1015, y≈75–440: the same, a straight vertical with token notches.
3. **Wide pad, south edge** at y≈430–440, x≈778–1015: shallow serration only. The dark lip under it is broken into short segments with gaps of matching length, so it reads as a dotted or dashed line.
4. **L-shape bottom strip, south edge** at y≈490–500, x≈75–370: the outline is basically a horizontal ruler. The lip is again a near-continuous dark dash row.
5. **Vertical stem of the L/T, east edge** at x≈360–372, y≈320–500: a straight edge, and a slab-a seam runs parallel just inside it. That makes a double straight line, and the cell column is obvious.
6. **Bottom-left strip, south lip** at x≈145–305, y≈625–632: the lip reads as dotted.
7. **The other extreme, north bites on one-cell strips**: the top-left piece (x≈75–185, y≈70–245) and the T arms (x≈205–500, y≈195–245) are eaten so deeply that the strip nearly separates into blobs. Read alongside the straight south and side edges, the north bites look like a stamped scallop rather than wear. This is a secondary issue next to defects 1–5.
8. **Things that are acceptable**: the bite dirt sits reasonably against dirt-b, and the slab-a seams and cracks do run up to the break. The loose chunks are fine, as is the single island (x≈458–500, y≈585–625).

**Fix list**

1. Give the E, W and S edge masks bites of the same depth as the north ones, roughly 3–6 px into the 16 px cell. Vary depth and position per cell so a run of edge cells never lines up. Defects 1–5 all come from these shallow masks.
2. Cut the north bite depth on one-cell strips to about 3–5 px so the strip stays connected.
3. Make the south lip a continuous 1 px dark run that follows the bite contour, with only occasional single-pixel breaks. Remove the regular segment-and-gap rhythm.
4. Put a bite at the cell midpoint of each straight side as well as near the corners, so no 16 px straight span survives.
5. Recheck the wide pad and the L in a new composite at 1x and 2x specifically.
