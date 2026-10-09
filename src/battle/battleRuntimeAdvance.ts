import type { BattleRuntime } from "@/battle/types";

const DEFAULT_TICK_MS = 1_000;
const DEFAULT_MAX_TICKS = 8;

export function advanceBattleRuntime(runtime: BattleRuntime): void {
  for (let ticks = 0; ticks < DEFAULT_MAX_TICKS; ticks += 1) {
    const snapshot = runtime.snapshot();
    if (snapshot.result || snapshot.phase !== "charging") return;
    runtime.tick(DEFAULT_TICK_MS);
  }
}
