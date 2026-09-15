// util/reducedMotion.ts
// `prefers-reduced-motion: reduce` 의 단일 창구.
//
// 조수의 화면 이동은 두 동작이 한 몸이다 — 맵 전환 크로스페이드(mapDissolveVeil)와
// 카메라 팬(EditScene.panCameraToTile). 둘이 각자 matchMedia 를 읽으면 한쪽만 꺼져
// 「즉시 갈아 끼운 뒤 300ms 팬」 같은 반쪽 상태가 나온다.

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
