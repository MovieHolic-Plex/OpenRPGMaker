// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { closeMapContextMenu } from "@/editor/panels/mapContextMenu";
import { renderMapList, resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { resetMapPanelSectionForTests, setMapPanelCollapsed } from "@/editor/workspace/mapPanelSection";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { listEditorCommands } from "@/editor/commandRegistry";
import { mountDock, renderDockPanels } from "@/editor/workspace/dockHost";
import { getWorkspaceLayout, resetWorkspaceForTests, subscribeWorkspace } from "@/editor/workspace/workspaceStore";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from "@/editor/panels/sidebarInspectionPins";
import { openTilesetTileBrowser } from "@/editor/panels/tilesetTileBrowser";
import { filterSpatialBrowserCards, renderSpatialAssetBrowser } from "@/editor/panels/spatialAssetBrowser";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { resetSpacesAuthoringSession } from "@/editor/panels/spatialSpaceCommands";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { spaceCompilerFixture, spaceDesign, interiorAtlas } from "./support/spatialSpaceCompilerFixture";
import { isolateTimers } from "./mergedTeardown";

describe("sidebarFocusR1", () => {
  isolateTimers();
  describe('sidebar R1 real renderer ownership', () => {
    let host: HTMLElement;
    let dock: HTMLElement;
    let offState: () => void;
    const get = (id: string): HTMLElement => {
      const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    };
    const escape = () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    beforeEach(() => {
      vi.useFakeTimers();
      resetTileToolbarMenusForTests();
      resetMapListUiStateForTests();
      resetMapPanelSectionForTests();
      store.replace(createBlankProject());
      editorState.set({ currentMapId: store.getCurrent().startMapId, layer: 'lower', tool: 'paint', paintShape: 'pen', selectedTile: 0, activePaletteStamp: null });
      host = document.createElement('div'); host.dataset.testid = 'left-palette-root';
      dock = document.createElement('div'); dock.dataset.testid = 'left-map-root';
      document.body.append(host);
      offState = editorState.subscribe(() => renderTilePalette(host));
      renderTilePalette(host);
    });
    afterEach(() => {
      offState(); closeMapContextMenu(); resetTileToolbarMenusForTests();
      host.remove(); dock.remove(); vi.clearAllTimers(); vi.useRealTimers();
    });
    it('closes the open map surface on Escape and restores its trigger', () => {
      get('sidebar-map-switcher').click();
      expect(host.querySelector('[data-sidebar-surface]')).not.toBeNull();
      escape();
      expect(host.querySelector('[data-sidebar-surface]')).toBeNull();
      expect(document.activeElement).toBe(get('sidebar-map-switcher'));
    });
    it('routes one Escape to the actual map context menu and then restores the map row', () => {
      get('sidebar-map-switcher').click();
      const id = store.getCurrent().startMapId;
      get(`map-tree-node-${id}`).focus();
      get(`map-tree-node-${id}`).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
      expect(get(`map-context-menu-${id}`).contains(document.activeElement)).toBe(true);
      escape();
      expect(document.querySelector(`[data-testid="map-context-menu-${id}"]`)).toBeNull();
      expect(host.querySelector('[data-testid="sidebar-map-surface"]')).not.toBeNull();
      expect(document.activeElement).toBe(get(`map-tree-node-${id}`));
      escape();
      expect(host.querySelector('[data-testid="sidebar-map-surface"]')).toBeNull();
    });
    it('keeps the map explorer attached while its body-mounted Rename action handles a pointer', () => {
      get('sidebar-map-switcher').click();
      const id = store.getCurrent().startMapId;
      get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      const rename = get(`map-menu-rename-${id}`);
      rename.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      rename.click();
      expect(host.querySelector(`[data-testid="map-rename-${id}"]`)).not.toBeNull();
      expect(document.activeElement).toBe(get(`map-rename-${id}`));
    });
    it('reveals the real map dock through its renderer rather than only changing collapse state', () => {
      document.body.append(dock);
      // 맵 도크가 붙은 뒤 다시 그려야 스위처가 도크 모드(목록에서 보기)로 바뀐다.
      renderTilePalette(host);
      renderMapList(dock);
      // 맵이 하나뿐이면 접기 단추가 없다(버튼 줄이기 2회차) — 접힌 채 저장된 상태에서 시작한다.
      setMapPanelCollapsed(true);
      renderMapList(dock);
      expect(get('map-tree-section-toggle').getAttribute('aria-expanded')).toBe('false');
      get('sidebar-map-switcher').click();
      expect(get('map-tree-section-toggle').getAttribute('aria-expanded')).toBe('true');
      expect(dock.querySelector('.is-section-collapsed')).toBeNull();
      expect(document.activeElement).toBe(get(`map-tree-node-${store.getCurrent().startMapId}`));
    });
    it('does not commit a cancelled Rename when removing its focused input emits blur', () => {
      get('sidebar-map-switcher').click();
      const id = store.getCurrent().startMapId;
      const original = store.getCurrent().maps[id]?.name;
      get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      get(`map-menu-rename-${id}`).click();
      const input = get(`map-rename-${id}`);
      if (!(input instanceof HTMLInputElement)) throw new Error('Missing actual Rename input');
      input.value = 'Cancelled draft';
      escape();
      input.dispatchEvent(new FocusEvent('blur'));
      expect(store.getCurrent().maps[id]?.name).toBe(original);
    });
    it.each([
      ['inspector', false], ['ruleAudit', false], ['history', false],
      ['inspector', true], ['ruleAudit', true], ['history', true],
    ] as const)('activates the real dock registry for %s with pinned=%s', (inspection, pinned) => {
      host.remove();
      const root = document.createElement('div'); document.body.append(root);
      const initial = layoutFromPreset('map');
      resetWorkspaceForTests({ ...initial, docks: { ...initial.docks, left: ['maps'] } });
      localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify(pinned ? [inspection] : []));
      resetInspectionPinsForTests();
      const renderDock = () => renderDockPanels(mountDock({ container: root, zone: 'left', panels: getWorkspaceLayout().docks.left }));
      const unsubscribe = subscribeWorkspace(renderDock);
      renderDock();
      const mapId = editorState.get().currentMapId;
      try {
        listEditorCommands().find(command => command.id === `sidebar-inspection-${inspection}`)?.run();
        expect(root.querySelector('[data-testid="left-palette-root"]')).not.toBeNull();
        const panelId = pinned ? { inspector: 'tile-inspector-dropdown', ruleAudit: 'tile-rule-audit-dropdown', history: 'tile-history-dropdown' }[inspection] : 'toolbar-overflow-dropdown';
        expect(get(panelId).contains(document.activeElement)).toBe(true);
        expect(editorState.get().currentMapId).toBe(mapId);
        expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY) ?? '[]')).toEqual(pinned ? [inspection] : []);
        escape();
        expect(root.querySelector(`[data-testid="${panelId}"]`)).toBeNull();
      } finally { unsubscribe(); root.remove(); resetWorkspaceForTests(); }
    });
  });
});

describe("spatialAssetBrowsers", () => {
  isolateTimers();
  const previous = store.getCurrent();
  beforeEach(() => {
    const fixture = structuredClone(spaceCompilerFixture());
    fixture.spatialAuthoring!.library.spaces[spaceDesign] = { ...fixture.spatialAuthoring!.library.spaces[spaceDesign], objectSlots: [] };
    store.replace(fixture, { preserveEventDrafts: false });
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    resetSpacesAuthoringSession();
  });
  afterEach(() => {
    document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")?.click();
    document.querySelector<HTMLButtonElement>("[data-testid='structure-kit-editor-close']")?.click();
    document.body.replaceChildren();
    bindSpatialAuthoringControllerFactory(null);
    store.replace(previous, { preserveEventDrafts: false });
  });
  it("combines tileset and name filters without leaking another tileset", () => {
    const cards = [
      { id: "a", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "inside" },
      { id: "b", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "outside" },
    ];
    expect(filterSpatialBrowserCards(cards, "작은 침대", "inside").map(card => card.id)).toEqual(["a"]);
    expect(filterSpatialBrowserCards(cards, "없는 이름", null)).toEqual([]);
  });
  it("tile browsing and cancel do not change the project or select a brush", () => {
    const before = store.getCurrent();
    const pick = vi.fn();
    openTilesetTileBrowser(before.tilesets[interiorAtlas], 0, pick);
    document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
    expect(pick).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")!.click();
    expect(pick).not.toHaveBeenCalled();
    expect(store.getCurrent()).toBe(before);
  });
  it("confirms the selected tile once and preserves search focus while filtering", () => {
    const pick = vi.fn();
    openTilesetTileBrowser(store.getCurrent().tilesets[interiorAtlas], 0, pick);
    const input = document.querySelector<HTMLInputElement>("[data-testid='tile-browser-search']")!;
    input.focus(); input.value = "54"; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.activeElement).toBe(input);
    document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
    document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-use']")!.click();
    expect(pick).toHaveBeenCalledExactlyOnceWith(54);
    expect(document.querySelector("[data-testid='tileset-tile-browser']")).toBeNull();
  });
  it("places an object in a source space by selection and click, then preview/applies it", () => {
    const card = { id: `library-space/library/${spaceDesign}`, localId: spaceDesign, name: "Room", source: "own" as const, kind: "spaces" as const, usage: 0 };
    const canvas = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
    document.body.append(canvas);
    canvas.querySelector<HTMLButtonElement>("[data-testid='spatial-object-bed-design']")!.click();
    expect(spaceChromeState.selectedObjectId).toBe("bed-design");
    const board = canvas.querySelector<HTMLElement>("[data-testid='spatial-space-board']")!;
    board.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 4 * 24 + 10, clientY: 3 * 24 + 10 }));
    expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(0);
    const slots = visibleAuthoringProject().spatialAuthoring!.library.spaces[spaceDesign].objectSlots;
    expect(slots).toHaveLength(1);
    expect(slots[0].objectDesignId).toBe("bed-design");
    const refreshed = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
    expect(refreshed.querySelector(".spatial-space-slot-art canvas")).not.toBeNull();
    expect(slots[0].placement).toMatchObject({ mode: "fixed", x: 4, y: 3 });
    expect(previewAuthoringDraft().kind).toBe("ok");
    expect(applyAuthoringPreview().kind).toBe("ok");
    expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(1);
  });
  it("creates a new object in the tileset selected in the browser", () => {
    const project = structuredClone(store.getCurrent());
    project.tilesets["custom-atlas"] = { ...project.tilesets[interiorAtlas], id: "custom-atlas", name: "커스텀", structureKits: [] };
    store.replace(project, { preserveEventDrafts: false });
    const browser = renderSpatialAssetBrowser({ ...spatialSession(), tab: "objects", source: "all", mode: "design" }, undefined, () => {});
    document.body.append(browser);
    browser.querySelector<HTMLButtonElement>("[data-tileset-id='custom-atlas']")!.click();
    browser.querySelector<HTMLButtonElement>("[data-testid='spatial-add']")!.click();
    expect(Object.values(visibleAuthoringProject().spatialAuthoring!.library.objects).some(object => object.graphic.tilesetId === "custom-atlas")).toBe(true);
    expect(store.getCurrent().tilesets["custom-atlas"].structureKits).toHaveLength(0);
  });
});
