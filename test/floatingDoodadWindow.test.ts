// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { mountFloatingDoodadWindow } from "@/editor/panels/floatingDoodadWindow";
import { TilePaintEngine } from "@/editor/TilePaintEngine";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapId, SectionStructureKitDef, TilesetDef } from "@/project/types";

const TREE_2X2_KIT: SectionStructureKitDef = {
  id: "bd-tree-f4f319",
  kind: "section",
  name: "버들항 나무 2×2",
  width: 2,
  height: 2,
  tileSize: 16,
  rows: [
    { tiles: [-1, -1], upperTiles: [10, 11] },
    { tiles: [-1, -1], upperTiles: [12, 13] },
  ],
  ai: {
    description: "2×2 나무",
    tags: ["버들항", "tree"],
    role: "prop",
  },
};

function seedProjectWithTreeKit(): { mapId: MapId; tileset: TilesetDef } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.width = 20;
  map.height = 15;
  map.tileSize = 16;
  map.lowerTiles = new Array(20 * 15).fill(0);
  map.upperTiles = new Array(20 * 15).fill(-1);
  map.events = [];

  const tileset: TilesetDef = {
    id: "beodeul_test_tileset",
    name: "버들항 테스트",
    kind: "custom",
    image: { type: "bundled", id: "beodeul_test_tileset" },
    tileSize: 16,
    tilesPerRow: 8,
    count: 32,
    priority: new Array<"lower" | "upper">(32).fill("lower"),
    terrain: new Array(32).fill(0),
    passability: Array.from({ length: 32 }, () => ({ up: true, down: true, left: true, right: true })),
    structureKits: [structuredClone(TREE_2X2_KIT)],
  };
  project.tilesets[tileset.id] = tileset;
  map.tilesetId = tileset.id;

  store.replace(project);
  editorState.set({
    currentMapId: mapId,
    tool: "paint",
    layer: "lower",
    paintShape: "pen",
    activePaletteStamp: null,
    activeInteractivePropId: null,
    reliefDoodad: null,
    reliefClusterEnabled: true,
    terrainBrush: "road",
  });
  return { mapId, tileset: store.getCurrent().tilesets[tileset.id]! };
}

function createPaintEngine(mapId: MapId, tileset: TilesetDef): TilePaintEngine {
  let isPainting = true;
  let lastPaintKey = "";
  return new TilePaintEngine({
    mapId: () => mapId,
    pointerToTile: (ptr) => {
      const point = ptr as unknown as { x: number; y: number };
      return { x: point.x, y: point.y };
    },
    updatePointerStatus: () => {},
    eventLayerClickCount: () => 1,
    pointerClickCount: () => 1,
    offerEventLayerSwitchAt: () => false,
    showEventLayerClickFeedback: () => {},
    openExistingEventAt: () => false,
    handleEventClick: () => {},
    tilesetForMap: () => tileset,
    setLastPointerTile: () => {},
    getPaintState: () => ({ isPainting, lastPaintKey }),
    setPaintState: (next) => {
      if (next.isPainting !== undefined) isPainting = next.isPainting;
      if (next.lastPaintKey !== undefined) lastPaintKey = next.lastPaintKey;
    },
  });
}

describe("floatingDoodadWindow — 2×2 tree single placement", () => {
  let host: HTMLElement;
  let dispose: (() => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    host.remove();
  });

  it("does not expose relief cluster duplicates for tree/rock props and places exactly one 2×2 tree per click", () => {
    const { mapId, tileset } = seedProjectWithTreeKit();
    const mount = mountFloatingDoodadWindow(host);
    dispose = mount.dispose;
    mount.setOpen(true);

    // Tree props must not be duplicated into relief (which triggers cluster scattering).
    const reliefTreeBtn = host.querySelector(`[data-testid="floating-doodad-item-relief:tree:${TREE_2X2_KIT.id}"]`);
    expect(reliefTreeBtn).toBeNull();

    // Selecting the tree from the Object Palette activates a single 2×2 stamp, not relief cluster mode.
    const stampBtn = host.querySelector<HTMLButtonElement>(`[data-testid="floating-doodad-item-stamp:${TREE_2X2_KIT.id}"]`);
    expect(stampBtn).not.toBeNull();
    stampBtn!.click();

    const state = editorState.get();
    expect(state.tool).toBe("paint");
    expect(state.reliefDoodad).toBeNull();
    expect(state.activePaletteStamp).toMatchObject({
      kitId: TREE_2X2_KIT.id,
      width: 2,
      height: 2,
    });

    // Clicking once on the map stamps exactly 4 upper tiles (one 2×2 tree), never a multi-tree cluster.
    const engine = createPaintEngine(mapId, tileset);
    engine.applyAtPointer({ x: 8, y: 6 } as never);
    engine.endStroke();

    const mapAfter = store.getCurrent().maps[mapId]!;
    const paintedUpperCount = mapAfter.upperTiles.filter((tile) => tile >= 0).length;
    expect(paintedUpperCount).toBe(4);
    expect(mapAfter.upperTiles[6 * 20 + 8]).toBe(10);
    expect(mapAfter.upperTiles[6 * 20 + 9]).toBe(11);
    expect(mapAfter.upperTiles[7 * 20 + 8]).toBe(12);
    expect(mapAfter.upperTiles[7 * 20 + 9]).toBe(13);
    expect(mapAfter.doodadGroups).toBeUndefined();
  });

  it("resets terrainBrush and disables reliefClusterEnabled when selecting a relief ramp from the Object Palette", () => {
    seedProjectWithTreeKit();
    const mount = mountFloatingDoodadWindow(host);
    dispose = mount.dispose;
    mount.setOpen(true);

    const rampBtn = host.querySelector<HTMLButtonElement>('[data-testid="floating-doodad-item-relief:ramp:slope"]');
    expect(rampBtn).not.toBeNull();
    rampBtn!.click();

    expect(editorState.get()).toMatchObject({
      tool: "relief",
      terrainBrush: "height",
      reliefDoodad: "ramp:slope",
      reliefClusterEnabled: false,
    });
  });
});
