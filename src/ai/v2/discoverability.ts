// ai/v2/discoverability.ts
/**
 * 새 플레이어가 길을 찾을 수 있나 — 이야기를 움직이는 이벤트가 화면에 보이고, 지금 할 일이 늘 화면에 있는가(2026-10-26 판정 J90).
 *
 * 왜: 연애 게임 「다음 역에서 내려요」(romance-j90)에서 하루를 끝내는 「집 현관」은 시작 칸 바로 위의 투명 이벤트였고 목표 안내가 없었다.
 * 자동 플레이는 엔딩 셋을 다 닿았지만 사람 판정자는 한 시간 동안 1일차에서 못 벗어났다.
 *
 * 이야기 이벤트 = 주인공이 직접 여는(조사·접촉) 이벤트 가운데 엔딩을 부르거나, 다른 이벤트·엔딩이 읽는 스위치·변수·아이템을 바꾸는 것.
 * 보인다 = 캐릭터·타일 그림이 있거나, 빛무리(glow)·가까이 반짝임(nearSparkle)이 있거나, 그 칸(또는 바로 위 칸)에 작은 물건이 그려져 있다.
 * 건물 한 채의 벽·문은 «보인다»로 치지 않는다 — 같은 문이 여럿인 거리에서 어느 문인지 모른다(반짝임을 단다).
 * 목표 = 「현재 목표」 줄(UI 명령 objectiveChip). 게임 시작에 하나, 이정표(스위치 켜기·아이템 얻기)마다 새로 — 엔딩이면 필요 없다.
 */
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { allPages, childLists, conditionLeaves, visitPageCommands, type PageRef, type RawCommand } from "@/qa/gameCheck/walk";
import { objectClusterAt } from "@/project/objectFootprint";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { mapRoute, objectiveTargetViews } from "@/player/objectiveTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import { computeReachableCells } from "@/project/lint/reachability";
import { josa } from "@/util/josa";
import { unreachableEvents } from "./eventReach";

export const OBJECTIVE_COMMAND_ID = "m2-214-ui-command";
export const OBJECTIVE_SURFACE = "objectiveChip";

/** 「현재 목표」 줄을 바꾸는 명령 — 실행되면 화면 오른쪽 위 목표 줄이 이 글로 바뀐다(playSceneZoneFeedback). */
export function objectiveCommand(message: string): RawCommand {
  return { kind: "m2Command", commandId: OBJECTIVE_COMMAND_ID, fields: { surface: OBJECTIVE_SURFACE, message, durationMs: 0 } };
}

export function isObjectiveCommand(command: RawCommand): boolean {
  if (command.kind !== "m2Command" || command.commandId !== OBJECTIVE_COMMAND_ID) return false;
  const fields = command.fields as Record<string, unknown> | undefined;
  return fields?.surface === OBJECTIVE_SURFACE && typeof fields.message === "string" && fields.message.trim().length > 0;
}

type Key = `sw:${string}` | `var:${string}` | `item:${string}`;

/** 조건으로 읽히는 상태 → 그 조건을 가진 이벤트 id 들("" = 공통 이벤트·엔딩·자기 밖). */
function readers(project: Project): Map<Key, Set<string>> {
  const out = new Map<Key, Set<string>>();
  const add = (key: Key, owner: string) => { let set = out.get(key); if (!set) out.set(key, set = new Set()); set.add(owner); };
  const leafKeys = (leaf: Record<string, unknown>): Key[] => {
    if (leaf.kind === "switch" && typeof leaf.switchId === "string") return [`sw:${leaf.switchId}`];
    if (leaf.kind === "variable" && typeof leaf.variableId === "string") return [`var:${leaf.variableId}`];
    // 「이 아이템이 없으면」(present:false)은 다 쓴 소모품을 다시 채우는 분기다 — 진행을 읽는 것이 아니다. 2026-10-29 standin monster:
    // 집 엄마·보물 상자가 포획구슬을 주자 «구슬이 없으면 세 개» 주민을 다음 이정표로 보고 「「mx_map_grove_house_resident」를 찾아가자」가
    // 본 목표(체육관·관측탑)를 덮었다.
    if (leaf.kind === "item" && typeof leaf.itemId === "string") return leaf.present === false ? [] : [`item:${leaf.itemId}`];
    return [];
  };
  for (const page of allPages(project)) {
    const owner = page.event?.id ?? "";
    for (const condition of page.conditions) for (const leaf of conditionLeaves(condition)) for (const key of leafKeys(leaf)) add(key, owner);
    visitPageCommands(page, ({ command }) => {
      if (command.kind === "fork") for (const leaf of conditionLeaves(command.condition)) for (const key of leafKeys(leaf)) add(key, owner);
    });
  }
  const endings = JSON.stringify(project.endings ?? []);
  for (const m of endings.matchAll(/"(switchId|variableId|itemId)":"([^"]+)"/gu)) add(`${m[1] === "switchId" ? "sw" : m[1] === "variableId" ? "var" : "item"}:${m[2]}` as Key, "");
  return out;
}

interface Write { readonly key: Key; readonly milestone: boolean }

function writesOf(command: RawCommand): Write[] {
  if (command.kind === "setSwitch" && typeof command.switchId === "string") return [{ key: `sw:${command.switchId}`, milestone: command.value === true }];
  if (command.kind === "setVariable" && typeof command.variableId === "string") return [{ key: `var:${command.variableId}`, milestone: false }];
  if (command.kind === "changeItem" && typeof command.itemId === "string") return [{ key: `item:${command.itemId}`, milestone: command.op !== "-=" }];
  return [];
}

const playerDriven = (page: PageRef): boolean => {
  const kind = (page.trigger as { kind?: string } | undefined)?.kind;
  return kind === "action" || kind === "playerTouch" || kind === "eventTouch" || kind === "touch";
};

export interface StoryEvent {
  readonly mapId: string;
  readonly mapName: string;
  readonly eventId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly pageIndex: number;
  readonly ends: boolean;
  /** 다른 이벤트가 읽는 스위치를 켜거나 아이템을 준다 — 다음 할 일이 바뀐다. */
  readonly milestone: boolean;
  readonly setsObjective: boolean;
  readonly visible: boolean;
}

function drawnAt(map: GameMap, x: number, y: number): boolean {
  const filled = (layer: readonly number[] | undefined, cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < map.width && cy < map.height && (layer?.[cy * map.width + cx] ?? -1) >= 0;
  return [map.upperTiles, map.upperOverlayTiles, map.lowerOverlayTiles].some((layer) => filled(layer, x, y) || filled(layer, x, y - 1));
}

/** 그 칸의 그림이 작은 물건 하나(상자·침대·표지판·문짝)인가 — 건물 한 채 전체의 벽면이면 「어느 문인지」 모른다(J90 집 현관). */
const SMALL_OBJECT_CELLS = 6;
function smallObjectAt(project: Project, map: GameMap, x: number, y: number): boolean {
  for (const cy of [y, y - 1]) {
    const cluster = objectClusterAt(project, map, x, cy);
    if (cluster) return cluster.cells.length <= SMALL_OBJECT_CELLS;
  }
  return drawnAt(map, x, y);
}

function pageVisible(project: Project, page: PageRef, map: GameMap, x: number, y: number): boolean {
  const raw = page.page as unknown as Record<string, unknown> | undefined;
  const graphic = (raw?.graphic ?? (page.event as unknown as Record<string, unknown> | undefined)?.sprite) as Record<string, unknown> | undefined;
  const hasGraphic = !!graphic && graphic.transparent !== true && Object.keys(graphic).some((k) => k !== "transparent" && graphic[k] !== undefined && graphic[k] !== "" && graphic[k] !== null);
  return hasGraphic || !!raw?.glow || !!raw?.nearSparkle || smallObjectAt(project, map, x, y);
}

/** 주인공이 여는 이야기 이벤트 페이지들. */
export function storyEvents(project: Project): StoryEvent[] {
  const read = readers(project);
  const out: StoryEvent[] = [];
  for (const page of allPages(project)) {
    if (!page.map || !page.event || !playerDriven(page)) continue;
    let ends = false, milestone = false, story = false, setsObjective = false;
    visitPageCommands(page, ({ command }) => {
      if (command.kind === "triggerEnding") ends = true;
      if (isObjectiveCommand(command)) setsObjective = true;
      for (const write of writesOf(command)) {
        const owners = read.get(write.key);
        if (!owners) continue;
        const others = [...owners].some((owner) => owner !== page.event!.id);
        if (!others) continue;
        story = true;
        if (write.milestone) milestone = true;
      }
    });
    if (!ends && !story) continue;
    out.push({
      mapId: page.map.id, mapName: page.map.name ?? page.map.id, eventId: page.event.id, name: page.event.name ?? page.event.id,
      x: page.event.x, y: page.event.y, pageIndex: page.pageIndex, ends, milestone, setsObjective,
      // 다른 맵으로 옮기는 페이지는 출구다 — 런타임이 「→ 목적지」 글자를 띄운다(2026-10-29 vm8: 들어가면 끝나는 입구 단계를 문 이동에 실었다).
      visible: pageVisible(project, page, page.map, page.event.x, page.event.y) || leavesMap(page.commands, page.map.id),
    });
  }
  return out;
}

function leavesMap(node: unknown, here: string): boolean {
  if (Array.isArray(node)) return node.some((n) => leavesMap(n, here));
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer" && typeof r.mapId === "string" && r.mapId !== here) return true;
  return Object.values(r).some((v) => v && typeof v === "object" && leavesMap(v, here));
}

/** 이야기 이벤트인데 화면에 아무것도 안 보인다(투명·그림 없음·반짝임 없음·그려진 물건 없음). */
export function invisibleStoryEvents(project: Project): StoryEvent[] {
  return storyEvents(project).filter((event) => !event.visible);
}

function startPages(project: Project): PageRef[] {
  return allPages(project).filter((page) => {
    const kind = (page.trigger as { kind?: string } | undefined)?.kind;
    const auto = kind === "auto" || kind === "parallel";
    if (page.commonEventId) return true;
    return auto && page.map?.id === project.startMapId;
  });
}

/** 목표 줄 문제 — 빈 배열이면 통과. */
export function objectiveGaps(project: Project): string[] {
  const gaps: string[] = [];
  const hud = project.system.fieldHud as { objective?: boolean } | undefined;
  let any = false;
  for (const page of allPages(project)) visitPageCommands(page, ({ command }) => { if (isObjectiveCommand(command)) any = true; });
  if (!any) return ["게임 어디에도 「현재 목표」 줄이 없다 — 새 플레이어가 무엇을 해야 하는지 화면에서 읽을 수 없다. set_objective{text, at:'start'} 로 시작 목표를 걸고, 이정표 이벤트마다 set_objective{text, eventId} 로 다음 목표를 건다."];
  if (hud && hud.objective === false) gaps.push("필드 HUD 가 「현재 목표」 줄을 숨긴다(fieldHud.objective:false) — set_objective 를 한 번 부르면 켜진다.");
  let atStart = false;
  for (const page of startPages(project)) visitPageCommands(page, ({ command }) => { if (isObjectiveCommand(command)) atStart = true; });
  if (!atStart) gaps.push("게임을 시작했을 때 「현재 목표」 줄이 비어 있다 — 시작 맵의 자동 실행(오프닝 뒤 첫 컷신)에서 목표를 건다: set_objective{text, at:'start'}.");
  const startGap = startObjectiveReachGap(project);
  if (startGap) gaps.push(startGap);
  // 「어디」 — 다른 장소 이름만 대고 그 입구가 어디인지 말하지 않는 목표(J105: 「지하철역의 지훈」 만 보고 역 입구를 못 찾았다).
  let vague = 0;
  const landings = objectiveLandings(project);
  for (const page of allPages(project)) {
    const pageMapId = page.map?.id ?? project.startMapId;
    visitPageCommands(page, ({ command }) => {
      if (vague >= 3 || !isObjectiveCommand(command)) return;
      const message = String((command.fields as Record<string, unknown>).message);
      // 이미 방위가 붙은 목표(「(… 입구: … 남동쪽)」·「(지하철역 북쪽)」)는 통과 — where 로 붙인 힌트는 글 속 장소 이름 힌트와 다를 수 있다.
      if (/입구:|\([^()]*(북|남|동|서|가운데)[^()]*\)\s*$/u.test(message)) return;
      const fromMapId = landings.get(command)?.mapId ?? pageMapId;
      // 같은 맵 이벤트 이름 꼬리 「(마을 시작)」 도 「어디」다 — whereHint 가 같은 맵 대상에 붙이는 꼴이고 런타임 표시가 그 이벤트를 짚는다.
      const labelTail = /\(([^():]+)\)\s*$/u.exec(message)?.[1];
      if (labelTail && (project.maps[fromMapId]?.events ?? []).some((event) => bare(String(event.name ?? "")).length >= 2 && bare(String(event.name)) === bare(labelTail))) return;
      if (withWhere(project, fromMapId, message) === message) return;
      vague += 1;
      gaps.push(`목표 「${message.slice(0, 40)}」 가 다른 장소 이름만 대고 그 입구가 어디인지 말하지 않는다 — 새 플레이어가 길을 못 찾는다. 같은 글로 set_objective 를 다시 부르면 「(지하철역 입구: 남동쪽)」 처럼 방위가 붙는다(where 로 대상 이벤트·장소를 줄 수도 있다).`);
    });
  }
  const stale = storyEvents(project).filter((event) => event.milestone && !event.ends && !event.setsObjective);
  for (const event of stale.slice(0, 4)) {
    gaps.push(`「${event.mapName}」 ${event.name}(${event.eventId}, ${event.x},${event.y}) 이 이야기를 한 단계 넘기는데 다음 목표를 바꾸지 않는다 — 앞 목표가 그대로 남아 새 플레이어가 길을 잃는다. set_objective{text: 다음에 할 일, eventId:'${event.eventId}'}.`);
  }
  return gaps;
}

/**
 * 다음 목표를 바꾸지 않는 이정표 이벤트(objectiveGaps 의 마지막 항목과 같은 판정)와, 그 이벤트가 쓰는 스위치·아이템을 읽는 다음 이벤트들.
 * 출하 기본값(shipDefaults)이 「다음 이벤트를 찾아가자」 목표를 거는 데 쓴다. 엔딩 정의만 읽으면 readers 가 빈 목록이다.
 */
export function staleMilestoneTargets(project: Project): { readonly event: StoryEvent; readonly readers: readonly { readonly mapId: string; readonly eventId: string; readonly name: string }[] }[] {
  const read = readers(project);
  const where = new Map<string, { mapId: string; name: string }>();
  // 이름 없는 이벤트는 이름을 비운다 — id(mx_map_grove_house_resident)를 목표 글에 그대로 실으면 안 된다.
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) where.set(event.id, { mapId: map.id, name: String(event.name ?? "") });
  const stale = storyEvents(project).filter((event) => event.milestone && !event.ends && !event.setsObjective);
  return stale.map((event) => {
    const keys = new Set<Key>();
    for (const page of allPages(project)) if (page.event?.id === event.eventId && page.pageIndex === event.pageIndex) visitPageCommands(page, ({ command }) => { for (const w of writesOf(command)) if (w.milestone) keys.add(w.key); });
    const ids = new Set<string>();
    for (const key of keys) for (const owner of read.get(key) ?? []) if (owner && owner !== event.eventId) ids.add(owner);
    return { event, readers: [...ids].sort().flatMap((id) => { const at = where.get(id); return at ? [{ mapId: at.mapId, eventId: id, name: at.name }] : []; }) };
  });
}

/** 맵의 이벤트를 첫 페이지로 본 정적 보기 — 목표 표시 해석(objectiveTargetViews)을 빌더 쪽에서 같은 규칙으로 돌린다. */
function staticEventViews(map: GameMap): RuntimeEventView[] {
  return (map.events ?? []).map((event) => {
    const page = event.pages?.[0];
    return { event, page, pageId: page?.id, x: event.x, y: event.y, trigger: page?.trigger ?? event.trigger ?? { kind: "action" } } as unknown as RuntimeEventView;
  });
}

/**
 * 시작 직후 플레이어가 선 자리에서 시작 목표가 가리키는 대상(이벤트·출구)까지 걸어갈 수 있나 — 런타임 목표 표시와 같은 해석으로 대상을 고른다.
 * 대상을 못 고르는데 꼬리가 「(… 입구: …)」 면(문을 약속했는데 시작 맵에 그 문이 없다) 그것도 짚는다.
 */
export function startObjectiveReachGap(project: Project): string | undefined {
  const map = project.maps[project.startMapId];
  const sp = project.startPos as Cell | undefined;
  if (!map || !sp) return undefined;
  let message: string | undefined;
  for (const page of startPages(project)) visitPageCommands(page, ({ command }) => {
    if (message === undefined && isObjectiveCommand(command)) message = String((command.fields as Record<string, unknown>).message);
  });
  if (!message) return undefined;
  const targets = objectiveTargetViews(project, map, staticEventViews(map), message);
  if (!targets.length) {
    return /입구:/u.test(message) ? `시작 목표 「${message.slice(0, 50)}」 가 입구를 가리키는데 시작 맵 「${map.name ?? map.id}」 에서 그리로 가는 출구(옮기기 이벤트)를 찾지 못한다 — 출구를 잇거나 목표를 다시 건다(set_objective at:'start').` : undefined;
  }
  const reach = computeReachableCells(project, map, sp.x, sp.y);
  // 몸 사각(가구 전체 3×1 책상)의 어느 칸 옆이든 닿으면 된다 — 런타임 조사는 몸 사각으로 받는다(2026-10-29 vm5 flash: 책상 가운데 앵커 앞이 의자).
  const near = (view: RuntimeEventView) => {
    const r = eventBodyRect(view.event);
    for (let y = r.top; y <= r.bottom; y++) for (let x = r.left; x <= r.right; x++) if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(`${x + dx!},${y + dy!}`))) return true;
    return false;
  };
  if (targets.some(near)) return undefined;
  const t = targets[0]!;
  return `시작 자리(${sp.x},${sp.y})에서 시작 목표의 대상 「${String(t.event.name ?? t.event.id)}」(${t.x},${t.y}) 까지 걸어갈 수 없다 — 새 플레이어는 첫 목표에 닿지 못한다. 길을 트거나 대상·시작 자리를 옮긴다.`;
}

/**
 * 전투 승리 스위치로 잠긴 이벤트 → 그 스위치를 켜는 전투 이벤트(같은 맵·다른 맵). 잠김 = 그 스위치를 조건으로 단 페이지와 달지 않은
 * 페이지가 함께 있다(gateBattleSteps 의 「아직 못 이김」). 켜는 쪽 = battleProcessing 과 그 스위치 켜기를 함께 가진 다른 이벤트.
 * 켜는 쪽 이름이 비었으면 부대 이름으로 채운다(제자리 수정).
 */
function battleGateHolders(project: Project): Map<string, { switchId: string; holder: { map: GameMap; event: GameMap["events"][number] } }> {
  const setters = new Map<string, { map: GameMap; event: GameMap["events"][number]; troopId?: string }>();
  for (const ref of allPages(project)) {
    let troopId: string | undefined;
    const sets: string[] = [];
    visitPageCommands(ref, ({ command }) => {
      if (command.kind === "battleProcessing") troopId ??= String(command.troopId ?? "");
      if (command.kind === "setSwitch" && command.value === true && typeof command.switchId === "string") sets.push(command.switchId);
    });
    if (troopId !== undefined && ref.map && ref.event) for (const id of sets) if (!setters.has(id)) setters.set(id, { map: ref.map!, event: ref.event!, troopId });
  }
  const out = new Map<string, { switchId: string; holder: { map: GameMap; event: GameMap["events"][number] } }>();
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const pages = event.pages ?? [];
    for (const [switchId, setter] of setters) {
      if (setter.event.id === event.id) continue;
      const has = (page: (typeof pages)[number]) => (page.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === switchId);
      if (!pages.some(has) || pages.every(has)) continue;
      if (!String(setter.event.name ?? "").trim()) {
        const troop = project.database.troops.find((t) => t.id === setter.troopId);
        if (troop?.name) (setter.event as { name?: string }).name = troop.name;
      }
      if (!String(setter.event.name ?? "").trim()) continue;
      out.set(event.id, { switchId, holder: { map: setter.map, event: setter.event } });
      break;
    }
  }
  return out;
}

/**
 * 「(<맵> 입구: …)」 꼬리를 지금 맵 연결로 다시 쓴다(끝맺음 조립에서 한 번, 모델 없음).
 * 목표 글은 짓는 도중에 걸리고 문·맵은 그 뒤에도 바뀐다 — 마지막 상태에서 «목표가 걸리는 자리에서 본 첫 출구» 방위와
 * 그 뒤 대상(다음 청사진 단계 이벤트)을 다시 붙인다. 바꾼 목표 수를 돌려준다.
 * 대상 이벤트가 전투 승리 스위치로 잠겨 있으면(gateBattleSteps: 「마왕과의 결전」은 보스를 이긴 뒤에만 넘어간다) 목표는 그 전투를 가리킨다 —
 * 2026-10-29 vm2 terra jrpg: 「동굴의 흔적」 뒤 목표가 「(마왕과의 결전)」 이라 표시가 바로 옆(1칸) 결전 이벤트를 짚었고, 진짜 할 일인
 * 마왕(27,9)은 이름이 없어 아무 표시도 받지 못했다. 이름 없는 보스 이벤트에는 부대 이름을 붙인다(런타임 표시는 이름으로 짚는다).
 */
export function refreshObjectiveRoutes(project: Project): number {
  const holders = battleGateHolders(project);
  const landings = objectiveLandings(project);
  const steps = project.gameBlueprint?.steps ?? [];
  const find = (ref: string | undefined) => {
    if (!ref) return undefined;
    for (const map of Object.values(project.maps)) {
      const event = (map.events ?? []).find((e) => e.id === ref || e.name === ref);
      if (event) return { map, event };
    }
    return undefined;
  };
  let changed = 0;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const k = steps.findIndex((step) => step.event === event.id || step.event === event.name);
    for (const page of event.pages ?? []) {
      const opening = map.id === project.startMapId && ["auto", "parallel"].includes(String((page.trigger as { kind?: string } | undefined)?.kind));
      const pageOrigin: Cell = opening && project.startPos ? project.startPos as Cell : { x: event.x, y: event.y };
      const stepNext = k >= 0 ? find(steps[k + 1]?.event) : opening ? find(steps[0]?.event) : undefined;
      // 이 페이지가 이미 그 승리 뒤에만 도는 페이지면(보스 자신·승리 조건 페이지) 잠금 대상을 그대로 가리킨다.
      const pageSwitches = new Set((page.conditions ?? []).map((c) => String((c as { switchId?: string }).switchId ?? "")));
      const holderFor = (target: { map: GameMap; event: GameMap["events"][number] } | undefined) => {
        const gate = target ? holders.get(target.event.id) : undefined;
        return gate && gate.holder.event.id !== event.id && !pageSwitches.has(gate.switchId) ? gate.holder : undefined;
      };
      const next = holderFor(stepNext) ?? stepNext;
      const visit = (list: RawCommand[]): void => {
        for (const command of list) {
          for (const child of childLists(command)) { const raw = rawChild(command, child.key); if (raw) visit(raw); }
          if (!isObjectiveCommand(command)) continue;
          const fields = command.fields as Record<string, unknown>;
          const message = String(fields.message ?? "");
          const landing = landings.get(command);
          const from = landing?.mapId ?? map.id;
          const origin = landing ? { x: landing.x, y: landing.y } : pageOrigin;
          const tail = /\s*\(([^()]*?)\s*입구:[^()]*\)\s*$/u.exec(message);
          if (!tail) {
            // 같은 맵 꼬리 「(마왕과의 결전)」 또는 글에 잠긴 이벤트 이름이 나오면 그 잠금을 여는 전투로 돌린다.
            // 「(북서쪽)」 처럼 방위 한 낱말만 있는 꼬리는 꼬리가 없는 것으로 본다 — 다른 맵 입구까지 이어 주는 꼬리로 다시 쓴다
            // (2026-10-29 vm4 deepseek jrpg: 「…돌문에 동굴 열쇠를 쓰자 (북서쪽)」 — 돌문은 동굴 맵 안이고 마을 입구는 언덕 아래 길로만 닿았다).
            const tail0 = /\s*\(([^()]*)\)\s*$/u.exec(message);
            const plainTail = tail0 && !/^(?:북|남|동|서|북동|북서|남동|남서|가운데)쪽?$/u.test(tail0[1]!.trim()) ? tail0 : null;
            const base = tail0 ? message.slice(0, tail0.index).trimEnd() : message;
            const gated = [...holders.keys()].map((id) => find(id)).find((ref) => ref && bare(String(ref.event.name ?? "")).length >= 2
              && (plainTail ? bare(plainTail[1]!) === bare(String(ref.event.name)) : bare(base).includes(bare(String(ref.event.name)))));
            const holder = holderFor(gated);
            if (!gated || !holder) {
              // 꼬리 없는 목표가 글에 나온 이벤트·장소로 「어디」를 붙일 수 있으면 붙인다 — 출하 검사 objective-missing 과 같은 판정(withWhere).
              // 2026-10-29 vm1 argon jrpg: 보스에 「마왕」 이름이 붙은 뒤 「마왕과 최후의 결전을 벌여 승리한다」(동굴의 문 이벤트) 가
              // 「(시작 마을 입구: 남쪽 → 마왕의 방 · 마왕)」 을 붙일 수 있게 됐는데, 위 가지는 잠긴 이벤트 이름을 담은 글만 고쳐 출하 검사가 남았다.
              if (plainTail) continue;
              let updated = withWhere(project, from, base, undefined, origin);
              // 글에서 어디를 못 찾으면 다음 청사진 단계가 다른 맵에 있을 때 그 맵 입구로 — 이 목표를 거는 단계 다음이 곧 갈 곳이다.
              if (updated === base && next && next.map.id !== from) updated = withWhere(project, from, base, next.event.id, origin);
              if (updated === base && tail0) updated = message;
              if (updated !== message) { fields.message = updated; changed += 1; }
              continue;
            }
            const holderName = String(holder.event.name ?? "");
            // 글이 잠긴 이벤트 이름을 담으면(런타임은 글에 나온 더 긴 이름을 고른다) 전투를 부르는 글로 바꾼다.
            const text = bare(base).includes(bare(String(gated.event.name))) ? `${holderName}${josa(holderName, "을/를")} 쓰러뜨리자` : base;
            const updated = withWhere(project, from, text, holder.event.id, origin);
            if (updated !== message) { fields.message = updated; changed += 1; }
            continue;
          }
          const named = Object.values(project.maps).find((m) => bare(m.name ?? "") === bare(tail[1]!));
          if (!named) continue;
          const base = message.slice(0, tail.index).trimEnd();
          // 다음 단계 이벤트가 그 입구 맵(또는 그 맵을 거쳐 가는 곳)에 있으면 그 이벤트를, 아니면 입구 맵을 가리킨다.
          const route = next && next.map.id !== from ? mapRoute(project, from, next.map.id) : undefined;
          const where = next && (next.map.id === from || route?.includes(named.id)) ? next.event.id : named.id;
          const updated = withWhere(project, from, base, where, origin);
          // 옮긴 뒤 맵이 바로 그 입구 맵이면 「입구」 꼬리는 틀린 말이다 — 꼬리 없는 글(이름이 이미 글에 있으면)도 쓴다.
          if (updated !== message && (updated !== base || from === named.id)) { fields.message = updated; changed += 1; }
        }
      };
      visit((page.commands as RawCommand[] | undefined) ?? []);
    }
  }
  return changed;
}

/**
 * 목표 명령 뒤 같은 목록에 옮기기(transfer)가 오면 그 목표는 옮긴 뒤 맵에서 읽힌다 — 「어디」는 그 맵·도착 칸에서 본다.
 * 2026-10-29 vm1 argon jrpg: 동굴 「마왕의 문 열기」 가 목표를 건 뒤 마왕의 방으로 옮기는데, 동굴에서 본 「(마왕의 방 입구: 바로 옆)」 이 붙었다.
 */
export function objectiveLandings(project: Project): WeakMap<object, { mapId: string; x: number; y: number }> {
  const out = new WeakMap<object, { mapId: string; x: number; y: number }>();
  const walk = (list: readonly RawCommand[]): void => {
    list.forEach((command, i) => {
      for (const child of childLists(command)) walk(child.list);
      if (!isObjectiveCommand(command)) return;
      const t = list.slice(i + 1).find((c) => c.kind === "transfer" && typeof c.mapId === "string" && project.maps[c.mapId as string]);
      if (t) out.set(command, { mapId: String(t.mapId), x: Number(t.x ?? 0), y: Number(t.y ?? 0) });
    });
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) walk(Array.isArray(page.commands) ? page.commands as unknown as RawCommand[] : []);
  return out;
}

const isMilestoneWrite = (command: RawCommand): boolean =>
  command.kind === "setSwitch" ? command.value === true : command.kind === "changeItem" ? command.op !== "-=" : false;
/** childLists 가 돌려주는 목록은 사본이다 — 넣기는 원본 배열에 해야 하므로 키로 원본을 다시 찾는다(탐지와 같은 분기를 걷는다). */
function rawChild(command: RawCommand, key: string): RawCommand[] | undefined {
  const option = /^options\[(\d+)\]\.branch$/u.exec(key);
  const value = option ? (command.options as Record<string, unknown>[] | undefined)?.[Number(option[1])]?.branch : command[key];
  return Array.isArray(value) ? value as RawCommand[] : undefined;
}

/** 명령 목록 안에서 이정표 쓰기 바로 뒤(같은 목록)에 목표 명령을 넣는다. 이미 같은 글의 목표가 있으면 그 자리를 바꾼다. 넣은 수. */
function insertAfterMilestones(list: RawCommand[], message: string): number {
  let placed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const command = list[i]!;
    for (const child of childLists(command)) {
      const raw = rawChild(command, child.key);
      if (raw) placed += insertAfterMilestones(raw, message);
    }
  }
  let last = -1;
  list.forEach((command, i) => { if (isMilestoneWrite(command)) last = i; });
  if (last < 0) return placed;
  const next = list[last + 1];
  if (next && isObjectiveCommand(next)) { list[last + 1] = objectiveCommand(message); return placed + 1; }
  list.splice(last + 1, 0, objectiveCommand(message));
  return placed + 1;
}

/** 맵을 3×3 으로 나눈 방위(「북서쪽」 「가운데」 …). 플레이어 자리와 무관하게 늘 맞는 「어디」다. */
export function mapRegion(map: GameMap, x: number, y: number): string {
  const col = Math.min(2, Math.floor((x * 3) / Math.max(1, map.width)));
  const row = Math.min(2, Math.floor((y * 3) / Math.max(1, map.height)));
  const names = [["북서쪽", "북쪽", "북동쪽"], ["서쪽", "가운데", "동쪽"], ["남서쪽", "남쪽", "남동쪽"]] as const;
  return names[row]![col]!;
}

function transferTargets(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) { for (const item of value) transferTargets(item, out); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
  for (const child of Object.values(record)) if (child && typeof child === "object") transferTargets(child, out);
}

type Cell = { readonly x: number; readonly y: number };
const BEARINGS = ["동쪽", "남동쪽", "남쪽", "남서쪽", "서쪽", "북서쪽", "북쪽", "북동쪽"] as const;
/**
 * origin 에서 본 to 의 방위(8방). 2칸 안이면 「바로 옆」.
 * 왜(2026-10-29 vm2 terra jrpg): 맵을 3×3 으로 나눈 방위는 「서쪽」 띠에 선 문을 「서쪽」이라 불렀는데, 플레이어는 이미 맵 서쪽 끝(1,4)에 있었고
 * 문은 같은 줄 26칸 남쪽(1,30)이었다 — 판정자가 「목표의 서쪽은 이미 맵 끝」이라며 길을 못 찾았다. 목표가 걸리는 자리에서 본 방위를 쓴다.
 */
export function bearingWord(origin: Cell, to: Cell): string {
  const dx = to.x - origin.x, dy = to.y - origin.y;
  if (Math.abs(dx) + Math.abs(dy) <= 2) return "바로 옆";
  return BEARINGS[(((Math.round(Math.atan2(dy, dx) / (Math.PI / 4))) % 8) + 8) % 8]!;
}

/**
 * 출구 자리를 맵에 붙박인 말로 — 가장자리(두 칸 안)면 「서쪽 끝 가운데」「북쪽 끝 동쪽 편」「남서쪽 구석」, 아니면 맵 3×3 방위(「북쪽」).
 * 걸어 다니는 동안에도 같은 뜻이고(목표 줄은 한 번 걸리면 플레이어가 움직여도 그대로다), 사람이 맵 전체를 놓고 읽는 말이다.
 * 왜(2026-10-29 vm7 argon jrpg): 촌장 자리에서 본 8방 「남서쪽」은 마을 서쪽 끝 가운데 (0,21) 길 끝이었는데, 판정자는 맵의 남서쪽 구석 숲을
 * 30분 가까이 헤맸다. flash jrpg: 촌장에서 본 「동쪽」은 마을 북쪽 한가운데 (28,5)였고 판정자는 동쪽 끝을 찾다 막혔다.
 * vm2 terra(서쪽 끝에 선 플레이어에게 「서쪽」)는 가장자리 말 「서쪽 끝 남쪽 편」이 푼다.
 */
export function placeWord(map: GameMap, x: number, y: number): string {
  const w = Math.max(1, map.width), h = Math.max(1, map.height);
  const west = x <= 1, east = x >= w - 2, north = y <= 1, south = y >= h - 2;
  if ((west || east) && (north || south)) return `${north ? "북" : "남"}${west ? "서" : "동"}쪽 구석`;
  const third = (v: number, n: number) => Math.min(2, Math.floor((v * 3) / n));
  if (west || east) {
    const along = ["북쪽 편", "가운데", "남쪽 편"][third(y, h)]!;
    return `${west ? "서쪽" : "동쪽"} 끝 ${along}`;
  }
  if (north || south) {
    const along = ["서쪽 편", "가운데", "동쪽 편"][third(x, w)]!;
    return `${north ? "북쪽" : "남쪽"} 끝 ${along}`;
  }
  return mapRegion(map, x, y);
}

/** 출구 자리 말 — 2칸 안이면 「바로 옆」, 아니면 맵에 붙박인 말(placeWord). */
function exitWord(map: GameMap, origin: Cell | undefined, gate: Cell): string {
  if (origin && Math.abs(gate.x - origin.x) + Math.abs(gate.y - origin.y) <= 2) return "바로 옆";
  return placeWord(map, gate.x, gate.y);
}

/** from 맵에서 to 맵으로 바로 가는 문(옮기기 이벤트) 자리들. */
function gatesTo(from: GameMap, toMapId: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const event of from.events ?? []) {
    const targets = new Set<string>();
    transferTargets(event.pages ?? [], targets);
    if (targets.has(toMapId)) out.push({ x: event.x, y: event.y });
  }
  return out;
}

const bare = (text: string) => text.replace(/[\s「」『』"'·]/gu, "");

/** 글에 이름이 나온 다른 맵들(긴 이름 먼저, 겹치는 짧은 이름은 뺀다). */
function namedMaps(project: Project, text: string, except: string): GameMap[] {
  const plain = bare(text);
  const maps = Object.values(project.maps).filter((map) => map.id !== except && map.name && bare(map.name).length >= 2 && plain.includes(bare(map.name)));
  return maps.filter((map) => !maps.some((other) => other !== map && bare(other.name!).includes(bare(map.name!)) && bare(other.name!).length > bare(map.name!).length));
}

/**
 * 「어디」 한 줄 — 목표가 걸리는 맵(from)에서 본 자리. 같은 맵의 대상은 그 맵의 방위, 다른 맵은 거기로 가는 문의 방위.
 * 새 플레이어가 「지하철역」이 어디인지 몰라 2일차에 멈췄다(2026-10-27 romance-j91 J105).
 */
/**
 * 같은 줄에 다른 곳으로 가는 문이 나란히 있으면 그 가운데 몇째인지 — 「 · 문 셋 중 왼쪽」.
 * 왜(2026-10-29 vm3 deepseek 방탈출 판정): 현관 홀 남쪽 벽에 응접실·서재·지하실 문이 3칸 간격으로 붙어 있었는데 목표는 「응접실 입구: 남동쪽」뿐이라
 * 판정자가 응접실 문을 끝내 고르지 못했다.
 */
function siblingOrdinal(project: Project, from: GameMap, gate: { x: number; y: number }, hopId: string): string {
  const others: { x: number; y: number; to: string }[] = [];
  for (const map of Object.values(project.maps)) {
    if (map.id === from.id) continue;
    const cells = gatesTo(from, map.id);
    if (!cells.length) continue;
    const pick = [...cells].sort((a, b) => Math.abs(a.x - gate.x) + Math.abs(a.y - gate.y) - (Math.abs(b.x - gate.x) + Math.abs(b.y - gate.y)))[0]!;
    others.push({ ...pick, to: map.id });
  }
  const row = others.filter((o) => Math.abs(o.y - gate.y) <= 1 && Math.abs(o.x - gate.x) <= 8);
  const col = others.filter((o) => Math.abs(o.x - gate.x) <= 1 && Math.abs(o.y - gate.y) <= 8);
  const line = row.length >= col.length ? row : col;
  if (line.length < 2 || !line.some((o) => o.to === hopId)) return "";
  const horizontal = line === row;
  line.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const k = line.findIndex((o) => o.to === hopId);
  const n = line.length;
  const COUNT = ["", "", "둘", "셋", "넷", "다섯"];
  const [first, last] = horizontal ? ["왼쪽", "오른쪽"] : ["위쪽", "아래쪽"];
  const pos = k === 0 ? first : k === n - 1 ? last : n === 3 ? "가운데" : `${first}에서 ${k + 1}번째`;
  return ` · 문 ${COUNT[n] ?? n} 중 ${pos}`;
}

export function whereHint(project: Project, fromMapId: string, target: { mapId: string; x?: number; y?: number; label?: string }, origin?: Cell): string | undefined {
  const from = project.maps[fromMapId];
  const to = project.maps[target.mapId];
  if (!from || !to) return undefined;
  // 같은 맵: 이벤트 이름만(「책장」) — 자리는 조사 칸 반짝이·목표 화살표가 가리킨다. 「(책장: 잠긴 서재 가운데)」 처럼 지금 서 있는 맵 이름과
  // 방위까지 붙이면 개발 메모처럼 읽히고 목표 칩이 4~5줄로 접혔다(2026-10-29 VQA 트리아지 B, 12건). 이름이 없으면 방위 한 낱말.
  if (to.id === from.id) {
    if (target.x === undefined || target.y === undefined) return undefined;
    return target.label?.trim() || (origin ? bearingWord(origin, { x: target.x, y: target.y }) : mapRegion(from, target.x, target.y));
  }
  // 다른 맵: 지금 맵에서 «첫 출구»의 방위(지금 맵 이름은 빼고) — 새 플레이어가 「지하철역」 이 어디인지 몰라 멈춘 것(J105)은 이것으로 푼다.
  // 바로 가는 문이 없으면 맵 경로의 첫 맵으로 가는 문을 가리키고 목적지를 「→」 뒤에 적는다(2026-10-29 vm2 flash jrpg: 숲에서 동굴로 가는 문은
  // 없고 마을을 거쳐야 하는데 목표는 「마왕의 동굴」만 말해 숲 안에서 동굴 입구를 찾다 막혔다). 대상 이벤트 이름도 「→」 뒤에 붙여,
  // 그 맵에 들어선 뒤 런타임 목표 표시(src/player/objectiveTarget)가 그 이벤트를 짚게 한다.
  const route = mapRoute(project, from.id, to.id);
  const hop = route?.[1] ? project.maps[route[1]] : undefined;
  if (!hop) return undefined;
  const gates = gatesTo(from, hop.id);
  if (gates.length === 0) return undefined;
  const near = origin ? [...gates].sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)))[0]! : undefined;
  const dir0 = near ? exitWord(from, origin, near) : [...new Set(gates.map((gate) => placeWord(from, gate.x, gate.y)))].slice(0, 2).join("·");
  const dir = `${dir0}${siblingOrdinal(project, from, near ?? gates[0]!, hop.id)}`;
  const label = target.label?.trim();
  if (hop.id === to.id) return `${to.name ?? to.id} 입구: ${dir}${label ? ` → ${label}` : ""}`;
  // 거쳐 가는 맵 안에서 다음 문의 방위도 적는다 — 그 맵에 들어선 뒤에도 같은 꼬리가 보이므로, 앞 맵의 방위(「남쪽」)만 남으면 거기서도 남쪽으로 간다.
  // 왜(2026-10-29 vm3 flash 추리 BLOCKER): 객실 목표 「여관 로비 입구: 남쪽 → 여관 뒤뜰」을 로비에서도 따라 로비 남쪽 끝(8,13)에서 막혔다 — 뒤뜰 문은 로비 서쪽(1,7)이었다.
  const next = route?.[2] ? nextLeg(project, from, near ?? gates[0]!, hop, route[2]) : undefined;
  return `${hop.name ?? hop.id} 입구: ${dir} → ${next ? `${hop.name ?? hop.id}에서 ${next} → ` : ""}${to.name ?? to.id}${label ? ` · ${label}` : ""}`;
}

/** from 의 gate 로 hop 에 들어선 자리(옮기기 착지)에서 본, hop 에서 then 으로 가는 문의 방위(+ 나란한 문 가운데 몇째). */
function nextLeg(project: Project, from: GameMap, gate: Cell, hop: GameMap, then: string): string | undefined {
  const gates = gatesTo(hop, then);
  if (!gates.length) return undefined;
  const event = (from.events ?? []).find((e) => e.x === gate.x && e.y === gate.y);
  let landing: Cell | undefined;
  const find = (value: unknown): void => {
    if (landing || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(find); return; }
    const r = value as Record<string, unknown>;
    if (r.kind === "transfer" && r.mapId === hop.id && typeof r.x === "number" && typeof r.y === "number") { landing = { x: r.x, y: r.y }; return; }
    Object.values(r).forEach(find);
  };
  find(event?.pages ?? []);
  const near = landing ? [...gates].sort((a, b) => Math.abs(a.x - landing!.x) + Math.abs(a.y - landing!.y) - (Math.abs(b.x - landing!.x) + Math.abs(b.y - landing!.y)))[0]! : gates[0]!;
  const dir = exitWord(hop, landing, near);
  return `${dir}${siblingOrdinal(project, hop, near, then)}`;
}

/** 글에 이름이 나온 이벤트(두 글자 이상, 긴 이름 먼저, 목표 맵의 것 먼저). 출입구·자동 실행 목표 이벤트는 뺀다. */
function namedEvent(project: Project, text: string, fromMapId: string): { mapId: string; x: number; y: number; label: string } | undefined {
  const plain = bare(text);
  const found: { mapId: string; x: number; y: number; label: string; len: number; here: boolean }[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const name = String(event.name ?? "");
    if (bare(name).length < 2 || event.id.startsWith("ev_objective") || event.id.startsWith("ev_gate_")) continue;
    if (plain.includes(bare(name))) found.push({ mapId: map.id, x: event.x, y: event.y, label: name, len: bare(name).length, here: map.id === fromMapId });
  }
  found.sort((a, b) => Number(b.here) - Number(a.here) || b.len - a.len);
  const best = found[0];
  return best ? { mapId: best.mapId, x: best.x, y: best.y, label: best.label } : undefined;
}

/** 목표 글에 「어디」를 붙인다 — where(이벤트·맵 이름/id)를 주거나, 글에 다른 맵 이름이 나오면 그 맵으로 가는 문의 방위를 붙인다. */
export function withWhere(project: Project, fromMapId: string, text: string, where?: string, origin?: Cell): string {
  const hints: string[] = [];
  if (where) {
    for (const map of Object.values(project.maps)) {
      const event = (map.events ?? []).find((candidate) => candidate.id === where || candidate.name === where);
      if (event) {
        const hint = whereHint(project, fromMapId, { mapId: map.id, x: event.x, y: event.y, ...(event.name ? { label: event.name } : {}) }, origin);
        if (hint) hints.push(hint);
        break;
      }
      if (map.id === where || map.name === where) {
        const hint = whereHint(project, fromMapId, { mapId: map.id }, origin);
        if (hint) hints.push(hint);
        break;
      }
    }
  }
  // 글에 나온 두 장소 중 하나가 다른 하나로 가는 길 위에 있으면 길 위의 곳만 — 「1번길 풀숲에서 잡고 새순 마을로 가자」 에
  // 두 꼬리가 같은 첫 출구를 되풀이해 「(… → 새순 마을 / … → 1번길)」 여섯 줄 창이 됐다(2026-10-29 standin monster 연구소).
  const mentioned = namedMaps(project, text, fromMapId);
  const onTheWay = (map: GameMap) => mentioned.some((other) => other !== map && (mapRoute(project, fromMapId, map.id) ?? []).slice(1, -1).includes(other.id));
  const places = mentioned.length > 1 ? mentioned.filter((map) => !onTheWay(map)) : mentioned;
  if (hints.length === 0) for (const map of places.length ? places : mentioned) {
    const hint = whereHint(project, fromMapId, { mapId: map.id }, origin);
    if (hint) hints.push(hint);
    if (hints.length >= 2) break;
  }
  // 글에 이벤트 이름(「책장」)만 나오면 그 이벤트 자리 — 같은 맵이면 방위, 다른 맵이면 그 맵 입구(2026-10-28 mt3 argon escape:
  // 「책장 주변에서 두 번째 단서를 찾자」 에 어디가 안 붙어 판정자가 「조사할 위치를 잡는 데 헤맸다」).
  if (hints.length === 0) {
    const named = namedEvent(project, text, fromMapId);
    if (named) { const hint = whereHint(project, fromMapId, named, origin); if (hint) hints.push(hint); }
  }
  const extra = hints.filter((hint) => !text.includes(hint));
  return extra.length ? `${text} (${extra.join(" / ")})` : text;
}

export interface ObjectivePlan {
  readonly ok: boolean;
  readonly summary: string;
  /** upsert_event 로 쓸 이벤트들(맵별). */
  readonly events: { readonly mapId: string; readonly event: Record<string, unknown> }[];
}

/**
 * 시작 목표가 뒤 단계의 일을 이미 일어난 것처럼 말하나 — 「투숙객이 자백했다. 여관 주인에게 보고하자」(2026-10-29 vm3 argon 추리:
 * 모델이 마지막에 set_objective 를 시작 자리로 불러 첫 단계 「여관 주인과 대화」 대신 마지막 단계 문구가 처음부터 떴고, 주인은 「아직 범인을
 * 찾지 못했다」고 했다). 끝난 일 말투(…했다.)이면서 첫 단계에는 없는 뒤 단계 gives 낱말(자백)을 담으면 늦은 목표다.
 */
export function lateStartObjective(project: Project): { readonly message: string; readonly first: string } | undefined {
  const steps = project.gameBlueprint?.steps ?? [];
  if (steps.length < 2) return undefined;
  const map = project.maps[project.startMapId];
  let message = "";
  for (const event of map?.events ?? []) for (const page of event.pages ?? []) {
    if (message || !["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) || !runsOnce(event, page)) continue;
    const found = (page.commands as RawCommand[] ?? []).find((command) => isObjectiveCommand(command));
    message = found ? String(((found as { fields?: { message?: unknown } }).fields?.message) ?? "").trim() : "";
  }
  if (!message || !/[가-힣](?:했|었|았|였|혔|졌|냈)다[.!]/u.test(message)) return undefined;
  const stem = (w: string) => w.replace(/(?:에게서|에게|에서|으로|이|가|을|를|의|은|는|와|과|로|에|도)$/u, "");
  const words = (s: string) => s.split(/[\s:·,.「」『』()]+/u).map(stem).filter((w) => w.length >= 2);
  const first = steps[0]!;
  const firstText = `${first.event} ${first.action} ${first.gives ?? ""}`;
  const late = steps.slice(1).some((step) => !/^엔딩$|ending/iu.test(step.gives ?? "") && words(step.gives ?? "").some((w) => message.includes(w) && !firstText.includes(w)));
  if (!late) return undefined;
  return { message, first: first.action.trim().replace(/[.。!]+$/u, "").slice(0, 60) };
}

/** 시작 맵에서 맵에 들어올 때마다 다시 도는 자동·병렬 페이지(runsOnce 아님)에 걸린 「현재 목표」 — 그 글. 불러오기·다시 들어오기마다 목표를 처음으로 되돌린다. */
export function repeatingStartObjectives(project: Project): { readonly eventId: string; readonly message: string }[] {
  const map = project.maps[project.startMapId];
  const out: { eventId: string; message: string }[] = [];
  for (const event of map?.events ?? []) for (const page of event.pages ?? []) {
    if (!["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) || runsOnce(event, page)) continue;
    const found = (page.commands as RawCommand[] ?? []).find((command) => isObjectiveCommand(command));
    const message = found ? String(((found as { fields?: { message?: unknown } }).fields?.message) ?? "").trim() : "";
    if (message) out.push({ eventId: event.id, message });
  }
  return out;
}

/**
 * 자동·병렬 페이지가 한 번만 도나 — 자기 지우기, 또는 켜는 자기 스위치·스위치가 같은 이벤트의 다른 페이지 조건이거나 이 페이지의 «꺼져 있어야» 조건이다.
 * 아니면 맵에 들어올 때마다(불러오기 포함) 다시 돈다(장면 분위기 페이지).
 */
export function runsOnce(event: GameEvent, page: { readonly commands?: unknown; readonly conditions?: unknown }): boolean {
  const self = new Set<string>();
  const sw = new Set<string>();
  let erases = false;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const c = node as Record<string, unknown>;
    if (c.kind === "eraseEvent") erases = true;
    if (c.kind === "setSelfSwitch" && c.value !== false && typeof c.key === "string") self.add(c.key);
    if (c.kind === "setSwitch" && c.value === true && typeof c.switchId === "string") sw.add(c.switchId);
    for (const v of Object.values(c)) if (v && typeof v === "object") visit(v);
  };
  visit(page.commands);
  if (erases) return true;
  type Cond = { kind?: string; key?: string; switchId?: string; value?: unknown };
  const conds = (p: { conditions?: unknown }) => (Array.isArray(p.conditions) ? p.conditions : []) as Cond[];
  const hits = (c: Cond) => (c.kind === "selfSwitch" && typeof c.key === "string" && self.has(c.key)) || (c.kind === "switch" && typeof c.switchId === "string" && sw.has(c.switchId));
  if (conds(page).some((c) => c.value === false && hits(c))) return true;
  return (event.pages ?? []).some((other) => other !== page && conds(other).some((c) => c.value !== false && hits(c)));
}

/**
 * 「현재 목표」 줄을 건다. at:'start' = 시작 맵의 자동 실행(오프닝 뒤 첫 컷신) 끝에, 없으면 새 자동 실행 이벤트로.
 * eventId = 그 이벤트의 이정표(스위치 켜기·아이템 얻기) 바로 뒤에 — 이정표가 없으면 그 이벤트 첫 페이지 끝에.
 */
export function planObjective(project: Project, input: { readonly text: string; readonly at?: string; readonly eventId?: string; readonly mapId?: string; readonly where?: string }): ObjectivePlan {
  const raw = input.text.trim().slice(0, 80);
  let text = raw;
  if (!text) return { ok: false, summary: "text 에 지금 할 일 한 줄을 준다(예: 「창고 상자에서 태엽 열쇠를 찾자」)", events: [] };
  // where 만 준 다음 목표(2026-10-28 mt3 argon escape): set_objective{text:'책장 주변에서 두 번째 단서를 찾자', where:'책상'} ·
  // {text:'…문을 열고 탈출하자', where:'책장'} — 모델은 where 를 «이 이벤트 뒤에»로 썼는데 eventId 가 없어 둘 다 시작 목표를 덮었고,
  // 게임 시작부터 마지막 목표(「문을 열고 탈출하자 (책장…)」)가 떠 첫 단서(책상)로 가는 안내가 사라졌다.
  // 시작 목표가 이미 있고, where 가 이정표(스위치 켜기·아이템 얻기)를 가진 이벤트인데 글이 그 이벤트를 가리키지 않으면
  // (글이 where 이벤트 이름을 담으면 그게 대상이다) where 이벤트 뒤의 다음 목표로 건다. 「어디」는 글에 나온 이벤트 이름에서 붙는다.
  if (input.at !== "start" && !input.eventId && !input.mapId && input.where) {
    const start = project.maps[project.startMapId];
    const hasStart = (start?.events ?? []).some((event) => (event.pages ?? []).some((page) => ["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) && JSON.stringify(page.commands ?? []).includes(OBJECTIVE_SURFACE)));
    const trigger = Object.values(project.maps).flatMap((map) => (map.events ?? []).filter((event) => event.id === input.where || event.name === input.where))[0];
    const milestone = trigger && JSON.stringify(trigger.pages ?? []).match(/"kind":"(setSwitch|changeItem)"/u);
    const fromMap = trigger ? Object.values(project.maps).find((map) => (map.events ?? []).includes(trigger)) : undefined;
    const namesTrigger = Boolean(trigger?.name) && bare(raw).includes(bare(String(trigger!.name)));
    if (hasStart && trigger && milestone && fromMap && !namesTrigger) {
      return planObjective(project, { text: raw, eventId: trigger.id, mapId: fromMap.id });
    }
  }
  if (input.at === "start" || (!input.eventId && !input.mapId)) {
    const map = project.maps[project.startMapId];
    if (!map) return { ok: false, summary: "시작 맵이 없다", events: [] };
    const startOrigin = (project.startPos ?? undefined) as Cell | undefined;
    // 시작 목표의 「어디」는 청사진 첫 단계 이벤트다(where 를 따로 주지 않았으면) — 글에 나온 먼 장소(「마왕의 동굴」)가 아니라
    // 지금 할 첫 일. 2026-10-29 vm2 flash jrpg: 시작 목표가 「(마왕의 동굴 입구: 남쪽)」 를 달아 첫 단계 「마을 시작」(시작 자리 3칸 위)을
    // 건너뛰게 했고, 열쇠 없이 동굴에 들어가면 막힌다.
    const firstStep = project.gameBlueprint?.steps[0];
    const firstStepEvent = firstStep ? Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === firstStep.event || e.name === firstStep.event))[0] : undefined;
    text = withWhere(project, map.id, raw, input.where ?? firstStepEvent?.id, startOrigin);
    if (text === raw && !input.where && firstStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === firstStep.event || e.name === firstStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? firstStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target, startOrigin) : undefined;
      if (hint && !raw.includes(hint)) text = `${raw} (${hint})`;
    }
    // 시작 맵 자동 실행에 이미 목표가 있으면 그 자리를 바꾼다(조건 달린 오프닝 페이지여도) — 새 이벤트를 하나 더 두면 두 목표가 겨룬다.
    // 단 맵에 들어올 때마다 다시 도는 페이지(장면 분위기 — 자기 스위치 없는 자동 실행)는 목표 자리가 아니다: 불러오기·다시 들어오기마다
    // 시작 목표로 되돌렸다(2026-10-29 vm2 deepseek 방탈출: 열쇠를 얻고 저장→불러오기 하자 「일지를 읽자」로 돌아감). 거기 있던 목표는 빼고 아래에서 다시 건다.
    const autoObjective = (page: { trigger?: unknown; commands?: unknown }) => ["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) && JSON.stringify(page.commands ?? []).includes(OBJECTIVE_SURFACE);
    const stripped: { mapId: string; event: Record<string, unknown> }[] = [];
    for (const event of map.events ?? []) {
      if (!(event.pages ?? []).some((page) => autoObjective(page) && !runsOnce(event, page))) continue;
      const copy = structuredClone(event) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      const strip = (list: RawCommand[]): RawCommand[] => list.filter((command) => !isObjectiveCommand(command)).map((command) => {
        for (const child of childLists(command)) { const rawList = rawChild(command, child.key); if (rawList) rawList.splice(0, rawList.length, ...strip(rawList)); }
        return command;
      });
      copy.pages.forEach((page, index) => { if (autoObjective(page) && !runsOnce(event, (event.pages ?? [])[index]!)) page.commands = strip((page.commands as RawCommand[]) ?? []); });
      stripped.push({ mapId: map.id, event: copy });
    }
    const owner = (map.events ?? []).find((event) => (event.pages ?? []).some((page) => autoObjective(page) && runsOnce(event, page)));
    if (owner) {
      const event = structuredClone(owner) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      let replaced = 0;
      const swap = (list: RawCommand[]): void => {
        list.forEach((command, index) => {
          if (isObjectiveCommand(command)) { list[index] = objectiveCommand(text); replaced += 1; return; }
          for (const child of childLists(command)) { const rawList = rawChild(command, child.key); if (rawList) swap(rawList); }
        });
      };
      for (const page of event.pages) if (["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind))) swap((page.commands as RawCommand[]) ?? []);
      if (replaced > 0) return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${owner.name ?? owner.id} 에 있던 시작 목표를 바꿨다`, events: [...stripped.filter((s) => s.event.id !== owner.id), { mapId: map.id, event }] };
    }
    const hostPage = (event: GameEvent) => (event.pages ?? []).findIndex((page) => (page.trigger as { kind?: string }).kind === "auto" && (page.conditions ?? []).length === 0 && runsOnce(event, page));
    const host = (map.events ?? []).find((event) => hostPage(event) >= 0);
    if (host) {
      const event = (stripped.find((s) => s.event.id === host.id)?.event ?? structuredClone(host)) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      const page = event.pages[hostPage(host)]!;
      const commands = (page.commands as RawCommand[]) ?? [];
      const existing = commands.findIndex((c) => isObjectiveCommand(c));
      if (existing >= 0) commands[existing] = objectiveCommand(text);
      else {
        // 끝에서 자기 지우기·자기 스위치 앞에 넣는다(그 뒤 명령이 안 돌 수 있다).
        let at = commands.length;
        while (at > 0 && ["eraseEvent", "setSelfSwitch"].includes(String(commands[at - 1]?.kind))) at -= 1;
        commands.splice(at, 0, objectiveCommand(text));
      }
      page.commands = commands;
      return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${host.name ?? host.id} 시작 컷신 끝에 걸었다${stripped.length ? `(맵에 들어올 때마다 도는 ${stripped.map((s) => String(s.event.name ?? s.event.id)).join("·")} 에서 목표를 뺌)` : ""}`, events: [...stripped.filter((s) => s.event.id !== host.id), { mapId: map.id, event }] };
    }
    const taken = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
    // 걷는 칸에 둔다(upsert_event 가 막힌 칸을 거절한다 — mt3 argon 방에서 (0,0) 벽에 놓으려다 시작 목표가 통째로 빠졌다). 시작점에서 가까운 칸 먼저.
    let cell = { x: 0, y: 0 };
    let best = Infinity;
    const sp = (project.startPos ?? { x: 0, y: 0 }) as { x: number; y: number };
    for (let i = 0; i < map.width * map.height; i += 1) {
      const c = { x: i % map.width, y: Math.floor(i / map.width) };
      if (taken.has(`${c.x},${c.y}`) || !isPassable(project, map, c.x, c.y)) continue;
      const d = Math.abs(c.x - sp.x) + Math.abs(c.y - sp.y);
      if (d < best) { best = d; cell = c; }
    }
    const event = {
      id: "ev_objective_start", name: "시작 목표", x: cell.x, y: cell.y,
      pages: [
        { id: "ev_objective_start_p0", name: "목표 걸기", trigger: { kind: "auto" }, priority: "below", graphic: { transparent: true }, conditions: [], commands: [objectiveCommand(text), { kind: "setSelfSwitch", key: "A", value: true }], movement: { type: "fixed", speed: 3, frequency: 3 } },
        { id: "ev_objective_start_p1", name: "끝", trigger: { kind: "action" }, priority: "below", graphic: { transparent: true }, conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [], movement: { type: "fixed", speed: 3, frequency: 3 } },
      ],
      // upsert_event 를 거치지 않고 바로 맵에 넣는 쪽(출하 기본값)도 저장 모양이 맞게 — 이벤트 수준 trigger·commands 가 없으면 불러오기 검사가 거절했다.
      trigger: { kind: "action" }, commands: [],
    };
    return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 에 시작 목표 이벤트를 새로 놓았다(${cell.x},${cell.y})${stripped.length ? `(맵에 들어올 때마다 도는 ${stripped.map((s) => String(s.event.name ?? s.event.id)).join("·")} 에서 목표를 뺌)` : ""}`, events: [...stripped, { mapId: map.id, event }] };
  }
  const maps = input.mapId ? [project.maps[input.mapId]].filter(Boolean) as GameMap[] : Object.values(project.maps);
  for (const map of maps) {
    const found = (map.events ?? []).find((event) => event.id === input.eventId || event.name === input.eventId);
    if (!found) continue;
    const eventOrigin = { x: found.x, y: found.y };
    text = withWhere(project, map.id, raw, input.where, eventOrigin);
    // 「어디」가 안 붙었고 이 이벤트가 청사진 단계면 다음 단계 이벤트 자리를 붙인다(「…문을 열고 탈출하자」 → 「(잠긴 문)」).
    const steps = project.gameBlueprint?.steps ?? [];
    const k = steps.findIndex((step) => step.event === found.id || step.event === found.name);
    const nextStep = k >= 0 ? steps[k + 1] : undefined;
    if (text === raw && !input.where && nextStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === nextStep.event || e.name === nextStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? nextStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target, eventOrigin) : undefined;
      if (hint && !raw.includes(hint)) text = `${raw} (${hint})`;
    }
    const event = structuredClone(found) as unknown as Record<string, unknown> & { pages?: Record<string, unknown>[]; commands?: RawCommand[] };
    let placed = 0;
    const lists: RawCommand[][] = event.pages?.length ? event.pages.map((page) => (page.commands as RawCommand[]) ?? []) : [event.commands ?? []];
    for (const list of lists) placed += insertAfterMilestones(list, text);
    if (!placed) {
      const first = lists[0];
      if (!first) return { ok: false, summary: `${found.name ?? found.id} 에 명령 목록이 없다`, events: [] };
      first.push(objectiveCommand(text));
      placed = 1;
    }
    return { ok: true, summary: `다음 목표 「${text}」 — ${found.name ?? found.id}(${map.name ?? map.id}) 의 이정표 ${placed}곳 뒤에 걸었다`, events: [{ mapId: map.id, event }] };
  }
  return { ok: false, summary: `이벤트 ${input.eventId} 를 찾지 못했다`, events: [] };
}

export interface OffArtEntrance {
  readonly mapId: string;
  readonly mapName: string;
  readonly eventId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly door: { readonly x: number; readonly y: number };
  readonly touch: boolean;
}

/**
 * 그려진 입구 옆 맨바닥에 선 출입구·이야기 이벤트 — 새 플레이어는 그림(계단·스크린도어·문짝)을 누르는데 이벤트는 옆 칸이다.
 * romance-j91: 지하철 계단 그림 두 칸 위 보도에 역 문(J103), 열차 스크린도어 아래 칸에 하루 끝 열차 이벤트(J104).
 * 문 그림 칸에 아무 이벤트도 없을 때만 짚는다(이미 다른 이벤트가 그 문을 맡았으면 그 문이 따로 산다).
 */
/** 문 그림 덩어리(4방 이웃)에 이미 이벤트가 서 있나 — 넓은 계단 한 칸에 문이 있으면 그 덩어리는 주인이 있다. */
function doorClusterTaken(project: Project, map: GameMap, x: number, y: number, taken: ReadonlySet<string>): boolean {
  const seen = new Set<string>([`${x},${y}`]);
  const queue = [{ x, y }];
  for (let i = 0; i < queue.length && queue.length <= 49; i += 1) {
    const cell = queue[i]!;
    if (taken.has(`${cell.x},${cell.y}`)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || !isDoorArtCell(project, map, next.x, next.y)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** 이벤트를 문 그림 칸 (x,y) 로 옮겨도 걸어 가 설 칸이 남나(지금 닿지 않는 이벤트는 따지지 않는다). */
function doorStandable(project: Project, map: GameMap, event: GameEvent, x: number, y: number): boolean {
  if (unreachableEvents(project, map.id, [event.id]).length) return true;
  const moved = { ...map, events: (map.events ?? []).map((e) => e.id === event.id ? { ...e, x, y } : e) } as GameMap;
  return unreachableEvents({ ...project, maps: { ...project.maps, [map.id]: moved } } as Project, map.id, [event.id]).length === 0;
}

export function offArtEntrances(project: Project): OffArtEntrance[] {
  const story = new Set(storyEvents(project).map((event) => `${event.mapId}|${event.eventId}`));
  const out: OffArtEntrance[] = [];
  for (const map of Object.values(project.maps)) {
    const taken = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
    for (const event of map.events ?? []) {
      const pages = event.pages ?? [];
      const page = pages[0];
      if (!page) continue;
      const kind = (page.trigger as { kind?: string } | undefined)?.kind;
      if (!["action", "touch", "playerTouch"].includes(String(kind))) continue;
      const graphic = page.graphic as Record<string, unknown> | undefined;
      const transparent = !graphic || graphic.transparent === true || (!graphic.sprite && !graphic.appearanceId && graphic.tileId === undefined);
      if (!transparent) continue;
      const transfers = new Set<string>();
      transferTargets(pages, transfers);
      if (transfers.size === 0 && !story.has(`${map.id}|${event.id}`)) continue;
      if (isDoorArtCell(project, map, event.x, event.y)) continue;
      let door: { x: number; y: number } | undefined;
      // 바로 옆(대각 포함) 또는 한 칸 바닥 건너 두 칸(열차 스크린도어 앞 승강장 칸에 선 하루 끝 이벤트, J104).
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]] as const) {
        const x = event.x + dx, y = event.y + dy;
        if (!isDoorArtCell(project, map, x, y) || taken.has(`${x},${y}`)) continue;
        if (doorClusterTaken(project, map, x, y, taken)) continue;
        if ((Math.abs(dx) === 2 || Math.abs(dy) === 2) && (!isPassable(project, map, event.x + dx / 2, event.y + dy / 2) || isDoorArtCell(project, map, event.x + dx / 2, event.y + dy / 2))) continue;
        // 그림 칸으로 옮기면 앞에 설 칸이 없는 문(벽 속 석문 그림 — 아래 줄도 벽)은 이 이벤트의 입구가 아니다(vm2 deepseek jrpg 「마왕과의 결전」).
        if (!doorStandable(project, map, event, x, y)) continue;
        // 칸막이·건물 벽에 붙은 같은 문 덩어리에 이미 다른 이벤트가 있으면 이 이벤트의 문이 아니다.
        door = { x, y };
        break;
      }
      if (!door) continue;
      out.push({ mapId: map.id, mapName: map.name ?? map.id, eventId: event.id, name: event.name ?? event.id, x: event.x, y: event.y, door, touch: kind !== "action" });
    }
  }
  return out;
}

/** 문 그림 칸이 막힌 칸이면 그 칸 이벤트는 부딪힘(priority same)·조사로 열린다 — 밟기(below)로 두면 영영 못 연다. */
export function doorCellBlocked(project: Project, mapId: string, x: number, y: number): boolean {
  const map = project.maps[mapId];
  return !!map && !isPassable(project, map, x, y);
}

/** 하루 세는 변수 — 어떤 이벤트가 += 로 올리고, 두 곳 넘게 페이지 조건(>=)으로 읽는 변수. */
function dayVariables(project: Project): Set<string> {
  const raised = new Set<string>();
  const thresholds = new Map<string, Set<number>>();
  for (const page of allPages(project)) {
    visitPageCommands(page, ({ command }) => {
      if (command.kind === "setVariable" && command.op === "+=" && typeof command.variableId === "string") raised.add(command.variableId);
    });
    for (const condition of page.conditions) for (const leaf of conditionLeaves(condition)) {
      if (leaf.kind === "variable" && typeof leaf.variableId === "string" && (leaf.op === ">=" || leaf.op === ">") && typeof leaf.value === "number") {
        let set = thresholds.get(leaf.variableId);
        if (!set) thresholds.set(leaf.variableId, set = new Set());
        set.add(leaf.op === ">" ? leaf.value + 1 : leaf.value);
      }
    }
  }
  // 이름이 날짜를 말하는 변수만 — 호감·진행도·처치 수도 += 로 오르고 >= 로 읽힌다(검토 지적).
  const names = new Map<string, string>();
  const vars = (project as unknown as { variables?: unknown }).variables;
  if (Array.isArray(vars)) for (const v of vars as { id?: string; name?: string }[]) { if (v?.id) names.set(v.id, v.name ?? ""); }
  else if (vars && typeof vars === "object") for (const [id, v] of Object.entries(vars as Record<string, unknown>)) names.set(id, typeof v === "string" ? v : String((v as { name?: string })?.name ?? ""));
  return new Set([...thresholds].filter(([id, values]) => raised.has(id) && values.size >= 2 && /일|날|day/iu.test(names.get(id) ?? "")).map(([id]) => id));
}

/** 하루 변수와 비교하는 가장 큰 날(마지막 날 판정 fork 의 >= 7 등). */
function maxDay(project: Project, dayVar: string): number | undefined {
  let best: number | undefined;
  const text = JSON.stringify(Object.values(project.maps).map((map) => map.events));
  const re = new RegExp(`"variableId":"${dayVar.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}","op":"(>=|==|>)","value":(\\d+)`, "gu");
  for (const m of text.matchAll(re)) { const value = Number(m[2]) + (m[1] === ">" ? 1 : 0); if (best === undefined || value > best) best = value; }
  return best;
}

export interface RepeatedDayPage { readonly mapName: string; readonly eventId: string; readonly name: string; readonly pageName: string; readonly from: number; readonly to: number; readonly line: string }

/**
 * 하루 반복 게임에서 날짜 구간 페이지가 여러 날을 덮는데 그 안에서 날을 가르지 않는 인물 대사 — 이튿날 첫날 대사를 그대로 다시 한다.
 * romance-j91 J106: 지훈 「1~2일」 페이지가 2일째에도 「신입이지?」.
 */
export function repeatedDayDialogue(project: Project): RepeatedDayPage[] {
  const days = dayVariables(project);
  if (days.size === 0) return [];
  const out: RepeatedDayPage[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const pages = event.pages ?? [];
    for (const dayVar of days) {
      const keyed = pages.map((page, index) => {
        const leaves = (page.conditions ?? []).flatMap((condition) => conditionLeaves(condition as never));
        const day = leaves.find((leaf) => leaf.kind === "variable" && leaf.variableId === dayVar && (leaf.op === ">=" || leaf.op === ">"));
        const other = leaves.some((leaf) => !(leaf.kind === "variable" && leaf.variableId === dayVar));
        return { page, index, explicit: !!day, start: day ? (day.op === ">" ? Number(day.value) + 1 : Number(day.value)) : (other ? undefined : 1) };
      }).filter((entry): entry is { page: typeof pages[number]; index: number; explicit: boolean; start: number } => entry.start !== undefined);
      // 조건 없는 첫 페이지를 1일째로 보는 것은 날짜 페이지가 둘 이상인 인물만(가게 주인의 평소 인사는 빼고).
      if (keyed.filter((entry) => entry.explicit).length < 2) continue;
      const starts = [...new Set(keyed.map((entry) => entry.start))].sort((a, b) => a - b);
      const lastDay = maxDay(project, dayVar);
      for (const entry of keyed) {
        const next = starts.find((start) => start > entry.start) ?? (lastDay !== undefined && lastDay >= entry.start ? lastDay + 1 : undefined);
        if (next === undefined || next - entry.start < 2) continue;
        const commands = JSON.stringify(entry.page.commands ?? []);
        if (!commands.includes('"kind":"text"')) continue;
        // 그 안에서 날(또는 오늘 만남 스위치)로 가르면 반복이 아니다.
        if (commands.includes(`"variableId":"${dayVar}"`) || /"kind":"setSelfSwitch"/u.test(commands)) continue;
        const line = (entry.page.commands ?? []).find((command) => (command as { kind?: string }).kind === "text") as { body?: string } | undefined;
        out.push({ mapName: map.name ?? map.id, eventId: event.id, name: event.name ?? event.id, pageName: (entry.page as { name?: string }).name ?? `페이지 ${entry.index}`, from: entry.start, to: next - 1, line: String(line?.body ?? "").slice(0, 30) });
      }
    }
  }
  return out;
}

export interface HeavyTint { readonly mapName: string; readonly eventId: string; readonly name: string; readonly value: string; readonly alpha: number }

/**
 * 장면이 끝난 뒤에도 남는 짙은 화면 색 — 필드 전체가 대화 배경이 걸린 것처럼 어둡다(2026-10-27 toy-j91 J98: 「밤」 색 20,30,80,0.5).
 * 페이지 명령을 차례로 따라가 마지막 화면 색이 알파 0.4 이상이면 짚는다(회상 세피아처럼 끝에 지우는 색은 빠진다).
 * 밤 분위기는 맵 조명(set_map_properties defaultLighting ambient + 등불)이 화면을 덮지 않고 낸다.
 */
export function lingeringHeavyTints(project: Project): HeavyTint[] {
  const out: HeavyTint[] = [];
  for (const page of allPages(project)) {
    let last: { value: string; alpha: number } | undefined;
    visitPageCommands(page, ({ command }) => {
      const tintM2 = command.kind === "m2Command" && String(command.commandId).startsWith("m2-046");
      if (!tintM2 && command.kind !== "tint") return;
      const fields = (command.fields ?? {}) as Record<string, unknown>;
      const value = String(tintM2 ? (fields.value || fields.color || "") : (command.tone ?? command.color ?? "")).trim();
      if (!value || value === "neutral" || value === "none" || value === "clear") { last = undefined; return; }
      const parts = value.split(",").map((part) => Number(part.trim()));
      const alpha = parts.length >= 4 && parts.every(Number.isFinite) ? parts[3]! : parts.length >= 3 && parts.every(Number.isFinite) ? 0.45 : 0;
      last = { value, alpha };
    });
    if (!last || last.alpha < 0.4) continue;
    out.push({ mapName: page.map?.name ?? "공통 이벤트", eventId: page.event?.id ?? String(page.commonEventId ?? ""), name: page.event?.name ?? page.event?.id ?? String(page.commonEventId ?? ""), value: last.value, alpha: last.alpha });
  }
  return out;
}
