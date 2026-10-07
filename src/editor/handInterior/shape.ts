// 손 도트 실내 평면의 모양 판정 — 바깥 출구 틈과 「ㅁ자 방 하나」.
// 평면 문자열에서도, 이미 지은 맵의 1층 타일에서도 같은 판정을 낸다(천장·공허 칸 = '#').
//
// 왜(2026-10-07 사용자 지적, 장르 프리셋 첫 제작): 대학 도서관 세미나실이 20×15 직사각형 하나(ㅁ자)로 지어졌고,
// 바깥으로 나가는 틈이 없이 동쪽 벽 안쪽 바닥에 보이지 않는 이동 칸만 있었다. 「외부로 나가는 길의 흔적이 없다」.
import { HAND_INTERIOR_SPEC, analyseHandInteriorPlan } from "./builder";
import type { GameMap } from "@/project/types";

export interface HandInteriorPoint { readonly x: number; readonly y: number }

export interface HandInteriorShape {
  readonly width: number;
  readonly height: number;
  /** 가장자리에 난 실내 칸 — 바깥으로 나가는 틈. 맨 아래 줄 틈이 정석이다. */
  readonly openings: readonly HandInteriorPoint[];
  /** 틈을 뺀 실내 칸이 직사각형 하나를 빈틈없이 채운다(칸막이·알코브·ㄱ/ㄷ자 없음). */
  readonly plainBox: boolean;
  /** 실내 칸 수(벽면 포함, 틈 제외). */
  readonly innerCells: number;
  isInner(x: number, y: number): boolean;
  /** 틈 바로 안쪽 칸 — 바깥에서 들어오면 여기 선다. 바닥이 아니면 null. */
  inwardOf(opening: HandInteriorPoint): { x: number; y: number; direction: "up" | "down" | "left" | "right" } | null;
  isFloor(x: number, y: number): boolean;
}

/** ㅁ자 경고 문턱. 이보다 작은 방(가게 한 칸·침실)은 직사각형이 자연스럽다. */
export const PLAIN_BOX_MIN_CELLS = 60;

function shapeOf(width: number, height: number, inner: (x: number, y: number) => boolean): HandInteriorShape {
  const isInner = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && inner(x, y);
  // 벽면: 막힌 칸 바로 아래 두 줄. 바닥 = 실내 칸 중 벽면이 아닌 칸(analyseHandInteriorPlan 과 같은 규칙).
  const face = (x: number, y: number) => isInner(x, y) && (!isInner(x, y - 1) || (isInner(x, y - 1) && !isInner(x, y - 2)));
  const isFloor = (x: number, y: number) => isInner(x, y) && !face(x, y);
  const openings: HandInteriorPoint[] = [];
  for (let y = 1; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isInner(x, y)) continue;
    if (y === height - 1 || x === 0 || x === width - 1) openings.push({ x, y });
  }
  const isOpening = new Set(openings.map((p) => p.y * width + p.x));
  let minX = width, minY = height, maxX = -1, maxY = -1, innerCells = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isInner(x, y) || isOpening.has(y * width + x)) continue;
    innerCells += 1;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const plainBox = innerCells > 0 && innerCells === (maxX - minX + 1) * (maxY - minY + 1);
  const inwardOf = (p: HandInteriorPoint) => {
    const candidates = [
      p.y === height - 1 ? { x: p.x, y: p.y - 1, direction: "up" as const } : null,
      p.x === 0 ? { x: p.x + 1, y: p.y, direction: "right" as const } : null,
      p.x === width - 1 ? { x: p.x - 1, y: p.y, direction: "left" as const } : null,
    ];
    return candidates.find((c) => c && isFloor(c.x, c.y) && !isOpening.has(c.y * width + c.x)) ?? null;
  };
  return { width, height, openings, plainBox, innerCells, isInner, inwardOf, isFloor };
}

export function handInteriorShapeFromPlan(plan: readonly string[]): HandInteriorShape {
  const a = analyseHandInteriorPlan(plan);
  return shapeOf(a.W, a.H, (x, y) => a.g[y]![x]!);
}

let blockedTiles: Set<number> | undefined;
/** 지은 맵의 1층에서 평면을 되찾는다 — 천장 띠·공허·빈칸이 '#'. 손 도트 실내 칩셋 맵이 아니면 null. */
export function handInteriorShapeFromMap(map: GameMap): HandInteriorShape | null {
  if (map.tilesetId !== "atlas_biome_interior" || map.lowerTiles.length !== map.width * map.height) return null;
  blockedTiles ??= new Set([HAND_INTERIOR_SPEC.void, HAND_INTERIOR_SPEC.blank, ...Object.values(HAND_INTERIOR_SPEC.ceilings).flat()]);
  const blocked = blockedTiles;
  return shapeOf(map.width, map.height, (x, y) => {
    const tile = map.lowerTiles[y * map.width + x]!;
    return tile >= 0 && !blocked.has(tile);
  });
}

export function nearestOpening(shape: HandInteriorShape, from: HandInteriorPoint): HandInteriorPoint | null {
  let best: HandInteriorPoint | null = null, bestScore = Infinity;
  for (const o of shape.openings) {
    // 맨 아래 줄 틈을 먼저 — 3/4 시점 실내의 정석 출입구다.
    const score = Math.abs(o.x - from.x) + Math.abs(o.y - from.y) + (o.y === shape.height - 1 ? 0 : 1000);
    if (score < bestScore) { best = o; bestScore = score; }
  }
  return best;
}
