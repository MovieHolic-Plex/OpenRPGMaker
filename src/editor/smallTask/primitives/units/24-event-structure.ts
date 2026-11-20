import { displayText } from "@/editor/smallTask/target";
import { strandedByRemoval } from "@/editor/tools/strandedSwitches";
import type { JsonSchema } from "@/editor/tools/types";
import { eventDisplayName } from "@/project/eventDisplayName";
import { eventWithoutDraft } from "@/project/eventDrafts";
import { EventPlacementAnalysis, eventRequiresPassableTile } from "@/project/eventPlacementRecovery";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { validateAssetRef } from "@/project/io/shapeReferenceFields";
import type { Dir, EventPage, GameEvent, GameMap, Project, SimpleTriggerKind } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "24-event-structure";

type Args = Record<string, unknown>;
type Cell = { x: number; y: number };

const eventTargets = ["event"] as const;
const mapTargets = ["map"] as const;
const directions = { up: "위쪽", down: "아래쪽", left: "왼쪽", right: "오른쪽" } satisfies Record<Dir, string>;
const triggers = {
  action: "결정 키", touch: "플레이어 접촉", playerTouch: "플레이어 접촉",
  eventTouch: "이벤트 접촉", auto: "자동 실행", parallel: "병렬 실행",
} satisfies Record<SimpleTriggerKind, string>;
const priorities = { below: "플레이어 아래", same: "플레이어와 같은 높이", above: "플레이어 위" } satisfies Record<EventPage["priority"], string>;

const nameField: JsonSchema = { type: "string", minLength: 1, maxLength: 100, description: "이벤트나 페이지의 표시 이름" };
const pageField: JsonSchema = { type: "integer", minimum: 1, description: "첫 페이지를 1로 세는 페이지 번호. 생략하면 선택한 페이지를 사용" };
const cellFields = {
  x: { type: "integer", description: "목적지의 가로 칸 번호. 왼쪽 끝은 0" },
  y: { type: "integer", description: "목적지의 세로 칸 번호. 맨 위는 0" },
} satisfies Record<string, JsonSchema>;
const destinationFields = {
  ...cellFields,
  dx: { type: "integer", description: "현재 자리에서 오른쪽으로 갈 칸 수. 왼쪽은 음수" },
  dy: { type: "integer", description: "현재 자리에서 아래로 갈 칸 수. 위는 음수" },
} satisfies Record<string, JsonSchema>;
const schema = (properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema =>
  ({ type: "object", additionalProperties: false, properties, required });

function scopeRefusal(message: string): never {
  throw new PrimitiveError(`범위 밖: ${message}`);
}

function selectedMap(ctx: PrimitiveContext): GameMap {
  if (ctx.target.kind === "dbEntry") scopeRefusal("맵이나 이벤트를 선택해 주세요.");
  const map = ctx.project.maps[ctx.target.mapId];
  if (!map) throw new PrimitiveError("선택한 맵을 찾을 수 없어요.");
  return map;
}

function selectedEvent(ctx: PrimitiveContext): { map: GameMap; event: GameEvent } {
  if (ctx.target.kind !== "event") scopeRefusal("먼저 고칠 이벤트를 선택해 주세요.");
  const { eventId, x, y } = ctx.target;
  const map = selectedMap(ctx);
  const event = map.events.find(entry => entry.id === eventId);
  if (!event || event.x !== x || event.y !== y) scopeRefusal("이벤트의 현재 자리를 다시 선택해 주세요.");
  return { map, event };
}

function eventScope(ctx: PrimitiveContext) {
  const { map, event } = selectedEvent(ctx);
  return { kind: "tileEvent" as const, mapId: map.id, x: event.x, y: event.y, eventId: event.id };
}

function selectedCell(ctx: PrimitiveContext): Cell {
  const rect = ctx.selection?.rect;
  if (rect?.w !== 1 || rect.h !== 1) scopeRefusal("목적지 한 칸을 먼저 선택해 주세요.");
  const map = selectedMap(ctx);
  assertInMap(map, rect);
  return { x: rect.x, y: rect.y };
}

function assertInMap(map: GameMap, { x, y }: Cell): void {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    scopeRefusal("목적지가 선택한 맵 밖에 있어요.");
  }
}

function requestedCell(args: Args, origin?: Cell): Cell | undefined {
  const { x, y, dx, dy } = args;
  if (x !== undefined || y !== undefined) {
    if (typeof x !== "number" || typeof y !== "number" || dx !== undefined || dy !== undefined) {
      throw new PrimitiveError("가로와 세로 위치를 함께 쓰거나 이동할 칸 수를 적어 주세요.");
    }
    return { x, y };
  }
  if (origin && (typeof dx === "number" || typeof dy === "number")) {
    return { x: origin.x + Number(dx ?? 0), y: origin.y + Number(dy ?? 0) };
  }
  return undefined;
}

function requireSelectedDestination(selected: Cell, requested?: Cell): void {
  if (requested && (requested.x !== selected.x || requested.y !== selected.y)) {
    scopeRefusal("선택한 목적지 한 칸만 사용할 수 있어요.");
  }
}

function cellScope(ctx: PrimitiveContext) {
  return { kind: "tileEvent" as const, mapId: selectedMap(ctx).id, ...selectedCell(ctx), eventId: null };
}

function replaceEvents(project: Project, map: GameMap, events: GameEvent[]): Project {
  return { ...project, maps: { ...project.maps, [map.id]: { ...map, events } } };
}

function replaceEvent(project: Project, map: GameMap, event: GameEvent): Project {
  return replaceEvents(project, map, map.events.map(entry => entry.id === event.id ? event : entry));
}

function nextId(stem: string, used: ReadonlySet<string>, start = 1): string {
  let number = start;
  while (used.has(`${stem}_${number}`)) number += 1;
  return `${stem}_${number}`;
}

function nextEventId(project: Project): string {
  const used = new Set(Object.keys(project.session.selfSwitches ?? {}));
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) used.add(event.id);
  }
  return nextId("ev_small_task", used);
}

function legacyPage(event: GameEvent): EventPage {
  return {
    id: `${event.id}_page_1`, name: "페이지 1",
    conditions: event.condition ? [event.condition] : [],
    graphic: event.sprite ? { sprite: event.sprite } : {},
    trigger: event.trigger, priority: "same",
    movement: { type: event.moveRoute ? "custom" : "fixed", speed: 3, frequency: 3, route: event.moveRoute },
    commands: structuredClone(event.commands),
  };
}

function pagesOf(event: GameEvent): readonly EventPage[] {
  return event.pages?.length ? event.pages : [legacyPage(event)];
}

function pageAt(pages: readonly EventPage[], number: number): EventPage {
  const page = pages[number - 1];
  if (!page) throw new PrimitiveError("그 번호의 페이지를 찾을 수 없어요.");
  return page;
}

function selectedPageNumber(ctx: PrimitiveContext, pages: readonly EventPage[], args: Args): number {
  if (ctx.target.kind === "event" && ctx.target.pageId) {
    const { pageId } = ctx.target;
    const number = pages.findIndex(page => page.id === pageId) + 1;
    if (!number || (args.page !== undefined && args.page !== number)) scopeRefusal("선택한 페이지만 고칠 수 있어요.");
    return number;
  }
  return typeof args.page === "number" ? args.page : 1;
}

function optionalName(args: Args): string | undefined {
  if (typeof args.name !== "string") return undefined;
  const name = args.name.trim();
  if (!name) throw new PrimitiveError("이름을 한 글자 이상 적어 주세요.");
  return name;
}

function previewName(name: string, fallback: string): string {
  const text = displayText(name.replace(/[{}[\]]/gu, ""), fallback);
  return text.length > 32 ? `${text.slice(0, 31)}…` : text;
}

function eventLabel(event: GameEvent): string {
  const name = eventDisplayName(event);
  return name === event.id ? "선택한 이벤트" : `‘${previewName(name, "이름 없음")}’ 이벤트`;
}

function validateReferences(before: Project, after: Project, message: string): void {
  const baseline = new Set(collectProjectReferenceIssues(before));
  if (collectProjectReferenceIssues(after).some(issue => !baseline.has(issue))) throw new PrimitiveError(message);
}

function movedTo(map: GameMap, event: GameEvent, destination: Cell): GameEvent {
  return {
    ...event,
    ...destination,
    ...(event.schedule ? {
      schedule: event.schedule.map(entry =>
        entry.at.mapId === map.id && entry.at.x === event.x && entry.at.y === event.y
          ? { ...entry, at: { ...entry.at, ...destination } } : entry),
    } : {}),
  };
}

function assertPlacement(project: Project, map: GameMap, event: GameEvent): void {
  const needsFloor = eventRequiresPassableTile(event) || pagesOf(event).some(page =>
    (page.trigger.kind === "touch" || page.trigger.kind === "playerTouch") && page.priority !== "same");
  if (!new EventPlacementAnalysis(project, map).validDestination(event, needsFloor)) {
    throw new PrimitiveError("그 칸에 이벤트를 놓을 수 없어요. 비어 있고 접근할 수 있는 자리를 골라 주세요.");
  }
}

function patchedGraphic(project: Project, previous: EventPage["graphic"], args: Args): EventPage["graphic"] {
  const graphic = { ...previous };
  if (args.graphic === null) {
    delete graphic.sprite;
    delete graphic.appearanceId;
    delete graphic.pattern;
    graphic.transparent = true;
  } else if (args.graphic !== undefined) {
    let sprite: ReturnType<typeof validateAssetRef>;
    try {
      sprite = validateAssetRef("이벤트 그림", args.graphic);
    } catch {
      throw new PrimitiveError("이벤트 그림을 다시 골라 주세요.");
    }
    const uploaded = Object.hasOwn(project.assets.uploaded, sprite.id);
    if (sprite.type === "uploaded" ? !uploaded : uploaded || !collectResourceIds(project).has(sprite.id)) {
      throw new PrimitiveError("사용할 그림을 찾을 수 없어요.");
    }
    if (graphic.sprite?.id !== sprite.id || graphic.sprite?.type !== sprite.type) delete graphic.pattern;
    delete graphic.appearanceId;
    graphic.sprite = sprite;
    graphic.transparent = false;
  }
  if (typeof args.pattern === "number") {
    if (!Number.isSafeInteger(args.pattern) || args.pattern < 0) throw new PrimitiveError("그림의 칸 번호를 확인해 주세요.");
    if (!graphic.sprite) throw new PrimitiveError("그림을 먼저 골라 주세요.");
    graphic.pattern = args.pattern;
  }
  if (typeof args.direction === "string") graphic.direction = args.direction as Dir;
  return graphic;
}

const patchFields: Record<string, JsonSchema> = {
  graphic: {
    type: ["object", "null"], description: "교체할 그림의 리소스. 그림을 없애려면 비움",
    required: ["type", "id"], additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["bundled", "uploaded"], description: "기본 제공 또는 올린 그림" },
      id: { type: "string", minLength: 1, description: "그림 목록에서 확인한 리소스 식별값" },
    },
  },
  pattern: { type: "integer", minimum: 0, description: "그림에서 표시할 칸 번호. 첫 칸은 0" },
  trigger: { type: "string", enum: Object.keys(triggers), description: "결정 키, 플레이어 접촉, 이벤트 접촉, 자동 실행 또는 병렬 실행" },
  priority: { type: "string", enum: Object.keys(priorities), description: "플레이어에 비해 아래, 같은 높이 또는 위" },
  through: { type: "boolean", description: "같은 높이에서 플레이어가 이벤트가 있는 칸을 통과할 수 있는지 여부" },
  direction: { type: "string", enum: Object.keys(directions), description: "처음에 바라볼 방향" },
};

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  {
    id: "event.tile.create", unit: UNIT, title: "이벤트 만들기", covers: { tools: ["upsert_event(create)"] },
    targets: mapTargets, args: schema({ name: nameField, ...cellFields }),
    scope: cellScope,
    describe(_ctx, args) {
      return args.name ? `선택한 칸에 ‘${previewName(String(args.name), "이벤트")}’ 이름으로 이벤트를 만들어요.` : "선택한 칸에 빈 이벤트를 만들어요.";
    },
    apply(ctx, args) {
      if (ctx.target.kind !== "map") scopeRefusal("이벤트를 만들 맵의 빈 칸을 선택해 주세요.");
      const map = selectedMap(ctx);
      const cell = selectedCell(ctx);
      requireSelectedDestination(cell, requestedCell(args));
      const name = optionalName(args);
      const event: GameEvent = {
        id: nextEventId(ctx.project), ...cell, ...(name ? { name } : {}),
        trigger: { kind: "action" }, commands: [],
      };
      event.pages = [legacyPage(event)];
      if (!new EventPlacementAnalysis(ctx.project, map).canOccupy(event)) throw new PrimitiveError("이미 사용 중인 칸이에요.");
      return replaceEvents(ctx.project, map, [...map.events, event]);
    },
  },
  {
    id: "event.page.add", unit: UNIT, title: "페이지 추가", covers: { tools: ["add_event_page"] },
    targets: eventTargets,
    args: schema({
      name: nameField,
      copyFrom: { ...pageField, description: "그림과 실행 설정을 가져올 페이지 번호. 생략하면 첫 페이지" },
      position: { ...pageField, description: "새 페이지가 들어갈 자리. 첫 자리는 1이며 생략하면 맨 뒤" },
    }),
    scope: eventScope,
    describe(_ctx, args) {
      return typeof args.position === "number" ? `${args.position}번째 자리에 빈 페이지를 추가해요.` : "이벤트 맨 뒤에 빈 페이지를 추가해요.";
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const pages = [...pagesOf(event)];
      const position = Number(args.position ?? pages.length + 1);
      if (!Number.isSafeInteger(position) || position < 1 || position > pages.length + 1) throw new PrimitiveError("페이지를 추가할 자리를 찾을 수 없어요.");
      const base = pageAt(pages, Number(args.copyFrom ?? 1));
      const usedNames = new Set(pages.map(page => page.name));
      let pageNumber = pages.length + 1;
      while (usedNames.has(`페이지 ${pageNumber}`)) pageNumber += 1;
      const page: EventPage = {
        id: nextId(`${event.id}_page`, new Set(pages.map(page => page.id)), pages.length + 1),
        name: optionalName(args) ?? `페이지 ${pageNumber}`,
        graphic: structuredClone(base.graphic ?? {}), trigger: structuredClone(base.trigger ?? event.trigger),
        priority: base.priority ?? "same", conditions: [], commands: [],
        movement: structuredClone(base.movement ?? legacyPage(event).movement),
        ...(base.overlapForbidden !== undefined ? { overlapForbidden: base.overlapForbidden } : {}),
      };
      pages.splice(position - 1, 0, page);
      return replaceEvent(ctx.project, map, { ...event, pages });
    },
  },
  {
    id: "event.page.patch", unit: UNIT, title: "페이지 설정 바꾸기",
    covers: { tools: ["patch_event_page(graphic,trigger,priority,through,direction)"] },
    targets: eventTargets, args: schema({ page: pageField, ...patchFields }),
    scope: eventScope,
    describe(ctx, args) {
      const number = selectedPageNumber(ctx, pagesOf(selectedEvent(ctx).event), args);
      const changes = [
        args.graphic === null ? "그림 숨김" : args.graphic !== undefined || args.pattern !== undefined ? "그림 변경" : "",
        typeof args.trigger === "string" ? triggers[args.trigger as SimpleTriggerKind] : "",
        typeof args.priority === "string" ? priorities[args.priority as EventPage["priority"]] : "",
        typeof args.through === "boolean" ? (args.through ? "통과 허용" : "통과 금지") : "",
        typeof args.direction === "string" ? `${directions[args.direction as Dir]} 보기` : "",
      ].filter(Boolean);
      return `${number}번째 페이지에 ${changes.join("·")} 설정을 적용해요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const pages = [...pagesOf(event)];
      const number = selectedPageNumber(ctx, pages, args);
      const page = pageAt(pages, number);
      if (!Object.keys(patchFields).some(key => args[key] !== undefined)) throw new PrimitiveError("바꿀 페이지 설정을 하나 이상 골라 주세요.");
      const graphicChanged = args.graphic !== undefined || args.direction !== undefined || args.pattern !== undefined;
      pages[number - 1] = {
        ...page,
        ...(graphicChanged ? { graphic: patchedGraphic(ctx.project, page.graphic ?? {}, args) } : {}),
        ...(typeof args.trigger === "string" ? { trigger: { kind: args.trigger as SimpleTriggerKind } } : {}),
        ...(typeof args.priority === "string" ? { priority: args.priority as EventPage["priority"] } : {}),
        ...(typeof args.through === "boolean" ? { overlapForbidden: !args.through } : {}),
      };
      return replaceEvent(ctx.project, map, { ...event, pages });
    },
  },
  {
    id: "event.page.remove", unit: UNIT, title: "페이지 삭제", covers: { tools: ["remove_event_page"] },
    targets: eventTargets, args: schema({ page: pageField }),
    scope: eventScope,
    describe(ctx, args) {
      return `${selectedPageNumber(ctx, pagesOf(selectedEvent(ctx).event), args)}번째 페이지를 삭제해요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const pages = [...pagesOf(event)];
      const number = selectedPageNumber(ctx, pages, args);
      pageAt(pages, number);
      if (pages.length === 1) throw new PrimitiveError("이벤트에는 페이지를 한 장 이상 남겨야 해요.");
      pages.splice(number - 1, 1);
      return replaceEvent(ctx.project, map, { ...event, pages });
    },
  },
  {
    id: "event.page.reorder", unit: UNIT, title: "페이지 순서 바꾸기", covers: { tools: ["reorder_event_page"] },
    targets: eventTargets,
    args: schema({ page: pageField, to: { ...pageField, description: "이동한 뒤의 페이지 번호. 맨 앞은 1" } }, ["to"]),
    scope: eventScope,
    describe(ctx, args) {
      return `${selectedPageNumber(ctx, pagesOf(selectedEvent(ctx).event), args)}번째 페이지를 ${args.to}번째 자리로 옮겨요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const pages = [...pagesOf(event)];
      const from = selectedPageNumber(ctx, pages, args);
      const to = Number(args.to);
      const page = pageAt(pages, from);
      pageAt(pages, to);
      if (from === to) return ctx.project;
      pages.splice(from - 1, 1);
      pages.splice(to - 1, 0, page);
      return replaceEvent(ctx.project, map, { ...event, pages });
    },
  },
  {
    id: "event.tile.duplicate", unit: UNIT, title: "이벤트 복제", covers: { tools: ["duplicate_event"] },
    targets: eventTargets, args: schema(destinationFields),
    scope: cellScope,
    describe(ctx) {
      return `${eventLabel(selectedEvent(ctx).event)}를 선택한 빈 칸에 복제해요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const cell = selectedCell(ctx);
      requireSelectedDestination(cell, requestedCell(args, event));
      const id = nextEventId(ctx.project);
      const copy = movedTo(map, { ...eventWithoutDraft(event), id }, cell);
      if (copy.pages) copy.pages = copy.pages.map((page, index) => ({ ...page, id: `${id}_page_${index + 1}` }));
      assertPlacement(ctx.project, map, copy);
      const after = replaceEvents(ctx.project, map, [...map.events, copy]);
      validateReferences(ctx.project, after, "원본 이벤트에 연결이 끊긴 항목이 있어 복제할 수 없어요.");
      return after;
    },
  },
  {
    id: "event.tile.remove", unit: UNIT, title: "이벤트 삭제", covers: { tools: ["remove_event"] },
    targets: eventTargets, args: schema({}),
    scope: eventScope,
    describe(ctx) {
      return `${eventLabel(selectedEvent(ctx).event)}를 삭제해요.`;
    },
    apply(ctx) {
      const { map, event } = selectedEvent(ctx);
      if (event.draft) throw new PrimitiveError("열린 이벤트 편집을 먼저 마쳐 주세요.");
      if (strandedByRemoval(ctx.project, map.id, event.id).length) {
        throw new PrimitiveError("다른 이벤트의 진행에 필요한 스위치를 켜는 이벤트예요.");
      }
      const after = replaceEvents(ctx.project, map, map.events.filter(entry => entry.id !== event.id));
      validateReferences(ctx.project, after, "다른 곳에서 이 이벤트를 사용하고 있어요.");
      if (!Object.hasOwn(ctx.project.session.selfSwitches ?? {}, event.id)
        || Object.values(after.maps).some(other => other.events.some(entry => entry.id === event.id))) return after;
      const selfSwitches = { ...after.session.selfSwitches };
      delete selfSwitches[event.id];
      return { ...after, session: { ...after.session, selfSwitches } };
    },
  },
  {
    id: "event.tile.move", unit: UNIT, title: "이벤트 옮기기", covers: { tools: ["move_event"] },
    targets: eventTargets, args: schema(destinationFields),
    // 위치 변경까지 허용하려면 칸 범위 가드가 호스트의 목적지를 함께 검증해야 한다.
    scope: eventScope,
    describe(ctx, args) {
      const { event } = selectedEvent(ctx);
      const destination = requestedCell(args, event);
      return destination
        ? `${eventLabel(event)}를 왼쪽에서 ${destination.x + 1}번째, 위에서 ${destination.y + 1}번째 칸으로 옮겨요.`
        : "선택한 이벤트를 선택한 칸으로 옮겨요.";
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const selected = selectedCell(ctx);
      requireSelectedDestination(selected, requestedCell(args, event));
      if (event.x === selected.x && event.y === selected.y) return ctx.project;
      const moved = movedTo(map, event, selected);
      assertPlacement(ctx.project, map, moved);
      return replaceEvent(ctx.project, map, moved);
    },
  },
  {
    id: "event.tile.rename", unit: UNIT, title: "이벤트 이름 바꾸기", covers: { tools: ["rename_event"] },
    targets: eventTargets, args: schema({ name: nameField }, ["name"]),
    scope: eventScope,
    describe(_ctx, args) {
      return `이벤트 이름을 ‘${previewName(String(args.name), "새 이름")}’으로 바꿔요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      return replaceEvent(ctx.project, map, { ...event, name: optionalName(args) });
    },
  },
];
