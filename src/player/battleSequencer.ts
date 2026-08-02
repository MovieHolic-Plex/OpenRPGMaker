import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot, BattleAnimationSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
import { withJosa } from "@/util/josa";
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
/** "○○을(를) 쓰러뜨렸다!" 격파 대사가 화면에 머무는 시간. */
export const BATTLE_KILL_LINE_MS = 780;
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
  /** 엔트리 재생 시작 시 그 엔트리의 전투 애니메이션(없으면 undefined — 레이어 정리). */
  readonly onEntryAnimation?: (animation: BattleAnimationSnapshot | undefined) => void;
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
      delay(() => {
        revealResult(snapshot, previous);
        setBusy(false);
      }, BATTLE_RESULT_HOLD_MS);
      return;
    }
    hooks.onDirectorState(directorStateAfterTurn(snapshot, previous));
    hooks.onDamageFeedback(undefined);
    hooks.onSyncView();
    setBusy(false);
  }

  function applyBeat(beat: BattleActionBeat, directorBase?: BattleDirectorState): void {
    if (directorBase) {
      // 비트 단위 메시지: approach(선언 연출) 동안은 첫 줄(선언)만 보여주고,
      // impact 부터 결과 문구를 드러낸다. 선언·피해가 한 덩어리로 터지지 않게 한다.
      const lines = beat.kind === "approach" && directorBase.lines.length > 1
        ? directorBase.lines.slice(0, 1)
        : directorBase.lines;
      hooks.onDirectorState({ ...directorBase, step: beat.directorStep, lines });
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

  /**
   * 이 엔트리가 대상을 쓰러뜨리는 마지막 유효타면 격파 대사를 돌려준다.
   * "마지막"인 이유: 다단히트에서 중간 타격마다 대사가 나오지 않게 하기 위함.
   */
  function killLineFor(
    entries: readonly BattleTimelineEntrySnapshot[],
    index: number,
    snapshot: BattleSnapshot,
  ): string | undefined {
    const entry = entries[index];
    if (entry.kind !== "damage" || !entry.targetId || (entry.amount ?? 0) <= 0) return undefined;
    const target = snapshot.enemies.find((enemy) => enemy.id === entry.targetId)
      ?? snapshot.actors.find((actor) => actor.id === entry.targetId || actor.recordId === entry.targetId);
    if (!target?.defeated) return undefined;
    for (let i = index + 1; i < entries.length; i += 1) {
      const later = entries[i];
      if (later.targetId === entry.targetId && later.kind === "damage" && (later.amount ?? 0) > 0) return undefined;
    }
    const isEnemy = snapshot.enemies.some((enemy) => enemy.id === entry.targetId);
    return isEnemy
      ? `${withJosa(target.name, "을/를")} 쓰러뜨렸다!`
      : `${withJosa(target.name, "이/가")} 쓰러졌다!`;
  }

  function playTimelineEntries(
    entries: readonly BattleTimelineEntrySnapshot[],
    snapshot: BattleSnapshot,
    done: () => void,
    firstDirector?: BattleDirectorState,
    entryOffset = 0,
    firstDirectorIndex = 0,
  ): void {
    if (entryOffset >= entries.length) {
      done();
      return;
    }
    const entry = entries[entryOffset];
    hooks.onTimelineEntry?.(entry);
    const continueNext = (): void =>
      playTimelineEntries(entries, snapshot, done, firstDirector, entryOffset + 1, firstDirectorIndex);
    // 명령 대사(firstDirector)는 그 명령의 엔트리에만 붙인다. 무조건 0번에 붙이면,
    // 민첩이 빠른 적이 라운드에서 먼저 움직일 때 적의 선공이 아군 명령 대사(도주/공격)로
    // 뒤집히고, 정작 아군 엔트리는 제네릭 재생으로 떨어진다(코덱스 리뷰 C2: 도주 성공
    // 뒤 "주인공의 공격! 효과가 충분하지 않았다"가 재생되던 결함).
    const resultEntry = resultFromTimeline(entry);
    const directorBase = (firstDirector && entryOffset === firstDirectorIndex)
      ? firstDirector
      : actionEntryDirectorState(entry, snapshot)
        ?? (resultEntry ? enemyActionDirectorState(resultEntry, snapshot) : timelineDirectorState(entry));
    const feedback = feedbackFromTimeline(entry);
    const visual = entry.kind === "damage" || entry.kind === "healing" || entry.kind === "miss"
      || entry.kind === "action" || entry.kind === "capture" || entry.kind === "stateUpkeep";
    if (!visual) {
      hooks.onDirectorState(directorBase);
      hooks.onSyncView();
      continueNext();
      return;
    }
    hooks.onEntryAnimation?.(entry.animation);
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
    // 격파 대사 비트 — 이 타격이 대상을 쓰러뜨리면, recover 후 대사가 잠시 머문다.
    // 막타에서도 연출이 끝까지 재생된 뒤에야 다음(결과 공개)으로 넘어간다.
    const killLine = killLineFor(entries, entryOffset, snapshot);
    const afterBeats = killLine
      ? (): void => {
        hooks.onActionMotion?.(undefined);
        hooks.onDirectorState({ step: "impact", lines: [killLine], targetId: entry.targetId });
        hooks.onSyncView();
        delay(continueNext, BATTLE_KILL_LINE_MS);
      }
      : continueNext;
    playBeats(beats, directorBase, afterBeats);
  }

  /** 도주/방어/교체 커맨드의 "action" 엔트리 전용 대사 — 제네릭 경로(resultFromTimeline →
   *  enemyActionDirectorState)로 떨어지면 자기 자신을 대상으로 한 "○○의 공격!"이 된다. */
  function actionEntryDirectorState(
    entry: BattleTimelineEntrySnapshot,
    snapshot: BattleSnapshot,
  ): BattleDirectorState | undefined {
    if (entry.kind !== "action") return undefined;
    const user = snapshot.actors.find((actor) => actor.recordId === entry.userRecordId)
      ?? snapshot.enemies.find((enemy) => enemy.recordId === entry.userRecordId);
    const name = user?.name ?? "아군";
    if (entry.commandKind === "escape") {
      return {
        step: "acting",
        lines: [
          `${withJosa(name, "이/가")} 도망치려 한다…`,
          entry.success ? "무사히 도망쳤다!" : "그러나 도망칠 수 없었다!",
        ],
        targetId: entry.targetId,
      };
    }
    if (entry.commandKind === "defend") {
      return { step: "acting", lines: [`${withJosa(name, "은/는")} 몸을 웅크려 방어했다!`], targetId: entry.targetId };
    }
    if (entry.commandKind === "switch") {
      return { step: "acting", lines: ["전열을 교체했다."], targetId: entry.targetId };
    }
    return undefined;
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
      // 이 명령을 내린 액터의 첫 엔트리를 찾는다 — strict 라운드에서 민첩이 빠른 적이
      // 먼저 움직이면 commandEntries 앞쪽은 적의 행동이다. 대사는 액터 엔트리에 붙인다.
      const commandActorId = before.activeActorId;
      const commandEntryIndex = commandEntries.findIndex(
        (entry) => entry.side === "actor" && entry.userRecordId === commandActorId,
      );
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
        () => playTimelineEntries(
          commandEntries,
          after,
          finish,
          actingState,
          0,
          commandEntryIndex >= 0 ? commandEntryIndex : 0,
        ),
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
