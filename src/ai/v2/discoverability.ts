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
import { isDoorArtCell } from "@/project/staging/doorCells";
import { isPassable } from "@/project/collision";
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
  // 「어디」 — 다른 장소 이름만 대고 그 입구가 어디인지 말하지 않는 목표(J105: 「지하철역의 지훈」 만 보고 역 입구를 못 찾았다).
  let vague = 0;
  for (const page of allPages(project)) {
    const fromMapId = page.map?.id ?? project.startMapId;
    visitPageCommands(page, ({ command }) => {
      if (vague >= 3 || !isObjectiveCommand(command)) return;
      const message = String((command.fields as Record<string, unknown>).message);
      // 이미 방위가 붙은 목표(「(… 입구: … 남동쪽)」·「(지하철역 북쪽)」)는 통과 — where 로 붙인 힌트는 글 속 장소 이름 힌트와 다를 수 있다.
      if (/입구:|\([^()]*(북|남|동|서|가운데)[^()]*\)\s*$/u.test(message)) return;
      if (withWhere(project, fromMapId, message) === message) return;
      vague += 1;
      gaps.push(`목표 「${message.slice(0, 40)}」 가 다른 장소 이름만 대고 그 입구가 어디인지 말하지 않는다 — 새 플레이어가 길을 못 찾는다. 같은 글로 set_objective 를 다시 부르면 「(지하철역 입구: 동네 거리 남동쪽)」 처럼 방위가 붙는다(where 로 대상 이벤트·장소를 줄 수도 있다).`);
    });
  }
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
export function whereHint(project: Project, fromMapId: string, target: { mapId: string; x?: number; y?: number; label?: string }): string | undefined {
  const from = project.maps[fromMapId];
  const to = project.maps[target.mapId];
  if (!from || !to) return undefined;
  if (to.id === from.id) {
    if (target.x === undefined || target.y === undefined) return undefined;
    return `${target.label ? `${target.label}: ` : ""}${from.name ?? from.id} ${mapRegion(from, target.x, target.y)}`;
  }
  const gates = gatesTo(from, to.id);
  if (gates.length === 0) return undefined;
  const regions = [...new Set(gates.map((gate) => mapRegion(from, gate.x, gate.y)))].slice(0, 2).join("·");
  return `${to.name ?? to.id} 입구: ${from.name ?? from.id} ${regions}`;
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
export function withWhere(project: Project, fromMapId: string, text: string, where?: string): string {
  const hints: string[] = [];
  if (where) {
    for (const map of Object.values(project.maps)) {
      const event = (map.events ?? []).find((candidate) => candidate.id === where || candidate.name === where);
      if (event) {
        const hint = whereHint(project, fromMapId, { mapId: map.id, x: event.x, y: event.y, ...(event.name ? { label: event.name } : {}) });
        if (hint) hints.push(hint);
        break;
      }
      if (map.id === where || map.name === where) {
        const hint = whereHint(project, fromMapId, { mapId: map.id });
        if (hint) hints.push(hint);
        break;
      }
    }
  }
  if (hints.length === 0) for (const map of namedMaps(project, text, fromMapId)) {
    const hint = whereHint(project, fromMapId, { mapId: map.id });
    if (hint) hints.push(hint);
    if (hints.length >= 2) break;
  }
  // 글에 이벤트 이름(「책장」)만 나오면 그 이벤트 자리 — 같은 맵이면 방위, 다른 맵이면 그 맵 입구(2026-10-28 mt3 argon escape:
  // 「책장 주변에서 두 번째 단서를 찾자」 에 어디가 안 붙어 판정자가 「조사할 위치를 잡는 데 헤맸다」).
  if (hints.length === 0) {
    const named = namedEvent(project, text, fromMapId);
    if (named) { const hint = whereHint(project, fromMapId, named); if (hint) hints.push(hint); }
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
    text = withWhere(project, map.id, raw, input.where);
    // 시작 목표에 「어디」가 없으면 청사진 첫 단계 이벤트 자리를 붙인다 — 「서재 안을 조사해 첫 번째 단서를 찾자」만으로는 어느 가구인지 모른다.
    const firstStep = project.gameBlueprint?.steps[0];
    if (text === raw && !input.where && firstStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === firstStep.event || e.name === firstStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? firstStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target) : undefined;
      if (hint && !raw.includes(hint)) text = `${raw} (${hint})`;
    }
    // 시작 맵 자동 실행에 이미 목표가 있으면 그 자리를 바꾼다(조건 달린 오프닝 페이지여도) — 새 이벤트를 하나 더 두면 두 목표가 겨룬다.
    const owner = (map.events ?? []).find((event) => (event.pages ?? []).some((page) => ["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) && JSON.stringify(page.commands ?? []).includes(OBJECTIVE_SURFACE)));
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
      if (replaced > 0) return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${owner.name ?? owner.id} 에 있던 시작 목표를 바꿨다`, events: [{ mapId: map.id, event }] };
    }
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
    text = withWhere(project, map.id, raw, input.where);
    // 「어디」가 안 붙었고 이 이벤트가 청사진 단계면 다음 단계 이벤트 자리를 붙인다(「…문을 열고 탈출하자」 → 「(잠긴 문: 잠긴 서재 서쪽)」).
    const steps = project.gameBlueprint?.steps ?? [];
    const k = steps.findIndex((step) => step.event === found.id || step.event === found.name);
    const nextStep = k >= 0 ? steps[k + 1] : undefined;
    if (text === raw && !input.where && nextStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === nextStep.event || e.name === nextStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? nextStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target) : undefined;
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
