// editor/automationBootContext.ts
// 자동화 부팅 판정의 단일 정본.
//
// 왜 합쳤나 (2026-09-11): 같은 이름의 함수가 editorWelcome.ts 와 teamWorkflowUi.ts 에
// 두 벌 있었고 **판정 집합이 달랐다** — 앞쪽만 ?forceWelcome=1 예외를 알고 있었다.
// 그래서 디버깅용으로 welcome 을 띄우면 로그인 벽은 그대로 억제돼, "자동화라서 안 뜬다" 는
// 서로 다른 두 규칙을 기억해야 했다. 첫 화면 QA 가 두 판정을 모두 통과해야 했다.

/**
 * e2e/dev 부팅 문맥 — 플로팅 첫 방문 UI(웰컴 브리핑·로그인 모달)가 표면을 가로채면 안 되는 곳.
 *
 * `?forceWelcome=1` 은 의도적 예외다: 브라우저 검증·도그푸딩에서 실제 사람 첫 방문을
 * 재현하려고 webdriver 억제를 끈다.
 */
export function isAutomationBootContext(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location?.search ?? "";
  const params = new URLSearchParams(search);
  if (params.has("forceWelcome")) return false;
  if (window.__OPRN_E2E_PROJECT__) return true;
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return (
    params.has("freshProject")
    || params.has("devProject")
    || params.has("blankProject")
    || params.has("aiBridge")
    || params.has("softConfirm")
    || params.has("sc2")
    || params.has("sc3")
  );
}

/**
 * ?forceWelcome=1 — 브라우저 검증·도그푸딩에서 사람 첫 방문을 재현하는 명시적 예외.
 * 자동화 억제를 끌 뿐 아니라, 첫 방문 데모가 뜬 상태에서도 웰컴 브리핑을 강제로 올린다.
 */
export function isForcedWelcomeRehearsal(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location?.search ?? "").has("forceWelcome");
}
