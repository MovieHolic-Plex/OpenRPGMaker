# Sidebar focus modes verification

Implementation: `6e4a4e45c9d82dec905d2ce629d1fd7f1ab4e621`, based on
`b9dec50fb`, branch `feat/sidebar-focus-modes`.

## Delivered contract

Standard has one full-height task surface and a current-map switcher backed by
the existing searchable map explorer. Expert retains map-tree auto/manual sizing,
collapse and saved dock preferences. Both share map/layer positions and existing
editor actions. Beginner's rail, brush buttons, source selection and undo remain.

Primary tools are paint/erase/fill/select, with Expert quick eyedropper. Tools
contains the remaining tools and clipboard actions. Shape is one selector;
Standard reaches it in Tools, Expert beside the brush. Size is one native select
only for freehand paint/erase, with remembered size while hidden. Event has no
duplicate tool entry or irrelevant tile controls. Search and category share one
row. Connection state stays visible; tile status and labelled utilities sit below
the sheet. Assist and structure kits open bounded surfaces rather than taking
sheet height. Inspection/audit/history share a labelled menu; Expert pins are
stored per mode, and Ctrl+K opens the same inspection state.

Outside dismissal removes only the surface, not the sidebar pointer target.
The red browser reproduction left Erase active after opening Tools and clicking
Paint; the regression test and final real-pointer checks prove this is fixed.
Child map-settings modals keep their parent map surface and consume their own
Escape. The old map-header heading margin was also causing five pixels of
clipping; the owned header now uses zero margin and the full button height.

## Verification

- `npm run typecheck:app`: **exit 0** (`final-typecheck.log/.exit`).
- Focused Vitest command below: **21 files, 170 tests passed, exit 0**
  (`verified-focused-tests.log/.exit`). No skipped tests in this run.
- All changed TypeScript source/test files and both MJS drivers received LSP
  diagnostics with no diagnostics. CSS diagnostics were unavailable because Biome is not
  installed; no dependency or gate baseline was changed to hide that limitation.
- Real Chromium, new isolated context, actual editor `?freshProject=1`,
  `SIDEBAR_QA_URL=http://127.0.0.1:9898`: **exit 0**. Browser GETs were relayed
  through Node fetch because direct Chromium loopback imports failed with
  `ERR_NETWORK_CHANGED`. The real browser executed the unmodified app.
- Both the child and parent model lack image decoding. Screenshots exist, but
  neither DOM checks nor screenshots constitute pixel-level visual approval.
  Parent owns independent review, ultrabrain approval, full gates/build and merge.
- No DB content writes: the driver asserts remote persistence is disabled before
  temporary fixture changes and again after reload. Runtime changes stay local.

```sh
npm test -- \
  test/sidebarFocusModes.test.ts test/sidebarModeWorkflow.test.ts \
  test/sidebarBrushUi.test.ts test/tileToolbarOverflowReach.test.ts \
  test/tileToolbarOverflowDismiss.test.ts test/tileToolbarToolAffordance.test.ts \
  test/tileToolbarMapModeClickWiring.test.ts test/tileToolbarAria.test.ts \
  test/sidebarKeyboardNav.test.ts test/editorMenuSidebarIa.test.ts \
  test/editorUiMode.test.ts test/leftDockPanels.test.ts test/tilePaletteChip.test.ts \
  test/inspectorBadges.test.ts test/mapList.test.ts test/mapPanelSection.test.ts \
  test/editorLayoutPersist.test.ts test/tileToolbarMapModeParity.test.ts \
  test/tileBrushState.test.ts test/tilePaletteGridRoving.test.ts \
  test/commandRegistry.test.ts --maxWorkers=2 --minWorkers=1

SIDEBAR_QA_URL=http://127.0.0.1:9898 \
SIDEBAR_QA_OUTPUT=output/evidence/sidebar-focus/final-9898 \
node scripts/qa/sidebar-focus.mjs after
```

## Actual visible sheet geometry

Measured `.left-panel .chipset-sheet`, not an ancestor wrapper. Every row below
passed sidebar-control containment plus center hit-testing, no main/sidebar
toolbar horizontal scroll, no document horizontal overflow, and canvas >=520px.

| Mode | Viewport | Sheet height | Sidebar height | Canvas width |
|---|---|---:|---:|---:|
| Standard | 1440x900 | 544 | 851 | 1134 |
| Standard | 1280x800 | 444 | 751 | 974 |
| Standard | 1024x768 | 412 | 719 | 718 |
| Expert | 1440x900 | 280 | 851 | 1114 |
| Expert | 1280x800 | 200 | 751 | 954 |
| Expert | 1024x768 | 185 | 719 | 698 |
| Beginner | 1440x900 | 522.02 | 851 | 1152 |
| Beginner | 1280x800 | 422.02 | 751 | 992 |
| Beginner | 1024x768 | 390.02 | 719 | 736 |

Standard 1440x900 reaches **63.92%**. Parent baseline on `b9dec50fb` was 280/851
Standard and 266/851 Expert; at 1024x768 it was 176/719 and 134/719 respectively.
Parent supplied the `sidebar-focus-before-*` screenshots from its isolated
baseline server. Final screenshots and measurements are in `final-9898/`.

`final-9898/interactions.json` records real-pointer tool/layer changes, map search
and switch/Escape, nested map-settings dismissal, size/shape transitions, Event
context, category/search reset focus, connection state, assist/kit height
preservation (both retain the 544px sheet), actual stamp selection, all three
Expert pins including reload, tree collapse/keyboard resize, actual canvas
paint/undo, and Beginner selection/layer return. `all-pins.json` records all four
inspection triggers contained at 1024x768; the last pin wraps rather than clips.

## Server identity and known limitations

- **9841 is invalid candidate evidence.** PID 2252417 was a pre-existing shared
  main Vite server, not this worktree. It was never killed or modified. The first
  child attempt against that port was rejected and is not a successful QA run.
- Child interim server 9842 served this worktree. Final evidence uses the
  parent-owned server **9898**; parent owns its restart/lifetime.
- Final console messages concern blocked dev HMR websocket/local companion
  connections, aborted local activity mirroring and local-only autosave notices.
  They are retained in the raw local log. The functional driver exited zero;
  no network/remote-save success is claimed.
- Parent-reported untouched-base failures: full gates timed out at 30 minutes;
  CSS fails only the pre-existing file-count quota (267 -> 268); five pre-existing
  event-editor surface baseline tests fail. App typecheck baseline is green.
  This task neither repairs those unrelated snapshots nor changes gate baselines.
- Geometry tradeoffs are intentional: Standard uses an overlay for map browsing;
  Expert keeps the smaller sheet plus persistent tree. All pins can wrap onto a
  second utility row. Tileset-name activation remains a shortcut to the same map
  settings dialog, not a second setup workflow. No automatic onboarding was added.
