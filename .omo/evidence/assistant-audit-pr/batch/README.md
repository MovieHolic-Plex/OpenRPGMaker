# Batch dependency and completion verification

Base: c2ae0514 in the isolated `worktree-rapid-harbor-7ca6-audit-batch` tree.
The final patch was applied to main alongside the verified map/NPC changes.

## Behavior

- A rejected explicit spec defers both scoped spatial tools and normally spec-free tile writers on that map. Other maps and independent reads still execute.
- Batch completion is deferred while a failed write target lacks a successful correction. A rejected non-mutating retry does not erase a successful same-target witness from that batch.
- An omitted item ID can acknowledge a fully done plan without applying anything twice. Missing plans, explicit unknown IDs, skipped work, open acceptance, reward/adventure failures and outstanding verification cannot use that acknowledgement.

## RED and controls

The initial supervisor run of `assistantBatchCompletion.test.ts` had **3 failed / 2 passed**, before production changes:

1. Same-map `place_props` executed after a rejected spec instead of being deferred.
2. Premature completion returned an ordinary failure rather than an unexecuted dependency result.
3. Repeating completion after the plan was already done failed without an item ID.

Additional controls cover skipped items and open acceptance. A separate later-verification control initially had two fixture mistakes: it selected an automatic lint event, then used an extra field that lint permits. Those attempts are not valid RED evidence.

The corrected control uses the already-established invalid `reachability:false` argument and selects that exact explicit invocation. With the new outstanding-verification guard removed, the completion assertion at line 141 failed (`expected true to be false`). `guard-red-screen.txt` is the captured completed terminal screen for that proper RED; seven other cases were unselected by `-t`, not skipped in source.

The existing `assistantVerificationEvidence` test also exposed that failed writes must not invalidate an earlier valid same-target result. That unchanged assertion was restored by tracking successful batch targets, not by changing its expectation.

## GREEN

```sh
npm test -- test/assistantBatchCompletion.test.ts test/assistantDependencyRetry.test.ts test/assistantVerificationEvidence.test.ts test/assistantAcceptanceSession.test.ts --pool=threads --maxWorkers=2 --testTimeout=60000
npm run typecheck:app
```

**4 files / 51 tests passed, exit 0; app typecheck exit 0.**
`green-screen.txt` preserves the completed terminal result.

After integrating with the new map and NPC changes, the supervisor ran eleven related files:
**170 tests passed**, followed by the complete editor/player/standalone build with exit 0.
See `combined-verification.log`.

No production guard, immutable acceptance rule, failed assertion or test was suppressed.
The tests use actual sessions, tools, project changes and milestone application; only the model and external persistence boundary are deterministic fixtures.
