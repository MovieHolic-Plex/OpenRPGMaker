/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { makeGridPalette } from "@/editor/panels/tilePaletteGrid";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("sidebar brush and source gestures", () => {
  let host: HTMLElement;
  let unsubscribe: () => void;
  const get = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  function node(id: string): HTMLElement {
    const found = get(id);
    if (!found) throw new Error(`Missing ${id}`);
    return found;
  }
  function pointer(target: EventTarget, type: string, pointerId = 1): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId, pointerType: "mouse" }));
  }
  function custom(): void {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("Missing tileset");
    store.replace({ ...project, tilesets: { ...project.tilesets, [tileset.id]: {
      ...tileset, kind: "custom", count: 12, tilesPerRow: 4,
      image: { type: "bundled", id: "gesture-fixture" },
      priority: Array.from({ length: 12 }, (_, i) => i % 2 ? "upper" : "lower"),
    } } });
    renderTilePalette(host);
  }
  beforeEach(() => {
    vi.useFakeTimers();
    resetTileToolbarMenusForTests();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, tool: "paint", layer: "lower", selectedTile: 0, paintShape: "pen", brushSize: 1, activePaletteStamp: null });
    host = document.createElement("div");
    host.dataset.testid = "left-palette-root";
    document.body.append(host);
    renderTilePalette(host);
    unsubscribe = editorState.subscribe(() => renderTilePalette(host));
  });
  afterEach(() => {
    unsubscribe();
    host.remove();
    resetTileToolbarMenusForTests();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it("F4 exposes unique live brush controls without More", () => {
    editorState.set({ brushSize: 4, paintShape: "pen", layer: "upper" });
    const select = node("brush-size-select");
    if (!(select instanceof HTMLSelectElement)) throw new Error("Missing brush selector");
    expect(select.value).toBe("4");
    expect(Array.from(select.options, option => option.value)).toEqual(["1", "2", "3", "4"]);
    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(node("tile-brush-state").dataset).toMatchObject({ shape: "pen", layer: "upper" });
    expect(editorState.get().brushSize).toBe(2);
    get("oprn-tool-overflow")?.click();
    expect(host.querySelectorAll('[data-testid="brush-size-select"]')).toHaveLength(1);
  });
  it("Paint clears a previous stamp and shape through the tool reset", () => {
    editorState.set({ paintShape: "round", activePaletteStamp: { width: 2, height: 1, source: { startTile: 0, endTile: 1 }, cells: [] } });
    node("tool-paint").click();
    expect(editorState.get()).toMatchObject({ paintShape: "pen", activePaletteStamp: null });
  });
  it("reports the active eraser rather than a retained paint shape or stamp", () => {
    editorState.set({
      tool: "erase",
      activePaletteStamp: { width: 2, height: 1, source: { startTile: 0, endTile: 1 }, cells: [] },
    });
    // Compare two shipped names for the same active action, not pinned prose.
    expect(node("tile-brush-state").textContent?.split(" · ")[0])
      .toBe(node("tool-erase").getAttribute("aria-label"));
  });
  it("F5 retains the representative as pressed roving cell for an unmatched selected variant", () => {
    const project = store.getCurrent();
    const tileset = Object.values(project.tilesets)[0];
    if (!tileset) throw new Error("Missing tileset");
    const onSelectTile = vi.fn();
    const sheet = makeGridPalette({ tileset, layer: "lower", selectedTile: 423, visibleTiles: new Set(), onSelectTile });
    const cell = sheet.querySelector('[data-tile-index="363"]');
    expect(cell?.getAttribute("aria-pressed")).toBe("true");
    expect(cell?.getAttribute("tabindex")).toBe("0");
    expect(onSelectTile).not.toHaveBeenCalled();
  });
  it("C8a resolves a mounted atlas drag once, with source geometry and cell layers", () => {
    custom();
    const grid = node("custom-palette-grid");
    const cells = grid.querySelectorAll<HTMLElement>(".chipset-tile");
    const start = cells[1]; const end = cells[6];
    if (!start || !end) throw new Error("Missing cells");
    const changed = vi.fn(); const off = editorState.subscribe(changed);
    pointer(start, "pointerdown");
    expect(start.isConnected).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    pointer(end, "pointermove");
    pointer(end, "pointerup");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(editorState.get().activePaletteStamp).toMatchObject({ width: 2, height: 2, source: { startTile: 1, endTile: 6 }, cells: [
      { dx: 0, dy: 0, tile: 1, layer: "upper" }, { dx: 1, dy: 0, tile: 2, layer: "lower" },
      { dx: 0, dy: 1, tile: 5, layer: "upper" }, { dx: 1, dy: 1, tile: 6, layer: "lower" },
    ] });
    off();
  });
  it.each(["pointercancel", "scroll"])("C8a abandons an atlas gesture on %s", event => {
    custom();
    pointer(node("chipset-tile-1"), "pointerdown");
    node("custom-palette-grid").dispatchEvent(new Event(event, { bubbles: true }));
    pointer(node("chipset-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
  });
  it("C8a ignores another pointer release and cancels an outside release", () => {
    custom();
    pointer(node("chipset-tile-1"), "pointerdown");
    pointer(node("chipset-tile-6"), "pointerup", 2);
    expect(editorState.get().selectedTile).toBe(0);
    pointer(document.body, "pointerup");
    pointer(node("chipset-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
  });
  it("C8a detached gestures cannot activate a replacement sheet", () => {
    custom();
    const old = node("chipset-tile-1");
    pointer(old, "pointerdown");
    renderTilePalette(host);
    pointer(node("chipset-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
    pointer(node("chipset-tile-2"), "pointerdown");
    pointer(node("chipset-tile-2"), "pointerup");
    expect(editorState.get().selectedTile).toBe(2);
  });
  it("C8a one-cell release selects once while keyboard and assistive click still work", () => {
    custom();
    pointer(node("chipset-tile-1"), "pointerdown");
    pointer(node("chipset-tile-1"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 1, layer: "upper", activePaletteStamp: null });
    node("chipset-tile-2").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(editorState.get().selectedTile).toBe(2);
    node("chipset-tile-3").click();
    expect(editorState.get().selectedTile).toBe(3);
  });
});
