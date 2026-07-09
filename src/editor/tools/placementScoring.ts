import type { GameMap, TileGroupMetadata } from "@/project/types";

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type SoftPenaltyInput = {
  readonly group: TileGroupMetadata;
  readonly candidate: Rect;
  readonly placed: readonly Rect[];
  readonly map: GameMap;
};

export function placementSoftPenalty(input: SoftPenaltyInput): number {
  let penalty = 0;
  for (const rule of input.group.rules ?? []) {
    if (rule.strength === "hard") continue;
    const weighted = rulePenalty(rule.kind, rule.params, input.candidate, input.placed) * strengthWeight(rule.strength);
    penalty += weighted;
  }
  return penalty;
}

function rulePenalty(
  kind: NonNullable<TileGroupMetadata["rules"]>[number]["kind"],
  params: Record<string, unknown>,
  candidate: Rect,
  placed: readonly Rect[]
): number {
  switch (kind) {
    case "adjacency":
      return 0;
    case "spacing":
      return spacingPenalty(params, candidate, placed);
    case "count":
      return countPenalty(params, placed);
    default:
      return assertNever(kind);
  }
}

function spacingPenalty(params: Record<string, unknown>, candidate: Rect, placed: readonly Rect[]): number {
  const minGap = integerParam(params.minGap);
  if (minGap === null || minGap < 1) return 0;
  return placed.reduce((total, rect) => total + Math.max(0, minGap - manhattanGap(candidate, rect)), 0);
}

function countPenalty(params: Record<string, unknown>, placed: readonly Rect[]): number {
  const max = integerParam(params.max);
  if (max === null) return 0;
  return Math.max(0, placed.length + 1 - max);
}

function manhattanGap(a: Rect, b: Rect): number {
  return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

function strengthWeight(strength: "medium" | "soft"): number {
  switch (strength) {
    case "medium":
      return 2;
    case "soft":
      return 1;
    default:
      return assertNever(strength);
  }
}

function integerParam(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 배치 규칙입니다: ${String(value)}`);
}
