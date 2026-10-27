// 숨겨 둔 앱 창을 처음 보일 때의 순서. Electron 을 부르지 않는다 — 메인(main.ts)과 테스트가 같은 표를 본다.
//
// 창은 숨긴 채 만들고, 보일 때 전체화면으로 연다. 리눅스는 생성자에 fullscreen 을 주면 show:false 여도
// 빈 창이 바로 뜬다. macOS 는 숨은 창에 전체화면을 걸면 무시될 수 있어 보인 뒤에 건다.

export type FirstShowStep = "show" | "fullscreen";

/** 아직 한 번도 보이지 않은 앱 창을 처음 보일 때. 이미 보였던 창에는 쓰지 않는다(사용자가 나온 전체화면을 다시 켜지 않게). */
export function firstShowSteps(platform: string): readonly FirstShowStep[] {
  return platform === "darwin" ? ["show", "fullscreen"] : ["fullscreen", "show"];
}
