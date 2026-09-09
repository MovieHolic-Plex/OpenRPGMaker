# Deliberate Continue contract proposal

## Preparation only - separate from the verified progress patch

Task `st_01a082f3`, read-only follow-up requested by parent. This document is the only write
in this turn. No source/test/docs outside this evidence file changed, and no tests, builds,
browsers, providers or database services ran. The parent alone owns the current 117-case
supervisor run at `/var/tmp/g1-progress-supervisor-aPwkrj/focused`; its result is not claimed here.

The existing eleven-file progress source pin remains:
`7ebee8d92bf444222aa22b361ebeaf504bdd0c3b45cec89ac2e097f93be03ac3`, base
`f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843`, branch `worktree/job-progress-contract`.
The eleven changed-file hashes were reread and match `LIVE-PROGRESS-HANDOFF.md`.
This evidence markdown is outside the frozen S0 source selection.

All field names marked **proposed** below are NOT implemented or accepted by current parsers.
This is a contract recommendation with future RED seams, not a continuation GREEN claim.

## Recommendation

Add **one assistant payload binding to an immutable successful plan-only predecessor result**,
using existing `input.dependsOn`, existing result/artifact reads and the existing assistant
executor/session. Add a narrowly validated plan-only continuation state to that predecessor's
terminal output, then initialize a fresh `AssistantSession` from that state and the successor's
freshly captured current project. Do not resume the predecessor's tool/provider journals under
a new job ID and do not restore from display progress.

Use a successful result as the cross-job authority, not an arbitrary saved checkpoint. A
completed source session checkpoint can retain the same state for completed-attempt retry,
but a failed/interrupted/cancelled source cannot mint a new-job continuation. Such a source
uses the existing explicit same-job generation retry, including unknown-cost acknowledgement.
This is the minimal safe first contract for **plan-only -> human Continue**, not arbitrary
mid-execution process/session serialization.

## 1. What the inspected implementation actually does

### Existing public session API: reuse it where it exists

`src/ai/assistantSessionCore.ts` exposes:

- `getWorkPlan()` returns a clone; `clearWorkPlan()` removes it (`1174-1180`).
- `getProposedProject()` returns the actual final current draft clone (`1136-1138`).
- `rebaseProject(project)` changes baseline/draft and clears proposals, but does not restore
  a plan (`1142-1152`). `syncBaselineFromStoreIfClean(project)` refuses while proposals exist,
  rebases and rebuilds the prompt (`1161-1166`).
- `sendUserMessage(...)` is the existing human-turn and driver entry point (`1393+`).
- `retryLastTurn(...)` retries a failed in-memory turn; it is not a persisted-session importer.
- `getHarnessSnapshot()`/`getMessages()`/audit export are readers, not restoration APIs.

**There is no public `setWorkPlan`, `restoreWorkPlan`, `resumeSession` or constructor plan
option in this inspected tree.** `applyWorkPlanTool` is private. Calling it through a cast is
not an API. `workPlanFromSetToolArgs`/`workPlanFromOrchestratorDecision` create a new plan with
new clock-derived plan identity and reset statuses/cursor; they are authoring, not restoration.

`priorTranscript` (`796`, `1029-1032`) adds one `restoredTranscriptMessage` behind the system
message. `conversationReplay.ts` explicitly makes this a bounded text history, not executable
state; it can omit old lines and excludes status entries. It does not assign `workPlan`, restore
goal gates, replay allocated IDs, or initialize successful-read evidence. It can remain useful
context via this existing API, but cannot be the continuation authority.

### Preserve the actual human-turn behavior, not a fabricated driver shortcut

The existing real-session contract is `test/aiComposerModeSession.test.ts:124-188`:

1. Plan mode invokes the planner, returns an unfinished `workPlan`, zero proposed calls, and
   does not auto-drive (`finishPlanOnlyTurn`, `1708-1716`).
2. A later human `sendUserMessage("계속", ..., {composerMode:"plan"})` sees that existing plan.
   `declareTurnIntent` recognizes exact continuation text plus an active plan and does not
   dispatch another intent declaration (`1724-1761`).
3. The ordinary planner may return `resume`; then execution enters the tool loop. The planner
   call is a **new decision for the new human turn**, not a replay of the original plan call.
   `planAuthoredThisTurn` is false for resume, so plan mode does not stop at plan-only again.
4. The human may instead supply a new instruction, and the planner may legitimately replan.

`SessionTurnOptions.driverContinue` is expressly internal (`751-762`). It suppresses normal
human reactivation and, for an active unblocked plan, skips the planner decision (`1646-1676`).
Only the autonomous driver sets it. A new durable Continue job must NOT expose/set this flag
merely to avoid a paid planner request. Automatic continuations remain inside one job/attempt
execution and use its counters/ledger; explicit human turns are new captured submissions.

### Hidden state that a work-plan-only import would incorrectly drop

A real plan-only turn also establishes goal contracts before returning:

- `adventureRequirements` from the declared intent (`1568-1573`).
- `readEvidence.begin(intent.readBeforeWrite)` (`1574-1577`).
- `runVolumeBar` and `runVolumeBaseline` when the planner declared volume (`1886-1892`,
  `2034-2042`). The baseline is `measureVolume(project)` at the time the plan was armed.

Exact Continue intentionally retains these (`intent.source === "continuation"` branches).
They are not all encoded in `WorkPlan`. Restoring only checklist text/IDs would remove read
requirements or permit a premature volume/adventure completion. Fresh read/verification
success evidence is correctly empty at a genuine first plan-only boundary because no tools
executed. This distinction is why the export must verify a clean plan-only boundary rather
than infer it from an unfinished plan or `stoppedReason:"final"` alone.

### Existing durable primitives are sufficient for transport

- `scheduler.mjs:96-101` loads succeeded dependency results into `host.dependencies` and grants
  reads of their `baseSnapshot`, `generatedSnapshot`, and `artifacts` refs.
- `drainQueue` waits for succeeded dependencies and fails dependent generation for failed,
  cancelled or interrupted predecessors (`181-188`).
- `host.loadCheckpoint()` loads the **current job's** checkpoint, not a predecessor checkpoint.
- `providerOperations.mjs` keys reuse by **job ID plus stable operation key**. A new job ID
  cannot reuse another job's paid prefix. Unknown outcomes require explicit same-job retry
  acknowledgement; changing job ID cannot be treated as recovery.
- `tilesetDependency.ts` is an existing family-local dependency validation pattern, not an
  assistant plan importer. Its cluster snapshot-equality rule must NOT be copied blindly:
  assistant plan-only Continue should capture human edits made after planning.
- Detail already exposes source `inputRef`, `resultRef`, `checkpointRef` and manifest reads.
  `JobClient.readInput` and `ApplicationClient.json/bytes` already read immutable input/results.
  No new HTTP path, SSE kind, executor, event bus or host RPC is required.

## 2. Exact minimal proposed wire contract

### New submission: one explicit binding, no client-authored plan copy

Keep normal `AiJobInput` fields. Add only this optional assistant payload member:

```ts
// PROPOSED, not currently parsed
payload.continuation?: {
  sourceJobId: string;
  resultSha256: string; // lowercase SHA-256 of the exact selected source AiJobResult
};
```

For this first assistant contract require `input.dependsOn` to be exactly `[sourceJobId]` when
the binding is present. With no binding, leave current dependency behavior alone. Use existing
admission idempotency for the immutable new request; double-click/lost acknowledgement resends
the same idempotency key/input, not a newly generated submission each time.

Do not add duplicate client-supplied `workPlan`, `planId`, `planSha256`, `sourceConfig`, or
`sourceDraft` overrides. The source result hash seals the exact terminal work plan and the
source continuation state. Its embedded plan ID is retained unchanged; that ID alone is not
identity, because the current IDs are clock-based. The usual new input ref seals the binding,
new instruction, current snapshot, target, mode, captured provider config and settings.

### Source output: explicit clean-boundary state, distinct from progress

Proposed optional result field on eligible assistant outputs:

```ts
payload.continuationState?: {
  version: 1;
  kind: "plan-only";
  inputRef: BlobRef; // exact immutable source AiJobInput, also in result.artifacts
  readBeforeWrite: {
    project: boolean;
    collections: string[];
    references: boolean;
  } | null;
  adventure: { village: boolean; dungeon: boolean; party: boolean; battle: boolean } | null;
  volume: {
    baseline: { authoredMaps: number; multiPageNpcs: number; shops: number; quests: number };
    minimum: { authoredMaps: number; multiPageNpcs: number; shops: number; quests: number };
  } | null;
};
// Existing fields retain their names and authority:
// payload.workPlan; result.project; result.baseSnapshot; result.generatedSnapshot
```

No duplicated plan is needed in this small state object: use the existing terminal
`payload.workPlan`. The source input carries original instruction/config/context/domain/scope,
so the state need not duplicate those either. `inputRef` must be included in result artifacts
because `host.dependencies` currently grants artifacts but does not automatically grant the
source input ref. The executor can obtain the canonical ref with existing
`host.putJson(jsonValue(input))`; this deduplicates the existing canonical input bytes.
No new host method is needed.

Export the state only for an actual clean plan-only return: no tool starts/results, proposals,
application or hosted journal prefix; an unfinished valid work plan; successful terminal
completion; no unresolved provider outcome. Include both explicit plan mode and the existing
autonomy `confirm`/plan-only behavior. Store it with the existing completed turn before saving
completion, so completed retry returns the same state and snapshot without new provider work.
`generatedSnapshot` must come from the actual final `session.getProposedProject()`, not a
reconstructed plan, initial input shortcut or UI preview. The producer should verify that this
clean source's final project equals the parsed input project semantically. Raw snapshot refs
may differ from captured input due to existing deserialize normalization; do not invent a
mutation or require ref equality merely because a plan-only source did no tools.

This is execution-authoritative **continuation input state**, not `SessionJobState.progress`.
Its parser must validate full plan fields/status/cursor and exact state shape. Do not use the
bounded display parser's `workPlanOmitted` fallback as executable state. For an oversized or
unsupported source, report continuation unavailable rather than silently truncating the plan.
Old completed outputs without this marker are not silently upgraded from transcript/progress:
there is no authoritative retained volume/read contract there. Same-job recovery remains valid;
an explicit newly requested replanning job is different and must be labeled as such.

## 3. Provider, project and plan identity rules

### Source identity and validation before any successor provider request

Resolve source only through the declared dependency, then validate:

1. Source job ID matches the binding; source family is assistant; source generation succeeded;
   exact result hash matches `resultSha256`; source result project backend and project ID equal
   the new input project. Check a selected result hash again at execution, not only in the UI.
2. `completion:"complete"`, valid final result, non-null generated snapshot, full unfinished
   terminal work plan, and the explicit valid plan-only continuation state are present.
3. `continuationState.inputRef` is an exact manifested ref; reading it yields the source input
   with matching project/family/baseSnapshot. Provider auth must remain Node-owned; no tokens
   or arbitrary endpoint credentials in state or submission.
4. New `payload.config` equals the immutable source input config for this exact-Continue v1
   path, including provider ID, model/liteModel, limits, effort, agent mode and autonomy level.
   Also retain source domain, context budget and preference-memory settings. The submitting UI
   reads those captured values, not later mutable editor settings. A provider/model change is
   a separately explicit new instruction/configured run, not silent exact continuation.
5. New instruction/mode and current selection/viewport are explicitly captured human facts.
   Validate current map/target and scope rectangle against the new current project. Preserve
   the source work plan target ID. A removed/incompatible target requires a visible replan/new
   instruction, not silently redirecting to whichever map happens to be selected.

Result-hash check without changing host RPC: the existing browser-safe
`jobs/resultPatch.ts:canonicalJson` plus `util/sha256.ts:sha256HexText` can hash already validated
JSON dependency results (same sorted-key/original-array-order representation as repository JSON
for these valid values). Add a machine-value equality test against a real repository result
hash; do not assume JSON.stringify insertion order equals canonical hash. Node admission-side
validation may compare the existing repository `resultRef.sha256` directly for early rejection;
the executor must still perform its own binding checks before dispatch. No widening of the
manifest to arbitrary predecessor or provider blobs is necessary.

### The successor baseline is the user's actual current project

The source generated snapshot is **provenance**, not permission to replace live state.
For a clean plan-only source, there is no pending generated mutation to transplant.

Recommended capture order in the future submitter:

1. Read selected source detail/result/input through existing integrity-checked artifact reads;
   retain selected `{jobId,inputRef,resultRef}` and UI owner epoch.
2. Resolve those reads first. Immediately before creating the admission request, capture the
   actual loaded current project, loaded backend/project ID, replacement epoch, current
   target/selection and requested instruction. Make an immutable project copy. Recheck source
   card and loaded-project ownership after awaits. No captured temporary play-test snapshot.
3. Submit that actual final capture through existing `JobAdmission.projectSnapshot`; the HTTP
   handler canonicalizes/stores it as new `input.projectSnapshot`. Start the new session from
   this captured snapshot. Do not overwrite it with the predecessor's baseline/generated ref.
4. Edits that occur after admission remain newer live edits. Generation is private. Existing
   application preparation/merge/conflict and loaded-project-epoch guards remain the only
   route to apply; continuation adds no automatic store replacement or save authority.

Unrelated human edits between planning and Continue are accepted and visible to the new
session. Incompatible deleted targets are rejected before provider work. A raw capture retains
all ordinary input project fields; do not substitute `appliedSnapshotHash` or
`canonicalProject` as its identity, since that application scheme intentionally excludes
uncommitted event drafts. No bypass of those live draft protections is allowed.

The retained planner volume baseline must not be re-armed from the successor snapshot. Keeping
the original measured baseline matches the existing in-memory Continue behavior, including
counting eligible human work done between turns. Restoring the target but recalculating its
baseline would require the model to author that human work again.

## 4. Minimal executor/session restoration proposal

No existing public method restores a plan. Add a narrow initialization option to the existing
session, not another executor or an unrestricted mutable public setter:

```ts
// PROPOSED trusted constructor option, only after external validation
AssistantSessionOptions.planOnlyContinuation?: {
  workPlan: WorkPlan;
  readBeforeWrite: IntentDeclaration["readBeforeWrite"];
  adventure: AdventureRequirements | undefined;
  volume: { baseline: VolumeSnapshot; minimum: VolumeBar } | null;
};
```

Add an equally narrow session exporter for the actual plan-only boundary, e.g.
`getPlanOnlyContinuationState()` returning the goal-contract portion above or null. Reuse the
existing `getWorkPlan()` and `getProposedProject()` APIs for plan and final snapshot. The exporter
must inspect actual `lastTurnPlanOnly`/tool/proposal state; do not parse assistant/status prose
or infer plan-only from an unfinished checklist. A constructor-only option avoids resetting a
running session's evidence or borrowing mutable session objects.

Executor sequence, in existing `executeAssistantJob`:

1. Parse immutable input and resolve/validate the continuation dependency before provider
   dispatch. Read source input from its manifested ref. Strictly parse source terminal work
   plan and goal state, retaining exact IDs/timestamps/statuses/cursor.
2. Initialize/replay **this successor job's** existing `SessionJobState` as usual. Its initial
   tools, provider cursor, usage, audit and progress belong to the successor only; do not copy
   source journal/tool refs, completed flag, usage/spend counters or attempt ID into them.
3. Construct `AssistantSession(newCapturedBaseline, {host:job.execution, config:capturedConfig,
   planOnlyContinuation:validatedSeed, ...existingOptions})`. Clone the plan into session state,
   call existing `readEvidence.begin` for the retained read contract, assign retained adventure
   and volume state. Fresh execution/read/verification-success evidence remains empty.
4. If desired, use existing `priorTranscript` with a deterministic transcript derived from the
   bound source result audit, not an unrelated client-supplied transcript. It preserves original
   request context but is explicitly not restoration authority. For a bound successor reject a
   conflicting client transcript or derive it solely server-side; retries must produce identical
   successor request bytes. Do not transplant the predecessor's raw provider messages.
5. Call the ordinary `sendUserMessage(newInstruction, job.observe, undefined, capturedTurn)`.
   Do **not** set `driverContinue`. Exact continuation text now sees an existing plan, skips the
   intent-declaration call by the existing rule, and reaches the ordinary planner resume/replan
   decision. With a controlled `resume` response the existing IDs/checklist are executed without
   another new-plan authoring round. A new human instruction still takes normal intent routing
   and may legitimately replan; never force monotonic statuses or a permanent planner bypass.
6. At the new turn's accepted restoration boundary, emit the restored plan through the existing
   `work_plan` callback before the first provider barrier, so the new job can display its seeded
   plan while that request is held. Do not copy the source progress frontier/activity into it.
   Existing progress barriers/checkpoints/terminal result formatting and application boundaries
   handle the successor. Retry reconstructs the same seed and same successor journals, so only
   newly unfinished successor provider operations may dispatch.

New-job budgets re-arm because the human explicitly submitted a new run; this is not erasing
an unresolved old operation. Automatic driver continuations stay within that new job and keep
its actual counters. The source generation/outcome/provider records are never rewritten.

## 5. Rejection and unsupported cases

Use explicit family validation errors before dispatch (HTTP early errors can be 400/409 using
existing service error conventions; no new endpoint). The message/code distinctions should
be machine-tested, not pinned human prose.

- Missing/mismatched dependency, malformed ref/hash, foreign project/family, stale selected
  result, source/result/input mismatch, missing/unmanifested source input: reject.
- Source queued/running, failed/interrupted/cancelled, unknown paid outcome, partial checkpoint,
  or no successful terminal result: no new-job recovery. Direct user to existing same-job retry;
  preserve `DUPLICATE_SPEND_ACK_REQUIRED` and never add acknowledgement implicitly.
- Completed successful generation that actually executed tools or has unapplied proposals:
  outside this clean plan-only contract. Do not discard proposals, auto-apply them, or pretend
  restoring WorkPlan alone restores its evidence/spec/verification/dedupe state.
- Missing/unsupported/oversized continuation state or plan, already completed plan, malformed
  statuses/cursor, invalid read/adventure/volume contracts: reject rather than fabricate state.
- Changed provider/config for this exact-Continue v1 binding: reject or require a separately
  explicit normal new instruction/run. Do not consume mutable settings as if they were captured.
- Human project replacement during source reads/capture, play-test read-only baseline, removed
  plan target, incompatible scope: reject/recapture explicitly. Preserve later human edits.
- A different user instruction is not an automatic driver turn. It may intentionally release
  the old volume/read contract and replan through existing intent handling; lineage does not
  authorize silently ignoring the new instruction.

The proposed v1 source eligibility is deliberately clean plan-only. General continuation from
an applied multi-turn job needs separate proof of applied snapshot/evidence/spec state and is
not smuggled into this proposal. Region/cluster Continue semantics are likewise not changed by
this assistant-only binding; they retain their existing family contracts.

## 6. Exact future RED seams (not prepared or executed here)

Use existing real executor + scheduler + repository + controlled provider boundary fixtures.
Subscribe/hold exact events before actions with bounded failure deadlines; no polling/sleeps.
Keep the established progress/replay/application tests intact. These are future failing
expectations, not claimed RED receipts.

| Seam | Discriminating assertion |
| --- | --- |
| Clean producer authority | Real explicit plan mode and real autonomy-confirm mode return plan-only continuation state, original config/input binding and final `getProposedProject()` snapshot; zero hosted tools/proposals. Ordinary final/partial/tool-executing results do not get the marker. |
| Plan-only -> durable human Continue | Run source job to success, dispose its session/submitter, reopen repository, create successor with exact source-result binding. Hold the successor's first planner request: it contains the exact active plan IDs/titles/cursor. Return `resume`, execute required tools and assert no source intent/planning prefix is dispatched again. |
| Existing human semantics | Controlled foreground same-session and durable successor both perform the normal resume decision and then tools even if composer mode remains `plan`. Do not assert a human Continue uses driver planner-skip. |
| Different new instruction | With bound source, submit a genuinely changed instruction. Intent declaration runs; planner can replan with legitimate new identity. No forced driverContinue, suppressed instruction or invented monotonic-plan status. |
| Current capture, not old source snapshot | Edit unrelated DB/map/title after source planning, then Continue. Held successor request/draft starts from that exact current capture. Source artifacts remain unchanged; no store mutation occurs during admission/generation. |
| Target conflict and capture race | Delete/resize the targeted map or replace loaded project while source reads are held. No provider dispatch against a foreign/stale target; no fallback to current selected map. |
| Goal gates survive import | Source intent requires specific reads/adventure outputs; source planner declares nonzero volume. On successor, required-read gates still reject premature writes, adventure checks still apply, and source volume baseline/minimum remain exact after intervening human edits. |
| Canonical result/input identity | Real repository result hash equals executor canonical hash. Tamper result hash, source input ref, source work plan, target, provider config or dependency linkage independently: reject before new provider operations. No title/plan-ID-only equality. |
| Source eligibility/unknown outcome | Controlled post-dispatch unknown source, cancellation, interruption, partial and executed-tool checkpoints cannot seed a new job. Same-job retry retains the explicit duplicate-spend acknowledgement requirement and original operation rows. |
| Successor retry | Interrupt successor after its own paid response; reopen and retry same successor. Compare exact successor request bytes/keys, source IDs/state, allocated successor IDs, dispatch count and usage. Source ledger unchanged; no repeated prefix under either job ID. |
| Lost admission acknowledgement | Same immutable new-job input and idempotency key yield one successor despite duplicate Continue click/reconnect; changed input with reused key conflicts. |
| Late save/provider and application | Cancel successor while save/provider is held; release late and assert no checkpoint/result resurrection. Edit live project again before applying successor; existing application merge/conflict/epoch protection remains authoritative. |
| Bounded/unavailable source state | Source progress omits oversized plan but terminal continuation state is authoritative: either restore a fully validated permitted plan or reject explicitly, never resume a truncated display plan. Legacy outputs lacking goal state fail visibly without replaying paid planning as recovery. |
| Ordinary no-binding jobs and within-job driver | Existing captured assistant jobs and same-job 0..48 numeric driver tests retain their behavior and request identities. No implicit predecessor choice from last-mounted UI/global session. |

## 7. Proposed implementation boundary for the separately tracked task

Expected focused changes, only after separate authorization and actual RED:

- Assistant payload optional reference parser and family-local predecessor validation.
- Clean plan-only continuation-state export/parser and constructor initialization in existing
  `AssistantSession`; use existing plan/project getters, `readEvidence.begin`, send and host APIs.
- Existing assistant executor output retention and dependency restoration, source input artifact
  membership, ordinary checkpoint/retry propagation. No new executor/host RPC/SSE protocol.
- A captured submitter binding for the selected source result and actual current snapshot with
  per-owner guards; no foreground execution fallback or auto-apply.
- Focused tests above and narrowly scoped architecture/testing updates in that later task.

The current verified bounded progress patch does not depend on this proposal. Do not edit its
source pin or integrate proposed continuation fields as if already shipped. No implementation,
initial RED preparation, heavy validation or approval of continuation occurred in this turn.
