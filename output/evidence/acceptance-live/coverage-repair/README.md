# PR #691 coverage failure repair

Task: `st_01a07d56`; branch: `feat/ai-acceptance-live-qa`.
Production baseline: `18481eb1fcaa9e68f308fa4441fb737b6b49be74`.
The enclosing conventional repair commit contains the source, tests and evidence.

## Changed contracts

- R1: two declarations of `{mode:"modify",needsPlan:false,npcRewards:[{}]}`
  previously returned only the NPC-error placeholder, bypassing coverage. The
  adapter now assesses the original request within its existing shared deadline.
  Audit unavailability retains a separate mandatory unresolved coverage check,
  without dropping the NPC error. The existing canonical ledger is unchanged.
- R2: structural audit failure now returns explicit parser error status through
  `IntentDeclarationOutcome.error`, making it non-cacheable. The unresolved
  mandatory obligations are preserved. Valid model-declared unsupported checks
  are not structural failures and remain cacheable. The array-returning parser
  used by recorded-live replay is preserved as a projection of the same parser.
- No prompt changes, TTL changes, new ledger, withdrawal authority or content
  mutation. The routing-test audit fixture now quotes its actual input facts,
  rather than a fixed unrelated sentence when another request is under test.

## Deterministic red/green

`red.log` / `red.exit`: **exit 1; 6 failed, 25 passed** on baseline production.
Four R1 cases (ordinary/explicit resume, audit available/unavailable) reproduced
`verified` instead of `blocked` after NPC-only clarification. Malformed JSON and
empty audits returned the cached unresolved result instead of the valid immediate
recovery. Network retry and valid-unsupported caching controls already passed.

`red-boundaries.log` / `red-boundaries.exit`: **exit 1; 10 failed, 25 passed**,
still baseline production, adding missing requirements, unlinked quotes, invalid
criteria and invalid clarification cases. The unlinked case initially stopped at
an overly narrow one-placeholder assertion: quote-gap accounting correctly adds
a second unresolved check. The final test explicitly asserts both checks before
testing retry, rather than removing coverage or changing parser obligations.

R1 original request: `Make test_reward give two potions only once; do not add combat.`
Second request: `The NPC reward is two item_potion from test_reward, only once.`
The production session/parser/interpreter is used, with only model responses
scripted. The NPC requirement is genuinely refined and verified; the original
coverage obligation stays mandatory, failed and sourced to request-1, the same
ledger ID is retained, and the goal remains `incomplete` for both continuation
routes. First-turn audit transport failure is also exercised for both routes.

R2 immediately calls `declareIntentCached` with identical facts twice, then a
third time. The failed audit keeps unresolved criteria and an error; the second
call reaches valid recovery; the third caches that recovery. Declaration/audit
counts are exactly 2/2. Valid unsupported audit control remains 1/1 with no error.
No TTL sleeps, polling, retries-until-green or timing-based assertions were added.

## Verification

| Evidence | Result |
| --- | --- |
| `green.log`, `green.exit` | **184 tests / 17 files, exit 0**, serial isolated workers; 266.66 seconds |
| `typecheck.log`, `typecheck.exit` | `npm run typecheck:app`, **exit 0** |
| `build-app.log`, `build-app.exit` | `npm run build:app`, **exit 0**; Rollup import/chunk warnings retained |
| `public-smoke.log`, `public-smoke.exit`, `public-smoke.json` | Existing Firefox public-session/parser/interpreter smoke, **exit 0**, remote writes blocked |

LSP diagnostics returned no diagnostics on both changed production files and both
changed test files. One later diagnostics request timed out awaiting fresh results;
the same file subsequently returned no diagnostics. Application typecheck is the
direct compiler validation; no claim of full test-tree typecheck is made.

`interrupted.log` is **not** green evidence: the command tool killed the first
aggregate validation at its 240-second outer limit, after 16 suites had passed
and before the final UI lifecycle suite reported. No direct process exit code
was captured. The unchanged aggregate command then ran to completion under a
900-second command envelope. No Vitest test/hook timeout or assertion was weakened.

Exact commands (all executed in the named worktree):

```sh
# Red: baseline production plus the new tests; run once at each test expansion.
npm test -- test/requestCoverage.test.ts test/intentDeclarationClient.test.ts \
  --maxWorkers=1 --no-file-parallelism

# Green: retained 14-suite acceptance set plus request/outcome/retry lifecycles.
npm test -- test/requestCoverage.test.ts test/fakeDomInsertBefore.test.ts \
  test/functionalAcceptanceSession.test.ts test/functionalClarification.test.ts \
  test/intentDeclarationClient.test.ts test/functionalAcceptance.test.ts \
  test/functionalPersistenceProof.test.ts test/functionalScenePurchase.test.ts \
  test/functionalWalkSuspension.test.ts test/functionalInterpreterResume.test.ts \
  test/npcRewardSession.test.ts test/assistantAcceptanceSession.test.ts \
  test/assistantAcceptance.test.ts test/agentBlueprintTurnEnd.test.ts \
  test/assistantAcceptanceRequestBaseline.test.ts test/aiRunOutcomeLifecycle.test.ts \
  test/aiRetryWorkPlanLifecycle.test.ts --maxWorkers=1 --no-file-parallelism
npm run typecheck:app
npm run build:app
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9860 \
  output/evidence/acceptance-live/coverage-repair/public-smoke.json
```

Command output was redirected directly to each log, followed immediately by
`code=$?`, writing that code to the matching `.exit` and exiting with it. No
pipeline exit statuses are used. The tool-level interrupted attempt is explicitly
separate above.

## Boundaries and preserved evidence

No push, PR operation, merge, shared-main edit, remote content write, full-gate
workload or live-model authoring was performed. Only the parent's existing 9860
server was used for the read-only scripted smoke; 9841/9888 were not touched and
no server was started or stopped. The `.env.local` default port is not used.

The owned project `oprn-qa-functional-48c68b5f-2d4` and existing saved-project,
model-provenance and graphical-player evidence were not modified or regenerated.
The local canonical `handoff/project.json` still hashes to
`ce9695ca460f438ffa130798d8f887257de4eba1a792a50dc91fce2c7a3380c4`.
The pre-repair lead full build/reload and 3 functional checks / 16 scene steps /
8 graphical-player checkpoints remain prior evidence, not newly performed checks.
This repair does not claim complete semantic evaluation of quoted language or
durable ledger recovery. Final lead checks, complete baseline/candidate gate
comparison and reviewer approval remain pending.
