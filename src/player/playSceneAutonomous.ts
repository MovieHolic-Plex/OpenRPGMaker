import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import type { AutonomousMover } from "@/player/playSceneTypes";
import {
  applyFacing,
  executeInstantCommand,
  movementDeltaForCommand,
  nextMoveCommandForScene,
} from "@/player/playSceneAutonomousCommands";
import { canNpcMove } from "@/player/playSceneAutonomousMapActions";
import { applySpriteAlpha, setNpcIdleFrame, setNpcWalkFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSceneContext } from "@/player/playSceneAutonomousTypes";
import {
  moveRuntimeEventPosition,
  runtimeEventView,
  runtimeEventViewsForMap,
} from "@/player/runtimeEventState";

export function updateAutonomousNPCs(scene: AutonomousNpcSceneContext, deltaMs: number): void {
  const project = store.getCurrent();
  for (const [eventId, mover] of scene.autonomousNPCs) {
    if (mover.activeMove) {
      updateActiveNpcMove({ scene, eventId, mover }, deltaMs);
      continue;
    }
    if (mover.moves.length === 0) {
      if (scene.commandMoveRouteEventIds?.delete(eventId)) scene.autonomousNPCs.delete(eventId);
      continue;
    }
    mover.timer += Math.max(0, deltaMs);
    if (mover.timer < mover.moveIntervalMs) continue;
    mover.timer = 0;
    const view = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
      .find((entry) => entry.event.id === eventId);
    if (!view) {
      completeRouteCommand(mover);
      continue;
    }
    const command = nextMoveCommandForScene(scene, mover);
    mover.step += 1;
    const baseFrame = view.page?.graphic.pattern ?? 0;
    const sprite = scene.eventSprites.get(eventId);
    const routeContext = { scene, eventId, mover };
    const commandTarget = { mover, view, baseFrame, sprite };
    if (executeInstantCommand(routeContext, commandTarget, command)) {
      completeRouteCommand(mover);
      continue;
    }

    const movement = movementDeltaForCommand(routeContext, command);
    if (!movement) {
      completeRouteCommand(mover);
      continue;
    }
    const position = { x: view.x, y: view.y };
    const nx = position.x + movement.x;
    const ny = position.y + movement.y;
    const frameDir = applyFacing(mover, movement.face);
    if (!movement.jump && nx === scene.tileX && ny === scene.tileY && !mover.through) {
      fireEventTouch(scene, eventId, view.trigger.kind);
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      completeRouteCommand(mover);
      continue;
    }
    if (canNpcMove({ project, scene, mover, from: position, to: { x: nx, y: ny } }, movement)) {
      moveAutonomousRuntimePosition(scene, eventId, nx, ny, frameDir);
      mover.activeMove = { fromX: position.x, fromY: position.y, toX: nx, toY: ny, dir: frameDir, baseFrame, elapsedMs: 0 };
      if (sprite) {
        sprite.setPosition(characterSpriteX(position.x), characterSpriteY(position.y));
        updateCharacterDepth(sprite, view.priority);
        applySpriteAlpha(sprite, mover.opacity);
        setNpcWalkFrame(sprite, baseFrame, frameDir, 0, view.animationType, mover.animationEnabled);
      }
      scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions));
    } else {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    }
    completeRouteCommand(mover);
  }
}

function moveAutonomousRuntimePosition(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  x: number,
  y: number,
  direction: AutonomousMover["facing"]
): void {
  const location = scene.session.eventLocations?.[eventId];
  if (location?.mapId === scene.map.id) {
    scene.session.eventLocations[eventId] = { ...location, x, y, direction };
    return;
  }
  moveRuntimeEventPosition(scene.eventPositions, eventId, x, y, direction);
}

function fireEventTouch(scene: AutonomousNpcSceneContext, eventId: string, triggerKind: string): void {
  if (triggerKind === "eventTouch") void scene.runEvent(eventId);
}

type ActiveNpcMoveTarget = {
  readonly scene: AutonomousNpcSceneContext;
  readonly eventId: string;
  readonly mover: AutonomousMover;
};

function updateActiveNpcMove(target: ActiveNpcMoveTarget, deltaMs: number): void {
  const { scene, eventId, mover } = target;
  const move = mover.activeMove;
  if (!move) return;
  move.elapsedMs = Math.min(mover.moveDurationMs, move.elapsedMs + Math.max(0, deltaMs));
  const progress = move.elapsedMs / mover.moveDurationMs;
  const sprite = scene.eventSprites.get(eventId);
  const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .find((entry) => entry.event.id === eventId);
  const animationType = view?.animationType ?? "normal";
  const priority = view?.priority ?? "same";
  if (sprite) {
    sprite.setPosition(
      characterSpriteX(lerp(move.fromX, move.toX, progress)),
      characterSpriteY(lerp(move.fromY, move.toY, progress))
    );
    updateCharacterDepth(sprite, priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcWalkFrame(sprite, move.baseFrame, move.dir, move.elapsedMs, animationType, mover.animationEnabled);
  }
  if (move.elapsedMs < mover.moveDurationMs) return;
  if (sprite) {
    sprite.setPosition(characterSpriteX(move.toX), characterSpriteY(move.toY));
    updateCharacterDepth(sprite, priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcIdleFrame(sprite, move.baseFrame, move.dir, animationType, mover.animationEnabled);
  }
  mover.activeMove = null;
  mover.timer = 0;
  scene.syncRuntimeState?.();
}

function completeRouteCommand(mover: AutonomousMover): void {
  if (!mover.repeat && mover.step >= mover.moves.length) mover.moves = [];
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
