# Task3 AdversarialVerify - implemented foundation re-verification

## Verdict: confirmed

- Status: **confirmed**; acceptance verdict **0**; mandatory fixes / blockers **0**.
- Verified commit: `f72853167278d2865a95b8600200313eb8ee08b0`.
- Verified tree: `39dfe3490828aeb7e6e1569c99a786005e8d3889`.
- Immediate parent / initial implementation: `5388715a6d560d8329e6375d752ab55e93f928bd`.
- Task2 ancestor: `f1024a2202ab6205591af630aeb53b0bc3445669`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Verifier task: `st_01a073f1`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Date: 2026-09-06, workstation local date.

This is unconditional approval of **task3's types, bounded schema and pure ownership transactions**, not approval of task4 persistence/reconciliation, later UI/clock/spatial wiring, or final shipping. It supersedes the old needs-fix artifact at `5c528ca3`, which correctly reported the then-absent implementation. Its three blockers are now resolved: task2 is confirmed on the actual ancestor; task3 implementation exists; both required test files and the real public probe execute successfully. Task3 no longer blocks beginning task4 under the plan's ancestor gate.

## Review boundary and provenance

Read the complete current plan `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, including Scope, the legacy cancellation clarification, task3 and subsequent ownership boundaries. Read producer SUMMARY, previous task3 VERIFY, task2 VERIFY, all task3 product/test diffs from `f1024a22`, the immediate-parent correction diff, both complete test files, the public probe, and the actual inventory/time/save helpers these call. CLAUDE.md was ignored.

Task2 VERIFY states confirmed, verdict0, blockers0 at `f1024a22`; `git merge-base --is-ancestor f1024a2202ab6205591af630aeb53b0bc3445669 HEAD` independently exited0. Commit ancestry is linear: f1024a22 -> 5388715a -> f7285316. The correction changes the unfinished legacy input expression and adds its regression/probe/wiki/evidence; it does not replace the initial implementation. The existing `test/p0Makers.test.ts` diff from task2 is empty.

## Contract-by-contract evidence

All test references below are in `test/lifeRecovery.test.ts` unless qualified. These are inspected assertions executed in the fresh 62-test run, not producer descriptions accepted as results.

| Obligation | Actual code and executable evidence |
| --- | --- |
| Session/claim shape | `session.ts:149-185,253` defines optional `{nextSequence,claims}`, claim id/sourceKind/sourceId/reason/items and optional unresolved JSON/detail, frozen maker contract, and spatial receipt types. `lifeRecovery.ts:77-89` validates the recovery shape; `saveSlotValidation.ts:1` exposes the same predicate. Tests: 58-60, 213-258. |
| Deterministic safe sequence and distinct identity | `lifeRecovery.ts:77-84,154-169,174-188` enforces canonical recovery:N keys, positive safe sequences greater than every retained ID, matching claim IDs and no rewind on receipt. No random/time ID generation. Tests: 72-101,184-190,219-234 exercise repeated source/claim refusal, new sequence after receipt, exhaustion, mismatched/duplicate claim IDs and source-kind distinction for identical source IDs. |
| 4096 claims, 64 distinct items, safe bounded quantities | Constants at `lifeRecovery.ts:6-9`; per-claim validation at 66-89; positive-safe aggregation and capped splitting at 125-163. Tests: 136-181,213-234 verify 4096 accepted/4097 rejected, 64 accepted/65 stored rejected, 65-source items split64+1, quantity 2*ITEM_QUANTITY_MAX+3 split without loss, fractional/negative/zero/nonfinite/unsafe counts rejected. Entire source/session/sequence remains equal on failed conversion. |
| Exact UTF-8 64 KiB raw and 8 MiB total limits | `lifeRecovery.ts:30-64,86-89,137,163` measures JSON encoding using TextEncoder, validates serializable evidence and rejects oversized candidates before commit. Tests: 236-258 accept exactly65536 bytes with multibyte text and exactly8388608 total bytes, reject one extra byte, and preserve input. Tests 360-376 assert whole-session equality after oversized source/total conversion failure. No trimming or prefix acceptance. |
| Real source ownership and atomic move | `lifeRecovery.ts:93-124` reads a named own property in the actual session source, not caller-provided payable amounts; 154-170 commits deletion plus claims only after complete candidate validation on a cloned session. Tests: 72-101,144-190,202-208; public probe spends3 in actual startMaker, cancels to claim3 and observes no inventory refund until receipt. |
| Atomic receipt and no duplicate payout | `lifeRecovery.ts:174-188` validates all claims, clones session, invokes actual `changeItemsAtomically`, and commits payout plus claim removal together. `session.ts:594-620` validates evolving inventory and collection metadata before item-state changes. Tests: 72-90,103-118,378-383 assert whole-session rollback on overflow/malformed metadata/state and no second payout. Public probe repeats overflow and duplicate receipt refusal. |
| Unknown/unproven evidence preserved, no automatic payout | `lifeRecovery.ts:100,115-137,158-159,180-183` retains original JSON with unpayable empty/unknown items as appropriate. Tests: 121-133 explicitly restore an item definition and prove no state change until explicit receipt; 175-181 retain unknown multi-item source; 273-295 preserve legacy original jobs with no guessed inputs; 349-358 preserve old spatial originals without refund. Unknown IDs are not filtered out of the boundary predicate. |
| Completed bundle receipts remain owners, not refunds | `lifeRecovery.ts:106-109` refuses completed or reward-applied bundles before removal; test193-199 exercises reward-applied tombstone refusal with whole-session equality. Full saved tombstone/donation-excess reconciliation belongs to task4. |
| New maker promise is actual spent input plus copied outputs/duration/time basis | `makers.ts:62-114` validates input/definition/deadline, successfully consumes inputs through the real inventory API, then copies input/output amounts and resolved clock values. `makers.ts:133-160` uses contract outputs rather than edited definitions. Tests: 24-41,297-331 prove detached arrays, duration/timeBasis contents, original payout2 instead of edited9, next-job new definition, and preserved ready contract on overflow/missing output definition. |
| Legacy makers still function; cancellation never invents past inputs | Normal legacy payout stays current-definition at `makers.ts:139-143`; tests43-49 and all8 unchanged P0 maker cases pass. `lifeRecovery.ts:114-120` rejects malformed new evidence and uses frozen unfinished inputs only; legacy unfinished jobs use empty payable items even with current inputs7. Tests264-295,337-344 prove cutoff39 inputs3 / cutoff40 outputs2, deleted definition handling, malformed-contract refusal, and legacy raw preservation/refused receipt. Immediate parent had the input-inference bug; f7285316 fixes it, and the correction is independently exercised. |
| Maker boundary and actual resume | `makers.ts:195-213` validates contract amounts/duration/clock; `saveSlotValidation.ts:175-185` checks optional contract and exact deadline consistency. Test51-56 rejects invalid input count, tests297-310 preserve compatible contract through actual create/apply, and the probe additionally writes/reads a real Storage Save5 slot before apply/advance/collect. |
| Spatial receipt types only; no speculative framework | `session.ts:168-177,256-257` adds optional paymentReceipt `{gold,items}` and decoration recoveryItem to runtime placement types, without adding them to authored or legacy placements. Payment capture/refund transactions remain later. The new module is a bounded validator and two domain transactions, not a general event-sourcing layer; no renderer/save side-effect payout was added. |

### Explicit boundary: task4 is not already implemented

The inspected current `saveSlots.ts` does **not** yet persist recovery claims or invoke their predicate during slot parsing. Its existing maker restore filter at1111-1126 remains lossy for removed definitions; writer/parser/apply reconciliation and complete recovery-load refusal with old-slot preservation are task4's assigned work. Task3 supplies the exact reject-without-trimming primitive, not that wiring. The probe's malformed JSON Storage assertion validates the exported predicate and unchanged raw input; it is not misrepresented here as recovery Save5 roundtrip. Full duplicate raw JSON key handling, unknown-content load preservation, partial donation excess, tombstone persistence and time-basis cancellation orchestration must be evaluated through task4's real codec surface. These are explicit task boundaries, not waived task3 failures or conditional approval.

## Fresh independent execution

Commands ran in the target worktree against f7285316. No unrelated full suite/build/gates was launched.

```sh
npm test -- test/lifeRecovery.test.ts test/p0Makers.test.ts
node .omo/evidence/life-full-20260906/3/public-probe.mjs
git diff --check
```

- Required test command: **exit0, 2 files / 62 tests passed, 0 failed, 0 skipped** in one run. Recovery54 + P0 makers8. Start08:40:53; duration26.34s; Vitest3.2.4. Both files actually ran; a successful filter omitting the new file was not accepted.
- Public probe: **actual child exit0**. Executed once via Python subprocess capture, parsed all four JSON output records, and asserted expected measured fields. Reviewed executable assertions before execution. It imports real Vite SSR session/makers/recovery/save/validation modules and uses happy-dom Storage; none of those target integrations is mocked. Fixture inventory is input to a module test, not proof of gameplay-earned resources. No browser result injection or player.html success claim.
- Fresh all-severity LSP diagnostics: **No diagnostics found** for each of `src/project/session.ts`, `src/project/makers.ts`, `src/project/lifeRecovery.ts`, `src/player/saveSlotValidation.ts`, `test/lifeRecovery.test.ts`.
- `git diff --check`: exit0.

Parsed public observations (backed by assert calls on real state):

```json
{"frozenPromise":2,"editedPromise":9,"resumedPayout":2,"liveJobUnchanged":true}
{"inputSpent":3,"canceledInputs":3,"paidOnce":3,"overflowUnchanged":true,"unknownPreserved":true,"nextSequence":3,"malformedRawUnchanged":true}
{"legacyEditedInputs":7,"inferredRefund":0,"originalPreserved":true,"receiptRejected":true}
{"teardown":"storage cleared, window and middleware-only Vite server closed","httpListener":false,"remoteWrites":0}
```

## RED/GREEN chronology and adversarial integrity

Parsed actual log test/failure/start/exit fields; correction raw-output SHA256 and exact file bytes match all six entries in `legacy-input-receipts.json`.

| Historical receipt | Parsed start, outcome and meaning |
| --- | --- |
| red.log | 07:58:13; exit1; 4 failed/9 passed. Failures identify missing new contract, changed-definition payout, malformed contract accepted, and missing recovery validator. Not a missing-module RED. |
| initial-green.log | 08:04:47; exit0; 54 passed. Intermediate coverage only. |
| adversarial-red.log | 08:06:20; exit1; 2 failed/58 passed. Malformed opposite-side maker evidence and large JSON-array stack overflow. |
| json-red.log | 08:08:02; exit1; 1 failed/60 passed. Shared serializable object incorrectly rejected. |
| green.log | 08:10:37; exit0; 61 passed. Initial implementation GREEN. |
| legacy-input-red.log | 08:32:04; exit1; 1 failed/61 passed. Assertion diff receives payable raw7 instead of empty items plus original unresolved job. |
| legacy-input-green.log | 08:33:15; exit0; 62 passed. Same required command with the new regression retained. |

Commit times corroborate sequence: initial implementation08:30:52, correction08:39:32. Historical RED is retained log evidence, not a pre-edit run witnessed by this verifier or a separately committed RED tree. Fresh current GREEN/probe above are independently witnessed. The current correction diff keeps the failed assertion and changes production selection, rather than weakening the expected refund policy. No existing maker test was edited, skipped or deleted. Both inspected test files and the probe are synchronous/deterministic for the asserted behavior, with explicit game-minute inputs rather than fixed sleeps, polling or timing-luck retries. No prose-pinning assertion substitutes for behavior.

Adversarial coverage includes stale removed source/consumed claim, same-ID distinct owners, sequence exhaustion, multi-claim capacity rollback, invalid quantities and JSON, Unicode byte boundaries, malformed metadata rollback, unknown definitions, changed maker promises, deleted makers and legacy unproven input cancellation. Build/typecheck/related-suite receipts in producer SUMMARY were not independently rerun or substituted for this bounded current verification.

## Hygiene and final decision

`git status --short` was empty at entry and after fresh tests/probe; HEAD remained f7285316. VERIFY.md is ignored/untracked, so a clean status is not used as proof that this evidence artifact does not exist. This verifier modifies only this VERIFY.md through `/tmp/apply_patch`, the inspected GNU patch wrapper. No product/test edits, commit, dependency installation, PR, merge or remote write. The probe's finally block cleared its Storage and closed happy-dom and middleware-only Vite; its process exited. No HTTP listener/browser was opened by this verifier.

**Final decision: confirmed, acceptance0, mandatory fixes0 for task3 on f72853167278d2865a95b8600200313eb8ee08b0.** The stale missing-implementation refusal is superseded by actual code/test/surface evidence, not producer status. Later tasks and full-project completion retain their own verification gates.
