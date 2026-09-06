# Task4 independent verification

## Verdict: confirmed

- Acceptance verdict: **0 (confirmed)**. Mandatory fixes / blockers: **0**.
- Actual current HEAD: `b7b02d97ad6cb3b493bd60691ec61970e8a0e37e`.
- Current HEAD tree: `63ea1d26f87d4a82d9ff925071582abdae01b354`.
- Task4 correction / execution-entry commit: `596eab9a865257197e67992cc0eec4e45239ad34`.
- Correction tree: `b3ca75034e7956fe318673bd5bed8fc69e42d8c1`.
- Task4 initial implementation: `b668667bfaaf1846ee4b65215b690a07f092c7d1`.
- Confirmed task3 ancestor: `f72853167278d2865a95b8600200313eb8ee08b0`, tree `39dfe3490828aeb7e6e1569c99a786005e8d3889`.
- Branch/worktree: `agent/life-full-p2`, `/home/main/z-project/rpg-zzu-life-full-p2`.
- Verifier: `st_01a07435`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Date: 2026-09-06, workstation local date.

**Task4 is confirmed at the actual current HEAD. Its predecessor gate no longer blocks task5.** This is not approval of later tasks, final shipping, or the full 51-feature journey. The previous needs-fix verdict at `8c4f4f57c1473f024ee7bf9dad50cf859459f30d` was justified; both of its exact counterexamples now pass independent verification. Approval is based on executed assertions and inspected ownership boundaries, not the producer's done claim.

### HEAD movement and applicability

Entry was clean at 596eab9a. During verification, another actor advanced HEAD to b7b02d97. I created no commit. `git show --stat HEAD` and `git diff --name-only 596eab9a HEAD` show exactly nine task2 evidence files, with no task4 SUMMARY/source/test/wiki change. Both commands below exited0:

```sh
git diff --exit-code 596eab9a HEAD -- . ':!.omo/evidence/**'
git merge-base --is-ancestor 596eab9a HEAD
```

Thus all executed task4 product/test code is byte-identical at current HEAD; the verdict applies to b7b02d97, not an assumed stale tree. The full required and related suites were not repeated merely because unrelated evidence was committed. `git merge-base --is-ancestor f72853167278d2865a95b8600200313eb8ee08b0 HEAD` also exited0. Task3 VERIFY explicitly confirms that ancestor with acceptance0/blockers0.

## Review scope and source inspection

Read the full approved plan, including all Scope contracts, task4 and the later task9/task11 assignments; complete task4 SUMMARY including B1/B2 correction; complete prior task4 refusal and its autosave follow-up; task3 confirmed VERIFY; AGENTS, quickstart, project wiki, focused runtime routing/session/schema guidance and relevant programming/TypeScript/debugging skills. All CLAUDE.md files were ignored.

Inspected the task4 source/test/wiki diff against f7285316, the complete 458-line persistence regression file and both producer probes, and the called save parser/writer/apply, recovery, maker, shipping, bundle, animal, placeable and spatial authorities. Changed existing tests retain their cases: obsolete deletion expectations now assert preserved owners/tombstones, scene rollback uses invalid quantity rather than recoverable stale content, and the scene wait subscribes before the action with a bounded failure timeout. The B1/B2 correction adds five tests without modifying the earlier 35 cases.

Scope is the complete task4 persistence boundary: pure writer, parser, atomic apply/day draft, bounded originals, shipping incompatibility, excess-only bundle recovery, tombstones/dormant rights, frozen original-clock cancellation, persistent occupancy before spatial/animals/remaining claims, explicit emptiness, and old disk/current live preservation on save failure. **General clock wiring is task9; full linked housing and spatial receipt capture/payout are task11.** Neither is demanded early or credited as completed here. Task4 preserves spatial receipts and unproven originals; it does not infer a refund from an opaque `paid` field.

## B1: exact recognizable legacy placeable is now lossless

Executed the checked-in B1/B2 probe and a separately written no-file Node/Vite SSR probe. Both use the real writer, disk reader/apply and recovery authorities, real happy-dom Storage, and no target-module or structuredClone mocks. The exact old record is:

```json
{"id":"legacy","mapId":"map_blank_start","x":2,"y":2,"kind":"legacy-machine","paid":{"itemId":"old-input","count":3},"oldJob":{"progress":7}}
```

Observed and asserted:

- Disk parsing retains the entire original; apply removes the active placeable and creates exactly one unresolved claim owning the complete deep-equal record.
- Claim payable items are `[]`. Explicit collection returns false and leaves the whole session unchanged. No inferred old-input3 payout occurs.
- Snapshot construction from the original live placeable produces the same quarantine without changing live input.
- Two further real writer -> Storage -> reader -> apply roundtrips retain the same single claim and sequence; there is no reissue or second owner.
- Reading/applying does not change the original input slot bytes.

The fix at `saveSlots.ts:690-695` rejects unsupported **fields** before reconstructing a recognized prefix. It does not close `PlaceableObjectState.kind`, which remains a string (`placeables.ts:15-28`). An independent positive control used actual `placeObject` for `legacy-machine`, `rock`, `tree`, `forage`, and `user-defined-marker`, with supported itemId/seasonalDrops. All five survived writer/read/apply unchanged, with zero quarantine claims and unchanged writer input. Existing generated-forage persistence also passed in the required P2 suite. This rules out solving B1 by a kind whitelist or breaking ordinary supported placeables.

## B2: exact malformed-neighbor occupancy is refused before loss

Both public probes independently used a valid 1x1 shed type plus this exact payload:

```json
{
  "farmPlots":{"map_blank_start":{
    "2,2":{"tilled":true,"watered":true,"stage":1,"cropId":"old-crop"},
    "3,3":{"tilled":"legacy","watered":false}
  }},
  "farmBuildingPlacements":{"shed":{
    "instanceId":"shed","typeId":"shed","level":1,"mapId":"map_blank_start",
    "x":2,"y":2,"orientation":"down"
  }}
}
```

Observed and asserted:

- `readSaveSlot` returns `corrupt`, rather than accepting a snapshot with all plots erased.
- Direct apply and writer throw `LifeReconciliationError`; input snapshot bytes/current session remain unchanged.
- Autosave returns null and preserves the prior autosave; failed manual snapshot construction does not replace the previous manual slot.
- Day transition returns `{ok:false,reason:"recovery",stage:"recovery",sourceKind:"farmPlots",sourceId:"farmPlots"}`. Existing claims, inventory, completion/reward receipts, plots and placement owners remain unchanged.
- **Positive control:** delete only malformed3,3. The reader accepts the slot, valid old-crop plot2,2 survives, and the colliding shed moves to an unresolved original claim. Missing crop content does not remove its plot occupancy. Spatial collision checks were not weakened.

`parseLifeState` now validates the present whole farmPlots collection using the existing predicate before the old lossy codec branch. Writer/apply/day all reach this shared precondition. Whole-load refusal is the approved minimal correction, not partial salvage or a task11 housing change.

## Full task4 contract evidence

| Contract | Grounded evidence |
| --- | --- |
| Writer purity and atomic ownership | `prepareLifeSnapshot` and `reconcileLifeState` clone inputs; source removal and claim creation commit only after bounded candidate validation. The required persistence40 and recovery54 tests pass full-state equality, prefix-capacity rollback, idempotence and explicit payout checks. Saving does not pay claims. |
| Partial bundle5 -> progress2 + claim3 | Real `contributeBundle` in public-probe.mjs spends5 from inventory10 before the definition shrinks. Measured inventory5 + progress2 + claim3 =10; after explicit receipt inventory8 + progress2 =10. Two reloads and duplicate collection do not duplicate assets; consumed claim sequence remains advanced. |
| Completed and dormant rights | Real bundle completion earns gold9. Deleting definitions retains completion/reward tombstones and region/recipe rights; definitions returning cannot reward again. Completed contributions are not refunded. |
| Disabled/deleted/ineligible shipping | All three required persistence variants pass. Reconciliation moves quantities before known-ID filtering. Unknown-item originals survive, cannot pay while unknown, and do not auto-pay when definitions return; explicit later receipt is required. |
| Bounded unresolved records | Reader/apply tests reject claim4097, distinct item65, unsafe sequence, invalid counts, raw64KiB overflow and total8MiB overflow without changing disk bytes. Recovery54 additionally tests exact byte boundaries and large quantity splitting. Duplicate raw JSON keys are rejected before last-key-wins ownership loss. Unknown legacy maker/shipping/animal/spatial records remain unpayable originals. |
| Frozen makers and legacy cancellation | Original clock minute29 yields proven inputs3; minute30 yields promised outputs2 after deletion/clock change, without reissue. Compatible makers synchronize ready only during apply, not snapshot creation. Unproven legacy input refunds remain forbidden; unchanged task3 recovery/maker tests pass. |
| Occupancy and restore order | Apply restores persistent plots/chests/placeables before preparation; preparation quarantines rejected placeables before spatial reconciliation. Spatial then precedes animal and shipping/bundle/maker reconciliation. Required test verifies plot collision -> spatial claim before removed-animal claim. Valid payment receipts survive; temporary player overlap does not remove a saved placement. B2 closes the parser precondition. |
| Animal preservation and empty collections | Removed species and rejected legacy records retain originals. The501st saved animal becomes one unresolved original while500 remain active. Independently exercised authored animal present -> explicit empty saved animals -> two disk roundtrips: zero resurrection; explicit empty spatial collections persist. Omitting the legacy animal field still restores the authored start. Existing legacy-home fallback remains unchanged. |
| Atomic apply/day and later failure | Apply returns only a successful independent draft. Day recovery failure identifies stage/source; later energy/animal/forage failures discard the entire day including prepared claims/calendar/receipts. Required/related tests and real public probe pass. |
| Failed save versus successful live action | Public quota probe collects a claim successfully, then fails autosave: current inventory3 stays in memory, claim stays consumed, previous disk remains byte-equal. Invalid recovery preserves old autosave/checkpoint and current live. Save failure does not retroactively undo a successful gameplay action. |
| Narrow autosave exception contract | `performAutosave` catches only typed reconciliation errors during construction; unrelated errors rethrow. Independent native non-cloneable-function input raises DataCloneError with no clone mock and old disk/current input intact. Typed invalid recovery instead returns null. Unchanged lifeSaveVersion18/autosave16/menu7 regressions pass policy, checkpoint, quota and debounce behavior. |

## Fresh independent commands and actual exits

All commands ran in the named worktree. Required/related suites each executed **once**, not retried. GNU timeout used `-k 10s`, with300s for suites/diagnostics,120s for module probes,900s for build. Each wrapper captured `$?`, printed the labeled exit, and exited with that value; no pipe-tail status was used.

```sh
npm test -- test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p1SessionPersistence.test.ts test/p2SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/p0RuntimeIntegration.test.ts
```

**Exit0; 6 files /75 passed /0 failed /0 skipped.** Vitest3.2.4, start09:55:40, duration34.32s. Recovery persistence40, P0 persistence9, P1 persistence3, P2 persistence4, spatial persistence3, P0 runtime16. Every required file actually executed.

```sh
npm test -- test/lifeRecovery.test.ts test/lifeSaveVersion.test.ts test/autosave.test.ts test/p0Makers.test.ts test/p0Shipping.test.ts test/p0Bundles.test.ts test/p1FarmAnimals.test.ts test/p1DayTransitionIntegration.test.ts test/p1WeatherDayTransition.test.ts test/p2DayTransition.test.ts test/p0DayTransitionSceneFailure.test.ts test/p2SpatialTransactions.test.ts test/checkpointEndingRuntime.test.ts test/playerOpenSaveMenu.test.ts test/customSeasonSave.test.ts test/p0SafetyHardening.test.ts
```

**Exit0; 16 files /169 passed /0 failed /0 skipped.** Start09:57:17, duration43.83s. Includes recovery54, lifeSaveVersion18, autosave16 and playerOpenSaveMenu7. The menu is real shell/keyboard/Storage integration using the export store shim, not a booted Phaser/player.html journey.

| Exact command | Fresh result |
| --- | --- |
| `node .omo/evidence/life-full-20260906/4/b1-b2-public-probe.mjs` | Exit0; inspected all executable assertions first; exact B1, B2 and valid-occupancy control pass; four JSON records including cleanup. |
| `node .omo/evidence/life-full-20260906/4/public-probe.mjs` | Exit0; seven JSON records prove actual donation, reward, maker cutoffs, malformed/quota/later-stage rollback and cleanup. |
| `node .omo/evidence/life-full-20260906/4/diagnostics.mjs` | Exit0; actual TypeScript language service, all14 changed TS files, zero syntactic/semantic diagnostics. Executed before build. |
| `npm run build` | Exit0; runs `tsc --noEmit -p tsconfig.app.json`, app Vite build, player/SDK and standalone. All completed. No separately rerun `npm run typecheck:app` is claimed; its identical tsc invocation ran successfully inside build. |
| `npm run openwiki:index -- --check` | Exit0; current index. |
| `npm run openwiki:verify` | Exit0; failures empty. |
| `git diff --check` | Exit0. |
| `timeout -k 10s 120s node --input-type=module` (independent exact-counterexample/control stdin program) | Exit0; exact B1/B2 independently rebuilt from prior refusal, two Storage roundtrips, sole original owner, no inferred payout, whole-failure preservation, valid occupancy, five open-kind placeables and native DataCloneError distinction. No file created. |
| `timeout -k 10s 120s node --input-type=module` (explicit-empty stdin program) | Exit0; authored animal positive control, empty animal/spatial collections survive two disk roundtrips; omitted animal field preserves legacy authored fallback. No file created. |

Build warnings remain visible: pre-existing circular record-picker chunk warning, mixed static/dynamic imports, runtime-resolved asset URLs, and large chunks. These also appear in inspected producer build evidence; none was suppressed or fixed outside scope. The player SDK reports project schema v4, consistent with unchanged Project4; game saves remain Save5.

### Independent stdin probes: inputs and decisive assertions

The first no-file program imports real saveSlots/defaults/session/autosave/lifeRecovery/dayTransition/placeables with Vite `createServer({configFile:false,resolve:{alias:{"@":cwd+"/src"}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:"custom"})`. It uses a new happy-dom Window/Storage, `startSession(project,44)`, exact B1/B2 JSON above and a valid1x1 shed type. It explicitly asserts `corrupt`, typed throws/null, whole-session deep equality, byte-equal old slots, sole deep-equal unresolved original, empty payable items, refused collection and identical recovery sequence over two repeated disk roundtrips. Removing only malformed3,3 proves the positive collision control. Normal objects are placed through `placeObject` before saving. The noncloneable property is an input fault, not a structuredClone replacement or injected successful result.

Actual asserted output:

```json
{"independentExactB1":true,"originalOwners":1,"noInferredPayout":true,"roundtrips":2,"independentExactB2":"corrupt before occupancy loss","writerAutosaveDayRollback":true,"validOccupancyControl":true}
{"openKindStrings":5,"normalPlaceables":"unchanged with item and seasonal drops","quarantineClaims":0,"nativeDataCloneError":"throws","structuredCloneMocked":false,"typedFailure":null,"oldDiskCurrentLivePreserved":true}
{"explicitEmptyAnimals":"no authored resurrection","emptySpatialCollections":"retained","roundtrips":2,"omittedLegacyAnimalState":"authored fallback remains"}
```

No sleeps, polling, random sequence IDs, target authority stubs, or success-only printouts substitute for assertions. Expected typed reconciliation and quota warnings were visible. This is public-module persistence evidence, not player.html gameplay evidence.

## Producer evidence audit and failure chronology

Read actual RED/GREEN, diagnostics, typecheck, build and probe receipts, not just SUMMARY. Verified SHA256 of captured text and every corresponding readable log after its documented per-line trailing-whitespace normalization: all10 self-contained receipts passed; all18 raw-output.json historical entries passed. Exact commands/exits were parsed from their JSON. Historical runs are producer receipts, not pre-edit executions witnessed by this verifier or separately committed RED trees.

| Historical receipt | Actual recorded outcome |
| --- | --- |
| red | Exit1,11 failed/35 passed; missing Storage test fixture, not accepted as behavioral RED. |
| seam-red | Exit1,10 failed/36 passed at08:49:38; actual source loss, invalid-recovery acceptance, false autosave/day success. |
| initial-green | Exit1,7 failed/39 passed at08:54:10; explicitly a failed intermediate run despite filename. |
| adversarial-red / placeable-red / animal-bound-red | Exit1; respectively1 failed/60 passed,1/27,1/34. Duplicate raw keys, deleted-item source stripping and501st animal original loss. |
| related | Exit1,2 failed/151 passed; stale-content scene fixtures superseded by malformed quantity while rollback checks retained. |
| diagnostics-initial | Exit1,12 test diagnostics; full error records inspected. Final/current diagnostics are zero, not hidden via baseline. |
| final-green / final-related | Exit0; historical70 and153 passes, not substituted for corrected current75/169. |
| b1-b2-red | Exit1,5 failed/70 passed at09:35:12. Both B1 surfaces lost paid/oldJob; B2 reader accepted present, writer did not throw, day returned success. Full assertion output inspected. |
| b1-b2-green / b1-b2-related | Exit0,75/169 passes at09:39:25, independently corroborated by fresh suites above. |
| b1-b2-diagnostics / b1-b2-typecheck / b1-b2-build | Exit0;14 files/zero diagnostics, app tsc, complete app/player/SDK/standalone build. Fresh diagnostics/build corroborate unchanged product. |
| b1-b2-public / b1-b2-prior-public | Exit0; both assertion programs independently executed above. |

Correction receipts record then-current parent HEAD/tree8c4f4f57/f4876f1c while edits were uncommitted; that metadata alone is not proof of the corrected tree. The committed correction and fresh executions plus product equivalence to actual current HEAD supply that proof.

Two verifier tooling problems are disclosed, not counted as test failures or green evidence: the initial overly broad AGENTS discovery hit its10-second tool timeout; targeted reads supplied the required context. The first hash/log audit's Python process exited1 because it compared whole-text trailing trim instead of the producer's per-line trailing trim (the surrounding discovery shell continued). Captured-text hash itself matched; the corrected, documented normalization verified all receipts without editing them. No behavioral test was retried.

## Scope fidelity, cleanup and final gate

`git diff --name-only f7285316 HEAD -- . ':!.omo/evidence/**'` contains only the seven task4 production files, seven test files, two focused wiki pages and generated INDEX. `git diff --exit-code f7285316 HEAD -- WISH.md package.json package-lock.json .omo/gates-baseline.json test/lifeSaveVersion.test.ts test/playerOpenSaveMenu.test.ts test/fixtures/life-full/coverage.json` exited0. No WISH/user changes, dependencies, baseline or unchanged save-characterization tests were modified. Full51 coverage remains outside this task and is not claimed complete.

Cleanup actually completed:

- Every test/diagnostic/build/probe subprocess exited; all module probes clear Storage and close happy-dom/Vite in finally. No HTTP listener, browser, remote write, or installed hook was used by this verifier.
- `dist` was absent at entry. Fresh build created it; `git ls-files dist` was empty. A guarded Python cleanup removed only that task-created non-symlink directory; absence asserted afterward, exit0.
- `.omo/evidence/life-full-20260906/4/vite-cache` is absent. Shared node_modules/environment and pre-existing cache directories were left alone.
- Entry and pre-deliverable tracked status are clean. This VERIFY is ignored, as independently confirmed by `git check-ignore`; clean tracked status does not mean the artifact is absent.
- Only this VERIFY.md is deliberately written, using the inspected `/tmp/apply_patch` wrapper (`patch -p1 --forward`), without backup/reject artifacts. No product/test/evidence receipt edits, commits, pushes, PRs or merges were made by this verifier. The unrelated task2 evidence commit was another actor's work and is preserved.

**Final decision: confirmed, acceptance0, mandatory blockers0 at b7b02d97ad6cb3b493bd60691ec61970e8a0e37e (tree63ea1d26f87d4a82d9ff925071582abdae01b354).** Both previous mandatory blockers are resolved with exact-input independent proof. Task5 may proceed under its own scope and remaining predecessor checks. Full gates, editor/player journeys, task9 clock integration and task11 housing/spatial payout retain their later verification obligations.
