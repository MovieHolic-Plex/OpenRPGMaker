# Request-bound functional acceptance verification

Base: `f22d64f7c`; branch: `feat/ai-functional-acceptance`.
Scope: engine/harness code, minimal test fixtures, public-API smoke and focused documentation. No demo/world/Supabase content authoring.

## Result

- Live intent declaration creates immutable required purchase/travel obligations; existing NPC reward declarations enter the same acceptance ledger.
- Production shop transactions prove exact gold and inventory deltas, including repeated transactions in single-quantity shops.
- Round trips use both authored transfers and walking in one interpreter session, including a return page gated by outgoing state.
- NPC rewards prove requested first grants and zero additional item/equipment, monster and gold rewards on a second same-session interaction.
- Replan, skip and repair cannot weaken accepted criteria. Unapplied drafts and changed current content cannot retain completion.
- Accepted-revision proof reruns functional criteria on the matching canonical reload through the existing store proof path.
- Parent-confirmed baseline failure in `npcRewardSession` (replanning into an unrelated skipped plan) is now passing.

## TDD evidence

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
