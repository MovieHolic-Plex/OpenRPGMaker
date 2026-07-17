import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot } from "@/battle/types";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import {
  planActionBeats,
  planEnemyActionBeats,
  type BattleActionBeat,
} from "@/player/battleActionBeats";
import {
  actorCommandDirectorState,
  battleResultRewardRowCount,
  commandPromptState,
  directorStateAfterTurn,
  enemyActionDirectorState,
  introDirectorState,
  type BattleDirectorState,
  resultDirectorState,
} from "@/player/battleDirectorDom";

export const BATTLE_INTRO_MS = 1_200;
export const BATTLE_ACTING_MS = 550;
/** Brief freeze on a damaging connect before impact UI continues. */
export const BATTLE_HITSTOP_MS = 120;
export const BATTLE_IMPACT_MS = 750;
export const BATTLE_RESOLVE_MS = 400;
export const BATTLE_RESULT_STAGE_MS = 450;
export const BATTLE_RESULT_HOLD_MS = 2_200;

export interface DamageFeedback {
  readonly targetId: string;
  readonly amount: number;
  readonly critical: boolean;
  readonly healing: boolean;
  readonly miss?: boolean;
}

export type ScheduleFn = (callback: () => void, delayMs: number) => number;
export type ClearScheduleFn = (timerId: number) => void;

export interface BattleSequencerHooks {
  readonly onDirectorState: (state: BattleDirectorState) => void;
  readonly onSyncView: () => void;
  readonly onDamageFeedback: (feedback: DamageFeedback | undefined) => void;
  /** True while the short hit-stop hold is active for a damaging hit. */
  readonly onHitFeel?: (active: boolean, feedback?: DamageFeedback) => void;
  /** Side-view lunge / knockback motion classes for the current beat. */
  readonly onActionMotion?: (beat: BattleActionBeat | undefined) => void;
  readonly onResultStage: (stage: number) => void;
  readonly onSequenceBusy: (busy: boolean) => void;
  /** 포획 시네마틱(구슬 투척·흔들림)을 재생하고 소요 ms를 반환. 미구현이면 0. */
  readonly onCaptureCinematic?: (targetId: string, success: boolean) => number;
}

export interface BattleSequencer {
  readonly busy: boolean;
  startIntro(snapshot: BattleSnapshot): void;
  runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void;
  runAfterEnemyAdvance(before: BattleSnapshot, after: BattleSnapshot): void;
  cancel(): void;
}

export function createBattleSequencer(
  runtime: BattleRuntime,
  hooks: BattleSequencerHooks,
  schedule: ScheduleFn = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearSchedule: ClearScheduleFn = (timerId) => window.clearTimeout(timerId)
): BattleSequencer {
  const timers = new Set<number>();
  let busy = false;
  // 행동 로그 소비 지점 — 이보다 뒤의 엔트리만 새 비트로 재생한다.
  let consumedActions = runtime.snapshot().actionLog.length;

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

  function clearMotion(): void {
    hooks.onActionMotion?.(undefined);
    hooks.onHitFeel?.(false);
  }

  function feedbackFromEntry(entry: BattleActionResultSnapshot): DamageFeedback | undefined {
    if (!entry.hit) return { targetId: entry.targetId, amount: 0, critical: false, healing: false, miss: true };
    if (entry.amount === 0) return undefined;
    if (entry.amount < 0) {
      return { targetId: entry.targetId, amount: Math.abs(entry.amount), critical: false, healing: true };
    }
    return { targetId: entry.targetId, amount: entry.amount, critical: entry.critical, healing: false };
  }

  function damageFeedback(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): DamageFeedback | undefined {
    const result = after.lastActionResult;
    if (!result?.targetId) return undefined;
    const target = after.enemies.find((enemy) => enemy.id === result.targetId)
      ?? after.actors.find((actor) => actor.id === result.targetId);
    if (!target) return undefined;
    const beforeTarget = before.enemies.find((entry) => entry.id === result.targetId)
      ?? before.actors.find((entry) => entry.id === result.targetId);
    const delta = beforeTarget ? beforeTarget.hp - target.hp : Math.abs(result.amount);
    const healing = command.kind === "skill" || command.kind === "item"
      ? (beforeTarget ? target.hp > beforeTarget.hp : false)
      : false;
    if (!result.hit) return { targetId: result.targetId, amount: 0, critical: false, healing: false, miss: true };
    if (!healing && delta <= 0) return undefined;
    return {
      targetId: result.targetId,
      amount: healing ? Math.max(0, target.hp - (beforeTarget?.hp ?? target.hp)) : delta,
      critical: Boolean(result.critical),
      healing,
    };
  }

  function actorUserId(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): string {
    const fromResult = after.lastActionResult?.userRecordId;
    if (fromResult) return fromResult;
    const active = before.activeActorId ?? after.activeActorId;
    if (active) return active;
    const first = before.actors.find((actor) => !actor.defeated) ?? after.actors[0];
    return first?.recordId ?? first?.id ?? "actor";
  }

  function revealResult(snapshot: BattleSnapshot, previous: BattleDirectorState): void {
    clearMotion();
    const resultState = resultDirectorState(snapshot, previous);
    hooks.onDirectorState(resultState);
    hooks.onSyncView();
    // 보상 행 수와 공개 스테이지 수를 동일한 소스로 계산한다(골드 행 미공개 버그 방지).
    const rewardCount = battleResultRewardRowCount(snapshot);
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
    clearMotion();
    const snapshot = runtime.snapshot();
    consumedActions = snapshot.actionLog.length;
    if (snapshot.result) {
      revealResult(snapshot, previous);
      setBusy(false);
      return;
    }
    hooks.onDirectorState(directorStateAfterTurn(snapshot, previous));
    hooks.onDamageFeedback(undefined);
    hooks.onSyncView();
    setBusy(false);
  }

  function applyBeat(beat: BattleActionBeat, directorBase?: BattleDirectorState): void {
    if (directorBase) {
      hooks.onDirectorState({ ...directorBase, step: beat.directorStep });
    }
    hooks.onActionMotion?.(beat);
    if (beat.feedback) hooks.onDamageFeedback(beat.feedback);
    if (beat.hitStop) hooks.onHitFeel?.(true, beat.feedback);
    else hooks.onHitFeel?.(false, beat.feedback);
    hooks.onSyncView();
  }

  /** Play a planned beat list in order, then call done. */
  function playBeats(
    beats: readonly BattleActionBeat[],
    directorBase: BattleDirectorState | undefined,
    done: () => void
  ): void {
    if (beats.length === 0) {
      clearMotion();
      done();
      return;
    }
    const [beat, ...rest] = beats;
    applyBeat(beat, directorBase);
    const advance = (): void => {
      if (beat.hitStop) hooks.onHitFeel?.(false, beat.feedback);
      playBeats(rest, directorBase, done);
    };
    if (beat.durationMs > 0) delay(advance, beat.durationMs);
    else advance();
  }

  /** 새 행동 로그 엔트리들을 하나씩 비트로 재생한 뒤 done을 호출한다. */
  function playActionEntries(
    entries: readonly BattleActionResultSnapshot[],
    snapshot: BattleSnapshot,
    done: () => void
  ): void {
    if (entries.length === 0) {
      done();
      return;
    }
    const [entry, ...rest] = entries;
    const feedback = feedbackFromEntry(entry);
    const directorBase = enemyActionDirectorState(entry, snapshot);
    const beats = planEnemyActionBeats({
      userId: entry.userRecordId,
      feedback,
      hitStopMs: BATTLE_HITSTOP_MS,
      impactMs: BATTLE_IMPACT_MS,
    });
    playBeats(beats, directorBase, () => {
      playActionEntries(rest, snapshot, done);
    });
  }

  function resolveEnemyTurns(previous: BattleDirectorState): void {
    delay(() => {
      advanceBattleRuntime(runtime);
      const after = runtime.snapshot();
      const entries = after.actionLog.slice(consumedActions);
      consumedActions = after.actionLog.length;
      playActionEntries(entries, after, () => finishTurn(previous));
    }, BATTLE_RESOLVE_MS);
  }

  return {
    get busy() {
      return busy;
    },
    startIntro(snapshot: BattleSnapshot): void {
      clearTimers();
      // 인트로 동안 게이지 틱이 배너를 덮지 않도록 시퀀스를 점유한다.
      setBusy(true);
      hooks.onDirectorState(introDirectorState(snapshot));
      hooks.onSyncView();
      delay(() => {
        hooks.onDirectorState(commandPromptState(snapshot));
        setBusy(false);
        hooks.onSyncView();
      }, BATTLE_INTRO_MS);
    },
    runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void {
      clearTimers();
      setBusy(true);
      // 플레이어 자신의 행동 엔트리는 아래 연출이 담당하므로 로그에서 소비 처리.
      consumedActions = after.actionLog.length;
      const actingState = actorCommandDirectorState(command, before, after);
      const feedback = damageFeedback(command, before, after);
      const userId = actorUserId(command, before, after);

      // 포획은 구슬 시네마틱이 먼저 재생된 뒤 결과 텍스트/임팩트로 이어진다.
      const cinematicMs = command.kind === "capture"
        ? hooks.onCaptureCinematic?.(command.targetEnemyId, after.lastCaptureResult?.success === true) ?? 0
        : 0;

      const beats = planActionBeats({
        userId,
        targetId: feedback?.targetId
          ?? (command.kind === "attack" || command.kind === "capture" ? command.targetEnemyId : undefined),
        feedback,
        actingMs: Math.max(BATTLE_ACTING_MS, cinematicMs),
        hitStopMs: BATTLE_HITSTOP_MS,
        impactMs: BATTLE_IMPACT_MS,
      });

      // First beat stamps acting immediately (matches prior test: steps[0] === "acting").
      playBeats(beats, actingState, () => {
        clearMotion();
        hooks.onDamageFeedback(undefined);
        // 막타로 전투가 끝났으면 적 턴 비트를 건너뛰고 곧바로 결과·보상 공개로 넘어간다.
        if (runtime.snapshot().result) {
          finishTurn(actingState);
        } else {
          resolveEnemyTurns(actingState);
        }
      });
    },
    runAfterEnemyAdvance(_before: BattleSnapshot, after: BattleSnapshot): void {
      if (busy) return;
      const entries = after.actionLog.slice(consumedActions);
      if (entries.length === 0) return;
      consumedActions = after.actionLog.length;
      setBusy(true);
      playActionEntries(entries, after, () => {
        clearMotion();
        const snapshot = runtime.snapshot();
        consumedActions = snapshot.actionLog.length;
        if (snapshot.result) {
          revealResult(snapshot, commandPromptState(snapshot));
          setBusy(false);
          return;
        }
        hooks.onDirectorState(directorStateAfterTurn(snapshot, commandPromptState(snapshot)));
        hooks.onDamageFeedback(undefined);
        hooks.onSyncView();
        setBusy(false);
      });
    },
    cancel(): void {
      clearTimers();
      clearMotion();
      setBusy(false);
    },
  };
}
