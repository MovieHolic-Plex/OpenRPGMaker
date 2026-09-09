# Assistant reliability / immutable acceptance merge integration

Task: st_01a07696. Worktree: worktree-rapid-harbor-7ca6.
Merge under inspection: HEAD 2c00261e, MERGE_HEAD 5384e607.

## RED facts (supervisor-captured, supplied in task)

The supervisor ran:

```sh
npm test -- test/assistantAcceptanceSession.test.ts test/npcRewardSession.test.ts test/assistantDependencyRetry.test.ts test/aiCompletionAccounting.test.ts --pool=threads --maxWorkers=2 --testTimeout=60000
```

- Seven accounting cases reached the expected work/state but returned
  `stoppedReason=error`: scripted chat exhausted after acceptance nudges.
- The retry rearm case reached a done work plan, but `state.batches` was 11,
  not the required 8.
- `assistantAcceptanceSession` and `npcRewardSession` passed.

These are supplied RED observations, not a new local reproduction. No raw RED
log was supplied to this child. The existing merged session conflict resolution
was already staged on entry and was left unchanged.

## Cause and minimal delta

The upstream acceptance ledger is independent of WorkPlan. Spatial tools create
an immutable missing-criteria promise if no explicit contract exists. A finished
plan cannot discharge it. `repair_acceptance` can supply missing criteria, but
only measured applied state can pass `targetChange`; a pending draft cannot.
The final-response gate gives three bounded repair nudges before returning an
acceptance-incomplete final result. Autonomous continuation also respects this
ledger, so leaving criteria missing causes extra rounds even after work is done.

Only these code files changed:

- `test/aiCompletionAccounting.test.ts`: the two-milestone model plan now promises
  actual changes in each of the two painted 3x3 regions. Assertions prove the
  first region verifies independently before the second, then both verify, with
  the original exact [1, 1] milestone write counts and map-content checks intact.
  The six draft-only expansion cases repair the missing promise with the actual
  retry region. Their model fixture answers the initial final request plus the
  three bounded acceptance nudges, checking the exact criterion and failed
  applied evidence on every response. First-turn chat counts are exactly 8
  (active spec) / 7 (implicit spec); second turns consume exactly five responses.
  This is checked protocol work, not unchecked success padding. Both turns end
  `final` with blocked acceptance and no applied writes. The first retains only
  the successful fill proposal; the second retains only the active-spec paint
  proposal, or none when the implicit scope has expired. Original failure,
  expansion, map-change and lifetime assertions remain.
- `test/assistantDependencyRetry.test.ts`: the successful eighth batch also repairs
  the missing criterion for the target NPC's single cell. The repair response
  still has failing applied evidence while the change is a draft. The existing
  real milestone application then verifies that evidence. The original 4/8
  batch counts remain unchanged; added checks require seven failed target calls
  followed by one success, exactly one applied place_npc, and no pending proposal.
  Unrelated title/NPC writes cannot satisfy this scoped promise.

No production change was needed. In particular, the merged publishAcceptance /
applyAcceptanceTool behavior, completionProblems, deferred gates, retry bounds,
and upstream acceptance assertions remain untouched. No per-map spec cache or
NPC repair implementation was added. No tests were skipped, deleted, or loosened.

## GREEN verification

The exact four-file command above passed on the first post-edit execution:

```text
Test Files  4 passed (4)
     Tests  50 passed (50)
  Duration  109.22s
exit 0
```

Per file: accounting 8, dependency retry 12, NPC reward 19, acceptance session 11.
Full output: `focused-tests.log`; actual shell exit: `focused-tests.exit`.
These tests exercise the real AssistantSession and tool/store surfaces, with
only the existing external persistence boundary fixtures. No browser/DB claim.

```sh
npm run typecheck:app
```

```text
> rpg-zzu@0.1.0 typecheck:app
> tsc --noEmit -p tsconfig.app.json
exit 0
```

Full output: `typecheck-app.log`; actual shell exit: `typecheck-app.exit`.
The initial invocation was interrupted by the tool's 120-second timeout before
an exit status was recorded; its output is retained in
`typecheck-app-timeout.log`. Process inspection confirmed it had ended. The
same command then completed with a 600-second tool timeout. No errors were hidden.

Language-server diagnostics: no diagnostics found for both changed test files
and the already-merged `src/ai/assistantSession.ts`.
`git diff --check` passed; `git ls-files -u` returned no unresolved conflicts.
No full suite, build, database access, browser run, commit, or child spawning.

## Assumptions / handoff

Draft-only tests deliberately do not apply their proposals: `final` denotes a
bounded terminal response, not verified acceptance. This preserves their original
accounting/lifetime scope instead of introducing writes merely to turn the note
green. The retry criterion proves a scoped NPC edit, not playable reward behavior;
the unchanged 19-case NPC reward suite retains that separate responsibility.

The two test adaptations and this evidence directory are staged for the parent
merge commit. Existing staged upstream merge changes were not rewritten.
