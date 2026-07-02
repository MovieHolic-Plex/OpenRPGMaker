import type { EventPageMovement, MoveCommand } from "@/project/types";
import { store } from "@/project/store";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { routeForLivingMovement } from "@/player/npcLivingTravel";
import { runtimeEventViewsForMap } from "@/player/runtimeEventState";

type PageMoveRouteSceneContext = Pick<
  PlaySceneContext,
  | "map"
  | "session"
  | "eventPositions"
  | "pageMoveRouteKeys"
  | "pageMoveRouteEventIds"
  | "autonomousNPCs"
  | "registerAutonomousMover"
>;

const DIRECTIONAL_MOVES: MoveCommand[] = [
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "move", dir: "up" },
];

export function registerPageMoveRoutes(scene: PageMoveRouteSceneContext): void {
  const activeKeys = new Set<string>();
  const activePageRouteEventIds = new Set<string>();
  const project = store.getCurrent();
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    const movement = view.movement;
    const route = routeForPageMovement(movement) ?? routeForLivingMovement({ project, map: scene.map, session: scene.session, view });
    if (!route) continue;
    const key = "key" in route ? route.key : `${view.event.id}:${view.pageId ?? "legacy"}`;
    activeKeys.add(key);
    activePageRouteEventIds.add(view.event.id);
    if (scene.pageMoveRouteKeys.has(key) && scene.pageMoveRouteEventIds.has(view.event.id)) {
      const mover = scene.autonomousNPCs.get(view.event.id);
      if (mover) configurePageMover(mover, movement, route.strategy, view.page?.graphic.direction ?? "down");
      continue;
    }
    removePageRouteForEvent(scene, view.event.id);
    scene.pageMoveRouteKeys.add(key);
    scene.pageMoveRouteEventIds.add(view.event.id);
    scene.registerAutonomousMover(view.event.id, route.moves, route.repeat);
    const mover = scene.autonomousNPCs.get(view.event.id);
    if (mover) configurePageMover(mover, movement, route.strategy, view.page?.graphic.direction ?? "down");
  }
  for (const eventId of [...scene.pageMoveRouteEventIds]) {
    if (!activePageRouteEventIds.has(eventId)) removePageRouteForEvent(scene, eventId);
  }
  for (const key of [...scene.pageMoveRouteKeys]) {
    if (!activeKeys.has(key)) scene.pageMoveRouteKeys.delete(key);
  }
}

export function npcMoveDurationMs(speed: number): number {
  const rank = clampSetting(speed);
  return Math.max(80, 640 - rank * 80);
}

export function npcMoveIntervalMs(frequency: number): number {
  const rank = clampSetting(frequency);
  return Math.max(80, 1040 - rank * 160);
}

function routeForPageMovement(
  movement: EventPageMovement
): (Pick<AutonomousMover, "moves" | "repeat" | "strategy">) | null {
  switch (movement.type) {
    case "fixed":
      return null;
    case "random":
      return { moves: [...DIRECTIONAL_MOVES], repeat: true, strategy: "random" };
    case "approach":
      return { moves: [...DIRECTIONAL_MOVES], repeat: true, strategy: "approach" };
    case "custom":
      return movement.route
        ? { moves: [...movement.route.moves], repeat: movement.route.repeat, strategy: "sequence" }
        : null;
    case "living":
      return null;
  }
}

function configurePageMover(
  mover: AutonomousMover,
  movement: EventPageMovement,
  strategy: AutonomousMover["strategy"],
  facing: AutonomousMover["facing"]
): void {
  mover.strategy = strategy;
  mover.facing = facing;
  mover.speedRank = clampSetting(movement.speed);
  mover.frequencyRank = clampSetting(movement.frequency);
  mover.moveDurationMs = npcMoveDurationMs(movement.speed);
  mover.moveIntervalMs = npcMoveIntervalMs(movement.frequency);
}

function removePageRouteForEvent(scene: PageMoveRouteSceneContext, eventId: string): void {
  if (scene.pageMoveRouteEventIds.delete(eventId)) scene.autonomousNPCs.delete(eventId);
  for (const key of [...scene.pageMoveRouteKeys]) {
    if (key.startsWith(`${eventId}:`)) scene.pageMoveRouteKeys.delete(key);
  }
}

function clampSetting(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}
