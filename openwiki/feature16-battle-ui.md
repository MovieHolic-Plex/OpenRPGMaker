# Battle reports, troop analysis and formation (2026-09-21)

## UI entry points

- Player Esc → 기록 → 전투 기록: newest completed battle first; Enter opens a report, ↑↓ reads every real log line in the detail description, Esc returns to the list. Empty history is explicit. Result, turns, EXP, money and item names remain usable after the battle scene is destroyed.
- Player Esc → 파티 → 진형: select an actor then another position to move them; select the final 전후열 변경 entry to toggle the selected actor's row. First N members enter combat; system `activeSlots` supplies N and the troop override takes precedence. Moving a reserve into these positions selects the active party. Monster-party mode explicitly directs the user to the existing monster menu and does not pretend actor rows affect monsters.
- Editor 자료집 → 적 그룹 → 배치 미리보기 → 행동 후보 · 약점 저작: select a party actor, front/back row, hypothetical turn and enemy MP %. Existing enemy actions are editable (skill/basic attack, priority, turn start/interval, add/remove), as are existing element rate grades. Edits go through `updateDatabaseRecord`, preserving other action fields and using the ordinary project save/undo pipeline. The selected enemy record is shared by every troop using it.

## Data and rules

`session.actorRows` already existed, including initialization near session.ts:539 and save-slot guards. It is reused, not duplicated. Missing rows mean front. The optional `session.battleReports` stores at most 20 reports with the latest 120 timeline entries per battle, 500 characters per line, and an explicit omitted-line count. Save snapshot creation, parsing and restoration normalize this field; legacy/invalid optional histories become empty. Names and results are captured at battle completion; later editor renaming does not rewrite history. No schema/version bump.

`playSceneBattle.onResult` appends once at the existing post-transition commit point, after rewards and before victory autosave. Cancelled/replaced scenes cannot append. Records come exclusively from the runtime's actual `timeline`, never guessed HP differences or canned messages. Defeat/escape do not claim victory rewards. No-action battles explicitly have no action log.

Formation is physical-only: ordinary attack and `effect: damage, statistic: attack`. Each back-row participant contributes ×0.75 (attacker outgoing, target incoming). Apply the product once to positive calculated damage, floor, minimum 1. Front/absent rows are unchanged. `mind` skills, healing, support, zero damage and negative absorption are unchanged. Raw attack/defense are unchanged, including equipment/class stat refreshes.

The authoring panel deliberately presents **eligible candidates**, not a guaranteed next AI action. Turn/resource checks use authored conditions and shared `battleSkillUseFailure`; damage uses shared prediction helpers. Actual AI also considers targets, utility and tied-choice RNG. Prediction is one hit without variance/crit/miss; it is not a multi-hit total. Element labels use actual authored multipliers, not a hardcoded assumption that A always means weakness. Gen1 uses species type effectiveness and explicitly explains that editing RM grades does not affect it. No prediction/intent clutter is added to the runtime HUD.

## Parent combat integration hooks

This worktree must not edit the combat agent's `runtime.ts`, `battleDamage.ts` or prediction implementation:

1. `runtime.ts` actor creation `actorBattlers(options.project, { ... })`: add `rows: options.party?.rows`. `playSceneBattle` already sends session rows. Fields are declared on `BattlePartyProgress` and `ActorBattlerOverrides`; actor creation/snapshot preserve `row`.
2. `battleDamage.ts` shared `applySkillLike`: after computed damage and before HP/MP subtraction call `formationDamage(amount, user.row, target.row, spec.statistic, spec.effect)` from `battleFormation.ts`. Apply once, including Gen1 dispatch if it shares the path.
3. Shared `battlePredict` applies the same helper once. `troopAuthoringPreview` consumes that result without applying a second multiplier.

`test/feature16BattleUiFormation.test.ts` includes integration assertions for these hooks; they intentionally require the combined parent change. UI/controller additions are small formation/report-only hooks; main detail modules are `playerFormationDetail.ts` and `playerBattleReportDetail.ts`.

## Parent-owned verification (not run by this worker)

```bash
npm test -- test/feature16BattleUiReports.test.ts test/feature16BattleUiFormation.test.ts test/feature16BattleUiAuthoring.test.ts
npm run qa:runtime -- --scenario feature16-battle-ui
AUDIT_BASE=http://127.0.0.1:<assigned-port>/ node scripts/capture-feature16-battle-ui.mjs
```

Runtime harness opens **player.html**. The small builder in `test/fixtures/feature16-battle-ui/runtime.mjs` patches an existing QA fixture, never writes remote content, and does not create reports. The scenario assigns a back row, moves a reserve to the front of the party, launches an actual event battle, wins it through keyboard input, then opens the resulting report. Read `verify-shots/runtime-qa/feature16-battle-ui/SUMMARY.md` first. Editor capture uses the real fresh-project editor, visible controls, record reopen, and wide/narrow viewport screenshots at `verify-shots/feature16-battle-ui-editor/`. No synthetic blank-page mounting. Screenshot evidence is pending parent execution.

### Fresh-project editor capture boot isolation

`capture-feature16-battle-ui.mjs` repeatedly dismisses the real `login-guest`,
`standard-welcome-start` and `coach-mark-skip` controls while opening the database,
with a 90-second deadline and a one-second overlay-free settling window. Native
click timeouts during transitions retry; other errors propagate. The disposable
freshProject browser context blocks service workers and cross-origin POSTs before
navigation, while allowing same-origin requests and external GET assets. The capture
summary records the blocked POST count. Parent owns browser execution.
