# Explicit cross-lineage flush ordering follow-up

Task: `st_01a07921`, separate follow-up requested by the parent.
Parent commit: `aeac163668af6f0ac8393e1ac2fea074fc21eb3b` (P2 deferred callbacks).
Branch: `agent/ai-deferred-lineage-p2-0907`.
Worktree: `/home/main/z-project/rpg-zzu-ai-interior-load-consistency-0907`.

This repairs the demonstrated current ordering defect; its presence on `9a0`
does not exempt it. No historical comparison is used to excuse the defect.
The prior commit, its evidence, and the old worktree branch/history are preserved.
This follow-up supersedes the unsafe-overlap limit in the previous evidence;
it does not rewrite that historical receipt or amend its commit.

## Bounded source change

`saveCurrentWithAutoSaveState` captures the requesting lineage before waiting.
If an older lineage owns `persistInFlight`, the explicit replacement request
awaits that existing promise's settlement. It then rejects obsolete ownership
with `disabled`, or re-enters the existing save path under its own lineage.

- A's completion alone never starts a B save.
- Two queued B callers enter the normal same-lineage coalescing path, not two
  parallel transports. Same-lineage edit catch-up remains unchanged.
- B replaced by C while queued cannot save either B or C. C can request its own
  flush and wait for the same older transport.
- A failure still rejects the original A promise and same-lineage A waiters.
  B observes/logs that older failure as a settlement barrier, then performs its
  independently authorized save; no error is converted into a successful A save.
- No new lock, server behavior, retry loop, duration, timer, or persistence API
  was introduced. Receipt/dirty guards and the P2 timer ownership checks are intact.

## Red-first and fixture compatibility

All executable verification in this follow-up used `unshare -Urn` (OS network
isolation), local intercepted persistence transports, and registered event gates.
No sleeps, polling, or deadline changes were added.

1. Before source edits:
   `unshare -Urn npm test -- test/storeSaveOrdering.test.ts --maxWorkers=2`
   **6 failed, 2 passed**, exit 1 (`red.log`). The real full-save entry is already
   invoked for B while A's PATCH remains held. This is observed synchronously
   before hashing/network timing can hide the premature submission. No-B
   authorization and same-lineage catch-up are passing controls.
2. After the source change, the same command passes **8/8**, exit 0
   (`green-focused.log`). The three missing/cleared/authored audio states all
   require accepted `[A, B]`, remote/local B agreement, exact descriptions,
   zero rejected CAS attempts, one coalesced B write, and correct receipt lineage.
3. The first related run (`regressions.log`) reported **4 failed, 140 passed**:
   three `storePersistenceLineage.test.ts` cases timed out because they awaited
   B's flush before releasing A; a following reload identity case also failed in
   that timed-out run. These are retained failures, not a claimed green run.
4. The three receipt fixtures were updated to request B while A is held, hold B's
   own PATCH, release A, and verify A's historical proof before allowing B to
   commit. All original receipt/proof/dirty/current-identity assertions remain,
   with additional remote-B and adopted-baseline checks. No timeout was raised.
   All **8 lineage tests pass** (`green-lineage.log`), including the reload
   identity case without changing that case. The original audio test file and
   all its assertions are unchanged by this follow-up.

## Final verification

The complete targeted command is recorded at the top of `green-regressions.log`:

```
unshare -Urn npm test -- test/storeSaveOrdering.test.ts test/storeDeferredLineage.test.ts test/storeLifecycleReentrancy.test.ts test/storePersistenceLineage.test.ts test/storePersistenceProof.test.ts test/storeFlushShaEvidence.test.ts test/interiorLoadConsistency.test.ts test/audioDescriptionConcurrentPersistence.test.ts test/audioDescriptionPersistence.test.ts --maxWorkers=2
```

Result: **9 files, 144 tests passed**, exit 0, one final combined execution.
This includes all 13 P2 deferred-callback tests, detached faceset and saving
subscriber guards, accepted-receipt proof/lineage, interior migration/failure/
catch-up, and all original concurrent audio assertions.

- `unshare -Urn npm run typecheck:app`: exit 0 (`typecheck-app.log`).
- `unshare -Urn npm run build:app`: exit 0 (`build-app.log`). Existing optional
  proxy-key notices, circular record-picker chunk re-export, mixed static/dynamic
  imports, and large-chunk warnings remain; no build configuration was changed.
- LSP: no diagnostics for `src/project/store.ts`, `test/storeSaveOrdering.test.ts`,
  `test/storePersistenceLineage.test.ts`, and the new executable store replay.
  No Markdown LSP server is configured; no Markdown-LSP pass is claimed.
- `unshare -Urn bun .omo/evidence/explicit-flush-ordering/store-replay.ts`: exit 0
  (`store-replay.log`). B requests its flush while A is held, does not enter saving
  before A is released, and finishes with accepted `[PROJECT_A, PROJECT_B]`, local
  and remote `PROJECT_B` / `PROJECT_B_MAP`, exact B descriptions, zero rejected
  CAS attempts, dirty false, A receipt noncurrent and B receipt current.
- `git diff --check` passed. Committed logs only trim trailing whitespace and blank
  EOF lines; untrimmed copies are preserved in `/tmp/st_01a07921-ordering-raw-logs`.

## Limits and unchanged receipts

This is in-store promise ordering for explicit/deferred store flushes, not a
cross-client database lock. Direct transport consumers, transactional new-project
creation, network partition behavior, and independent clients were not changed
or newly certified. No transport cancellation or automatic retry was added.

No live DB, browser/UI, model, game, NPC proof module, credential configuration,
or frozen parent/review source was edited. No whole gates, player/standalone build,
live game acceptance, push, PR, or remote merge is claimed. The prior receipt's
five baseline legacy persistence test failures are not reclassified or repaired
here. Round8 remains failed and fresh AI-game acceptance remains OPEN.
