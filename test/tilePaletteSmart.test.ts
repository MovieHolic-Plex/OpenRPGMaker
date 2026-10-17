/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearFavoriteTilesForTest, recordRecentTile } from "@/editor/panels/tileBrushTools";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { PALETTE_CARD_ROW_PX, PALETTE_CARD_WINDOW, PALETTE_THUMB_PX, resetSmartPaletteForTests } from "@/editor/panels/tilePaletteSmart";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { SectionStructureKitDef, TilesetDef } from "@/project/types";

function pass(count: number) {
  return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
}

function sectionKit(id: string, name: string, role: "building" | "prop"): SectionStructureKitDef {
  return {
    id,
    name,
    kind: "section",
    width: 1,
    height: 1,
    rows: [{ tiles: [4] }],
    learnedFrom: "user-paint",
    ai: { description: name, placementRules: "", role, tags: name.includes("기와") ? ["기와"] : [] },
  };
}

function smartTileset(kitCount = 1): TilesetDef {
  const count = 16;
  const kits = [sectionKit("giwa-house", "조선 기와집", "building")];
  for (let index = 1; index < kitCount; index += 1) kits.push(sectionKit(`shed-${index}`, `헛간 ${index}`, "prop"));
  return {
    id: "smart-fixture",
    name: "합성",
    kind: "custom",
    image: { type: "bundled", id: "smart-sheet" },
    tileSize: 16,
    count,
    tilesPerRow: 8,
    passability: pass(count),
    priority: Array.from({ length: count }, () => "lower"),
    terrain: Array(count).fill(0),
    tileMeta: [
      undefined,
      { label: "흙길 외곽" },
      undefined,
      { label: "연못" },
      { label: "기와 조각", tags: ["기와"] },
    ],
    autotileGroups: [{
      id: "dirt-road",
      name: "조선 흙길",
      memberTileIds: [1, 8],
      variantMap: { "0": 1, "255": 8 },
      layer: "lower",
    }],
    tileGroups: [{
      id: "pond",
      name: "연못",
      role: "water",
      defaultLayer: "lower",
      tileIds: [3],
      description: "",
      placementRules: "",
    }],
    structureKits: kits,
  };
}

function bareTileset(): TilesetDef {
  const count = 8;
  return {
    id: "bare-fixture",
    name: "빈 판",
    kind: "custom",
    image: { type: "bundled", id: "bare-sheet" },
    tileSize: 16,
    count,
    tilesPerRow: 4,
    passability: pass(count),
    priority: Array.from({ length: count }, () => "lower"),
    terrain: Array(count).fill(0),
  };
}

describe("smart tile palette", () => {
  let host: HTMLElement;
  const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  function mount(tileset: TilesetDef): void {
    const project = createBlankProject();
    project.tilesets[tileset.id] = tileset;
    project.maps[project.startMapId]!.tilesetId = tileset.id;
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      layer: "lower",
      tool: "paint",
      paintShape: "pen",
      selectedTile: 0,
      activePaletteStamp: null,
      autoConnectMode: false,
    });
    host = document.createElement("div");
    host.dataset.testid = "left-palette-root";
    document.body.append(host);
    renderTilePalette(host);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resetSmartPaletteForTests();
    clearFavoriteTilesForTest();
  });

  afterEach(() => {
    host?.remove();
    resetSmartPaletteForTests();
    clearFavoriteTilesForTest();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("opens on terrain cards and paints the autotile body with the existing connect flag", () => {
    mount(smartTileset());
    expect(find("palette-tab-terrain")?.getAttribute("aria-selected")).toBe("true");
    expect(find("tile-palette")).toBeNull();
    const card = find("palette-terrain-auto:dirt-road");
    expect(card?.querySelector(".palette-card-name")?.textContent).toBe("조선 흙길");
    const sprite = card?.querySelector<HTMLElement>(".palette-card-sprite");
    expect(sprite?.getAttribute("style")).toContain(`calc(-1 * ${PALETTE_THUMB_PX}px)`);
    expect(sprite?.getAttribute("style")).not.toContain("100%");
    editorState.set({ activePaletteStamp: { width: 1, height: 1, cells: [], source: { startTile: 0, endTile: 0 } } });
    card?.click();
    expect(editorState.get()).toMatchObject({
      selectedTile: 8,
      autoConnectMode: true,
      activePaletteStamp: null,
      tool: "paint",
      layer: "lower",
    });
  });

  it("filters terrain chips down to water", () => {
    mount(smartTileset());
    find("palette-terrain-chip-water")?.click();
    expect(find("palette-terrain-group:pond")).not.toBeNull();
    expect(find("palette-terrain-auto:dirt-road")).toBeNull();
  });

  it("stamps a prefab and toggles it off", () => {
    mount(smartTileset());
    find("palette-tab-prefab")?.click();
    find("palette-prefab-giwa-house")?.click();
    expect(editorState.get().activePaletteStamp).toMatchObject({ kitId: "giwa-house", width: 1, height: 1 });
    expect(editorState.get().tool).toBe("paint");
    find("palette-prefab-giwa-house")?.click();
    expect(editorState.get().activePaletteStamp).toBeNull();
  });

  it("lists a recently picked tile and selects it through the shared tile path", () => {
    mount(smartTileset());
    recordRecentTile(4);
    find("palette-tab-recent")?.click();
    expect(find("palette-recent-4")?.textContent).toContain("기와 조각");
    find("palette-recent-4")?.click();
    expect(editorState.get().selectedTile).toBe(4);
    expect(editorState.get().activePaletteStamp).toBeNull();
  });

  it("keeps the raw grid, category select, and its own search on the individual tab", () => {
    mount(smartTileset());
    find("palette-tab-tiles")?.click();
    expect(find("tile-palette")).not.toBeNull();
    expect(find("tile-category-select")).not.toBeNull();
    expect(find("tile-search-input")).not.toBeNull();
    expect(find("palette-catalog-search")).toBeNull();
  });

  it("ranks a prefab hit before an individual tile in search results", () => {
    mount(smartTileset());
    const input = find("palette-catalog-search");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing catalog search");
    input.value = "기와";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(120);
    const headings = [...host.querySelectorAll("[data-testid='palette-search-results'] h4")].map((node) => node.textContent ?? "");
    const prefabAt = headings.findIndex((text) => text.startsWith("프리팹"));
    const tileAt = headings.findIndex((text) => text.startsWith("개별 타일"));
    expect(prefabAt).toBeGreaterThanOrEqual(0);
    expect(tileAt).toBeGreaterThan(prefabAt);
    expect(find("palette-search-summary")?.textContent).toContain("프리팹");
  });

  it("virtualizes a long prefab list to the first window", () => {
    mount(smartTileset(80));
    find("palette-tab-prefab")?.click();
    const body = find("palette-smart-body");
    expect(body?.clientHeight ?? 0).toBe(0);
    expect(host.querySelectorAll(".palette-card").length).toBeLessThanOrEqual(PALETTE_CARD_WINDOW);
    expect(host.querySelectorAll(".palette-card").length).toBeGreaterThan(0);
    const rows = Math.ceil(80 / 3);
    expect(host.querySelector<HTMLElement>(".palette-card-spacer")?.style.height).toBe(`${rows * PALETTE_CARD_ROW_PX - 4}px`);
  });

  it("falls back to the raw grid when the tileset has no catalog", () => {
    mount(bareTileset());
    expect(find("palette-smart-tabs")).toBeNull();
    expect(find("tile-palette")).not.toBeNull();
    expect(find("tile-category-select")).not.toBeNull();
  });

  it("clears active catalog search when switching palette tabs so the target tab renders immediately", () => {
    mount(smartTileset());
    const input = find("palette-catalog-search");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing catalog search");
    input.value = "기와";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(120);
    expect(find("palette-search-results")).not.toBeNull();

    find("palette-tab-prefab")?.click();
    expect(find("palette-tab-prefab")?.getAttribute("aria-selected")).toBe("true");
    expect(find("palette-search-results")).toBeNull();
    expect(find("palette-smart")?.dataset.paletteView).toBe("prefab");
    expect(find("palette-prefab-giwa-house")).not.toBeNull();
  });

  it("retains auxiliary relief-side-panel in left-palette-root across smart tab switches", () => {
    mount(smartTileset());
    const relief = document.createElement("section");
    relief.dataset.testid = "relief-side-panel";
    relief.hidden = true;
    host.append(relief);

    find("palette-tab-prefab")?.click();
    find("palette-tab-tiles")?.click();
    find("palette-tab-terrain")?.click();

    expect(find("relief-side-panel")).toBe(relief);
    expect(host.querySelectorAll('[data-testid="palette-work-shell"]')).toHaveLength(1);
  });
});
