/**
 * 카메라 초점 기하학 — 순수 계산만 둔다(Phaser·DOM import 없음).
 *
 * 조수 표면은 캔버스 위 입력줄 캡슐과, 턴이 열리면 그 위에 펼치는 기록 카드다.
 * `.ai-chat-panel` 자체는 inset:0 투명 호스트라 캔버스 전체를 덮지만 가림이 아니다.
 * 입력줄+기록 카드를 한 덩어리로 합친 뒤에 가림을 빼야, 60% 교차 비율이 오른쪽 열을 알아본다.
 */

/** 캔버스 기준 CSS 픽셀 사각형. */
export interface CanvasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 오버레이가 한 변을 "충분히 가로지른다"고 볼 최소 비율 — 이보다 짧으면 모서리 장식일 뿐 잘라낼 근거가 없다. */
const CROSS_RATIO = 0.6;
/** 잘라낸 뒤 눈으로 볼 수 있는 최소 폭/높이(px). 이보다 좁은 조각만 남으면 그 가림은 무시한다. */
const DEFAULT_MIN_SPAN_PX = 64;
/** 캔버스 면적의 이 비율 이상을 덮으면 투명 호스트로 보고 버린다. */
const FULL_COVER_RATIO = 0.85;
/** 인접한 조수 조각을 한 덩어리로 볼 최대 간격(px). */
const OVERLAY_MERGE_GAP_PX = 24;
/** 이 거리 안에 있으면 캔버스 변에 붙어 있다고 본다. */
const EDGE_FLUSH_PX = 24;
/** 변에 붙은 열로 깎을 최소 폭. 접힌 「조수」 단추는 이보다 좁다. */
const EDGE_COLUMN_MIN_WIDTH = 200;
/** 입력줄만 있을 때는 열로 안 깎고, 기록 카드까지 붙으면 깎는다. */
const EDGE_COLUMN_MIN_HEIGHT = 200;
/** 변에 붙은 가로 띠로 깎을 최소 높이. */
const EDGE_ROW_MIN_HEIGHT = 80;

/**
 * 캔버스를 덮는 오버레이(조수 유리 카드 등)를 뺀, 실제로 맵이 보이는 최대 사각형.
 * 한 방향씩만 깎는다(좌/우/상/하). 60% 교차 비율은 어느 변을 깎을지 결정하고,
 * minSpanPx 는 그 결과가 눈으로 보기 어려운 좁은 조각일 때만 깎기를 거부한다.
 * 오른쪽 아래 캡슐+기록은 큰 창에서 높이 60%를 못 넘기므로, 변에 붙은 열/띠는
 * 교차 비율과 별도로 그 변을 깎는다.
 * 실측한 600×500 캔버스에서는 폭 360px 카드 오른쪽에 228px가 남으므로, 정상 가시 영역을 버리던
 * 240px 대신 64px를 기본값으로 삼는다.
 */
export function unoccludedCanvasRect(
  canvas: CanvasRect,
  overlays: readonly CanvasRect[],
  minSpanPx = DEFAULT_MIN_SPAN_PX
): CanvasRect {
  if (!isUsableRect(canvas)) return canvas;
  let current: CanvasRect = canvas;

  for (const overlay of overlays) {
    if (!isUsableRect(overlay)) continue;
    const inter = intersect(current, overlay);
    if (!inter) continue;

    const crossesVertically = inter.height >= current.height * CROSS_RATIO;
    const crossesHorizontally = inter.width >= current.width * CROSS_RATIO;

    if (crossesVertically) {
      // 좌우 중 더 넓게 남는 쪽으로 깎는다.
      const keepRight = current.x + current.width - (inter.x + inter.width);
      const keepLeft = inter.x - current.x;
      if (Math.max(keepRight, keepLeft) > 0 && Math.max(keepRight, keepLeft) >= minSpanPx) {
        current =
          keepRight >= keepLeft
            ? { x: inter.x + inter.width, y: current.y, width: keepRight, height: current.height }
            : { x: current.x, y: current.y, width: keepLeft, height: current.height };
        continue;
      }
    }
    if (crossesHorizontally) {
      const keepBelow = current.y + current.height - (inter.y + inter.height);
      const keepAbove = inter.y - current.y;
      if (Math.max(keepBelow, keepAbove) > 0 && Math.max(keepBelow, keepAbove) >= minSpanPx) {
        current =
          keepBelow >= keepAbove
            ? { x: current.x, y: inter.y + inter.height, width: current.width, height: keepBelow }
            : { x: current.x, y: current.y, width: current.width, height: keepAbove };
        continue;
      }
    }

    const edgeCrop = cropFlushEdge(current, inter, minSpanPx);
    if (edgeCrop) current = edgeCrop;
  }

  return { x: current.x, y: current.y, width: Math.max(0, current.width), height: Math.max(0, current.height) };
}

/** 변에 붙은 열/띠는 60% 교차를 못 해도 그 변을 깎는다. 오른쪽 아래 캡슐이 여기 해당한다. */
function cropFlushEdge(current: CanvasRect, inter: CanvasRect, minSpanPx: number): CanvasRect | null {
  const rightGap = current.x + current.width - (inter.x + inter.width);
  const leftGap = inter.x - current.x;
  const bottomGap = current.y + current.height - (inter.y + inter.height);
  const topGap = inter.y - current.y;

  if (rightGap <= EDGE_FLUSH_PX && inter.width >= EDGE_COLUMN_MIN_WIDTH && inter.height >= EDGE_COLUMN_MIN_HEIGHT && leftGap >= minSpanPx) {
    return { x: current.x, y: current.y, width: leftGap, height: current.height };
  }
  if (leftGap <= EDGE_FLUSH_PX && inter.width >= EDGE_COLUMN_MIN_WIDTH && inter.height >= EDGE_COLUMN_MIN_HEIGHT && rightGap >= minSpanPx) {
    return { x: inter.x + inter.width, y: current.y, width: rightGap, height: current.height };
  }
  if (bottomGap <= EDGE_FLUSH_PX && inter.height >= EDGE_ROW_MIN_HEIGHT && topGap >= minSpanPx) {
    return { x: current.x, y: current.y, width: current.width, height: topGap };
  }
  if (topGap <= EDGE_FLUSH_PX && inter.height >= EDGE_ROW_MIN_HEIGHT && bottomGap >= minSpanPx) {
    return { x: current.x, y: inter.y + inter.height, width: current.width, height: bottomGap };
  }
  return null;
}

/**
 * 대상 월드 지점이 가시(가림 제외) 영역의 중앙에 오도록 카메라가 바라봐야 할 월드 지점.
 * 카메라 중심은 캔버스 중앙에 대응하므로 lookAt = target - (가시중앙 - 캔버스중앙) / zoom 이다.
 */
export function cameraLookAtForTarget(input: {
  readonly targetWorldX: number;
  readonly targetWorldY: number;
  readonly canvas: CanvasRect;
  readonly unoccluded: CanvasRect;
  readonly zoom: number;
}): { readonly x: number; readonly y: number } {
  const zoom = safeZoom(input.zoom);
  const canvasCenterX = input.canvas.x + input.canvas.width / 2;
  const canvasCenterY = input.canvas.y + input.canvas.height / 2;
  const viewCenterX = input.unoccluded.x + input.unoccluded.width / 2;
  const viewCenterY = input.unoccluded.y + input.unoccluded.height / 2;
  return {
    x: input.targetWorldX - (viewCenterX - canvasCenterX) / zoom,
    y: input.targetWorldY - (viewCenterY - canvasCenterY) / zoom,
  };
}

/**
 * 보이는 월드 사각형 + 가림 제외 캔버스 사각형 → 분수 타일 사각형(부분 타일을 버리지 않는다).
 * worldView 는 캔버스 전체에 1:1 대응하므로 캔버스 px 오프셋 p 의 월드 좌표는 worldView.x + p / zoom 이다.
 */
export function visibleTileRectFromViewport(input: {
  readonly worldView: CanvasRect;
  readonly canvas: CanvasRect;
  readonly unoccluded: CanvasRect;
  readonly zoom: number;
  readonly tileSize: number;
}): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
  if (!isUsableRect(input.worldView) || !isUsableRect(input.canvas)) return null;
  if (!Number.isFinite(input.tileSize) || input.tileSize <= 0) return null;
  const zoom = safeZoom(input.zoom);
  const offsetX = input.unoccluded.x - input.canvas.x;
  const offsetY = input.unoccluded.y - input.canvas.y;
  const width = input.unoccluded.width / zoom / input.tileSize;
  const height = input.unoccluded.height / zoom / input.tileSize;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: (input.worldView.x + offsetX / zoom) / input.tileSize,
    y: (input.worldView.y + offsetY / zoom) / input.tileSize,
    width,
    height,
  };
}

function safeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/**
 * inset:0 투명 패널처럼 캔버스를 거의 다 덮는 사각형은 가림이 아니다.
 * 입력줄·기록 카드만 남긴다.
 */
export function filterAssistantOverlayRects(
  canvas: CanvasRect,
  rects: readonly CanvasRect[],
): CanvasRect[] {
  if (!isUsableRect(canvas)) return [];
  const canvasArea = canvas.width * canvas.height;
  const kept: CanvasRect[] = [];
  for (const rect of rects) {
    if (!isUsableRect(rect)) continue;
    const inter = intersect(canvas, rect);
    if (!inter) continue;
    if (inter.width * inter.height >= canvasArea * FULL_COVER_RATIO) continue;
    kept.push(rect);
  }
  return kept;
}

/**
 * 겹치거나 가까이 붙은 사각형을 한 덩어리로 합친다.
 * 입력줄과 그 위 기록 카드는 각각 60% 교차에 못 미치지만, 합치면 오른쪽 열로 깎인다.
 */
export function mergeNearbyRects(
  rects: readonly CanvasRect[],
  gapPx = OVERLAY_MERGE_GAP_PX,
): CanvasRect[] {
  const items = rects.filter(isUsableRect).map((rect) => ({ ...rect }));
  if (items.length <= 1) return items;
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (!rectsAreNearby(items[i], items[j], gapPx)) continue;
        items[i] = unionRect(items[i], items[j]);
        items.splice(j, 1);
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  return items;
}

function rectsAreNearby(a: CanvasRect, b: CanvasRect, gapPx: number): boolean {
  const padded: CanvasRect = {
    x: a.x - gapPx,
    y: a.y - gapPx,
    width: a.width + gapPx * 2,
    height: a.height + gapPx * 2,
  };
  return intersect(padded, b) !== null;
}

function unionRect(a: CanvasRect, b: CanvasRect): CanvasRect {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.width, b.x + b.width);
  const y1 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function isUsableRect(rect: CanvasRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function intersect(a: CanvasRect, b: CanvasRect): CanvasRect | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Inspection room beyond an edge, in CSS pixels at every zoom. */
export const CAMERA_INSPECTION_PADDING = 32;

/** Bounds for the existing camera: either map edge can reach the unobstructed center. */
export function editorCameraBounds(input: {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly canvas: CanvasRect;
  readonly unoccluded: CanvasRect;
  readonly zoom: number;
}): CanvasRect {
  const { canvas, unoccluded, zoom } = input;
  const cx = unoccluded.x - canvas.x + unoccluded.width / 2;
  const cy = unoccluded.y - canvas.y + unoccluded.height / 2;
  const padding = CAMERA_INSPECTION_PADDING;
  return {
    x: -(cx + padding) / zoom,
    y: -(cy + padding) / zoom,
    width: input.mapWidth + (canvas.width + padding * 2) / zoom,
    height: input.mapHeight + (canvas.height + padding * 2) / zoom,
  };
}
