# Adversarial review round 2: wasteland_ruins object scale and floor (r63)

You are an independent, adversarial pixel-art reviewer (16px tiles, 3/4 top-down RPG, code hand pixels).
The user said wasteland objects were at a different scale from Beodeul (the reference chipset of the same game)
and that the floor was too messy (too much noise, too many decals, texture contrast too high).
Round 1 reviewers found doors 14-17 px against a 24 px hero, storeys of 16-20 px, eaves below the hero's head,
and a floor of high-contrast blotches with 12-40 decals per 10x10 cells. Find what is still wrong. Do not be kind; do not invent.

The hero is Actor1, 24x32 frame drawn 1x; the visible figure is 24 px. Beodeul ruler: doors about 10-12 x 24-26 px,
storeys 30-34 px, windows 8-10 px framed, crate 13 px, barrel 14 px.

## Files (all in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r63/review2)
- scale-wasteland-1x.png / -3x.png: hero beside every wasteland object, same baseline, 16 px grid. scale-table.json has measured heights.
- scale-beodeul-1x.png / -3x.png: hero beside Beodeul reference objects.
- map-settlement4-hero-*.png, map-settlement1-hero-*.png, map-shanty3-hero-*.png: AFTER maps with the hero (1x whole map, 3x crop).
- before-map-settlement4-hero-*.png, before-map-shanty3-hero-*.png: the same maps BEFORE this fix.
- map-beodeul-vineyard3-hero-*.png, map-beodeul-mining7-hero-*.png: Beodeul towns with the hero.

## What changed
Redrawn at Beodeul scale and judged in this round: husk-a, husk-b, husk-tall, shack-b, shack-c, container-home, stall-a, stall-b,
dead-tree, lamp-broken, hut-sheet, wash-line.
Ground: dirt-b/c/d now a calm base with a fine sparse grain; asphalt-ph calmer; the composer places far fewer decals
(weeds, rubble, puddles, road cracks, stains).
NOT redrawn yet (their redraws failed the separate 3/4 style gate, so the old art is kept for now): shack-a, lean-to, tent-tarp,
gate-scrap, car-rust-h, car-rust-v, van-rust, husk-e, husk-g, husk-h, lean-doors, shack-2f, hut-stove, market-shelter.
Do not grade those; just list them if they still look off-scale.

## Output (exact form)
VERDICT: PASS or FAIL   (PASS = every redrawn piece reads at Beodeul scale next to the hero AND the after floor reads about as calm as Beodeul)

## Redrawn pieces
One line each for the 12 redrawn pieces: - <id>: PASS|FAIL — measured door / storey / eave / window px and why.

## Floor
FLOOR: PASS or FAIL — compare after vs before vs Beodeul: grain contrast, decal count per 10x10 cells (count it), calm empty areas.

## Still off-scale (old art kept)
One line listing which of the 14 kept pieces still read off-scale.
