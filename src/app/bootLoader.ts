// 첫 로드 로더(index.html 의 #oprn-boot-loader) 걷어내기.
// 로더는 JS 없이 HTML 만으로 그려지는 고정 오버레이라, 편집기가 지우지 않으면 계속 덮는다
// (bootApp 은 #app 을 비우지 않고 append 한다). 편집기 셸 마운트·부팅 실패 화면 양쪽에서 부른다.

const BOOT_LOADER_ID = "oprn-boot-loader";

/** 멱등. 로더가 없으면(플레이어·테스트·두 번째 호출) 아무것도 안 한다. */
export function dismissBootLoader(): void {
  // 테스트의 가짜 document(test/fakeDom.ts)는 getElementById 가 없다 — 부팅 경로를 깨지 않게 조용히 넘어간다.
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
  const loader = document.getElementById(BOOT_LOADER_ID);
  if (!loader || loader.dataset.leaving !== undefined) return;
  loader.dataset.leaving = "";
  // 페이드아웃 뒤 DOM 에서 뺀다. reduced-motion(transition:none)이면 transitionend 가 안 오므로 시간으로.
  setTimeout(() => loader.remove(), 200);
}
