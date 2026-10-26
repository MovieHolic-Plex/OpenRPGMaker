// project/fieldEnemyClash.ts
// 보이는 필드 적(place_field_enemy 의 심볼 적) 사이의 진영 싸움 — 순수 판정. Phaser/세션을 모른다.
//
// 진영표(set_factions)는 원래 액션 전투의 구역 스폰(FieldSpawnDef.factionId)에만 먹었다. 심볼 적은 맵 이벤트라
// 진영이 없었다. 이벤트에 fieldFactionId 를 단 보이는 적끼리만 이 규칙을 탄다(옛 맵은 그대로).
// 적대(태도 -1 이하)인 두 적이 CLASH_RANGE 칸 안에 들면 짧게 부딪히고, 적 그룹 전력이 약한 쪽이 사라진다.
// 연출·지우기는 player/playSceneFieldEnemyClash.ts.
import { factionStance, type ResolvedFactionTable } from "@/project/factions";
import type { Project } from "@/project/types";

/** 이 맨해튼 거리(칸) 안에 들면 마주쳤다고 본다. */
export const FIELD_ENEMY_CLASH_RANGE = 2;

export interface FieldEnemyClashEntry {
  readonly eventId: string;
  readonly factionId: string;
  readonly x: number;
  readonly y: number;
  /** 전력(적 그룹 능력치 합). 큰 쪽이 이긴다. 같으면 이벤트 id 순서가 앞인 쪽. */
  readonly power: number;
}

export interface FieldEnemyClash {
  readonly winnerId: string;
  readonly loserId: string;
}

/** 적 그룹의 전력: 구성원 HP + 공격·방어·정신·민첩의 4배 합. 그룹이 없으면 0. */
export function troopFieldPower(project: Pick<Project, "database">, troopId: string | undefined): number {
  const troop = troopId ? project.database.troops.find((entry) => entry.id === troopId) : undefined;
  if (!troop) return 0;
  const ids = troop.members?.filter((member) => !member.hidden).map((member) => member.enemyId) ?? troop.enemyIds;
  let power = 0;
  for (const enemyId of ids) {
    const stats = project.database.enemies.find((entry) => entry.id === enemyId)?.stats;
    if (!stats) continue;
    power += stats.maxHp + 4 * (stats.attack + stats.defense + stats.mind + stats.agility);
  }
  return power;
}

/**
 * 이번에 부딪힐 쌍들. 한 적은 한 번에 한 싸움에만 낀다(가까운 쌍부터). 같은 진영·중립·우호는 싸우지 않는다.
 */
export function findFieldEnemyClashes(entries: readonly FieldEnemyClashEntry[], table: ResolvedFactionTable): FieldEnemyClash[] {
  const pairs: { a: FieldEnemyClashEntry; b: FieldEnemyClashEntry; distance: number }[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!, b = entries[j]!;
      if (a.factionId === b.factionId) continue;
      const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (distance > FIELD_ENEMY_CLASH_RANGE) continue;
      if (factionStance(table, a.factionId, b.factionId) > -1) continue;
      pairs.push({ a, b, distance });
    }
  }
  pairs.sort((left, right) => left.distance - right.distance);
  const busy = new Set<string>();
  const clashes: FieldEnemyClash[] = [];
  for (const { a, b } of pairs) {
    if (busy.has(a.eventId) || busy.has(b.eventId)) continue;
    busy.add(a.eventId);
    busy.add(b.eventId);
    const aWins = a.power > b.power || (a.power === b.power && a.eventId < b.eventId);
    clashes.push(aWins ? { winnerId: a.eventId, loserId: b.eventId } : { winnerId: b.eventId, loserId: a.eventId });
  }
  return clashes;
}
