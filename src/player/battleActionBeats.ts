import type { DamageFeedback } from "@/player/battleSequencer";

/** One timed presentation beat for a resolved battle action. */
export type BattleActionBeatKind = "approach" | "impact" | "recover";

export type BattleUserMotion = "windup" | "lunge" | "return" | "idle";
export type BattleTargetMotion = "knockback" | "idle";

export interface BattleActionBeat {
  readonly kind: BattleActionBeatKind;
  /** Director step stamped while this beat is live. */
  readonly directorStep: "acting" | "impact";
  readonly durationMs: number;
  /** Attacker / caster battler id (enemy id or actor recordId). */
  readonly userId?: string;
  readonly targetId?: string;
  readonly userMotion: BattleUserMotion;
  readonly targetMotion: BattleTargetMotion;
  readonly feedback?: DamageFeedback;
  /** True while the short hit-stop freeze should hold. */
  readonly hitStop: boolean;
}

/**
 * 행동의 무게. 모든 행동이 완전히 같은 3비트(550/120/750)를 타면 "약한 잽"과
 * "필살기"가 같은 리듬·같은 길이가 되고, 위력 차이를 숫자로만 읽어야 한다.
 * 케이던스의 대비가 0 이면 몇 턴 만에 스킵 버튼을 찾게 된다.
 *  - light  : 빗나감 · 0 피해 · 회복. 짧게 지나간다.
 *  - normal : 통상 타격. 기준값 그대로(시퀀서 상수 = normal).
 *  - heavy  : 급소 · 대상을 쓰러뜨린 타격. 크게 눌러 잡는다.
 */
export type BattleActionWeight = "light" | "normal" | "heavy";

const APPROACH_SCALE: Record<BattleActionWeight, number> = { light: 0.72, normal: 1, heavy: 1.28 };
const HITSTOP_SCALE: Record<BattleActionWeight, number> = { light: 0, normal: 1, heavy: 1.9 };
const RECOVER_SCALE: Record<BattleActionWeight, number> = { light: 0.68, normal: 1, heavy: 1.45 };

/** 피드백만 보고 무게를 정한다. 호출자가 명시하면 그 값이 이긴다. */
export function weightForFeedback(feedback: DamageFeedback | undefined, lethal = false): BattleActionWeight {
  if (!feedback) return "light";
  if (feedback.miss || feedback.blocked || feedback.healing || feedback.amount <= 0) return "light";
  if (feedback.critical || lethal) return "heavy";
  return "normal";
}

function scaled(base: number, scale: number): number {
  if (scale === 1) return base;
  return Math.max(0, Math.round(base * scale));
}

export interface PlanActionBeatsInput {
  readonly userId: string;
  readonly targetId?: string;
  readonly feedback?: DamageFeedback;
  readonly actingMs: number;
  readonly hitStopMs: number;
  readonly impactMs: number;
  /** 미지정이면 feedback 에서 유도한다(weightForFeedback). */
  readonly weight?: BattleActionWeight;
}

/**
 * Classic side-view attack cadence:
 * approach (lunge) → impact (popup + hit-stop + knockback) → recover (return).
 * Timing matches the existing sequencer constants so tests stay stable.
 */
export function planActionBeats(input: PlanActionBeatsInput): readonly BattleActionBeat[] {
  const targetId = input.targetId ?? input.feedback?.targetId;
  const damaging =
    Boolean(input.feedback)
    && !input.feedback?.healing
    && !input.feedback?.miss
    && (input.feedback?.amount ?? 0) > 0;
  const miss = input.feedback?.miss === true;
  const weight = input.weight ?? weightForFeedback(input.feedback);

  const approach: BattleActionBeat = {
    kind: "approach",
    directorStep: "acting",
    durationMs: scaled(input.actingMs, APPROACH_SCALE[weight]),
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: "idle",
    hitStop: false,
  };

  const impact: BattleActionBeat = {
    kind: "impact",
    directorStep: "impact",
    // Hit-stop only freezes on a real damaging connect; miss/heal skip the freeze.
    durationMs: damaging ? scaled(input.hitStopMs, HITSTOP_SCALE[weight]) : 0,
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: damaging ? "knockback" : "idle",
    feedback: input.feedback,
    hitStop: damaging,
  };

  const recover: BattleActionBeat = {
    kind: "recover",
    directorStep: "impact",
    durationMs: scaled(input.impactMs, RECOVER_SCALE[weight]),
    userId: input.userId,
    targetId,
    // Misses still read as a short lunge then settle; heals skip knockback already.
    userMotion: miss || damaging || Boolean(input.feedback) ? "return" : "idle",
    targetMotion: "idle",
    hitStop: false,
  };

  return [approach, impact, recover];
}

/** 적 행동의 예고(움츠림) 길이. 짧은 잽(light)은 0.72배, 필살(heavy)은 1.28배로 늘어난다. */
export const ENEMY_WINDUP_MS = 300;

/**
 * 적 행동: windup(움츠림·예고) → impact(전진 + 착탄) → recover.
 *
 * 2026-09-03 전에는 approach 비트가 없어 적 턴이 대사 한 줄 뒤 곧바로 착탄이었다 — 누가 때렸는지
 * 화면에서 읽을 수 없어 "적 턴이 텍스트로만 진행된다" 로 느껴졌다. 움츠림은 `battle-motion-windup`
 * 으로 스프라이트를 살짝 키우고 어둡게 한 뒤(05-poses-motion.css), 착탄 비트의 lunge 로 파티 쪽에
 * 내리찍는다.
 */
export function planEnemyActionBeats(input: {
  readonly userId: string;
  readonly targetId?: string;
  readonly feedback?: DamageFeedback;
  readonly hitStopMs: number;
  readonly impactMs: number;
  readonly weight?: BattleActionWeight;
  /** 미지정이면 ENEMY_WINDUP_MS. 0 이면 예고 비트를 만들지 않는다(옛 2비트 케이던스). */
  readonly windupMs?: number;
}): readonly BattleActionBeat[] {
  const targetId = input.targetId ?? input.feedback?.targetId;
  const damaging =
    Boolean(input.feedback)
    && !input.feedback?.healing
    && !input.feedback?.miss
    && (input.feedback?.amount ?? 0) > 0;
  const weight = input.weight ?? weightForFeedback(input.feedback);
  const windupMs = scaled(input.windupMs ?? ENEMY_WINDUP_MS, APPROACH_SCALE[weight]);
  const windup: BattleActionBeat | undefined = windupMs > 0
    ? {
        kind: "approach",
        directorStep: "acting",
        durationMs: windupMs,
        userId: input.userId,
        targetId,
        userMotion: "windup",
        targetMotion: "idle",
        hitStop: false,
      }
    : undefined;
  const impact: BattleActionBeat = {
    kind: "impact",
    directorStep: "impact",
    durationMs: damaging ? scaled(input.hitStopMs, HITSTOP_SCALE[weight]) : 0,
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: damaging ? "knockback" : "idle",
    feedback: input.feedback,
    hitStop: damaging,
  };
  const recover: BattleActionBeat = {
    kind: "recover",
    directorStep: "impact",
    durationMs: scaled(input.impactMs, RECOVER_SCALE[weight]),
    userId: input.userId,
    targetId,
    userMotion: "return",
    targetMotion: "idle",
    hitStop: false,
  };
  return windup ? [windup, impact, recover] : [impact, recover];
}

/**
 * 애니메이션(후속 포함)이 비트 총합보다 길면 recover 를 늘린다. 시퀀서는 애니메이션을 기다리지 않고
 * 비트 길이로만 시간을 재므로, 이 보정이 없으면 연기·잔광 같은 후속이 다음 엔트리에 잘려 나간다.
 * 반환값은 impactMs 이상이다(짧은 애니메이션이 비트를 줄이지는 않는다).
 */
export function recoverMsForAnimation(
  animationMs: number | undefined,
  actingMs: number,
  hitStopMs: number,
  impactMs: number
): number {
  if (!animationMs || !Number.isFinite(animationMs)) return impactMs;
  return Math.max(impactMs, Math.round(animationMs - actingMs - hitStopMs));
}
