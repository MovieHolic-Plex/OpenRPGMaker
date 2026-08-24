import type { BattleAnimationRecord } from "@/project/types";
import { generatedEffectFrameDurationMs } from "@/assets/generatedEffectSheets";

export const BATTLE_ANIMATION_FRAME_MS = 120;
export const DEFAULT_BATTLE_ANIMATION_DURATION_MS = 360;

export function battleAnimationFrameDurationMs(record: BattleAnimationRecord | undefined): number {
  return generatedEffectFrameDurationMs(record?.resourceId) ?? BATTLE_ANIMATION_FRAME_MS;
}

export function battleAnimationDurationMs(record: BattleAnimationRecord | undefined): number {
  const frameCount = Math.max(0, record?.frames?.length ?? 0);
  if (frameCount === 0) return DEFAULT_BATTLE_ANIMATION_DURATION_MS;
  const frameDurationMs = battleAnimationFrameDurationMs(record);
  return Math.max(frameDurationMs, frameCount * frameDurationMs);
}
