import type { ItemRecord, Project, SkillMpCost } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { nextSessionRandom } from "@/project/session";
import { activeItemEffects, itemAllowsMenu } from "@/project/itemUsage";
import { monsterCurrentHp, monsterMaxHp, normalizeMonsterInstanceBattleState } from "@/project/monsterCollection";

/** Field medicine follows the same unrestricted-monster contract as battle.
 * Actor/class-restricted medicine remains authored for actors only. */
export function targetsPartyMonsters(project: Project, item: ItemRecord): boolean {
  return (project.system.battleParty === "monsters" || project.system.monsterBattleParty === true)
    && item.type === "medicine" && (item.scope === "ally" || item.scope === "allAllies");
}

/** One explicit move-PP effect shared by field and battle medicine. Missing PP
 * entries mean full PP, exactly as move execution and monster normalization do. */
export function restoredMovePp(project: Project, skillIds: readonly string[], current: Readonly<Record<string, number>> | undefined, recovery?: SkillMpCost) {
  const skillPp = { ...current };
  let before = 0, after = 0, maximum = 0;
  for (const id of new Set(skillIds)) {
    const max = project.database.skills.find(skill => skill.id === id)?.maxPp;
    if (max === undefined || max <= 0) continue;
    const old = Math.max(0, Math.min(max, Math.trunc(current?.[id] ?? max)));
    const next = Math.min(max, old + (recovery ? recoveryAmount(recovery, max) : 0));
    if (next !== old) skillPp[id] = next;
    before += old; after += next; maximum += max;
  }
  return { skillPp, before, after, maximum, changed: after > before };
}

export function previewMonsterMedicine(project: Project, session: Pick<PlaySession, "monsterParty" | "monsterInstances" | "inventory">, authored: ItemRecord, instanceId: string) {
  const item = activeItemEffects(authored);
  const instance = session.monsterInstances?.[instanceId];
  const normalized = instance ? normalizeMonsterInstanceBattleState(project, instance) : undefined;
  const hp = monsterCurrentHp(project, normalized), maxHp = monsterMaxHp(project, normalized);
  const states = normalized?.stateIds ?? [];
  const healIds = healedStateIds(item);
  const curedStateIds = states.filter(id => healIds.has(id));
  const hpAfter = Math.min(maxHp, hp + recoveryAmount(item.hpRecovery, maxHp));
  const pp = restoredMovePp(project, normalized?.skillIds ?? [], normalized?.skillPp, item.ppRecovery);
  let reason: string | undefined;
  if (!targetsPartyMonsters(project, item)) reason = "이 아이템은 몬스터에게 사용할 수 없습니다";
  else if (!normalized || !session.monsterParty?.includes(instanceId)) reason = "파티 몬스터를 선택하세요";
  else if (item.usableActorIds.length || item.usableClassIds.length) reason = "특정 배우에게만 사용할 수 있습니다";
  else if (!itemAllowsMenu(item)) reason = "필드에서 사용할 수 없는 아이템입니다";
  else if ((session.inventory[item.id] ?? 0) <= 0) reason = "아이템이 없습니다";
  else if (item.onlyEffectiveOnDeadActors && hp > 0) reason = "전투불능 대상에게만 사용할 수 있습니다";
  else if (!item.onlyEffectiveOnDeadActors && hp <= 0) reason = "전투불능 상태입니다";
  else if (hpAfter === hp && !pp.changed && curedStateIds.length === 0 && !inflictEffects(project, item, states).length) reason = "적용할 효과가 없습니다";
  return { reason, hp, maxHp, hpAfter: reason ? hp : hpAfter, pp: pp.before, maxPp: pp.maximum, ppAfter: reason ? pp.before : pp.after, stateIds: states, curedStateIds: reason ? [] : curedStateIds };
}

/** Applies recovery to one live party instance; inventory consumption belongs
 * to the calling command, once even when scope is allAllies. */
export function applyMonsterMedicine(project: Project, session: PlaySession, item: ItemRecord, instanceId: string): boolean {
  const preview = previewMonsterMedicine(project, session, item, instanceId);
  if (preview.reason) return false;
  const raw = session.monsterInstances[instanceId]!;
  const instance = normalizeMonsterInstanceBattleState(project, raw);
  const pp = restoredMovePp(project, instance.skillIds ?? [], instance.skillPp, item.ppRecovery);
  const states = [...(instance.stateIds ?? [])].filter(id => !preview.curedStateIds.includes(id));
  for (const effect of inflictEffects(project, item, states)) {
    // Preserve Gen1's mutually exclusive major-status contract in field use.
    const status = project.database.states.find(state => state.id === effect.stateId)?.gen1MajorStatus;
    if (project.system.battleModel === "gen1" && status && states.some(id => project.database.states.find(state => state.id === id)?.gen1MajorStatus)) continue;
    if (effect.chance < 100 && nextSessionRandom(session, "battle") * 100 >= effect.chance) continue;
    states.push(effect.stateId);
  }
  const changed = preview.hpAfter !== preview.hp || pp.changed || states.length !== (instance.stateIds?.length ?? 0)
    || states.some((id, i) => id !== instance.stateIds?.[i]);
  if (!changed) return false;
  const stateTurns = { ...instance.stateTurns };
  for (const id of preview.curedStateIds) delete stateTurns[id];
  for (const id of states) if (!instance.stateIds?.includes(id)) stateTurns[id] = 0;
  session.monsterInstances[instanceId] = {
    ...instance, currentHp: preview.hpAfter, stateIds: states, stateTurns,
    ...(pp.changed ? { skillPp: pp.skillPp } : {}),
  };
  return true;
}

function healedStateIds(item: ItemRecord): Set<string> {
  return new Set([...item.healStateIds, ...item.stateEffects.filter(effect => effect.operation === "remove").map(effect => effect.stateId)]);
}

function inflictEffects(project: Project, item: ItemRecord, states: readonly string[]) {
  return item.stateEffects.filter(effect => effect.operation === "add" && effect.chance > 0 && !states.includes(effect.stateId)
    && project.database.states.some(state => state.id === effect.stateId));
}

function recoveryAmount(recovery: SkillMpCost, max: number): number {
  return Math.max(0, Math.floor(max * recovery.percentMax / 100) + recovery.flat);
}
