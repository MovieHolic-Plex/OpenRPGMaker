import type { ActionChargeTier, SkillInputKey, SkillInputSequence } from "@/project/types";

/** 입력 커맨드 결과. 생략(자동전투·적·헤드리스)은 배율 1 — 입력 없는 기존 기술과 같다. */
export type SkillInputResult = "success" | "fail";

export const SKILL_INPUT_KEYS = ["up", "down", "left", "right", "confirm", "cancel"] as const satisfies readonly SkillInputKey[];
export const DEFAULT_INPUT_SUCCESS_MULTIPLIER = 1.5;
export const DEFAULT_INPUT_FAIL_MULTIPLIER = 0.5;
const MAX_INPUT_KEYS = 12;

export function isSkillInputKey(value: unknown): value is SkillInputKey {
  return typeof value === "string" && (SKILL_INPUT_KEYS as readonly string[]).includes(value);
}

export function normalizeSkillInputSequence(sequence: Partial<SkillInputSequence> | undefined): SkillInputSequence | undefined {
  if (!sequence || typeof sequence !== "object" || !Array.isArray(sequence.keys)) return undefined;
  const keys = sequence.keys.filter(isSkillInputKey).slice(0, MAX_INPUT_KEYS);
  if (keys.length === 0) return undefined;
  const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return {
    keys,
    timeLimitMs: Math.round(clamp(sequence.timeLimitMs, 300, 20000, 3000)),
    ...(sequence.successMultiplier !== undefined ? { successMultiplier: clamp(sequence.successMultiplier, 0, 10, DEFAULT_INPUT_SUCCESS_MULTIPLIER) } : {}),
    ...(sequence.failMultiplier !== undefined ? { failMultiplier: clamp(sequence.failMultiplier, 0, 10, DEFAULT_INPUT_FAIL_MULTIPLIER) } : {}),
  };
}

export function inputSequencePowerMultiplier(sequence: SkillInputSequence | undefined, result: SkillInputResult | undefined): number {
  if (!sequence || !result) return 1;
  return result === "success"
    ? sequence.successMultiplier ?? DEFAULT_INPUT_SUCCESS_MULTIPLIER
    : sequence.failMultiplier ?? DEFAULT_INPUT_FAIL_MULTIPLIER;
}

export type InputSequenceProgress = "pending" | SkillInputResult;

/**
 * 입력 판정기. startedAtMs 부터 timeLimitMs 안에 keys 를 순서대로 눌러야 성공이다.
 * 틀린 키 한 번이면 즉시 실패, 시간이 넘으면 다음 press/expire 에서 실패.
 */
export function createInputSequenceTracker(sequence: SkillInputSequence, startedAtMs: number) {
  let index = 0;
  let state: InputSequenceProgress = "pending";
  const deadline = startedAtMs + sequence.timeLimitMs;
  return {
    get index(): number { return index; },
    get state(): InputSequenceProgress { return state; },
    press(key: SkillInputKey, nowMs: number): InputSequenceProgress {
      if (state !== "pending") return state;
      if (nowMs > deadline) return (state = "fail");
      if (sequence.keys[index] !== key) return (state = "fail");
      index += 1;
      if (index >= sequence.keys.length) state = "success";
      return state;
    },
    expire(nowMs: number): InputSequenceProgress {
      if (state === "pending" && nowMs >= deadline) state = "fail";
      return state;
    },
  };
}

export function inputKeyLabel(key: SkillInputKey): string {
  switch (key) {
    case "up": return "↑";
    case "down": return "↓";
    case "left": return "←";
    case "right": return "→";
    case "confirm": return "Z";
    case "cancel": return "X";
  }
}

/** 홀드 차지 정규화: holdMs 오름차순, 중복 holdMs 는 뒤의 것. 최대 5단계. */
export function normalizeChargeTiers(tiers: readonly Partial<ActionChargeTier>[] | undefined): ActionChargeTier[] | undefined {
  if (!Array.isArray(tiers)) return undefined;
  const byHold = new Map<number, number>();
  for (const tier of tiers) {
    if (!tier || !Number.isFinite(tier.holdMs) || !Number.isFinite(tier.multiplier)) continue;
    byHold.set(Math.round(Math.max(50, Math.min(10000, tier.holdMs!))), Math.max(0.1, Math.min(10, tier.multiplier!)));
  }
  const out = [...byHold.entries()].sort((a, b) => a[0] - b[0]).slice(0, 5).map(([holdMs, multiplier]) => ({ holdMs, multiplier }));
  return out.length > 0 ? out : undefined;
}

/** 누른 시간이 넘은 가장 높은 단계의 배율. 어떤 단계에도 못 미치면 1. */
export function chargeTierMultiplier(tiers: readonly ActionChargeTier[] | undefined, heldMs: number): number {
  let multiplier = 1;
  for (const tier of tiers ?? []) if (heldMs >= tier.holdMs) multiplier = tier.multiplier;
  return multiplier;
}

/** 홀드 차지 진행 상태. heldMs 가 undefined 면 차지 중이 아니다. */
export interface SkillChargeState {
  heldMs?: number;
}

/**
 * 한 프레임 진행. 차지 중이고 키가 떼졌으면 그 시간의 배율을 돌려주고 상태를 비운다(= 발동).
 * 키가 아직 눌려 있으면 시간을 쌓고 undefined(발동 없음).
 */
export function advanceSkillCharge(state: SkillChargeState, tiers: readonly ActionChargeTier[] | undefined, deltaMs: number, held: boolean): number | undefined {
  if (state.heldMs === undefined) return undefined;
  if (held) {
    state.heldMs = Math.min(60_000, state.heldMs + Math.max(0, deltaMs));
    return undefined;
  }
  const multiplier = chargeTierMultiplier(tiers, state.heldMs);
  state.heldMs = undefined;
  return multiplier;
}
