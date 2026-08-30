// 에디터 카메라 → 타일 뷰포트 스냅샷 + 어시스턴트 컨텍스트 블록.
// 순수 함수(브라우저/Phaser 비의존) — 테스트·세션·contextBuilder가 공유한다.
//
// 줌/가림(조수 도크) 보정은 호출자 책임이다: 여기에는 이미 "화면에 실제로 보이는 월드 사각형"만 들어온다.
// 왜: 예전 입력은 {scrollX, zoom, viewWidthPx...} 였고 worldLeft = scrollX 로 계산했다. Phaser 3.60+ 는
// worldView.x = scrollX + width/2 - width/(2*zoom) 이라 zoom !== 1 이면 이 가정이 깨진다. 에디터 기본 줌은 2다.
// 실측(캔버스 1133×700, scroll(400,300), tileSize 16): 진짜 시각 중심은 타일 (60,40) 인데 (42,29) 로 보고했다
// — 모델에게 18칸 왼쪽/11칸 위의 영역을 알려주고 통행 그리드·뷰포트 이미지까지 그 엉뚱한 영역을 설명했다.

import type { GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";

/** 화면에 실제로 보이는 월드 사각형(줌 보정 + 조수 도크 가림 제외). Phaser camera.worldView 에서 만든다. */
export type MapCameraViewInput = {
  readonly worldLeftPx: number;
  readonly worldTopPx: number;
  readonly worldWidthPx: number;
  readonly worldHeightPx: number;
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
  const viewW = Math.max(1, camera.worldWidthPx);
  const viewH = Math.max(1, camera.worldHeightPx);

  const worldLeft = camera.worldLeftPx;
  const worldTop = camera.worldTopPx;
  const worldRight = worldLeft + viewW;
  const worldBottom = worldTop + viewH;
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

/** 뷰포트 통행 그리드. `#`=isPassable false, `.`=true. 행마다 한 줄, 칸마다 한 글자. */
export const VIEWPORT_PASSABILITY_MARK = { blocked: "#", open: "." } as const;

/** `pass:x,y` — 다음 h줄이 각 행 마커. */
export const VIEWPORT_PASSABILITY_ORIGIN_PREFIX = "pass:";

export function formatViewportContextBlock(
  viewport: MapViewportSnapshot,
  mapName: string,
  project?: Project,
): string {
  // 마지막 칸은 x+w-1 (양 끝 포함). 반열림 끝값을 찍으면 그대로 베낀 모델이 한 칸 밀린다.
  const x1 = viewport.x + viewport.w - 1;
  const y1 = viewport.y + viewport.h - 1;
  const lines = [
    "## 에디터 뷰포트(사용자가 지금 보고 있는 맵 화면)",
    `- 맵: ${mapName} (\`${viewport.mapId}\`)`,
    `- 화면 중앙 타일: **(${viewport.centerX}, ${viewport.centerY})**`,
    `- 가시 영역(타일): (${viewport.x},${viewport.y})~(${x1},${y1}) — ${viewport.w}×${viewport.h} (양 끝 칸 포함)`,
    "- 영역 표기 규약(툴 공통): 좌상단 기준, w/h 는 칸 수, 마지막 칸은 x+w-1 / y+h-1.",
    "- 사용자 말의 \"여기/이 근처/화면/가운데\"는 위 좌표를 기준으로 해석하세요.",
    "- 상세 타일/이벤트는 get_map_region / show_map_region으로 이 영역 또는 주변을 조회하세요.",
  ];
  const grid = formatPassabilityGrid(viewport, project);
  if (grid) lines.push(...grid);
  return lines.join("\n");
}

/**
 * 배치 계약과 같은 isPassable 로 그리드를 짠다.
 * queryTools 의 passable 필드는 passageMarkForTile(...) !== "x" 라서 타일 단위(합성 레이어 무시) — 출처가 갈라질 수 있다.
 */
function formatPassabilityGrid(
  viewport: MapViewportSnapshot,
  project: Project | undefined,
): string[] | null {
  if (!project) return null;
  const map = project.maps[viewport.mapId];
  if (!map) return null;
  const rows: string[] = [`${VIEWPORT_PASSABILITY_ORIGIN_PREFIX}${viewport.x},${viewport.y}`];
  for (let row = 0; row < viewport.h; row += 1) {
    let line = "";
    const y = viewport.y + row;
    for (let col = 0; col < viewport.w; col += 1) {
      const x = viewport.x + col;
      line += isPassable(project, map, x, y) ? VIEWPORT_PASSABILITY_MARK.open : VIEWPORT_PASSABILITY_MARK.blocked;
    }
    rows.push(line);
  }
  return rows;
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
