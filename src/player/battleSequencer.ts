import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import {
  actorCommandDirectorState,
  commandPromptState,
  type BattleDirectorState,
  resultDirectorState,
} from "@/player/battleDirectorDom";

export const BATTLE_INTRO_MS = 1_200;
export const BATTLE_ACTING_MS = 550;
export const BATTLE_IMPACT_MS = 750;
export const BATTLE_RESOLVE_MS = 400;
export const BATTLE_RESULT_STAGE_MS = 450;
export const BATTLE_RESULT_HOLD_MS = 2_200;

export interface DamageFeedback {
  readonly targetId: string;
  readonly amount: number;
  readonly critical: boolean;
  readonly healing: boolean;
}

export type ScheduleFn = (callback: () => void, delayMs: number) => number;
export type ClearScheduleFn = (timerId: number) => void;

export interface BattleSequencerHooks {
  readonly onDirectorState: (state: BattleDirectorState) => void;
  readonly onSyncView: () => void;
  readonly onDamageFeedback: (feedback: DamageFeedback | undefined) => void;
  readonly onResultStage: (stage: number) => void;
  readonly onSequenceBusy: (busy: boolean) => void;
}

export interface BattleSequencer {
  readonly busy: boolean;
  startIntro(snapshot: BattleSnapshot): void;
  runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void;
  runAfterEnemyAdvance(before: BattleSnapshot, after: BattleSnapshot): void;
  cancel(): void;
}

function enemyActionAdvanced(before: BattleSnapshot, after: BattleSnapshot): boolean {
  const beforeResult = before.lastActionResult;
  const afterResult = after.lastActionResult;
  if (!afterResult) return false;
  if (!beforeResult) return true;
  return beforeResult.targetId !== afterResult.targetId
    || beforeResult.amount !== afterResult.amount
    || beforeResult.hit !== afterResult.hit
    || beforeResult.critical !== afterResult.critical
    || beforeResult.skillName !== afterResult.skillName
    || before.turn !== after.turn;
}

export function createBattleSequencer(
  runtime: BattleRuntime,
  hooks: BattleSequencerHooks,
  schedule: ScheduleFn = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearSchedule: ClearScheduleFn = (timerId) => window.clearTimeout(timerId)
): BattleSequencer {
  const timers = new Set<number>();
  let busy = false;

  function setBusy(next: boolean): void {
    busy = next;
    hooks.onSequenceBusy(next);
  }

  function trackTimer(timerId: number): void {
    timers.add(timerId);
  }

  function clearTimers(): void {
    for (const timerId of timers) clearSchedule(timerId);
    timers.clear();
  }

  function delay(callback: () => void, ms: number): void {
    trackTimer(schedule(callback, ms));
  }

  function damageFeedbackFromSnapshots(before: BattleSnapshot, after: BattleSnapshot, healingHint = false): DamageFeedback | undefined {
    const result = after.lastActionResult;
    if (!result?.targetId || result.amount === 0) return undefined;
    const target = after.enemies.find((enemy) => enemy.id === result.targetId)
      ?? after.actors.find((actor) => actor.id === result.targetId);
    if (!target) return undefined;
    const beforeTarget = before.enemies.find((entry) => entry.id === result.targetId)
      ?? before.actors.find((entry) => entry.id === result.targetId);
    const delta = beforeTarget ? beforeTarget.hp - target.hp : Math.abs(result.amount);
    const healing = healingHint || (beforeTarget ? target.hp > beforeTarget.hp : false);
    if (!healing && delta <= 0) return undefined;
    return {
      targetId: result.targetId,
      amount: healing ? Math.max(0, target.hp - (beforeTarget?.hp ?? target.hp)) : delta,
      critical: Boolean(result.critical),
      healing,
    };
  }

  function damageFeedback(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): DamageFeedback | undefined {
    return damageFeedbackFromSnapshots(
      before,
      after,
      command.kind === "skill" || command.kind === "item"
    );
  }

  function revealResult(snapshot: BattleSnapshot, previous: BattleDirectorState): void {
    const resultState = resultDirectorState(snapshot, previous);
    hooks.onDirectorState(resultState);
    hooks.onSyncView();
    const rewardCount = snapshot.result === "victory"
      ? 1 + (snapshot.rewards.items.length > 0 ? snapshot.rewards.items.length : 0) + (snapshot.rewards.levelUps?.length ?? 0)
      : 1;
    let stage = 0;
    const revealNext = (): void => {
      hooks.onResultStage(stage);
      hooks.onSyncView();
      stage += 1;
      if (stage <= rewardCount) delay(revealNext, BATTLE_RESULT_STAGE_MS);
    };
    revealNext();
  }

  function finishTurn(previous: BattleDirectorState): void {
    const snapshot = runtime.snapshot();
    if (snapshot.result) {
      revealResult(snapshot, previous);
      setBusy(false);
      return;
    }
    hooks.onDirectorState(commandPromptState(snapshot));
    hooks.onDamageFeedback(undefined);
    hooks.onSyncView();
    setBusy(false);
  }

  function resolveEnemyTurns(previous: BattleDirectorState): void {
    delay(() => {
      const before = runtime.snapshot();
      advanceBattleRuntime(runtime);
      const after = runtime.snapshot();
      const enemyAction = after.lastActionResult;
      if (enemyAction && enemyActionAdvanced(before, after)) {
        hooks.onDirectorState({
          step: "acting",
          lines: ["적의 행동!", enemyAction.skillName ?? "공격이 이어진다."],
          activeActorRecordId: undefined,
          targetId: enemyAction.targetId,
        });
        hooks.onDamageFeedback(damageFeedbackFromSnapshots(before, after));
        hooks.onSyncView();
        delay(() => finishTurn(previous), BATTLE_IMPACT_MS);
        return;
      }
      finishTurn(previous);
    }, BATTLE_RESOLVE_MS);
  }

  return {
    get busy() {
      return busy;
    },
    startIntro(snapshot: BattleSnapshot): void {
      clearTimers();
      hooks.onDirectorState({
        step: "command",
        lines: ["전투가 시작되었습니다.", "적이 나타났다!"],
        activeActorRecordId: snapshot.activeActorId,
      });
      hooks.onSyncView();
      delay(() => {
        hooks.onDirectorState(commandPromptState(snapshot));
        hooks.onSyncView();
      }, BATTLE_INTRO_MS);
    },
    runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void {
      clearTimers();
      setBusy(true);
      const actingState = actorCommandDirectorState(command, before, after);
      hooks.onDirectorState({ ...actingState, step: "acting", lines: [actingState.lines[0] ?? ""] });
      hooks.onSyncView();
      delay(() => {
        hooks.onDirectorState(actingState);
        hooks.onDamageFeedback(damageFeedback(command, before, after));
        hooks.onSyncView();
        delay(() => resolveEnemyTurns(actingState), BATTLE_IMPACT_MS);
      }, BATTLE_ACTING_MS);
    },
    runAfterEnemyAdvance(before: BattleSnapshot, after: BattleSnapshot): void {
      if (busy) return;
      if (!after.lastActionResult || after.lastActionResult === before.lastActionResult) return;
      setBusy(true);
      hooks.onDirectorState({
        step: "acting",
        lines: ["적의 행동!", after.lastActionResult.skillName ?? "공격이 이어진다."],
        targetId: after.lastActionResult.targetId,
      });
      hooks.onDamageFeedback(damageFeedbackFromSnapshots(before, after));
      hooks.onSyncView();
      delay(() => {
        const snapshot = runtime.snapshot();
        if (snapshot.result) {
          revealResult(snapshot, commandPromptState(snapshot));
          setBusy(false);
          return;
        }
        hooks.onDirectorState(commandPromptState(snapshot));
        hooks.onDamageFeedback(undefined);
        hooks.onSyncView();
        setBusy(false);
      }, BATTLE_IMPACT_MS);
    },
    cancel(): void {
      clearTimers();
      setBusy(false);
    },
  };
}