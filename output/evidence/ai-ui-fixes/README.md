# Assistant UI fixes — evidence

[Resolution report](../../../docs/qa/2026-09-07-ai-assistant-ui-fixes.md)

## Real-page captures

| Capture | Check |
|---|---|
| [History menu](manual-ai-command-menu.png) | F1 viewport placement and actual hit target |
| [History preference](manual-ai-preference-popover.png) | F1 viewport placement |
| [History context](manual-ai-context-panel.png) | F1 visible disabled compact target, not hidden summary |
| [Collapsed studio columns](manual-studio-collapsed.png) | F5 52px tracks, reclaimed monitor |
| [Long conversation](manual-long-conversation.png) | F1/F9 real composer and pointer download |
| [Settings applied](manual-settings-applied.png) | F6/F7/F8 post-modal editor |
| [Resize RED seam](red/F10-resize-seam.png) | F10 actual production module and stylesheet before fix |

The JSON files beside these captures preserve measured values and actions.
`manual-settings.json` separates the real detached-opener RED from successful
attached-opener, panel-menu and nested-modal checks. The replacement branch is
also covered by a deterministic native-DOM test.

`green/` contains the final 1440×900 and 1024×768 regression captures and per-case
state/error records. `e2e-results.json` is the Playwright result, not a hand-written
claim. Early interrupted or invalid-port runs are not final evidence.

## Validation

Final browser matrix: **PASS 24/24, exit 0** (1440x900 x12, 1024x768 x12).
Result: `e2e-results.json` (expected=24, unexpected=0, flaky=0, skipped=0).

Final `npm run build`: **PASS, exit 0** after the replacement-opener fix.
App: 1,527 modules; player: 562; standalone: 564. All three bundles completed.

Final supervisor gates: typecheck:app exit 0, css gate PASS.
vitest/surface failures are all pre-existing baseline items
(tests baseline 98 failed files incl. eventEditor*.baseline;
surface baseline axes include the same eventEditor baselines).
Changed-file suites (16 files / 175 tests) PASS on direct run.
The new browser spec passes; it is excluded from gates baselines
because it did not exist when the baseline was captured.

Focused results already captured:
- Panel/composer: 35 tests passed.
- Studio regression plus existing shell: 23 tests passed.
- Native empty export plus resize: 12 tests passed.
- Settings/focus replacement plus nested select: 31 tests passed.
- Settings worker's wider regression run: 102 tests passed before the additional
  replacement-opener case; the final gate includes the subsequent case.

These counts describe separate runs and overlap; they are not a unique-test total.

See [captured RED/GREEN excerpts](regression-evidence.md) for the failure mechanisms.

## Cleanup

Teardown complete. Closed both manual browser contexts/browsers, stopped the
owned 29843 (and 29842) dev servers, removed both sparse `/dev/shm/rpg-ai-ui-*`
worker worktrees (branches retained), and deleted task-owned temp dirs
(`st_01a07876` logs, old candidate traces, green-panel candidates, root
`test-results`). 29843 is unbound (`ss -ltnp` shows no listener); both manual
browsers report disconnected. Verified no other worktree or shared server was
touched. Final browser output lives in `e2e-results.json`; `green/` holds the
final per-case captures and state/error records.
