// ai/v2/monsterRouteLevels.ts
// 몬스터 원정 끝맺음: 길(route) 야생·트레이너 레벨을 다음 관문(체육관 관장) 레벨 곡선에 맞춘다. 순수 함수(프로젝트를 고친다), 결정적·멱등.
//
// 왜(2026-10-29 standin monster 「새싹 몬스터 모험」): 스타터 Lv8 에 1번길 야생 Lv2~4·트레이너 Lv3~4 — 세 판을 이겨도 레벨이 그대로였고
// 다음 관문(관장 Lv7)까지 길에서 키울 수가 없었다(런타임 QA 에서 관측탑 보스를 진 판). 길은 직전 관문(첫 길은 스타터) 레벨 조금 아래에서
// 다음 관문 바로 아래까지 오르는 곡선 위에 있어야 한다.
//
// 규칙: 길마다 다음 관문 = 그 길과 이동 명령으로 바로 이어진 배지 마을 중 원정 순서가 가장 앞선 배지(없으면 첫 배지). 직전 레벨 P = 스타터 레벨
// (첫 배지) 또는 앞 배지 관장 레벨, 관문 레벨 G = 배지를 켜는 이벤트가 싸우는 트룹의 가장 높은 적 레벨. 곡선 [lo, hi] = [max(1, min(P,G)-2),
// max(lo, G-1)]. 길의 가장 높은 레벨(야생 levelMax·트레이너 적 레벨)이 lo 보다 낮을 때만 길을 lo 쪽으로 올린다 — 각 항목은 길의 가장 낮은 레벨에서
// 떨어진 만큼 lo 위에 두고 hi 에서 자른다. 단 트룹마다 스타터 혼자(직전 레벨 P)가 모의전(시드 고정) 80% 이상 이기는 데까지만 — 못 이기면 한 레벨씩
// 덜 올린다(타입 상성이 나쁜 길 몬스터는 덜 오른다). 이미 곡선 위·안이면 손대지 않는다(두 번 불러도 같다).
// 적 레코드(종 몬스터)는 그 레벨의 능력치·기술로 다시 계산하고(speciesEnemyAtLevel, 야생 굴림과 같은 계산) 경험치는 레벨 비로 맞춘다.
// 다른 맵 트룹에도 쓰이는 적 레코드는 건드리지 않는다.
import { speciesEnemyAtLevel } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import { monsterBalanceParty } from "@/editor/tools/troopBalanceCheck";
import { totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { EnemyRecord, GameMap, Project } from "@/project/types";

type Obj = Record<string, unknown>;

/** 곡선으로 올린 길 상대를 스타터 혼자 이겨야 하는 모의전 승률과 판 수(시드 고정 — 결정적). */
const FIT_WIN_RATE = 0.8;
const FIT_SAMPLES = 40;

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

function starterSpeciesId(project: Project): string | undefined {
  let id: string | undefined;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) walk(event.pages, (cmd) => {
    if (id === undefined && cmd.kind === "giveMonster" && typeof cmd.speciesId === "string") id = cmd.speciesId;
  });
  return id;
}

/**
 * 고를 수 있는 스타터 종 전부 — 첫 giveMonster 가 든 이벤트의 giveMonster 들(박사의 세 선택지). 이벤트가 하나만 주면 그 하나.
 * 왜(2026-10-29 standin monster): 관문 곡선을 첫 선택지(풀)로만 재서, 풀이 아닌 스타터를 고른 판을 못 봤다.
 */
function starterChoices(project: Project): string[] {
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const ids: string[] = [];
    walk(event.pages, (cmd) => { if (cmd.kind === "giveMonster" && typeof cmd.speciesId === "string" && !ids.includes(cmd.speciesId)) ids.push(cmd.speciesId); });
    if (ids.length) return ids;
  }
  return [];
}

function loneMonster(project: Project, speciesId: string, level: number): MonsterInstance | null {
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

function troopExp(project: Project, troopId: string): number {
  return (project.database.troops.find((troop) => troop.id === troopId)?.enemyIds ?? [])
    .reduce((sum, id) => sum + Math.max(0, project.database.enemies.find((enemy) => enemy.id === id)?.rewards?.exp ?? 0), 0);
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

/** 원정 목표 스위치를 켜는 이벤트가 싸우는 트룹(목표 순서대로, 전투 없는 목표는 빠진다)과 그 맵. */
function campaignGates(project: Project): { switchId: string; mapIds: Set<string>; troopIds: string[] }[] {
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

/**
 * 원정 관문 레벨 곡선(첫 관장 < 다음 관문 < … < 챔피언)을 바로 세운다. 순수 함수(프로젝트를 고친다), 결정적·멱등.
 *
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」): 스타터 Lv8 인데 관장·관측탑 보스·챔피언이 모두 Lv7 — 관문이 앞 관문보다 세지지
 * 않았다. 스타터를 곡선 시작점(관장 −2)으로 내리는 길은 모의전에서 막혔다 — 풀 스타터 Lv7 이 1번길 트레이너(불꽃 Lv4)를 3%, 관장(같은 풀
 * 종 Lv7)을 30% 이겼다(상성 기술을 늦게 배운다). 그래서 스타터는 두고 관문을 올린다:
 *   첫 관문 목표 = max(원래, 스타터+1), 다음 관문 목표 = max(원래, 앞 관문의 최종 레벨+1).
 * 관문 트룹과 같은 맵에서 관문 레벨 이하로 싸우는 다른 트레이너(체육관 관원)도 같은 폭만큼 올린다. 전설 조우처럼 관문보다 높은 전투는 두지 않는다.
 * 올린 관문은 기준 파티(troopBalanceCheck.monsterBalanceParty — 첫 관장은 스타터 혼자, 그 뒤는 잡은 동료 포함)가 **도착 레벨**에서
 * 모의전(시드 고정) 80% 이상 이겨야 하고, 경험치 나누기(rewardPolicy.expShare)가 꺼져 있으면 고를 수 있는 스타터 **각각 혼자서도** 그 종의
 * 도착 레벨에서 80% 이상 이겨야 한다 — 못 이기면 한 레벨씩 덜 올린다(원래 레벨 아래로는 내리지 않는다). 도착 레벨 = 스타터 경험치 +
 * 길 트레이너 전부 + 앞 관문(관원 포함)의 경험치로 오르는 레벨(야생전은 세지 않는다). 같은 풀 종끼리의 관장전처럼 올리면 못 이기는
 * 첫 관문은 그대로 두고, 다음 관문부터 그 레벨 위로 잇는다. 다른 관문·맵 트룹과 함께 쓰는 적 레코드는 건드리지 않는다.
 */
export function fitGateLevelCurve(project: Project): string[] {
  const starter = starterLevel(project);
  const speciesId = starterSpeciesId(project);
  const species = speciesId ? monsterSpeciesById(project, speciesId) : undefined;
  if (!project.system.monsterCampaign || starter === undefined || !species) return [];
  const gates = campaignGates(project);
  if (!gates.length) return [];
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const levelForExp = (exp: number): number => { let level = starter; while (level < 99 && totalExpForLevel(curve, level + 1) <= exp) level += 1; return level; };
  const troopMaps = new Map<string, Set<string>>();
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) troopMaps.set(entry.troopId, (troopMaps.get(entry.troopId) ?? new Set()).add(`wild:${map.id}`));
    for (const event of map.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") troopMaps.set(cmd.troopId, (troopMaps.get(cmd.troopId) ?? new Set()).add(map.id)); });
  }
  // 도착 레벨 추정: 스타터 경험치 + 길(route) 트레이너 전부 + 앞 관문(관원 포함)의 경험치. 야생전은 세지 않는다(고르지 않아도 되는 싸움).
  const routeIds = new Set(project.system.monsterCampaign.locations.filter((entry) => entry.kind === "route").map((entry) => entry.mapId));
  let exp = totalExpForLevel(curve, starter);
  const choices = project.system.rewardPolicy?.expShare === true ? [] : starterChoices(project);
  // 스타터 종마다 경험치 곡선이 다를 수 있다 — 같은 경험치(첫 스타터 기준 누계 − 시작치)를 그 종의 곡선에 얹은 레벨.
  const arrivalFor = (speciesId: string): number => {
    const own = monsterSpeciesById(project, speciesId)?.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
    const total = totalExpForLevel(own, starter) + exp - totalExpForLevel(curve, starter);
    let level = starter;
    while (level < 99 && totalExpForLevel(own, level + 1) <= total) level += 1;
    return level;
  };
  for (const mapId of routeIds) { const map = project.maps[mapId]; if (map) for (const troopId of routeTrainerTroops(map)) exp += troopExp(project, troopId); }
  const out: string[] = [];
  let prev = starter;
  for (const gate of gates) {
    const level = Math.max(...gate.troopIds.map((id) => troopMaxLevel(project, id) ?? 0));
    // 함께 올릴 트룹: 관문 트룹 + 관문 맵에서 관문 레벨 이하로 싸우는 다른 이벤트 트룹(조우표·다른 맵에도 쓰이는 트룹 제외).
    const helpers = new Set<string>(gate.troopIds);
    for (const mapId of gate.mapIds) for (const event of project.maps[mapId]?.events ?? []) walk(event.pages, (cmd) => {
      if (cmd.kind !== "battleProcessing" || typeof cmd.troopId !== "string") return;
      const maps = troopMaps.get(cmd.troopId) ?? new Set();
      if ([...maps].every((id) => id === mapId) && (troopMaxLevel(project, cmd.troopId) ?? Infinity) <= level) helpers.add(cmd.troopId);
    });
    if (level <= 0) continue;
    const arrival = levelForExp(exp);
    const target = Math.max(level, prev + 1);
    const troops = [...helpers].map((id) => project.database.troops.find((troop) => troop.id === id)).filter((troop): troop is NonNullable<typeof troop> => !!troop);
    const users = new Map<string, Set<string>>();
    for (const troop of project.database.troops) for (const enemyId of troop.enemyIds) users.set(enemyId, (users.get(enemyId) ?? new Set()).add(troop.id));
    const base = new Map<string, number>();
    for (const troop of troops) for (const enemyId of troop.enemyIds) {
      const enemy = project.database.enemies.find((item) => item.id === enemyId);
      if (!enemy?.speciesId || typeof enemy.level !== "number" || enemy.level <= 0) continue;
      if (![...(users.get(enemyId) ?? [])].every((troopId) => helpers.has(troopId))) continue;
      base.set(enemyId, enemy.level);
    }
    let delta = target - level;
    if (delta > 0 && base.size) {
      const saved = project.database.enemies.map((enemy) => enemy);
      for (; delta > 0; delta -= 1) {
        for (const [enemyId, from] of base) { const enemy = project.database.enemies.find((item) => item.id === enemyId); if (enemy) relevel(project, enemy, from + delta); }
        const winsAll = gate.troopIds.every((troopId) => {
          const party = monsterBalanceParty(project, troopId, arrival);
          if (party?.length && simulateBattle({ project, troopId, heroLevel: arrival, monsterParty: party, n: FIT_SAMPLES, seed: 1, useSkills: true }).winRate < FIT_WIN_RATE) return false;
          // 고를 수 있는 스타터마다 혼자서도 — 경험치는 싸운 몬스터만 받으니(경험치 나누기 없음) 잡은 동료는 관문 레벨까지 크지 않는다.
          // 왜(2026-10-29 standin monster, 런타임 풀 스타터): 동료 포함 기준 파티로만 재서 관측탑 보스를 Lv7→8, 챔피언을 7→9 로 올렸는데
          // 풀 스타터 혼자는 비행 보스 Lv8 을 도착 Lv10 에서 25%, 챔피언 Lv9 를 0% 이겼다 — 런타임에서 풀 판이 보스에서 졌다.
          return choices.every((speciesId) => {
            const level = arrivalFor(speciesId);
            const lone = loneMonster(project, speciesId, level);
            return !lone || simulateBattle({ project, troopId, heroLevel: level, monsterParty: [lone], n: FIT_SAMPLES, seed: 1, useSkills: true }).winRate >= FIT_WIN_RATE;
          });
        });
        if (winsAll) break;
        project.database.enemies = [...saved];
      }
    } else delta = 0;
    const reached = level + delta;
    if (delta > 0) out.push(`관문 「${gate.switchId}」 상대 레벨 Lv${level}→Lv${reached}(곡선: 앞 관문·스타터 Lv${prev} 다음, 기준 파티 도착 Lv${arrival} 에서 이김, 관원 ${troops.length - gate.troopIds.length}팀 함께)`);
    for (const troopId of helpers) exp += troopExp(project, troopId);
    prev = reached;
  }
  return out;
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
    const levelOf = (enemyId: string) => project.database.enemies.find((item) => item.id === enemyId)?.level ?? 0;
    // 올린 레벨로 첫 길 상대를 스타터 혼자(풀 HP, 직전 레벨)가 모의전 80% 이상 이기는지 본다 — 못 이기면 한 레벨씩 내린다(원래 레벨까지).
    // 왜: 레벨만 올리면 새로 배운 타입 기술(풀 스타터 상대 비행 노멀 자속 몸통박치기·벌레 기술)로 Lv6 한 마리가 Lv8 스타터를 94% 이겼다.
    const fits = (troopId: string, shift: number, apply: (delta: number) => void): number => {
      const saved = project.database.enemies.map((enemy) => enemy);
      for (let delta = shift; delta > 0; delta -= 1) {
        apply(delta);
        const party = monsterBalanceParty(project, troopId, prev);
        if (!party?.length) return delta;
        if (simulateBattle({ project, troopId, heroLevel: prev, monsterParty: party, n: FIT_SAMPLES, seed: 1, useSkills: true }).winRate >= FIT_WIN_RATE) return delta;
        project.database.enemies = [...saved];
      }
      return 0;
    };
    const moved: string[] = [];
    for (const entry of entries) {
      const troop = project.database.troops.find((item) => item.id === entry.troopId);
      if (!troop) continue;
      const levels = troop.enemyIds.map(levelOf).filter((level) => level > 0);
      const min0 = entry.levelMin ?? (levels.length ? Math.min(...levels) : floor);
      const max0 = Math.max(min0, entry.levelMax ?? (levels.length ? Math.max(...levels) : floor));
      const shift = lift(min0) - min0;
      // 시험은 범위 위쪽(가장 센 판) 레벨로 한다 — 레코드는 끝에 아래쪽 레벨로 둔다.
      const delta = fits(troop.id, shift, (d) => { for (const enemyId of troop.enemyIds) { const enemy = project.database.enemies.find((item) => item.id === enemyId); if (enemy && own(enemyId)) relevel(project, enemy, Math.min(hi, max0 + d)); } });
      if (delta <= 0) continue;
      entry.levelMin = min0 + delta;
      entry.levelMax = Math.max(entry.levelMin, Math.min(hi, max0 + delta));
      for (const enemyId of troop.enemyIds) { const enemy = project.database.enemies.find((item) => item.id === enemyId); if (enemy && own(enemyId)) relevel(project, enemy, entry.levelMin); }
      moved.push(`${troop.name || troop.id} ${min0}~${max0}→${entry.levelMin}~${entry.levelMax}`);
    }
    for (const troopId of routeTrainerTroops(map)) {
      const troop = project.database.troops.find((item) => item.id === troopId);
      const mine = (troop?.enemyIds ?? []).filter((enemyId) => own(enemyId) && levelOf(enemyId) > 0 && !!project.database.enemies.find((item) => item.id === enemyId)?.speciesId);
      if (!troop || !mine.length) continue;
      const base = new Map(mine.map((enemyId) => [enemyId, levelOf(enemyId)]));
      const shift = Math.max(...[...base.values()].map((level) => lift(level) - level));
      const delta = fits(troop.id, shift, (d) => { for (const [enemyId, level] of base) { const enemy = project.database.enemies.find((item) => item.id === enemyId); if (enemy) relevel(project, enemy, Math.min(hi, level + d)); } });
      if (delta > 0) moved.push(`${troop.name || troop.id} Lv${[...base.values()].join("·")}→${[...base.values()].map((level) => Math.min(hi, level + delta)).join("·")}`);
    }
    if (moved.length) out.push(`길 「${map.name ?? map.id}」 몬스터 레벨을 관문 곡선(Lv${lo}~${hi}, 시작 Lv${prev} → 관문 Lv${gate})으로: ${moved.join(", ")}`);
  }
  return out;
}

/** 고르기(choices) 가지 안은 건너뛰고 걷는다 — 「재대결할까?」처럼 플레이어가 고르는 전투는 필수가 아니다. */
function walkRequired(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walkRequired(item, visit); return; }
  if (!node || typeof node !== "object") return;
  const cmd = node as Obj;
  visit(cmd);
  if (cmd.kind === "choices") return;
  for (const value of Object.values(cmd)) if (value && typeof value === "object") walkRequired(value, visit);
}

/**
 * 필수 전투를 고를 수 있는 스타터 셋 **각각 혼자서** 이길 수 있게 상대 레벨을 내린다(경험치 나누기 꺼짐일 때). 순수 함수, 결정적·멱등.
 *
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」 런타임 세 스타터 판): 경험치는 싸운 몬스터만 받아, 플레이어 파티는 사실상 스타터 하나다.
 * 그런데 물 스타터는 풀 관장 Lv7 을 Lv10 에서도 0%, 풀 스타터는 1번길 트레이너(벌레·땅 Lv4 둘)를 Lv8 에서 33% 이겼다 — 모델이 짠 상성이
 * 한 스타터를 막았다. 관문 곡선(fitGateLevelCurve)은 올리지만 않을 뿐 원래 레벨 아래로는 내리지 않았다.
 *
 * 필수 전투 = 원정 맵의 이벤트 전투 중 도망칠 수 없고(canEscape ≠ true) 고르기 가지 안이 아닌 것(재대결·전설 조우 제외).
 * 순서 = 단계(관문 i: 그 관문 앞 길 → 관문 맵 관원 → 관문). 길의 단계는 이동 명령으로 이어진 배지 마을의 관문, 그 밖의 맵은 0.
 * 도착 레벨 = 스타터 레벨 경험치 + 앞 단계 필수 전투 전부 + 같은 단계에서 앞선 것(길 트레이너 → 관원 → 관문)의 경험치를 그 종의 곡선에 얹은 레벨.
 * 스타터마다 혼자(풀 HP, 시드 고정 모의전 40판, 가장 좋은 기술) 80% 를 못 넘기면 그 트룹의 적을 모두 한 레벨씩 내린다(Lv2 까지).
 * 다른 트룹과 함께 쓰는 적 레코드는 이 트룹 전용 사본으로 떼고 내린다. 경험치 보상은 relevel 이 레벨 비로 줄인다.
 */
export function fitRequiredBattlesToStarters(project: Project): string[] {
  const campaign = project.system.monsterCampaign;
  const starter = starterLevel(project);
  if (!campaign || starter === undefined || project.system.rewardPolicy?.expShare === true) return [];
  const choices = starterChoices(project).filter((id) => monsterSpeciesById(project, id));
  if (!choices.length) return [];
  const gates = campaignGates(project);
  const gateIndex = new Map(gates.map((gate, index) => [gate.switchId, index]));
  const campaignMaps = new Set(campaign.locations.map((entry) => entry.mapId));
  const routeIds = new Set(campaign.locations.filter((entry) => entry.kind === "route").map((entry) => entry.mapId));
  const stageOfRoute = (map: GameMap): number => {
    for (const badge of campaign.badges ?? []) {
      const city = project.maps[badge.cityMapId];
      if (city && (transfersBetween(map, city.id) || transfersBetween(city, map.id))) return gateIndex.get(badge.switchId) ?? 0;
    }
    return 0;
  };
  // 필수 전투 모으기: [단계, 순번(0 길·기타 1 관원 2 관문), 트룹].
  const required: { stage: number; rank: number; troopId: string }[] = [];
  const seen = new Set<string>();
  for (const map of Object.values(project.maps)) {
    if (campaignMaps.size && !campaignMaps.has(map.id) && !gates.some((gate) => gate.mapIds.has(map.id))) continue;
    for (const event of map.events ?? []) walkRequired(event.pages, (cmd) => {
      if (cmd.kind !== "battleProcessing" || typeof cmd.troopId !== "string" || cmd.canEscape === true || seen.has(cmd.troopId)) return;
      if ((map.encounterTable ?? []).some((entry) => entry.troopId === cmd.troopId)) return;
      seen.add(cmd.troopId);
      const gate = gates.findIndex((entry) => entry.troopIds.includes(cmd.troopId as string));
      if (gate >= 0) { required.push({ stage: gate, rank: 2, troopId: cmd.troopId }); return; }
      const home = gates.findIndex((entry) => entry.mapIds.has(map.id));
      if (home >= 0) { required.push({ stage: home, rank: 1, troopId: cmd.troopId }); return; }
      required.push({ stage: routeIds.has(map.id) ? stageOfRoute(map) : 0, rank: 0, troopId: cmd.troopId });
    });
  }
  required.sort((a, b) => a.stage - b.stage || a.rank - b.rank);
  const arrivalFor = (speciesId: string, gained: number): number => {
    const own = monsterSpeciesById(project, speciesId)?.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
    const total = totalExpForLevel(own, starter) + gained;
    let level = starter;
    while (level < 99 && totalExpForLevel(own, level + 1) <= total) level += 1;
    return level;
  };
  const out: string[] = [];
  let gained = 0;
  let pending = 0; // 같은 (단계, 순번) 묶음 안에서는 앞 트룹 경험치를 아직 안 얹는다(길 트레이너끼리 순서는 모른다).
  let group = "";
  const FLOOR = 2;
  for (const entry of required) {
    const key = `${entry.stage}:${entry.rank}`;
    if (key !== group) { gained += pending; pending = 0; group = key; }
    const troop = project.database.troops.find((item) => item.id === entry.troopId);
    if (!troop) continue;
    const worst = (): { speciesId: string; rate: number; level: number } => {
      let low = { speciesId: "", rate: 1, level: starter };
      for (const speciesId of choices) {
        const level = arrivalFor(speciesId, gained);
        const lone = loneMonster(project, speciesId, level);
        if (!lone) continue;
        const rate = simulateBattle({ project, troopId: troop.id, heroLevel: level, monsterParty: [lone], n: FIT_SAMPLES, seed: 1, useSkills: true }).winRate;
        if (rate < low.rate) low = { speciesId, rate, level };
      }
      return low;
    };
    let low = worst();
    if (low.rate < FIT_WIN_RATE) {
      const species = (id: string) => project.database.enemies.find((item) => item.id === id);
      const before = troop.enemyIds.map((id) => species(id)?.level ?? 0);
      // 다른 트룹과 함께 쓰는 적은 이 트룹 전용 사본으로 뗀다.
      troop.enemyIds = troop.enemyIds.map((enemyId) => {
        const enemy = species(enemyId);
        if (!enemy?.speciesId || typeof enemy.level !== "number") return enemyId;
        const shared = project.database.troops.some((other) => other.id !== troop.id && other.enemyIds.includes(enemyId));
        if (!shared) return enemyId;
        const copyId = `${enemyId}__${troop.id}`;
        if (!species(copyId)) project.database.enemies.push({ ...structuredClone(enemy), id: copyId } as EnemyRecord);
        return copyId;
      });
      while (low.rate < FIT_WIN_RATE) {
        const lowerable = troop.enemyIds.map(species).filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level > FLOOR);
        if (!lowerable.length) break;
        for (const enemy of lowerable) relevel(project, enemy, enemy.level! - 1);
        low = worst();
      }
      const after = troop.enemyIds.map((id) => species(id)?.level ?? 0);
      const who = monsterSpeciesById(project, low.speciesId)?.name ?? low.speciesId;
      out.push(`필수 전투 「${troop.name || troop.id}」 Lv${before.join("·")}→Lv${after.join("·")} — 스타터 혼자 이기게(${who ? `가장 약한 ${who} ` : ""}도착 Lv${low.level} 승률 ${Math.round(low.rate * 100)}%${low.rate < FIT_WIN_RATE ? ", 바닥 Lv2 에서도 미달" : ""})`);
    }
    pending += troopExp(project, troop.id);
  }
  return out;
}
