import type { MutableBattler } from "@/battle/battleBattlers";

export type BattlerRateMultiplier = (battler: MutableBattler) => number;

export type ReadyBattler =
  | { readonly kind: "actor"; readonly battler: MutableBattler; readonly timeMs: number }
  | { readonly kind: "enemy"; readonly battler: MutableBattler; readonly timeMs: number };

export function nextReadyBattler(
  actors: readonly MutableBattler[],
  enemies: readonly MutableBattler[],
  deltaMs: number,
  hasteMultiplier = 1,
  battlerMultiplier: BattlerRateMultiplier = () => 1
): ReadyBattler | undefined {
  // 배율 0 은 스톱(게이지 정지)이다 — 게이지가 차 있어도 차례가 오지 않는다.
  const live = (entry: MutableBattler): boolean => entry.hp > 0 && battlerMultiplier(entry) > 0;
  const readyActors = actors.filter(live).map((battler) => readyActor(battler, hasteMultiplier * battlerMultiplier(battler)));
  const readyEnemies = enemies.filter(live).map((battler) => readyEnemy(battler, hasteMultiplier * battlerMultiplier(battler)));
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
  deltaMs: number,
  hasteMultiplier = 1,
  battlerMultiplier: BattlerRateMultiplier = () => 1
): void {
  for (const actor of actors) charge(actor, deltaMs, hasteMultiplier * battlerMultiplier(actor));
  for (const enemy of enemies) charge(enemy, deltaMs, hasteMultiplier * battlerMultiplier(enemy));
}

function readyActor(battler: MutableBattler, hasteMultiplier = 1): ReadyBattler {
  return { kind: "actor", battler, timeMs: timeToReady(battler, hasteMultiplier) };
}

function readyEnemy(battler: MutableBattler, hasteMultiplier = 1): ReadyBattler {
  return { kind: "enemy", battler, timeMs: timeToReady(battler, hasteMultiplier) };
}

function timeToReady(battler: MutableBattler, hasteMultiplier = 1): number {
  return Math.max(0, (100 - battler.gauge) / Math.max(0.001, battler.chargeRate * hasteMultiplier));
}

function charge(battler: MutableBattler, deltaMs: number, hasteMultiplier = 1): void {
  if (battler.hp <= 0) return;
  void hasteMultiplier;
  battler.gauge = Math.min(100, battler.gauge + battler.chargeRate * deltaMs * hasteMultiplier);
}

export function effectiveChargeRate(battler: MutableBattler): number {
  return battler.chargeRate;
}

export function msToReady(battler: MutableBattler): number {
  return Math.max(0, (100 - battler.gauge) / Math.max(0.001, battler.chargeRate));
}
