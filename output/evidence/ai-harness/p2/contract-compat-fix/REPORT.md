# P2 contract compatibility repair

## Delivered outcome

All four newly introduced contract mismatches are resolved by test-only changes.
The final exact test content passes 84/85 cases in ten files. The only failure is
the independently demonstrated baseline F-05 assertion; it is neither changed nor
skipped. This is baseline-relative success, not an all-green test command.

Test commit: `6f8000763a411a24db540b6b16875a39644f1b1b`

- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-event-contract-20260906`
- Branch: `agent/ai-harness-p2-contracts-20260906`
- Parent: `dfa8bdd15e4e39904ae910101d5e90579b5d8a67`
- Unchanged source tree: `45c9a7a48f1f1c3eb9cfea2966ac477c86307957`
- Task: `st_01a078e9`; parent session: `01a07564-2645-75ee-8627-2f0990a25d52`
- Evidence is delivered in a subsequent evidence-only commit containing this report.

Only these tests changed:

1. `test/aiBlockedContinue.test.ts`
2. `test/aiToolCallSessionProtocol.test.ts`
3. `test/assistantSessionIntent.test.ts`

## Source-backed contract decisions

Read the worktree AGENTS, quickstart, wiki index/project map, relevant panel
context, and the complete lead contract at
`/home/main/z-project/rpg-zzu/.omo/ulw-loop/ai-harness-implementation-01a07564/phase-p2.md`.
The source, not obsolete test prose or telemetry wording, establishes the checks:

- `aiTurnRunner.ts:126-143` renders the existing Continue button and sends
  `("계속", undefined, { userResume: true })`. `aiChatPanel.ts:1576-1583` consumes
  that host authorization to change Ask to Do. `AiRunSurface.sendText` types the
  option. The test now types its spy against that surface and checks the explicit
  authorization exactly once. Other control ownership, collapsed-history, and
  resumed-result checks are unchanged.
- `assistantSession.ts:1526-1580` catches unexpected turn errors and returns a
  typed failed result. The tool-loop catch at `4142-4154` first serializes a failed
  `role:tool` response with `tool-loop-exception`, then rethrows to that boundary.
  The test keeps the real post-tool exception injection and checks its exact
  sentinel, stoppedReason, outcome, recap, harness, and final typed event. It also
  runs a subsequent public session turn and verifies that the provider receives
  both the original call ID and exactly one corresponding failed response; history
  deletion cannot make the protocol assertion pass. The original malformed-JSON
  case is unchanged. The injected hook is restored before the next turn.
- `assistantSession.ts:1716-1722,1955-1965` maps a declared question to Ask before
  deciding whether to plan. Planner transport at `1997-2017` has no tools; normal
  answer transport at `3702-3712` carries tools and `tool_choice:auto`. Tests now
  distinguish these real requests rather than requiring `planner:skip question`.
  The question does not call the planner; a needs-plan declaration does. Existing
  planner-start positive/negative checks remain.
- `planToolExposure.ts:66-71` scans explicit tool mentions. The session passes
  only the instruction, stripping the footer when no instruction override exists
  (`assistantSession.ts:1695-1702,3641`). Authorized Do cases preserve both positive
  `define_ending` exposure and negative footer-only `set_type_chart` exposure,
  with and without an explicit instruction option.
- `assistantSession.ts:3682-3684,3974-3977` removes write schemas in Ask and rejects
  memorized write calls at dispatch. Separate explicit Ask and declared-question
  cases keep the original question context. They challenge both instruction and
  declarer write-tool mentions, attempt a valid `define_ending`, observe the
  `composer-mode-ask` issue in events and provider-bound JSON, then successfully
  execute `list_endings`. Every model request remains read-only, no planner runs,
  no draft or plan is created, and the project remains equal to its input.

No unintended product regression was identified in these four mismatches. The
additional question case initially exposed test isolation leakage, not a product
change: `intentDeclarationClient.ts:124-156` caches declarations by user facts,
not by injected declarer. Reusing the same question in independent parameterized
cases reused the first case's modify declaration. Before/after hooks now reset
that cache, and each case verifies its own declarer was called. No sleeps, polling,
timeout changes, skips, suppressions, new prose assertions, or new non-null
assertions were added. Typed guards narrow all newly checked array accesses.

## Verification and preserved intermediate outputs

Environment: Linux x64; Node `v24.11.1`, npm `11.6.2`, Vitest `3.2.4`.
The existing worktree dependency symlink was used; no install/config change.
All test commands ran from the sole writable worktree with the lead-owned TMPDIR.
Exit statuses were captured directly after each command, without a pipeline.

| Artifact prefix | Scope | Result | Exit |
| --- | --- | --- | --- |
| `red` | Original three files before any edit | 13 passed, 5 failed | 1 |
| `corrected` | First correction, including added Ask cases | 19 passed, 2 failed: F-05 and cached-declarer leakage | 1 |
| `verified` | Cache-isolated tests plus seven related files | 84 passed, only F-05 failed | 1 |
| `final` | Final typed-guard revision plus the same related files | 84 passed, only F-05 failed | 1 |
| `diagnostics` | Final three files, compiler syntactic + semantic diagnostics | 0 diagnostics in every file | 0 |

Each test prefix retains its exact `.log`, `-vitest.json`, and `.exit` files.
Final changed-file subset: 20 passed / 1 baseline failure, with three added cases.
Related unchanged policy coverage: 64/64 passed. No tests were pending/skipped.

Commands for `red` and `corrected` (substitute the corresponding artifact prefix):

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 npm test -- test/aiBlockedContinue.test.ts test/aiToolCallSessionProtocol.test.ts test/assistantSessionIntent.test.ts --maxWorkers 1 --minWorkers 1 --reporter default --reporter json --outputFile output/evidence/ai-harness/p2/contract-compat-fix/red-vitest.json
```

Final verification command (`verified` used the same files/options with its own output prefix):

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 npm test -- test/aiBlockedContinue.test.ts test/aiToolCallSessionProtocol.test.ts test/assistantSessionIntent.test.ts test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/aiContinueUserAction.test.ts test/aiRunOutcomeLifecycle.test.ts test/aiOutcomeContinuationDelivery.test.ts test/aiComposerModeSession.test.ts test/aiAskPendingPlan.test.ts --maxWorkers 1 --minWorkers 1 --reporter default --reporter json --outputFile output/evidence/ai-harness/p2/contract-compat-fix/final-vitest.json
```

The actual API surface was exercised through real AssistantSession/tool/ledger
execution and the existing happy-dom Panel Continue test. That test distinguishes
normal composer typing, bridge send, unflagged surface send, and explicit button
click; only the genuine Continue click changes Ask to Do. There was no substitute
browser or full build, as directed. Full gates remain lead-owned and were not run.

LSP requests were made for all three files. Fresh intent diagnostics timed out;
a later protocol diagnostic correctly caught a readonly transport-array type
mismatch, which was fixed by retaining the readonly snapshot type. The final
independent TypeScript compiler diagnostic pass covers all three files under the
actual repository tsconfig without suppressing diagnostics or editing config:

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 node output/evidence/ai-harness/p2/contract-compat-fix/check-diagnostics.mjs
```

## Known baseline failure, deliberately unchanged

F-05 expects `야외 집으로 진행합니다.` but receives:

```text
완료 검증이 아직 미완성입니다.
- 집 하나 만들어줘: Missing or malformed criteria: repair_acceptance required
```

The copied lead `p2-residual-base*` and `p2-residual-current*` artifacts bind this
same failure to baseline `58105616bb4b970f8012e43fc20498bbe9c9d11a` and current
`dfa8bdd15e4e39904ae910101d5e90579b5d8a67`, respectively. They are inherited evidence,
not new runs by this worker. Their wider schema/database results are historical
context, not claims that this task fixes or validates those domains.

`scope-and-baseline-proof.json` compares the same F-05 name/status/assertion error
across baseline, current, and final JSON; all are identical. It also verifies the
F-05 test body is byte-for-byte unchanged from this task's parent commit. Only
shared test isolation changed, and the final failure remains identical.

## Scope, exact content, and cleanup

`scope-and-baseline-proof.json` contains the final test SHA-256 values and exact
source-tree identity. `protected-no-diff.log` records exit 0 and empty output for
the full protected-path diff, excluding only the three authorized tests and this
evidence directory. The test commit itself contains exactly those three tests.
Source, schema-worker files/tests, package/lockfiles, config, and all other tests
remain unchanged. `git diff --check` passes.

`cleanup.json` records bounded process-exit observations for the two owned
TypeScript diagnostics workers. Test/compiler commands completed synchronously.
No browser/server, remote content, dependency install, shared-root write, push,
merge, or PR was performed. The lead-owned private TMPDIR was preserved.

Assumption resolved from the approved contract and source: explicit user Continue
is authorization, whereas a question or an unflagged continuation string in Ask
is not. No new product policy was inferred from model prose.
