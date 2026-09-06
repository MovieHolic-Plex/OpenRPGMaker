# Sidebar focus modes - R1 handoff

Review: `/tmp/sidebar-focus-ultrabrain-r1.md`, REQUEST_CHANGES on `d8dfa2466`.
Repair commit: `1169976c8dc22b1d36bdb1ee585dc6ad6ca68f1a`.
Integrated main: first `5d2649d0c`, then `db825efc51ebd186163b020e3d61d63ddabaf7c3`
after origin advanced during the task. No further integration is being attempted.

## Implemented repairs

1. The actual map context menu uses the shared keyboard layer stack and
   `--z-popover-high` (1200), above the map surface (90). Child pointer actions
   retain the map explorer. Escape closes one layer and restores its map row.
   The deferred row-focus timer that stole menu focus is removed. The required
   cancel exercise also exposed a blur-after-Escape commit: Rename now settles
   its draft before teardown so cancellation cannot commit it.
2. Mode notification removes the live surface rather than forgetting its owner.
   Dock remount closes ownership; editor teardown removes surface listeners.
   Beginner-first subscriber ordering is regression-tested without an extra
   palette render after the mode event.
3. Expert's current-map header calls `revealMapInDock`: the owning map renderer
   updates section collapse, branch expansion/filter reset and current-row focus.
4. Inspection command dispatch activates a missing Tiles host through workspace
   state before opening/focusing the existing pinned or unpinned inspection.
   Activation stays in command dispatch to avoid a panel/workspace import cycle.
5. Both integrations preserve the sidebar, action-combat and event-window DESIGN
   additions. The canonical OpenWiki index was regenerated; no conflict remains.

No new default controls/onboarding, remote content writes, push or PR merge.

## Completed verification

- `final-focused.log/.exit`: **22 files / 181 tests, exit 0**, on the repair plus
  `5d2649d0c`. Command uses `taskset -c 8-11 npm test --` with the original
  21-file set in `../README.md`, plus `test/sidebarFocusR1.test.ts`, and
  `--maxWorkers=2 --minWorkers=1`.
- After integrating `db825efc5`, `latest-focused.log/.exit`: **4 files / 52 tests,
  exit 0**. Exact targets: `test/sidebarFocusR1.test.ts`,
  `test/sidebarFocusModes.test.ts`, `test/mapList.test.ts`,
  `test/commandRegistry.test.ts`; same affinity/worker options.
- `latest-typecheck.log/.exit`: **npm run typecheck:app, exit 0** after that latest
  integration. R1 TypeScript/MJS diagnostics were clean. CSS LSP is unavailable
  because Biome is not installed. `node scripts/openwiki-index.mjs --check`
  passed against the integrated tree.
- Red evidence: `unit-red.log` has four intended ownership failures; browser
  `red/results.json` has five failed probes covering all four behavior findings,
  plus the passing Standard-first control. `rename-red.log` independently
  reproduces cancellation committing a draft on blur.
- Final frozen-server browser evidence **completed at handoff**:
  `context-menu-pointer` and `context-menu-keyboard`, both at 1440x900, 1280x800
  and 1024x768. Actual hit-tested Rename, cancel and commit passed; keyboard
  opening/navigation/Rename and two-level Escape/focus return passed.
  Standard visible sheet remains **544/851 = 63.92%**, canvas 1134px at 1440x900.
  See `handoff-browser-results.json` and `final-direct/context-menu-*.png`.

## Remaining browser verification - parent-owned, NOT reported as pass

The final frozen-server driver is still running at handoff. Beginner-first and
Standard-first Ctrl+K Tools/Assist transitions plus teardown/remount, persisted
Expert collapse/header reveal and pointer/keyboard resize, and the three
inspection commands across maps-only reload/pinned/unpinned states have not all
completed in that final run. Their DOM regressions pass, but that is not a
substitute for the remaining real-browser checks.

```sh
SIDEBAR_QA_URL=http://127.0.0.1:9842 \
SIDEBAR_QA_OUTPUT=output/evidence/sidebar-focus/r1/parent-final \
node scripts/qa/sidebar-focus-r1.mjs
```

The reusable driver uses real Firefox, native pointer/keyboard actions, real
context-menu/render owners and pre-registered DOM/mode signals. No sleeps,
polling delays, fake registered modals, or post-mode manual palette rerenders.
Existing full geometry/interaction driver: `scripts/qa/sidebar-focus.mjs`.

## Execution identity and limitations

- Owned frozen server: **9842, PID 2497089**, cwd this task worktree; launched
  through Vite `createServer` with `server.hmr=false`. Application source stays
  frozen. Shared-main 9841 was never used or killed during R1.
- Child final browser PID at handoff: **2535417**. Live output:
  `final-direct-browser.log`, results `final-direct/results.json`, eventual exit
  `final-direct-browser.exit`. These live files are not immutable pass evidence.
- A further same-22-file focused rerun after latest integration is in progress
  (`latest-full-focused.log/.exit`); it is not counted as passed without its exit.
- Earlier runs interrupted by Vite full reload during integration or browser
  transport/relay failures are invalidated, not passes. The final driver uses
  native Firefox requests and the HMR-disabled server. A completed earlier
  legacy matrix run is recorded separately, not substituted for final R1 cases.
- Image decoding is unavailable. Captures and DOM/hit-test evidence do not claim
  pixel-level visual approval.
- Parent owns final build, gates, browser completion, ultrabrain re-review and
  approval, and PR merge. Baseline full gates timed out at 30 minutes, including
  the affinity-bounded `5d2649d0c` run; candidate/earlier timeouts are not passes.
  No unrelated suite failures or gate thresholds were changed to obtain green.
