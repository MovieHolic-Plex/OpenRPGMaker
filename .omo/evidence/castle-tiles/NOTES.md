# Castle tiles — editor integration, 2026-09-19

Scope: add a bundled choice for new and existing projects. Keep the startup
tileset unchanged. The castle reference board and its spatial catalog were
also published to the canonical LegacyDb project.

Manual browser capture:

```sh
VITE_CACHE_DIR=/tmp/rpg-zzu-castle/vite-cache npm run dev:worktree -- --port 9987
node scripts/capture-castle-tiles.mjs http://127.0.0.1:9987 .omo/evidence/castle-tiles
```

The capture uses an isolated `blankProject` solely to inspect the editor UI.
`catalog.png`: 자료집 → 맵 → 타일 → 성채. `palette.png`: map tileset selection
and a 2×2 source drag. `inspection.json`: observed data and actual Phaser frames.

- 512×512 original PNG preserved byte-for-byte; SHA-256 matches ATTRIBUTION.md.
- Catalog and resource profile: 16px / 32 columns / 1024 cells.
- Removing the choice from a project then applying the existing normalization
  adds it back without changing maps; repeated normalization preserves edits.
- Map settings exposes 성채 · OpenGameArt (CC-BY 3.0).
- Dragging cells 2→35 selects [2, 3, 34, 35], a 2×2 upper-layer stamp.
- Actual frames: 31=(496,0), 32=(0,16), 770=(32,384), 1023=(496,496), all 16px.
- Color-key + graft texture retains 32-column geometry. Grafting cell 770 into
  1023 produces the source pixel at the expected destination.
- Export collector includes both the PNG and the credit notice.
- Reference board: `map_castle_reference_95_20260919` is 140×140 with lower
  tiles 0..19599, so rebuilding its 16px cells is pixel-identical to the
  supplied 2239×2235 image after the documented edge padding. Remote project
  reload confirmed the board tileset plus 12 objects, 3 spaces, 5 places, 1
  region, and 1 world under the `castle-reference:` ids. The added catalog
  covers the image's market stalls, crop plots, landmark trees, statue,
  wooden dock, and river boat as well as the castle structures.
- 16-section comparison: `map_castle_reference_20260919` is the map opened for
  comparison. It has a 4×4 `comparisonGrid`; the saved project was reloaded
  and rendered with `scripts/compare-castle-reference.py`. All 16 regions are
  similarity `1.000000`, MAE `0`, and exact-pixel ratio `1.000000`.
- Remote save proof: project `rpg-zzu-house-template-gallery`, published SHA
  `e1c5ce19f962e420331054dd3eeef6fc3fa6910c8183fae566e61c275454fbbc`; the
  post-save reload and mirror sync both succeeded.
- `reference-board-browser.png` opens the saved board in the editor and shows
  the castle facade, courtyard, crops, and river tiles from the supplied image;
  the e2e browser run reported no page errors.
- `comparison-map-browser.png` opens `map_castle_reference_20260919`, the
  image-faithful 16-section comparison map.
- `actual-map-browser.png` is retained as the earlier capture of the original
  OpenGameArt castle-atlas composition. That editable composition is now
  preserved under `map_castle_editable_20260919`; its measured similarity is
  0.845246, so it is explicitly not presented as the 95% comparison result.
- Browser page errors: 0 in the completed capture. `git diff --check`: clean.
- Current map preservation: the comparison map remains copied as
  `map_castle_reference_saved_20260919`; it was not overwritten while the new
  castle was iterated.
- Second castle: `map_castle_keep_3` is `성채 · 쌍문 안뜰성`, a distinct 128×120
  `opengameart_castle` map built from the original atlas. The castle is dressed
  with four readable exterior zones: a north gate approach, west market lane,
  east moat bank/bridge landing, and south rest plaza. Complete measured props
  (market stalls, crates, clock trees, lamps, statues, benches and fountain)
  make those zones legible instead of leaving a blank grass ring.
- Latest LegacyDb save proof: project `rpg-zzu-house-template-gallery`, SHA
  `c5bda3ca390e0ea2905b5e2e7c98fb161c24d508128c677b1e455f5ce5c215d0`;
  `saved: true`, `reloaded: true`, and 60 protected maps were unchanged.
  `courtyard-castle-browser.png` is the 1× editor capture (page errors: 0);
  `courtyard-castle-full.png` is the independent original-atlas render.

Vitest, gates and typecheck were not run, per AGENTS.md session rules.
The unit regressions are supplied for an authorized gate run. This evidence
covers the editor and shared texture registration; it is not a player QA run.

## Harbor and varied surroundings — 2026-09-20

The user's boat request uses the actual Daniel Eddeland LPC boat/dock art
credited on the Castle Tiles example page. It is not in Castle2 itself.
`castle_courtyard_harbor` is a project-owned 512×944 uploaded atlas: unchanged
Castle2 first 1024 cells, plus measured boat, dock, produce, crop, tree, rock,
grass and vine components from the credited original source packs. The map
has two opposed boats beside the east cargo dock, a smaller fishing landing,
produce/sacks/firewood in the west market, two crop beds, bank vegetation,
four large trees, rock clusters and wall vines. 17 complete-object stamps are
available on the map's extended tileset.

- Project: `rpg-zzu-house-template-gallery`; map: `map_castle_keep_3`.
- Saved project SHA:
  `ec5e779a13d22f1c90290969128bbbfd76c41d95cde22ef7968da7e6cf61916c`.
- Save + reload: exact map, tileset and embedded atlas asset equality.
- 61 other maps preserved, including the saved original comparison map.
- `harbor-castle-browser.png`: actual editor at 1×, painted map visually
  inspected; page errors 0 and console errors 0. The initial 5-second capture
  was blank while loading and was rejected; the completed 15-second capture
  is the evidence. A zero error count alone is not visual success.
- `harbor-castle-full.png`: reloaded project independently rendered, including
  upper tile stacks; no invalid source cells or unbacked transparency.
- `harbor-detail.png`: detail crop of that render showing the two boats/docks.
- Source PNG hashes/rectangles: `public/assets/castle-surroundings/manifest.json`.
  Full credit/license: the neighbouring `CREDITS.txt`, also included in exports.

## NPCs and playable-life pass — 2026-09-20

The same canonical map now has 9 fixed, action-triggered events: 7 named people
(항구 관리인, 북쪽 선원, 장터 상인, 장터 손님, 정원 관리인, 남문 경비병,
여행객) plus 부두 고양이 and 정원개. They are spread across the east harbor,
west market, clock-tree garden and south gate, with short Korean interaction
lines. The saved comparison map was not changed.

- Latest LegacyDb project: `rpg-zzu-house-template-gallery`.
- Latest published/reloaded SHA:
  `ce5dd9518ac2cf6cd2a0330dd0c8845efbc66970e9294e76e95333d5c713ff7e`.
- Save proof: `saved: true`, `reloaded: true`, `protectedMapsUnchanged: 61`.
- Runtime screenshots use the dedicated `player.html` QA harness with the
  LegacyDb-reloaded project. `harbor-npc-runtime.png`, `garden-npc-runtime.png`,
  and `south-guard-runtime.png` show actual character sprites over the tiles;
  `market-runtime.png` shows the market stalls and crop bed in the same pass.
- Runtime page and console errors were both 0 for these captures. The player
  spawn is moved near each life zone only for the screenshot; the saved project
  start map and authored NPC coordinates remain unchanged.

The chipset profile no longer carries a face-only `graphicNote`; credits remain
in `public/assets/castle-surroundings/CREDITS.txt`, `public/assets/ATTRIBUTION.md`,
and the exported asset collector. Vitest, gates and typecheck were not run,
per AGENTS.md session rules.
- `harbor-boats-runtime.png` is the wider east-bank player capture: a rowboat,
  dock, sacks, bank grass and the harbor NPC share the same runtime frame.

## Bridge removal — 2026-09-21

Local reference atlas: bridge region replaced with water; 165253 changed pixels,
zero changed pixels outside `(1632,1712)-(2112,2160)`. Old reference screenshots
above are historical and still show the bridge; do not ship them as game assets.
Three reference-map remaps are prepared. Remote save remains incomplete:
`publish_spatial_project` returned 57014 statement timeout repeatedly.
No matching castle maps were found in the inspected SQLite host projects.
