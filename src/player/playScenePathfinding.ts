import { store } from "@/project/store";
import { passageBounds, rectsOverlap } from "@/project/footprint";
import { resolvePlayerBody, playerPassageRect } from "@/project/playerFootprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { runtimeEventViewsForMap, runtimeEventViewById } from "@/project/runtimeEventState";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { findChasePath } from "@/player/chaseAi";
import { startPlayerRoute } from "@/player/playerRouteState";
import { npcMoveDurationMs } from "@/player/playScenePageMoveRoutes";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { MoveCommand } from "@/project/types";

type PathfindStep = Extract<StepResult, { kind: "pathfindMove" }>;

/** Plan against terrain, authored footprints, live solid events and spatial objects. */
export function planPathfindMove(scene: PlaySceneContext, step: PathfindStep, currentEventId?: string) {
  const project = store.getCurrent();
  const target = step.target === "player" || step.target === PLAYER_MOVE_TARGET ? PLAYER_MOVE_TARGET
    : !step.target || step.target === "this-event" ? currentEventId ?? "" : step.target;
  const player = target === PLAYER_MOVE_TARGET;
  const view = player ? undefined : runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, target);
  if (!player && !view) return null;
  const from = player ? { x: scene.tileX, y: scene.tileY } : { x: view!.x, y: view!.y };
  const body = player ? resolvePlayerBody(project, scene.session) : { footprint: view!.footprint, passRows: view!.passRows };
  const blockers = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
    .filter(v => v.event.id !== target && v.priority === "same" && v.overlapForbidden);
  const playerBody = resolvePlayerBody(project, scene.session);
  const path = findChasePath(project, scene.map, from, step, body, point => {
    const rect = passageBounds(point.x, point.y, body.footprint, body.passRows);
    if (isSpatialPlacementBlocking(project, scene.session, scene.map.id, rect)) return false;
    if (blockers.some(v => rectsOverlap(rect, v.passRect))) return false;
    if (!player && rectsOverlap(rect, playerPassageRect(playerBody, scene.tileX, scene.tileY))) return false;
    if (!player && scene.moving && rectsOverlap(rect, playerPassageRect(playerBody, scene.movingTo.x, scene.movingTo.y))) return false;
    return true;
  });
  let previous = from;
  const moves: MoveCommand[] = path.map(point => {
    const dir = point.x > previous.x ? "right" : point.x < previous.x ? "left" : point.y > previous.y ? "down" : "up";
    previous = point;
    return { kind: "move", dir };
  });
  return { target, player, from, moves };
}

/** Uses real route tweens; never writes the requested destination into the session. */
export async function playPathfindMove(scene: PlaySceneContext, step: PathfindStep, currentEventId?: string, signal?: AbortSignal): Promise<void> {
  const plan = planPathfindMove(scene, step, currentEventId);
  const session = scene.session;
  const map = scene.map;
  session.flags.pathfindSucceeded = false;
  if (!plan || (!plan.moves.length && (plan.from.x !== step.x || plan.from.y !== step.y))) {
    console.warn(`[player] pathfind destination unreachable: ${step.target} (${step.x}, ${step.y})`);
    return;
  }
  if (!plan.moves.length) { session.flags.pathfindSucceeded = true; return; }
  if (plan.player) {
    startPlayerRoute(scene, plan.moves, false);
    scene.playerRoute!.stopOnBlocked = true;
    scene.playerRoute!.moveDurationMs = npcMoveDurationMs(step.speed);
  } else {
    scene.registerAutonomousMover(plan.target, plan.moves, false);
    const mover = scene.autonomousNPCs.get(plan.target);
    if (!mover) return;
    mover.stopOnBlocked = true;
    mover.moveDurationMs = npcMoveDurationMs(step.speed);
    mover.moveIntervalMs = 0;
    scene.commandMoveRouteEventIds.add(plan.target);
  }
  const route = plan.player ? scene.playerRoute : scene.autonomousNPCs.get(plan.target);
  const ownsRoute = () => (plan.player ? scene.playerRoute : scene.autonomousNPCs.get(plan.target)) === route;
  await new Promise<void>(resolve => {
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); signal?.removeEventListener("abort", cancel); scene.events?.off("shutdown", cancel); resolve(); };
    const cancel = () => {
      if (ownsRoute()) {
        if (plan.player) scene.playerRoute = null;
        else { scene.autonomousNPCs.delete(plan.target); scene.commandMoveRouteEventIds.delete(plan.target); }
      }
      finish();
    };
    const check = () => {
      if (signal?.aborted || scene.session !== session || scene.map !== map) { cancel(); return; }
      if (!ownsRoute()) {
        const position = plan.player ? { x: scene.tileX, y: scene.tileY }
          : runtimeEventViewById(store.getCurrent(), map, session, scene.eventPositions, plan.target);
        session.flags.pathfindSucceeded = position?.x === step.x && position?.y === step.y;
        finish();
        return;
      }
      frame = requestAnimationFrame(check);
    };
    signal?.addEventListener("abort", cancel, { once: true });
    scene.events?.once("shutdown", cancel);
    check();
  });
}
