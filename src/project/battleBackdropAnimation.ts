import type { BattleBackdropAnimation } from "@/project/types";

/**
 * 트룹 backdropAnimation(움직이는 전투 배경)의 저작 범위와 정규화.
 * 모델 정규화(normalizeTroopRecord)·편집기 폼·런타임(battle/battleBackdrop.ts)이 같은 범위를 본다.
 */
export const BATTLE_BACKDROP_ANIMATION_LIMITS = {
  scrollX: { min: -400, max: 400 },
  scrollY: { min: -400, max: 400 },
  waveAmplitude: { min: 0, max: 24 },
  waveFrequency: { min: 0, max: 8 },
  paletteCycleSeconds: { min: 0, max: 60 },
} as const;

export type BattleBackdropAnimationKey = keyof typeof BATTLE_BACKDROP_ANIMATION_LIMITS;

function clampAnimationValue(key: BattleBackdropAnimationKey, value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const { min, max } = BATTLE_BACKDROP_ANIMATION_LIMITS[key];
  const clamped = Math.max(min, Math.min(max, Math.round(value * 100) / 100));
  return clamped === 0 ? undefined : clamped;
}

/** 0/무효 값은 떨구고, 남는 게 없으면 undefined(= 정지 배경, 옛 JSON 바이트 유지). */
export function normalizeBattleBackdropAnimation(value: unknown): BattleBackdropAnimation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const result: BattleBackdropAnimation = {};
  for (const key of Object.keys(BATTLE_BACKDROP_ANIMATION_LIMITS) as BattleBackdropAnimationKey[]) {
    const clamped = clampAnimationValue(key, raw[key]);
    if (clamped !== undefined) result[key] = clamped;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
