# Fresh adversarial Opus reviewer — final verdict (r34)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 15955d0ee981d4b031ccdfaeae3bb3b440316fb216daedbb1b42d7e3ad813b9e (gate FAIL).

---

**Verdict: FAIL.**

The north and south breaks are good. The single-cell horizontal strips stay solid and wavy, the south lip follows the bite shape, slab-a cracks and seams run right up to the break, and the bite dirt sits well next to dirt-b. The east and west breaks are the problem: they are too shallow, so vertical pad sides still read as straight cell edges.

**Defects (coordinates in the 4x composite):**

1. **East and west sides read as ruler-straight cell edges (main defect).** In the sheet, the side bites are only about 1–3 native px deep, while the north and south bites are about 4–6 px. So the vertical sides keep a nearly unbroken line.
   - The J's vertical bar, x≈330 (left) and x≈360 (right), y≈320–495: both sides are straight for a full cell and more.
   - The wide slab's west edge, x≈775–785, y≈75–435: only tiny wiggles, much straighter than its top, east and bottom edges.
   - The ┐ shape's vertical bar, right side around x≈630, y≈140–240.
2. **Slab-a seams show as a dark outline along the pad side.** Where a slab-a vertical seam falls inside the thin uneaten band, the overlay leaves it exposed. The result is a continuous dark rule that looks like a sticker outline or a cell border.
   - The left L, x≈72, y≈135–240.
   - The J's right side, x≈358, y≈320–495.
   - The left end cap of the bottom-left T, x≈150, y≈585–615.

   The seams themselves belong to the accepted slab-a; the fault is that the overlay doesn't break the band they sit in.
3. **Minor: visible rhythm on long edges.** The wide slab's east edge (x≈1000, y≈80–430) and bottom edge (y≈420–440) repeat similar scallops at a near-constant spacing. Two variants aren't enough to hide it over 6 or more cells. Players will notice this less than defect 1.
4. **Minor: the lip breaks into dashes in places.** Under the single-cell strip, x≈200–500, y≈235–245, the lip breaks into short segments at the bite tips. It reads fine at 2x, but at 1x it is close to a dotted line.
5. **Minor: the single island is too small.** At x≈455–505, y≈585–630 the mask-0 blob shrinks to about half a cell, so it reads as a rock rather than a broken slab.

**Fix list:**

1. Deepen the east and west bites to match north and south, about 3–7 px deep with varied depth, in both variants. The vertical pad sides must never run straight for more than about 4 px.
2. Make the east and west dirt cover at least the outer 2 px everywhere, so a slab-a seam on the cell boundary can never survive as a full-height dark rule. Add a few lit broken-rim pixels on the concrete side, mirroring the north/south treatment.
3. Make the scallop spacing different between variant A and variant B, or offset the phase per variant, so long edges lose the beat.
4. Bridge the south lip across bite tips with 1 px, or let it fade there instead of stopping.
5. Grow the mask-0 island to about 10–12 px across.
