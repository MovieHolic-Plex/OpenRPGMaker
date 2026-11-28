// editor/editorCameraViewport.ts
// EditScene 카메라가 지금 비추고 있는 월드 사각형·줌을 플로팅 미니맵 HUD와 캔버스 포털 오버레이에 전달한다.

export interface EditorCameraViewport {
  /** 이 사각형이 속한 맵. 맵 전환 직후 옛 맵의 px 값을 새 맵에 대입하지 않도록 소비자가 대조한다. */
  readonly mapId?: string;
  readonly mapWidthPx: number;
  readonly mapHeightPx: number;
  readonly viewX: number;
  readonly viewY: number;
  readonly viewWidthPx: number;
  readonly viewHeightPx: number;
  readonly zoom: number;
  /** Phaser 월드 좌표계 기준 캔버스 좌상단 (0,0) 의 월드 위치. */
  readonly worldViewX?: number;
  readonly worldViewY?: number;
  /** Phaser 캔버스의 뷰포트(client) 좌상단 좌표. */
  readonly canvasX?: number;
  readonly canvasY?: number;
}

type ViewportListener = (viewport: EditorCameraViewport) => void;

let currentViewport: EditorCameraViewport | null = null;
const listeners = new Set<ViewportListener>();

export function publishEditorCameraViewport(viewport: EditorCameraViewport): void {
  currentViewport = viewport;
  for (const listener of listeners) listener(viewport);
}

export function getEditorCameraViewport(): EditorCameraViewport | null {
  return currentViewport;
}

export function subscribeEditorCameraViewport(listener: ViewportListener): () => void {
  listeners.add(listener);
  if (currentViewport) listener(currentViewport);
  return () => {
    listeners.delete(listener);
  };
}
