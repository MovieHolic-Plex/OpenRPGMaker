VERDICT: FAIL

Reason in one line: all 12 redrawn pieces now read at Beodeul scale, but the floor does not. The dirt is calm now. The asphalt is still the old busy camouflage: 88% of road pixels are identical to the before render, and its luminance SD is 16.4 after vs 17.2 before. So the brief's claim "asphalt-ph calmer" does not hold.

Measured on scale-wasteland-1x crops zoomed 6x (/tmp/r63s2/*.png). Hero = 24 px visible. Error about ±1 px.

## Redrawn pieces
- husk-a: PASS — door 11x24, front storey ~37 px (one storey + parapet), windows 9x8 framed. The door top is level with the hero's head.
- husk-b: PASS — door 11x24, front wall ~34 px, windows ~9x9. The rubble half reads as a collapsed corner, not as a smaller building.
- husk-tall: PASS — three storeys of 30/30/30 px, door 11x25, windows 8-10 px with frames, roof deck ~39 px on top. Matches the Beodeul storey ruler.
- shack-b: PASS — door 12x27 including frame, wall 31 px, eave 31 px above ground (above the hero's head), louvre window ~16 px wide (a vent, acceptable).
- shack-c: PASS — door 12x27, wall ~34 px, framed window ~9-10 px, eave above the head.
- container-home: PASS (minor) — door opening 12x27, box wall ~36 px (top of the Beodeul range), awning ~37 px. The barred window is ~15x10, larger than Beodeul's 8-10 px windows, but it reads as a container cut-out, not a scale error.
- stall-a: PASS — canopy edge 32-33 px above ground, counter front 15 px (shoulder/chest height of the hero, about 1 m), 48 px total.
- stall-b: PASS — same rig as stall-a: eave ~32 px, counter ~15-16 px. Goods are 3-5 px, consistent with a 13 px crate.
- dead-tree: PASS — 64 px tall (2.7x hero), trunk ~9 px wide. Smaller than the Beodeul broadleaf (~80 px), but reasonable for a dead tree.
- lamp-broken: PASS — 47 px (about 2x hero), head ~41 px above ground, pole 4-5 px.
- hut-sheet: PASS — door 12-13x27 (curtained), wall 31 px, barred window ~11x11 framed, eave ~31 px above ground.
- wash-line: PASS — posts 25 px, line at about 23 px (hero eye/head height), cloths 5-8 px. It reads as a person-height clothes line.

## Floor
FLOOR: FAIL — Dirt passes and asphalt fails. On dirt, after vs before: the large blotches are gone (4x4-px block-mean SD inside base tiles is 2.9 after vs 5.6 before in settlement4, and 2.5 vs 5.5 in shanty3), and the empty dirt reads as calm, fine grain. I counted decals by hand in 10x10-cell windows. Settlement4 cells (36..45, 0..9): after about 13 grey/red pebble specks + 1 weed tuft; before about 22 specks + 1 puddle + blotches. Settlement4 cells (20..29, 25..34): after about 2 scorch stains + 1 weed + about 5 specks. A Beodeul vineyard3 grass 10x10 has about 4-5 small decals (2 flower tufts, 1 rock cluster, 1 small bush). So wasteland dirt still carries about 2-3x Beodeul's speck density, but the specks are 2-4 px and low-contrast, so they are acceptable. Asphalt fails. The road between the kerbs is the same pattern as before: light-grey camouflage patches plus brown chips, luminance SD 16.4 vs 17.2 before (p5-p95 77..116 in both), and only 11.8% of pixels changed (mostly one pothole decal removed). In the 3x crops of settlement4 and settlement1, the road is now the busiest, highest-contrast surface on the map, louder than the calm dirt beside it, and Beodeul has no ground that busy. Fix: flatten asphalt-ph to a near-flat base with sparse 1-2 px grain at about half the current contrast.

## Still off-scale (old art kept)
shack-a (door ~12x17-18, wall ~22 px, both below the hero's head), lean-to (roof ~20 px, below the head), lean-doors (opening ~16-18 px), shack-2f (storeys ~13-15 px, door ~14 px), hut-stove (~20 px total, shorter than the hero), market-shelter (eave ~15-16 px, at the hero's chest), husk-e (storeys ~18 px, door ~18 px), husk-g (storeys ~14 px), husk-h (storeys ~20-22 px, ground shutters ~20 px). gate-scrap is borderline (opening ~22 px). car-rust-h and car-rust-v are slightly small (48 px long = 2x hero). tent-tarp and van-rust read acceptably. husk-c is not in either list, but it is also undersized (storeys ~20 px).

Side note: in before-map-settlement4 the shack (shack-b) is pixel-identical to the after render, so the "before" map does not show shack-b's old art. Only the stall visibly changed in that crop.
