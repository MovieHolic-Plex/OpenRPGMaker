# Durable human Continue backend handoff

## VERIFIED - continuation slot released, parent integration pending

This separately authorized clean plan-only continuation increment is implemented and verified.
After all three audit corrections, the final source passed **177/177 tests**, app typechecking, strict TypeScript compilation of
the new continuation suite, and the app/worker production build. No source/test edits followed
those pinned final runs. This handoff is ignored evidence markdown, outside S0's source pin.

- Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract`.
- Branch: `worktree/job-progress-contract`.
- Base/current HEAD: `43a58d9d259a680afbc06cdc5f0d8e733ca41423`.
- Progress is already committed/integrated by parent (`43a58d9d2` / reported main `515592184`).
  This continuation diff is separate and uncommitted. No reset, main/UI edits, commits or pushes.
- Final source SHA-256: `f836b4ee6b250a1d719c0f94aa4ebeea2b65d19b8e952f0c8c76d3b38073e67f`.
- The parent's earlier 168/168 supervisor pass on `07a614...` is pre-correction evidence, not
  proof of the audited footer/history fixes. See the separate audit RED and final receipts below.
- Dependency SHA-256: `954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`.
- The continuation heavy slot is explicitly RELEASED. The worktree is intentionally retained
  for parent review/integration; its lifetime cleanup is not falsely marked complete.

## 1. Shipped backend behavior

A new assistant job can explicitly bind one successful clean plan-only predecessor:

```ts
payload.continuation?: {
  sourceJobId: string;
  resultSha256: string;
};
input.dependsOn = [sourceJobId]; // exact one-element dependency when bound
```

This extends the existing assistant payload and executor. There is no new executor, bus,
HTTP path, SSE event kind, host RPC, user toggle or foreground fallback.

Before successor provider dispatch, `jobs/assistantContinuation.ts` validates:

- Exactly the declared dependency, matching source job ID, assistant family, project backend
  and project ID, and SHA-256 of the full canonical immutable selected source result.
- Explicit supported clean plan-only state and full unfinished work plan, zero proposed/applied
  calls, complete/final terminal state, and non-null source generated snapshot.
- Source input ref is present in source result artifacts. Read source input has matching
  version/family/project/base-snapshot identity and passes the real assistant payload parser.
- Captured config equality after normal payload parsing: provider/model/liteModel, limits,
  effort, autonomy and agent settings. Domain, context character budget and preference-memory
  section also match. This v1 binding does not silently switch provider/settings to the UI's
  current values. Optional config fields should be copied from the source, not default-filled
  independently into a different captured config.
- Source parsed base and generated projects are semantically equal, proving the declared
  clean source has no project changes to transplant. Raw refs need not be equal because of
  existing load normalization. The successor's actual baseline is ALWAYS its new captured
  `input.projectSnapshot`, not either source snapshot.
- Original plan target, new context/target map IDs exist in the current snapshot. Captured
  selection/scope has integer positive dimensions within its map and does not conflict with
  a retained plan target. The existing `parseContextFooter(payload.instruction)` also supplies
  the recognized footer map/selection for these checks: actual session implicit scope gives
  that footer precedence over structured scope. A valid structured A scope cannot conceal a
  footer selecting B or an out-of-bounds rectangle. Foreground/unbound precedence is unchanged.
- A bound input cannot provide a separate `priorTranscript`. The selected source's bounded
  `continuationState.history` is passed through the existing constructor history option. Each
  eligible producer retains inherited context plus its own human instruction/assistant planning
  response using existing `serializeAuditTranscript`. This preserves A -> B -> C context without
  another client field, recursive ancestor reads, copied provider messages or an unlimited log.
  History is conversation context, not work-plan execution authority.

Source generation eligibility is enforced by the existing scheduler dependency rule: only
succeeded predecessors reach the executor. Failed/cancelled/interrupted dependencies do not
spend. Unknown original provider work still requires explicit same-job retry acknowledgement.
No source operation records, outcomes, counters or attempt IDs are rewritten.

## 2. Actual result/checkpoint DTO

Eligible assistant result payloads now include this optional field:

```ts
interface AssistantContinuationState {
  version: 1;
  kind: "plan-only";
  inputRef: BlobRef;
  history?: string; // newly produced states include it; at most 12000 JS string characters
  readBeforeWrite: {
    project: boolean;
    collections: readonly string[];
    references: boolean;
  } | null;
  adventure: {
    village: boolean;
    dungeon: boolean;
    party: boolean;
    battle: boolean;
  } | null;
  volume: {
    baseline: { authoredMaps: number; multiPageNpcs: number; shops: number; quests: number };
    minimum: { authoredMaps: number; multiPageNpcs: number; shops: number; quests: number };
  } | null;
}
// result.payload.continuationState: AssistantContinuationState | absent
// result.payload.workPlan: existing full WorkPlan (no plan alias, no duplicate plan in state)
// result.artifacts includes continuationState.inputRef
```

The marker is produced only when the actual session ended at `lastTurnPlanOnly`, never started
any tool in its lifetime, has no proposals/applied calls, and retains an eligible unfinished
plan. Both explicit composer plan and autonomy-confirm planning returns are covered. The
executor additionally requires no hosted tool journal prefix. General applied/mid-run and
ordinary question/tool-executing results do not gain this state.

Plan validation reuses the full strict `parseWorkPlan` validator, now exported independently
from the optional display projection. It never imports displayed `progress` into execution.
Eligible plans have nonempty plan/goal/layer/item identities/text, unique layer/item IDs,
only pending/in-progress items, exactly one in-progress item matching the cursor, and at most
131072 serialized JSON characters. Invalid nested fields/status/cursor reject. An oversized
otherwise valid authored plan remains terminal output but does not advertise continuation.
There is no truncated executable plan, regenerated ID or compatibility reconstruction from
old transcript/progress.

The state parser rejects unknown fields at each state/read/adventure/volume/ref level, invalid
booleans/array types, non-safe or negative volume counters, and malformed JSON blob refs.
A missing marker means continuation unavailable. `CONTINUATION_UNAVAILABLE` is the explicit
executor failure for an absent eligible source state; other invalid identities/shape/targets
have specific validation errors. These are ordinary generation failures using the existing
service surface, not new HTTP response contracts.

### Source-owned history and compatibility

`history` is the one added compatible result-state field. It is included in the same completed
turn, so result-ack retry/reopen retains exactly the same history bytes. The serializer takes
inherited history as one user-context entry followed by the current user/assistant planning
entries, applies its existing newest-entry retention/omission policy, then clamps the final text
(including any omission notice) to `RESTORED_TRANSCRIPT_MAX_CHARS = 12000`. Overflow can omit old
context; this is not an exhaustive constraint log or a promise that arbitrary-length history is
lossless. Short chains preserve the ancestor machine-value constraint, as the execution-request
regression proves. New state parsing rejects non-string and oversized history.

Old first-level sources with a valid continuation marker but no `history` can derive their
complete context from their own immutable input and assistant text. Old already-bound sources
without retained history cannot recover ancestors from that input alone; they fail explicitly
with `CONTINUATION_HISTORY_UNAVAILABLE` before any provider operation. No recursive artifact
allowlist expansion or invented ancestor context is used. This does not make old sources lacking
any continuation marker eligible. Bound clients still cannot override history via `priorTranscript`.

### Retention across completed-source retry

The existing session completed checkpoint gains only optional artifact retention:

```ts
S.completed = {
  turn: { ...existingTurn, completion: "complete", continuationState?: AssistantContinuationState },
  generatedSnapshot: BlobRef,
  artifacts?: BlobRef[]
};
```

For a clean source, `completed.artifacts` retains the exact source input ref; it is also included
in the checkpoint's outer artifact manifest and terminal result artifacts. New completed ref
fields are strictly parsed; old checkpoints without this optional array remain supported.
The executor uses existing `host.putJson(jsonValue(input))`, so real canonical repository storage
returns the original immutable source input identity. A source result-ack failure after completed
checkpoint followed by reopen/retry reuses that state and final snapshot without new paid work.

The actual final current snapshot comes from `session.getProposedProject()` and the existing
ordered draft-retention writer. The source input ref is provenance, not a replacement project. The completed turn's optional
history is source-owned context, never a client instruction to replay prior paid work.

## 3. Existing session API reuse and the narrow additions

No public plan restoration API existed in the inspected session. The additions are:

- `AssistantSessionOptions.planOnlyContinuation?: PlanOnlyContinuation`, a trusted constructor-only
  seed after external validation. It clones the full plan, initializes required-read contract
  with the existing `readEvidence.begin`, and restores adventure and original volume baseline/
  minimum. It does not seed tool success evidence, proposals, provider messages or usage.
- `getPlanOnlyContinuationState(): PlanOnlyGoalState | null`, an exporter gated on the actual
  clean session boundary. Existing `getWorkPlan()` and `getProposedProject()` remain the plan
  and final-current-project readers.
- A lifetime tool-start count distinguishes actual clean planning from a later empty-looking
  turn after tool execution. Existing within-turn tool counters keep their semantics.

The executor still calls ordinary `sendUserMessage`. No externally supplied `driverContinue`
is parsed or injected. Exact human Continue sees an active plan and uses the existing intent
continuation rule, then a new ordinary planner resume/replan decision. It is NOT replay of the
source's initial paid planning call. With `resume`, the existing plan IDs/statuses/cursor survive
and the tool loop executes even if composer mode remains `plan`. A changed human instruction
can run a fresh intent declaration and legitimately replan.

A restored plan emits through the existing `work_plan` callback before the new turn's first
provider barrier, so live checkpoint projection can show the seed while that request is held.
The source progress frontier/activity is not copied. Successor provider keys/usage/tool journal,
allocated map IDs, checkpoint writer and attempt fencing remain successor-owned. Retry recreates
the same seed and only the successor's own deterministic prefix; source paid work is untouched.

The original volume baseline is retained, rather than re-measured at Continue. Human authoring
between planning and execution therefore counts as it does in the real foreground reference;
restoration does not demand duplicate work. Required reads start with no successful-read evidence,
and adventure completion/repair requirements remain active.

No-binding jobs use the previous config/chat/request construction. Their existing tests and
within-job 0..48 driver/round tests passed unchanged. The only intentional no-binding output
extension is the optional clean-source continuation marker and its input artifact.

## 4. UI read/capture requirements (backend delivered; UI NOT edited)

Use existing integrity-checked reads:

1. `GET /api/ai-jobs/:sourceJobId` for job generation/project/input/result refs and manifest.
2. `ApplicationClient.json<AiJobResult>(sourceJobId, job.resultRef)` for the exact source result.
3. Validate source ownership/version/family/project and the marker/full plan. Existing exported
   `continuationOutput(result.payload)` returns parsed state/plan or null for unavailable output;
   it throws for malformed output. It does not authorize arbitrary source selection by itself.
4. Read the manifested `continuationState.inputRef` (or `JobClient.readInput(sourceJob)`) for
   captured config/domain/context. The future UI must verify selected result/input ownership
   after EVERY await, rather than using a mutable modal-wide last-job ID.

Machine-value example of the binding (illustrative placeholders, not a recorded network sample):

```ts
const continuation = {
  sourceJobId: selectedSource.id,
  resultSha256: selectedSource.resultRef.sha256,
};
const dependsOn = [selectedSource.id];
```

After source reads finish, capture the actual loaded current project immediately before
admission, with its backend/project ID, replacement epoch, current map/selection/viewport and
new human instruction. Do not capture a temporary play-test/read-only snapshot. Recheck that
source card and loaded-project owner still match; if not, abandon the stale read/capture and
require a new explicit action. Backend validation can validate submitted identity/geometry,
not discover a browser's mutable owner epoch.

Build the existing `JobAdmission` from that final immutable project capture:

```ts
// Illustrative construction using already read/validated source and a current owner capture.
const request = {
  input: {
    version: 1,
    family: "assistant",
    project: capturedCurrentIdentity,
    target: capturedCurrentTarget,
    mode: "review",
    dependsOn: [sourceJob.id],
    payload: {
      instruction: capturedHumanInstruction,
      config: sourcePayload.config,
      domain: sourcePayload.domain,
      context: {
        ...sourcePayload.context,
        currentMapId: capturedCurrentMapId,
        viewport: capturedCurrentViewport,
      },
      selection: capturedCurrentSelection,
      turn: capturedHumanTurn, // ordinary composer mode/scope/autonomous; no driverContinue
      continuation: { sourceJobId: sourceJob.id, resultSha256: sourceJob.resultRef.sha256 },
      // Ordinary currently captured artwork/reportAssets may be included through existing rules.
      // Do not spread sourcePayload wholesale: that could copy priorTranscript or an older binding.
    },
  },
  projectSnapshot: jsonValue(capturedCurrentProject),
  artwork: capturedCurrentArtwork,
};
// Existing JobClient.admit(request, stableIdempotencyKey).
```

Omit absent optional JSON fields through the normal capture serialization. Never substitute
source `baseSnapshot`, `generatedSnapshot`, or `appliedSnapshotHash` for the new raw project
capture. The latter application scheme excludes event drafts and is not this input identity.
Do not re-render or auto-apply source proposals. Current captured artwork/report refs must use
the existing admission manifest rules, not stale unmanifested source-ref aliases.

- A source must be succeeded with eligible state, not merely have an unfinished displayed plan.
  Missing/unsupported/oversized state is unavailable; do not imply transcript restores it.
- Failed/cancelled/interrupted/unknown source jobs expose existing same-job retry, not a new
  Continue that evades spend acknowledgement. Report readiness is not source generation success.
- Duplicate click/lost admission acknowledgement reuses the same idempotency key and immutable
  request. A different instruction/snapshot with that same key conflicts.
- New edits after admission remain newer live edits. Existing materialization/application
  merge/conflict and loaded-project fencing decide application. New generation has no save
  authority, and generated success does not mean applied/saved.
- This first binding retains source provider/settings. A deliberate provider/config change is
  a normal explicitly configured new instruction, not silent exact continuation through this
  binding. No new provider-policy toggle is added.
- Build a recognized footer from the same current capture as structured scope/selection. The
  backend validates that effective footer authority too; structured scope does not override it.
- Do not send `continuationState.history` back as a payload field or `priorTranscript`. It is
  read from the bound immutable result. Treat `CONTINUATION_HISTORY_UNAVAILABLE` as unavailable
  continuation, not permission to choose another ancestor/ref or silently drop conversation context.
- General applied/mid-run or cross-family continuation is outside this clean assistant boundary.

## 5. Actual RED, fixture diagnosis and GREEN evidence

Every directory below retains `command.log`, `source.json` and `receipt.json`. None was overwritten.
All runs were S0, one worker, sequential, without live services/browser launch or installation.
All receipts have `error:null`, the expected dependency hash, and `cleanup.removed:true`.

| Run | Actual outcome | Evidence |
| --- | --- | --- |
| Prepared 40-case RED, before production edits | **23 failed, 17 passed**, exit 1 | `/var/tmp/s0-job-continuation-red-q2uLPgO3/red` |
| Foreground diagnostic selection | 1 selected failure, other 39 not selected; exit 1, NOT feature GREEN/RED count | `/var/tmp/s0-continuation-reference-aTmIJ786/reference` |
| First implementation GREEN | **40/40 passed**, exit 0 | `/var/tmp/s0-job-continuation-green-I0AevmdF/green` |
| Pre-audit continuation + existing families | **168/168 passed in 10 files**, 322.72 seconds; not audit-fix proof | `/var/tmp/s0-job-continuation-final-YulrCwcy/final` |
| Pre-audit typechecks + app/worker build | **exit 0**, 0 test TS diagnostics, 1536 modules built; not audit-fix proof | `/var/tmp/s0-job-continuation-build-6pVGvFYF/build` |
| Audit RED on unchanged production | **3 failed, 45 passed**, exit 1 | `/var/tmp/s0-continuation-audit-red-iFAGi4fg/red` |
| Audit behavioral GREEN before declaration addition | **177/177 passed**, exit 0 | `/var/tmp/s0-continuation-audit-final-Fc4hET0c/final` |
| Audit compiler failure | App typecheck passed; test compilation failed TS7016; build did not run | `/var/tmp/s0-continuation-audit-build-h2h8stGd/build` |
| Final corrected typechecks + app/worker build | **exit 0**, zero test TS diagnostics, 1536 modules built | `/var/tmp/s0-continuation-audit-build-Lyle7oc4/build` |
| Final corrected combined tests on the same build pin | **177/177 passed in 10 files**, 349.22 seconds | `/var/tmp/s0-continuation-audit-final-f2Nv4Jbj/final` |

### RED versus fixture defect

Prepared source test SHA-256:
`232596a6599572c76ab54963d816e55336712f8a293f956df24ef8254450f36a`.
RED whole-source hash:
`43b23f78257fea11dce804fc3d9cd0a8b501582e121416d5935648f3627d8bc3`.
RED run ID: `200b9cbb-a995-4c4e-9ff8-d23e7a96b9ab`.

Primary RED was missing actual producer `continuationState` and current payload rejection of
the binding. Downstream cancellation/replay could not reach a successor boundary, and source
corruption cases stopped at the missing eligible producer. No import/syntax/setup failures or
fixture deadline expirations were counted as continuation RED.

Separate fixture defect: real foreground `upsert_item` returned `tool-error` because its supplied
item lacked required `item.id`. Its unmet plan then asked for another request and exhausted the
fixture sequence. The narrow diagnostic retained that exact tool failure. Correction supplied
`id:"continuation-record"` to the actual item tool, kept success/plan/request assertions, and
moved actual generated-ID coverage to an additional real `create_map` in the successor replay
sequence. That sequence now has four successor provider calls, with post-response interruption
at provider/3, and asserts retained allocated map ID/content across reopen. No production tool
semantics changed and no failing test was deleted/skipped to make the full suite pass.

The pre-audit suite added five real edges beyond the original 40: strict completed-artifact
refs, empty plan identity, nested read/adventure extra fields, and oversized producer output.
Those 45 continuation cases plus existing 117 progress/family and six foreground composer cases
formed the original **168**; their test intents remain intact.

### Audit RED and the three corrections

The parent's pre-correction supervisor run `821e6fce-7b2a-4e31-adca-daa420f13d1d` at
`/var/tmp/continuation-supervisor-lQqrfP/final` was reported 168/168, exits 0, cleanup removed,
source `07a614037d1aea2bc45970f916072993b60e3797b4bc71e51b1d84de39dc1012`. That source stayed
frozen until the parent explicitly lifted the freeze and released this slot. The audit fixes
are NOT inferred from that earlier pass.

Actual new RED: run `f08c86c6-b913-4206-80fe-cea63eb5829b`, source
`4ccc2bef3cb693d5fd175ec09cac4f082464dbc62c1c9e7e39968bbc60086591`, test file SHA-256
`e2d0fd05accf947a09c3cba80205c3097a3dcbfd0f9957f417a73b47249cdcd1`.
All 45 earlier continuation cases passed. Both foreign-map and out-of-bounds footer cases
incorrectly succeeded. C's first execution request had B's instruction/text but omitted A's
machine-value constraint while B's plan was already restored. No import/setup/timeout issue
was counted as this RED. Production fixes followed this observed failure.

1. Footer authority: reuse `parseContextFooter` for the actual text passed to the session;
   validate its recognized map/selection alongside structured scope at the continuation
   boundary, before any provider operation. Do not change core/buildSpec/foreground precedence.
2. Chained context: retain bounded source-owned `history` in eligible result/completed state;
   reuse existing transcript serialization, preserve short A -> B -> C context, keep B's plan
   and goal restoration independent, and reject unrecoverable legacy bound history without
   recursive artifact access or client-supplied overrides.
3. Type constraints: the test reads repository JSON through existing `validateResult` and
   `validateInput`, then JSON field/payload guards. It no longer returns double-cast AiJob DTOs.
   `baseline.maps[rect.mapId]!` is replaced by retrieval plus assertion narrowing. A file-wide
   scan found no `as unknown`, `as any`, or AiJob type casts in the new test/validator; remaining
   `as const` uses are literal enum fixtures, not type escapes. No duplicate schema parser or
   custom unsafe type predicate was introduced.

The test-only validator import initially exposed missing module declarations: strict test
compilation failed TS7016 for existing `validation.mjs`, despite runtime tests and app typecheck
passing. Added `scripts/lib/aiJobs/validation.d.mts` with accurate signatures for its existing
exports. Validators deliberately return `void`; they do not make unchecked narrowing claims.
This changes no runtime code, disables no compiler rule and suppresses no diagnostic. The final
build/compilation and full combined test run were repeated on the new exact pin, not represented
as passing on the previous pin.

Nine new cases cover the three audit regressions, bounded/reopened history, root/bound legacy
history, malformed/oversized history, and a rejected client-history override. Final total:
**54 continuation + 117 existing progress/family + 6 existing foreground = 177**. No committed
baseline test file was changed; the new continuation suite retains its original intents plus
the audit cases. No assertion was weakened and no failing case skipped to obtain GREEN.

### Exact final identities

Final source:
`f836b4ee6b250a1d719c0f94aa4ebeea2b65d19b8e952f0c8c76d3b38073e67f`.
The final combined test run supplied this as `--expected-source-sha256` and matches the build receipt.

Final test run ID: `76e590a3-f9fc-4385-a9f4-ccca85f6540c`.
Final test command SHA-256:
`b01d8c3a314eff05c3089c4298ddbd7730f92589051753b3c1f33cd12c5406ad`.
Final build run ID: `815bb990-1fa9-421d-8985-7fc80a501f4b`.
Final build command SHA-256:
`b1df2703f08568c584c35a71b13dbab70a4bc29132e6203a743b68578df07475`.

Both final receipts report command/launcher/sandbox exit 0; uid 1000, capabilities 0,
no-new-privileges, loopback-only and zero nonlocal routes. S0 owns TMPDIR `/dev/shm`, caches,
repositories and build output. LSP after final source edits: jobs directory 27 files, zero
diagnostics; session core, constructor-state types, new validator declaration and test each returned no diagnostics.
`git diff --check` passed. Markdown has no configured LSP and was reviewed as documentation.

The app build includes the actual worker entry/chunks. Retained warnings: Zod pure-comment
placement, record-picker circular chunk, mixed static/dynamic imports and large chunks. No
warning was suppressed or unrelated source changed. Missing proxy-key notices are expected in
S0's secret-free environment. This is not a full player/standalone build or browser/UI proof.

## 6. Exact reproduction scope

The final test run used these twelve explicit includes on base `43a58d9d2`. For a future parent
run use a fresh owned output directory and coordinated slot; do not reuse/overwrite evidence.

```bash
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract
OUT=$(/usr/bin/mktemp -d /var/tmp/s0-continuation-audit-final-XXXXXXXX)
/usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/usr/sbin:/bin LANG=C.UTF-8 \
  /usr/bin/python3 -I -S -B \
  /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract/scripts/qa/isolated-validation.py \
  --source /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract \
  --expected-head 43a58d9d259a680afbc06cdc5f0d8e733ca41423 \
  --expected-source-sha256 f836b4ee6b250a1d719c0f94aa4ebeea2b65d19b8e952f0c8c76d3b38073e67f \
  --dependencies /home/main/z-project/rpg-zzu/node_modules \
  --browser /dev/shm/task8-managed-chromium-cHQvga \
  --bun /home/main/.bun/bin/bun --scratch-root /var/tmp \
  --output "$OUT/final" --timeout 1200 --retain-log \
  --include test/aiJobContinuation.test.ts \
  --include scripts/lib/aiJobs/validation.d.mts \
  --include src/ai/assistantSessionCore.ts \
  --include src/ai/planOnlyContinuation.ts \
  --include src/ai/jobs/assistantContinuation.ts \
  --include src/ai/jobs/assistantPayload.ts \
  --include src/ai/jobs/checkpointState.ts \
  --include src/ai/jobs/sessionProgress.ts \
  --include src/ai/jobs/sessionHost.ts \
  --include src/ai/jobs/executors/assistantJob.ts \
  --include openwiki/architecture.md \
  --include openwiki/testing.md -- \
  npm test -- --maxWorkers=1 --no-file-parallelism \
  test/aiJobContinuation.test.ts test/aiJobLiveProgress.test.ts \
  test/aiSessionProgressEdges.test.ts test/aiJobCanonicalReplay.test.ts \
  test/aiSessionJobHost.test.ts test/aiRegionJob.test.ts test/aiTilesetJob.test.ts \
  test/aiJobApplication.test.ts test/aiJobWorkerIsolation.test.ts test/aiComposerModeSession.test.ts
```

Final build used the same source pin/includes/mounts with output
`/var/tmp/s0-continuation-audit-build-Lyle7oc4/build`, followed by `/bin/bash -c` and this body
(formatted for readability; exact command identity above):

```bash
cd /work && npm run typecheck:app && node --input-type=module -e '
import ts from "typescript";
const file=ts.readConfigFile("tsconfig.json",ts.sys.readFile);
if(file.error) throw new Error(ts.flattenDiagnosticMessageText(file.error.messageText,"\n"));
const config=ts.parseJsonConfigFileContent(file.config,ts.sys,".");
const roots=[...config.fileNames.filter(f=>f.endsWith(".d.ts")),"test/aiJobContinuation.test.ts"];
const program=ts.createProgram(roots,{...config.options,noEmit:true});
const diagnostics=[...config.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCanonicalFileName:f=>f,getCurrentDirectory:ts.sys.getCurrentDirectory,getNewLine:()=>"\n"
  }));
  process.exit(1);
}
console.log("Continuation test TypeScript: 0 diagnostics (configured ambient declarations included)");
' && npm run build:app
```

## 7. Final changed-file fingerprints

```text
8b9ca2e65c1920208985a1de07b89507dc328b859a0543a1f946c6adcf6e9245  scripts/lib/aiJobs/validation.d.mts
7f225e9032bf3e2fc35bed18adae0cb84143e4e3d7346a62dcc30a8901a9d609  src/ai/assistantSessionCore.ts
ac759b7a0d200440b5b38199d8000e570cdce6df29a6f9ec883f170099f7cbde  src/ai/planOnlyContinuation.ts
3e2e3b1fef4803a80055d446111ed518dc6de440ff7668bb7b322ee4d62e005b  src/ai/jobs/assistantContinuation.ts
70384e24dc32aed2e24c3c9cd172cd80ab208cededbb0452f299ca0283f2dea1  src/ai/jobs/assistantPayload.ts
326a73e15107ee3e31913232c1047bfc5af5bc2b497fcbc6852bcdcf5170d633  src/ai/jobs/checkpointState.ts
4e41b045d61bd043f76b2a72e6fae6628ab217eaae8bdf4cd14eb1ec543b5bc2  src/ai/jobs/sessionProgress.ts
b6803747dfea7b86d2daa196fd7ce2cf2015a9d9f2a0dfb5c11238bf9f3e7191  src/ai/jobs/sessionHost.ts
e01243ce05cc50da89d097690825a9c33c3854a677ac37e5257ee5ac2987ccff  src/ai/jobs/executors/assistantJob.ts
b0dc993d9c195cb7d46b50ca30505193812f839282c921b70e03ce85c673441a  test/aiJobContinuation.test.ts
8ccffa2f92b214a0022d1e6a6b9193b529435df0f2794b0e3f0cb30076fb2cab  openwiki/architecture.md
849b3fe1b78316e8d07fd71a638256de46d05c82a7aa897a66879d7bbd2576ac  openwiki/testing.md
```

## 8. Cleanup and limits

All five original continuation invocations and all five audit-correction invocations completed
and report scratch removal, including the failed compiler attempt. No browser was launched; the existing browser directory was only the required S0 mount. No live provider/DB,
installation, shared cache modification, foreign process, main source or forbidden port was
used. Owned test listeners from the existing HTTP/application family ran only within the
removed sandboxes. Command/source/receipt evidence remains intentionally retained outside them.

The heavy slot is released. No remaining backend implementation blocker is known for this
clean plan-only scope. Parent owns independent review/integration and any subsequent UI binding.
The worktree remains owned for that purpose, so its eventual cleanup remains open. No general
mid-run/applied continuation, new provider policy, UI approval, full Task8 approval, commit or
push is part of this delivery.
