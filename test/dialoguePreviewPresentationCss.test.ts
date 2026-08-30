// 에디터 프리뷰의 「말투·연출」 재생이 **런타임과 같은 연출인지** 지킨다.
//
// 프리뷰 창은 `.ecp-message-window` 고 게임 창은 `.dialogue-box` 다. 선택자가 다르니
// 감정→keyframe 매핑을 두 번 적어야 한다. 그 중복은 조용히 어긋난다 — 제작자가 「기쁨」을
// 골랐는데 프리뷰만 옛 곡선으로 튀어도 예외도 경고도 없고, 프리뷰가 목적 그대로
// "게임에서 이렇게 보인다"를 거짓말한다. 그래서 두 규칙 집합을 텍스트로 대조한다.
//
// keyframes 자체는 src/styles/dialogue.css 것을 그대로 부른다(복제하지 않는다).
// 그 파일이 에디터 그래프에 실려 있어야 이름이 풀리므로 import 사슬도 같이 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RUNTIME_CSS = "src/styles/dialogue.css";
const PREVIEW_CSS = "src/styles/editor/event-editor.command-preview/01-event-editor-modern-import.css";

function read(relative: string): string {
  // 주석은 걷어낸다 — 규칙 앞 주석이 선택자 덩어리에 섞여 들어온다.
  return readFileSync(resolve(__dirname, "..", relative), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** `@media (prefers-reduced-motion: reduce)` 블록의 문자 범위. 중괄호 균형으로 뜬다. */
function reducedRanges(css: string): ReadonlyArray<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  const header = /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{/g;
  for (let match = header.exec(css); match; match = header.exec(css)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    ranges.push([match.index, index]);
  }
  return ranges;
}

/** 속성 선택자만 정렬해 키로 쓴다 — 나열 순서가 달라도 같은 규칙으로 본다. */
function attributeKey(rest: string): string {
  return [...rest.matchAll(/\[[^\]]*\]/g)].map(([attribute]) => attribute).sort().join("");
}

/**
 * `<base>` + 속성 선택자로만 이루어지고 `phase="enter"` 를 물면서 애니메이션을 선언하는
 * 규칙을 모은다. 자손 선택자(이름표·초상화·글자)와 exit·shown 규칙은 프리뷰가 일부러
 * 갖지 않으므로 대조 대상이 아니다.
 */
function enterRules(css: string, base: string, reduced: boolean): ReadonlyMap<string, string> {
  const ranges = reducedRanges(css);
  const rules = new Map<string, string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const inside = ranges.some(([start, end]) => match.index >= start && match.index < end);
    if (inside !== reduced) continue;
    const body = match[2]!;
    if (!/\banimation(-name)?\s*:/.test(body)) continue;
    for (const raw of match[1]!.split(",")) {
      const selector = raw.trim();
      if (!selector.startsWith(base)) continue;
      const rest = selector.slice(base.length);
      if (!/^(\[[^\]]*\])+$/.test(rest)) continue;
      if (!rest.includes('[data-dialogue-phase="enter"]')) continue;
      rules.set(attributeKey(rest), body.replace(/\s+/g, " ").trim());
    }
  }
  return rules;
}

const runtime = read(RUNTIME_CSS);
const preview = read(PREVIEW_CSS);

describe("에디터 프리뷰 연출 CSS", () => {
  it("감정별 진입 연출이 런타임과 한 짝도 어긋나지 않는다", () => {
    const game = enterRules(runtime, ".dialogue-box", false);
    const mock = enterRules(preview, ".ecp-message-window", false);
    expect(game.size, "런타임 진입 규칙을 못 찾았다 — 선택자 형태가 바뀌었는지 확인해라.").toBeGreaterThan(1);
    expect(
      Object.fromEntries(mock),
      "프리뷰와 게임의 감정→연출 짝이 어긋났다. 프리뷰가 '게임에서 이렇게 보인다'를 거짓말한다."
    ).toEqual(Object.fromEntries(game));
  });

  it("움직임을 끈 자리의 안전망도 같이 따라간다", () => {
    const game = enterRules(runtime, ".dialogue-box", true);
    const mock = enterRules(preview, ".ecp-message-window", true);
    expect(game.size, "런타임 reduced-motion 진입 안전망이 없다").toBeGreaterThan(0);
    expect(Object.fromEntries(mock), "프리뷰에 reduced-motion 안전망이 없다").toEqual(
      Object.fromEntries(game)
    );
  });

  it("프리뷰 창도 아래 변에서 자란다", () => {
    // transform-origin 이 없으면 기본값 50% 50% 로 중심에서 부풀어, 같은 keyframe 이라도
    // 게임(아래 변 기준)과 다른 움직임으로 보인다.
    expect(preview).toMatch(/\.ecp-message-window\[data-dialogue-phase\]\s*\{[^}]*transform-origin/);
  });

  it("프리뷰가 부르는 keyframe 은 런타임 파일에 실재하고 그 파일이 에디터에 실린다", () => {
    const names = new Set<string>();
    for (const [, body] of enterRules(preview, ".ecp-message-window", false)) {
      for (const [, value] of body.matchAll(/animation(?:-name)?:\s*([^;]+)/g)) {
        const first = value!.trim().split(/\s+/)[0]!;
        if (/^[a-zA-Z][\w-]*$/.test(first) && first !== "none") names.add(first);
      }
    }
    expect(names.size, "프리뷰 규칙에서 애니메이션 이름을 못 찾았다").toBeGreaterThan(0);
    for (const name of names) {
      expect(runtime, `${name} keyframes 가 런타임 CSS 에 없다 — 프리뷰만 조용히 안 움직인다.`).toContain(
        `@keyframes ${name}`
      );
    }
    // 이름은 정의가 같은 문서에 로드돼야 풀린다. 에디터 셸이 dialogue.css 를 놓치면
    // 프리뷰 규칙은 남고 애니메이션만 사라진다.
    const runtimeIndex = readFileSync(resolve(__dirname, "..", "src/styles/runtime/playerRuntime.css"), "utf8");
    expect(runtimeIndex, "playerRuntime.css 가 dialogue.css 를 안 부른다").toContain("../dialogue.css");
    const editorIndex = readFileSync(resolve(__dirname, "..", "src/styles/index.css"), "utf8");
    expect(editorIndex, "index.css 가 playerRuntime.css 를 안 부른다").toContain("runtime/playerRuntime.css");
  });
});
