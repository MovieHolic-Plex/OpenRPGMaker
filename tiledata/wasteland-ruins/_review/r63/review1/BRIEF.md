# Adversarial review: wasteland_ruins object scale and floor noise (r63 round 1)

You are an independent, adversarial pixel-art reviewer. The user looked at the wasteland_ruins chipset (16px tiles, 3/4 top-down RPG, code hand pixels) and said:
1. The wasteland objects (ruined building husks, shacks, tents, crates, barrels/drums, crop beds, rocks, vehicles) are at a DIFFERENT SCALE than Beodeul (the reference chipset of the same game). The fix must be to the art scale itself.
2. The wasteland floor is too messy: too much noise, too many decals, texture contrast too high.

Your job is to find every problem. Do not be kind. Do not invent problems you cannot see either.

## Reference scale
The hero is Actor1 (RPG Maker 2000 charset), a 24x32 frame drawn at 1x on 16px maps; the visible figure is 24 px tall (feet to top of hair). Beodeul is the target: its objects are drawn in the same game world with that same hero.

## Files (all in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r63/review1)
- scale-wasteland-1x.png / -3x.png: hero standing beside every wasteland object, feet on the same baseline, faint 16px grid behind.
- scale-beodeul-1x.png / -3x.png: hero beside the Beodeul reference objects (door, houses, cabin, crates, barrels, fences, carts/wagon, trees, boulder, well, fenced field).
- map-settlement4-hero-*.png, map-shanty3-hero-*.png: real wasteland maps made by the composer, hero pasted on walkable cells (1x full map; 3x crop around the first hero).
- map-beodeul-vineyard3-hero-*.png, map-beodeul-mining7-hero-*.png: real Beodeul town maps with the hero, same treatment. Compare floors and object scale against these.

## Measured heights (opaque pixel height; ratio = object height / hero visible height 24)
Wasteland:
| id | size px | drawn h | ratio |
|---|---|---|---|
| crop-bed-b | 48x32 | 29 | 1.21 |
| crop-bed-c | 48x32 | 29 | 1.21 |
| husk-a | 96x80 | 80 | 3.33 |
| husk-b | 80x64 | 64 | 2.67 |
| husk-tall | 64x96 | 96 | 4.0 |
| wall-h | 48x32 | 27 | 1.12 |
| wall-v | 16x48 | 48 | 2.0 |
| wall-stub | 16x32 | 25 | 1.04 |
| shack-a | 48x48 | 46 | 1.92 |
| shack-b | 64x64 | 64 | 2.67 |
| lean-to | 48x32 | 31 | 1.29 |
| shack-c | 48x48 | 47 | 1.96 |
| container-home | 64x48 | 44 | 1.83 |
| tent-tarp | 32x32 | 32 | 1.33 |
| barricade-h | 48x32 | 24 | 1.0 |
| fence-h | 16x16 | 16 | 0.67 |
| gate-scrap | 32x32 | 32 | 1.33 |
| car-rust-h | 48x32 | 29 | 1.21 |
| car-rust-v | 32x48 | 48 | 2.0 |
| van-rust | 64x32 | 28 | 1.17 |
| water-tank | 32x48 | 45 | 1.88 |
| generator | 32x32 | 31 | 1.29 |
| solar-scrap | 32x16 | 16 | 0.67 |
| campfire | 16x16 | 14 | 0.58 |
| log-seat | 32x16 | 13 | 0.54 |
| stall-a | 48x32 | 32 | 1.33 |
| stall-b | 48x32 | 32 | 1.33 |
| drums | 16x16 | 16 | 0.67 |
| tyres | 16x16 | 15 | 0.62 |
| crates | 32x16 | 15 | 0.62 |
| scrap-heap | 48x32 | 26 | 1.08 |
| rubble-pile | 32x32 | 23 | 0.96 |
| dead-tree | 32x48 | 48 | 2.0 |
| bush-wild | 32x32 | 31 | 1.29 |
| vine-wall | 16x32 | 27 | 1.12 |
| lamp-broken | 16x32 | 31 | 1.29 |
| jersey-barrier | 32x16 | 16 | 0.67 |
| sign-blank | 16x32 | 31 | 1.29 |
| husk-e | 64x80 | 80 | 3.33 |
| wall-h2 | 48x32 | 32 | 1.33 |
| husk-g | 64x128 | 128 | 5.33 |
| husk-h | 96x96 | 96 | 4.0 |
| hut-sheet | 32x32 | 31 | 1.29 |
| lean-doors | 48x32 | 32 | 1.33 |
| shack-2f | 48x48 | 48 | 2.0 |
| hut-stove | 32x32 | 32 | 1.33 |
| market-shelter | 48x32 | 30 | 1.25 |
| wash-line | 32x16 | 16 | 0.67 |
| crates-plastic | 32x16 | 16 | 0.67 |

Beodeul:
| id | size px | drawn h | ratio |
|---|---|---|---|
| bd-out-log-door (door (log wall door cell)) | 16x32 | 32 | 1.33 |
| bd-house-h101_2 (house 3x6) | 48x96 | 84 | 3.5 |
| bd-house-h102_1 (house 5x8) | 80x128 | 108 | 4.5 |
| bd-out-cabin-small (log cabin) | 64x64 | 64 | 2.67 |
| bd-prop-crate_apple (crate) | 16x16 | 13 | 0.54 |
| bd-pick-aqueduct-sewer-crate-stack (crate stack) | 16x32 | 22 | 0.92 |
| bd-prop-fish_barrel (barrel) | 16x16 | 14 | 0.58 |
| bd-pick-mining-valley-barrel (barrel) | 16x16 | 14 | 0.58 |
| bd-out-hay-barrels (hay/barrels/crate) | 48x16 | 14 | 0.58 |
| bd-prop-goods_pile (goods pile) | 32x32 | 24 | 1.0 |
| bd-out-fence-run (fence) | 64x16 | 15 | 0.62 |
| bd-farm-fence-run-4 (farm fence) | 64x16 | 16 | 0.67 |
| bd-prop-veg_cart (hand cart) | 32x32 | 25 | 1.04 |
| bd-pick-walled-market-wagon (covered wagon) | 64x48 | 42 | 1.75 |
| bd-tree-eef4bc (tree 1x3) | 16x48 | 47 | 1.96 |
| bd-tree-d43edd (tree 4x5) | 64x80 | 79 | 3.29 |
| bd-pick-mountain-pass-boulder-l (boulder) | 32x32 | 24 | 1.0 |
| bd-prop-well_roofed (roofed well) | 32x32 | 31 | 1.29 |
| bd-farm-fenced-plot (fenced field) | 112x96 | 96 | 4.0 |

Note height alone is not scale: judge the DETAILS that imply scale — door height vs hero (Beodeul door = 32 px, about 1.33x the hero figure, the hero fits through it), window size, storey height, plank/brick size, crate and barrel size vs hero, wheel size, tent opening, how many storeys a building shows for its pixel height. A building 96 px tall that shows 5 storeys of tiny windows reads as miniature even if the height matches.

## What to output
Reply with a verdict file in exactly this form:

VERDICT: PASS or FAIL   (PASS only if no object is noticeably off-scale and the floor reads about as calm as Beodeul)

## Scale findings
One line per wasteland object you judge off-scale (skip ones that look right):
- <id>: TOO SMALL|TOO BIG|DETAILS MINIATURE — what is wrong, measured or estimated (e.g. door 14 px vs hero 24 px, should be ~32 px; windows 6 px, Beodeul windows ~10-12 px; shows 5 storeys in 96 px, a storey should be ~32 px), and what the fix should be (target size in px or cells).
Then one line listing objects you checked and found OK.

## Floor findings
Where the wasteland floor reads noisy or dirty compared with Beodeul ground: name the ground texture (dirt / road asphalt / curb / concrete slabs), the decals (specks, weeds, dry grass tufts, rubble bits, oil, scorch, cracks), and give concrete targets: e.g. "dirt contrast: dark blotches are 3 value steps from the base, Beodeul dirt uses ~1 step; cut to 1 step", "decals: about N per 10x10 cells, Beodeul has about M; target M", "need calm empty areas of at least K cells".

## Top 5 fixes in priority order
