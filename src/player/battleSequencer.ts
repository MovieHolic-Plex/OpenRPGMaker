import type { ActorCommand, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import { WEATHER_LABELS, weatherResidualLine } from "@/battle/weather";
import type { BattleActionResultSnapshot, BattleAnimationSnapshot, BattleEventChoiceSnapshot, BattleEventPauseSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
import { STAT_STAGE_LABELS, statStageMessage } from "@/battle/statStages";
import { withJosa } from "@/util/josa";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import {
  approachScaleFor,
  planActionBeats,
  planEnemyActionBeats,
  weightForFeedback,
  type BattleActionBeat,
  type BattleActionWeight,
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
import { emeraldBattlerName, emeraldShortName, emeraldFaintLine, emeraldIntroSendOut, emeraldMajorStatusLine, emeraldNarrationActive, emeraldTrainerSendOutLine, emeraldTrainerTroop } from "@/player/emeraldBattleNarration";

export const BATTLE_INTRO_MS = 1_200;
/** 포획 결과 문장 최소 체류(ms, 템포·배속 적용 후). */
export const CAPTURE_RESULT_HOLD_MS = 1300;
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
/** 에메랄드 결과 문장 한 쪽이 머무는 시간 — 패널 행이 아니라 읽는 문장이다. */
export const EMERALD_RESULT_PAGE_MS = 1_300;
export const BATTLE_RESULT_HOLD_MS = 900;
/** 쓰러짐 연출을 기다리는 최대 시간 — 연출이 멈춰도 결과가 영영 안 뜨지 않게. */
export const BATTLE_COLLAPSE_HOLD_MAX_MS = 2200;

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
  /** 상성 배율(엔트리 effectiveness). 1 이면 생략. */
  readonly effectiveness?: number;
  /** 장비한 무기 계열이 맞아 기술 위력이 오른 타격(SkillRecord.weaponAffinity). 숫자 위 「무기↑」 꼬리표. */
  readonly weaponAffinity?: boolean;
  /** 약점 공략 타격(SkillRecord.exploitStates). 숫자 아래 「공략!」 꼬리표. */
  readonly exploit?: boolean;
  /** 이 적 종류의 약점·저항을 처음 알아낸 타격 — 꼬리표가 「약점 발견!」·「저항 발견!」으로 커진다. */
  readonly weaknessDiscovered?: boolean;
  /** 숫자 대신 띄울 글자(상태 부여 「스톱」 등). 있으면 HP 원장·타격 연출·효과음을 건드리지 않는
   *  **표시 전용** 팝업이다(battleDom.onDamageFeedback 이 일찍 돌아간다). */
  readonly label?: string;
}

/** 광역기 착탄에서 대상 사이의 간격(ms). 0 = 한 작업 안에서 모두 함께 맞는다. 30ms 타이머로 벌렸더니 첫 착탄의 그리기 부하로
 *  실측 간격이 49~144ms 로 늘어 「차례로」 읽혔다(2026-10-24 폴른 스타 블리자드) — 그래서 같은 순간에 친다. */
export const BATTLE_GROUP_IMPACT_STAGGER_MS = 0;
const GROUP_HIT_KINDS: ReadonlySet<BattleTimelineEntrySnapshot["kind"]> = new Set(["damage", "healing", "miss"]);

/** 상태 부여 문장·떠오르는 글자가 머무는 시간. 한 줄 메시지 창(retro2003)에서 읽을 수 있어야 한다. */
export const BATTLE_STATE_LINE_MS = 800;
const STATE_ENTRY_KINDS: ReadonlySet<BattleTimelineEntrySnapshot["kind"]> = new Set([
  "stateAdded", "stateRemoved", "stateUpkeep", "stateRecovery", "incapacitated",
]);

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
  /** 광역기 한 번의 착탄으로 함께 맞는 대상들(맞는 포즈를 모두에게 준다). undefined 면 해제. 단일 대상 행동에서는 불리지 않는다. */
  readonly onImpactGroup?: (targetIds: readonly string[] | undefined) => void;
  /** Side-view lunge / knockback motion classes for the current beat. */
  readonly onActionMotion?: (beat: BattleActionBeat | undefined) => void;
  readonly onResultStage: (stage: number) => void;
  readonly onSequenceBusy: (busy: boolean) => void;
  /** Called once for each newly appended runtime timeline entry, in order. */
  readonly onTimelineEntry?: (entry: BattleTimelineEntrySnapshot) => void;
  /** 이 엔트리의 행동을 시작하기 전에 둘 연출 시간(ms, 배속 적용 전). onTimelineEntry 직후에 묻는다. 연계기 컷인이 쓴다. */
  readonly entryLeadMs?: (entry: BattleTimelineEntrySnapshot) => number;
  /** 엔트리 재생 시작 시 그 엔트리의 전투 애니메이션(없으면 undefined — 레이어 정리). */
  readonly onEntryAnimation?: (animation: BattleAnimationSnapshot | undefined) => void;
  /** 포획 시네마틱(구슬 투척·흔들림)을 재생하고 소요 ms를 반환. 미구현이면 0. */
  readonly onCaptureCinematic?: (targetId: string, success: boolean, shakes?: 0 | 1 | 2 | 3) => number;
  /** 이 애니메이션의 착탄(효과음·플래시가 걸린 첫 프레임)까지 걸리는 ms(템포 적용 전). 시퀀서는 이펙트
   *  마운트를 `approach − 착탄` 만큼 늦춰 착탄 프레임이 임팩트 비트(팝업·히트스톱)와 같은
   *  순간에 오게 한다. 미구현이면 이펙트는 approach 시작과 함께 뜬다. `approachMs` = 이 엔트리
   *  approach 비트 길이(템포 적용 후) — 표시 계층이 앞당길 수 있는 한도로 쓴다. */
  readonly animationImpactMs?: (animation: BattleAnimationSnapshot, approachMs: number) => number;
  /** 마운트 뒤 이펙트(후속 포함)가 실제로 도는 ms(템포 적용 전) — 앞 프레임을 건너뛰는 표시 계층만 구현한다.
   *  있으면 recover 비트를 이 끝 시각에 맞춘다. animationImpactMs 다음에 불린다. */
  readonly animationRemainingMs?: (animation: BattleAnimationSnapshot) => number | undefined;
  /** 피해 연출이 impact 비트 시작부터 끝나기까지 필요한 ms(템포 적용 후). recover 비트를 이만큼은 늘린다 —
   *  포켓몬 스킨은 기술 연출 뒤에 깜빡임·HP 감소가 따로 오므로(3세대 순서) 다음 행동이 그 위로 올라오면 안 된다. */
  readonly impactPresentationMs?: (entry: BattleTimelineEntrySnapshot, feedback: DamageFeedback | undefined) => number;
  /** 도주 시도의 결과가 화면에 도달하는 순간. 도주음·BGM 정지는 성공이 확정된 뒤에만 울려야 한다. */
  readonly onEscapeOutcome?: (success: boolean) => void;
  /** 결과가 정해진 뒤 결과 패널이 뜨기 전(BATTLE_RESULT_HOLD_MS) 한 번. 이 홀드는 예전엔 빈 필드만
   *  보이는 정적 구간이었다 — 표시 계층이 승리/전멸 도장을 찍는다. */
  readonly onResultPending?: (result: NonNullable<BattleSnapshot["result"]>) => void;
  /** 결판 막타 뒤 남은 적 쓰러짐 연출 시간(ms, EnemyRecord.collapseEffect). 결과 도장·패널을 그만큼 미뤄 보스 가라앉기가 가려지지 않게 한다. */
  readonly collapseHoldMs?: () => number;
  /** 행동 사이 쉼(적 차례 정리 BATTLE_RESOLVE_MS · 격파 대사 BATTLE_KILL_LINE_MS)에 곱하는 배율. undefined 면 1.
   *  도트 측면 전투가 0.6 을 쓴다(battle-feel r2: 행동 사이 빈 화면이 녹화에서 0.4~0.9초). */
  readonly interludeScale?: () => number | undefined;
  /** 첫 인트로 홀드 길이(ms). undefined 면 BATTLE_INTRO_MS. 도트 측면 보스 등장(battle-feel r2)이 쓴다. */
  readonly introHoldMs?: (snapshot: BattleSnapshot) => number | undefined;
  /** 아군 행동의 접근(approach) 비트 길이를 표시 계층이 정한다(도트 측면 전투: 적 앞까지 걷는 거리에 비례).
   *  undefined 를 돌려주면 BATTLE_ACTING_MS 그대로 — 이 훅이 없는 스킨의 시간은 바뀌지 않는다. */
  readonly actorApproachMs?: (entry: BattleTimelineEntrySnapshot, weight?: BattleActionWeight) => number | undefined;
  /** 아군 행동의 회복(recover) 비트 최소 길이(걸어간 거리만큼 뛰어 돌아오는 시간). */
  readonly actorRecoverMs?: (entry: BattleTimelineEntrySnapshot, weight?: BattleActionWeight) => number | undefined;
  /** 적 행동의 예고(approach) 비트 길이. 도트 측면 전투에서 적이 아군 앞까지 뛰어/날아가는 시간. undefined 면 BATTLE_ENEMY_WINDUP_MS. */
  readonly enemyApproachMs?: (entry: BattleTimelineEntrySnapshot, weight?: BattleActionWeight) => number | undefined;
  /** 적 행동의 회복(recover) 비트 최소 길이(제자리로 돌아가는 시간). */
  readonly enemyRecoverMs?: (entry: BattleTimelineEntrySnapshot, weight?: BattleActionWeight) => number | undefined;
  /** 표시 계층이 행동의 무게를 바꾼다(도트 연출 레코드의 weight 손잡이). undefined 면 피드백에서 정한 무게 그대로. */
  readonly actionWeight?: (entry: BattleTimelineEntrySnapshot, base: BattleActionWeight) => BattleActionWeight | undefined;
  /** 스킨의 동작 템포. 행동 비트(예고·돌진·회복)와 이펙트 착탄 오프셋만 이 배율로 줄인다 — 히트스톱과
   *  대사 읽기 시간은 그대로다. 배속(speedMultiplier)과 곱해진다. undefined·1 이면 옛 길이 그대로. */
  readonly motionTempo?: () => number;
  /** 피해 문장에 상성(「효과가 굉장했다!」·「효과가 별로인 듯하다…」)을 붙인다 — 포켓몬 스킨만. */
  readonly describeEffectiveness?: boolean;
}

/** 히트스톱 비트를 뺀 행동 비트를 템포로 줄인다. 히트스톱을 같이 줄이면 타격이 가벼워진다. */
export function tempoActionBeats(beats: readonly BattleActionBeat[], tempo: number): readonly BattleActionBeat[] {
  if (!(tempo > 0) || tempo === 1) return beats;
  return beats.map((beat) => (beat.hitStop || beat.durationMs <= 0 ? beat : { ...beat, durationMs: Math.max(10, Math.round(beat.durationMs / tempo)) }));
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
      ...(entry.effectiveness !== undefined && !healing ? { effectiveness: entry.effectiveness } : {}),
      ...(entry.weaponAffinity && !healing ? { weaponAffinity: true } : {}),
      ...(entry.exploit && !healing ? { exploit: true } : {}),
      ...(entry.weaknessDiscovered && !healing ? { weaknessDiscovered: true } : {}),
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
      ...(entry.skillId ? { skillId: entry.skillId } : {}),
      ...(hooks.describeEffectiveness && entry.effectiveness !== undefined ? { effectiveness: entry.effectiveness } : {}),
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
      if (stage <= rewardCount) delay(revealNext, emeraldNarrationActive() ? EMERALD_RESULT_PAGE_MS : BATTLE_RESULT_STAGE_MS);
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
    const fallen = fallenTarget(entries, index, snapshot);
    if (!fallen) return undefined;
    if (emeraldNarrationActive()) return emeraldFaintLine(fallen.target, snapshot);
    return fallen.isEnemy
      ? `${withJosa(fallen.name, "을/를")} 쓰러뜨렸다!`
      : `${withJosa(fallen.name, "이/가")} 쓰러졌다!`;
  }

  /** 이 엔트리가 대상을 쓰러뜨린 마지막 유효타면 그 대상(표시 이름·편). 아니면 undefined. */
  function fallenTarget(
    entries: readonly BattleTimelineEntrySnapshot[],
    index: number,
    snapshot: BattleSnapshot,
  ): { readonly target: Parameters<typeof emeraldFaintLine>[0]; readonly name: string; readonly isEnemy: boolean } | undefined {
    const entry = entries[index];
    if (entry.kind !== "damage" || !entry.targetId || (entry.amount ?? 0) <= 0) return undefined;
    const departed = snapshot.departedEnemies?.find((enemy) => enemy.id === entry.targetId);
    const target = snapshot.enemies.find((enemy) => enemy.id === entry.targetId)
      ?? departed
      ?? snapshot.actors.find((actor) => actor.id === entry.targetId || actor.recordId === entry.targetId)
      // 쓰러져 교체를 기다리는 아군은 전열에서 빠져 있다 — 그래도 「새싹토는 쓰러졌다!」는 읽혀야 한다.
      ?? snapshot.reserveActors.find((actor) => actor.id === entry.targetId || actor.recordId === entry.targetId);
    if (!target?.defeated) return undefined;
    for (let i = index + 1; i < entries.length; i += 1) {
      const later = entries[i];
      if (later.targetId === entry.targetId && later.kind === "damage" && (later.amount ?? 0) > 0) return undefined;
    }
    const isEnemy = Boolean(departed) || snapshot.enemies.some((enemy) => enemy.id === entry.targetId);
    const peers = isEnemy ? snapshot.enemies : snapshot.actors;
    return { target, name: disambiguatedBattlerName(target, peers), isEnemy };
  }

  function playTimelineEntries(
    entries: readonly BattleTimelineEntrySnapshot[],
    snapshot: BattleSnapshot,
    done: () => void,
    firstDirector?: BattleDirectorState,
    entryOffset = 0,
    firstDirectorIndex = 0,
    leadPlayed = false,
  ): void {
    if (entryOffset >= entries.length) {
      done();
      return;
    }
    const entry = entries[entryOffset];
    if (!leadPlayed) {
      hooks.onTimelineEntry?.(entry);
      // 엔트리 앞 연출 시간(연계기 얼굴 교차 컷인 등) — 표시 계층이 그동안 화면을 차지하고, 행동은 그 뒤에 시작한다.
      const leadMs = Math.max(0, hooks.entryLeadMs?.(entry) ?? 0);
      if (leadMs > 0) {
        delay(() => playTimelineEntries(entries, snapshot, done, firstDirector, entryOffset, firstDirectorIndex, true), leadMs);
        return;
      }
    }
    const continueNext = (): void =>
      playTimelineEntries(entries, snapshot, done, firstDirector, entryOffset + 1, firstDirectorIndex);
    // 쓰러져 남은 대상의 상태 해제(전투 끝·죽음 정리)는 말하지 않는다 — 승리 직전 「도깨비불 1의 민첩 하락이 풀렸다」가 떴다(2026-10-24).
    if (entry.kind === "stateRemoved" && entry.targetId && staysDown(entries, entryOffset, snapshot, entry.targetId)) {
      continueNext();
      return;
    }
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
    // 상태 엔트리는 userRecordId·targetId 를 들고 있어 resultEntry 가 만들어진다 — 예전에는 그래서
    // enemyActionDirectorState 로 떨어져 「발키리의 공격! 효과가 충분하지 않았다.」로 읽혔다(2026-09-29 실측).
    const rawDirector = (firstDirector && entryOffset === firstDirectorIndex)
      ? firstDirector
      : actionEntryDirectorState(entry, snapshot)
        // 적 교체 엔트리도 userRecordId·targetId 가 있어 「○○의 공격!」으로 읽혔다 — 교체 문장으로.
        ?? (STATE_ENTRY_KINDS.has(entry.kind) || entry.kind === "switch" ? timelineDirectorState(entry, snapshot)
          : resultEntry ? enemyActionDirectorState(resultEntry, snapshot, { resource: entry.resource ?? "hp", healing: entry.kind === "healing" || (entry.amount ?? 0) < 0 }) : timelineDirectorState(entry, snapshot));
    // 보조 기술(피해 0 인 action): 결과는 뒤따르는 상태 엔트리가 말한다 — 「효과가 충분하지 않았다」를 떼고,
    // 아무 상태도 안 붙었으면 recover 뒤에 「…에게는 효과가 없었다.」를 한 비트 준다.
    const support = supportOutcome(entries, entryOffset, snapshot);
    // 훔치기처럼 action 없이 special 한 줄만 남기는 명령은 명령 대사가 그 엔트리를 차지해 결과(「…을 훔쳤다!」)가
    // 사라지고 「효과가 충분하지 않았다」가 남았다 — 명령 줄 다음에 special 줄을 따로 읽힌다.
    // 힘 모으기 예고는 명령 줄(「…을 사용했다!」) 없이 예고 문장만 — 아직 쓰지 않았다.
    if (entry.kind === "special" && entry.charge && entry.message) {
      hooks.onDirectorState({ step: "acting", lines: [entry.message], targetId: entry.targetId });
      hooks.onSyncView();
      delay(continueNext, BATTLE_LOG_MS);
      return;
    }
    // 능력치 단계 변화는 표시 이름(야생·상대 접두)으로 문장을 다시 만든다 — 런타임 message 는 이름만 있는 일반 문장이다.
    const stageLine = statStageLine(entry, snapshot);
    const specialAfterCommand = rawDirector === firstDirector && entry.kind === "special" && entry.message ? (stageLine ?? entry.message) : undefined;
    const directorBase = support || specialAfterCommand ? { ...rawDirector, lines: rawDirector.lines.slice(0, 1) } : rawDirector;
    const raw = feedbackFromTimeline(entry);
    // 선고(doomTurns)로 쓰러지는 upkeep: 남은 HP 숫자(-99999 같은) 대신 상태 이름을 띄운다. amount 는 원장용으로 둔다.
    const feedback = raw && entry.kind === "stateUpkeep" && entry.message ? { ...raw, label: entry.weatherKind ? WEATHER_LABELS[entry.weatherKind] : stateLabel(entry.stateId) } : raw;
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
    if (entry.kind === "stateAdded" && entry.targetId) {
      // 상태 이름이 대상 위에 숫자 팝업처럼 잠깐 떠오른다(표시 전용 label 피드백).
      hooks.onDirectorState(directorBase);
      hooks.onDamageFeedback({ targetId: entry.targetId, amount: 0, critical: false, healing: false, label: stateLabel(entry.stateId) });
      hooks.onSyncView();
      delay(() => { hooks.onDamageFeedback(undefined); continueNext(); }, BATTLE_STATE_LINE_MS);
      return;
    }
    if (specialAfterCommand) {
      hooks.onDirectorState(directorBase);
      hooks.onSyncView();
      const stagePopup = statStagePopup(entry);
      delay(() => {
        hooks.onDirectorState({ step: "acting", lines: [specialAfterCommand], targetId: entry.targetId });
        // 올림·내림이 실제로 일어난 단계는 대상 위에 「공격↑」 글자가 잠깐 뜬다(표시 전용 label 피드백, HP 원장·타격 연출을 건드리지 않는다).
        if (stagePopup && entry.targetId) hooks.onDamageFeedback({ targetId: entry.targetId, amount: 0, critical: false, healing: false, label: stagePopup });
        hooks.onSyncView();
        delay(() => { if (stagePopup) hooks.onDamageFeedback(undefined); continueNext(); }, BATTLE_STATE_LINE_MS);
      }, BATTLE_LOG_MS);
      return;
    }
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
    // 광역기: 같은 행동이 둘 이상의 대상을 친 피해·회복·빗나감 엔트리는 한 번에 재생한다 — 연출 한 번, 숫자·깜빡임·HP 감소는
    // 같은 순간(대상마다 30ms), 격파 대사는 그 뒤 한 줄. 예전엔 대상마다 접근·히트스톱·격파 대사를 따로 돌아 「차례로」 맞았다.
    const targetGroup = collectTargetGroup(entries, entryOffset);
    if (targetGroup) {
      playTargetGroup(targetGroup, entries, snapshot, directorBase, () =>
        playTimelineEntries(entries, snapshot, done, firstDirector, targetGroup.end, firstDirectorIndex));
      return;
    }
    // 격파 대사 비트 — 이 타격이 대상을 쓰러뜨리면, recover 후 대사가 잠시 머문다.
    // 막타에서도 연출이 끝까지 재생된 뒤에야 다음(결과 공개)으로 넘어간다.
    const killLine = killLineFor(entries, entryOffset, snapshot);
    const { beats, animationOffsetMs } = planEntryBeats(entry, feedback, killLine);
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
        // 저작한 쓰러짐 연출(보스 가라앉기 1.8초 등)이 아직 돌면 결과 도장이 그 위를 덮는다 — 끝날 때까지 미룬다.
        const hold = decisive ? Math.min(BATTLE_COLLAPSE_HOLD_MAX_MS, Math.max(0, hooks.collapseHoldMs?.() ?? 0)) : 0;
        const stampAndContinue = (): void => {
          if (decisive && snapshot.result) hooks.onResultPending?.(snapshot.result);
          delay(continueNext, decisive ? BATTLE_DECISIVE_KILL_LINE_MS : Math.round(BATTLE_KILL_LINE_MS * (hooks.interludeScale?.() ?? 1)));
        };
        if (hold > 0) delay(stampAndContinue, hold);
        else stampAndContinue();
      }
      : support?.failLine
        ? (): void => {
          hooks.onActionMotion?.(undefined);
          hooks.onDirectorState({ step: "acting", lines: [support.failLine ?? ""], targetId: entry.targetId });
          hooks.onSyncView();
          delay(continueNext, BATTLE_STATE_LINE_MS);
        }
        : continueNext;
    playBeats(beats, directorBase, afterBeats);
  }

  interface TargetGroup {
    /** 묶인 타격 엔트리(엔트리 순서). */
    readonly members: readonly BattleTimelineEntrySnapshot[];
    /** members 의 entries 안 위치. */
    readonly indexes: readonly number[];
    /** 같은 행동이 남긴 상태 부여·해제 — 타격 뒤에 함께 읽힌다. */
    readonly states: readonly BattleTimelineEntrySnapshot[];
    /** 묶음 다음 엔트리 위치. */
    readonly end: number;
  }

  /**
   * entries[offset] 에서 시작하는 광역 타격 묶음. 같은 행동 번호·사용자·기술의 피해/회복/빗나감 엔트리가 **서로 다른 대상 둘 이상**을
   * 칠 때만 묶는다 — 단일 대상(다단 포함)은 undefined 라 옛 경로 그대로다. 대가·흡수·반동(aside)·반격 같은 다른 엔트리가 끼면 거기서 끊는다.
   * 3세대 문장 규칙(에메랄드)은 대상마다 상성 문장을 따로 읽어야 해 묶지 않는다.
   */
  function collectTargetGroup(entries: readonly BattleTimelineEntrySnapshot[], offset: number): TargetGroup | undefined {
    const head = entries[offset];
    if (!head || head.actionId === undefined || !head.targetId || head.aside !== undefined || !GROUP_HIT_KINDS.has(head.kind)) return undefined;
    if (emeraldNarrationActive()) return undefined;
    const sameStrike = (row: BattleTimelineEntrySnapshot): boolean => row.side === head.side && row.userRecordId === head.userRecordId
      && row.commandKind === head.commandKind && (row.skillId ?? row.skillName) === (head.skillId ?? head.skillName);
    const members: BattleTimelineEntrySnapshot[] = [];
    const indexes: number[] = [];
    const states: BattleTimelineEntrySnapshot[] = [];
    let end = offset;
    for (let i = offset; i < entries.length; i += 1) {
      const row = entries[i]!;
      if (row.actionId !== head.actionId) break;
      if (GROUP_HIT_KINDS.has(row.kind) && row.targetId && row.aside === undefined && sameStrike(row)) {
        members.push(row);
        indexes.push(i);
        end = i + 1;
        continue;
      }
      if ((row.kind === "stateAdded" || row.kind === "stateRemoved") && row.targetId) {
        states.push(row);
        end = i + 1;
        continue;
      }
      break;
    }
    if (new Set(members.map((row) => row.targetId)).size < 2) return undefined;
    // 마지막 타격 뒤에 붙은 상태만 묶는다 — 그 뒤 엔트리(다음 행동 등)는 원래 순서대로 간다.
    return { members, indexes, states, end };
  }

  /** 묶음을 착탄 차례(대상마다 n 번째 타)로 나눈다. 1타 광역기는 한 차례다. */
  function groupWaves(group: TargetGroup): { readonly entry: BattleTimelineEntrySnapshot; readonly index: number }[][] {
    const hitsSoFar = new Map<string, number>();
    const waves: { entry: BattleTimelineEntrySnapshot; index: number }[][] = [];
    group.members.forEach((entry, i) => {
      const target = entry.targetId ?? "";
      const n = hitsSoFar.get(target) ?? 0;
      hitsSoFar.set(target, n + 1);
      (waves[n] ??= []).push({ entry, index: group.indexes[i]! });
    });
    return waves;
  }

  function groupSummaryLine(members: readonly BattleTimelineEntrySnapshot[], snapshot: BattleSnapshot): string {
    const hits = members.filter((row) => row.kind !== "miss" && row.hit !== false);
    if (hits.length === 0) return "공격이 모두 빗나갔다!";
    const healing = hits.every((row) => row.kind === "healing" || (row.amount ?? 0) < 0);
    const total = hits.reduce((sum, row) => sum + Math.abs(row.amount ?? 0), 0);
    const targets = new Set(hits.map((row) => row.targetId)).size;
    const onEnemies = hits.every((row) => snapshot.enemies.some((enemy) => enemy.id === row.targetId)
      || snapshot.departedEnemies?.some((enemy) => enemy.id === row.targetId));
    if (healing) return `${onEnemies ? "적" : "아군"} ${targets}${onEnemies ? "체가" : "명이"} 합계 ${total} 회복했다!`;
    const base = onEnemies ? `적 ${targets}체에게 합계 ${total} 피해!` : `아군 ${targets}명이 합계 ${total} 피해를 입었다!`;
    const rates = hits.map((row) => row.effectiveness).filter((rate): rate is number => rate !== undefined && rate > 0);
    const weak = rates.some((rate) => rate > 1);
    const resisted = rates.length === hits.length && rates.every((rate) => rate < 1);
    return weak ? `${base} 약점을 찔렀다!` : resisted ? `${base} 효과가 별로인 듯하다…` : base;
  }

  /** 광역 묶음 재생: 연출(이펙트·시전 동작)은 첫 엔트리로 한 번, 착탄은 모두에게 함께, 격파·상태 문장은 그 뒤에 한 줄씩. */
  function playTargetGroup(
    group: TargetGroup,
    entries: readonly BattleTimelineEntrySnapshot[],
    snapshot: BattleSnapshot,
    directorBase: BattleDirectorState,
    next: () => void,
  ): void {
    const head = group.members[0]!;
    const waves = groupWaves(group);
    const declaration = directorBase.lines.slice(0, 1);
    const summary = groupSummaryLine(group.members, snapshot);
    const fallen = group.indexes
      .map((index) => fallenTarget(entries, index, snapshot))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const choreographed = head.side === "enemy" ? hooks.enemyRecoverMs !== undefined : hooks.actorRecoverMs !== undefined;
    const playWave = (waveIndex: number): void => {
      if (waveIndex >= waves.length) {
        afterWaves();
        return;
      }
      const wave = waves[waveIndex]!;
      const planned = wave.map(({ entry, index }) => {
        const feedback = feedbackFromTimeline(entry);
        return { entry, feedback, plan: planEntryBeats(entry, feedback, fallenTarget(entries, index, snapshot) ? "fallen" : undefined) };
      });
      const beatOf = (row: (typeof planned)[number], kind: BattleActionBeat["kind"]) => row.plan.beats.find((beat) => beat.kind === kind);
      const lead = planned[0]!;
      const approach = waveIndex === 0 ? beatOf(lead, "approach") : undefined;
      const approachMs = waveIndex === 0 ? approach?.durationMs ?? 0 : Math.max(0, ...planned.map((row) => beatOf(row, "approach")?.durationMs ?? 0));
      const impactMs = Math.max(0, ...planned.map((row) => beatOf(row, "impact")?.durationMs ?? 0));
      const recovers = planned.map((row) => beatOf(row, "recover")?.durationMs ?? 0);
      // 연출 재생기가 시각을 정한 행동(도트 측면 직업·몬스터 기술)은 엔트리별 회복 비트가 「다음 착탄까지」의 간격이라 합이 남은 연출 길이다.
      const recoverMs = choreographed ? recovers.reduce((sum, ms) => sum + ms, 0) : Math.max(0, ...recovers);
      const hitBeat = beatOf(lead, "impact");
      const recoverBeat = beatOf(lead, "recover");
      if (waveIndex === 0) {
        if (head.animation && lead.plan.animationOffsetMs > 0) {
          hooks.onEntryAnimation?.(undefined);
          delay(() => hooks.onEntryAnimation?.(head.animation), lead.plan.animationOffsetMs);
        } else {
          hooks.onEntryAnimation?.(head.animation);
        }
      }
      const strike = (): void => {
        hooks.onDirectorState({ ...directorBase, step: "impact", lines: [...declaration, summary] });
        if (hitBeat) hooks.onActionMotion?.(hitBeat);
        const struck = planned.filter((row) => row.feedback && !row.feedback.miss && !row.feedback.healing && row.feedback.amount > 0)
          .map((row) => row.entry.targetId!);
        hooks.onImpactGroup?.(struck);
        planned.forEach((row, i) => {
          const land = (): void => {
            hooks.onDamageFeedback(row.feedback);
            const damaging = Boolean(row.feedback && !row.feedback.miss && !row.feedback.healing && row.feedback.amount > 0);
            if (damaging) hooks.onHitFeel?.(true, row.feedback);
            hooks.onSyncView();
          };
          if (i === 0 || BATTLE_GROUP_IMPACT_STAGGER_MS <= 0) land();
          else delay(land, i * BATTLE_GROUP_IMPACT_STAGGER_MS);
        });
        const lastLand = (planned.length - 1) * BATTLE_GROUP_IMPACT_STAGGER_MS;
        delay(() => {
          hooks.onHitFeel?.(false);
          hooks.onImpactGroup?.(undefined);
          if (recoverBeat) hooks.onActionMotion?.({ ...recoverBeat, durationMs: recoverMs, feedback: undefined });
          hooks.onDamageFeedback(undefined);
          hooks.onSyncView();
          delay(() => playWave(waveIndex + 1), Math.max(0, recoverMs - Math.max(0, lastLand - impactMs)));
        }, Math.max(impactMs, lastLand));
      };
      if (approachMs > 0) {
        hooks.onDirectorState({ ...directorBase, step: "acting", lines: declaration });
        if (approach) hooks.onActionMotion?.(approach);
        else hooks.onActionMotion?.(undefined);
        hooks.onDamageFeedback(undefined);
        hooks.onHitFeel?.(false);
        hooks.onSyncView();
        delay(strike, approachMs);
      } else strike();
    };
    const afterWaves = (): void => {
      hooks.onActionMotion?.(undefined);
      const lines: string[] = [];
      const enemies = fallen.filter((row) => row.isEnemy).map((row) => row.name);
      const allies = fallen.filter((row) => !row.isEnemy).map((row) => row.name);
      if (enemies.length) lines.push(`${withJosa(enemies.join(", "), "을/를")} 쓰러뜨렸다!`);
      if (allies.length) lines.push(`${withJosa(allies.join(", "), "이/가")} 쓰러졌다!`);
      const decisive = Boolean(lines.length && snapshot.result && !entries.slice(group.end)
        .some((later) => later.kind === "damage" || later.kind === "healing" || later.kind === "miss"));
      // 이 광역기로 쓰러진 대상의 상태 변화(걸림→죽어서 풀림)는 말하지 않는다 — 「쓰러뜨렸다」 뒤에 「민첩이 내려갔다/풀렸다」가 붙었다(2026-10-24 실측).
      const fallenIds = new Set(fallen.map((row) => row.target.id));
      const toStates = (): void => {
        const live = group.states.filter((row) => !fallenIds.has(row.targetId ?? ""));
        for (const row of group.states) if (fallenIds.has(row.targetId ?? "")) hooks.onTimelineEntry?.(row);
        playGroupStates(live, snapshot, next);
      };
      if (lines.length === 0) {
        toStates();
        return;
      }
      hooks.onDirectorState({ step: "impact", lines, targetId: head.targetId });
      hooks.onSyncView();
      const hold = decisive ? Math.min(BATTLE_COLLAPSE_HOLD_MAX_MS, Math.max(0, hooks.collapseHoldMs?.() ?? 0)) : 0;
      const stampAndContinue = (): void => {
        if (decisive && snapshot.result) hooks.onResultPending?.(snapshot.result);
        delay(toStates, decisive ? BATTLE_DECISIVE_KILL_LINE_MS : Math.round(BATTLE_KILL_LINE_MS * (hooks.interludeScale?.() ?? 1)));
      };
      if (hold > 0) delay(stampAndContinue, hold);
      else stampAndContinue();
    };
    playWave(0);
  }

  /** 이 대상이 지금 스냅숏에서 쓰러져 있고, 뒤 엔트리가 다시 건드리지 않는가(부활·회복 없음). */
  function staysDown(entries: readonly BattleTimelineEntrySnapshot[], offset: number, snapshot: BattleSnapshot, targetId: string): boolean {
    const battler = [...snapshot.enemies, ...snapshot.actors].find((row) => row.id === targetId);
    if (!battler || battler.hp > 0) return false;
    return !entries.slice(offset + 1).some((later) => later.targetId === targetId && (later.kind === "healing" || later.kind === "damage"));
  }

  /** 광역기가 남긴 상태 변화를 같은 상태끼리 한 줄로 — 대상 위 글자는 함께 뜬다. */
  function playGroupStates(states: readonly BattleTimelineEntrySnapshot[], snapshot: BattleSnapshot, next: () => void): void {
    const buckets = new Map<string, BattleTimelineEntrySnapshot[]>();
    for (const row of states) {
      const key = `${row.kind}:${row.stateId ?? ""}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }
    const queue = [...buckets.values()];
    const step = (): void => {
      const rows = queue.shift();
      if (!rows) {
        hooks.onDamageFeedback(undefined);
        next();
        return;
      }
      const first = rows[0]!;
      const names = rows.map((row) => {
        const peers = snapshot.enemies.some((enemy) => enemy.id === row.targetId) ? snapshot.enemies : snapshot.actors;
        const target = peers.find((battler) => battler.id === row.targetId);
        return target ? disambiguatedBattlerName(target, peers) : "대상";
      });
      for (const row of rows) hooks.onTimelineEntry?.(row);
      hooks.onDirectorState({ step: "acting", lines: [stateChangeLine(first.kind as "stateAdded" | "stateRemoved", first.stateId, names.join(", "))], targetId: first.targetId });
      if (first.kind === "stateAdded") {
        for (const row of rows) {
          hooks.onDamageFeedback({ targetId: row.targetId!, amount: 0, critical: false, healing: false, label: stateLabel(row.stateId) });
          hooks.onSyncView();
        }
      } else {
        hooks.onDamageFeedback(undefined);
        hooks.onSyncView();
      }
      delay(() => {
        hooks.onDamageFeedback(undefined);
        step();
      }, BATTLE_STATE_LINE_MS);
    };
    step();
  }

  /** 엔트리 하나의 비트 계획(접근·착탄·회복)과 이펙트 마운트 지연. 단일 대상 경로와 광역 묶음 경로가 같이 쓴다. */
  function planEntryBeats(
    entry: BattleTimelineEntrySnapshot,
    feedback: DamageFeedback | undefined,
    killLine: string | undefined,
  ): { readonly beats: readonly BattleActionBeat[]; readonly animationOffsetMs: number; readonly weight: BattleActionWeight } {
    const cinematicMs = entry.kind === "capture" && entry.targetId
      ? hooks.onCaptureCinematic?.(entry.targetId, entry.success === true, entry.shakes) ?? 0
      : 0;
    // 행동의 무게 — 급소·막타는 heavy(길게 눌러 잡고), 빗나감·0 피해·회복은 light.
    const baseWeight = weightForFeedback(feedback, Boolean(killLine));
    const weight = hooks.actionWeight?.(entry, baseWeight) ?? baseWeight;
    const tempo = hooks.motionTempo?.() ?? 1;
    // 포획 연출(구슬·흔들림)은 실제 시간으로 흐른다. 행동 비트는 무게 배율(light 0.72)·템포(÷1.5)·배속(÷speed)으로 줄어들므로
    // 그만큼 키워 넘겨야 한다 — 안 그러면 「잡았다!」 문장이 구슬이 아직 흔들리는 중에 뜬다(실측: 연출 3.4초 중 1.7초에 결과 문장).
    const cinematicBeatMs = cinematicMs * (tempo > 0 ? tempo : 1) * Math.max(0.2, speedMultiplier) / approachScaleFor(weight);
    const planBeats = (animationMs: number | undefined): readonly BattleActionBeat[] => tempoActionBeats(entry.side === "enemy"
      ? planEnemyActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "enemy",
          // 피해가 없는 기술(약화·수면)은 feedback 이 없어 대상이 비었다 — 내 쪽과 같이 엔트리 대상을 넘긴다
          targetId: entry.targetId,
          feedback,
          hitStopMs: BATTLE_HITSTOP_MS,
          // 연출 재생기(retro2003)가 시각을 정한 엔트리는 그 값을 그대로 쓴다 — 다단·광역의 타 사이를 최소 비트(400ms)로
          // 벌리면 연출이 끝난 뒤에야 숫자가 하나씩 떴다(2026-10-01 실측, 플레슈 5타).
          impactMs: hooks.enemyRecoverMs?.(entry, weight)
            ?? recoverMsForAnimation(animationMs, hooks.enemyApproachMs?.(entry, weight) ?? BATTLE_ENEMY_WINDUP_MS, BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS),
          weight,
          windupMs: hooks.enemyApproachMs?.(entry, weight) ?? BATTLE_ENEMY_WINDUP_MS,
        })
      : planActionBeats({
          userId: entry.userRecordId ?? entry.userId ?? "actor",
          targetId: entry.targetId,
          feedback,
          actingMs: Math.max(hooks.actorApproachMs?.(entry, weight) ?? BATTLE_ACTING_MS, cinematicBeatMs),
          hitStopMs: BATTLE_HITSTOP_MS,
          // 후속 애니메이션(연기·잔광)이 비트보다 길면 recover 를 늘려 잘리지 않게 한다.
          impactMs: hooks.actorRecoverMs?.(entry, weight)
            ?? recoverMsForAnimation(animationMs, Math.max(hooks.actorApproachMs?.(entry, weight) ?? BATTLE_ACTING_MS, cinematicBeatMs), BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS),
          weight,
        }), tempo);
    let beats = planBeats(entry.animation?.durationMs);
    // 이펙트 마운트 시점: 착탄 프레임이 임팩트 비트와 같은 순간에 오도록 approach 길이에서
    // 착탄까지의 ms 를 뺀 만큼 늦춘다. 예전엔 approach 시작에 바로 떠서 적이 하얗게 번쩍인
    // 뒤 0.3초 있다가 숫자가 뜨고 밀리는 "절정 두 번"이 됐다(2026-09-14 실측 250~300ms).
    const approachMs = beats.find((beat) => beat.kind === "approach")?.durationMs ?? 0;
    // 이펙트 프레임도 같은 템포로 돈다(battleAnimationFrameMs 가 data-battle-motion-tempo 를 곱한다).
    const impactAtMs = entry.animation && hooks.animationImpactMs ? hooks.animationImpactMs(entry.animation, approachMs) / (tempo > 0 ? tempo : 1) : 0;
    // 착탄 정보가 없으면(타이밍 없는 레코드·훅 미구현) 예전처럼 approach 시작과 함께 뜬다.
    const animationOffsetMs = impactAtMs > 0 ? Math.max(0, approachMs - impactAtMs) : 0;
    // 표시 계층이 앞 프레임을 건너뛰면(포켓몬 안무) 이펙트는 approach 끝 무렵에 마운트돼 남은 프레임만 돈다.
    // recoverMsForAnimation 은 「approach 시작에 마운트해 0번부터」를 가정하므로, 실제로 끝나는 시각(템포 전 ms)을 넘겨
    // recover 를 다시 잰다 — 안 그러면 운석은 끝에 빈 화면이, 번개는 마지막 잔광이 잘렸다(2026-10-02 적대적 리뷰).
    const remainingMs = entry.animation && hooks.animationRemainingMs ? hooks.animationRemainingMs(entry.animation) : undefined;
    if (remainingMs !== undefined && hooks.actorRecoverMs === undefined && hooks.enemyRecoverMs === undefined) {
      beats = planBeats(Math.max(0, animationOffsetMs * (tempo > 0 ? tempo : 1) + remainingMs));
    }
    const presentationMs = hooks.impactPresentationMs?.(entry, feedback) ?? 0;
    if (presentationMs > 0) {
      const impactBeatMs = beats.find((beat) => beat.kind === "impact")?.durationMs ?? 0;
      const needed = Math.round(presentationMs - impactBeatMs);
      beats = beats.map((beat) => (beat.kind === "recover" && beat.durationMs < needed ? { ...beat, durationMs: needed } : beat));
    }
    // 포획 결과 문장(「잡았다!」·「아깝다!」)은 글자가 다 나온 뒤 읽을 시간이 필요하다 — 연출이 끝나면 바로 다음 차례로 넘어가
    // 실패 문장이 0.4초 만에 지나갔다(2026-10-16 실측). recover 비트(템포 적용 뒤 길이)를 최소 CAPTURE_RESULT_HOLD_MS 로 늘린다.
    if (entry.kind === "capture") {
      const hold = CAPTURE_RESULT_HOLD_MS;
      beats = beats.map((beat) => (beat.kind === "recover" && beat.durationMs < hold ? { ...beat, durationMs: hold } : beat));
    }
    return { beats, animationOffsetMs, weight };
  }

  /** 도주/방어/교체 커맨드의 "action" 엔트리 전용 대사 — 제네릭 경로(resultFromTimeline →
   *  enemyActionDirectorState)로 떨어지면 자기 자신을 대상으로 한 "○○의 공격!"이 된다. */
  function actionEntryDirectorState(
    entry: BattleTimelineEntrySnapshot,
    snapshot: BattleSnapshot,
  ): BattleDirectorState | undefined {
    if (entry.kind === "counter") {
      // 상태 반격(state_counter)은 아군도 한다 — 엔트리 side 가 반격하는 쪽이다.
      const actor = entry.side === "actor"
        ? snapshot.actors.find((candidate) => candidate.id === entry.userId || candidate.recordId === entry.userRecordId)
        : undefined;
      const user = actor ? undefined : snapshot.enemies.find((enemy) => enemy.id === entry.userId || enemy.recordId === entry.userRecordId);
      const name = actor ? actor.name : user ? disambiguatedBattlerName(user, snapshot.enemies) : "적";
      return { step: "acting", lines: [`${name}의 반격!${entry.skillName ? ` — ${entry.skillName}` : ""}`], targetId: entry.targetId };
    }
    if (entry.kind === "revive") {
      const actor = snapshot.actors.find((candidate) => candidate.id === entry.targetId || candidate.recordId === entry.targetId);
      return { step: "acting", lines: [`${withJosa(actor?.name ?? "아군", "이/가")} 다시 일어섰다! (HP ${entry.amount ?? 0})`], targetId: entry.targetId };
    }
    if (entry.kind === "move") return { step: "acting", lines: [], targetId: entry.targetId };
    if (entry.kind === "special") return { step: "acting", lines: entry.message ? [statStageLine(entry, snapshot) ?? entry.message] : [], targetId: entry.targetId };
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

  /** 피해 0 인 보조 기술 엔트리의 결과. 보조 기술이 아니면 undefined.
   *  뒤따르는(다음 행동 엔트리 전까지) 같은 대상의 상태 변화·특수 결과가 있으면 failLine 없음,
   *  없는데 기술에 상태 부여가 적혀 있으면 「…에게는 효과가 없었다.」. */
  function supportOutcome(
    entries: readonly BattleTimelineEntrySnapshot[],
    offset: number,
    snapshot: BattleSnapshot,
  ): { readonly failLine?: string } | undefined {
    const entry = entries[offset];
    if (entry.kind !== "action" || entry.hit === false || (entry.amount ?? 0) !== 0 || !entry.skillName || !entry.targetId) return undefined;
    if (entry.commandKind === "defend" || entry.commandKind === "escape" || entry.commandKind === "switch") return undefined;
    let changed = false;
    for (const later of entries.slice(offset + 1)) {
      if (later.kind === "action" || later.kind === "damage" || later.kind === "healing" || later.kind === "miss" || later.kind === "counter") break;
      if ((later.kind === "stateAdded" || later.kind === "stateRemoved" || later.kind === "special") && later.targetId === entry.targetId) changed = true;
    }
    if (changed) return {};
    const skill = store.getCurrent().database.skills.find((record) => entry.skillId ? record.id === entry.skillId : record.name === entry.skillName);
    const adds = (skill?.stateEffects ?? []).filter((effect) => effect.operation !== "remove").map((effect) => effect.stateId);
    if (adds.length === 0) return undefined;
    const peers = snapshot.enemies.some((enemy) => enemy.id === entry.targetId) ? snapshot.enemies : snapshot.actors;
    const target = peers.find((battler) => battler.id === entry.targetId);
    const name = target ? disambiguatedBattlerName(target, peers) : "대상";
    // 이미 걸려 있어 새로 붙지 않은 것은 실패가 아니다 — 「효과가 없었다」로 읽히면 기술이 헛나간 것 같다.
    if (target && adds.every((stateId) => target.stateIds.includes(stateId))) {
      return { failLine: `${withJosa(name, "은/는")} 이미 ${stateLabel(adds[0])} 상태다.` };
    }
    return { failLine: `${name}에게는 효과가 없었다.` };
  }

  /** 능력치 단계 변화(statStage)가 실린 special 엔트리의 문장 — 에메랄드 문장 규칙이면 「상대/야생 이름」을 쓴다. 아니면 undefined. */
  function statStageLine(entry: BattleTimelineEntrySnapshot, snapshot: BattleSnapshot): string | undefined {
    if (entry.kind !== "special" || (!entry.statStage && !entry.recoil)) return undefined;
    const peers = snapshot.enemies.some((enemy) => enemy.id === entry.targetId) ? snapshot.enemies : snapshot.actors;
    const target = peers.find((battler) => battler.id === entry.targetId);
    if (!target) return undefined;
    const name = emeraldNarrationActive() ? emeraldBattlerName(target, snapshot) : disambiguatedBattlerName(target, peers);
    if (entry.recoil || !entry.statStage) return `${withJosa(name, "은/는")} 반동 피해를 입었다!`;
    return statStageMessage(name, {
      stat: entry.statStage.stat,
      before: entry.statStage.before,
      after: entry.statStage.after,
      applied: entry.statStage.after - entry.statStage.before,
      requested: entry.statStage.requested,
    });
  }

  /** 단계가 실제로 움직였을 때만 뜨는 짧은 글자(「공격↑」). 한계에 걸려 안 움직였으면 문장만. */
  function statStagePopup(entry: BattleTimelineEntrySnapshot): string | undefined {
    const change = entry.statStage;
    if (!change || change.after === change.before) return undefined;
    return `${STAT_STAGE_LABELS[change.stat]}${change.after > change.before ? "↑" : "↓"}`;
  }

  /** 상태 부여·해제 문장. 능력 증감(「공격 상승」)은 「…의 공격이 올랐다!」로 읽는다. */
  function stateChangeLine(kind: "stateAdded" | "stateRemoved", stateId: string | undefined, name: string): string {
    const label = stateLabel(stateId);
    if (kind === "stateRemoved") {
      if (stateId === "state_death") return `${withJosa(name, "이/가")} 되살아났다!`;
      return `${name}의 ${withJosa(label, "이/가")} 풀렸다.`;
    }
    const buff = /^(.+) (상승|하락)$/u.exec(label);
    if (buff) return `${name}의 ${withJosa(buff[1], "이/가")} ${buff[2] === "상승" ? "올랐다!" : "내려갔다!"}`;
    return `${withJosa(name, "은/는")} ${label}에 걸렸다!`;
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
    if (entry.kind === "switch") {
      const enemySide = entry.side === "enemy";
      const next = (enemySide ? snapshot.enemies : snapshot.actors).find((battler) => battler.id === entry.targetId);
      const trainer = enemySide && emeraldNarrationActive() ? emeraldTrainerTroop(snapshot) : undefined;
      if (trainer && next) return { step: "acting", lines: [emeraldTrainerSendOutLine(trainer.name, next.name)], targetId: entry.targetId };
      if (next) {
        const line = !enemySide && emeraldNarrationActive() ? `가라! ${emeraldShortName(next.name)}!`
          : `${withJosa(disambiguatedBattlerName(next, enemySide ? snapshot.enemies : snapshot.actors), "이/가")} ${enemySide ? "나타났다!" : "나섰다!"}`;
        return { step: "acting", lines: [line], targetId: entry.targetId };
      }
    }
    const detail = entry.kind === "stateAdded" ? `${withJosa(stateLabel(entry.stateId), "이/가")} 걸렸다!`
      : entry.kind === "stateRemoved" ? `${withJosa(stateLabel(entry.stateId), "이/가")} 풀렸다.`
      : entry.kind === "stateUpkeep" ? `상태 이상으로 ${entry.amount ?? 0} 피해를 입었다.`
      : entry.kind === "stateRecovery" ? `상태로 ${entry.amount ?? 0} 회복했다.`
      : entry.kind === "incapacitated" ? (entry.flinch ? "풀이 죽어 행동할 수 없다." : "상태 이상으로 행동할 수 없다.")
      : entry.kind === "switch" ? "전열을 교체했다."
      : entry.kind === "capture" ? (entry.success ? "포획에 성공했다!" : "포획에 실패했다.")
      : "행동을 실행했다.";
    const peers = snapshot.enemies.some((enemy) => enemy.id === entry.targetId) ? snapshot.enemies : snapshot.actors;
    const target = peers.find((battler) => battler.id === entry.targetId);
    const isState = STATE_ENTRY_KINDS.has(entry.kind);
    // 3세대 문장: 「새싹토는 독의 피해를 입었다!」 — 「새싹토: 상태 이상으로 2 피해를 입었다.」는 숫자를 말하는 RPG 로그다.
    if (entry.kind === "stateUpkeep" && !entry.message && target && emeraldNarrationActive() && (entry.amount ?? 0) > 0) {
      return { step: "acting", lines: [`${withJosa(emeraldBattlerName(target, snapshot), "은/는")} ${stateLabel(entry.stateId)}의 피해를 입었다!`], targetId: entry.targetId };
    }
    // 풀죽음: 상태 이상이 아니라 이번 차례만 잃는다 — 걸려 있는 상태 문장으로 읽히면 안 된다.
    if (entry.kind === "incapacitated" && entry.flinch && target) {
      const who = emeraldNarrationActive() ? emeraldBattlerName(target, snapshot) : disambiguatedBattlerName(target, peers);
      return { step: "acting", lines: [`${withJosa(who, "은/는")} 풀이 죽어 움직일 수 없다!`], targetId: entry.targetId };
    }
    // 3세대 주요 상태: 「새싹토는 얼어붙어서 움직일 수 없다!」·「새싹토의 얼음이 녹았다!」. 못 움직인 차례는 지금 걸린 주요 상태로 말한다.
    if (target && emeraldNarrationActive() && (entry.kind === "stateAdded" || entry.kind === "stateRemoved" || entry.kind === "incapacitated")) {
      const states = store.getCurrent().database.states;
      const major = (stateId: string | undefined) => states.find((state) => state.id === stateId)?.gen1MajorStatus;
      const volatile = (stateId: string | undefined) => states.find((state) => state.id === stateId)?.volatileStatus;
      const status = entry.kind === "incapacitated" ? target.stateIds.map(major).find(Boolean) : major(entry.stateId) ?? volatile(entry.stateId);
      const emerald = emeraldMajorStatusLine(entry.kind === "stateAdded" ? "added" : entry.kind === "stateRemoved" ? "removed" : "held",
        status, emeraldBattlerName(target, snapshot));
      if (emerald) return { step: "acting", lines: [emerald], targetId: entry.targetId };
    }
    // 날씨 피해: 표시 이름(야생·상대 접두)으로 문장을 다시 만든다 — 런타임 message 는 이름만 있는 일반 문장이다.
    const weatherLine = entry.kind === "stateUpkeep" && entry.weatherKind && target
      ? weatherResidualLine(entry.weatherKind, emeraldNarrationActive() ? emeraldBattlerName(target, snapshot) : disambiguatedBattlerName(target, peers))
      : undefined;
    const line = weatherLine ? weatherLine : entry.kind === "stateUpkeep" && entry.message ? entry.message
      : (entry.kind === "stateAdded" || entry.kind === "stateRemoved") && target
      ? stateChangeLine(entry.kind, entry.stateId, disambiguatedBattlerName(target, peers))
      : isState && target ? `${disambiguatedBattlerName(target, peers)}: ${detail}` : detail;
    return { step: "acting", lines: [line], targetId: entry.targetId };
  }

  function resolveEnemyTurns(previous: BattleDirectorState): void {
    delay(() => {
      advanceBattleRuntime(runtime);
      const after = runtime.snapshot();
      const entries = after.timeline.slice(consumedTimeline);
      consumedTimeline = after.timeline.length;
      playTimelineEntries(entries, after, () => finishTurn(previous));
    }, Math.round(BATTLE_RESOLVE_MS * (hooks.interludeScale?.() ?? 1)));
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
      // 트레이너 전: 「○○는 △△를 내보냈다!」가 「가라, □□!」 앞에 한 쪽 더 온다.
      const foeSendOut = emeraldNarrationActive() ? emeraldIntroSendOut(snapshot) : undefined;
      const toCommandPrompt = (): void => {
        const current = runtime.snapshot();
        const entries = current.timeline.slice(consumedTimeline);
        consumedTimeline = current.timeline.length;
        playTimelineEntries(entries, current, () => finishTurn(commandPromptState(current)));
      };
      const playSendOut = (): void => {
        if (!sendOut) {
          toCommandPrompt();
          return;
        }
        hooks.onDirectorState(sendOut);
        hooks.onSyncView();
        delay(toCommandPrompt, BATTLE_INTRO_MS);
      };
      delay(() => {
        if (!foeSendOut) {
          playSendOut();
          return;
        }
        hooks.onDirectorState({ step: "intro", trainerSendOut: "foe", lines: [foeSendOut], activeActorRecordId: snapshot.activeActorId });
        hooks.onSyncView();
        delay(playSendOut, BATTLE_INTRO_MS);
      }, hooks.introHoldMs?.(snapshot) ?? BATTLE_INTRO_MS);
    },
    runAfterActorCommand(command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): void {
      clearTimers();
      setBusy(true);
      const setupEntries = before.timeline.slice(consumedTimeline);
      const commandStart = Math.max(consumedTimeline, before.timeline.length);
      const commandEntries = after.timeline.slice(commandStart);
      consumedTimeline = after.timeline.length;
      const actingState = actorCommandDirectorState(command, before, after, { describeEffectiveness: hooks.describeEffectiveness });
      // 이 명령을 내린 액터의 첫 엔트리를 찾는다 — strict 라운드에서 민첩이 빠른 적이
      // 먼저 움직이면 commandEntries 앞쪽은 적의 행동이다. 대사는 액터 엔트리에 붙인다.
      const commandActorId = before.activeActorId;
      const commandEntryIndex = commandEntries.findIndex(
        (entry) => entry.side === "actor" && entry.userRecordId === commandActorId,
      );
      // 얼음·잠·마비로 못 움직인 차례에 명령 대사(「새싹토의 새싹치기!」)를 붙이면, 결과를 못 찾아 상대의 마지막 타격
      // (「효과가 굉장했다!」)을 빌려 읽었다(2026-10-07 눈 관장전 영상). 그 엔트리는 상태 문장으로 읽힌다.
      // 혼란 자해(userRecordId 를 단 stateUpkeep + 문장)도 같다 — 명령을 못 쓴 차례다.
      const commandHead = commandEntryIndex >= 0 ? commandEntries[commandEntryIndex]! : undefined;
      const commandIncapacitated = commandHead?.kind === "incapacitated" || (commandHead?.kind === "stateUpkeep" && Boolean(commandHead.message));
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
          commandIncapacitated ? undefined : actingState,
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
