# Task7 - complete queue, inbox, report and recovery UI handoff

Completed by continuation worker `st_01a0789f`, preserving the complete uncommitted
implementation of `st_01a077b2`. Verified HEAD:
`1c4a8f7a7664b544ff569d0a89f3196b1aadcb0c`.

The remaining recovery/control acceptance now passes, including explicit guarded
application after cancellation/retry and report refresh. No production guard,
readiness assertion, application contract or existing test was weakened. The
continuation made no production-source changes: it corrected the diagnostic
probe's transport scope, used fresh owned tmpfs fixtures, ran final verification,
and completed this handoff. All inherited UI changes remain uncommitted.

## Recovery failure disposition

The historical `recovery-fourth-diagnostics.json` records a claimed application
without a receipt. That old uncertain job was NOT replayed. Its service error was
not printed by the old harness and cannot be reconstructed from that diagnostic.
There is no evidence-backed claim that ENOSPC, the loader fix, or any particular
production defect caused it. Root storage had only 2.3 GiB available at continuation
start; owned repositories/caches now use `TMPDIR=/dev/shm` as instructed.

1. The first execution of the prepared probe exited 1 before admission. Its route
   interceptor incorrectly proxied an unrelated POST to the optional companion
   on port 17831; `route.fetch` threw `ECONNREFUSED`. This is a diagnostic harness
   defect, not a service/application failure. `retry-apply-probe.log` retains it.
2. The probe interceptor now proxies only same-origin static GET requests, matching
   the E2E workaround. API/SSE/cookies and unrelated requests remain native.
3. A second fresh-store probe passed: cancel, explicit acknowledged generation
   retry, ready report, explicit confirmation, prepare, artifact and evidence.
   Every application POST returned 200; final state was `applied`, errors=[] and
   activeBrowsers=0. See `retry-apply-probe-second.log`, its `-server.log`,
   `retry-apply-probe.json` and `-cleanup.json`.
4. A separate fresh server and browser context then passed the complete recovery
   E2E plus launcher smoke in one invocation, retries=0. Both the auto job and
   explicitly reviewed retried job published their receipt-bound artifacts and
   evidence over real HTTP 200. No service fatal occurred. This resolves the
   remaining acceptance failure without inventing a backend fix or replaying
   historical uncertainty.

The supervisor-integrated bootstrap change remains independently owned; Task7
never edited workerEntry/executor/report loader. Fresh servers loaded the current
HEAD. No source was edited while those browser contexts were running, so no HMR
module replacement occurred during final acceptance. The fixture is still a Vite
source server, not a claim of production-preview browser QA.

## Exact file ownership

New production files:

- `src/editor/aiJobs/jobClient.ts`: one editor-lifetime client, durable admission
  API, named SSE, request/event/read fencing, connectivity and auto reconciliation.
- `src/editor/aiJobs/jobInbox.ts`: launcher counts, family/state labels and filters.
- `src/editor/aiJobs/jobQueuePanel.ts`: nonmodal queue, keyed rows/search/filter,
  explicit cancellation/retry consent, focus and reconnect controls.
- `src/editor/aiJobs/jobReportPanel.ts`: immutable report window, all-object
  navigation, verified media, independent states and guarded review/save actions.
- `src/editor/aiJobs/jobReviewControls.ts`: job/result-scoped native event exclusions
  and tileset proposal selection.
- `src/styles/editor/ai-jobs.css`: one scoped stylesheet using existing tokens.

Narrow modifications:

- `src/editor/panels/menu.ts`: persistent launcher in all modes; dispose only the
  mounted subscription on rebuild, retain client and restore launcher focus.
- `src/editor/hotkeys.ts`: report owns editor tool/history shortcuts.
- `src/editor/panels/tilesetAiNativeReviewInbox.ts`: controlled captured proposal
  presentation, no live-session/answer/paid handlers.
- `src/styles/index.css`: imports the scoped stylesheet once.
- `DESIGN.md`: token/geometry/accessibility contract recorded before original UI
  implementation (see the partial checkpoint); no new brand or framework.
- `openwiki/editor-ai-panel.md`: current APIs, state semantics and Task8 boundary.

New tests: `test/aiJobPanels.test.ts` and `test/e2e/ai-job-inbox.spec.ts`.
The evidence-only fixture/probe/runner and this handoff live under this directory.
Task5 application/store and Task6 report/server code are consumed, not modified.

## Public client and surface APIs

```ts
getJobClient(): JobClient
// Starts once. Views must not construct their own production clients.
disposeJobClient(): void

interface JobAdmission {
  input: Omit<AiJobInput, "projectSnapshot" | "artwork">;
  projectSnapshot: JsonValue;
  artwork: readonly { mediaType: string; base64: string }[];
}
JobClient.admit(request: JobAdmission, idempotencyKey: string)
  : Promise<{ job: AiJob; created: boolean }>
JobClient.connect(): Promise<void>
JobClient.refresh(): Promise<void>
JobClient.refreshJob(id: string): Promise<void>
JobClient.subscribe(listener: () => void): () => void
JobClient.readInput(job: AiJob): Promise<AiJobInput>
JobClient.cancel(id: string): Promise<void>
JobClient.retry(id: string, stage: "generation" | "report",
                acknowledgeDuplicateSpend?: boolean): Promise<void>
JobClient.markRead(id: string): Promise<void>
JobClient.apply(id: string, review: JobReview): Promise<JobApplicationOutcome>
JobClient.save(id: string): Promise<JobApplicationOutcome>

mountJobLauncher(client?): { element: HTMLButtonElement; dispose: () => void }
openJobQueue(opener: HTMLElement, client?): HTMLElement | null
closeJobQueue(): void
openJobReport(id: string, opener: HTMLElement, client?): Promise<HTMLElement>
closeJobReport(): void
createJobReview(client: JobClient, job: AiJob)
  : Promise<{ element: HTMLElement; review: () => JobReview }>
```

Client exposes jobs/inbox/outcomes/labels, running/unread, connection, error,
generationAvailable, configuredBackend and durable sequence. `artifacts` is the
Task5 `ApplicationClient`; `verifiedArtifact` additionally requires exact manifest
membership before byte/hash verification. Report media gets owned object URLs,
with visible inventory mounted before held fetches, offscreen IntersectionObserver
loading and cleanup on object/revision replacement or close.

`GET /api/ai-jobs/events` has no query cursor. Named admitted/updated/outcome/
inbox-read events are sequence-deduplicated; native reconnect sends Last-Event-ID.
List/detail request order and per-job event versions reject stale responses.
Authoritative read acknowledgement remains monotonic across historical replay;
opening a report fetches authoritative inbox state before acknowledging unread
records. Queue opening/filtering/preview completion never acknowledges or applies.
Writes use session CSRF/cookies and JSON. No polling or automatic generation retry.

Auto application is opt-in input.mode=auto and only eligible assistant/database/
canonical-image output. It is independent of report mounting, observes full loaded
identity/epoch/read-only availability, retries transient pending reads on recovery,
and never retries settled conflicts or unknown application. Report apply requires
explicit confirmation and displayed/current immutable result-hash agreement,
checked again after confirmation. Event exclusions and selected proposal IDs are
bound to that same result, not mutable editor selection. No legacy tileset
workspace opener or paid review handler is invoked by report viewing.

Task5 remains sole mutation/save authority. Conflicts retain output. Other-project
reports do not switch projects or apply; the project picker is explicit. Unknown
claims remain unknown, with no equality-based replay. Generation, report,
application, draft confirmation, save, pending evidence and unknown usage remain
separate. Matching durable receipts reconcile stale local outcomes. Save-only
retry never generates/reapplies and local fixtures never claim remote save proof.

## Final verification commands and exits

All commands ran from this worktree. Temporary stores/build outputs used
`TMPDIR=/dev/shm`; no installs or shared-cache purge occurred.

| Command | Result / evidence |
| --- | --- |
| `python3 .omo/evidence/ai-job-queue/task-7/run-owned.py retry-apply-probe-second node .omo/evidence/ai-job-queue/task-7/retry-apply-probe.mjs` | exit 0; fresh cancellation/retry/explicit application; `retry-apply-probe-second.log` |
| `python3 .omo/evidence/ai-job-queue/task-7/run-owned.py e2e-recovery-final node node_modules/@playwright/test/cli.js test test/e2e/ai-job-inbox.spec.ts --grep 'real reconnect\|exposes the durable'` | exit 0; 2 passed, 6.4 min; `e2e-recovery-final.log` |
| `TMPDIR=/dev/shm npm test -- --maxWorkers=1 --no-file-parallelism --testTimeout=60000 test/aiJobPanels.test.ts test/aiJobApplication.test.ts` | exit 0, 47 tests (22 panel/client + 25 application), 2 files, one run; `focused-complete.log` |
| `TMPDIR=/dev/shm npm run typecheck:app` | exit 0; `typecheck-app-complete.log` |
| `TMPDIR=/dev/shm npm run gates -- --only css` | exit 0, budget=0, graph=0, no baseline rewrite; `css-complete.log` |
| `TMPDIR=/dev/shm node node_modules/typescript/bin/tsc -p .omo/evidence/ai-job-queue/task-7/typecheck-tests.json` | exit 2, two unchanged baseline mixed Node/DOM timer errors below; `typecheck-tests-complete.log` |
| `TMPDIR=/dev/shm npm run build:app -- --outDir /dev/shm/task7-app-build-e5sezz5x` | exit 0; `build-app-complete.log`; output removed in finally |
| `node --check .omo/evidence/ai-job-queue/task-7/editor-fixture-server.mjs` and probe `node --check` | both exit 0 |
| `git diff --check` | exit 0 |

The owned runner sets `DEV_SERVER_PORT=19841 E2E_RETRIES=0 TMPDIR=/dev/shm`, starts
and waits for exact TASK7_EDITOR_READY stdout, drains immediate service errors,
then runs the command. Its finally path uses HTTP shutdown and waits for process
exit. It preserves each run's server log and cleanup receipt. Port 9841 is untouched.
The E2E grep intentionally selects the previously incomplete recovery/control
scenario and launcher smoke; the valid 72-measurement matrix was not repeated
solely for the disjoint bootstrap change, per supervisor instruction. No skipped
or deleted failing test is hidden as a green full-file E2E invocation.

LSP checked the entire `src/editor/aiJobs` directory (10 TS files), both new test
files, hotkeys.ts, menu.ts and tilesetAiNativeReviewInbox.ts: zero diagnostics.
CSS LSP for both changed stylesheets is unavailable because Biome is not installed;
no dependency was installed. CSS gates passed instead. `lsp-complete.md` records it.

Focused test compiler baseline, preserved without suppression/unrelated fixes:

```
src/editor/panels/eventEditor/customSelect.ts(362,5): error TS2322: Type 'Timeout' is not assignable to type 'number'.
src/editor/panels/eventEditor/showAnimationPlayback.ts(138,5): error TS2322: Type 'number' is not assignable to type 'Timeout'.
```

App build warnings remain visible: output directory outside root (intentional
owned temp output), existing mixed dynamic/static imports for playSceneInterpreter,
editorUiMode, devProjectPersistence and player, and chunks exceeding 500 kB.
No warning threshold or suppression was changed. This is app build plus separate
app typecheck, not the full player/standalone build or full gates. Supervisor owns
fresh final integration/preview and full gates.

## RED/GREEN history

Original discriminating failures remain in their logs, inspected during this
continuation. They are assertion/state-boundary failures, not missing imports:

- `red.log`: real topbar had zero job launchers instead of one.
- `races-red.log`: already-read replay reintroduced unread; stale list replaced
  newer detail/list; identity replacement notification missing; pending auto reads
  did not retry on explicit/native reconnect.
- `report-races-red.log`: stale report incorrectly enabled apply; matching receipt
  did not reconcile local save; newest-first DOM order wrong; held first image
  prevented complete 300-preview inventory mounting.
- `focus-red.log`: topbar rebuild lost launcher focus and report leaked shortcuts.
- `remount-read-red.log`: replacement launcher misreported open queue; report open
  before initial inbox snapshot failed to acknowledge authoritative unread.
- `browser-offline-red.log`: quiet SSE did not observe browser offline event.
- `session-recovery-red.log`: failed online session handshake left no native stream.

All corresponding current tests passed in the final 47-test run. Earlier filtered
RED invocations list unselected tests as skipped; final focused run has no skips.
No production RED/fix is claimed for the historical fatal: it did not reproduce
in either fresh acceptance run, so no speculative backend change was made.

## Completed real editor evidence

### Preserved layout/pixel matrix

`browser-evidence.json` contains 72 measurements, 76 actions, zero browser errors
and zero document overflow across 1024x768, 1280x800 and 1440x900. It includes all
three modes, empty/no-results/20+ rows, all six report families, all 21 affected
maps discoverable, partial/missing/unsupported/failed/cancelled/interrupted,
conflict/other-project/unknown, applied-unsaved/save-failed/save-unknown/draft/
noChanges, long labels, lower object/body scroll, native choices and nested Escape.
Pinned map red/blue and artwork alpha/magenta pixel assertions passed. Screenshots
`launcher-*`, `queue-large-*`, `report-*` and `editor-action-trace.zip` are retained.

These matrix assertions completed in the old combined `e2e-fifth.log` run before
its later offline assertion failed. That invocation exited 1 and is NOT called a
passing E2E run. Its recovery portion is now separately green. Geometry/pixel
assertions are not an aesthetic review.

### Fresh completed recovery/control run

`browser-recovery-evidence.json`, `e2e-recovery-final.log`, its server/cleanup logs,
`editor-recovery-trace.zip` and screenshots establish:

- native browser offline input retention and online recovery;
- actual durable reusable admission, controlled held provider boundary, submitting
  tab closed, server finishes, reopened report and server read acknowledgement;
- positive native Last-Event-ID with no after query, no replay admission/provider;
- opt-in auto application before any report mounts, actual disposable project
  item added, then save-only retry with no additional generation/provider dispatch;
- queued cancellation with zero operations, running cancellation, explicit
  duplicate-spend retry confirmation, and real successful generation/report;
- old mounted checkpoint cannot apply; explicit refresh adopts matching current
  result; explicit report confirmation publishes actual guarded application;
- reduced motion, keyboard focus within report, visible focus outline and Escape
  restoration. `actual-reviewed-application.png` captures the completed endpoint.

The final recovery fixture made four controlled free provider dispatches, zero
external paid calls, errors=[], and launched/closed 14 managed browsers. Native
API/SSE/cookies are not replaced by the static-GET network workaround. Report waits
retain strict ready assertions with bounded 300-second event deadlines; no polling
or sleeps were added. The prior observed 98.7-second refresh was slow ready output,
not a missing-art or partial-ready condition.

## Cleanup, limits and Task8 integration

Fresh probe and recovery server exits were 0, HTTP shutdown was 200. Cleanup
receipts report no active managed browsers. `cleanup-complete.json` independently
checks both /dev/shm repositories and app output are absent; no task7 temp directory,
owned server process or 19841 listener remained. Browser context cleanup reports
no failures. Earlier historical owned-store cleanup remains documented in
`PARTIAL-bootstrap-checkpoint.md` / `partial-cleanup.json`.

Aesthetic review remains UNVERIFIED: image attachments are omitted across the
available configured model routes. No screenshot aesthetic verdict is inferred
from pixel/DOM measurements. Historical fatal cause remains unproven as above;
its uncertain evidence was not promoted into success. No real remote-save claim,
user-project write, paid call, commit, push, PR, dependency install or cache purge.
The working tree still contains the complete approved uncommitted Task7 UI.

Task8 should use the existing singleton/admission API, not create another queue:

1. Capture full loaded backend/project identity, project JSON snapshot, explicit
   mode, target, provider settings and current context before asynchronous work.
   Retain request and stable idempotency key across uncertain admission ack.
   Surface unavailable runtime without losing input; no browser-owned fallback.
2. Pin reportAssets by actual resource/image IDs and include the same binary bytes
   in artwork admission (Task6 contract). Never substitute current editor images.
3. Capture real live draft UUID/revision/owner/path/expected command through Task5
   draftOwners/jobDraft seams; selection or vault presence is not a live owner.
4. Preserve per-family auto/review policy. Event/native tileset choices stay in
   this immutable report review path; never reopen paid legacy workspace handlers.
5. Capture dialogue/follow-up dependencies against predecessor output. Route actual
   six-family submitters and wrappers per the Task8 inventory; do not claim the
   generic DB admission fixture migrated any existing real submission family.

No Task8 migration is included here. Supervisor can stage the owned files above;
`.omo` evidence is ignored and requires explicit inclusion if desired. No staging
or commit was performed by this continuation.

## Subsequent independent acceptance

The user assigned UI/image work to GROK and non-UI work to Astra. The earlier
image-input limitation above is historical: GROK received pixels and completed
the full editor replay and focused caption scroll proof. See GROK-VERIFICATION.md
and supervisor.md for current Task7 UI PASS and fresh graceful cleanup receipts.
No caption defect remained and no production UI patch was needed.

Astra corrected the separate owned-runner cleanup failure paths and obtained
scoped same-reviewer approval after the mixed parent/descendant regression.
RUNNER-SAFETY-APPROVAL.md records that result; it is not the final whole-project
review. The verified QA lifecycle harness was committed separately as 3a6528082.
