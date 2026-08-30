/**
 * 카메라 초점 기하학 — 순수 계산만 둔다(Phaser·DOM import 없음).
 *
 * 조수 채팅 독의 기본 모습은 캔버스 위에 떠 있는 유리 카드다
 * (src/styles/database/tabs-b-assistant-panel/02-chat-dock.css: .ai-chat-float-host inset:0 z-index:32,
 * .ai-chat-panel.chat-dock-glass inset 12px auto auto 12px, width clamp(360px,38vw,520px)).
 * 즉 캔버스 전체 중앙에 대상을 맞추면 그 카드 뒤로 들어가 "아무 일도 안 일어난 것"처럼 보인다.
 * 그래서 가림을 뺀 사각형을 먼저 구하고, 그 사각형의 중앙에 대상이 오도록 카메라 lookAt 을 옮긴다.
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

/**
 * 캔버스를 덮는 오버레이(조수 유리 카드 등)를 뺀, 실제로 맵이 보이는 최대 사각형.
 * 한 방향씩만 깎는다(좌/우/상/하). 60% 교차 비율은 어느 변을 깎을지 결정하고,
 * minSpanPx 는 그 결과가 눈으로 보기 어려운 좁은 조각일 때만 깎기를 거부한다.
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
      }
    }
  }

  return { x: current.x, y: current.y, width: Math.max(0, current.width), height: Math.max(0, current.height) };
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
