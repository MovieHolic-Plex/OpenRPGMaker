import type { BattleAnimationRecord } from "@/project/types";

export const BATTLE_ANIMATION_FRAME_MS = 120;
export const DEFAULT_BATTLE_ANIMATION_DURATION_MS = 360;

export function battleAnimationDurationMs(record: BattleAnimationRecord | undefined): number {
  const frameCount = Math.max(0, record?.frames?.length ?? 0);
  if (frameCount === 0) return DEFAULT_BATTLE_ANIMATION_DURATION_MS;
  return Math.max(BATTLE_ANIMATION_FRAME_MS, frameCount * BATTLE_ANIMATION_FRAME_MS);
}
