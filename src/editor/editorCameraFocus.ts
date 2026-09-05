import type { MapId } from "@/project/types";

/**
 * 좌측 사이드바 이벤트 목록 등 DOM-side UI가 "이 타일로 카메라를 보내달라"고
 * EditScene(Phaser)에 요청할 때 쓰는 단방향 pub/sub.
 * store/editorState와 달리 카메라 위치는 Phaser 씬 상태이므로 별도 채널을 둔다.
 */

export interface CameraFocusBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraFocusTarget {
  /** 이벤트가 있는 맵. 현재 EditScene이 보고 있는 맵과 다르면 무시된다. */
  readonly mapId: MapId;
  /** 카메라를 중심에 둘 타일 X. bounds 가 없을 때만 쓰이며 분수를 받는다(사각형 중심). */
  readonly tileX: number;
  /** 카메라를 중심에 둘 타일 Y. bounds 가 없을 때만 쓰이며 분수를 받는다(사각형 중심). */
  readonly tileY: number;
  /**
   * 화면에 들여놓고 싶은 영역(타일). 주면 이 사각형의 중심으로 간다 — tileX/tileY 는
   * bounds 를 못 쓰는 소비자를 위한 폴백으로 남는다.
   */
  readonly bounds?: CameraFocusBounds;
  /**
   * 대상이 이미 화면 안에 들어와 있으면 카메라를 움직이지 않는다.
   * 조수가 자동으로 요청하는 이동 전용 — 사용자가 직접 누른 이동(이벤트 목록 행, 린트 행)은
   * 눌렀는데 아무 일도 안 나는 것이 더 나쁘므로 이 옵션을 쓰지 않는다.
   */
  readonly onlyIfOffscreen?: boolean;
}

/**
 * 지금 화면에 실제로 보이는 타일 사각형 — **분수 타일** 단위다.
 * 값을 ceil/floor 로 정수화하면 99% 보이는 타일이 버려져서 이미 화면 안인 대상을 끌어당긴다.
 * 조수 독처럼 캔버스를 덮는 오버레이를 뺀 사각형을 넣는다(cameraFocusViewport.visibleTileRectFromViewport).
 */
export interface VisibleTileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 카메라가 바라볼 지점 — 타일 단위 분수 좌표(대상 사각형의 정확한 중심). 월드 픽셀 = center * tileSize. */
export interface CameraFocusPlan {
  readonly centerTileX: number;
  readonly centerTileY: number;
  /** 대상이 현재 줌으로 가시 영역에 안 들어올 때 제안하는 줌. 없으면 줌을 바꾸지 않는다. */
  readonly zoom?: number;
}

type Listener = (target: CameraFocusTarget) => void;

const listeners = new Set<Listener>();

export function subscribeEditorCameraFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestEditorCameraFocus(target: CameraFocusTarget): void {
  for (const listener of listeners) listener(target);
}

/**
 * 카메라 이동 판정 — 순수 계산이라 씬 없이 테스트한다.
 *
 * `onlyIfOffscreen` 이 붙은 요청(조수 자동 이동)에서 화면을 함부로 빼앗지 않는 것이 핵심이다.
 * 세 갈래로 갈린다:
 *  1. 대상이 여유(margin)까지 포함해 화면 안에 다 들어와 있다 → 움직이지 않는다.
 *  2. 대상이 화면보다 커서 애초에 다 담을 수 없다 → 대상 중심이 화면 중앙부에 있으면
 *     이미 "보고 있는" 것으로 치고 움직이지 않는다. (100×100 맵을 다 채운 변경에서
 *     화면이 매번 맵 중앙으로 튀는 것을 막는다.)
 *  3. 그 밖 → 대상 중심으로 보낸다.
 *
 * 중심은 **내림하지 않는다**: {x:4,y:4,width:6,height:8} 의 참 중심은 (7,8) 이고, 예전처럼 내림한 뒤
 * 소비자가 +0.5 타일을 더하면 오른쪽 아래로 반 타일(8px) 밀렸다. 1×1 대상은 (3,5) → (3.5,5.5) 이다.
 *
 * `visible === null` 은 "뷰포트를 모른다"는 뜻이다. 조수 자동 이동에서는 판정 불가를 이동으로 바꾸면
 * 이미 보고 있는 화면을 빼앗으므로 포기한다. 사용자가 직접 누른 이동은 그대로 간다.
 */
export function planCameraFocus(
  target: CameraFocusTarget,
  map: { readonly width: number; readonly height: number },
  visible: VisibleTileRect | null,
  marginTiles = 1,
  fit?: { readonly currentZoom: number; readonly zoomLevels: readonly number[] }
): CameraFocusPlan | null {
  const raw = focusRect(target);
  if (![map.width, map.height].every(Number.isFinite) || map.width <= 0 || map.height <= 0) return null;
  const keep = raw && clipCameraFocusBounds(raw, map);
  if (keep === null) return null;
  if (visible && ![visible.x, visible.y, visible.width, visible.height].every(Number.isFinite)) visible = null;
  marginTiles = Number.isFinite(marginTiles) ? Math.max(0, marginTiles) : 1;

  const centerX = keep.x + keep.width / 2;
  const centerY = keep.y + keep.height / 2;
  // 맵 경계 판정은 내림한 중심으로 한다 — 40 폭 맵에서 39.5 는 마지막 타일의 중앙이라 유효하고,
  // 정확히 40.0 은 맵 밖이다.
  const tileX = Math.floor(centerX);
  const tileY = Math.floor(centerY);
  if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return null;

  const center: CameraFocusPlan = { centerTileX: centerX, centerTileY: centerY };
  const suggestedZoom = suggestFitZoom(target, keep, visible, marginTiles, fit);
  const withZoom: CameraFocusPlan =
    suggestedZoom === null ? center : { ...center, zoom: suggestedZoom };

  if (!target.onlyIfOffscreen) return withZoom;
  if (visible === null || visible.width <= 0 || visible.height <= 0) return null;

  const fitsInView = keep.width + marginTiles * 2 <= visible.width && keep.height + marginTiles * 2 <= visible.height;
  if (fitsInView) {
    const inside =
      keep.x - marginTiles >= visible.x &&
      keep.y - marginTiles >= visible.y &&
      keep.x + keep.width + marginTiles <= visible.x + visible.width &&
      keep.y + keep.height + marginTiles <= visible.y + visible.height;
    return inside ? null : withZoom;
  }

  // 화면보다 큰 대상: 중심이 화면 중앙 절반 안에 있으면 이미 보고 있다.
  // 줌 맞춤은 화면 밖일 때만 — 보고 있는 자리를 줌 아웃으로 빼앗지 않는다.
  const coreX = visible.x + visible.width / 4;
  const coreY = visible.y + visible.height / 4;
  const centerInCore =
    centerX >= coreX &&
    centerY >= coreY &&
    centerX <= coreX + visible.width / 2 &&
    centerY <= coreY + visible.height / 2;
  return centerInCore ? null : withZoom;
}

/**
 * 대상이 현재 줌으로 안 들어오면 낮출 줌을 고른다. 줌을 올리는 제안은 하지 않는다.
 *
 * 가시 폭/높이(타일)는 줌에 반비례하므로 후보 줌에서의 폭은 visibleSpan * currentZoom / candidate 다.
 * 후보 중 다 담기는 가장 큰 값이 최선이고, 어떤 후보로도 다 담기지 않으면(예: 40×40 대상 vs 20×12 화면)
 * 가장 낮은 후보를 제안한다 — 최대한 물러나는 것이 그래도 사용자가 보려는 영역을 가장 많이 보여준다.
 */
function suggestFitZoom(
  target: CameraFocusTarget,
  keep: CameraFocusBounds,
  visible: VisibleTileRect | null,
  marginTiles: number,
  fit?: { readonly currentZoom: number; readonly zoomLevels: readonly number[] }
): number | null {
  if (!fit || !target.bounds) return null;
  if (!visible || visible.width <= 0 || visible.height <= 0) return null;
  const current = fit.currentZoom;
  if (!Number.isFinite(current) || current <= 0) return null;

  const needWidth = keep.width + marginTiles * 2;
  const needHeight = keep.height + marginTiles * 2;
  const fitsAt = (zoom: number): boolean =>
    (visible.width * current) / zoom >= needWidth && (visible.height * current) / zoom >= needHeight;
  if (fitsAt(current)) return null;

  const candidates = fit.zoomLevels
    .filter((zoom) => Number.isFinite(zoom) && zoom > 0 && zoom < current)
    .sort((a, b) => a - b);
  if (candidates.length === 0) return null;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const zoom = candidates[index];
    if (fitsAt(zoom)) return zoom;
  }
  return candidates[0];
}

/** 지금 진행 중인 사용자 제스처. EditScene 이 자기 상태를 그대로 채워 넣는다. */
export interface PointerGestureState {
  /** 좌클릭 페인트 스트로크 중. */
  readonly painting: boolean;
  /** 카메라 팬(스페이스·휠클릭 드래그) 중. */
  readonly panning: boolean;
  /** 사각형/선/타원 드래그, 선택 드래그, 이벤트 이동 드래그 중이거나 그 후보를 잡고 있다. */
  readonly dragging: boolean;
  /** 우클릭 영역 제스처(영역 AI) 중. */
  readonly rightRegionGesture: boolean;
  /** 붙여넣기 미리보기가 커서를 따라다니는 중. */
  readonly pastePreview: boolean;
}

/**
 * 프로그램 카메라 이동을 미뤄야 하는가 — 사용자의 손이 화면 위에 있으면 카메라를 빼앗지 않는다.
 *
 * 취향 문제가 아니라 **데이터 손상**이다. 드래그의 끝 타일은 `pointerToTile(ptr)` 이 살아 있는
 * 카메라로 계산하므로(EditScene.pointerToTile), 드래그 중에 카메라가 300ms 팬하면
 * `DragOperationHandler.finish` 가 팬 거리만큼 밀린 타일을 커밋한다 — 도형은 엉뚱한 자리에
 * 칠해지고(commitShapeDrag → paintTilesBulk) 이벤트는 다른 칸에 놓인다(commitEventMoveDrag →
 * moveEvent). 우클릭 영역 제스처(finishRightRegionGesture)와 붙여넣기 확정도 같은 경로다.
 *
 * `painting` 만 보면 안 되는 이유: pointerdown 은 `beginDragOperation` 이 true 를 돌려주면
 * `isPainting = true` 를 **세우기 전에** 반환하고, `beginRightRegionGesture` 는 오히려
 * `isPainting = false` 로 내린다. 즉 모든 드래그 제스처에서 painting 은 거짓이다.
 * 조수의 자동 카메라 이동(focusAcceptedAgentChanges)은 사용자 클릭 없이 비동기로 들어오므로
 * 이 조합이 실제로 겹친다.
 */
export function shouldDeferCameraFocus(gesture: PointerGestureState): boolean {
  return gesture.painting
    || gesture.panning
    || gesture.dragging
    || gesture.rightRegionGesture
    || gesture.pastePreview;
}

function focusRect(target: CameraFocusTarget): CameraFocusBounds | null {
  const bounds = target.bounds;
  if (bounds) {
    if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      || bounds.width < 1 || bounds.height < 1) return null;
    return { x: Math.floor(bounds.x), y: Math.floor(bounds.y), width: Math.trunc(bounds.width), height: Math.trunc(bounds.height) };
  }
  // 정수를 요구하지 않는다 — 기존 소비자(이벤트 목록 행)의 값이 정수라고 타입에만 적혀 있고
  // 런타임 검증은 없었다. 여기서 새로 거부하면 조용히 이동이 사라진다.
  if (!Number.isFinite(target.tileX) || !Number.isFinite(target.tileY)) return null;
  return { x: Math.floor(target.tileX), y: Math.floor(target.tileY), width: 1, height: 1 };
}

/** Intersect with the addressed map; never fit or highlight coordinates belonging outside it. */
export function clipCameraFocusBounds(bounds: CameraFocusBounds, map: { width: number; height: number }): CameraFocusBounds | null {
  const x = Math.max(0, bounds.x);
  const y = Math.max(0, bounds.y);
  const right = Math.min(map.width, bounds.x + bounds.width);
  const bottom = Math.min(map.height, bounds.y + bounds.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}
