import type { MapId } from "@/project/types";

/**
 * 좌측 사이드바 이벤트 목록 등 DOM-side UI가 "이 타일로 카메라를 보내달라"고
 * EditScene(Phaser)에 요청할 때 쓰는 단방향 pub/sub.
 * store/editorState와 달리 카메라 위치는 Phaser 씬 상태이므로 별도 채널을 둔다.
 */

export interface CameraFocusTarget {
  /** 이벤트가 있는 맵. 현재 EditScene이 보고 있는 맵과 다르면 무시된다. */
  readonly mapId: MapId;
  /** 카메라를 중심에 둘 타일 X (정수). */
  readonly tileX: number;
  /** 카메라를 중심에 둘 타일 Y (정수). */
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
