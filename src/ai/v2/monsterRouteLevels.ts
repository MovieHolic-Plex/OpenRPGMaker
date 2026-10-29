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
import { typeChartMultiplierForTypes } from "@/battle/typeChart";
import { EVENT_TOOLS } from "@/editor/tools/eventTools";
import { isPassableLanding } from "@/project/collision";
import { withJosa } from "@/util/josa";
import { simulateBattle } from "@/battle/simulate";
import { monsterBalanceParty } from "@/editor/tools/troopBalanceCheck";
import { totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterMaxHp, monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { EnemyRecord, GameMap, Project } from "@/project/types";

type Obj = Record<string, unknown>;

/** 곡선으로 올린 길 상대를 스타터 혼자 이겨야 하는 모의전 승률과 판 수(시드 고정 — 결정적). */
const FIT_WIN_RATE = 0.8;
const FIT_SAMPLES = 40;
/**
 * 필수 전투의 남은 HP 띠(모의전 평균, 파티 = 스타터 + 선물 동료). 아래 HP_MARGIN 미만이면 아슬아슬한 승리 — 못 이긴 것으로 친다.
 * 위 HP_EASY(0.8 — 0.85 로는 런타임 물 스타터 1번길 트레이너가 91% 남았다)를 넘는 스타터가 있으면 가장 약한 스타터가 띠 안에 있는 한 상대를 한 레벨씩 올린다(HP_RAISE_CAP 까지).
 * 왜(2026-10-29 「새싹 몬스터 모험」 런타임 표): 띠 아래쪽 0.25 로는 물 스타터가 관장전에서 파티 23%(스타터 0/30)로 이겼고,
 * 위쪽이 없어 1번길 트레이너·관원은 91~97% 가 남았다. 런타임 운(빗나감·급소·상대 AI)이 모의전 평균보다 나쁘게 나오는 몫을 0.35 로 둔다.
 */
const HP_MARGIN = 0.35;
const HP_EASY = 0.8;
const HP_RAISE_CAP = 3;

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
  // 끝맺음이 스타터 고르기 갈래에 끼운 선물 동료(campaignGifts)는 고를 수 있는 스타터가 아니다 — 세면 선물이 「혼자 싸우는 스타터」로 잡혔다.
  const gifts = new Set(campaignGifts(project).map((gift) => gift.speciesId));
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const ids: string[] = [];
    walk(event.pages, (cmd) => { if (cmd.kind === "giveMonster" && typeof cmd.speciesId === "string" && !gifts.has(cmd.speciesId) && !ids.includes(cmd.speciesId)) ids.push(cmd.speciesId); });
    if (ids.length) return ids;
  }
  return [];
}

/**
 * 맞춤 모의전(시드 1·40판·가장 좋은 기술) 결과 캐시 — 입력이 같으면 결과도 같다(결정적).
 * 키 = 트룹 레코드 + 그 적 레코드 전부(종·레벨·능력치·기술) + 영웅 레벨 + 몬스터 파티(종·레벨·HP·기술). 프로젝트마다 따로 둔다.
 * 끝맺음은 같은 판을 수없이 다시 잰다(바퀴 셋 · 후보 시험 뒤 되돌리기 · 단계마다 같은 관문) — 없을 때 맞춤만 416초, 끝맺음 전체 약 9분(2026-10-29).
 * 그 밖에 모의전에 들어가는 것(기술·상태·타입 표·종 능력치)은 맞춤 중에 바뀌지 않는다 — 종의 배우는 기술 레벨(②)은 파티 기술에 드러난다.
 */
const fitSimCache = new WeakMap<Project, Map<string, ReturnType<typeof simulateBattle>>>();
function fitSimulate(project: Project, troopId: string, heroLevel: number, monsterParty: MonsterInstance[]): ReturnType<typeof simulateBattle> {
  const troop = project.database.troops.find((item) => item.id === troopId);
  const enemies = (troop?.enemyIds ?? []).map((id) => project.database.enemies.find((item) => item.id === id) ?? null);
  const key = JSON.stringify([troop ?? troopId, enemies, heroLevel, monsterParty]);
  let cache = fitSimCache.get(project);
  if (!cache) fitSimCache.set(project, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const result = simulateBattle({ project, troopId, heroLevel, monsterParty, n: FIT_SAMPLES, seed: 1, useSkills: true });
  cache.set(key, result);
  return result;
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
  const choices = starterChoices(project).filter((id) => monsterSpeciesById(project, id));
  for (const mapId of routeIds) { const map = project.maps[mapId]; if (map) for (const troopId of routeTrainerTroops(map)) exp += troopExp(project, troopId); }
  const out: string[] = [];
  let prev = starter;
  for (const [gateStage, gate] of gates.entries()) {
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
          if (party?.length && fitSimulate(project, troopId, arrival, party).winRate < FIT_WIN_RATE) return false;
          // 고를 수 있는 스타터마다 혼자서도 — 경험치는 싸운 몬스터만 받으니(경험치 나누기 없음) 잡은 동료는 관문 레벨까지 크지 않는다.
          // 왜(2026-10-29 standin monster, 런타임 풀 스타터): 동료 포함 기준 파티로만 재서 관측탑 보스를 Lv7→8, 챔피언을 7→9 로 올렸는데
          // 풀 스타터 혼자는 비행 보스 Lv8 을 도착 Lv10 에서 25%, 챔피언 Lv9 를 0% 이겼다 — 런타임에서 풀 판이 보스에서 졌다.
          // 경험치 나누기가 켜졌으면 잡을 수 있는 동료와 함께(starterOutcome — fitRequiredBattlesToStarters 와 같은 판정).
          return choices.every((speciesId) => starterOutcome(project, troopId, speciesId, starter, exp - totalExpForLevel(curve, starter), gateStage).rate >= FIT_WIN_RATE);
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
        if (fitSimulate(project, troopId, prev, party).winRate >= FIT_WIN_RATE) return delta;
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

/** 이 맵에 회복 명령(recoverAll)이 있는가 — 센터 간호사·체육관 회복 지점. */
function mapHasHeal(map: GameMap | undefined): boolean {
  let found = false;
  for (const event of map?.events ?? []) walk(event.pages, (cmd) => { if (cmd.kind === "recoverAll") found = true; });
  return found;
}

/**
 * 몬스터 원정 지원 장치 — 레벨을 깎기 전에 먼저 쓰는 수단 둘. 순수 함수, 결정적·멱등.
 *  ① 경험치 나누기: rewardPolicy.expShare 가 정해지지 않았으면 켠다(나서지 않은 살아 있는 동료도 절반을 받는다). 잡은 동료가 자란다.
 *  ② 체육관 회복 지점: 관원 전투가 있는 관문 맵에 회복 명령이 없으면 체육관 안내원(id 에 gym_guide)에게 「회복할까?」를 붙인다.
 * 왜(2026-10-29 standin monster): 경험치 나누기가 없어 동료가 크지 않았고 관원 셋을 회복 없이 잇달아 싸워야 해서, 세 스타터를 모두 혼자 이기게
 * 하려면 관원을 Lv2·보스를 Lv5 까지 깎아야 했다(긴장감 없음).
 */
export function equipMonsterCampaign(project: Project): string[] {
  const campaign = project.system.monsterCampaign;
  if (!campaign || starterLevel(project) === undefined) return [];
  const out: string[] = [];
  if (project.system.rewardPolicy?.expShare === undefined) {
    project.system.rewardPolicy = { ...(project.system.rewardPolicy ?? {}), expShare: true };
    out.push("경험치 나누기 켬(나서지 않은 동료도 절반)");
  }
  // ③ 길 회복 샘: 필수 트레이너가 둘 이상인 길에 회복이 없으면 처음 들어오는 칸 가까이(풀숲·트레이너 앞)에 회복의 샘(전원 회복·기록)을 둔다.
  //    실제 플레이어는 회복 지점이 없으면 회복하지 않는다 — 포획 싸움과 트레이너 셋을 깎인 HP 로 잇달아 치렀다(2026-10-29 런타임 물 판 1/26).
  for (const location of campaign.locations.filter((entry) => entry.kind === "route")) {
    const map = project.maps[location.mapId];
    if (!map || mapHasHeal(map)) continue;
    let trainers = 0;
    const wild = new Set((map.encounterTable ?? []).map((entry) => entry.troopId));
    for (const event of map.events ?? []) walkRequired(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && cmd.canEscape !== true && !wild.has(String(cmd.troopId))) trainers += 1; });
    if (trainers < 2) continue;
    const cell = routeSpringCell(project, map);
    const tool = EVENT_TOOLS.find((item) => item.name === "place_savepoint");
    if (!cell || !tool) continue;
    try {
      tool.run(project as never, { mapId: map.id, x: cell.x, y: cell.y, id: `${map.id}_heal_spring`, name: "회복의 샘", heal: true, mode: "checkpoint", sparkleRadius: 2 });
      out.push(`길 회복 샘: 「${map.name ?? map.id}」 (${cell.x},${cell.y}) — 필수 트레이너 ${trainers}명 앞`);
    } catch { /* 둘 칸이 없으면 둔다 */ }
  }
  for (const gate of campaignGates(project)) for (const mapId of gate.mapIds) {
    const map = project.maps[mapId];
    if (!map || mapHasHeal(map)) continue;
    let helpers = 0;
    for (const event of map.events ?? []) walkRequired(event.pages, (cmd) => { if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string" && !gate.troopIds.includes(cmd.troopId) && cmd.canEscape !== true) helpers += 1; });
    if (!helpers) continue;
    const guide = (map.events ?? []).find((event) => /gym_guide/.test(event.id));
    const page = guide?.pages?.[0] as { commands?: unknown[] } | undefined;
    if (!guide || !page) continue;
    page.commands = [
      ...(page.commands ?? []),
      { kind: "choices", prompt: "동료들을 회복할까요?", options: [
        { text: "회복한다", branch: [
          { kind: "recoverAll" },
          { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false },
          { kind: "text", body: "동료들이 모두 건강해졌어요. 관원들과 다시 겨뤄 보세요!", speaker: "체육관 안내원" },
        ] },
        { text: "괜찮다", branch: [] },
      ] },
    ];
    out.push(`체육관 회복 지점: 「${map.name ?? map.id}」 안내원(${guide.x},${guide.y})이 동료를 회복한다`);
  }
  return out;
}

/**
 * 길에 처음 들어오는 칸(시작 맵에서 오는 이동 도착 칸, 없으면 다른 맵에서 오는 첫 도착 칸)에서 걸어 3~10칸, 둘레 한 칸에 이벤트가 없고
 * 이웃 셋 이상이 트인 칸(가까운 순·결정적).
 */
function routeSpringCell(project: Project, map: GameMap): { x: number; y: number } | undefined {
  const landings: { from: string; x: number; y: number }[] = [];
  for (const other of Object.values(project.maps)) {
    if (other.id === map.id) continue;
    for (const event of other.events ?? []) walk(event.pages, (cmd) => {
      if (cmd.kind === "transfer" && cmd.mapId === map.id && typeof cmd.x === "number" && typeof cmd.y === "number") landings.push({ from: other.id, x: cmd.x, y: cmd.y });
    });
  }
  landings.sort((a, b) => Number(b.from === project.startMapId) - Number(a.from === project.startMapId) || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) || a.y - b.y || a.x - b.x);
  const start = landings[0];
  if (!start) return undefined;
  const near = (x: number, y: number) => (map.events ?? []).some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
  const open = (x: number, y: number) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => isPassableLanding(project, map, x + dx!, y + dy!)).length;
  const seen = new Set<string>([`${start.x},${start.y}`]);
  let frontier = [{ x: start.x, y: start.y }];
  for (let dist = 1; dist <= 10 && frontier.length; dist += 1) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isPassableLanding(project, map, x, y)) continue;
      next.push({ x, y });
    }
    if (dist >= 3) {
      const hit = [...next].sort((a, b) => a.y - b.y || a.x - b.x).find((c) => !near(c.x, c.y) && open(c.x, c.y) >= 3);
      if (hit) return hit;
    }
    frontier = next;
  }
  return undefined;
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

/** 원정 단계 정보: 관문 순서, 길 맵의 단계(이동 명령으로 이어진 배지 마을의 관문 순번, 없으면 0). */
function campaignStages(project: Project) {
  const campaign = project.system.monsterCampaign!;
  const gates = campaignGates(project);
  const gateIndex = new Map(gates.map((gate, index) => [gate.switchId, index]));
  const routeIds = [...new Set(campaign.locations.filter((entry) => entry.kind === "route").map((entry) => entry.mapId))].filter((id) => project.maps[id]);
  const stageOfRoute = (mapId: string): number => {
    const map = project.maps[mapId];
    if (!map) return 0;
    for (const badge of campaign.badges ?? []) {
      const city = project.maps[badge.cityMapId];
      if (city && (transfersBetween(map, city.id) || transfersBetween(city, map.id))) return gateIndex.get(badge.switchId) ?? 0;
    }
    return 0;
  };
  return { gates, routeIds, stageOfRoute };
}

/** 단계 stage 까지 길 풀숲에서 잡을 수 있는 종과 가장 낮은 잡히는 레벨. */
function catchableUpTo(project: Project, stage: number): Map<string, number> {
  const { routeIds, stageOfRoute } = campaignStages(project);
  const out = new Map<string, number>();
  for (const mapId of routeIds) {
    if (stageOfRoute(mapId) > stage) continue;
    for (const entry of project.maps[mapId]?.encounterTable ?? []) {
      const troop = project.database.troops.find((item) => item.id === entry.troopId);
      if (!troop || (troop as { uncapturable?: boolean }).uncapturable) continue;
      for (const enemyId of troop.enemyIds) {
        const enemy = project.database.enemies.find((item) => item.id === enemyId);
        if (!enemy?.speciesId || (monsterSpeciesById(project, enemy.speciesId)?.captureRate ?? 0) <= 0) continue;
        const level = entry.levelMin ?? enemy.level ?? 1;
        out.set(enemy.speciesId, Math.min(out.get(enemy.speciesId) ?? 99, level));
      }
    }
  }
  return out;
}

function levelOnCurve(project: Project, speciesId: string, fromLevel: number, gained: number): number {
  const curve = monsterSpeciesById(project, speciesId)?.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const total = totalExpForLevel(curve, fromLevel) + Math.max(0, gained);
  let level = fromLevel;
  while (level < 99 && totalExpForLevel(curve, level + 1) <= total) level += 1;
  return level;
}

/**
 * 이벤트로 받는 동료(선물 몬스터) — 원정 목표 스위치를 켜는 바로 그 명령 목록에서 setSwitch 뒤에 오는 giveMonster. 그 목표 다음 관문 단계부터 파티에 있다.
 * 스타터 고르기의 giveMonster 는 setSwitch 앞이라 세지 않는다. 고르기 포획과 달리 반드시 받는다(포획은 실패할 수 있다).
 */
export function campaignGifts(project: Project): { speciesId: string; level: number; stage: number }[] {
  const campaign = project.system.monsterCampaign;
  if (!campaign) return [];
  const gates = campaignGates(project);
  const objectives = campaign.objectives ?? [];
  const stageAfter = new Map<string, number>();
  for (const [index, objective] of objectives.entries()) {
    const next = objectives.slice(index + 1).find((item) => gates.some((gate) => gate.switchId === item.switchId));
    const stage = next ? gates.findIndex((gate) => gate.switchId === next.switchId) : gates.length;
    stageAfter.set(objective.switchId, stage);
  }
  const out: { speciesId: string; level: number; stage: number }[] = [];
  const scan = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    let stage: number | undefined;
    for (const raw of list) {
      const cmd = raw as Obj;
      if (!cmd || typeof cmd !== "object") continue;
      if (cmd.kind === "setSwitch" && cmd.value !== false && typeof cmd.switchId === "string" && stageAfter.has(cmd.switchId)) stage = stageAfter.get(cmd.switchId);
      if (cmd.kind === "giveMonster" && stage !== undefined && typeof cmd.speciesId === "string") out.push({ speciesId: cmd.speciesId, level: typeof cmd.level === "number" ? cmd.level : 5, stage });
      for (const value of Object.values(cmd)) if (value && typeof value === "object") scan(Array.isArray(value) ? value : Object.values(value as Obj).filter(Array.isArray).flat());
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) scan((page as { commands?: unknown[] }).commands);
  const seen = new Set<string>();
  return out.filter((gift) => { const key = `${gift.speciesId}@${gift.stage}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

interface StarterOutcome { readonly speciesId: string; readonly rate: number; readonly level: number; readonly hpLeft: number; readonly hpFrac: number }

/**
 * 스타터 하나가 이 트룹을 도착 레벨에서 이길 수 있는가(시드 고정 모의전 40판, 가장 좋은 기술). 파티 = 스타터(앞) + 그 단계까지 이벤트로 받은
 * 동료(campaignGifts, 받은 레벨 그대로 — 자라는 몫은 세지 않는다). 잡을 수 있는 몬스터는 세지 않는다 — 포획은 실패할 수 있다.
 * 평균 남은 HP 가 min(파티 최대 × HP_MARGIN, 들어온 HP 의 절반) 미만이면 아슬아슬한 승리 — 승률을 80% 바로 아래로 친다.
 * extraGift 를 주면 그 동료도 받은 것으로 친다(선물 고르기 시험).
 */
export function starterOutcome(project: Project, troopId: string, speciesId: string, starter: number, gained: number, stage: number, carryHp?: number, extraGift?: { speciesId: string; level: number }): StarterOutcome {
  const level = levelOnCurve(project, speciesId, starter, gained);
  const fresh = loneMonster(project, speciesId, level);
  if (!fresh) return { speciesId, rate: 1, level, hpLeft: 0, hpFrac: 1 };
  const maxHp = monsterMaxHp(project, fresh);
  const lead = carryHp === undefined ? fresh : { ...fresh, currentHp: Math.max(1, Math.round(carryHp)) };
  const gifts = [...campaignGifts(project).filter((gift) => gift.stage <= stage), ...(extraGift ? [extraGift] : [])]
    .map((gift) => loneMonster(project, gift.speciesId, gift.level)).filter((item): item is MonsterInstance => !!item)
    .map((item, index) => ({ ...item, instanceId: `${item.instanceId}_${index}` }));
  const party = [lead, ...gifts];
  const full = party.reduce((sum, item) => sum + monsterMaxHp(project, item), 0);
  const inHp = (lead.currentHp ?? maxHp) + gifts.reduce((sum, item) => sum + monsterMaxHp(project, item), 0);
  const result = fitSimulate(project, troopId, level, party);
  const safe = result.avgHpRemaining >= Math.min(full * HP_MARGIN, inHp * 0.5);
  return { speciesId, rate: safe ? result.winRate : Math.min(result.winRate, FIT_WIN_RATE - 0.01), level, hpLeft: Math.min(maxHp, result.avgHpRemaining), hpFrac: full > 0 ? result.avgHpRemaining / full : 1 };
}

/**
 * 단계 stage 의 선물을 끼울 자리 — 그 단계 바로 앞 원정 목표 스위치를 켜는 setSwitch 전부(스타터 고르기처럼 갈래마다 켜면 갈래마다 준다).
 */
function giftAnchors(project: Project, stage: number): { list: unknown[]; index: number; switchId: string }[] {
  const gates = campaignGates(project);
  const objectives = project.system.monsterCampaign?.objectives ?? [];
  const gate = gates[stage];
  if (!gate) return [];
  const at = objectives.findIndex((item) => item.switchId === gate.switchId);
  const before = at > 0 ? objectives[at - 1]!.switchId : undefined;
  if (!before) return [];
  const found: { list: unknown[]; index: number; switchId: string }[] = [];
  const scan = (list: unknown[]): void => {
    for (const [index, raw] of list.entries()) {
      const cmd = raw as Obj;
      if (!cmd || typeof cmd !== "object") continue;
      if (cmd.kind === "setSwitch" && cmd.switchId === before && cmd.value !== false) found.push({ list, index, switchId: before });
      for (const value of Object.values(cmd)) {
        if (Array.isArray(value)) scan(value);
        else if (value && typeof value === "object") for (const inner of Object.values(value as Obj)) if (Array.isArray(inner)) scan(inner);
      }
    }
  };
  for (const map of Object.values(project.maps).sort((x, y) => (x.id < y.id ? -1 : 1))) for (const event of map.events ?? []) for (const page of event.pages ?? []) scan(((page as { commands?: unknown[] }).commands) ?? []);
  return found;
}

/**
 * 필수 전투를 고를 수 있는 스타터 셋 각각이(경험치 나누기가 켜졌으면 잡을 수 있는 동료와 함께) 이길 수 있게 맞춘다. 순수 함수, 결정적·멱등.
 * 끝맺음에서 equipMonsterCampaign(경험치 나누기·체육관 회복 지점)과 관문·길 곡선 뒤에 돈다.
 *
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」 런타임 세 스타터 판): 물 스타터는 풀 관장 Lv7 을 Lv10 에서도 0%, 풀 스타터는 1번길 트레이너를
 * Lv8 에서 33%, 비행 보스를 25% 이겼다. 레벨만 깎으면 관원 Lv2·보스 Lv5 — 긴장감이 없다. 그래서 깎기는 마지막 수단이다.
 *
 * 필수 전투 = 원정 맵의 이벤트 전투 중 도망칠 수 없고(canEscape ≠ true) 고르기 가지 안이 아닌 것(재대결·전설 조우·조우표 제외).
 * 순서 = 단계(관문 i: 그 관문 앞 길 → 관문 맵 관원 → 관문). 도착 레벨 = 스타터 레벨 + 앞 단계 필수 전투 경험치(그 종 곡선).
 * 같은 (단계, 순번) 묶음은 회복 없이 잇달아 싸운다고 보고 남은 HP 를 잇는다 — 맵에 회복 지점이 있으면(체육관 안내원) 판마다 회복한다.
 * 스타터마다 starterOutcome 이 80% 를 못 넘기면 순서대로:
 *  ① 관문이면 그 관문 단계까지의 길 하나(가장 늦은 단계, 같으면 가장 높은 야생 레벨)의 풀숲에 상성을 메울 종을 더한다 — 그 종의 적 레코드가 이미
 *     있고(그림) 잡을 수 있고, 잡히는 레벨에서 아는 피해 기술이 관문 몬스터에게 ×2 인 종. 길 야생 레벨 범위로, 가중치 3.
 *  ② 막힌 스타터가 나중에 배울 ×2 피해 기술 하나를 스타터 레벨로 당긴다(이미 그런 기술을 알면 안 함).
 *  ③ 트룹 적을 한 레벨씩 내린다 — 가장 약한 스타터 도착 레벨 −1 아래로는 안 내린다(모델 레벨 아래로는 가도 된다).
 *  ④ 그래도 못 이기는 관문 아닌 트룹은 몬스터를 길 풀숲 종으로 바꾸고 원래 레벨 쪽으로 다시 올린다.
 * 다른 트룹과 함께 쓰는 적 레코드는 이 트룹 전용 사본으로 떼고 바꾼다. 경험치 보상은 relevel 이 레벨 비로 줄인다.
 */
export function fitRequiredBattlesToStarters(project: Project): string[] {
  return runRequiredBattles(project, true).out;
}

/** 필수 전투 한 판의 모의전 결과(스타터마다) — 끝맺음 기록·QA 표 대조용. 프로젝트를 바꾸지 않는다. */
export interface RequiredBattleRow { readonly troopId: string; readonly name: string; readonly stage: number; readonly rank: number; readonly heal: boolean; readonly outcomes: readonly StarterOutcome[] }
export function requiredBattleReport(project: Project): RequiredBattleRow[] {
  return runRequiredBattles(project, false).rows;
}

function runRequiredBattles(project: Project, adjust: boolean): { out: string[]; rows: RequiredBattleRow[] } {
  const rows: RequiredBattleRow[] = [];
  const campaign = project.system.monsterCampaign;
  const starter = starterLevel(project);
  if (!campaign || starter === undefined) return { out: [], rows };
  const choices = starterChoices(project).filter((id) => monsterSpeciesById(project, id));
  if (!choices.length) return { out: [], rows };
  const { gates, routeIds, stageOfRoute } = campaignStages(project);
  const campaignMaps = new Set(campaign.locations.map((entry) => entry.mapId));
  const routeSet = new Set(routeIds);
  const required: { stage: number; rank: number; troopId: string; mapId: string }[] = [];
  const seen = new Set<string>();
  for (const map of Object.values(project.maps)) {
    if (campaignMaps.size && !campaignMaps.has(map.id) && !gates.some((gate) => gate.mapIds.has(map.id))) continue;
    for (const event of map.events ?? []) walkRequired(event.pages, (cmd) => {
      if (cmd.kind !== "battleProcessing" || typeof cmd.troopId !== "string" || cmd.canEscape === true || seen.has(cmd.troopId)) return;
      if ((map.encounterTable ?? []).some((entry) => entry.troopId === cmd.troopId)) return;
      seen.add(cmd.troopId);
      const gate = gates.findIndex((entry) => entry.troopIds.includes(cmd.troopId as string));
      if (gate >= 0) { required.push({ stage: gate, rank: 2, troopId: cmd.troopId, mapId: map.id }); return; }
      const home = gates.findIndex((entry) => entry.mapIds.has(map.id));
      if (home >= 0) { required.push({ stage: home, rank: 1, troopId: cmd.troopId, mapId: map.id }); return; }
      required.push({ stage: routeSet.has(map.id) ? stageOfRoute(map.id) : 0, rank: 0, troopId: cmd.troopId, mapId: map.id });
    });
  }
  required.sort((a, b) => a.stage - b.stage || a.rank - b.rank);
  const out: string[] = [];
  let gained = 0;
  let pending = 0; // 같은 묶음 안의 앞 트룹 경험치는 아직 안 얹는다(길 트레이너끼리 순서는 모른다).
  let group = "";
  const carry = new Map<string, number>();
  const enemyOf = (id: string) => project.database.enemies.find((item) => item.id === id);
  for (const entry of required) {
    const key = `${entry.stage}:${entry.rank}`;
    if (key !== group) { gained += pending; pending = 0; group = key; carry.clear(); }
    const troop = project.database.troops.find((item) => item.id === entry.troopId);
    if (!troop) continue;
    const healHere = mapHasHeal(project.maps[entry.mapId]);
    let outcomes: StarterOutcome[] = [];
    const evaluate = (): StarterOutcome => {
      outcomes = choices.map((speciesId) => starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId)));
      return outcomes.reduce((low, item) => (item.rate < low.rate ? item : low));
    };
    let low = evaluate();
    const notes: string[] = [];
    const defendersOf = (troopId: string) => (project.database.troops.find((item) => item.id === troopId)?.enemyIds ?? []).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id).map((id) => monsterSpeciesById(project, id)?.types ?? []);
    const hitsVs = (troopId: string) => (skillId: string) => {
      const skill = project.database.skills.find((item) => item.id === skillId);
      const defenders = defendersOf(troopId);
      return !!skill && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0
        && defenders.some((types) => typeChartMultiplierForTypes(project, skill.elementId, [], types) >= 2)
        && defenders.every((types) => typeChartMultiplierForTypes(project, skill.elementId, [], types) > 0);
    };
    const hits = hitsVs(troop.id);
    // 이 단계의 관문 트룹(관장·보스) — 선물 동료는 이 단계 내내 같이 다니므로 가장 센 관문 기준으로 고른다.
    const gateTroopId = gates[entry.stage]?.troopIds.find((id) => project.database.troops.some((item) => item.id === id));
    // ① 선물 동료: 혼자 못 이기는 스타터가 있으면 이 단계 앞 원정 목표를 켜는 순간 동료 하나를 이벤트로 준다(모두가 받는다).
    //    후보 = 그림이 있는 적 레코드가 있는 잡을 수 있는 종(스타터 제외) 가운데 그 레벨에서 이 상대에게 ×2 피해 기술을 아는 종, id 순 앞 8개.
    //    선물 레벨 = 가장 약한 스타터 도착 레벨 −2. 막힌 스타터들의 가장 낮은 승률이 가장 높은 종.
    if (adjust && low.rate < FIT_WIN_RATE && !campaignGifts(project).some((gift) => gift.stage === entry.stage)) {
      const anchors = giftAnchors(project, entry.stage);
      const giftLevel = Math.max(2, Math.min(...outcomes.map((item) => item.level)) - 2);
      if (anchors.length) {
        const blocked = outcomes.filter((item) => item.rate < FIT_WIN_RATE);
        // 후보 기술은 관문 트룹 상대 ×2(관문이 없으면 이 트룹). 점수 = min(막힌 스타터들의 이 판 승률, 모든 스타터의 관문 승률).
        const hitsGate = hitsVs(gateTroopId ?? troop.id);
        const candidates = [...new Set(project.database.enemies.filter((enemy) => enemy.speciesId && (enemy as { monsterResourceId?: string }).monsterResourceId).map((enemy) => enemy.speciesId!))]
          .filter((id) => !choices.includes(id) && (monsterSpeciesById(project, id)?.captureRate ?? 0) > 0)
          .filter((id) => monsterSkillIdsAtLevel(monsterSpeciesById(project, id)!, giftLevel).some(hitsGate)).sort().slice(0, 8);
        let best: { speciesId: string; rate: number } | undefined;
        for (const candidate of candidates) {
          const gift = { speciesId: candidate, level: giftLevel };
          const here = Math.min(...blocked.map((item) => starterOutcome(project, troop.id, item.speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(item.speciesId), gift).rate));
          const atGate = gateTroopId && gateTroopId !== troop.id ? Math.min(...choices.map((speciesId) => starterOutcome(project, gateTroopId, speciesId, starter, gained, entry.stage, undefined, gift).rate)) : 1;
          const rate = Math.min(here, atGate);
          if (!best || rate > best.rate) best = { speciesId: candidate, rate };
        }
        if (best && best.rate > low.rate) {
          const name = monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId;
          // 같은 목록에 둘 이상이면 뒤에서부터 끼워 앞 자리 번호가 밀리지 않게.
          for (const anchor of [...anchors].sort((x, y) => y.index - x.index)) anchor.list.splice(anchor.index + 1, 0,
            { kind: "text", body: `${withJosa(name, "이/가")} 동료가 되었다!` },
            { kind: "giveMonster", speciesId: best.speciesId, level: giftLevel, nickname: name });
          notes.push(`선물 동료 ${name} Lv${giftLevel}(「${anchors[0]!.switchId}」 켤 때 ${anchors.length}곳)`);
          low = evaluate();
        }
      }
    }
    // ② 막힌 스타터에게 ×2 기술 하나를 스타터 레벨로.
    if (adjust && low.rate < FIT_WIN_RATE) {
      for (const outcome of outcomes) {
        if (outcome.rate >= FIT_WIN_RATE) continue;
        const record = project.database.monsterSpecies?.find((item) => item.id === outcome.speciesId);
        if (!record?.skillsByLevel) continue;
        const known = monsterSkillIdsAtLevel(record, outcome.level);
        if (known.some(hits)) continue;
        const pick = record.skillsByLevel.filter((item) => item.level > outcome.level && hits(item.skillId))
          .sort((a, b) => a.level - b.level || (project.database.skills.find((s) => s.id === a.skillId)?.power ?? 0) - (project.database.skills.find((s) => s.id === b.skillId)?.power ?? 0))[0];
        if (!pick) continue;
        const from = pick.level;
        (pick as { level: number }).level = Math.min(from, starter);
        notes.push(`${record.name ?? record.id} 「${project.database.skills.find((s) => s.id === pick.skillId)?.name ?? pick.skillId}」 Lv${from}→Lv${pick.level}`);
      }
      low = evaluate();
    }
    const before = troop.enemyIds.map((id) => enemyOf(id)?.level ?? 0);
    const swaps: string[] = [];
    // 다른 트룹과 함께 쓰는 적 레코드는 이 트룹 전용 사본으로 뗀다(올리기·내리기가 다른 전투를 건드리지 않게).
    const ownEnemies = (): void => {
      troop.enemyIds = troop.enemyIds.map((enemyId) => {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId || typeof enemy.level !== "number") return enemyId;
        if (!project.database.troops.some((other) => other.id !== troop.id && other.enemyIds.includes(enemyId))) return enemyId;
        const copyId = `${enemyId}__${troop.id}`;
        if (!enemyOf(copyId)) project.database.enemies.push({ ...structuredClone(enemy), id: copyId } as EnemyRecord);
        return copyId;
      });
    };
    if (adjust && low.rate < FIT_WIN_RATE) {
      // ③ 깎기 — 가장 약한 스타터 도착 레벨 −1 이 바닥.
      const floor = Math.max(1, Math.min(...outcomes.map((item) => item.level)) - 1);
      ownEnemies();
      while (low.rate < FIT_WIN_RATE) {
        const lowerable = troop.enemyIds.map(enemyOf).filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level > floor);
        if (!lowerable.length) break;
        for (const enemy of lowerable) relevel(project, enemy, enemy.level! - 1);
        low = evaluate();
      }
      // ④ 관문 아닌 트룹은 몬스터를 길 풀숲 종으로.
      if (low.rate < FIT_WIN_RATE && entry.rank !== 2) {
        const pool = new Set(catchableUpTo(project, entry.stage).keys());
        const donors = new Map<string, EnemyRecord>();
        for (const enemy of project.database.enemies) if (enemy.speciesId && pool.has(enemy.speciesId) && (enemy as { monsterResourceId?: string }).monsterResourceId && !donors.has(enemy.speciesId)) donors.set(enemy.speciesId, enemy);
        for (const enemyId of [...troop.enemyIds]) {
          if (low.rate >= FIT_WIN_RATE) break;
          const enemy = enemyOf(enemyId);
          if (!enemy?.speciesId || typeof enemy.level !== "number") continue;
          const own = monsterSpeciesById(project, enemy.speciesId)?.types ?? [];
          const original = structuredClone(enemy);
          const index = project.database.enemies.findIndex((item) => item.id === enemyId);
          let best: { speciesId: string; rate: number; record: EnemyRecord } | undefined;
          const candidates = [...donors.keys()].filter((id) => id !== enemy.speciesId).sort((a, b) => {
            const sa = (monsterSpeciesById(project, a)?.types ?? []).some((t) => own.includes(t)) ? 0 : 1;
            const sb = (monsterSpeciesById(project, b)?.types ?? []).some((t) => own.includes(t)) ? 0 : 1;
            return sa - sb || (a < b ? -1 : a > b ? 1 : 0);
          });
          for (const speciesId of candidates) {
            const oldName = monsterSpeciesById(project, original.speciesId!)?.name;
            const swapped = { ...structuredClone(original), speciesId, monsterResourceId: (donors.get(speciesId) as { monsterResourceId?: string }).monsterResourceId, level: undefined, skillIds: [], actions: [], name: original.name === oldName ? monsterSpeciesById(project, speciesId)?.name ?? original.name : original.name } as EnemyRecord;
            project.database.enemies[index] = swapped;
            // level 을 비워 두고 옮긴다 — 같은 레벨이면 speciesEnemyAtLevel 이 아무것도 안 해 바꾼 종이 옛 종의 능력치·기술을 그대로 들고 있었다.
            relevel(project, swapped, original.level!);
            const trial = evaluate();
            if (!best || trial.rate > best.rate) best = { speciesId, rate: trial.rate, record: structuredClone(enemyOf(enemyId)!) };
            project.database.enemies[index] = original;
          }
          if (best && best.rate > low.rate) {
            project.database.enemies[index] = best.record;
            swaps.push(`${monsterSpeciesById(project, original.speciesId!)?.name ?? original.speciesId}→${monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId}`);
          }
          low = evaluate();
        }
      }
    }
    // ⑤ 너무 쉬운 판: 어느 스타터든 평균 남은 HP 가 HP_EASY 를 넘고 가장 약한 스타터가 띠 안(80%·HP_MARGIN)이면 상대를 한 레벨씩 올린다.
    //    가장 약한 스타터가 띠 밖으로 나가는 레벨이면 한 단계 되돌리고 멈춘다. 원래 레벨 + HP_RAISE_CAP 까지.
    const easiest = (): number => Math.max(...outcomes.map((item) => item.hpFrac));
    const raiseWhileEasy = (): void => {
      if (low.rate < FIT_WIN_RATE || easiest() <= HP_EASY) return;
      ownEnemies();
      const start = new Map(troop.enemyIds.map((id) => [id, enemyOf(id)?.level ?? 0]));
      for (let step = 0; step < HP_RAISE_CAP; step += 1) {
        const raisable = troop.enemyIds.map(enemyOf).filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level < (start.get(enemy.id) ?? 0) + HP_RAISE_CAP);
        if (!raisable.length) break;
        const saved = raisable.map((enemy) => structuredClone(enemy));
        for (const enemy of raisable) relevel(project, enemy, enemy.level! + 1);
        const trial = evaluate();
        if (trial.rate < FIT_WIN_RATE) {
          for (const record of saved) project.database.enemies[project.database.enemies.findIndex((item) => item.id === record.id)] = record;
          low = evaluate();
          break;
        }
        low = trial;
        if (easiest() <= HP_EASY) break;
      }
    };
    if (adjust) raiseWhileEasy();
    // ⑥ 관문 아닌 트룹의 종 다시 고르기 — 두 경우:
    //    (가) 같은 맵(같은 길·같은 체육관)의 앞 필수 트룹이 이미 쓴 종이거나 트룹 안에서 겹치는 종 → 아직 안 쓴 종으로 바꾼다.
    //        왜(2026-10-29 감독): 쉬움 줄이기가 1번길 트레이너 셋을 모두 피오르 Lv6 으로, 체육관 관원·관장을 모두 토리프로 두었다.
    //    (나) 그래도 너무 쉬운 판(어느 스타터든 남은 HP > HP_EASY) — 스타터끼리 상성 차이가 커 레벨로는 못 좁힌 판
    //        (1번길 트레이너가 불꽃 스타터에 95%, 물에 91~93%).
    //    후보 = 그림이 있는 적 레코드가 있는 종 가운데 스타터·선물·최종형과 전설(포획률 < 0.4)·같은 맵 앞 트룹과 이 트룹의 다른 칸이 쓴 종을 뺀 것.
    //    차례: 체육관(관문 맵)은 관문 몬스터와 타입을 나누는 종 → 이 단계까지 잡을 수 있는 길 풀숲 종 → 첫 단계 종(포획률 ≥ 0.7).
    //    앞 차례에서 띠 안(모든 스타터 80%·HP_MARGIN, 가장 쉬운 스타터 ≤ HP_EASY)인 종이 있으면 그중 가장 쉬운 스타터의 남은 HP 가 가장 낮은 종,
    //    없으면 띠 아래쪽만 지키는 종 가운데 가장 낮은 종. 레벨은 바꾸기 전 그 칸 레벨. 그다음 ⑤ 를 다시 돈다.
    //    「앞 트룹」만 보므로 두 번째 끝맺음에서 앞 트룹이 뒤 트룹 때문에 바뀌지 않는다(멱등).
    //    관문(관장·보스·챔피언)은 그 구성이 앞 관문과 똑같을 때만(보스·챔피언이 둘 다 피오르 한 마리) 같은 규칙으로 바꾼다 — 앞 관문들이 쓴 종을 피한다.
    const speciesOfTroop = (id: string): string[] => (project.database.troops.find((item) => item.id === id)?.enemyIds ?? []).map((enemyId) => enemyOf(enemyId)?.speciesId).filter((sid): sid is string => !!sid);
    const earlierGates = required.slice(0, required.indexOf(entry)).filter((other) => other.rank === 2 && other.troopId !== troop.id);
    const sameAsEarlierGate = entry.rank === 2 && earlierGates.some((other) => speciesOfTroop(other.troopId).sort().join() === speciesOfTroop(troop.id).sort().join());
    if (adjust && (entry.rank !== 2 || sameAsEarlierGate)) {
      const sameMapBefore = entry.rank === 2 ? earlierGates : required.slice(0, required.indexOf(entry)).filter((other) => other.mapId === entry.mapId && other.troopId !== troop.id);
      // 체육관 관원은 관장 종도 피한다(관장은 관문이라 바꾸지 않는다 — 관원이 관장과 같은 종이면 관원 쪽을 바꾼다).
      const gateOnMap = entry.rank === 1 && gateTroopId ? [gateTroopId] : [];
      const usedBefore = new Set([...sameMapBefore.map((other) => other.troopId), ...gateOnMap].flatMap((id) => project.database.troops.find((item) => item.id === id)?.enemyIds ?? []).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id));
      const gifts = new Set(campaignGifts(project).map((gift) => gift.speciesId));
      const art = new Map<string, string>();
      for (const enemy of project.database.enemies) {
        const resource = (enemy as { monsterResourceId?: string }).monsterResourceId;
        if (enemy.speciesId && resource && !art.has(enemy.speciesId)) art.set(enemy.speciesId, resource);
      }
      const catchable = new Set(catchableUpTo(project, entry.stage).keys());
      const gateTypes = new Set(entry.rank === 1 && gateTroopId ? defendersOf(gateTroopId).flat() : []);
      const tierOf = (speciesId: string): number => {
        const species = monsterSpeciesById(project, speciesId);
        if (gateTypes.size && (species?.types ?? []).some((type) => gateTypes.has(type))) return 0;
        if (catchable.has(speciesId)) return 1;
        return (species?.captureRate ?? 0) >= 0.7 ? 2 : 3;
      };
      // 상성 치우침(모의전 없이): 스타터마다 쉬움 = 「가장 좋은 내 기술의 상대 타입 배율 ÷ 상대 가장 좋은 기술의 내 타입 배율」,
      // 치우침 = 가장 쉬운 스타터 ÷ 가장 어려운 스타터. 1 에 가까운(모든 스타터에게 고른) 종부터 모의전한다 — 띠는 양쪽 끝을 다 봐야 해서.
      const bestMultiplier = (skillIds: readonly string[], types: readonly string[]): number => Math.max(0.5, ...skillIds.map((id) => project.database.skills.find((skill) => skill.id === id))
        .filter((skill) => !!skill && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0)
        .map((skill) => typeChartMultiplierForTypes(project, skill!.elementId, [], types)));
      const matchupLean = (speciesId: string, level: number): number => {
        const foe = monsterSpeciesById(project, speciesId);
        if (!foe) return Infinity;
        const foeMoves = monsterSkillIdsAtLevel(foe, level);
        const ease = outcomes.map((outcome) => {
          const mine = monsterSpeciesById(project, outcome.speciesId);
          if (!mine) return 1;
          return bestMultiplier(monsterSkillIdsAtLevel(mine, outcome.level), foe.types ?? []) / bestMultiplier(foeMoves, mine.types ?? []);
        });
        return Math.max(...ease) / Math.min(...ease);
      };
      // 후보 시험: 지금 가장 어려운 스타터부터 재고, 띠 아래쪽(80%·HP_MARGIN)을 못 지키는 스타터가 나오면 나머지는 재지 않는다.
      const trialBand = (): { easy: number } | null => {
        const order = [...outcomes].sort((a, b) => a.hpFrac - b.hpFrac || a.rate - b.rate).map((item) => item.speciesId);
        let easy = 0;
        for (const speciesId of order) {
          const outcome = starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId));
          if (outcome.rate < FIT_WIN_RATE) return null;
          easy = Math.max(easy, outcome.hpFrac);
        }
        return { easy };
      };
      ownEnemies();
      for (const [slot, enemyId] of [...troop.enemyIds].entries()) {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId || typeof enemy.level !== "number") continue;
        const inTroop = new Set(troop.enemyIds.filter((_, other) => other < slot).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id));
        const duplicate = usedBefore.has(enemy.speciesId) || inTroop.has(enemy.speciesId);
        if (!duplicate && (entry.rank === 2 || low.rate < FIT_WIN_RATE || easiest() <= HP_EASY)) continue;
        const original = structuredClone(enemy);
        const index = project.database.enemies.findIndex((item) => item.id === enemyId);
        const current = { rate: low.rate, easy: easiest() };
        const candidates = [...art.keys()].filter((id) => id !== original.speciesId && !choices.includes(id) && !gifts.has(id) && !usedBefore.has(id) && !inTroop.has(id)
          // 포획률 < 0.4 = 마지막 진화형·전설 — 관원 Lv8 에 벨데로드(최종형)가 나왔다. 중간형까지만.
          && (monsterSpeciesById(project, id)?.captureRate ?? 0) >= 0.4 && tierOf(id) < 3)
          .map((id) => ({ id, tier: tierOf(id), lean: matchupLean(id, original.level!) }))
          .sort((a, b) => a.tier - b.tier || a.lean - b.lean || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          // 칸마다 모의전 비용을 묶는다(차례마다 앞 2종, 모두 6종까지) — 다 보면 끝맺음이 3분 → 12분, 10종이면 9분이 됐다. 치우침 순이라 앞쪽이 띠에 가장 가깝다.
          // 앞 5종만 보던 판은 체육관 차례(풀 종)만 보고 물 스타터에게 모두 띠 밖이라 관원 셋이 다시 관장과 같은 토리프로 남았다.
          .filter((item, at, all) => all.slice(0, at).filter((other) => other.tier === item.tier).length < 2).slice(0, 6).map((item) => item.id);
        let best: { speciesId: string; tier: number; easy: number; record: EnemyRecord } | undefined;
        const better = (tier: number, easy: number): boolean => {
          if (!best) return true;
          const inBand = easy <= HP_EASY, bestIn = best.easy <= HP_EASY;
          if (inBand !== bestIn) return inBand;
          if (inBand && tier !== best.tier) return tier < best.tier;
          return easy < best.easy;
        };
        for (const speciesId of candidates) {
          // 띠 안 후보를 찾으면 멈춘다 — 후보는 차례 → 상성 치우침(matchupLean) 순이라 처음 들어온 것이 그 차례에서 가장 고른 종에 가깝다.
          // 차례 안을 모두 모의전하던 판은 ⑥ 하나에 약 110초를 썼다(2026-10-29).
          if (best && best.easy <= HP_EASY) break;
          const oldName = monsterSpeciesById(project, original.speciesId!)?.name;
          const swapped = { ...structuredClone(original), speciesId, monsterResourceId: art.get(speciesId), level: undefined, skillIds: [], actions: [], name: original.name === oldName ? monsterSpeciesById(project, speciesId)?.name ?? original.name : original.name } as EnemyRecord;
          project.database.enemies[index] = swapped;
          relevel(project, swapped, original.level!);
          const trial = trialBand();
          if (trial && better(tierOf(speciesId), trial.easy)) best = { speciesId, tier: tierOf(speciesId), easy: trial.easy, record: structuredClone(enemyOf(enemyId)!) };
          project.database.enemies[index] = original;
        }
        // 겹침은 띠 아래쪽만 지키면 바꾼다. 쉬움만 문제면 0.05 이상 나아질 때만.
        if (best && (duplicate || (current.rate >= FIT_WIN_RATE && best.easy < current.easy - 0.05))) {
          project.database.enemies[index] = best.record;
          swaps.push(`${monsterSpeciesById(project, original.speciesId!)?.name ?? original.speciesId}→${monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId}(${duplicate ? "겹침 피하기" : "쉬움 줄이기"})`);
        }
        low = evaluate();
      }
      raiseWhileEasy();
    }
    // ⑦ 기술 가르치기 — 그래도 가장 쉬운 스타터가 HP_EASY 를 넘는 판(관원이 불꽃 스타터에 82~83%, 조련사가 물에 87%, 챔피언이 풀에 85%):
    //    상대 몬스터 하나에 「가장 쉬운 스타터에게 ×2 이상이고, 남은 HP 가 0.5 아래인 스타터에게는 ×1 이하」인 피해 기술 하나를 가르친다
    //    (어느 종이든 배우는 기술만, 위력 낮은 순 앞 4개). 레벨로는 약한 스타터까지 같이 세지고, 이 기술은 쉬운 스타터만 아프게 한다.
    //    띠 안(모든 스타터 80%·HP_MARGIN, 가장 쉬운 ≤ HP_EASY)이 되는 첫 기술, 없으면 0.03 이상 나아지는 가장 좋은 기술. 기술이 넷이면 위력이 가장 낮은 것과 바꾼다.
    if (adjust && low.rate >= FIT_WIN_RATE && easiest() > HP_EASY) {
      ownEnemies();
      const easyOne = outcomes.reduce((top, item) => (item.hpFrac > top.hpFrac ? item : top));
      const typesOf = (speciesId: string) => monsterSpeciesById(project, speciesId)?.types ?? [];
      const struggling = outcomes.filter((item) => item.hpFrac < 0.5);
      const learnable = new Set((project.database.monsterSpecies ?? []).flatMap((species) => (species.skillsByLevel ?? []).map((item) => item.skillId)));
      const pool = project.database.skills.filter((skill) => learnable.has(skill.id) && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0
        && typeChartMultiplierForTypes(project, skill.elementId, [], typesOf(easyOne.speciesId)) >= 2
        && struggling.every((item) => typeChartMultiplierForTypes(project, skill.elementId, [], typesOf(item.speciesId)) <= 1))
        .sort((a, b) => (a.power ?? 0) - (b.power ?? 0) || (a.id < b.id ? -1 : 1)).slice(0, 4);
      const power = (id: string) => project.database.skills.find((skill) => skill.id === id)?.power ?? 0;
      const trial = (): number | null => {
        const order = [...outcomes].sort((a, b) => a.hpFrac - b.hpFrac).map((item) => item.speciesId);
        let easy = 0;
        for (const speciesId of order) {
          const outcome = starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId));
          if (outcome.rate < FIT_WIN_RATE) return null;
          easy = Math.max(easy, outcome.hpFrac);
        }
        return easy;
      };
      const current = easiest();
      let best: { easy: number; enemyId: string; record: EnemyRecord; skillId: string } | undefined;
      search: for (const enemyId of troop.enemyIds) {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId) continue;
        const index = project.database.enemies.findIndex((item) => item.id === enemyId);
        for (const skill of pool) {
          if ((enemy.skillIds ?? []).includes(skill.id)) continue;
          const skills = [...(enemy.skillIds ?? [])];
          if (skills.length >= 4) skills.splice(skills.indexOf([...skills].sort((a, b) => power(a) - power(b))[0]!), 1);
          const taught = { ...structuredClone(enemy), skillIds: [...skills, skill.id], actions: [...(enemy.actions ?? []).filter((action) => !action.skillId || skills.includes(action.skillId)),
            { skillId: skill.id, priority: 6, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }] } as EnemyRecord;
          project.database.enemies[index] = taught;
          const easy = trial();
          project.database.enemies[index] = enemy;
          if (easy !== null && (!best || easy < best.easy)) best = { easy, enemyId, record: taught, skillId: skill.id };
          if (best && best.easy <= HP_EASY) break search;
        }
      }
      if (best && (best.easy <= HP_EASY || best.easy < current - 0.03)) {
        project.database.enemies[project.database.enemies.findIndex((item) => item.id === best!.enemyId)] = best.record;
        notes.push(`${enemyOf(best.enemyId)?.name ?? best.enemyId} 기술 「${project.database.skills.find((skill) => skill.id === best!.skillId)?.name ?? best.skillId}」 가르침`);
      }
      low = evaluate();
    }
    const after = troop.enemyIds.map((id) => enemyOf(id)?.level ?? 0);
    if (notes.length || swaps.length || after.join() !== before.join()) {
      const who = monsterSpeciesById(project, low.speciesId)?.name ?? low.speciesId;
      const levels = after.join() !== before.join() ? ` Lv${before.join("·")}→Lv${after.join("·")}` : "";
      out.push(`필수 전투 「${troop.name || troop.id}」${levels}${notes.length ? ` · ${notes.join(", ")}` : ""}${swaps.length ? ` · 몬스터 ${swaps.join(", ")}` : ""} — 가장 약한 스타터 ${who} 도착 Lv${low.level} 승률 ${Math.round(low.rate * 100)}%${low.rate < FIT_WIN_RATE ? ", 미달" : ""}`);
    }
    rows.push({ troopId: troop.id, name: troop.name || troop.id, stage: entry.stage, rank: entry.rank, heal: healHere, outcomes });
    for (const outcome of outcomes) carry.set(outcome.speciesId, outcome.hpLeft);
    pending += troopExp(project, troop.id);
  }
  return { out, rows };
}
