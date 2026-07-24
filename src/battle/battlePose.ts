import type { BattleActionResultSnapshot, BattleBattlerSnapshot } from "@/battle/types";

/** Side-view presentation poses driven by the latest resolve beat. */
export type BattleBattlerPose = "idle" | "attack" | "hit" | "defend" | "dead";

/**
 * Resolve which pose a battler should show after the latest action result.
 * Pure helper so unit tests and DOM can share one source of truth.
 */
export function resolveBattlerPose(input: {
  readonly battler: Pick<BattleBattlerSnapshot, "id" | "recordId" | "defeated" | "defending">;
  readonly lastActionResult?: BattleActionResultSnapshot;
  readonly showActionPose?: boolean;
}): BattleBattlerPose {
  if (input.battler.defeated) return "dead";
  const result = input.lastActionResult;
  const showAction = input.showActionPose !== false;
  // SC10 (M5): healing actions (amount < 0) are not attacks — the caster should
  // not show "attack" and the target should not show "hit".
  const isHeal = result && result.amount < 0;
  if (showAction && result && !isHeal) {
    if (result.userRecordId === input.battler.recordId || result.userRecordId === input.battler.id) {
      return "attack";
    }
    if (result.targetId === input.battler.id && result.hit) {
      return "hit";
    }
  }
  if (input.battler.defending) return "defend";
  return "idle";
}

/** True when the last action should flash hit-feel juice (popup/shake/SFX). */
export function hitFeelFromActionResult(
  result: BattleActionResultSnapshot | undefined
): { readonly targetId: string; readonly amount: number; readonly critical: boolean; readonly healing: boolean } | undefined {
  if (!result?.hit || !result.targetId) return undefined;
  if (result.amount === 0) return undefined;
  return {
    targetId: result.targetId,
    amount: Math.abs(result.amount),
    critical: Boolean(result.critical),
    healing: result.amount < 0,
  };
}
