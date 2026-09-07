# Task8 executor availability - resolved on Astra

Date: 2026-09-07. Task: st_01a07982. No commit, build, full gates, UI edits, parser edits, or UI-image inspection.

## Outcome

The existing Chromium runtime was not absent. The real local entry (`vite.config.ts`, `configLoader: 'runner'`, `/api/ai-jobs`) now reports generation/report availability and returns **202** for an isolated admission. No download, package installation, browser-version switch, provider substitution, or unavailable-admission weakening was needed.

`HANDOFF.md`'s assertion that managed Chromium was not installed is disproven by the installed-runtime access and actual launch/close checks below. The prior setup result `installed: false` means no installation was necessary, not that Chromium was absent.

## Exact root cause

1. `vite.config.ts` registers `aiJobsPlugin(({ origin, cacheDir }) => createBrowserRuntime({ origin, cacheDir }))`.
2. `aiJobsPlugin.attach` invokes that runtime factory during `configureServer`, after Vite has evaluated its configuration.
3. Vite's `runnerImport` (`node_modules/vite/dist/node/chunks/dep-Dm0c1Wj2.js`) closes the configuration environment in its `finally` block before returning the loaded config. Deferred dynamic imports in functions loaded by that runner still reference the disposed runner.
4. `createBrowserRuntime` used `await import('playwright')` inside that later factory invocation. Reproducing that exact deferred expression under the runner produced an **import-stage** failure:

   ```text
   Error: Vite module runner has been closed.
     at ModuleRunner.getModuleInformation (.../vite/dist/node/module-runner.js:1201:13)
     at ModuleRunner.cachedModule (.../vite/dist/node/module-runner.js:1191:21)
     at request (.../vite/dist/node/module-runner.js:1227:99)
     at dynamicRequest (.../vite/dist/node/module-runner.js:1229:124)
   ```

5. The runtime's existing combined import/access catch converted that error into the generic missing-Chromium unavailable reason. No executable-access attempt was reached through the failed import. The scheduler therefore had no `executeJob` and correctly rejected admission.

Before the fix, an owned service using the actual project config returned:

```json
{"generationAvailable":false,"reportAvailable":false,"requiresRestart":false,"unavailableReason":"Managed Chromium is unavailable. Run npm run setup:ai-runtime in the project folder, then restart the local server before submitting AI jobs."}
```

A session/CSRF-authenticated POST returned HTTP 503 with `code: EXECUTOR_UNAVAILABLE`; the actual server logged `AiJobsServiceError` from `scheduler.available` through `http.mjs:route`. Direct Node creation of the same runtime succeeded. This distinguishes Vite wiring from package/cache/OS prerequisites.

The import-stage reproducer and full stack are retained in `runtime-import-diagnostic.mjs` and `executor-import-error.txt`. It intentionally reproduces the old deferred import independently; it does not replace production runtime wiring.

## Minimal correction

Changed `scripts/lib/aiJobs/browserExecutor.mjs` only at the runtime package-loading seam:

```diff
+import { createRequire } from 'node:module';
-    chromium ??= (await import('playwright')).chromium;
+    chromium ??= createRequire(import.meta.url)('playwright').chromium;
```

The package load remains deferred, checkout-relative, and inside the existing unavailable guard, but is now owned by Node rather than Vite's disposed configuration runner. Supplied-Chromium behavior, executable `X_OK` validation, managed executable selection, default provider adapter, scheduler admission, and backend identity are unchanged.

Added `test/aiJobsViteRuntime.test.mjs` and a focused note in `openwiki/testing.md`. The regression creates the real configured Vite service with isolated private state/cache, checks both executor availability flags, and confirms malformed admission reaches HTTP 400 `INVALID_DATA` beyond the availability guard without creating a job.

Existing servers need to be restarted by their owners to load the correction. No existing listener was restarted here.

## Installed-runtime evidence

Read-only package/access check and actual existing-browser launch/close were performed **before** starting any service probe or changing production code. Repeated in the final reproducible proof:

| Item | Observed value |
| --- | --- |
| Node | v24.11.1, `/usr/local/bin/node` |
| Worktree | `/home/main/.herdr/worktrees/rpg-zzu/worktree-silver-harbor-d2a7` |
| Shared node_modules realpath | `/home/main/z-project/rpg-zzu/node_modules` |
| Playwright entry | `/home/main/z-project/rpg-zzu/node_modules/playwright/index.js` |
| Playwright / @playwright/test | 1.61.0 / 1.61.0 |
| Executable | `/home/main/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` |
| Access | `X_OK` succeeded |
| Actual launched browser | Chromium 149.0.7827.55 |
| Browser cleanup | `await browser.close()` completed |
| HOME / TMPDIR | `/home/main` / `/dev/shm` |
| PLAYWRIGHT_* environment overrides | None |

No setup/install command or download was run in this task. No dependency prerequisite remains for the measured availability path.

## Real local admission evidence

Command, exit 0:

```sh
TMPDIR=/dev/shm node .omo/evidence/ai-job-queue/task-8/verify-executor-availability.mjs
```

Evidence: `executor-installed-admission.json`, `executor-admission.txt`, and the reproducible script above.

- Owned service: `http://127.0.0.1:19841`, PID 2871816 for the successful final probe; actual project config with runner loader.
- Isolated `AI_JOBS_DIRECTORY` and `VITE_CACHE_DIR` beneath a unique `/dev/shm/task8-executor-proof-*` directory, removed after service close. No existing queue was reused.
- Session: `generationAvailable: true`, `reportAvailable: true`, `requiresRestart: false`.
- Configured backend, unchanged from the pre-fix probe: `supabase-proxy:6c0fac7eba408cfc4f6081240871bf070fd1b460c06895c07dd4150b08dbe6d0`.
- POST: **202**, `created: true`, job `a0b0b384-5f16-4a82-9fe9-db958532ee0d`.
- The submitted job retained that exact backend and synthetic project ID `task8-executor-availability-isolated-fixture`; no switch to a local backend or real user project.
- SSE was connected before POST. Its exact durable `admitted` event (seq 1) identified the same job, with generation `queued`.
- Cancel: HTTP **200**, generation `cancelled`.
- Job detail: `providerOperations: []`. Zero paid calls and zero user-project writes.

The admission fixture deliberately uses an invalid empty assistant payload, which is rejected before any provider invocation if execution wins the cancellation race. It is not a successful-generation fixture. The service uses the production provider adapter unchanged; no held/fake provider was substituted. No Apply/save/project-network surface was called. The scope of this proof is installed runtime plus real admission, not Task8 family-generation/UI acceptance.

Port ownership was checked before every use of 19841: no listener existed. Final `ss -lptn '( sport = :19841 or sport = :9841 )'` showed no 19841 listener and the unchanged pre-existing 9841 listener owned by PID 2252417. That listener was never requested, reused, signalled, or cleaned up.

## RED then GREEN and validation

1. **RED**, before production edit:
   `TMPDIR=/dev/shm node --test test/aiJobsViteRuntime.test.mjs`
   exited 1. The real service's `generationAvailable` was `false`, failing `false !== true`. Full output: `executor-red.txt`.
2. **GREEN**, single combined run after correction:
   `TMPDIR=/dev/shm node --test test/aiJobsViteRuntime.test.mjs test/aiJobsBrowserExecutor.test.mjs test/aiJobsRuntimeSetup.test.mjs`
   exited 0: **25 passed, 0 failed, 0 skipped**. Output: `executor-green.txt`.
   This includes the existing real-browser boot test and the missing-executable admission test; absent Chromium still rejects admission without durable doomed work.
3. The first manual-proof run failed only during cleanup: aborting the SSE fetch before `reader.cancel()` made cancellation reject with `AbortError`. Its server/private state were still cleaned up. Preserved output: `executor-admission-cleanup-red.txt`. The evidence script now cancels the reader before aborting the controller, with server/state cleanup protected by `finally`; its subsequent real admission run exited 0.
4. LSP diagnostics: no diagnostics for the production runtime, new regression test, and initial evidence scripts. The final evidence-script diagnostic refresh timed out; its final `node --check` and actual execution passed. Markdown has no configured LSP server.
5. `node --check` succeeded for the production runtime, regression test, and final proof script. Workspace `git diff --check` reported an unrelated existing `src/editor/tilesetAiNativeReviewSession.ts:230` blank line at EOF; not changed here.

No full build/gates or commit was run, as requested. UI/capture helpers and the separately delegated payload-parser work remain untouched. Linux evidence does not establish macOS behavior or paid provider authentication/completion.
