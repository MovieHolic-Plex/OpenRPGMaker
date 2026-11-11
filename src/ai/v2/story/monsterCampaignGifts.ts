// 몬스터 원정의 회복 샘·선물 동료·스타터 승률 — 원정 채비(equipMonsterCampaign), 단계별 선물(campaignGifts), 스타터별 전투 결과(starterOutcome).
import { EVENT_TOOLS } from "@/editor/tools/eventTools";
import { isPassableLanding } from "@/project/collision";
import { totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterMaxHp, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { GameMap, Project } from "@/project/types";
import { Obj, HP_MARGIN, walk, starterLevel, loneMonster, transfersBetween, campaignGates } from "./monsterCampaign";
import { FIT_WIN_RATE, fitSimulate } from "./monsterFitBudget";

/**
 * 고를 수 있는 스타터 종 전부 — 첫 giveMonster 가 든 이벤트의 giveMonster 들(박사의 세 선택지). 이벤트가 하나만 주면 그 하나.
 * 왜(2026-10-29 standin monster): 관문 곡선을 첫 선택지(풀)로만 재서, 풀이 아닌 스타터를 고른 판을 못 봤다.
 */
export function starterChoices(project: Project): string[] {
  // 끝맺음이 스타터 고르기 갈래에 끼운 선물 동료(campaignGifts)는 고를 수 있는 스타터가 아니다 — 세면 선물이 「혼자 싸우는 스타터」로 잡혔다.
  const gifts = new Set(campaignGifts(project).map((gift) => gift.speciesId));
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const ids: string[] = [];
    walk(event.pages, (cmd) => { if (cmd.kind === "giveMonster" && typeof cmd.speciesId === "string" && !gifts.has(cmd.speciesId) && !ids.includes(cmd.speciesId)) ids.push(cmd.speciesId); });
    if (ids.length) return ids;
  }
  return [];
}

/** 이 맵에 회복 명령(recoverAll)이 있는가 — 센터 간호사·체육관 회복 지점. */
export function mapHasHeal(map: GameMap | undefined): boolean {
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
export function walkRequired(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walkRequired(item, visit); return; }
  if (!node || typeof node !== "object") return;
  const cmd = node as Obj;
  visit(cmd);
  if (cmd.kind === "choices") return;
  for (const value of Object.values(cmd)) if (value && typeof value === "object") walkRequired(value, visit);
}

/** 원정 단계 정보: 관문 순서, 길 맵의 단계(이동 명령으로 이어진 배지 마을의 관문 순번, 없으면 0). */
export function campaignStages(project: Project) {
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
export function catchableUpTo(project: Project, stage: number): Map<string, number> {
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

export interface StarterOutcome { readonly speciesId: string; readonly rate: number; readonly level: number; readonly hpLeft: number; readonly hpFrac: number }

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
export function giftAnchors(project: Project, stage: number): { list: unknown[]; index: number; switchId: string }[] {
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
