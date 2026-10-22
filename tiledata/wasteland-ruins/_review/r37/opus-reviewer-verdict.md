# Fresh adversarial Opus reviewer — final verdict (r37)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha 240e792a4070e376c153f486d596edb35bfe9e15bc7811b1f62c27f03c4f494a (gate REFER).

---

**Verdict: FAIL**

The north, east and west breaks work. The south breaks don't: on every south-facing edge the bite stays at almost the same depth, so the bottom of each pad reads as a straight ruled cell edge with a dark line under it. That breaks the brief's main requirement, and a player will see it at 1x and 2x.

**Defects (coordinates in the 4x composite)**

1. **Straight south edges.** I measured the lowest grey pixel per column, in 1x pixels:
   - Bottom of the cross's horizontal arm, x≈200–495, y≈236–240: the edge stays on row 59–60 across about 3 cells and moves only 1px. Apart from the junction it is a ruler line with a continuous dark lip. This is the worst case.
   - Bottom of the L, x≈78–370, y≈485–495: rows 120–124 over about 73px. There is only one shallow dip, near x≈205.
   - Bottom of the wide slab, x≈780–1010, y≈420–435: rows 104–108 over about 57px. It reads as a gentle 1px wobble, not a broken edge.

   In comparison, the north edges vary 48–55 (cross top) and the east edges 88–93 (right side of the L). Only the south breaks are flat.
2. **The south lip is too even.** Because the edges above are flat, the dark 1px lip follows them as one unbroken line all the way along the bottom of each pad. With dark seams on the other sides as well, the pads start to look outlined. The overlay sheet shows the cause: on the magenta sheet at 6x, the south lips at about y=70, 265, 455 and 650 are almost flat across every S-open cell in both variants.
3. **Minor: one squared step.** On the bottom strip, x≈190–256, y≈620–636, the edge drops by exactly 4px in a rectangular step (rows 155→159→155). This may just be the T stem coming down, but if it isn't, it looks stamped rather than broken.

**What's fine**
- The bites on north, east and west eat into the concrete well enough.
- One-cell strips (the vertical arm top, the bottom strip) and the single island stay solid and aren't shredded.
- The bite dirt sits naturally against the dirt-b tile.
- The loose chunks, for example at (373,68) and (240,385), are fine.
- I saw no obvious repeat between the two variants on the N/E/W edges.

**Fix list**
1. In every S-open mask, in both variants, vary the south bite depth by about 2–6px within each cell. Add at least one deep bite of 4–6px and one shallow stretch of 0–1px per cell, at different x positions in variant A and variant B. The goal is a depth spread similar to the north edges (about 7px), not the current 1–2px.
2. Make the lip follow the new profile, and break it occasionally: thin it to nothing on short stretches, and let a lit rim pixel take over where the bite is shallow. It should not run the full width unbroken.
3. Don't let a bite on the south side sit at the same x in neighbouring S-open cells. Line up the cells with flat south edges (masks 11, 10, 3, 9) side by side and check them as a 4-cell run before baking.
4. Re-render the composite and confirm that every south run varies by at least 4px across each cell, matching the north and east edges.

The images I judged are in `/home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r37/`. I edited nothing.
