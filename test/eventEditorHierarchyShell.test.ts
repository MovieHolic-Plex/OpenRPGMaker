import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// PIN-RED: event-editor hierarchy chrome (after.html contract).
//
// These assertions describe the target "hierarchy" shell rendered by content.ts +
// event-editor.balanced.css:
//   - cool-white indigo token shell (`--accent: #4A57D6` from tokens.css)
//   - identity collapsed into a 48px titlebar with ONE primary `저장하고 닫기`
//   - pages as a 40px underline tab strip (no numbered card tabs)
//   - an indigo 3px inset rail for the selected story row
//   - inspector preview-first, no gold `현재 명령 편집`
//   - a 40px footer with only 취소/적용 (no second save)
//   - no bottom AI/스크립트/플로우 quick-tools chip row
//
// All assertions currently FAIL against the "balanced" baseline; implementation
// (step 2) flips this file to green.

const balancedStylesUrl = new URL("../src/styles/editor/event-editor.balanced.css", import.meta.url);
const balancedCss = readFileSync(balancedStylesUrl, "utf8");
const contentSource = readFileSync(new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("../src/editor/panels/eventEditor/modal.ts", import.meta.url), "utf8");
const pagePropsSource = readFileSync(new URL("../src/editor/panels/eventEditor/pageProps.ts", import.meta.url), "utf8");
const inspectorSource = readFileSync(new URL("../src/editor/panels/eventEditor/commandInspector.ts", import.meta.url), "utf8");

describe("event editor hierarchy chrome (after.html)", () => {
  it("adopts the cool-white indigo token shell from tokens.css", () => {
    expect(balancedCss).toMatch(/--accent\s*:\s*#4A57D6/);
    // Warm "balanced" palette is replaced by indigo tokens; no coral/plum/gold remnants.
    expect(balancedCss).not.toContain("--balanced-coral");
    expect(balancedCss).not.toContain("--balanced-gold: #d09f0d");
  });

  it("collapses the identity into a 48px titlebar with one primary save", () => {
    expect(balancedCss).toContain("--balanced-header-height: 48px");
    // Product-brand column disappears; event name is the title.
    expect(balancedCss).not.toContain("155px minmax(0, 1fr) auto auto !important");
    expect(modalSource).not.toContain("event-editor-product-brand");
    // The required `event-editor-save` testid becomes the single primary save.
    expect(modalSource).toContain('testid: "event-editor-save"');
  });

  it("renders pages as a 40px underline tab strip, not numbered cards", () => {
    expect(balancedCss).toContain("--balanced-pages-height: 40px");
    expect(pagePropsSource).not.toContain("event-page-number-tabs");
    // Active page tab is an accent underline, not a raised card.
    expect(balancedCss).toMatch(/\.page-tab\.active::after\s*\{[^}]*background:\s*var\(--accent\)/s);
  });

  it("selects the story row with an indigo 3px inset rail", () => {
    expect(balancedCss).toMatch(/box-shadow:\s*inset 3px 0 0 var\(--accent\)/);
    expect(balancedCss).not.toMatch(/var\(--balanced-plum\)/);
  });

  it("removes the gold 현재 명령 편집 affordance from the inspector", () => {
    expect(inspectorSource).not.toContain("현재 명령 편집");
  });

  it("collapses the footer to 40px with no second save", () => {
    expect(balancedCss).toContain("--balanced-footer-height: 40px");
    // Save live only in the header; footer keeps 취소/적용.
    expect(modalSource).not.toContain('footerButton("저장하고 닫기"');
  });

  it("drops the bottom AI/스크립트/플로우 quick-tools chip row", () => {
    expect(contentSource).not.toContain("renderCommandQuickTools");
  });
});
