import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("touch controls over runtime modal surfaces", () => {
  it("hides the touch pad while the player status menu is open", async () => {
    const css = await readFile(resolve("src/styles/runtime/touchpad.css"), "utf8");

    expect(css).toMatch(
      /\.play-stage:has\(\[data-testid=["']main-menu["']\]\)\s*>\s*\.touch-pad\s*\{[^}]*visibility:\s*hidden/s,
    );
  });

  it("keeps status-menu copy legible and all four life-ledger labels visible", async () => {
    const titleCss = await readFile(resolve("src/styles/database/tabs-b-title-screen.css"), "utf8");
    const detailCss = await readFile(resolve("src/styles/database/tabs-b-status-menu-main.css"), "utf8");

    expect(titleCss).toMatch(
      /\.oprn-status-menu\.main-menu\s*\{[^}]*color:\s*var\(--oprn-status-text\)/s,
    );
    expect(detailCss).toMatch(/\.life-ledger-tab\s*\{[^}]*font-size:\s*6px/s);
  });
});
