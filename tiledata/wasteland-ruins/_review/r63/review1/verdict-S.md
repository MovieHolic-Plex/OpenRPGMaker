VERDICT: FAIL

## Scale findings
Measured on scale-wasteland-1x.png (dark-pixel components, 4-8x crops). Beodeul reference measured the same way: house doors 10x25 (h101_2) and 10x26 (h102_1), cabin door ~10x20, log-wall door ~21; storey (wall band) ~31-34 px; windows ~8x8 plus a frame (~10x10); Beodeul cabin front wall ~34 px. Hero visible figure = 24 px.
- husk-tall: DETAILS MINIATURE. The 60 px facade shows 3 storeys at ~20 px each, so every storey is shorter than the hero (24). The door is 11x15 and the hero's head clears the lintel by 9 px. Fix: storeys ~32 px and door ~11x25, so 2 storeys in the existing facade, or keep 3 storeys and grow the object to ~64x128.
- husk-g: DETAILS MINIATURE, the worst one. 5 storeys at ~16 px each in a 96 px facade, window openings ~5-6 px tall, double door 15x15 (component 7+7 x 15). It reads as a 10-storey model tower next to the hero. Fix: 3 storeys at ~32 px in 96 px, windows ~10x10, door ~22x26 (double) or 12x26.
- husk-h: DETAILS MINIATURE. Upper floors are ~17 px storeys with ~6x6 windows. The shopfront band is ~24 px, so shutters are hero height, still low. Fix: 2 storeys at ~32 px above a ~30 px shopfront, windows ~10x10. That needs ~96x112, or drop one floor.
- husk-e: DETAILS MINIATURE. 2 storeys at ~20 px, door 11x16 (hero 24). Windows 10x11 are fine. Fix: storey ~30 px, door ~11x25. Keep 2 storeys and grow to ~64x96, or keep 80 px and show 1 storey plus a broken top.
- husk-a: TOO SMALL details. Door 11x17 against hero 24 (Beodeul 10x25). Fix: door ~11x25. The ~33 px front wall already allows it; raise the lintel. Windows 10x7-8 are acceptable.
- husk-b: TOO SMALL details. Door 10x16. Fix: door ~10x25 (front wall is ~27 px, so make the wall ~32 px).
- shack-a: TOO SMALL. Front wall ~23 px, as tall as the hero (Beodeul cabin wall ~34). Door ~11x17. Fix: wall ~32 px, door ~11x22-24, object ~48x64 or 64x64.
- shack-b: slightly small. Door ~19 px. Fix: door ~22-24 px. The wall height (~31) is fine.
- shack-2f: DETAILS MINIATURE upper floor. The upper storey is ~19 px, lower ~30. Fix: upper floor ~28-32 px, which needs ~48x64.
- hut-sheet: TOO SMALL. The whole hut is 32x31, front wall ~16 px, door ~14 px. The hero is taller than the hut's eaves. Fix: ~48x48 with wall ~28 and door ~22-24.
- hut-stove: TOO SMALL. Same 32x32 dwelling problem: eaves below the hero's head. Fix: ~48x48 with a ~22-24 px door.
- lean-doors: TOO SMALL. 48x32 storage lean-to with bay openings ~16-18 px and roof included in 32 px. The hero is as tall as the whole structure. Fix: ~48x48 with ~24 px openings.
- lean-to: TOO SMALL. 31 px including the tarp, so the sheltered opening is ~16-18 px. Fix: ~48x48 with a ~24 px clear opening.
- tent-tarp: TOO SMALL. 32x32 including the pole; tent body ~22 px, door opening ~10 px tall. Fix: ~48x32 or 32x48 with a ~16-18 px opening (crouch height).
- stall-a, stall-b, market-shelter: TOO SMALL. 30-32 px including the awning, so the awning eave sits at ~20 px, below the hero's head (24). Fix: ~48x48 with the eave at ~30 px and the counter at ~12-14 px.
- gate-scrap: TOO SMALL. 32 px posts with the crossbar at ~20 px clear, so the hero cannot pass under. Fix: 32x48 or 48x48 with ~28-30 px clear under the bar.
- van-rust: TOO SMALL in height. 64x28 with the body side ~20 px, lower than the hero. A van is taller than a person. Fix: ~64x40-48 with the body ~30 px and wheels ~8-10 px.
- lamp-broken: TOO SMALL. 31 px street lamp, only 1.3 heroes. Fix: ~16x48 (2 heroes).

OK (checked, scale reads right against the hero and Beodeul props): crop-bed-b, crop-bed-c, wall-h, wall-h2, wall-v, wall-stub, shack-c (door ~22, wall ~30), container-home, barricade-h, fence-h, car-rust-h, car-rust-v, water-tank, generator, solar-scrap, campfire, log-seat, drums (~14 px, Beodeul barrel 14), tyres, crates (16x15 each, Beodeul crate 13), crates-plastic, scrap-heap, rubble-pile, dead-tree, bush-wild, vine-wall, jersey-barrier, sign-blank, wash-line.

## Floor findings
- Dirt (settlement4 / shanty3): 3 tones laid as large 2-4 px camouflage blotches over every cell. The base (123,93,72) is v96 and covers 59%. The light blotch (145,111,87) is v114 (+18) and covers 27%. The dark blotch (101,76,57) is v78 (-18) and covers 11%, plus v57 dark bits. Beodeul dirt is v97 base 49%, with a darker grain at v84 (-13, 17%) and a lighter one at v103 (+6, 12%) laid as 1-px grain, not blotches. Targets: one light step ~+6, one dark step ~-10; light coverage below 12% and dark below 15%; no 3x3+ blotches; break up the visible 16 px repeat.
- Speck decals on dirt (grey/red pebbles, yellow dry-grass tufts, teal puddles): about 44% of 16 px cells in an open strip of settlement4 (85/192 cells hold 2 or more speck pixels), so about 40+ per 10x10 cells. Beodeul dirt and grass carry about 10-15 per 10x10, clustered near paths and edges. Target ≤12 per 10x10, clustered at edges, ruins and roads.
- Calm areas: wasteland has no empty patch; every cell is mottled and specked. Beodeul grass and dirt keep calm runs of 4x4+ cells. Target: calm areas of at least 4x4 cells of plain base tone, at least 50% of open ground.
- Road asphalt: base v77 (66%) with lighter blotches v98 (+21, 25%) and v116 (+39, 5%), plus cracks and pothole decals spaced every few cells. It reads dirty and gravelly, not like asphalt. Target: one lighter step ~+8 at ≤10% coverage, cracks/potholes ≤1 per 10 cells of road length, no +39 highlights.
- Curb/sidewalk slabs and the concrete pad are fine in contrast. The crumbled edge noise on the pad is acceptable.

## Top 5 fixes in priority order
1. Redraw the tall husks (husk-g, husk-tall, husk-h, husk-e) with ~32 px storeys, ~10x10 windows and ~25 px doors. Cut the storey count or make the objects taller; do not squeeze 3-5 floors into 96 px.
2. Enlarge the shanty dwellings (hut-sheet, hut-stove, shack-a, lean-doors, lean-to, shack-2f upper floor) so walls and eaves sit at ~28-32 px and doors at ~22-24 px. The hero must never be taller than a house's eave.
3. Calm the dirt base: replace the ±18 three-tone blotch pattern with a 1-px grain at about +6/-10, and keep light/dark coverage under ~12-15%.
4. Cut floor decals from ~40 to ≤12 per 10x10 cells, cluster them near ruins and road edges, and leave 4x4+ empty runs. Do the same on asphalt: drop the +39 highlights and the dense cracks/potholes.
5. Resize the walk-through and street props: stalls and market-shelter to ~48 px with the eave at ~30, gate-scrap to ~28-30 px clear under the bar, van-rust to a ~30 px body height, lamp-broken to ~48 px. Raise the husk-a and husk-b doors to ~25 px.
