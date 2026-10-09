import { runtimeEventViewById } from "@/project/runtimeEventState";
import { store } from "@/project/store";
import type { Dir } from "@/player/input";
import type { AutonomousNpcSceneContext } from "@/player/playSceneAutonomousTypes";
import type { MoveCommand } from "@/project/types";
import type { Rng } from "@/util/rng";

const DIRECTIONS: readonly Dir[] = ["up", "right", "down", "left"];

export function randomMoveIndex(length: number, rng: Rng): number {
  if (length <= 0) return 0;
  return Math.floor(rng() * length);
}

export function randomDirection(rng: Rng): Dir {
  return DIRECTIONS[randomMoveIndex(DIRECTIONS.length, rng)] ?? "down";
}

export function relativeTurn(dir: Dir, turn: Extract<MoveCommand, { kind: "turnRelative" }>["turn"], rng: Rng): Dir {
  const index = DIRECTIONS.indexOf(dir);
  const offset = relativeTurnOffset(turn, rng);
  return DIRECTIONS[(index + offset + DIRECTIONS.length) % DIRECTIONS.length] ?? dir;
}

export function playerRelativeDirection(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  towardPlayer: boolean
): Dir | null {
  const position = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, eventId);
  if (!position) return null;
  const dx = scene.tileX - position.x;
  const dy = scene.tileY - position.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return horizontalPlayerDirection(dx, towardPlayer);
  if (dy !== 0) return verticalPlayerDirection(dy, towardPlayer);
  return null;
}

export function facingForDelta(x: number, y: number, fallback: Dir): Dir {
  if (Math.abs(x) >= Math.abs(y) && x !== 0) return x > 0 ? "right" : "left";
  if (y !== 0) return y > 0 ? "down" : "up";
  return fallback;
}

function relativeTurnOffset(turn: Extract<MoveCommand, { kind: "turnRelative" }>["turn"], rng: Rng): number {
  switch (turn) {
    case "right90":
      return 1;
    case "left90":
      return -1;
    case "turn180":
      return 2;
    case "leftOrRight90":
      return rng() < 0.5 ? -1 : 1;
    default:
      return assertNever(turn);
  }
}

function horizontalPlayerDirection(dx: number, towardPlayer: boolean): Dir {
  if (towardPlayer) return dx > 0 ? "right" : "left";
  return dx > 0 ? "left" : "right";
}

function verticalPlayerDirection(dy: number, towardPlayer: boolean): Dir {
  if (towardPlayer) return dy > 0 ? "down" : "up";
  return dy > 0 ? "up" : "down";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled relative turn: ${String(value)}`);
}
