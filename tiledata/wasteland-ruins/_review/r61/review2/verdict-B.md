VERDICT: oil-stain-a=PASS, oil-stain-b=FAIL, scorch-a=FAIL, scorch-b=FAIL, crop-bed-c=PASS
oil-stain-a 1: PASS — flat blot on dirt, no standing face. /tmp/r61-rev2-B/oil-stain-a-8x.png
oil-stain-a 2: PASS — dark soaked patch with one pale sheen streak, reads as oil in earth; borderline hole-like but the sheen and the ragged rim carry it. /tmp/r61-rev2-B/oil-stain-a-8x.png
oil-stain-a 3: PASS — 3 to 4 dark steps plus a sheen step, edge dithers into dirt; slight blobbiness but acceptable. /tmp/r61-rev2-B/oil-stain-a-8x.png
oil-stain-a 4: PASS — blots sit beside cars, generator and drums in settlement-1 and settlement-4; no stamp rows. /tmp/r61-rev2-B/map-settlement-1-q1.png, /tmp/r61-rev2-B/settlement-4-15.png
oil-stain-a 5: PASS — not toy-like at 1x.
oil-stain-b 1: PASS — lies flat. /tmp/r61-rev2-B/oil-stain-b-8x.png
oil-stain-b 2: FAIL — near-black, round, almost no sheen; reads as a hole or pit, not oil soaked into earth. /tmp/r61-rev2-B/oil-stain-b-8x.png
oil-stain-b 3: FAIL — core is a flat dark fill (1 to 2 values) with a hard rounded outline and only one tiny highlight; weak shading steps. /tmp/r61-rev2-B/oil-stain-b-8x.png
oil-stain-b 4: FAIL — on asphalt and road dirt in ruined-city-2 and settlement-4 it appears far from any vehicle or drum and reads as a hole in the road. /tmp/r61-rev2-B/map-ruined-city-2-q0.png, /tmp/r61-rev2-B/settlement-4-15.png
oil-stain-b 5: FAIL — blobby dark stamp, amateurish next to Beodeul. /tmp/r61-rev2-B/oil-stain-b-8x.png
scorch-a 1: PASS — flat. /tmp/r61-rev2-B/scorch-a-8x.png
scorch-a 2: PASS — grey ash flecks and charcoal bars read as a burnt patch up close. /tmp/r61-rev2-B/scorch-a-8x.png
scorch-a 3: FAIL — dark mass has nearly the same value and the same ragged blob outline as oil-stain-a; it lacks a warm char to ash gradient, and the outer rim is a hard dark ring. /tmp/r61-rev2-B/scorch-a-8x.png
scorch-a 4: FAIL — at 1x the patch is indistinguishable from the oil blots, and the settlement-1 campfire on its slab has no scorch beside it. /tmp/r61-rev2-B/camp1.png, /tmp/r61-rev2-B/map-settlement-1-q0.png
scorch-a 5: FAIL — two near-identical dark-blob decal families look like one recoloured stamp.
scorch-b 1: PASS — flat. /tmp/r61-rev2-B/scorch-b-8x.png
scorch-b 2: FAIL — regular diagonal crosshatch reads as a grille or mesh, not charred sticks and ash. /tmp/r61-rev2-B/scorch-b-8x.png
scorch-b 3: FAIL — squarish silhouette, repeated line pattern, and a hard outline that does not blend into the dirt. /tmp/r61-rev2-B/scorch-b-8x.png
scorch-b 4: FAIL — visible as a square stamp on the road in ruined-city-2, and not placed by fires or ruins. /tmp/r61-rev2-B/map-ruined-city-2-q0.png
scorch-b 5: FAIL — toy-like, mechanical pattern.
crop-bed-c 1: PASS — plank frame and ridges read from above. /tmp/r61-rev2-B/crop-bed-c-8x.png
crop-bed-c 2: PASS — reads as a planted bed with bean plants, not a crate or rug. /tmp/r61-rev2-B/crop-bed-c-8x.png
crop-bed-c 3: PASS — enough greens, soil and plank steps, with no hard cell outline. /tmp/r61-rev2-B/crop-bed-c-8x.png
crop-bed-c 4: PASS — sits inside a fenced plot beside a drum/crate cell in settlement-1 and settlement-4. Only one bed per plot is visible in these maps; minor. /tmp/r61-rev2-B/garden1.png
crop-bed-c 5: PASS — acceptable, not toy-like at 1x.
FIXES:
oil-stain-b: Lighten the core from near-black to dark brown-grey (about 2 steps above the current darkest). Add a 2 to 3 px curved sheen arc, offset from the centre, in a cool grey-violet, plus a second 1 px sheen. Make the outline irregular and lobed, not round. Add a lighter soaked-brown halo ring that dithers outward into the dirt, 1 to 2 px wide. Shift its placement rule so it is only placed adjacent to vehicles, drums or generators and never on bare road.
scorch-a: Re-key the value ramp as warm char (dark red-brown to black) at the core, then grey ash at the edge, then dirt. Keep it visibly warmer and drier than the cool oil blots, with no wet sheen. Add 3 to 4 distinct ash-grey flecks in the outer ring and 2 charcoal sticks as 1x3 and 1x4 px lines at different angles. Remove the hard dark ring and replace it with dithered ash. Add scorch beside the campfire and ruin placements in the map generator.
scorch-b: Delete the diagonal crosshatch. Redraw as an irregular, non-square blob that touches no cell edge. Use scattered ash flecks (light grey, 1 to 2 px clusters), 2 to 3 charcoal sticks of different lengths and angles, and a warm char core. Feather the rim into the dirt and make sure the silhouette differs from scorch-a. Restrict placement to cells adjacent to fires or ruined buildings.
