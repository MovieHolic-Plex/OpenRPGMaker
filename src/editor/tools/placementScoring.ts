import { checkPlacementSurface, surfaceRuleFromClusterRule, type SurfaceProbe } from "@/project/placementSurface";
import type { ClusterRule, GameMap, TileGroupMetadata } from "@/project/types";

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type SoftPenaltyInput = {
  readonly group: TileGroupMetadata;
  readonly candidate: Rect;
  readonly placed: readonly Rect[];
  readonly map: GameMap;
  /**
   * 배치 면 채점용 벽·바닥 프로브. 없으면 surface 규칙은 0점으로 건너뛴다 —
   * 통행 플래그를 볼 수 없는 호출자(맵만 있고 프로젝트가 없는 경로)를 위한 하위 호환이다.
   */
  readonly probe?: SurfaceProbe;
};

export function placementSoftPenalty(input: SoftPenaltyInput): number {
  let penalty = 0;
  for (const rule of input.group.rules ?? []) {
    if (rule.strength === "hard") continue;
    const weighted = rulePenalty(rule, input.candidate, input.placed, input.probe) * strengthWeight(rule.strength);
    penalty += weighted;
  }
  return penalty;
}

/** surface 위반 1건의 기본 벌점 — 간격/개수 벌점(칸 수)과 같은 눈금으로 쓰려고 2로 둔다. */
const SURFACE_PENALTY = 2;

function rulePenalty(
  rule: ClusterRule,
  candidate: Rect,
  placed: readonly Rect[],
  probe: SurfaceProbe | undefined
): number {
  switch (rule.kind) {
    case "adjacency":
      return 0;
    case "spacing":
      return spacingPenalty(rule.params, candidate, placed);
    case "count":
      return countPenalty(rule.params, placed);
    case "surface":
      return surfacePenalty(rule, candidate, probe);
    default:
      return assertNever(rule.kind);
  }
}

function surfacePenalty(rule: ClusterRule, candidate: Rect, probe: SurfaceProbe | undefined): number {
  if (!probe) return 0;
  const surfaceRule = surfaceRuleFromClusterRule(rule);
  if (!surfaceRule) return 0;
  return checkPlacementSurface({ probe, rect: candidate, rule: surfaceRule }).ok ? 0 : SURFACE_PENALTY;
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
