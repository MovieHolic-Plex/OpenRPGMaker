import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot, BattleAnimationSnapshot, BattleEventChoiceSnapshot, BattleEventPauseSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
import { withJosa } from "@/util/josa";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import {
  planActionBeats,
  planEnemyActionBeats,
  weightForFeedback,
  type BattleActionBeat,
  recoverMsForAnimation,
} from "@/player/battleActionBeats";
import { store } from "@/project/store";
import {
  actorCommandDirectorState,
  battleResultRewardRowCount,
  commandPromptState,
  directorStateAfterTurn,
  enemyActionDirectorState,
  introDirectorState,
  sendOutDirectorState,
  type BattleDirectorState,
  resultDirectorState,
} from "@/player/battleDirectorDom";
import { disambiguatedBattlerName } from "@/player/battleCommandDom";

export const BATTLE_INTRO_MS = 1_200;
// 아래 3개는 **normal 무게** 기준값이다. light/heavy 는 battleActionBeats 가 배율로 늘리거나 줄인다.
// 470 → 400 (2026-09-27): 전진은 비트 끝 240ms 에만 움직이므로(22-hit-feel.css ⑦) 앞의 230ms 가
// "주인공의 공격!" 뒤 아무것도 움직이지 않는 죽은 시간이었다.
export const BATTLE_ACTING_MS = 400;
/** Brief freeze on a damaging connect before impact UI continues. */
export const BATTLE_HITSTOP_MS = 110;
/** 적 행동 예고(움츠림) — planEnemyActionBeats 의 windup 비트. weight 로 0.72~1.28배 늘어난다. */
export const BATTLE_ENEMY_WINDUP_MS = 300;
/**
 * 임팩트 여운. 750 → 430 → 400(접근 400 과 맞춘다, F06).
 *
 * 실측: 입력 1회당 비인터랙티브 2.09초 중 마지막 ~470ms 는 모션도 팝업도 없는
 * 완전 정적 구간이었다. 히트스톱(=절정)은 1샘플 폭인데 여운이 900ms 넘게 흘러
 * 임팩트 대비 여운의 비율이 거꾸로였다.
 */
export const BATTLE_IMPACT_MS = 400;
/** "○○을(를) 쓰러뜨렸다!" 격파 대사가 화면에 머무는 시간. */
export const BATTLE_KILL_LINE_MS = 660;
/** 결판 막타의 격파 대사 체류. 결과 도장이 같은 순간 뜨고 결과 홀드(900)가 뒤를 잇는다. */
export const BATTLE_DECISIVE_KILL_LINE_MS = 240;
export const BATTLE_RESOLVE_MS = 260;
/** 시각 효과가 없는 로그 엔트리(상태 부여/해제 등)가 화면에 머무는 최소 시간. */
export const BATTLE_LOG_MS = 520;
export const BATTLE_RESULT_STAGE_MS = 450;
export const BATTLE_RESULT_HOLD_MS = 900;

export interface DamageFeedback {
  readonly targetId: string;
  readonly amount: number;
  readonly critical: boolean;
  readonly healing: boolean;
  /** 피해·회복이 어느 자원에 적용됐는가. 표시 계층이 HP 원장에 MP 회복을
   *  적용하지 않도록 하는 유일한 근거다. 기본은 "hp". */
  readonly resource?: "hp" | "mp";
  readonly miss?: boolean;
  /** 명중했지만 피해가 0 인 타격(완전 방어·무효). 화면에 반드시 표시한다. */
  readonly blocked?: boolean;
}

export type ScheduleFn = (callback: () => void, delayMs: number) => number;
export type ClearScheduleFn = (timerId: number) => void;

export interface BattleSequencerHooks {
  readonly onEventPause?: (request: Exclude<BattleEventPauseSnapshot, { kind: "wait" }>) => void;
  readonly onEventChoice?: (request: BattleEventChoiceSnapshot) => void;
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
  /** 이 애니메이션의 착탄(효과음·플래시가 걸린 첫 프레임)까지 걸리는 ms. 시퀀서는 이펙트
   *  마운트를 `approach − 착탄` 만큼 늦춰 착탄 프레임이 임팩트 비트(팝업·히트스톱)와 같은
   *  순간에 오게 한다. 미구현이면 이펙트는 approach 시작과 함께 뜬다. */
  readonly animationImpactMs?: (animation: BattleAnimationSnapshot) => number;
  /** 도주 시도의 결과가 화면에 도달하는 순간. 도주음·BGM 정지는 성공이 확정된 뒤에만 울려야 한다. */
  readonly onEscapeOutcome?: (success: boolean) => void;
  /** 결과가 정해진 뒤 결과 패널이 뜨기 전(BATTLE_RESULT_HOLD_MS) 한 번. 이 홀드는 예전엔 빈 필드만
   *  보이는 정적 구간이었다 — 표시 계층이 승리/전멸 도장을 찍는다. */
  readonly onResultPending?: (result: NonNullable<BattleSnapshot["result"]>) => void;
  /** 아군 행동의 접근(approach) 비트 길이를 표시 계층이 정한다(도트 측면 전투: 적 앞까지 걷는 거리에 비례).
   *  undefined 를 돌려주면 BATTLE_ACTING_MS 그대로 — 이 훅이 없는 스킨의 시간은 바뀌지 않는다. */
  readonly actorApproachMs?: (entry: BattleTimelineEntrySnapshot) => number | undefined;
  /** 아군 행동의 회복(recover) 비트 최소 길이(걸어간 거리만큼 뛰어 돌아오는 시간). */
  readonly actorRecoverMs?: (entry: BattleTimelineEntrySnapshot) => number | undefined;
  /** 적 행동의 예고(approach) 비트 길이. 도트 측면 전투에서 적이 아군 앞까지 뛰어/날아가는 시간. undefined 면 BATTLE_ENEMY_WINDUP_MS. */
  readonly enemyApproachMs?: (entry: BattleTimelineEntrySnapshot) => number | undefined;
  /** 적 행동의 회복(recover) 비트 최소 길이(제자리로 돌아가는 시간). */
  readonly enemyRecoverMs?: (entry: BattleTimelineEntrySnapshot) => number | undefined;
}

export interface BattleSequencer {
  readonly busy: boolean;
  speedMultiplier: number;
  startIntro(snapshot: BattleSnapshot): void;
  runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void;
  runAfterEnemyAdvance(before: BattleSnapshot, after: BattleSnapshot): void;
  runAfterEventChoice(before: BattleSnapshot, after: BattleSnapshot): void;
  cancel(): void;
}

export function createBattleSequencer(
  runtime: BattleRuntime,
  hooks: BattleSequencerHooks,
  schedule: ScheduleFn = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearSchedule: ClearScheduleFn = (timerId) => window.clearTimeout(timerId)
): BattleSequencer {
  const timers = new Set<number>();
  /** 배속이 바뀔 때 남은 시간을 새 배속으로 다시 걸기 위한 원장. authored 지연은 제외. */
  const pending = new Map<number, { callback: () => void; baseMs: number; scaledMs: number; startedAt: number; generation: number }>();
  let busy = false;
  let speedMultiplier = 1.0;
  // Ordered timeline cursor. A sequencer is created with its runtime, so facts
  // appended during strict-round setup remain pending for the first sequence.
  let consumedTimeline = 0;
  let announcedChoiceId: number | undefined;
  let announcedPauseId: number | undefined;
  let generation = 0;

  function setBusy(next: boolean): void {
    busy = next;
    hooks.onSequenceBusy(next);
  }

  function trackTimer(timerId: number): void {
    timers.add(timerId);
  }

  function clearTimers(): void {
    generation += 1;
    for (const timerId of timers) clearSchedule(timerId);
    timers.clear();
    pending.clear();
  }

  function reducedMotion(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** 감소 모션은 **움직임**을 빼는 것이지 정보를 빼는 것이 아니다. 대사·격파 문구·결과 대기가
   *  10ms 로 지나가면 읽을 수 없는 로그가 된다(2026-09-14 실측). 읽기 시간 250ms 는 남긴다. */
  const REDUCED_MOTION_MAX_MS = 250;

  function scaleDelay(ms: number): number {
    if (reducedMotion()) return Math.max(10, Math.min(ms, REDUCED_MOTION_MAX_MS));
    return Math.max(10, Math.round(ms / Math.max(0.2, speedMultiplier)));
  }

  function now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function scheduleScaled(callback: () => void, baseMs: number, scaledMs: number, scheduledGeneration: number): void {
    let timer: number | undefined;
    let fired = false;
    timer = schedule(() => {
      fired = true;
      if (timer !== undefined) {
        timers.delete(timer);
        pending.delete(timer);
      }
      if (generation === scheduledGeneration) callback();
    }, scaledMs);
    if (!fired) {
      trackTimer(timer);
      pending.set(timer, { callback, baseMs, scaledMs, startedAt: now(), generation: scheduledGeneration });
    }
  }

  function delay(callback: () => void, ms: number, authored = false): void {
    const scheduledGeneration = generation;
    if (authored) {
      let timer: number | undefined;
      let fired = false;
      timer = schedule(() => {
        fired = true;
        if (timer !== undefined) timers.delete(timer);
        if (generation === scheduledGeneration) callback();
      }, ms);
      if (!fired) trackTimer(timer);
      return;
    }
    scheduleScaled(callback, ms, scaleDelay(ms), scheduledGeneration);
  }

  /** 배속이 바뀌면 **이미 걸려 있는** 지연도 남은 비율만큼 새 배속으로 다시 건다. 예전엔
   *  스케줄 시점의 배속이 고정돼 인트로 1.2초 홀드 중 확인키(스킵)를 눌러도 표시만 켜지고
   *  실제 단축은 0 이었다(2026-09-14 실측: 연타 15회에도 1236ms). */
  function rescheduleForSpeed(): void {
    if (pending.size === 0) return;
    const current = now();
    const entries = [...pending.entries()];
    for (const [timer, item] of entries) {
      clearSchedule(timer);
      timers.delete(timer);
      pending.delete(timer);
      if (item.generation !== generation) continue;
      const fraction = item.scaledMs > 0 ? Math.min(1, Math.max(0, (current - item.startedAt) / item.scaledMs)) : 1;
      const remainingBase = item.baseMs * (1 - fraction);
      scheduleScaled(item.callback, remainingBase, scaleDelay(remainingBase), item.generation);
    }
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
    // 상태 유지 회복(stateRecovery)도 같은 부호 계약을 탄다 — 여기서 빼면 회복량이
    // 양수 피해로 재생되어 팝업 -8 / HP 50→42 / 메시지 "8 회복" 이 한 화면에 겹친다.
    const healing = entry.kind === "healing" || entry.kind === "stateRecovery" || entry.kind === "revive" || (entry.amount ?? 0) < 0;
    if (amount === 0) {
      // 예전에는 여기서 undefined 를 돌려줘 0 피해가 화면에 **아무 흔적도** 남기지
      // 않았다. 실측에서 기본 적 24종 중 12종이 정확히 0 을 주고 있었으니, 초반 전투의
      // 절반은 적이 때렸는지조차 알 수 없었다 — 버그로 보인다. 0 도 사건이므로 표시한다.
      if (entry.kind !== "damage") return undefined;
      return { targetId: entry.targetId, amount: 0, critical: false, healing: false, blocked: true, resource: entry.resource ?? "hp" };
    }
    return {
      targetId: entry.targetId,
      amount,
      critical: Boolean(entry.critical),
      healing,
      resource: entry.resource ?? "hp",
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
    // 첫 행(경험치)은 패널과 함께 공개한다 — stage 0 은 제목·확인만 있는 빈 상자를 450ms
    // 보여 줬다(2026-09-14 실측). 행 수가 많으면 그 빈 상자마저 화면 밖이었다.
    let stage = Math.min(1, rewardCount);
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
    if (snapshot.eventPause) {
      hooks.onDamageFeedback(undefined);
      hooks.onSyncView();
      const request = snapshot.eventPause;
      if (announcedPauseId !== request.id) {
        announcedPauseId = request.id;
        if (request.kind === "wait") {
          delay(() => {
            const before = runtime.snapshot();
            if (runtime.resumeEventPause(request.id, { kind: "wait" })) resumeEvents(before, runtime.snapshot());
          }, request.ms, true);
        } else hooks.onEventPause?.(request);
      }
      return;
    }
    if (snapshot.eventChoice) {
      hooks.onDamageFeedback(undefined);
      hooks.onSyncView();
      if (announcedChoiceId !== snapshot.eventChoice.id) {
        announcedChoiceId = snapshot.eventChoice.id;
        hooks.onEventChoice?.(snapshot.eventChoice);
      }
      return;
    }
    if (snapshot.result) {
      hooks.onResultPending?.(snapshot.result);
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
    const peers = isEnemy ? snapshot.enemies : snapshot.actors;
    const targetName = disambiguatedBattlerName(target, peers);
    return isEnemy
      ? `${withJosa(targetName, "을/를")} 쓰러뜨렸다!`
      : `${withJosa(targetName, "이/가")} 쓰러졌다!`;
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
    // 배틀 이벤트 wait: strict 흐름은 라운드를 동기로 해결하고 일시정지를 이 사실로 넘긴다.
    // 진짜 연출 지연은 여기서만 생긴다 — 잡고 있는 화면/대사는 그대로 유지한다.
    if (entry.kind === "wait") {
      const waitMs = entry.waitMs ?? 0;
      if (waitMs > 0) delay(continueNext, waitMs);
      else continueNext();
      return;
    }
    // 명령 대사(firstDirector)는 그 명령의 엔트리에만 붙인다. 무조건 0번에 붙이면,
    // 민첩이 빠른 적이 라운드에서 먼저 움직일 때 적의 선공이 아군 명령 대사(도주/공격)로
    // 뒤집히고, 정작 아군 엔트리는 제네릭 재생으로 떨어진다(코덱스 리뷰 C2: 도주 성공
    // 뒤 "주인공의 공격! 효과가 충분하지 않았다"가 재생되던 결함).
    const resultEntry = resultFromTimeline(entry);
    const directorBase = (firstDirector && entryOffset === firstDirectorIndex)
      ? firstDirector
      : actionEntryDirectorState(entry, snapshot)
        ?? (resultEntry ? enemyActionDirectorState(resultEntry, snapshot, { resource: entry.resource ?? "hp", healing: entry.kind === "healing" || (entry.amount ?? 0) < 0 }) : timelineDirectorState(entry, snapshot));
    const feedback = feedbackFromTimeline(entry);
    // 적 이동: 대사 없이 스냅샷의 새 좌표로 미끄러지는 동안만 기다린다(CSS 트랜지션이 그린다).
    if (entry.kind === "move") {
      hooks.onSyncView();
      const moved = snapshot.enemies.find((enemy) => enemy.id === entry.targetId)?.moved;
      delay(continueNext, moved?.durationMs ?? 0);
      return;
    }
    // 자동 부활: 원장을 되살려(회복 피드백) 쓰러진 표시를 걷고 대사를 읽을 시간을 준다.
    if (entry.kind === "revive") {
      hooks.onDirectorState(directorBase);
      hooks.onDamageFeedback(feedback);
      hooks.onSyncView();
      delay(() => { hooks.onDamageFeedback(undefined); continueNext(); }, BATTLE_LOG_MS);
      return;
    }
    const visual = entry.kind === "damage" || entry.kind === "healing" || entry.kind === "miss"
      || entry.kind === "action" || entry.kind === "capture" || entry.kind === "stateUpkeep" || entry.kind === "stateRecovery";
    if (!visual) {
      hooks.onDirectorState(directorBase);
      hooks.onSyncView();
      // 시각 효과가 없는 엔트리(상태 부여·해제·행동 불가·MP 소모 등)도 **읽을 시간**을
      // 준다. 예전에는 지연이 0 이라 여러 줄이 같은 프레임에 뭉쳐 사라졌다 — 읽을 수
      // 없는 로그는 없는 로그다.
      if (directorBase.lines.length > 0) delay(continueNext, BATTLE_LOG_MS);
      else continueNext();
      return;
    }
    const cinematicMs = entry.kind === "capture" && entry.targetId
      ? hooks.onCaptureCinematic?.(entry.targetId, entry.success === true) ?? 0
      : 0;
    // 격파 대사 비트 — 이 타격이 대상을 쓰러뜨리면, recover 후 대사가 잠시 머문다.
    // 막타에서도 연출이 끝까지 재생된 뒤에야 다음(결과 공개)으로 넘어간다.
    const killLine = killLineFor(entries, entryOffset, snapshot);
    // 행동의 무게 — 급소·막타는 heavy(길게 눌러 잡고), 빗나감·0 피해·회복은 light.
    const weight = weightForFeedback(feedback, Boolean(killLine));
    const beats = entry.side === "enemy"
      ? planEnemyActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "enemy",
          feedback,
          hitStopMs: BATTLE_HITSTOP_MS,
          impactMs: Math.max(
            hooks.enemyRecoverMs?.(entry) ?? 0,
            recoverMsForAnimation(entry.animation?.durationMs, hooks.enemyApproachMs?.(entry) ?? BATTLE_ENEMY_WINDUP_MS, BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS),
          ),
          weight,
          windupMs: hooks.enemyApproachMs?.(entry) ?? BATTLE_ENEMY_WINDUP_MS,
        })
      : planActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "actor",
          targetId: entry.targetId,
          feedback,
          actingMs: Math.max(hooks.actorApproachMs?.(entry) ?? BATTLE_ACTING_MS, cinematicMs),
          hitStopMs: BATTLE_HITSTOP_MS,
          // 후속 애니메이션(연기·잔광)이 비트보다 길면 recover 를 늘려 잘리지 않게 한다.
          impactMs: Math.max(
            hooks.actorRecoverMs?.(entry) ?? 0,
            recoverMsForAnimation(entry.animation?.durationMs, Math.max(hooks.actorApproachMs?.(entry) ?? BATTLE_ACTING_MS, cinematicMs), BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS),
          ),
          weight,
        });
    // 이펙트 마운트 시점: 착탄 프레임이 임팩트 비트와 같은 순간에 오도록 approach 길이에서
    // 착탄까지의 ms 를 뺀 만큼 늦춘다. 예전엔 approach 시작에 바로 떠서 적이 하얗게 번쩍인
    // 뒤 0.3초 있다가 숫자가 뜨고 밀리는 "절정 두 번"이 됐다(2026-09-14 실측 250~300ms).
    const approachMs = beats.find((beat) => beat.kind === "approach")?.durationMs ?? 0;
    const impactAtMs = entry.animation && hooks.animationImpactMs ? hooks.animationImpactMs(entry.animation) : 0;
    // 착탄 정보가 없으면(타이밍 없는 레코드·훅 미구현) 예전처럼 approach 시작과 함께 뜬다.
    const animationOffsetMs = impactAtMs > 0 ? Math.max(0, approachMs - impactAtMs) : 0;
    if (entry.animation && animationOffsetMs > 0) {
      hooks.onEntryAnimation?.(undefined);
      delay(() => hooks.onEntryAnimation?.(entry.animation), animationOffsetMs);
    } else {
      hooks.onEntryAnimation?.(entry.animation);
    }
    if (entry.kind === "action" && entry.commandKind === "escape" && entry.side === "actor") {
      hooks.onEscapeOutcome?.(entry.success === true);
    }
    // 결판을 내는 막타: 뒤에 남은 피해·회복·빗나감 엔트리가 없고 결과가 이미 정해졌으면, 격파 대사와
    // 동시에 결과 도장을 찍고 대사 체류를 줄인다 — 대사 660ms + 결과 홀드 900ms 동안 빈 필드만
    // 보였다(2026-09-25 녹화). finishTurn 의 onResultPending 은 같은 결과면 표시 계층이 무시한다.
    const decisive = Boolean(killLine && snapshot.result && !entries.slice(entryOffset + 1)
      .some((later) => later.kind === "damage" || later.kind === "healing" || later.kind === "miss"));
    const afterBeats = killLine
      ? (): void => {
        hooks.onActionMotion?.(undefined);
        hooks.onDirectorState({ step: "impact", lines: [killLine], targetId: entry.targetId });
        hooks.onSyncView();
        if (decisive && snapshot.result) hooks.onResultPending?.(snapshot.result);
        delay(continueNext, decisive ? BATTLE_DECISIVE_KILL_LINE_MS : BATTLE_KILL_LINE_MS);
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
    if (entry.kind === "counter") {
      const user = snapshot.enemies.find((enemy) => enemy.id === entry.userId || enemy.recordId === entry.userRecordId);
      const name = user ? disambiguatedBattlerName(user, snapshot.enemies) : "적";
      return { step: "acting", lines: [`${name}의 반격!${entry.skillName ? ` — ${entry.skillName}` : ""}`], targetId: entry.targetId };
    }
    if (entry.kind === "revive") {
      const actor = snapshot.actors.find((candidate) => candidate.id === entry.targetId || candidate.recordId === entry.targetId);
      return { step: "acting", lines: [`${withJosa(actor?.name ?? "아군", "이/가")} 다시 일어섰다! (HP ${entry.amount ?? 0})`], targetId: entry.targetId };
    }
    if (entry.kind === "move") return { step: "acting", lines: [], targetId: entry.targetId };
    if (entry.kind === "special") return { step: "acting", lines: entry.message ? [entry.message] : [], targetId: entry.targetId };
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

  /** 내부 state id 대신 DB 의 상태 이름을 돌려준다. 플레이어에게 `state_poison_01`
   *  같은 문자열을 읽히면 상태 시스템이 있다는 사실 자체가 전달되지 않는다. */
  function stateLabel(stateId: string | undefined): string {
    if (!stateId) return "상태";
    const record = store.getCurrent().database.states.find((entry) => entry.id === stateId);
    return record?.name ?? stateId;
  }

  function timelineDirectorState(entry: BattleTimelineEntrySnapshot, snapshot: BattleSnapshot): BattleDirectorState {
    // 문장 스타일은 #253 판(조사 붙은 이름 + 완결 문장). stateRecovery 는 main 에만 있던
    // 갈래라 같은 어투로 옮겨 남긴다 — 빼면 상태 회복이 «행동을 실행했다» 로 뭉개진다.
    const detail = entry.kind === "stateAdded" ? `${withJosa(stateLabel(entry.stateId), "이/가")} 걸렸다!`
      : entry.kind === "stateRemoved" ? `${withJosa(stateLabel(entry.stateId), "이/가")} 풀렸다.`
      : entry.kind === "stateUpkeep" ? `상태 이상으로 ${entry.amount ?? 0} 피해를 입었다.`
      : entry.kind === "stateRecovery" ? `상태로 ${entry.amount ?? 0} 회복했다.`
      : entry.kind === "incapacitated" ? "상태 이상으로 행동할 수 없다."
      : entry.kind === "switch" ? "전열을 교체했다."
      : entry.kind === "capture" ? (entry.success ? "포획에 성공했다!" : "포획에 실패했다.")
      : "행동을 실행했다.";
    const peers = snapshot.enemies.some((enemy) => enemy.id === entry.targetId) ? snapshot.enemies : snapshot.actors;
    const target = peers.find((battler) => battler.id === entry.targetId);
    const isState = ["stateAdded", "stateRemoved", "stateUpkeep", "stateRecovery", "incapacitated"].includes(entry.kind);
    const line = isState && target ? `${disambiguatedBattlerName(target, peers)}: ${detail}` : detail;
    return { step: "acting", lines: [line], targetId: entry.targetId };
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

  function resumeEvents(_before: BattleSnapshot, after: BattleSnapshot): void {
    clearTimers();
    setBusy(true);
    const entries = after.timeline.slice(consumedTimeline);
    consumedTimeline = after.timeline.length;
    playTimelineEntries(entries, after, () => {
      const current = runtime.snapshot();
      if (current.battleFlow === "gauge" && current.phase === "charging" && !current.result) {
        resolveEnemyTurns(commandPromptState(current));
      } else finishTurn(commandPromptState(current));
    });
  }

  return {
    get busy() {
      return busy;
    },
    get speedMultiplier() {
      return speedMultiplier;
    },
    set speedMultiplier(val: number) {
      if (val === speedMultiplier) return;
      speedMultiplier = val;
      rescheduleForSpeed();
    },
    startIntro(snapshot: BattleSnapshot): void {
      clearTimers();
      // 인트로 동안 게이지 틱이 배너를 덮지 않도록 시퀀스를 점유한다.
      setBusy(true);
      hooks.onDirectorState(introDirectorState(snapshot));
      hooks.onSyncView();
      // 파티 몬스터 전투는 "야생의 X가 나타났다!" 다음에 "가라, Y!" 를 한 비트 더 준다.
      const sendOut = sendOutDirectorState(snapshot);
      const toCommandPrompt = (): void => {
        const current = runtime.snapshot();
        const entries = current.timeline.slice(consumedTimeline);
        consumedTimeline = current.timeline.length;
        playTimelineEntries(entries, current, () => finishTurn(commandPromptState(current)));
      };
      delay(() => {
        if (!sendOut) {
          toCommandPrompt();
          return;
        }
        hooks.onDirectorState(sendOut);
        hooks.onSyncView();
        delay(toCommandPrompt, BATTLE_INTRO_MS);
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
        if (after.battleFlow === "strict" || runtime.snapshot().result || runtime.snapshot().eventChoice || runtime.snapshot().eventPause) {
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
      if (entries.length === 0 && !after.eventChoice && !after.eventPause && !after.result) return;
      consumedTimeline = after.timeline.length;
      setBusy(true);
      playTimelineEntries(entries, after, () => finishTurn(commandPromptState(after)));
    },
    runAfterEventChoice: resumeEvents,
    cancel(): void {
      clearTimers();
      clearMotion();
      setBusy(false);
    },
  };
}
