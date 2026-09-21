import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eraseTile, fillTile, paintTilesBulk } from "@/editor/tileActions";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyToolToStore } from "@/editor/tools/applyChangesetToStore";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { store } from "@/project/store";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

const blockedFetch = vi.fn(async () => { throw new Error("Namespace tests must not contact the network"); });
const TRUNKS = [290, 291, 292, 293] as const;
type Namespace = "interior" | "custom" | "foreign-rpg" | "id-collision";

beforeEach(() => {
  for (const key of ["VITE_LEGACY_DB_URL", "VITE_LEGACY_DB_ANON_KEY", "VITE_LEGACY_DB_PROJECT_ID", "VITE_LEGACY_DB_USE_PROXY"]) vi.stubEnv(key, "");
  blockedFetch.mockClear();
  vi.stubGlobal("fetch", blockedFetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
  resetMapEditHistory();
});
afterEach(() => {
  expect(blockedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function fixture(namespace: Namespace) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 8; map.height = 8;
  map.lowerTiles = Array(64).fill(72); map.upperTiles = Array(64).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 0, y: 0 };
  if (namespace === "interior") {
    map.tilesetId = "easyrpg_chipset_interior";
  } else {
    const id = namespace === "id-collision" ? DEFAULT_TILESET_ID : `qa-${namespace}`;
    const tileset: TilesetDef = {
      id, name: "Foreign namespace", image: { ...project.tilesets.easyrpg_chipset_interior.image },
      kind: namespace === "custom" ? "custom" : "rpg2k", tileSize: 16, tilesPerRow: 30, count: 480,
      priority: Array(480).fill("upper"), terrain: Array(480).fill(0),
      passability: Array.from({ length: 480 }, () => ({ up: true, down: true, left: true, right: true })),
      tileGroups: [], autotileGroups: [],
    };
    tileset.priority[72] = "lower";
    project.tilesets[id] = tileset;
    map.tilesetId = id;
  }
  return { project, map, tileset: project.tilesets[map.tilesetId] };
}

function pair(): TileGroupMetadata {
  return { id: "authored-pair", name: "Authored pair", role: "prop", defaultLayer: "upper", tileIds: [280, 290], description: "", placementRules: "", rules: [{ id: "pair", kind: "adjacency", strength: "hard", params: { a: 280, b: 290, relation: "aAboveB" } }] };
}

function paintThroughStore(mapId: string, tile: number, x: number, y: number, layer: "lower" | "upper" = "upper"): void {
  const notifications: { readonly upper: readonly number[]; readonly origin: string | undefined }[] = [];
  const off = store.subscribe((project, change) => {
    notifications.push({ upper: [...project.maps[mapId].upperTiles], origin: change.origin });
  });
  try {
    const result = applyToolToStore("paint_tiles", { mapId, tile, layer, mode: "cells", cells: [{ x, y }] });
    expect(result.ok, result.summary).toBe(true);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.origin).toBe("tool");
    expect(notifications[0]?.upper).toEqual(store.getCurrent().maps[mapId].upperTiles);
    expect(store.isRemotePersistenceEnabled()).toBe(false);
  } finally { off(); }
}

describe("public tool/store tree-number namespaces", () => {
  it.each(TRUNKS)("keeps built-in Interior %i upper without inventing a canopy", (tile) => {
    const { project, map, tileset } = fixture("interior");
    expect(tileset.priority[tile]).toBe("upper");
    store.replace(project);
    paintThroughStore(map.id, tile, 3, 3);
    const after = store.getCurrent().maps[map.id];
    const upper = Array(64).fill(TILE.EMPTY); upper[27] = tile;
    expect(after.upperTiles).toEqual(upper);
    expect(after.lowerTiles).toEqual(Array(64).fill(72));
  });

  for (const namespace of ["custom", "foreign-rpg", "id-collision"] as const) {
    it.each(["tool", "pen"] as const)(`preserves ${namespace} authored pair through %s and subsequent edits`, (entry) => {
      const { project, map, tileset } = fixture(namespace);
      tileset.tileGroups = [pair()];
      store.replace(project);
      if (entry === "tool") paintThroughStore(map.id, 290, 3, 3);
      else paintTilesBulk(map.id, [{ layer: "upper", x: 3, y: 2, tile: 280 }]);
      const upper = Array(64).fill(TILE.EMPTY); upper[19] = 280; upper[27] = 290;
      expect(store.getCurrent().maps[map.id].upperTiles).toEqual(upper);
      paintThroughStore(map.id, 237, 5, 5);
      upper[45] = 237;
      expect(store.getCurrent().maps[map.id].upperTiles).toEqual(upper);
      expect(store.getCurrent().maps[map.id].lowerTiles).toEqual(Array(64).fill(72));
      expect(store.getCurrent().tilesets[tileset.id].tileGroups).toEqual([pair()]);
    });
  }

  it("honors foreign authored lower groups for canopy and trunk numbers", () => {
    const { project, map, tileset } = fixture("foreign-rpg");
    tileset.priority[260] = "lower"; tileset.priority[290] = "lower";
    tileset.tileGroups = [{ id: "floor", name: "Foreign floor", role: "terrain", defaultLayer: "lower", tileIds: [260, 290], description: "", placementRules: "" }];
    store.replace(project);
    paintThroughStore(map.id, 260, 2, 2);
    paintThroughStore(map.id, 290, 3, 2);
    const lower = Array(64).fill(72); lower[18] = 260; lower[19] = 290;
    expect(store.getCurrent().maps[map.id].lowerTiles).toEqual(lower);
    expect(store.getCurrent().maps[map.id].upperTiles).toEqual(Array(64).fill(TILE.EMPTY));
  });

  it("repairs town maps but leaves every foreign layer intact during an unrelated store tool edit", () => {
    const { project, map } = fixture("custom");
    const town = { ...structuredClone(map), id: "town-control", tilesetId: DEFAULT_TILESET_ID, lowerTiles: Array(64).fill(TILE.GRASS), upperTiles: Array(64).fill(TILE.EMPTY) };
    town.lowerTiles[45] = 290;
    project.maps[town.id] = town;
    project.mapTree.children.push({ mapId: town.id, children: [] });
    map.upperTiles[3] = 291; map.lowerTiles[27] = 293; map.upperTiles[19] = 280;
    const lower = [...map.lowerTiles]; const upper = [...map.upperTiles]; upper[54] = 237;
    store.replace(project);
    paintThroughStore(map.id, 237, 6, 6);
    expect(store.getCurrent().maps[map.id].lowerTiles).toEqual(lower);
    expect(store.getCurrent().maps[map.id].upperTiles).toEqual(upper);
    expect(store.getCurrent().maps[town.id].upperTiles[37]).toBe(260);
    expect(store.getCurrent().maps[town.id].lowerTiles[45]).toBe(290);
  });

  it("does not guess a namespace when a map has no tileset definition", () => {
    const { project, map } = fixture("custom");
    map.tilesetId = "missing-definition";
    map.upperTiles[3] = 291; map.lowerTiles[27] = 293;
    const before = structuredClone(map);
    expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
    expect(map).toEqual(before);
  });
});

for (const namespace of ["custom", "foreign-rpg"] as const) {
  describe(`${namespace} manual repair callers`, () => {
    it("filling an unrelated upper region does not rewrite an authored pair", () => {
      const { project, map, tileset } = fixture(namespace);
      tileset.tileGroups = [pair()]; map.upperTiles[19] = 280; map.upperTiles[27] = 290;
      store.replace(project);
      fillTile(map.id, "upper", 6, 6, 237);
      expect(store.getCurrent().maps[map.id].upperTiles[19]).toBe(280);
      expect(store.getCurrent().maps[map.id].upperTiles[27]).toBe(290);
      expect(store.getCurrent().maps[map.id].upperTiles[54]).toBe(237);
    });

    it("erases only the requested foreign lower cell, not a numeric town companion", () => {
      const { project, map, tileset } = fixture(namespace);
      tileset.priority[290] = "lower";
      map.lowerTiles[27] = 290; map.upperTiles[19] = 260;
      store.replace(project);
      eraseTile(map.id, "lower", 3, 3);
      expect(store.getCurrent().maps[map.id].lowerTiles[27]).toBe(TILE.EMPTY);
      expect(store.getCurrent().maps[map.id].upperTiles[19]).toBe(260);
    });

    it("still erases an authored hard pair without deleting unrelated numeric tiles on the other layer", () => {
      const { project, map, tileset } = fixture(namespace);
      tileset.tileGroups = [pair()];
      map.upperTiles[19] = 280; map.upperTiles[27] = 290; map.lowerTiles[19] = 293;
      store.replace(project);
      eraseTile(map.id, "upper", 3, 2);
      expect(store.getCurrent().maps[map.id].upperTiles[19]).toBe(TILE.EMPTY);
      expect(store.getCurrent().maps[map.id].upperTiles[27]).toBe(TILE.EMPTY);
      expect(store.getCurrent().maps[map.id].lowerTiles[19]).toBe(293);
    });
  });
}
