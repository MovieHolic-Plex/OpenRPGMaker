# OPRN-OUT-022 — Combo Brush: acceptance evidence

Branch `agent/oprn022`, worktree `/home/main/z-project/rpg-zzu-oprn022`, dev port 9855.
All browser evidence uses `?freshProject=1` with remote persistence disabled — no LegacyDb
project row was written (pure editor/engine change, the narrow exception in `AGENTS.md`).

## Gate commands (exact output)

```
$ npm run typecheck:app
> tsc --noEmit -p tsconfig.app.json
                                        # exit 0, no diagnostics
```

```
$ npx vitest run test/comboBrushCatalog.test.ts test/comboBrushPlacement.test.ts \
    test/comboBrushPaletteUi.test.ts --maxWorkers=2
 ✓ test/comboBrushPaletteUi.test.ts  (11 tests)
 ✓ test/comboBrushCatalog.test.ts    (8 tests)
 ✓ test/comboBrushPlacement.test.ts  (16 tests)
 Test Files  3 passed (3)
      Tests  35 passed (35)
```

Adjacent suites re-run for regression (no new failures):

```
$ npx vitest run test/tileBrushState.test.ts test/structureKitBrushConditions.test.ts \
    test/tilePaletteStamp.test.ts test/tilePaletteGrid.test.ts test/sidebarBrushUi.test.ts \
    test/sheetRangeSelect.test.ts test/editScenePaintHistory.test.ts \
    test/tilePaletteSelection.test.ts test/tilePaletteGridRoving.test.ts --maxWorkers=2
 Test Files  9 passed (9)
      Tests  102 passed (102)

$ npx vitest run test/tileToolbar.test.ts test/tileToolbarMapModeParity.test.ts \
    test/sidebarFocusModes.test.ts test/sidebarModeWorkflow.test.ts \
    test/structurePlacements.test.ts test/roundLakeStamp.test.ts test/inspectorBadges.test.ts ...
 Test Files  10 passed (10)
      Tests  93 passed (93)
     Errors  4 errors      # pre-existing: tileToolbarMenus timer fires after fakeDom teardown.
                           # Verified identical on the stashed baseline (4 errors, 4 tests pass).
```

One regression was found **and fixed** during this work: installing the drag gesture on the
default palette broke `test/tilePaletteGridRoving.test.ts` (`window is not defined` in the
lightweight fakeDom host). Fixed at the environment boundary in
`tilePaletteCustomGesture.ts` (`hostWindow` guard), not by weakening the test.
Baseline of that file before the fix: PASS; after the fix: PASS.

## Browser evidence

```
$ DEV_SERVER_PORT=9855 VITE_CACHE_DIR=/tmp/oprn022-vite npm run dev:worktree
  ➜  Local:   http://127.0.0.1:9855/
$ node scripts/qa/combo-brush.mjs
QA 01-selection: PASS
QA 02-hover-footprint: PASS
QA 03-repeat: PASS
QA 04-boundary: PASS
QA 05-terrain-list: PASS
QA 06-curated-place: PASS
6/6 scenarios PASS · page errors: 0
```

Machine-readable observations: `verify-shots/oprn-022/results.json`.
Note the QA fixture resizes the map to 20×20 so the right map edge is genuinely on screen;
the default 100×100 map (1600px) puts its edge outside the viewport, which silently turned an
"edge click" into an ordinary interior click on the first run.

## Per acceptance criterion

### 1. Users can create an active Combo Brush from a supported contiguous palette selection and repeat it at multiple map positions — **MET**

The gesture was custom-atlas-only; the default reflowed palette now installs it too
(`tilePaletteGrid.makeGridPalette` + `displayOrderStampFactory`).

- `verify-shots/oprn-022/01-selection.png` — a 2×2 drag on the DEFAULT palette; sidebar reads
  `조합 붓 2×2 · 4칸 · 바닥`, cells `[0, 93, 6, 9]` = exactly the four visible cells dragged.
- `verify-shots/oprn-022/03-repeat.png` — the same brush placed at three origins
  `[[10,14],[14,14],[10,18]]`; `stillActive: true` after all three.
- Tests: `comboBrushPaletteUi.test.ts` "turns a rectangular drag into an active multi-cell combo
  brush", `comboBrushPlacement.test.ts` "stays active across multiple placements".

### 2. 2×N, 3×3 and 4×4 patterns preserve their source-relative cell layout and layer routing — **MET**

- `comboBrushPlacement.test.ts` → "keeps a 2xN / 3x3 / 4x4 source layout cell for cell" (the 2×N case
  uses the real 2×5 curated tower, mixed upper/lower).
- Layer routing: "sends upper cells to the upper layer and lower cells to the lower layer" and
  "routes cells by their declared layer regardless of the active editing layer".
- `verify-shots/oprn-022/06-curated-place.png` — 나무 한 그루 places `[260, 290]` = canopy on upper,
  trunk on lower, at one click.

### 3. Hover preview displays the exact active footprint and visibly handles map boundaries before commit — **MET**

`editSceneHoverPreview` no longer does its own boundary arithmetic; it calls
`comboBrushPlacement`, the same function the paint path uses, and draws out-of-bounds cells
as red markers instead of skipping them.

- `verify-shots/oprn-022/04-boundary-hover.png` — at map column 19 of a 20-wide map the left
  column previews normally (green) and the right column is marked red **before** the click.
- Scenario `04-boundary` observed `clippedCount: 2`, `painted: 2`.
- Test: "previews exactly the cells that will be written, and marks the clipped ones" asserts the
  preview marker count equals `comboBrushPlacement(...).cells.length` (footprint, not just the
  paintable subset).

### 4. The UI clearly distinguishes composite Combo Brush selection from ordinary 1×1, 3×3, 4×4 repeated-tile brush size — **MET**

`comboBrushBadge` is the single source of that wording. The sidebar state chip exposes
`data-brush-kind` = `combo` | `stamp` | `repeat`, and composite gets an accent-outlined chip
(`.sidebar-brush-state.is-combo-brush`) plus a `조합 붓 해제` action instead of `도장 해제`.

- `verify-shots/oprn-022/01-selection.png` — outlined `조합 붓 2×2 · 4칸 · 바닥` chip.
- Tests: "labels a composite brush with the combo badge", "keeps repeated-tile brush size as its own
  concept when no combo brush is active", "hides the repeated-size select while a composite combo
  brush is active", "does not call a single-cell stamp a combo brush".

### 5. The terrain-tool surface can list named, validated functional combinations without requiring raw tile-number entry — **MET**

New 「조합」 sidebar surface (`panels/comboBrushShelf.ts`) renders the curated catalog as real
rendered thumbnails grouped 자연 / 건물 / 시설.

- `verify-shots/oprn-022/05-terrain-list.png` — 12 named combinations; scenario asserts
  `shelf.locator("input").count() === 0`, i.e. no tile-number entry field exists.
- Names observed: 나무 한 그루, 넓은 나무 (2×2), 광장 석상, 원형 타워 (2×5), 성 지붕 여장 (3×4),
  목조 벽면 (3×3), 흰 벽 건물면 (3×3), 집 출입구 받침, 가로 탁자 한 벌 (3×3),
  세로 탁자 한 벌 (3×3), 집 앞 마당 소품 (4×1), 울타리 한 구간 (3×1).
- Tests: "renders every curated combination by name, with no raw tile-number entry",
  "activates a curated combination as a reusable combo brush and toggles it off",
  "offers no combinations on a non-default chipset".

### 6. Invalid or blocked placement returns an actionable diagnostic and does not partially corrupt the pattern — **MET**

`evaluateComboBrushPlacement` gives exactly two outcomes: fully outside → refuse and diagnose
(zero cells written, so nothing half-lands); partially clipped → allow with a warning, and the
in-bounds cells still land in their exact source arrangement.

- Scenario `04-boundary` observed diagnostic
  `조합 붓 2×2이 맵(20×20) 밖입니다 — 맵 안쪽을 눌러 주세요.`
- Test "writes nothing and returns the model diagnostic when the footprint is fully outside"
  compares both tile arrays to a pre-click clone, asserts `canUndo === false`, and asserts the
  text shown to the user **is the model's own diagnostic string** (so the wording cannot acquire a
  second source).
- Test "paints only the in-bounds cells and leaves their layout intact" walks
  `verdict.placement.paintableCells` and checks each one landed.

### 7. One Combo Brush placement is one Undo/Redo unit — **MET**

One `paintTilesBulk` call per placement under the existing `recordMapEditIfChanged` stroke rule.

- Test "treats one combo placement as one undo unit and restores every cell" — one undo restores
  the whole 9-cell pattern, one redo reapplies it.
- Test "undoes two separate placements one at a time".

### 8. Existing custom-atlas stamps, structure-kit stamps, autotile behavior and manual single-tile painting remain compatible — **MET**

- `test/sidebarBrushUi.test.ts` (14 tests) — the real custom-atlas drag suite, including
  pointercancel/scroll abandonment and one-cell release — passes unchanged.
- `test/structureKitBrushConditions.test.ts`, `test/tileBrushState.test.ts`,
  `test/structurePlacements.test.ts`, `test/roundLakeStamp.test.ts` pass unchanged.
- `comboBrushPaletteUi.test.ts` "reads the drag rectangle from the source sheet, not the display
  order" pins that the custom atlas still uses source coordinates (`[10, 11, 18, 19]`).
- `comboBrushPlacement.test.ts` "keeps single-tile painting on the plain path", "keeps 1x1 stamps
  flowing through the ordinary autotile-aware stamp path" (single-cell stamps still honour
  `autoConnect`), "keeps brush size a repeated-tile concept independent of the combo brush".

### 9. Curated combination metadata and review responsibility are documented; presets are not inferred from numeric adjacency alone — **MET**

- `openwiki/editor-pre-edit-routing.md` → new **Combo Brush (2026-09-10, OPRN-OUT-022)** section:
  terminology table, ownership boundaries, the no-numeric-adjacency rule, review responsibility
  and what a submission must carry.
- `COMBO_BRUSH_REVIEW_OWNER` in code points back at that wiki section; a test pins that link so
  the two cannot drift apart silently.
- `test/comboBrushCatalog.test.ts` enforces the rule mechanically: every cell tile must belong to a
  `CHIPSET_TILE_GROUPS` bag the entry itself cites, the declared layer must equal
  `defaultPaintLayerForTile`, and `dx`/`dy` must fill the declared footprint with no empty row or
  column and no duplicate cell.

## Deferred / not done

- **Nothing from the acceptance list is deferred.**
- Not attempted (out of scope, and the issue explicitly keeps it separate): sharing placement
  validation with OPRN-OUT-017's hard-cluster recovery path. `checkKitStampConditions` and
  `evaluateComboBrushPlacement` stay independent, as the issue requires.
- Full `npm run typecheck` and the whole vitest suite are RED at baseline in this repo; they were
  not used as gates. `npm run gates` is the supervisor's call, not run here.
- The 「조합」 shelf is default-chipset only. Curating combinations for other chipsets is content
  work needing the same review, not a code gap.
