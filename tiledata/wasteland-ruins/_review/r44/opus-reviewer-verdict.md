# Fresh adversarial Opus reviewer — final verdict (r44)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha bbad4f3b51b8628c6fdec964dd16b990256b8f48797a7b98bea45f69a7c1c733 (gate FAIL).

---

The asphalt fails, mainly on rule 6 and the overall-quality bar (rule 8). All coordinates below are in the 4x sample image; the 1x equivalent is the coordinate divided by 4.

**Rule by rule**

1. **Not water: pass, with a caveat.** The body colour (82,75,73) is a neutral warm grey, nowhere near navy, and at 2x it reads as road. The caveat is that every dark accent is cool blue-grey: specks (42,53,57), the rim and lip (61,75,81), and the crack cores. That is the same hue as the puddle (about 197° vs the puddle's 186°), only much less saturated. Along the south edges it reads faintly as a wet rim, for example at (220–250, 488–500) and (785–1000, 420–440).
2. **Specks: technically met, but weak.** Specks cover about 18% of the surface, are all isolated 1px dots, and are spread evenly in four colours. There is no 2px aggregate clustering and no tonal mottling. Next to `ref-paving` and `ref-grass` it reads as sandpaper or TV static rather than aggregate, for example the block interior at (800–990, 100–400).
3. **Cracks: borderline.** They do have a 2px core with a light lip. But all three are smooth arcs with a regular 1px step and similar length, and two have no branching. They read as scratches or claw marks, not fractures: (895–960, 140–178), (838–880, 250–320), (832–895, 340–368, the only branched one).
4. **Edges break into dirt: met, but stamped.** There is no continuous outline on N, E or W, and detached chunks exist on all four sides. However, every chunk is the same 2×2 or 2×3 stamp (light top-left pixel) at the same offset in every cell, for example at (88–100, 88–100), (328–340, 88–100), (328–340, 244–256) and (1016–1024, 152–164). Separately, the E and W edges are nearly straight vertical lines with one identical 2px bite per cell. The left side of the block runs straight at x≈784 from y 100 to 410, so the interior block and the vertical roads read as rectangles.
5. **Isolated and dead-end cells: mostly met.** The isolated cell at (460–497, 584–626) is an irregular teardrop, but it fills only about 9×11 of the 16px cell and reads as an oil stain. The east/west stubs are short, flat-cut and peaked, more fin-like than rounded: (130–180, 132–180) and (525–580, 140–185).
6. **South and north edge profile: fails.** Within each cell, the south edge is one centred 6px dip flanked by two rounded lobes, and the north edge is one centred hump. That is a deliberate rhythmic scallop, not an irregular edge. Every horizontal run therefore reads as a puffy cloud or caterpillar ribbon, clearly visible even at 2x: (205–500, 195–250), (80–350, 445–500), (140–310, 575–635).
7. **No lane paint: fine.**
8. **Quality vs references: fails.** The edge styles don't match each other: vertical edges are ruler-straight while horizontal edges are puffy. That, plus the uniform noise texture, puts it below `ref-paving`.

**Defects, most severe first**
1. The horizontal edges repeat a rounded scallop per cell (north hump, south 6px dip between two lobes), so every horizontal road reads as a cloud or caterpillar ribbon: (205–500, 195–250), (80–350, 445–500), (140–310, 575–635).
2. The E and W edges are near-straight lines with one identical 2px bite per cell, so the asphalt reads as rectangles and the vertical edges clash with the puffy horizontal ones: block left edge x≈784 for y 100–410, vertical road at x≈272 and x≈324 for y 88–190.
3. The surface texture is uniform 1px speckle at about 18% coverage with no clustered aggregate or tonal patches; it reads as noise and falls below the references: (800–990, 100–400).
4. The cracks are smooth, evenly stepped arcs that read as scratches rather than fractures: (895–960, 140–178), (838–880, 250–320), (832–895, 340–368).
5. Every detached edge chunk is the same 2×2 stamp at the same per-cell offset: (88–100, 88–100), (328–340, 88–100), (328–340, 244–256).
6. All dark accents are cool teal-grey, the puddle's hue family, so the south lip reads slightly wet: (785–1000, 420–440), (220–250, 488–500).
7. The E/W dead-end stubs end in a flat or peaked fin instead of a rounded blob, and the isolated cell is undersized: (130–180, 132–180), (525–580, 140–185), (460–497, 584–626).

VERDICT: FAIL
