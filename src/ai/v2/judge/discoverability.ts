// ai/v2/judge/discoverability.ts
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
import { OBJECTIVE_HUD_HIDDEN_MESSAGE, OBJECTIVE_MISSING_MESSAGE, OBJECTIVE_NOT_AT_START_MESSAGE } from "@/ai/agentRules";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { allPages, conditionLeaves, visitPageCommands, type PageRef, type RawCommand } from "@/qa/gameCheck/walk";
import { objectClusterAt } from "@/project/objectFootprint";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import { computeReachableCells } from "@/project/lint/reachability";
import { unreachableEvents } from "./eventReach";
import { isObjectiveCommand } from "./objectiveCommand";
import { transferTargets, Cell, bare, withWhere } from "./objectiveWhere";
import { objectiveLandings } from "./objectiveRoutes";

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

interface StoryEvent {
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

/**
 * 등록된 곁 퀘스트(create_quest)의 것 — 그 퀘스트의 스위치·변수(sw_<key>_… · var_<key>_…)와 그 퀘스트의 이벤트(의뢰인 · ev_<key>_…).
 * 퀘스트 밖 이벤트가 그 스위치를 읽으면(본편이 그 퀘스트에 걸려 있으면) 곁 퀘스트가 아니라 본편이다 — sideKey 가 그것을 가른다.
 */
function sideQuests(project: Project): { sideKey(key: Key, read: ReadonlyMap<Key, ReadonlySet<string>>): boolean } {
  type Quest = { readonly key?: string; readonly giver?: { readonly eventId?: string }; readonly steps?: readonly { readonly eventId?: string; readonly target?: { readonly eventId?: string } }[] };
  const quests = ((project as { quests?: readonly Quest[] }).quests ?? []).filter((q) => typeof q.key === "string" && q.key);
  const questOf = (key: Key) => quests.find((q) => key.startsWith(`sw:sw_${q.key}_`) || key.startsWith(`var:var_${q.key}_`));
  return {
    sideKey(key, read) {
      const quest = questOf(key);
      if (!quest) return false;
      // 그 퀘스트의 이벤트: 의뢰인 · 도착 칸(ev_<key>_…) · 말 걸기 단계가 얹힌 사람(steps[].target).
      const own = (eventId: string) => eventId === quest.giver?.eventId || eventId.startsWith(`ev_${quest.key}_`) || (quest.steps ?? []).some((st) => st.eventId === eventId || st.target?.eventId === eventId);
      return [...(read.get(key) ?? [])].every(own);
    },
  };
}

/** 주인공이 여는 이야기 이벤트 페이지들. 곁 퀘스트의 진행(수락 · 도착 · 완료)은 본편 이정표가 아니다 — 「현재 목표」 줄은 본편의 것이다. */
function storyEvents(project: Project): StoryEvent[] {
  const read = readers(project);
  const side = sideQuests(project);
  const out: StoryEvent[] = [];
  for (const page of allPages(project)) {
    if (!page.map || !page.event || !playerDriven(page)) continue;
    let ends = false, milestone = false, story = false, setsObjective = false;
    visitPageCommands(page, ({ command }) => {
      if (command.kind === "triggerEnding") ends = true;
      if (isObjectiveCommand(command)) setsObjective = true;
      for (const write of writesOf(command)) {
        const owners = read.get(write.key);
        if (!owners || side.sideKey(write.key, read)) continue;
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

/**
 * 곁 퀘스트 진행만 쓰는 페이지에 걸린 「현재 목표」 명령들 — 본편 목표 줄을 덮어쓴다(수락하면 「나지라」를 찾아가자, 도착 칸을 밟으면 「하산」을 찾아가자).
 * 본편 이정표(다른 이벤트·엔딩이 읽는 스위치·아이템)를 함께 쓰는 페이지는 빼고, 명령이 든 목록과 자리를 돌려준다(떼는 쪽이 쓴다).
 */
export function sideQuestObjectives(project: Project): { readonly mapId: string; readonly eventId: string; readonly message: string; readonly list: RawCommand[]; readonly command: RawCommand }[] {
  const read = readers(project);
  const side = sideQuests(project);
  const out: { mapId: string; eventId: string; message: string; list: RawCommand[]; command: RawCommand }[] = [];
  for (const page of allPages(project)) {
    if (!page.map || !page.event) continue;
    let sideWrites = 0, mainWrites = 0;
    visitPageCommands(page, ({ command }) => {
      for (const write of writesOf(command)) {
        if (side.sideKey(write.key, read)) sideWrites += 1;
        else if (write.milestone && [...(read.get(write.key) ?? [])].some((owner) => owner !== page.event!.id)) mainWrites += 1;
      }
    });
    if (!sideWrites || mainWrites) continue;
    const walk = (list: RawCommand[]): void => {
      for (const command of list) {
        if (isObjectiveCommand(command)) out.push({ mapId: page.map!.id, eventId: page.event!.id, message: String((command.fields as Record<string, unknown>).message), list, command });
        for (const value of Object.values(command)) {
          if (!Array.isArray(value)) continue;
          if (value.every((v) => v && typeof v === "object" && typeof (v as RawCommand).kind === "string")) walk(value as RawCommand[]);
          else for (const option of value) { const branch = (option as { branch?: unknown } | null)?.branch; if (Array.isArray(branch)) walk(branch as RawCommand[]); }
        }
      }
    };
    walk((page.page?.commands ?? page.commands) as unknown as RawCommand[]);
  }
  return out;
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
  if (!any) return [OBJECTIVE_MISSING_MESSAGE];
  if (hud && hud.objective === false) gaps.push(OBJECTIVE_HUD_HIDDEN_MESSAGE);
  let atStart = false;
  for (const page of startPages(project)) visitPageCommands(page, ({ command }) => { if (isObjectiveCommand(command)) atStart = true; });
  if (!atStart) gaps.push(OBJECTIVE_NOT_AT_START_MESSAGE);
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
  const side = sideQuests(project);
  const where = new Map<string, { mapId: string; name: string }>();
  // 이름 없는 이벤트는 이름을 비운다 — id(mx_map_grove_house_resident)를 목표 글에 그대로 실으면 안 된다.
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) where.set(event.id, { mapId: map.id, name: String(event.name ?? "") });
  const stale = storyEvents(project).filter((event) => event.milestone && !event.ends && !event.setsObjective);
  return stale.map((event) => {
    const keys = new Set<Key>();
    for (const page of allPages(project)) if (page.event?.id === event.eventId && page.pageIndex === event.pageIndex) visitPageCommands(page, ({ command }) => { for (const w of writesOf(command)) if (w.milestone && !side.sideKey(w.key, read)) keys.add(w.key); });
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

interface OffArtEntrance {
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

interface RepeatedDayPage { readonly mapName: string; readonly eventId: string; readonly name: string; readonly pageName: string; readonly from: number; readonly to: number; readonly line: string }

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

interface HeavyTint { readonly mapName: string; readonly eventId: string; readonly name: string; readonly value: string; readonly alpha: number }

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
