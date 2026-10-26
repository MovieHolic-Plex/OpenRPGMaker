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
import { allPages, childLists, conditionLeaves, visitPageCommands, type PageRef, type RawCommand } from "@/qa/gameCheck/walk";
import { objectClusterAt } from "@/project/objectFootprint";
import type { GameMap, Project } from "@/project/types";

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
    if (leaf.kind === "item" && typeof leaf.itemId === "string") return [`item:${leaf.itemId}`];
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
      visible: pageVisible(project, page, page.map, page.event.x, page.event.y),
    });
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
  if (!any) return ["게임 어디에도 「현재 목표」 줄이 없다 — 새 플레이어가 무엇을 해야 하는지 화면에서 읽을 수 없다. set_objective{text, at:'start'} 로 시작 목표를 걸고, 이정표 이벤트마다 set_objective{text, eventId} 로 다음 목표를 건다."];
  if (hud && hud.objective === false) gaps.push("필드 HUD 가 「현재 목표」 줄을 숨긴다(fieldHud.objective:false) — set_objective 를 한 번 부르면 켜진다.");
  let atStart = false;
  for (const page of startPages(project)) visitPageCommands(page, ({ command }) => { if (isObjectiveCommand(command)) atStart = true; });
  if (!atStart) gaps.push("게임을 시작했을 때 「현재 목표」 줄이 비어 있다 — 시작 맵의 자동 실행(오프닝 뒤 첫 컷신)에서 목표를 건다: set_objective{text, at:'start'}.");
  const stale = storyEvents(project).filter((event) => event.milestone && !event.ends && !event.setsObjective);
  for (const event of stale.slice(0, 4)) {
    gaps.push(`「${event.mapName}」 ${event.name}(${event.eventId}, ${event.x},${event.y}) 이 이야기를 한 단계 넘기는데 다음 목표를 바꾸지 않는다 — 앞 목표가 그대로 남아 새 플레이어가 길을 잃는다. set_objective{text: 다음에 할 일, eventId:'${event.eventId}'}.`);
  }
  return gaps;
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

export interface ObjectivePlan {
  readonly ok: boolean;
  readonly summary: string;
  /** upsert_event 로 쓸 이벤트들(맵별). */
  readonly events: { readonly mapId: string; readonly event: Record<string, unknown> }[];
}

/**
 * 「현재 목표」 줄을 건다. at:'start' = 시작 맵의 자동 실행(오프닝 뒤 첫 컷신) 끝에, 없으면 새 자동 실행 이벤트로.
 * eventId = 그 이벤트의 이정표(스위치 켜기·아이템 얻기) 바로 뒤에 — 이정표가 없으면 그 이벤트 첫 페이지 끝에.
 */
export function planObjective(project: Project, input: { readonly text: string; readonly at?: string; readonly eventId?: string; readonly mapId?: string }): ObjectivePlan {
  const text = input.text.trim().slice(0, 80);
  if (!text) return { ok: false, summary: "text 에 지금 할 일 한 줄을 준다(예: 「창고 상자에서 태엽 열쇠를 찾자」)", events: [] };
  if (input.at === "start" || (!input.eventId && !input.mapId)) {
    const map = project.maps[project.startMapId];
    if (!map) return { ok: false, summary: "시작 맵이 없다", events: [] };
    const host = (map.events ?? []).find((event) => (event.pages ?? []).some((page) => (page.trigger as { kind?: string }).kind === "auto" && (page.conditions ?? []).length === 0));
    if (host) {
      const event = structuredClone(host) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      const page = event.pages.find((p) => (p.trigger as { kind?: string }).kind === "auto" && ((p.conditions as unknown[]) ?? []).length === 0)!;
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
      return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${host.name ?? host.id} 시작 컷신 끝에 걸었다`, events: [{ mapId: map.id, event }] };
    }
    const taken = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
    let cell = { x: 0, y: 0 };
    for (let i = 0; i < map.width * map.height; i += 1) { const c = { x: i % map.width, y: Math.floor(i / map.width) }; if (!taken.has(`${c.x},${c.y}`)) { cell = c; break; } }
    const event = {
      id: "ev_objective_start", name: "시작 목표", x: cell.x, y: cell.y,
      pages: [
        { id: "ev_objective_start_p0", name: "목표 걸기", trigger: { kind: "auto" }, priority: "below", graphic: { transparent: true }, conditions: [], commands: [objectiveCommand(text), { kind: "setSelfSwitch", key: "A", value: true }] },
        { id: "ev_objective_start_p1", name: "끝", trigger: { kind: "action" }, priority: "below", graphic: { transparent: true }, conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [] },
      ],
    };
    return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 에 시작 목표 이벤트를 새로 놓았다(${cell.x},${cell.y})`, events: [{ mapId: map.id, event }] };
  }
  const maps = input.mapId ? [project.maps[input.mapId]].filter(Boolean) as GameMap[] : Object.values(project.maps);
  for (const map of maps) {
    const found = (map.events ?? []).find((event) => event.id === input.eventId || event.name === input.eventId);
    if (!found) continue;
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
