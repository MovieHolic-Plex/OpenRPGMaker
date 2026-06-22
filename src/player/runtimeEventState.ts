import { resolveEventPage } from "@/project/io";
import type { AssetRef, EventPage, EventPriority, GameEvent, Trigger } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

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
  const position = positions[event.id] ?? { x: event.x, y: event.y };
  return {
    event,
    page,
    pageId: page?.id,
    x: position.x,
    y: position.y,
    trigger: page?.trigger ?? event.trigger,
    priority: page?.priority ?? "same",
    overlapForbidden: page?.overlapForbidden ?? true,
    sprite: page?.graphic.sprite ?? event.sprite,
  };
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
