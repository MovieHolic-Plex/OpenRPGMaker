// 집 부지(lot) 주변 꾸밈 — LLM은 의도 태그만 고르고, 좌표·산포는 전부 여기(결정론).

import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { GameMap } from "@/project/types";

export type YardDecorKind =
  | "firewood"
  | "mailbox"
  | "pot"
  | "jar"
  | "bench_h"
  | "bench_v"
  | "flowers"
  | "fruit_box"
  | "wood_box"
  | "table_h"
  | "sign";
// chair / table-chairs 는 탁자 옆 배치 전용 — 마당 가방 산포에 넣지 않음(맵에 널브러짐 방지).

export const YARD_DECOR_KINDS: readonly YardDecorKind[] = [
  "firewood",
  "mailbox",
  "pot",
  "jar",
  "bench_h",
  "bench_v",
  "flowers",
  "fruit_box",
  "wood_box",
  "table_h",
  "sign",
] as const;

export type YardDecorPlan = {
  readonly kind: YardDecorKind;
  /** 해당 종류 몇 개(기본 1). */
  readonly count?: number;
};

export type HouseWing = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type YardArea = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** 의도 태그 → place_props propVocabId (그룹 id 또는 타일 숫자 문자열). */
export function propVocabIdForYardDecor(kind: YardDecorKind): string {
  switch (kind) {
    case "firewood":
      return "349";
    case "mailbox":
      return "350";
    case "pot":
      return "351";
    case "jar":
      return "352";
    case "bench_h":
      return `${COMBINED_TOWN_HARNESS_PREFIX}bench-horizontal`;
    case "bench_v":
      return `${COMBINED_TOWN_HARNESS_PREFIX}bench-vertical`;
    case "flowers":
      return `${COMBINED_TOWN_HARNESS_PREFIX}flower-props`;
    case "fruit_box":
      return `${COMBINED_TOWN_HARNESS_PREFIX}fruit-box`;
    case "wood_box":
      return `${COMBINED_TOWN_HARNESS_PREFIX}wood-box`;
    case "table_h":
      return `${COMBINED_TOWN_HARNESS_PREFIX}table-horizontal`;
    case "sign":
      return "320";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** 집 wings 합집합 bbox. */
export function houseBBox(wings: readonly HouseWing[]): YardArea {
  if (wings.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const wing of wings) {
    minX = Math.min(minX, wing.x);
    minY = Math.min(minY, wing.y);
    maxX = Math.max(maxX, wing.x + wing.w - 1);
    maxY = Math.max(maxY, wing.y + wing.h - 1);
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * 문 남쪽 앞마당 영역(결정론).
 * - 문 좌표가 있으면 문 남쪽 중심
 * - 없으면 집 bbox 남쪽 전체 폭
 * 맵 안으로 clamp.
 */
export function yardAreaForHouse(
  map: Pick<GameMap, "width" | "height">,
  wings: readonly HouseWing[],
  doorAt: { readonly x: number; readonly y: number } | null | undefined,
  opts: { readonly depth?: number; readonly pad?: number } = {},
): YardArea {
  const depth = Math.max(2, opts.depth ?? 3);
  const pad = Math.max(0, opts.pad ?? 1);
  const bbox = houseBBox(wings);

  let x: number;
  let w: number;
  let y: number;

  if (doorAt && Number.isInteger(doorAt.x) && Number.isInteger(doorAt.y)) {
    // 문 앞: 문 x 중심, 폭 = max(집폭, 6) with pad
    w = Math.max(6, bbox.w + pad * 2);
    x = doorAt.x - Math.floor(w / 2);
    y = doorAt.y + 1;
  } else {
    w = bbox.w + pad * 2;
    x = bbox.x - pad;
    y = bbox.y + bbox.h;
  }

  // clamp to map
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) y = 0;
  if (x + w > map.width) w = map.width - x;
  if (y + depth > map.height) {
    const h = map.height - y;
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  }
  return { x, y, w: Math.max(1, w), h: depth };
}

export function isYardDecorKind(value: unknown): value is YardDecorKind {
  return typeof value === "string" && (YARD_DECOR_KINDS as readonly string[]).includes(value);
}

/** 산포 파라미터 — 마당은 좁은 영역이므로 poisson + minGap 2. */
export function yardScatterParams(kind: YardDecorKind): { readonly minGap: number; readonly naturalness: number } {
  switch (kind) {
    case "bench_h":
    case "bench_v":
    case "table_h":
      return { minGap: 2, naturalness: 0.55 };
    case "flowers":
      return { minGap: 1, naturalness: 0.65 };
    default:
      return { minGap: 1, naturalness: 0.55 };
  }
}
