# Fresh adversarial Opus reviewer — final verdict (r30)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 898403d217f162aef09195668b62d9f4b4ca2980f1843b4336a1f18480e9724d (gate PASS).

---

**Verdict: FAIL**

At 1x/2x the player will see two problems. Wide pads have an even, repeating zigzag edge along straight lines. Narrow pads are eaten down to thin shards that look obviously generated. Coordinates below are in the 4x composite (1024x768).

**Defects**

1. **The wide pad still has straight cell edges.** On the right-hand slab, the left edge runs at about x=776, the right edge at about x=1012, the top at about y=80 and the bottom at about y=435. All four are dead straight with only 1–2 art-pixel jags. The jags repeat about every 4 art px and the pattern restarts every 16px cell, so it reads as a stamped "zipper" border with the grid showing through, not as bites. The large rounded bites the brief asks for appear almost nowhere on wide-pad edges. The only real hole is about 790,240, a small notch.
2. **Narrow strips are over-eaten into shards.**
   - The 1-cell strips (horizontal arm at about 210–495,200–240, vertical stem at about 330–365,280–500, L-bottom at about 80–360,440–500, cap at about 145–300,585–650) are bitten from both sides until only 2–4 art px of concrete remains in places.
   - The T-junction centre (about 300–400,170–290) becomes a symmetric diamond, and the L-bottom becomes mirrored triangular "mountains" (about 200–360,410–500).
   - The left/right and N/S masks look like near-mirror images of each other, which gives away that the shapes are generated.
3. **Seams end as stray bars.** Slab-a seams stop flush against dirt and are left as isolated dark sticks with no break or rim treatment. Examples: the vertical bar at about 545,400–495 on the island's west edge, about 200,440–495, about 590,140–230, and about 235,640–670. In the strips they read as floating twigs rather than seams running into a break.
4. **The south lip is dotted.** On the strips (about 330–365,300–420 and along y of about 495 on the L-bottom), the dark lip breaks into scattered single dark pixels and short dashes. That is exactly the "dotted line" the brief forbids. On the wide pad it is fine.
5. **The loose chunks form a ruled line.** The 1–2 px grey specks sit in a regular column just outside the wide pad's west edge (about x=775, y=180–360, roughly every 30 px) and along the right edge (about x=1015). They read as a dotted guide line, not scattered debris.
6. Minor: the single island (about 465–495,585–625) is fine. Bite dirt colour sits naturally against dirt-b, and I see no sticker-like outline all round. Those requirements are met.

**Fix list**

1. **Deepen bites on wide edges.**
   - Make bites irregular and rounded, 3–6 art px deep, with gaps of uneven length.
   - Vary them across the four cells of each mask so the period isn't 16px.
   - Run at least one larger bite across the cell boundary (draw it as a pair of halves that line up) so the outline never lines up with x/y = cell edge.
2. **Cap the bite depth on opposite open sides.** When a cell has both N and S open (or both E and W), keep at least 6–8 px of solid concrete in the middle.
3. **Break the mirror symmetry.**
   - Draw E and W, and N and S, independently.
   - Make the T and cross centres asymmetric, not diamonds.
4. **Finish seams at the break.** Where a slab-a seam hits a break, end it in a lit rim or a small notch in the lip so it doesn't hang as a loose bar. Alternatively, put a bite exactly where seams reach the cell edge.
5. **Make the south lip continuous.** Draw it as 1px dark runs of at least 3–4 px following the bite curve, with no isolated single pixels.
6. **Scatter the loose chunks.** Use irregular offsets, fewer of them, more of them in some places, and not all in the column next to the edge. Some should be 2x2 with a lit pixel.
