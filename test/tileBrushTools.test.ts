import { beforeEach, describe, expect, it } from "vitest";
import { paintTile } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import {
  clearFavoriteTilesForTest,
  favoriteTilesSnapshot,
  selectUsedLocation,
  similarTilesForTile,
  toggleFavoriteTile,
  usedLocationsForTile,
} from "@/editor/panels/tileBrushTools";
import { compatibleStampIdForTile, isAutoConnectCandidate, tileStampsForTile } from "@/editor/tileStampBrushes";
import { createBlankProject, TILE } from "@/project/defaults";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { appendTileToStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

describe("tile brush tools", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    clearFavoriteTilesForTest();
    editorState.set({
      activeStampId: null,
      autoConnectMode: true,
      currentMapId: null,
      layer: "lower",
      selectedTile: TILE.GRASS,
      selection: null,
      tool: "paint",
    });
  });

  it("offers road stamps and auto-connect affordance when a road body tile is selected", () => {
    const stamps = tileStampsForTile(DIRT_ROAD_TILE.BODY);

    expect(isAutoConnectCandidate(DIRT_ROAD_TILE.BODY)).toBe(true);
    expect(stamps.map((stamp) => stamp.id)).toEqual(["road-plus", "road-block"]);
  });

  it("derives stamps and auto-connect affordance from custom tileset metadata", () => {
    const tileset = customMetadataTileset();

    const stamps = tileStampsForTile(3, tileset);

    expect(isAutoConnectCandidate(3, tileset)).toBe(true);
    expect(stamps.map((stamp) => stamp.id)).toEqual(["road-plus", "road-block"]);
    expect(stamps[0]?.cells.map((cell) => cell.tile)).toEqual([3, 3, 3, 3, 3]);
    expect(compatibleStampIdForTile("road-plus", 9, tileset)).toBeNull();
  });

  it("keeps favorite tiles in most-recent order when toggled", () => {
    toggleFavoriteTile(TILE.GRASS);
    toggleFavoriteTile(DIRT_ROAD_TILE.BODY);
    toggleFavoriteTile(TILE.GRASS);
    toggleFavoriteTile(TILE.GRASS);

    expect(favoriteTilesSnapshot()).toEqual([TILE.GRASS, DIRT_ROAD_TILE.BODY]);
  });

  it("reports used lower, upper, and stacked tile locations for palette hooks", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    map.lowerTiles[1 * map.width + 2] = DIRT_ROAD_TILE.BODY;
    map.upperTiles[2 * map.width + 3] = DIRT_ROAD_TILE.BODY;
    appendTileToStack(map, "lower", 3 * map.width + 4, DIRT_ROAD_TILE.BODY);

    const locations = usedLocationsForTile({ map, tile: DIRT_ROAD_TILE.BODY, limit: 8 });

    expect(locations.slice(0, 3)).toEqual([
      { layer: "lower", x: 2, y: 1 },
      { layer: "upper", x: 3, y: 2 },
      { layer: "lower", x: 4, y: 3 },
    ]);
  });

  it("selects a used tile location as the current map neighborhood hook", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;

    selectUsedLocation({ mapId, layer: "upper", x: 5, y: 6 });

    expect(editorState.get().selection).toEqual({ mapId, x: 5, y: 6, width: 1, height: 1 });
    expect(editorState.get().layer).toBe("upper");
  });

  it("suggests nearby dirt-road variants before unrelated tiles", () => {
    const project = store.getCurrent();
    const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];

    const similar = similarTilesForTile({ tileset, tile: DIRT_ROAD_TILE.BODY, limit: 5 });

    expect(similar).toContain(DIRT_ROAD_TILE.EDGE_NORTH);
    expect(similar).not.toContain(TILE.TREE);
  });

  it("suggests related custom tiles from tile groups and metadata before unrelated tiles", () => {
    const tileset = customMetadataTileset();

    const similar = similarTilesForTile({ tileset, tile: 3, limit: 3 });

    expect(similar).toContain(4);
    expect(similar).toContain(5);
    expect(similar).not.toContain(9);
  });

  it("lets manual auto-connect mode paint a non-autotile tile without reshaping it", () => {
    // RM: dirt body still reshapes under Manual. Non-autotile (grass) keeps exact tile.
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = store.getCurrent().maps[mapId];

    paintTile(mapId, "lower", 2, 2, TILE.GRASS, { autoConnect: false });

    expect(store.getCurrent().maps[mapId].lowerTiles[2 * map.width + 2]).toBe(TILE.GRASS);
  });

  it("keeps neighboring non-autotile tiles unchanged when painting grass in Manual", () => {
    const mapId = store.getCurrent().startMapId;
    const map = store.getCurrent().maps[mapId]!;
    paintTile(mapId, "lower", 1, 2, TILE.GRASS, { autoConnect: false });
    paintTile(mapId, "lower", 2, 2, TILE.GRASS, { autoConnect: false });
    paintTile(mapId, "lower", 3, 2, TILE.GRASS, { autoConnect: false });
    const leftBefore = store.getCurrent().maps[mapId]!.lowerTiles[2 * map.width + 1];
    const rightBefore = store.getCurrent().maps[mapId]!.lowerTiles[2 * map.width + 3];

    paintTile(mapId, "lower", 2, 2, TILE.GRASS, { autoConnect: false });

    const after = store.getCurrent().maps[mapId]!;
    expect(after.lowerTiles[2 * map.width + 1]).toBe(leftBefore);
    expect(after.lowerTiles[2 * map.width + 2]).toBe(TILE.GRASS);
    expect(after.lowerTiles[2 * map.width + 3]).toBe(rightBefore);
  });

  it("RM-style: dirt body still reshapes under Manual autoConnect", () => {
    const mapId = store.getCurrent().startMapId;
    const map = store.getCurrent().maps[mapId]!;
    paintTile(mapId, "lower", 2, 2, DIRT_ROAD_TILE.BODY, { autoConnect: false });
    expect(store.getCurrent().maps[mapId]!.lowerTiles[2 * map.width + 2]).toBe(DIRT_ROAD_TILE.ISOLATED);
  });
});

function customMetadataTileset(): TilesetDef {
  return {
    id: "custom-town",
    name: "Custom Town",
    image: { type: "uploaded", id: "custom-chipset" },
    tileSize: 16,
    tilesPerRow: 4,
    count: 12,
    passability: Array.from({ length: 12 }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array.from({ length: 12 }, () => "lower"),
    terrain: Array.from({ length: 12 }, () => 0),
    tileMeta: Array.from({ length: 12 }, (_, tile) => ({
      label: tile >= 3 && tile <= 5 ? "custom road tile" : tile === 8 ? "custom sand tile" : "grass",
      description: tile >= 3 && tile <= 5 ? "road autotile body and edge" : "",
      repeatability: tile >= 3 && tile <= 5 ? "auto" : "fixed",
      source: "imported",
    })),
    tileGroups: [
      {
        id: "custom-road",
        name: "Custom road",
        role: "terrain",
        defaultLayer: "lower",
        tileIds: [3, 4, 5],
        description: "Imported road autotile group",
        placementRules: "Use auto road connection.",
        patternGrammar: {
          kind: "autotile_3x3",
          parts: [{ role: "center", tileIds: [3] }],
          preserveCaps: false,
          repeat: "center",
        },
      },
      {
        id: "custom-sand",
        name: "Custom sand",
        role: "terrain",
        defaultLayer: "lower",
        tileIds: [8],
        description: "Imported sand plaza",
        placementRules: "Use as a dry surface.",
      },
    ],
  };
}
