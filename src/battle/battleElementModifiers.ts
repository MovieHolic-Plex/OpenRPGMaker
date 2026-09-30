import { stateElementRateOverride } from "@/battle/battleStates";
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

/** RM damage uses the same authored grades, state overrides and type chart in every consumer. */
export function battleElementMultiplier(project: Project, elementId: string | undefined, user: MutableBattler | BattleBattlerSnapshot, target: MutableBattler | BattleBattlerSnapshot): number {
  return authoredElementMultiplier(project, elementId, target.recordId, target)
    * typeChartMultiplierForTypes(project, elementId, battlerTypes(project, user), battlerTypes(project, target));
}
