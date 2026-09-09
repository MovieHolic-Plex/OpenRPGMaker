# G1 non-UI contract-fix handoff

## Current status: lifecycle and preserved fixture patch verified; heavy slot released

Task `st_01a0832e` resumed the preserved patch after explicit slot release. All work stayed in `/home/main/.herdr/worktrees/rpg-zzu/worktree-gate-contract-fixes`, branch `worktree/gate-contract-fixes`, base `f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843`. Main and progress trees were not edited. No commit was created.

**Deliverable:** updated sibling `G1-NONUI-FIX.patch` contains all ten test/support files, including both untracked tests. Patch SHA256: `c8cbf0e6480c581905aa6c8e4a891cf8ff2984527f8914a56c941b445830b1e8`. `git apply --reverse --check` against this worktree passed. This ignored handoff and patch must be retained explicitly by the parent.

### Minimal lifecycle repair

- `test/aiJobsTestSupport.mjs` composes the existing repository/scheduler teardown into ONE HTTP-owned hook, making FIFO/LIFO registration order irrelevant. Each HTTP fixture owns an abort controller combined with the runner signal, its fetch Promises, and the actual production-handler-returned route Promises. Cleanup aborts client requests, stops listening/closes connections, awaits pending requests and accepted handler work, then invokes the unchanged scheduler/repository/directory cleanup and its unchanged empty-error assertion. Client rejection observers only remove settled requests; callers still receive the original rejection. Unexpected handler rejections are retained in the fixture error array.
- `test/aiJobsTestSupport.d.mts` adds only optional readonly `signal` to the cleanup owner contract. No production drain API, scheduler availability bypass, error clearing, timeout increase or polling was added.
- `test/aiReportAssetsPayload.test.ts` creates a fresh cleanup owner and hook list in `beforeEach`, with that test's real Vitest signal. Its returned teardown runs all owned hooks in reverse order and aggregates rather than suppresses failures. Inspection of installed Vitest 3.2.4 showed `it.each` does NOT forward test context to the row callback; therefore signal ownership is captured in `beforeEach`, not a nonexistent row argument. All original 28 sequential negative requests per family, six family rows, deadlines, executor/error/ownership/manifest/reload assertions remain unchanged.
- Prepared `test/aiJobsHttpFixtureLifecycle.test.ts` was executed unchanged: SHA256 `5b45a131a071c5e61dd8ceb27bbe03eef85b6450b3927997645c7bb0d02274e9`. It holds real persistence before scheduler admission, explicitly aborts the test owner, and observes actual route Promise settlement. Both hook orders now preserve storage until that settlement, stop the 28-request workload after index 0, propagate the exact abort reason, never execute a job, retain an empty error array and remove the owned directory.
- All seven earlier fixture corrections below remain. Five files are byte-identical to the earlier successful manifest. Report changes after that manifest are only its cleanup adapter. Fresh LSP found a real prior fixture type defect in `transactionalNewRemoteProject.test.ts:131`: `SupabaseResourceCacheReport` requires `cached`. Added `cached: []` beside `skipped: []`; all namespace/loading/rollback assertions remain. Final LSP on all ten changed/new files is clean; no suppression was used.

The diagnosis remains narrow: test timeout left a fetch/body/route continuation alive past scheduler closure. A per-test executor already exists; no production install/readiness defect was found or patched. The prior supervisor's 20 global OOM kills and the unproven initial stall remain historical evidence, not a claim this patch prevents machine-wide starvation.

### Observed RED and final verification

All six invocations ran sequentially under this tree's S0 launcher, byte-identical to main's launcher (`c193abf7f4c92b80f685a786034d6a994c0f991b4c14a9540504742296dc8ad4`). Explicit includes, original deadlines, installed dependencies `/home/main/z-project/rpg-zzu/node_modules`, read-only owned browser `/dev/shm/task8-managed-chromium-cHQvga`, and disk scratch `/var/tmp` were used. No bare live-env tests, provider/remote DB/browser/image execution, installs, shared-cache changes or foreign-process actions occurred. The focused tests retain their existing controlled decoder and mocked remote I/O boundaries.

Evidence root: `/var/tmp/g1-nonui-lifecycle-f3Bxfkm5`. Every row retains `command.log`, `receipt.json` and complete `source.json`.

| Label | Observed result | command/sandbox/launcher exits | Owned scratch (confirmed absent) |
| --- | --- | --- | --- |
| `lifecycle-red` | Correct RED, 0 passed / 2 failed. FIFO observed `cleanupFinished=true, schedulerClosed=true` while route held; LIFO raised `AggregateError: Fixture cleanup failed`. No import/missing-tool failure. | 1/1/1 | `/var/tmp/s0-sih1b9a4` |
| `lifecycle-green` | First support fix, 2/2 passed | 0/0/0 | `/var/tmp/s0-pfqv9zk9` |
| `lifecycle-final` | Final source, FIFO/LIFO 2/2 passed, 0.583s | 0/0/0 | `/var/tmp/s0-1o7llulp` |
| `focused-final` | Original 10-file non-UI group, 114/114 passed in one run, 248.81s | 0/0/0 | `/var/tmp/s0-n52aqo5u` |
| `node-http-regressions` | HTTP/scheduler/repository 47/47 passed, 0 failed/cancelled/skipped, 3.862s | 0/0/0 | `/var/tmp/s0-3kr2foct` |
| `build` | `npm run build` passed: app typecheck, editor bundle, player/SDK and standalone bundle | 0/0/0 | `/var/tmp/s0-pqnn0088` |

The real HTTP lifecycle regression exercises the affected runnable surface, not socket-only mocks. The focused run passed all six original negative pin rows (6.27-6.57s each at the unchanged 30s deadline), application journal recovery, draft namespace and transaction rollback assertions. Build emitted existing product asset-resolution and >500kB chunk warnings; these were retained, not suppressed or addressed by this test-only patch. No full G1, browser/manual UI gate, standalone HTML assembly or supervisor repeat of the new source is claimed.

Final four invocations used the same pinned source:

```text
sourceSha256       130d7570d837d18c85cbd1dca76aeab704eb2403a0ad3f8730eb2f009c7651d0
dependenciesSha256 954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2
RED source         d31cf1ff20d361a4c00b1eb39a5206a98eb30528eeae023e6969fc89d27bd426
first GREEN source 5822a50f8960e0ad105e6b8fd2d197daadd833742ee0bff1563130bb17c5e129
```

The SHA256 of each retained `source.json` was recalculated and matches its receipt. Current bytes of all ten deliverable files match the final source manifest. All six receipts report `error=null`, cleanup `removed=true`, uid1000, capabilities0, no-new-privileges, loopback-only and zero nonlocal routes. Every recorded scratch path is absent; `/proc/*/cwd` inspection found no process matching any recorded owned work device/inode. Build artifacts existed only in S0 scratch and were removed. Only the named evidence and uncommitted patch remain. **Heavy slot is released to the parent.**

### Final file pins

```text
c155b18af66443164572ed86dbcfe8013a3f62b650cb1742a579b16d3ec1defa  test/aiJobApplication.test.ts
339626f458b1eda3e48731f89af0c7e368f947d4ae838d12d2b670115050635b  test/aiJobsTestSupport.d.mts
c5b99d12f74ec571bbf62cfe2bd66436599ef4e1361189c66c06d91be8a7f23f  test/aiJobsTestSupport.mjs
d94eb1ca64503a34d499ae88f457d95afb8ae64b0f206150db656283333a7941  test/aiReportAssetsPayload.test.ts
a9ee3eddcb7c73a8a377a08905ffde00627872a6526b8feb38e645c724999d78  test/manualCommitDiff.test.ts
99973d9a67dc99c59831bc7030292ef13177fc301506ddbc1532bc8280544b5e  test/noLocalProjectDb.test.ts
11edae94f2046847e91077322bf7fa2705694fcca9e2356e8cf70ad84becbc7c  test/storeEventDraftPreserve.test.ts
2c567b6b71bae26a96faf5e2483af83e9ad4c484fd3d318959eee1983065a76a  test/transactionalNewRemoteProject.test.ts
5b45a131a071c5e61dd8ceb27bbe03eef85b6450b3927997645c7bb0d02274e9  test/aiJobsHttpFixtureLifecycle.test.ts
b9d36749417fe87a556c583b170a0593a0cea2325e9cb725cc5383511a47d9b4  test/eventDraftVaultFixtureNamespace.test.ts
```

### Exact final execution parameters

Use the historical function below with cwd explicitly set to the fixes tree; launcher path in this increment was `scripts/qa/isolated-validation.py`. In addition to its seven named includes, this increment explicitly included `test/aiJobsHttpFixtureLifecycle.test.ts`, `test/aiJobsTestSupport.mjs` and `test/aiJobsTestSupport.d.mts`. Output root was the lifecycle evidence root above, timeout remained 1800, and all logs were retained. `lifecycle-final` captured the final source; the remaining three invocations passed `--expected-source-sha256 130d7570d837d18c85cbd1dca76aeab704eb2403a0ad3f8730eb2f009c7651d0`.

```bash
s0_nonui lifecycle-final npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobsHttpFixtureLifecycle.test.ts
s0_nonui focused-final npm test -- --maxWorkers=1 --no-file-parallelism \
  test/eventDraftVaultFixtureNamespace.test.ts test/aiReportAssetsPayload.test.ts \
  test/aiJobReports.test.ts test/manualCommitDiff.test.ts test/storeEventDraftPreserve.test.ts \
  test/transactionalNewRemoteProject.test.ts test/noLocalProjectDb.test.ts \
  test/aiJobApplication.test.ts test/aiJobIdentity.test.ts test/aiJobCanonicalReplay.test.ts
s0_nonui node-http-regressions node --test --test-concurrency=1 \
  test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs test/aiJobsRepository.test.mjs
s0_nonui build npm run build
```

## Historical checkpoint: supervisor failure retained; lifecycle RED was prepared

The remainder preserves the prior child/supervisor history. Statements below about a blocked slot, pending RED, no build and old final hashes apply to that historical checkpoint, not the current verified deliverable above.

The historical child pass below was NOT reliable verification: supervisor reran the identical source/dependencies and failed two timeout cases. Parent authorized a narrow test-fixture lifecycle repair, gated on deterministic RED. At that checkpoint progress GREEN worker st_01a082f3 owned the heavy slot and no new test/build command had run.

### Separate supervisor outcome and bounded diagnosis

- Child `/var/tmp/g1-nonui-contract-HrboxvML/focused-repaired/`: 114/114 passed, exits 0/0/0, retained unchanged.
- Supervisor `/var/tmp/g1-nonui-supervisor-4lkcnA/focused/`: 112 passed / 2 failed, exits 1/1/1, error=null, cleanup removed=true; scratch `/var/tmp/s0-ilhfwgqr` confirmed absent. Image and tileset negative HTTP-pin cases timed out at the original 30000ms limit. Tileset additionally failed teardown's unchanged empty-error assertion with `EXECUTOR_UNAVAILABLE`.
- Both source manifests were read and found byte-identical: `2eacf6507884fe3c443b7e61b03b347e0d1bab7f3fd82367491cc474a22088b6`; dependencies `954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`; command `d208ce1021d20cbdca4c7c708b2b7d828bd0fcc4c20d4093ddee48ada4db7f44`.
- Proven secondary mechanism: the route passed its first scheduler availability check, awaited repository writes, then resumed at `scheduler.admit` after fixture cleanup set `stopped=true`. The executor is captured and present; fatal readiness has a different message. Socket destruction/server closure does not await that async route continuation. Vitest's timeout rejects its wrapper without settling the underlying workload, and fixture fetches currently do not use the test signal. Each fixture has its own handler/scheduler/errors; cross-test handler reuse is not established.
- Resource evidence, not a generic load excuse: `/var/log/kern.log` contains 20 global OOM kills during the supervisor 06:53:06-07:03:35 KST window, first 06:57:15.475922 and last 07:02:12.291642; free swap reached 8kB of 39,845,880kB. Exact request/operation timing is not retained, so OOM alone is not claimed as proof of either initial timeout's cause.

### Prepared discriminating regression (NOT RUN)

New `test/aiJobsHttpFixtureLifecycle.test.ts` holds the real repository `putJson` response before the accepted route resumes at `scheduler.admit`. It explicitly aborts a per-test owner, runs Node-style FIFO and current report-adapter LIFO hooks, and observes the actual handler-returned Promise. It asserts cleanup cannot finish or close the scheduler while the route is held; after release, client and handler settlement must precede scheduler/repository closure, all work must settle before directory removal, the 28-request workload must stop after its first request, the executor must never run, and the unchanged fixture error array must remain empty. No real 30s timeout, sleep, polling, forced timer advancement or host-memory condition triggers the regression. Five-second deadlines only bound exact lifecycle signals.

- New regression LSP: no diagnostics found. `git diff --check`: exit 0.
- Regression SHA256: `5b45a131a071c5e61dd8ceb27bbe03eef85b6450b3927997645c7bb0d02274e9`.
- Support remains unchanged at `def9739440e8894ae8fd934b86e287875d870843fc1a30bcb3cd86f68c53e19b`; report adapter remains at `c49f0c2634bf6d3140808494f6a0ee9937044bd1645048394beff2939513c7a9`.
- No test-support, adapter or production implementation was changed before observed RED. The existing seven-file integration patch below is historical and does not include this pending regression; it must not be treated as the final lifecycle deliverable.

After explicit slot release, use the same main S0 launcher function below with the existing seven includes plus `--include test/aiJobsHttpFixtureLifecycle.test.ts`, a fresh owned output directory, and:

```bash
s0_nonui lifecycle-red npm test -- --maxWorkers=1 --no-file-parallelism \
  test/aiJobsHttpFixtureLifecycle.test.ts
```

Only after a correct, cleanly contained RED may support/adapter implementation proceed. Production HTTP/scheduler/repository policy remains excluded; if test-layer handler settlement is impossible, send the exact minimal proposal before widening. Original deadlines, all 28 sequential checks per family, and all error/rollback/pin assertions remain required. Final validation must include the Node HTTP/scheduler consumers as well as the focused Vitest group under S0, one heavy command at a time.

## Historical child handoff (before supervisor repeat)

Task st_01a082f1 continued prepared task st_01a08282. Worktree `/home/main/.herdr/worktrees/rpg-zzu/worktree-gate-contract-fixes`, branch `worktree/gate-contract-fixes`, HEAD `f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843`. No commit was created. All edits are confined to this worktree.

**Final focused S0 run: 10 files, 114/114 tests passed; command/sandbox/launcher exits 0; cleanup verified.** Full G1, build and browser/manual gates remain parent-owned and were not run here. This is a verified focused fixture repair, not a claim that full G1 is green.

Parent released the heavy slot explicitly after progress RED completed. Two focused commands ran sequentially under the existing main S0 launcher; the first exposed an incomplete prepared report fixture, fixed below before the second run. No bare live-env test, provider/remote DB request, installation, UI/image workload, shared-cache mutation, foreign-process action or commit was performed. The focused tests use their existing isolated HTTP/repository boundaries and controlled image decoder; no browser was launched. S0 used its managed read-only browser path and private scratch/cache.

## Baseline and namespace authority

The matched baseline is complete, not pending: main `.omo/evidence/ai-job-queue/verification/G1-MATCHED-COMPARISON.md` records base490 at 173 failures and candidate at 280, both with dependency hash `954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`. Report6/manual2/draft2/transaction3 are new candidate failures; the lexical guard already failed in baseline and gained the journal match. No baseline was changed and no unrelated failure was repaired.

Parent's independent `/var/tmp/g1-nonui-contract-FY18Zp/namespace-proof/` passed 2/2 before this task's transactional edit. Its log and receipt were read here: command/sandbox/launcher exits 0, source `ecda39509552421d16671a49e1e51d45bb82b10cf4b6777ee4c17adc9e24c876`, matching dependency hash, cleanup removed=true, scratch `/var/tmp/s0-_t41ppgl` independently confirmed absent. This proves that explicit legacy-ID flush leaves the scheduled ephemeral write, while a matching namespace flush cancels it. The proof was not rerun independently; it is also included in both focused groups below.

Unlike the frozen full candidate, this fixes tree starts at committed HEAD without the candidate's working-tree UI/region edits. HEAD alone is not proof of an identical full source; use the recorded source manifests.

## Complete seven-file patch

- `test/aiReportAssetsPayload.test.ts`: retains the prepared dedicated captured resource ID, both changed icon/image bindings, and explicit negative baseline-binding assertions. Focused execution showed the new ID also needs a generated-project resource profile: added a `picture` profile without embedded bytes, so rendering still must use the captured pin. All existing two-decode, pin, preview, manifest, download/foreign-ref denial and disk-reload assertions remain.
- `test/manualCommitDiff.test.ts`: retains explicit synthetic non-proxy config and real `store.load()` through mocked remote load, loaded connection/backend identity assertions, and the exact deferred remote commit Promise. Fresh LSP reported TS2550 for the prepared `Promise.withResolvers` under the configured library. Replaced only construction with the synchronous `new Promise` executor and a guarded resolver; the non-async one-shot mock, outer mock promise-identity assertion, release/await order, all diff and saved/not-configured dedup assertions remain. No microtask count, sleep, type suppression or non-null assertion was introduced.
- `test/storeEventDraftPreserve.test.ts`: prepared patch unchanged. Real store adoption/save path with synthetic loaded connection/identity and mocked remote I/O; cache mock returns `{ skipped: [] }`. Both full draft/canonical-profile preservation assertions remain; timers are fixture-controlled and manual flush awaited.
- `test/noLocalProjectDb.test.ts`: prepared patch unchanged. Allows exactly one `factory: IDBFactory = indexedDB` journal factory and one `typeof indexedDB !== "undefined"` capability check. Every other pattern/occurrence in these files and all other editor/project files remains scanned. No broad file/directory exemption.
- `test/aiJobApplication.test.ts`: prepared patch unchanged. Prepared/applied durable journal negative recovery tests use real HTTP repository/application/journal paths, close/reopen the journal, and reject missing canonical load or snapshot overwrite of later human edits. Full live-project equality, no mutation/undo growth, and receipt/server-state assertions remain; explicit presence guards remain.
- New `test/eventDraftVaultFixtureNamespace.test.ts`: prepared patch unchanged. Exact ephemeral/legacy timer-write characterization plus matching loaded-namespace control; no sleep/polling/microtask-count workaround.
- `test/transactionalNewRemoteProject.test.ts`: new narrow fixture repair. Explicit non-proxy `https://transaction-fixture.invalid` config; mock only initial remote load and resource cache, then call real `store.load()`. Assert loaded state, exact connection, backend/project identity and vault storage key before seeding. Remember and default-flush the SAME loaded namespace before the full pre-transaction storage snapshot. Reset the current vault in teardown. Every original project/draft/config/URL/full-storage rollback equality, identity guard, JSONB roundtrip, mismatch rejection, quota/welcome assertion and ordering assertion is unchanged. No production vault/auth/store/transaction code changed.

Before continuation, all six prepared files matched the parent's namespace-proof source manifest exactly. Only the report registration and Promise-construction compatibility correction changed those prepared files afterward; four prepared files remain byte-identical.

Full integration patch: sibling `G1-NONUI-FIX.patch`, including the untracked namespace test. The handoff and patch are ignored evidence files; the seven test changes remain unstaged. Parent must include the new namespace file when integrating.

## Verification results and retained failure

All seven changed/new test files received LSP diagnostics here. Six were immediately clean; manual commit TS2550 was corrected as above and its repeat diagnostics were clean. Report diagnostics were refreshed after resource registration and were clean. `git diff --check` passed after all code edits.

First focused run, `/var/tmp/g1-nonui-contract-HrboxvML/focused/`:

- 9 files passed, 1 failed; **108 passed, 6 failed**. Transaction 13/13 and namespace 2/2 already passed.
- All six report-family HTTP capture cases failed at `expect(report.failure).toBeNull()` (line 153 at that pin). Actual renderer failure: `item item_potion: imageResourceId가 존재하지 않습니다: report-pins-captured-item-artwork`.
- Cause traced through `renderJobReport -> parseProject -> collectResourceIds/validateItemResources`: the prepared new binding was not a registered resource. Fixed by registering only its generated resource profile, not weakening parsing or changing renderer policy.
- command/sandbox/launcher exits **1/1/1**, error=null, cleanup removed=true; scratch `/var/tmp/s0-slfct8_i` independently confirmed absent.
- Source SHA256 `e81aaa350b63c24187db3518fdefb4ecc894fddf09c3018133af8527666c7143`.

Final focused run, `/var/tmp/g1-nonui-contract-HrboxvML/focused-repaired/`:

- **10 files passed; 114/114 tests passed**, duration 287.67s.
- Application 27, reports 22, report-assets payload 29, canonical replay 6, identity 7, manual commit 4, draft preserve 2, lexical guard 2, namespace 2, transaction 13.
- command/sandbox/launcher exits **0/0/0**, error=null, cleanup removed=true; scratch `/var/tmp/s0-afknhdt9` independently confirmed absent.
- Run ID `2664f4ca-8f92-4dc1-a142-49dc671774d1`.
- Source SHA256 `2eacf6507884fe3c443b7e61b03b347e0d1bab7f3fd82367491cc474a22088b6`.

Both runs retain `command.log`, `receipt.json`, and `source.json`. Both source-manifest file hashes were recalculated and matched receipts. Both dependency hashes equal the matched full-gate hash `954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`. Both command hashes are `d208ce1021d20cbdca4c7c708b2b7d828bd0fcc4c20d4093ddee48ada4db7f44`. Both receipts confirm uid1000, capabilities0, noNewPrivileges=true, loopbackOnly=true and nonlocalRoutes0. Current contents of all seven test files were independently hashed against the final source manifest and matched.

## Final file pins (SHA256)

```text
c49f0c2634bf6d3140808494f6a0ee9937044bd1645048394beff2939513c7a9  test/aiReportAssetsPayload.test.ts
a9ee3eddcb7c73a8a377a08905ffde00627872a6526b8feb38e645c724999d78  test/manualCommitDiff.test.ts
11edae94f2046847e91077322bf7fa2705694fcca9e2356e8cf70ad84becbc7c  test/storeEventDraftPreserve.test.ts
99973d9a67dc99c59831bc7030292ef13177fc301506ddbc1532bc8280544b5e  test/noLocalProjectDb.test.ts
c155b18af66443164572ed86dbcfe8013a3f62b650cb1742a579b16d3ec1defa  test/aiJobApplication.test.ts
b9d36749417fe87a556c583b170a0593a0cea2325e9cb725cc5383511a47d9b4  test/eventDraftVaultFixtureNamespace.test.ts
2eb79ba9507d4d416df87d0a7cbd4f5dbc18e1443b43a61029068eabc25aecc8  test/transactionalNewRemoteProject.test.ts
```

## Exact executed payload

The first command created `S0_OUTPUT_ROOT` using `mktemp -d /var/tmp/g1-nonui-contract-XXXXXXXX`, yielding `/var/tmp/g1-nonui-contract-HrboxvML`, and called the function with label `focused`. After the evidenced resource registration fix, the same command/include set used label `focused-repaired`. No concurrent heavy command ran.

```bash
S0_SOURCE=/home/main/.herdr/worktrees/rpg-zzu/worktree-gate-contract-fixes
S0_HEAD=f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843
S0_INCLUDES=(
  --include test/aiReportAssetsPayload.test.ts
  --include test/manualCommitDiff.test.ts
  --include test/storeEventDraftPreserve.test.ts
  --include test/noLocalProjectDb.test.ts
  --include test/aiJobApplication.test.ts
  --include test/eventDraftVaultFixtureNamespace.test.ts
  --include test/transactionalNewRemoteProject.test.ts
)
S0_OUTPUT_ROOT=/var/tmp/g1-nonui-contract-HrboxvML
s0_nonui() {
  label=$1; shift
  /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/usr/sbin:/bin LANG=C.UTF-8 \
    /usr/bin/python3 -I -S -B \
    /home/main/.herdr/worktrees/rpg-zzu/worktree-silver-harbor-d2a7/scripts/qa/isolated-validation.py \
    --source "$S0_SOURCE" --expected-head "$S0_HEAD" \
    --dependencies /home/main/z-project/rpg-zzu/node_modules \
    --browser /dev/shm/task8-managed-chromium-cHQvga \
    --bun /home/main/.bun/bin/bun --scratch-root /var/tmp \
    --output "$S0_OUTPUT_ROOT/$label" --timeout 1800 \
    "${S0_INCLUDES[@]}" --retain-log -- "$@"
}
s0_nonui focused-repaired npm test -- --maxWorkers=1 --no-file-parallelism \
  test/eventDraftVaultFixtureNamespace.test.ts \
  test/aiReportAssetsPayload.test.ts test/aiJobReports.test.ts \
  test/manualCommitDiff.test.ts test/storeEventDraftPreserve.test.ts \
  test/transactionalNewRemoteProject.test.ts test/noLocalProjectDb.test.ts \
  test/aiJobApplication.test.ts test/aiJobIdentity.test.ts test/aiJobCanonicalReplay.test.ts
```

No build/full G1/browser verification is claimed. No production/source policy, baseline, UI, region runner or launcher edit is included. All owned S0 scratch was removed; only retained evidence output remains. Heavy slot is returned to parent/progress worker.
