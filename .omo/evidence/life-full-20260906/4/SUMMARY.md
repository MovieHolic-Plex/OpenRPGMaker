# Task4: lossless life snapshot reconciliation

Task4 is implemented and verified in `agent/life-full-p2`. This replaces the stale blocked producer SUMMARY. It does **not** replace the independent task4 VERIFY at old HEAD `5c528ca3`; the parent must obtain fresh task4 verification before task5 starts.

## Identity, gate and immutable provenance

- Task: `st_01a073f5`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Evidence: `/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/4/`.
- Base/verified predecessor: `f72853167278d2865a95b8600200313eb8ee08b0`.
- Base tree: `39dfe3490828aeb7e6e1569c99a786005e8d3889`.
- Verified code/tests/wiki tree before task4 evidence staging: `1562a67cf2450fc2b8517e4e7ed1d326285b68f1`.
- Atomic commit subject: `fix(save): retain life assets across content changes`.
- This SUMMARY is included in the same atomic implementation commit. Resolve its immutable introduction with `git log --diff-filter=A --format=%H -- src/project/lifeStateReconciliation.ts`; this avoids a circular self-hash in the committed file. The final parent report supplies the actual resulting commit hash.
- **Before any edit**, read task3 VERIFY: confirmed, acceptance0, blockers0 at the exact base above. HEAD matched and `git merge-base --is-ancestor f72853167278d2865a95b8600200313eb8ee08b0 HEAD` exited0, again checked before staging evidence.
- Initial `git status --short` was empty. Branch has no upstream configured; no remote/history rewrite was attempted.
- Read full approved Scope/task4, task3 SUMMARY/VERIFY, stale task4 SUMMARY/VERIFY, AGENTS, quickstart, focused runtime wiki, programming/TypeScript, debugging and git-master guidance. All CLAUDE.md files were ignored. No parent plan/Boulder/WISH or other-task product source was edited.

## Actual implementation

| Paths | Change |
| --- | --- |
| `src/project/lifeStateReconciliation.ts` | Task4-specific parser and pure reconciliation, typed failure carrying source kind/ID, bounded unproven-record quarantine. Extracted the new reconciliation unit rather than growing the task3 transaction module past its responsibility. |
| `src/project/lifeRecovery.ts` | Re-exports the reconciliation API; lets reconciliation explicitly preserve an unproven source with no payable items. Existing atomic source/claim and claim/inventory transactions remain the payout authority. |
| `src/player/saveSlots.ts` | Persists recovery across all codec boundaries; preserves originals before lossy filters; keeps completion/reward tombstones and unlock IDs; reconciles before writer/apply completion; refuses ambiguous duplicate raw JSON keys. |
| `src/player/autosave.ts` | Typed reconciliation failure warns and returns null before a write. Save-access/map/cutscene/debounce policy is unchanged. Unrelated construction exceptions still propagate, retaining the existing characterization. |
| `src/player/dayTransition.ts` | Runs recovery on the whole-day draft before shipping; failure includes recovery stage/source kind/ID. Later stage failure discards reconciliation along with calendar, inventory and receipts. |
| `src/project/p1FoundationRecords.ts` | Explicit saved emptiness is authoritative; removed assets do not resurrect from authored starts, and saved known-species identity is not silently replaced after definition edits. Existing legacy-home fallback remains. |
| `src/project/spatialPlacementRestore.ts` | Adds persistent farm plots to restoration occupancy checks. Existing persistent placeables/chests and spatial footprints still participate; temporary player overlap does not remove a saved asset. |
| `test/lifeRecoveryPersistence.test.ts` | 35 deterministic writer/parser/apply/day/Storage boundary tests. |
| Six existing persistence/day/scene test files | Update explicitly superseded deletion/stale-content contracts with preserved-owner assertions; retain all existing tests and strengthen malformed failure coverage. Correct directly encountered test fixture type errors without changing product behavior. |
| `openwiki/runtime-sessions.md`, `runtime-project-schema.md`, generated `INDEX.md` | Document the actual persistence/cancellation/failure boundary and downstream limits. |

### Ownership and restoration contracts proven

- The writer works on a cloned draft, never the live session. It restores persistent occupancy before spatial reconciliation, then animals, then shipping/bundle/maker reconciliation. Apply validates separately and returns a new session only after reconciliation succeeds. No rendering or saving pays a claim.
- Contribution5 against changed requirement2 yields **progress2 + claim3**, not zero or refund5. Re-reading/re-saving the reconciled state twice preserves the same claim/sequence. Explicit collection transfers3 exactly once; a later snapshot retains the consumed claim's advanced sequence without recreating it.
- Completed and reward-applied bundle IDs are unioned tombstones and survive definition deletion. Their contributions are not refunded. Region/recipe IDs remain dormant rights. The public probe completes an actual bundle, earns gold9, removes definitions, reloads and restores them, then proves a repeated contribution cannot reward again.
- Disabled, deleted or ineligible shipping moves its exact quantities into recovery before filtering. Unknown item IDs preserve unresolved source evidence, reject receipt while missing, do not auto-pay when restored, and require explicit later collection.
- Removed/changed-clock frozen makers cancel using the saved date in their **original** clock: minute29 refunds only spent inputs3; minute30 preserves outputs2. Unproven legacy jobs retain original JSON with no guessed input refund. Compatible jobs retain contracts and synchronize ready status on apply; snapshot construction alone does not advance them.
- Unknown legacy shipping/maker/animal/placement shapes become empty-item unresolved claims containing their original JSON. Invalid new maker evidence is rejected rather than treated as legacy. Removed species, rejected spatial placements and stale/unknown-item placeables retain originals, with no guessed payouts.
- Saved animals above the existing500 runtime bound retain the suffix as unresolved claims; a501-animal regression proves exactly500 active plus the preserved501st owner and no reissue on reload.
- Valid spatial payment receipts survive writer/read/apply. Existing legacy home fallback and omitted optional states remain compatible; explicitly empty saved collections do not resurrect authored placements or animals.
- Both disk readers reject duplicate raw JSON object keys before last-key-wins semantics can erase ownership. Claim4097, item65, unsafe sequence, invalid counts, raw64KiB overflow and total8MiB overflow refuse the load without changing raw disk bytes. Capacity failure after a tentative first conversion rolls back the entire source/sequence draft, not a prefix.
- Source-to-claim and claim-to-inventory use the task3 atomic transactions. Quota failure after successful collection preserves the **current successful in-memory action** and the **prior disk slot** independently; it does not resurrect a consumed claim. Failed checkpoint construction also retains the prior checkpoint.
- Recovery failure prevents any day commit and includes the failed source ID. A later energy failure rolls back already prepared recovery claims; existing animal-overflow, forage and hook/scene rollback coverage also passes.

**Boundaries:** no full linked housing, animalHousing/housingPlacementId authoring or spatial payment capture/payout is preimplemented. Spatial receipts are preserved; old assets without payment evidence remain unpayable. No natural-minute/command/setTime clock wiring from task9 is added; only the scoped restore-time synchronization uses the existing maker authority. No new package, generalized event framework, UI/ledger implementation, database write or player.html journey is claimed.

## RED/GREEN and command evidence

`commands.json` contains exact commands, exits, durations and base/tree. Every result below is an actual subprocess exit, not a pipe's tail. Final executions use GNU timeout with TERM/10-second kill grace; no monitor tool was available. `raw-output.json` preserves exact captured subprocess text plus UTF-8 length/SHA256 (text-mode universal-newline decoding). Readable logs trim trailing whitespace only.

| Receipt | Observed result and meaning |
| --- | --- |
| `red.log` | Initial test harness error: 11 failed/35 passed, exit1; Storage was not installed in the node test environment. **Not accepted as the behavioral RED.** Fixed only the fixture by constructing real happy-dom Storage before any production edit. |
| `seam-red.log` | Required six-file command before production changes: **10 failed/36 passed**, exit1. Correct failures: contribution disappears, tombstones vanish, shipping/maker recovery absent, invalid recovery accepted, autosave falsely succeeds, day commits. Compatible legacy characterization and all35 existing tests pass. |
| `initial-green.log` | Intermediate **failed** integration, exit1: 7 failed/39 passed. Filename is not a success claim. Old deletion/clock expectations and an unintended unrelated direct-apply normalization were exposed; fixed the latter and updated only the explicitly superseded ownership expectations. |
| `adversarial-red.log` | 1 failed/60 passed, exit1: duplicate raw claim key read as present. The same assertion passes after duplicate-key refusal. |
| `placeable-red.log` | 1 failed/27 passed, exit1: missing explicit item definition was stripped while the legacy object survived without its original. The fix quarantines the original instead. |
| `animal-bound-red.log` | 1 failed/34 passed, exit1: the501st saved animal disappeared without a recovery owner. The retained assertion now proves its unresolved original. |
| `related.log` | First related run: 2 failed/151 passed, exit1. Scene failure fixtures used recoverable stale content; replaced with malformed quantity while retaining complete rollback/preflight assertions. No tests were removed or skipped. |
| `diagnostics-initial.log` | Actual TypeScript language service found12 test diagnostics after LSP initially reported none. Four newly introduced fixture/access diagnostics and eight existing fixture type errors were corrected in the directly affected tests. Final language-service evidence, not the initial LSP response, is authoritative. |
| `final-green.log` | **6 files /70 passed /0 failed /0 skipped**, one final execution, exit0. All six named files exist and actually executed, including35 task4 tests. |
| `final-related.log` | **13 files /153 passed /0 failed /0 skipped**, one final execution, exit0. |
| `diagnostics-final.log` | Syntactic+semantic TypeScript language-service diagnostics across **all14 changed TS files:0**, exit0. |
| `typecheck.log` | `npm run typecheck:app`, after diagnostics, exit0. |
| `build.log` | `npm run build` completes app + player/SDK + standalone in137.39s, exit0 within900s bound. Runtime-resolved asset URLs, mixed static/dynamic import and large-chunk warnings remain visible; none suppressed. |
| `final-public.log`, `roundtrip.json` | Real Vite SSR public imports + real happy-dom Storage: all asserted happy/failure scenarios complete, exit0. Exact extracted observations below. |
| Session tool receipts | `npm run openwiki:index -- --check`, `npm run openwiki:verify`, `git diff --check`, staged diff check: exit0. |

Exact required command (no substitutions):

```sh
npm test -- test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p1SessionPersistence.test.ts test/p2SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/p0RuntimeIntegration.test.ts
```

Exact related command:

```sh
npm test -- test/lifeRecovery.test.ts test/lifeSaveVersion.test.ts test/autosave.test.ts test/p0Makers.test.ts test/p0Shipping.test.ts test/p0Bundles.test.ts test/p1FarmAnimals.test.ts test/p1DayTransitionIntegration.test.ts test/p1WeatherDayTransition.test.ts test/p2DayTransition.test.ts test/p0DayTransitionSceneFailure.test.ts test/p2SpatialTransactions.test.ts test/checkpointEndingRuntime.test.ts
```

Other exact final commands:

```sh
node .omo/evidence/life-full-20260906/4/diagnostics.mjs
npm run typecheck:app
npm run build
node .omo/evidence/life-full-20260906/4/public-probe.mjs
npm run openwiki:index -- --check
npm run openwiki:verify
git diff --check
```

The initial broad guidance discovery reached a20-second timeout; subsequent bounded targeted lookup found and read the installed skills. A wiki-index patch initially failed because an in-memory stdout generator exited before draining its pipe; synchronous fd1 output fixed generation, and the official index check passes. Neither failure is presented as successful verification. The first evidence-staging diff check also reported extra blank EOF lines in captured logs (exit2); readable logs now trim that terminal whitespace, while raw-output.json retains the exact captured text. No product/config change absorbed a timeout.

## Actual public surface observations

The executable probe imports real save/session/bundle/shipping/maker/recovery/autosave/day/checkpoint modules; none is replaced by a success stub. It uses fixture starting inventory as input, then spends it through actual `contributeBundle`, `depositShipping` and `startMaker`. This is exact public-module persistence evidence, **not player.html gameplay evidence**.

- Real partial donation spends5 from inventory10; reconciliation leaves inventory5/progress2/claim3. Two reloads do not reissue. Receipt leaves inventory8/progress2, conserved total10, and duplicate payout false.
- Real completed bundle earns gold9; completion/reward tombstone and2 dormant rights survive deleted definitions. Reintroduction cannot reward twice.
- Changed-start maker cancellation at original minute29 yields raw3; minute30 yields product2. Subsequent roundtrip reissues neither.
- Malformed recovery returns autosave null, preserves prior autosave/current live/prior checkpoint, refuses direct apply, reports corrupt reader and preserves raw input bytes. Day failure stage is recovery.
- Later energy failure rolls back the entire day, including recovery; quota failure after an explicit successful claim retains the current inventory3 and old disk slot.
- Finally clears Storage and closes happy-dom and middleware-only Vite. No HTTP listener was opened. `roundtrip.json` is extracted from the actual final probe output, not hand-authored success fields.

## Adversarial integrity and teardown

- **cancel/resume:** actual maker source consumption, original-clock boundary29/30, saved partial donation/claims and twice-read conservation; legacy unknown job preservation.
- **malformed:** invalid source quantities, new contract boundaries, duplicate raw keys, all recovery limits, unknown legacy shapes; load/raw bytes and failed draft ownership preserved.
- **stale:** removed definitions, retained completion/unlock rights, missing item returning without autopay, consumed claim retry, source sequence and explicit saved emptiness, bounded animal suffix.
- **flaky:** seeded fixtures and explicit game minutes. No new fixed sleeps/polling. The read scene failure test's existing `vi.waitFor` was replaced with an exact overlay signal subscribed before the action and a bounded failure timeout; the listener is scene-local and timeout cleared.
- **dirty:** clean entry and explicit scoped staging. Parent plan/Boulder, stale independent VERIFY, dependencies and full51 coverage are untouched. The new reconciliation file is a174-line task4 implementation unit, not an unrelated module/framework.
- **misleading output:** unsuccessful harness/RED/intermediate runs retained separately; exact six-file and13-file counts parsed from actual execution. LSP's initial empty report did not override real language-service failures. Module probe is never described as browser/player success.

Public probe resources close in finally; all recorded test/compiler/build/probe processes exited. The task-created `dist` directory was absent before build, contained0 tracked files, and was removed after receipts. No Vite cache directory remained, no parser/storage hooks were installed globally, and no temporary index backup/reject file remains. Shared dependencies/env and other worktrees were untouched. No commit existed before the final verified atomic increment; no push, PR, merge, dependency installation or remote DB write occurred.

Architecture audit: task3 transaction module remains181 nonblank/non-line-comment lines, new reconciliation165, autosave98, day authority160, spatial restore52. Existing large codec/record modules receive focused boundary changes only. New source uses typed domain failures and existing validators; no new any/non-null assertions/error suppression or speculative housing layer. Test type corrections use real startPos, complete placeable fixtures, typed fade mock, immutable animal replacement and optional access; no assertion was weakened to hide a failure.

`test/fixtures/life-full/coverage.json` is unchanged: **51 features +13 findings remain not-run**. Full project gates and player/editor end-to-end journeys were not run by this bounded child; they remain separate parent/future work, not task4 verification credit.

## DoneClaim

```json
{
  "taskId": "st_01a073f5",
  "taskNumber": 4,
  "status": "done",
  "done": true,
  "branch": "agent/life-full-p2",
  "baseCommit": "f72853167278d2865a95b8600200313eb8ee08b0",
  "baseTree": "39dfe3490828aeb7e6e1569c99a786005e8d3889",
  "verifiedCodeTestsWikiTree": "1562a67cf2450fc2b8517e4e7ed1d326285b68f1",
  "commitSubject": "fix(save): retain life assets across content changes",
  "implementationCommitLookup": "git log --diff-filter=A --format=%H -- src/project/lifeStateReconciliation.ts",
  "predecessor": { "verdict": "confirmed", "blockers": 0, "matchesAncestor": true },
  "requiredTests": { "files": 6, "passed": 70, "failed": 0, "skipped": 0 },
  "relatedTests": { "files": 13, "passed": 153, "failed": 0, "skipped": 0 },
  "diagnostics": { "files": 14, "count": 0 },
  "typecheckExit": 0,
  "buildExit": 0,
  "publicProbeExit": 0,
  "partialBundle": { "donated": 5, "retained": 2, "recovered": 3, "duplicatePayout": false },
  "sourceOwnership": "draft-atomic; no writer payout or live mutation; no reissue on reread",
  "unknownLegacy": "original unresolved JSON retained; no guessed payout",
  "completedRights": "completion/reward tombstones and dormant region/recipe IDs retained",
  "restoreOrder": "persistent occupancy, spatial, animals, other life claims, restored maker synchronization, returned live draft",
  "autosaveFailure": "typed reconciliation failure returns null; old disk and current live unchanged; input policy retained",
  "dayFailure": "whole draft discarded with recovery stage/source ID or later stage",
  "task9GeneralClock": "not preimplemented",
  "task11LinkedHousing": "not preimplemented",
  "full51coverage": "not-run; 51 features and13 findings unchanged",
  "remoteWrites": 0,
  "pushPrMerge": false,
  "teardown": "complete",
  "independentTask4Verification": "parent must refresh stale VERIFY before task5"
}
```
