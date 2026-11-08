import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 폰 세로 창 칸(data-window-panel)은 상점을 320 논리 칸에 넣는다. 제작 창은 같은 상점 오버레이 클래스를 써서
// 그 칸에 끌려 들어가 이름이 한 글자씩 감겼다(2026-11-07 실제 플레이어 390×844). 칸 규칙은 제작 창을 빼고,
// 제작 창은 칸이 들어갈 방 통째(--panel-room-*)를 쓴다.
const css = readFileSync(resolve("src/styles/runtime/mobileUi.css"), "utf8");

function ruleBody(selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("craft window in the portrait window panel", () => {
  it("keeps the craft overlay out of the 320 shop slot rule", () => {
    const slot = ruleBody(".player-layout .play-viewport[data-window-panel] > .runtime-overlay.runtime-shop-overlay:not(.emerald-shop-overlay):not(.runtime-craft-shop-overlay)");
    expect(slot).toMatch(/width:\s*var\(--panel-w\)/);
    expect(css).not.toMatch(/\.runtime-shop-overlay:not\(\.emerald-shop-overlay\)\s*\{/);
  });

  it("gives the craft overlay the whole window room at 1x", () => {
    const room = ruleBody(".player-layout .play-viewport[data-window-panel] > .runtime-overlay.runtime-shop-overlay.runtime-craft-shop-overlay");
    expect(room).toMatch(/width:\s*var\(--panel-room-w\)/);
    // 메뉴 단추 줄 위가 아니라 화면 아래 안전 영역 위까지(2026-11-08: 382×478 에서 제작법 3줄 → 382×828 에서 5줄).
    expect(room).toMatch(/height:\s*calc\(100% - var\(--panel-room-top\) - var\(--touch-band-bottom, 0px\) - 8px\)/);
    expect(room).toMatch(/top:\s*var\(--panel-room-top\)/);
    expect(room).toMatch(/transform:\s*none/);
  });

  it("hides the touch pad and fullscreen toggle while the craft window takes the controls band", () => {
    expect(ruleBody(".player-layout .play-viewport[data-window-panel]:has(> .runtime-craft-shop-overlay) > :is(.touch-pad, .play-fullscreen-toggle)")).toMatch(/display:\s*none/);
  });
});
