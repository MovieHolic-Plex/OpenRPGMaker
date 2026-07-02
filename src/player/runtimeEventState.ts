import { resolveEventPage } from "@/project/io";
import type {
  AssetRef,
  EventAnimationType,
  EventPage,
  EventPageMovement,
  EventPriority,
  GameMap,
  GameEvent,
  Project,
  Trigger,
} from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

const DEFAULT_PAGE_MOVEMENT: EventPageMovement = {
  type: "fixed",
  speed: 3,
  frequency: 3,
};

export interface RuntimeEventPosition {
  readonly x: number;
  readonly y: number;
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
  y: number
): void {
  positions[eventId] = { x, y };
}

export function runtimeEventView(
  event: GameEvent,
  session: PlaySessionLike,
  positions: RuntimeEventPositions
): RuntimeEventView {
  const page = resolveEventPage(event, session);
  const location = session.eventLocations?.[event.id];
  const position = location ? { x: location.x, y: location.y } : positions[event.id] ?? { x: event.x, y: event.y };
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
  for (const event of map.events) {
    const location = session.eventLocations?.[event.id];
    if (location && location.mapId !== map.id) continue;
    views.push(runtimeEventView(event, session, positions));
    included.add(event.id);
  }
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    for (const event of sourceMap.events) {
      if (included.has(event.id)) continue;
      if (session.eventLocations?.[event.id]?.mapId !== map.id) continue;
      views.push(runtimeEventView(event, session, positions));
      included.add(event.id);
    }
  }
  return views;
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
