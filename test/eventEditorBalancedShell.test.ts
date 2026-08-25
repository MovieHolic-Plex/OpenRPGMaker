import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesEntry = readFileSync(new URL("../src/styles/index.css", import.meta.url), "utf8");
const balancedStylesUrl = new URL("../src/styles/editor/event-editor.balanced.css", import.meta.url);
const contentSource = readFileSync(new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url), "utf8");

describe("balanced event editor presentation layer", () => {
  it("loads the fidelity layer after every earlier event editor stylesheet", () => {
    expect(stylesEntry).toContain('@import "./editor/event-editor.balanced.css";');
    expect(stylesEntry.lastIndexOf("event-editor.balanced.css")).toBeGreaterThan(
      stylesEntry.lastIndexOf("event-editor-help.css"),
    );
  });

  it("owns the target viewport bands, workbench tracks, and independent scroll surfaces", () => {
    const css = readFileSync(balancedStylesUrl, "utf8");

    expect(css).toContain("--balanced-header-height: 54px");
    expect(css).toContain("--balanced-identity-height: 89px");
    expect(css).toContain("--balanced-pages-height: 102px");
    expect(css).toContain("--balanced-footer-height: 55px");
    expect(css).toContain(
      "grid-template-rows: var(--balanced-identity-height) var(--balanced-pages-height) minmax(0, 1fr)",
    );
    expect(css).toMatch(/\.event-editor-modal-dynamic \.event-editor\s*\{[^}]*display:\s*grid/s);
    expect(css).toContain("grid-template-columns: 350px minmax(0, 1fr) 383px");
    expect(css).toMatch(/\.event-editor-settings-main\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.event-editor \.cmd-list,[\s\S]*?overflow-y:\s*auto/s);
    expect(css).toMatch(/\.event-editor-inspector-column\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it("keeps the existing functional regions visible in the balanced composition", () => {
    const css = readFileSync(balancedStylesUrl, "utf8");

    for (const selector of [
      ".event-editor-top-strip",
      ".event-page-number-tabs",
      ".event-editor-settings-column",
      ".event-editor-commands",
      ".event-editor-inspector-column",
      ".event-draft-validation",
      ".event-editor-modal-footer",
    ]) {
      expect(css).toContain(selector);
    }
  });

  it("renders the event identity band before the full-width page strip", () => {
    expect(contentSource).toMatch(/section\.append\(\s*eventCard,\s*\/\/ 페이지 전환/);
    expect(contentSource).toContain("settingsColumn.append(settingsMain)");
    expect(contentSource).not.toContain("settingsColumn.append(eventCard, settingsMain)");
  });
});
