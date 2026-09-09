# Narrow acceptance-cost correction

Implemented the requested bounded-cost correction in the assigned P2 worktree. Final verification passed **122/122 tests in eight files**, app typecheck and full build. Changes remain uncommitted on top of `9e01ca0525866ddfc262cfbe3e073a894c6c172b`, alongside the prior follow-ups.

## Changes

- `AssistantAcceptanceLedger.evaluate()` computes the full applied/draft difference once per evaluation, only when a tool-verdict criterion exists and `applied !== draft`. All tool-verdict promises reuse that boolean. Identical references cause no full-project fingerprinting; distinct references preserve content-based semantics.
- `ToolVerificationEvidence.hasChecks()` is a constant-time read of the existing check map's size, not another evidence store.
- `AssistantSession.refreshAcceptance()` retains image-evidence maintenance, then returns before project fingerprinting/cloning when neither canonical acceptance nor verification checks exist. Observed checks still keep the refresh path active before late requirement adoption. The comparison also short-circuits identical references.
- No broad performance refactor, timing threshold, dependency, cache framework, result projection or persistence-authority change.

## Deterministic RED/GREEN

`test/assistantAcceptanceCost.test.ts` adds six cases. Fingerprint and clone spies call their real implementations; assertions count work instead of measuring elapsed time. Three real ledger promises share each project pair. Real session/native reachability calls establish the pre-declaration evidence used by the two freshness controls; only LLM transports are scripted there.

Before source edits:

```sh
npm test -- test/assistantAcceptanceCost.test.ts --maxWorkers 2 --minWorkers 1
```

Exit **1**, four failed / two passed. `requirements-cost-red.log` records six full-project fingerprints for three promises, including when applied and draft are the same reference, and two unnecessary fingerprints for a session with no authority/evidence. Both same-content and changed-content late-adoption controls passed before the cost fix.

After source edits:

```sh
npm test -- test/assistantAcceptanceCost.test.ts test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers 2 --minWorkers 1
npm run typecheck:app
npm run build
```

All exited **0**. Raw logs: `requirements-cost-green.log` (122 passed, eight files, 64.17s), `requirements-cost-typecheck.log`, `requirements-cost-build.log`. npm exit statuses were captured directly, without a pipeline.

The final tests prove zero full-project fingerprints for identical references, one fingerprint per side for multiple promises on distinct references, zero fingerprints/clones on idle refresh, preserved proof for same-content detached refreshes, and retired pre-declaration proof after a content change. Existing late-adoption, stale/undo, advisory, image, legacy, scheduler-link and adversarial question contracts also passed.

## Review and limits

Diagnostics on all four files changed in this turn found no diagnostics; `git diff --check` exited 0. LOC: ledger 158, verification storage 56, new deterministic cost suite 49; the existing session remains oversized at 3840 with only the narrow refresh guard changed this turn. Responsibilities and existing boundaries remain intact. No new casts, `any`, non-null assertions, suppression, parameter bloat, speculative helper, sleeps, polling, prose test, logging surface or redundant destructive verification was added.

Full build completed editor, player/SDK and standalone outputs. Existing optional-provider-key, circular-chunk, mixed-import, unresolved runtime PNG and chunk-size warnings remain unsuppressed. No browser, server, remote fixture, commit, push, merge or full gate was created. This report and raw logs remain in ignored evidence output until staged by the owning delivery node; no benchmark or browser performance claim is made.
