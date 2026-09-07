# Task8 Node-owned QA wire handoff

## Status and integration boundary

Implemented in `/dev/shm/task8-qa-wire-MyjYVp`, branch `worktree/ai-job-qa-wire-0907`, adopted base `c794ff7d5`. No production TS/CSS/images, production persistence, credentials, global configuration, or package dependencies were changed. No commit was created. Task7 default fixture and its six process tests are unchanged; its runner has an explicit `TASK8_QA=1` branch.

The fixture preserves the real HTTP admission/CSRF service, scheduler, filesystem repository, provider ledger, isolated Chromium executor, report renderer, Apply implementation, application receipts, and normal store flush/reload. Only provider transport, canonical remote persistence transport, connection status, and local activity mirrors are controlled. It never seeds fabricated jobs/results.

**Do not run the existing family spec against normal Vite.** Browser `page.route` provider interception is not the safety boundary. The family spec/UI migration belongs to the parent/GROK integration and is not present in this adopted base. The commands below select the new backend explicitly; GROK must wire its family spec to the control API before running it.

## Safety boundary

- `createTask8Runtime` requires an explicit controlled provider function and assigns it last, overriding any accidental `options.dispatchProvider`. The server passes only `createQaWire().dispatchProvider`. No live adapter invocation, credential lookup, provider subprocess, provider fetch, fallback, or retry exists in this fixture transport.
- A job must match exactly one unused plan (or its already-bound plan). Family/project/optional payload fields, tileset variant, operation key, request kind and provider must match. Unknown/ambiguous/exhausted operations are logged as violations and throw `PROVIDER_NOT_DISPATCHED`. The actual ledger therefore records them as `failed`, not as an invented success. Optional request hashes further restrict the operation.
- No `vite.config` or `.env` files load. Vite client environment uses an unrelated prefix; only explicit disposable Supabase proxy configuration is defined. No real provider/DB proxy handlers are installed.
- The Node HTTP guard precedes Vite. It denies legacy `/v1`, `/api/ai`, `/api/qwen`, `/api/cpen`, unknown API/auth routes and other non-GET requests with HTTP 451, except the explicit real job service and controlled wires. Violations contain method/path or job/operation identity, not request bodies/credentials.
- `/auth/status` and `/auth/providers` return synthetic local-connected status, not real account information. This enables the real controls without logging in.
- `/supabase/rest/v1/*` is memory-only and initially fails closed. Only project `task8-disposable-qa` is accepted. There is no upstream. Project `current_json/current_sha256`, map rows and tileset rows are distinct. CAS PATCH, row replacement/upsert/delete, normal commit rows, activity/conversation rows, and map-edit locks use the local wire. Project-change rows must link to a local disposable commit. Unsupported operations fail rather than forwarding.
- Node also enforces exact Host/Origin. Fixture controls require the UUID run header. CSP restricts browser connection/image/media/form/frame destinations to self (plus data/blob media); use a fresh browser context with service workers blocked. CSP is defense in depth, not the provider safety boundary.
- The two `/__oprn/*-activity` POST mirrors are initialized-disposable, in-memory sinks. They never write the normal output folders.

This is a QA fixture, not a security sandbox for arbitrary hostile Node code. Do not import normal Vite/provider plugins into it, point browsers at other origins, or weaken a denied operation to make a test pass. No vendor accounting claim is made about the earlier audited paid operation or its unknown total cost.

## Exact commands on Astra

All commands run from the adopted tree. Neither 9841 nor 19841 is used. The runner asks the kernel for a fresh ephemeral HTTP port, obtains it from a UUID-bound readiness message, then passes `TASK8_ORIGIN`, `TASK8_RUN_ID`, and the actual `DEV_SERVER_PORT` to its workload.

The adopted `node_modules` symlink cannot resolve the base code's existing `zod` import. The already-installed `/home/main/node_modules/zod` is version 4.4.3. `TASK8_ZOD_ENTRY` supplies a QA-only Vite resolution alias to that existing package; it does not install/copy/modify it. On an integrated tree with normal zod resolution, omit this variable. If neither resolution is available, stop before UI proof; do not install under this task.

Verified backend exercise, including real executor/report/Apply/store publication failure then success:

```bash
cd /dev/shm/task8-qa-wire-MyjYVp
TASK8_QA=1 TASK8_ZOD_ENTRY=/home/main/node_modules/zod/index.js \
TASK7_COMMAND_TIMEOUT=180 TASK7_SHUTDOWN_TIMEOUT=45 \
python3 .omo/evidence/ai-job-queue/task-7/run-owned.py qa-wire-release \
  node .omo/evidence/ai-job-queue/task-8/verify-qa-wire.mjs
```

**GROK family execution after integrating its control-aware spec:**

```bash
cd /dev/shm/task8-qa-wire-MyjYVp
TASK8_QA=1 TASK8_ZOD_ENTRY=/home/main/node_modules/zod/index.js \
python3 .omo/evidence/ai-job-queue/task-7/run-owned.py grok-families \
  node node_modules/@playwright/test/cli.js test \
  --config .omo/evidence/ai-job-queue/task-8/grok-family.config.mjs
```

`grok-family.config.mjs` has no `webServer`, no existing-server reuse, one worker, zero retries, and matches only `test/e2e/ai-job-families.spec.ts`. It refuses missing Task8 environment or either shared port. It does not replace GROK's required test setup/assertions. The family spec must use `baseURL`, not a hard-coded port or normal Playwright config. The owned runner remains alive for the entire workload, including browser closure. Avoid an outer shell/tool timeout shorter than the runner's command + shutdown + escalation budgets.

Direct server command for an independently owned foreground process (prefer the runner):

```bash
cd /dev/shm/task8-qa-wire-MyjYVp
DEV_SERVER_PORT=0 TASK8_ZOD_ENTRY=/home/main/node_modules/zod/index.js \
  node .omo/evidence/ai-job-queue/task-8/editor-fixture-server.mjs
```

Read `TASK8_EDITOR_READY {"origin":...,"runId":...}` from that process's stdout. A direct launch must own/wait for that PID and close it through the run-bound shutdown endpoint. Never find/kill/shutdown a process merely by port.

## Control API

Every control is `POST ${TASK8_ORIGIN}/__task8/<route>`, JSON, with `X-Task8-Run-Id: ${TASK8_RUN_ID}`. Browser-origin requests must have the exact server Origin. Node/API clients may omit Origin. Control bodies are limited to 32 MiB. These endpoints never enter normal dev/preview/player exports.

| Route | Body | Response/behavior |
| --- | --- | --- |
| `persistence/init` | `{projectId, serialized, sha256}` | One initialization only; SHA-256 of exact UTF-8 serialized project bytes; fixed disposable ID required. |
| `persistence/configure` | `{failWrites:0, blockWrites:true}` | Deny all canonical `projects` mutations until explicitly unblocked. Does not consume failures on activity/lock writes. |
| `persistence/configure` | `{failWrites:1, blockWrites:false}` | Deny the next canonical project mutation once. Prefer persistent blocking for UI save tests with autosave. |
| `persistence/snapshot` | `{}` | Full controlled project/map/tileset/auxiliary tables and counters for independent readback. |
| `plan` | See below | Append an immutable plan with unique ID. No overwrite/reset/live fallback. |
| `wait` | `{type, planId?, index?, jobId?, after?, generation?, report?, application?, save?, waitType?, table?}` | Exact event subscription plus retained-event replay; 90-second bounded deadline; no polling. `after` is the fixture event sequence, not the job SSE sequence. |
| `release` | `{planId,index}` | Release an already-reached held operation. Premature/duplicate release returns 409. |
| `counts` | `{}` | Actual jobs, operations, attempts, plans/cursors, controlled calls, logical ledger requests, reused-response count, violations, events, held keys, active waiters/browsers, persistence summary. Full response/project bytes are not in counts. |
| `shutdown` | `{}` | Acknowledge, drain/cancel controlled gates, close service/browsers/Vite/HTTP, remove temp storage, write a UUID receipt, exit naturally. |

Real job admission, cancellation, retry and application endpoints remain `/api/ai-jobs*`; the fixture does not replace them. Use the actual editor controls. For backend clients, obtain cookie + `csrfToken` from `/api/ai-jobs/session` and send the exact Origin, cookie, `X-AI-Jobs-CSRF`, JSON, and admission `Idempotency-Key`. Session `configuredBackend` is `task8-local:<runId>`, not a real Supabase identifier.

A plan binds to its first matching job at physical dispatch and stays bound across retries. Register only one unbound plan for a given selector, or distinguish jobs with exact top-level `match.payload` fields (for example `brief`, `instruction`, `kind`, `tilesetId`). `match.inputSha256` optionally pins the admitted input ref. Unknown selector/operation fields are rejected. A no-provider preflight failure leaves the plan unbound and unconsumed: assert the job/attempt state rather than waiting forever for a provider event.

```json
{
  "id": "database-potion-1",
  "match": {
    "family": "database",
    "projectId": "task8-disposable-qa",
    "payload": {"kind":"item", "brief":"Disposable controlled potion"}
  },
  "operations": [{
    "key": "database/text",
    "kind": "text",
    "provider": "google-antigravity",
    "hold": true,
    "cancel": "late-response",
    "response": {
      "choices": [{"finish_reason":"stop", "message":{
        "role":"assistant", "content":"{\"name\":\"Task8 Controlled Potion\",\"price\":37}"
      }}]
    }
  }]
}
```

Each operation requires exactly one `response` or `failure`. `response` is returned unchanged through the real provider ledger. `requestSha256` and `responseSha256` use SHA-256 of production `canonicalJson(value)`; neither is an image/prompt interpretation. `failure` is `not-dispatched` (safe failed ledger operation) or `outcome-unknown` (exercises duplicate-spend acknowledgement, still no real dispatch). Repeat a key as the next plan entry when an injected pre-dispatch failure should return a new controlled response on retry.

For held operations, `cancel:"abort"` (default) rejects the gate on job cancellation and never releases a response. `cancel:"late-response"` keeps it held after cancellation: click Cancel, observe cancellation, exercise the real explicit duplicate-spend acknowledgement if retrying while it is still held, then release the original response. The real ledger persists it and can reuse it on the retry without a second controlled call. Shutdown rejects even late-response gates; it cannot leak a paid request.

## No-race wait pattern before clicking controls

Minimal Playwright control helper (inside the GROK spec):

```js
const control = async (route, body = {}) => {
  const response = await request.post(`${process.env.TASK8_ORIGIN}/__task8/${route}`, {
    headers: { 'X-Task8-Run-Id': process.env.TASK8_RUN_ID }, data: body,
    timeout: 120000,
  });
  expect(response.status()).toBe(200);
  return response.json();
};
await control('plan', plan);
const armed = control('wait', {
  type: 'waiter-registered', waitType: 'operation-reached', planId: plan.id,
});
const reached = control('wait', { type: 'operation-reached', planId: plan.id, index: 0 });
await armed;
// Click the actual family control here, with the matching nonsecret config/payload.
const atProvider = await reached;
const ready = control('wait', { type: 'job-event', jobId: atProvider.jobId, report: 'ready' });
await control('release', { planId: plan.id, index: 0 });
await ready;
```

The fixture registers its release resolver before publishing `operation-reached`. The wait API registers its listener before acknowledging `waiter-registered`; retained events cover HTTP request ordering. Use `after` from `counts.events.at(-1).seq` before repeated transitions so an old ready/failure cannot satisfy a new action. Register state/event observers before cancel/retry/save. Do not use sleeps, polling, or blindly releasing gates.

Other useful exact types: `operation-aborted`, `operation-failed`, `operation-responded`, `operation-reused`, `job-event`, `persistence-write-failed`, `persistence-write`, `persistence-read`, `local-mirror-write`, `violation`. `job-event.event` is the real durable scheduler event. Reached/responded identify the real job/attempt/operation IDs. Unexpected-operation details are retained even though the production scheduler's public generation failure message is intentionally generic.

## All six families / seven tileset variants

`plan-examples.mjs` exports machine-consumed `familyPlans({tilesetId,tileIds,imageResponse,provider})`: 12 plans, all six families, all seven tileset variants, 23 physical operations for the illustrated happy paths (database artwork enabled). Every response has a computed content pin. Register the corresponding plan **before** its actual UI submission; do not register all examples as if they were automatically valid for an arbitrary project.

```js
import { familyPlans } from './.omo/evidence/ai-job-queue/task-8/plan-examples.mjs';
// Values below come from GROK's serialized disposable project and artifact manifest.
const plans = familyPlans({ tilesetId, tileIds, imageResponse, provider: 'google-antigravity' });
// POST one plans[n] to /__task8/plan before that control's click.
```

| Family/variant | Exact planned keys | Example provider responses | Required real-editor setup |
| --- | --- | --- | --- |
| assistant | `assistant/provider/0`, `/1`, `/2` | Full intent JSON, `create_map` tool call, final text | Matching map-domain request; real captured project. Creates an 8x8 private map, not an injected result. |
| region | `region/provider/0`, `/1`, `/2` | Selection-aware intent, `create_map`, final text | Real current map/rectangle; use region `mode:"task"` as in the base executor proof. Other modes enforce their real region rules. |
| database | `database/text`, `database/artwork` | OpenAI-compatible item JSON text, opaque image envelope | Item generation with artwork selected. For text-only omit the artwork operation and uncheck artwork; then expect one operation. Enemy JSON must match the real enemy parser. |
| event-commands | `event-commands/assist/0` | Text containing `[{"kind":"text","body":"Task8 retained command"}]` | Open a real event page/common-event command draft. Keep the exact draft open for draft Apply; use the real save action to publish the draft. Invalid generated commands can require explicit `/1`, `/2` repair responses. |
| tileset cluster-edit | `tileset/cluster-edit/provider/0..2` | Intent, `upsert_tile_group`, final text | Existing captured tileset and group ID. Example creates a named group in the private proposal. |
| tileset range-classify | `tileset/range-classify/provider/0..2` | Intent, `upsert_tile_group`, final text | Captured atlas range `rect` and exact `tileIds`. |
| tileset unclassified-analysis | `tileset/unclassified-analysis/provider/0..2` | Intent, `upsert_tile_group`, final text | Nonempty unclassified `sampleTiles` and matching total. |
| tileset knowledge-analysis | `tileset/knowledge-analysis/provider/0` | `{"summary":...,"proposals":[{"template":"desk","tileIds":[...],"name":...,"confidence":0.7}]}` | Pinned atlas artifact, feedback array; valid tiles within captured tileset. |
| tileset proposal-draft | `tileset/proposal-draft/provider/0` | `{"tiles":[{"tile":...,"label":...}]}` | Actual completed temporary-map snapshot/image + nonempty summary, selected tiles, setupChoice, lockedAnswer. Example assumes unlocked/compatible answer. |
| tileset question-followup | `tileset/question-followup/provider/0` | Same knowledge-response schema | Pending proposal from the actual predecessor review, current fingerprint, captured turns/answer; preserve `sourceJobId`/`dependsOn` where the UI uses them. Do not invent the review ID/fingerprint. |
| tileset structure-kit-metadata | `tileset/structure-kit-metadata/provider/0` | `{"description":...,"tags":["fixture"],"placement":[{"zone":"againstWall","facing":"north","strength":"hard"}]}` | Existing captured structure kit of kind `section`, exact kit ID. |
| image | `image/provider/generate` | Opaque image envelope | Actual compatible map/common-event/draft destination, available resource ID, requested postprocessing; preserve draft ownership for draft-only Apply. |

The examples derive from the real Task4 executor/provider contracts; only schema/key/count coverage was run for all examples here. Full family UI execution and image suitability remain GROK's work. If the actual UI requests extra intent, repair, rendering-analysis or tool rounds, configure their exact operations/responses deliberately from the real contract. An unplanned request must remain RED; never add wildcard success/fallback.

### Artifact pinning

GROK supplies the serialized disposable project and any already-approved opaque image bytes/response envelopes. No images are generated or visually inspected by this fixture author. The opaque-byte unit-test specimen is deliberately **not** a usable PNG and must not be used for UI proof.

1. Save the exact project serialization as a fixture-owned file; SHA-256 its UTF-8 bytes. POST those exact bytes as `serialized` and the digest as `sha256` to `persistence/init`. A bad hash or second initialization is rejected. Include all required real map/event/common-event/tileset/group/section-kit structures in the serialized project, not mutations to a user's project.
2. Pin atlas, temporary-map, report asset and generated-art response files in GROK's artifact manifest with SHA-256/byteLength/mediaType. Existing uploaded project assets must contain the supplied data URLs. The real UI submission retains actual snapshot/artwork/reportAssets refs through the real job HTTP API; the fixture does not substitute refs or generated results.
3. An image response has shape `{"image":{"dataUrl":"data:image/png;base64,...","mimeType":"image/png","model":"gemini-3.8-flash","provider":"google-antigravity"}}`. GROK encodes only its supplied bytes. Hash the entire canonical response JSON for `responseSha256`; separately pin raw image bytes in its artifact manifest. `familyPlans` computes the response pin automatically. No URL-fetching provider response is supported.
4. Read the real job detail/manifest and download only its authorized artifacts. Compare the retained response ref/hash in counts, generated/processed artifacts, report refs and loaded project identity. Raw and postprocessed bytes can differ legitimately: postprocessing and the real renderer are intentionally not stubbed.

## Matching-project Apply and save proof

Initialize persistence **before navigating the editor**. Open a fresh context at `${TASK8_ORIGIN}/?project=task8-disposable-qa`, without `fresh`, `blank`, showcase, or offline flags. These flags deliberately disable normal remote persistence. The compiled environment fixes `/supabase` and the disposable project; `/api/ai-jobs/session` supplies the run-specific backend identity. Verify the real loaded identity equals the queued job's identity; do not force a local identity into the job or fabricate application evidence.

For publication-failure proof, set `{failWrites:0,blockWrites:true}` before Apply. This keeps failure deterministic despite autosave/commit logging. Apply is allowed to mutate the actual editor while the canonical wire remains unchanged. Click the real save-only retry. Then inspect the actual receipt plus `persistence/snapshot`. The base production `retryJobSave` leaves **`save:"unknown"`** when `store.flush()` throws HTTP 503 (it marks `failed` only when flush returns a nonsaved result). This was observed, not changed. It is not a successful save and must not be asserted as `failed` just to satisfy a screenshot expectation.

Set `{failWrites:0,blockWrites:false}`, use the same job's real save-only retry, then independently reload through the normal store/Supabase load path. Require `application:"applied", save:"saved"`, the same receipt/result identity, unchanged provider count, and real reload confirmation hash matching the exact applied snapshot. The backend exercise verified this path, item price/name readback, and a subsequent normal map CAS/row save/load. Draft-only event-command/image Apply remains deliberately unsaved until the owning real editor draft is committed; `retryJobSave` does not promote a draft into remote project-save proof.

The local PostgREST wire is not a general Supabase emulator: no real auth/RLS/realtime/RPC/storage service, hosted durability or cross-process DB persistence is claimed. It persists canonical state across browser/editor reloads within the owned fixture process; a fresh fixture starts empty. Unsupported queries are limitations to report, not permission to forward upstream.

## Assertions and cleanup

For each job assert exact `jobCount`, `operationCount`, `controlledCalls`, operation keys/statuses, plan binding/cursor/remaining, attempts, immutable refs, and actual generation/report/application/save state. `logicalRequests` counts executor calls into the **real** ledger. `reusedResponses` counts completed ledger responses returned without another transport dispatch. A checkpoint that bypasses the ledger entirely can reuse durable work while both logicalRequests and reusedResponses stay unchanged; assert unchanged operation refs/count and the new attempt instead.

Happy paths require no violations/unconsumed operations/held gates. Negative scenarios must assert the exact expected violations, not ignore the list. Browser route interception is optional defense/static transport only; the Node negative proof calls paid HTTP endpoints directly and verifies denial. Do not label a constant zero as vendor spend accounting: the forbidden-default sentinel test and controlled-only assembly prove no live adapter invocation in this fixture.

The runner writes `<label>-cleanup.json`, a unique UUID fixture cleanup receipt, `<label>-server.log`, and `<label>.log` in Task8's evidence directory. Require matching run IDs/temp paths, commandExit 0, serverExit 0, `graceful:true`, no cleanup errors/escalations/remaining PIDs, `portFree:true`, temporary removed, service/server closed, `activeBrowsers:0`, `held:[]`, `waiters:0`. A command failure can coexist with successful cleanup and must remain RED. Finish all pending state observers/close browser contexts before workload exit; the runner owns the entire descendant tree and detects leaks.

## Verification evidence

- `qa-wire-red.txt`: discriminating pre-fix assembly test reached `FORBIDDEN_LIVE_SENTINEL` instead of controlled `PROVIDER_NOT_DISPATCHED`; no real adapter/network used.
- `qa-wire-final-tests.txt`: focused fixture tests plus existing real HTTP job-service tests. Covers exact held response, pre-registered signal, unknown operations, forbidden sentinel, cancel/late response/retry/reuse, injected failure, opaque byte transport, pins, wait cleanup, all-family plan keys/counts and isolated canonical CAS/map rows.
- `qa-wire-task7-regression.txt`: all six unchanged Task7 runner process tests GREEN, including approved exceptional cleanup branches.
- `qa-wire-real-http-proof.json` and `qa-wire-release-cleanup.json`: owned real database executor/report/Apply/store/save/reload exercise GREEN, exactly one job/one operation/one controlled provider call; five deliberate legacy HTTP denials and one deliberate foreign-project denial; no external browser origins/page errors. Latest run identity is in these files.
- Changed JS/Python files: LSP diagnostics returned none; Node syntax checks/Python compile pass. JSON LSP unavailable (`biome` not installed); no installation attempted. The QA JSON config is parsed by TypeScript.
- Plain app typecheck is blocked by the pre-existing unresolvable zod import and dependent implicit-any errors (`qa-wire-typecheck.txt`). The explicit existing-package alias config `tsconfig.qa-wire.json` typechecks cleanly (`qa-wire-resolved-typecheck.txt`). No production type error is suppressed.
- Safe application Vite build with `configFile:false`, `envFile:false`, existing zod alias and temporary output passed (`qa-wire-build.txt`); existing circular/dynamic-import/chunk-size warnings remain visible. Build output/cache were removed. No normal Vite credential/config loading or full UI family E2E was run.
- Initial real integration exposed/fixed receipt ordering (snapshot after repository close) and added the controlled normal activity mirrors. One outer tool timeout killed the initial runner during that new receipt bug; its exact known server+esbuild descendant PIDs were reclaimed with pidfds and its temp/port verified cleaned (`qa-wire-initial-emergency-cleanup.json`). Later owned runs exited naturally with complete receipts. The initial failure logs remain evidence, not claimed GREEN.

Focused validators:

```bash
cd /dev/shm/task8-qa-wire-MyjYVp
node --test .omo/evidence/ai-job-queue/task-8/qa-wire.test.mjs test/aiJobsHttp.test.mjs
python3 -m unittest discover -s .omo/evidence/ai-job-queue/task-7 -p test_runner_cleanup.py
node node_modules/typescript/bin/tsc --noEmit -p .omo/evidence/ai-job-queue/task-8/tsconfig.qa-wire.json
```

GROK's complete family UI matrix, supplied image validity/visual proof, and the parent's migration integration remain explicitly unverified here. The safe reusable backend wire and the matching-project real Apply/save path are functional; there is no fixture process left running for GROK to accidentally reuse.
