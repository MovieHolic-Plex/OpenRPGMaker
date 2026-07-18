import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_UI_MODE,
  EDITOR_PRODUCT_BRAND,
  EDITOR_UI_MODE_STORAGE_KEY,
  chromeForMode,
  loadEditorUiMode,
  parseEditorUiMode,
  resetEditorUiModeForTests,
  saveEditorUiMode,
  setEditorUiMode,
  getEditorUiMode,
  applyEditorUiModeClasses,
} from "@/editor/editorUiMode";

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

afterEach(() => {
  resetEditorUiModeForTests("basic");
});

describe("editorUiMode", () => {
  it("defaults to basic when storage is empty or invalid", () => {
    const storage = new MemoryStorage();
    expect(DEFAULT_EDITOR_UI_MODE).toBe("basic");
    expect(loadEditorUiMode(storage)).toBe("basic");
    expect(parseEditorUiMode(null)).toBe("basic");
    expect(parseEditorUiMode("")).toBe("basic");
    expect(parseEditorUiMode("nope")).toBe("basic");
    expect(parseEditorUiMode("BASIC")).toBe("basic");
  });

  it("round-trips expert mode through storage", () => {
    const storage = new MemoryStorage();
    saveEditorUiMode("expert", storage);
    expect(storage.getItem(EDITOR_UI_MODE_STORAGE_KEY)).toBe("expert");
    expect(loadEditorUiMode(storage)).toBe("expert");
    saveEditorUiMode("basic", storage);
    expect(loadEditorUiMode(storage)).toBe("basic");
  });

  it("setEditorUiMode persists and updates body hooks when document exists", () => {
    const storage = new MemoryStorage();
    resetEditorUiModeForTests("basic");
    setEditorUiMode("expert", storage);
    expect(getEditorUiMode()).toBe("expert");
    expect(storage.getItem(EDITOR_UI_MODE_STORAGE_KEY)).toBe("expert");
    if (typeof document !== "undefined" && document.body) {
      applyEditorUiModeClasses("expert");
      expect(document.body.classList.contains("editor-ui-expert")).toBe(true);
      expect(document.body.classList.contains("editor-ui-basic")).toBe(false);
      expect(document.body.dataset.editorUiMode).toBe("expert");
    }
    setEditorUiMode("basic", storage);
    expect(getEditorUiMode()).toBe("basic");
  });

  it("basic chrome hides map tree column (map flyout owns switching) while reducing density", () => {
    const basic = chromeForMode("basic");
    const expert = chromeForMode("expert");
    // Map switching moved to the icon-rail map flyout — the left map-tree column is hidden in basic.
    expect(basic.mapTree).toBe(false);
    expect(basic.classicToolbar).toBe(false);
    // Event editing is not gated off by chrome flags — layers/tools stay in shared shell.
    expect(expert.mapTree).toBe(true);
    expect(expert.classicToolbar).toBe(true);
    expect(expert.helpMenu).toBe(true);
    // AI assistant chrome is mode-agnostic — there is no AI density flag at all.
    expect("aiDenseSections" in basic).toBe(false);
    expect("aiDenseSections" in expert).toBe(false);
  });

  it("uses AI RPG MAKER as the product brand string", () => {
    expect(EDITOR_PRODUCT_BRAND).toBe("AI RPG MAKER");
  });

  it("keeps event tool id available in shared palette tool list (basic does not gate events)", async () => {
    // Structural: shipped toolbar always includes event (basic only reduces chrome density).
    // 구 tilePaletteToolbar.ts는 통합 툴바(rpgMakerTileToolbar.ts)로 흡수됨 (2026-07-18).
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/editor/panels/rpgMakerTileToolbar.ts", import.meta.url), "utf8"),
    );
    expect(source).toMatch(/id:\s*"event"/);
    expect(source).toMatch(/testid:\s*`tool-\$\{item\.id\}`|tool-event/);
    // chrome flags never include an "eventsBlocked" style switch
    const basic = chromeForMode("basic");
    expect("eventsBlocked" in basic).toBe(false);
    // Map tree is hidden in basic; map switching is owned by the icon-rail map flyout
    expect(basic.mapTree).toBe(false);
    // basic left rail also ships event tool
    const basicRail = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/editor/panels/basicLeftRail.ts", import.meta.url), "utf8"),
    );
    expect(basicRail).toMatch(/id:\s*"event"/);
    expect(basicRail).toMatch(/testid:\s*`tool-\$\{tool\.id\}`|tool-event|event/);
  });

  it("basic icon rail CSS keeps flyouts unclipped above the canvas", async () => {
    const fs = await import("node:fs/promises");
    const css = await fs.readFile(new URL("../src/styles/shell/editor-ui-modes.css", import.meta.url), "utf8");
    const indexCss = await fs.readFile(new URL("../src/styles/index.css", import.meta.url), "utf8");
    // Cascade: density modes after figma shell skin
    const figmaIdx = indexCss.indexOf('figma-editor.css');
    const modesIdx = indexCss.indexOf("editor-ui-modes.css");
    expect(figmaIdx).toBeGreaterThan(-1);
    expect(modesIdx).toBeGreaterThan(figmaIdx);
    // Overflow + stacking so layer/map flyouts are not under the map canvas
    expect(css).toMatch(/body\.editor-ui-basic[\s\S]*overflow:\s*visible\s*!important/);
    expect(css).toMatch(/body\.editor-ui-basic[\s\S]*z-index:\s*50/);
    expect(css).toMatch(/body\.editor-ui-basic[\s\S]*padding:\s*0\s*!important/);
  });
});
