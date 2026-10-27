# Fresh adversarial Opus reviewer — final verdict (r36)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 95b614df8ad38e3a98e8cc00865fb578052a14cf6903c8e7c9633c055955bdc5 (gate FAIL).

---

**Verdict: FAIL.** Most of it works, but a few edges still read as straight 16px cell edges, and one shape (the 2x2 block) reads oddly at 2x.

**What works**
- The south lip is a solid broken line, not dotted.
- One-cell strips stay solid; none are shredded.
- The dirt colour in the bites matches dirt-b.
- There is no dark sticker outline all round: the north rims are lit, and the dark pixels are mostly on the south and side edges.
- slab-a seams and cracks run right up to the break in the wide area.

**Defects** (pixel coordinates in the 4x composite)
1. **North edges are bitten much more shallowly than the other sides.** The bites are only 0–1px deep at 1x, so the north outline still reads as the cell edge.
   - Wide area top edge, y≈72, x≈845–985: one straight line with a single dip near x≈990.
   - End caps of the vertical strips are cut flat for about 5–6px at 1x, with only the corners chamfered: x 75–110, x 335–370 and x 590–630, all at y≈72.
   - The top of the horizontal arm at x 115–175, y≈136 is ruler-straight.
2. **Some west edges are almost straight.**
   - Top-left strip, x≈75, y 140–240: two cells with only 1px steps.
   - Wide area, x≈780, y 150–310: gentle bulges only, so the edge reads as the cell boundary.
3. **The east edge of the wide area repeats a stamp rhythm** (x≈1000, y 80–430). It is a regular scallop of about two bulges per cell, with a dark notch pixel at each valley. At 2x this reads as a sawtooth, and the notch pixels form a faint dotted column.
4. **The 2x2 block (x 525–630, y 390–500) becomes a four-pointed star.** All four convex corners and the edge midpoints are bitten with similar depth, so it looks like a caltrop rather than a broken pad.
5. **Seam slivers next to the edge (minor, but the overlay can fix it).** Where a slab-a seam runs 1–3px inside the broken edge, the edge reads as a double dark outline. Examples: the arm top at y≈140, the seam at x≈150 on the bottom-left T, and the seam at x≈548 in the 2x2 block. The bites stop just short of the seam.

**Fix list**
1. Bring the north bites up to the same depth range as south/east/west: irregular 1–4px, with at least one bite of 3px or more per north-open cell. Do this especially for the end-cap masks, so no cap has a flat segment longer than 3px.
2. Give the west-open cells at least one deep (3–4px) bite per cell, at a different position in each variant.
3. Break the east scallop period. Vary bump widths, let some spans run 6–8px without a notch, and don't place a dark pixel at every valley. Make the two variants differ enough that adjacent cells don't repeat.
4. On corner masks, vary the corner bite depth by mask and variant, and avoid deep bites at edge midpoints right next to deep corners. A small block should look lopsided, not symmetric.
5. Where an edge is open, let the bite reach 1–2px into the slab occasionally, so a seam parallel to the edge is sometimes swallowed instead of forming a sliver. Alternatively, keep the lit rim off the pixel row right next to the edge.
