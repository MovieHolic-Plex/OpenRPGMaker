// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { compileSpaces } from "@/editor/spatial/compileSpaces";
import { requireOccurrenceAssociations } from "@/project/spatial/domain";
import { freshSpatialId, librarySpaceCardId, spaceDraftTarget, usedSpatialIds } from "@/editor/panels/spatialSpaceDraft";
import { SPACE_TILE_PX, renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { renderSpatialSpacesInspector, resetSpatialSpacesTabChrome, spatialSpacesChrome } from "@/editor/panels/spatialSpacesTab";
import { mutateWorkingSpace, workingProject } from "@/editor/panels/spatialSpaceCommands";
import { store } from "@/project/store";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { identityAuthoringController, reconstructDraft } from "./support/spatialAuthoringIdentity";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { editorState } from "@/editor/editorState";
import { clearFavoriteTilesForTest, recordRecentTile } from "@/editor/panels/tileBrushTools";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { CARD_COLUMNS, PALETTE_CARD_ROW_PX, PALETTE_CARD_WINDOW, PALETTE_THUMB_PX, resetSmartPaletteForTests } from "@/editor/panels/tilePaletteSmart";
import { createBlankProject } from "@/project/defaults";
import type { SectionStructureKitDef, TilesetDef } from "@/project/types";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { closeTilesetAiWorkspace, isTilesetAiWorkspaceOpen, openTilesetAiWorkspace } from "@/editor/panels/tilesetAiWorkspaceModal";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { resetTilesetAiReviewSessions, runTilesetAiReview, setTilesetAiReviewAnalyzer } from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { resetTilesetAiConversation } from "@/editor/tilesetAiConversationSession";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom } from "./helpers/aiTestSignals";
import { isolateTimers } from "./mergedTeardown";

describe("spatialSpaceActions", () => {
  isolateTimers();
  const previous = store.getCurrent();
  function session(): SpatialAuthoringSession {
    return {
      tab: "spaces",
      mode: "design",
      source: "own",
      designId: librarySpaceCardId(spaceDesign),
      occurrenceId: null,
      camera: { x: 0, y: 0, zoom: 1 },
      breadcrumb: [],
      legacyOrigin: null,
      placeKindFilter: null,
      regionKindFilter: null,
      inspectorOpen: true,
    };
  }
  function spaceCard() {
    return {
      id: librarySpaceCardId(spaceDesign),
      localId: spaceDesign,
      name: "Compiler room",
      source: "own" as const,
      kind: "spaces" as const,
      usage: 0,
    };
  }
  function placedCard() {
    return {
      id: spaceRoot,
      localId: spaceDesign,
      name: "Compiler room",
      source: "placed" as const,
      kind: "spaces" as const,
      usage: 0,
    };
  }
  beforeEach(() => {
    store.replace(spaceCompilerFixture(7));
    resetSpatialSpacesTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  });
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    resetSpatialSpacesTabChrome();
    store.replace(previous);
  });
  describe("spatial space actions", () => {
    it("keeps the issued draft handle so reconstructed wrappers are foreign-draft", () => {
      const controller = identityAuthoringController();
      const created = controller.createDraft();
      if (created.kind !== "ok") throw new Error("draft");
      const rebuilt = reconstructDraft(created.value.project);
      expect(controller.preview(rebuilt, { operation: { kind: "edit" } }).kind).toBe("error");
      expect(controller.preview(created.value, { operation: { kind: "edit" } }).kind).toBe("ok");
      const host = document.createElement("div");
      const paint = (): void => {
        host.replaceChildren(renderSpatialSpacesInspector(spaceCard(), true, paint));
      };
      paint();
      const input = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
      const baseline = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width;
      input!.value = "14";
      input!.dispatchEvent(new Event("change"));
      expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(baseline);
      expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
      const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
      chrome.preview?.();
      expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
      spatialSpacesChrome(spaceCard(), paint).apply?.();
      expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    });

    it("does not apply clone/delete/refresh until explicit preview", () => {
      const before = JSON.stringify(store.getCurrent().spatialAuthoring);
      const placed = spatialSpacesChrome(placedCard(), () => undefined);
      placed.duplicate?.();
      placed.refresh?.();
      expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
      const owned = spatialSpacesChrome(spaceCard(), () => undefined);
      owned.delete?.();
      spatialSpacesChrome(spaceCard(), () => undefined).onDeleteConfirm?.();
      expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
      owned.preview?.();
      expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
    });

    it("refuses apply without a visible preview", () => {
      const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
      chrome.add?.();
      const current = spatialSpacesChrome(spaceCard(), () => undefined);
      expect(current.apply).toBeUndefined();
      current.apply?.();
      expect(store.getCurrent().spatialAuthoring?.library.spaces["untitled-space-1"]).toBeUndefined();
    });

    it("compiles placed edits through the preview request", () => {
      const host = document.createElement("div");
      const paint = (): void => {
        host.replaceChildren(renderSpatialSpacesInspector(placedCard(), true, paint));
      };
      paint();
      const width = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
      width!.value = "16";
      width!.dispatchEvent(new Event("change"));
      spatialSpacesChrome(placedCard(), paint).preview?.();
      spatialSpacesChrome(placedCard(), paint).apply?.();
      const project = store.getCurrent();
      const spatialDocument = fixtureDocument(project);
      const compiled = compileSpaces({
        project,
        document: spatialDocument,
        occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
      });
      expect(compiled.ports.length).toBeGreaterThan(0);
      expect(compiled.map.width).toBeGreaterThan(0);
    });

    it("empties slots through preview/apply then compile", () => {
      const host = document.createElement("div");
      const paint = (): void => {
        host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
      };
      paint();
      const before = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots.length ?? 0;
      expect(before).toBeGreaterThan(0);
      mutateWorkingSpace(spaceDraftTarget(spaceCard()), (space) => ({ ...space, objectSlots: [] }));
      spatialSpacesChrome(spaceCard(), paint).preview?.();
      spatialSpacesChrome(spaceCard(), paint).apply?.();
      expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots).toEqual([]);
      const rebuilt = reinstantiateSpace(store.getCurrent(), (space) => space);
      const spatialDocument = fixtureDocument(rebuilt);
      const compiled = compileSpaces({
        project: rebuilt,
        document: spatialDocument,
        occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
      });
      expect(compiled.objects).toEqual([]);
    });

    it("nudges a slot by pointer tiles and Escape restores the origin", () => {
      const host = document.createElement("div");
      document.body.append(host);
      const paint = (): void => {
        host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
      };
      paint();
      const board = host.querySelector<HTMLElement>("[data-testid='spatial-space-board']");
      const slot = host.querySelector<HTMLButtonElement>("[data-testid='spatial-slot-hearth']");
      expect(board).not.toBeNull();
      expect(slot).not.toBeNull();
      board!.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 288, width: 480, height: 288, toJSON: () => undefined,
      });
      const origin = workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
        .find((entry) => entry.id === "hearth");
      expect(origin?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
      slot!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
      board!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 3 * SPACE_TILE_PX + 1, clientY: 5 * SPACE_TILE_PX + 1 }));
      expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
        .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 3, y: 5 });
      board!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
        .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
      host.remove();
    });

    it("adds a source space and clones a placed occurrence without silent no-op", () => {
      const source = spatialSpacesChrome(spaceCard(), () => undefined);
      expect(source.add).toBeTypeOf("function");
      const before = new Set(Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}));
      source.add?.();
      spatialSpacesChrome(spaceCard(), () => undefined).preview?.();
      spatialSpacesChrome(spaceCard(), () => undefined).apply?.();
      const added = Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
      expect(added).toHaveLength(1);
      expect(store.getCurrent().spatialAuthoring?.library.spaces[added[0] ?? ""]?.objectSlots).toEqual([]);
      resetSpatialSpacesTabChrome();
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
      const placed = spatialSpacesChrome(placedCard(), () => undefined);
      expect(placed.duplicate).toBeTypeOf("function");
      expect(placed.delete).toBeTypeOf("function");
    });

    it("does not reuse a library-wide id on repeated add or clone allocation", () => {
      const project = store.getCurrent();
      const objectId = Object.keys(project.spatialAuthoring?.library.objects ?? {})[0];
      expect(objectId).toBeTruthy();
      const first = freshSpatialId(project, "space");
      const second = freshSpatialId(project, "space");
      expect(first).not.toBe(second);
      expect(usedSpatialIds(project).has(first)).toBe(false);
      expect(first).not.toBe(objectId);
      const occupied = structuredClone(project);
      if (!occupied.spatialAuthoring) throw new Error("missing document");
      occupied.spatialAuthoring.library.objects = {
        ...occupied.spatialAuthoring.library.objects,
        [first]: occupied.spatialAuthoring.library.objects[objectId!],
      };
      expect(freshSpatialId(occupied, "space")).not.toBe(first);
      const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
      const before = new Set(Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}));
      chrome.add?.();
      chrome.add?.();
      const added = Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
      expect(added).toHaveLength(2);
      expect(added[0]).not.toBe(added[1]);
      chrome.duplicate?.();
      chrome.duplicate?.();
      expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.id).toBe(spaceDesign);
    });
  });
});

describe("tilePaletteSmart", () => {
  isolateTimers();
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
      const rows = Math.ceil(80 / CARD_COLUMNS);
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
});

describe("tilesetAiWorkspaceModal", () => {
  isolateTimers();
  type FakeElement = HTMLElement;
  function installFakeDom(): () => void {
    document.body.replaceChildren();
    return () => document.body.replaceChildren();
  }
  let cleanupDom: (() => void) | null = null;
  let tilesetId = "";
  function currentTileset(): TilesetDef {
    const tileset = store.getCurrent().tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset fixture");
    return tileset;
  }
  function fakeAnalyzer(): void {
    setTilesetAiReviewAnalyzer(async (tileset, feedback) => {
      const columns = tileset.tilesPerRow;
      return {
        kind: "success",
        rawAnswer: "{}",
        review: {
        fingerprint: tilesetKnowledgeFingerprint(tileset),
        proposals: [
          {
            cellLayers: null,
            confidence: 0.96,
            description: "cliff",
            evidence: "cliff pattern",
            feedback: feedback.join(" "),
            id: "cliff",
            name: "반복 절벽",
            passage: { down: false, left: false, right: false, up: false },
            placementRules: "",
            question: "절벽이 맞나요?",
            quickReplies: ["맞아"],
            status: "pending",
            template: "repeatable-cliff-2x3",
            tileIds: [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1],
          },
          {
            cellLayers: null,
            confidence: 0.42,
            description: "desk",
            evidence: "desk pattern",
            feedback: "",
            id: "desk",
            name: "미확인 가구",
            passage: { down: false, left: false, right: false, up: false },
            placementRules: "",
            question: "책상인가요?",
            quickReplies: ["책상", "선반"],
            status: "pending",
            template: "desk",
            tileIds: [3, 4],
          },
        ],
        summary: "two proposals",
        warnings: [],
        },
      };
    });
  }
  describe("AI tileset workspace entry", () => {
    beforeEach(() => {
      cleanupDom = installFakeDom();
      const project = createBlankProject();
      tilesetId = Object.keys(project.tilesets)[0] ?? "";
      const tileset = project.tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset fixture");
      tileset.tileGroups = [];
      store.replace(project);
      resetTilesetAiReviewSessions();
      resetTilesetAiConversation();
    });

    afterEach(() => {
      closeTilesetAiWorkspace();
      setTilesetAiReviewAnalyzer(null);
      resetTilesetAiReviewSessions();
      resetTilesetAiConversation();
      cleanupDom?.();
      cleanupDom = null;
    });

    it("keeps the human knowledge editor visible without an inline AI inbox", () => {
      // Given / When
      const panel = renderWithFakeDom(() => renderTileGroupPanel(currentTileset(), () => undefined));

      // Then
      expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
      expect(findByTestId(panel, "tileset-ai-review-inbox")).toBeNull();
      expect(findByTestId(panel, "tileset-ai-review-manual")).toBeNull();
    });

    it("retires the separate AI launcher and exposes reference documents in the tile library", () => {
      const editor = renderWithFakeDom(() => renderTilesetEditor(currentTileset(), () => undefined));
      expect(findByTestId(editor, "tileset-ai-workspace-open")).toBeNull();

      const host = renderWithFakeDom(() => {
        const root = document.createElement("div");
        renderTilesetsTab(root, () => undefined);
        return root;
      });
      expect(findByTestId(host, "tileset-ai-workspace-open")).toBeNull();
      expect(findByTestId(host, "tileset-section-tab-references")?.textContent).toBe("AI 참고문서");
    });
  });
  describe("AI tileset workspace three-step flow", () => {
    beforeEach(() => {
      cleanupDom = installFakeDom();
      const project = createBlankProject();
      tilesetId = Object.keys(project.tilesets)[0] ?? "";
      const tileset = project.tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset fixture");
      tileset.tileGroups = [];
      store.replace(project);
      resetTilesetAiReviewSessions();
      resetTilesetAiConversation();
      fakeAnalyzer();
    });

    afterEach(() => {
      closeTilesetAiWorkspace();
      setTilesetAiReviewAnalyzer(null);
      resetTilesetAiReviewSessions();
      resetTilesetAiConversation();
      cleanupDom?.();
      cleanupDom = null;
    });

    it("starts on the analyze step and moves to questions once analysis lands", async () => {
      // Given
      openTilesetAiWorkspace(tilesetId);
      const host = document.body.querySelector("[data-testid='tileset-ai-workspace-host']");
      expect(host).not.toBeNull();

      // When — land the analysis, then observe the natural step on a fresh open
      await runTilesetAiReview(currentTileset(), () => undefined);
      closeTilesetAiWorkspace();
      openTilesetAiWorkspace(tilesetId);

      // Then — natural step after analysis is questions
      const body = document.body as unknown as FakeElement;
      const workspace = findByTestId(body, "tileset-ai-workspace");
      expect(workspace?.dataset.step).toBe("questions");
      expect(findByTestId(body, "tileset-ai-workspace-step-questions")?.classList.contains("current")).toBe(true);
    });

    it("shows the summary step with a confirmed list and applies to the project", async () => {
      // Given
      await runTilesetAiReview(currentTileset(), () => undefined);
      openTilesetAiWorkspace(tilesetId);
      const body = document.body as unknown as FakeElement;
      const toSummary = findByTestId(body, "tileset-ai-workspace-to-summary");
      expect(toSummary).not.toBeNull();

      // When — skip remaining questions, go to summary
      toSummary?.click();
      const workspace = findByTestId(body, "tileset-ai-workspace");
      expect(workspace?.dataset.step).toBe("summary");
      expect(findByTestId(body, "tileset-ai-summary-item-cliff")).not.toBeNull();

      const apply = findByTestId(body, "tileset-ai-workspace-apply");
      expect(apply?.textContent).toContain("확정된 1개 적용");
      apply?.click();

      // Then
      expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["반복 절벽"]);
      expect(findByTestId(body, "tileset-ai-workspace-apply")?.textContent).toContain("적용됨");
      expect(isTilesetAiWorkspaceOpen()).toBe(true);
    });
  });
});
