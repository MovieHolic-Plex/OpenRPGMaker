// 숨겨 둔 앱 창을 처음 보일 때의 순서. Electron 을 부르지 않는다 — 메인(main.ts)과 테스트가 같은 표를 본다.
//
// 창은 숨긴 채 만들고, 보일 때 기본 창 모드(1280×800)로 연다. 전체화면은 사용자가 직접 전환할 때만 켠다.

export type FirstShowStep = "show" | "fullscreen";

/** 아직 한 번도 보이지 않은 앱 창을 처음 보일 때. 모든 플랫폼에서 전체화면을 강제하지 않고 창만 보인다. */
export function firstShowSteps(_platform: string): readonly FirstShowStep[] {
  return ["show"];
}
