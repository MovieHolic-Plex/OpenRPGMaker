// benchmark/interior/scoringSets.ts
// 집합형 답변("어떤 타일이 X인가") 채점 스킴 S1..S4.
//
// 한 숫자로는 모델이 왜 틀렸는지 알 수 없어서 네 가지를 함께 낸다:
//   S1 setF1       정확히 맞췄는가
//   S2 semantic    같은 계열을 골랐는가(부분점수)
//   S3 trapPenalty 그럴듯한 오답을 걸러냈는가
//   S4 rolePurity  고른 것들이 애초에 같은 종류이긴 한가
// 예: 벽돌벽을 대량으로 고른 모델은 S1 이 낮고 S4 는 높다 — "벽은 알지만 정본
// 문법은 모른다"는 진단이 두 숫자의 조합에서 나온다.

import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import type {
  InteriorCategoryTruth,
  SchemeScore,
  SchemeWeights,
  ScoredAnswer,
  ScoringSchemeId,
  TileSetAnswer,
} from "./types";

const ROLE_BY_INDEX: ReadonlyMap<number, string> = new Map(
  INTERIOR_TILE_SEMANTICS.map((entry) => [entry.index, entry.role]),
);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function scheme(id: ScoringSchemeId, rawScore: number, detail: Record<string, number>): SchemeScore {
  return Object.freeze({
    scheme: id,
    score: clamp01(rawScore),
    rawScore: Number.isFinite(rawScore) ? rawScore : 0,
    detail: Object.freeze({ ...detail }),
  });
}

/** S1 — canonical 기준 정밀도/재현율/F1. */
function setF1(picked: readonly number[], truth: InteriorCategoryTruth): SchemeScore {
  let truePositives = 0;
  for (const id of picked) if (truth.canonical.has(id)) truePositives += 1;
  const falsePositives = picked.length - truePositives;
  const falseNegatives = truth.canonical.size - truePositives;
  const precision = picked.length === 0 ? 0 : truePositives / picked.length;
  const recall = truth.canonical.size === 0 ? 0 : truePositives / truth.canonical.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return scheme("setF1", f1, { truePositives, falsePositives, falseNegatives, precision, recall });
}

/**
 * S2 — 부분점수. canonical 1.0 · generous 0.5 · 그 외 0.
 * 분모를 max(정답 크기, 답변 길이)로 두어, 답을 길게 늘여 적중 수를 늘리는
 * 전략이 점수를 올리지 못하게 한다.
 */
function semantic(picked: readonly number[], truth: InteriorCategoryTruth): SchemeScore {
  let exactHits = 0;
  let generousHits = 0;
  for (const id of picked) {
    if (truth.canonical.has(id)) exactHits += 1;
    else if (truth.generous.has(id)) generousHits += 1;
  }
  const misses = picked.length - exactHits - generousHits;
  const denominator = Math.max(truth.canonical.size, picked.length);
  const value = denominator === 0 ? 0 : (exactHits + 0.5 * generousHits) / denominator;
  return scheme("semantic", value, { exactHits, generousHits, misses, denominator });
}

/**
 * S3 — 함정 감점. canonical 재현율에서 밟은 함정 비율을 뺀다.
 * rawScore 는 음수가 될 수 있고(함정만 잔뜩 고른 경우) score 는 0..1 로 자른다.
 */
function trapPenalty(picked: readonly number[], truth: InteriorCategoryTruth): SchemeScore {
  let hits = 0;
  let trapHits = 0;
  for (const id of picked) {
    if (truth.canonical.has(id)) hits += 1;
    if (truth.traps.has(id)) trapHits += 1;
  }
  const recall = truth.canonical.size === 0 ? 0 : hits / truth.canonical.size;
  const penalty = trapHits / Math.max(1, truth.traps.size);
  return scheme("trapPenalty", recall - penalty, { trapHits, trapTotal: truth.traps.size, recall });
}

/**
 * S4 — 역할 순도. 정답 멤버들의 다수 역할을 기준으로, 고른 타일 중 그 역할을
 * 가진 비율. 정답을 하나도 못 맞춰도 "같은 종류를 고르고는 있다"를 잡아낸다.
 */
function rolePurity(picked: readonly number[], truth: InteriorCategoryTruth): SchemeScore {
  const counts = new Map<string, number>();
  for (const id of truth.canonical) {
    const role = ROLE_BY_INDEX.get(id);
    if (role) counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  let majorityRole = "";
  let best = -1;
  // 동점은 역할 이름 사전순으로 깨서 결정적으로 만든다.
  for (const role of [...counts.keys()].sort()) {
    const count = counts.get(role)!;
    if (count > best) {
      best = count;
      majorityRole = role;
    }
  }
  let roleMatches = 0;
  for (const id of picked) if (ROLE_BY_INDEX.get(id) === majorityRole) roleMatches += 1;
  const value = picked.length === 0 ? 0 : roleMatches / picked.length;
  return scheme("rolePurity", value, { roleMatches, picked: picked.length });
}

const SET_SCHEME_IMPLS: Readonly<
  Record<string, (picked: readonly number[], truth: InteriorCategoryTruth) => SchemeScore>
> = Object.freeze({ setF1, semantic, trapPenalty, rolePurity });

export function scoreTileSetAnswer(input: {
  readonly answer: TileSetAnswer;
  readonly truth: InteriorCategoryTruth;
  readonly schemes: readonly ScoringSchemeId[];
  readonly weights: SchemeWeights;
}): ScoredAnswer {
  const picked = input.answer.tileIds;
  const schemes: SchemeScore[] = [];
  for (const id of input.schemes) {
    const impl = SET_SCHEME_IMPLS[id];
    if (!impl) {
      throw new Error(`interior scoringSets: 집합형 답변에 쓸 수 없는 스킴 "${id}"`);
    }
    schemes.push(impl(picked, input.truth));
  }
  return Object.freeze({ schemes: Object.freeze(schemes), composite: weightedMean(schemes, input.weights) });
}

/** 요청된 스킴들의 가중 평균. 가중치 합이 0이면 0(0으로 나누지 않는다). */
export function weightedMean(schemes: readonly SchemeScore[], weights: SchemeWeights): number {
  let total = 0;
  let weightSum = 0;
  for (const entry of schemes) {
    const weight = weights[entry.scheme] ?? 0;
    total += entry.score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}
