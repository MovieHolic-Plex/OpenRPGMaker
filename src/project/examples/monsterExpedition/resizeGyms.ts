// 이미 지어진 몬스터 캠페인의 체육관(=배지) 수를 줄인다 — 「배지 8개를 5개로 줄여 줘」.
// 줄어든 체육관은 관장 은퇴로 끝내지 않고 건물(마을 판의 7×7 킷)·내부 맵·퍼즐째 걷어 낸다(건물 자리는 공터).
// 늘리기는 하지 않는다: 체육관 수는 마을 수·리그·밤막회사·박물관·레벨 곡선(campaignShape/campaignLevels)을 함께 정하므로
// 마을 하나를 더해도 마지막 마을·리그 문·관측탑 위치가 바뀐다 — 정직하게 거절하고 create 로 새로 짓게 한다.
//
// 정의(system.monsterCampaign)의 배지 배열만 줄이면 관장 이벤트가 그대로 남아 거짓말이 된다(2026-10-14 감사: 정의 5개·관장 8명).
// 그래서 정의·이벤트·진행 잠금·서사를 한 번에 맞춘다. 순수 함수 — 프로젝트를 제자리에서 고친다(도구가 복제본에 부른다).
import type { GameMap, Project } from "@/project/types";
import { LEGACY_CAMPAIGN_PLAN, retellForGymCount } from "./campaignPlan";
import { removeFromTree } from "@/project/mapTree";
import templateData from "./mapTemplates.json";

type Template = { width: number; height: number; tilesetId: string; names: Record<string, number>; buildings: { name: string; width: number; height: number; rowsLower: number[][]; rowsUpper: number[][] }[] };
const templates = templateData as unknown as Record<string, Template>;

export interface ResizeGymsResult {
  readonly before: number;
  readonly after: number;
  readonly removedBadges: readonly string[];
  readonly retiredLeaderEvents: readonly string[];
  readonly rewiredConditions: number;
  readonly retoldStrings: number;
  /** 체육관 건물·내부 맵·퍼즐을 통째로 걷어 낸 체육관(건물 자리는 공터가 된다). */
  readonly removedGyms: readonly string[];
}

type Raw = Record<string, unknown>;

function walkObjects(value: unknown, fn: (record: Raw) => void): void {
  if (Array.isArray(value)) { for (const v of value) walkObjects(v, fn); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Raw;
  fn(record);
  for (const v of Object.values(record)) walkObjects(v, fn);
}

const setsSwitch = (commands: unknown, ids: ReadonlySet<string>): boolean => {
  let found = false;
  walkObjects(commands, r => { if (r.kind === "setSwitch" && typeof r.switchId === "string" && ids.has(r.switchId) && r.value !== false) found = true; });
  return found;
};

/** 줄어든 체육관을 건물·내부·퍼즐째 걷어 낸다. 성공하면 true, 못 찾으면 false(호출자는 관장 은퇴로 대신한다). */
function removeGymBuilding(project: Project, town: GameMap | undefined, gymMapId: string): boolean {
  const gym = project.maps[gymMapId];
  if (!town || !gym) return false;
  const door = town.events.find(e => {
    let found = false;
    walkObjects(e.pages ?? e.commands, r => { if (r.kind === "transfer" && r.mapId === gymMapId) found = true; });
    return found;
  });
  if (!door) return false;
  // 1) 마을 판의 체육관 건물(7×7 킷)을 찾는다 — 문 칸이 킷 맨 아랫줄에 있고 칸들이 킷과 일치하는 자리.
  let footprint: { ox: number; oy: number; w: number; h: number } | undefined;
  const names: Record<string, number> = {};
  for (const t of Object.values(templates)) {
    if (t.tilesetId !== town.tilesetId) continue;
    Object.assign(names, t.names);
    if (footprint) continue;
    for (const kit of t.buildings) {
      if (!kit.name.startsWith("gym_")) continue; // 체육관 킷만 철거한다 — 일반 집·도시 건물은 문만 닫는다.
      for (let ox: number = door.x - (kit.width - 1); ox <= door.x && !footprint; ox++) {
        const oy: number = door.y - (kit.height - 1);
        if (ox < 0 || oy < 0 || ox + kit.width > town.width || oy + kit.height > town.height) continue;
        let matches = true;
        for (let y = 0; y < kit.height && matches; y++) for (let x = 0; x < kit.width; x++) {
          const i = (oy + y) * town.width + ox + x;
          if ((kit.rowsLower[y]![x]! >= 0 && town.lowerTiles[i] !== kit.rowsLower[y]![x])
            || (kit.rowsUpper[y]![x]! >= 0 && town.upperTiles[i] !== kit.rowsUpper[y]![x])) { matches = false; break; }
        }
        if (matches) footprint = { ox, oy, w: kit.width, h: kit.height };
      }
    }
  }
  // 건물 킷을 못 찾은 마을(체육관이 일반 건물 킷·도시 건물에 문만 낸 판)은 건물은 두고 문만 닫는다 — 평범한 닫힌 건물이 된다.
  const closeDoorOnly = () => {
    for (const page of door.pages ?? []) { page.commands = [{ kind: "text", body: "문이 굳게 닫혀 있다. 이 건물은 지금 쓰이지 않는 것 같다." }] as typeof page.commands; page.conditions = []; }
    if (!door.pages?.length) door.commands = [{ kind: "text", body: "문이 굳게 닫혀 있다. 이 건물은 지금 쓰이지 않는 것 같다." }] as typeof door.commands;
  };
  // 2) 건물 자리를 둘레 땅으로 덮는다(가장 흔한 둘레 칸) — 투명 칸 아래도 같은 땅이라 구멍이 안 난다. 자리에 비는 칸이 없게 소품 몇 개를 흩는다.
  if (!footprint) { closeDoorOnly(); return finishRemoval(project, town, gymMapId, door, true); }
  const ring = new Map<number, number>();
  for (let y = footprint.oy - 1; y <= footprint.oy + footprint.h; y++) for (let x = footprint.ox - 1; x <= footprint.ox + footprint.w; x++) {
    const inside = x >= footprint.ox && x < footprint.ox + footprint.w && y >= footprint.oy && y < footprint.oy + footprint.h;
    if (inside || x < 0 || y < 0 || x >= town.width || y >= town.height) continue;
    const t = town.lowerTiles[y * town.width + x]!;
    if (t >= 0) ring.set(t, (ring.get(t) ?? 0) + 1);
  }
  const ground = [...ring.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (ground === undefined) { closeDoorOnly(); return finishRemoval(project, town, gymMapId, door, true); }
  const decor = ["flower_red", "flower_white", "bush0", "bush1", "boulder0", "ash_pile0", "ash_pile1", "lava_rock0", "dbush", "drock0", "cactus"].flatMap(n => names[n] !== undefined ? [names[n]!] : []);
  const edge = (x: number, y: number) => (Math.imul(x + 3, 374761393) ^ Math.imul(y + 5, 668265263)) >>> 0;
  for (let y = 0; y < footprint.h; y++) for (let x = 0; x < footprint.w; x++) {
    const i = (footprint.oy + y) * town.width + footprint.ox + x;
    town.lowerTiles[i] = ground; town.upperTiles[i] = -1;
    if (decor.length && y < footprint.h - 2 && edge(footprint.ox + x, footprint.oy + y) % 7 === 0) town.upperTiles[i] = decor[edge(x, y) % decor.length]!;
  }
  // 3) 문 이벤트와 내부 맵·연결을 지운다.
  return finishRemoval(project, town, gymMapId, door, false);
}

function finishRemoval(project: Project, town: GameMap, gymMapId: string, door: GameMap["events"][number], keepDoorEvent: boolean): boolean {
  if (!keepDoorEvent) town.events = town.events.filter(e => e !== door);
  delete project.maps[gymMapId];
  if (project.mapTree) removeFromTree(project.mapTree, gymMapId);
  project.mapConnections = (project.mapConnections ?? []).filter(c => c.from.mapId !== gymMapId && c.to.mapId !== gymMapId);
  // 안내원 대사의 「체육관에서 도전」 문장도 고친다.
  const phrase = "북동쪽 건물에서 지역의 관장에게 도전할 수 있어요.";
  walkObjects(town.events, r => { if (typeof r.body === "string" && r.body.includes(phrase)) r.body = r.body.replace(phrase, "이 마을의 체육관은 문을 닫았어요."); });
  return true;
}

export function resizeCampaignGyms(project: Project, countInput: number): ResizeGymsResult {
  const campaign = project.system.monsterCampaign;
  if (!campaign) throw new Error("몬스터 캠페인 정의가 없습니다.");
  const count = Math.round(countInput);
  const before = campaign.badges.length;
  if (!Number.isFinite(count) || count < 0) throw new Error("체육관 수는 0 이상의 정수여야 합니다.");
  if (count > before) throw new Error(`체육관은 이 도구로 늘릴 수 없습니다(현재 ${before}개 → ${count}개). 체육관 수는 마을·길·리그·밤막회사·레벨 곡선을 함께 정하므로 기존 게임에 마을 하나를 덧대면 마지막 마을의 리그 문과 관측탑이 어긋납니다. 늘리려면 build_monster_game {mode:"create", replace:true, gymCount:${count}} 로 그 규모를 새로 짓거나, 마을·체육관 맵을 직접 더한 뒤 definition.badges 로 등록하세요.`);
  const removed = campaign.badges.slice(count);
  const removedSwitches = new Set(removed.map(b => b.switchId));
  // 앞선 약속(마지막으로 남는 배지, 0이면 스타터)으로 잠금을 옮긴다.
  const fallback = count > 0 ? campaign.badges[count - 1]!.switchId : (campaign.objectives[0]?.switchId ?? "mx_starter");
  const retired: string[] = [];
  const removedGyms: string[] = [];
  let rewired = 0;
  if (removed.length) {
    // 0) 체육관 건물·내부 맵·퍼즐째 걷어 낸다 — 관장만 은퇴한 빈 시험장이 남던 것(2026-10-14 감사)을 없앤다.
    // 건물을 못 찾는 저작본(사용자가 고친 마을)은 아래 1)의 관장 은퇴로 대신한다.
    for (const badge of removed) {
      const gymMapId = `${badge.cityMapId}_gym`;
      if (removeGymBuilding(project, project.maps[badge.cityMapId], gymMapId)) removedGyms.push(gymMapId);
    }
    // 1) 그 배지를 주는 관장 이벤트 — 대전·배지 지급을 지우고(건물을 못 걷어 낸 체육관은 그대로 열어 둔다).
    for (const map of Object.values(project.maps)) for (const event of map.events) {
      if (!setsSwitch(event.pages ?? event.commands, removedSwitches)) continue;
      const hasBattle = (() => { let found = false; walkObjects(event.pages ?? event.commands, r => { if (r.kind === "battleProcessing") found = true; }); return found; })();
      if (!hasBattle) continue;
      const retire = (): unknown[] => [{ kind: "text", body: "이 체육관은 이제 시험을 열지 않아. 관장은 오래전에 약속을 마쳤단다. 길을 가는 여행자에게 행운을 빌어 줄게." }];
      if (event.pages?.length) for (const page of event.pages) { page.commands = retire() as typeof page.commands; page.conditions = []; }
      else event.commands = retire() as typeof event.commands;
      retired.push(`${map.id}:${event.id}`);
    }
    // 2) 그 배지로 잠긴 문·대전·목표 — 앞선 약속으로.
    const rewire = (record: Raw): void => {
      if (record.kind === "switch" && typeof record.switchId === "string" && removedSwitches.has(record.switchId)) { record.switchId = fallback; rewired++; }
    };
    for (const map of Object.values(project.maps)) walkObjects(map.events, rewire);
    walkObjects(project.commonEvents, rewire);
    walkObjects(project.endings, rewire);
    for (const objective of campaign.objectives) if (objective.requiresSwitchId && removedSwitches.has(objective.requiresSwitchId)) { objective.requiresSwitchId = fallback; rewired++; }
    // 3) 정의 — 배지와 그 배지를 받으라는 목표를 덜어 낸다.
    campaign.badges = campaign.badges.slice(0, count);
    campaign.objectives = campaign.objectives.filter(o => !removedSwitches.has(o.switchId));
  }
  campaign.plan = { ...(campaign.plan ?? { ...LEGACY_CAMPAIGN_PLAN, species: Math.min(LEGACY_CAMPAIGN_PLAN.species, campaign.speciesIds.length) }), gyms: count };
  const retold = removed.length ? retellForGymCount(project, count) : 0;
  return { before, after: count, removedBadges: removed.map(b => b.name), retiredLeaderEvents: retired, rewiredConditions: rewired, retoldStrings: retold, removedGyms };
}
