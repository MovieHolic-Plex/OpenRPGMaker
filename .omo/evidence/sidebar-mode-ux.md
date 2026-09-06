# Editor sidebar mode UX

## Scope

Beginner now has a persistent 288px labeled palette and visible history-backed
undo. Standard keeps daily drawing tools and labeled More. Expert exposes
inspector, rule audit and history directly without duplicate overflow actions.
Map flyout focus, custom atlas geometry, existing paint engine and persisted mode
selection are preserved.

The sidebar toolbar keeps More beside daily tools. Automatic map-dock sizing
reserves up to 108px of actual map-list content, rather than allowing the tile
sheet's preferred height to starve a multi-map list.

## Adversarial rubric

Scores are functional/geometry UX judgments, not pixel-level visual certification.
The image tools could not display captured screenshots to the active models.

| Mode | Before | After |
| --- | ---: | ---: |
| Beginner | 73 | 90 |
| Standard | 77 | 82 |
| Expert | 71 | 86 |

Weights: actual painting/recovery/state retention 30, discoverability 25,
accessibility/targets 20, canvas/narrow layout 15, mode differentiation 10.

Before evidence: `output/evidence/mode-ux-before/REPORT.md` and
`combined-action-log.json`. The baseline confirms palette dismissal after every
beginner tile choice, missing visible beginner undo, and near-identical
standard/expert workflows.

The independent after audit (`output/evidence/mode-ux-after-audit/REPORT.md`,
`lifecycle/result.json`) passed eight physical paint/undo scenarios, six mode
transitions and six advanced-menu open/close checks. These scores and that audit
preceded the final multi-map allocation corrections. The lead subsequently
verified all eight scenarios on final source; the same conservative rubric
scores are retained rather than awarding additional points for those fixes.

## Failing-first and regression evidence

- `test/sidebarModeWorkflow.test.ts`: 10 expected failures before production
  edits; 37 existing cases passed. Evidence:
  `output/evidence/mode-ux/RED.md`, `red-tests.log`, `red-tests.exit`.
- Implementation: 117 tests across 15 files passed in one final focused run.
  Exact command and output: `output/evidence/mode-ux/GREEN.md`,
  `green-tests.log`.
- Real multi-map E2E caught a 104px list at 1440px and an 86px list at the narrow
  viewport, both below the unchanged 108px criterion. Fixes address toolbar
  wrapping and measured dock minimum respectively.
- Post-allocation focused run: `test/leftDockPanels.test.ts` and
  `test/sidebarModeWorkflow.test.ts`, 19 tests passed.
- E2E resize synchronization subscribes before viewport changes using
  ResizeObserver and the resize event, with bounded cleanup. It has no sleeps,
  timing retries, or weakened height assertion.
- The browser harness reads the running application's actual module instances
  and awaits the one-shot EditScene create event. A visible canvas alone does
  not prove that the game object is ready. Local GETs use real Node-fetched
  responses to avoid shared-host Chromium network-change failures.

## Validation and limits

- Initial full `npm run build`: exit 0, including app/player/standalone.
- Final CSS gates plus app build after toolbar correction: exit 0.
- Changed `editor.ts` and E2E TypeScript diagnostics: clean.
- Some earlier large-file LSP requests timed out. CSS LSP was unavailable
  because Biome is not installed; repository CSS validators were used.
- The first full gate was interrupted after more than 20 minutes during heavy
  shared-machine contention. It is not a passing result. A CPU-limited full
  gate (`taskset -c 0,1 npm run gates`) also did not finish within 30 minutes.
  Both attempts are inconclusive; no claim of full-suite/baseline parity is made.
- Post-allocation focused tests and `npm run typecheck:app` completed together
  with exit 0 (19 tests passed).
- Pre-existing local-fixture save-error topbar overflow at 1024px and the
  canvas's missing accessible name/focus entry are outside this sidebar change.
- QA uses local fixtures only. No authored remote project data was written.

## Final-source verification

- Final full `npm run build` after both layout fixes: exit 0
  (`mon_5MNJF4PD4M71V2C4`).
- Multi-map E2E reached its final Maps screenshot after all mode/viewport,
  keyboard, palette and map-height assertions passed. It hit the 600-second
  overall budget while capturing; duplicate screenshots were reduced without
  changing assertions, timeout or retry policy.
- `npm run gates -- --only surface` fails the untouched event-editor snapshot
  axes. Running the same command at starting commit `9d5134e5` in an isolated
  adopted worktree reproduces the same commit-probe/no-commit, form, interaction,
  M2 and portal snapshot failures. The current run additionally hit a 15-second
  M2 test timeout; a focused rerun completed that case and left only the same
  baseline snapshot failure (10 passed, 1 snapshot failure). Surface parity is
  not represented as a green gate.
- The isolated baseline worktree was removed and its path verified absent.

- Final-source lead browser run: **8/8 passed**, six mode transitions preserved
  map and tile state, six advanced-menu open/close checks passed. Each scenario
  physically selected tile 7, painted a map cell, and used the visible undo
  button to restore the exact map. Upper-layer data remained unchanged.
- Final-source action/geometry/cleanup evidence:
  `.omo/evidence/sidebar-mode-ux-actions.json`.
- At 1024x768, canvas rectangles are beginner 736x645, standard 718x645 and
  expert 698x645. Beginner palette remains visible after every tile choice.
  Beginner undo is 88x36; expert direct controls are at least 76x32 and pass
  center hit-testing. Tile/tileset reveal and auto-connect targets are 24px high.
- Explicit final PNGs and traces: `output/evidence/mode-ux-after/`.
  Both 1280/1024 contexts and the browser closed successfully.

- Final E2E command:
  `DEV_SERVER_PORT=29887 E2E_RETRIES=0 npx playwright test test/e2e/left-sidebar-adversarial.spec.ts --workers=1`
  completed **1 passed, exit 0, 8.6 minutes**. All three modes at
  1440x900, 1280x800 and 1024x768 retain the original control/hit-test,
  map-list, palette, keyboard and focus assertions.
- Self-review: the HEAVY tier remained appropriate for coordinated mode and
  layout changes. The diff is confined to sidebar presentation, map-dock sizing,
  related tests and documentation; no shared palette geometry, paint engine,
  project schema, persistence behavior or user content was changed. No test
  assertions were weakened or skipped. This bare ultrawork run used self-review,
  not a plan-gated reviewer approval.
- Cleanup: all QA browser contexts closed; owned server PID 2053229 terminated
  and port 29887 verified empty; temporary server PID/log files removed.
  Baseline worktree `/tmp/sidebar-ux-baseline-5ef1` removed and path absent.
  Evidence files and the requested notepad are intentionally retained.
