# NPC Action Repeat Bugfix Proposal Evidence

Date: 2026-06-28 Asia/Seoul
Workspace: C:\Users\hyeon\Downloads\rpg-zzu

## Scenario / Success Criteria

Prevent repeated NPC action-trigger dialogue for the same target while the original action key is still held or repeated, even if event completion clears/unlocks runtime state. Preserve a fresh action press after key release so the same NPC can be talked to again without requiring player movement.

## Source Observables

- `src/player/playSceneMovement.ts:16` starts action handling when `input.actionPressed && !scene.moving`.
- `src/player/playSceneMovement.ts:79-83` suppresses a same-target action only while `scene.lastActionTargetKey` still equals the target tile key.
- `src/player/playSceneInterpreter.ts:56-59` currently clears `scene.lastActionTargetKey = ""` in `finally`, immediately before input is re-enabled.
- `src/player/input.ts:15-52` has `RuntimeKeyHoldTracker`, which already tracks held action keys internally but does not expose action-held state in `InputState`.
- `test/input.test.ts` exists and confirms one action edge per held key until keyup.

## Commands Run

### Existing input regression check

Invocation:

```powershell
npm.cmd test -- --run test/input.test.ts
```

Binary observable:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

### Strict typecheck baseline

Invocation:

```powershell
npm.cmd run typecheck
```

Binary observable:

```text
exit code 1
src/player/playSceneSchedulers.ts(249,26): error TS2345: Argument of type '{ kind: "inputNumber"; variableId: string; digits: number; settings: MessageWindowSettings; }' is not assignable to parameter of type 'never'.
```

This is outside the requested scope and was present before this proposed change.

## Failing-First Test To Add

File: `test/playSceneMovement.test.ts`

Scenario name: `it("does not restart the same action event after completion until the action key is released")`

Given:

- player at `(1, 1)`, facing down
- action-trigger NPC at `(1, 2)`
- input frame 1 returns `actionPressed: true, actionHeld: true`
- `runEvent` records the event id
- event completion is simulated by setting `scene.lastActionTargetKey = ""`, matching current `playSceneInterpreter.ts:58`
- input frame 2 returns another `actionPressed: true, actionHeld: true` before key release

When:

- `updatePlayScene(scene, 16)` runs for frame 1
- completion clears `lastActionTargetKey`
- `updatePlayScene(scene, 16)` runs for frame 2 while action is still held/repeated

Then:

- expected `runEvent` calls: `["npc-1"]`
- current code would produce `["npc-1", "npc-1"]`, so the test fails for the intended bug.

Companion fresh-press test:

Scenario name: `it("allows the same action event after the action key is released and pressed again")`

Given the same setup, after completion frame 2 returns `actionPressed: false, actionHeld: false`, then frame 3 returns `actionPressed: true, actionHeld: true`.

Then expected `runEvent` calls: `["npc-1", "npc-1"]`.

## Smallest Code Approach

1. Add `actionHeld: boolean` to `InputState` in `src/player/input.ts`.
2. Add `hasActionHeld(): boolean` to `RuntimeKeyHoldTracker` using `this.actionKeys.size > 0`.
3. Return `actionHeld: this.runtimeKeys.hasActionHeld()` from `Input.update()`, including the disabled-input branch so held state is still visible while dialogue disables input.
4. In `src/player/playSceneMovement.ts`, clear `scene.lastActionTargetKey` only when `!input.actionHeld`, before handling a new action press.
5. Remove `scene.lastActionTargetKey = ""` from `src/player/playSceneInterpreter.ts` finally block, so event completion alone cannot unlock the same held action.
6. Keep `tryStartMove()` clearing `lastActionTargetKey`, preserving current behavior that movement/facing-to-new-target resets action gating.

## Risks

- `PlaySceneContext` contract grows through `InputState`; all callers creating fake input state in tests must include `actionHeld`.
- Existing E2E test hook `injectActionEdge()` currently simulates a press-and-release, so it should continue to represent a fresh press; a held-action test would need direct keydown/keyup or a dedicated test-only hold helper.
- Typecheck cannot currently prove the final state until the unrelated `playSceneSchedulers.ts:249` baseline error is fixed or isolated.
