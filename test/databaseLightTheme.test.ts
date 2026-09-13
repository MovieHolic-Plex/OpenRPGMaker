// DB UI 현대화 W1 — 라이트 팔레트 스코프 검증.
//
// 사용자 결정 C: 데이터베이스 모달만 밝은 클래식(크림 기조), 앱 셸은 다크 유지.
// 이 검사는 light-theme.css 의 **스코프 경계**를 직접 본다(브라우저 e2e 는 계산 스타일을,
// 여기선 CSS 텍스트를 검증한다 — dialogueFaceRuntimeCss.test.ts 와 동일한 방식).
//
// 지켜야 할 불변식:
//   1. 모든 규칙이 `.database-modal-backdrop` 하위에 스코프 — 전역 :root/셸 침범 금지.
//   2. `:root` 선택자 금지(tokens.css 를 건드리지 않는다).
//   3. index.css 에서 dock.css 다음(마지막 database 임포트 블록)에 로드 — 다른
//      database CSS 가 라이트 팔레트를 덮어쓰지 못하게 캐스케이드 순서를 보장.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

/** 주석을 제거해 선택자 수준 검사를 정확하게 한다(주석의 `:root` 언급은 무시). */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

describe("DB 모달 라이트 팔레트 스코프 (W1)", () => {
  it("light-theme.css 가 .database-modal-backdrop 스코프 선택자를 포함한다", () => {
    const css = read("src/styles/database/light-theme.css");
    expect(
      css,
      "light-theme.css 에 .database-modal-backdrop 스코프가 없다 — " +
      "라이트 팔레트가 DB 모달 밖으로 새어나가거나 파일이 비어 있다.",
    ).toContain(".database-modal-backdrop");
  });

  it("light-theme.css 는 :root 선택자를 포함하지 않는다 (전역/토큰 침범 금지)", () => {
    const css = stripCssComments(read("src/styles/database/light-theme.css"));
    expect(css, "light-theme.css 에 :root 선택자가 있다 — 전역 토큰/셸을 건드리면 안 된다.").not.toMatch(/:root/);
  });

  it("light-theme.css 의 모든 규칙 선택자가 .database-modal-backdrop 하위에 스코프된다", () => {
    const css = stripCssComments(read("src/styles/database/light-theme.css"));
    // `@media`/`@supports` 프렐류드는 선택자가 아니다 — 내부 규칙은 따로 잡힌다.
    // #803 이 light-theme.css 에 첫 미디어 쿼리를 넣으면서 이 스캐너가 프렐류드를 선택자로 읽었다.
    const selectors = (css.match(/[^{}]+(?=\s*\{)/gu) ?? []).filter(
      (candidate) => !candidate.trim().startsWith("@"),
    );
    expect(selectors.length, "light-theme.css 에 규칙이 하나도 없다").toBeGreaterThan(0);
    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (trimmed.length === 0) continue;
      expect(
        trimmed,
        `스코프 밖 선택자 발견: "${trimmed}" — 모든 규칙은 .database-modal-backdrop 하위여야 한다.`,
      ).toMatch(/^\.database-modal-backdrop/);
    }
  });

  it("database 진입 시트가 light-theme.css 를 dock.css 다음에 임포트한다", () => {
    const indexCss = read("src/styles/database/index.css");
    const dbImports = indexCss
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith('@import "./'));
    const dockIndex = dbImports.findIndex((line) => line.includes("dock.css"));
    const lightIndex = dbImports.findIndex((line) => line.includes("light-theme.css"));
    expect(dockIndex, "database/index.css 에 ./dock.css 임포트가 없다").toBeGreaterThanOrEqual(0);
    expect(
      lightIndex,
      "database/index.css 에 ./light-theme.css 임포트가 없다 — 라이트 팔레트가 로드되지 않는다.",
    ).toBeGreaterThanOrEqual(0);
    expect(
      lightIndex,
      "light-theme.css 는 dock.css 다음(마지막 database 임포트 블록)에 와야 한다 — " +
      "뒤의 database CSS 가 라이트 팔레트를 덮어쓸 수 있다.",
    ).toBeGreaterThan(dockIndex);
  });
});
