# Task 6 - immutable image-rich report artifacts

Task: st_01a07761. Implementation began only after GO on
`c31d62000e9f96da59f463eed8c52cfd50cb481e`.

The complete report pipeline is implemented in the adopted worktree. There is no
queue/editor UI or submission-path migration in this change. No commit, push,
worktree creation, paid provider call, user-project write, full build or full gates
command was performed by this worker.

During the task, HEAD independently advanced to
`3a4d7967b0910e0080157d53df3abd766620bcd2` (`fix(project): keep late local saves
bound to their project`). That commit changes store.ts, aiJobIdentity.test.ts and
its c3 evidence; it is not this worker's commit. The final verification below ran
after that commit. This worker's final code changes remain uncommitted.

## Delivered contract and integration

- `src/ai/jobs/reportModel.ts`: `JobReport`, `ReportContext`, `ReportSection`,
  `ReportPreview`, `AppliedReportBinding`, `ReportAssetBindings`.
- `src/ai/jobs/renderJobReport.ts`:
  `renderJobReport(result: AiJobResult | null, host: AiReportHost, options?)`.
  `options.renderPreview` is the external render-fault seam used by focused tests;
  production uses the actual renderer.
- `scripts/lib/aiJobs/reports.mjs`: durable shell projection, exact applied binding,
  captured evidence identity and validation of report/manifest/phase boundaries.
- `AiJobsRuntime.renderReport(resultOrNull, host, signal)` is now wired by
  `createBrowserRuntime`. Its `AiReportHost` has `report: ReportContext` and
  `saveReport(document): Promise<BlobRef>`, plus immutable blob/JSON operations.
  It has NO providerOperation/loadCheckpoint/saveCheckpoint authority. The actual
  Playwright binding rejects those methods in report mode, not just TypeScript.
- Scheduler persists a useful shell before invoking Chromium. It checkpoints the
  complete section inventory and each successful/failed preview as immutable JSON.
  A whole-browser/renderer failure preserves prior successful previews and records
  the renderer failure. Retry reuses ready previews with matching section/source
  identity and only renders unfinished entries.
- `job.reportRef` is the current immutable revision. `previous` links to the prior
  revision; cumulative `artifacts` retain old report and preview refs in the job's
  explicit HTTP manifest. Repository reload verifies their bytes. Full map tile
  arrays and embedded artwork are not duplicated into display sections/revisions.
- Application/save evidence changes schedule a provider-free refreshed report.
  Evidence arriving during a running render prevents the old evidence version from
  being finalized as the current ready report; another revision follows. A shell
  and any old open report remain readable during refresh.
- Terminal generation failures, cancellations and interruptions can have reports.
  `source: "checkpoint"`, `result: null`, `generatedSnapshot: null`, `phase: "staged"`
  explicitly identify retained completed artwork/text/proposals as private staged
  output, not successful generation. An input-only shell is also representable.
  Report readiness NEVER implies generation succeeded.
- Report transitions produce durable `updated` events, not another completion
  inbox notification. Generation/application/save outcomes retain their separate
  outcome events. Reconnect/read/retry never deletes or reapplies an artifact.

### APIs for Tasks 7-8

Existing same-origin endpoints remain the surface:

```
GET  /api/ai-jobs/:jobId
GET  /api/ai-jobs/:jobId/artifacts/:sha256
GET  /api/ai-jobs/events?after=:seq
GET  /api/ai-jobs/inbox
POST /api/ai-jobs/inbox/:eventSeq/read  {}
POST /api/ai-jobs/:jobId/retry          { "stage": "report" }
```

Read detail.manifest and fetch job.reportRef through that manifest. Do not assemble
arbitrary blob URLs or dereference mutable asset URLs. Old revisions remain in the
current manifest; the artifact endpoint remains sandboxed/download-oriented, so
UI can fetch verified bytes and create owned object URLs, revoking them on teardown.

`report.states` and `report.evidenceKey` describe that captured report revision.
The newer `job` may already be refreshing. Display generation/application/save
independently; show that a report is refreshing rather than rewriting old pixels
or implying that applied/draft-confirmed/saved are synonyms.

`output` is the captured family payload with binary/tile display projection, not
a new common answer schema. Actual assistant/cluster results use `assistantText`;
DB results retain record/name/summary, image results retain proposal/destination,
event results retain their proposal ref plus command section, and tileset results
retain their operation/proposal metadata. Unknown usage is null, not zero. Raw
input/result/checkpoint refs remain available for full inspection.

Task 8 artwork capture contract:

```ts
input.payload.reportAssets[imageId] = { sha256, byteLength, mediaType };
// Include those same bytes in admission's artwork list.
```

Pin bundled DB artwork, original tileset images and every graft source by their
actual image/resource ID. Uploaded data URLs are already pinned inside the source
snapshot. Tileset analysis's explicitly captured full `atlas` is usable as such;
a proposal's temporary-map snapshot.image is not reinterpreted as a full atlas.
Missing bindings stay explicit instead of fetching current bundled/remote URLs.
The existing DESIGN.md and cool-white/indigo token contract were not replaced.

### Exact applied-after boundary

Applied sections require all of:

- matching prepared claim/receipt ID and project identity;
- matching receipt and artifact resultSha256 to this job's result ref;
- exact matching receipt.evidence.appliedArtifact and stored artifact.ref;
- raw artifact SHA matching appliedSnapshotSha256;
- scope `project` with `project-canonical-json-no-event-drafts-v1`, or scope `draft`
  with `command-draft-canonical-json-v1`.

The renderer consumes the uploaded Task 5 artifact bytes, never the current store
and never generated-after relabeled as applied-after. Server report validation
also rejects an applied section whose source/scope is not the exact receipt
artifact. Invalid or absent bindings produce unavailable applied-after.

`noChanges: true` is preserved: applied without a mutation/undo. Draft artifacts
have `applied-draft` phase and are explicitly not confirmed project data. Save
labels come from the separate durable save evidence; this proof does not claim a
real remote project save.

## Report family coverage

- Assistant: every affected map, resource, DB record and relevant project change;
  actual captured answer for read-only output; event and quest sections.
- Region: aligned common pixel-space crop and scale for before/generated/applied;
  all affected maps, including additional maps, not a sampled first map.
- Database: real uploaded/captured artwork galleries plus exact record facts and
  resource-field bindings. Missing/unsupported images do not hide the record.
- Image: actual output bytes, decoded dimensions/type, model and captured bound
  destination; no mounted-field callback is required.
- Event commands: actual proposed/final/base command lists, review/exclusion data,
  and deterministic authored-structure SVG. Canonical eventCommandBranches handles
  shop failure, choice cancellation and all other branches without treating
  condition/route data as commands. Legacy event commands, stable event-page IDs,
  common events and troop battleEventPages retain their real ownership.
- Tilesets: all seven operations have atlas, affected-tile crops and exact proposal
  metadata. Actual map rendering shares mapTileDrawCore, transparency and graft
  helpers. `regionSnapshotCore` is store-free; the foreground wrapper preserves
  its existing image resolution.
- Quests: captured graph nodes/edges or step order, deterministic SVG and full
  drilldown text. These are authored structure, NOT gameplay execution/QA proof.
  Long labels visibly truncate inside bounded SVG nodes; full labels remain in
  source/section data. Deleted command/quest/tileset records remain explicit.

No report family is deferred. Unsupported media/unpinned images are explicit
preview states rather than fabricated rendering or hidden fallback requests.

## RED/GREEN and exact command record

Logs are in this directory. All final named suites passed in a single invocation,
with no disabled/deleted failing tests, no polling/sleeps, and no provider retry.
Async tests subscribe to exact durable events or explicit fault-boundary signals
before triggering work, with bounded deadlines.

| Command | Result and evidence |
| --- | --- |
| `npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobReports.test.ts` before implementation | exit 1, `red.log`: real assertion failure, failed browser left reportRef null |
| `npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobReports.test.ts -t 'does not repeat'` before size correction | exit 1, `size-red.log`: report JSON still contained embedded data:image bytes |
| `npm test -- --maxWorkers=1 --no-file-parallelism --testTimeout=60000 test/aiJobReports.test.ts test/aiJobWorkerIsolation.test.ts test/aiJobWorkerRouting.test.ts test/aiSessionJobHost.test.ts test/regionSnapshot.test.ts` | exit 0, `focused-green.log`: 36 tests / 5 files, including 21 report tests |
| `node --test --test-concurrency=1 test/aiJobsScheduler.test.mjs test/aiJobsHttp.test.mjs test/aiJobsRepository.test.mjs test/aiJobsBrowserExecutor.test.mjs` | exit 0, `node-green.log`: 56 tests, zero failures/skips |
| `npm run typecheck:app` | exit 0, `typecheck-app-green.log` |
| `node node_modules/typescript/bin/tsc -p .omo/evidence/ai-job-queue/task-6/typecheck-tests.json` | exit 0, `typecheck-tests-green.log`; checks the new test and reachable source with the existing Vite ambient declarations |
| `for f in scripts/lib/aiJobs/{browserExecutor,repository,reports,scheduler,validation,vitePlugin}.mjs src/ai/jobs/reportData.mjs test/aiJobReports.browser.mjs; do node --check "$f" || exit; done` | exit 0, `syntax-green.log` |
| `node test/aiJobReports.browser.mjs` | exit 0, `browser-green.log`: 16 cases, 17 actual managed Chromium realms, zero provider calls/errors |
| `git diff --check` | exit 0; final cleanup record |

Intermediate failures are retained, not represented as green:

- `reports-first.log` was interrupted by a steering message before results; no exit
  code/pass is claimed. `typecheck-first.log` reached the tool's 120-second timeout;
  no compiler exit/pass is claimed for that invocation.
- `reports-validation.log`: 19/20 passed; a DB fixture referenced an absent resource
  and correctly failed source validation. `db-diagnostic.log` identifies that exact
  invalid icon binding. The fixture now uses an existing resource with an unpinned
  URL, testing the intended unsupported-preview state without weakening validation.
- `focused-first-combined.log`: 35/36 passed; unsupported image MIME reached Image
  construction before format validation. Production now checks the format first.
- `typecheck-second.log` caught an optional event title; the stable owner ID is the
  fallback. `typecheck-tests-first.log` caught missing ambient inclusion in the
  focused config and inferred optional-undefined fields in a JSON command fixture;
  both were corrected, with no suppression.
- `browser-first.log`: pixel comparisons had run, but a fixture DB record retained
  an additional default bundled imageResourceId that was not pinned. The missing
  preview was correctly explicit. The known-artwork fixture now binds both actual
  artwork fields. The successful browser runs preserve the same strict assertion.

LSP requested every changed production/test code/declaration file (20 paths).
Those requests returned no diagnostics, except two non-error async-conversion
hints in the new test. The final renderJobReport.ts request initially timed out
under concurrent verification; a later fresh request returned no diagnostics.
The focused test compiler and app compiler independently passed after the final
fixes. There is no full-build/full-gates claim; those are supervisor-owned.

## Actual Chromium evidence

- `browser-report-artifacts.png`: actual artifact comparison/gallery/flow capture.
- `browser-worker-trace.zip`: representative real managed worker bootstrap/render.
- `browser-viewer-trace.zip`: artifact viewing and label/geometry inspection.
- `browser-evidence.json`: all 16 case labels, 17 managed realms, captured refs,
  decoded dimensions, pixel assertions, independent states and Korean text bounds.
- `browser-cleanup.json`: finally-path resource closure and removed temporary repo.

The proof seeds immutable completed/checkpoint fixtures at the real report-service
boundary, then uses the production scheduler, repository, managed browser,
store-free renderer, artifact hashing and application-evidence HTTP surface. It
does not replace the report runner or call generation/providers. The related
worker-routing tests additionally execute real database/event worker entry paths.
This is report ownership proof, not a repeat of all Task 4 provider integrations.

Asserted pixels: before red `[220,50,40,255]`, generated blue `[40,90,220,255]`, exact
receipt-bound applied red again, blue tile crop, magenta DB artwork
`[200,40,180,255]`, and transparent `[0,0,0,0]`. Artwork hashes/dimensions match the
captured fixture bytes. Three affected maps are enumerated; diagram labels and
state labels are asserted, including generated/applied/unsaved and staged-failed.
Two inbox clients see identical durable entries; preview refresh adds no completion
notification. Tests separately cover whole-browser failure after a successful
preview, report-only retry, cancellation fencing, mismatched applied bindings,
noChanges, draft scope, restart immutability, and all staged terminal states.

The four-large-resource regression uses 4 x 256 KiB source artwork and asserts no
embedded data URLs and a <24 KiB bound for each report revision. It does not sample
away any resource. Full binary/tile inspection still uses source/artifact refs.

Visual limitation: the read tool attached the screenshot but reported that the
current model cannot view images. Pixel/asset/label/geometry assertions are actual
browser evidence; aesthetic screenshot-review signoff is not claimed. This is
not the later editor report-window layout or accessibility acceptance surface.

## Cleanup and handoff boundary

Only port 19841 was owned; the pre-existing 9841 server was not touched. The final
browser proof reports zero managed contexts/browsers remaining and removes its
private temporary directory. The separate listener check found no 19841 listener.
The final `cleanup.txt` verifies the recorded temporary directory is absent, HEAD,
git diff whitespace, and the port check. Tests close their services/HTTP listeners
and temporary repositories through registered teardown. No owned provider process,
server, browser or temporary project is intentionally left running.

Earlier numbered per-realm traces from the first failed browser proof were removed
as redundant owned scratch output; its failure log remains. Final representative
worker/viewer traces and screenshot are retained (about 12 MiB total evidence).
Evidence is ignored by the repository .omo rule; supervisor must explicitly stage
the desired handoff/evidence. No staging or commit was performed by this worker.

Task 7 can now consume the immutable model and existing endpoints, wire the
already-implemented application/save APIs, and update the existing DESIGN.md.
Task 8 owns submission capture/migration, including reportAssets pinning. Neither
UI workstream is included or falsely claimed here.
