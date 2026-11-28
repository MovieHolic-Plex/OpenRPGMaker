// 화면 오른쪽 아래 구석에 앱 버전을 작게 항상 보여 준다 — 사용자 스크린샷만 봐도 어느 판인지 알 수 있게(개발 편의).
// 시작 화면·편집기·플레이 모두 같은 body 위 오버레이라 진입점이 한 번만 부른다(src/main.ts).
// 클릭·선택을 가로채지 않는다(pointer-events: none). 자세한 커밋·빌드 시각은 도움말 「버전」 줄과 window.__oprnVersion().
import { APP_VERSION } from "@/brand";

const TAG_TESTID = "app-version-tag";

export function mountVersionTag(): void {
  if (typeof document === "undefined" || document.querySelector(`[data-testid="${TAG_TESTID}"]`)) return;
  const tag = document.createElement("div");
  tag.dataset.testid = TAG_TESTID;
  tag.textContent = `v${APP_VERSION}`;
  tag.setAttribute("aria-hidden", "true");
  Object.assign(tag.style, {
    position: "fixed",
    right: "6px",
    bottom: "3px",
    zIndex: "2147483000",
    fontSize: "10px",
    lineHeight: "1",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    color: "var(--muted-foreground, currentColor)",
    opacity: "0.45",
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "nowrap",
  });
  document.body.append(tag);
}
