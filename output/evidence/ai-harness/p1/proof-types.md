# P1 proof-state type refinement

Task: st_01a0768b. Date: 2026-09-06.
Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`.
Baseline HEAD: `9cb25c5d`.

## Scope and implementation

Only `src/ai/assistantSession.ts` proof projection/emission/return sites and
`test/aiRunEndProof.test.ts` characterization assertions changed, plus this evidence.
Read the P1 phase contract and approved plan's accepted-revision requirements.
No persistence, completion, approval, retry, cancellation, or apply-metadata policy changed.

- Extracted the existing freshness calculation into the non-null
  `projectRunEndProof(state: RunEndProofState): RunEndProofState` method.
- Kept `getRunEndProof(): RunEndProofState | null` and its initial null result.
- Moved state assignment from the emission helper to its four call sites, before
  emission, so TypeScript sees the established non-null state. Assignment and
  callback ordering are unchanged; the emitter projects its non-null argument.
- The success return projects `this.runEndProof` after subscribers, not the
  earlier local success object. This preserves both freshness after a subscriber
  edits the store and the latest emitted state when a subscriber synchronously
  starts another proof. No fallback, cast, assertion, or suppression is needed.
- The existing failure return, retry/dedup guards, post-read/post-event checks,
  audit ordering, and actual apply metadata correlation remain unchanged.

## Characterization before product edits

Existing tests already exercised failed reads, same-receipt retry, successful
proof deduplication, changed revisions, cancelled/disabled/mismatched/stale reads,
no editor replacement, real apply commit metadata, failed commit logging,
no-plan apply, edits during commit, recovered LLM failure, and missing receipts.

Added four characterization cases before modifying production source:

1. Initial getter/snapshot null; initialized attempted/succeeded events match
   the getter; a final status subscriber's local edit makes the returned proof
   and getter/snapshot `succeeded` with `verified:false`.
2. A synchronous success-proof subscriber edit yields `failed/stale`, no saved audit.
3. A synchronous success-proof subscriber cancellation yields `failed/cancelled`,
   no saved audit.
4. A final status subscriber starting a cancelled proof makes the outer return
   reflect that latest emitted failed state rather than its old success object.

These tests use real session/store paths with fixture HTTP transport. They assert
machine-consumed state, not status prose. New cases use synchronous callbacks
and awaited proof promises, with no sleeps, polling, or timer advancement.

## Verification results

All commands ran in the scoped worktree. No full gates, build, browser, or remote
QA was run for this nonbehavioral refinement; phase-wide acceptance remains
supervisor-owned. The focused tests execute the affected public session entry
points, including autonomous completion and explicit proof/retry.

| Check | Result |
| --- | --- |
| Before production edit: `npm test -- test/aiRunEndProof.test.ts` | Exit 0; 1 file, 18/18 tests; 113.28 s total |
| After production edit: `npm test -- test/aiRunEndProof.test.ts` | Exit 0; 1 file, 18/18 tests; 99.26 s total |
| LSP diagnostics, `src/ai/assistantSession.ts`, all severities | No diagnostics found |
| LSP diagnostics, `test/aiRunEndProof.test.ts`, all severities | No diagnostics found |
| `npm run typecheck:app` | Exit 0; `tsc --noEmit -p tsconfig.app.json` |
| `git diff --check` | Exit 0 |
| TypeScript AST assertion comparison against baseline HEAD | Exit 0; exactly the two `this.getRunEndProof()!` expressions removed, no assertions/casts added |
| Added production-line type/lint suppression scan | No additions |

The AST comparison parsed baseline and current `assistantSession.ts` with the
installed TypeScript API, collected `NonNullExpression`, `AsExpression`, and
`TypeAssertionExpression` node texts, and compared them as multisets. It also
checked that `getRunEndProof()!` no longer appears and scanned added production
lines for `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, and `eslint-disable`.
Actual output:

```json
{
  "addedAssertions": [],
  "removedAssertions": [
    "this.getRunEndProof()!",
    "this.getRunEndProof()!"
  ],
  "addedSuppressions": []
}
```

No new `as any`, `as unknown`, non-null assertion, type assertion, type/lint
suppression, or null fallback hides an impossible initialized proof state.
Unrelated pre-existing assertions were left untouched.
