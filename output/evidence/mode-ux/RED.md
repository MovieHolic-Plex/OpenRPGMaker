# Sidebar mode UX: RED checkpoint

Production is unchanged. Awaiting lead GO after the before-browser audit.

## Changed test

- `test/sidebarModeWorkflow.test.ts` (11 integration cases, happy-dom)
- No existing tests removed, skipped, or changed at this checkpoint.
- Production renderers, editor state, tile grids, store, and history remain real.
- History tests subscribe to `oprn:map-edit-history-change` before each action,
  with a bounded deadline and listener cleanup. No sleeps or polling.
- Production debounce/positioning timers are fake and canceled at teardown;
  they are not advanced to make assertions pass.

## Executed command

```sh
npm test -- test/sidebarModeWorkflow.test.ts test/basicTilePalette.test.ts test/basicLeftRail.test.ts test/tilePaletteSelection.test.ts test/tilePaletteGridRoving.test.ts test/tileToolbarOverflowReach.test.ts
```

Exit: 1. Results: 1 failed file, 5 passed files; 10 failed tests, 37 passed tests.
Raw output: `red-tests.log`. Captured process exit: `red-tests.exit`.

All ten failures belong to the new workflow suite:

- Beginner picker absent on first render.
- Beginner selected tile cell absent without opening a flyout.
- Custom atlas persistent picker absent.
- Returning from event layer does not mount the persistent picker.
- Map flyout Escape restores its opener, but persistent picker remains absent.
- Beginner `oprn-tool-undo` absent.
- Expert direct inspector absent.
- Expert direct rule audit absent.
- Expert direct history absent.
- Returning to beginner preserves tool/tile, but persistent picker is absent.

Standard daily tools plus More already pass. The five existing suites pass
(36 tests), preserving current grid, selection, keyboard and overflow baseline.
Later assertions for new behavior are intentionally not yet reached where
prerequisite controls are absent; GREEN must execute them after implementation.

## Diagnostics and scope

- Changed-file LSP: no diagnostics found for `test/sidebarModeWorkflow.test.ts`.
- `git diff --check`: exit 0.
- Git status after test execution: only new `test/sidebarModeWorkflow.test.ts`;
  evidence lives under the ignored output tree.
- No server/browser launched, no commit made, no production or wiki edits yet.
