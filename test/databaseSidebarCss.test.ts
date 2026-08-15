// DB UI 현대화 W2, todo 3 — 사이드바 CSS + 도크 아이콘 레일.
//
// 시각 중심 작업이라 fakeDom 대신 CSS 파일 텍스트를 직접 검증한다
// (databaseLightTheme.test.ts 와 동일한 방식). 지켜야 할 불변식:
//   1. 모든 규칙이 `.database-modal-backdrop` 하위에 스코프 — 전역 :root/셸 침범 금지.
//   2. `:root` 선택자 금지.
//   3. 세로 사이드바 폭이 200-220px 요구 범위(구현값 210px).
//   4. `.is-docked` 레일 변형 존재 + 레일 폭 ≤56px(구현값 48px).
//   5. index.css 에서 light-theme.css 다음에 로드 — 팔레트/탭 스트립 규칙을 덮는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

/** 주석을 제거해 선택자 수준 검사를 정확하게 한다(주석의 `:root` 언급은 무시). */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

describe("DB 사이드바 CSS (W2, todo 3)", () => {
  it("sidebar.css 가 .database-modal-backdrop 스코프 선택자를 포함한다", () => {
    const css = read("src/styles/database/sidebar.css");
    expect(
      css,
      "sidebar.css 에 .database-modal-backdrop 스코프가 없다 — " +
        "사이드바 스타일이 DB 모달 밖으로 새어나가거나 파일이 비어 있다.",
    ).toContain(".database-modal-backdrop");
  });

  it("sidebar.css 는 :root 선택자를 포함하지 않는다 (전역/토큰 침범 금지)", () => {
    const css = stripCssComments(read("src/styles/database/sidebar.css"));
    expect(css, "sidebar.css 에 :root 선택자가 있다 — 전역 토큰/셸을 건드리면 안 된다.").not.toMatch(/:root/);
  });

  it("sidebar.css 의 모든 규칙 선택자가 .database-modal-backdrop 하위에 스코프된다", () => {
    const css = stripCssComments(read("src/styles/database/sidebar.css"));
    const selectors = css.match(/[^{}]+(?=\s*\{)/gu) ?? [];
    expect(selectors.length, "sidebar.css 에 규칙이 하나도 없다").toBeGreaterThan(0);
    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (trimmed.length === 0) continue;
      expect(
        trimmed,
        `스코프 밖 선택자 발견: "${trimmed}" — 모든 규칙은 .database-modal-backdrop 하위여야 한다.`,
      ).toMatch(/^\.database-modal-backdrop/);
    }
  });

  it("세로 사이드바 폭이 180-220px 범위다 (구현값 210px)", () => {
    const css = stripCssComments(read("src/styles/database/sidebar.css"));
    const widths = css.match(/width:\s*(\d+)px/g) ?? [];
    // 창 모드 .db-tabs 폭: 200-220px 요구 범위의 구현값.
    expect(widths, "sidebar.css 에 .db-tabs 폭 선언이 없다").toContain("width: 210px");
  });

  it("도크 레일(.is-docked) 변형이 존재하고 레일 폭이 ≤56px 다 (구현값 48px)", () => {
    const css = stripCssComments(read("src/styles/database/sidebar.css"));
    expect(css, "sidebar.css 에 .is-docked 레일 변형이 없다 — 도크 모드가 아이콘 레일로 축소되지 않는다.").toContain(
      ".database-modal-backdrop.is-docked",
    );
    expect(css, "도크 레일 폭 선언이 없다").toContain("width: 48px");
    // 레일에서 라벨 텍스트가 숨겨진다(font-size: 0 — title 속성 툴팁은 유지).
    expect(css, "도크 레일에서 .db-tab 라벨 숨김이 없다").toMatch(/\.db-tab\s*\{[^}]*font-size:\s*0/);
  });

  it("index.css 가 sidebar.css 를 light-theme.css 다음에 임포트한다", () => {
    const indexCss = read("src/styles/index.css");
    const dbImports = indexCss
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith('@import "./database/'));
    const lightIndex = dbImports.findIndex((line) => line.includes("light-theme.css"));
    const sidebarIndex = dbImports.findIndex((line) => line.includes("sidebar.css"));
    expect(lightIndex, "index.css 에 ./database/light-theme.css 임포트가 없다").toBeGreaterThanOrEqual(0);
    expect(
      sidebarIndex,
      "index.css 에 ./database/sidebar.css 임포트가 없다 — 사이드바 스타일이 로드되지 않는다.",
    ).toBeGreaterThanOrEqual(0);
    expect(
      sidebarIndex,
      "sidebar.css 는 light-theme.css 다음에 와야 한다 — 팔레트/탭 스트립 규칙을 덮어써야 한다.",
    ).toBeGreaterThan(lightIndex);
  });
});
