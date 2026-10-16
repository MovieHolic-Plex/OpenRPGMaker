import type { Project } from "@/project/types";

/**
 * 도감 종 speciesId 의 야생 무리 id. 낚시처럼 「이 종과 싸운다」만 정해진 조우가 어느 무리로 싸울지 고른다.
 * 트레이너 무리는 제외하고, 그 종 하나만 나오는 무리를 먼저(`define_monster_families spawn` 이 만드는 `troop_wild_<종>` 이 그렇다), 없으면 그 종이 낀 무리를 쓴다.
 */
export function wildTroopIdForSpecies(project: Project, speciesId: string): string | undefined {
  const enemySpecies = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy.speciesId] as const));
  let mixed: string | undefined;
  for (const troop of project.database.troops) {
    if (troop.trainerBattle === true) continue;
    const enemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
    if (!enemyIds.some((id) => enemySpecies.get(id) === speciesId)) continue;
    if (enemyIds.every((id) => enemySpecies.get(id) === speciesId)) return troop.id;
    mixed ??= troop.id;
  }
  return mixed;
}
