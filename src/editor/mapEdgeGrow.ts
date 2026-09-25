import { resizeMap } from "@/editor/actions";
import { recordCoalescedSnapshot } from "@/editor/mapEditHistory";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { exceedsMapDimensionLimit } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

/** 맵 테두리 바깥, 화면 픽셀. 이 안에서만 크기가 커진다. */
export const MAP_EDGE_GROW_BAND_PX = 56;
/** 가장자리에 머문 뒤 첫 칸까지. */
export const MAP_EDGE_GROW_ARM_MS = 140;
/** 칸과 칸 사이. */
export const MAP_EDGE_GROW_STEP_MS = 170;

export type MapEdgeGrowAxes = {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
};

export function mapEdgeGrowAxes(input: {
  readonly worldX: number;
  readonly worldY: number;
  readonly mapWidthPx: number;
  readonly mapHeightPx: number;
  readonly zoom: number;
}): MapEdgeGrowAxes | null {
  const zoom = input.zoom > 0 ? input.zoom : 1;
  const band = MAP_EDGE_GROW_BAND_PX / zoom;
  const { worldX, worldY, mapWidthPx, mapHeightPx } = input;
  if (mapWidthPx <= 0 || mapHeightPx <= 0) return null;
  const nearX = worldX >= -band && worldX <= mapWidthPx + band;
  const nearY = worldY >= -band && worldY <= mapHeightPx + band;
  if (!nearX || !nearY) return null;
  const left = worldX < 0;
  const right = worldX >= mapWidthPx;
  const up = worldY < 0;
  const down = worldY >= mapHeightPx;
  if (!left && !right && !up && !down) return null;
  return { left, right, up, down };
}

export type MapEdgeGrowResult = {
  readonly dx: number;
  readonly dy: number;
};

/**
 * 포인터가 있는 바깥 방향으로 맵을 한 칸 키운다.
 * 왼쪽·위는 내용을 밀어 새 칸이 그 변에 생긴다.
 * 연속 호버는 히스토리 한 단계로 묶인다.
 */
export function growMapOnEdges(mapId: MapId, axes: MapEdgeGrowAxes): MapEdgeGrowResult | null {
  const map = store.getCurrent().maps[mapId];
  if (!map) return null;
  const left = axes.left && !axes.right;
  const right = axes.right && !axes.left;
  const up = axes.up && !axes.down;
  const down = axes.down && !axes.up;
  let addW = (left || right) ? 1 : 0;
  let addH = (up || down) ? 1 : 0;
  if (addW > 0 && exceedsMapDimensionLimit(map.width + addW, map.height)) addW = 0;
  if (addH > 0 && exceedsMapDimensionLimit(map.width + addW, map.height + addH)) addH = 0;
  if (addW === 0 && addH === 0) return null;
  const dx = left && addW > 0 ? 1 : 0;
  const dy = up && addH > 0 ? 1 : 0;
  recordCoalescedSnapshot(`map-edge-grow:${mapId}`, "맵 크기", mapId);
  resizeMap(mapId, map.width + addW, map.height + addH);
  if (dx !== 0 || dy !== 0) shiftMapContent(mapId, { dx, dy });
  return { dx, dy };
}
