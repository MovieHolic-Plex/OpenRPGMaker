import type { EnemyActionPattern, SkillRecord } from "@/project/types";

/** Campaign authoring policy. Generic RPG demo turn schedules are inappropriate
 * for zero-MP monster moves: early recovery can erase every earned attack. */
export function expeditionEnemyActions(skillIds: readonly string[], moves: readonly SkillRecord[]): EnemyActionPattern[] {
  return skillIds.map(skillId => {
    const skill = moves.find(move => move.id === skillId);
    const healsHp = skill?.effect.kind === "healing" && skill.effect.affects === "hp";
    return {
      skillId,
      priority: skill?.effect.kind === "damage" ? 6 : 2,
      condition: healsHp ? { kind: "hp", minPercent: 0, maxPercent: 35 } : { kind: "always" },
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    };
  });
}
