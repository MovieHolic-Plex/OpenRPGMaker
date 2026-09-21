import { fallHop, jumpHop } from "@/player/characterHop";
import { mapTileSize } from "@/project/tileGeometry";
import type { Dir } from "@/player/input";
import { npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { MoveCommand } from "@/project/types";
import type {
  AutonomousNpcSceneContext,
  AutonomousNpcSprite,
  MovementDelta,
} from "@/player/playSceneAutonomousTypes";
import { applySpriteAlpha, setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { RuntimeEventView } from "@/project/runtimeEventState"
import { applyNpcTransfer } from "@/player/playSceneAutonomousMapActions";
import {
  facingForDelta,
  playerRelativeDirection,
  randomDirection,
  randomMoveIndex,
  relativeTurn,
} from "@/player/playSceneAutonomousRouteDirection";
import {
  applyMoveRouteGraphicChange,
  clampRouteOpacity,
  clampRouteRank,
  playMoveRouteSound,
} from "@/player/playSceneAutonomousRouteEffects";
import { nextSessionRandom } from "@/project/session";

const DEFAULT_JUMP_DISTANCE = 2;

export type NpcRouteCommandContext = {
  readonly scene: AutonomousNpcSceneContext;
  readonly eventId: string;
  readonly mover: AutonomousMover;
};

export type NpcCommandTarget = {
  readonly mover: AutonomousMover;
  readonly view: RuntimeEventView;
  readonly baseFrame: number;
  readonly sprite: AutonomousNpcSprite | undefined;
};

export function nextMoveCommand(mover: AutonomousMover): MoveCommand {
  if (mover.strategy === "approach") return { kind: "moveTowardPlayer" };
  if (mover.strategy === "random") return mover.moves[randomMoveIndex(mover.moves.length, () => 0)] ?? { kind: "wait" };
  return mover.moves[mover.step % mover.moves.length] ?? { kind: "wait" };
}

export function nextMoveCommandForScene(scene: AutonomousNpcSceneContext, mover: AutonomousMover): MoveCommand {
  if (mover.strategy === "approach") return { kind: "moveTowardPlayer" };
  if (mover.strategy === "random") {
    return mover.moves[randomMoveIndex(mover.moves.length, () => nextSessionRandom(scene.session, "movement"))] ?? { kind: "wait" };
  }
  return nextMoveCommand(mover);
}

export function movementDeltaForCommand(
  context: NpcRouteCommandContext,
  command: MoveCommand
): MovementDelta | null {
  switch (command.kind) {
    case "move":
      return { ...commandDelta(command.dir), face: command.dir };
    case "moveDiagonal": {
      const x = command.horizontal === "right" ? 1 : -1;
      const y = command.vertical === "down" ? 1 : -1;
      return { x, y, face: command.horizontal };
    }
    case "moveRandom": {
      const dir = randomDirection(() => nextSessionRandom(context.scene.session, "movement"));
      return { ...commandDelta(dir), face: dir };
    }
    case "moveTowardPlayer":
      return playerRelativeMove(context, true);
    case "moveAwayFromPlayer":
      return playerRelativeMove(context, false);
    case "stepForward":
      return { ...commandDelta(context.mover.facing), face: context.mover.facing };
    case "jump": {
      const delta = jumpDelta(context.mover, command);
      return {
        ...delta,
        face: facingForDelta(delta.x, delta.y, context.mover.facing),
        jump: true,
        hop: jumpHop(command),
      };
    }
    case "dropIn":
      // 타일 이동이 없다(dx=dy=0) — 보간은 제자리고 리프트만 H→0 으로 내려온다.
      return { x: 0, y: 0, face: context.mover.facing, jump: true, hop: fallHop(command) };
    case "land":
    case "turn":
    case "turnRelative":
    case "turnRandom":
    case "turnTowardPlayer":
    case "turnAwayFromPlayer":
    case "setDirectionFix":
    case "setThrough":
    case "setAnimation":
    case "changeOpacity":
    case "setSwitch":
    case "changeSpeed":
    case "changeFrequency":
    case "changeGraphic":
    case "npcTransfer":
    case "playSe":
    case "wait":
      return null;
    default:
      return assertNever(command);
  }
}

export function executeInstantCommand(
  routeContext: NpcRouteCommandContext,
  target: NpcCommandTarget,
  command: MoveCommand
): boolean {
  switch (command.kind) {
    case "wait":
      return true;
    case "land":
      setNpcIdleFrame(
        target.sprite,
        target.baseFrame,
        target.mover.facing,
        target.view.animationType,
        target.mover.animationEnabled
      );
      return true;
    case "turn":
      turnNpc(target, command.dir);
      return true;
    case "turnRelative":
      turnNpc(target, relativeTurn(target.mover.facing, command.turn, () => nextSessionRandom(routeContext.scene.session, "movement")));
      return true;
    case "turnRandom":
      turnNpc(target, randomDirection(() => nextSessionRandom(routeContext.scene.session, "movement")));
      return true;
    case "turnTowardPlayer": {
      const dir = playerRelativeDirection(routeContext.scene, routeContext.eventId, true);
      if (dir) turnNpc(target, dir);
      return true;
    }
    case "turnAwayFromPlayer": {
      const dir = playerRelativeDirection(routeContext.scene, routeContext.eventId, false);
      if (dir) turnNpc(target, dir);
      return true;
    }
    case "setDirectionFix":
      target.mover.directionFix = command.enabled;
      return true;
    case "setThrough":
      target.mover.through = command.enabled;
      return true;
    case "setAnimation":
      target.mover.animationEnabled = command.enabled;
      return true;
    case "changeOpacity":
      target.mover.opacity = clampRouteOpacity(target.mover.opacity + command.delta);
      applySpriteAlpha(target.sprite, target.mover.opacity);
      return true;
    case "setSwitch":
      applyRouteSwitch(routeContext.scene, command);
      return true;
    case "changeSpeed":
      target.mover.speedRank = clampRouteRank(target.mover.speedRank + command.delta);
      target.mover.moveDurationMs = npcMoveDurationMs(target.mover.speedRank);
      return true;
    case "changeFrequency":
      target.mover.frequencyRank = clampRouteRank(target.mover.frequencyRank + command.delta);
      target.mover.moveIntervalMs = npcMoveIntervalMs(target.mover.frequencyRank);
      return true;
    case "changeGraphic":
      applyMoveRouteGraphicChange(command.spriteId, target.view, target.sprite, mapTileSize(routeContext.scene.map));
      return true;
    case "npcTransfer":
      applyNpcTransfer(routeContext, target, command);
      return true;
    case "playSe":
      playMoveRouteSound(routeContext.scene, command.resourceId);
      return true;
    case "move":
    case "moveDiagonal":
    case "moveRandom":
    case "moveTowardPlayer":
    case "moveAwayFromPlayer":
    case "stepForward":
    case "jump":
    case "dropIn":
      return false;
    default:
      return assertNever(command);
  }
}

export function applyFacing(mover: AutonomousMover, dir: Dir): Dir {
  if (!mover.directionFix) mover.facing = dir;
  return mover.facing;
}

function applyRouteSwitch(scene: AutonomousNpcSceneContext, command: Extract<MoveCommand, { kind: "setSwitch" }>): void {
  const switchId = command.switchId.trim();
  if (switchId.length === 0) return;
  scene.session.switches[switchId] = command.value;
  scene.refreshRuntimeSurfaces?.();
}

function playerRelativeMove(context: NpcRouteCommandContext, towardPlayer: boolean): MovementDelta | null {
  const dir = playerRelativeDirection(context.scene, context.eventId, towardPlayer);
  return dir ? { ...commandDelta(dir), face: dir } : null;
}

function turnNpc(target: NpcCommandTarget, dir: Dir): void {
  const frameDir = applyFacing(target.mover, dir);
  setNpcIdleFrame(
    target.sprite,
    target.baseFrame,
    frameDir,
    target.view.animationType,
    target.mover.animationEnabled
  );
}

function jumpDelta(
  mover: AutonomousMover,
  command: Extract<MoveCommand, { kind: "jump" }>
): { readonly x: number; readonly y: number } {
  if (command.dx !== 0 || command.dy !== 0) return { x: command.dx, y: command.dy };
  const delta = commandDelta(mover.facing);
  return { x: delta.x * DEFAULT_JUMP_DISTANCE, y: delta.y * DEFAULT_JUMP_DISTANCE };
}

function commandDelta(dir: "left" | "right" | "up" | "down"): { x: number; y: number } {
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

function assertNever(value: never): never {
  throw new Error(`Unhandled move route command: ${JSON.stringify(value)}`);
}
