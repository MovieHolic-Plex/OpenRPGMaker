// 맵 우클릭 제스처 판별:
// - 클릭(1칸) → 스포이트
// - 드래그(2칸 이상 사각) → 영역 AI 작업
import type { TilePoint } from "@/editor/tileShapeTools";
import { tileRectFromDrag, tileRectWithinBounds } from "@/editor/tileShapeTools";

export type RegionDragRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function regionRectFromDrag(
  start: TilePoint,
  end: TilePoint,
  mapSize: { readonly width: number; readonly height: number },
): RegionDragRect | null {
  return tileRectWithinBounds(tileRectFromDrag(start, end), mapSize);
}

/** 2칸 이상(가로 또는 세로)이면 AI 영역 드래그로 본다. 1×1은 클릭(스포이트). */
export function isSignificantRegionDrag(rect: RegionDragRect | null | undefined): boolean {
  if (!rect) return false;
  return rect.width > 1 || rect.height > 1;
}
