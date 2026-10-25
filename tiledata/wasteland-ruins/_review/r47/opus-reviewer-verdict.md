# Fresh adversarial Opus reviewer — final verdict (r47)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha 0d4209aec15f5e37d84a41f408945a41802aec934807b738dfe32c2b6429c25b (gate FAIL).

---

The asphalt fails. The edges and colours are mostly fine; the interior texture and the repeated south-edge shape are not. All coordinates below are in `asphalt-sample-4x.png`.

**Interior (brief 2): fails badly.**
- The interior is effectively two tones. Measured over the large block (800–1000, 90–420): base (82,75,73) 78%, (104,96,94) 19%, (123,114,112) 1.7%, (141,132,130) under 0.5%. That is not broad mottling in 4+ adjacent tones.
- The light tone appears only as separate oval discs, about 8–10px native, filled with a checker dither and sitting on a flat base. They read as pebbles, cobble tops or wet spots, not worn asphalt. Examples in the large block: (815,100), (850,280), (940,305), (995,405). In the bottom 3-wide run: (485,1060), (545,990), (670,1035), (730,1025). In the 3-wide vertical run: (1310,95), (1370,95), (1300,665).
- The 2x2 patch (520–630, 390–495) shows four ovals in a 2x2 grid. It reads as cobblestones.
- There is no 1–2px dither blend between patches. Each oval has a hard checker border against flat base.

**Fixed-position fleck grid (briefs 1 and 2).**
- Each cell has its single light pixel at the same offset, so the flecks form a regular lattice about 64px apart (one cell). That is the tiling rhythm the brief forbids.
- 1-wide horizontal run, y≈853: x≈145, 213, 273, 342, 402, 470, 530, 598, 662.
- 3-wide horizontal run, y≈1092: x≈313, 442, 505, 570, 697. Second row at y≈1104: x≈185, 250, 377.

**South edge of the 3-wide horizontal run (brief 1).**
- The same dithered half-dome "arch" is stamped against the south ledge in about 6 of 12 cells. It makes a scalloped tooth rhythm along the edge.
- Positions, all at y≈1115–1140: x≈152–187, 217–252, 345–380, 600–635, 727–765, plus the corner at 790–820.

**1-wide vertical run (brief 1, weaker).**
- Light dither lumps hug the W edge only, at x≈1095–1125, about once per cell.
- At y≈90–120, 170–200, 290–320, 400–440, 460–490, 530–560 and 680–710.
- This gives a mild bead rhythm, and the E side does not do the same.

**Cracks (brief 3): colour passes, shape is weak.**
- They are filled with warm dirt darks (74,56,40) and (101,76,57), and none crosses a 1-wide road.
- The interior ones are dead-straight 1px diagonals with a light pixel. They read as twigs or sticks rather than cracks: (910–945, 145–165), (855–875, 335–365), (910–945, 335–360), (215–235, 1030–1075), (265–305, 1040–1060).

**What passes.**
- Straight-run silhouettes: there is no 16px sausage bulge on either the 1-wide horizontal run (75–820, 840–890) or the 1-wide vertical run (1095–1145, 75–820).
- Not water (brief 4): the surface is warm grey, not blue.
- South ledge: dry dark brown, present.
- Dead ends and the isolated cell (brief 5) are acceptably irregular. Isolated cell: (455–505, 585–630). Dead-end stub: (205–245, 395–440).

**Against the reference (brief 6).** The house modern-city road (`ref-modern-city-road-8x.png`) is a quiet flat field with sparse, staggered flecks. This asphalt's spotted ovals make it busier and more pebbled. At equal scale it reads as a cobbled or puddled lot rather than old asphalt.

1. The interior is two tones of separate checker-dithered oval discs on a flat base, so it reads as cobbles or pebbles rather than worn asphalt. There are no 4+ tone adjacent patches and no 1–2px dither blends (e.g. (815,100), (850,280), (545,990), (730,1025); the 2x2 patch at 520–630, 390–495 looks like four cobbles).
2. The same half-dome arch is stamped on the 3-wide run's south edge about once per cell, giving a scallop or tooth rhythm (y≈1115–1140; x≈152–187, 217–252, 345–380, 600–635, 727–765).
3. The single light fleck sits at the same offset in every cell, forming a 64px lattice that shows the tiling (y≈853 x≈145/213/273/342…; y≈1092 x≈313/442/505/570/697).
4. The 1-wide vertical run has light lumps on its W edge only, about once per cell (x≈1095–1125, y≈90–120, 170–200, 290–320, 400–440, 460–490, 530–560, 680–710). E/W are not symmetric and there is a mild bead rhythm.
5. The interior cracks are straight 1px diagonals with a highlight pixel and read as twigs rather than cracks ((910–945,145–165), (855–875,335–365), (215–235,1030–1075), (265–305,1040–1060)).
6. At equal scale it is noticeably busier and more spotted than the house road reference.

VERDICT: FAIL
