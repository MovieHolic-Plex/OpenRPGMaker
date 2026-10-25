# Fresh adversarial Opus reviewer — final verdict (r38)

Piece(s): asphalt + dirt-c. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha 8753286b65e4f2682a35e8e2abc535210af9c04495212d18f17ee139a3d61e56 (gate FAIL); dirt-c sha 7b59c67c4323… (gate FAIL).

---

## Verdicts

| Piece | Verdict |
|---|---|
| `asphalt` | **FAIL** |
| `dirt-c` | **PASS** |

## asphalt: FAIL

**What works**
- It does not read as water. The surface is grey (about 82,75,73) with scattered single-pixel specks. Next to the teal puddle in `puddle-sample-4x.png` it is clearly a different material.
- The cracks, dark stains and the yellow paint chip in the large slab look right for an old road.
- There are no horizontal ripple dashes inside the road surface.

**Defects a player will see**
1. **Dark lip strokes inside connected road.** On the vertical road at native x≈83–94 (4x sample x≈335–375), a near-black (14,23,32) two-row stroke appears at native y=34–35, 66–67, 82–83 and 98–99. These rows are inside the road, not at an open edge. The stroke is identical each time and repeats exactly every 16px, so the straight road reads as a bamboo or ladder pattern at 1x/2x. The same stroke appears in the dead-end stubs at 4x (85–120, 90–100), (340–375, 90–100), (600–630, 90–100) and (215–245, 405–415). The north–south straight cell, and probably the end caps, seem to have an edge stroke built in on one side.
2. **The road's width repeats every tile.** A vertical straight narrows to 8px at the top of each cell, widens to 12px, then narrows again. The same silhouette repeats every 16 rows, so the edges look beaded rather than randomly chipped. The horizontal arms show the same repeat along their bottom lip.
3. **Hat-shaped dead-ends.** Each north end cap (4x around (80–125, 70–105), (335–380, 70–105), (590–635, 70–105)) forms a mushroom or hat shape with a dark stripe through it. It looks like an object, not a broken-off road end.
4. **Light square blocks at bottom-right ends.** A flat lighter-grey square of about 4×4 native px sits at 4x ≈(985–1010, 410–435) on the slab, (340–372, 478–500) on the end of the L-shaped road, and (598–625, 478–495) on the small patch. They read as tile glitches, not loose chunks.
5. **Minor: dashed left edge on the slab.** Short dark dashes run down the slab's left edge (4x x≈785) at a regular spacing, which shows the stamp rhythm again.
6. **Minor: the surface leans warm.** The surface sits at warm-neutral (82,75,73), not the cool charcoal the brief asks for. Most of the cool feel comes from the specks. This is not enough to fail on its own.

**Fixes**
- Remove every lip stroke from edges that connect. The dark lip line plus shadow should only appear on edges that are open according to the mask, and only at the very border row.
- Vary the side outline across the 8 interior variants, or randomise it per edge, so the road width does not repeat every 16px. Keep the width roughly constant (about 10–12px) and put the irregularity in 1–2px chips.
- Redraw the dead-end caps as a ragged broken lip with one or two loose chunks beside it.
- Replace the flat grey squares with irregular chunks of 1–3px, or remove them.
- Optionally move the base colour about 4 points cooler, to roughly (78,77,80).

## dirt-c: PASS

- The earth is soft, low-contrast and clumped. At 1x it reads as one even field.
- I compared each 16px cell of the dirt-c sample against the dirt-b sample. Only 11 cells differ, so the gravel and rust cells are sparse. Up close (4x crop 180–440 × 180–460) each cell has 2–4 small grey pebbles with 1–2 rust flakes, in different arrangements. They read as scattered gravel, not stamps.
- In the 2×2-period view I saw no repeating rows of dark blotches and no clear diagonal alignment.
- **Nit, not a fail:** three gravel clusters sit at about the same height (4x y≈410–440 at x≈30, 280 and 410). Another three sit around y≈80–105. That is a mild row grouping, and it comes from where cells were placed in the sample, not from the tile itself. Keep gravel cells spread out when the field is laid. The cluster at the sample's corners, (150–175, 5–35) and its copies, is just the 128px period wrapping, not a defect.

**3/4 view gate:** this review is not an `object-gate` receipt. Neither piece has passed that gate.
