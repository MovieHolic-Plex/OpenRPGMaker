import { afterEach, describe, expect, it } from "vitest";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
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
});

describe("renderCanvasToolbar zoom visibility", () => {
  it("renders the full zoom set behind the expand gate", () => {
    storage = new MemoryStorage();
    restoreDom = installFakeDom();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });

    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    const fake = asFake(host);

    expect(fake.classList.contains("is-basic-chrome")).toBe(false);
    expect(fake.classList.contains("is-expanded")).toBe(false);
    expect(fake.dataset.uiDensity).toBe("expert");
    // Dense path: expand gate present, full zoom set rendered behind it.
    expect(fake.querySelector('[data-testid="editor-canvas-toolbar-expand"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="canvas-ai-workbench"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="canvas-ai-create"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="canvas-ai-polish"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="canvas-ai-inspect"]')).toBeTruthy();
    expect(fake.querySelector('[data-testid="canvas-ai-ask"]')).toBeTruthy();
    for (const z of [0.25, 0.5, 1, 2, 3, 4, 6, 8]) {
      expect(fake.querySelector(`[data-testid="editor-zoom-${z}"]`)).toBeTruthy();
    }
  });

  it("keeps the toolbar collapsed by default (⋯ gate still applies)", () => {
    storage = new MemoryStorage();
    restoreDom = installFakeDom();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });

    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    const fake = asFake(host);

    expect(fake.classList.contains("is-basic-chrome")).toBe(false);
    expect(fake.classList.contains("is-expanded")).toBe(false);
    expect(fake.dataset.uiDensity).toBe("expert");
    expect(fake.querySelector('[data-testid="editor-canvas-toolbar-expand"]')).toBeTruthy();
  });
});
