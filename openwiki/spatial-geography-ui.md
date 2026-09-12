# Region and world visual authoring

Task16 owns the geography canvases. It does not replace the compiler
contract in `spatial-geography-compiler.md`, the shared shell/stage, or
catalog publication.

## Public modules

- `src/editor/panels/spatialRegionsTab.ts`
- `src/editor/panels/spatialWorldsTab.ts`
- Geography-only helpers: `spatialGeographyDraft.ts`,
  `spatialGeographyGeometry.ts`, `spatialGeographyCommands.ts`,
  `spatialGeographyCanvas.ts`, `spatialGeographyInspector.ts`,
  `spatialGeographyRaster.ts`, `spatialGeographyTools.ts`
- Styles: `src/styles/database/spatial-geography.css` (Database Studio
  tokens only; cream wash on the board, no new theme)

This worktree wires `renderSpatialRegionsCanvas` /
`renderSpatialWorldsCanvas` and geography chrome into `spatialStage.ts`,
imports `spatial-geography.css` from `src/styles/index.css`, and uses
`openSpatialDestination` for child drill so `setSpatialTab` does not
drop breadcrumbs. `bindSpatialAuthoringControllerFactory` stays the
database.ts binding. Six selectable shipped region examples remain
task18; they are not completed here.

## Settlement regions (2026-09-12)

Villages are regions, not places. `villagePresets` records surface as
`regionKind: "settlement"` cards in the regions gallery; `villageTemplates`
(house shapes) stay in places. The legacy `villages` database route selects the
regions tab with `regionKindFilter: "settlement"` and mounts the old
`renderVillageTab` inside a `.spatial-legacy-host` on the regions stage; the
canonical regions rail clears both. A preset card's inspector exposes
「정주지 지역 만들기」 (`createSettlementRegion`), which writes a real
`RegionDesign` with `settlement { presetId, seed }` into
`library.regions`. The region inspector shows the source preset and an editable
seed. Preview and compile both stamp the actual village — see
[the compiler contract](spatial-geography-compiler.md#settlement-regions-2026-09-12).

Legacy projects without a `spatialAuthoring` document cannot create
geography: `upsertGeography` would silently no-op, so 「추가」 and
「정주지 지역 만들기」 bail early via `spatialDocumentPresent` and
surface an activation-required message. The stage toolbar now exposes a
「공간 설계 활성화」 action on exactly those projects —
`SpatialDomainChrome.activate` / `spatialGeographyChrome` wire it to
`activateSpatialDocument`, which calls `store.activateSpatialAuthoring()`
and guards re-entry through `geographyChromeState.activating`. The store
still enforces remote persistence, a clean working copy and legacy-baseline
conversion; the button only surfaces that path instead of leaving the
message dead-ended. Browser QA for this surface needs a canonical project;
when the dev DB lacks the spatial CAS
migration (`migration-required` on publish), seed a converted project
through the `__RPG_ZZU_E2E_PROJECT__` dev hook — build it with
`convertLegacySpatialSnapshot(serialize(project))`, never by editing raw
JSON by hand.

## Authoring rules

Edits go through the project-scoped detached draft. Preview and apply
are explicit. Undo/redo are controller methods. There are no live store
writes from the canvas and no reconstructed draft handles.

- Source cards patch the reusable library. Placed cards patch the frozen
  occurrence snapshot only.
- Region children and route vertices are integer overview coordinates.
  Child-local ports stay on the child design/map.
- Region routes are authored orthogonal polylines. Endpoints must match
  the positioned children. An invalid move or route is rejected before
  apply; it does not erase obstacles.
- World connections have no path-point field. The canvas draws the
  compiler's horizontal-then-vertical crossing from the two child
  positions. Entry is an explicit selector, not containment.
- Terrain paint clones the project, runs `geographyTerrain` plus
  `paintGeographyRoute` (bridges/stairs/dirt), then `drawMapTileLayers`
  on the real World/private structure atlas. The live project is not
  mutated. Unsupported materials reject.
- Opening a child uses `setDatabaseActiveTab` then `patchSpatialSession`
  with an explicit breadcrumb. `setSpatialTab` is not used for drill-down
  because it clears Back state. `restoreGeographyParent` pops the session
  and restores the database tab. Unit tests prove session/database routing;
  they do not fabricate a places canvas. Parent still needs `spatialStage`
  Back to call `restoreGeographyParent`; `setDatabaseActiveTab` currently
  calls `setSpatialTab`.
- Placed child moves update occurrence x/y only through
  `findOccurrenceChildId` / `parentSlot`. Shared sources do not alias siblings.
- Invalid route/structure paint returns a typed preview error. Failed
  terrain (unsupported material, mountain primitive) has no map. Failed
  routes keep terrain only, never a partial bridge. Unknown errors still
  throw. Chromium proof loads `renderGeographyRaster` through Vite.

## Fixtures

`test/support/spatialGeographyRecipes.ts` remains the task10 contract
set. The six region recipes and two worlds are selectable in unit tests.
They are not the task18 catalog or task19 published samples.

## Proof

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  npm test -- test/spatialGeographyActions.test.ts --maxWorkers=1 --no-file-parallelism
```

Integrated browser acceptance is pending parent stage wiring.
