import type { MutableBattler } from "@/battle/battleBattlers";

export type ReadyBattler =
  | { readonly kind: "actor"; readonly battler: MutableBattler; readonly timeMs: number }
  | { readonly kind: "enemy"; readonly battler: MutableBattler; readonly timeMs: number };

export function nextReadyBattler(
  actors: readonly MutableBattler[],
  enemies: readonly MutableBattler[],
  deltaMs: number
): ReadyBattler | undefined {
  const readyActors = actors.filter((entry) => entry.hp > 0).map((battler) => readyActor(battler));
  const readyEnemies = enemies.filter((entry) => entry.hp > 0).map((battler) => readyEnemy(battler));
  const ordered = [...readyActors, ...readyEnemies].sort((left, right) => {
    const delta = left.timeMs - right.timeMs;
    if (delta !== 0) return delta;
    if (left.kind === right.kind) return 0;
    return left.kind === "actor" ? -1 : 1;
  });
  const first = ordered[0];
  return first && first.timeMs <= deltaMs ? first : undefined;
}

export function chargeBattlers(
  actors: readonly MutableBattler[],
  enemies: readonly MutableBattler[],
  deltaMs: number
): void {
  for (const actor of actors) charge(actor, deltaMs);
  for (const enemy of enemies) charge(enemy, deltaMs);
}

function readyActor(battler: MutableBattler): ReadyBattler {
  return { kind: "actor", battler, timeMs: timeToReady(battler) };
}

function readyEnemy(battler: MutableBattler): ReadyBattler {
  return { kind: "enemy", battler, timeMs: timeToReady(battler) };
}

function timeToReady(battler: MutableBattler): number {
  return Math.max(0, (100 - battler.gauge) / battler.chargeRate);
}

function charge(battler: MutableBattler, deltaMs: number): void {
  if (battler.hp <= 0) return;
  battler.gauge = Math.min(100, battler.gauge + battler.chargeRate * deltaMs);
}
