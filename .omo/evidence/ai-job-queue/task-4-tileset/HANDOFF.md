# Task 4 tileset family - st_01a07678

Implemented on `agent/aiq-tileset-silver` in
`/home/main/z-project/rpg-zzu-aiq-tileset-silver`, based on
`9647fac2670b7fe9bd12768a529f74ab34bd25be`.
Initial implementation commit: `b7296218af5bea48c70e81be1e4480000c9738f3`.

## Supervisor correction: canonical persisted proposal replay

A subsequent **new fix commit**, not an amendment, corrects non-cluster completed
proposal comparison. See `CANONICAL-RETRY-FIX.md` for the filesystem RED, rejected
RPC-error run, exact final commands and cleanup. Post-fix proof is **112 tests /
9 files, exit 0, no unhandled errors**, plus application typecheck exit 0 and
clean diagnostics on the two changed files. Earlier 104-test results below are
historical baseline evidence, not acceptance of this correction.

The public API and checkpoint/result schemas are unchanged. The fix is confined
to `tilesetJob.ts`, its owned tests and evidence; no shared source was edited.

## Integration API

```ts
import {
  executeTilesetJob,
  TILESET_JOB_OPERATIONS,
  type TilesetJobPayload,
  type TilesetJobProposal,
  type TilesetAnalysisProposal,
  type TilesetClusterProposal,
} from "@/ai/jobs/executors/tilesetJob";

executeTilesetJob(
  input: AiJobInput & { family: "tileset" },
  host: AiJobHost,
): Promise<AiJobResult>
```

**Supervisor integration:** add the `tileset` dispatch in `workerEntry.ts` to this
function. No shared contract/host/provider/browser/vite/package changes are
required. Those files and other family executors were not edited. No UI
submission migration or application authority is included.

### Exhaustive operation inventory and source callers

These are all existing tileset-family paid operation boundaries, not a sample.
The original helper bodies were extracted, not replaced with successful stubs.

| `payload.operation` | Existing source caller / actual generation path |
| --- | --- |
| `cluster-edit` | `clusterAiModal.ts::kickoffFor`, `aiChatPanel.ts::handleAiAssist` legacy event bridge -> `buildClusterEditKickoff` -> isolated `AssistantSession` |
| `range-classify` | `tilePaletteSheet.ts` range action -> `openClusterAiModal` -> `buildRangeClassifyKickoff` -> isolated session, including real `suggest_group_from_range` / `render_group_sample` tools |
| `unclassified-analysis` | `clusterAiModal.ts::kickoffFor`, `aiChatPanel.ts::handleAiAssist` -> `buildUnclassifiedAnalysisKickoff` -> isolated session |
| `knowledge-analysis` | `tilesetAiWorkspaceModal.ts` open/reanalyze and `tilesetAiNativeReviewInbox.ts` initial/retry buttons -> `runTilesetAiReview` / `analyzeTilesetKnowledge` |
| `proposal-draft` | `tilesetAiProposalModal.ts` -> `createTilesetAiProposalController().analyze(lockedAnswer)` -> extracted prompt, Cpen request, locked-edit merge and metadata normalization |
| `question-followup` | `tilesetAiWorkspaceModal.ts::onAnswer` -> `answerTilesetAiQuestion` -> feedback-bearing knowledge reanalysis, matching refreshed proposal, staging and conversation turns |
| `structure-kit-metadata` | `structureKitEditorDialog.ts` AI draft button -> `requestAiMetaDraft` -> extracted `buildStructureKitAiRequest` / `buildAiMetaDraftPrompt` / `parseAiMetaDraft` |

Cluster text follow-ups reuse their original operation with captured
`instruction` and `priorTranscript`; proposal retries/question answers in the
mapping editor reuse `proposal-draft` with `lockedAnswer`. Native reanalysis
reuses `knowledge-analysis` with feedback and optional previous review. These
are not missing extra discriminators. Structure metadata operates on section
kits, matching the actual editor; legacy house-kit records are not section
matrices and are rejected before dispatch.

### Exact captured payload

All variants carry:

```ts
{
  operation: /* table above */,
  tilesetId: string,
  config: {
    authMode: "chatgpt",
    providerId?: "google-antigravity" | "openai-codex",
    model: string,
    liteModel?: string,
    maxToolCalls: number, // positive integer
    maxTokens: number,   // positive integer
    reasoningEffort?: "off" | "low" | "medium" | "high",
    autonomyLevel?: /* existing AUTONOMY_LEVEL_IDS */,
    agentMode?: "auto" | "chat",
  },
  context: {
    budgetChars: number, // positive integer
    preferenceMemorySection: string, // explicit, including empty string
    currentMapId?: string,
    projectScopeKey?: string,
    viewport?: /* existing captured MapViewportSnapshot, or null */,
  },
  sourceJobId?: string,
}
```

Variant fields (all required unless marked optional):

- `cluster-edit`: `groupId`, optional `instruction`, `priorTranscript`.
  The group's metadata is resolved from the captured project, not the store.
- `range-classify`: `rect: {x,y,w,h}`, `tileIds: number[]`, optional
  `instruction`, `priorTranscript`. Coordinates/IDs are validated against the
  captured tileset and range.
- `unclassified-analysis`: `sampleTiles: number[]`, `total: number`, optional
  `instruction`, `priorTranscript`.
- `knowledge-analysis`: `atlas: BlobRef`, `feedback: string[]`, optional
  `review: TilesetAiReviewReady`.
- `proposal-draft`: `selectedTiles: number[]`, `setupChoice: AiSetupChoice`,
  `snapshot: { image: BlobRef, summary: string }`, `lockedAnswer: string`.
  `AiSetupChoice` is the existing intent/repeatability/scope/structure union;
  all four enum fields are validated in `tilesetPayload.ts`.
  The completed temporary-map image/summary must be captured before submission.
  Map name/usage context is derived from the submitted project/currentMapId.
- `question-followup`: `atlas: BlobRef`, `review: TilesetAiReviewReady`,
  `proposalId: string`, `answer: string`, `turns: TilesetAiConversationTurn[]`.
  Review fingerprint, target, IDs, layers, passages, confidence, status,
  feedback, quick replies and conversation fields are validated. A nonempty
  answer must target an existing pending proposal.
- `structure-kit-metadata`: `kitId: string`. The section matrix and existing
  names are resolved from the captured project; preferences come from context.

`BlobRef` is the existing `{sha256,byteLength,mediaType}`. Images accept PNG,
JPEG, WebP or GIF refs; checkpoint JSON refs require `application/json`.
The host reads immutable bytes; no remote image URL is accepted as the atlas.
`input.projectSnapshot` is deserialized with the real project deserializer.
`input.project`, artwork refs and snapshot identity are preserved in results.
`input.mode`/`target` remain the queue envelope's descriptive metadata; payload
fields above are the authoritative execution target.

Config reconstruction uses the existing assistant payload guards. API keys,
base URLs, unsupported auth modes/providers, malformed budgets/config fields
are rejected before paid work. Existing surface policies select the cluster
lite tier, structure supervisor tier, and tileset-analysis supervisor tier with
8192 output tokens. Auth mode and provider ID are never switched to a fallback.

### Captured dependency semantics

Standalone captures (including pre-migration foreground review snapshots) use
no `sourceJobId` and no `dependsOn`.
A queued follow-up sets `sourceJobId` and includes it in `input.dependsOn`.
The host must supply that completed tileset result in `host.dependencies`.
Project identity and snapshot lineage are checked before dispatch:

- Cluster continuations submit the predecessor's `generatedSnapshot` as their
  project snapshot, plus explicit captured transcript/instruction.
- Analysis continuations use the same predecessor base snapshot/tileset.
  Native review content must match predecessor output, except that user
  `status` and `feedback` choices may differ.
- Missing, cross-project, incomplete or mismatched predecessors are rejected.
  Dependencies are not silently treated as unrelated snapshot work.

### Exact result semantics

Every returned result has version 1, family `tileset`, the host job/attempt IDs,
original project identity and `baseSnapshot`. No result claims remote save or
editor application. `payload.persistence` is `not-applicable` and
`payload.completion` is `complete` only on successful generation.

- Cluster output: `generatedSnapshot` is the immutable detached project proposal.
  Payload is `TilesetClusterProposal` (`TurnResult` fields, `kind: "cluster"`,
  `operation`, usage, audit and `previews`) plus `checkpoint: "private-draft"`.
  `appliedCalls` is empty/absent. Preview entries carry `index`, honest
  `status: "ready" | "missing"`, and `{ref,label}` images. Artifact refs include
  captured artwork, draft/tool journal refs and rendered images.
- Native analysis/question: `generatedSnapshot: null`; payload includes
  `kind`, `tilesetId`, typed `review`, typed `turns`,
  `checkpoint: "private-proposal"`, and immutable `proposalRef`.
  Review `accepted` means staged for review, never applied. Previously
  accepted/skipped choices, feedback and matched IDs survive reanalysis.
- Mapping: same null snapshot/private-proposal envelope; `kind: "proposal-draft"`,
  `tilesetId`, normalized `answer`, typed validated `mapping`, `proposalRef`.
  Locked edits and user question answers survive normalization. Empty/malformed
  mappings and invalid preview dimensions fail rather than produce success.
- Structure: same null snapshot/private-proposal envelope;
  `kind: "structure-kit-metadata"`, `tilesetId`, `kitId`, typed `metadata`,
  `proposalRef`. Origin stays `ai`; placement-condition IDs are deterministic
  `pc_${jobId}-${kitId}-${index}` and stable across retry.

All non-cluster result artifacts include captured artwork/image, raw response
JSON and final proposal JSON. Render-only snapshot helpers accept a supplied
image and import neither store nor panels. Foreground wrappers preserve their
existing loader/UI behavior. Worker paths contain no snapshot polling, remote
`recordAiAnalysisRun`, singleton native-review application, or direct provider
transport.

## Checkpoint/provider contract

Paid operation keys are `tileset/<operation>/provider/<zero-based ordinal>`.
All text/vision calls, including cluster intent and session internal stages,
use `host.providerOperation` with existing wire encoder/parser; no client HTTP
or hidden retries. Provider failures latch at the chat boundary.

Non-cluster checkpoint state:

```ts
{ version: 1, operation, rawRef?: BlobRef, proposalRef?: BlobRef }
```

Stages are `tileset/<operation>/request`, `/response`, `/completed`. Raw JSON is
`{text,finishReason}` and is checkpointed before parsing/postprocessing.
Invalid output/truncation survives failure; retries reuse it without paying
again or upgrading truncation to success. A completed retry regenerates the
pure typed proposal from saved raw text, validates the host-produced canonical
content identity (hash, length and media type) against its saved proposal ref,
and returns the same immutable ref. Failed completion checkpoints can rerun
pure parsing/ID derivation without repeating the provider stage.

Cluster checkpoint state:

```ts
{ version: 1, operation,
  session: /* existing guarded session checkpoint v1 */,
  renders: Array<{key: string, images: Array<{ref: BlobRef, label: string}>}> }
```

The shared session host journals real tool results/deltas, IDs, clock and draft;
outer checkpoints retain rendered-image refs as well. Retry replays those
actual tools/images instead of reallocating IDs or regenerating pixels.
Budget/execution/provider failure retains `session.partial` and throws
`TILESET_INCOMPLETE`; it never returns a completed result. Completed retry uses
the exact generated snapshot ref. Artifacts are deduplicated, stable and retained.

**Shared issue discovered, not edited:** `parseSessionJobState` reconstructs
`ToolResult`/diff property order. Model-facing tool messages embed JSON strings,
so an otherwise identical replay can change the paid request string. The new
three-cluster retry tests reproduced this. The tileset provider boundary
canonicalizes embedded tool JSON for both first dispatch and replay. Supervisor
may apply the same correction to the shared assistant bridge/parser; this lane
did not edit either. See `replay-diagnosis.log` for the exact mismatch.

## Original implementation verification and limitations (historical baseline)

`COMMANDS.md` records exact validator commands and exits.

- Behavioral RED before product changes: native analysis runtime graph reached
  Cpen panel, connection-status panel, temp-map panel and `project/store.ts`.
- Original lane focused run: **104 tests / 9 files**, including **28 adapter/graph
  tests**. Real helpers, isolated session tools, range suggestion and sample
  renderer execute. Host-provider/renderer events are explicitly deferred;
  tests use no sleeps or polling and no real provider/remote writes.
- `typecheck:app`: exit 0. All 28 changed source/test files received final
  per-file LSP `No diagnostics found` results. Four overloaded requests timed
  out initially and were completed after the test load ended.
- Extended foreground regression: 116 passed, 1 failure plus 1 unhandled
  rejection in `tilesetAiWorkspaceModal.test.ts` from
  `matching.matches is not a function`. A read-only HEAD source overlay
  independently reproduced the identical failure/rejection (3 passed, 1 failed).
  This is the pre-existing fake-DOM/workspace-focus mismatch, not changed here.
  No test was deleted, disabled or changed to conceal it.
- Full six-family browser dev/preview test and whole build/gates remain
  supervisor-owned and were not duplicated. Unit render evidence uses controlled
  image/canvas primitives; it is not claimed as browser screenshot verification.
- No listener/browser was launched on port 19846; cleanup confirms it is free.
  No process/resource owned by this task remains. No push/merge or parent-tree
  modification was performed.
