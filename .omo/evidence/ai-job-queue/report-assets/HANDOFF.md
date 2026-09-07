# reportAssets backend contract handoff

Task: `st_01a07984` (Astra backend child)
Date: 2026-09-07
Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-ai-report-assets-0906`
Branch: `worktree/ai-report-assets-0906`
Base/HEAD (unchanged): `cbb6ad0085630723bb128897ee47cfbbf0b4cbf6`
Status: implementation and backend proof complete; uncommitted for supervisor verification/integration.

## Delivered

All six family payload contracts now accept and preserve optional top-level
`reportAssets: Record<string, BlobRef>`. All seven tileset operations use the same
metadata parser. No field was relocated. No renderer, UI, provider identity,
project identity, application DTO, or credential policy was changed.

`src/ai/jobs/reportAssets.mjs` is a browser-safe shared validator, also used by
repository input validation. It accepts plain JSON dictionaries with opaque IDs
and exact `{ sha256, byteLength, mediaType }` refs. SHA-256 is 64 lowercase hex
characters; byte length is a positive safe integer; media type is one of
`image/png`, `image/jpeg`, `image/webp`, `image/gif`, matching the existing report
raster decoder and HTTP image capture boundary. Arrays, null, URLs, malformed
refs, accessors, symbol/non-enumerable properties and extra ref fields fail.

The repository uses its existing canonical JSON and blob-integrity boundaries:
- Every report ref must match an `input.artwork` ref exactly, not merely its hash.
- Same-hash conflicting artwork metadata is rejected for pinned refs, so a map's
  last-write behavior cannot make the accepted pin unreadable by the worker.
- Another job's/orphaned blob is not sufficient ownership. HTTP admission must
  carry the matching bytes in its existing artwork upload array.
- Existing storage reads check actual hash/length at admission and repository
  reload. Worker/report/HTTP manifests already include artwork, so no manifest
  expansion or raw-payload rewriting was needed.

## Exact changed source, test and documentation files

1. `src/ai/jobs/assistantPayload.ts`
2. `src/ai/jobs/regionPayload.ts`
3. `src/ai/jobs/eventCommandsPayload.ts`
4. `src/ai/jobs/executors/databaseJob.ts`
5. `src/ai/jobs/imagePayload.ts`
6. `src/ai/jobs/tilesetPayload.ts`
7. `src/ai/jobs/reportAssets.mjs` (new shared runtime validator)
8. `src/ai/jobs/reportAssets.d.mts` (new browser/server type declaration)
9. `scripts/lib/aiJobs/validation.mjs`
10. `test/aiReportAssetsPayload.test.ts` (new, 29 tests)
11. `test/aiJobWorkerRouting.test.ts` (existing real worker tests parameterized with/without pins)
12. `openwiki/architecture.md`

The database parser is exported as `parseDatabaseJobPayload` for direct contract
coverage; the executor calls the same parser. Its existing semantic checks are
unchanged.

Evidence is entirely under `.omo/evidence/ai-job-queue/report-assets/`:
- `HANDOFF.md`, `DIAGNOSTICS.md`
- `build-worker.mjs`, `check-tests.mjs`, `worker-build.json`
- Each validation log named below and its matching `.exit` file.
This checkout's `.gitignore` ignores this evidence directory. The supervisor must
explicitly include desired evidence when staging (for example with `git add -f`).
No staging, commit, push, PR or cherry-pick was performed by this child.

## Compatibility and GROK capture integration

- Absent metadata retains prior parser output and stored version-1 semantics;
  no `reportAssets: undefined` property is added by the parsers. Empty `{}` is valid.
- Assistant, region, event-commands and database still reject unrelated top-level
  extras. Their nested provider/config guards are unchanged. Image and tileset
  retain their prior behavior of ignoring unrelated top-level extras; they now
  validate supplied reportAssets instead of silently discarding it.
- HTTP secret scanning remains intact for every family, including nested secrets.
- Existing invalid supplied metadata can now fail admission/reload intentionally;
  this does not migrate or weaken malformed historic pins. Existing valid pins
  with matching artwork remain readable, and absent pins are backward compatible.
- GROK should capture bytes, compute the exact lowercase SHA-256 and byte length,
  and set `input.payload.reportAssets[actualImageId] = { sha256, byteLength,
  mediaType }`. Send the same bytes as canonical base64 in the existing HTTP
  submission `artwork: [{ mediaType, base64 }]`. The server constructs
  `input.artwork`; do not send refs in place of that HTTP byte-upload array.
- Preserve actual resource/tileset/graft IDs and MIME types. Do not insert URLs,
  credentials, a new nested metadata home, or a different user/provider identity.
- Task6 already reads raw `input.payload.reportAssets[imageId]`. This backend
  change unblocks capture for the four strict families without changing that
  renderer. Image/tileset capture should keep its existing artwork uploads.
- Report pins do not declare new project resources: existing project reference
  validation still applies. Uploaded resources still use embedded snapshot bytes
  first. Missing unrelated artwork remains missing/partial, not a mutable fetch.
- Caller's `worktree-silver-harbor-d2a7/.omo/evidence/ai-job-queue/task-8/NEEDS-ASTRA.md`
  was read only. No caller worktree or UI files were edited.

## Proof scope

The new suite proves all six parsers accept valid captured refs, preserve absent
and empty metadata, reject malformed metadata, and retain existing extra-field
and credential policies. It also covers every tileset operation and opaque IDs.

For each family it exercises real authenticated loopback HTTP admission,
filesystem repository/scheduler, exact worker-host blob reads, report execution,
manifest download, and close/reopen. The generation callback is a controlled
executor boundary which runs the actual family parser and creates a detached
fixture result; this is not a claim of real provider generation for all six.
The real `renderJobReport` runs unchanged; only `Image` decoding is controlled.
Both record artwork fields bind the same exact captured ref, and reports/reloads
retain it. The tileset case deliberately leaves the separate atlas uncaptured;
its two atlas previews must be `missing`, while both pinned resource previews
are `ready`. No raster rendering, visual interpretation or screenshot inspection
is claimed.

The existing actual worker entry database/event tests execute both with and
without pins. Related suites cover real assistant/region/database/event/image/
tileset execution and durable retries with controlled provider wires. Node tests
cover HTTP, repository, scheduler and managed-browser infrastructure. No real
paid provider call was made.

## Exact validation commands and exits

Every command below ran after explicit:

```sh
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-ai-report-assets-0906
```

Logs were redirected directly to files, with the command's `$?` saved before
printing log tails. No pipeline exit code is used as success evidence.

### RED before any production edit

```sh
npm test -- test/aiReportAssetsPayload.test.ts
```

Exit **1**, `red.log`: 3 actual assertion failures. Valid captured PNG refs were
rejected by assistant (`Unexpected captured input field`), region (`Unexpected
region input field`) and event-commands (`Unexpected event commands field`).
These are parser assertion failures, not import/collection errors.

### Related suite command (exact repeated command)

```sh
npm test -- test/aiReportAssetsPayload.test.ts test/aiJobWorkerRouting.test.ts test/aiJobWorkerIsolation.test.ts test/aiSessionJobHost.test.ts test/aiRegionJob.test.ts test/aiDatabaseJob.test.ts test/aiEventCommandsJob.test.ts test/aiImageJob.test.ts test/aiTilesetJob.test.ts test/aiJobReports.test.ts test/aiJobCanonicalReplay.test.ts --maxWorkers=4
```

| Log | Exit | Result |
| --- | --- | --- |
| `green.log` | 1 | 172 passed, 6 new integration-fixture failures |
| `final-green.log` | 1 | 177 passed, 1 new fixture incorrectly required ready despite missing atlas |
| **`verified-green.log`** | **0** | **178 passed, 11 files; full related command passed in one final run** |

Intermediate targeted diagnostic commands, retained rather than hidden:

| Exact command | Log | Exit |
| --- | --- | --- |
| `npm test -- test/aiReportAssetsPayload.test.ts --maxWorkers=1` | `contract-green.log` | 1 (23 passed, 6 fixture failures) |
| `npm test -- test/aiReportAssetsPayload.test.ts -t 'HTTP capture' --maxWorkers=1` | `capture-diagnostic.log` | 1 (6 selected failures) |
| `npm test -- test/aiReportAssetsPayload.test.ts -t "assistant.*HTTP capture" --maxWorkers=1` | `preview-diagnostic.log` | 1 (1 selected failure; exact missing preview diagnostic) |

These exposed test-fixture issues: Buffer versus Uint8Array comparison at the
Node host boundary, an unregistered synthetic resource ID rejected by project
validation, and uncaptured pre-existing item/atlas artwork. Fixtures were made
contract-valid; raw refs and production guards were not dropped or weakened.
The final full command has no filtered/skipped tests and no baseline failures.

### Other final validators

| Exact command | Log | Exit/result |
| --- | --- | --- |
| `node --test --test-concurrency=4 test/aiJobsRepository.test.mjs test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs test/aiJobsBrowserExecutor.test.mjs` | `node-tests.log` | **0; 56 passed** |
| `npm run typecheck:app` | `typecheck.log` | **0** |
| `node .omo/evidence/ai-job-queue/report-assets/check-tests.mjs` | `test-diagnostics.log` | **0; both changed tests have zero syntax/semantic diagnostics** |
| `node .omo/evidence/ai-job-queue/report-assets/build-worker.mjs` | `build.log` | **0; affected worker production build** |
| `node --check src/ai/jobs/reportAssets.mjs && node --check scripts/lib/aiJobs/validation.mjs && git diff --check` | `syntax.log` | **0** |

The scoped Vite build uses the real `ai-job-worker.html` entry, configFile/envFile
false, no public asset copy, and an owned temporary output directory. It emitted
21 chunks / 642 included module IDs (753 transformed modules). Build assertions
prove reportAssets is included, with zero server job runtime modules, Node
externals or browser-external shims. `worker-build.json` records these facts.
The log includes Vite's harmless notice that its outside-root temporary outDir
will not be emptied automatically; the script removes it explicitly in finally.
Full app/player/standalone builds and full gates were not run, per narrow scope.

LSP found no diagnostics on every changed executable source/declaration/test
file and evidence script. The large test file had transient 3-second fresh-LSP
timeouts during parallel validation; its final LSP call returned no diagnostics,
and the compiler-API targeted test diagnostic command independently passed.
See `DIAGNOSTICS.md`.

## Cleanup / boundaries

- HTTP fixtures use `listen(0, '127.0.0.1')` and clean up servers, connections,
  schedulers, repositories and temporary directories in teardown. Final suites
  completed and exited with all teardown checks passing.
- The worker build output `/tmp/report-assets-worker-build-TVYKL3` was removed by
  its finally block. A later prefix check found no remaining owned build dir.
- No main app server was started; no fixed 9841/19841/19842 listener was acquired.
- No real user DB writes, installs, environment rewrites, image inspection, UI
  edits, commits, pushes or PRs. No owned resources remain running.
- Supervisor owns independent verification and commit/cherry-pick. No external
  dependency remains blocking this backend deliverable.
