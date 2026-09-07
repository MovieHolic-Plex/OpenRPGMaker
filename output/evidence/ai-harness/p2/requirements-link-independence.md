# Legacy fixture fidelity and scheduler-link independence

This test-only follow-up corrects `plan()` so that both new fields are independently opt-in: `plan(requirements?, requirementIds?)`. `plan()` emits neither `requirements` nor item `requirementIds`; declaring requirements alone does not invent scheduler links. The existing linked-plan/parser tests now request their links explicitly.

The two legacy session tests assert the actual model payload has neither new field before dispatch:

- Bare legacy scheduler plans remain unassessed after skip.
- Legacy explicit `acceptance` is still assessed without `requirements` or item links.

Two new real-session cases assert a required obligation remains blocked despite completed/skipped scheduling and absent links:

- The requirement is declared with no item linked to it initially.
- An initially linked requirement survives replacement by a plan containing neither declarations nor item links.

The canonical source already adopts all declarations independently of WorkItems and filters its denominator only by required/withdrawal metadata. No production code was changed for this follow-up.

## Executed evidence

Before correcting the helper, both strengthened legacy tests failed because `layers.0.items.0.requirementIds` was present. This is fixture-fidelity RED, not a product failure:

```sh
npm test -- test/aiRequiredOutcomes.test.ts -t 'legacy|existing explicit acceptance' --maxWorkers 2 --minWorkers 1
```

Exit **1**, two failed, 33 runner-filtered. Raw output: `requirements-legacy-fixture-red.log`.

After the correction and new independence assertions:

```sh
npm test -- test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers 2 --minWorkers 1
```

Exit **0**, **116/116 tests in seven files**, 81.19s. `aiRequiredOutcomes.test.ts` now has 37 cases. Raw output: `requirements-link-independence-green.log`. Commands ran in `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`, capturing npm's direct exit without a pipeline.

Diagnostics on both changed files found no diagnostics; `git diff --check` exited 0. Existing session/native-tool tests are the actual API exercise; only LLM transports are scripted. No new sleep, polling, prose assertion, type escape hatch, helper abstraction or source dependency was added. The existing fixture now takes two independent explicit arguments. LOC: fixture 42, requirement suite 219; the latter remains in the documented warning band below 250.

The worktree remains on `9e01ca0525866ddfc262cfbe3e073a894c6c172b` with uncommitted follow-up changes. Prior question-dispatch source guards and fixture corrections remain intact. This turn added no production edit, commit, push, merge, full gate, browser/server or remote fixture. Build/typecheck were not rerun for this test-only follow-up; their preceding successful execution is recorded separately in `requirements-question-dispatch.md`.
