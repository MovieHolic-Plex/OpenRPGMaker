# Fresh adversarial Opus reviewer — final verdict (r25)

Piece(s): slab-edge. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-edge sha 77ec867c448e307d63dd9d89294f3585cafbe679e4e222cc79f7d811ee56e71c (gate FAIL).

---

**Verdict: FAIL** for `slab-edge`

The edge outline is fine: the broken edge into dirt is irregular, has no straight cut sides, and the overall value matches slab-a closely (mean RGB about 148,148,156 against 143,142,147). The body of the edge cells is the problem. A player would see it at 2x, and at 1x the repeating tile rhythm would show too.

**Defects** (pixel coordinates are in `slab-edge-4x.png`):

1. **The cell grid shows through stamped seam stubs.** In the vertical arm of the left assembly (x≈330–380, y≈130–450), a short horizontal seam stub repeats every 64px, at y≈130, 195, 258, 322, 385 and 450. Each stub comes with the same diagonal crack. It reads as a ladder of separate tiles, not one continuous slab. The horizontal arms have the same problem: vertical stubs at x≈250 and x≈125 (y≈200–245 and 455–500), and at x≈575 (y≈135–190).
2. **The right edge column repeats the same crack.** In the right block, the ring cells at x≈960–1000 carry an identical diagonal crack at y≈150, 215, 280 and 345, one per cell. It is clearly the same tile repeated, which slab-a never does.
3. **Seams don't carry through from slab-a into the edge ring.** Inside the right block, the slab-a seams form a T that floats on its own (x≈830–960, y≈135–325). The horizontal seam at y≈140 just stops at x≈960, and the seam at y≈320 stops at x≈830 and x≈960. Slab-a is a continuous grid of slabs about 36–45px wide at 1x, but the ring has no slab layout at all. There are only disconnected L-shaped fragments in the corners (x≈790–830, y≈385–410 and x≈960–1015, y≈385), plus a vertical stub at x≈800, y≈80–130.
4. **The edge texture doesn't match slab-a.** Slab-a has large soft brown-grey stain patches and long branching hairline cracks. The edge cells are an even speckle of small light-grey and brown dashes with short straight 1px cracks. You can see where the ring stops and the interior starts, especially around y≈330–420 inside the right block, where slab-a's brown stain ends at the ring.
5. **The 1px darker lip is missing or too weak.** Along most of the break, for example the top edge of the right block (y≈75–90) and the arms in the left assembly, light concrete meets mid-brown dirt with no darker under-lip. The brief's subtle shadow lip isn't readable. The Beodeul paving reference (`ref-paving-4x.png`) does give its edges a consistent defined lip.

**Fixes:**

- Build the edge cells by cutting slab-a itself. Lay the slab-a field under the 4x4 mask and erode only the outer 2–5px into irregular chunks. That way stain patches, slab seams and long cracks run straight through to the broken edge.
- Remove the stamped seam stubs and the repeated per-cell diagonal crack. Any seam in an edge cell has to line up with slab-a's slab grid: same period and offsets, continuing across cell borders.
- Give opposite and neighbouring edge variants different crack placement, so straight runs of three or more cells don't show a 16px rhythm.
- Add a 1px darker lip (dark warm grey-brown, a step below the dirt) under the broken edge on the sides facing down and right, broken up rather than continuous.
- Recheck by placing a 5×5 or larger slab area and a long one-cell-wide strip, at 1x and 2x, next to `slab-a-4x.png`.
