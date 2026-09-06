# Multi-map construction-contract patch

Base: c2ae0514. Same main worktree; no commits, children, browser, build, or DB work.
Concrete audit: /tmp/ai-session-audit-20260906-findings.md, entries 87 -> 122 ->
162 (village spec replaced by cave spec, then village placement loses its gate),
and entries 66-69 (terrain background / road overlap rejects the whole batch).

## Delivered behavior and API

- AssistantSession has one live `Map<mapId, {spec, turnIndex}>` and a latest-map
  key. No duplicate live singleton. A successful confirmation or expansion moves
  that map to the most-recent position. Failed updates, failed writes and thrown
  runners retain every previously valid spec.
- `getActiveSpec(mapId?: string | null): BuildSpec | null` is backward compatible:
  no argument reads the latest confirmed/expanded spec; a map ID reads that map;
  explicit null returns null. Removing the latest map falls back to the most
  recently confirmed/expanded surviving map.
- `getCompletionSpecs(calls: readonly ProposalCompletenessCall[]): BuildSpec[]`
  selects only changed maps, sorted by map ID. Precedence independently per map:
  current-turn explicit > current-turn implicit > historical carryover > eligible
  active spec. It does not implicitly combine the call ledger: callers pass
  applied plus pending writes for accounting, pending only for application.
- `proposalCompletenessWarnings` accepts optional `buildSpecs: readonly BuildSpec[]`.
  When supplied it supersedes legacy `buildSpec`; an empty list takes the existing
  no-spec heuristic path. Multiple map checks are evaluated in one invocation,
  map IDs qualify missing assets so identical asset IDs cannot collapse, and
  generic interior/quest/no-spec logic is not independently rerun per map.
- aiTurnRunner directly shares `session.getCompletionSpecs(turnWrites)`. Its
  confirmed-spec completeness cache and the now-unused exported helper
  `completenessSpecForProposal` were removed. Blueprint presentation still uses
  the latest-spec compatibility API; it is not a construction-contract cache.
- Carryover snapshots and warning deduplication are map-keyed. Implicit selection
  and successful implicit expansion remain turn-local, never persisted as explicit
  specs. The NPC fallback uses all current-turn specs, excluding historical NPCs.
- Successful map deletion prunes specs, carryover and implicit selection before ID
  reuse; failed deletion does not. Successful reset_project clears all such state,
  including a reused start-map ID and future planned maps. Ordinary rebase prunes
  only maps that existed before and disappeared; never-created planned maps and
  surviving maps remain. Goal acceptance reset is not a construction reset.
- Same-layer terrain/road overlap is allowed only when an explicit buildOrder puts
  terrain before road. Unordered/reversed/incomplete order, terrain/house overlap,
  and all existing overwrite/completed-house protection remain enforced.

No NPC tool code changed. No batch completion or tile-deferral policy was added.
Immutable acceptance and applied-plus-pending accounting were not weakened.

## Exact source/test/wiki changes

Production:
- src/ai/assistantSession.ts
- src/ai/buildSpec.ts
- src/ai/proposalCompleteness.ts
- src/editor/panels/aiTurnRunner.ts
- src/editor/panels/aiChatPanelHelpers.ts

Tests:
- test/assistantMultiMapSpec.test.ts (new, 18 cases)
- test/aiTurnAppliedAccounting.test.ts (real session -> panel plural selection test;
  existing no-spec double implements getCompletionSpecs)
- test/aiAutonomousRunSurface.test.ts
- test/aiAutonomyRunSurface.test.ts
- test/aiClusterAssist.test.ts
- test/aiComposerEffortPanel.test.ts
- test/aiPanelAutoExpand.test.ts
- test/aiPanelExpandShrink.test.ts

The last six files only add the no-spec `getCompletionSpecs(): []` API to their
existing session doubles. No production optional-method fallback was introduced.
Documentation: openwiki/editor-ai-panel.md.

## RED

```sh
npm test -- test/assistantMultiMapSpec.test.ts --pool=threads --maxWorkers=2 --testTimeout=60000
```

Before production edits: 13 failed / 4 passed, exit 1 (`red.log`, `red.exit`).
A/B/A writes returned [false, true] rather than [true, true]. Map-specific reads
returned B when asked for A. The runner-throw test could not reach the runner
because A was already lost. The plural completion API was absent. Ordered terrain
then road returned [false, false, false] rather than [true, true, true].
The overlap parameter table was subsequently wrapped in row objects so Vitest
passes each buildOrder array as one parameter; an additional current-vs-historical
NPC fallback case brought the final count to 18. No failing test was removed.

## GREEN

```sh
npm test -- test/assistantMultiMapSpec.test.ts test/aiTurnAppliedAccounting.test.ts test/aiCompletionAccounting.test.ts test/assistantDependencyRetry.test.ts test/assistantAcceptanceSession.test.ts test/npcRewardSession.test.ts --pool=threads --maxWorkers=2 --testTimeout=60000
```

```text
Test Files  6 passed (6)
     Tests  80 passed (80)
  Duration  126.82s
exit 0
```

Full output and exit: green.log / green.exit. Tests exercise real sessions, real
registered tools, existing milestone/store accounting, and the actual panel turn
runner under fake DOM. Spatial tests deliberately stop at an explicit one-batch
budget: pending acceptance stays blocked, not fabricated as verified. The NPC
fallback case invokes that internal boundary with real tools/project mutation;
it does not claim dialogue/cast or playable reward verification.

```sh
npm run typecheck:app
```

Completed with exit 0, no diagnostics (typecheck-app.log / typecheck-app.exit).

## Broader regression and pre-existing failures (not hidden)

The exact 19-file command is recorded at the top of regression.log. It covers
spec gating/hardening, completed-house preservation, build order, completeness,
proposal assembly, acceptance/rewards, accounting, and all touched panel doubles.
Result: 18 files passed / 1 failed; 248 tests passed / 1 failed, exit 1.

Failure: test/aiSpecGateHardening.test.ts:319, implicit-selection expiration:
`expected undefined to be false`. Its old script has one final response per turn;
acceptance nudges consume the second-turn write in the first turn. This fixture
was not changed by this patch.

To distinguish baseline from regression, all five production files were temporarily
restored exactly to HEAD using the inverse of implementation.patch. The failing
case was run alone with the same pool/timeout flags and the exact test title
(`baseline-hardening.log`, exit 1 in baseline-hardening.exit). It reproduced the
same line-319 error. The implementation was restored by an EXIT trap and compared
byte-for-byte with implementation.patch. The hardening test's SHA-256 matched HEAD.
The test-name filter's 20 unselected cases are not source-level skips/deletions.
The new multi-map implicit-expiry case and all six existing accounting expansion
cases pass and retain the real next-turn refusal assertions.

Language-server diagnostics were requested for all changed TypeScript files.
Production files, the six no-spec doubles and the new multi-map tests report no
diagnostics. The new test initially exceeded the LSP's 3-second refresh deadline;
a later completed request returned no diagnostics. aiTurnAppliedAccounting has two
pre-existing fixture errors: TS2741 at line 43 (titleCall omits destructive) and
TS2345 at line 168 (milestone event omits commitId). `git show HEAD` confirms the
same unmodified payloads at original lines 41 and 135. They are not suppressed or
fixed as unrelated baseline defects. No new diagnostic was reported for the added
panel case. The app-only compiler gate is green.

Logs retain the complete command output with trailing whitespace removed. The
baseline-isolation implementation.patch is a local gitignored artifact; the
staged production diff is the delivered patch.

`git diff --check` passes. Patch and evidence are staged for lead QA; no commit.
