# Fresh adversarial Opus reviewer — final verdict (r51)

Piece(s): asphalt-ph, road-crack-b, pothole-a, pothole-b. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt-ph 5b3ed08f36c2 (gate REFER), road-crack-b 9d2db0e4b9eb (FAIL), pothole-a 705c9a978481 (FAIL), pothole-b 3f79d4a8c1e7 (REFER); road-crack-a f73eb23ea9b7 and road-crack-c c75c96067e6c passed the gate.

---

All four pieces fail. The asphalt is the closest to passing: it reads as a grey surface at 2x but not yet as old asphalt.

Coordinate frames below: **S4** = `asphalt-sample-4x.png` pixels; **P** = 1x pixel in the 48×48 frame of an `<id>-in-place-6x.png` (multiply by 6 to find it in the file).

## 1. asphalt-ph

**What works**
- The north light rim and the dark south ledge are there, and the ledge reads as a step down into the dirt.
- No tile-border seams.
- The global texture flows across the crossroads and the T-junctions.

**Defects**
- **Pill caps.** Every 1-wide dead end is a smooth semicircle, so the runs read as capsules or tubes, not broken road ends:
  - vertical run top cap at S4 (1100–1145, 70–110) and bottom cap at (1100–1145, 780–820);
  - horizontal run caps at S4 (78–100, 840–890) and (800–822, 840–890);
  - T arm ends at S4 (75–120, 75–100), (590–630, 75–100) and (205–250, 655–690).
- **Isolated tile.** It shrinks to a 10×10 px rounded dark coin at S4 (460–500, 588–628), i.e. 1x (115–125, 147–157). It reads as a sticker.
- **2×2 patch.** It is an almost clean rounded square at S4 (520–630, 392–500). The edges are nearly straight, so you can't see the promised 1–3 px chipping.
- **Wide slabs.** The left and top edges are near-straight lines at S4 (780, 75–430) and (780–1015, 72). They read as a cut rectangle, not a crumbled edge.
- **Visible repetition.** The 128 px period repeats exactly: the slab texture differs by exactly 0.0 at a 128 px offset. In the 12-tile runs the light blotches come back at the same spots, at S4 x≈130 and x≈640 on the bottom slab (y 970–1140).
- **Banding.**
  - The light wash forms a horizontal band at S4 y≈330–410 that spans both slabs (x 780–1015 and x 1225–1400).
  - The slab is also dark on top and lighter at the bottom (S4 y 340–430), which reads as a gradient, not wear.
- **Tonal depth is thin.**
  - Inside the slab there are 5 colours. One flat value (L≈82) covers about 60% of the pixels, and the luminance range is only 71–134; Beodeul paving runs 52–197.
  - The texture is single-pixel salt-and-pepper (light grey and blue-grey specks). It looks like TV static or granite, not aggregate with tar patches.
  - There are no 2–3 px clusters and no darker tar-patch clumps.

## 2. road-crack-b

- **Near-symmetric "moustache" or stick-figure glyph.** The left arm runs P (19,19)→(21,22) and the right arm P (29,21)→(28,24). Between them sits a thick 2-row bar at P (23–27, 23–24), which makes it read as a drawn symbol.
- **Stray pixels.** A lone light pixel (L 134) at P (24,25) and a brown dot at the junction look like an eye or a nail, not a fracture.
- **No depth.** The stroke is one flat dark value (L 50) with no lit lip on the south side of the crack. At 2x on the board it reads as a little asterisk or star.

## 3. pothole-a

- **The floor is brighter than the road.** The hole floor is L 81–99 at P rows 22–27; the asphalt around it is L 76. Only the north wall is dark (L 37), so the shape reads as a raised brown mound. In `marks-alone-8x.png` it looks like a spiky hedgehog.
- **The north rim is a row of spikes.** It has regular dark teeth at P (22,20) and (25,20), with alternating 37/59 values at row 21. It should be a ragged broken edge.
- **No broken-asphalt rim.** A "larger broken-asphalt" pothole needs chunk fragments or a crumbled lighter rim around it. This one has only a single light lip at row 28 (P 18–25, L 116).
- **Wrong scale.** About 12×9 px, barely bigger than pothole-b. At 2x on the board (`asphalt-with-marks-2x` at around (430,78) and (650,238)) it reads as a brown bean or eye.

## 4. pothole-b

- **Same raised-floor problem.** The fill is L 81–99, brighter than the asphalt, so it reads as a lump of dirt sitting on the road.
- **The lobes don't read.** It reads as two stacked offset rectangles (a ruler-straight dark lid at P (19–23, 21), then a second step at P (25–27, 23)), not two eroded lobes.
- At map scale it is close to a duplicate of pothole-a.

## Verdicts

`asphalt-ph: FAIL`
`road-crack-b: FAIL`
`pothole-a: FAIL`
`pothole-b: FAIL`

## Fix lists

**asphalt-ph**
1. Break the convex caps and corners: add asymmetric bites and a 1–2 px flat or jagged facet instead of radius rounding. This applies to dead ends, the isolated tile, 2×2 outer corners and T-arm ends.
2. Push the chipped-edge noise amplitude so long straight edges actually wander 1–3 px, with occasional crumbs of asphalt off the edge into the dirt.
3. Swap the single-pixel salt noise for 2–3 px aggregate clusters, and add a darker tar or patch value (L about 60). This widens the range toward the paving reference.
4. Break the 128 px period: offset the wash per axis, or use a second non-commensurate layer (for example 96 or 160). Drop the wash's horizontal band structure.

**road-crack-b**
1. Make it asymmetric: unequal arm lengths and angles, and a meandering main stem.
2. Thin the junction bar to 1 px and remove the stray light pixel and the brown dot.
3. Add a 1 px lighter lip on the south (lit) side, and make the line taper or break at the ends.

**pothole-a**
1. Make the hole floor darker than the asphalt (L about 45–60), so the dark wall is north, the floor is deep, and only a thin lit rim sits on the south inner wall.
2. Replace the toothed north rim with an irregular broken edge, and add lifted light asphalt fragments or crumbs around the outside.
3. Make it clearly larger (about 14–16 px wide) and irregular so it reads as the "big" pothole.

**pothole-b**
1. Use the same darkened floor as pothole-a.
2. Make the two lobes read as rounded or eroded basins joined by a narrow neck, not two stepped rectangles.
3. Make it visibly different from pothole-a in silhouette and size at 2x.
