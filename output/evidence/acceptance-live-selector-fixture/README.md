# Event-selector fixture repair

Base: `0798a67b36f8416c4f3526be40712c5fb31f51fc`, branch
`fix/acceptance-gate-regressions`. Verification ran against that base plus the
five-line fixture insertion; receipt HEAD values are the pre-commit HEAD.

Only `test/eventEditorStagedState.test.ts` changes executable code: the existing
swap case seeds valid `event-a` and `event-b` records in the actual store's start
map before rendering. Test names, all 14 cases, canonical `eventA`/`eventB`, legacy
field removal, and runtime `_swap` assertions are unchanged. Production code,
fake DOM, other tests, and baseline snapshots are untouched.

## Verification (2026-09-08)

Commands ran in this worktree under `bwrap --unshare-net`, with the host filesystem
read-only and only this new evidence directory/private caches writable. No remote
writes. Two workers; unchanged 15,000 ms test / 90,000 ms hook deadlines. The surface
supervisor deadline remains 360 seconds; focused runs had a 180-second outer bound.
Receipts record exact sandbox commands and actual child exits, not pipeline exits.

| Run | Command inside sandbox | Actual result |
| --- | --- | --- |
| Red, before edit | `node scripts/run-vitest.mjs run --configLoader bundle test/eventEditorStagedState.test.ts -t 'stores eventA/eventB and executes the selected swap' --reporter default --reporter json --outputFile.json output/evidence/acceptance-live-selector-fixture/red-vitest.json` | Exit 1; 1 failed, 13 filter-skipped. Received empty eventA/eventB. |
| Green, complete file once | `node scripts/run-vitest.mjs run --configLoader bundle test/eventEditorStagedState.test.ts --reporter default --reporter json --outputFile.json output/evidence/acceptance-live-selector-fixture/green-vitest.json` | Exit 0; 14 passed, 0 failed/skipped. |
| Real surface gate once | `node scripts/check-surface-gates.mjs --json` | Exit 1; 10 files, 115 cases: 108 passed, 7 failed, 0 skipped. Snapshot exit 1; CSS-live exit 0. |

Language-server diagnostics on the changed test: none. `git diff --check`: exit 0.
The seven remaining surface failures are the DB tab inventory, commit-probe floor,
no-commit ratchet, and form / interaction / M2 / portal snapshot comparisons (six
files). Their case identities match the original surface report; no new failures.
Only the swap fixture failure disappeared (original surface: eight failed cases).
The surface gate is **red**, not waived or weakened.

## Retained local artifacts (repository-relative paths)

- `output/evidence/acceptance-live-selector-fixture/red.log`, `red-vitest.json`, `red.receipt.json`
- `output/evidence/acceptance-live-selector-fixture/green.log`, `green-vitest.json`, `green.receipt.json`
- `output/evidence/acceptance-live-selector-fixture/surface.log` (complete JSON report, case inventory and failure output), `surface.receipt.json`
- Original, unchanged: `output/evidence/acceptance-live-candidate-final/surface-report.json`, `comparison.json`, `summary.json`, `full-vitest.json`.

The original full-run raw JSON contains 1,829 files / 18,363 cases: 18,128 passed,
212 failed, 23 skipped at the base commit. It is not a full run of this later fix.
No full-suite or production-build rerun was performed here. The lead retains the
original trace-recovery and independent inventory evidence; this fix does not
rewrite or reinterpret it. Only this README is committed from the evidence pack.
