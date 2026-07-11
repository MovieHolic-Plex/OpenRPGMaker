import { canMove, inBounds } from "@/project/collision";
import { store } from "@/project/store";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import type { MoveCommand } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { AutonomousNpcSceneContext, MovementDelta } from "@/player/playSceneAutonomousTypes";
import { applySpriteAlpha } from "@/player/playSceneAutonomousSprites";
import type { NpcCommandTarget, NpcRouteCommandContext } from "@/player/playSceneAutonomousCommands";
import { runtimeEventViewsForMap } from "@/player/runtimeEventState";
import type { Project } from "@/project/types/project";

export type NpcMoveCollision = {
  readonly project: Project;
  readonly scene: AutonomousNpcSceneContext;
  readonly mover: AutonomousMover;
  /** Excluded from solid-event occupancy (the mover itself). */
  readonly eventId?: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
};

/** Player occupancy for character collision: current tile, plus mid-move destination. */
export function isPlayerOccupyingTile(
  scene: Pick<AutonomousNpcSceneContext, "tileX" | "tileY"> &
    Partial<Pick<AutonomousNpcSceneContext, "moving" | "movingTo">>,
  x: number,
  y: number
): boolean {
  if (scene.tileX === x && scene.tileY === y) return true;
  if (scene.moving === true && scene.movingTo && scene.movingTo.x === x && scene.movingTo.y === y) return true;
  return false;
}

export function canNpcMove(
  request: NpcMoveCollision,
  movement: MovementDelta
): boolean {
  if (movement.jump || request.mover.through) return inBounds(request.scene.map, request.to.x, request.to.y);
  // RM2K3 same-as-characters: player and solid events occupy tiles and block non-through movers.
  if (isCharacterBlockedTile(request, request.to.x, request.to.y)) return false;
  if (movement.x !== 0 && movement.y !== 0) {
    const hx = request.from.x + movement.x;
    const vy = request.from.y + movement.y;
    const horizontalOpen =
      canMove(request.project, request.scene.map, request.from.x, request.from.y, hx, request.from.y) &&
      canMove(request.project, request.scene.map, hx, request.from.y, request.to.x, request.to.y) &&
      !isCharacterBlockedTile(request, hx, request.from.y);
    const verticalOpen =
      canMove(request.project, request.scene.map, request.from.x, request.from.y, request.from.x, vy) &&
      canMove(request.project, request.scene.map, request.from.x, vy, request.to.x, request.to.y) &&
      !isCharacterBlockedTile(request, request.from.x, vy);
    return horizontalOpen || verticalOpen;
  }
  return canMove(
    request.project,
    request.scene.map,
    request.from.x,
    request.from.y,
    request.to.x,
    request.to.y
  );
}

function isCharacterBlockedTile(request: NpcMoveCollision, x: number, y: number): boolean {
  if (isPlayerOccupyingTile(request.scene, x, y)) return true;
  return runtimeEventViewsForMap(
    request.project,
    request.scene.map,
    request.scene.session,
    request.scene.eventPositions
  ).some(
    (view) =>
      view.x === x &&
      view.y === y &&
      view.event.id !== request.eventId &&
      view.priority === "same" &&
      view.overlapForbidden
  );
}

export function applyNpcTransfer(
  routeContext: NpcRouteCommandContext,
  target: NpcCommandTarget,
  command: Extract<MoveCommand, { kind: "npcTransfer" }>
): void {
  const project = store.getCurrent();
  const targetMap = project.maps[command.mapId];
  if (!targetMap) {
    console.warn(`[player] npcTransfer target map missing: ${command.mapId}`);
    return;
  }
  const destination = nearestPassableTile(project, targetMap, command.x, command.y);
  routeContext.scene.session.eventLocations ??= {};
  routeContext.scene.session.eventLocations[routeContext.eventId] = {
    mapId: command.mapId,
    x: destination.x,
    y: destination.y,
    direction: command.direction ?? target.mover.facing,
  };
  delete routeContext.scene.eventPositions[routeContext.eventId];
  routeContext.scene.autonomousNPCs.delete(routeContext.eventId);
  applySpriteAlpha(target.sprite, 0);
  routeContext.scene.refreshRuntimeSurfaces?.();
  routeContext.scene.syncRuntimeState?.();
}
