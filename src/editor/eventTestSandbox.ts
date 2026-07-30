import { isPassable } from "@/project/collision";
import { eventWithoutDraft, projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";

export type EventTestSpawn = {
  readonly x: number;
  readonly y: number;
  readonly usedFallback: boolean;
  readonly diagnostic?: string;
};

export type EventTestPreparation = {
  readonly project: Project;
  readonly event: GameEvent;
  readonly mapId: MapId;
  readonly eventId: string;
  readonly spawn: EventTestSpawn;
};

/**
 * Builds a canonical in-memory project and injects only the selected event's
 * current working body. Other open drafts remain at their Apply/OK baselines.
 */
export function buildEventTestSandboxProject(
  liveProject: Project,
  mapId: MapId,
  eventId: string,
): Project | null {
  const working = liveProject.maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!working) return null;
  const sandbox = projectWithoutEventDrafts(liveProject);
  const map = sandbox.maps[mapId];
  if (!map) return null;
  const event = eventWithoutDraft(working);
  const index = map.events.findIndex((entry) => entry.id === eventId);
  if (index >= 0) map.events[index] = event;
  else map.events.push(event);
  return sandbox;
}

export function prepareEventTest(
  liveProject: Project,
  mapId: MapId,
  eventId: string,
): EventTestPreparation | null {
  const project = buildEventTestSandboxProject(liveProject, mapId, eventId);
  const map = project?.maps[mapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!project || !map || !event) return null;
  return {
    project,
    event,
    mapId,
    eventId,
    spawn: selectEventTestSpawn(project, map, event),
  };
}

/**
 * Down/left/right/up is the stable adjacent preference. If every adjacent cell
 * is blocked, expand in deterministic Chebyshev rings. A fully blocked map gets
 * an explicit last-resort event-cell spawn plus a diagnostic instead of a
 * silent, misleading success.
 */
export function selectEventTestSpawn(
  project: Project,
  map: GameMap,
  event: Pick<GameEvent, "id" | "x" | "y">,
): EventTestSpawn {
  const occupied = new Set(
    map.events
      .filter((entry) => entry.id !== event.id)
      .map((entry) => cellKey(entry.x, entry.y)),
  );
  const usable = (x: number, y: number): boolean =>
    x >= 0
    && y >= 0
    && x < map.width
    && y < map.height
    && !occupied.has(cellKey(x, y))
    && isPassable(project, map, x, y);

  const adjacent = [
    { x: event.x, y: event.y + 1 },
    { x: event.x - 1, y: event.y },
    { x: event.x + 1, y: event.y },
    { x: event.x, y: event.y - 1 },
  ];
  for (const cell of adjacent) {
    if (usable(cell.x, cell.y)) return { ...cell, usedFallback: false };
  }

  const maxRadius = Math.max(map.width, map.height);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = event.x + dx;
        const y = event.y + dy;
        if (!usable(x, y)) continue;
        return {
          x,
          y,
          usedFallback: true,
          diagnostic: `이벤트 옆에 통행 가능하고 비어 있는 칸이 없어 가장 가까운 (${x}, ${y})에서 시작합니다.`,
        };
      }
    }
  }

  const x = Math.max(0, Math.min(map.width - 1, event.x));
  const y = Math.max(0, Math.min(map.height - 1, event.y));
  return {
    x,
    y,
    usedFallback: true,
    diagnostic: `맵에 통행 가능하고 비어 있는 시작 칸이 없습니다. 마지막 수단으로 이벤트 위치 (${x}, ${y})에서 시작하므로 이동이 제한될 수 있습니다.`,
  };
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
