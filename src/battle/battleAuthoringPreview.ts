import { combatConditionMet } from "@/battle/combatConditions";
import { startStateOf } from "@/project/session";
import { actorBattlers, battlerSnapshot, enemyBattlers } from "@/battle/battleBattlers";
import { elementMultiplierFor, predictAttackDamage, predictSkillDamageFor } from "@/battle/battlePredict";
import { type BattleRow } from "@/battle/battleFormation";
import { battleSkillUseFailure, battleSkillUseFailureLabel } from "@/battle/battleSkillUse";
import { battlerTypes, gen1TypeModifiersForTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { Project, TroopRecord } from "@/project/types";

/** Authoring what-if only: candidates, never a promise of the runtime AI's choice. */
export function troopAuthoringPreview(project: Project, troop: TroopRecord, input: {
  memberIndex: number; actorId: string; turn: number; hpPercent?: number; mpPercent: number; row: BattleRow;
}) {
  const member = troop.members?.[input.memberIndex] ?? (troop.enemyIds?.[input.memberIndex] ? { enemyId: troop.enemyIds[input.memberIndex]!, x: 80, y: 80 } : undefined);
  if (!member || !project.database.enemies.some(e => e.id === member.enemyId)) return undefined;
  const enemy = enemyBattlers(project, { ...troop, members: [member] })[0];
  const actor = project.database.actors.some(a => a.id === input.actorId)
    ? actorBattlers(project, { partyActorIds: [input.actorId], rows: { [input.actorId]: input.row } })[0] : undefined;
  if (!enemy) return undefined;
  enemy.hp = Math.floor(enemy.maxHp * Math.max(0, Math.min(100, input.hpPercent ?? 100)) / 100);
  // Same initial switch seed as startSession; this is not a live battle observation.
  const start = startStateOf(project);
  const switches: Record<string, boolean> = Object.fromEntries(project.switches.map(sw => [sw.id, start.switches?.[sw.id] ?? false]));
  for (const [id, value] of Object.entries(project.flags)) if (!(id in switches)) switches[id] = value;
  const members = troop.members?.length ? troop.members : (troop.enemyIds ?? []).map(enemyId => ({ enemyId, hidden: false }));
  const livingAllies = members.filter((ally, index) => index !== input.memberIndex && !ally.hidden
    && project.database.enemies.some(record => record.id === ally.enemyId)).length;
  enemy.mp = Math.floor(enemy.maxMp * Math.max(0, Math.min(100, input.mpPercent)) / 100);
  const target = actor ? battlerSnapshot(actor) : undefined;
  const source = battlerSnapshot(enemy);
  const record = normalizeEnemyRecord(project.database.enemies.find(e => e.id === enemy.recordId)!);
  const actions = record.actions.map((action, index) => {
    const condition = action.condition;
    const conditionMatches = combatConditionMet(condition, enemy, input.turn, livingAllies, switches);
    const skill = project.database.skills.find(s => s.id === action.skillId);
    const failure = action.skillId ? battleSkillUseFailure(project, enemy, action.skillId, { requireLearned: false }) : undefined;
    const reason = !conditionMatches ? (condition.kind === "turn" ? "턴 조건 불일치" : "조건 불일치") : failure ? battleSkillUseFailureLabel(failure, skill, enemy) : undefined;
    const damage = !target ? undefined : !action.skillId ? predictAttackDamage(project, source, target)
      : skill?.effect.kind === "damage" && (skill.scope === "enemy" || skill.scope === "allEnemies")
        ? predictSkillDamageFor(project, source, skill, target).amount : undefined;
    return { index, action, name: skill?.name ?? (action.skillId || "일반 공격"), reason,
      damage };
  });
  const elements = (project.database.elements ?? []).map(element => {
    const types = battlerTypes(project, source);
    const actorTypes = target ? battlerTypes(project, target) : [];
    const multiplier = project.system.battleModel === "gen1"
      ? gen1TypeModifiersForTypes(project, element.id, [], types).typeFactors.reduce((n, f) => n * f / 10, 1)
      : elementMultiplierFor(project, element.id, source.recordId, source) * typeChartMultiplierForTypes(project, element.id, actorTypes, types);
    return { id: element.id, name: element.name, grade: record.elementRates[element.id], multiplier };
  });
  return { enemyName: source.name, actions, elements, actorName: target?.name, hp: enemy.hp, maxHp: enemy.maxHp, livingAllies, mp: enemy.mp, maxMp: enemy.maxMp };
}
