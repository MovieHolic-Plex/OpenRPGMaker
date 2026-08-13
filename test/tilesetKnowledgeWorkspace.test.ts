import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import {
  activateKnowledgeWorkspace,
  beginKnowledgeDrag,
  chooseKnowledgeTemplate,
  clearKnowledgeSelection,
  knowledgeDraft,
  knowledgeSelection,
  loadKnowledgeGroup,
  loadKnowledgeProposal,
  saveKnowledgeDraft,
  selectKnowledgeTile,
  updateKnowledgeDraft,
} from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

class TestMouseEvent extends Event {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;

  constructor(type: string, init: { readonly ctrlKey?: boolean; readonly shiftKey?: boolean } = {}) {
    super(type);
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = false;
    this.shiftKey = init.shiftKey ?? false;
  }
}

class TestPointerEvent extends TestMouseEvent {}

let cleanupDom: (() => void) | null = null;
let previousMouseEvent: typeof MouseEvent | undefined;
let previousPointerEvent: typeof PointerEvent | undefined;
let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset");
  return tileset;
}

function selectRectangle(tileset: TilesetDef, start: number, end: number): void {
  selectKnowledgeTile(tileset, start, new MouseEvent("click"));
  selectKnowledgeTile(tileset, end, new MouseEvent("click", { shiftKey: true }));
}

describe("tileset knowledge workspace", () => {
  beforeEach(() => {
    cleanupDom = installFakeDom();
    previousMouseEvent = globalThis.MouseEvent;
    previousPointerEvent = globalThis.PointerEvent;
    Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: TestMouseEvent });
    Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: TestPointerEvent });
    store.replace(createBlankProject());
    resetMapEditHistory();
    tilesetId = Object.keys(store.getCurrent().tilesets)[0] ?? "";
    activateKnowledgeWorkspace(currentTileset());
    clearKnowledgeSelection();
    updateKnowledgeDraft({ activeGroupId: null, cellLayers: null, description: "", name: "", placementRules: "" });
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = null;
    if (previousMouseEvent === undefined) Reflect.deleteProperty(globalThis, "MouseEvent");
    else Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: previousMouseEvent });
    if (previousPointerEvent === undefined) Reflect.deleteProperty(globalThis, "PointerEvent");
    else Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: previousPointerEvent });
  });

  it("renders named templates and an accessible selection summary", () => {
    const panel = renderTileGroupPanel(currentTileset(), () => undefined) as unknown as FakeElement;

    expect(findByTestId(panel, "tileset-knowledge-inspector")).not.toBeNull();
    expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
    expect(findByTestId(panel, "tileset-knowledge-template-water-atlas-9x9")).not.toBeNull();
    expect(findByTestId(panel, "tileset-knowledge-template-repeatable-cliff-2x3")).not.toBeNull();
    expect(findByTestId(panel, "tileset-knowledge-selection-summary")?.textContent).toContain("타일");
  });

  it("saves and updates a 2x3 repeatable cliff under one stable group id", () => {
    const tileset = currentTileset();
    selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 1);
    chooseKnowledgeTemplate("repeatable-cliff-2x3");
    updateKnowledgeDraft({ name: "북쪽 절벽" });

    expect(saveKnowledgeDraft(tileset)).toBe(true);
    const saved = currentTileset().tileGroups?.find((group) => group.name === "북쪽 절벽");
    expect(saved?.patternGrammar?.kind).toBe("repeatable_block");
    expect(saved?.patternGrammar?.blockWidth).toBe(2);
    expect(saved?.patternGrammar?.blockHeight).toBe(3);
    expect(saved?.tileIds).toEqual([0, 1, tileset.tilesPerRow, tileset.tilesPerRow + 1, tileset.tilesPerRow * 2, (tileset.tilesPerRow * 2) + 1]);

    if (!saved) throw new Error("missing saved group");
    resetMapEditHistory();
    loadKnowledgeGroup(saved, currentTileset());
    updateKnowledgeDraft({ name: "북쪽 절벽 수정" });
    expect(saveKnowledgeDraft(currentTileset())).toBe(true);
    expect(currentTileset().tileGroups?.filter((group) => group.id === saved.id)).toHaveLength(1);
    expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽 수정");
    expect(undoMapEdit()).toBe(true);
    expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽");
  });

  it("persists directional passage and registers a real 3x3 autotile", () => {
    const tileset = currentTileset();
    selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 2);
    chooseKnowledgeTemplate("one-way-path");
    updateKnowledgeDraft({
      name: "아래로만 가는 길",
      passage: { down: true, left: false, right: false, up: false },
    });

    expect(saveKnowledgeDraft(tileset)).toBe(true);
    const saved = currentTileset().tileGroups?.find((group) => group.name === "아래로만 가는 길");
    expect(saved).toBeDefined();
    expect(currentTileset().passability[0]).toEqual({ down: true, left: false, right: false, up: false });
    const autotile = currentTileset().autotileGroups?.find((group) => group.id === saved?.id);
    expect(autotile?.neighborhood).toBe(8);
    expect(Object.keys(autotile?.variantMap ?? {})).toHaveLength(256);
  });

  it("keeps per-cell layers paired with their tile when loading knowledge", () => {
    const tileset = currentTileset();
    loadKnowledgeGroup({
      cellLayers: ["upper", "lower"],
      defaultLayer: "mixed",
      description: "Two cells",
      id: "layer-pair",
      layerHome: "perCell",
      name: "Layer pair",
      origin: "user",
      placementRules: "Keep pairing",
      role: "prop",
      source: "user",
      tileIds: [5, 4],
    }, tileset);

    expect(knowledgeSelection().selected).toEqual([4, 5]);
    expect(knowledgeDraft().cellLayers).toEqual(["lower", "upper"]);
  });

  it("clears per-cell layers when a same-sized selection moves to another tile", () => {
    const tileset = currentTileset();
    loadKnowledgeProposal({
      cellLayers: ["upper"],
      description: "Canopy",
      name: "Single cell",
      passage: { down: false, left: false, right: false, up: false },
      placementRules: "Upper only",
      template: "tree",
      tileIds: [4],
    });

    beginKnowledgeDrag(tileset, 5, new PointerEvent("pointerdown"));

    expect(knowledgeSelection().selected).toEqual([5]);
    expect(knowledgeDraft().cellLayers).toBeNull();
  });
});
