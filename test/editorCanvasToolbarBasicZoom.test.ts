import { afterEach, describe, expect, it } from "vitest";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { resetEditorUiModeForTests, setEditorUiMode } from "@/editor/editorUiMode";
import { FakeElement, installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

function asFake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  resetEditorUiModeForTests("basic");
});

describe("renderCanvasToolbar basic zoom visibility", () => {
  it("marks basic chrome as is-expanded so zoom buttons are not gated behind ⋯", () => {
    storage = new MemoryStorage();
    restoreDom = installFakeDom();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    setEditorUiMode("basic", storage);

    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    const fake = asFake(host);

    expect(fake.classList.contains("is-basic-chrome")).toBe(true);
    expect(fake.classList.contains("is-expanded")).toBe(true);
    expect(fake.dataset.uiDensity).toBe("basic");
    // Zoom levels present — figma CSS shows .zoom-button only when is-expanded.
    for (const z of [1, 2, 3, 4, 6, 8]) {
      expect(fake.querySelector(`[data-testid="editor-zoom-${z}"]`)).toBeTruthy();
    }
    // No expand control / map-save in basic path
    expect(fake.querySelector('[data-testid="editor-canvas-toolbar-expand"]')).toBeNull();
    expect(fake.querySelector('[data-testid="editor-map-screenshot-button"]')).toBeNull();
  });

  it("keeps expert chrome collapsed by default (⋯ gate still applies)", () => {
    storage = new MemoryStorage();
    restoreDom = installFakeDom();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    setEditorUiMode("expert", storage);

    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    const fake = asFake(host);

    expect(fake.classList.contains("is-basic-chrome")).toBe(false);
    expect(fake.classList.contains("is-expanded")).toBe(false);
    expect(fake.dataset.uiDensity).toBe("expert");
    expect(fake.querySelector('[data-testid="editor-canvas-toolbar-expand"]')).toBeTruthy();
  });
});
