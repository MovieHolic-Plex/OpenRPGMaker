import type { EnemyActionCondition, EnemyRecord, Project } from './types';

/** New combat references participate in the same load/delete/rename contracts. */
export function enemyCombatConditions(enemy: EnemyRecord): EnemyActionCondition[] {
  return [...enemy.actions.map(action => action.condition), ...(enemy.rewards.drops ?? []).map(drop => drop.condition)];
}

export function combatReferenceIssues(project: Project): string[] {
  const items = new Set(project.database.items.map(item => item.id));
  const states = new Set(project.database.states.map(state => state.id));
  const switches = new Set(project.switches.map(entry => entry.id));
  const issues: string[] = [];
  for (const enemy of project.database.enemies) {
    for (const drop of enemy.rewards.drops ?? []) {
      if (!items.has(drop.itemId)) issues.push(`enemy ${enemy.id}: drop item does not exist: ${drop.itemId}`);
    }
    for (const condition of enemyCombatConditions(enemy)) {
      if (condition.kind === 'status' && !states.has(condition.stateId)) issues.push(`enemy ${enemy.id}: condition state does not exist: ${condition.stateId}`);
      if (condition.kind === 'switch' && !switches.has(condition.switchId)) issues.push(`enemy ${enemy.id}: condition switch does not exist: ${condition.switchId}`);
    }
  }
  return issues;
}
