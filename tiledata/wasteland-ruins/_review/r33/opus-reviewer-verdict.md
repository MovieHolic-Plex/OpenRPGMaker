# Fresh adversarial Opus reviewer — final verdict (r33)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha f75b7ae775debadd01a6cc6a184319b28695531c686ab11d87fbddfe3fcca16f (gate FAIL).

---

**Verdict: FAIL**

The bite fill colour and the south lip are fine. The pad outline is not: on several edges it still reads as a straight cell edge, and the wide-slab sides read as a regular zigzag. Both are noticeable at 2x.

**Defects (coordinates in `slab-break-composite-4x.png`)**

1. **Straight cell edges with a dark line along them.** Wherever a slab-a seam falls on the pad's open side, the overlay doesn't eat past it. The pad then ends in a ruler-straight dark line, which looks like a cut rectangle with an outline rather than a broken edge. These are not south edges, so this isn't the intended lip.
   - Vertical strip in the J shape, right side: x≈360, y≈320–495, straight for about 2.5 cells.
   - Y/K shape at top left, left side: x≈75, y≈140–245.
   - Bottom-left T, west end cap: x≈145–150, y≈590–635 (vertical dark line, flat end).
   - Bottom-left T, stem sides: x≈200 and x≈248, y≈645–695. Both sides are dead straight, so the stem reads as a pasted rectangle.
   - End caps generally (the west caps of the T arms, and the strip at x≈75–90, y≈465–500) are flat with almost no bite.
2. **The wide slab's east and west sides are a regular sawtooth, not rounded bites.** On the left (x≈778–800, y≈150–420) and the right (x≈995–1015, y≈100–420), near-identical triangular teeth repeat about every 4–6 px. It reads as pinking-shear or a stamp rhythm and contradicts the "rounded dirt bites" brief. In the overlay sheet, the W/E mask cells in both variants have the same fine zigzag profile, so swapping variants doesn't break the rhythm.
3. **The wide slab's north edge is nearly straight** (y≈82–95, x≈790–1000), with only 1–2 px notches. The pad's top outline reads as the cell line.
4. **Strip bites are too shallow overall.** Long strip edges such as the top of the right T arm (x≈410–490, y≈198) and the arms of the bottom T (y≈585–590) have only 1–2 px nicks. Their silhouette is still the 16px cell grid.

The single island at x≈460–500, y≈585–630 is a minor issue. It is eaten down to a small plus/star and reads as debris rather than a slab remnant. That is borderline, and I am not failing on it.

**Fix list**

1. On open sides, push bites at least 2–4 px deep into the concrete, including the outermost pixel column or row. Every open side, including end caps and N/E/W sides, should then have at least one or two bites crossing the cell edge, so no straight run is longer than about 6–8 px.
2. Make sure the overlay covers the outermost 1–2 px on every open side, where a slab-a seam can sit. That way a seam never forms the final outline, and seams end at a bite instead of running along the edge.
3. Replace the uniform W/E sawtooth with a few larger rounded scallops of varied width (about 3–7 px) and depth (about 1–4 px). Make the two variants clearly different in where the bites fall.
4. Give the N edge the same treatment as the others, with real bites rather than 1 px notches. Keep the lit rim along the bite curve.
5. In the one-cell strip masks (5, 10, and the end caps 1/2/4/8), offset the bites on the two opposite sides from each other. That keeps a solid core of about 8 px or more while keeping both sides irregular.
