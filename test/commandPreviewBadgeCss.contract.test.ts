// test/commandPreviewBadgeCss.contract.test.ts
// 계약(event-editor-actor-battle-post-rm plan §3):
//   이벤트 에디터 커맨드 미리보기의 배지(.ecp-gold-badge / .ecp-battle-badge /
//   .ecp-exp-badge / .ecp-skill-badge)는 텍스트 색(color)이 자기 배경
//   (background)과 달라야 한다. 같으면 배지가 배경에 묻혀 읽을 수 없다.
//
// 이 계약은 실제 스타일 시트에 선언된 색/배경 토큰의 관계를 검증한다. 현재 실측
// 상태는 전 배지가 color == backgroundColor 이라 RED 다. CSS 가 고쳐진 뒤에만 GREEN.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 배지 스타일이 선언된 커맨드 프리뷰 CSS 파일.
const CSS_FILE = new URL(
  "../src/styles/editor/event-editor.command-preview/02-changeface-play-mock-larger.css",
  import.meta.url,
);

const BADGE_SELECTORS = [
  ".ecp-gold-badge",
  ".ecp-battle-badge",
  ".ecp-exp-badge",
  ".ecp-skill-badge",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** selector 로 시작하는 css 규칙 블록을 추출한다. */
function ruleBlock(source: string, selector: string): string {
  const match = source.match(
    new RegExp(`(?:^|\\n)\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`),
  );
  if (!match) throw new Error(`no css rule for ${selector}`);
  return match[1];
}

/** 블록에서 color/background 선언 값을 가져온다. */
function declaredValue(block: string, property: "color" | "background"): string {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`no ${property} declaration in block:\n${block}`);
  return match[1].trim();
}

/** 값에 쓰인 var(--token) 이름들을 전부 추출한다. */
function varTokens(value: string): string[] {
  return [...value.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
}

/**
 * color 값이 단일 var(--token) 이면 토큰 이름, 그렇지 않으면 리터럴 값 그대로.
 * 배경과 "같은 재질" 인지를 비교하기 위한 정규화다.
 */
function resolveColorToken(value: string): string {
  const tokens = varTokens(value);
  return tokens.length === 1 ? tokens[0] : value;
}

describe("command preview badge css", () => {
  const css = readFileSync(CSS_FILE, "utf8");

  it("모든 프리뷰 배지가 배경과 구분되는 텍스트 색을 선언한다 (red until CSS fixed)", () => {
    for (const selector of BADGE_SELECTORS) {
      const block = ruleBlock(css, selector);
      const color = declaredValue(block, "color");
      const background = declaredValue(block, "background");
      const bgTokens = varTokens(background);
      const resolvedColor = resolveColorToken(color);

      // 배경이 var(--token) 들로 이뤄진 경우 색 토큰이 그 중 하나면 색 == 배경.
      // 배경에 var() 가 없으면(리터럴) 색 리터럴이 배경 문자열에 포함되면 색 == 배경.
      const sameAsBackground =
        bgTokens.includes(resolvedColor) ||
        (bgTokens.length === 0 && background.includes(resolvedColor));

      expect(
        sameAsBackground,
        `${selector}: color(${color}) 는 background(${background}) 와 달라야 한다`,
      ).toBe(false);
    }
  });
});
