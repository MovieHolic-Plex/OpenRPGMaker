# Issue 693 navigation handoff

Scope: OUT-005 / OUT-006 / OUT-008, authoring camera only. The assistant remains
FLOAT; no assistant diagnostics, persistence or project schema changes.

## Reproduce the browser proof

From the assigned worktree, first confirm port 38423 is free. Start a freshly
restarted server (a frozen server must be restarted after source changes):

```bash
mkdir -p /dev/shm/rpg-zzu-issue693-navigation/{tmp,vite}
ss -ltnp '( sport = :38423 )'
TMPDIR=/dev/shm/rpg-zzu-issue693-navigation/tmp \
DEV_SERVER_PORT=38423 \
VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-navigation/vite \
E2E_FREEZE_DEV_SERVER=1 npm run dev:worktree -- --port 38423
```

In a second terminal in that same worktree:

```bash
TMPDIR=/dev/shm/rpg-zzu-issue693-navigation/tmp \
BASE_URL=http://127.0.0.1:38423 \
EVIDENCE_DIR=output/evidence/issue693-navigation/final \
node scripts/qa/issue693-navigation.mjs
```

Optional `QA_WIDTH=1024` restricts the capture to one desktop width. Firefox is
used through the existing Playwright dependency. The script drives real native
wheel, pointer, keyboard, scroll and resize events against the live editor and
Phaser camera. It does not mock viewport geometry, render a substitute surface,
call an LLM or write remote content. `freshProject=1` loads the existing 100x100
map; `createBlankProject` supplies the existing 20x15 local-only small project.
All waiters subscribe to exact input/scroll/scrollend/scale/postrender events with
bounded deadlines, not sleeps or polling.

## Verification receipts

- Baseline: `15b95dc138ea71602f2cabf7d9cce9a10584f498`.
- Before implementation, the browser driver failed all four original seams at
  all three sizes: Ctrl+wheel left zoom at 2 instead of 3; assistant opening
  changed visible focal Y; zero camera scrollbar regions; no neutral primary pan.
- `npm test -- test/cameraStability.test.ts` first failed 2/9 cases: zoom-2 center
  was reported as (200,150) instead of (400,300), and resize did not preserve it.
- Final browser proof: **51/51 PASS**, with one PNG per case. Includes large and
  small maps, assistant expanded/resized/collapsed, X/Y endpoints and proportional
  thumbs, native keyboard scrolling, pointer-anchored bidirectional zoom, plain
  wheel, explicit Pan/Space/middle drag, neutral drag, paint/select/event alignment,
  keyboard zoom and live resize plus Standard/Expert roundtrip.
- Focused TypeScript syntax/semantic diagnostics on all ten changed TS files:
  **0**. QA driver `node --check`: pass. CSS parsed successfully with the existing
  PostCSS parser; Biome CSS LSP is unavailable, and no dependency was installed.
- Related command (one worker, temporary files in this lane's /dev/shm directory):

```bash
TMPDIR=/dev/shm/rpg-zzu-issue693-navigation/tmp npm test -- \
  test/cameraScrollbars.test.ts test/cameraStability.test.ts \
  test/cameraFocusViewport.test.ts test/editSceneCameraFocus.test.ts \
  test/editSceneRender.test.ts test/editScenePaintHistory.test.ts \
  test/editorCameraFocusPlan.test.ts test/mapSurfaceFocus.test.ts --maxWorkers=1
```

Result: **133 passed, 1 failed**. All seven camera/paint suites pass. The unchanged
`mapSurfaceFocus.test.ts:99` history-owner fixture expects true for
`event-editor-modal`, but its fake DOM does not match the owner's
`:not([hidden])` selector. The exact base-commit owner functions and base fake DOM
reproduce `{ testid: 'event-editor-modal', expected: true, actual: false }`.
`hotkeys.ts`, `mapSurfaceFocus.ts`, that test and `fakeDom.ts` are byte-identical
to baseline and were not modified. No failing test was skipped or deleted.

## Evidence locations in the assigned worktree

`output/evidence/issue693-navigation/` (generated evidence, not committed images):

- `red/results.json`, `red/*.png`, `red-browser.log`, `red-center.log`
- `final/results.json`, `final/*.png`, `browser-final.log`
- `focused-final.log`, `diagnostics-final.log`, `base-history-owner.log`
- `capture-manifest.json`: 51 valid PNG files, expected desktop dimensions and
  nonempty pixel diversity. This is capture hygiene, not a visual verdict.

## Integration notes

- Neutral means **Select, outside the map**, no selection/stamp/paste/edit gesture.
  Paint and Event always retain edit ownership; Pan/Space/middle remain explicit.
- Scrollbar extent includes half-view inspection padding plus 32 CSS pixels, even
  on a small map. Both edges can be centered with the assistant open.
- Ctrl is the wheel modifier on Linux/Windows/macOS; trackpad Ctrl-style pinch
  follows it. Command-only wheel remains unchanged. Zoom limits are 1/2/3/4/6/8.
- Full gates/build and independent visual review are lead-owned. This child cannot
  view images; no visual approval, Lighthouse score or accessibility-debt waiver
  is claimed. The captured screenshots are ready for the lead's own review.
- Root disk pressure prompted migration of owned cache/tmp files to /dev/shm.
  No source write was truncated. One overbroad diagnostic attempt timed out;
  the replacement changed-file-only diagnostic pass completed successfully.
- The standalone `apply_patch` binary is absent in this child environment. All
  code edits used a shell `apply_patch` compatibility function backed by
  `git apply`, with unified patches and final `git diff --check` verification.
