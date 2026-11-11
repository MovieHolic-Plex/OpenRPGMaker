// ai/v2/story/monsterRouteLevels.ts
import { monsterBalanceParty } from "@/editor/tools/troopBalanceCheck";
import { totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterSpeciesById } from "@/project/monsterCollection";
import type { EnemyRecord, Project } from "@/project/types";
import { walk, starterLevel, starterSpeciesId, troopExp, troopMaxLevel, gateLevel, transfersBetween, routeTrainerTroops, enemyHomeMaps, relevel, campaignGates } from "./monsterCampaign";
import { FIT_WIN_RATE, fitSimulate } from "./monsterFitBudget";
import { starterChoices, starterOutcome } from "./monsterCampaignGifts";

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
      try {
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
      } catch (error) {
        // 예산 초과 등 어떤 예외든 시도 중이던 레벨을 되돌린다 — 반쯤 올린 상태가 남으면 안 된다(맞춤은 «바뀐 것만 남는다»).
        project.database.enemies = [...saved];
        throw error;
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
      try {
        for (let delta = shift; delta > 0; delta -= 1) {
          apply(delta);
          const party = monsterBalanceParty(project, troopId, prev);
          if (!party?.length) return delta;
          if (fitSimulate(project, troopId, prev, party).winRate >= FIT_WIN_RATE) return delta;
          project.database.enemies = [...saved];
        }
      } catch (error) {
        project.database.enemies = [...saved]; // 예외(예산 초과 포함)로 빠져도 시도 중이던 레벨을 되돌린다.
        throw error;
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
