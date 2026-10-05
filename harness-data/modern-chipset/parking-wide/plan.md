# Existing-chip expansion experiment — 12 bays

User asks to see the approved parking chipset used in a larger space. This is a new assembly, NOT an extension of the small scene's acceptance. No new raster art or rotations. Reuse only current public modern_city tiles.

Canvas 26×18 cells, 16px = 416×288, 4.78× the old scene area. North wall rows 0..1 continuous; its short west return stays at (0,2). West/east/south edges are explicit cutaway section boundaries, not claims of an enclosed structural facility. Structural columns, overhead fixtures, ramp, barrier and fire door are absent from this limited chipset and must remain disclosed as missing before any full-facility claim.

Two banks, each 6 east-facing bays. Bay ground strips x=7..12 and x=19..24 (96px); outer boundary line lies at x=13 / 25. Top north shared strip is y=2. Each bay's car ground row is y=3+2*r, r=0..5; shared walking strips y=2+2*r and y=4+2*r. Pitch32px retained. Stops occupy source two-cell strips x=11..12 / 23..24 and extend into next shared row, leaving x7..10 / 19..22 free. Cars copied exactly from the approved parking kit, top row STAR and ground row solid, width5cells, origin(8+12*bank,2+2*r). Six occupied bays: west rows 0,2,5; east rows1,3,4. Six empty bays.

Aisles x1..6 and x13..18 run south/north; southern transverse connector y15..17 is a 48px projected clear strip below the bottom boundary at y14. First aisle connects to second through the southern strip. Start(4,16); engine BFS must reach every bay's left approach, its north/south shared strip, second aisle and exit(0,16). Static pedestrian scene: no vehicle-turn or door-swing simulation claim. No filler enlargement after this shape is fixed.

ASCII (coarse, each bay is 2 tile rows):
##########################  north wall
| aisle | car >| aisle |empty>
| aisle |empty>| aisle | car >
| aisle | car >| aisle |empty>
| aisle |empty>| aisle | car >
| aisle |empty>| aisle | car >
| aisle | car >| aisle |empty>
|--------- connected --------|
exit      south cross aisle

Extract semantic subregions from the approved 14×7 kit: plain floor at(0,3); north normal panel pairs at cols2..4 rows0..1; two lamps from cols8..11 rows0..2 translated +0/+12; bank cross sections cols7..13 rows2,3,4,6, with top row2 once, internal row4 between bays, terminal row6 once. Do not repeat the whole room, west return, wall lighting or floor patches inside the parking field. No stretched pixels, no made-up tile IDs.

Hard checks: correct 12/6 counts; exact original pixels; continuous north wall; no internal wall stamping; physically separate car ground/roof; all required pedestrian routes connected; no car/wall/stop walk-through; no undefined empty lower cells; exact array-to-PNG reproduction.
Advisory: repeated identical cars, flat concrete, only two north lamps, absence of structural columns and full enclosure limits richness. Assess these honestly in the final visual review. They may make the enlarged scene look unfinished even with mechanically correct tiling. Do not report this as a finished 12-space facility.
