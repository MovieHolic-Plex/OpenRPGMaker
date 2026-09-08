# R12 final-assessment integration regression receipt

Task: st_01a07738
Base: 9b77fe6afcc39f47020a2c0d648c479a89e56099
Worktree: /home/main/z-project/rpg-zzu-ai-r12-regression-0906
Production code changed: no.

## Diagnosis and contract

Both requested failures reproduced on the frozen base, not the seven previously
recorded aiAssistantSession baseline failures. The first expected 12 calls but
received 18; the second expected two verify_quest calls but received four.

noteSuccessfulTools applies each completed milestone, then sweepFinishedLayers
selects the canonical calls and marks that layer verified. R12 separately calls
assessCompletion at the model-final boundary and from finishRunRecap. These are
read-only checks, not replayed authored tools or milestone applications. The
second boundary also covers budget exits and finalization paths after the model
response. This test-only fix retains both boundaries, without introducing caching
or weakening fresh-artifact semantics. It does not optimize repeated read checks
on an unchanged artifact.

The tests delimit layer scope at the final scripted model response, retain exact
canonical layer sequences, require exactly two completion assessments, and match
the complete completion-tool stream against those assessments. They retain exact
quest IDs/scenarios, inspect real current-project lint inputs, verify the fallback
quest's verified node, and assert exact applied tool batches, milestone events,
undo counts, completed items, and no remaining proposals. Spies call through to
real verification/application code. UI yielding is injected as a no-op; no sleeps,
polling, new type assertions, or prose pins were added.

## Verification receipts

All log paths below are relative to .omo/evidence/r12-regression/ in this worktree.
Logs remain local; this receipt and the test change are committed.

- red.log: npm test -- test/aiAssistantSession.test.ts -t '\(a\) 레이어 완료마다|\(a-2\) final 레이어' --maxWorkers=2
  Exit 1: both requested cases failed (2 failed, 52 filtered out).
- focused.log: same command after the test correction.
  Exit 0: 2 passed, 52 filtered out; 31.40 seconds.
- related.log: npm test -- test/assistantFinalAssessment.test.ts test/assistantVerificationEvidence.test.ts test/agentVerification.test.ts --maxWorkers=2
  Exit 0: all 70 tests in 3 files passed; 44.52 seconds.
- Language-server diagnostics, test/aiAssistantSession.test.ts, severity all:
  No diagnostics found.
- typecheck-app.log: npm run typecheck:app. Exit 0.
- typecheck-full.log: npm run typecheck. Exit 2, 828 TS diagnostics, none in
  test/aiAssistantSession.test.ts. Examples: TS7016 missing declarations in
  scripts/lib/aiAuthRuntime.ts; TS2322 in src/editor/editorToolHook.ts; TS2339 in
  test/workPlan.test.ts. No full-typecheck green or baseline-delta claim is made.
  The initial pre-edit full-typecheck attempt timed out at 120 seconds without
  diagnostics (typecheck-before.log); the completed post-edit run used 360 seconds.
- git diff --check: passed.

The full 54-case session suite and supervisor full gates were not rerun here.
The seven baseline session failures were not edited. No browser, DB, environment,
push, PR, or main-branch operations were performed. Frozen live QA production
behavior is unchanged by this commit.
