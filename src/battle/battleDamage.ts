import type { MutableBattler } from "@/battle/battleBattlers";
import type { Rng } from "@/util/rng";

export interface SkillLikeEffect {
  readonly power: number;
  readonly statistic: "attack" | "mind";
  readonly effect: "damage" | "healing" | "support" | "switch";
  // 명중률(0~100). 기본 100. 데미지 적용 전에 롤하여 빗나가면 0.
  readonly hitRate?: number;
  // 데미지 분산(0~100). ±variance% 범위 랜덤. 기본 0(고정).
  readonly variance?: number;
  // 크리티컬 발동 확률(0~100). 기본 0(발생 안 함).
  readonly criticalRate?: number;
  // 크리티컬 배율. 기본 3(RM2K3).
  readonly criticalMultiplier?: number;
  // 속성 상성 배율. 기본 1.0. 1.5=약점, 0.5=내성 등.
  readonly elementMultiplier?: number;
  // 시전자 능력치 배율(공격 상승 상태 등). 기본 1.0.
  readonly attackerStatMultiplier?: number;
  // 대상 방어력 배율(방어 하락 상태 등). 기본 1.0.
  readonly targetDefenseMultiplier?: number;
  readonly rng?: Rng;
}

export type SkillApplyResult = { hit: boolean; amount: number; critical: boolean };

export function applySkillLike(user: MutableBattler, target: MutableBattler, spec: SkillLikeEffect): SkillApplyResult {
  const baseStat = spec.statistic === "mind" ? user.mind : user.attackPower;
  const stat = Math.round(baseStat * (spec.attackerStatMultiplier ?? 1));
  if (spec.effect === "healing") {
    const result = computeMagnitude(spec.power, target, "heal", stat, spec);
    target.hp = Math.min(target.maxHp, target.hp + result.amount);
    return { hit: true, amount: result.amount, critical: false };
  }
  if (spec.effect === "support" || spec.effect === "switch") return { hit: true, amount: 0, critical: false };
  // 명중 판정(데미지 효과만). hitRate 기본 100.
  const hitRate = spec.hitRate ?? 100;
  const rng = spec.rng ?? fallbackRng;
  if (rng() * 100 >= hitRate) {
    return { hit: false, amount: 0, critical: false };
  }
  const magnitude = computeMagnitude(spec.power, target, "damage", stat, spec);
  if (magnitude.amount < 0) {
    target.hp = Math.min(target.maxHp, target.hp + Math.abs(magnitude.amount));
    return { hit: true, amount: magnitude.amount, critical: false };
  }
  applyDamage(target, magnitude.amount);
  return { hit: true, amount: magnitude.amount, critical: magnitude.critical };
}

function computeMagnitude(
  power: number,
  target: MutableBattler,
  mode: "damage" | "heal",
  sourceStat: number,
  spec: SkillLikeEffect
): { amount: number; critical: boolean } {
  let magnitude = power + Math.floor(sourceStat / 2);
  if (mode === "heal") {
    return { amount: applyVariance(magnitude, spec), critical: false };
  }
  // 속성 상성 배율(기본 1.0)
  const elementMultiplier = spec.elementMultiplier ?? 1;
  magnitude = Math.round(magnitude * elementMultiplier);
  if (elementMultiplier === 0) return { amount: 0, critical: false };
  if (elementMultiplier < 0) return { amount: magnitude, critical: false };
  // 분산(±variance%)
  magnitude = applyVariance(magnitude, spec);
  // 크리티컬(확률×배율)
  const criticalRate = spec.criticalRate ?? 0;
  const critical = criticalRate > 0 && (spec.rng ?? fallbackRng)() * 100 < criticalRate;
  if (critical) {
    magnitude = Math.round(magnitude * (spec.criticalMultiplier ?? 3));
  }
  // 방어 반감 + 대상 방어력(방어 하락 상태 등의 배율 반영)
  const effectiveDefense = target.defense * (spec.targetDefenseMultiplier ?? 1);
  magnitude -= Math.floor(effectiveDefense / 2);
  if (target.defending) magnitude = Math.floor(magnitude / 2);
  return { amount: magnitude <= 0 ? 0 : Math.max(1, magnitude), critical };
}

function applyVariance(magnitude: number, spec: SkillLikeEffect): number {
  const variance = spec.variance ?? 0;
  if (variance <= 0) return magnitude;
  const factor = 1 + ((spec.rng ?? fallbackRng)() * 2 - 1) * (variance / 100);
  return Math.max(1, Math.round(magnitude * factor));
}

function applyDamage(target: MutableBattler, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
}

function fallbackRng(): number {
  return 0.5;
}
