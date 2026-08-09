import { resolveEventPage } from "@/project/io";
import type {
  AssetRef,
  Dir,
  EventAnimationType,
  EventPage,
  EventPageMovement,
  EventPriority,
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
    transparent,
    animationType: page?.animationType ?? "normal",
    movement: page?.movement ?? legacyMovement(event),
    sprite: transparent ? undefined : page?.graphic.sprite ?? event.sprite,
    direction: runtimeDirection ?? page?.graphic.direction,
    runtimeDirection,
  };
}

export function runtimeEventViewsForMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions
): RuntimeEventView[] {
  const views: RuntimeEventView[] = [];
  const included = new Set<string>();
  const erased = new Set(session.erasedEventIds ?? []);
  const removedOnCurrentMap = removedEventSet(session, map.id);
  for (const event of map.events) {
    if (erased.has(event.id)) continue;
    if (removedOnCurrentMap.has(event.id)) continue;
    const location = session.eventLocations?.[event.id];
    if (location && location.mapId !== map.id) continue;
    views.push(runtimeEventView(event, session, positions));
    included.add(event.id);
  }
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    const removedOnSourceMap = removedEventSet(session, sourceMap.id);
    for (const event of sourceMap.events) {
      if (included.has(event.id)) continue;
      if (erased.has(event.id)) continue;
      if (removedOnSourceMap.has(event.id)) continue;
      if (session.eventLocations?.[event.id]?.mapId !== map.id) continue;
      views.push(runtimeEventView(event, session, positions));
      included.add(event.id);
    }
  }
  for (const [spawnedEventId, spawn] of Object.entries(session.spawnedEvents ?? {})) {
    if (included.has(spawnedEventId)) continue;
    if (spawn.mapId !== map.id) continue;
    const event = materializeSpawnedEvent(project, spawnedEventId, spawn);
    if (!event) continue;
    views.push(runtimeEventView(event, session, positions));
    included.add(spawnedEventId);
  }
  return views;
}

function removedEventSet(session: PlaySessionLike, mapId: string): ReadonlySet<string> {
  return new Set(session.removedEventIds?.[mapId] ?? []);
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

export function findRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => event.x === x && event.y === y && matchesTrigger(event.trigger.kind, triggerKind));
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
  return runtimeEventViewsForMap(project, map, session, positions)
    .find((event) => event.x === x && event.y === y && matchesTrigger(event.trigger.kind, triggerKind));
}

export function findBlockingRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => event.x === x && event.y === y && event.priority === "same" && event.overlapForbidden);
}

export function findBlockingRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return runtimeEventViewsForMap(project, map, session, positions)
    .find((event) => event.x === x && event.y === y && event.priority === "same" && event.overlapForbidden);
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
