// assets/bgmOnDemand.ts
// 데스크톱 앱(app://)은 카탈로그 BGM 281곡을 다 싣지 않고 처음 재생할 때 한 곡씩 받는다(electron/main/bgmOnDemand.ts).
// 렌더러는 preload 가 준 플래그 하나로 그것을 안다. 웹 호스트에는 브리지가 없어 false 다.

export function isDesktopBgmOnDemand(): boolean {
  return typeof window !== "undefined" && window.oprn?.bgmOnDemand === true;
}
