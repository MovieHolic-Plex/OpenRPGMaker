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
  /** 카메라를 중심에 둘 타일 X (정수). */
  readonly tileX: number;
  /** 카메라를 중심에 둘 타일 Y (정수). */
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

/** 지금 화면에 실제로 보이는 타일 사각형. Phaser camera.worldView 에서 만든다. */
export interface VisibleTileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 카메라를 어느 타일 중심으로 보낼지. null 이면 움직이지 않는다. */
export interface CameraFocusPlan {
  readonly tileX: number;
  readonly tileY: number;
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
 */
export function planCameraFocus(
  target: CameraFocusTarget,
  map: { readonly width: number; readonly height: number },
  visible: VisibleTileRect | null,
  marginTiles = 1
): CameraFocusPlan | null {
  const keep = focusRect(target);
  if (keep === null) return null;
  if (map.width <= 0 || map.height <= 0) return null;

  const centerX = Math.floor(keep.x + keep.width / 2);
  const centerY = Math.floor(keep.y + keep.height / 2);
  if (centerX < 0 || centerY < 0 || centerX >= map.width || centerY >= map.height) return null;

  if (!target.onlyIfOffscreen || visible === null || visible.width <= 0 || visible.height <= 0) {
    return { tileX: centerX, tileY: centerY };
  }

  const fitsInView = keep.width + marginTiles * 2 <= visible.width && keep.height + marginTiles * 2 <= visible.height;
  if (fitsInView) {
    const inside =
      keep.x - marginTiles >= visible.x &&
      keep.y - marginTiles >= visible.y &&
      keep.x + keep.width + marginTiles <= visible.x + visible.width &&
      keep.y + keep.height + marginTiles <= visible.y + visible.height;
    return inside ? null : { tileX: centerX, tileY: centerY };
  }

  // 화면보다 큰 대상: 중심이 화면 중앙 절반 안에 있으면 이미 보고 있다.
  const coreX = visible.x + visible.width / 4;
  const coreY = visible.y + visible.height / 4;
  const centerInCore =
    centerX >= coreX &&
    centerY >= coreY &&
    centerX <= coreX + visible.width / 2 &&
    centerY <= coreY + visible.height / 2;
  return centerInCore ? null : { tileX: centerX, tileY: centerY };
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
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    return {
      x: Math.trunc(bounds.x),
      y: Math.trunc(bounds.y),
      width: Math.trunc(bounds.width),
      height: Math.trunc(bounds.height),
    };
  }
  // 정수를 요구하지 않는다 — 기존 소비자(이벤트 목록 행)의 값이 정수라고 타입에만 적혀 있고
  // 런타임 검증은 없었다. 여기서 새로 거부하면 조용히 이동이 사라진다.
  if (!Number.isFinite(target.tileX) || !Number.isFinite(target.tileY)) return null;
  return { x: Math.trunc(target.tileX), y: Math.trunc(target.tileY), width: 1, height: 1 };
}
