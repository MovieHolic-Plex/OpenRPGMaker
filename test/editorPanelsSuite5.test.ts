// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { clearTimeout as clearDeadline, setTimeout as deadline } from "node:timers";
import { editorState } from "@/editor/editorState";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetSmartPaletteForTests } from "@/editor/panels/tilePaletteSmart";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from "@/editor/panels/sidebarInspectionPins";
import { openTilesetTileBrowser } from "@/editor/panels/tilesetTileBrowser";
import { filterSpatialBrowserCards, renderSpatialAssetBrowser } from "@/editor/panels/spatialAssetBrowser";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview, hasAuthoringDraft } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { resetSpacesAuthoringSession } from "@/editor/panels/spatialSpaceCommands";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { spaceCompilerFixture, spaceDesign, interiorAtlas } from "./support/spatialSpaceCompilerFixture";
import { commitLiveOrDraft } from "@/editor/panels/spatialObjectMutations";
import { renameOwnedKit } from "@/editor/panels/spatialObjectDraft";
import { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";
import { roomKindOf } from "@/editor/panels/spatialGallery";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { deserialize, serialize } from "@/project/io";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("sidebarModeWorkflow", () => {
  isolateTimers();
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
  describe("sidebar painting workflow", () => {
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
      resetTileToolbarMenusForTests();
      localStorage.removeItem(SIDEBAR_PINS_KEY);
      resetInspectionPinsForTests();
      resetSmartPaletteForTests();
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
      host.querySelector<HTMLElement>('[data-testid="palette-tab-tiles"]')?.click();
      unsubscribe = editorState.subscribe(() => renderTilePalette(host));
    });

    afterEach(async () => {
      unsubscribe();
      resetTileToolbarMenusForTests();
      host.remove();
      await historyChange(() => resetMapEditHistory());
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("mounts the tile palette as the persistent draw pane", () => {
      expect(find("tile-palette")).not.toBeNull();
      expect(find("selected-tile-status")).not.toBeNull();
      expect(host.querySelectorAll('[data-testid="tile-palette"]')).toHaveLength(1);
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
      expect(find("custom-palette-grid")?.querySelectorAll(".chipset-tile")).toHaveLength(128);
      control("chipset-tile-127").click();
      expect(editorState.get()).toMatchObject({ selectedTile: 127, layer: "upper", tool: "paint" });
      expect(find("custom-palette-grid")?.querySelectorAll(".chipset-tile")).toHaveLength(128);
      expect(find("chipset-tile-127")?.getAttribute("aria-pressed")).toBe("true");
    });

    it("restores the persistent picker after leaving the event layer", () => {
      selectSidebarLayer("event");
      expect(editorState.get()).toMatchObject({ layer: "event", tool: "event" });
      expect(find("tile-palette")).toBeNull();
      selectSidebarLayer("lower");
      expect(editorState.get()).toMatchObject({ layer: "lower", tool: "paint" });
      expect(find("tile-palette")).not.toBeNull();
    });

    it.each(["event-editor-cancel", "event-editor-modal-close", "event-editor-save"])(
      "opens on the first sidebar activation and preserves list scroll through %s",
      (closeTestId) => {
        const mapId = store.getCurrent().startMapId;
        const event = createDefaultGameEvent(3, 3);
        store.replaceEvent(mapId, event.id, event);
        selectSidebarLayer("event");
        editorState.set({ selectedEventId: event.id });
        const unsubscribeStore = store.subscribe(() => renderTilePalette(host));
        const rows = () => find("event-list")!.querySelector<HTMLElement>(".event-list-rows")!;
        rows().scrollTop = 64;
        try {
          control("event-editor-open").click();
          const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
          expect(modal?.dataset.eventId).toBe(event.id);
          expect(rows().scrollTop).toBe(64);

          modal?.querySelector<HTMLButtonElement>(`[data-testid="${closeTestId}"]`)?.click();
          expect(modal?.isConnected).toBe(false);
          expect(rows().scrollTop).toBe(64);
        } finally {
          unsubscribeStore();
          document.querySelector<HTMLButtonElement>('[data-testid="event-editor-cancel"]')?.click();
        }
      },
    );

    it("provides visible undo wired to actual map history and its change event", async () => {
      const undo = control("oprn-tool-undo");
      expect((undo.getAttribute("aria-label") ?? undo.textContent ?? "").trim().length).toBeGreaterThan(0);
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

    it("keeps daily tools direct and inspection actions reachable once through More", () => {
      renderTilePalette(host);
      for (const id of ["palette-tool-paint", "tool-erase", "palette-tool-fill", "palette-tool-select", "oprn-tool-undo"]) {
        control(id);
      }
      expect(find('sidebar-tools-menu')).toBeNull();
      // 검사 3종은 핀 없이는 오버플로 안에 한 번씩만 있다.
      for (const [id] of advanced) expect(find(id)).toBeNull();
      control("oprn-tool-overflow").click();
      for (const [id] of advanced) {
        expect(find("toolbar-overflow-dropdown")?.contains(control(id))).toBe(true);
        expect(host.querySelectorAll(`[data-testid="${id}"]`)).toHaveLength(1);
      }
    });

    it.each(advanced)("pins %s for direct access and returns Escape focus to its own trigger", (id, panelId) => {
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

describe("spatialLegacyEditing", () => {
  isolateTimers();
  const previous = store.getCurrent();
  const tilesetId = INTERIOR_ROOM_TILESET_ID;
  beforeEach(() => {
    store.replace(withRetiredEasyRpgTilesets(createBlankProject()), { preserveEventDrafts: false });
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    resetMapEditHistory();
  });
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    store.replace(previous, { preserveEventDrafts: false });
    document.body.replaceChildren();
  });
  it("saves legacy object edits with the production controller bound, survives IO, and undoes", () => {
    store.update(project => { project.tilesets[tilesetId].structureKits = [{ id: "test-kit", name: "Before", kind: "section", width: 1, height: 1, rows: [{ tiles: [1] }] }]; });
    commitLiveOrDraft(() => {}, project => renameOwnedKit(project, tilesetId, "test-kit", "After"));
    expect(hasAuthoringDraft()).toBe(false);
    expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].structureKits?.[0].name).toBe("After");
    undoMapEdit();
    expect(store.getCurrent().tilesets[tilesetId].structureKits?.[0].name).toBe("Before");
  });
  it("edits authored room rules even when their id matches the builtin catalog", () => {
    const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
    store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Authored" }]; });
    const card: SpatialGalleryCard = { id: "test-room", localId: kind.id, name: "Authored", kind: "spaces", source: "own", usage: 0, tilesetId, compatibility: "room-rule" };
    expect(roomKindOf(card)?.label).toBe("Authored");
    const inspector = renderSpatialSpacesInspector(card, true, () => {});
    document.body.append(inspector);
    const input = inspector.querySelector<HTMLInputElement>(`[data-testid='tileset-spaces-kind-label-${kind.id}']`)!;
    expect(input).not.toBeNull();
    input.value = "Renamed";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(roomKindOf(card)?.label).toBe("Renamed");
    expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].interiorRoomKinds?.[0].label).toBe("Renamed");
    undoMapEdit();
    expect(roomKindOf(card)?.label).toBe("Authored");
  });
  it("copies a builtin room without overwriting an existing authored rule with the same id", () => {
    const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
    store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Keep me" }]; });
    const card: SpatialGalleryCard = { id: kind.id, localId: kind.id, name: kind.label, kind: "spaces", source: "default", usage: 0, tilesetId };
    const inspector = renderSpatialSpacesInspector(card, true, () => {});
    inspector.querySelector<HTMLButtonElement>("[data-testid='spatial-space-copy']")!.click();
    const records = store.getCurrent().tilesets[tilesetId].interiorRoomKinds!;
    expect(records).toHaveLength(2);
    expect(records[0].label).toBe("Keep me");
    expect(records[1].id).not.toBe(kind.id);
  });
});
