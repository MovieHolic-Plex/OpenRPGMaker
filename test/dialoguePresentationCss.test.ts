// 대화창 연출이 **CSS 쪽에서 실재하는지** 지킨다.
//
// 이 검사가 필요한 이유는 연출의 실패가 조용하기 때문이다. TS 는 상자에
// data-dialogue-phase 와 --dialogue-*-ms 를 성실히 심는데, 대응하는 @keyframes 나
// :root 폴백이 없으면 화면에는 **아무 일도 일어나지 않는다.** 예외도, 콘솔 경고도 없다.
//  - animation-name 이 없는 keyframe 을 가리키면 애니메이션은 그냥 무시된다.
//  - var(--dialogue-enter-ms) 가 정의되지 않으면 선언 전체가 무효가 되어
//    animation-duration 이 초기값 0s 로 떨어지고 연출이 통째로 죽는다.
// 브라우저 e2e 로도 "연출이 없다"는 정상 화면과 구분되지 않는다. 그래서 텍스트를 직접 본다.
// test/dialogueFaceRuntimeCss.test.ts 와 같은 계열의 검사다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIALOGUE_EMOTIONS,
  dialoguePresentationCssVars,
  dialoguePresentationProfile,
} from "@/player/dialoguePresentation";

const css = readFileSync(resolve(__dirname, "..", "src/styles/dialogue.css"), "utf8");

/** `@keyframes <name> { … }` 의 본문을 중괄호 균형으로 떠낸다(키프레임은 한 단계 더 중첩된다). */
function keyframeBlocks(): ReadonlyMap<string, string> {
  const blocks = new Map<string, string>();
  const header = /@keyframes\s+([\w-]+)\s*\{/g;
  for (let match = header.exec(css); match; match = header.exec(css)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.set(match[1]!, css.slice(start, index - 1));
  }
  return blocks;
}

/** 규칙에서 참조하는 애니메이션 이름 — `animation:` 단축과 `animation-name:` 양쪽. */
function referencedAnimationNames(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const [, value] of css.matchAll(/animation-name:\s*([^;}]+)/g)) {
    for (const name of value!.split(",")) names.add(name.trim());
  }
  for (const [, value] of css.matchAll(/\banimation:\s*([^;}]+)/g)) {
    for (const part of value!.split(",")) {
      const first = part.trim().split(/\s+/)[0];
      // `animation: none` 이나 var()/시간값으로 시작하는 형태는 이름이 아니다.
      if (first && /^[a-zA-Z][\w-]*$/.test(first) && first !== "none") names.add(first);
    }
  }
  return names;
}

describe("대화창 연출 CSS", () => {
  it("참조하는 모든 애니메이션 이름에 실제 @keyframes 가 있다", () => {
    const defined = keyframeBlocks();
    const missing = [...referencedAnimationNames()].filter((name) => !defined.has(name));
    expect(
      missing,
      `@keyframes 없는 애니메이션 이름: ${missing.join(", ")} — 클래스만 붙고 화면에는 아무 일도 안 일어난다.`
    ).toEqual([]);
  });

  it("진입·퇴장이 phase 속성으로 걸리고 길이는 주입된 변수를 읽는다", () => {
    expect(css).toContain('.dialogue-box[data-dialogue-phase="enter"]');
    expect(css).toContain('.dialogue-box[data-dialogue-phase="exit"]');
    // 길이를 CSS 에 다시 적으면 TS 와 어긋난다 — battleTransition 이 close 260 vs 190 으로
    // 어긋나 있던 실수를 여기서 반복하지 않는다.
    expect(css).toContain("var(--dialogue-enter-ms)");
    expect(css).toContain("var(--dialogue-exit-ms)");
  });

  it("TS 가 심는 모든 --dialogue-* 변수에 :root 폴백이 있다", () => {
    const root = css.slice(0, css.indexOf("}"));
    const injected = new Set<string>();
    for (const emotion of DIALOGUE_EMOTIONS) {
      for (const name of Object.keys(dialoguePresentationCssVars(dialoguePresentationProfile(emotion)))) {
        injected.add(name);
      }
    }
    const missing = [...injected].filter((name) => !root.includes(`${name}:`));
    expect(
      missing,
      `:root 폴백이 없는 변수: ${missing.join(", ")} — 인라인 주입이 없는 경로에서 `
      + "var() 가 무효가 되고 animation-duration 이 0s 로 떨어진다."
    ).toEqual([]);
  });

  it("상자 연출은 가로로 커지지 않는다", () => {
    // 검증된 제약이다. 전폭 상자를 가로로 부풀리면 1280 뷰포트에서 좌우 여백의 16px 하한이
    // 깨지고 test/e2e/dialogue-modern-skin.spec.ts 의 leftGutter/rightGutter 단정이 무너진다.
    // 게다가 대칭으로 몇 px 벌어지는 변화는 눈에 잡히지도 않는다 — 탄력은 세로에만 준다.
    for (const [name, body] of keyframeBlocks()) {
      if (!name.startsWith("dialogue-box-")) continue;
      expect(body, `${name} 이 scaleX 를 건드린다 — 세로 scaleY 로 옮겨라.`).not.toMatch(/scaleX\(/);
      expect(
        body,
        `${name} 이 등방 scale()/scale3d() 를 쓴다 — 가로까지 커진다. scaleY() 로 바꿔라.`
      ).not.toMatch(/(?<![a-zA-Z])scale(3d)?\(/);
    }
  });

  it("이름표·초상화 연출은 상자의 진입 단계에만 걸린다", () => {
    // 게이트가 없으면 연속 대사마다 이름표가 다시 튀어나온다 — phase="enter" 는
    // 세션 첫 창에만 붙으므로 그게 곧 세션 경계 게이트다.
    const childRules = [...css.matchAll(/^([^{}\n][^{}]*?)\{/gm)]
      .map(([, selector]) => selector!.trim())
      .filter((selector) => /\.speaker\.speaker-nameplate|\.dialogue-face/.test(selector))
      .filter((selector) => /animation/.test(css.slice(css.indexOf(selector) + selector.length, css.indexOf(selector) + selector.length + 300)));
    for (const selector of childRules) {
      expect(
        selector,
        `${selector} 가 상자 phase 게이트 없이 애니메이션을 건다 — 매 대사마다 재생된다.`
      ).toContain('[data-dialogue-phase="enter"]');
    }
  });

  it("초상화 진입이 좌우 뒤집기를 지우지 않는다", () => {
    // .dialogue-face.flipped 는 transform: scaleX(-1) 을 쓴다. 진입의 translateX 가
    // transform 을 통째로 덮으므로 keyframe 이 뒤집기를 같이 실어야 한다.
    // 안 실으면 초상화가 진입하는 동안만 제자리로 펴진다.
    expect(css, ".dialogue-face.flipped 가 --face-flip 을 안 쓴다").toMatch(
      /\.dialogue-face\.flipped\s*\{[^}]*--face-flip/
    );
    for (const [name, body] of keyframeBlocks()) {
      if (!name.startsWith("dialogue-face-")) continue;
      if (!body.includes("translateX")) continue;
      expect(body, `${name} 이 뒤집기를 빼먹었다 — flipped 초상화가 진입 중 펴진다.`).toContain(
        "scaleX(var(--face-flip))"
      );
    }
  });

  it("레이아웃 속성은 애니메이션하지 않는다", () => {
    // has-speaker 의 padding-top 은 페이지당 줄 수 계산(dialogueMaxLines)에 직접 들어간다.
    // 움직이면 측정이 프레임마다 달라져 대사가 페이지 중간에서 잘린다.
    const forbidden = /(?:^|\s)(padding|margin|width|height|top|left|right|bottom|font-size|line-height)\s*:/m;
    for (const [name, body] of keyframeBlocks()) {
      if (!name.startsWith("dialogue-")) continue;
      expect(body, `${name} 이 레이아웃 속성을 애니메이션한다 — transform/opacity 만 써라.`).not.toMatch(
        forbidden
      );
    }
  });

  it("스크림은 오버레이가 아니라 자기 엘리먼트에 걸리고 창 밴드 아래에 있다", () => {
    // 오버레이 안에 두면 화면을 덮을 수 없다 — position-top/bottom 에서 높이가 27% 뿐이다.
    // 그리고 39(창) 위로 올라가면 스크림이 대사를 덮는다.
    const scrim = css.slice(css.indexOf(".dialogue-scrim {"));
    expect(scrim.slice(0, scrim.indexOf("}"))).toContain("z-index: 38");
    expect(css, "z-index 밴드 주석에 38 이 없다").toMatch(/z-index 밴드[^*]*38/);
    // 크롭 inset 은 playSurface.css 가 맞춘다 — 목록에서 빠지면 잘려 나가는 띠까지 어두워진다.
    const surface = readFileSync(resolve(__dirname, "..", "src/styles/runtime/playSurface.css"), "utf8");
    expect(surface, "playSurface.css 의 크롭 inset 목록에 .dialogue-scrim 이 없다").toContain(
      ".play-stage > .dialogue-scrim"
    );
  });

  it("분노 흔들림은 좌우 여백 하한을 먹지 않는다", () => {
    // 전폭 상자의 좌우 여백 하한이 16px 이고 test/e2e/dialogue-modern-skin.spec.ts 가 그 값을
    // 잰다. 흔들림은 phase="shown" 에 걸리므로 그 측정과 시점이 겹칠 수 있다.
    const shake = keyframeBlocks().get("dialogue-box-shake");
    expect(shake, "dialogue-box-shake keyframes 가 없다").toBeTruthy();
    const offsets = [...shake!.matchAll(/translate(?:3d|X)\(\s*(-?\d+(?:\.\d+)?)px/g)].map(([, value]) =>
      Math.abs(Number.parseFloat(value!))
    );
    expect(offsets.length, "흔들림이 좌우로 움직이지 않는다").toBeGreaterThan(0);
    expect(Math.max(...offsets), `좌우 진폭 ${Math.max(...offsets)}px — 4px 이하로 묶어라.`).toBeLessThanOrEqual(4);
  });

  it("흔들림은 진입 연출과 같은 규칙을 다투지 않는다", () => {
    // 진입과 같은 [data-dialogue-phase="enter"] 에 얹으면 둘이 transform 을 다투고,
    // 세션 중간의 분노 대사는(shown 으로 바로 뜬다) 아예 흔들리지 않는다.
    const rule = css.slice(css.indexOf('.dialogue-box[data-dialogue-shake="1"]'));
    expect(rule.slice(0, rule.indexOf("{"))).toContain('[data-dialogue-phase="shown"]');
  });

  it("움직임을 끈 자리에도 창은 뜬다", () => {
    // opacity 만 남기고 이동·신축을 없앤다. 애니메이션을 통째로 none 으로 만들면
    // fill-mode 로 잡혀 있던 opacity 가 풀려 창이 안 보이거나, 반대로 퇴장이 안 끝난다.
    expect(css).toContain('[data-dialogue-motion="off"][data-dialogue-phase="enter"]');
    expect(css).toContain('[data-dialogue-motion="off"][data-dialogue-phase="exit"]');
    expect(keyframeBlocks().get("dialogue-box-enter-fade")).toContain("opacity: 1");

    const guard = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(guard, "reduced-motion 안전망이 없다").toContain("dialogue-box-enter-fade");
    expect(guard).toContain("dialogue-box-exit-fade");
    // 감정별 animation-name 규칙이 특이도 (0,3,0) 이므로 안전망도 속성 두 개를 물어야 이긴다.
    expect(
      guard,
      "안전망 선택자가 [data-dialogue-emotion] 을 빼먹었다 — happy·sad 가 안전망을 통과한다."
    ).toContain('[data-dialogue-emotion][data-dialogue-phase="enter"]');
    // 흔들림·글자·플래시도 안전망이 필요하다. 이 셋은 phase 가 아니라 자기 dataset 으로
    // 게이트되므로 위의 enter/exit 안전망이 닿지 않는다.
    expect(guard, "흔들림 안전망이 없다").toContain('[data-dialogue-shake="1"]');
    expect(guard, "글자 등장 안전망이 없다").toContain(".dialogue-char");
    expect(guard, "플래시 안전망이 없다").toContain('.dialogue-scrim[data-dialogue-flash="1"]::after');
    // 스크림 디밍은 남긴다 — 움직임이 아니라 분위기·대비 신호다.
    expect(guard, "안전망이 스크림 디밍까지 없앴다").not.toContain('[data-dialogue-scrim="on"]');
  });
});
