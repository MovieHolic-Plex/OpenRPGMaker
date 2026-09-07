# Requirement-source original-utterance correction

Changed one production assignment in `executeUserTurn`: `acceptanceRequestSource.text` now receives the existing `instruction`, not transport `text`. The existing derivation remains `(options.instruction ?? stripContextFooter(text)).trim()`. Thus explicit original user instructions win over transport wrappers, and footer-stripped user text is used when no override exists. Host scope remains separate metadata; no duplicate context field was added.

This clarifies the current integration contract described by the earlier requirement report: source text means the normalized original user utterance, not synthesized editor context carried in the transport message. Original request provenance remains immutable after adoption.

## Regression evidence

Two real-session cases were added to `aiRequiredOutcomes.test.ts`:

- A user utterance plus a synthesized `[컨텍스트]` editor footer, without an instruction override.
- Different transport wrapper/footer text and an explicit `options.instruction` containing the original user utterance.

Both then submit a separate follow-up user instruction that replans the same requirement ID with forged model source metadata. The retained source must equal the exact first user instruction and preserve its host scope. These are machine-owned provenance assertions, not prompt wording tests.

Before the source assignment changed:

```sh
npm test -- test/aiRequiredOutcomes.test.ts -t 'original user utterance' --maxWorkers 2 --minWorkers 1
```

Exit **1**, both cases failed because retained source included transport/editor context. Other cases were runner-filtered, not skipped in source. Raw output: `requirements-source-utterance-red.log`.

Final verification:

```sh
npm test -- test/assistantAcceptanceCost.test.ts test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers 2 --minWorkers 1
npm run typecheck:app
npm run build
```

All exited **0**. Raw evidence: `requirements-source-utterance-green.log` (**124 passed, eight files, 50.13s**), `requirements-source-utterance-typecheck.log`, `requirements-source-utterance-build.log`. The new requirement suite now has 39 cases. Commands ran in the assigned `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906` worktree, capturing npm exits directly without a pipeline.

Test-file diagnostics found no diagnostics. Session LSP diagnostics timed out after 3000ms and are not credited as a pass; the actual app typecheck and build both succeeded. `git diff --check` exited 0. Existing optional-provider-key, circular-chunk, mixed-import, unresolved runtime PNG and chunk-size build warnings remain unsuppressed.

## Scope and review

The production change reuses an existing trusted boundary value; no parser, authority, context schema, baseline, tool, UI, logging or projection behavior was redesigned. The new tests use the existing real-session/native-tool fixture with only LLM transports scripted. No new helper, dependency, parameter, type escape hatch, defensive layer, sleep, polling, timing assertion or resource was introduced. LOC remains 3840 for the existing oversized session; the requirement test file is 228, within its documented warning band.

Changes are uncommitted on top of `9e01ca0525866ddfc262cfbe3e073a894c6c172b`, alongside the preceding follow-ups. No commit, push, merge, full gate, browser/server or remote fixture was created by this turn. Earlier RED/GREEN artifacts are retained as historical evidence; this report records the corrected current provenance contract.
