// 에디터 카메라 → 타일 뷰포트 스냅샷 + 어시스턴트 컨텍스트 블록.
// 순수 함수(브라우저/Phaser 비의존) — 테스트·세션·contextBuilder가 공유한다.

import type { GameMap, Project } from "@/project/types";
import { TILE } from "@/project/defaults/constants";

/** 카메라/캔버스 입력(월드 픽셀 기준 scroll, 화면 픽셀 크기). */
export type MapCameraViewInput = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly viewWidthPx: number;
  readonly viewHeightPx: number;
  readonly tileSize: number;
};

/** 어시스턴트에 넘기는 타일 좌표 뷰포트. */
export type MapViewportSnapshot = {
  readonly mapId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/** 컨텍스트/이미지에 넣을 최대 한 변(타일). 너무 크면 토큰·렌더 비용이 큼. */
export const DEFAULT_VIEWPORT_MAX_SPAN = 16;

export function computeMapViewport(
  map: Pick<GameMap, "id" | "width" | "height">,
  camera: MapCameraViewInput,
  maxSpan: number = DEFAULT_VIEWPORT_MAX_SPAN,
): MapViewportSnapshot {
  const tileSize = Math.max(1, camera.tileSize);
  const zoom = camera.zoom > 0 ? camera.zoom : 1;
  const viewW = Math.max(1, camera.viewWidthPx);
  const viewH = Math.max(1, camera.viewHeightPx);

  const worldLeft = camera.scrollX;
  const worldTop = camera.scrollY;
  const worldRight = camera.scrollX + viewW / zoom;
  const worldBottom = camera.scrollY + viewH / zoom;
  const worldCx = (worldLeft + worldRight) / 2;
  const worldCy = (worldTop + worldBottom) / 2;

  const centerX = clamp(Math.floor(worldCx / tileSize), 0, Math.max(0, map.width - 1));
  const centerY = clamp(Math.floor(worldCy / tileSize), 0, Math.max(0, map.height - 1));

  let x0 = Math.floor(worldLeft / tileSize);
  let y0 = Math.floor(worldTop / tileSize);
  let x1 = Math.ceil(worldRight / tileSize);
  let y1 = Math.ceil(worldBottom / tileSize);

  x0 = clamp(x0, 0, map.width);
  y0 = clamp(y0, 0, map.height);
  x1 = clamp(x1, 0, map.width);
  y1 = clamp(y1, 0, map.height);

  let w = Math.max(1, x1 - x0);
  let h = Math.max(1, y1 - y0);

  // 화면에 보이는 영역이 너무 넓으면 중심 기준으로 maxSpan 안으로 자른다.
  if (w > maxSpan) {
    x0 = clamp(centerX - Math.floor(maxSpan / 2), 0, Math.max(0, map.width - maxSpan));
    w = Math.min(maxSpan, map.width - x0);
  }
  if (h > maxSpan) {
    y0 = clamp(centerY - Math.floor(maxSpan / 2), 0, Math.max(0, map.height - maxSpan));
    h = Math.min(maxSpan, map.height - y0);
  }
  if (x0 + w > map.width) w = Math.max(1, map.width - x0);
  if (y0 + h > map.height) h = Math.max(1, map.height - y0);

  return {
    mapId: map.id,
    centerX,
    centerY,
    x: x0,
    y: y0,
    w,
    h,
  };
}

/** 맵 요약용 영역: 뷰포트가 있으면 그 클립, 없으면 좌상단 fallback. */
export function mapRegionForContext(
  map: Pick<GameMap, "id" | "width" | "height">,
  viewport: MapViewportSnapshot | null | undefined,
  fallbackMax = 20,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  if (viewport && viewport.mapId === map.id && viewport.w > 0 && viewport.h > 0) {
    return { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h };
  }
  return {
    x: 0,
    y: 0,
    w: Math.min(map.width, fallbackMax),
    h: Math.min(map.height, fallbackMax),
  };
}

export function formatViewportContextBlock(
  viewport: MapViewportSnapshot,
  mapName: string,
): string {
  const x1 = viewport.x + viewport.w;
  const y1 = viewport.y + viewport.h;
  return [
    "## 에디터 뷰포트(사용자가 지금 보고 있는 맵 화면)",
    `- 맵: ${mapName} (\`${viewport.mapId}\`)`,
    `- 화면 중앙 타일: **(${viewport.centerX}, ${viewport.centerY})**`,
    `- 가시 영역(타일): (${viewport.x},${viewport.y})~(${x1},${y1}) — ${viewport.w}×${viewport.h}`,
    "- 사용자 말의 \"여기/이 근처/화면/가운데\"는 위 좌표를 기준으로 해석하세요.",
    "- 상세 타일/이벤트는 get_map_region / show_map_region으로 이 영역 또는 주변을 조회하세요.",
  ].join("\n");
}

/** show_map_region 과 동일한 lower/upper 2D 배열 페이로드(비전 렌더용). */
export function mapRegionImagePayload(
  project: Project,
  mapId: string,
  region: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lower: number[][];
  readonly upper: number[][];
  readonly tilesetId: string;
} | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const x = clamp(region.x, 0, map.width);
  const y = clamp(region.y, 0, map.height);
  const w = Math.max(1, Math.min(region.w, map.width - x));
  const h = Math.max(1, Math.min(region.h, map.height - y));
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let row = 0; row < h; row += 1) {
    const lowerRow: number[] = [];
    const upperRow: number[] = [];
    for (let col = 0; col < w; col += 1) {
      const index = (y + row) * map.width + (x + col);
      lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
      upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
    }
    lower.push(lowerRow);
    upper.push(upperRow);
  }
  return { mapId, x, y, w, h, lower, upper, tilesetId: map.tilesetId };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
