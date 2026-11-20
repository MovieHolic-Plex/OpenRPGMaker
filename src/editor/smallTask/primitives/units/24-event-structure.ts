import { CHARSET_FRAME_COUNT } from "@/assets/easyrpgRtp";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import { eventDisplayName } from "@/project/eventDisplayName";
import { eventWithoutDraft } from "@/project/eventDrafts";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { EventPlacementAnalysis, eventRequiresPassableTile } from "@/project/eventPlacementRecovery";
import { rectsOverlap } from "@/project/footprint";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { validateAssetRef } from "@/project/io/shapeReferenceFields";
import { uploadedSpriteGeometry } from "@/project/uploadedSpriteGeometry";
import type { Dir, EventPage, GameEvent, GameMap, Project, SimpleTriggerKind } from "@/project/types";
import { genId } from "@/util/id";
import { PrimitiveError, SELECT_EVENT_PAGE } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { anOpenDraftReferencesDeletedEvent, hasEventReference, hasNamedEventReference, hasNamedObjective, pageIsShadowed, switchesStrandedByDeletion } from "./24-event-structure/references";

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
  x: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "목적지의 가로 칸 번호. 왼쪽 끝은 0" },
  y: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "목적지의 세로 칸 번호. 맨 위는 0" },
} satisfies Record<string, JsonSchema>;
const destinationFields = {
  ...cellFields,
  dx: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER, description: "현재 자리에서 오른쪽으로 갈 칸 수. 왼쪽은 음수" },
  dy: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER, description: "현재 자리에서 아래로 갈 칸 수. 위는 음수" },
} satisfies Record<string, JsonSchema>;
const schema = (properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema =>
  ({ type: "object", additionalProperties: false, properties, required });

function scopeRefusal(message: string): never {
  throw new PrimitiveError(`범위 밖: ${message}`);
}

function selectedMap(ctx: PrimitiveContext): GameMap {
  if (ctx.target.kind === "dbEntry") scopeRefusal("맵이나 이벤트를 선택해 주세요.");
  const map = ctx.project.maps[ctx.target.mapId];
  if (!map || map.id !== ctx.target.mapId) scopeRefusal("선택한 맵을 찾을 수 없어요.");
  return map;
}

function selectedEvent(ctx: PrimitiveContext): { map: GameMap; event: GameEvent } {
  if (ctx.target.kind !== "event") scopeRefusal("먼저 고칠 이벤트를 선택해 주세요.");
  const { eventId, pageId, x, y } = ctx.target;
  const map = selectedMap(ctx);
  const [event, duplicate] = map.events.filter(entry => entry.id === eventId);
  if (!event || duplicate || event.x !== x || event.y !== y) scopeRefusal("이벤트의 현재 자리를 다시 선택해 주세요.");
  assertInMap(map, event);
  if (pageId !== undefined && event.pages?.filter(page => page.id === pageId).length !== 1) {
    scopeRefusal("고칠 페이지를 다시 선택해 주세요.");
  }
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

function nextEventId(project: Project, mapId: string): string {
  const used = new Set(Object.keys(project.session.selfSwitches ?? {}));
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) used.add(event.id);
  }
  // Play saves can still refer to IDs removed from the authored project.
  let id: string;
  do id = genId("ev_small_task");
  while (used.has(id) || hasEventReference(project, mapId, id, false));
  return id;
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
  if (typeof args.page === "number") return args.page;
  if (pages.length > 1) throw new PrimitiveError(SELECT_EVENT_PAGE);
  return 1;
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

function overlapsLaterPage(map: GameMap, candidate: GameEvent): boolean {
  const body = eventBodyRect(candidate);
  return map.events.some(event => event.pages?.slice(1).some(page =>
    rectsOverlap(body, eventBodyRect({ ...event, pages: [page] }))));
}

function assertPlacement(project: Project, map: GameMap, event: GameEvent): void {
  const analysis = new EventPlacementAnalysis(project, map);
  const fits = pagesOf(event).every(page => {
    const candidate = { ...event, pages: [page] };
    const needsFloor = eventRequiresPassableTile(candidate)
      || ((page.trigger.kind === "touch" || page.trigger.kind === "playerTouch") && page.priority !== "same");
    return analysis.validDestination(candidate, needsFloor) && !overlapsLaterPage(map, candidate);
  });
  if (!fits) {
    throw new PrimitiveError("그 칸에 이벤트를 놓을 수 없어요. 비어 있고 접근할 수 있는 자리를 골라 주세요.");
  }
}

function eventGraphicFrames(project: Project, id: string): number | undefined {
  const { sprites, uploaded } = project.assets;
  if ((id in sprites && !Object.hasOwn(sprites, id)) || (id in uploaded && !Object.hasOwn(uploaded, id))) return undefined;
  const texture = resolveEventSpriteTexture(project, id, 0);
  if (!texture) return undefined;
  const def = sprites[id];
  const upload = uploaded[def?.image.id ?? texture.texture];
  if (upload?.kind === "sprite") return uploadedSpriteGeometry(upload)?.frames;
  if (isCharsetSpriteTexture(texture)) return CHARSET_FRAME_COUNT;
  if (texture.frame === "__BASE") return 1;
  const bundled = def ?? Object.values(sprites).find(sprite => sprite.image.type === "bundled" && sprite.image.id === id);
  return bundled?.frames ?? upload?.meta.frames ?? 1;
}

function patchedGraphic(project: Project, event: GameEvent, previous: EventPage["graphic"], args: Args): EventPage["graphic"] {
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
    if ((sprite.type === "uploaded") !== uploaded || eventGraphicFrames(project, sprite.id) === undefined) {
      throw new PrimitiveError("사용할 그림을 찾을 수 없어요.");
    }
    if (graphic.sprite?.id !== sprite.id || graphic.sprite?.type !== sprite.type) delete graphic.pattern;
    delete graphic.appearanceId;
    graphic.sprite = sprite;
    graphic.transparent = false;
  }
  if (typeof args.pattern === "number") {
    const sprite = resolveEventAppearanceGraphic(project, graphic).sprite ?? event.sprite;
    const frames = sprite && eventGraphicFrames(project, sprite.id);
    if (args.graphic === null || frames === undefined) throw new PrimitiveError("그림을 먼저 골라 주세요.");
    if (!Number.isSafeInteger(args.pattern) || args.pattern < 0 || args.pattern >= frames) {
      throw new PrimitiveError("그림에 있는 칸 번호를 골라 주세요. 첫 칸은 0이에요.");
    }
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
      return args.name ? `선택한 칸에 ‘${previewName(String(args.name), "새 이벤트")}’ 이벤트를 만들어요.` : "선택한 칸에 빈 이벤트를 만들어요.";
    },
    apply(ctx, args) {
      if (ctx.target.kind !== "map") scopeRefusal("이벤트를 만들 맵의 빈 칸을 선택해 주세요.");
      const map = selectedMap(ctx);
      const cell = selectedCell(ctx);
      requireSelectedDestination(cell, requestedCell(args));
      const name = optionalName(args);
      const event: GameEvent = {
        id: nextEventId(ctx.project, map.id), ...cell, ...(name ? { name } : {}),
        trigger: { kind: "action" }, commands: [],
      };
      event.pages = [legacyPage(event)];
      if (!new EventPlacementAnalysis(ctx.project, map).canOccupy(event) || overlapsLaterPage(map, event)) {
        throw new PrimitiveError("이미 사용 중인 칸이에요.");
      }
      return replaceEvents(ctx.project, map, [...map.events, event]);
    },
  },
  {
    id: "event.page.add", unit: UNIT, title: "페이지 추가", covers: { tools: ["add_event_page"] },
    targets: eventTargets,
    args: schema({
      name: nameField,
      copyFrom: { ...pageField, description: "그림과 실행 설정을 가져올 페이지 번호. 생략하면 첫 페이지" },
      position: { ...pageField, description: "새 페이지가 들어갈 자리. 첫 자리는 1이며, 생략하면 맨 앞에 넣어요. 조건이 맞는 페이지 중 맨 뒤 한 장이 실행돼요." },
    }),
    scope: eventScope,
    describe(_ctx, args) {
      return typeof args.position === "number" ? `${args.position}번째 자리에 빈 페이지를 추가해요.` : "이벤트 맨 앞에 빈 페이지를 추가해요.";
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const pages = [...pagesOf(event)];
      const position = Number(args.position ?? 1);
      if (!Number.isSafeInteger(position) || position < 1 || position > pages.length + 1) throw new PrimitiveError("페이지를 추가할 자리를 찾을 수 없어요.");
      const base = pageAt(pages, Number(args.copyFrom ?? 1));
      if (args.position === undefined && !pages.some(page => (page.conditions ?? []).length === 0)) {
        throw new PrimitiveError("모든 페이지에 등장 조건이 있어요. 빈 페이지를 넣을 자리를 지정해 주세요.");
      }
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
        ...(base.animationType !== undefined ? { animationType: base.animationType } : {}),
        ...(base.footprint ? { footprint: { ...base.footprint } } : {}),
        ...(base.passRows !== undefined ? { passRows: base.passRows } : {}),
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
      return `${number}번째 페이지에 ${changes.join(", ")} 설정을 적용해요.`;
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
        ...(graphicChanged ? { graphic: patchedGraphic(ctx.project, event, page.graphic ?? {}, args) } : {}),
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
      const removed = pageAt(pages, number);
      if (pages.length === 1) throw new PrimitiveError("이벤트에는 페이지를 한 장 이상 남겨야 해요.");
      pages.splice(number - 1, 1);
      const edited = { ...event, pages };
      const after = replaceEvent(ctx.project, map, edited);
      if (!pageIsShadowed(event, removed)) {
        const stranded = switchesStrandedByDeletion(after, removed, edited);
        if (stranded.self) throw new PrimitiveError("이 페이지를 지우면 다음 진행에 필요한 셀프 스위치를 켤 수 없어요.");
        if (stranded.global) throw new PrimitiveError("이 페이지를 지우면 다른 곳에서 기다리는 스위치를 켤 수 없어요.");
      }
      return after;
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
      return `선택한 빈 칸에 ${eventLabel(selectedEvent(ctx).event)}의 복제본을 만들어요.`;
    },
    apply(ctx, args) {
      const { map, event } = selectedEvent(ctx);
      const cell = selectedCell(ctx);
      requireSelectedDestination(cell, requestedCell(args, event));
      const id = nextEventId(ctx.project, map.id);
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
      if (event.draft || ctx.live?.maps[map.id]?.events.some(entry => entry.id === event.id && entry.draft)) {
        throw new PrimitiveError("열린 이벤트 편집을 먼저 마쳐 주세요.");
      }
      const after = replaceEvents(ctx.project, map, map.events.filter(entry => entry.id !== event.id));
      if (switchesStrandedByDeletion(after, event).global) {
        throw new PrimitiveError("이 이벤트를 지우면 진행에 필요한 스위치를 켤 수 없어요.");
      }
      if (hasEventReference(after, map.id, event.id) || hasNamedObjective(after, event)
        || hasNamedEventReference(ctx.project, map.id, event)
        || anOpenDraftReferencesDeletedEvent(ctx.project, after, map.id, event, ctx.live)) {
        throw new PrimitiveError("다른 곳에서 이 이벤트를 사용하고 있어요. 연결을 먼저 확인해 주세요.");
      }
      // Reference diagnostics may include array indexes. Keep the surviving events at the same indexes in both snapshots.
      const baseline = replaceEvents(ctx.project, map, [...after.maps[map.id].events, event]);
      validateReferences(baseline, after, "다른 곳에서 이 이벤트를 사용하고 있어요.");
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
    describe() {
      return "이벤트가 이미 선택한 칸에 있어요.";
    },
    apply(ctx, args) {
      const { event } = selectedEvent(ctx);
      const selected = selectedCell(ctx);
      requireSelectedDestination(selected, requestedCell(args, event));
      if (event.x === selected.x && event.y === selected.y) return ctx.project;
      scopeRefusal("작은 일에서는 이벤트를 다른 칸으로 옮길 수 없어요. 맵에서 이벤트를 직접 옮겨 주세요.");
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
      const name = optionalName(args);
      if (!name) throw new PrimitiveError("이름을 한 글자 이상 적어 주세요.");
      if (hasNamedObjective(ctx.project, event, name)) {
        throw new PrimitiveError("현재 목표가 이 이벤트를 이름으로 가리키고 있어요. 목표의 연결을 먼저 확인해 주세요.");
      }
      if (hasNamedEventReference(ctx.project, map.id, event, name)) {
        throw new PrimitiveError("다른 곳에서 이 이벤트를 이름으로 찾고 있어요. 대사나 조건의 연결을 먼저 확인해 주세요.");
      }
      return replaceEvent(ctx.project, map, { ...event, name });
    },
  },
];
