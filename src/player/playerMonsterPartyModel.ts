import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterBattlePartyOf, monsterBattleStats, monsterCurrentHp, monsterDisplayName, monsterMaxHp, normalizeMonsterInstanceBattleState } from "@/project/monsterCollection";
import { restoredMovePp } from "@/project/monsterMedicine";
import type { MonsterInstance, PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export function usesMonsterParty(project: Project): boolean {
  return project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
}

export function monsterTypeLabel(project: Project, types: readonly string[] | undefined): string {
  return (types ?? []).map(id => project.database.elements.find(element => element.id === id)?.name ?? id).join(" / ") || "미분류";
}

/** Localize authored '<element id> 타입' tokens without changing arbitrary prose. */
export function monsterMoveDescription(project: Project, description: string | undefined): string | undefined {
  if (!description) return description;
  return description.replace(/([^\s/·]+)(\s+타입)/g, (token, id: string, suffix: string) => {
    const element = project.database.elements.find(record => record.id === id);
    return element ? element.name + suffix : token;
  });
}

export function monsterPartyEntries(project: Project, session: Pick<PlaySession, "monsterParty" | "monsterInstances">) {
  return monsterBattlePartyOf(project, session).party.map(instance => monsterUiEntry(project, instance));
}

export function monsterUiEntry(project: Project, raw: MonsterInstance) {
  const instance = normalizeMonsterInstanceBattleState(project, raw);
  const species = project.database.monsterSpecies?.find(record => record.id === instance.speciesId);
  const maxHp = monsterMaxHp(project, instance), hp = monsterCurrentHp(project, instance);
  const pp = restoredMovePp(project, instance.skillIds ?? [], instance.skillPp);
  const curve = species?.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const base = totalExpForLevel(curve, instance.level), next = totalExpForLevel(curve, instance.level + 1);
  return {
    instance, species, name: monsterDisplayName(project, instance), hp, maxHp, pp,
    typeLabel: monsterTypeLabel(project, species?.types), stats: monsterBattleStats(project, instance),
    stateNames: hp <= 0 ? ["전투불능"] : (instance.stateIds ?? []).map(id => project.database.states.find(state => state.id === id)?.name ?? id),
    nextLevel: instance.level < 99 && next > base
      ? { remaining: Math.max(0, next - instance.exp), ratio: Math.max(0, Math.min(1, (instance.exp - base) / (next - base))) } : undefined,
  };
}

export function monsterBoxUnavailableReason(project: Project, session: Pick<PlaySession, "monsterParty" | "monsterInstances">, instanceId: string): string | undefined {
  return usesMonsterParty(project) && session.monsterParty.includes(instanceId)
    && monsterBattlePartyOf(project, session).party.length <= 1
    ? "마지막 파티 몬스터는 보관할 수 없습니다. 먼저 다른 몬스터를 파티로 데려오세요." : undefined;
}

/** Optional sibling icon resource; existing packs keep their authored front fallback. */
export function monsterMenuIconResourceId(project: Project, frontId: string | undefined): string | undefined {
  if (!frontId || !isEmeraldMonsterStyle(project)) return frontId;
  const iconId = frontId.replace(/_front$/u, "_icon");
  return iconId !== frontId && resolveAssetResourceUrl(iconId, { project }) ? iconId : frontId;
}
