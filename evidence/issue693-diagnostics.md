# Issue 693 diagnostics lane handoff

Scope: OUT-009/010. Worktree `rpg-zzu-issue693-diagnostics`, branch
`fix/issue693-diagnostics`. One bounded observation-only, memory-only diagnostic
session, consent/category selection, existing export-entry replacement, frozen
Markdown/JSON preview and separately confirmed clipboard/file output.

## Reproduce

Use this worktree; first verify port 38425 is free. Do not use adoption's 9841.

```sh
mkdir -p /dev/shm/rpg-zzu-issue693-diagnostics/tmp
TMPDIR=/dev/shm/rpg-zzu-issue693-diagnostics/tmp \
DEV_SERVER_PORT=38425 \
VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-diagnostics/vite \
VITE_EDIT_ACTIVITY_DISK_MIRROR=0 npm run dev:worktree -- --port 38425
# In another shell in this worktree:
TMPDIR=/dev/shm/rpg-zzu-issue693-diagnostics/tmp node scripts/qa/issue693-diagnostics.mjs
```

The script uses real Firefox, actual assistant-menu consent, native canvas paint,
local-only save, real Test Play keyboard collision/movement/event/transfer, stop,
preview, cancelled download, confirmed JSON and Markdown downloads, clear/reload.
It blocks non-origin requests and never reads private logs or remote projects.
`QA_BASE_URL` and `QA_OUTPUT_DIR` override the base/evidence directory.

Evidence: `/dev/shm/rpg-zzu-issue693-diagnostics/evidence/qa.json`, seven PNGs,
`confirmed-report.json`, `confirmed-report.md`. The completed run measured one
million disabled checks/publications with zero payload reads (15 ms on the latest run;
an observation, not a cross-device performance guarantee). Screenshots need lead
visual/CJK review: this child model cannot inspect images. No visual approval or
Lighthouse score is claimed.

## Focused verification

```sh
TMPDIR=/dev/shm/rpg-zzu-issue693-diagnostics/tmp npm test -- \
  test/localDiagnosticSession.test.ts test/localDiagnosticsWorkflow.test.ts \
  test/localDiagnosticSources.test.ts test/runtimeMovementStability.test.ts \
  test/playSceneInterpreterCutsceneSkip.test.ts test/storePersistenceProof.test.ts \
  test/houseDoorOpen.test.ts --maxWorkers=1
TMPDIR=/dev/shm/rpg-zzu-issue693-diagnostics/tmp npm test -- \
  test/aiChatPanelUxRepairs.test.ts -t 'local diagnostics' --maxWorkers=1
```

Final focused runs: 94/94 and 1/1 pass. Red/green logs are in
`/dev/shm/rpg-zzu-issue693-diagnostics/`: `issue693-diagnostics-red-core.log`,
`issue693-diagnostics-red-workflow.log`, `issue693-diagnostics-red-sources.log`,
`issue693-diagnostics-red-transfer.log`, `green-final.log`, `green-entry.log`.
Red commands were the corresponding tests above; source tests initially used
`-t 'local diagnostics'`, and transfer used `-t '실내에서 기존 발판'`.
The early broad AI-panel run also failed outside the new regression: abort timeout,
missing composer-chip assertion, fake-DOM select support. Those unrelated failures
remain unchanged; an isolated base comparison was not performed by this lane.
TypeScript/JS LSP reported no errors in changed code/tests. CSS LSP is unavailable
(Biome not installed); PostCSS parse passed and no dependency was added.
Full gates/build are lead-owned.

## Integration contract and limits

- `store.ts` only adds successful-save observation in `persistCurrent`. The local
  hook runs only after `saveDevProjectOverride` returns true. The remote hook uses
  captured `generationAtSubmit` after the existing lineage guard, requires an
  accepted receipt and matching diagnostic token, and excludes IDs/hash/content.
  Media-lane transaction changes remain authoritative; carry this additive hook
  through successful-save publication without changing persistence decisions.
- `savedGeneration` is latest observed accepted save, explicitly not the running
  scene's revision proof. Null is unverified. No goal-pass inference is made.
- Conversation receipts intentionally retain only role and character count, never
  user/output prose or old raw audit history. All categories are opt-in; all retained
  payload strings are enums. Existing independent audit/network policies stay intact.
- Event-editor files were not changed. `diagnosticReport` is the pure selected-section
  projection; no raw validation payload or assistant submission was added.
- Root disk pressure affected early browser startup. Temporary logs/cache moved to
  this lane's `/dev/shm` directory. An exact-match patch helper partially applied an
  early multi-file patch before rejecting the ambiguous AI-panel hunk; that hunk was
  subsequently applied explicitly and `git diff --check` passed. No truncated source
  write was observed. No remote writes, pushes, PR actions or comments were made.
