# Fresh adversarial Opus reviewer — final verdict (r32)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 366e4f457f35a35c3b7fa5ee3f048e623ffc81db48ec9f3f633805267e16027f (gate FAIL).

---

**Verdict: FAIL.** The broken edges work along the north and south sides, and on the outside of the wide slab area. The east and west edges of the narrow pieces still show long, straight, dark vertical lines that sit on the cell edges. At 1x/2x these read as tile edges with an outline. Coordinates below are in the 4x composite.

**Defects**
1. **Straight dark vertical edges on E/W-open cells.** This is the main problem. A dark 1px line from slab-a's seams is left as the outline, with no bite cutting into it for a full cell or more:
   - East side of the long vertical strip, x≈360, y≈320–475. This is about two cells of perfectly straight dark line, while its west side next to it is scalloped. This is the most visible one.
   - West side of the top-left shape, x≈76, y≈184–245.
   - West side of the upright in the bottom L, x≈204, y≈396–484.
   - West side of the 2x2 block, x≈544, y≈412–484.
   - West side of the top cell of the vertical strip, x≈333, y≈72–125.
   - Left end cap of the bottom T, x≈148, y≈585–630.

   Together they show the 16px grid and look like a sticker outline. The bites stop exactly at the seam column instead of eating past it.
2. **The single island (x≈456–504, y≈580–632) reads as a clean square.** Its N, W and E sides are straight, with only a few small notches. It looks like an untouched cell, not a broken piece of slab.
3. **The vertical strip pinches where it meets the cross arm (x≈330–375, y≈250–315).** Bites from both sides cut the 16px strip down to about 6–7px, giving an hourglass waist. This breaks the "one-cell strips stay solid" rule.
4. **Minor:** on the wide slab area, the east edge (x≈1000, y≈100–420) and the bottom edge (y≈420–440) have teeth at an almost regular ~8px spacing. That repeating rhythm is visible at 2x.

What passes: the south lip reads as a broken lip, not a dotted line. The bite dirt colour matches dirt-b. The rims are lit. The outline of the wide area is convincingly irregular. The loose chunks are fine.

**Fixes**
1. In every W/E-open mask, paint dirt over the outer 2–4px column across the whole edge. Then bite inward unevenly, so that no slab-a seam pixel within about 4px of an open side survives as the outline. Make sure there is at least one bite every ~6–8px along vertical edges.
2. Redraw mask 0 (the island) in both variants with rounded, uneven bites on all four sides and broken corners.
3. For E+W-open masks (5, 10 and their T and end variants), and likewise N+S, limit the combined bite depth so that at least about 10px of concrete always remains across the strip.
4. Vary the tooth spacing and depth between variant A and variant B, so neighbouring cells don't repeat the same ~8px sawtooth.
