VERDICT: oil-stain-a=FAIL, oil-stain-b=PASS, scorch-a=FAIL, scorch-b=FAIL, crop-bed-b=PASS, crop-bed-c=PASS

oil-stain-a 1: PASS — flat, no standing face; halo lies on the dirt (oil-stain-a-1x, 16x zoom of cell 1,1).
oil-stain-a 2: FAIL — near-symmetric horizontal oval with concentric darkening to a single darkest 2-3px core plus one cold blue glint pixel in the exact centre: reads as a small burrow/hole (darkest centre = depth) or an eye, not oil soaked flat into earth. At 10x the two side-by-side copies literally read as a pair of eyes (oil-stain-a-10x). Oil should be flat-dark across its whole body with an off-centre sheen streak, not a radial pupil.
oil-stain-a 3: PASS — 4 dark steps (4a3828/3b3634/2f2418 + blue sheen), soft fringe into dirt, no square outline.
oil-stain-a 4: PASS — beside drums/crates/vans (crop-shanty-3-oil-stain-a-7_10 by drum+shack, crop-ruined-city-2-oil-stain-a-2_16 by drums/crates); no stamp rows, no cell seams.
oil-stain-a 5: FAIL — the "eye/hole" read makes it look like a stock blob, not a deliberate stain.
oil-stain-b 1: PASS — flat diagonal smear, no side face.
oil-stain-b 2: PASS — elongated irregular smear with a sheen streak along its length and a rust pixel; reads as a spill/drip trail soaked into dirt, not a hole (16x zoom, crop-settlement-1-oil-stain-b-7_23 between van and jeep).
oil-stain-b 3: PASS — dark body graded into dirt via 654c39/4a3828 fringe, sheen breaks the fill, no cell outline.
oil-stain-b 4: PASS — next to wrecked van/jeep/car in all crops (settlement-1 7_23, settlement-4 37_12 by wreck car); no visible repetition grid.
oil-stain-b 5: PASS — reads intentional at 1x.
scorch-a 1: PASS — no standing face.
scorch-a 2: FAIL — the mark is one fat diagonal dark slab (~8x4 px, 2f2418/3b3634 core) rimmed by paired light-grey highlight pixels (8d8482+7b7270 at its lower-left, upper-right and below it) and one red ember: the rim highlights give it volume, so it reads as a single charred log / black rock lump lying on the ground, not a burnt patch. No wide soot falloff, no ash bed, no scattered sticks. Its silhouette and diagonal are also almost the same as oil-stain-b, so at 1x scorch and oil are interchangeable smudges (crop-settlement-1-scorch-a-2_12, crop-shanty-6-scorch-a-30_11).
scorch-a 3: FAIL — the grey highlight pairs are isolated 2px specks sitting outside the dark mass (rows 23,25,27,29 of the cell) = salt noise; the burnt area is far too small for a 16px cell (the dark part covers ~25% of the cell), so it can't carry soot -> ash -> char steps.
scorch-a 4: PASS — next to ruined brick building / rubble heap and near a campfire slab; no stamp grid, no seam.
scorch-a 5: FAIL — reads as a tiny dropped lump, amateur next to Beodeul ground decals.
scorch-b 1: PASS — flat.
scorch-b 2: FAIL — flat dark oval core with a ring of light flecks on its top and bottom rims: dark centre + lighter rim = small pit/hole with pebbles at its lip. No charred sticks, no grey ash centre, no outward soot gradient (16x zoom, crop-settlement-1-scorch-b-11_23 next to the rubble heap reads as a dug hole).
scorch-b 3: FAIL — the core is a near-flat 2f2418 fill (~14 px, no internal variation) with a hard 1-step edge to 4a3828; rim flecks are single/paired grey pixels = salt-and-pepper.
scorch-b 4: PASS — beside rubble heap/crates; ground natural, no repetition.
scorch-b 5: FAIL — tiny, hole-like, not a convincing burn.
crop-bed-b 1: PASS — frame seen from above with a slightly lighter front (bottom) rail face, ridges and plant crowns all top-down (crop-bed-b-6x).
crop-bed-b 2: PASS — three tilled ridges with 11 leafy plants in rows inside a frame; reads as a planted bed, not crate/rug/grille.
crop-bed-b 3: PASS — plants 3 greens + dark shadow, ridges lit/shadow bands, frame has joints and highlight; no noise. Frame is a hard rectangle but that is the object's real edge. (Minor: frame reads as grey scrap metal rather than planks.)
crop-bed-b 4: PASS — settlement-4, inside the fenced plot (fence rows above and below, posts left/right), offset from bed-c with crates/drum between; no seam.
crop-bed-b 5: PASS.
crop-bed-c 1: PASS — top-down frame and plants.
crop-bed-c 2: PASS — different from bed-b: uneven rows, gaps, reddish fruiting plants, teal left board; clearly a garden bed.
crop-bed-c 3: PASS — same shading depth as bed-b, no flat fills.
crop-bed-c 4: PASS — inside the fence in settlement-4 (crop-settlement-4-crop-bed-c-35_24), paired with bed-b, offset vertically.
crop-bed-c 5: PASS.

FIXES:
- oil-stain-a: break the radial symmetry — make the body an irregular lobed blotch ~11x8 px with 2 satellite drips, keep the body mostly one flat dark tone (2f2418/3b3634 mixed in a dither cluster, not a centred darkest pupil), move the blue/purple sheen to a 3-4 px curved streak off-centre (upper-left lobe) instead of 1 centred pixel; fringe with 4a3828/654c39 broken edge only on 2 sides.
- scorch-a: replace the single slab with a wide (~13x10 px, nearly filling the cell but with ragged non-square edge) soot patch: outer ring of 654c39->4a3828 dithered soot, inner 3b3634, then a 4-6 px grey ash centre (68605e/7b7270/8d8482 clumped, not isolated pairs), and 2-3 thin 1px-wide charred sticks (2f2418 with one 70402f ember pixel at a tip) lying across it. Remove the light rim highlights that give it volume. Make the silhouette clearly different from oil-stain-b (round/ragged, not diagonal).
- scorch-b: same patch structure as above but different shape (lopsided, wind-streaked to one side); fill the centre with lighter grey ash instead of a flat 2f2418 core so it reads as burnt ground, not a hole; drop the light rim flecks around the edge (they read as pebbles at a pit lip), put ash flecks inside the patch instead; add 1-2 charred stick ends.
