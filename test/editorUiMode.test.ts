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
  resetEditorUiModeForTests("standard");
});

describe("editorUiMode", () => {
  it("defaults to standard when storage is empty or invalid and migrates legacy basic", () => {
    const storage = new MemoryStorage();
    expect(DEFAULT_EDITOR_UI_MODE).toBe("standard");
    expect(loadEditorUiMode(storage)).toBe("standard");
    expect(parseEditorUiMode(null)).toBe("standard");
    expect(parseEditorUiMode("")).toBe("standard");
    expect(parseEditorUiMode("nope")).toBe("standard");
    expect(parseEditorUiMode("basic")).toBe("beginner");
    expect(parseEditorUiMode("beginner")).toBe("beginner");
    expect(parseEditorUiMode("standard")).toBe("standard");
    expect(parseEditorUiMode("expert")).toBe("expert");
  });

  it("round-trips all three modes through storage", () => {
    const storage = new MemoryStorage();
    for (const mode of ["beginner", "standard", "expert"] as const) {
      saveEditorUiMode(mode, storage);
      expect(storage.getItem(EDITOR_UI_MODE_STORAGE_KEY)).toBe(mode);
      expect(loadEditorUiMode(storage)).toBe(mode);
    }
  });

  it("setEditorUiMode persists and keeps the three body hooks mutually exclusive", () => {
    const storage = new MemoryStorage();
    for (const mode of ["beginner", "standard", "expert"] as const) {
      setEditorUiMode(mode, storage);
      expect(getEditorUiMode()).toBe(mode);
      expect(storage.getItem(EDITOR_UI_MODE_STORAGE_KEY)).toBe(mode);
      if (typeof document !== "undefined" && document.body) {
        applyEditorUiModeClasses(mode);
        for (const candidate of ["beginner", "standard", "expert"] as const) {
          expect(document.body.classList.contains(`editor-ui-${candidate}`)).toBe(candidate === mode);
        }
        expect(document.body.dataset.editorUiMode).toBe(mode);
      }
    }
  });

  it("defines distinct progressive chrome for beginner, standard, and expert", () => {
    const beginner = chromeForMode("beginner");
    const standard = chromeForMode("standard");
    const expert = chromeForMode("expert");

    expect(beginner.mapTree).toBe(false);
    expect(beginner.classicToolbar).toBe(false);
    expect(beginner.canvasChromeDense).toBe(false);
    expect(standard.mapTree).toBe(true);
    expect(standard.classicToolbar).toBe(false);
    expect(standard.canvasChromeDense).toBe(false);
    expect(expert.mapTree).toBe(true);
    expect(expert.classicToolbar).toBe(true);
    expect(expert.canvasChromeDense).toBe(true);
    expect(expert.helpMenu).toBe(true);
    expect("aiDenseSections" in beginner).toBe(false);
    expect("aiDenseSections" in standard).toBe(false);
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
    const beginner = chromeForMode("beginner");
    expect("eventsBlocked" in beginner).toBe(false);
    expect(beginner.mapTree).toBe(false);
    const basicRail = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/editor/panels/basicLeftRail.ts", import.meta.url), "utf8"),
    );
    expect(basicRail).toMatch(/id:\s*"event"/);
    expect(basicRail).toMatch(/testid:\s*`tool-\$\{tool\.id\}`|tool-event|event/);
  });

  it("beginner icon rail CSS keeps flyouts unclipped above the canvas", async () => {
    const fs = await import("node:fs/promises");
    const css = await fs.readFile(new URL("../src/styles/shell/editor-ui-modes.css", import.meta.url), "utf8");
    const indexCss = await fs.readFile(new URL("../src/styles/index.css", import.meta.url), "utf8");
    // Cascade: density modes after figma shell skin
    const figmaIdx = indexCss.indexOf('figma-editor.css');
    const modesIdx = indexCss.indexOf("editor-ui-modes.css");
    expect(figmaIdx).toBeGreaterThan(-1);
    expect(modesIdx).toBeGreaterThan(figmaIdx);
    // Overflow + stacking so layer/map flyouts are not under the map canvas
    expect(css).toMatch(/body\.editor-ui-beginner[\s\S]*overflow:\s*visible\s*!important/);
    // z-index 는 tokens.css 의 --z-rail(=50) 로 토큰화됨 — 값은 동일, 캔버스 위로 떠야 한다는 의도 보존.
    expect(css).toMatch(/body\.editor-ui-beginner[\s\S]*z-index:\s*var\(--z-rail\)/);
    expect(css).toMatch(/body\.editor-ui-beginner[\s\S]*padding:\s*0\s*!important/);
  });
});
