import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesEntry = readFileSync(new URL("../src/styles/index.css", import.meta.url), "utf8");
const balancedStylesUrl = new URL("../src/styles/editor/event-editor.balanced.css", import.meta.url);
const contentSource = readFileSync(new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("../src/editor/panels/eventEditor/modal.ts", import.meta.url), "utf8");
const pagePropsSource = readFileSync(new URL("../src/editor/panels/eventEditor/pageProps.ts", import.meta.url), "utf8");

describe("hierarchy event editor presentation layer", () => {
  it("loads the fidelity layer after every earlier event editor stylesheet", () => {
    expect(stylesEntry).toContain('@import "./editor/event-editor.balanced.css";');
    expect(stylesEntry.lastIndexOf("event-editor.balanced.css")).toBeGreaterThan(
      stylesEntry.lastIndexOf("event-editor-help.css"),
    );
  });

  it("owns the target viewport bands, workbench tracks, and independent scroll surfaces", () => {
    const css = readFileSync(balancedStylesUrl, "utf8");

    expect(css).toMatch(/--(?:hierarchy|balanced)-header-height:\s*48px/);
    expect(css).not.toContain("--balanced-identity-height: 89px");
    expect(css).toMatch(/--(?:hierarchy|balanced)-pages-height:\s*40px/);
    expect(css).toMatch(/--(?:hierarchy|balanced)-footer-height:\s*40px/);
    expect(css).toMatch(/\.event-editor-modal-dynamic \.event-editor\s*\{[^}]*display:\s*grid/s);
    expect(css).toMatch(/\.event-editor-modal-body\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/grid-template-rows:\s*var\(--hierarchy-pages-height\)\s+minmax\(0,\s*1fr\)\s+!important/);
    expect(css).toContain(".event-editor-render-error");
    expect(css).toMatch(/grid-template-columns: 228px minmax\(0, 1fr\) 340px !important/);
    expect(css).toContain("overflow-y: auto");
  });

  it("keeps the existing functional regions visible in the hierarchy composition", () => {
    const css = readFileSync(balancedStylesUrl, "utf8");

    for (const selector of [
      ".event-editor-pagebar",
      ".event-page-number-tabs",
      ".event-editor-settings-column",
      ".event-editor-commands-column",
      ".event-editor-inspector-column",
      ".event-editor-modal-footer",
    ]) {
      expect(css).toContain(selector);
    }
  });

  it("renders the event name in the titlebar and compact presence in settings", () => {
    expect(modalSource).toContain("event-editor-name");
    // 이벤트 정체성은 «이름 + 좌표» 다(DESIGN.md §5). 예전 헤더의 `0007` 은 ID 가 아니라
    // 맵 events 배열의 순번(findIndex+1)을 4자리로 채운 값이라 앞 이벤트를 지우면 밀렸다 —
    // 안정적인 식별자처럼 보이지만 아니었으므로 제거했다. 되살리지 말 것.
    expect(modalSource).not.toContain("event-editor-event-id");
    expect(modalSource).toContain("event-editor-coords");
    expect(modalSource).toContain("event-editor-npc-chip");
    expect(pagePropsSource).toContain("class: \"presence\"");
    expect(pagePropsSource).not.toContain("1. 언제 나타날까요?");
  });

  it("keeps the truthful save state and validation actions available", () => {
    expect(modalSource).toContain('dataset: { testid: "event-editor-header-save-state" }');
    expect(modalSource).toContain("refreshModalHeaderSaveState");
    expect(modalSource).toContain("event-editor-save");
    expect(modalSource).toContain("event-editor-apply");
  });

  it("keeps page copy and delete actions visibly available", () => {
    expect(pagePropsSource).not.toContain("wrap.open = true");
    expect(pagePropsSource).toContain("requestEventPageDeletion");
    expect(pagePropsSource).toContain("evt-page-add");
  });
});
