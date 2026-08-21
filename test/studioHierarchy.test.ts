import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { stepEditorZoom } from "@/editor/panels/editorZoomToolbar";
import { renderEditorStatusbar } from "@/editor/panels/editorStatusbar";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

const STATUSBAR_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles/shell/figma-editor/05-canvas-statusbar.css"),
  "utf8",
);

describe("stepEditorZoom", () => {
  it("steps within the visible level list", () => {
    expect(stepEditorZoom(1, [1, 2, 4], 2)).toBe(4);
    expect(stepEditorZoom(-1, [1, 2, 4], 2)).toBe(1);
    expect(stepEditorZoom(1, [1, 2, 4], 4)).toBe(4);
    expect(stepEditorZoom(-1, [1, 2, 4], 1)).toBe(1);
  });
});

describe("studio statusbar and empty events", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      layer: "event",
      tool: "event",
    });
    resetEditorUiModeForTests("expert");
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    resetEditorUiModeForTests("standard");
  });

  it("expert always-visible cells are layer, map, and save", () => {
    const host = document.createElement("div");
    renderEditorStatusbar(host);
    const mapCell = host.querySelector("[data-testid='statusbar-map']");
    expect(mapCell?.textContent).toMatch(/맵:/);
    expect(mapCell?.classList.contains("strong")).toBe(true);
    expect(mapCell?.classList.contains("editor-statusbar-cell")).toBe(true);
    expect(STATUSBAR_CSS).toMatch(
      /editor-statusbar-cell:not\(button\):not\(\.strong\):not\(\[data-testid="statusbar-map"\]\)/,
    );
    const children = Array.from(host.childNodes).filter((node) => node instanceof HTMLElement);
    const always = children.filter((node) => !node.classList.contains("editor-statusbar-overflow"));
    expect(always.some((node) => node.textContent?.includes("줌:"))).toBe(false);
    expect(host.querySelector("[data-testid='statusbar-overflow']")?.textContent).toContain("줌:");
  });

  it("event layer keeps the chipset under the event list", () => {
    const host = document.createElement("div");
    renderTilePalette(host);
    expect(host.querySelector("[data-testid='palette-event-dock']")).toBeTruthy();
    expect(host.querySelector("[data-testid='event-list-empty']")).toBeTruthy();
    expect(host.querySelector(".chipset-sheet, .palette-work-shell")).toBeTruthy();
  });

  it("empty event list is a one-line next action", () => {
    const host = document.createElement("div");
    renderEventEditor(host);
    const empty = host.querySelector("[data-testid='event-list-empty']");
    expect(empty?.textContent).toContain("이벤트 없음");
    expect(empty?.textContent).toContain("더블클릭으로 추가");
    expect(empty?.tagName).toBe("BUTTON");
  });
});
