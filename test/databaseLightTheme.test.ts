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
    const selectors = css.match(/[^{}]+(?=\s*\{)/gu) ?? [];
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

  /**
   * `@import` 그래프를 깊이우선으로 펼쳐 **실제 로드 순서**를 만든다.
   *
   * 예전 판은 `index.css` 의 한 줄짜리 임포트 목록만 훑고 `dock.css` 라는 **파일명**을
   * 찾았다. 그 파일이 `database-modal-docked.css` 로 개명하고 배럴 아래로 내려가자
   * 검사는 "임포트가 없다" 로 죽었다 — 캐스케이드는 그대로였는데도. 파일명이 아니라
   * 순서를 재야 개명에 부러지지 않고, 배럴을 거쳐 들어오는 규칙도 같이 잡힌다.
   */
  function flattenImports(entry: string, seen = new Set<string>()): string[] {
    if (seen.has(entry)) return [];
    seen.add(entry);
    const order: string[] = [];
    for (const line of read(entry).split("\n")) {
      const match = /^\s*@import\s+"([^"]+)"/u.exec(line);
      if (!match) continue;
      const target = resolve(root, entry, "..", match[1]).slice(`${root}/`.length);
      order.push(target, ...flattenImports(target, seen));
    }
    return order;
  }

  it("라이트 팔레트가 도킹 레이아웃보다 나중에 로드된다", () => {
    const order = flattenImports("src/styles/index.css");
    const lightIndex = order.indexOf("src/styles/database/light-theme.css");
    const dockedIndex = order.indexOf("src/styles/database/database-modal-docked.css");
    expect(
      lightIndex,
      "light-theme.css 가 로드 그래프에 없다 — 라이트 팔레트가 아예 적용되지 않는다.",
    ).toBeGreaterThanOrEqual(0);
    expect(
      dockedIndex,
      "database-modal-docked.css 가 로드 그래프에 없다 — DB 모달 사이드 도킹이 스타일 없이 뜬다.",
    ).toBeGreaterThanOrEqual(0);
    expect(
      lightIndex,
      "light-theme.css 는 도킹 레이아웃 다음에 와야 한다 — 앞서면 도킹 규칙이 팔레트를 덮는다.",
    ).toBeGreaterThan(dockedIndex);
  });
});
