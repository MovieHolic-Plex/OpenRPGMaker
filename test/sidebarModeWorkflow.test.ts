/** @vitest-environment happy-dom */
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { clearTimeout as clearDeadline, setTimeout as deadline } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, setEditorUiMode } from "@/editor/editorUiMode";
import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetBasicLeftRailForTests } from "@/editor/panels/basicLeftRail";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from '@/editor/panels/sidebarInspectionPins';

const advanced = [
  ["oprn-tool-inspector", "tile-inspector-dropdown"],
  ["toolbar-toggle-ruleAudit", "tile-rule-audit-dropdown"],
  ["toolbar-toggle-history", "tile-history-dropdown"],
] as const;

// History emits a coalesced microtask. Subscribe before the mutation, never sleep.
async function historyChange(action: () => void): Promise<void> {
  let cancel = () => {};
  const signal = new Promise<void>((resolve, reject) => {
    const onChange = () => resolve();
    const timeout = deadline(() => reject(new Error("history change event missing")), 2000);
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, onChange, { once: true });
    cancel = () => {
      clearDeadline(timeout);
      window.removeEventListener(MAP_EDIT_HISTORY_EVENT, onChange);
    };
  });
  try {
    action();
    await signal;
  } finally {
    cancel();
  }
}

describe("mode-specific sidebar painting workflow", () => {
  let host: HTMLElement;
  let unsubscribe: () => void;

  function find(id: string): HTMLElement | null {
    return host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  function control(id: string): HTMLButtonElement {
    const node = find(id);
    expect(node, `missing control ${id}`).not.toBeNull();
    return node as HTMLButtonElement;
  }

  beforeEach(async () => {
    // Cancel production debounce/positioning jobs on teardown; no clock advances.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    resetBasicLeftRailForTests();
    resetTileToolbarMenusForTests();
    localStorage.removeItem(SIDEBAR_PINS_KEY);
    resetInspectionPinsForTests();
    resetEditorUiModeForTests("beginner");
    store.replace(createBlankProject());
    await historyChange(() => resetMapEditHistory());
    editorState.set({
      currentMapId: store.getCurrent().startMapId, layer: "lower", tool: "paint",
      selectedTile: 0, paintShape: "pen", activePaletteStamp: null, selection: null, brushSize: 1,
    });
    host = document.createElement("div");
    host.dataset.testid = "left-palette-root";
    document.body.append(host);
    renderTilePalette(host);
    unsubscribe = editorState.subscribe(() => renderTilePalette(host));
  });

  afterEach(async () => {
    unsubscribe();
    resetBasicLeftRailForTests();
    resetTileToolbarMenusForTests();
    host.remove();
    await historyChange(() => resetMapEditHistory());
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("mounts the beginner tile workflow without opening or pinning a flyout", () => {
    expect(find("basic-tile-grid")).not.toBeNull();
    expect(find("basic-tile-search")).not.toBeNull();
    expect(find("selected-tile-status")).not.toBeNull();
    expect(find("basic-rail-flyout")).toBeNull();
    expect(host.querySelectorAll('[data-testid="basic-tile-grid"]')).toHaveLength(1);
  });

  it("keeps the selected cell focused and the sheet mounted after beginner tile activation", () => {
    editorState.set({ tool: "erase", paintShape: "rect" });
    const cell = control("basic-tile-0");
    cell.focus();
    cell.click();
    expect(editorState.get()).toMatchObject({ selectedTile: 0, tool: "paint", paintShape: "pen", activePaletteStamp: null });
    expect(find("basic-tile-grid")).not.toBeNull();
    expect(document.activeElement).toBe(find("basic-tile-0"));
    expect(find("basic-rail-flyout")).toBeNull();
  });

  it("preserves custom atlas cells and routes selection to the authored layer in the persistent panel", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    store.replace({ ...project, tilesets: { ...project.tilesets, [tileset.id]: {
      ...tileset, kind: "custom", count: 128, tilesPerRow: 16,
      image: { type: "bundled", id: "custom-workflow-test" },
      priority: Array.from({ length: 128 }, () => "upper" as const),
      tileMeta: { 127: { label: "Authored window" } },
    } } });
    renderTilePalette(host);
    expect(find("basic-tile-grid")?.querySelectorAll(".chipset-tile")).toHaveLength(128);
    control("basic-tile-127").click();
    expect(editorState.get()).toMatchObject({ selectedTile: 127, layer: "upper", tool: "paint" });
    expect(find("basic-tile-grid")?.querySelectorAll(".chipset-tile")).toHaveLength(128);
    expect(find("basic-tile-127")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("restores the persistent picker after leaving the event layer", () => {
    selectSidebarLayer("event");
    expect(editorState.get()).toMatchObject({ layer: "event", tool: "event" });
    expect(find("basic-tile-grid")).toBeNull();
    selectSidebarLayer("lower");
    expect(editorState.get()).toMatchObject({ layer: "lower", tool: "paint" });
    expect(find("basic-tile-grid")).not.toBeNull();
  });

  it("keeps map flyout Escape focus return without dismissing the persistent picker", () => {
    control("basic-rail-toggle-maps").click();
    expect(find("basic-map-list-host")).not.toBeNull();
    control("basic-flyout-close").focus();
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(find("basic-rail-flyout")).toBeNull();
    expect(document.activeElement).toBe(find("basic-rail-toggle-maps"));
    expect(find("basic-tile-grid")).not.toBeNull();
  });

  it("provides visible beginner undo wired to actual map history and its change event", async () => {
    const undo = control("oprn-tool-undo");
    expect(undo.textContent?.trim().length).toBeGreaterThan(0);
    expect(undo.disabled).toBe(true);
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const original = project.maps[mapId]!.lowerTiles[0]!;
    await historyChange(() => {
      recordProjectSnapshot("test paint", mapId, { kind: "map", mapId });
      store.update(p => { p.maps[mapId]!.lowerTiles[0] = original === 0 ? 1 : 0; });
    });
    expect(control("oprn-tool-undo").disabled).toBe(false);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).not.toBe(original);
    await historyChange(() => control("oprn-tool-undo").click());
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(original);
    expect(getMapEditHistoryState()).toMatchObject({ canUndo: false, canRedo: true });
    expect(control("oprn-tool-undo").disabled).toBe(true);
  });

  it("keeps standard daily tools direct and inspection actions reachable once through More", () => {
    resetEditorUiModeForTests("standard");
    renderTilePalette(host);
    for (const id of ["tool-paint", "tool-erase", "tool-fill", "tool-select", "oprn-tool-undo"]) {
      control(id);
    }
    control('sidebar-tools-menu').click();
    control('tool-eyedropper').click();
    expect(editorState.get().tool).toBe('eyedropper');
    // 검사 3종은 핀 없이는 오버플로 안에 한 번씩만 있다(표준이 전문가 capability 흡수).
    for (const [id] of advanced) expect(find(id)).toBeNull();
    control("oprn-tool-overflow").click();
    for (const [id] of advanced) {
      expect(find("toolbar-overflow-dropdown")?.contains(control(id))).toBe(true);
      expect(host.querySelectorAll(`[data-testid="${id}"]`)).toHaveLength(1);
    }
  });

  it.each(advanced)("pins standard %s for direct access and returns Escape focus to its own trigger", (id, panelId) => {
    resetEditorUiModeForTests("standard");
    renderTilePalette(host);
    const pin = { 'oprn-tool-inspector': 'inspector', 'toolbar-toggle-ruleAudit': 'ruleAudit', 'toolbar-toggle-history': 'history' }[id];
    control('oprn-tool-overflow').click();
    control(`sidebar-pin-${pin}`).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const trigger = control(id);
    expect(trigger.textContent?.trim().length).toBeGreaterThan(0);
    trigger.focus();
    trigger.click();
    expect(find(panelId)).not.toBeNull();
    expect(find("toolbar-overflow-dropdown")).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(find(panelId)).toBeNull();
    expect(document.activeElement).toBe(find(id));
    control("oprn-tool-overflow").click();
    for (const [advancedId] of advanced) {
      expect(host.querySelectorAll(`[data-testid="${advancedId}"]`)).toHaveLength(1);
      expect(find("toolbar-overflow-dropdown")?.contains(control(advancedId))).toBe(advancedId !== id);
    }
  });

  it("preserves selected tile and tool across mode changes while remounting the beginner picker", () => {
    editorState.set({ selectedTile: 0, tool: "fill" });
    setEditorUiMode("expert", null);
    renderTilePalette(host);
    setEditorUiMode("beginner", null);
    renderTilePalette(host);
    expect(editorState.get()).toMatchObject({ selectedTile: 0, tool: "fill", layer: "lower" });
    expect(find("basic-rail-flyout")).toBeNull();
    expect(find("basic-tile-grid")).not.toBeNull();
  });
});
