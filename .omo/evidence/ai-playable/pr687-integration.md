# PR687 frozen integration: blocked by incompatible verification contracts

## Outcome

No integration commit was created. The isolated `--no-commit --no-ff` merge was
aborted after identifying contradictory behavioral contracts. This is an evidence-only
handoff on candidate 497, not a verified merged candidate, promotion, or approval.
No source or existing test assertion was changed, deleted, skipped, or weakened.

- Task: `st_01a07c86`
- Candidate: `4978229453770fe0bde4b43889048b621797d577`
- Frozen upstream: `9a7069e685bad13cde5cbb22b9cb285e893f2356`
- Merge base: `5d2649d0cd0baf83d3a30036955ff24ce149f689`
- Isolated path: `/home/main/z-project/rpg-zzu-pr687-integration-st_01a07c86`
- Branch: `agent/pr687-integration-st_01a07c86`
- Evidence commit: the commit containing this report; its first parent is candidate 497.
- Frozen parent: `/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906`

## Isolation

Read root AGENTS, quickstart, INDEX, PROJECT_WIKI, agent-worktrees, editor/runtime
routing, and the focused AI ownership/acceptance documentation. Inspected both
frozen histories and conflicting implementation/test hunks.

Created this new tree from the explicit frozen candidate, avoiding a snapshot of
any shared uncommitted work:

```sh
npm run wt -- create pr687-integration-st_01a07c86 --base 4978229453770fe0bde4b43889048b621797d577
```

The supported helper provisioned a node_modules link and private env. Its allocated
port 9841 already had a listener, so only this tree's `.env.local` was assigned
19801, checked against worktree assignments and a loopback bind. `ss` confirmed
19801 had no listener. No server was started, stopped, restarted, reused or reloaded.
Existing worktrees were preserved. No parent branch or files were changed, and no
DB/content/model/browser authoring or remote Git write occurred.

## Executably demonstrated incompatibilities

### 1. Successful exploratory checks: declaration versus invocation

Candidate `ToolVerificationEvidence` deliberately keeps adoption separate from
attempt history. A successful unadopted probe is not a new game requirement, and
removing its dummy target does not leave a stale blocking obligation. Candidate
`assistantVerificationContinuation.test.ts` tests both adopted and unadopted dummy
removal, with opposite terminal outcomes; `assistantVerificationEvidence.test.ts`
also tests the unowned-dummy case directly.

Upstream `ToolVerificationEvidence.observe` marks every explicit invocation as an
explicit check. `invalidateAfterWrite` marks those checks stale; `problems` reports
them even if no acceptance/scheduler declaration ever adopted their scope.
Upstream commit `20a1a916c2f12053c779febd2e5d9edab6aa86a3` deliberately makes these
stale explicit checks trigger bounded authoring repair before finalization.

The executable probe supplied the SAME real successful scene result to both
implementations, removed its NPC fixture, and invalidated after that write:

- candidate: `problems() = []`
- upstream: one stale `run_scene_test` problem

Making all upstream explicit passes into retained requirements breaks the candidate
protection. Keeping adoption-only blocking changes upstream's promised implicit
revalidation behavior. This is an authority-policy choice, not import repair.

### 2. Scene correction identity: facing-only versus navigation/debug coalescing

Candidate commit `7cd4340505d204c102a9fe0b565c339c3b18c0ee` and subsequent ownership
fixes preserve movement, debug state, ordered assertions, and map/event ownership;
only facing can be repaired without changing the accepted scene identity.
Candidate `sceneVerificationRepair.test.ts` explicitly rejects changed navigation,
state, start, checkpoints, choices and assertions. Its inherited `set` fixture was
changed to RETAIN that step in the corrected script.

Upstream strips face/move/walk and position-only set steps while computing scene
identity. Its version of `sceneVerificationRepair.test.ts` explicitly requires a
failed script containing `set {x,y}` to be cleared by a passing script that removes
that step.

The probe ran both scripts through the real candidate scene runner and then fed
identical results to both frozen evidence implementations:

- failed script: `set {x:10,y:8}`, snapshot, interact, reward assertion
- passing script: face up, snapshot, interact, identical reward assertion
- candidate: original finding remains (one problem)
- upstream: original finding cleared (`problems() = []`)

A union of both implementations cannot simultaneously retain and delete that same
finding. Choosing broad upstream coalescing would remove candidate route protections.

### 3. Scheduler skip policy (source/test evidence, not separately executed upstream)

Upstream `test/workPlanIdentity.test.ts` requires `skip_work_item` on a verification
item to return false and leave the plan unchanged. Candidate
`assistantVerificationContinuation.test.ts` requires a verification item to become
`skipped`, with the independently owned check still blocking acceptance and retained
through continuation. The candidate test passed in this session. Both policies
protect completion, but they require opposite observable scheduling behavior.

## Recommendation / decision required

Retain candidate's explicit adoption and facing-only correction identity. They are
specific protections earned by the captured route/reward failures. Parent/ultrabrain
must explicitly adjudicate how upstream implicit explicit-check revalidation and
scheduler skip policy fit that authority model before an integration changes either
behavior or migrates contradictory assertions. No such migration was guessed here.

Other conflicts appeared composable in principle (additive functional criteria,
provider image validation plus delivery acknowledgments, native catalog exposure
plus session controls, scene purchase/transfer/life interactions plus protected
reward replay), but were NOT resolved or verified. In particular, functional NPC
acceptance must not bypass candidate request-bound prerequisite witnesses or repeat
reward protections. Store lineage auto-merged during the attempted merge, which is
not evidence that the combined persistence path works.

## Conflict inventory

The attempted merge reported exactly 20 conflicted paths:

- `openwiki/INDEX.md` (generated; would require regeneration after resolution)
- `openwiki/editor-ai-tools.md`
- `openwiki/runtime-project-schema.md`
- `scripts/lib/ohMyPiPiAiRuntime.ts`
- `src/ai/assistantAcceptance.ts`
- `src/ai/assistantAcceptanceEvaluation.ts`
- `src/ai/assistantAcceptanceLedger.ts`
- `src/ai/assistantAcceptanceTools.ts`
- `src/ai/assistantSession.ts`
- `src/ai/intentDeclaration.ts`
- `src/ai/toolVerificationEvidence.ts`
- `src/ai/workItemOutcome.ts`
- `src/ai/workPlan.ts`
- `src/assets/resourceSearch.ts`
- `src/editor/tools/playTools.ts`
- `src/testing/sceneTestRunner.ts`
- `test/actionAcceptanceRequirements.test.ts`
- `test/aiToolDiscoveryEscalation.test.ts`
- `test/assistantProposalAssembly.test.ts`
- `test/assistantVerificationContinuation.test.ts` (add/add)

## Source delta versus candidate 497

Actual delivered source delta: **zero** in every category. The merge was aborted.
Only this report, the executable diagnostic probe, and its two output logs are added.

| Category | Delivered source delta | Incoming areas inspected, not integrated |
| --- | --- | --- |
| AI generation/verification | 0 files | Full native catalog and original grounding; canonical requirements/run outcomes; functional acceptance; verification authority; plan repair; appearance evidence; provider image transport |
| Runtime / persistence / rewards | 0 files | Scene purchases, transfers and held interpreter; life-field interactions; protected NPC replay; store lineage overlap; upstream publication/save identity |
| Unrelated upstream | 0 files | Upstream history also includes BGM release packs, sidebar/event-window UI, shop/item equipment presentation, release/community/export infrastructure |

The two frozen inputs differ in 225 `src/` paths (direct tree comparison, including
candidate-only differences); that number is NOT an integrated delta or verification
claim. No focused wiki update was needed because no contract change was delivered.

## Checks executed once

All execution occurred in the isolated tree after aborting the attempted merge,
with application source exactly at candidate 497.

1. `npm test -- test/sceneVerificationRepair.test.ts test/assistantVerificationContinuation.test.ts --maxWorkers=2 --no-file-parallelism`
   - Exit 0, **2 files / 28 tests passed**, one run.
   - Log: `pr687-integration-focused.log` beside this report.
   - Real registered tools/session/ledger paths; scripted model transport; no added
     sleeps, polling, timing retries, or assertion changes.
2. `node node_modules/vite-node/vite-node.mjs --config vitest.config.ts .omo/evidence/ai-playable/pr687-integration-probe.mts`
   - Exit 0, both contradictory outcomes asserted.
   - Log: `pr687-integration-probe.log` beside this report.
   - Candidate uses the real `runTool` scene runner. Upstream evidence and verdict
     parser are fetched from the EXACT local frozen Git blobs, transpiled to ESM,
     then imported without behavioral edits or mocks. Only the parser import URL
     is resolved to its matching frozen blob. This is not an upstream full-session,
     browser, runtime player, or persistence execution.
3. LSP diagnostics on `pr687-integration-probe.mts`: **no diagnostics**.
   Markdown diagnostics were requested but no Markdown LSP is configured; the report
   is covered by the whitespace/diff check, not a claimed Markdown LSP pass.
4. Merge exit 1 documented the conflicts; `git merge --abort` exited 0 and restored
   the isolated source/index before evidence work. `git diff --check` and commit
   parent/source-delta checks are recorded in the final handoff.

## Limits

No merged-candidate LSP, full gates, builds, browser/manual runtime QA, live editor-AI
generation, remote save/reload, PR update, push or merge was performed. Full gates
and release approval remain parent-owned. These passing checks demonstrate the
incompatibility and candidate controls; they do NOT establish an integration pass.
PR687 state/head/base/draft information was supplied by the task, not re-queried.
The local evidence commit is not the requested integration commit and must not be
promoted into the frozen live source or remotely merged.
