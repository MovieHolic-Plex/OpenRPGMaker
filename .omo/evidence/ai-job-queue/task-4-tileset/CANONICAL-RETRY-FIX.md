# Supervisor correction: canonical persisted proposal replay

Initial commit: `b7296218af5bea48c70e81be1e4480000c9738f3`.
The separate fix commit contains this document; its SHA is returned in the task
result. The initial commit was not amended.

## Cause and fix

`repository.putJson` uses canonical JSON with sorted object keys. The old
completed-proposal check compared insertion-order JSON.stringify output against
readJson, rejecting a semantically identical canonical disk object. The earlier
cluster provider-message canonicalization does not address that separate check.

`executeTilesetJob` now puts the complete regenerated typed proposal through the
host's existing content-addressed JSON method and compares all three ref fields:
SHA-256, byteLength and mediaType. This uses the repository's canonical identity
without importing Node storage code into the worker or weakening comparison to
selected fields. Every field, value and array position still participates. The
original immutable proposal ref and artifact list are returned on replay. No
provider call, application or remote save is added by this comparison.

Only product edit: `src/ai/jobs/executors/tilesetJob.ts` (8-line focused diff).
Owned test edit: `test/aiTilesetJob.test.ts`. No shared source/config or other
family file was edited.

## New real-filesystem coverage

The fixture opens the actual `openAiJobsRepository`, admits a job, registers an
attempt, and persists checkpoint references through real repository transactions.
Inputs, images, raw responses, typed proposals and checkpoint envelopes traverse
real canonical blobs. Each retry closes/reopens the repository and registers a
fresh attempt. The paid provider boundary alone is a controlled wire fixture;
the executor, analyzers, parsers and storage implementation are real.

Eight new parameterized cases cover BOTH completed retry and raw-response to
proposal-checkpoint-failure recovery for EVERY non-cluster discriminator:

- `knowledge-analysis`
- `proposal-draft`
- `question-followup`
- `structure-kit-metadata`

The completed-retry cases first prove that disk and fresh output are deeply
equal but JSON.stringify ordering differs. They assert identical result payloads,
immutable proposal refs and artifact lists after repository reopen. Then each
case substitutes valid immutable JSON containing a changed target, an extra
field, a missing field, or a reordered nested array; all must still be rejected.

The checkpoint-failure cases throw at the exact completion checkpoint boundary,
after raw response persistence. They confirm the durable checkpoint contains
rawRef but no proposalRef, reopen storage, and assert that recovery returns the
same content-addressed proposal that was attempted before interruption. Another
completed retry remains stable. The provider-operation spy is asserted to have
been invoked **exactly once**, not merely deduplicated by a mock ledger. This
also covers stable structure condition IDs and native conversation/review data.

## Faithful asynchronous acknowledgements

The first post-fix full run reproduced the supervisor's reporting issue: all 112
assertions passed, but Vitest exited 1 with `Timeout calling "onTaskUpdate"`.
That run is retained as `canonical-green.log` and is **not accepted as GREEN**.

The older in-memory fixture acknowledged writes synchronously through resolved
promises, allowing long microtask chains to starve worker/reporting IPC. Its
write acknowledgement now waits on a MessageChannel message. The receiver and
error handler are registered before send; a 10-second failure deadline is
cleared and both ports are closed in finally. There is no fixed sleep, polling,
error suppression or increased test timeout. The filesystem fixture continues
to use real awaited storage I/O. The final pool is bounded to two workers to
avoid adding excess load on the shared workstation; all nine files still run.

## Commands and observed outcomes

All commands ran in `/home/main/z-project/rpg-zzu-aiq-tileset-silver`.

1. BEFORE the product fix:
   `npm test -- test/aiTilesetJob.test.ts -t 'canonical filesystem proposal retry'`
   -> **exit 1**, `canonical-red.log`: all eight new cases fail with
   `Checkpoint proposal does not match its raw response`. The name filter was
   RED diagnosis only; no tests were disabled or removed.
2. AFTER the content-identity fix, before acknowledgement correction:
   `npm test -- test/aiTilesetJob.test.ts test/tilesetAiNativeAnalysis.test.ts test/tilesetAiNativeReviewModel.test.ts test/tilesetAiConversationSession.test.ts test/tilesetAiCpenClient.test.ts test/tilesetAiMetadataNormalizer.test.ts test/tilesetAiMappingRules.test.ts test/tilesetAiSetupMapping.test.ts test/structureKitEditorDialog.test.ts`
   -> **exit 1**, `canonical-green.log`: 112 assertions pass, one unhandled
   `onTaskUpdate` RPC timeout. Explicitly rejected as final proof.
3. Concurrent initial `npm run typecheck:app` exceeded the command tool's
   120-second watchdog without a reported compiler result. It was not counted
   as a pass. The later completed invocation below supersedes it; no compiler
   settings, errors or test deadlines were changed to obtain that result.
4. FINAL after acknowledgement correction:
   `npm test -- --maxWorkers=2 test/aiTilesetJob.test.ts test/tilesetAiNativeAnalysis.test.ts test/tilesetAiNativeReviewModel.test.ts test/tilesetAiConversationSession.test.ts test/tilesetAiCpenClient.test.ts test/tilesetAiMetadataNormalizer.test.ts test/tilesetAiMappingRules.test.ts test/tilesetAiSetupMapping.test.ts test/structureKitEditorDialog.test.ts`
   -> **exit 0**, `canonical-final.log`: **112 passed / 9 files**, including
   **36 adapter/graph tests**, no RPC or unhandled errors. One complete run.
5. FINAL `npm run typecheck:app`
   -> **exit 0**, `canonical-typecheck-final.log`.
6. `lsp_diagnostics(..., severity="all")` on `tilesetJob.ts` and
   `aiTilesetJob.test.ts`: **No diagnostics found**. Test diagnostics repeated
   after the MessageChannel edit, also clean.
7. `git diff --check`: **exit 0**. No `rpg-tileset-canonical-*` directories
   remained under /tmp after tests, and `ss -ltn '( sport = :19846 )'` showed
   no listener. Repository locks, directories and MessageChannel ports are
   cleaned in finally. No paid request or remote project write was made.

The initial supervisor 104-assertion result was baseline only and, per supervisor
feedback, its RPC-timeout exit was not an accepted pass. The final post-fix
proof is command 4, not the earlier lane or supervisor results. Full browser and
whole-application build gates remain supervisor-owned.
