# Full generation-family integration - supervisor evidence

Date: 2026-09-06. Scope: plan task4 and its transport/identity integration fixes.
Application, inbox and report UI remain subsequent plan work.

## Integrated adapters

| Family | Integrated commits | Supervisor focused verification |
| --- | --- | --- |
| Database | a4b063354 |57 tests, app typecheck, changed-file diagnostics |
| Event commands | f147ad1b4 |103 tests, app typecheck, changed-file diagnostics |
| Image | a84a0c9e6 + d5bff940f |29 tests including actual Chromium and fs-reopen retry, app typecheck |
| Tileset | fa54b9157 + c1198fde2 |112 tests including all non-cluster fs retries, app typecheck |
| Region/shared replay |9790d7d82 +1a8b48504 |154 tests plus13 scheduler tests, app typecheck |

All five isolated worktrees were removed after integration; branches/commits retained.

## Failing-first integration corrections

- Actual worker entry rejected database and event-commands requests. New routing
  tests captured those failures before their branches were registered.
- Real Chromium rejected image/tileset jobs at the unregistered dispatcher.
- Private Vite optimizer cache was blocked:607 requests,606 complete, zod.js denied.
  Node RED verified missing cacheDir propagation and a denied valid cache asset.
  The fix passes only the configured cache directory; traversal/adjacent files stay denied.
- Native review identity changed after canonical fs storage despite deep-equal tileset
  data. A new actual repository roundtrip test failed before the fingerprint correction.
  Separate tests retain sensitivity to tile-size and tile-array-order changes.
- A real static GET ECONNRESET escaped an async Playwright route callback and exited
  Node. A focused handler-escape RED reproduced the boundary defect. Errors now fail
  only the owning job, and one safe static GET reset is retried. A real Chromium test
  forces the socket reset and proves two GETs, zero provider calls and successful boot.
- The final region dispatcher RED was captured after transport correction:
  648 requests completed without errors, then the exact unregistered-region error.

No failed assertion was suppressed. One root event fixture omitted the required page
name; the fixture was corrected without relaxing the project validator. Cold-import
timeout was not counted as routing RED; the actual missing-family error was captured.

## Final supervisor run

Monitor `mon_SF7M45AWJKYRZP55` completed **exit0**:

```sh
node --test test/aiJobsBrowserExecutor.test.mjs
node .omo/evidence/ai-job-queue/task-4-runtime/proof.mjs
npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobWorkerRouting.test.ts test/aiJobWorkerIsolation.test.ts test/aiJobCanonicalReplay.test.ts
node --test test/aiJobsRepository.test.mjs test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs
npm run typecheck:app
npm run build:app
```

Observed:9 browser-transport tests;12 actual runtime scenarios;9 routing/canonical
tests;46 repository/HTTP/scheduler tests; app typecheck and build passed.
The preceding native/tileset regression run passed115 tests after the fingerprint fix.

`results.json` contains every successful runtime receipt:
assistant, database, event-commands, image, region, and tileset knowledge-analysis,
proposal-draft, question-followup, structure-kit-metadata, cluster-edit,
range-classify and unclassified-analysis.

The proof uses real HTTP, fs repository, Chromium, worker dispatcher, domain helpers,
image decoding and pixel checks. Only the paid provider wire endpoint is controlled.
Cluster runtime scenarios request inspection; actual cluster mutation/rendering and
replay contracts are additionally exercised in the focused adapter suite.

Each job remained `awaiting-review` and `unsaved`; input data was unchanged. These
statuses are intentional and are not claims of live application or remote saving.

## Cleanup and residual baseline

All normal and diagnostic runs closed owned HTTP/Chromium/state/cache resources.
After the one uncaught pre-fix Node failure, its dead writer PID and known failed job
UUID identified the leftover queue directory; its paired cache had the same creation
timestamp. Both were removed. No owned Chromium process remained.

No paid provider, user project or Supabase write occurred. Pre-existing port9841 was
untouched; owned runtime port19841 was released.

Broader pre-existing map-edit/tile-graft/workspace fake-DOM failures are recorded in
the adapter handoffs. LSP also reported missing declarations on unchanged companion
imports in Vite config; no new cache/worker declaration error was reported. The
repository's app typecheck and actual app build passed. Full baseline gates remain
the final integration stage, not claimed here.
