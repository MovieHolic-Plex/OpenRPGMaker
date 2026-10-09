import type { AutonomousMover } from "@/player/playSceneTypes";

export interface RuntimeMoverSnapshot {
  readonly step: number;
  readonly moveCount: number;
  readonly remainingMoveCount: number;
  readonly repeat: boolean;
  readonly strategy: AutonomousMover["strategy"];
  readonly facing: AutonomousMover["facing"];
  readonly directionFix: boolean;
  readonly through: boolean;
  readonly animationEnabled: boolean;
  readonly opacity: number;
  readonly speedRank: number;
  readonly frequencyRank: number;
  readonly moveIntervalMs: number;
  readonly moveDurationMs: number;
  readonly activeMove: {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
    readonly dir: AutonomousMover["facing"];
  } | null;
}

export function runtimeMoverSnapshots(
  movers: ReadonlyMap<string, AutonomousMover>
): Record<string, RuntimeMoverSnapshot> {
  const snapshots: Record<string, RuntimeMoverSnapshot> = {};
  for (const [eventId, mover] of movers) {
    snapshots[eventId] = {
      step: mover.step,
      moveCount: mover.moves.length,
      remainingMoveCount: Math.max(0, mover.moves.length - mover.step),
      repeat: mover.repeat,
      strategy: mover.strategy,
      facing: mover.facing,
      directionFix: mover.directionFix,
      through: mover.through,
      animationEnabled: mover.animationEnabled,
      opacity: mover.opacity,
      speedRank: mover.speedRank,
      frequencyRank: mover.frequencyRank,
      moveIntervalMs: mover.moveIntervalMs,
      moveDurationMs: mover.moveDurationMs,
      activeMove: mover.activeMove
        ? {
            fromX: mover.activeMove.fromX,
            fromY: mover.activeMove.fromY,
            toX: mover.activeMove.toX,
            toY: mover.activeMove.toY,
            dir: mover.activeMove.dir,
          }
        : null,
    };
  }
  return snapshots;
}
