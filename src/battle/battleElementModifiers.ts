import { resolveDamageTypeRate, stateDamageTypeRateOverride, stateElementRateOverride } from "@/battle/battleStates";
import { battlerTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { ActorId, EnemyId, Project } from "@/project/types";

type ElementTarget = Pick<MutableBattler | BattleBattlerSnapshot, "recordId" | "stateIds" | "equipmentEffects">;

export function authoredElementMultiplier(project: Project, elementId: string | undefined, recordId: ActorId | EnemyId, target?: ElementTarget): number {
  if (!elementId) return 1;
  const element = project.database.elements?.find(entry => entry.id === elementId);
  if (!element?.damageMultipliers) return 1;
  const rates = project.database.enemies.find(entry => entry.id === recordId)?.elementRates
    ?? project.database.actors.find(entry => entry.id === recordId)?.elementRates;
  const grade = (target ? stateElementRateOverride(project, target, elementId) : undefined) ?? rates?.[elementId];
  if (!grade) return 1;
  const multiplier = element.damageMultipliers[grade as keyof typeof element.damageMultipliers];
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return 1;
  return multiplier / 100 * (target?.equipmentEffects?.elementalDefenseIds.includes(elementId) ? 0.5 : 1);
}

/** 상성 문장(「효과가 굉장했다」)용 배율 — 피해 배율과 같되 **자속 보정(STAB 1.5)은 뺀다**. 3세대도 상성 문장은
 *  방어 쪽 타입만 본다(Cmd_effectivenesssound · gMoveResultFlags). 넣으면 물 몬스터의 물 기술이 늘 「굉장」이 된다. */
export function battleEffectivenessMultiplier(project: Project, elementId: string | undefined, target: MutableBattler | BattleBattlerSnapshot): number {
  return authoredElementMultiplier(project, elementId, target.recordId, target)
    * typeChartMultiplierForTypes(project, elementId, [], battlerTypes(project, target));
}

/**
 * 피해 계열(physical = 공격력 계열, magic = 마력 계열) 받는 피해 배율. 0 이면 무효 — 효과 꼬리표도 이 배율을 곱해 「무효」·「약점!」이 뜬다.
 * 우선순위: 걸린 상태가 이 타격에 대해 값을 정하면(그 상태의 elements[속성] ?? 그 상태의 [계열], 여러 상태면 가장 큰 값) 그 값,
 * 아니면 적 기록의 elements[속성] ?? 적 기록의 [계열], 그것도 없으면 1.
 * 즉 같은 출처 안에서는 속성 예외가 계열 값을 이기고, 상태는 출처째로 적 기본값을 갈아 끼운다.
 * elementId = 맞은 기술의 속성(통상 공격은 무기 속성). 생략하면 속성 예외는 보지 않는다.
 */
export function damageTypeMultiplier(project: Project, kind: "physical" | "magic", target: Pick<MutableBattler | BattleBattlerSnapshot, "recordId" | "stateIds">, elementId?: string): number {
  const override = stateDamageTypeRateOverride(project, target, kind, elementId);
  const base = override ?? resolveDamageTypeRate(project.database.enemies.find((entry) => entry.id === target.recordId)?.damageTypeRates, kind, elementId);
  if (typeof base !== "number" || !Number.isFinite(base)) return 1;
  return Math.max(0, base) / 100;
}

/** RM damage uses the same authored grades, state overrides and type chart in every consumer. */
export function battleElementMultiplier(project: Project, elementId: string | undefined, user: MutableBattler | BattleBattlerSnapshot, target: MutableBattler | BattleBattlerSnapshot): number {
  return authoredElementMultiplier(project, elementId, target.recordId, target)
    * typeChartMultiplierForTypes(project, elementId, battlerTypes(project, user), battlerTypes(project, target));
}
