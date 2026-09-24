/**
 * 런타임(게임 화면) 시트 ~570KB 는 편집기 첫 화면에 싣지 않는다. 런타임 DOM 을 그리는 표면 —
 * 플레이 모드, 테스트 플레이, 자료집·이벤트 편집기의 미리보기 — 이 열릴 때 이것을 부른다.
 * 출하 플레이어(src/player/player.css)는 이 경로와 무관하게 즉시 싣는다.
 *
 * 거절하지 않는다: 시트 로드 실패가 표면을 막으면 안 된다. 실패하면 다음 호출이 다시 시도한다.
 */
let pending: Promise<void> | null = null;

export function preloadRuntimeStyles(): Promise<void> {
  if (!pending) {
    pending = import("@/app/runtimeStylesheet").then(
      () => undefined,
      (error: unknown) => {
        pending = null;
        console.warn("[runtime-styles] 런타임 시트를 읽지 못했다:", error);
      },
    );
  }
  return pending;
}
