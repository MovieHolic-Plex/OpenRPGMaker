import { mulberry32, type Rng } from "@/util/rng";

export const DEFAULT_NATURALNESS = 0.5;
export const NATURALNESS_GUIDANCE =
  "naturalness(자연도) 기본 0.5. 사용자가 '정갈/반듯'을 원하면 0~0.2, '야생/자연/구불구불'을 원하면 0.8 이상을 쓰세요.";

const DEFAULT_SEED = 1;

export function naturalnessArg(args: Record<string, unknown>): number {
  const value = args.naturalness;
  return typeof value === "number" && Number.isFinite(value) ? clamp01(value) : DEFAULT_NATURALNESS;
}

export function naturalnessLabel(value: number): string {
  return clamp01(value).toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

export function rngForTool(args: Record<string, unknown>, signature: string): Rng {
  return mulberry32(seedForTool(args, signature));
}

export function seedForTool(args: Record<string, unknown>, signature: string): number {
  const explicit = args.seed;
  return typeof explicit === "number" && Number.isInteger(explicit) ? normalizeSeed(explicit) : fnv1a(signature);
}

export function jitterMaxOffset(naturalness: number): number {
  return Math.min(2, Math.max(0, Math.round(clamp01(naturalness) * 2)));
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return normalizeSeed(hash);
}
