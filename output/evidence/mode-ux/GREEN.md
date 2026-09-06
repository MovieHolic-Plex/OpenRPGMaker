# Sidebar mode UX implementation: GREEN source/unit checkpoint

## Delivered

- Beginner: CSS-owned 288px persistent labeled panel, visible history-backed undo,
  shared full tile grid, selected-tile status/search, and short painting guidance.
  Tile selection no longer closes the picker. The tile utility focuses the grid.
- Maps alone keeps the nonmodal flyout, pin and Escape/opener-focus contract.
  Its width is clamped against the persistent panel rather than the former rail.
- Standard: existing daily tools and labeled More.
- Expert: direct labeled inspector/rule-audit/history dropdowns. More retains
  copy/paste and brush sizes but does not duplicate advanced actions or badges.
  Direct menus reuse existing rendering/anchoring, and Escape restores their
  own trigger. Mode changes dismiss menus.
- Touched selected-tile/tileset-name, auto-connect and map-menu targets have a
  token-based 24px minimum. New labeled utility controls have a 32px minimum.
- Shared custom/RM grids, paint engine, tile-selection implementations, persisted
  mode key, undo stack and project schema were not changed.

## Executed validation

```sh
npm test -- test/sidebarModeWorkflow.test.ts test/basicTilePalette.test.ts test/basicLeftRail.test.ts test/basicRailFlyout.test.ts test/tilePaletteSelection.test.ts test/tilePaletteGrid.test.ts test/tilePaletteGridRoving.test.ts test/tileToolbarOverflowReach.test.ts test/tileToolbarOverflowDismiss.test.ts test/tileToolbarAria.test.ts test/tileToolbarMapModeClickWiring.test.ts test/sidebarFocus.test.ts test/sidebarKeyboardNav.test.ts test/editorUiMode.test.ts test/leftDockPanels.test.ts --maxWorkers=4
npm run gates:css
npm run typecheck:app
git diff --check
```

- Focused tests: **15 files / 117 tests passed**, exit 0, in one final execution.
- CSS budget, import graph and live-class gates: exit 0.
- App TypeScript compiler: exit 0.
- Whitespace diff check: exit 0.
- Logs: `green-tests.log`, `css-gates.log`, `typecheck-app.log` and matching `.exit` files.
- RED proof: `RED.md`, `red-tests.log`, `red-tests.exit` (10 expected new failures).
- First implementation run is retained as `green-attempt-1.log`: new workflow
  suite passed, but four related failures exposed my missing headless window
  guard and duplicated assertion. Those caused failures were corrected before
  the final GREEN run; no test was skipped/deleted to achieve GREEN.

## Changed-file diagnostics

No diagnostics found when checked:

- `src/editor/editorUiMode.ts`
- `src/editor/panels/basicTilePalette.ts`
- `src/editor/panels/tileToolbar.ts`
- `test/sidebarModeWorkflow.test.ts`
- `test/basicLeftRail.test.ts`
- `test/sidebarKeyboardNav.test.ts`
- `test/leftDockPanels.test.ts`
- `test/editorUiMode.test.ts`
- `test/e2e/left-sidebar-adversarial.spec.ts`

Initial diagnostics also found none for `basicLeftRail.ts`, `editor.ts`, and
`tileToolbarMenus.ts`, but final fresh requests for those three timed out twice
at 3000ms. Do not call their final LSP check clean; the final app compiler did
pass on all production source. CSS LSP is unavailable (Biome not installed),
and Markdown has no configured LSP. No dependencies were installed; the real
repository CSS validators passed instead.

## Changed paths

Production:

- `src/editor/editorUiMode.ts`
- `src/editor/panels/basicLeftRail.ts`
- `src/editor/panels/basicTilePalette.ts`
- `src/editor/panels/editor.ts`
- `src/editor/panels/tileToolbar.ts`
- `src/editor/panels/tileToolbarMenus.ts`
- `src/styles/editor/left-sidebar.modern.css`
- `src/styles/shell/editor-ui-modes.css`

Tests:

- `test/sidebarModeWorkflow.test.ts` (new)
- `test/basicLeftRail.test.ts`
- `test/sidebarKeyboardNav.test.ts`
- `test/leftDockPanels.test.ts`
- `test/editorUiMode.test.ts`
- `test/e2e/left-sidebar-adversarial.spec.ts`

Documentation:

- `openwiki/editor-pre-edit-routing.md`
- `DESIGN.md`

## Browser/build handoff and boundaries

No browser/server/build/full-gates execution was performed by this child; these
remain lead-owned. The edited adversarial Playwright spec is not yet executed.
At 1024px the nominal beginner horizontal budget is 1024 - 288 = 736px before
other shell spacing, above the existing 520px canvas minimum. This is source
arithmetic, not a measured after screenshot or hit-test claim. The updated
browser spec asserts 288px panel width, at least 520px canvas, persistent sheet,
map Escape focus and unpinned keyboard tile-selection survival.

The before audit's unrelated narrow topbar save-error overflow is intentionally
unchanged. No after UX score is claimed. No commits or child-owned server/browser
resources were created; lead-owned server and user browser remain untouched.
