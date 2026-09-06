# Report-only worker bootstrap isolation

Task `st_01a07873`; parent/root `01a07570-b72c-7248-95f8-b3ac9bb31f7a`.

Delivered and verified in `/home/main/.herdr/worktrees/rpg-zzu/worktree-ai-report-bootstrap-0906`, branch `worktree/ai-report-bootstrap-0906`, base/HEAD `3206b7fd5a43f819c87f3f56ccb9aba2cd658df1`. No commit, staging, push, PR, integration, paid call, real installation, user-project/remote DB write, or shared-cache deletion was performed. Caller silver-harbor and the active main UI were not edited or integrated. Only loopback port 19842 was used for this proof, not 19841 or 9841.

## Exact patch

1. `src/ai/jobs/workerEntry.ts`: remove six eager executor imports; keep `renderJobReport` as a type-only import for the unchanged global return type. Each existing exhaustive family branch uses its literal dynamic import and calls the same executor with the same input/host. The report invocation dynamically imports only its renderer. Production diff is 8 added / 14 removed lines.
2. `test/aiJobReportBootstrap.browser.mjs`: new focused, real managed-browser regression. One captured map report proves RED/GREEN, immutable report/artifact SHA checks, real PNG dimensions/pixels, actual preview viewing/screenshot, independent states, request graphs at readiness/completion, and provider-free report operations. A fresh actual database-generation realm then proves the lazy executor still executes and returns a private generated item using a single local fixture provider response. Optional arguments are run label and an existing production build directory containing `.vite/manifest.json`.
3. `openwiki/architecture.md`: document literal lazy dispatch, unchanged full-potential-closure isolation coverage, the focused browser command and owned cleanup.
4. `.omo/evidence/ai-job-queue/report-bootstrap/`: this handoff, command logs, raw request graphs, screenshots, production manifest/chunk mapping and cleanup receipts. Evidence is gitignored; supervisor must explicitly select it for integration if desired.

No HTML, scheduler, browser executor, renderer, host capability allowlist, executor implementation, or existing test was modified. `test/aiJobWorkerIsolation.test.ts` remains unchanged: its runtime graph follows literal dynamic imports and still requires `assistantSessionCore` in the full potential closure. It was not weakened into an initial-only graph.

## Mechanism and contracts

The scheduler already selects a report attempt separately from generation. `browserExecutor.mjs` starts the same `ai-job-worker.html` in a fresh managed realm, exposes scoped bindings, waits for `__aiJobReady`, then calls the appropriate global. Previously static entry imports initialized both pipelines before readiness, even when the invocation was report-only. The correction moves loading to the existing selected invocation, not a new loader/page/protocol.

The same globals, promise return types, exhaustive six-family routing and host construction remain. Report bindings still allow only immutable reads/writes plus `saveReport`; they have no provider/checkpoint authority. Abort/cleanup and failed dynamic import handling remain owned by the same managed runtime and scheduler. Generated, applied, and saved semantics are unchanged. The proof asserts succeeded / awaiting-review / unsaved and not-applied, and the existing report suite covers exact applied artifacts, late receipts/save evidence, drafts/noChanges, cancellation fencing and retained previews.

This removes unnecessary initialization. It does NOT establish that static imports were the sole cause of the separately observed approximately 98.7-second UI refresh, and establishes no latency or speed ratio. There are no wall-clock pass thresholds, sleeps or polling in the new proof. It subscribes to readiness and exact report terminal events before triggering work; generation awaits its real returned result. Timeouts are bounded failure deadlines only.

## Deterministic RED before production edits

The new browser assertion was added and run while `workerEntry.ts` still had all eager imports. A real report completed successfully first, both previews decoded with expected pixels and matching SHA-256, and the screenshot/evidence were saved. Then this assertion failed (exit 1):

```
AssertionError [ERR_ASSERTION]: Report-only request graph must exclude generation executors and assistant session
+ /src/ai/jobs/executors/assistantJob.ts
+ /src/ai/jobs/executors/databaseJob.ts
+ /src/ai/jobs/executors/eventCommandsJob.ts
+ /src/ai/jobs/executors/imageJob.ts
+ /src/ai/jobs/executors/tilesetJob.ts
+ /src/ai/jobs/executors/regionJob.ts
+ /src/ai/assistantSessionCore.ts
+ /src/ai/jobs/sessionHost.ts
- []
```

`red.log` contains the exact full URLs and assertion output. `red-browser.json` captures all requests and successful script responses, including those present when the real readiness binding ran. This is not a source-prose/import-string test, missing import, syntax error, or boot timeout.

Two preliminary environment/setup failures are not represented as RED: the first shell redirection ran before the evidence directory existed, so no test ran; after creating it, `/tmp` mkdtemp failed with ENOSPC (`red-environment.log`, exit 1). Storage inspection showed the root filesystem near full and ample `/dev/shm` space. Subsequent runs use `TMPDIR=/dev/shm`; no cache was deleted to repair the environment.

## Commands and observed exits

Every command ran with explicit `cd /home/main/.herdr/worktrees/rpg-zzu/worktree-ai-report-bootstrap-0906`. Below, `ROOT` abbreviates that absolute directory and `EVIDENCE` abbreviates `$ROOT/.omo/evidence/ai-job-queue/report-bootstrap`. Commands were redirected to the indicated log and their actual process status captured, not inferred from a pipe.

| Command | Exit / evidence |
| --- | --- |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" red` before production edit | 1, intended assertion above; `red.log` |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" green` after minimal production edit | 0; `green.log` |
| `TMPDIR=/dev/shm npm test -- --maxWorkers=1 --no-file-parallelism --testTimeout=60000 test/aiJobReports.test.ts test/aiJobWorkerIsolation.test.ts test/aiJobWorkerRouting.test.ts test/aiSessionJobHost.test.ts test/regionSnapshot.test.ts` | 0; 36 tests / 5 files, one invocation; `focused-green.log` |
| `TMPDIR=/dev/shm node --test --test-concurrency=1 "$ROOT/test/aiJobsScheduler.test.mjs" "$ROOT/test/aiJobsHttp.test.mjs" "$ROOT/test/aiJobsRepository.test.mjs" "$ROOT/test/aiJobsBrowserExecutor.test.mjs"` | 0; 56 tests, zero failures/skips; `node-green.log` |
| `TMPDIR=/dev/shm npm run typecheck:app` | 0; `typecheck-app.log` |
| `build_dir=$(mktemp -d /dev/shm/ai-report-bootstrap-build-XXXXXX)` then `TMPDIR=/dev/shm VITE_CACHE_DIR="$build_dir/vite-cache" npm run build:app -- --outDir "$build_dir/dist" --manifest` | 0; actual directory `/dev/shm/ai-report-bootstrap-build-nH3Kpw`; `build-app.log`, `build-directory.txt` |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" production /dev/shm/ai-report-bootstrap-build-nH3Kpw/dist` | 0; actual emitted worker/report/database chunks; `production-browser.log` |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" green-final` after adding optional built mode | 0; `green-final.log` |
| `node --check "$ROOT/test/aiJobReportBootstrap.browser.mjs"` | 0, including final cleanup revision |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" cleanup-green` after cleanup clarification | 0; final source-mode proof and automatic own-directory removal; `cleanup-green.log` |
| `TMPDIR=/dev/shm node "$ROOT/test/aiJobReportBootstrap.browser.mjs" cleanup-production /dev/shm/ai-report-bootstrap-build-nH3Kpw/dist` | 0; final emitted-mode proof and automatic own-directory removal; `cleanup-production.log` |
| Node assertions comparing RED/final dev/final production preview objects, copied manifest, removed only recorded owned roots, then checked absence | 0; `cleanup-receipt.json` |
| `git diff --check` | 0 |
| `ss -ltn '( sport = :19842 )'` | 0; header only, no remaining listener |

LSP diagnostics for changed `workerEntry.ts` and the browser proof returned no diagnostics, including the final cleanup revision. Markdown LSP was requested for the changed architecture note but no `.md` server is configured; no markdown-LSP success is claimed.

Build used the actual production app MPA config, not a synthetic worker-only bundle. Its manifest contains all six executor dynamic entries plus the report renderer, and the worker has only preload helpers as static imports. `production-manifest.json` and `production-chunks.json` retain this evidence after owned build cleanup. The browser proof serves the emitted worker HTML/assets unchanged through local static GET middleware; only the separate fixture/viewer page still uses dev modules. It asserts the built report worker does not fall back to `/src/` requests. Both report and database generation actually ran from emitted assets.

Build warnings are retained, not suppressed: external outDir will not be emptied; mixed static/dynamic imports for unchanged playSceneInterpreter/editorUiMode/devProjectPersistence/player modules; chunks above 500 kB. There is no full `npm run build` (player/standalone), full gates, or main UI signoff claim; supervisor owns those final gates. No unrelated warning was fixed.

## Actual browser graph and preview evidence

Counts below are distinct successful script-response URLs observed in managed realms, not inferred source closure counts. The dev count includes the empty `/@vite/client` transport response. At readiness the static module graph has completed evaluation; completion captures the selected pipeline's additional requests. Full URL lists and host-method logs are in each `*-browser.json`.

| Mode / stage | At `__aiJobReady` | At completion | Generation executor/session URLs during report |
| --- | ---: | ---: | --- |
| RED dev report | 672 | 672 | six executors, assistantSessionCore, sessionHost |
| Final GREEN dev report | 2 | 253 | none |
| Final GREEN dev database generation | 2 | 576 | database executor loaded on invocation |
| Final emitted report | 3 | 11 | none |
| Final emitted database generation | 3 | 14 | database executor chunk loaded on invocation |

Report complete URL categories:

| Category | RED | GREEN dev |
| --- | ---: | ---: |
| optimizer/dependencies | 1 | 0 |
| @vite | 1 | 1 |
| src/ai | 77 | 7 |
| src/assets | 47 | 34 |
| src/battle | 30 | 2 |
| src/brand.ts | 1 | 1 |
| src/editor (store-free helpers included) | 197 | 30 |
| src/player | 39 | 2 |
| src/project | 273 | 174 |
| src/testing | 2 | 0 |
| src/util | 4 | 2 |

The emitted report loads 11 `/assets/` scripts, none of the manifest's executor, assistantSessionCore or sessionHost chunks. Source and emitted graphs are separate evidence; no claim is made that one production chunk equals one source module.

Every successful proof has zero page/service errors and zero report provider calls. Each generation smoke uses exactly one local fixture `database/text` response, creates `Bootstrap Potion` priced 37 in the real returned private snapshot, leaves the original snapshot unchanged, and retains `persistence: not-applicable`. No external provider operation is dispatched.

Real map preview pixels at (8,8), dimensions and hashes are identical across RED, final dev and emitted production:

| Phase | Dimensions | RGBA | SHA-256 |
| --- | --- | --- | --- |
| before | 128 x 128 | `[220,50,40,255]` | `9f6e3477574e5c5076084bb94f60da9ff6488a332cf7a2e189919c535b264642` |
| generated | 128 x 128 | `[40,90,220,255]` | `279ae7c541b01c96abcbcb1a9e662e62e4a872090c295ccd4c671acd33bbc251` |

The returned report's own bytes are SHA-verified against its immutable ref. Report hashes themselves need not match between runs because attempt/job IDs differ. Artifact bytes above do match. Screenshots `red-previews.png`, `cleanup-green-previews.png` and `cleanup-production-previews.png` show actual decoded returned artifacts in Chromium, not fabricated canvas substitutes. The image-read tool reported this model cannot view images, so pixel/decoding/hash evidence is verified but aesthetic screenshot review is not claimed. This is report-pipeline proof, not main report-window UX, gameplay QA, or remote-save evidence.

## Cleanup receipt and ownership

After the user's clarification, the checked-in proof's `finally` closes viewer, service, server and owned managed contexts/browsers, then removes only its own `mkdtemp` root (repository plus isolated Vite cache). Each run writes a cleanup receipt after removal. A supplied build is explicitly caller-owned and is never deleted by the proof. This proof does not itself create a build root.

`cleanup-green-cleanup.json` and `cleanup-production-cleanup.json` report `temporaryRemoved: true`, zero managed contexts/browsers and no cleanup errors. A subsequent independent filesystem check confirmed those directories were already absent. Earlier runs had conservatively retained owned directories before the clarification; final cleanup removed exactly their recorded roots:

- `/dev/shm/ai-report-bootstrap-GKQgJW` (RED)
- `/dev/shm/ai-report-bootstrap-iV7wuL` (GREEN)
- `/dev/shm/ai-report-bootstrap-Hi83mG` (GREEN final)
- `/dev/shm/ai-report-bootstrap-j7Kalz` (emitted production)
- Final self-cleaned roots: `/dev/shm/ai-report-bootstrap-7rnXhT`, `/dev/shm/ai-report-bootstrap-uKkIXf`.

The shell-owned `/dev/shm/ai-report-bootstrap-build-nH3Kpw` root was removed after both emitted proofs and after copying its manifest/chunk evidence. `cleanup-receipt.json` records and verifies absence of every root. Shared node_modules/Vite/Playwright caches and all evidence remain untouched. Port 19842 has no listener. Existing Node tests close their own repositories/listeners via teardown. No owned browser/server/provider process is intentionally left running.

All requested narrow implementation and verification work is complete. Supervisor retains independent verification, safe-boundary integration, final full gates and isolated-worktree cleanup ownership.
