# Live progress backend handoff

## VERIFIED BACKEND PATCH - parent integration pending

Task `st_01a082f3`; backend progress only. The final pinned source passed **117/117 tests**,
app typechecking, both progress tests' TypeScript validation, and the app/worker build through
S0. This is backend delivery, **not integration approval, public/UI binding or Task8 approval**.

- Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract`.
- Branch: `worktree/job-progress-contract`.
- HEAD/base: `f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843`; no commits or pushes.
- Parent explicitly released the progress-only heavy GREEN slot. This child ran sequential
  one-worker S0 validations only. Those runs are complete and the heavy slot is returned.
- Final source identity: `7ebee8d92bf444222aa22b361ebeaf504bdd0c3b45cec89ac2e097f93be03ac3`.
  Final tests and build receipts have this exact same source/dependency identity.
- Only this worktree was modified. The explicitly requested main contract document was read;
  main/GROK and gate-contract-fixes production/test work were not touched.

## Preserved RED evidence

Read, not regenerated or modified:

- `/var/tmp/g1-progress-red-FDnAYo/red/command.log`
- `/var/tmp/g1-progress-red-FDnAYo/red/receipt.json`

The parent's actual run reports **16 tests, 16 failed**, not import/syntax failures: missing
live progress, missing durable pre-tool start, missing numeric budget events, mutable/out-of-order
flush snapshots and a writer failure bypass. Receipt: `commandExit:1`, `launcherExit:1`,
`cleanup.removed:true`, `error:null`, dependency identity
`954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`, source identity
`931ae717c315ddcd8869c8aaf8410e015b42b14bd8d669c555cd76dc0d1e18c3`.
This RED source hash is **not** the new production candidate hash.

The prepared `test/aiJobLiveProgress.test.ts` remains byte-for-byte unchanged:
`a497200c98ff952f6f7a1da35cd01d0f40e0fbba1e283f8486e5ebe81236d8e6`.
Its original 16 cases and assertions were not removed, skipped or weakened.

## Implemented and verified backend

1. `src/ai/jobs/sessionProgress.ts`: optional strict version-1 DTO/parser and synchronous
   observation reducer. Latest plan/phase/current tool, 32 activity rows, 512-character
   summaries and names, explicit omitted/truncated information, numeric budgets and sampled
   usage. Unknown fields reject at every nested DTO level; plans have validated item/status/
   cursor structure. No raw tokens/prompts/messages/tool args/results/audit/status log is projected.
2. `checkpointState.ts`: parses optional progress; old checkpoints remain accepted. Existing
   tool journal/result parsing and terminal payload schema remain unchanged.
3. `sessionHost.ts`: immutable snapshots captured at flush invocation, one ordered failure-sticky
   writer, exact draft-byte ref reuse, serialized terminal draft retention. Progress callbacks
   perform no asynchronous writes. Pre-tool yields, hosted tool/milestone checkpoints,
   provider barriers and terminal drains await the same writer.
4. `assistantSessionCore.ts`: typed `run_budget` emitted from the real turn/round and autonomous
   driver counters, including initialization/change/exhaustion. Rounds are entered rounds,
   not tools. Existing execution limits and request construction are unchanged. Internal
   `place_npc` and `author_npc_cast` starts now await the existing yield before execution too.
5. `assistantJob.ts` and `tilesetClusterExecution.ts`: replace discarded callbacks/no-op yields
   with observation/barrier wiring and sample existing `getUsageTotals()`. Cluster checkpoint
   envelopes capture render records before storage awaits; image generation and preview refs
   are unchanged. `assistant/terminal` is an internal drain stage, not a new HTTP/SSE event.
6. `regionJob.ts`: reuses the assistant adapter and shares its writer for outer start/partial/
   review/completed checkpoint publication. A failed session write cannot be bypassed by outer
   partial saving. After the completed-session drain, region review-artifact preparation retains
   its existing failure/partial/retry semantics, independently of checkpoint-writer failure.
7. `test/aiSessionProgressEdges.test.ts`: eight additional cases for nested parent/verification
   tool identity, reconstruction/replan replacement, oversized-plan omission, long tool/model
   labels, strict nested schema/usage consistency, real 0..48 continuation exhaustion with
   separately reset per-turn rounds, immutable in-place draft capture/ref reuse, and queued
   writer rejection with the original error. No sleeps/polling; the driver uses the real session.
8. Focused architecture/testing documentation updated in `openwiki/architecture.md` and
   `openwiki/testing.md`.

### Replay and failure semantics

- Reconstruct a fresh observation stream alongside the existing provider/tool replay. Do not
  inject displayed plans into the session, skip provider operations from progress, regenerate
  tool/plan IDs, append old activity again or add saved usage to reconstructed usage.
- Until the saved semantic frontier and hosted tool replay prefix are reached, retain the last
  durable checkpoint/draft. Earlier replay milestones cannot publish an older draft. Status,
  token, message and recap prose do not advance this frontier: a transient failed provider
  acknowledgement is not reproduced when its durable response is replayed.
- At/after that frontier, legitimate replans replace the displayed plan, including pending
  items replacing done items. No global monotonic-plan fiction. Nested verification tools
  preserve the enclosing session-handled call's ordinal through an in-memory observation stack.
- The promise chain retains rejection. Later drains/completion reject the same writer failure;
  they do not recover via an unrelated successful write. All publication still uses the
  scheduler's existing attempt fence. Cancelled/interrupted state is never inferred from a
  progress field. Retained `currentTool` on an interrupted tool is historical, not proof of a
  live worker.

### Review of `started.pop()!` and rejection ownership

All four actual `AssistantSession` tool-result emission paths were traced: main model tool
loop, `executeVerificationAdvisory`, `buildSpecNpcAssetsDirectly` (`place_npc`), and
`authorPendingNpcCast` (`author_npc_cast`). Each emits its own start before its result. The
main session-handled completion branch can synchronously await nested verification; those
nested results arrive before the enclosing completion result. Exceptions rethrow instead of
emitting an unpaired fallback result. The reducer's stack therefore represents actual LIFO
call nesting, not a guessed tool count. A fresh replay reconstructs those same starts/results;
it does not seed the stack from retained progress. The nested-stack edge case, real session/
family runs and three-family replay cases passed. No fallback events or dropped results were
added to make this assumption hold.

Observation callbacks do not schedule promises. Every writer call is returned to an awaited
pre-tool/tool/milestone/provider/terminal barrier; the chain tail is that same promise, not
an unobserved rejecting derivative. The queued-writer edge test subscribes to both rejections
and proves later storage never runs; the original-error test and final Vitest run passed
without unhandled-rejection reports. No catch suppresses a writer failure.

## Actual DTO for GROK

This is the implemented, GREEN-verified backend type, not a proposed schema. The prepared
real session/repository/HTTP assertions passed on the final source. No UI binding is included.

```ts
interface SessionProgress {
  version: 1;
  revision: number; // safe nonnegative semantic observation frontier; NOT SSE seq
  turnIndex: number; // safe nonnegative; tools use 1-based turns
  workPlan: WorkPlan | null; // existing WorkPlan, IDs unchanged
  workPlanOmitted?: boolean;
  phase: "plan" | "execute" | "review" | null;
  currentTool: {
    turnIndex: number;
    index: number; // 1-based attempted call ordinal WITHIN this turn
    name: string;
    nameTruncated?: boolean;
  } | null;
  recentActivity: Array<{
    id: number; // semantic revision at this row; stable on reconstruction
    turnIndex: number;
    kind: "tool" | "milestone" | "paused";
    index?: number; // required for kind:tool; absent otherwise
    name?: string; // required for kind:tool; absent otherwise
    nameTruncated?: boolean;
    ok?: boolean; // required for kind:tool; absent otherwise
    summary: string;
    truncated: boolean;
  }>;
  omittedActivityCount: number;
  budget: {
    rounds: { used: number; total: number } | null;
    driverContinuations: { used: number; total: number; exhausted: boolean } | null;
  };
  usage: SessionUsageTotals | null;
  usageOmitted?: boolean;
}
```

Exact limits/interpretation:

- Activity: at most 32 most recent semantic rows. Each summary and tool name at most 512
  JavaScript string characters. `truncated` describes the summary; `nameTruncated:true`
  describes a shortened label. A tool index is not an immutable hosted journal index.
- Work plan: one exact latest snapshot up to 131072 serialized JSON characters. Above that,
  `workPlan:null, workPlanOmitted:true`; no fake shortened executable plan or regenerated IDs.
  A later fitting plan clears the omission flag. Full terminal `workPlan` is unchanged.
- Usage: existing `{calls,promptTokens,completionTokens,callsWithoutUsage,byModel}`. Each model
  row has `model` plus those four counters. Above 32 model rows or a 512-character model name,
  `usage:null,usageOmitted:true`; the session totals and terminal output remain unchanged.
  Otherwise totals are replaced with the session's sample, never accumulated across retries.
  These are session-observed calls, not exhaustive physical job spend; the separate intent
  declaration path is outside the session usage wrapper. Missing provider usage is counted
  by `callsWithoutUsage`; there is no fabricated cost field.
- Rounds: `used` is rounds entered in this turn; `total` is the actual captured limit after
  the autonomy cap. It resets per turn. Planner-only sessions may have `rounds:null`.
- Driver: separate `used:0..48,total:48,exhausted`; initial turn excluded. Non-autonomous
  execution has `driverContinuations:null`.
- `revision` is not a checkpoint-head identity: usage/stage may change without a semantic
  revision change. Deduplicate immutable reads by checkpoint ref, not revision alone.
- No progress in an old checkpoint means unavailable, not zero observed activity or success.
  `phase:null` means no phase event observed, not an inferred execution phase.

Example minimal actual DTO, constructed from the implemented initial shape (not a claimed
live response capture):

```json
{"version":1,"revision":0,"turnIndex":0,"workPlan":null,"phase":null,"currentTool":null,"recentActivity":[],"omittedActivityCount":0,"budget":{"rounds":null,"driverContinuations":null},"usage":null}
```

Example tool row shape: `{id:7,turnIndex:1,index:1,kind:"tool",name:"get_project_summary",
ok:true,summary:"...",truncated:false}`. The summary is tool-authored bounded text, not a
numeric/status protocol. The full result remains at the existing immutable `toolRefs` blob.

## Exact existing reads and invalidation

1. `GET /api/ai-jobs/:jobId` returns `{job,attempts,operations,manifest}`.
2. Read `job.checkpointRef` via `GET /api/ai-jobs/:jobId/artifacts/:sha256`.
3. Select the existing family-specific session state:

| Family | Session state S | Progress |
| --- | --- | --- |
| assistant | `C.state` | `C.state.progress` |
| region, once session exists | `C.state.session.state` | `C.state.session.state.progress` |
| tileset cluster-edit/range-classify/unclassified-analysis | `C.state.session` | `C.state.session.progress` |

Non-session tileset operations do not gain this DTO. Early region checkpoints can have no
session. Existing `S.toolRefs`, `S.draftRef`, `S.partial` and `S.completed` retain their shape.

Concrete read ingredients using the **existing** integrity-checking client and the new parser:

```ts
import { ApplicationClient } from "@/editor/aiJobs/applicationClient";
import { parseSessionProgress } from "@/ai/jobs/sessionProgress";
import type { AiJobCheckpoint } from "@/ai/jobs/contracts";
import { requireRecord } from "@/project/io/guards";

const api = new ApplicationClient();
const { job } = await api.detail(jobId);
if (job.checkpointRef) {
  const head = job.checkpointRef;
  const c = await api.json<AiJobCheckpoint>(job.id, head); // hash + byte length checked
  if (c.version !== 1 || c.jobId !== job.id || c.inputSha256 !== job.inputRef.sha256)
    throw new Error("Foreign checkpoint");
  let s: Record<string, unknown> | undefined;
  if (job.family === "assistant") s = c.state;
  if (job.family === "region" && c.state.session !== undefined)
    s = requireRecord("session", requireRecord("region session", c.state.session).state);
  if (job.family === "tileset" && c.state.session !== undefined)
    s = requireRecord("cluster session", c.state.session);
  const progress = s?.progress === undefined ? null : parseSessionProgress(s.progress);
  const liveAttempt = job.generation === "running" && c.attemptId === job.activeAttemptId;
  // Bind {job.id, job.inputRef, head, progress, liveAttempt} only if this read still
  // owns the current UI observer. This is an immutable read, not session execution.
}
```

Keep existing `JobClient` per-job request/connection/owner guards after every await; do not
copy this illustrative block into an unguarded modal-wide callback. A replaying new attempt
may temporarily expose the prior attempt's retained checkpoint: show last-known progress,
not a fresh starting-tool animation. Terminal generation clears busy chrome regardless of
remaining plan items or retained currentTool. Losing current-manifest membership during a
head replacement requires refreshed detail, not arbitrary blob access.

SSE remains exactly `admitted|updated|outcome|inbox-read`, with sequence and job states only.
`updated` invalidates detail; it does not carry progress, tool events or provider bytes.
Provider request/response blobs remain outside the public job-artifact manifest.

Terminal results retain `payload.workPlan` (never `payload.plan`), `proposedCalls`, `audit`,
`usage`; cluster previews remain `previews[].images[].{ref,label}` with existing grouping.
No top-level `toolCalls`, data URL alias, preview re-render or live-store read was added.
Separate deliberate new-job Continue binding remains explicitly unimplemented/out of scope.

## Actual verification and retained receipts

### Final pinned GREEN

Both final receipt directories contain `command.log`, `receipt.json` and `source.json`.

| Check | Actual result | Receipt directory |
| --- | --- | --- |
| Final progress + replay/session/region/tileset/application/isolation | 8 files, **117/117 passed**, 232.42 seconds | `/var/tmp/s0-job-progress-final-9FWSXcoL/final` |
| App typecheck + progress-test TypeScript + app/worker build | **exit 0**, 0 test TS diagnostics, 1535 build modules, worker HTML/chunks emitted | `/var/tmp/s0-job-progress-build-7NNC1P2E/build` |

Exact common source SHA-256:
`7ebee8d92bf444222aa22b361ebeaf504bdd0c3b45cec89ac2e097f93be03ac3`.
Exact common dependency SHA-256:
`954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`.
Both final runs used `--expected-source-sha256` and all eleven explicit source/test/doc includes.
The handoff itself is excluded evidence markdown and does not change that frozen source set.

Final tests: run `656ea054-a5c3-4f4c-909f-aab225a203ff`, command SHA-256
`8aa10f6a4d7f592de0194cbc58d7f474f4b654edcb0eebabed51321b23999c2e`.
Final build: run `06d2d47d-8362-4330-b37e-175a1fca5df2`, command SHA-256
`bb8e7d85ca4a904cadc9763fdd1cb4e122a5526f51659078498d51db887d52c8`.
Both report command/launcher/sandbox exit 0, `error:null`, and `cleanup.removed:true`.
Boundary receipts record uid 1000, capabilities 0, no-new-privileges, loopback-only and zero
nonlocal routes. S0 owns TMPDIR `/dev/shm`, caches, storage and build output.

The actual real HTTP/SSE test read a held executor's running checkpoint and hosted tool refs,
consumed durable `updated` events to a known sequence, and denied unrelated/provider raw blobs.
The real session/repository/ledger tests exercised pre-tool storage, all three family layouts,
reopen/retry, allocated IDs, immutable snapshots and cancellation fences. These are backend
surface proofs, not browser UI or production-provider evidence.

LSP: job-directory scan reported 26 TypeScript files and 0 diagnostics; the core and both
progress tests also returned no diagnostics during GREEN work. Some fresh single-file LSP
requests timed out at 3000ms, including the final region edit. The final app `tsc` and explicit
progress-test compiler run cover the final source despite that LSP limitation. Markdown has
no configured LSP. `git diff --check` passed after the final source changes.

Build warnings were retained, not suppressed: Zod annotation placement, an event-editor
record-picker circular chunk, mixed static/dynamic imports, and large chunks. Their files are
outside this patch; no baseline build comparison is claimed. Missing proxy-key notices are
expected in S0's secret-free environment. None prevented the build.

### Earlier attempts preserved, not relabeled GREEN

1. `/var/tmp/s0-job-progress-green-9PKPsfZP/progress`: 21/22 passed, exit 1; the 35-tool bounded
   activity case hit its unchanged 15-second deadline. Source
   `9eaed391c095261d1a42fc74fc1f48f01680ce490c45948fccfff331980c745e`.
   Fix: capture the draft with one serialization and only not-yet-durable tool rows, instead
   of repeatedly cloning/parsing the full project and full journal. Preserve immutable
   in-place capture and exact-byte ref reuse. Added two discriminating writer cases.
2. `/var/tmp/s0-job-progress-green-Z1ZPIF9D/progress`: **24/24 passed**, exit 0; bounded case
   completed in 7.47 seconds without a timeout/test-assertion edit. Intermediate source
   `e3ab99ba37de1228c684789de51fdde6868ead70ca3c6c8c75f5fc6cbc99ed04`.
3. `/var/tmp/s0-job-progress-contracts-5kPqBYkX/contracts`: 92/93 passed, exit 1 on the same
   intermediate source. Existing region test expected `region/partial/review` after output
   blob-storage failure but saw `region/session/completed`. This patch had incorrectly put
   region review-artifact preparation into the sticky session writer. Restored preparation
   after the drained session and retained shared, sticky checkpoint publication. The unchanged
   region test and the whole final group now pass; no failed test was weakened.
4. `/var/tmp/s0-job-progress-build-g7RMQdSM/build`: app typecheck succeeded, then the custom
   focused test compiler failed with seven `ImportMeta.env` errors because its selected roots
   omitted the project's ambient declarations. Build did not run in that attempt. This was
   a validator setup error, not a production error. The corrected compiler includes all
   configured `.d.ts` roots plus the two progress tests, with unchanged strict compiler options.

Every child attempt above has `error:null` and `cleanup.removed:true`. The parent's original
16/16 RED logs remain at their original paths, unmodified.

### Reproducible final S0 test command

Executed with `OUT=/var/tmp/s0-job-progress-final-9FWSXcoL`, output subdirectory `final`.
A subsequent parent run must use its own fresh output directory and coordinated slot.
The provisioned browser directory is a required S0 mount; no browser was launched.

```bash
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract
OUT=$(/usr/bin/mktemp -d /var/tmp/s0-job-progress-final-XXXXXXXX)
/usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/usr/sbin:/bin LANG=C.UTF-8 \
  /usr/bin/python3 -I -S -B \
  /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract/scripts/qa/isolated-validation.py \
  --source /home/main/.herdr/worktrees/rpg-zzu/worktree-job-progress-contract \
  --expected-head f6a88ffd71ca06d6bbdd9ca548a47ff2978c8843 \
  --expected-source-sha256 7ebee8d92bf444222aa22b361ebeaf504bdd0c3b45cec89ac2e097f93be03ac3 \
  --dependencies /home/main/z-project/rpg-zzu/node_modules \
  --browser /dev/shm/task8-managed-chromium-cHQvga \
  --bun /home/main/.bun/bin/bun --scratch-root /var/tmp \
  --output "$OUT/final" --timeout 1200 --retain-log \
  --include src/ai/assistantSessionCore.ts \
  --include src/ai/jobs/checkpointState.ts \
  --include src/ai/jobs/sessionProgress.ts \
  --include src/ai/jobs/sessionHost.ts \
  --include src/ai/jobs/executors/assistantJob.ts \
  --include src/ai/jobs/executors/regionJob.ts \
  --include src/ai/jobs/tilesetClusterExecution.ts \
  --include test/aiJobLiveProgress.test.ts \
  --include test/aiSessionProgressEdges.test.ts \
  --include openwiki/architecture.md \
  --include openwiki/testing.md -- \
  npm test -- --maxWorkers=1 --no-file-parallelism \
  test/aiJobLiveProgress.test.ts test/aiSessionProgressEdges.test.ts \
  test/aiJobCanonicalReplay.test.ts test/aiSessionJobHost.test.ts \
  test/aiRegionJob.test.ts test/aiTilesetJob.test.ts \
  test/aiJobApplication.test.ts test/aiJobWorkerIsolation.test.ts
```

### Final build/typecheck command body

The final build used the same S0 source pin, dependencies, includes and timeout with
`--output /var/tmp/s0-job-progress-build-7NNC1P2E/build`, followed by `/bin/bash -c` and this
body (formatted here for readability; its exact command hash is above):

```bash
cd /work && npm run typecheck:app && node --input-type=module -e '
import ts from "typescript";
const file=ts.readConfigFile("tsconfig.json",ts.sys.readFile);
if(file.error) throw new Error(ts.flattenDiagnosticMessageText(file.error.messageText,"\n"));
const config=ts.parseJsonConfigFileContent(file.config,ts.sys,".");
const roots=[...config.fileNames.filter(f=>f.endsWith(".d.ts")),"test/aiJobLiveProgress.test.ts","test/aiSessionProgressEdges.test.ts"];
const program=ts.createProgram(roots,{...config.options,noEmit:true});
const diagnostics=[...config.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCanonicalFileName:f=>f,getCurrentDirectory:ts.sys.getCurrentDirectory,getNewLine:()=>"\n"
  }));
  process.exit(1);
}
console.log("Progress test TypeScript: 0 diagnostics (configured ambient declarations included)");
' && npm run build:app
```

This is the affected app/worker build, not a claim of the separate full player/standalone gates.

## Final changed-file fingerprints

```text
8335dcc9b6be19828bf2844504a4d07c6b9a43315ed8d55398d361c35cc32e65  src/ai/assistantSessionCore.ts
90773167bd98b661e49cfc5f79ceecaa5107a649094ec5c91c93a103a6afd076  src/ai/jobs/checkpointState.ts
29c734cf9c5eb5e2d05d0d3960654cb1ac112cfb4c414e3ddc67ef87f5b348bc  src/ai/jobs/sessionProgress.ts
82cc408a013545fa2149a1b196507c0e718bfdb75c76fdc8857d9e1315dec0ea  src/ai/jobs/sessionHost.ts
69fccce3da39f146327e35a168f9e7e451a3f263d2e7824e9139e44e760bd001  src/ai/jobs/executors/assistantJob.ts
594881127921f256302d2a3948036889c3d8adda5bffd4ab32174b791a968f65  src/ai/jobs/executors/regionJob.ts
01d97c8eac310ed3c9cbeb6052596a1aa90a36df5f20bd72fa8f4f50e1a85860  src/ai/jobs/tilesetClusterExecution.ts
a497200c98ff952f6f7a1da35cd01d0f40e0fbba1e283f8486e5ebe81236d8e6  test/aiJobLiveProgress.test.ts
170b3e4bd17a65c85b2206792614629d954ca8c85ed45d512579f298dbd067e2  test/aiSessionProgressEdges.test.ts
c2c4ba40255f2f13bfd8650bdc73820079ffb2bbbb9073026557b2e1e54bdf89  openwiki/architecture.md
d2a0292fc8f792b7a0cc5763a95be2d2298579032f7d2494abd9765952b33e95  openwiki/testing.md
```

## Cleanup and scope boundary

All six child S0 receipts report scratch removal, including the final build's output. The
owned test HTTP listeners, repository fixtures and caches lived inside those removed
sandboxes; no shared cache, dependency installation, browser directory, env/auth/origin/
persistence configuration or foreign process was modified. No live provider/DB service,
interactive browser or forbidden shared port was used. Original RED evidence and all child
command/source/receipt evidence remain retained outside the removed scratch roots.

The progress-only heavy slot is returned. There is no remaining blocker for this backend
patch. Parent owns review/integration and any later GROK binding; no public/UI migration,
new-job Continue, full Task8 approval, commit or push is included.
