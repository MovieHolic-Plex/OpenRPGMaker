import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 폰 세로(무대 1배 미만)에서 도트 전투 결과 창은 무대 배율 × 전투 무대 배율(0.61 × 0.75 = 0.457)로 그려져 글자가 5~6px 였다
// (2026-11-08 실제 플레이어 390×844). 창 칸 모드에서는 결과 창을 칸이 들어갈 세로 방(--panel-room-*)에 1배로 꺼낸다.
const css = readFileSync(resolve("src/styles/runtime/mobileUi.css"), "utf8");
const PANEL = ".player-layout .play-viewport[data-window-panel] .battle-scene:is([data-battle-ui-style])[data-battle-skin][data-battle-skin-family][data-battle-layout] .battle-result-panel.battle-result-pixel";

function ruleBody(selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("pixel battle result in the portrait window panel", () => {
  it("draws the result window at 1x in the panel room", () => {
    const body = ruleBody(PANEL);
    expect(body).toMatch(/width:\s*var\(--panel-room-w\)/);
    expect(body).toMatch(/height:\s*var\(--panel-room-h\)/);
    expect(body).toMatch(/transform:\s*scale\(calc\(1 \/ \(var\(--play-scale\) \* var\(--battle-stage-scale\)\)\)\)/);
  });

  it("lets the result window out of the clipped battle stage", () => {
    expect(ruleBody(".player-layout .play-viewport[data-window-panel] .battle-stage:has(.battle-result-pixel) > .battle-scene")).toMatch(/overflow:\s*visible/);
  });

  it("stacks loot rows in one column so names are not cut to one syllable", () => {
    expect(ruleBody(`${PANEL} .battle-result-cards`)).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
  });
});
