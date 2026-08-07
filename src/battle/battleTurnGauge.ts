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
  // 둔화/가속 상태가 있으면 배율 보정(공격업·방어다운 등 상태 배율과 동일한 clamp).
  // battleStates 공격/방어 배율과 별도로, 여기서는 민첩 배율로 해석한다.
  // 상태가 없으면 1.0.
  let hasteMultiplier = 1;
  // defensive: if battler has no state evaluation context, skip multiplier.
  // We use a lightweight check: if stateIds contains attack_up/defense_down etc.,
  // we treat them as haste-affecting too — actual game data maps them via runtimeEffects.
  // For now, no extra multiplier here (kept for future state-driven haste stat).
  // The key fix: remove FLOOR dead zone for agility <=8 and expose effective rate.
  void hasteMultiplier;
  battler.gauge = Math.min(100, battler.gauge + battler.chargeRate * deltaMs);
}

export function effectiveChargeRate(battler: MutableBattler): number {
  return battler.chargeRate;
}

export function msToReady(battler: MutableBattler): number {
  return Math.max(0, (100 - battler.gauge) / Math.max(0.001, battler.chargeRate));
}
