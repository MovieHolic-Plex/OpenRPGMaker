// ai/v2/monsterRouteLevels.ts
// 몬스터 원정 끝맺음: 길(route) 야생·트레이너 레벨을 다음 관문(체육관 관장) 레벨 곡선에 맞춘다. 순수 함수(프로젝트를 고친다), 결정적·멱등.
//
// 왜(2026-10-29 standin monster 「새싹 몬스터 모험」): 스타터 Lv8 에 1번길 야생 Lv2~4·트레이너 Lv3~4 — 세 판을 이겨도 레벨이 그대로였고
// 다음 관문(관장 Lv7)까지 길에서 키울 수가 없었다(런타임 QA 에서 관측탑 보스를 진 판). 길은 직전 관문(첫 길은 스타터) 레벨 조금 아래에서
// 다음 관문 바로 아래까지 오르는 곡선 위에 있어야 한다.
//
// 규칙: 길마다 다음 관문 = 그 길과 이동 명령으로 바로 이어진 배지 마을 중 원정 순서가 가장 앞선 배지(없으면 첫 배지). 직전 레벨 P = 스타터 레벨
// (첫 배지) 또는 앞 배지 관장 레벨, 관문 레벨 G = 배지를 켜는 이벤트가 싸우는 트룹의 가장 높은 적 레벨. 곡선 [lo, hi] = [max(1, min(P,G)-2),
// max(lo, G-1)]. 길의 가장 높은 레벨(야생 levelMax·트레이너 적 레벨)이 lo 보다 낮을 때만 길 전체를 lo 로 올린다 — 각 항목은 길의 가장 낮은 레벨에서
// 떨어진 만큼 lo 위에 두고 hi 에서 자른다. 이미 곡선 위·안이면 손대지 않는다(두 번 불러도 같다).
// 적 레코드(종 몬스터)는 그 레벨의 능력치·기술로 다시 계산하고(speciesEnemyAtLevel, 야생 굴림과 같은 계산) 경험치는 레벨 비로 맞춘다.
// 다른 맵 트룹에도 쓰이는 적 레코드는 건드리지 않는다.
import { speciesEnemyAtLevel } from "@/battle/battleBattlers";
import type { EnemyRecord, GameMap, Project } from "@/project/types";

type Obj = Record<string, unknown>;

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (!node || typeof node !== "object") return;
  const cmd = node as Obj;
  visit(cmd);
  for (const value of Object.values(cmd)) if (value && typeof value === "object") walk(value, visit);
}

function starterLevel(project: Project): number | undefined {
  let level: number | undefined;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (level === undefined && cmd.kind === "giveMonster" && typeof cmd.speciesId === "string") level = typeof cmd.level === "number" && cmd.level > 0 ? cmd.level : 5;
  });
  return level;
}

function troopMaxLevel(project: Project, troopId: string): number | undefined {
  const levels = (project.database.troops.find((troop) => troop.id === troopId)?.enemyIds ?? [])
    .map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.level)
    .filter((level): level is number => typeof level === "number" && level > 0);
  return levels.length ? Math.max(...levels) : undefined;
}

/** 배지 스위치를 켜는 이벤트가 싸우는 트룹들의 가장 높은 적 레벨 — 관장 레벨. */
function gateLevel(project: Project, badgeSwitchId: string): number | undefined {
  let best: number | undefined;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const troops: string[] = [];
    let sets = false;
    walk(event.pages, (cmd) => {
      if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") troops.push(cmd.troopId);
      if (cmd.kind === "setSwitch" && cmd.switchId === badgeSwitchId && cmd.value !== false) sets = true;
    });
    if (!sets) continue;
    for (const troopId of troops) { const level = troopMaxLevel(project, troopId); if (level !== undefined) best = Math.max(best ?? 0, level); }
  }
  return best;
}

function transfersBetween(a: GameMap, bId: string): boolean {
  let found = false;
  for (const event of a.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "transfer" && cmd.mapId === bId) found = true; });
  return found;
}

/** 길 맵의 트레이너 트룹(그 맵 이벤트가 싸우는 트룹 중 조우표가 아닌 것). */
function routeTrainerTroops(map: GameMap): string[] {
  const wild = new Set((map.encounterTable ?? []).map((entry) => entry.troopId));
  const out = new Set<string>();
  for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && !wild.has(cmd.troopId)) out.add(cmd.troopId);
  });
  return [...out];
}

/** 적 레코드를 쓰는 트룹들이 놓인 맵(조우표·전투 명령). */
function enemyHomeMaps(project: Project): Map<string, Set<string>> {
  const troopMaps = new Map<string, Set<string>>();
  const note = (troopId: string, mapId: string) => troopMaps.set(troopId, (troopMaps.get(troopId) ?? new Set()).add(mapId));
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) note(entry.troopId, map.id);
    for (const event of map.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") note(cmd.troopId, map.id); });
  }
  const out = new Map<string, Set<string>>();
  for (const troop of project.database.troops) for (const enemyId of troop.enemyIds) {
    const maps = out.get(enemyId) ?? new Set<string>();
    for (const mapId of troopMaps.get(troop.id) ?? []) maps.add(mapId);
    out.set(enemyId, maps);
  }
  return out;
}

function relevel(project: Project, enemy: EnemyRecord, level: number): void {
  const moved = speciesEnemyAtLevel(project, enemy, level);
  if (!moved) return;
  const old = enemy.level && enemy.level > 0 ? enemy.level : level;
  const exp = enemy.rewards?.exp;
  const index = project.database.enemies.findIndex((entry) => entry.id === enemy.id);
  project.database.enemies[index] = {
    ...enemy,
    level: moved.level,
    stats: moved.stats,
    skillIds: moved.skillIds,
    actions: moved.actions,
    ...(enemy.rewards && typeof exp === "number" ? { rewards: { ...enemy.rewards, exp: Math.max(0, Math.round(exp * level / old)) } } : {}),
  };
}

export function fitRouteLevelsToGates(project: Project): string[] {
  const campaign = project.system.monsterCampaign;
  const badges = campaign?.badges ?? [];
  const starter = starterLevel(project);
  if (!campaign || !badges.length || starter === undefined) return [];
  const gates = badges.map((badge) => ({ badge, level: gateLevel(project, badge.switchId) }));
  const homes = enemyHomeMaps(project);
  const out: string[] = [];
  for (const location of campaign.locations.filter((entry) => entry.kind === "route")) {
    const map = project.maps[location.mapId];
    if (!map) continue;
    const index = Math.max(0, gates.findIndex(({ badge }) => {
      const city = project.maps[badge.cityMapId];
      return !!city && (transfersBetween(map, city.id) || transfersBetween(city, map.id));
    }));
    const gate = gates[index]?.level;
    if (gate === undefined) continue;
    const prev = index === 0 ? starter : gates[index - 1]?.level ?? starter;
    const lo = Math.max(1, Math.min(prev, gate) - 2);
    const hi = Math.max(lo, gate - 1);
    const entries = map.encounterTable ?? [];
    const trainerEnemies = routeTrainerTroops(map)
      .flatMap((troopId) => project.database.troops.find((troop) => troop.id === troopId)?.enemyIds ?? [])
      .map((id) => project.database.enemies.find((enemy) => enemy.id === id))
      .filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level > 0);
    const wildLevels = entries.flatMap((entry) => {
      const levels = (project.database.troops.find((troop) => troop.id === entry.troopId)?.enemyIds ?? []).map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.level).filter((level): level is number => typeof level === "number" && level > 0);
      const min = entry.levelMin ?? (levels.length ? Math.min(...levels) : undefined);
      const max = entry.levelMax ?? (levels.length ? Math.max(...levels) : undefined);
      return min !== undefined && max !== undefined ? [min, max] : [];
    });
    const all = [...wildLevels, ...trainerEnemies.map((enemy) => enemy.level!)];
    if (!all.length || Math.max(...all) >= lo) continue;
    const floor = Math.min(...all);
    const lift = (level: number) => Math.min(hi, lo + (level - floor));
    const own = (enemyId: string) => [...(homes.get(enemyId) ?? [])].every((mapId) => mapId === map.id);
    for (const entry of entries) {
      const troop = project.database.troops.find((item) => item.id === entry.troopId);
      const levels = (troop?.enemyIds ?? []).map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.level).filter((level): level is number => typeof level === "number" && level > 0);
      const min = lift(entry.levelMin ?? (levels.length ? Math.min(...levels) : floor));
      const max = Math.max(min, lift(entry.levelMax ?? (levels.length ? Math.max(...levels) : floor)));
      entry.levelMin = min;
      entry.levelMax = max;
      for (const enemyId of troop?.enemyIds ?? []) {
        const enemy = project.database.enemies.find((item) => item.id === enemyId);
        if (enemy && own(enemyId)) relevel(project, enemy, min);
      }
    }
    for (const enemy of trainerEnemies) if (own(enemy.id)) relevel(project, enemy, lift(enemy.level!));
    out.push(`길 「${map.name ?? map.id}」 몬스터 레벨 ${floor}~${Math.max(...all)} → ${lo}~${hi}(시작 Lv${prev} → 관문 Lv${gate})`);
  }
  return out;
}
