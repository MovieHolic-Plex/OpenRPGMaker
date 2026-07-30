import type { MutableBattler } from "@/battle/battleBattlers";
import type { Project } from "@/project/types";
import type { Rng } from "@/util/rng";

// magical 속성의 데미지 감소를 mind(마법 방어력) 로 라우팅할지 판정하는 **단일 권위자**.
// runtime 과 predict 가 반드시 같은 판정을 써야 예측/실제 데미지 parity 가 유지된다.
//
// battleModel === "gen1" 에서만 활성화한다. 이유:
//  - `.omo/plans/pokemon-clone-feature.md` task 1 은 "Must NOT change RM2k3 behavior",
//    task 2 는 "defense mis-wire — **fix in gen1 path**" 를 명시한다.
//  - normalizeElementKind 의 폴백이 "magical" 이고 기본 속성 17개 중 13개가 magical 이므로,
//    게이트 없이 적용하면 저장된 모든 RM2k3 프로젝트의 화염·냉기·번개 데미지가 마이그레이션
//    없이 바뀐다. 실제로 그 상태였다.
export function usesMagicalDefense(project: Project, elementId: string | undefined): boolean {
  if (!elementId) return false;
  if (project.system.battleModel !== "gen1") return false;
  return project.database.elements?.find((entry) => entry.id === elementId)?.kind === "magical";
}

export interface SkillLikeEffect {
  readonly power: number;
  readonly statistic: "attack" | "mind";
  readonly effect: "damage" | "healing" | "support" | "switch";
  // healing/damage 가 적용되는 자원. 기본 hp.
  readonly affects?: "hp" | "mp";
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
  // gen1 모델 + magical 속성인 경우 true — 대상의 mind(마법 방어력) 로 감소시킨다.
  // rm2k3(기본)·physical 속성·무속성이면 defense(물리 방어력) 를 쓴다. usesMagicalDefense() 로 판정.
  readonly useMagicalDefense?: boolean;
  readonly rng?: Rng;
}

export type SkillApplyResult = { hit: boolean; amount: number; critical: boolean };

export function applySkillLike(user: MutableBattler, target: MutableBattler, spec: SkillLikeEffect): SkillApplyResult {
  const baseStat = spec.statistic === "mind" ? user.mind : user.attackPower;
  const stat = Math.round(baseStat * (spec.attackerStatMultiplier ?? 1));
  if (spec.effect === "healing") {
    const result = computeMagnitude(spec.power, target, "heal", stat, spec);
    if (spec.affects === "mp") {
      target.mp = Math.min(target.maxMp, target.mp + result.amount);
    } else {
      target.hp = Math.min(target.maxHp, target.hp + result.amount);
    }
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
  // 마법 속성(kind="magical") 은 mind(마법 방어력) 로 감소, 물리는 defense.
  const baseDefense = spec.useMagicalDefense ? target.mind : target.defense;
  const effectiveDefense = baseDefense * (spec.targetDefenseMultiplier ?? 1);
  magnitude -= Math.floor(effectiveDefense / 2);
  if (target.defending) magnitude = Math.floor(magnitude / 2);
  return { amount: magnitude <= 0 ? 0 : Math.max(1, magnitude), critical };
}

function applyVariance(magnitude: number, spec: SkillLikeEffect): number {
  // 분산(±variance%). 미지정 시 0(고정) — 데미지 공식 문서와 일치.
  const variance = spec.variance ?? 0;
  if (variance <= 0) return magnitude;
  const factor = 1 + ((spec.rng ?? fallbackRng)() * 2 - 1) * (variance / 100);
  return Math.max(1, Math.round(magnitude * factor));
}

function applyDamage(target: MutableBattler, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
}

function fallbackRng(): number {
  throw new Error("applySkillLike requires an rng; pass a deterministic rng for replay/safety.");
}
