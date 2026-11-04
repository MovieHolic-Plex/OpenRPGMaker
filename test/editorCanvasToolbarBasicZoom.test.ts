import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { resetCanvasToolPillForTests } from "@/editor/panels/canvasToolPill";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function asFake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function render(): FakeElement {
  const host = document.createElement("div") as unknown as HTMLElement;
  renderCanvasToolbar(host);
  return asFake(host);
}

function ids(fake: FakeElement): string[] {
  return Array.from(fake.children as unknown as FakeElement[], (child) => child.dataset.testid ?? child.className);
}

beforeEach(() => {
  restoreDom = installFakeDom();
  resetCanvasToolPillForTests();
  const project = createBlankProject();
  store.replace(project);
  resetMapEditHistory();
  editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", tool: "paint", zoom: 2 });
});

afterEach(() => {
  resetCanvasToolPillForTests();
  restoreDom?.();
  restoreDom = null;
});

// 2026-11 캔버스 알약 개편: 캔버스 위 떠 있는 도구는 칠하기·사각형·채우기·화면 밀기 | 되돌리기 | 배율 하나뿐이다.
describe("canvas tool pill", () => {
  it("renders exactly the mock's controls in order, and nothing else", () => {
    const fake = render();
    expect(fake.classList.contains("canvas-tool-pill")).toBe(true);
    expect(ids(fake)).toEqual([
      "tool-paint",
      "tool-rect",
      "tool-fill",
      "tool-pan",
      "canvas-tool-pill-divider",
      "canvas-tool-undo",
      "editor-zoom-group",
    ]);
    for (const gone of [
      "editor-canvas-toolbar-expand",
      "canvas-ai-workbench",
      "walk-encounter-list-open",
      "map-location-layer-toggle",
      "map-background-preview-toggle",
      "editor-grid-toggle",
      "editor-map-screenshot-button",
    ]) {
      expect(fake.querySelector(`[data-testid="${gone}"]`), gone).toBeNull();
    }
  });

  it("shows zoom as a percentage and keeps every editor-zoom-* level behind it", () => {
    const fake = render();
    const stepper = fake.querySelector('[data-testid="editor-zoom-stepper"]');
    expect(stepper?.textContent).toBe("200%");
    for (const z of [0.25, 0.5, 1, 2, 3, 4, 6, 8]) {
      expect(fake.querySelector(`[data-testid="editor-zoom-${z}"]`), String(z)).toBeTruthy();
    }
    (fake.querySelector('[data-testid="editor-zoom-4"]') as FakeElement).click();
    expect(editorState.get().zoom).toBe(4);
  });

  it("drives the shared tool state and reflects it as the pressed button", () => {
    let fake = render();
    (fake.querySelector('[data-testid="tool-rect"]') as FakeElement).click();
    expect(editorState.get()).toMatchObject({ tool: "paint", paintShape: "rect" });
    fake = render();
    expect(fake.querySelector('[data-testid="tool-rect"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(fake.querySelector('[data-testid="tool-paint"]')?.getAttribute("aria-pressed")).toBe("false");
    (fake.querySelector('[data-testid="tool-pan"]') as FakeElement).click();
    expect(editorState.get().tool).toBe("pan");
    (fake.querySelector('[data-testid="tool-fill"]') as FakeElement).click();
    expect(editorState.get().tool).toBe("fill");
  });

  it("disables undo while the history stack is empty", () => {
    const fake = render();
    const undo = fake.querySelector('[data-testid="canvas-tool-undo"]') as FakeElement | null;
    expect(undo?.disabled).toBe(true);
  });

  it("drops the tile tools on the event layer but keeps undo and zoom", () => {
    editorState.set({ layer: "event", tool: "event" });
    const fake = render();
    expect(fake.querySelector('[data-testid="tool-paint"]')).toBeNull();
    expect(fake.querySelector('[data-testid="canvas-tool-undo"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="editor-zoom-stepper"]')).toBeTruthy();
  });
});
