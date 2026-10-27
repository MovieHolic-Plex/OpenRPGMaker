# Fresh adversarial Opus reviewer — final verdict (r43)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha f05287f15cec05666bbfc43ac1b13249946b471005fc774152a1f34f3fef683d (gate FAIL).

---

Verdict: FAIL. Three brief items fail outright (cracks, unconnected edges, rounded blobs), the south lip is weak, and items 1, 2 and 7 pass. All coordinates below are in `asphalt-sample-4x.png` unless marked otherwise. One source pixel is 4 px at this scale.

**What passes**
- **1. Not water: pass.** The fill is a warm charcoal (82,75,73), clearly different from the puddle's teal (50,108,114). Two things push it toward "wet", though:
  - A sparse cyan glint speck (97,118,125) shows up, for example around (590,450) and (848,400).
  - The south lip is near-black navy (14,23,32) on top of a blue-grey row (42,53,57).
- **2. Aggregate specks: pass.** On the interior rows the specks are 160 single pixels, 18 of 2×1 and 11 of 1×2, so they don't run in one direction.
- **7. Lane paint: pass.** There is none, as intended.

**Defects**
- **3. Cracks fail.** The three cracks in the block, roughly (895,145)–(960,180), (845,260)–(880,320) and (835,345)–(895,365), are 1 px staircase lines in the darkest navy.
  - They are 2 px wide in only a few short runs.
  - The light lip (104,96,94) appears at maybe 2–3 isolated pixels along the whole length.
  - At 4x they read as thin scratch or glyph strokes, not shaded fractures. The same is true in the raw sheet's interior rows.
- **4. Unconnected edges are not broken up.** The W and E edges are straight vertical lines with only 1 px jitter:
  - Block west edge: x≈780, y 75–430.
  - Block east edge: x≈1005.
  - West edge of the 2×2 patch: x≈522, y 400–495.
  - Left edge of the T stem: x≈200, y 420–490.
  - Left edge of the top-left piece: x≈72, y 85–240.
  - The asphalt bits out in the dirt are mostly loose 1 px specks, for example (107,65), (122,95), (370,95) and the detached bits at (505,590) and (505,625). These are not 2–3 px chunks.
  - The north edges are also close to a ruler line with notches: block top at y≈72, road tops at y≈200 and y≈455.
- **5. Blobs read as squares, not rounded.** The 2×2 patch at (520–635, 390–500) reads as a square with lightly clipped corners. The vertical dead-end stems at (200–250, 400–500) and (325–375, 80–110) have squared sides. The isolated cell at (455–495, 585–635) is irregular, which is acceptable, but it is small (about 9×10 px) and has detached 1 px crumbs beside it rather than a cohesive rounded blob.
- **6. South lip is a dotted bead, not a lip.** It is a row of separate near-black 1–3 px dashes sitting on a blue-grey row, spaced at fairly even intervals within each cell. Examples:
  - Horizontal road at y≈497–502, dashes at x≈ 85, 155, 235, 290, 345, 410, 470.
  - Upper road at y≈243, x 220–490.
  - Block bottom at y≈430.
  
  It reads as beading or drips more than a short darker front face, and the navy colour adds to the wet look.
- **8. Quality is below the references.** Next to the paving and grass references at the same scale, the surface is one flat tone plus specks, with no broader low-frequency variation such as wear patches or tonal mottling. The edges look stamped rather than eroded. It reads as ground, but as a flat fill.

Defects by severity:
1. Cracks are 1 px navy staircase lines with almost no light lip, so they read as scratches or glyph strokes rather than 2 px shaded fractures (block cracks at (895,145)–(960,180), (845,260)–(880,320), (835,345)–(895,365)).
2. W, E and N unconnected edges are nearly straight with 1 px notches, and the asphalt bits in the dirt are mostly 1 px specks, not 2–3 px chunks (x≈780, x≈1005, x≈522, x≈200, x≈72; y≈72, 200, 455).
3. The 2×2 patch (520–635, 390–500) and the dead-end stems (200–250, 400–500) read as squared, not rounded, blobs. The isolated cell (455–495, 585–635) is tiny and surrounded by loose crumbs.
4. The south lip is a dotted row of near-black navy dashes at fairly even spacing (y≈500, y≈243, y≈430), which looks like beading and adds a wet blue cast.
5. Cyan glint specks (97,118,125) and the navy lip cool the surface toward water (for example (590,450), (848,400)).
6. The interior is flat, with no tonal variation or wear, below the texture quality of the paving and grass references.

VERDICT: FAIL
