/**
 * 타격의 세기 — 피해량이 대상 최대 HP 의 몇 %인가로 정한다.
 *
 * 왜(2026-09-03): 잽과 필살기가 같은 ±7px 흔들림·같은 밝기·같은 페이드였다. 위력을 숫자로만 읽어야
 * 해서 "전투가 심플하다" 로 느껴진 두 번째 원인이다. 시퀀서의 `weight`(light/normal/heavy) 는 **시간**
 * (비트 길이)을 조절하고, 여기의 세기는 **공간**(넉백·찌그러짐·화면 펀치·흔들림 진폭)을 조절한다.
 * 둘을 합치면 같은 스킬도 상대의 체력에 따라 다르게 보인다.
 */
import type { DamageFeedback } from "@/player/battleSequencer";

export type BattleHitIntensity = "graze" | "normal" | "heavy" | "crushing";

/** 세기별 표현 파라미터. 넉백·찌그러짐은 대상 노드, 펀치·흔들림은 무대. */
export interface BattleHitIntensityStyle {
  /** 대상이 밀리는 거리(논리 px). 방향은 CSS 가 스킨·진영에 맞게 정한다. */
  readonly knockbackPx: number;
  /** 찌그러짐 비율(0.06 = 가로 +6%, 세로 −6%). */
  readonly squash: number;
  /** 무대 펀치(순간 확대) 배율. 1 이면 없음. */
  readonly punchScale: number;
  /** 화면 흔들림 진폭(논리 px). 0 이면 흔들지 않는다. */
  readonly shakePx: number;
}

export const HIT_INTENSITY_STYLE: Readonly<Record<BattleHitIntensity, BattleHitIntensityStyle>> = {
  graze: { knockbackPx: 10, squash: 0.02, punchScale: 1, shakePx: 0 },
  normal: { knockbackPx: 26, squash: 0.06, punchScale: 1, shakePx: 0 },
  heavy: { knockbackPx: 40, squash: 0.1, punchScale: 1.03, shakePx: 6 },
  crushing: { knockbackPx: 54, squash: 0.15, punchScale: 1.05, shakePx: 10 },
};

/** 최대 HP 대비 피해 비율의 경계. */
const GRAZE_RATIO = 0.08;
const HEAVY_RATIO = 0.3;
const CRUSHING_RATIO = 0.6;

/**
 * 빗나감·회복·0 피해는 세기가 없다(undefined). 막타(lethal)는 비율과 무관하게 crushing,
 * 급소는 최소 heavy — 급소·막타를 크게 눌러 잡는 시퀀서 weight 와 같은 판단이다.
 */
export function hitIntensity(
  feedback: Pick<DamageFeedback, "amount" | "critical" | "miss" | "healing" | "blocked">,
  targetMaxHp: number,
  lethal = false
): BattleHitIntensity | undefined {
  if (feedback.miss || feedback.healing || feedback.blocked || feedback.amount <= 0) return undefined;
  if (lethal) return "crushing";
  const ratio = feedback.amount / Math.max(1, targetMaxHp);
  if (ratio >= CRUSHING_RATIO) return "crushing";
  if (feedback.critical || ratio >= HEAVY_RATIO) return "heavy";
  if (ratio < GRAZE_RATIO) return "graze";
  return "normal";
}

/** 대상 노드에 심는 CSS 변수. 넉백 방향은 CSS 가 정하므로 크기만 준다. */
export function hitIntensityTargetVariables(intensity: BattleHitIntensity): Readonly<Record<string, string>> {
  const style = HIT_INTENSITY_STYLE[intensity];
  return {
    "--hit-knockback": `${style.knockbackPx}px`,
    "--hit-squash": String(style.squash),
  };
}

/** 무대(씬 루트)에 심는 CSS 변수. */
export function hitIntensityStageVariables(intensity: BattleHitIntensity): Readonly<Record<string, string>> {
  const style = HIT_INTENSITY_STYLE[intensity];
  return {
    "--hit-punch": String(style.punchScale),
    "--battle-shake-x": `${style.shakePx}px`,
    "--battle-shake-y": `${Math.round(style.shakePx * (2 / 3) * 100) / 100}px`,
  };
}

export const HIT_INTENSITY_TARGET_VARIABLES = ["--hit-knockback", "--hit-squash"] as const;
