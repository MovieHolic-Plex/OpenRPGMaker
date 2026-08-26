// test/aiGlassPanelWidth.test.ts
// Asserts the CSS contract for responsive glass assistant panel width.
// Glass dock .ai-chat-panel.chat-dock-glass:not(.is-history-open):not(.is-studio):not(.is-collapsed)
// must use clamp(360px, 38vw, 520px) (or equivalent responsive width >360px at 1280px/1920px viewports)
// and not lock down to min(360px, 34%) or hardcoded 360px.
// Also --ai-docked-panel-inset must not hardcode min(360px, 40vw).

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function readCssFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Glass assistant card responsive width CSS contract", () => {
  const modernCssPath = "src/styles/database/tabs-b-assistant-panel/13-assistant-modern.css";
  const densityCssPath = "src/styles/database/tabs-b-assistant-panel/09-ux-polish-density.css";
  const temperatureCssPath = "src/styles/database/tabs-b-assistant-panel/12-assistant-temperature.css";
  const commandBarCssPath = "src/styles/database/assistant-command-bar.css";

  it("13-assistant-modern.css does not lock glass panel width/max-width to min(360px, 34%)", () => {
    const css = readCssFile(modernCssPath);
    expect(css).not.toMatch(/width:\s*min\(\s*360px\s*,\s*34%\s*\)/);
    expect(css).not.toMatch(/max-width:\s*min\(\s*360px\s*,\s*34%\s*\)/);
  });

  it("13-assistant-modern.css sets width and max-width to clamp(360px, 38vw, 520px) for glass dock panel", () => {
    const css = readCssFile(modernCssPath);
    // Find the selector rule block for glass dock panel
    const glassRuleMatch = css.match(
      /\.editor-layout\s+\.ai-chat-panel\.chat-dock-glass:not\(\.is-history-open\):not\(\.is-studio\):not\(\.is-collapsed\)[\s\S]*?\{([\s\S]*?)\}/
    );
    expect(glassRuleMatch).toBeTruthy();
    const ruleBody = glassRuleMatch ? glassRuleMatch[1] : "";

    expect(ruleBody).toMatch(/width:\s*clamp\(\s*360px\s*,\s*38vw\s*,\s*520px\s*\)/);
    expect(ruleBody).toMatch(/max-width:\s*clamp\(\s*360px\s*,\s*38vw\s*,\s*520px\s*\)/);
  });

  it("09-ux-polish-density.css does not hardcode min(360px, 40vw) for --ai-docked-panel-inset", () => {
    const css = readCssFile(densityCssPath);
    expect(css).not.toMatch(/--ai-docked-panel-inset:\s*calc\(\s*min\(\s*360px/);
  });

  it("calculates >360px at 1280px and 1920px viewports with clamp(360px, 38vw, 520px)", () => {
    const clampWidth = (vw: number) => {
      const preferred = vw * 0.38;
      return Math.min(520, Math.max(360, preferred));
    };

    // 1280px viewport -> 38% of 1280 = 486.4px
    expect(clampWidth(1280)).toBe(486.4);
    expect(clampWidth(1280)).toBeGreaterThan(360);

    // 1920px viewport -> 38% of 1920 = 729.6px, clamped to 520px max
    expect(clampWidth(1920)).toBe(520);
    expect(clampWidth(1920)).toBeGreaterThan(360);

    // 900px viewport -> 38% of 900 = 342px, clamped to 360px min
    expect(clampWidth(900)).toBe(360);
    // At 900px, 360px leaves 540px for map canvas (leaves map canvas visible)
    expect(900 - clampWidth(900)).toBe(540);
  });

  it("12-assistant-temperature.css does not lock glass width to min(260px, 28%)",
    () => {
      const css = readCssFile(temperatureCssPath);
      expect(css).not.toMatch(/width:\s*min\(\s*260px\s*,\s*28%\s*\)/);
      expect(css).not.toMatch(/max-width:\s*min\(\s*260px\s*,\s*28%\s*\)/);
    },
  );

  it("header more-menu stacks idle-view options in one column so labels are not clipped",
    () => {
      const css = readCssFile(commandBarCssPath);
      const stacked = css.match(
        /\.ai-more-menu\s+\.ai-temperature-picker\s*\{([\s\S]*?)\}/,
      );
      expect(stacked).toBeTruthy();
      expect(stacked?.[1] ?? "").toMatch(/grid-template-columns:\s*(1fr|minmax\(0,\s*1fr\))/);
      expect(stacked?.[1] ?? "").not.toMatch(/repeat\(\s*3/);
    },
  );
});
