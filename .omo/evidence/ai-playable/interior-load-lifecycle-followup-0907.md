# Narrow store lifecycle follow-up

Parent commit: `3c4377d1830510e2a9e6c2e385bbbc70d26b582e` (not amended).
Worktree: `/home/main/z-project/rpg-zzu-ai-interior-load-consistency-0907`.
The original interior-load receipt and archived Round8 evidence are unchanged.

## Reproduced seams and bounded fixes

1. `normalizeCurrentProject` awaited the real faceset repair of an object that
   could become detached, then marked the current project mutated. A full switch
   and an ordinary immutable edit both reproduce this: save the replacement while
   the original image-load signal is held, release the signal, and the replacement
   becomes dirty again despite unchanged content. Its accepted receipt loses
   currentness. The guard captures the repair object and lineage, checks both after
   the await, and rechecks ownership before scheduling after synchronous emit.
2. Publishing `saving` invokes synchronous status subscribers. A subscriber can
   replace the project before `persistCurrent` captures its snapshot. The old flush
   then issues one unauthorized replacement write; when the subscriber also starts
   its own flush, two replacement writes occur. The old request now rechecks lineage
   after publication and returns the existing non-success `disabled` variant before
   persistence/flight registration. Remote persistence itself stays enabled, and
   the replacement's pending state or own save/receipt remains authoritative.

No serialization, hashing, receipt/proof contract, faceset implementation, or other
lifecycle refactor changed. Same-lineage callback edits still enter the submitted
snapshot. A repair whose target stays current still becomes dirty and persists.
Detached repair output is not merged over newer edits; any pending marker on the
new object remains available for a later normal load repair.

## Deterministic evidence

Local logs: `output/evidence/interior-load-lifecycle-followup/`.

- `red.log`: **4 failed / 1 passed** on the parent implementation before the guard.
  Both faceset races observed `dirty:true` instead of false. Subscriber replacement
  observed **1 write instead of 0**, and nested own-flush observed **2 instead of 1**.
- `test/storeLifecycleReentrancy.test.ts`: **6/6 pass** finally. Tests use the real
  `repairUploadedFacesetSheets`, a controlled image-load event, real marker cleanup,
  real store load/reload/replace/update/flush, and serialized detached save responses.
  They also assert replacement receipt currentness, no new autosave notification,
  no extra clean-flush write, and successful later explicit replacement persistence.
- Subscribers/signals are installed before actions. Native bounded deadlines are
  failure bounds, not sleeps; unrelated autosave timers are frozen. Held requests
  are released and awaited in finally blocks. No polling or test-timeout changes.

Final focused command:

```sh
npm test -- test/storeLifecycleReentrancy.test.ts \
  test/interiorLoadConsistency.test.ts test/storePersistenceProof.test.ts \
  test/storePersistenceLineage.test.ts test/storeFlushShaEvidence.test.ts \
  test/storeMutationInstrumentation.test.ts test/facesetUploadedSheetMigration.test.ts \
  --maxWorkers=2
```

- `focused.log`: **78/78 tests, 7/7 files, exit 0**. Prior interior regressions
  30/30, proof 18/18, lineage 8/8, SHA 2/2, instrumentation 8/8, faceset migration
  6/6, and new lifecycle cases 6/6.
- LSP: no diagnostics on changed source/test files.
- `typecheck.log`: `npm run typecheck:app`, **exit 0**.
- `typecheck-all.log`: broad non-gating `npm run typecheck`, **exit 2**, the same
  prior count of 847 diagnostics; **zero** in the new lifecycle test file.
- `build.log`: full `npm run build`, **exit 0**. Editor, player/SDK, standalone
  all built; existing chunk/import and unresolved runtime-image warnings remain.
- `git diff --cached --check`: **exit 0** before commit.

All follow-up test/build execution was network-isolated using `bwrap --unshare-net`
and a blank env bound over this worktree's `.env.local`. Full build output and its
temporary directory were RAM-backed because root disk was nearly full. No live DB,
UI, model, game-content, currency, parent-tree or review-tree work was performed.
No push, remote merge or amended commit is part of this follow-up.
