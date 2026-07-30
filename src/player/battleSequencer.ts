import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
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
  /** Called once for each newly appended runtime timeline entry, in order. */
  readonly onTimelineEntry?: (entry: BattleTimelineEntrySnapshot) => void;
  /** 포획 시네마틱(구슬 투척·흔들림)을 재생하고 소요 ms를 반환. 미구현이면 0. */
  readonly onCaptureCinematic?: (targetId: string, success: boolean) => number;
}

export interface BattleSequencer {
  readonly busy: boolean;
  speedMultiplier: number;
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
  let speedMultiplier = 1.0;
  // Ordered timeline cursor. A sequencer is created with its runtime, so facts
  // appended during strict-round setup remain pending for the first sequence.
  let consumedTimeline = 0;

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
    const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scaledMs = reduced ? 10 : Math.max(10, Math.round(ms / Math.max(0.2, speedMultiplier)));
    trackTimer(schedule(callback, scaledMs));
  }

  function clearMotion(): void {
    hooks.onActionMotion?.(undefined);
    hooks.onHitFeel?.(false);
  }

  function feedbackFromTimeline(entry: BattleTimelineEntrySnapshot): DamageFeedback | undefined {
    if (!entry.targetId) return undefined;
    if (entry.kind === "miss" || entry.hit === false) {
      return { targetId: entry.targetId, amount: 0, critical: false, healing: false, miss: true };
    }
    const amount = Math.abs(entry.amount ?? 0);
    if (amount === 0) return undefined;
    return {
      targetId: entry.targetId,
      amount,
      critical: Boolean(entry.critical),
      healing: entry.kind === "healing" || (entry.amount ?? 0) < 0,
    };
  }

  function resultFromTimeline(entry: BattleTimelineEntrySnapshot): BattleActionResultSnapshot | undefined {
    if (!entry.targetId || !entry.userRecordId) return undefined;
    return {
      userRecordId: entry.userRecordId,
      targetId: entry.targetId,
      hit: entry.hit !== false,
      amount: entry.amount ?? 0,
      critical: Boolean(entry.critical),
      skillName: entry.skillName,
    };
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
    consumedTimeline = snapshot.timeline.length;
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
    // Feedback belongs to exactly one beat. Explicitly clear it on approach/recover
    // before syncing, otherwise battleDom reuses the prior impact feedback and
    // appends the same damage popup again on the recover frame.
    hooks.onDamageFeedback(beat.feedback);
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

  function playTimelineEntries(
    entries: readonly BattleTimelineEntrySnapshot[],
    snapshot: BattleSnapshot,
    done: () => void,
    firstDirector?: BattleDirectorState,
  ): void {
    if (entries.length === 0) {
      done();
      return;
    }
    const [entry, ...rest] = entries;
    hooks.onTimelineEntry?.(entry);
    const resultEntry = resultFromTimeline(entry);
    const directorBase = firstDirector
      ?? (resultEntry ? enemyActionDirectorState(resultEntry, snapshot) : timelineDirectorState(entry));
    const feedback = feedbackFromTimeline(entry);
    const visual = entry.kind === "damage" || entry.kind === "healing" || entry.kind === "miss"
      || entry.kind === "action" || entry.kind === "capture" || entry.kind === "stateUpkeep";
    if (!visual) {
      hooks.onDirectorState(directorBase);
      hooks.onSyncView();
      playTimelineEntries(rest, snapshot, done);
      return;
    }
    const cinematicMs = entry.kind === "capture" && entry.targetId
      ? hooks.onCaptureCinematic?.(entry.targetId, entry.success === true) ?? 0
      : 0;
    const beats = entry.side === "enemy"
      ? planEnemyActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "enemy",
          feedback,
          hitStopMs: BATTLE_HITSTOP_MS,
          impactMs: BATTLE_IMPACT_MS,
        })
      : planActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "actor",
          targetId: entry.targetId,
          feedback,
          actingMs: Math.max(BATTLE_ACTING_MS, cinematicMs),
          hitStopMs: BATTLE_HITSTOP_MS,
          impactMs: BATTLE_IMPACT_MS,
        });
    playBeats(beats, directorBase, () => playTimelineEntries(rest, snapshot, done));
  }

  function timelineDirectorState(entry: BattleTimelineEntrySnapshot): BattleDirectorState {
    const detail = entry.kind === "stateAdded" ? `상태가 부여되었다: ${entry.stateId ?? "상태"}`
      : entry.kind === "stateRemoved" ? `상태가 해제되었다: ${entry.stateId ?? "상태"}`
      : entry.kind === "stateUpkeep" ? `상태 지속 피해 ${entry.amount ?? 0}`
      : entry.kind === "incapacitated" ? "상태 이상으로 행동할 수 없다."
      : entry.kind === "switch" ? "전열을 교체했다."
      : entry.kind === "capture" ? (entry.success ? "포획에 성공했다!" : "포획에 실패했다.")
      : "행동을 실행했다.";
    return { step: "acting", lines: [detail], targetId: entry.targetId };
  }

  function resolveEnemyTurns(previous: BattleDirectorState): void {
    delay(() => {
      advanceBattleRuntime(runtime);
      const after = runtime.snapshot();
      const entries = after.timeline.slice(consumedTimeline);
      consumedTimeline = after.timeline.length;
      playTimelineEntries(entries, after, () => finishTurn(previous));
    }, BATTLE_RESOLVE_MS);
  }

  return {
    get busy() {
      return busy;
    },
    get speedMultiplier() {
      return speedMultiplier;
    },
    set speedMultiplier(val: number) {
      speedMultiplier = val;
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
      const setupEntries = before.timeline.slice(consumedTimeline);
      const commandStart = Math.max(consumedTimeline, before.timeline.length);
      const commandEntries = after.timeline.slice(commandStart);
      consumedTimeline = after.timeline.length;
      const actingState = actorCommandDirectorState(command, before, after);
      const finish = (): void => {
        clearMotion();
        hooks.onDamageFeedback(undefined);
        if (after.battleFlow === "strict" || runtime.snapshot().result) {
          finishTurn(actingState);
        } else {
          resolveEnemyTurns(actingState);
        }
      };
      playTimelineEntries(
        setupEntries,
        before,
        () => playTimelineEntries(commandEntries, after, finish, actingState),
      );
    },
    runAfterEnemyAdvance(_before: BattleSnapshot, after: BattleSnapshot): void {
      if (busy) return;
      const entries = after.timeline.slice(consumedTimeline);
      if (entries.length === 0) return;
      consumedTimeline = after.timeline.length;
      setBusy(true);
      playTimelineEntries(entries, after, () => {
        clearMotion();
        const snapshot = runtime.snapshot();
        consumedTimeline = snapshot.timeline.length;
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
