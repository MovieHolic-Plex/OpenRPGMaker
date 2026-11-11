// 몬스터 원정 읽기 — 스타터 레벨·종, 트룹 경험치·레벨, 관문(체육관) 차례(campaignGates), 길 트레이너, 레벨 다시 매기기(relevel).
import { speciesEnemyAtLevel } from "@/battle/battleBattlers";
import { monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { EnemyRecord, GameMap, Project } from "@/project/types";

export type Obj = Record<string, unknown>;

/**
 * 필수 전투의 남은 HP 띠(모의전 평균, 파티 = 스타터 + 선물 동료). 아래 HP_MARGIN 미만이면 아슬아슬한 승리 — 못 이긴 것으로 친다.
 * 위 HP_EASY(0.8 — 0.85 로는 런타임 물 스타터 1번길 트레이너가 91% 남았다)를 넘는 스타터가 있으면 가장 약한 스타터가 띠 안에 있는 한 상대를 한 레벨씩 올린다(HP_RAISE_CAP 까지).
 * 왜(2026-10-29 「새싹 몬스터 모험」 런타임 표): 띠 아래쪽 0.25 로는 물 스타터가 관장전에서 파티 23%(스타터 0/30)로 이겼고,
 * 위쪽이 없어 1번길 트레이너·관원은 91~97% 가 남았다. 런타임 운(빗나감·급소·상대 AI)이 모의전 평균보다 나쁘게 나오는 몫을 0.35 로 둔다.
 */
export const HP_MARGIN = 0.35;

export const HP_EASY = 0.8;

export const HP_RAISE_CAP = 3;

export function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (!node || typeof node !== "object") return;
  const cmd = node as Obj;
  visit(cmd);
  for (const value of Object.values(cmd)) if (value && typeof value === "object") walk(value, visit);
}

export function starterLevel(project: Project): number | undefined {
  let level: number | undefined;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (level === undefined && cmd.kind === "giveMonster" && typeof cmd.speciesId === "string") level = typeof cmd.level === "number" && cmd.level > 0 ? cmd.level : 5;
  });
  return level;
}

export function starterSpeciesId(project: Project): string | undefined {
  let id: string | undefined;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (id === undefined && cmd.kind === "giveMonster" && typeof cmd.speciesId === "string") id = cmd.speciesId;
  });
  return id;
}

export function loneMonster(project: Project, speciesId: string, level: number): MonsterInstance | null {
  const species = monsterSpeciesById(project, speciesId);
  if (!species) return null;
  return {
    instanceId: `gate_fit_${speciesId}`,
    speciesId,
    level,
    exp: 0,
    skillIds: monsterSkillIdsAtLevel(species, level).filter((id) => project.database.skills.some((skill) => skill.id === id)),
    friendship: 0,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
}

export function troopExp(project: Project, troopId: string): number {
  return (project.database.troops.find((troop) => troop.id === troopId)?.enemyIds ?? [])
    .reduce((sum, id) => sum + Math.max(0, project.database.enemies.find((enemy) => enemy.id === id)?.rewards?.exp ?? 0), 0);
}

export function troopMaxLevel(project: Project, troopId: string): number | undefined {
  const levels = (project.database.troops.find((troop) => troop.id === troopId)?.enemyIds ?? [])
    .map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.level)
    .filter((level): level is number => typeof level === "number" && level > 0);
  return levels.length ? Math.max(...levels) : undefined;
}

/** 배지 스위치를 켜는 이벤트가 싸우는 트룹들의 가장 높은 적 레벨 — 관장 레벨. */
export function gateLevel(project: Project, badgeSwitchId: string): number | undefined {
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

export function transfersBetween(a: GameMap, bId: string): boolean {
  let found = false;
  for (const event of a.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "transfer" && cmd.mapId === bId) found = true; });
  return found;
}

/** 길 맵의 트레이너 트룹(그 맵 이벤트가 싸우는 트룹 중 조우표가 아닌 것). */
export function routeTrainerTroops(map: GameMap): string[] {
  const wild = new Set((map.encounterTable ?? []).map((entry) => entry.troopId));
  const out = new Set<string>();
  for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && !wild.has(cmd.troopId)) out.add(cmd.troopId);
  });
  return [...out];
}

/** 적 레코드를 쓰는 트룹들이 놓인 맵(조우표·전투 명령). */
export function enemyHomeMaps(project: Project): Map<string, Set<string>> {
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

export function relevel(project: Project, enemy: EnemyRecord, level: number): void {
  const moved = speciesEnemyAtLevel(project, enemy, level);
  if (!moved) return;
  // 가르친 기술(⑦ — 그 종이 어느 레벨에서도 배우지 않는 기술)은 레벨을 옮겨도 남긴다.
  const learnset = new Set((monsterSpeciesById(project, enemy.speciesId ?? "")?.skillsByLevel ?? []).map((item) => item.skillId));
  const tutored = (enemy.skillIds ?? []).filter((id) => !learnset.has(id) && !moved.skillIds.includes(id));
  if (tutored.length) {
    moved.skillIds = [...moved.skillIds.filter((id) => !tutored.includes(id)).slice(-(4 - tutored.length)), ...tutored];
    const keep = new Set(moved.skillIds);
    moved.actions = [...moved.actions.filter((action) => !action.skillId || keep.has(action.skillId)), ...(enemy.actions ?? []).filter((action) => action.skillId && tutored.includes(action.skillId))];
  }
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

/** 원정 목표 스위치를 켜는 이벤트가 싸우는 트룹(목표 순서대로, 전투 없는 목표는 빠진다)과 그 맵. */
export function campaignGates(project: Project): { switchId: string; mapIds: Set<string>; troopIds: string[] }[] {
  const out: { switchId: string; mapIds: Set<string>; troopIds: string[] }[] = [];
  for (const objective of project.system.monsterCampaign?.objectives ?? []) {
    const troopIds = new Set<string>();
    const mapIds = new Set<string>();
    for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
      const troops: string[] = [];
      let sets = false;
      walk(event.pages, (cmd) => {
        if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") troops.push(cmd.troopId);
        if (cmd.kind === "setSwitch" && cmd.switchId === objective.switchId && cmd.value !== false) sets = true;
      });
      if (!sets || !troops.length) continue;
      for (const troopId of troops) troopIds.add(troopId);
      mapIds.add(map.id);
    }
    if (troopIds.size) out.push({ switchId: objective.switchId, mapIds, troopIds: [...troopIds] });
  }
  return out;
}
