import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventSurfaceFiles, readEventSurfaceCss } from "./helpers/eventSurfaceCss";

// 이벤트 에디터 시트는 표면 진입 시트 src/styles/event/index.css 가 @layer event 로 가져온다(modal.ts 가 import).
const stylesEntry = readFileSync(new URL("../src/styles/event/index.css", import.meta.url), "utf8");
// 2026-09-11 Task 13: 셸·페이지·푸터 규칙을 갖던 event-editor.balanced.css 는 구성 요소 버킷으로 흩어졌다 → 표면 전체를 읽는다.
const surfaceCss = readEventSurfaceCss();
const contentSource = readFileSync(new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("../src/editor/panels/eventEditor/modal.ts", import.meta.url), "utf8");
const pagePropsSource = readFileSync(new URL("../src/editor/panels/eventEditor/pageProps.ts", import.meta.url), "utf8");

describe("hierarchy event editor presentation layer", () => {
  it("registers every component bucket in @layer event, shell first and previews last", () => {
    // 버킷 순서(shell → pages → command-list → inspector → footer → subdialogs → command-forms → previews)가 접기 전 유효 순서다.
    const imports = stylesEntry.split("\n").filter((line) => line.startsWith("@import"));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^@import "\.\/[\w./-]+\.css" layer\(event\);$/);
    expect(imports[0]).toBe('@import "./shell.css" layer(event);');
    expect(stylesEntry.indexOf("./pages.css")).toBeGreaterThan(stylesEntry.indexOf("./shell.css"));
    expect(stylesEntry.indexOf("./footer.css")).toBeGreaterThan(stylesEntry.indexOf("./pages.css"));
    expect(stylesEntry.lastIndexOf("./previews/command-preview")).toBeGreaterThan(stylesEntry.lastIndexOf("./command-forms/forms"));
    expect(eventSurfaceFiles().length).toBe(imports.length);
  });

  it("owns the target viewport bands, workbench tracks, and independent scroll surfaces", () => {
    const css = surfaceCss;

    expect(css).toMatch(/--(?:hierarchy|balanced)-header-height:\s*48px/);
    expect(css).not.toContain("--balanced-identity-height: 89px");
    expect(css).toMatch(/--(?:hierarchy|balanced)-pages-height:\s*40px/);
    expect(css).toMatch(/--(?:hierarchy|balanced)-footer-height:\s*40px/);
    expect(css).toMatch(/\.event-editor-modal-dynamic \.event-editor\s*\{[^}]*display:\s*grid/s);
    expect(css).toMatch(/\.event-editor-modal-body\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/grid-template-rows:\s*var\(--hierarchy-pages-height\)\s+minmax\(0,\s*1fr\)/);
    expect(css).toContain(".event-editor-render-error");
    // 워크벤치 트랙은 event 표면이 소유한다 — 레이어 순서·특이도·선언 순서로 이기므로
    // !important 가 없어야 한다(2026-09-11 Task 12: 이벤트 편집기 시트에서 !important 를 모두 뗐다). 표면 전체에 0건.
    expect(css).toMatch(
      /\.event-editor \.event-editor-workbench,\s*\.event-editor \.event-editor-workbench:not\(\.has-command-inspector\)\s*\{\s*grid-template-columns: var\(--balanced-settings-width\) minmax\(0, 1fr\) var\(--event-inspector-reserved-track, 0px\);/,
    );
    expect(css).toMatch(
      /\.event-editor \.event-editor-workbench\.has-command-inspector\s*\{\s*grid-template-columns: var\(--balanced-settings-width\) minmax\(0, 1fr\) var\(--balanced-inspector-width\);/,
    );
    expect(css).not.toContain("!important");
    expect(css).toContain("overflow-y: auto");
  });

  it("keeps the existing functional regions visible in the hierarchy composition", () => {
    const css = surfaceCss;

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
