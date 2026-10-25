VERDICT: oil-stain-a=FAIL, oil-stain-b=FAIL, scorch-a=FAIL, scorch-b=FAIL, crop-bed-b=FAIL
oil-stain-a 1: PASS — flat blot with no standing face; lies on the ground plane. /tmp/r61-rev1-B/oil-stain-a-8x.png
oil-stain-a 2: FAIL — reads as a dark navy crater or hole or bug splat, not oil in earth. The blue-black core is outside the warm dirt ramp. In the maps it shows as a teal-blue puddle (settlement-4 at about x183,y40 and x567,y472). /tmp/r61-rev1-B/sheet4.png, map-settlement-4.png
oil-stain-a 3: FAIL — core is nearly one flat fill with only 1-2 steps and no sheen highlight. The outline is a blobby hard-edged dark rim, not soaked into the dirt. /tmp/r61-rev1-B/oil-stain-a-8x.png
oil-stain-a 4: FAIL — blots sit in open dirt far from cars, drums or generators (settlement-4 top row, ruined-city-5 at about x365,y52). They look like water puddles, not oil. map-settlement-4.png, map-ruined-city-5.png
oil-stain-a 5: FAIL — the blue tint and uniform shape read as a sticker or toy puddle next to the Beodeul ground detail. /tmp/r61-rev1-B/sheet4.png
oil-stain-b 1: PASS — flat, no side view. /tmp/r61-rev1-B/oil-stain-b-8x.png
oil-stain-b 2: FAIL — same blue-black crater or hole read. The interior has a checkerboard dither that looks like a grille or bug, not a liquid film. /tmp/r61-rev1-B/oil-stain-b-8x.png
oil-stain-b 3: FAIL — the checkerboard dither is a salt-and-pepper pattern. There are no soak-in edge steps, and the rim is hard. /tmp/r61-rev1-B/oil-stain-b-8x.png
oil-stain-b 4: FAIL — scattered in open dirt as teal puddles, not beside vehicles, drums or generators. The a/b pair looks alike and repeats. map-settlement-4.png, map-ruined-city-5.png
oil-stain-b 5: FAIL — amateur dither look, off the dirt palette. /tmp/r61-rev1-B/sheet4.png
scorch-a 1: PASS — flat blot, no standing face. /tmp/r61-rev1-B/scorch-a-8x.png
scorch-a 2: FAIL — nearly the same dark blot as oil, with grey flecks. It reads as a pit with speckles, not a burnt patch. There is no brown-black charcoal ramp and no charred sticks. In the maps it looks like a bug or a black hole. /tmp/r61-rev1-B/sheet4.png, map-settlement-4.png (about x680,y232)
scorch-a 3: FAIL — flat dark fill with scattered single-pixel grey noise. The edge is a hard rim, not an ash feather into the dirt. /tmp/r61-rev1-B/scorch-a-8x.png
scorch-a 4: FAIL — dark blots appear on the road and in open dirt (settlement-4 at about x245,y455; ruined-city-5 at about x645,y185), not beside campfires or ruins. The same blot repeats. map-settlement-4.png, map-ruined-city-5.png
scorch-a 5: FAIL — reads as a dirty dot stamp, not hand-drawn burnt ground. /tmp/r61-rev1-B/sheet4.png
scorch-b 1: PASS — flat, no side view. /tmp/r61-rev1-B/scorch-b-8x.png
scorch-b 2: FAIL — it is hard to tell apart from the oil blots or a hole. There are no charred sticks and no ash gradient. /tmp/r61-rev1-B/scorch-b-8x.png
scorch-b 3: FAIL — flat fill, single-pixel grey flecks (salt and pepper), hard outline. /tmp/r61-rev1-B/scorch-b-8x.png
scorch-b 4: FAIL — the black blot repeats across the shanty and settlement maps with no fire or ruin nearby. map-shanty-3.png (about x120,y185 and x265,y280), map-settlement-4.png
scorch-b 5: FAIL — toy-like and amateur against the Beodeul bar. /tmp/r61-rev1-B/sheet4.png
crop-bed-b 1: PASS — frame and ridges read as seen from above; no standing face. /tmp/r61-rev1-B/crop-bed-b-8x.png
crop-bed-b 2: PASS — reads as a planted bed with green rows and stakes, not a crate or rug. /tmp/r61-rev1-B/crop-bed-b-8x-black.png
crop-bed-b 3: FAIL — the plank frame is a thin flat 1px line with no light top edge or dark underside. Plants are tiny and the ridges are monotone. There is a stray yellow pixel. The edge is a rectangular cell shape against the dirt. /tmp/r61-rev1-B/crop-bed-b-8x-black.png
crop-bed-b 4: FAIL — in settlement-4 the beds (about x95,y430 and x445,y445) sit in open dirt with no fence around them. In settlement-1 two beds side by side are identical stamps. /tmp/r61-rev1-B/map-settle1-garden-4x.png, map-settlement-4.png
crop-bed-b 5: FAIL — the thin frame and tiny plants read as a flat stamped tile, a step below Beodeul. /tmp/r61-rev1-B/map-settle1-left-3x.png
NOTE: system load stayed at 64-85 (above the 40 threshold) throughout. I limited myself to a few light PIL crops. The map-placement checks for ruined-city-2/5, settlement-1/4 and shanty-3 were done by eye at 1x plus the 3x/4x crops listed. shanty-6 was not separately inspected.
FIXES:
- oil-stain-a and oil-stain-b: recolour the blue-black core to warm dark browns (about #2a1e18 -> #3b2a20 -> #54402f) with one 1-2px glossy sheen highlight in a dark desaturated blue-grey on the upper-left. Add 2-3 intermediate steps from core to dirt over a 2px soak-in ring, so the edge is a dither-free gradient into the dirt colour. Remove the checkerboard in b. Make the outline asymmetric with a lobe or a drip on one side. Make a and b differ clearly in silhouette.
- scorch-a and scorch-b: use a brown-black charcoal ramp (4 steps from #1c1613 to #4a3a30), clearly different from oil, with a feathered ash-grey halo and an irregular, torn silhouette. Add 2-3 charred stick pixels (2-3px dark lines with a faint ember-brown tip) and cluster the ash flecks into a few 2px groups instead of scattered single pixels. Drop the hard rim.
- crop-bed-b: thicken the plank frame to 2px, with a lighter top plank pixel row, a dark underside and a few plank-end joints. Give each ridge 3 tones (light crest, mid, dark furrow). Enlarge the bean plants to 2-3px with a lit top and a stake pixel. Remove the stray yellow pixel. Round or break the frame corners so the edge is not a clean rectangle. Make two variants, or flip one, to avoid identical stamps. Place it only inside a fenced plot.
- Placement (map generation): put oil only within 1-2 cells of cars, drums and generators, scorch only beside campfires and ruins, and stop scattering them in open dirt or on the road.
VERDICT: oil-stain-a=FAIL, oil-stain-b=FAIL, scorch-a=FAIL, scorch-b=FAIL, crop-bed-b=FAIL
