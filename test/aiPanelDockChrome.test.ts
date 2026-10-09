// test/aiPanelDockChrome.test.ts
// 조수 패널의 **메타 진입점이 CSS 로 지워지지 않는가** 를 원문으로 잠근다.
//
// 왜 CSS 원문인가: 이 결함은 DOM 에는 버튼이 있고 CSS 가 그것을 지우는 형태였다. fakeDom
// 단위 테스트는 스타일시트를 읽지 않으므로 통과하고(실제로 통과했다), 브라우저 스펙은
// 이 저장소에서 부팅 15초 게이트에 걸려 흔들린다. 그래서 규칙 자체를 텍스트로 검사한다 —
// 값싸고 결정적이며, 다시 숨기려는 편집을 정확히 그 자리에서 막는다.
//
// 사실관계: 헤더 밴드는 2026-08-28 에 폐기됐고 `.ai-chat-toolbar` 는 hidden + inert +
// is-empty 인 테스트 훅 컨테이너로만 남았다(헤더 ☰ 실측 rect 0×0). 그런데 "유리·사이드는
// 헤더가 있으니 컴포저 ☰ 는 중복" 이라는 옛 근거의 display:none 이 남아 있어서, 당시
// 기본 도크(유리)와 사이드에는 이전 대화·감독 지침으로 갈 길이 없었다.
//
// 2026-08-31: 도크 축이 걷혀 표면은 캡슐 하나다. 그래서 도크별 대조군(유리에서는 숨는다)은
// 검사할 대상이 없어졌고, 남은 계약은 "어떤 규칙도 컴포저 ☰ 를 숨기지 않는다" 한 줄이다.
// 조수가 붙는 자리가 하나뿐이므로 이 진입점을 숨기면 곧바로 도달 불가가 된다.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOCK_CSS = readFileSync("src/styles/database/tabs-b-assistant-panel/02-chat-dock.css", "utf8");

/** `display: none` 을 주는 규칙들의 선택자 목록만 뽑는다(주석 안의 언급은 제외한다). */
function hiddenSelectors(css: string): readonly string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = match[2] ?? "";
    if (!/display:\s*none/.test(body)) continue;
    selectors.push(...(match[1] ?? "").split(",").map((part) => part.trim()).filter(Boolean));
  }
  return selectors;
}

describe("조수 메타 진입점", () => {
  it("Given 유일한 표면 When 컴포저 ☰ Then display:none 규칙이 없다(유일한 진입점이다)", () => {
    const hidden = hiddenSelectors(DOCK_CSS).filter((selector) => selector.includes(".ai-command-menu-toggle"));

    expect(hidden).toEqual([]);
  });

  it("Given 같은 파일 When 도크 선택자 Then 어느 규칙도 도크 클래스를 짚지 않는다", () => {
    // 위 검사가 "display:none 을 통째로 지웠다" 로 통과하는 것을 막는 대조군 겸,
    // 도크 축이 CSS 로 되살아나는 것을 막는 자리다.
    const dockScoped = hiddenSelectors(DOCK_CSS).filter((selector) => /chat-dock-(glass|side)\b/.test(selector));

    expect(dockScoped).toEqual([]);
  });
});
