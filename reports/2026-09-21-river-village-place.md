# Approved river village in Places

Registered shared outdoor place `place_river_forest_village` (강변 숲마을), classified as
EasyRPG → 마을·도시 → 실외. It uses the existing reviewed-place gallery, raster preview,
copy-to-edit and spatial build paths. The approved 78×44 source raster is bundled; no remote
lookup is required to browse the shared card. Event doors are represented by static door
chips in this reusable exterior. NPCs, interiors and transfer events remain in the original
project and are not advertised as part of the outdoor design.

`RIVER_VILLAGE_STYLE` supplies the place identity and generation style. The blank-map
morphology/tileset defaults consume it; AI context and `author_village` describe the same
central river, bank houses, forest assemblies and selective-fence policy. Explicit themes,
project designs, existing maps and selection bounds keep precedence. Requested house
count is not replaced with the example's eight houses.

## Persistence and compilation

- Source read from LegacyDb `river-village-live-20260921-414a` before authoring.
- Converted an independent project copy through `convertLegacySpatialSnapshot`.
- Copied through `copyReviewedPlace`, then executed actual `preview_spatial_build` and
  `apply_spatial_build`; serialized/deserialized through project IO.
- Existing source-map lower tiles and events were compared and preserved.
- Published new canonical project `river-village-place-20260921-414a` through
  `publish_spatial_project`; a direct legacy upsert was rejected by its spatial fence.
- Reloaded full JSON matches serialized authored content. Server SHA:
  `c3d200d0bb6849e4558ced4fb0f3be59f67b0c37c0c4637973da181b85d2ddd0`.
- Copied place ID: `river-village-reference:place_river_forest_village`.
- Compiled occurrence: `river-village-reference-example`.

Evidence: `/home/main/river-village-place/proof.json`, `reloaded.json`, `place.png`;
`/home/main/river-village-place.html` embeds the native-rendered PNG as base64.
Script: `node scripts/qa/river-village-place.mjs`; `--resume` validates already published
content against `authored.json` and continues UI capture without rewriting the remote row.

Syntax transpilation of seven changed TypeScript files and `git diff --check` passed.
No full typecheck, test suites or live LLM conversation were run for this registration.

The browser exposed two existing copy-editor defects for this large outdoor design:
a fixed 40×30 edit canvas clipped the 78×44 exterior, and raw tile swatches omitted
lower-tree backing. Direct-exterior places now inherit actual section dimensions;
the composition preview uses `tileBackingTile` for lower cells, preserving transparent
empty cells and explicit backing overrides. Neither fix changes the authored map raster.

Places gallery verification completed in the actual editor: the shared 「강변 숲마을」 card
is visible under 마을·도시 and its preview loads. Screenshot:
`/home/main/river-village-place/places-ui.png`. The browser uses a local QA session;
remote persistence evidence above is independent of that session's save-status banner.

Copied-place editor verification also passed: width 78, height 44, loaded canvas;
`/home/main/river-village-place/place-edit-ui.png` shows the whole village with grass
under the tree assemblies. The two additional preview files passed syntax transpilation.
