// 홀드 가드(방어) 순수 규칙.
// 가드 키를 누르고 있는 동안 들어오는 피해가 줄지만, 그 대가로 스태미나가 계속 탄다.
// 스태미나가 0 이면 가드가 열리지 않고 피해를 그대로 받는다(무료 무적 금지).
// 회피 무적 창과는 겹치지 않는다 — 둘 중 하나만 선다.
// Phaser·씬 접근 없음: 남은 스태미나/감소율/드레인/경과 시간/입력만 받는다.

/** 저자가 아무리 크게 적어도 여기까지만 깎는다 — 완전 무적 가드 금지. */
export const GUARD_MAX_DAMAGE_REDUCTION_PERCENT = 90;

export interface GuardStepInput {
  /** 현재 남은 스태미나. */
  readonly stamina: number;
  /** 가드 중 피해 감소율(%). 0..GUARD_MAX_DAMAGE_REDUCTION_PERCENT 로 클램프. */
  readonly reductionPercent: number;
  /** 가드 유지 초당 스태미나 소모. 음수는 0. */
  readonly drainPerSec: number;
  /** 이번 프레임 경과 시간(ms). */
  readonly deltaMs: number;
  /** 이번 프레임 가드 키가 눌려 있는가. */
  readonly requested: boolean;
  /** 회피 무적 창이 열려 있는가. 열려 있으면 가드는 서지 않는다. */
  readonly dodging: boolean;
}

export interface GuardStepOutcome {
  /** 이번 프레임 가드가 성립했는가. */
  readonly guarding: boolean;
  /** 드레인을 반영한 남은 스태미나. */
  readonly stamina: number;
  /** 이번 프레임 피해 배수(1 = 감소 없음). */
  readonly damageMultiplier: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampGuardReductionPercent(percent: number): number {
  const value = finite(percent);
  return Math.min(GUARD_MAX_DAMAGE_REDUCTION_PERCENT, Math.max(0, value));
}

export function resolveGuardStep(input: GuardStepInput): GuardStepOutcome {
  const stamina = Math.max(0, finite(input.stamina));
  // 빈 스태미나·회피 중·입력 없음 → 가드 없음. 드레인도 없다.
  if (!input.requested || input.dodging || stamina <= 0) {
    return { guarding: false, stamina, damageMultiplier: 1 };
  }
  const drainPerSec = Math.max(0, finite(input.drainPerSec));
  const deltaMs = Math.max(0, finite(input.deltaMs));
  const drained = Math.max(0, stamina - (drainPerSec * deltaMs) / 1000);
  const reduction = clampGuardReductionPercent(input.reductionPercent);
  return { guarding: true, stamina: drained, damageMultiplier: 1 - reduction / 100 };
}

/** 가드 배수를 실제 피해에 적용한다. 0 피해는 그대로, 그 외에는 최소 1 은 들어간다. */
export function guardedDamage(damage: number, multiplier: number): number {
  const incoming = finite(damage);
  if (incoming <= 0) return 0;
  const scale = Math.min(1, Math.max(0, finite(multiplier, 1)));
  return Math.max(1, Math.round(incoming * scale));
}
