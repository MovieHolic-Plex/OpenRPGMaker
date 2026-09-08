# R12: current final artifact and combined repair categories

Task: `st_01a076eb`. Worktree: `/home/main/z-project/rpg-zzu-ai-final-assessment-0906`.

Original base: `affaa027e3847eb78640c6330b4cf437f51394d4`.
Dependency: R7 source `2a5970c01d7d3d2717dee20f193de3bf44d36554`, directly based
on affaa. The initially clean isolated branch was rebased onto that dependency.
The parent already integrated R7 as `0f2f95b39`; cherry-pick only the R12 commit,
not its R7 parent. No R7 parser/schema or R11 transport code was changed here.

## Captured cause

Read the original REQUEST_CHANGES in
`/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/.omo/evidence/ai-playable/review-round2.md`
and its `output/evidence/ai-playable-final/round2/REPORT.md`, runtime receipts,
and saved project. The receipts show zero exit choices, key count 1, and ending
false after dialogue. Screenshot 11 was requested through the image read tool,
but this child model cannot view images; no independent visual-inspection claim.

The session selected only lint after the early quality check preceded ending
definition. Acceptance repair continued before collecting adventure defects,
and recap replaced acceptance text with adventure text. R1's actual quality
assessment already correctly detects the missing executable invocation.

## Delivered behavior

- Ending layers/current artifacts and earlier quality checks select fresh
  `evaluate_game_quality`. Final assessment is separate from the once-per-layer
  sweep and cannot mark an unfinished layer verified.
- Both the model finalization boundary and terminal recap assess the current
  draft. Budget exits cannot reuse a pre-ending quality result.
- `completion_assessment` events, repair input, and
  `TurnResult.completionAssessment` carry acceptance (including R7 issue fields),
  adventure defects, unresolved verification findings, and current check results
  together. Terminal prose composes the categories rather than overwriting them.
- Acceptance/content repairs share the complete assessment before selecting a
  bounded continuation. Missing ending invocation requests content repair.
  General advisory lint does not trigger a new fatal gate. Questions and plan-only
  requests do not acquire completion obligations.
- One-category repair preserves the others, valid original promises, and applied
  milestone accounting. No baseline reset or milestone replay was introduced.

## Red and green evidence

Initial red command:

```sh
npm test -- test/assistantFinalAssessment.test.ts --maxWorkers=2 --minWorkers=1
```

`red.log`: exit 1, six failures. The final quality result still had no
`ending_escape` invocation finding, and combined assessment was absent before
repair. Initial implementation: `green-initial.log`, six passed.

`focused-initial.log`: exit 1, 110 passed / two failed. The two failures expected
quality to remain stale after later writes. The changed tests now require the
last quality call to receive the actual current project, clean current evidence,
and exactly the original applied title write (no replay), rather than pinning
the prior stale behavior or prose.

`related.log`: the command's 150-second timeout interrupted the larger run.
It reported 8 assessment, 6 milestone-accounting, and 18 accepted-revision tests
passing, but had no complete runner exit. It is not used as green evidence.

Counter-case red command:

```sh
npm test -- test/assistantFinalAssessment.test.ts --testNamePattern='factual question' --maxWorkers=2 --minWorkers=1
```

`question-red.log`: exit 1, question received five model responses instead of one.
The fix excludes factual question intent from automatic completion assessment.
The filter ran only that new counter-case; no failing test was disabled/deleted.

Final complete command:

```sh
npm test -- test/assistantFinalAssessment.test.ts test/agentVerification.test.ts test/assistantVerificationEvidence.test.ts test/assistantAcceptanceSession.test.ts test/assistantVisualEvidenceSession.test.ts test/aiEndingCompletionRegression.test.ts test/aiRunEndProof.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiComposerModeSession.test.ts --maxWorkers=2 --minWorkers=1
```

`focused-final.log`: exit 0, **159 passed, 10 files**, 123.22 seconds. Tests use real
tools and the real session loop; model responses and external persistence are
controlled in memory. No fixed sleeps/polling, new type assertions, weakened
checks, or prose-pinning assertions were added.

## Actual saved-artifact replay

```sh
bun run .omo/evidence/ai-final-assessment/replay.mts /home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round2/first-project.json
```

`replay.log`: exit 0. The real public session entry point loads the captured
artifact with a deterministic completion response and a one-round execution
budget. Its terminal assessment runs lint plus quality, reports
`ending-uninvoked` for `ending_escape`, and retains the actionable invocation
diagnostic. Other reported issues remain warnings. The captured source is
unchanged, SHA-256
`919653337f89abafa70f093539e61c11c723310a494cb1721b6c92cd36d31559`.

The replay is a read-only session/assessment exercise, not an AI generation or
runtime playthrough. No authored content, server, browser state, or DB was written.

## Other gates and limits

- `npm run typecheck:app`: exit 0 (`typecheck-app.log`).
- Changed source/tests and `replay.mts`: LSP diagnostics returned no diagnostics.
- `git diff --check`: exit 0 (`diffcheck.log`, empty output).
- Captured runner logs had trailing whitespace/extra EOF blank lines; only that
  whitespace was normalized for the staged diff check. Exit results and output
  content are retained. The initial staged check rejected the raw log whitespace.
- Bootstrap failures before the real red run: `apply_patch` was absent from PATH;
  `/tmp/apply_patch` was a different POSIX patch wrapper. Both attempts created no
  test file, and Vitest exited 1 with no tests found. All actual edits used the
  installed Codex `apply_patch` entry point afterward.
- `.env.local` and occupied port 9841 were untouched. No push, PR, main update,
  merge, server/browser writes, or remote content writes were performed.
- Parent owns final build, broad gates, matched editor/player/provider builds,
  aggressive real-AI generation/correction, fresh reload/playthrough, and repeated
  ultrabrain approval. This increment does not claim overall R6 approval.

The R9 parent `recordToolResult` insertion context was inspected and remains
compatible. R11's provider-acknowledgement/spent-token region is untouched.
