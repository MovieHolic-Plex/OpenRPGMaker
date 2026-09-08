# C2/C3 core correction + frozen P1 fixtures

## Handoff verdict

**The nine accepted source/entry RED cases now pass with their original incomplete expectations and current required rows visible. All requested P1 complete-file batches are GREEN.** App typecheck and app build pass. The full test/ambient typecheck remains red; five diagnostics belong to the earlier P1 fixture increment and are explicitly attributed below, not mislabeled upstream.

- Integration HEAD/base: `2294496e33c9da64d242a0bda23cdc9861a6ddf0`.
- Task: `st_01a07fd8`; parent/root `01a07570-3fcb-7988-b994-b5b369ac125d`; Astra (`gpt-6-astra`, `opencodex`).
- `handoff-core-correction.patch`: two production files, five direct source/early-boundary test files, focused `openwiki/editor-ai-panel.md` correction.
- `handoff-core-plus-fixtures.patch`: complete 15-file core + P1 deliverable against HEAD.
- Core patch SHA-256: `d3cc5c9732477afea3b8c1df88d81208f934d97bd917e71e66275c5c244e365a`.
- Combined patch SHA-256: `64e1b5ac3745271241c1940ff07e6b88967afdb54b526574e556a70bc84d6f94`.
- `handoff.sha256` freezes every changed file. The original seven P1 files still match `../frozen-tests.sha256` exactly, so all nine original RED traces were reused without changing their tests.
- No commits, branch operations, P2/GROK worktree edits, shared-helper edits, unrelated production/UI changes, full suite or browser runs. The UI commit `e33ec0f4e` remains outside integration.

This handoff supersedes the unresolved-core verdict in the parent P1 README; the original RED evidence remains preserved there.

## Minimal production correction

### Existing ledger capture owns the current denominator

`AssistantAcceptanceLedger.startRequest` already owns source capture and canonical required promises. It now also publishes those newly captured unresolved rows into a **new frozen current ledger snapshot** immediately. Existing assessed rows/evidence are reused unchanged. Empty source units and non-authoring requests append nothing and leave the current snapshot unchanged.

This is not a second outcome ledger or a goal override: `getRunOutcome` still derives its goal from the existing acceptance snapshot. The new required source rows are in the same promise map and use the same unresolved-row representation as normal evaluation. A direct regression proves capture does not invoke criterion evaluation, preserves old snapshot/item identity and data, deduplicates repeated capture, and converges exactly with the next native ledger evaluation.

### Entry publishes captured authority without premature domain evaluation

`sendUserMessage` emits the captured immutable acceptance snapshot before its first preparation await. The `requestPrepared` evaluation guard stays intact; capture does not run domain checks against incomplete preparation state. Getters, history handling and RunOutcome derivation are unchanged.

Existing-work declaration facts are captured **before** adding the new source. Otherwise a new-goal token `계속` would mistake its own newly unresolved source for pre-existing active work and skip the real declarer. The intermediate G00 run exposed this exact consequence (71 PASS / 2 declaration-trace failures). The correction preserves the frozen required two-declaration new-goal trace rather than weakening that expectation.

## Regression coverage and preserved contracts

- All 18 frozen entry cases pass: six entry variants x failed/live-cancelled/already-aborted. The accepted nine cases retain `goal: incomplete`, exact source IDs/spans/coverage, canonical required-row inventory, all result/recap/getter/harness/final-event projections, old-result and receipt immutability, zero proposals, and exact 1/0 applied-call ownership.
- Wiki and intent preparation failures now expose current new-goal rows synchronously. Each captured owner is archived once when the next genuine new-goal retires it; old snapshots, source scopes and evidence remain immutable.
- Added six public already-aborted empty/non-authoring controls and three ledger empty/non-authoring controls. Empty Do/new-goal can remain unassessed; explicit Ask retains the previous assessment and never creates an authoring row. There is no blanket incomplete fallback.
- Four added ledger cases cover immediate required-row capture, no prior-evidence reevaluation, frozen scope/span/evidence, duplicate capture and exact evaluation convergence, plus the three empty/non-authoring variants.
- Eight direct boundary assertions outside the frozen seven encoded the obsolete unassessed behavior: one queued entry, one already-aborted entry and six wiki preparation/cancellation/proof-retry cases. Their observed diffs were goal-only. Their expectations now agree with their actual nonempty uncovered source, with exact required-source assertions added. Every execution, native apply/save/proof, receipt identity, history and call-quantity assertion remains.
- Shared fixtures, current-question tests and all other production files remain unchanged. The current-question complete-file controls also pass.

## RED and GREEN evidence

- Reused RED: `../G01-source-entry-final.json`, `../entry-core-blocker-matrix.json`; the seven fixture hashes were checked before production edits and again at handoff.
- Added direct source/early-boundary RED before production edits: `R01-direct-source-capture` = 9 FAIL / 46 PASS, exit 1.
- First production diagnostic: `G00-direct-source-entry` = 71 PASS / 2 FAIL, exit 1; exact new-goal routing consequence described above.
- Initial G02/G09 runs after the core correction preserved the eight obsolete boundary expectations as raw failures before those direct tests were corrected. Their final complete files were then rerun. Earlier results were not overwritten or mixed into final pass totals.
- `accepted-red-to-green.json` maps every accepted original RED test ID to its passing native result. `observed-green-early-entry.json` retains the native early-entry assertion records. Repository Vitest uses `silent:true`; no unavailable raw console traces are invented.

### Final complete-file results

| Batch | Files | Tests passed | Failed/skipped/todo | Exit |
| --- | ---: | ---: | ---: | ---: |
| G01-source-entry | 5 | 36 | 0 | 0 |
| G02-native-early-ownership-final | 6 | 73 | 0 | 0 |
| G03-batch-house | 2 | 29 | 0 | 0 |
| G09-required-source-contracts-final | 6 | 112 | 0 | 0 |
| G10-current-question | 2 | 15 | 0 | 0 |
| **Total** | **21 distinct complete files** | **265** | **0** | **0** |

`complete-file-audit.json` verifies exact requested file membership, no duplicates, and every assertion passed. Tests use the existing wrapper, one fork (`minWorkers=1`, `maxWorkers=1`, no file parallelism), command-local `ulimit -c 0`, 8-GiB Node old space, bounded watchdogs and fresh JSON/log/exit files. No test sleeps, skips, deadline increases, fake success receipts, source erasure or private plan injection were added.

## Production gates and diagnostic attribution

- `npm run typecheck:app`: **PASS**, exit 0 (`typecheck-app.log`). There is no `editorToolHook` error in this production gate.
- `npm run build:app`: **PASS**, exit 0 (`build-app.log`), with the existing Vite large-chunk warning retained. No warning threshold or build configuration was changed.
- Final changed-file LSP: all **14 TypeScript files** return `No diagnostics found`; exact tool outputs and file hashes are in `lsp-diagnostics.json`. Markdown has no configured LSP server; that limitation is recorded, not counted as a successful Markdown diagnostic check. `git diff --check` passes.
- Full `npm run typecheck`: **FAIL**, exit 2, **850 diagnostics** before the core correction and at handoff. The file/code/message multiset is identical: **zero core-introduced diagnostics**. This is not the app production gate.

The five diagnostics introduced by the earlier P1 fixture work remain owned by this increment; the user-directed seven-file freeze is preserved:

| P1-owned test location | Diagnostic |
| --- | --- |
| `aiOutcomeEntryOwnership.test.ts:52` | TS2550: `Promise.withResolvers` absent from the root ES2022 library |
| `aiOutcomeEntryOwnership.test.ts:53` | TS2550: same API on the rejected transport deferred |
| `aiOutcomeEntryOwnership.test.ts:63` | TS2322: resulting `any` is not assignable to `never` |
| `aiOutcomeEntryOwnership.test.ts:134` | TS18048: `snapshot.requests` is possibly undefined |
| `assistantBatchCompletion.test.ts:186` | TS2532: optional harness requests are possibly undefined |

Of the other 845 diagnostics, 844 occur in files verified byte-identical to HEAD. The remaining `runOutcomeApplyFixture.test.ts:44` TS2550 belongs to the identical pre-existing writer-body control (`const reading = Promise.withResolvers<void>();`) in HEAD, not the P1 addition. `typecheck-attribution.json` retains every diagnostic, ownership and comparison evidence. No test/type error was suppressed or relabeled as a passing full typecheck, and no unrelated type cleanup was attempted.

The app gates ran on the exact final production/doc bytes in `core-freeze.sha256`. Only three direct test files changed afterward; final complete-file runs validate those changes. App build/typecheck evidence is therefore not being reused across a production change.

## Cleanup and final ownership

`cleanup.json` records zero node/bun processes with integration cwd after validation. All test commands settled or were reaped; owned fixture sends/transports and native writer drainage remain in the frozen P1 tests. No unowned live session/worker remains. `status.handoff`, `head.handoff`, the patches and hash manifests identify the exact source freeze. No unresolved C2/C3 source/entry blocker remains; the separately attributed full test/ambient type diagnostics are not concealed by that GREEN result.
