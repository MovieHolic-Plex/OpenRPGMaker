# Task 4 - isolated region generation

Branch: `agent/aiq-region-silver`
Base: `9647fac2`
Worktree: `/home/main/z-project/rpg-zzu-aiq-region-silver`

## Delivered interface

```ts
executeRegionJob(
  input: AiJobInput & { family: "region" },
  host: AiJobHost,
): Promise<AiJobResult>
```

Export: `src/ai/jobs/executors/regionJob.ts`. It also re-exports
`RegionJobPayload` and `RegionJobResultMetadata` from `regionPayload.ts`.
No shared worker dispatch, provider bridge, host interface, assistant executor,
UI submission, application, or remote persistence code was changed.

### Exact payload

```ts
{
  instruction: string,                 // nonempty
  mapId: string,                       // must exist in submitted project
  region: { x: number, y: number, width: number, height: number },
  mode: "task" | "polish",
  config: {
    authMode: "chatgpt",
    providerId?: "google-antigravity" | "openai-codex",
    model: string,
    liteModel?: string,
    maxToolCalls: number,
    maxTokens: number,
    reasoningEffort?: "off" | "low" | "medium" | "high",
    autonomyLevel?: AiConfig["autonomyLevel"],
    agentMode?: "auto" | "chat",
  },
  context: {
    budgetChars: number,
    preferenceMemorySection: string,
    currentMapId?: string,
    viewport?: MapViewportSnapshot | null,
    projectScopeKey?: string,
  },
}
```

The rectangle must use safe integers, have positive dimensions, and fit the
submitted map. Current-map and viewport IDs, when present, must match mapId.
Config/context reuse `parseAssistantPayload` and its existing enum/shape guards;
API keys, URLs, callbacks, unsupported transports and unknown payload fields
are rejected. The project uses the existing deserializer. `input.target.mapId`,
if supplied, must match. Use `input.mode = payload.mode`; payload.mode owns the
region behavior. Capture the surface-resolved config at submission.

Selection is derived exactly from mapId/region, never read from editor state.
The session gets both this selection and explicit turn scope/instruction.
Viewport and preferences are submitted values. This adapter always uses the
submitted project snapshot; dependency/follow-up admission is supervisor-owned.

### Exact result

`family = "region"`; job/attempt IDs come from the host. Project identity and
baseSnapshot remain the submitted values. `generatedSnapshot` references the
complete clipped/reviewed project, not merely the target map. New interior maps,
other maps, tileset changes and uploaded artwork survive in that snapshot.

`payload` contains the real assistant turn, usage and audit, plus:

- mapId, region, mode, instruction;
- changedCells, changedEvents, mapsAdded, clippedCells, seamCells;
- completedHouses: immutable pre-clipping new-house protection evidence;
- review?: existing harness issues/metrics plus layout/blend diagnostics;
- completion: "complete", applied: false, persistence: "not-applicable",
  checkpoint: "private-draft".

The existing cell/event counting rules are retained. A no-op does not perform
opportunistic seam polish and has no review, matching the foreground short path.
Diagnostics are advisory; house protection is an invariant. Unsafe clipped or
polished completed houses cannot produce a successful result.

`artifacts` contains immutable JSON refs for the prepared snapshot, cumulative
session draft/tool journal/raw completion, and final generated snapshot.
Generation never applies, saves, opens a pending slot, creates ghosts, distills
preferences, or records foreground activity.

## Generation and recovery

`regionGenerationCore.ts` extracts the actual foreground message/count/review
rules; foreground runRegionTask reuses these calculations but retains its UI
lifecycle. `buildPaletteTileGroups.ts` is the pure extraction of the existing
palette preparation and its required constants. The mixed palette module
re-exports its public API. regionSurroundings and regionChangeSummary now import
eventDisplayName directly from the project module.

The approved turnGuide ownership extension is implemented as the smallest
possible cut: one import changes from the panel module to the extracted pure
palette module. turnGuide itself is already the pure material-label helper;
there is no duplicate formatter or additional wrapper.

The executor explicitly adapts `executeAssistantJob` rather than importing
runRegionTask. The host adapter uses stable `region/provider/0`, `/1`, ... paid
operation keys, and `region/session/<assistant-stage>` checkpoint keys. It does
not change request bytes or weaken ledger request equality.

Region checkpoint state:

```ts
{
  version: 1,
  kind: "region",
  preparedSnapshot: BlobRef,
  session?: { stageKey: string, state: JsonObject, artifacts: BlobRef[] },
  completed?: { generatedSnapshot: BlobRef, payload: JsonObject },
  failure?: { stage: "session" | "review", message: string },
}
```

The nested session state is the unchanged version-1 assistant journal schema.
Incoming refs, projects, session state, completed target/count fields and
completion flags are guarded. A completed resume returns the same final ref.
Failure checkpoints are `region/partial/session` or `region/partial/review`.
Session failures retain recorded tools/IDs and reuse paid responses on retry.
Review/house/storage failures retain the completed raw session snapshot and
artifacts, throw honestly, and retry deterministic finalization without another
provider operation. Failure does not masquerade as completed/applied/saved.

## Shared replay fix (ownership explicitly extended)

Only `src/ai/jobs/checkpointState.ts` changed in shared execution code.
`parseSessionJobState` reconstructed ToolResult and ChangeSummary in schema
property order. In actual create_map output, `diff.mapPropertiesChanged` follows
`tilesChanged`; reconstruction moved it near the end, and also reordered
ToolResult.data/diff. The session serializes these values inside tool-message
strings. Therefore the next provider request differed byte-for-byte although
JSON meanings matched, triggering the correct request-mismatch protection.

The fix validates the same scalar/array/issue/diff fields with existing guards,
then clones the original validated ToolResult. Original property order and
optional field presence survive. No public API, paid operation key, retry rule,
provider bridge, or OPERATION_MISMATCH check changed. No request-normalization
workaround remains. Negative tests still reject malformed ok, numeric diff and
issue severity fields. `red-shared-replay.log` shows exact before/after JSON;
`replay-investigation.log` shows the affected `region/provider/2` request substring.
Other family adapters can consume the fixed shared parser without changes.

## Verification and resources

See COMMANDS.md for commands/exits and lsp.md for diagnostics.

- RED isolation: the old region orchestrator graph reached store, panels,
  history, ghosts, pending state and preference distillation.
- Behavioral RED: no-op polish incorrectly changed 31 cells before restoring
  the existing no-op rule.
- Shared RED: real tool-result JSON bytes changed after checkpoint validation.
- 148 tests / 13 focused and affected-foreground files passed, exit 0.
- Final 22 tests / 3 files passed, exit 0, including 15 region/shared/isolation
  cases and material/palette tests. Actual session/tools run against deferred
  host-provider wire responses, not a fake executor. Artwork preservation is
  explicitly checked with an embedded image asset.
- Final application typecheck passed. All changed TS files have clean LSP
  results. One busy-machine diagnostic timed out; a subsequent request was clean.
- Runtime transitive graph has no store, editor panels/state/history, pending
  slot, ghost lifecycle, preference distillation or PWA. The real executor module
  and helper/tool surfaces execute in the focused tests.

Two late runs passed assertions but failed with Vitest onTaskUpdate RPC timeout
(kept as runner-contention.log and runner-serialized-failure.log). The initial
in-memory host resolved all writes on microtasks; a long suite could starve IPC.
Its transaction acknowledgement now uses a real MessageChannel event: listeners
are attached before send, bounded timeout, both ports closed in finally. No
sleep, polling, timeout increase or error suppression was added. The final
region suite exceeded 60 seconds and passed cleanly in one run.

No paid calls, environment-file reads, real provider credentials, remote writes,
or project saves. No application server/browser/provider process was started.
Port 19845 is free. Test MessageChannels/timers are closed and blobs are in-memory.
Only language-server infrastructure remains managed by the diagnostics tool.
Whole build/gates and real-browser six-family integration are explicitly left
to the supervisor, as requested; they are not claimed here.

## Supervisor integration

Add the region branch in workerEntry's dispatcher, calling executeRegionJob with
its narrowed input and existing host. Capture the payload above in the later UI
submission migration. WorkerEntry/contracts/providerAdapter remain untouched.
No additional shared product fix is blocked; the approved import and replay cuts
are included in this commit. Apply the shared parser change before sibling
adapters rely on resumed map-tool response strings.

The commit SHA is returned in the task result (this file is included in that
commit, so it does not contain a self-referential commit hash).
