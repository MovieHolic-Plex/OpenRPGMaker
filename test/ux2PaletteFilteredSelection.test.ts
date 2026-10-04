/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearFavoriteTilesForTest, recordRecentTile } from "@/editor/panels/tileBrushTools";
import { renderTilePalette, selectPaletteTile, syncMountedPaletteLayerSelection, syncMountedPaletteSelection } from "@/editor/panels/tilePalette";
import { resetSidebarSurfaceForTests } from "@/editor/panels/sidebarSurface";
import { combinedTownTileset, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

const work = vi.hoisted(() => ({ similar: vi.fn((_input: unknown) => []), used: vi.fn((_input: unknown) => []), canvas: vi.fn() }));
vi.mock("@/editor/panels/tileBrushTools", async (original) => ({
  ...await original<typeof import("@/editor/panels/tileBrushTools")>(),
  similarTilesForTile: work.similar,
  usedLocationsForTile: work.used,
}));
vi.mock("@/editor/harnessSuggestion/kitRender", async (original) => ({
  ...await original<typeof import("@/editor/harnessSuggestion/kitRender")>(),
  renderTileCellsToCanvas: (...args: unknown[]) => { work.canvas(...args); return document.createElement("canvas"); },
}));

describe("UX2 filtered palette and closed auxiliary bodies", () => {
  let root: HTMLElement;
  let unsubscribe: () => void;
  const find = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const filter = (category: string) => {
    const select = find("tile-category-select") as HTMLSelectElement;
    select.value = category;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  function mount(count = 24, rm2k = false): void {
    const project = createBlankProject();
    const tileset: TilesetDef = rm2k ? combinedTownTileset() : {
      id: "ux2-atlas", name: "UX2 atlas", kind: "custom",
      image: { type: "bundled", id: "ux2-sheet" }, tileSize: 16, count, tilesPerRow: 6,
      passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })),
      priority: Array(count).fill("lower"), terrain: Array(count).fill(0),
      tileMeta: Array.from({ length: count }, (_, i) => ({ label: `tile ${i}`, description: "", tags: i === 0 ? ["road"] : ["house"] })),
      structureKits: Array.from({ length: 3 }, (_, i) => ({
        id: `kit-${i}`, kind: "section", width: 1, height: 1, rows: [{ tiles: [0] }], learnedFrom: "user-paint",
      })),
    };
    if (!rm2k) tileset.priority[2] = "upper";
    project.tilesets[tileset.id] = tileset;
    project.maps[project.startMapId]!.tilesetId = tileset.id;
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, layer: "lower", tool: "paint", paintShape: "pen", selectedTile: 0, activePaletteStamp: null, autoConnectMode: true, clusterAssistMode: true });
    renderTilePalette(root);
    filter("all");
    unsubscribe = editorState.subscribe(() => {
      if (!syncMountedPaletteLayerSelection() && !syncMountedPaletteSelection()) renderTilePalette(root);
    });
    work.similar.mockClear(); work.used.mockClear(); work.canvas.mockClear();
  }
  beforeEach(() => {
    vi.useFakeTimers();
    clearFavoriteTilesForTest();
    resetSidebarSurfaceForTests();
    root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);
    unsubscribe = () => {};
  });
  afterEach(() => {
    unsubscribe();
    resetSidebarSurfaceForTests();
    root.remove();
    vi.clearAllTimers(); vi.useRealTimers();
  });

  it.each([24, 5000])("retains sheet, controls, focus and scroll for a filtered %i-cell custom atlas", (count) => {
    mount(count);
    filter("house");
    const sheet = find("tile-palette"), search = find("tile-search-input"), controls = find("auto-connect-mode-toggle");
    const former = find("chipset-tile-0"), selected = find("chipset-tile-1");
    sheet.scrollTop = 64;
    selected.focus();
    selected.click();
    expect(find("tile-palette")).toBe(sheet);
    expect(find("tile-search-input")).toBe(search);
    expect(find("auto-connect-mode-toggle")).toBe(controls);
    expect(document.activeElement).toBe(selected);
    expect(sheet.scrollTop).toBe(64);
    expect(former.classList.contains("is-filtered-out")).toBe(true);
    expect(selected.classList.contains("active")).toBe(true);
    expect(find("selected-tile-status").dataset.selectedTile).toBe("1");
    expect(find("auto-connect-mode-hint").textContent).toBe("이 타일 단독");
    expect(find("palette-filter-status").textContent).toContain(`${count - 1}칸 표시`);
    expect(work.similar).not.toHaveBeenCalled(); expect(work.used).not.toHaveBeenCalled(); expect(work.canvas).not.toHaveBeenCalled();
    selectPaletteTile(2);
    expect(editorState.get().layer).toBe("upper");
    expect(find("tile-palette")).toBe(sheet);
    expect(find("tile-brush-state").dataset.layer).toBe("upper");
  });

  it("updates Recent membership, eviction and counts while a search stays focused", () => {
    mount();
    for (let tile = 0; tile < 18; tile += 1) recordRecentTile(tile);
    filter("recent");
    const search = find("tile-search-input") as HTMLInputElement;
    search.value = "tile 0";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(120);
    search.focus();
    const sheet = find("tile-palette"), former = find("chipset-tile-0");
    selectPaletteTile(18);
    expect(find("tile-palette")).toBe(sheet);
    expect(document.activeElement).toBe(search);
    expect(former.classList.contains("is-filtered-out")).toBe(true);
    expect(find("chipset-tile-18").classList.contains("is-filtered-out")).toBe(false);
    expect(find("palette-filter-status").textContent).toContain("0칸 표시");
    expect(root.querySelector('option[value="recent"]')?.textContent).toBe("최근 (18)");
  });

  it("constructs assist/kit content only after opening and keeps inline toggles working", () => {
    mount();
    expect(find("cluster-assist-mode-toggle")).toBeTruthy();
    find("auto-connect-mode-toggle").click();
    expect(editorState.get().autoConnectMode).toBe(false);
    expect(work.similar).not.toHaveBeenCalled(); expect(work.used).not.toHaveBeenCalled(); expect(work.canvas).not.toHaveBeenCalled();
    find("sidebar-structure-kits").click();
    expect(work.canvas).toHaveBeenCalledTimes(3);
    find("sidebar-kits-close").click();
    find("palette-brush-assist-toggle").click();
    expect(work.similar).toHaveBeenCalledTimes(1); expect(work.used).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('[data-testid="auto-connect-mode-toggle"]')).toHaveLength(1);
    selectPaletteTile(1);
    expect(work.similar).toHaveBeenCalledTimes(2);
    expect(work.similar.mock.calls.at(-1)?.[0]).toMatchObject({ tile: 1 });
  });

  it("keeps RM2K filtered rebuilds and defers its closed combo icons", () => {
    mount(480, true);
    filter("house");
    expect(work.canvas).not.toHaveBeenCalled();
    const sheet = find("tile-palette");
    selectPaletteTile(360);
    expect(find("tile-palette")).not.toBe(sheet);
    expect(find("chipset-tile-360")).toBeTruthy();
    find("sidebar-combo-brushes").click();
    expect(work.canvas).toHaveBeenCalled();
  });
});
