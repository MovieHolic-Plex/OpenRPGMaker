# PR618 isolated integration handoff

Worktree: `/home/main/z-project/rpg-zzu-integration-pr618-0906`.
PR618 merge: `5ffc905283467f48fa83a08567777ba754019962`, parents `9d5134e5a54766bf27a6c8f394058e967ef71892` and `8c470a41f4955cd6bbb317985c3a3b216f934e15`.
The handoff merge additionally includes shared-main PR615 commit `0eb0a06c754d46019631baeb84cf9469e83cbf66`. PR616 is supervisor-owned and excluded.
No shared-root files/index/branch/server were changed. No pushes, PR comments, Supabase reads/writes, or authoring-save scripts were performed by this integration.

## Resolutions

- Combined independently appended database/runtime/schema/testing documentation; regenerated INDEX rather than selecting either generated version. Preserved custom-slot, world-document, animation/elements and chipset-correction ancestry.
- `interiorConceptCompose.ts`: retained PR611 rug/seating/warehouse grouping and interactive loot access alongside PR618 whole-assembly reachability checks. Observed failures before correcting opaque tables overwriting rugs and occupying the actual entrance spawn. Opaque floor assemblies now precede rugs; rugs select upper-only seating; crowded multi-table halls prefer side placement for wide tables.
- `interiorRoomPipeline.ts`: retained legacy per-map placement journals and whole-set rollback together with concept assembly protection and room-limited repair. Corrected the old two-tile table validator to accept repeated 326 bodies and validate 327 end caps.
- `interiorRoomSession.ts`: retained existing manor/planning/visual-QA cautions with the new concept-only route description.
- `conceptFacilityTemplates.ts`: kept PR611 additional tavern seating/rug and PR618 dining assembly. Other PR611 additions survived automatic merging.
- `conceptFacilityVariants.ts`: new built-in facilities also receive buildable reference plans, without replacing live authored bundles.
- Tests retain assertions: legacy UI editing contracts explicitly seed the legacy inn fixture. Warehouse tests now use real passability/reachability for entrance tile 176, rather than falsely treating every nonempty upper tile as blocked. Added passable-spawn assertions across all 18 non-inn facilities.
- PR615 merge: source changes apply without conflict and equal parent PR615 source; only generated INDEX conflicted.

## Passed validation

All commands run in this worktree. Raw logs remain under `output/evidence/integration-pr618/`.

- `npm run typecheck:app`: exit 0, including final PR615 integration (`final-typecheck.log`).
- TypeScript transpilation diagnostics on all 80 changed TS/MTS/MJS source/test/script files: zero syntax errors. LSP unavailable (Biome missing; test LSP daemon timed out), so no LSP-clean claim.
- `npm run openwiki:index -- --check`: exit 0, current.
- PR618 + PR611/shared chipset regressions: **438 passed across 25 files**, in these three bounded batches, each exit 0:

```sh
npm test -- test/villageBuilder.test.ts --maxWorkers=2 --reporter=dot
npm test -- test/conceptFacilityTemplates.test.ts test/interiorConceptAssemblies.test.ts test/placeConceptTool.test.ts test/scratchConceptTab.test.ts test/conceptFacilityComposition.test.ts --maxWorkers=2 --reporter=dot
npm test -- test/conceptFacilityLevels.test.ts test/conceptFacilityScore.test.ts test/generateMap.test.ts test/houseKit.test.ts test/innArchitecture.test.ts test/innConceptRebuild.test.ts test/innExploration.test.ts test/interiorConceptRoutes.test.ts test/interiorFireRendering.test.ts test/interiorObjectCatalog.test.ts test/interiorTileCorrections.test.ts test/stoneHearth.test.ts test/tilemapHarnessOverhaul.test.ts test/conceptDoubleRowLayout.test.ts test/conceptOutdoorGates.test.ts test/interiorRoomPipelineParity.test.ts test/interiorRoomWalkabilitySeal.test.ts test/placeConceptRender.test.ts test/chipsetLabelCorrections.test.ts --maxWorkers=2 --reporter=dot
```

Batch counts: 33/1 file, 250/5 files, 155/19 files (`batch-1.log` through `batch-3.log`). This includes all 18 PR618 test files and eight chipset-label assertions. These batches validated PR618 merge source before the disjoint PR615 merge.

After merging PR615:

```sh
npm test -- test/databaseEnemyDialogFocus.test.ts test/databaseModernControls.test.ts test/databaseNumericLabelTrust.test.ts test/modalStack.test.ts --maxWorkers=2 --reporter=dot
npm test -- test/scratchConceptTab.test.ts test/customEquipmentSlots.test.ts test/worldDocumentWorkspace.test.ts test/databaseAnimationFrameSelect.test.ts test/databaseElementsUx.test.ts --maxWorkers=2 --reporter=dot
```

Both exit 0: **50/4 files** (`pr615-tests.log`) and **72/5 files** (`prior-integration-tests.log`). The latter rechecks the merged concept UI and PR605/607/609/612 contracts.

## Failed attempts, not hidden

- First combined suite: 420 passed, 18 failed, one Vitest unhandled RPC error; exit 1 (`focused.log`). Failures identified legacy UI fixture assumptions, 176 passability assumptions, new-facility variants, table/rug composition, and repeated-counter validation.
- Intermediate correction runs: 16 failures/161 passes; 4 failures/143 passes; 7 failures/129 passes. These exposed large-table placement pressure while retaining all furniture. Logs: `corrections.log`, `composition-corrections.log`, `assembly-fit.log`. Final focused composition run: 136 passed, exit 0 (`seating-fit.log`).
- One correction typecheck failed TS2345 from a literal-union `includes` call; fixed with direct comparisons, final typecheck exit 0.
- After product corrections, the monolithic 25-file run had **438 passed**, but **exit 1** from `[vitest-worker]: Timeout calling "onTaskUpdate"` (`pr618-final-tests.log`). It is not green. The installed RPC transport has a 60s response timeout; root cause was not proven. The three focused batches above then each passed without RPC errors, without changing test assertions/timeouts/skips.
- No full gates, full production build, or browser-player execution was run; supervisor explicitly owns them.

## Safe real-player QA inputs

Executed successfully, no remote access:

```sh
node_modules/.bin/vite-node scripts/qa-pr618-fixtures.mts
node_modules/.bin/vite-node scripts/qa-facility-quality.mts pr618-integration
```

First creates `output/evidence/pr618-fixtures/{inn,hearth-unlit,hearth-lit}.json` and `manifest.json`. Inn fixture is serialized/reloaded and passes 1F -> 2F -> 3F -> 2F -> 1F walkthrough. Manifest records exact events/positions for real keyboard traversal. Hearth fixtures distinguish static 463 from fire anchor 124.
Second creates all **19** facility JSON/PNG fixtures, **zero placement warnings**, under `output/evidence/facility-quality/pr618-integration/` (including multi-floor `inn.json`).

Supervisor's existing built-player command (not executed here):

```sh
npm run build:player
FACILITY_QA_FIREFOX=1 node scripts/qa-facility-player.mjs pr618-integration
```

That player script intentionally excludes inn; it will cover 18 other facilities. For inn/hearth use the three local fixture JSONs with the built `player.html`/export store shim, direct Firefox and QA instrumentation. Best player entry: `qa_inn`, at manifest start; keyboard-walk/interact through all four stair transfers, then verify lodging. Observe actual fire frames 124/154/184/214 while cold hearth remains 463. No editor shell, save flags, or Supabase loader is necessary.

## Shared dirty-patch replay concerns

Parent owns replay; shared dirty contents were not read or modified here. Based on the reported overlap:

- Keep `supportsChipsetTileAnimation` imports and calls in editor `createRawTileObject` and player `renderTile`. Interior fire uses this narrow predicate; do not broaden `isDefaultTilesetTexture` to enable world/interior animation, because that also enables town-specific road/tree behavior.
- Preserve independently authored world transparency/quarter-composition predicates and rendering branches when replaying `tilesetImage.ts`, `chipsetTileRender.ts`, and `playSceneMapRuntime.ts`.
- `themePacks.ts` must retain cab4b950 correction overlays and origin-user/locked/graft protection, plus new hearth/stair/table groups and excluded 408/409/410 IDs, alongside the parent's world metadata changes.
- Regenerate INDEX after all documentation/PR616 changes; do not replay the old generated index wholesale.
- Known PR618 limitation remains: connected reception furniture reroll may reject with `transfer-impassable`, preserving the original project. This integration does not claim to fix it.

Exact integration file list: `git diff --name-only 0eb0a06c <handoff-commit>`. The entire PR ancestry (including authored receipts) is retained; integration-only corrections are detailed above. Build/start/push, shared dirty-patch replay, and real-player visual approval remain supervisor-owned.
