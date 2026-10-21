// player/cameraScreen.ts
// 세계 좌표 → 카메라 화면 좌표(카메라 px). Phaser 카메라는 origin(기본 0.5) 기준으로 확대하므로 (y - scrollY) * zoom 은
// 배율 ≠ 1 에서 화면 절반만큼 어긋난다. worldView 는 preRender 에서야 갱신되어 맵을 막 옮긴 같은 틱(시작 자동 실행 대사)에는
// 옛 값이다 — 그래서 scroll·origin·zoom 으로 직접 계산하고, 경계(useBounds)는 preRender 처럼 clamp 해서 쓴다.
type CameraLike = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly width?: number;
  readonly height?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly useBounds?: boolean;
  clampX?(x: number): number;
  clampY?(y: number): number;
};

/** 화면(카메라 px)에서 보이는 세계 사각의 왼쪽 위. */
export function cameraViewOrigin(camera: CameraLike): { readonly left: number; readonly top: number } {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const sx = camera.useBounds && typeof camera.clampX === "function" ? camera.clampX(camera.scrollX) : camera.scrollX;
  const sy = camera.useBounds && typeof camera.clampY === "function" ? camera.clampY(camera.scrollY) : camera.scrollY;
  if (zoom === 1) return { left: sx, top: sy };
  const ox = camera.originX ?? 0.5;
  const oy = camera.originY ?? 0.5;
  return {
    left: sx + ox * (camera.width ?? 0) * (1 - 1 / zoom),
    top: sy + oy * (camera.height ?? 0) * (1 - 1 / zoom),
  };
}
