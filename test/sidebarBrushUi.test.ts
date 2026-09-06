/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetBasicLeftRailForTests } from "@/editor/panels/basicLeftRail";
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
    resetBasicLeftRailForTests();
    resetTileToolbarMenusForTests();
    resetEditorUiModeForTests("beginner");
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
    resetBasicLeftRailForTests();
    resetTileToolbarMenusForTests();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it.each(["beginner", "standard", "expert"] as const)("F4 exposes unique live brush controls in %s without More", mode => {
    resetEditorUiModeForTests(mode);
    editorState.set({ brushSize: 4, paintShape: "rect", layer: "upper" });
    for (const size of [1, 2, 3, 4]) expect(host.querySelectorAll(`[data-testid="brush-size-${size}"]`)).toHaveLength(1);
    expect(node("brush-size-4").getAttribute("aria-pressed")).toBe("true");
    expect(node("tile-brush-state").dataset).toMatchObject({ shape: "rect", layer: "upper" });
    node("brush-size-2").click();
    expect(editorState.get().brushSize).toBe(2);
    get("oprn-tool-overflow")?.click();
    expect(host.querySelectorAll('[data-testid="brush-size-2"]')).toHaveLength(1);
  });
  it("beginner Paint clears a previous stamp and shape through the tool reset", () => {
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
  it("F7 reports zero true matches and restores search focus on reset", () => {
    const search = node("basic-tile-search");
    if (!(search instanceof HTMLInputElement)) throw new Error("Missing search");
    search.value = "no-such-tile-xyz";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(node("basic-tile-search-feedback").dataset.matchCount).toBe("0");
    expect(node("basic-tile-filter-selection").dataset.selectedTile).toBe("0");
    node("basic-tile-search-reset").focus();
    node("basic-tile-search-reset").click();
    expect(document.activeElement).toBe(node("basic-tile-search"));
    expect(get("basic-tile-filter-selection")).toBeNull();
    expect(editorState.get().selectedTile).toBe(0);
  });
  it.each(["beginner", "standard"] as const)("C8a resolves a mounted %s atlas drag once, with source geometry and cell layers", mode => {
    resetEditorUiModeForTests(mode);
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
    pointer(node("basic-tile-1"), "pointerdown");
    node("basic-tile-grid").dispatchEvent(new Event(event, { bubbles: true }));
    pointer(node("basic-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
  });
  it("C8a ignores another pointer release and cancels an outside release", () => {
    custom();
    pointer(node("basic-tile-1"), "pointerdown");
    pointer(node("basic-tile-6"), "pointerup", 2);
    expect(editorState.get().selectedTile).toBe(0);
    pointer(document.body, "pointerup");
    pointer(node("basic-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
  });
  it("C8a detached gestures cannot activate a replacement sheet", () => {
    custom();
    const old = node("basic-tile-1");
    pointer(old, "pointerdown");
    renderTilePalette(host);
    pointer(node("basic-tile-6"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 0, activePaletteStamp: null });
    pointer(node("basic-tile-2"), "pointerdown");
    pointer(node("basic-tile-2"), "pointerup");
    expect(editorState.get().selectedTile).toBe(2);
  });
  it("C8a one-cell release selects once while keyboard and assistive click still work", () => {
    custom();
    pointer(node("basic-tile-1"), "pointerdown");
    pointer(node("basic-tile-1"), "pointerup");
    expect(editorState.get()).toMatchObject({ selectedTile: 1, layer: "upper", activePaletteStamp: null });
    node("basic-tile-2").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(editorState.get().selectedTile).toBe(2);
    node("basic-tile-3").click();
    expect(editorState.get().selectedTile).toBe(3);
  });
});
