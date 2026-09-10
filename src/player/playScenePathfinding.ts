import { store } from "@/project/store";
import { inBounds } from "@/project/collision";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import { movementResultLogText, recordMovementResult } from "@/player/movementResult";
import type { MovementResult } from "@/project/eventCommands/coordinateDestination";
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
// The public result flag belongs to the latest request, including immediate no-ops.
const latestPathfind = new WeakMap<object, object>();

/**
 * OPRN-OUT-013: 목적지 해석의 결말. 계획을 세우기 **전에** 맵 밖·막힘을 갈라 두면
 * 저작자가 「경로가 없다」와 「그 칸 자체가 막혀 있다」를 구분해 분기할 수 있다.
 */
function classifyDestination(
  scene: PlaySceneContext,
  step: PathfindStep
): { readonly kind: "ok"; readonly x: number; readonly y: number } | { readonly kind: MovementResult } {
  const project = store.getCurrent();
  const map = scene.map;
  if (!inBounds(map, step.x, step.y)) {
    if (step.fallback !== "nearest") return { kind: "outOfBounds" };
    const clamped = nearestPassableTile(project, map, step.x, step.y);
    return { kind: "ok", x: clamped.x, y: clamped.y };
  }
  return { kind: "ok", x: step.x, y: step.y };
}

/** Plan against terrain, authored footprints, live solid events and spatial objects. */
export function planPathfindMove(scene: PlaySceneContext, step: PathfindStep, currentEventId?: string) {
  const project = store.getCurrent();
  const target = step.target === "player" || step.target === PLAYER_MOVE_TARGET ? PLAYER_MOVE_TARGET
    : !step.target || step.target === "this-event" ? currentEventId ?? "" : step.target;
  const player = target === PLAYER_MOVE_TARGET;
  const view = player ? undefined : runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, target);
  if (!player && !view) return null;
  // An admitted step still lands before the replacement route can start.
  const from = player ? (scene.moving ? { ...scene.movingTo } : { x: scene.tileX, y: scene.tileY }) : { x: view!.x, y: view!.y };
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

/**
 * Uses real route tweens; never writes the requested destination into the session.
 *
 * OPRN-OUT-013: 반환값은 이 명령 한 번의 결과다. 기존 호출부는 그대로 `void` 로
 * 버려도 동작이 같지만, 대기하는 명령은 이 값으로 「실패하면 중단」을 상한다.
 * 명령이 결과 변수/스위치를 지정했으면 거기에도 기록한다 — 전역 플래그와 달리
 * 변수/스위치는 명령별이므로 변렬 이벤트가 경쟁하지 않는다.
 */
export async function playPathfindMove(scene: PlaySceneContext, step: PathfindStep, currentEventId?: string, signal?: AbortSignal): Promise<MovementResult> {
  const session = scene.session;
  const map = scene.map;
  const request = {};
  latestPathfind.set(session, request);
  const settle = (result: MovementResult, detail?: string): MovementResult => {
    if (latestPathfind.get(session) === request) {
      session.flags.pathfindSucceeded = result === "arrived";
    }
    // 결과 변수·스위치는 이 명령의 것이므로 「가장 최신 요구」 게이트를 보지 않는다.
    recordMovementResult(session, step, result);
    if (result !== "arrived") {
      console.warn(`[player] pathfind ${step.target} (${step.x}, ${step.y}) — ${movementResultLogText(result, detail)}`);
    }
    return result;
  };
  session.flags.pathfindSucceeded = false;

  const destination = classifyDestination(scene, step);
  if (destination.kind !== "ok") return settle(destination.kind);
  const effective: PathfindStep = destination.x === step.x && destination.y === step.y
    ? step
    : { ...step, x: destination.x, y: destination.y };

  const plan = planPathfindMove(scene, effective, currentEventId);
  if (!plan) return settle("missingTarget", `대상 «${step.target}» 을 이 맵에서 모 못 찾았다`);
  if (!plan.moves.length && (plan.from.x !== effective.x || plan.from.y !== effective.y)) {
    // 칸 자체가 막힌 것과 경로가 없는 것은 저작자에게 다른 사습이다 — 구분해 보고한다.
    return settle(destinationBlocked(scene, plan, effective, currentEventId) ? "blocked" : "unreachable");
  }
  const previousMover = plan.player ? undefined : scene.autonomousNPCs.get(plan.target);
  const inFlight = plan.player ? scene.moving || !!scene.playerHop : !!previousMover?.activeMove;
  if (!plan.moves.length && !inFlight) {
    if (plan.player) scene.playerRoute = null;
    else { scene.autonomousNPCs.delete(plan.target); scene.commandMoveRouteEventIds.delete(plan.target); }
    return settle("arrived");
  }
  if (plan.player) {
    const activeDuration = scene.playerRoute?.moveDurationMs ?? scene.moveDurationMs;
    startPlayerRoute(scene, plan.moves, false);
    // An empty replacement still owns and waits for the already admitted step.
    scene.playerRoute ??= { moves: [], index: 0, repeat: false };
    scene.playerRoute!.stopOnBlocked = true;
    scene.playerRoute!.moveDurationMs = npcMoveDurationMs(effective.speed);
    if (scene.moving) {
      scene.playerRoute.nextMoveDurationMs = scene.playerRoute.moveDurationMs;
      scene.playerRoute.moveDurationMs = activeDuration;
    }
  } else {
    scene.registerAutonomousMover(plan.target, plan.moves, false);
    const mover = scene.autonomousNPCs.get(plan.target);
    if (!mover) return settle("missingTarget", "이동 루트 등록 직후 무버가 사라졌다");
    mover.stopOnBlocked = true;
    mover.moveDurationMs = npcMoveDurationMs(effective.speed);
    mover.moveIntervalMs = 0;
    if (previousMover?.activeMove) {
      mover.activeMove = { ...previousMover.activeMove, durationMs: previousMover.activeMove.durationMs ?? previousMover.moveDurationMs };
      mover.facing = previousMover.facing;
      mover.opacity = previousMover.opacity;
      mover.animationEnabled = previousMover.animationEnabled;
    }
    scene.commandMoveRouteEventIds.add(plan.target);
  }
  const route = plan.player ? scene.playerRoute : scene.autonomousNPCs.get(plan.target);
  const ownsRoute = () => (plan.player ? scene.playerRoute : scene.autonomousNPCs.get(plan.target)) === route;
  const outcome = await new Promise<MovementResult>(resolve => {
    let frame = 0;
    const finish = (result: MovementResult) => {
      cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", cancel);
      scene.events?.off("shutdown", cancel);
      resolve(result);
    };
    const cancel = () => {
      if (ownsRoute()) {
        if (plan.player) scene.playerRoute = null;
        else { scene.autonomousNPCs.delete(plan.target); scene.commandMoveRouteEventIds.delete(plan.target); }
      }
      finish("interrupted");
    };
    const check = () => {
      if (signal?.aborted || scene.session !== session || scene.map !== map) { cancel(); return; }
      if (!ownsRoute()) {
        // 루트가 남의 것이 됐다 = 끝났거나 다른 명령이 교체했다. 둘을 구분해야
        // 「내 명령이 도착했다」와 「내 명령이 쓸려나갔다」가 같은 결과가 되지 않는다.
        if (latestPathfind.get(session) !== request) { finish("interrupted"); return; }
        const position = plan.player ? { x: scene.tileX, y: scene.tileY }
          : runtimeEventViewById(store.getCurrent(), map, session, scene.eventPositions, plan.target);
        const arrived = position?.x === effective.x && position?.y === effective.y;
        finish(arrived ? "arrived" : "blocked");
        return;
      }
      frame = requestAnimationFrame(check);
    };
    signal?.addEventListener("abort", cancel, { once: true });
    scene.events?.once("shutdown", cancel);
    check();
  });
  return settle(outcome);
}

/**
 * 계획이 빈 이유가 「목적지 칸이 막혀서」인가. 계획기와 **같은** 진입 판정을 목적지
 * 한 칸에만 다시 적용한다 — 두 번째 통행 규칙을 만들지 않기 위해 planner 의 자산을 재사용한다.
 */
function destinationBlocked(
  scene: PlaySceneContext,
  plan: NonNullable<ReturnType<typeof planPathfindMove>>,
  step: PathfindStep,
  currentEventId: string | undefined
): boolean {
  // 목적지만 바꿔 다시 계획하는 대신, 목적지 바로 옆 칸에서 목적지로 들어가는
  // 계획을 시도한다. 그것조차 안 되면 칸 자체가 막힌 것이다.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const neighbor = { x: step.x + dx, y: step.y + dy };
    if (!inBounds(scene.map, neighbor.x, neighbor.y)) continue;
    const reachable = planPathfindMove(scene, { ...step, x: neighbor.x, y: neighbor.y }, currentEventId);
    if (!reachable) continue;
    const arrivesAtNeighbor = reachable.moves.length > 0
      || (plan.from.x === neighbor.x && plan.from.y === neighbor.y);
    if (arrivesAtNeighbor) return true;
  }
  return false;
}
