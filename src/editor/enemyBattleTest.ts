import type { Project } from "@/project/types";

/** A disposable encounter for the editor's selected-enemy test. Never enters the store. */
export function prepareEnemyBattleTest(project: Project, enemyId: string): { project: Project; troopId: string } | undefined {
  const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
  if (!enemy) return undefined;
  const snapshot = structuredClone(project);
  let troopId = "editor-enemy-test";
  while (snapshot.database.troops.some((entry) => entry.id === troopId)) troopId += "-";
  snapshot.database.troops.push({
    id: troopId,
    name: enemy.name,
    enemyIds: [enemyId],
    autoAlign: true,
    battleEventPages: [],
  });
  return { project: snapshot, troopId };
}
