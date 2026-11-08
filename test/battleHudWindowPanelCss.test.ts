import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 폰 세로에서 도트 전투 명령·파티 창은 0.42~0.46배로 그려져 명령 줄 15px, HP/MP 글자 5px 였다
// (2026-11-08 실제 플레이어 360×780·390×844). 창 칸 모드에서는 무대 아래 띠로 꺼내 줄을 손가락 크기(44px)로 키운다.
const css = readFileSync(resolve("src/styles/runtime/mobileUi.css"), "utf8");
const SCENE = ".player-layout .play-viewport[data-window-panel] .battle-scene:is([data-battle-ui-style])[data-battle-skin][data-battle-skin-family][data-battle-layout]";
const HUD = `${SCENE} > :is(.battle-command-host, .battle-enemy-list-panel, .battle-party)`;

function ruleBody(selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("pixel battle HUD in the portrait window panel", () => {
  it("places the command and party windows in the band under the stage, out of the scene grid", () => {
    const body = ruleBody(HUD);
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/grid-area:\s*auto/);
    expect(body).toMatch(/transform:\s*scale\(var\(--hud-inv\)\)/);
  });

  it("keeps rows finger sized after the zoom", () => {
    const zoom = Number(css.match(/--hud-zoom:\s*([\d.]+)/)?.[1]);
    const row = Number(css.match(new RegExp(`${SCENE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{ --battle-command-row-height: (\\d+)px; \\}`))?.[1]);
    expect(row * zoom).toBeGreaterThanOrEqual(44);
  });

  it("folds party rows to name above HP so names are not cut to one syllable", () => {
    const row = ruleBody('.player-layout .play-viewport[data-window-panel] .battle-scene[data-battle-motion="retro"][data-battle-ui-style="classic"][data-battle-skin-family="glass"][data-battle-layout="sideview"] .battle-party .battle-actor-status');
    expect(row).toMatch(/grid-template-areas:\s*"name state tp" "hpnum mpnum mpnum"/);
  });

  it("hides the HUD band while the result window owns the room", () => {
    expect(ruleBody(".player-layout .play-viewport[data-window-panel] .battle-stage:has(.battle-result-pixel) .battle-scene > :is(.battle-command-host, .battle-enemy-list-panel, .battle-party)")).toMatch(/display:\s*none/);
  });
});
