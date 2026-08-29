// 지난 턴 요약이 10px 회색 띠로 눌리는 결함의 CSS 계약 (2026-08-30).
//
// 실측(.omo/evidence/assistant-glass-fold/): 복원된 16턴 대화에서 `.ai-turn-group` 15개가
// 전부 h=10px 인데 각자의 scrollHeight 는 43px 이었다. 안에 든 `.ai-turn-group-toggle` 은
// 35px(font 12px + padding 8/10) 로 정상이었고 텍스트도 DOM 에 있었다 — 즉 불러오기 실패가
// 아니라 그룹이 자기 자식을 잘라낸 것이다. glass·side 두 도크 모두 같았다.
//
// 원인: `.ai-chat-log` 은 column flex 컨테이너이고(03-three-tier-ia.css) 그룹은 flex 아이템이다.
// flex 아이템의 자동 최소 크기(min-height:auto)는 `overflow: visible` 일 때만 콘텐츠 크기로
// 해석된다 — `.ai-turn-group` 의 `overflow: hidden` 이 그 값을 0 으로 떨어뜨려, 로그가 넘칠 때
// 기본 `flex-shrink: 1` 이 결손을 전부 그룹들에 몰았다. 로그는 `overflow: auto` 스크롤러이므로
// 자식은 줄지 말고 넘쳐야 한다.
//
// 이 계약은 브라우저 레이아웃 결과라 fakeDom 으로는 못 잡는다. CSS 원문을 읽어 잠근다
// (선례: test/aiGlassPanelWidth.test.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DENSITY_CSS = "src/styles/database/tabs-b-assistant-panel/09-ux-polish-density.css";
const IA_CSS = "src/styles/database/tabs-b-assistant-panel/03-three-tier-ia.css";

function readCss(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "mu"));
  return match?.[1] ?? "";
}

describe("지난 턴 그룹은 로그의 flex 결손을 흡수하지 않는다", () => {
  it(".ai-turn-group 은 flex-shrink 를 끈다 — overflow:hidden 이 자동 최소 크기를 0 으로 만들기 때문", () => {
    const body = ruleBody(readCss(DENSITY_CSS), ".ai-turn-group");
    expect(body).not.toBe("");
    // overflow:hidden 이 남아 있는 한(카드 모서리 클리핑에 필요) 최소 크기 보호가 반드시 필요하다.
    expect(body).toMatch(/overflow:\s*hidden/u);
    expect(body).toMatch(/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/u);
  });

  it(".ai-chat-log 는 여전히 column flex 스크롤러다 — 이 전제가 깨지면 위 규칙의 이유가 사라진다", () => {
    const body = ruleBody(readCss(IA_CSS), ".ai-chat-log");
    expect(body).toMatch(/display:\s*flex/u);
    expect(body).toMatch(/flex-direction:\s*column/u);
    expect(body).toMatch(/overflow(-y)?:\s*auto/u);
  });
});
