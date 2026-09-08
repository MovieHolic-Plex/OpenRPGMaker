# P1 failed-selection ownership handoff

- Task: `st_01a07c12`.
- Exact base: `bb0ca961498e872276292ed0139d11b216c9b7aa`.
- Branch: `fix/p1-selection-ownership-st_01a07c12` in `/home/main/z-project/rpg-zzu-ai-interior-load-consistency-0907`.
- Previous clean branch `fix/cr3-cr4-atomic-st_01a07bd3` remains at `0ecbcc025c519a788cf772a82f2752898121aaad`; its evidence was not removed.
- The delivered head is the single commit containing this handoff. No parent integration or P1 authorization is implied.

## Change and ownership

The runner now captures optional `failedSelection:{stepIndex,mapId,eventId}` before explicit interaction selection, and clears it when the intended action event is selected. It survives front/underfoot mismatches, both farm-target positions, explicitly missing targets, and the game-over/current-map guards. Executed `interactions` are unchanged. The registered `run_scene_test` tool forwards the field. `sceneTargets()` consumes it for the existing finding identity and compatible-discharge checks, retaining the older structured no-target fallback. No prose parsing, navigation identity changes, invalid-probe broadening, or ledger hotpatch is involved.

The focused wiki documents the public receipt. `openwiki/INDEX.md` is intentionally unchanged for parent regeneration. Farm execution semantics are unchanged: the existing farm operation can run before its mismatch return; this fix records the failed NPC intent, not a fictional executed NPC.

## Red, green, and protected coverage

All Vitest commands used `--maxWorkers=1 --minWorkers=1`.

| Execution | Result |
| --- | --- |
| New `test/verificationSelectionOwnership.test.ts` against exact base, before source edits | 15 failed / 9 passed; reproduced false `verified` through both session APIs and collapse of two negatives |
| First new-plus-protected command, 17 files | 519 passed / 1 failed: all 496 original protected cases passed; one new missing-map expectation was incorrect |
| Corrected new file plus complete `aiAssistantSession.test.ts` | 80 passed / 7 pre-existing failures; new 24/24 passed |
| Final isolated new-file command | 24/24 passed, exit 0 |
| `npm run typecheck:app` | exit 0 |
| LSP, three changed source files, new test, standalone proof script | no diagnostics |
| Markdown diagnostics | no Markdown LSP configured; `git diff --check` passed |
| `bun .omo/evidence/p1-selection-st_01a07c12/session-proof.ts` | exit 0; six normal-session sequences, zero network calls |

The missing-map test correction does not suppress a product failure: the real selected event's transfer to a missing map stops at its autorun boundary in step 2, before the next interaction in step 3. The test now asserts step 2, the actual executed NPC receipt, and absence of failed selection. `missing-map-boundary.json` preserves the direct registered-runner observation. Capture still precedes the current-map guard in `runInteractStep`; that guard was not forced via private state.

The unchanged seven session failures remain at lines `1279,1408,1463,1508,1563,1611,1876`: three `error`/`final` disagreements, two final-text mismatches, one phase-sequence mismatch, and one missing terminal audit. These match the prior review's baseline, not new regression failures. The full session test file is byte-identical to bb0 (SHA256 `2798c97c3a227e171f518c2a729b35405b7c456d58b4c84a37025a06cd35ba99`). Full-suite green is not claimed.

Protected 16-file command: `test/{verificationFindingOwnership,verificationPlanAtomicity,verificationNativeScopes,verificationRouteDeclaration,walkthroughVerificationInput,assistantVerificationEvidence,assistantVerificationContinuation,sceneVerificationRepair,sceneTestRunner,agentVerification,assistantAcceptance,workPlan,npcGoldReward,reachabilityArguments,actionAcceptanceRequirements,actionAcceptanceProof}.test.ts`.

- Original contracts 1/6/7/11/13/14: new real-runner and normal-session selection tests plus existing findings/verification tests.
- Contracts 2/3/4 and all four previous fixes: unchanged route/native/walkthrough coverage and all 108 tool/planner atomic-adoption cases passed.
- Contracts 5/8/9/10/12: unchanged continuation/evidence/scene-repair suites and complete session execution; wire180->181, corrected171, frozen targets/assertions/state/choices/navigation, invalid correction IDs, dummy ownership, and write invalidation remain protected.
- New coverage: front, underfoot, farm-front, farm-underfoot and no-target; same-map deduplication, A/B distinct negatives, A-only repair retaining B; legitimate same-map facing repairs; selected execution failure versus selection failure; game-over early return; unowned no-target control.

## Real surface proof

`session-proof.ts` uses the real `crossMapVerification()` fixture, registered tools, `AssistantSession.sendUserMessage()`, and public `syncBaselineFromStoreIfClean()`. Only chat/intent responses are scripted. It separately executes ordinary rerun and `correct_verification` versions of foreign B pass, two negatives then A-only repair, and the no-target control. Genuine independent adopted proof is passed, so an unrelated pending check cannot conceal the bug. Foreign B pass leaves A blocked/in_progress; A-only repair leaves B blocked/in_progress; repairing every failed map permits verified/done. Fresh original-map probes confirm unresolved negatives. No private ledger modification occurs. `session-proof-summary.json` contains the observed checkpoints and structured receipts.

## Evidence and limits

Raw logs are preserved locally beside this handoff (not all are committed):

| Path | SHA256 |
| --- | --- |
| `red.txt` | `2f94e01643089d98f3c4ced2846721ed69418b73e2265777d39e3190e0054185` |
| `green-protected.txt` | `b113a748ad6ce3f1a5996bc83e2aecc3d8e92f2233f8c6ba26aba05e358b930b` |
| `green-session-baseline.txt` | `0e44dbbfd0c0f3f3519ab59185db263481997f6663c7694363fff89e1491ab2c` |
| `green-focused.txt` | `45a8f31818e4533fac869802ddf38da399eb3af6e9fea373de8395ae58d5fcbd` |
| `session-proof.json` | `b31ca6324a97317b26d66f8f43dfbcfe450b72fbdfade28d1aa13779df062c1c` |
| `typecheck-app.txt` | `9e2e881b46f10347e10261b098fd6171273d8f45b9a5d52fc81a8473a713bdfe` |

No child full build or gates were run: parent owns combined build/gates. No parent/gold/live UI/DB/model/network edits, new game, push, or PR. Parent HEAD was checked and remained exact bb0; Round12 prepare was not changed. This is offline source verification, not player/visual/persistence/new-project AI-generation proof or approval to proceed with P1.
