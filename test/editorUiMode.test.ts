import { afterEach, describe, expect, it } from "vitest";
import { PRODUCT_BRAND } from "@/brand";
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

  it("defines distinct progressive chrome for beginner and standard (expert aliases standard)", () => {
    const beginner = chromeForMode("beginner");
    const standard = chromeForMode("standard");
    const expert = chromeForMode("expert");

    // 표준이 전문가 capability를 흡수했다 — expert는 standard와 동일 별칭이다.
    expect(standard).toEqual(expert);
    expect(beginner.advancedSidebarControls).toBe(false);
    expect(standard.advancedSidebarControls).toBe(true);
    expect(beginner.mapTree).toBe(false);
    expect(beginner.toolStrip).toBe(false);
    expect(beginner.canvasChromeDense).toBe(false);
    expect(standard.mapTree).toBe(true);
    expect(standard.toolStrip).toBe(true);
    expect(standard.canvasChromeDense).toBe(true);
    expect(beginner.paletteRail).toBe(true);
    expect(beginner.leftPanelMaxWidthPx).toBe(null);
    expect(beginner.layerTermStyle).toBe("plain");
    expect(beginner.prominentTestPlay).toBe(true);
    expect(beginner.coachMarks).toBe(true);
    expect(beginner.standardWelcome).toBe(false);
    expect(standard.paletteRail).toBe(false);
    expect(standard.leftPanelMaxWidthPx).toBe(320);
    expect(standard.layerTermStyle).toBe("technical");
    expect(standard.prominentTestPlay).toBe(false);
    expect(standard.coachMarks).toBe(false);
    expect(standard.standardWelcome).toBe(false);
    expect("aiDenseSections" in beginner).toBe(false);
    expect("aiDenseSections" in standard).toBe(false);
    expect("aiDenseSections" in expert).toBe(false);
  });

  it("pins beginner/standard chrome flags for database nav, event chrome, jargon style", () => {
    const beginner = chromeForMode("beginner");
    const standard = chromeForMode("standard");
    const expert = chromeForMode("expert");

    expect(beginner.databaseNav).toBe("grouped");
    expect(beginner.eventBeginnerChrome).toBe(true);
    expect(beginner.jargonStyle).toBe("plain");

    // 표준이 전문가 capability를 흡수했다 — event 안내 크롬과 용어는 초보와 같다.
    expect(standard.databaseNav).toBe("grouped");
    expect(standard.eventBeginnerChrome).toBe(false);
    expect(standard.jargonStyle).toBe("plain");

    expect(expert.databaseNav).toBe("grouped");
    expect(expert.eventBeginnerChrome).toBe(false);
    expect(expert.jargonStyle).toBe("plain");

    expect(parseEditorUiMode("basic")).toBe("beginner");
  });

  it("characterization: pins current chrome field names before the todo-2 extension", () => {
    const beginner = chromeForMode("beginner");
    const expected = [
      "mapTree",
      "toolStrip",
      "canvasChromeDense",
      "helpMenu",
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

  // 탈-쯔구르 라운드(2026-08-21): 예전 계약은 "AI RPG MAKER" 리터럴을 못박고 있었다 —
  // 즉 침해 문자열을 테스트가 지키고 있었다. 이제 브랜드는 src/brand.ts 단일 원천이고,
  // 계약은 "그 원천에서 온다 + 금지어가 없다" 두 가지다.
  it("derives the product brand from the single brand source", () => {
    expect(EDITOR_PRODUCT_BRAND).toBe(PRODUCT_BRAND);
    expect(EDITOR_PRODUCT_BRAND.trim().length).toBeGreaterThan(0);
  });

  it("keeps trademark-adjacent wording out of the product brand", () => {
    expect(EDITOR_PRODUCT_BRAND).not.toMatch(/rpg\s*maker|rm2k|tkool|ツクール|쯔꾸르|쯔구르|RPG\s*만들기/i);
  });

  it("keeps Event available through shared layers and the unchanged beginner tools", async () => {
    // Actual layer->tool state transitions are covered by sidebarFocusModes and
    // tileToolbarMapModeClickWiring; this guards the shared rendered entry.
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/editor/panels/leftLayerSwitcher.ts", import.meta.url), "utf8"),
    );
    expect(source).toMatch(/id:\s*"event"/);
    expect(source).toMatch(/testid:\s*`layer-\$\{item\.id\}`|layer-event/);
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
