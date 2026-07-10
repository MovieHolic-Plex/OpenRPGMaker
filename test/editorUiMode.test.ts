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
    expect(basic.aiDenseSections).toBe(false);
    expect(basic.paletteFindPropsTabs).toBe(false);
    // Event editing is not gated off by chrome flags — layers/tools stay in shared shell.
    expect(expert.mapTree).toBe(true);
    expect(expert.classicToolbar).toBe(true);
    expect(expert.aiDenseSections).toBe(true);
    expect(expert.helpMenu).toBe(true);
  });

  it("uses AI RPG MAKER as the product brand string", () => {
    expect(EDITOR_PRODUCT_BRAND).toBe("AI RPG MAKER");
  });

  it("keeps event tool id available in shared palette tool list (basic does not gate events)", async () => {
    // Structural: shipped tool section always includes event (basic only reduces chrome density).
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/editor/panels/tilePaletteToolbar.ts", import.meta.url), "utf8"),
    );
    expect(source).toMatch(/id:\s*"event"/);
    expect(source).toMatch(/testid:\s*`tool-\$\{t\.id\}`|tool-event|t\.id/);
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
});
