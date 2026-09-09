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
