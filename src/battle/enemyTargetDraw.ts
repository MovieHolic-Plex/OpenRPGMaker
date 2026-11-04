import type { Rng } from "@/util/rng";

/** 기대 피해가 있는 후보가 받는 최소 몫(ultrabrain 스웜 R2 판정). */
export const DAMAGE_TARGET_MIN_SHARE = 0.15;

export interface DamageTargetCandidate {
  /** pickBestByUtility 가 쓰는 같은 점수(기대 피해 + 막타 1000 + 잃은 HP%×20). */
  readonly score: number;
  readonly expected: number;
  readonly hp: number;
}

/**
 * 적의 피해 대상 인덱스(-1 = 점수 전부 0, 호출부가 argmax). argmax 는 방어 최저 아군만 때렸다(fs2 스웜 R2).
 * 후보 하나·막타는 rng 없이 고르고, 나머지는 점수² 비례 + 기대 피해 있는 후보 최소 15%. targetRate 는 안 쓴다.
 */
export function drawDamageTargetIndex(candidates: readonly DamageTargetCandidate[], rng: Rng): number {
  if (candidates.length <= 1) return candidates.length - 1;
  const lethal = candidates.map((c, i) => [c, i] as const).filter(([c]) => c.expected >= c.hp && c.expected > 0);
  if (lethal.length > 0) return lethal.reduce((best, cur) => (cur[0].score > best[0].score ? cur : best))[1];
  const weights = candidates.map((c) => Math.max(0, c.score) ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return -1;
  const hitCount = candidates.filter((c) => c.expected > 0).length;
  const floor = hitCount > 0 ? Math.min(DAMAGE_TARGET_MIN_SHARE, 1 / hitCount) : 0;
  const shares = weights.map((w, i) => (candidates[i]!.expected > 0 ? Math.max(w / total, floor) : w / total));
  const sum = shares.reduce((acc, s) => acc + s, 0);
  let roll = rng() * sum;
  for (let i = 0; i < shares.length; i += 1) {
    roll -= shares[i]!;
    if (roll < 0) return i;
  }
  return shares.length - 1;
}
