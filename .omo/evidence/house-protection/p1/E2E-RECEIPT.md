# Phase 1 actual-editor house protection - PASS

Final gate: **4 passed, 0 failed, zero retries, exit 0 (4.9m)** against production
commit `02b496aec6c331d0cc33b19217765e2b0b2e967b`. See `playwright.log` and
`e2e-receipt.json` (spec hash, outcome summary, JSON/screenshot hashes).

```sh
DEV_SERVER_PORT=52385 E2E_RETRIES=0 npx playwright test test/e2e/ai-house-protection.spec.ts --project=chromium --workers=1 --reporter=line
```

## What the four cases prove

Each fresh real editor session builds one house, attempts destruction in the same
AI turn, and applies the retained draft through the real proposal/store/canvas path.
Permissions are selection, confirmDestroy, overExisting-clear, and overExisting-keep.

- Accepted house construction and accepted permission declarations.
- House erasure, painting an empty protected upper cell, and clearing the north
  ridge all fail with `protected-house-write`.
- Every rejected call leaves the entire session draft map exactly equal to the
  post-build map, including both arrays, events and layout metadata.
- All 42 protected cells (6x6 bbox plus full-width north row) retain both base
  layers and stack entries exactly in the final applied editor store.
- Erasure of a pre-existing unrelated selected upper tile succeeds; final upper
  array differs at that one cell only, and the full lower array remains equal.
- The ridge begins nonempty, so its attempted clearing is not a no-op.

`selection.json`, `confirmDestroy.json`, `overExisting-clear.json` and
`overExisting-keep.json` contain the actual before/built/after maps, per-tool draft
snapshots, tool results, permissions, store notification, audit and denied writes.
Their equalities were also checked directly with Python after the passing run.
The twelve 1440x900 PNGs show before/build-preview/after for all four cases.
The build-preview is captured while the real session is held before destruction;
its normal preview animation may still be visible. Screenshot files and dimensions
were verified, but subjective visual interpretation was not independently graded
because this child model cannot inspect image attachments.

## Determinism and isolation

Only `/v1/chat/completions` responses are scripted. The panel bridge, AssistantSession,
registered tools, project store, selection state and Phaser renderer remain real.
Tool completion is observed from its response in the next model request; the AI
store subscription is installed before sending and awaited together with the real
send promise. Render capture awaits Phaser postrender. All have bounded deadlines.
No sleeps, polling delays, boot retry loops or suppressed failures are present.

The engine-only `blankProject=1` fixture asserts remote project persistence disabled.
A context-owned network guard aborts remote writes, including during page-route
teardown; it never fabricates a successful save. No authored demo or production
file was edited. Final LSP diagnostics and `git diff --check` were clean. This
browser-only child did not rerun the application build or broad unit gate.

## Server identity and cleanup

`.env.local` assigns 9841, but that listener belonged to `/home/main/z-project/rpg-zzu`.
An initial 9842 override collided with another worktree and was interrupted before
being treated as evidence. The final owned server used OS-selected port **52385**,
strict-port mode, frozen source watching and a private Vite cache. Every server
process cwd was the phase worktree (`server-receipt.json`). No credentials are
included in the receipt.

`cleanup.json` records pidfd-confirmed termination of all four owned npm/Vite/esbuild
processes and the joined log-reader thread. Port 52385 was bindable after cleanup;
TIME_WAIT sockets are not live servers. The private cache was removed. Playwright
owned and disposed its browser contexts. Foreign servers were left untouched.

## Earlier failures, resolved in test infrastructure

Prior development runs failed on stale HTTP sockets, route-response disposal, and
route teardown sharing an almost-exhausted test budget. The final spec disables
connection reuse for dev modules (not retries), leaves ordinary image fetching with
Chromium, and drains route handlers in a separately bounded fixture teardown.
The 120-second test and 60-second session deadlines were not increased. An earlier
full run also passed before final oracle review replaced a redundant helper-count
assertion with the real ridge precondition. Only the final run is the certificate.

No additional production blocker was observed in these four cases. The supervisor's
six roadObstacleAvoidance regressions are explicitly outside this certificate;
the isolated road worker's fix still requires integration and final supervisor QA.
No push or PR was made.
