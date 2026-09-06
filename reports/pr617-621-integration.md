# Locked PR617 + PR621 integration

Base: `1d89d74d3f84bda42863bd1a88809740cc9267dd`.
PR617 snapshot: `11f608cf7deb66c2cf0d5c6d3d9b9a9aec8d980f`.
PR621 snapshot: `caea9297dbb340abb3495bf908caa898a6c3fd6e`.
Assigned tree: `/home/main/z-project/rpg-zzu-all-pr-map-617-621`.

The user explicitly authorized both snapshots regardless of Draft/approval/hold
status. This integrates present code, not promised future features. No push,
PR comments, remote content scripts, shared-root inspection, or dirty-root replay
was performed. Existing dependency symlink was used; no dependency installation.

## Verified increments and semantic conflicts

1. `60e93de1c6cea578ae9c3ee89dc24e80446cbd75`: PR617 merge.
   - `database.ts`: combine once-per-navigation tileset facets with the existing
     equipment-to-items alias, filter and selected-record behavior. Keep 32 primary
     tabs, current monster/world labels, and existing System/assistant integration.
   - `databaseSidebarNav.test.ts`: exact 32-primary-tab contract after removing the
     obsolete equipment row and making legacy Map destinations contextual.
   - `databaseStudioV2.test.ts`: retain current group-label import alongside the
     incoming nested Map breadcrumb assertions.
   - `openwiki/INDEX.md`: regenerate from merged wiki, not either stale side.
   - Audited sidebar CSS deletions auto-merged with contextual Map CSS; the latest
     canvas sidebar workflow code and CSS are unchanged.
2. PR621 merge (the commit containing this report).
   - `chipsetTileRender.ts`, `playSceneMapRuntime.ts`: preserve the common
     `supportsChipsetTileAnimation` call, adding graft-aware World strips inside
     that helper in `tilesetImage.ts`. Preserve actual interior strip-base-124
     predicate, static cold hearth and narrow default-town predicate.
   - `themePacks.ts`: compose World descriptions/terrain/coast seeding with approved
     chipset corrections and their existing user/locked/graft guards. Corrections
     remain last in metadata precedence.
   - `openwiki/INDEX.md`: regenerate again with World documentation and integration
     notes. World structure tool/coast/terrain/description source modules and canvas
     image loader remain identical to the requested PR621 snapshot.

## Failing evidence and bounded corrections

- Initial PR617 focused run: 3 files failed, 7 tests failed, 163 passed.
  `databaseConceptFirstNav`: missing old `stairs` ID and absent separate equipment
  destination. `databaseTabIcons`: expected 33, received 32 (two assertions).
  `scratchConceptTab`: missing old `bed_h`/`stairs` IDs (three tests).
  Corrections retain the new inn model and unified inventory, adapt exact IDs/counts
  and test routing through the single inventory destination. Added equipment as a
  search alias on items. No tests removed, skipped, or converted to loose assertions.
  The new E2E snapshot uses corresponding current inn IDs; E2E was not executed.
- Initial World focused run: 1 failed, 172 passed. World description seeding expected
  old generic prose for 314-317/344-347, but approved chipset corrections won.
  Preserve the approved corrections and make the expected 480-entry array compose
  both shipped sources. Runtime-flag/other-metadata equality and idempotency checks
  remain intact. `chipsetLabelCorrections.test.ts` also passes.

## Exact executed checks

All test commands use `--maxWorkers=2`; no full test suite or gates.

```sh
npm run typecheck:app
npm test -- test/databaseConceptFirstNav.test.ts test/databaseBattleStudio.test.ts test/databaseGroupPeek.test.ts test/databaseNavMode.test.ts test/databaseSidebarKeyboard.test.ts test/databaseSidebarNav.test.ts test/databaseStudioV2.test.ts test/databaseTabIcons.test.ts test/databaseTilesetFolder.test.ts test/scratchConceptTab.test.ts test/tilesetTabActivation.test.ts test/databaseInventoryCatalog.test.ts test/databaseCrossTabNav.test.ts --maxWorkers=2
npm test -- test/worldStructureTools.test.ts test/worldCoastMapping.test.ts test/worldTerrainAutotiles.test.ts test/worldTileDescriptions.test.ts test/mapCanvasTexture.test.ts test/characterDepthYSort.test.ts test/interiorFireRendering.test.ts test/terrainQuarterAutotile.test.ts test/dungeonTerrainQuarter.test.ts test/editSceneRender.test.ts test/placeConceptRender.test.ts test/placeConceptTool.test.ts test/toolSchemaProviderCompat.test.ts test/sidebarModeWorkflow.test.ts test/chipsetLabelCorrections.test.ts test/databaseSystemStudio.test.ts test/databaseMonsterSpeciesView.test.ts --maxWorkers=2
npm run openwiki:index
```

Final combined-tree results: app typecheck exit 0; navigation 13 files / 170 tests
passed; World/render/protection/System/monster/sidebar 17 files / 195 tests passed.
Each corrected selection passed in a single invocation, without retry options.
The navigation selection was also rerun after the World merge (170 passed).

Explicit per-file TypeScript LSP checks on every changed TS/test/script file
reported no diagnostics. A preliminary broad test-directory diagnostic scan was
capped at 50 and reported 26 unrelated baseline diagnostics in unchanged files;
it is not evidence of a clean whole-repository typecheck. CSS diagnostics were
unavailable because Biome is not installed; no install or suppression was made.

## Limits

No full build, browser/E2E execution, full gates, remote save/reload, rollout or
new-feature completion. App typecheck is the local buildability check, not proof
that app/player/standalone bundles were built. Existing PR documentation/evidence
about remote World authoring is inherited provenance, not child-session validation.
Supervisor owns all final rollout checks. No test was weakened for timing; the
incoming graphic-editor test observes the actual editor-open boundary and retains
real save/undo/close behavior with a bounded failure deadline.

## Parent dirty-replay caution

Actual dirty-root paths were deliberately not inspected. Treat the entire PR621
32-file footprint as a potential overlap (`git diff --name-only caea9297^ caea9297`).
Do not blanket-restore dirty copies over this merge. In particular:

- `src/editor/tilesetImage.ts`, `src/editor/chipsetTileRender.ts`,
  `src/player/playSceneMapRuntime.ts`: keep the common animation predicate, interior
  fire support, World graft guards and tileset-aware quarter calls together.
- `src/project/tilesetHarness/themePacks.ts`: retain approved label-correction
  precedence and user/locked/graft guards alongside World metadata seeding.
- `src/editor/mapTileDraw.ts`, `src/editor/mapScreenshot.ts`,
  `src/editor/panels/eventEditor/transferMapPreview.ts`,
  `src/editor/panels/mapThumbnail.ts`, `src/editor/panels/projectPickerCover.ts`,
  `src/editor/panels/tilesetAiTempMapImage.ts`,
  `src/editor/panels/villageHousePreview.ts`, `src/player/minimap.ts`: shared
  image/canvas union, color-key cache and quarter-composition wiring must stay aligned.
- `src/project/defaults/{lakeAutotile,terrainQuarterAutotile,worldCoastMapping,
  worldTerrainAutotiles,worldTileDescriptions,worldStructureRules}.ts`,
  `src/editor/tools/{worldStructureTools,toolRegistry}.ts`,
  `src/player/characterDepth.ts`: compare overlapping dirty work semantically;
  retain provenance, opt-out and source/locked/graft protections.
- `test/{worldCoastMapping,worldTerrainAutotiles,worldTileDescriptions,
  worldStructureTools,mapCanvasTexture,characterDepthYSort}.test.ts`: retain all
  integration assertions, especially approved description precedence.
- `src/editor/panels/{database,databaseModal,scratchConceptTab,
  tilesetMetadataEditor,tilesetUsageGuide}.ts`, navigation/concept tests, and
  `src/styles/database/{sidebar,scratch-concept}.css`: if parent edits overlap,
  keep unified inventory, concept-first routes, new inn IDs and CSS628 deletions.
- `openwiki/{INDEX,editor-database,autotiles,world-structure-authoring}.md` and
  `scripts/{qa-world-structure-tools.mjs,verify-world-structure-tools.mts}`:
  preserve documentation/script provenance, and regenerate INDEX after replay.
  Do not execute the remote-writing verification script as part of replay.
