# Request-bound functional acceptance verification

Base: `f22d64f7c`; branch: `feat/ai-functional-acceptance`.
Scope: engine/harness code, minimal test fixtures, public-API smoke and focused documentation. No demo/world/LegacyDb content authoring.

## Result

- Live intent declaration creates immutable required purchase/travel obligations; existing NPC reward declarations enter the same acceptance ledger.
- Production shop transactions prove exact gold and inventory deltas, including repeated transactions in single-quantity shops.
- Round trips use both authored transfers and walking in one interpreter session, including a return page gated by outgoing state.
- NPC rewards prove requested first grants and zero additional item/equipment, monster and gold rewards on a second same-session interaction.
- Replan, skip and repair cannot weaken accepted criteria. Unapplied drafts and changed current content cannot retain completion.
- Accepted-revision proof reruns functional criteria on the matching canonical reload through the existing store proof path.
- Parent-confirmed baseline failure in `npcRewardSession` (replanning into an unrelated skipped plan) is now passing.

## Rereview P2: consumed hold ownership (after 9d7ba7fab)

Production changes are limited to the purchase, choice and animation resume paths
in `sceneTestRunner.ts`. Each captures the interpreter/event owner locally and
clears the consumed `state.held` before invoking `resume`. A resumed continuation
can transfer into a non-suspending autorun, or suspend again under its original
owner. The existing nested-owner guard and corridor rejection are unchanged.
No R2 clarification behavior was changed.

Regression coverage includes the exact purchase -> transfer -> variable initializer
path, plain-transfer control, all three resume modes, a second suspension, and
rejected replacement of a newly held nested interpreter. The initializer uses the
persisted M2 Erase Event command, and tests assert that it actually erased itself.
Animation completion uses authored-duration-derived engine ticks, not a wall-clock
sleep or polling.

Evidence under `output/evidence/functional-acceptance/`:

- `resume-red.log`: 7 initial failures; purchase/choice/animation transfer and ledger acceptance reproduced the stale consumed-hold bug.
- `resume-focused-integration.log`: 3 remaining test-fixture failures after the production fix. The test incorrectly put a second pause after transfer; `interpreter/resume.ts` intentionally ends an event at transfer. The second pause was moved before transfer, with stronger exact gold/inventory/initializer assertions.
- `resume-test-types-red.log`: direct test typechecking caught the fixture's runtime-step spelling `eraseEvent`; it was replaced with the valid persisted M2 command. The diagnostic invocation was also aligned with the app command's `noEmit` option.
- `resume-final-green.log`: **143 tests / 11 files passed**, exit 0, in one final thread-worker run.
- `resume-typecheck.log`: `npm run typecheck:app`, exit 0.
- `resume-test-types.log`: app sources plus the new regression and its imported fixture, using TypeScript with the app options and `noEmit:true`: **0 diagnostics**. This replaced timed-out fresh LSP diagnostics for the new test; no errors were suppressed.
- `resume-final-smoke.log` / `resume-final-smoke.json`: public Firefox smoke passed, including the resumed purchase ending on `test_interior` with **80 gold, 2 potions, var_0001=1**, while the forced corridor remains blocked.

Exact final focused command:

```bash
npm test -- \
  test/functionalInterpreterResume.test.ts test/functionalWalkSuspension.test.ts \
  test/functionalClarification.test.ts test/functionalAcceptance.test.ts \
  test/functionalScenePurchase.test.ts test/functionalAcceptanceSession.test.ts \
  test/functionalPersistenceProof.test.ts test/sceneTestRunner.test.ts \
  test/sceneVerificationRepair.test.ts test/npcRewardAcceptance.test.ts \
  test/npcRewardSession.test.ts --pool=threads --maxWorkers=1 --reporter=dot
npm run typecheck:app
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9842 output/evidence/functional-acceptance/resume-final-smoke.json
npm run openwiki:index
node scripts/openwiki-index.mjs --check
git diff --check
```

Independent lead gates/build and ultrabrain rereview remain required for this
revision. No push, PR edit or merge was performed.

## Review repair R1/R2 (after 0977da78c)

R1: each individual tile movement refuses to advance while an interpreter is held.
Starting another event cannot replace that interpreter; nested autorun suspension
that cannot preserve the outer continuation fails closed. Regression tests force
all travel through a touch shop followed by game-over, compare split/unsplit
walks, and verify the shop continuation both through a real purchase and through
the production interpreter's cancel result.

R2: `functionalRefinements` is a trusted user-declaration field, not a worker tool.
The declarer receives the original unresolved requirement/source, typed known
expectations and prior user clarification sources. Host refinement keeps the
original ID/source/baseline, retains omitted known fields, rejects conflicting
values without an explicit user correction, and appends source metadata. Partial
clarification remains blocked; a concrete contract becomes immutable again.
Genuine user host-resume works; worker repair/replan and unlinked refinement do not.

Repair evidence under `output/evidence/functional-acceptance/`:

- `r1-red.log`: 2 reproduced failures (false-positive corridor and unsplit walk).
- `r1-green-r2-red.log`: R1 green; 4 R2 failures reproduced through public session/declaration APIs.
- `r2-resume-red.log`: genuine host-resume clarification reproduced as blocked.
- `repair-focused-final.log`: **275 tests / 18 files passed**, exit 0, one thread-worker run.
- `repair-typecheck.log`: `npm run typecheck:app`, exit 0.
- `repair-public-smoke.log` / `repair-public-smoke.json`: Firefox public-API smoke passed on 9842, including forced corridor, split/unsplit equivalence and three-message clarification with rejected worker repair.
- All changed source/test files and the smoke script: LSP diagnostics returned no errors.

Exact repair validation commands:

```bash
npm test -- \
  test/functionalAcceptance.test.ts test/functionalScenePurchase.test.ts \
  test/functionalAcceptanceSession.test.ts test/functionalPersistenceProof.test.ts \
  test/functionalWalkSuspension.test.ts test/functionalClarification.test.ts \
  test/npcRewardSession.test.ts test/npcRewardAcceptance.test.ts \
  test/sceneTestRunner.test.ts test/workItemOutcome.test.ts \
  test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts \
  test/intentDeclaration.test.ts test/intentDeclarationClient.test.ts \
  test/aiRunEndProof.test.ts test/shopMerchantGold.test.ts \
  test/shopRuntimeUx.test.ts test/sceneVerificationRepair.test.ts \
  --pool=threads --maxWorkers=1 --reporter=dot
npm run typecheck:app
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9842 output/evidence/functional-acceptance/repair-public-smoke.json
npm run openwiki:index
node scripts/openwiki-index.mjs --check
git diff --check
```

The original implementation checks below did not cover R1/R2; they are historical
baseline evidence, not substitutes for these new regressions. Independent full
gates/build and ultrabrain rereview remain required. No push, PR edit or merge
was performed during this repair.

## Original implementation TDD evidence

Untracked detailed logs are retained in this worktree under `output/evidence/functional-acceptance/`:

| Log | Observed result |
| --- | --- |
| `shop-red.log` | 8 failures: unsupported purchase input; opening a shop incorrectly counted as complete |
| `criteria-red-shop-green.log` | New criterion evaluator red; public purchase suite green |
| `session-red.log` | 4 failures: live declaration obligations absent; ordinary request unaffected |
| `persistence-red.log` | 2 failures: no canonical functional rerun; earlier acceptance certified newer broken content |
| `boundary-red.log` | 2 failures: nested worker flags accepted; blocked actual start accepted |
| `single-shop-red.log` | Requested total incorrectly rejected in single-quantity shop |
| `draft-proof-red.log` | Manual proof could succeed while a newer draft remained unapplied |
| `focused-thread.log` | Final clean run: 16 files, 264 tests passed, exit 0 |
| `typecheck-final.log` | App typecheck exit 0 |
| `tool-catalog.log` | 4 tests passed; generated catalog updated |
| `public-smoke-firefox.log`, `public-smoke.json` | Final public API smoke exit 0, all three behaviors and hostile cases verified |

Exact final test command (no relaxed timeouts, skipped assertions or ignored errors):

```bash
npm test -- \
  test/functionalAcceptance.test.ts test/functionalScenePurchase.test.ts \
  test/functionalAcceptanceSession.test.ts test/functionalPersistenceProof.test.ts \
  test/npcRewardSession.test.ts test/npcRewardAcceptance.test.ts \
  test/sceneTestRunner.test.ts test/workItemOutcome.test.ts \
  test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts \
  test/intentDeclaration.test.ts test/intentDeclarationClient.test.ts \
  test/aiRunEndProof.test.ts test/shopMerchantGold.test.ts \
  test/shopRuntimeUx.test.ts test/sceneVerificationRepair.test.ts \
  --pool=threads --maxWorkers=1 --reporter=dot
npm run typecheck:app
UPDATE_CATALOG=1 npm test -- test/toolCatalog.test.ts --maxWorkers=1
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9842
npm run openwiki:index
node scripts/openwiki-index.mjs --check
git diff --check
```

All changed TypeScript files and the smoke script were checked with LSP diagnostics: no errors.

Two broader fork-worker attempts completed 264 assertions but exited 1 with an unhandled Vitest `Timeout calling "onTaskUpdate"`; those are NOT counted as green (`focused-final.log`, `focused-serial.log`). The unchanged suite passed in one thread-worker run. A direct catalog-generator attempt timed out; the repository's configured npm test wrapper generated and validated it successfully.

## Public smoke and environment

The executable script defaults to port **9841**. During this task, that port was already owned by PID 2252417 running shared main (`/home/main/z-project/rpg-zzu`). That process was not modified. Verification used the isolated feature worktree on **9842** instead.

The smoke uses Playwright Firefox. Chromium failed module loads with `net::ERR_NETWORK_CHANGED` while the host had multiple `NO-CARRIER` Docker bridges, matching the existing OpenWiki diagnosis. Firefox completed the same public-API checks without retries or fixed delays. Install Firefox with `npx playwright install firefox` if needed.

The smoke scripts only the external model response boundary, passes it through the actual intent parser, calls public session/runtime APIs, blocks external requests and all network writes, and checks the engine verdicts rather than model prose. The successful transaction ended at **80 gold / 2 potions**. It does not claim live-model semantic extraction, graphical-player QA or an authored remote project.

## Remaining boundaries

- Purchase/travel checks start at the declared actual project entry, not an arbitrary local teleport. Ordinary player-buy shops and action/touch transfers are supported. Shopkeeper/haggle/services, ambiguous triggers and unresolved prerequisites remain unverified.
- NPC item/collected-monster reward checks are local interaction proof, not world-path or quest-prerequisite proof.
- Natural-language coverage still depends on the declarer model; immutable engine checks enforce the extracted expectations.
- Full repository gates/build and independent player QA are owned by the lead, as requested. No PR, push or merge was performed.
