// 대사창 얼굴이 **런타임 CSS 만으로도** 그려지는지 지킨다.
//
// ── 있었던 결함(2026-07-27 확인) ─────────────────────────────────────────────
// dialogue.ts 의 renderFace() 는 페이스셋 칩을
//   <div class="dialogue-face actor-sheet-crop" style="--crop-url:…;--crop-x:…">
// 로 만든다. 그런데 `.actor-sheet-crop` 의 background-image / width / height 선언은
// src/styles/editor/event-editor-legacy.part-1.css — **에디터 전용 CSS** 에만 있었다.
// 익스포트한 단독 플레이어는 src/player/player.css(tokens + runtime/playerRuntime)만
// 불러오므로 그 규칙이 없고, 얼굴은 배경 없는 빈 테두리로 그려졌다.
// 실제 빌드 산출물로 확인: community-site/public/player-static 의 player CSS 에
// `dialogue-face` 는 있고 `actor-sheet-crop` 은 **0회**였다.
// 에디터 테스트 플레이에서는 에디터 CSS 가 함께 로드돼 정상으로 보였기 때문에
// 브라우저 e2e 로도 잡히지 않았다 — 그래서 이 검사는 CSS 텍스트를 직접 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

describe("런타임 대사창 얼굴 CSS", () => {
  it("dialogue.css 가 페이스셋 칩 크롭을 스스로 그린다", () => {
    const css = read("src/styles/dialogue.css");
    const rule = css.slice(css.indexOf(".dialogue-face.actor-sheet-crop"));
    expect(
      css,
      "dialogue.css 에 .dialogue-face.actor-sheet-crop 규칙이 없다 — "
      + "에디터 CSS 없이 구동하는 익스포트 플레이어에서 얼굴이 빈 칸으로 그려진다.",
    ).toContain(".dialogue-face.actor-sheet-crop");
    // 크롭에 필요한 네 가지가 모두 있어야 한 칸만 보인다.
    for (const declaration of ["background-image", "background-position", "background-size", "height", "width"]) {
      expect(rule.slice(0, 500), `크롭 선언 ${declaration} 이 없다`).toContain(declaration);
    }
    expect(rule.slice(0, 500)).toContain("--crop-url");
  });

  it("dialogue.css 는 런타임 CSS 사슬 안에 있다", () => {
    // player.css → runtime/playerRuntime.css → ../dialogue.css 경로가 끊기면
    // 위 규칙을 넣어도 플레이어 빌드에 들어가지 않는다.
    expect(read("src/player/player.css")).toContain("runtime/playerRuntime.css");
    expect(read("src/styles/runtime/playerRuntime.css")).toContain("dialogue.css");
  });

  it("화자 이름표 자리를 상속된 글꼴 크기에 의존하지 않는다", () => {
    // `padding-top: 1.35em` 은 .dialogue-box 에 font-size 선언이 없어 상속된 14px 로 풀렸고
    // (본문은 9px), 상자 안쪽 높이의 44% 를 먹어 페이지당 줄 수를 절반으로 만들었다.
    const css = read("src/styles/dialogue.css");
    const hasSpeaker = css.slice(css.indexOf(".dialogue-box.has-speaker"));
    const block = hasSpeaker.slice(0, hasSpeaker.indexOf("}"));
    expect(block, "has-speaker 의 padding-top 이 em 으로 돌아갔다").not.toMatch(/padding-top:\s*[\d.]+em/);
    expect(block).toContain("--runtime-dialogue-speaker-inset");
  });
});
