import {
  SPRITE_COLS,
  TILE_SIZE,
} from "@/assets/bundled";
import { canMove } from "@/project/collision";
import { store } from "@/project/store";
import type { Dir } from "@/player/input";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { DIRECTION_ROW } from "@/player/playSceneTypes";
import { findBlockingRuntimeEventAt, findRuntimeEventAt } from "@/player/runtimeEventState";

export function updatePlayScene(scene: PlaySceneContext, deltaMs: number): void {
  const input = scene.input_.update();
  if (!scene.moving && input.dir) tryStartMove(scene, input.dir);
  if (scene.moving) {
    updatePlayerMovement(scene, deltaMs);
  } else {
    scene.player.setFrame(DIRECTION_ROW[scene.facing] * SPRITE_COLS);
  }
  if (input.actionPressed && !scene.moving) handleAction(scene);
  scene.input_.resetEdges();
  scene.updateAutonomousNPCs(deltaMs);
  scene.updateParallelEvents(deltaMs);
  scene.updateTimers(deltaMs);
  scene.syncRuntimeState();
}

function updatePlayerMovement(scene: PlaySceneContext, deltaMs: number): void {
  scene.moveProgress += deltaMs / scene.moveDurationMs;
  if (scene.moveProgress >= 1) {
    scene.moveProgress = 1;
    scene.tileX = scene.movingTo.x;
    scene.tileY = scene.movingTo.y;
    scene.session.x = scene.tileX;
    scene.session.y = scene.tileY;
    scene.moving = false;
    fireTouchTriggers(scene);
  }
  const px = linear(scene.movingFrom.x, scene.movingTo.x, scene.moveProgress);
  const py = linear(scene.movingFrom.y, scene.movingTo.y, scene.moveProgress);
  scene.player.x = px * TILE_SIZE + TILE_SIZE / 2;
  scene.player.y = py * TILE_SIZE + TILE_SIZE / 2;
  scene.walkTimer += deltaMs;
  if (scene.walkTimer > 90) {
    scene.walkTimer = 0;
    scene.walkFrame = (scene.walkFrame + 1) % SPRITE_COLS;
  }
  scene.player.setFrame(DIRECTION_ROW[scene.facing] * SPRITE_COLS + scene.walkFrame);
}

function tryStartMove(scene: PlaySceneContext, dir: Dir): void {
  scene.facing = dir;
  const delta = directionDelta(dir);
  const nx = scene.tileX + delta.x;
  const ny = scene.tileY + delta.y;
  const project = store.getCurrent();
  if (!canMove(project, scene.map, scene.tileX, scene.tileY, nx, ny)) return;
  const blockingEvent = findBlockingRuntimeEventAt(scene.map.events, scene.session, scene.eventPositions, nx, ny);
  if (blockingEvent) {
    firePlayerTouchEvent(scene, blockingEvent.event.id, blockingEvent.trigger.kind);
    return;
  }
  scene.movingFrom = { x: scene.tileX, y: scene.tileY };
  scene.movingTo = { x: nx, y: ny };
  scene.moving = true;
  scene.moveProgress = 0;
  scene.lastActionTargetKey = "";
}

function handleAction(scene: PlaySceneContext): void {
  const delta = directionDelta(scene.facing);
  const tx = scene.tileX + delta.x;
  const ty = scene.tileY + delta.y;
  const key = `${tx},${ty}`;
  if (key === scene.lastActionTargetKey) return;
  scene.lastActionTargetKey = key;
  const event = findRuntimeEventAt(scene.map.events, scene.session, scene.eventPositions, tx, ty, "action");
  if (event) void scene.runEvent(event.event.id);
}

function fireTouchTriggers(scene: PlaySceneContext): void {
  const event = findRuntimeEventAt(
    scene.map.events,
    scene.session,
    scene.eventPositions,
    scene.tileX,
    scene.tileY,
    ["touch", "playerTouch"]
  );
  if (event) void scene.runEvent(event.event.id);
}

function firePlayerTouchEvent(scene: PlaySceneContext, eventId: string, triggerKind: string): void {
  if (triggerKind === "touch" || triggerKind === "playerTouch") void scene.runEvent(eventId);
}

function directionDelta(dir: Dir): { x: number; y: number } {
  switch (dir) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
  }
}

function linear(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
