// 청크를 캔버스 위 도형으로 그리기 위한 순수 기하·순회 함수.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.
//
// 왜 이 모듈이 생겼나: `RegionChunk.cells` 는 셀 단위 정확한 도형인데, 지금까지 그 기하는
// 팝오버 안 74px 썸네일 격자에만 쓰이고 `describeChunkPosition()` 이 평균을 내 "왼쪽 위"
// 텍스트 한 조각으로 뭉갰다. 버려지던 것은 기하가 아니라 **축척**이다. 여기서는 같은
// 셀 목록을 캔버스 축척의 화면 사각형·외곽선으로 바꾼다.
//
// DOM·Phaser·store 의존 없음 — 순수 함수. 좌표 규약은 `origin` 이 영역 원점(region.x,
// region.y)의 화면 좌표이고, 청크 셀의 x/y 는 영역 원점 기준 로컬 좌표다
// (groupLayerChanges 가 dx/dy 로 채운다).
import type { RegionRect } from "./clipToRegion";
import {
  describeChunkPosition,
  type RegionChangeGroups,
  type RegionChunk,
  type RegionLayer,
} from "./regionChangeGroups";

export interface OverlayRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 외곽선 한 변. 셀 union 의 **경계**만 담는다 — 내부 격자선은 들어오지 않는다. */
export interface OverlayEdge {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ChunkOverlayShape {
  readonly id: string;
  readonly layer: RegionLayer;
  readonly label: string;
  /** 청크가 덮는 각 셀의 화면 사각형. 클릭 히트 영역·채우기용. */
  readonly cellRects: readonly OverlayRect[];
  /** 청크 전체를 감싸는 경계 사각형. 라벨 배치·카메라 추적용. */
  readonly bounds: OverlayRect;
  /** 셀 union 의 외곽선. 이게 있어야 "칸 무더기"가 아니라 하나의 도형으로 읽힌다. */
  readonly outline: readonly OverlayEdge[];
  /** 키보드 순회 순서(위→아래, 좌→우), 0부터. tabindex 부여에 그대로 쓴다. */
  readonly order: number;
  /**
   * 스크린리더용 라벨. 캔버스 도형에는 체크박스가 주던 접근성이 없으므로
   * `describeChunkPosition()` 을 여기서 **재사용**한다 — 그 함수는 삭제되지 않고
   * 시각 표현의 보조로 강등된다.
   */
  readonly ariaLabel: string;
}

export interface BuildChunkOverlayShapesOptions {
  readonly chunks: readonly RegionChunk[];
  readonly region: RegionRect;
  /** 타일 한 칸의 화면 크기(px). 카메라 줌이 반영된 값을 넘긴다. */
  readonly tileSize: number;
  /** 영역 원점의 화면 좌표. 생략하면 원점 기준 로컬 좌표를 그대로 낸다. */
  readonly origin?: { readonly x: number; readonly y: number };
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** 셀 union 의 경계 변만 모은다 — 이웃 셀이 같은 청크에 없는 방향의 변이 경계다. */
function outlineOf(
  cells: readonly { readonly x: number; readonly y: number }[],
  tileSize: number,
  originX: number,
  originY: number,
): OverlayEdge[] {
  const present = new Set(cells.map((c) => cellKey(c.x, c.y)));
  const edges: OverlayEdge[] = [];
  for (const cell of cells) {
    const left = originX + cell.x * tileSize;
    const top = originY + cell.y * tileSize;
    const right = left + tileSize;
    const bottom = top + tileSize;
    if (!present.has(cellKey(cell.x, cell.y - 1))) edges.push({ x1: left, y1: top, x2: right, y2: top });
    if (!present.has(cellKey(cell.x + 1, cell.y))) edges.push({ x1: right, y1: top, x2: right, y2: bottom });
    if (!present.has(cellKey(cell.x, cell.y + 1))) edges.push({ x1: left, y1: bottom, x2: right, y2: bottom });
    if (!present.has(cellKey(cell.x - 1, cell.y))) edges.push({ x1: left, y1: top, x2: left, y2: bottom });
  }
  return edges;
}

/**
 * 청크 목록 → 캔버스 도형 목록. 셀이 하나도 없는 청크는 그리지 않는다(클릭할 것이 없다).
 * 반환 순서가 곧 키보드 순회 순서다.
 */
export function buildChunkOverlayShapes(
  options: BuildChunkOverlayShapesOptions,
): readonly ChunkOverlayShape[] {
  const { chunks, region, tileSize } = options;
  const originX = options.origin?.x ?? 0;
  const originY = options.origin?.y ?? 0;

  const drawable = chunks.filter((chunk) => chunk.cells.length > 0);

  const measured = drawable.map((chunk) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const cellRects: OverlayRect[] = [];
    for (const cell of chunk.cells) {
      if (cell.x < minX) minX = cell.x;
      if (cell.y < minY) minY = cell.y;
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y > maxY) maxY = cell.y;
      cellRects.push({
        x: originX + cell.x * tileSize,
        y: originY + cell.y * tileSize,
        width: tileSize,
        height: tileSize,
      });
    }
    const bounds: OverlayRect = {
      x: originX + minX * tileSize,
      y: originY + minY * tileSize,
      width: (maxX - minX + 1) * tileSize,
      height: (maxY - minY + 1) * tileSize,
    };
    const where = describeChunkPosition(chunk, region);
    return {
      chunk,
      cellRects,
      bounds,
      minX,
      minY,
      outline: outlineOf(chunk.cells, tileSize, originX, originY),
      ariaLabel: where ? `${chunk.label} · ${where}` : chunk.label,
    };
  });

  // 위→아래, 같은 줄이면 왼쪽→오른쪽. 읽기 순서 = 순회 순서 = tabindex 순서.
  measured.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));

  return measured.map((m, order) => ({
    id: m.chunk.id,
    layer: m.chunk.layer,
    label: m.chunk.label,
    cellRects: m.cellRects,
    bounds: m.bounds,
    outline: m.outline,
    order,
    ariaLabel: m.ariaLabel,
  }));
}

/**
 * 클릭 타깃 최소 크기(px).
 *
 * 왜 필요한가 — 실측(2026-09-11, 호수 마을 12×10 영역, forest 오퍼레이터):
 * 청크 22개 중 **18개가 1칸**이었다. 나무를 흩뿌리는 생성기에서는 4-연결성 청킹이
 * 나무 한 그루씩을 청크로 만들기 때문이다. 1칸은 1x 줌에서 16×16px 이라 사실상 누를 수 없다.
 * 그림은 타일 크기 그대로 두고 **히트 영역만** 이 값까지 넓힌다.
 */
export const MIN_CHUNK_HIT_PX = 24;

/** 사각형의 중심을 유지하며 최소 크기까지 넓힌 히트 영역. 이미 크면 그대로. */
export function hitRectFor(rect: OverlayRect, min: number = MIN_CHUNK_HIT_PX): OverlayRect {
  const width = Math.max(rect.width, min);
  const height = Math.max(rect.height, min);
  if (width === rect.width && height === rect.height) return rect;
  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
}

function countCells(chunks: readonly RegionChunk[]): number {
  let total = 0;
  for (const chunk of chunks) total += chunk.cells.length;
  return total;
}

/**
 * 처음에 어느 레이어를 만지게 할지. 바닥/위 청크는 같은 칸을 공유할 수 있어 동시에
 * 그리면 읽히지 않으므로 한 번에 한 레이어만 활성이다(스펙 §4.3).
 * 변경 칸이 더 많은 쪽을 고르고, 같으면 바닥을 고른다.
 */
export function defaultOverlayLayer(groups: RegionChangeGroups): RegionLayer {
  return countCells(groups.upper) > countCells(groups.lower) ? "upper" : "lower";
}

/** 포함/제외 토글. 원본 집합을 바꾸지 않고 새 집합을 낸다. */
export function selectionAfterToggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export type ChunkDirection = "up" | "down" | "left" | "right";

function centerOf(rect: OverlayRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function overlapsOnCross(a: OverlayRect, b: OverlayRect, cross: "x" | "y"): boolean {
  const aStart = cross === "x" ? a.x : a.y;
  const aEnd = aStart + (cross === "x" ? a.width : a.height);
  const bStart = cross === "x" ? b.x : b.y;
  const bEnd = bStart + (cross === "x" ? b.width : b.height);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * 화살표 키 이동. 진행 방향으로 실제로 넘어간 청크만 후보로 두고, 그중 교차축이 겹치는
 * 것(=같은 줄/열에 있는 것)을 우선한다. 겹치는 게 없으면 가장 가까운 것으로 간다.
 * 갈 곳이 없거나 모르는 id 면 null.
 */
export function nextChunkInDirection(
  shapes: readonly ChunkOverlayShape[],
  currentId: string,
  direction: ChunkDirection,
): string | null {
  const current = shapes.find((shape) => shape.id === currentId);
  if (!current) return null;

  const axis: "x" | "y" = direction === "left" || direction === "right" ? "x" : "y";
  const cross: "x" | "y" = axis === "x" ? "y" : "x";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const currentCenter = centerOf(current.bounds);

  const ahead = shapes
    .filter((shape) => shape.id !== currentId)
    .filter((shape) => sign * (centerOf(shape.bounds)[axis] - currentCenter[axis]) > 0.5);
  if (ahead.length === 0) return null;

  const aligned = ahead.filter((shape) => overlapsOnCross(shape.bounds, current.bounds, cross));
  const pool = aligned.length > 0 ? aligned : ahead;

  let best = pool[0]!;
  let bestScore = Infinity;
  for (const shape of pool) {
    const center = centerOf(shape.bounds);
    const primary = Math.abs(center[axis] - currentCenter[axis]);
    const secondary = Math.abs(center[cross] - currentCenter[cross]);
    const score = primary * 1000 + secondary;
    if (score < bestScore) {
      bestScore = score;
      best = shape;
    }
  }
  return best.id;
}
