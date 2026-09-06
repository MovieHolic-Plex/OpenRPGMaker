# Task 4 event-commands: isolated durable reviewed proposals

Branch: `agent/aiq-event-silver`. Base: `9647fac2`.
Implementation and focused verification complete. The final commit is the commit
containing this handoff; its SHA is returned in the child task's final response.

## Delivered API

```ts
import { executeEventCommandsJob } from "@/ai/jobs/executors/eventCommandsJob";

executeEventCommandsJob(
  input: AiJobInput & { family: "event-commands" },
  host: AiJobHost,
): Promise<AiJobResult>
```

`EventCommandsJobPayload`, `EventCommandsTarget`, and
`EventCommandsJobProposal` are exported from the executor. The unique capture/parser
helper is `src/ai/jobs/eventCommandsPayload.ts`.

No shared worker dispatch, contracts, provider bridge/adapter, scheduler, session
host, package/Vite files, other family adapters or UI submission routes were changed.
Supervisor integration needs only the normal event-family worker dispatch:

```ts
if (input.family === "event-commands") return executeEventCommandsJob(input, host);
```

### Exact input

Use ordinary version-1 `AiJobInput` metadata and immutable `projectSnapshot`.
`mode` MUST be `"review"`; auto/other modes reject before provider work. The scheduler
uses this mode for its application state, so payload labels alone would not suffice.

```ts
input.target =
  { kind: "map-event-page", mapId: string, eventId: string, pageId: string }
  // OR
  { kind: "common-event", mapId: string, commonEventId: string };

input.payload = {
  prompt: string,                     // required, nonblank
  config: {
    authMode: "chatgpt",
    providerId?: "google-antigravity" | "openai-codex",
    model: string,                    // required, nonblank
    liteModel?: string,
    maxTokens: number,                // positive safe integer
    maxToolCalls: number,             // positive safe integer
    reasoningEffort?: "off" | "low" | "medium" | "high"
  },
  baseCommands: Command[],            // exact visible draft list, not merely saved list
  selection: number[] | null,         // existing command-path encoding; [] also accepted
  selectionLabel?: string,
  preferenceMemorySection: string,    // capture at submission; "" prevents live reads
  projectScopeKey?: string
};
```

Capture the actual map reference context even for common events. Existing map/event/
page or common-event identity is required in the submitted snapshot. Metadata comes
from that snapshot through the existing project deserializer. The separate exact
`baseCommands` is deliberately allowed to differ from the saved commands: the command
editor can hold an unsaved draft. No live store, current map, local preference, DOM
selection, callback, credential, or arbitrary provider endpoint is consulted.
Unsupported auth/provider settings and unexpected payload/config keys are rejected.
Unrelated job dependencies do not substitute another project's snapshot or target;
this adapter always uses the explicitly submitted capture.

### Exact immutable proposal and result

`generatedSnapshot` is **null**: this is a command-review proposal, not a project
snapshot and not read-only chat. `artifacts[0]` and `payload.proposalRef` point to the
same JSON blob, typed as `EventCommandsJobProposal`:

```ts
{
  version: 1,
  kind: "event-commands-proposal",
  project: AiProjectIdentity,
  baseSnapshot: BlobRef,
  target: EventCommandsTarget,
  context: { event?: GameEvent, page?: EventPage, commonEvent?: CommonEvent },
  baseCommands: Command[],
  commands: Command[],                // validated original assist output
  finalCommands: Command[],           // fully resolved replacement candidate
  scope: "page" | "append",
  attempts: number,                   // 1..3
  selection: number[] | null,
  selectionLabel?: string,
  review: {
    status: "awaiting-review",
    diff: "command-lists-v1",
    excludedRowIds: []
  }
}
```

Result payload:

```ts
{
  proposalRef: BlobRef,
  scope: "page" | "append",
  attempts: number,
  completion: "complete",
  review: "required",
  persistence: "not-applicable",
  checkpoint: "private-proposal"
}
```

Result identity is the submitted project plus current host job/attempt; base snapshot
and proposal ref remain stable across completed retries. The worker never edits or
saves any live project and never claims applied/saved. Application/report code must
consume the proposal artifact, not treat `generatedSnapshot: null` as no proposal.

### Original assist and review semantics

- Actual `runEventCommandAssist`, its lite-model surface policy, command factory
  examples, resource/reference/passability/world-canon validation and maximum two
  validation repairs are reused. A nonempty page can validly become `[]`.
- Normal page output replaces the entire list. Above the existing 12,000-character
  threshold, output is insertion-only: insert after the captured selected command,
  including nested branches, or append at root if no selection/branch is available.
- The frozen `baseCommands`/`finalCommands` pair is the durable diff representation.
  The editor reconstructs `diffCommandLists(baseCommands, finalCommands)` using the
  existing review algorithm, then `applyCommandDiff(rows, new Set(excludedRowIds))`.
  No panel code is imported by the worker. Fresh generation starts with no exclusions,
  matching the foreground regeneration behavior. Exclusions chosen later belong to
  a separate review/application record, not mutation of the generation artifact.
  The regression test exercises the actual diff/exclusion helper against this output.
- For later stale-draft detection, retain project backend/id, exact target IDs,
  `baseSnapshot`, exact `baseCommands`, selection, and captured event/page/common
  metadata. Compare the current draft list against `baseCommands` before applying;
  project/reference semantic dependencies additionally require task5's conservative
  baseline guard. No delayed-application guard or UI migration is claimed here.

### Provider/checkpoint contract

Every assist/repair call uses `host.providerOperation` with deterministic keys
`event-commands/assist/0`, `/1`, `/2`. The actual foreground wire encoder and response
parser are reused; no fetch or hidden client retry is called. Provider errors
propagate immediately, rather than being treated as validation-repair permission.

Checkpoint state is `{ version: 1, responseRefs: BlobRef[], proposalRef?: BlobRef }`.
Stage keys are `event-commands/start`, `event-commands/response/0..2`, and
`event-commands/completed`. All referenced response/proposal blobs are in the
checkpoint artifact manifest. Raw paid output is durably checkpointed BEFORE
parsing and before deciding whether to request a repair.

Retries validate the project, capture, checkpoint envelope/input SHA, state refs,
stage and artifact manifest. Completed responses are replayed locally to reconstruct
the exact repair request; only missing operations cross the provider host. If the
worker died before checkpointing a returned response, the host ledger reuses the
same operation key and identical request. Exhausted validation retains all three
responses and throws, never returning false success. Final proposal persistence
failure retains the successful response, so retry does not spend again. Completed
retry validates/reconstructs the proposal and compares content-addressed refs (not
object property order), preserving the original ref without running assist again.

### Approved import separation

The strict graph RED found an existing event resource catalog import of a DOM/video
panel. Ownership extension was explicitly approved in this task. Extracted
`listMovieResources`, `MovieResourceEntry`, and `isMovieMedia` into
`src/assets/movieResourceCatalog.ts`. The foreground `playMoviePreview.ts` re-exports
the original list/type API and still owns URL resolution/rendering. The AI resource
catalog imports only the pure helper. Existing movie-kind, preview and runtime
characterization tests remained unchanged and passed.

## Evidence and boundaries

- Meaningful RED: injected assist still reached foreground HTTP/client retry;
  strict transitive graph reached playMoviePreview; actual disk canonicalization
  broke completed retry; malformed captured text was accepted; automatic mode
  bypassed the explicit-review scheduler state. See selected logs and COMMANDS.md.
- GREEN: **103 tests / 5 files**, exit 0, including 16 tests in the new executor file
  (one is the reused existing assistant worker graph assertion).
- `npm run typecheck:app`: exit 0. LSP: all seven changed TS files reported no
  diagnostics; a transient post-whitespace diagnostic timeout was followed by a
  successful fresh check. `git diff --check` passed after fixing one EOF blank line.
- New tests call the real helper/executor, actual wire parser/encoder and actual
  fsynced local repository. Provider fixtures are deferred at the host boundary;
  assertions await explicit provider entry/checkpoint transactions, with bounded
  Vitest test timeouts. No fixed sleeps or polling in the new tests.
- Existing unchanged event-assist UI tests contain `vi.waitFor`; this pre-existing
  test-design debt is not copied into the new tests and was not broadened into an
  unrelated test rewrite.
- No paid requests, external HTTP, remote project writes, local user project writes,
  browser launch or owned server occurred. Test repositories were isolated temporary
  directories and were removed via exact teardown. Port 19844 is free.
- Full browser six-family acceptance, whole build/gates, UI capture/migration,
  reporting and delayed application are supervisor-owned and were not duplicated.

No remaining shared-code blocker. No push, merge or parent-worktree modification.
