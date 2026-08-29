import { resolveEventPage } from "@/project/io";
import { footprintBounds, normalizeCharacterFootprint, normalizeCharacterScale, pointRect, rectsOverlap } from "@/project/footprint";
import type {
  AssetRef,
  CharacterFootprint,
  Dir,
  EventAnimationType,
  EventPage,
  EventPageMovement,
  EventPriority,
  FootprintRect,
  GameMap,
  GameEvent,
  Project,
  Trigger,
} from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

const DEFAULT_PAGE_MOVEMENT: EventPageMovement = {
  type: "fixed",
  speed: 3,
  frequency: 3,
};

export interface RuntimeEventPosition {
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
}

export type RuntimeEventPositions = Record<string, RuntimeEventPosition>;

export interface RuntimeEventView {
  readonly event: GameEvent;
  readonly page: EventPage | undefined;
  readonly pageId: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly trigger: Trigger;
  readonly priority: EventPriority;
  readonly overlapForbidden: boolean;
  /** 충돌 발자국. 생략된 페이지는 1x1 로 정규화돼 언제나 존재한다. */
  readonly footprint: CharacterFootprint;
  /** 스프라이트 렌더 배율. 생략 시 1. 발자국과 독립. */
  readonly scale: number;
  readonly transparent: boolean;
  readonly animationType: EventAnimationType;
  readonly movement: EventPageMovement;
  readonly sprite: AssetRef | undefined;
  readonly direction: Dir | undefined;
  readonly runtimeDirection: Dir | undefined;
}

export function initialRuntimeEventPositions(events: readonly GameEvent[]): RuntimeEventPositions {
  const positions: RuntimeEventPositions = {};
  for (const event of events) {
    positions[event.id] = { x: event.x, y: event.y };
  }
  return positions;
}

export function moveRuntimeEventPosition(
  positions: RuntimeEventPositions,
  eventId: string,
  x: number,
  y: number,
  direction?: Dir
): void {
  positions[eventId] = { x, y, direction: direction ?? positions[eventId]?.direction };
}

export function setRuntimeEventPositionDirection(
  positions: RuntimeEventPositions,
  eventId: string,
  direction: Dir
): void {
  const position = positions[eventId];
  if (!position) return;
  positions[eventId] = { ...position, direction };
}

export function runtimeEventView(
  event: GameEvent,
  session: PlaySessionLike,
  positions: RuntimeEventPositions
): RuntimeEventView {
  const page = resolveEventPage(event, session);
  const location = session.eventLocations?.[event.id];
  const runtimePosition = positions[event.id];
  const position = location ? { x: location.x, y: location.y } : runtimePosition ?? { x: event.x, y: event.y };
  const runtimeDirection = location?.direction ?? runtimePosition?.direction;
  const transparent = page?.graphic.transparent === true;
  return {
    event,
    page,
    pageId: page?.id,
    x: position.x,
    y: position.y,
    trigger: page?.trigger ?? event.trigger,
    priority: page?.priority ?? "same",
    overlapForbidden: page?.overlapForbidden ?? true,
    footprint: normalizeCharacterFootprint(page?.footprint),
    scale: normalizeCharacterScale(page?.graphic.scale),
    transparent,
    animationType: page?.animationType ?? "normal",
    movement: page?.movement ?? legacyMovement(event),
    sprite: transparent ? undefined : page?.graphic.sprite ?? event.sprite,
    direction: runtimeDirection ?? page?.graphic.direction,
    runtimeDirection,
  };
}

/**
 * 이 맵에 있는 런타임 이벤트 뷰를 순서대로 방문한다 — 이 파일의 유일한 순회 원본.
 * visit 이 true 를 내면 즉시 멈춘다(찾기 질의는 배열을 만들지 않는다).
 *
 * 왜: 예전에는 모든 질의가 runtimeEventViewsForMap 으로 **전체 배열**을 만든 뒤 find/some
 * 했다. 그 배열은 다른 모든 맵의 이벤트까지 훑고 Set 3종을 새로 만든다. NPC 마다 프레임당
 * 1~3회 불려 O(N²) 가 됐다(실측 0.04~0.16ms/호출).
 */
function forEachRuntimeEventView(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  visit: (view: RuntimeEventView) => boolean | void
): void {
  const erased = idSet(session.erasedEventIds);
  const removedOnCurrentMap = removedEventSet(session, map.id);
  const locations = session.eventLocations;
  const included = new Set<string>();
  for (const event of map.events) {
    if (erased?.has(event.id)) continue;
    if (removedOnCurrentMap?.has(event.id)) continue;
    const location = locations?.[event.id];
    if (location && location.mapId !== map.id) continue;
    included.add(event.id);
    if (visit(runtimeEventView(event, session, positions)) === true) return;
  }
  // 다른 맵의 이벤트는 **이 맵으로 옮겨진 것만** 후보다. 옮겨진 이벤트가 없으면
  // 맵 전체 순회를 건너뛴다(대부분의 프레임이 여기에 해당한다). 후보 집합은 다른 맵이
  // 실제로 있을 때만 만든다 — 맵이 하나뿐인 프로젝트에서 헛일이 되지 않게.
  let incoming: ReadonlySet<string> | undefined;
  let incomingResolved = false;
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    if (!incomingResolved) {
      incomingResolved = true;
      incoming = incomingEventIds(locations, map.id, included, erased);
    }
    if (!incoming) break;
    const removedOnSourceMap = removedEventSet(session, sourceMap.id);
    for (const event of sourceMap.events) {
      if (!incoming.has(event.id)) continue;
      if (included.has(event.id)) continue;
      if (removedOnSourceMap?.has(event.id)) continue;
      included.add(event.id);
      if (visit(runtimeEventView(event, session, positions)) === true) return;
    }
  }
  const spawned = session.spawnedEvents;
  if (!spawned) return;
  for (const spawnedEventId in spawned) {
    const spawn = spawned[spawnedEventId];
    if (!spawn || spawn.mapId !== map.id) continue;
    if (included.has(spawnedEventId)) continue;
    const event = materializeSpawnedEvent(project, spawnedEventId, spawn);
    if (!event) continue;
    included.add(spawnedEventId);
    if (visit(runtimeEventView(event, session, positions)) === true) return;
  }
}

export function runtimeEventViewsForMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions
): RuntimeEventView[] {
  const views: RuntimeEventView[] = [];
  forEachRuntimeEventView(project, map, session, positions, (view) => {
    views.push(view);
  });
  return views;
}

/** 이벤트 하나만 필요한 질의. 전체 배열을 만들지 않고 찾는 즉시 멈춘다. */
export function runtimeEventViewById(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  eventId: string
): RuntimeEventView | undefined {
  let found: RuntimeEventView | undefined;
  forEachRuntimeEventView(project, map, session, positions, (view) => {
    if (view.event.id !== eventId) return false;
    found = view;
    return true;
  });
  return found;
}

/** 이 맵으로 옮겨졌고 아직 방문되지 않은 이벤트 id. 없으면 undefined. */
function incomingEventIds(
  locations: PlaySessionLike["eventLocations"],
  mapId: string,
  included: ReadonlySet<string>,
  erased: ReadonlySet<string> | undefined
): ReadonlySet<string> | undefined {
  if (!locations) return undefined;
  let ids: Set<string> | undefined;
  for (const eventId in locations) {
    if (locations[eventId]?.mapId !== mapId) continue;
    if (included.has(eventId)) continue;
    if (erased?.has(eventId)) continue;
    ids ??= new Set<string>();
    ids.add(eventId);
  }
  return ids;
}

function idSet(ids: readonly string[] | undefined): ReadonlySet<string> | undefined {
  return ids && ids.length > 0 ? new Set(ids) : undefined;
}

function removedEventSet(session: PlaySessionLike, mapId: string): ReadonlySet<string> | undefined {
  return idSet(session.removedEventIds?.[mapId]);
}

function materializeSpawnedEvent(
  project: Pick<Project, "maps">,
  eventId: string,
  spawn: NonNullable<PlaySessionLike["spawnedEvents"]>[string]
): GameEvent | null {
  const template = findTemplateEvent(project, spawn.templateMapId, spawn.templateEventId);
  if (!template) return null;
  return {
    ...template,
    id: eventId,
    x: spawn.x,
    y: spawn.y,
    pages: template.pages?.map((page) => ({ ...page, commands: [...page.commands] })),
    commands: [...template.commands],
  };
}

function findTemplateEvent(
  project: Pick<Project, "maps">,
  templateMapId: string,
  templateEventId: string
): GameEvent | undefined {
  const preferred = project.maps[templateMapId]?.events.find((event) => event.id === templateEventId);
  if (preferred) return preferred;
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === templateEventId);
    if (event) return event;
  }
  return undefined;
}

function legacyMovement(event: GameEvent): EventPageMovement {
  return event.moveRoute
    ? { ...DEFAULT_PAGE_MOVEMENT, type: "custom", route: event.moveRoute }
    : DEFAULT_PAGE_MOVEMENT;
}

/** 뷰의 발자국 사각. 1x1 이면 그 칸 자신이다. */
function viewRect(view: RuntimeEventView): FootprintRect {
  return footprintBounds(view.x, view.y, view.footprint);
}

/**
 * 사각과 겹치는 이벤트를 찾는다 — 이 파일의 히트테스트 원본.
 * 점 질의(findRuntimeEventAtInMap 등)는 전부 여기에 1x1 사각으로 위임한다.
 */
export function findEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  let found: RuntimeEventView | undefined;
  forEachRuntimeEventView(project, map, session, positions, (event) => {
    if (!rectsOverlap(viewRect(event), rect)) return false;
    if (!matchesTrigger(event.trigger.kind, triggerKind)) return false;
    found = event;
    return true;
  });
  return found;
}

/**
 * 이벤트 배열 형태. map 을 안 받아 runtimeEventViewsForMap 을 못 쓰므로
 * 사각 질의 원본에 위임하지 못하고 자기 .find 조건만 발자국으로 바꾼다.
 */
export function findRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(viewRect(event), rect) && matchesTrigger(event.trigger.kind, triggerKind));
}

/** 사각과 겹치면서 통행을 막는 이벤트. excludeEventId 는 자기 자신(움직이는 NPC)을 뺀다. */
export function findBlockingEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect,
  excludeEventId?: string
): RuntimeEventView | undefined {
  let found: RuntimeEventView | undefined;
  forEachRuntimeEventView(project, map, session, positions, (event) => {
    if (!rectsOverlap(viewRect(event), rect)) return false;
    if (event.event.id === excludeEventId) return false;
    if (event.priority !== "same" || !event.overlapForbidden) return false;
    found = event;
    return true;
  });
  return found;
}

export function findRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  return findEventOverlappingRect(project, map, session, positions, pointRect(x, y), triggerKind);
}

export function findBlockingRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(viewRect(event), rect) && event.priority === "same" && event.overlapForbidden);
}

export function findBlockingRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return findBlockingEventOverlappingRect(project, map, session, positions, pointRect(x, y));
}

export function eventBlocksPlayerAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): boolean {
  return findBlockingRuntimeEventAt(events, session, positions, x, y) !== undefined;
}

function matchesTrigger(
  actual: Trigger["kind"],
  expected: Trigger["kind"] | readonly Trigger["kind"][]
): boolean {
  if (typeof expected === "string") return actual === expected;
  return expected.includes(actual);
}
