# Fresh adversarial Opus reviewer — final verdict (r42)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha c52ae49596a0e0970f3cd0ad6dfa2864145d82114571c27d43f2122de4ce3e5a (gate FAIL).

---

I judged the asphalt road autotile against all 8 brief points by viewing the review images at higher zoom. It fails: the cracks read as letters, the north, east and west edges are tidy outlines rather than broken lips, and the isolated cell and dead ends look like neat squares rather than broken slabs.

Coordinates below are in `asphalt-sample-4x.png`, which is 1024×768 (4 px = 1 art pixel). Files are in `/home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r42/`.

**Brief point by point**

1. **Not water: passes.** The base colour is a warm mauve-grey (82,75,73) with blue-grey specks. Next to the cyan puddle it never reads as water. It sits on the warm side of the neutral grey the brief asked for, but that is minor.
2. **Aggregate specks: passes.** The 1–2 px specks are spread evenly with no direction. They are dense and all cool blue, which makes the surface slightly busy but not wrong.
3. **Lane paint: weak pass.** The yellow paint at (905–960, 285–290) and the white at (895–955, 360–366) are both visible. Each is a single short stub floating mid-block with no lane context. The white one ("▬▬ ▪ ▪") reads like Morse code or a text glyph rather than worn paint (sheet, bottom row).
4. **Unconnected edges: fails on north, east and west.**
   - These sides are near-straight lines with a 1 px grey-teal outline and only single-pixel jogs. Examples: the top of the big block (775–1010, 72), the west side of the big block (775, 80–430), both sides of the vertical road (330/380, 80–470), and the top of the 2×2 patch (518–632, 392).
   - There are no asphalt chunks breaking into the dirt. The only "debris" is lone near-black pixels floating in the dirt at (125,88), (191,150), (194,209), (377,85), (380,280), (380,360), (505,215) and (510,610). They read as stray noise, not chunks.
   - The south front face exists, but it is a thin 1–2 px dark line plus a teal highlight. It reads as an outline more than a slab face, and it is much weaker than the edges in the paving reference.
5. **Dead ends and isolated cell: fails.**
   - The isolated cell (452–500, 582–636) is a clean, nearly perfect square with slightly softened corners. It reads as a placed tile or box, not a broken slab.
   - The dead ends are trimmed clean with 1 px rounded corners: the vertical top (330–375, 75–85), the left end of the bottom arm (78–90, 460–500), the right end of the cross arm (490–500, 200–245) and the bottom stub (200–245, 680–692).
   - The 2×2 patch (518–632, 392–500) is a neat rounded rectangle. Two 1–2 px teeth hang under its south lip at (565–590, 500–506).
6. **No repeating notch rhythm: borderline fail.** The south lip uses one symmetric upward "^" notch per cell, so a straight edge shows a regular sawtooth: (242,245), (265,242), (397,237), (140,495), (185,500), (265,495). It reads as a stylised squiggle rather than random breakage. On north, east and west there is almost no per-cell profile at all.
7. **Cracks read as fractures: fails clearly.** Every crack is a 1 px pure near-black straight stroke with one branch and no shading.
   - (895–960, 145–185) reads as a "Y" or "人".
   - (840–895, 260–305) reads as "メ" or "ナ": a long diagonal crossed by a short bar.
   - (835–890, 335–372) reads as "ム" or "ト".
   - The sheet's bottom-right variant is a "√\_/" zigzag.
   - The dark blob in the middle interior variant of the sheet reads as an unclear figure, not a pothole.
   - The light smudges next to the cracks at (870,280) and (870,335) look blurred and do not match the crisp pixels around them.
8. **Quality versus references: fails.** At the same scale, the paving reference has a strong lip with highlight and shadow on every edge. This asphalt reads as a flat cut-out outlined in teal, and only the south side has any depth. The interior holds up; the edges and the decals don't.

**Defects by severity**
1. Cracks are letter-like 1 px single-branch strokes with no width, depth or shading: "Y" at (895–960, 145–185), "メ" at (840–895, 260–305), "ム" at (835–890, 335–372).
2. North, east and west unconnected edges are straight outlined cut lines with no broken lip and no asphalt chunks, for example (775, 80–430), (330/380, 80–470) and (518–632, 392). The only "chunks" are lone near-black stray pixels at (125,88), (191,150), (377,85), (380,280), (505,215) and others.
3. The isolated cell (452–500, 582–636) is a neat square, and the dead ends are cleanly trimmed with rounded corners: (330–375, 75–85), (78–90, 460–500), (200–245, 680–692).
4. The south lip repeats the same symmetric "^" notch in every cell, e.g. (242,245), (265,242), (397,237), (140,495), (185,500), (265,495), and has hanging teeth at (565–590, 500–506). The front face is only 1–2 px, so the slab has little 3/4 depth.
5. The lane paint stubs are tiny and isolated; the white one reads like a glyph (895–955, 360–366).
6. Minor: blurred light smudges at (870,280) and (870,335); the base colour is warm mauve rather than cool charcoal; the specks are dense and uniformly blue.

VERDICT: FAIL
