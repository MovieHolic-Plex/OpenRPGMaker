# Informed-appearance dependency contract repair

Base revision: `d932aa66b322412929d04a43af9f7f2b228f2884`.
Scope: `test/assistantDependencyRetry.test.ts`, the record-availability bookkeeping block in `src/ai/assistantSession.ts`, and this validation evidence. No baseline cleanup or emberQuestToolReplay changes.

## Cause and smallest repair

A new enemy denied by the appearance-read gate returns `tool-deferred`, so the previous `!isDeferredToolResult` wrapper excluded it from `failedRecords`. Same-batch troops referencing that absent ID therefore executed against a missing record or received independent generic read refusals. Four such refusals could exhaust the troop retry target before the model could consume appearance evidence and recover.

Record availability is independent of whether the producer executed. Move only record bookkeeping outside that wrapper; leave spec bookkeeping under its existing condition. Failed/deferred producers are tracked only when their record is absent. Successful creation clears the unavailable ID. This also propagates unavailable troop IDs to transitive consumers. Existing records remain available when an update fails or is deferred.

Neither appearance validation, generic read-before-write validation, dependency-guard order, nor retry charging was relaxed or changed.

## Fixtures and regression coverage

- All three existing scripted enemy-creation cases now run `get_monster_resource` in a separate preceding model batch and include root `appearanceTags:["slime"]` on both valid and intentionally invalid writes.
- The test captures actual model-facing requests. It verifies that the following request contains the successful full resource response, not merely that a read tool ran.
- The setup-read event is explicitly asserted before indexing the remaining original events. All existing dependency, 13-troop-event, retry, protocol-response, and recap assertions are preserved. `invalidField:true` remains; an additional check confirms `unknown-db-field` rather than an appearance refusal.
- New real-session cases, with generic reference reads both disabled and enabled: an unseen new enemy defers five same-batch dependent troop calls and a transitive encounter-table write. An unrelated title write succeeds. Later delivered appearance/database reads allow enemy, troop, and encounter creation. The final recap is zero actual failures and seven deferred calls; the plan completes.
- Two new existing-record cases verify that failed and appearance-deferred updates do not invalidate ID references. A subsequent troop can still reference the unchanged existing enemy after the generic full-record read.
- Existing tests continue to cover whole-batch failed-read handling, spec dependencies, generic missing-read retry bounds, same-batch retry exhaustion, user rearming, and successful-correction resets.

## RED / GREEN

All commands and actual process exits are saved in `*-exit.json`; every run used an owned `/dev/shm/st_01a078e1-dependency-fix/<label>` TMPDIR. Exact raw logs are retained in `raw-logs.tar.gz`; readable `.log` copies have trailing whitespace and terminal blank lines removed for the repository whitespace gate. No diagnostic text is removed.

1. `red.log` / `red.json`: initial test development, exit 1. Five failures: the two intended dependency regressions and three newly added assertions that initially named the wrong validation code. Observed production code was `unknown-db-field`; those new checks were corrected without changing the contract assertions.
2. `red-contract.log` / `red-contract.json`: **before any production edit**, exit 1, 14 pass / 2 fail. All original fixture cases now pass. Only the two new deferred-producer cases fail: ordinary failure without deferred data (references=false), or `read-before-write-required` rather than `record-dependency-failed` (references=true).
3. `green.log` / `green.json`: exit 0, **156/156 tests pass across 12 files**, no skips. Includes all 16 dependency tests, generic read contract, assistant/original context, appearance evidence/session/transport/identity/adversarial/asset identity, AI accounting, and real loopback HTTP completion transport.
4. `typecheck-app.log`: `npm run typecheck:app`, exit 0.
5. `typecheck-test.log`: application sources plus the changed test under inherited strict compiler options, exit 0. This is a narrow compile target, not a test exclusion.
6. `build-app.log`: `npm run build:app -- --outDir /dev/shm/st_01a078e1-dependency-fix/build-app-dist --emptyOutDir`, exit 0. Build output is on tmpfs to avoid the nearly full disk. Vite reports mixed static/dynamic-import chunking warnings and chunks over 500 kB; warnings are retained, not suppressed.
7. `evidence-syntax.log`: Node syntax checks on the isolation/config helpers and Python compile check on the runner, exit 0.

No full-suite run. No ENOSPC in these logs. No snapshot refresh, skipped tests, weakened assertions, or remote DB/provider writes. The validation process uses an isolated HOME, empties .env reads without opening credentials, disables dev TLS loading, and permits only loopback network traffic; explicit per-test mocks remain in place.

## Diagnostics and review status

- Language-server diagnostics: no diagnostics for `assistantSession.ts` and the evidence JS/Python helpers.
- An initial changed-test diagnostic request returned clean; subsequent fresh requests timed out at the tool's 3-second limit. Do not interpret those timeouts as clean diagnostics. The complete changed-test/application strict compiler run above is the successful fallback.
- Diff review confirms only the intended bookkeeping block moved. Existing-record existence checks and success clearing are unchanged. Build-spec handling remains non-deferred-only. The guard/retry implementations are untouched.
- Independent renewed **ultrabrain approval is not claimed**: this child has no independent review/delegation tool. Parent review remains required; this directory contains the RED/GREEN and implementation evidence for it.
