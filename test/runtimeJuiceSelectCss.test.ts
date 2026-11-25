import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime menu-select juice CSS", () => {
  const juiceCss = readFileSync(resolve("src/styles/runtime/juice.css"), "utf8");
  const dockCss = readFileSync(resolve("src/styles/runtime/statusMenuEdgeDock.css"), "utf8");

  it("does not flash the whole overlay when the cursor moves", () => {
    expect(juiceCss).not.toMatch(/juice-menu-select-tick/);
    const selectRuleBody = groupedRule(juiceCss, [".juice-menu-select", ".juice-title-select"]);
    expect(selectRuleBody).toMatch(/animation:\s*none/);
    expect(selectRuleBody).not.toMatch(/filter:/);
    expect(selectRuleBody).not.toMatch(/transform:/);
  });

  it("moves the ESC overlay only when the menu opens or closes", () => {
    const overlayIdle = groupedRule(juiceCss, [
      ".oprn-status-menu.juice-menu-select",
      ".oprn-status-menu.juice-menu-confirm",
      ".oprn-status-menu.juice-menu-back",
      ".oprn-status-menu.juice-menu-invalid",
    ]);
    expect(overlayIdle).toMatch(/animation:\s*none/);
    expect(overlayIdle).not.toMatch(/transform:/);

    expect(groupedRule(juiceCss, [".juice-menu-open", ".juice-title-enter"])).toMatch(
      /juice-menu-open-pop/,
    );
    expect(groupedRule(juiceCss, [".juice-menu-back", ".juice-menu-close"])).toMatch(
      /juice-menu-back-slide/,
    );
    expect(selectRule(juiceCss, ".juice-menu-invalid")).toMatch(/juice-menu-invalid-shake/);
  });

  it("keeps the ESC-menu cursor highlight without bloom", () => {
    const selectedDock = selectRule(
      dockCss,
      ".oprn-status-menu .status-menu-primary-dock > .status-menu-command.selected",
    );
    expect(selectedDock).toMatch(/box-shadow:\s*none/);
    expect(selectedDock).not.toMatch(/0 0 12px/);

    const selectedAction = selectRule(
      dockCss,
      ".oprn-status-menu .status-menu-detail-action.selected",
    );
    expect(selectedAction).toMatch(/inset 2px 0 0/);
    expect(selectedAction).not.toMatch(/0 0 10px/);
  });
});

function groupedRule(css: string, selectors: readonly string[]): string {
  const header = selectors
    .map((selector) => selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("\\s*,\\s*");
  return ruleBody(css, header, selectors.join(", "));
}

function selectRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return ruleBody(css, escaped, selector);
}

function ruleBody(css: string, headerPattern: string, label: string): string {
  const match = new RegExp(`${headerPattern}\\s*\\{`, "u").exec(css);
  expect(match, `missing rule ${label}`).toBeTruthy();
  const start = match!.index + match![0].length;
  const end = css.indexOf("}", start);
  expect(end, `unclosed rule ${label}`).toBeGreaterThan(start);
  return css.slice(start, end);
}
