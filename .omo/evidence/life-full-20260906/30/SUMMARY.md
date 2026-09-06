# Task30: reserved JSON record-key quantity conservation

The reserved-key quantity loss is corrected without changing recovery ownership policy. The correction is six targeted numeric-record/lookup changes in three product files, plus one focused regression file and the matching runtime wiki/index. No schema, UI, dependency, baseline, maker policy, or spatial policy changes are included.

## Isolation and reproducible trees

- Task: `st_01a074c9`; parent/root session `01a0727b-398a-7481-b557-b198013542c1`.
- Frozen base: `f86474547028cddf795c8e431b2195b7edccd201`.
- Base tree: `8386dd1efe4338f705d6a7accdbdefaa3b0beb6a`.
- Branch: `agent/life-full-record-keys`.
- Actual retained worktree: `/home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys`.
- Creation command, run from `/home/main/z-project/rpg-zzu-life-full-p2` before product edits: `npm run wt -- create life-full-record-keys --base f86474547028cddf795c8e431b2195b7edccd201`, exit 0. See `worktree.log`. The script prefixed the calling directory basename; the actual path above is not the shorter assumed path.
- `node_modules` links to `/home/main/z-project/rpg-zzu/node_modules`; `.env.local` was provisioned. Only the configured port, `9841`, was observed, not credentials. No HTTP listener was required or started; no remote writes.
- RED code/test tree: `c16d8e5d0757d4eb09c0f1a47fed9098004b2ef5` (base product code plus regression tests).
- First GREEN code/test tree: `7bb52510fb996944c59a63fbfa66c492d1e70b97`.
- Final verified code/test tree: `7cecb337c4de1a3ef732bc1161cf5f5551aa5e89`. The only intervening test change awaits Happy DOM's actual close operation; all assertions remain intact.
- `run.mjs` records command argv, direct subprocess exit/signal, cwd, timestamps, HEAD/base trees, and a temporary-index code/test tree without changing the real index. Its code tree intentionally excludes documentation/evidence; the final commit tree includes them. Use the commit containing this summary for the evidence-inclusive tree.

Read context: approved plan Scope/task30, AGENTS, quickstart, wiki index/project map, runtime routing/sessions/schema and historical audit Scope. The current approved implementation task, not the historical audit's read-only restriction, authorizes this correction. All CLAUDE.md files were ignored. No edits or staging occurred in the parent phase2 tree, no parent evidence/WISH was changed, and no merge/push/PR/amend/history rewrite was performed.

## Cause and minimal correction

1. `lifeStateReconciliation.ts` assigned arbitrary JSON item keys into ordinary `{}` numeric records. Assigning positive `__proto__` invokes the prototype setter rather than creating an own numeric property. The same cause existed in parsing, retained progress, and excess amounts. All three accumulators now have null prototypes.
2. Following the same quantity through explicit recovery collection exposed a second actual loss: the claim could be consumed successfully while sanitization erased an existing own `__proto__` inventory count. `itemTransitions.ts` now uses null-prototype numeric inventory accumulators in sanitization and save normalization. The transition algorithm, finite-use logic, caps, and operations are unchanged.
3. The immediate `changeItemsAtomically` preflight read inherited `constructor`/`toString` as quantities when no inventory owner existed. That count lookup now checks `Object.hasOwn` before reading. No recovery-source or claim-ID policy was changed.

`moveLifeRecoverySource` already uses own-source checks, `Map` aggregation, array item batches and generated `recovery:N` keys; `collectLifeRecoveryClaim` already checks own claims. Those policies/code did not need modification. No blacklist was introduced. The public probe successfully executes actual project `serialize -> deserialize` with each of `ordinary`, `__proto__`, `constructor`, `toString` as authored item and bundle IDs; these IDs are not rejected by the actual contracts.

## RED before product edits

- `red.json` / `red.log`: 21 deterministic tests, **8 failed / 13 passed**, exit **1**, before any production correction.
- `public-red.json` / `public-red.log`: the parent's public probe, copied unchanged (archived as `reserved-key-probe.initial.mjs`), exit **1** at the frozen base.
- Exact public input: `{"bundleContributions":{"bundle":{"__proto__":1}}}`.
- Actual public output: `{"result":"parsed","directOwner":false,"unresolvedOwner":false,"parsed":{"bundleContributions":{"bundle":{}}}}`.
- Actual assertion: `A positive source amount must retain an owner or explicitly refuse parsing`.
- The tests also demonstrate successful direct shipping-claim collection dropping an existing own `__proto__` stack (`expected [] to deep equally contain ['__proto__', 4]`), and inherited-name collection refusal. Full failures, expected/actual values, and source lines are preserved in `red.log`.

## GREEN and public ownership receipts

`public-green.json` / `.log` run the exact original public probe again, exit **0**: direct owner true, unresolved owner false, quantity **1** retained. `public-roundtrip.json` / `.log` run real imported modules with actual Happy DOM Storage, not mocked readers/writers; exit **0** for all four IDs. Every stage logs full contribution/shipping records, inventory, claims/items/unresolved originals, sequence and numeric totals at writer, reader and apply.

| Case, for each of four IDs | Source quantity | Claim quantity | Inventory quantity |
| --- | ---: | ---: | ---: |
| Original contribution | 5 | 0 | 0 |
| Requirement reduced to 2; writer/read/apply | 2 | 3 | 0 |
| Two further reconciliation/save/read/apply retries | 2 | 3 | 0 |
| Explicit collection, duplicate attempt rejected, then roundtrip | 2 | 0 | 3 |
| Existing inventory1 plus direct shipping claim3, after roundtrip | 0 | 0 | 4 |
| Unknown definition; complete original unresolved record retained | 0 | 5 | 0 |
| Two unknown retries; collection refused with no mutation | 0 | 5 | 0 |
| Definition returns, save/read/apply without collection | 0 | 5 | 0 |
| Explicit collection after definition returns | 0 | 0 | 5 |

Unknown claim item amounts reflect the proven source record, not inferred compensation; unresolved JSON is evidence of the same claim, not a second payable owner. No save/reconciliation pays claims. Sequence remains 2 after consuming claim1. The focused tests additionally cover fully compatible requirement5 (source5/no claim), unsafe sequence capacity rollback, malformed negative counts at Storage/direct apply with original disk bytes intact, full inventory rollback, and exact own-key presence. Existing suites retain all capacity, opaque evidence, occupancy, quota and day rollback assertions. Object.prototype descriptors are checked unchanged; inherited names cannot supply the tested inventory quantities.

The first expanded public probe failed in its *observer*, not the product: it checked only the inner record's own key, so an absent outer `__proto__` bundle read Object.prototype and reported null instead of zero. Its unchanged source and actual failed output are retained as `public-roundtrip.initial.mjs` and `public-roundtrip-instrumentation-failure.{json,log}`. The observer now checks both levels. The same edit awaited `window.happyDOM.close()` and asserts `window.closed === true` instead of reporting synchronous `window.close()` as completed. No product code or test assertion was changed to hide this failure; the corrected probe passed on the same product tree, without timing retries.

## Exact verification commands and results

Each command below is invoked through `node .omo/evidence/life-full-20260906/30/run.mjs LABEL SECONDS ...`. Every resulting `LABEL.json` stores the full executable argv. Heavy execution is serialized by `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --signal=TERM --kill-after=15s <SECONDS>s ...`.

| Receipt label | Inner command | Deadline | Exit/result |
| --- | --- | ---: | --- |
| red | `npm test -- test/lifeRecoveryRecordKeys.test.ts --maxWorkers=2 --minWorkers=1` | 180s | 1; 8 RED / 13 pass |
| public-red / public-green | `node .omo/evidence/life-full-20260906/30/reserved-key-probe.mjs` | 120s | 1 / 0 |
| final-green | `npm test -- test/lifeRecoveryRecordKeys.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/itemTransitions.test.ts --maxWorkers=2 --minWorkers=1` | 300s | 0; 131/131, 6 files |
| quantity-regression | `npm test -- test/p0CommerceFinalSafety.test.ts test/p0EconomySafetyFollowup.test.ts --maxWorkers=2 --minWorkers=1 --no-cache` | 240s | 0; 34/34, 2 files |
| public-green-owned-cache | `node .omo/evidence/life-full-20260906/30/reserved-key-probe.mjs` | 120s | 0; explicit task cache, removed after close |
| public-roundtrip | `node .omo/evidence/life-full-20260906/30/public-roundtrip.mjs` | 180s | 0; all four IDs, cleanup asserted |
| diagnostics | `node .omo/evidence/life-full-20260906/30/diagnostics.mjs` | 300s | 0; touched TS semantic/syntactic diagnostics empty, evidence JS syntax checks 0 |
| typecheck | `npm run typecheck:app` | 300s | 0 |
| build | `env VITE_CACHE_DIR=.cache/life-record-keys-build npm run build` | 600s | 0; app, player SDK and standalone bundles |
| wiki-verify | `npm run openwiki:verify` | 120s | 0 |
| cleanup / cleanup-final | `python3 .omo/evidence/life-full-20260906/30/cleanup.py` | 60s | 0 / 0; initial mistake and correction detailed below |

Initial LSP diagnostics found no diagnostics for all four changed TS files. Refreshes after the cleanup-only test edit timed out for the test and public probe (3000ms); rather than treating stale output as verification, the recorded TypeScript compiler-API diagnostics checked all final changed TS sources before typecheck/build. All script syntax checks also passed. Build warnings about unresolved asset/font paths, missing optional AI proxy keys, mixed static/dynamic imports and large chunks remain visible in `build.log`; build success does not mean warning-free. No warnings or baseline failures were suppressed. Full repository gates and player UI journeys are delegated to parent integration, not claimed here.

## Cleanup and handoff

`cleanup.json`, `cleanup.log`, `cleanup-details.json` preserve the initial cleanup; `cleanup-final.json`, `cleanup-final.log`, `cleanup-final-details.json` and the final public probe cleanup row record the corrected final cleanup. Storage is empty, the Happy DOM window is closed, Vite is closed, and its task cache is absent. The cleanup scan found no remaining task-root language-server processes. Task-root dist (238 MiB) and task-owned temporary console files were removed; task-specific build/public caches were absent or removed. The initial cleanup incorrectly also removed the TRACKED baseline `.vite-cache/deps/_metadata.json` and `.vite-cache/deps/package.json`. The parent caught this before commit. Both files were restored byte-for-byte from `git show f86474547028cddf795c8e431b2195b7edccd201:<path>` using an explicit patch, and neither is included in the correction diff. `cleanup.initial.py` preserves the erroneous cleanup source and its original receipts remain unchanged; `cleanup.py` now excludes `.vite-cache` and refuses tracked removal targets. Further exact probes explicitly use `.cache/life-record-keys-exact`; the expanded probe already used `.cache/life-record-keys-public`. `finalization-corrections.json` records the byte/hash/diff checks. No native apply_patch command/tool was exposed, so the remaining edits used an `apply_patch` shell wrapper over `git apply` with explicit unified patches, never checkout/reset or direct source overwrites. Shared node_modules caches were deliberately not deleted because other actors use them. Provisioned dependencies/env and the task worktree are retained for parent verification. No HTTP player/editor server, browser process or remote DB session was started.

`git diff --cached --check` initially exited 2 because raw command logs contained trailing spaces/redundant final blank lines. Exact original bytes and SHA-256 hashes are retained in `raw-command-output.json`; readable `.log` views remove only that whitespace, not warnings or failing output. No failure was suppressed.

Only scoped product/test/wiki files and this task30 evidence directory are staged. The generated INDEX is regenerated after final evidence-inclusive staging and checked again after the correction commit; final command/commit receipts accompany the parent handoff. The parent owns independent verification and cherry-pick; this task does not claim integration approval.
