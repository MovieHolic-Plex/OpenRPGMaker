# Fresh adversarial Opus reviewer — final verdict (r26)

Piece(s): slab-edge. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-edge sha b80cf2d9b189729498b2282067d065fff2ec48603af1d0be249d82a27e475fd2 (gate FAIL).

---

**Verdict: FAIL** for `slab-edge`.

The colour itself is fine: the edge band's average grey (about 144,141,145) matches slab-a (144,142,148), so there is no tinted or brighter band. The failures are in texture, seam handling and repetition.

**Defects, using pixel coordinates in `slab-edge-4x.png`:**

1. **The slab interior looks like a framed panel (right block).** A continuous dark seam runs all the way round the slab-a interior, from about x 828–965 and y 125–388. The edge ring has no seams at all, so every slab-a seam dead-ends into this frame and the interior reads as a separate inset rectangle. Two examples:
   - The top-left corner dirt plug (about 835–870, 128–150) is sliced off by the frame line.
   - The bottom-row seams stop at the frame (about 875, 320–385).

   At 1x this reads as a "picture frame" on every paved area, which breaks the brief that slab-a seams should meet the edge band naturally.
2. **The edge ring has a different texture from the interior.** The ring is coarse, blotchy mottle with brown flecks and no seams or cracks. The interior is finer-grained with long cracks and seams. The averages match, but the two surfaces clearly don't. You can see the step all round the inner frame, and it is most obvious on the left side (about x 790–828).
3. **Seam stubs float at junctions on the left samples.** These are short dark lines with a light highlight, sitting inside edge-only shapes:
   - vertical at about (124, 128–185)
   - vertical at about (578, 128–185)
   - horizontal at about (193–255, 450)
   - horizontal at about (193–255, 636)

   They start and stop with nothing on either side, which is exactly the "seams floating or dead-ending in plugs" the brief rules out.
4. **The same cell repeats visibly along runs.** The vertical strip (x 330–380, y 250–450) and the horizontal strip (y 200–250, x 200–500) show the same bump profile every 64px (16px at 1x). The right block's outer ring has the same regular scalloping on its top and bottom edges (y about 75 and 430). In a long road this will show the 16px grid.
5. **The darker lip looks dotted.** Under the bottom breaks it reads as broken dashes rather than a continuous lip, for example along y about 245 (x 205–500) and y about 497 (x 75–370). This is minor next to items 1–4.

Next to `ref-paving-4x.png`, the reference's slab boundaries and edge highlights carry continuously and stay in one consistent texture. This piece does not reach that level of finish.

**Fix list:**
- Carry slab-a's seam grid into the edge cells. Run seams out to the broken edge, end them at a chunk notch or in dirt, and remove the closed rectangle around the interior.
- Paint the edge body with slab-a's own texture (same grain size, crack lines, fleck density), then cut the irregular break into it, rather than using a separate mottle fill.
- Delete the isolated seam stubs and highlight lines in the edge cells at x 124, x 578, y 450 and y 636.
- Make the break profile in each straight edge cell look less periodic: offset chunks so they don't align at the 16px boundary, or add a second variant per direction.
- Make the under-break lip a continuous 1px dark line that follows the chunk outline instead of separated dots.
