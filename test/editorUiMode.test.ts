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
    expect(standard.canvasChromeDense).toBe(true);
    expect(expert.mapTree).toBe(true);
    expect(expert.classicToolbar).toBe(true);
    expect(expert.canvasChromeDense).toBe(true);
    expect(expert.helpMenu).toBe(true);
    expect(beginner.paletteRail).toBe(true);
    expect(beginner.leftPanelMaxWidthPx).toBe(null);
    expect(beginner.layerTermStyle).toBe("plain");
    expect(beginner.prominentTestPlay).toBe(true);
    expect(beginner.coachMarks).toBe(true);
    expect(beginner.standardWelcome).toBe(false);
    expect(standard.paletteRail).toBe(false);
    expect(standard.leftPanelMaxWidthPx).toBe(300);
    expect(standard.layerTermStyle).toBe("technical");
    expect(standard.prominentTestPlay).toBe(false);
    expect(standard.coachMarks).toBe(false);
    expect(standard.standardWelcome).toBe(true);
    expect(expert.paletteRail).toBe(false);
    expect(expert.leftPanelMaxWidthPx).toBe(320);
    expect(expert.layerTermStyle).toBe("technical");
    expect(expert.prominentTestPlay).toBe(false);
    expect(expert.coachMarks).toBe(false);
    expect(expert.standardWelcome).toBe(false);
    expect("aiDenseSections" in beginner).toBe(false);
    expect("aiDenseSections" in standard).toBe(false);
    expect("aiDenseSections" in expert).toBe(false);
  });

  it("pins beginner/standard/expert chrome flags for rail labels, database nav, event chrome, jargon style", () => {
    const beginner = chromeForMode("beginner");
    const standard = chromeForMode("standard");
    const expert = chromeForMode("expert");

    expect(beginner.railLabels).toBe("persistent");
    expect(beginner.databaseNav).toBe("common");
    expect(beginner.eventBeginnerChrome).toBe(true);
    expect(beginner.jargonStyle).toBe("plain");

    expect(standard.railLabels).toBe("hover");
    expect(standard.databaseNav).toBe("grouped");
    expect(standard.eventBeginnerChrome).toBe(true);
    expect(standard.jargonStyle).toBe("plain");

    expect(expert.railLabels).toBe("hover");
    expect(expert.databaseNav).toBe("grouped");
    expect(expert.eventBeginnerChrome).toBe(false);
    expect(expert.jargonStyle).toBe("technical");

    expect(parseEditorUiMode("basic")).toBe("beginner");
  });

  it("characterization: pins current chrome field names before the todo-2 extension", () => {
    const beginner = chromeForMode("beginner");
    const expected = [
      "mapTree",
      "classicToolbar",
      "canvasChromeDense",
      "helpMenu",
      "gameMenuLabel",
      "paletteRail",
      "leftPanelMaxWidthPx",
      "layerTermStyle",
      "prominentTestPlay",
      "coachMarks",
      "standardWelcome",
      "statusbarDensity",
    ];
    for (const key of expected) {
      expect(Object.prototype.hasOwnProperty.call(beginner, key)).toBe(true);
    }
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

});
