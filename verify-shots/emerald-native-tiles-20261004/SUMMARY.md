# Seven native Emerald tile variants — 2026-10-04

Source slice only; no canonical project write, DB access, server, gates, Vitest or full typecheck.

## Actual evidence

- Current canonical reference source: `/tmp/oprn-emerald-20261004/canonical-before/decoded.json`. Exported all seven with `scripts/content/export-tileset-references.mjs`. 75 complete MD pages and 92 actual images; exact arrays read by parser and every exported image visually inspected as native composites. Receipt `/tmp/oprn-emerald-20261004/emerald-tiles-reference-read.json` includes per-file hashes.
- Native `prepare-emerald-monster.py` exit 0: all seven 256px-wide sheets, 14528 cells checked for exact dimensions, no original occupied tile becomes empty, no opaque backing is lost. All 12507 native names/aliases retain original enumeration; 4464 current dictionary names explicitly match current canonical references. `preservation-manifest.json` records counts and hashes.
- Focused `npx tsx scripts/qa/emerald-tile-preservation.mts` exit 0: actual PNG bounds, frame/geometry registration, 12 unchanged structural fields, seven variants in both new/existing projects, independent deep copies, shipped reference paths, author category preservation, deliberate `[]` preservation and idempotent supplementation. Result `registration-proof.json`.
- Native atlas full images and **all 54 normal full-map native samples** visually inspected; contact sheets `/tmp/oprn-emerald-20261004/native-samples-{overworld,wild,coast,climate,rooms,dungeon,gyms}.png`. Samples render exact current full lower/upper arrays. Before/after pairs ship beside samples. No original pret pixels are committed.

## Open these first

All links are actual newly generated atlas outputs; left = original OPRN native atlas, right = new variant.

- [Town](../../public/assets/emerald-monster/references/overworld/map-before-after.png), [route](../../public/assets/emerald-monster/references/overworld/route-before-after.png), [forest](../../public/assets/emerald-monster/references/wild/forest_maze-before-after.png).
- [Coast](../../public/assets/emerald-monster/references/coast/port-before-after.png), [lab](../../public/assets/emerald-monster/references/rooms/lab-before-after.png), [pool gym](../../public/assets/emerald-monster/references/gyms/gym_water-before-after.png).
- [Desert](../../public/assets/emerald-monster/references/climate/desert-before-after.png), [snow](../../public/assets/emerald-monster/references/climate/snow_town-before-after.png), [ash](../../public/assets/emerald-monster/references/climate/ash_town-before-after.png), [sea cave](../../public/assets/emerald-monster/references/dungeon/sea_cave-before-after.png).

## Findings and limits

Mint meadow/darker forest floor and broad canopy clusters now agree across town/route/coast/wild. Short water ripples replace the old net in ponds, rivers, sea, bow/deck, oasis, cave pools and gyms. Native pool walls remain deep below cream walkways; warm sand, snow/ice, gray ash, red lava, blue-gray labs and league themes remain distinct. House roof planes/courses and timber shades are refined within unchanged footprints. Ship frames that become visually constant retain reserved slots; anonymous native cells remain present.

This is Emerald inspired original art, not an assertion of pixel equivalence or Gen3 mechanics. Existing FRLG/RSE mixed structures and original gym designs remain. Existing gray/league furniture, snow/volcanic materials and some landmark roofs are reused native drawings. 38 inherited **error** reference images remain original-color diagnostics with explicit captions. They prove the inherited collision examples, not newly executed gameplay. Canonical map retarget, save/reload and native runtime QA belong to root integration.
