# Database-family job adapter handoff

Task: st_01a07674. Base: 9647fac2. Branch: agent/aiq-database-silver.
Worktree: /home/main/z-project/rpg-zzu-aiq-database-silver.

## Delivered

- `src/ai/jobs/executors/databaseJob.ts` exports the real item/enemy executor,
  payload/proposal/artwork interfaces and its checkpoint validation.
- `src/ai/databaseGenerationCore.ts` contains the existing prompt, parser, ID,
  tool-call and explicitly injected foreground orchestration helpers. It has no
  store or panel import. Malformed generated fields are now checked recursively
  against the existing DB tool schemas before artwork; numeric/boolean coercion,
  optional partial-record fields, whitelist and world-canon behavior remain.
- `src/editor/aiDatabaseGeneration.ts` remains the foreground-compatible entry,
  re-exporting the helpers/types and supplying its original client/store/apply
  defaults. No UI submission migration is included.
- `test/aiDatabaseJob.test.ts` executes the actual executor, wire parsers, tool
  runner, PNG decoding/encoding, artwork helper and alpha algorithm. Only the
  host/provider and DOM pixel-I/O boundaries are controlled.

## Exact executor API

```ts
executeDatabaseJob(
  input: AiJobInput & { family: "database" },
  host: AiJobHost,
): Promise<AiJobResult>
```

`DatabaseJobPayload` (the input's `payload`, not `target`):

```ts
{
  kind: "item" | "enemy", // monster is represented by the existing enemy kind
  brief: string,          // nonblank, trimmed
  config: {
    authMode: "chatgpt",
    providerId?: "google-antigravity" | "openai-codex",
    model: string,
    maxToolCalls: number, // positive integer, existing captured config contract
    maxTokens: number,   // positive integer
    liteModel?: string,
    reasoningEffort?: "off" | "low" | "medium" | "high",
    autonomyLevel?: AiConfig["autonomyLevel"],
    agentMode?: "auto" | "chat"
  },
  withArtwork: boolean
}
```

The shared `parseAssistantPayload` config guard is reused without constructing
or executing an assistant. Unsupported auth/provider modes, credential fields,
callbacks and unknown payload/config keys fail before paid work. As in task 3,
API-key/gateway execution is not silently redirected to OAuth.

The common input envelope uses the submitted `projectSnapshot` and `project`
identity unchanged. `mode` remains a downstream application/review policy;
`target` can be `{}`. This family does not read the current editor, use a pending
singleton, resolve dependency projects or save remote data. A supervisor capturing
follow-up work must submit its intended baseline explicitly; ordinary DB jobs
use the submission snapshot.

Successful result:

```ts
{
  version: 1,
  family: "database",
  jobId: host.jobId,
  attemptId: host.attemptId,
  project: input.project,
  baseSnapshot: input.projectSnapshot,
  generatedSnapshot: BlobRef, // immutable full detached project JSON
  artifacts: BlobRef[],      // [] or [rawImageRef, processedImageRef]
  payload: {
    kind: "item" | "enemy",
    recordId: string,
    name: string,
    record: JsonObject,      // complete normalized record facts, not live reads
    resourceId?: string,    // `${recordId}_art` when artwork is generated
    artwork?: {
      raw: BlobRef,
      processed: BlobRef,   // always present in successful artwork results
      model: string,
      provider: string
    },
    summary: string,
    completion: "complete",
    persistence: "not-applicable",
    checkpoint: "private-draft"
  }
}
```

`DatabaseJobProposal` and `DatabaseArtwork` are exported. `processed` is optional
in the latter's TypeScript shape because the same shape represents the durable
raw-artwork checkpoint; successful artwork output requires it. Image refs hold
binary image bytes with image MIME types, not JSON/data-URL wrapper documents.
The generated project's uploaded asset contains the processed image data URL.
There are no `applied` or `saved` claims. Record facts are the normalized item or
enemy record produced by the real tools, sufficient for report rendering without
reading a live store.

## Stages, durability and paid-operation boundary

1. `database/text` provider operation uses the existing requestBody/parseNonStream
   codec, submitted config, original schema/prompt/names/world canon. Incomplete
   finish reasons/tool calls and malformed records fail without a project result.
2. `database/text` checkpoint stores `{version:1, kind, recordId, patch}`. ID is
   captured using the original ASCII-slug/numbered-Korean collision algorithm.
3. `database/artwork` provider operation uses the actual image client's injected
   transport. Request is `{kind:"image", provider:"google-antigravity", body:
   {prompt, model:"gemini-3.8-flash"}}`; text may independently use Codex.
   No HTTP fetch or client retry escapes `host.providerOperation`.
4. `database/artwork` checkpoint adds `artwork.raw`, actual model and provider.
   The raw binary artifact is retained before decoding/transparent processing.
5. `database/artwork-processed` checkpoint adds `artwork.processed`. The unchanged
   shared flattenGeneratedArtwork helper preserves connected-background alpha,
   enclosed white details, and maximum 512px sizing.
6. Run original upsert_resource then upsert_item/upsert_enemy calls through the
   actual tool runner on a detached clone. Tool/schema/lint failures never publish
   a generated snapshot. An unrelated existing generated artwork resource ID is
   rejected instead of overwritten.
7. `database/completed` checkpoint adds `completed:{generatedSnapshot,proposal}`.
   Every image ref plus the completed snapshot ref is in checkpoint artifacts.
   Completed retries validate project, record facts, binding and artifact metadata
   and return the exact saved snapshot ref, without replaying tools/providers.

Provider keys are deterministic, family/stage-scoped and independent of attempts.
Text is skipped after its checkpoint; failed artwork retries keep text/ID. Canvas
failures reuse raw artwork. Tool/output persistence failures reuse processed
artwork. Checkpoint persistence failure reuses the host's already-durable provider
response with identical request JSON. Unknown physical outcomes remain governed
by the shared host ledger, not an automatic adapter retry.

## Verified evidence

See COMMANDS.md for invocations and exits. `red.log` records two behavioral
failures (malformed item price / enemy HP accepted), with all 24 unchanged
foreground generation tests passing. It is not a missing-import/syntax RED.

`focused-final.log`: **57 tests passed in four files**, including 23 database
adapter tests plus the reused worker-graph test, 24 foreground generation tests,
7 foreground dialog tests and 2 lazy-import tests. The test file imports the
existing runtimeGraph helper, which also registers its original isolation test.

Coverage includes deferred text/artwork barriers, captured project/ID/facts,
immutable source snapshot, no direct fetch, item picture/enemy monster bindings,
transparent pixels and enclosed white detail, resizing, failed artwork/canvas/
real-tool/snapshot stages, every checkpoint persistence boundary, exact completed
replay, malformed input/project/checkpoint/output, forbidden world canon, and
forged completed artwork binding rejection. The executor transitive runtime graph
contains no store, panels, editorState, history subscription, apply-to-store or
PWA boot edge. No fixed sleeps or polling are used.

`typecheck-final.log`: `npm run typecheck:app` exits 0. LSP reported no diagnostics
for all four changed TS files (details in lsp.txt). Real tsc additionally caught an
initial incorrect resource collection access that LSP did not report; it was fixed
to assets.uploaded. A later checkpoint validation test exposed JSON object-key
ordering sensitivity; canonical comparison fixed it without weakening checks.
Intermediate failures are documented in COMMANDS.md; none remain in final checks.

No server/browser/provider processes were started, no real paid calls were made,
no remote project was written, and no environment secrets were inspected. Port
19842 is free (`cleanup.txt`). Only the owned four TS files and selected local
evidence are committed. No shared worker/contracts/provider/artwork/package/Vite
file was edited. No push, merge, main change or parent-worktree modification.

## Supervisor integration still required

Add the `database` switch branch in the shared workerEntry.ts and import
executeDatabaseJob there. No other shared runtime change is required by this
adapter. UI submission migration, delayed application, reports and real-browser
six-family dev/preview acceptance remain supervisor-owned. Tests here use a
controlled DOM pixel boundary, not a claim of completed browser integration.
Whole application build/gates were deliberately not duplicated.
