import { canMove, inBounds } from "@/project/collision";
import { store } from "@/project/store";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import type { MoveCommand } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { AutonomousNpcSceneContext, MovementDelta } from "@/player/playSceneAutonomousTypes";
import { applySpriteAlpha } from "@/player/playSceneAutonomousSprites";
import type { NpcCommandTarget, NpcRouteCommandContext } from "@/player/playSceneAutonomousCommands";
import type { Project } from "@/project/types/project";

export type NpcMoveCollision = {
  readonly project: Project;
  readonly scene: AutonomousNpcSceneContext;
  readonly mover: AutonomousMover;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
};

export function canNpcMove(
  request: NpcMoveCollision,
  movement: MovementDelta
): boolean {
  if (movement.jump || request.mover.through) return inBounds(request.scene.map, request.to.x, request.to.y);
  if (movement.x !== 0 && movement.y !== 0) {
    const hx = request.from.x + movement.x;
    const vy = request.from.y + movement.y;
    return (
      (canMove(request.project, request.scene.map, request.from.x, request.from.y, hx, request.from.y) &&
        canMove(request.project, request.scene.map, hx, request.from.y, request.to.x, request.to.y)) ||
      (canMove(request.project, request.scene.map, request.from.x, request.from.y, request.from.x, vy) &&
        canMove(request.project, request.scene.map, request.from.x, vy, request.to.x, request.to.y))
    );
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
