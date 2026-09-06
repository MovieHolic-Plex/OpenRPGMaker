# ai-job-queue-visual-reports - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** AI 요청을 맡긴 뒤 편집을 계속하고, 브라우저를 닫아도 로컬 서버가 생성과 이미지 중심 보고서를 완성합니다. 다시 접속하면 작업함과 알림함에서 결과를 확인하고 안전하게 반영합니다.

**Why this approach:** 기존 브라우저 기반 AI·렌더링을 격리된 서버 소유 실행기에서 재사용하고, 실제 프로젝트 반영은 올바른 프로젝트가 열린 편집기로 제한합니다.

**What it will NOT do:** 컴퓨터·로컬 서버가 꺼진 동안 계속 실행하거나, 외부 알림 업체를 추가하거나, 보고서 장식용 유료 이미지를 생성하지 않습니다.

**Effort:** XL
**Risk:** High - 실행 수명, 동시 편집, 지연 적용과 저장 증거를 분리하는 전면 변경
**Decisions to sanity-check:** 로컬 서버 실행, 앱 안의 영속 알림함, 기존 자동/검토 적용 정책 유지, 충돌 시 결과 보존. 사용자가 구현·커밋·PR을 승인했습니다.

Your next move: Approved for implementation and PR on 2026-09-06; no further generic approval and no merge. Full execution detail follows below.

---

> TL;DR (machine): XL / High / durable local jobs, six AI families, visual reports, safe apply, verified commits and PR

## Scope
### Must have
- Full six-family migration, durable local-server ownership, in-app inbox, pinned image-rich reports, cancel/retry/recovery, guarded application, dev/preview parity and commits/PR.
- Source evidence and inventory: .omo/drafts/ai-job-queue-visual-reports.md; execution notepad: .omo/drafts/ai-job-queue-execution-notepad.md.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No hosted executor, provider switch, external messaging service, paid decorative report generation, destructive Git command or PR merge.
- No hidden editor boot in worker, user profile reuse, worker project-save authority, browser-owned fallback, blind replay after unknown provider/apply outcome, stale full-project overwrite or false remote-save claim.
- No unrelated cleanup; preserve user changes, existing runtime/player contracts and default remote project data.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Vitest/Node test and Playwright E2E; pure documentation by read review, no prose tests.
- Goal criteria C1-C6 and exact surface matrix: .omo/drafts/ai-job-queue-execution-notepad.md. Port 9841 belongs to this adopted worktree; override only after checking occupancy. Intercept provider HTTP/host adapter with deferred real wire responses, not entire job runner mocks. Subscribe before triggering; no fixed sleeps or polling waits.
- LSP before builds. Supervisor personally runs npm run gates and HTTP/browser acceptance; baseline pre-existing failures are reported, not suppressed. Child summaries alone are not evidence.
- Evidence: `.omo/evidence/ai-job-queue/task-N/` for each numbered task; `c1/` through `c4/` for cross-cutting acceptance and `verification/` for final gates.

## Execution strategy
### Parallel execution waves
- Foundation: 1 -> 2. Execution: 3 -> 4. Application/reports: 5 -> 6. UI and full migration: 7 -> 8 -> 9.
- Shared worktree means exactly one coding worker at a time. Route backend/logic/executor to deep; UI to visual-engineering. Read-only audits may run concurrently. Supervisor owns real QA/commits/PR. No extra worktrees unless independent coding is actually dispatched.
### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2 | read-only review only |
| 2 | 1 | 3 | read-only review only |
| 3 | 2 | 4 | read-only review only |
| 4 | 3 | 5 | read-only review only |
| 5 | 4 | 6 | read-only review only |
| 6 | 5 | 7 | read-only review only |
| 7 | 6 | 8 | read-only review only |
| 8 | 7 | 9 | read-only review only |
| 9 | 8 | F1-F4 | read-only review only |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. Define job contracts and durable local repository
  - Recommended task executor category: deep
  - References / edit scope: src/ai/jobs/contracts.ts; scripts/lib/aiJobs/repository.mjs; test/aiJobsRepository.test.mjs
  - Implementation: Define versioned six-family input/result unions and separate generation, report, application and save states. Store immutable input/project/artwork blobs by SHA-256 outside public/dist. Use ONE atomic fsynced metadata snapshot containing jobs, attempts, operations, events and inbox (temp write, fsync, rename, directory sync), with one serialized writer and exclusive process ownership. This intentionally replaces the advisory journal/compaction machinery with the smaller equivalent single-file transaction; do not split jobs and inbox into separately written files. Admission succeeds only after blobs and metadata are durable. Keep nonterminal/unapplied/unread records; no implicit eviction. Validate disk input and fail loudly on corruption. Recover previously running attempts as interrupted, not automatic paid replay.
  - Acceptance: Durable reload returns identical job/inbox; duplicate key is one job; mismatched key payload conflicts; failed persistence admits no job; second writer fails; corruption is explicit.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `node --test test/aiJobsRepository.test.mjs`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `node --test test/aiJobsRepository.test.mjs`; evidence `.omo/evidence/ai-job-queue/task-1/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Inject failed write/fsync before acknowledgement and simulate process restart; no success event or paid dispatch.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 2. Implement scheduler provider ledger and local HTTP service
  - Recommended task executor category: deep
  - References / edit scope: scripts/lib/aiJobs/{http,scheduler,providerOperations}.mjs; vite.config.ts; test/aiJobsHttp.test.mjs; test/aiJobsScheduler.test.mjs
  - Implementation: Attach /api/ai-jobs to dev and preview. POST admission requires Idempotency-Key; GET list/detail; replayable SSE /events?after=; cancel/retry; manifest-scoped artifact reads; inbox read acknowledgements; application claim/evidence endpoints. Exact same-origin Origin/Host validation, JSON-only writes and a local service session/CSRF token protect mutations; no permissive cross-origin or arbitrary URL fetching. Single active job, one provider operation; dependencies explicit. Persist dispatch and response before worker receives them. Fence results by attempt identity; persist cancel before signaling. Retry known safe failed stages only; uncertain dispatched outcome needs explicit duplicate-spend acknowledgement, never hidden client retry. Store credentials only in existing Node provider auth; reject secrets in job payloads. Return 503 when executor unavailable, not browser fallback.
  - Acceptance: Real HTTP 202/detail/SSE replay works after disconnect, 409 duplicate mismatch, cross-origin rejected, cancellation late result cannot resurrect, provider response reused after worker interruption.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `node --test test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `node --test test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs`; evidence `.omo/evidence/ai-job-queue/task-2/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Deferred provider request, cancel then retry and resolve old request last. Capture status/headers/body and exact physical dispatch count.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 3. Add isolated server-owned browser execution and session host
  - Recommended task executor category: deep
  - References / edit scope: ai-job-worker.html; src/ai/jobs/workerEntry.ts; scripts/lib/aiJobs/browserExecutor.mjs; src/ai/assistantSession.ts; src/ai/jobs/sessionHost.ts; test/aiJobWorkerIsolation.test.ts
  - Implementation: Lazily launch managed Chromium with fresh context per attempt, service workers blocked and typed Playwright bindings. Worker entry must not import main.ts, editor panels, store singleton or PWA. Remove worker-consumed mixed tool barrels. Inject session host for baseline reads, milestone draft checkpoints and persistence verification; existing editor adapter retains current foreground semantics. Worker runs only against submitted snapshot and checkpoints private drafts, never saves remote project or labels checkpoints applied. Restrict navigation/network to worker bootstrap/static assets and bound host provider bridge; no credentials or user browser profile. Dispose context/browser on cancellation/shutdown; server restart retains ledger and reports interrupted stage.
  - Acceptance: Actual isolated worker imports execute without editor boot/store persistence, completes a held provider response after submitting user tab closes, and retains result after server restart.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobWorkerIsolation.test.ts test/aiSessionJobHost.test.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobWorkerIsolation.test.ts test/aiSessionJobHost.test.ts`; evidence `.omo/evidence/ai-job-queue/task-3/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Worker crash after durable provider response must retain paid response; no automatic duplicate dispatch; dedicated worker dev and built entry both load.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 4. Implement all six generation family adapters
  - Recommended task executor category: deep
  - References / edit scope: src/ai/jobs/executors/{assistantJob,regionJob,databaseJob,eventCommandsJob,tilesetJob,imageJob}.ts; src/editor/aiDatabaseGeneration.ts; existing region/event/tileset orchestration helpers; test/aiJobExecutors.test.ts
  - Implementation: Each adapter outputs typed immutable proposals/artifacts without live mutation. Assistant handles chat/autonomous plus DB assistant/MCP routing; internal intent/planning/compaction/verification are tracked operations. Region retains clipping, house protection, diagnostics and extra interior maps, with per-job draft rather than singleton pending slot. DB retains text, IDs and artwork separately for retry; image includes stable record/field binding, not a DOM callback. Event assist returns commands/diff and exclusion choices for explicit review. Tileset family covers cluster/question/proposal/native knowledge/structure-kit operations using extracted orchestration, not modal imports. Captured follow-up dependencies bind to predecessor output; unrelated work uses submission snapshot.
  - Acceptance: Every family runs through real helper/tool seams with deferred wire provider and returns correct artifact/proposal; no store write; text/artwork/postprocess failures retain completed stages.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobExecutors.test.ts test/aiDatabaseGeneration.test.ts test/eventCommandAssist.test.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobExecutors.test.ts test/aiDatabaseGeneration.test.ts test/eventCommandAssist.test.ts`; evidence `.omo/evidence/ai-job-queue/task-4/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Run database generation for project A then switch editor to B; all result identity remains A. Retry failed artwork only, not completed text; report rendering never calls provider.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 5. Add guarded idempotent delayed result application
  - Recommended task executor category: deep
  - References / edit scope: src/ai/jobs/resultPatch.ts; src/editor/aiJobs/applyJobResult.ts; src/project/store.ts; src/editor/tools/applyChangesetToStore.ts; test/aiJobApplication.test.ts
  - Implementation: Compute deterministic base->generated changes, never replay generation tools or allocate IDs again. Three-way merge keyed record/resource/map units; command arrays and tile payloads atomic. Preserve unchanged live siblings; overlap/deletion/reference or creation-ID collision conflicts retain output. Where semantic read dependencies are unknown, whole-project baseline mismatch blocks application. Validate final project and existing house/reference guards. Project identity includes backend and project ID (persist local UUID for local project); recheck before sync mutation. Server application claim plus per-project browser lock and durable local receipt/recovery snapshot prevent duplicate application across tabs. Crash uncertainty is explicit, not replay. Preserve existing auto surfaces when matching editor available and safe; preserve explicit review surfaces; closed editor means awaiting-editor. One undo and AI attribution. Remote saved requires this job snapshot confirmed by normal reload; failed/unknown map publication stays unsaved, not inferred from commit log. Never claim global cross-device transactions.
  - Acceptance: Unrelated edits survive, same-unit edits conflict, target switch rejected, two tabs claim one apply, one undo/receipt; save failure reports applied but not saved and does not regenerate.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobApplication.test.ts test/aiApplyActivityLabels.test.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobApplication.test.ts test/aiApplyActivityLabels.test.ts`; evidence `.omo/evidence/ai-job-queue/task-5/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Lose acknowledgement around application: reconcile exact receipt or outcome-unknown. Test canonical/map-row publication failure and no false saved report.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 6. Build immutable image-rich report artifacts
  - Recommended task executor category: deep
  - References / edit scope: src/ai/jobs/{reportModel,renderJobReport}.ts; src/editor/regionSnapshot.ts; test/aiJobReports.test.ts
  - Implementation: Typed report model references job/attempt/snapshot/artifact hashes. Render actual DB artwork galleries, aligned map/region before/generated-after images and separately identified applied-after; tileset crops; deterministic event/quest diagrams and command excerpts. Cover every affected map/asset in overview with drilldown. Read-only text jobs have honest text output. Explicit missing/failed/unsupported previews; no swallowed error or fake gameplay QA. Persist report shell and partial artifacts even if renderer fails; retry rendering only. Notifications dedup from durable outcome event; reading never removes result or project-owned asset.
  - Acceptance: Reports remain frozen after later project edits; image failure yields retained result and retryable preview; generated/applied/saved and usage unknown are distinct.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobReports.test.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobReports.test.ts`; evidence `.omo/evidence/ai-job-queue/task-6/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Two reconnecting clients see same terminal inbox item; report failure does not increment provider request count.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 7. Create queue inbox and report editor surfaces
  - Recommended task executor category: visual-engineering
  - References / edit scope: DESIGN.md; src/editor/aiJobs/{jobClient,jobQueuePanel,jobInbox,jobReportPanel}.ts; editor shell/topbar integration; scoped styles; test/aiJobPanels.test.ts; test/e2e/ai-job-inbox.spec.ts
  - Implementation: Extract existing cream editor tokens/controls into DESIGN.md before new UI, no new brand/framework. Add a persistent accessible job/inbox entry with unread count, queued/running/attention/completed/failed filters, per-job cancel/retry, stable reconnect and no editing obstruction. Detail report prioritizes large actual artwork and before-after comparison over logs, then concise changes/validation/usage and state-appropriate actions. Correct-project navigation is explicit; viewing another project report never applies or silently switches project. Use SSE reconnect from durable sequence; no polling loops. Keyboard, focus restore and 1024x768/1280x800/1440x900 overflow coverage. Capture full state matrix; no decorative generation.
  - Acceptance: Real editor submits, stays usable, shows unread completion after reconnect, opens image-rich report and correct actions; error/partial/empty/large report and keyboard states work.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobPanels.test.ts; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-inbox.spec.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobPanels.test.ts; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-inbox.spec.ts`; evidence `.omo/evidence/ai-job-queue/task-7/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Disconnected SSE, duplicate events, unsupported previews, other-project report and cancelled job cannot duplicate writes or mislead status.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 8. Migrate every AI submission entry point
  - Recommended task executor category: deep
  - References / edit scope: src/editor/panels/{aiChatPanel,aiTurnRunner,aiRegionTaskRunner,regionTaskModal,databaseAiGenerateDialog,aiImageGenerateField,clusterAiModal,tilesetAiWorkspaceModal}.ts; eventEditor/aiAssist.ts; eventEditor/showPictureAiField.ts; structure/tileset helper entry points; test/aiJobSurfaceCoverage.test.ts; test/e2e/ai-job-families.spec.ts
  - Implementation: All user-triggered long-running family operations call durable admission and return promptly; none retain execution ownership or depend on mounted callbacks. Capture target/context/mode/selection/provider settings at submission. Existing DB assistant/canvas/MCP wrappers route to parent operations without duplicate jobs. Preserve event/tileset review and dialogue followups. Remove legacy browser queue ownership only after parity; no fallback to old direct paid path. Inventory actual call sites of chatCompletion/generateAiImage/session creation and classify each as queued operation, worker-only stage or unrelated read-only infrastructure; enforce structural coverage at the user-operation boundary, not prompt prose.
  - Acceptance: Browser matrix exercises all six families and wrapper routes; close submitting tab during controlled provider work, reconnect and find correct result/report for each.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm test -- test/aiJobSurfaceCoverage.test.ts; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-families.spec.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm test -- test/aiJobSurfaceCoverage.test.ts; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-families.spec.ts`; evidence `.omo/evidence/ai-job-queue/task-8/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Project/map changes while queued, cancellation only one job, followup dependency failure, event draft changed while awaiting result, completed image with unmounted field.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

- [ ] 9. Ship runtime provisioning documentation and regression coverage
  - Recommended task executor category: deep
  - References / edit scope: package.json; vite.config.ts; scripts/setup-local.mjs; scripts/start-preview.mjs; build entry config; openwiki/editor-ai-panel.md; openwiki/editor-ai-tools.md; openwiki/editor-database.md; focused tests and QA scripts
  - Implementation: Ensure managed Chromium is a documented explicit local runtime prerequisite, provisioned through existing setup tooling and same dependency version; no installation on generation request. Both dev and production preview serve worker entry and same service. Static export/player excluded from queue imports and startup. Document lifetime, storage location, recovery, unavailable states, visual report/apply/save distinctions and all entry paths. Run related tests, typecheck/build, supervisor gates; no baseline rewrite/suppression. Test content stays isolated contract fixtures; any actual authored DB validation uses separate project identity and save/reload proof, never default user project.
  - Acceptance: Build includes isolated worker, dev/preview actual endpoint and browser flows pass, no new gate failures, runtime player boot unaffected, all owned processes/contexts/ports cleaned.
  - RED then GREEN: add discriminating regression at the named seam BEFORE production changes; capture correct failure, then pass via `npm run typecheck:app; npm run build; npm run gates; node --test test/aiJobsHttp.test.mjs test/aiJobsRepository.test.mjs test/aiJobsScheduler.test.mjs; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-inbox.spec.ts test/e2e/ai-job-families.spec.ts`. Missing-import/syntax failures are not RED. Characterize unchanged behavior before refactoring.
  - Happy QA: `npm run typecheck:app; npm run build; npm run gates; node --test test/aiJobsHttp.test.mjs test/aiJobsRepository.test.mjs test/aiJobsScheduler.test.mjs; DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/ai-job-inbox.spec.ts test/e2e/ai-job-families.spec.ts`; evidence `.omo/evidence/ai-job-queue/task-9/` contains invocation, exit code and outputs. Browser tasks include screenshots/action trace.
  - Failure QA: Missing Chromium produces actionable unavailable state without lost input or paid dispatch; server stop interrupts honestly and queued records reload.
  - Commit: own verified implementation and tests together, Conventional Commit matching path history; supervisor checks and commits.

## Final verification wave
> After all implementation: supervisor executes actual QA; one gate reviewer audits complete work. Latest user authorization covers implementation, commits and PR; no additional generic approval gate.
- [ ] F1. Plan compliance audit
  - Verify every task and C1-C6 against actual diff/evidence, full family inventory, durable receipts and lifetime promise; no partial completion.
- [ ] F2. Code quality review
  - One independent gate reviewer after supervisor real-surface QA; verify all criterion-cited blockers and fix, then re-review deltas. Evidence .omo/evidence/ai-job-queue/final-review.md.
- [ ] F3. Real manual QA
  - Supervisor drives editor at http://127.0.0.1:9841, submits all families, closes client during held execution and reconnects; inspect saved reports/artifacts and dev/preview HTTP responses. Run failure scenarios C3-C4 and capture screenshot/trace/receipt. Register and execute teardown of every owned server/browser.
- [ ] F4. Scope fidelity
  - Verify no stale browser execution routes, user project damage, unrequested cloud dependency, credential-bearing evidence, unrelated files or merged PR. Verify final gh pr view URL/head and atomic commit log.

## Commit strategy
- User explicitly authorized commits and PR, not merge. Commit each buildable verified increment (feat/fix/test/docs style from history); exact path staging, no WIP, no force push. Final implementation commit footer: Plan: .omo/plans/ai-job-queue-visual-reports.md.
- Push worktree/silver-harbor-d2a7 and create one reviewer-readable PR to origin main; verify gh pr view --json url,headRefName,baseRefName,state. No automated merge.

## Success criteria
- C1 durable admission and local-server completion/restart proof. C2 every AI family migrated and browser-close continuity. C3 cancellation/project isolation/conflict/stage recovery proof. C4 persistent deduplicated inbox and immutable image-rich report states. C5 focused regressions/build/gates and runtime separation. C6 clean resources, verified commits and PR URL.
- Stop immediately when all are evidenced and final handoff delivered. No bonus refactor.
