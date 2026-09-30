# Battle flow adversarial audit — 0e0db9b5818814e9f27400c8fb2b54b619d59e8d (v0.41.0)

Scope: battleDom/sequencer/command/result DOM, playBattle lifecycle, command/random/symbol entry and troop afterBattle. Read-only source review. No source/project edits, commits/stash, new Node/browser/server, tests/gates/typecheck execution. Only this report written. Read AGENTS, quickstart, INDEX, PROJECT_WIKI, runtime routing pointer/lifetime contracts, runtime-battle 09-30/09-28 result/afterBattle and sequential cancellation contracts. Root confirmed ai_conversations query had zero rows. Existing tests were read only. Mouse exclusion and rm2000 old-save compatibility are intentional contracts and excluded.

## 1. [P1] Capture commits to live session before cancellation boundary, while capture-item cost does not

Status: **confirmed-by-source**, requires supervisor runtime reproduction for screenshot/state evidence.

Primary location: `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/playSceneBattle.ts:175` (onMonsterCaptured callback, lines 175–187).

Supporting path:
- runtime capture succeeds, marks target captured/hidden and calls `options.onMonsterCaptured(capture)` immediately: `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:2396`.
- callback directly calls `giveMonster(project, session, ...)` while the animation/result UI is still active.
- `giveMonster` mutates live `session.monsterInstances`, `monsterParty` or `monsterBox`: `/home/main/.codex/worktrees/3852/rpg-zzu/src/project/monsterCollection.ts:230`.
- item costs and ordinary battle state stay on eventState until exit/reveal completes and `applyBattleRewardsToSession` runs. On teardown, abort resolves null, with no reward/state writeback or capture rollback (`playSceneBattle.ts:250` vicinity cleanup/abort; `battleRewardsToSession.ts:37`, `:211` inventory assignment).

Repro inputs/conditions: prepare one valid capturable species enemy and one capture item whose rate guarantees success (or deterministic seed). Enter real playBattle. Confirm capture. As soon as capturedMonsters is appended, before result acceptance/exit reveal, call the existing `destroyBattleSceneOnHost(host)` or cancel the same-session battle controller. Await result. Compare live inventory and monster ownership before/after.

Expected: cancelled result null leaves both ownership and capture item unchanged, per cancellation contract. Actual: ownership increases by one but original item remains (cost was only in abandoned runtime eventState). Also affects nonreturning defeat after a capture: ownership was already committed even though other battle mutations are intentionally not applied.

Coverage gap: `test/playSceneBattleCancellation.test.ts` checks entry/choice/session replacement/result teardown with variables; none checks capture/monster ownership. Capture tests exercise successful runtime capture, not cancellation transaction.

Fix suggestion: stage captures in battle-local state; grant only in the single post-reveal commit block together with corresponding eventState inventory. If immediate callback is needed for presentation, separate notification from mutation. Preserve persistent captured HP/states/IVs/PP and exact once semantics.

## 2. [P2] AUTO can act during a self/all-target skill input prompt, leaving a stale prompt attached to the next turn

Status: **confirmed-by-source** for AUTO advancing during prompt; exact delayed wrong-actor execution is **needs-runtime-repro** and depends on timing/which actors know the skill.

Primary location: `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleDom.ts:1127` (checkAutoBattleStep has no inputPrompt guard), with `:1309` (runActorCommand guards sequenceBusy only).

Causal path:
1. `beginTargetCommand` opens inputPrompt for scope self/allAllies/allEnemies before calling runtime.beginActorCommand (`battleDom.ts:1402`). Thus runtime remains phase actorCommand and sequenceBusy=false.
2. F handler precedes `if (inputPrompt)` in onKeydown (`:655` vs `:667`), toggles AUTO and calls syncView.
3. syncView calls checkAutoBattleStep (`:1124`), which chooses and commits an ordinary AUTO command, without consulting inputPrompt. The original prompt/timer stays live.
4. prompt completion clears inputPrompt and calls the original beginTargetCommand callback; no captured actor/turn/request check (`:1380`, `:1406`). It can send the old command to whatever actorCommand phase is now active (or silently discard it if sequenceBusy is true).

Minimal repro: strict battle with two actors and robust enemy HP. Actor A selects a self inputSequence skill `{keys:[up,down,confirm],timeLimitMs:10000}`. While prompt is visible press F. Observe phase/strictQueuedActorIds change without completing input; input overlay remains. Turn AUTO off, let command sequence finish, complete the old prompt after Actor B takes focus. If B knows the same skill, look for B executing A's pending skill. Even without later reattribution the original chosen input action was interrupted by AUTO unexpectedly.

Expected: prompt owns action/input until completion or explicit cancellation; AUTO enable takes effect after prompt settlement. Actual: action commits underneath the prompt and its stale callback survives.

Related Active ATB race: `tickInterval` (`:1513`) also never checks inputPrompt. While a prompt is open, enemies may start a sequence and the unscaled prompt timeLimit continues. Its completion calls `confirmTargetSelection`/`beginTargetCommand` whose sequenceBusy guard discards the action; prompt disappears without executing the user's technique. If active actor changes before self prompt callback, it can be reattributed. Treat as same missing prompt-lifetime ownership defect, not duplicate issue.

Coverage gap: `test/mgL4InputCharge.test.ts:85` and `:116` cover target prompt success/timeout in a quiet default battle. No AUTO, Active ATB, next-turn ownership or event interruption cases.

Fix suggestion: record actor/turn/request identity when opening the prompt and only submit to that identity. Gate AUTO actions and menu ticks while the prompt owns input, or implement explicit prompt cancellation on actor/phase change and defer its completion while enemy presentation plays. A UI boolean alone should not be the only lifetime guard.

## 3. [P2] retro2003 result screen keeps the old director message window above the reward summary

Status: **confirmed-by-source + visual evidence**. Parent-produced shipping screenshot was opened and independently inspected: `/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/retro2003/07-battle-result.png`. Root is collecting settled/computed geometry evidence. This is persistent CSS, not transient reward reveal.

Primary location: `/home/main/.codex/worktrees/3852/rpg-zzu/src/styles/runtime/battle-skins/_retro2003.css:177`.

Expected: result has summary/party/loot windows, and the battle director message window is hidden as in base result policy. Actual screenshot: old full-width blue “승리” strip overlays the top half of the new summary; yellow “승리!” and EXP/gold beneath are clipped/occluded.

Cause: retro skin uses `.battle-scene[data-battle-skin=retro2003][data-battle-ui-style=classic][data-battle-skin-family=glass][data-battle-layout=sideview] .battle-message-window { top:8px; height:40px; display:grid; ... }` unconditionally. Its specificity `(0,6,0)` beats base result hiding `(0,3,0)` in `/home/main/.codex/worktrees/3852/rpg-zzu/src/styles/runtime/battle/13-compact-victory-box.css:3`, and glass result hiding `(0,5,0)` in `/home/main/.codex/worktrees/3852/rpg-zzu/src/styles/runtime/battle-skins/_rm2000.css:1095`. The inherited message position absolute/z-index12 remains (`_rm2000.css:1087`, `:1091`). DOM deliberately continues to hold resultDirectorState lines (`battleDirectorDom.ts:247`), so there is no later timeout/removal that can cure the overlay. New pixel summary starts at top padded16 (`pixelWindows.css:33` and `:71`), directly underneath.

Repro: shipping player, battleUiStyle retro2003, pixel menu/result skin, win any battle. Wait >2 seconds after full result reveal; query computed style of message window and rectangle intersection with battle-result-summary. Confirm every reward row revealed; overlay remains.

Coverage gap: runtime scenario can pass if result/party/cards selectors exist and phase ends. This does not establish unobscured summary text. CSS/source surface tests do not evaluate specificity across skins. Parent baseline was 7/7 auto checks despite screenshot failure.

Fix suggestion: scope unconditional retro message display away from result, or add a retro result-specific hide selector with appropriate specificity. Assert computed display:none and zero message/result summary occlusion at settled result.

## 4. [P2] Active ATB skill menu caches a stale “partner not ready” state after allies become ready

Status: **confirmed-by-source**, supervisor runtime repro recommended.

Primary location: `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleDom.ts:1150` (command panel signature, lines 1150–1173).

Repro conditions: system.atbMode=active, gauge flow; A reaches actorCommand before B. Both know/participate in a combo skill `comboActorIds:[A,B]`. Open A's skill submenu while B.gauge<100; combo button correctly shows “연계 동료가 아직 준비되지 않았습니다.” Keep menu open until B.gauge reaches100 with no actor HP/MP, inventory, phase or active actor change (slow enemies make this deterministic). Observe combo button still has `data-battle-command-inert=true`; pressing confirm refuses. Close and reopen submenu: it becomes usable immediately.

Expected: availability updates as readiness changes in Active ATB. Actual: a now valid combo remains disabled until the user forces menu rebuild.

Causal path: `runtime.ts:874` tickDuringMenu deliberately charges `others` (`:877`, `:881`) and preserves active actor/menu. UI availability is evaluated when skill rows are created (`battleCommandDom.ts:534`, `:539`); comboParticipants uses actor.gauge>=100 (`battleSkillUse.ts:223`), and battleActorSkillFailure returns comboPartnerNotReady (`:203`). However commandPanel signature has only phase/active id/submenu/target/current actor mp/maxMp/skillIds/inventory/switch/strict ids; it omits ally gauge/hp/mp/stateIds, current stateIds/resource2/limit/skillCooldowns, partyGauge and class/battle command overrides. When signature matches, it skips commandPanel creation (`battleDom.ts:1170`). The fresh snapshot never updates inert attributes/reason text in existing rows.

Same omission also causes stale skill-enabled appearance if enemy applies silence during a menu, or limit gauge fills while menu stays open; runtime may correctly reject/allow but the button state/reason is stale. These are manifestations of one cache dependency bug.

Coverage gap: engine combo/gauge tests validate snapshot/readiness and battleActorSkillFailure, while command DOM tests build isolated snapshots. Need mounted real DOM + timed active menu ticks, avoiding direct button reconstruction between before/after.

Fix suggestion: make panel dependency key include all inputs to skill eligibility and menu commands, or update eligibility/details for existing buttons from each fresh snapshot. Avoid forcing whole DOM rebuild every200ms if only gauge is changing; rebuild when readiness/eligibility boundary changes.

## Lower-confidence observation to decide after main findings

`/home/main/.codex/worktrees/3852/rpg-zzu/src/player/playSceneFieldSpawns.ts:102` starts symbol battle with canLose:true, but immediately treats defeat as terminal gameOver (`:110`). Unlike random encounter canLose:false, this makes playBattle return path apply defeat event mutations/timer writes and restore field music/reveal bright field before applyBattleDefeat. Wiki explicitly says symbol defeats are game-over/no afterBattle. This is a bridge semantics inconsistency; record as separate P2 only after runtime evidence confirms user-visible field/music flash or undesired state writes. It is not needed to meet four primary findings.

## Reviewed paths without a finding

- Root/window WeakSet suppresses duplicate key handling after command DOM detaches.
- Target cancel restores originating submenu, not always root.
- Result confirm waits for director result phase, then reveals rewards and sequences level-up dialogs.
- Event pauses/choices drain sequencer facts before real dialogue and cancellation removes input hosts; no forced default option.
- commandBattle writes battleResult then runs troop afterBattle before original event result branch; returning defeat only when canLose.
- random and field paths lock scene.running through battle/afterBattle, avoiding duplicate encounters in the normal path.
- Scene/DOM teardown is idempotent and sequencer timers are scoped; capture is the transaction exception listed above.


## 감독자 최종 재현 판정

최종 기준은 `docs/2026-09-30-battle-adversarial-review.md`와 `rules-probe.json`, `interactions/interactions.json`이다. 2026-09-30 추가 상호작용 5개 모두 reproduced=true/errors0. combo 재실행도 ATB57→100 비활성 유지, 재개방 활성으로 확인됐다. 리뷰 원문의 source-only/needs-runtime-repro 표현은 해당 검토자가 작성한 시점의 범위이며, 후속 감독자 재현은 종합 보고서에 반영했다.
