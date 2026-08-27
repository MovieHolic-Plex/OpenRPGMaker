import type { EventAnimationType, EventPageMovement, MoveCommand } from "@/project/types";
import { store } from "@/project/store";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { routeForLivingMovement } from "@/player/npcLivingTravel";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState"

type PageMoveRouteSceneContext = Pick<
  PlaySceneContext,
  | "map"
  | "session"
  | "eventPositions"
  | "pageMoveRouteKeys"
  | "pageMoveRouteEventIds"
  | "autonomousNPCs"
  | "registerAutonomousMover"
> & Partial<Pick<PlaySceneContext, "commandMoveRouteEventIds">>;

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
    if (scene.commandMoveRouteEventIds?.has(view.event.id)) continue;
    const movement = view.movement;
    const route = routeForPageMovement(movement) ?? routeForLivingMovement({ project, map: scene.map, session: scene.session, view });
    if (!route) continue;
    const key = "key" in route ? route.key : `${view.event.id}:${view.pageId ?? "legacy"}`;
    activeKeys.add(key);
    activePageRouteEventIds.add(view.event.id);
    if (
      scene.pageMoveRouteKeys.has(key)
      && scene.pageMoveRouteEventIds.has(view.event.id)
      && scene.autonomousNPCs.has(view.event.id)
    ) {
      const mover = scene.autonomousNPCs.get(view.event.id);
      // 기존 무버는 속도/빈도만 재설정하고 facing 은 보존한다. refreshRuntimeSurfaces
      // 가 이벤트 조사 직후에도 호출되는데, 여기서 facing 을 기본 방향으로 되돌리면
      // turnActionEventTowardPlayer 가 플레이어 쪽으로 돌려놓은 방향이 즉시 취소된다
      // (= "말을 걸어도 NPC 가 쳐다보지 않는" 버그).
      if (mover) configurePageMover(mover, movement, route.strategy, view.animationType);
      continue;
    }
    removePageRouteForEvent(scene, view.event.id);
    scene.pageMoveRouteKeys.add(key);
    scene.pageMoveRouteEventIds.add(view.event.id);
    scene.registerAutonomousMover(view.event.id, route.moves, route.repeat);
    const mover = scene.autonomousNPCs.get(view.event.id);
    if (mover) {
      // 신규 무버만 페이지 그래픽의 초기 방향으로 세팅한다.
      mover.facing = view.page?.graphic.direction ?? "down";
      configurePageMover(mover, movement, route.strategy, view.animationType);
    }
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
    case "chase":
      return { moves: [], repeat: true, strategy: "chase" };
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
  animationType: EventAnimationType
): void {
  mover.strategy = strategy;
  mover.directionFix = animationType === "fixedDirection" || animationType === "fixedDirectionStep";
  mover.speedRank = clampSetting(movement.speed);
  mover.frequencyRank = clampSetting(movement.frequency);
  mover.moveDurationMs = npcMoveDurationMs(movement.speed);
  mover.moveIntervalMs = movement.moveIntervalMs !== undefined
    ? Math.max(80, Math.min(10000, Math.round(movement.moveIntervalMs)))
    : npcMoveIntervalMs(movement.frequency);
  mover.sightRange = normalizeOptionalRange(movement.sightRange);
  mover.giveUpRange = normalizeOptionalRange(movement.giveUpRange);
  mover.pathfind = movement.pathfind !== false;
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

function normalizeOptionalRange(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}
