import { beforeEach, describe, expect, it } from "vitest";
import { paintTilesBulk } from "@/editor/tileActions";
import { expandHardClusterPlacement } from "@/editor/tools/clusterRulePlacement";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

const FOREIGN_NAMESPACES = ["custom", "interior"] as const;
const TRUNKS = [290, 291, 292, 293] as const;

function fixture(namespace: "custom" | "interior" | "town") {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 6;
  map.height = 6;
  map.lowerTiles = Array(36).fill(TILE.GRASS);
  map.upperTiles = Array(36).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 0, y: 0 };
  if (namespace !== "town") {
    // A complete 480-cell atlas using an existing bundled image, with only the
    // authored rules needed here. Custom atlases may reuse bundled artwork.
    const tileset: TilesetDef = {
      id: `namespace-${namespace}`,
      name: `Namespace ${namespace}`,
      image: { ...project.tilesets.easyrpg_chipset_interior.image },
      kind: namespace === "custom" ? "custom" : "rpg2k",
      tileSize: 16,
      tilesPerRow: 30,
      count: 480,
      passability: Array.from({ length: 480 }, () => ({ up: true, down: true, left: true, right: true })),
      priority: Array(480).fill("upper"),
      terrain: Array(480).fill(0),
      tileGroups: [],
      autotileGroups: [],
    };
    tileset.priority[TILE.GRASS] = "lower";
    project.tilesets[tileset.id] = tileset;
    map.tilesetId = tileset.id;
  }
  return { project, map, tileset: project.tilesets[map.tilesetId] };
}

function pairGroup(a: number, b: number): TileGroupMetadata {
  return {
    id: "authored-pair",
    name: "Authored pair",
    role: "prop",
    defaultLayer: "upper",
    tileIds: [a, b],
    description: "",
    placementRules: "",
    rules: [{ id: "authored-adjacency", kind: "adjacency", strength: "hard", params: { a, b, relation: "aAboveB" } }],
  };
}

beforeEach(() => {
  // Exercise the real store mutation path without enabling remote persistence.
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
});

for (const namespace of FOREIGN_NAMESPACES) {
  describe(`${namespace} tree-number namespace isolation`, () => {
    for (const trunk of TRUNKS) {
      it.each([280, trunk])(`keeps authored upper pair 280/${trunk} when expanding from %i`, (originTile) => {
        const { map, tileset } = fixture(namespace);
        tileset.tileGroups = [pairGroup(280, trunk)];
        const result = expandHardClusterPlacement({
          map, tileset, tile: originTile, originLayer: "upper",
          origin: { x: 2, y: originTile === 280 ? 2 : 3 },
        });
        expect(result.ok).toBe(true);
        expect(result.autoTiles).toBe(1);
        expect(result.edits).toHaveLength(2);
        expect(result.edits).toEqual(expect.arrayContaining([
          { layer: "upper", tile: 280, x: 2, y: 2 },
          { layer: "upper", tile: trunk, x: 2, y: 3 },
        ]));
      });
    }

    it("painting over 260 does not erase its authored non-tree companion", () => {
      const { project, map, tileset } = fixture(namespace);
      tileset.tileGroups = [pairGroup(260, 280)];
      store.replace(project);
      paintTilesBulk(map.id, [{ layer: "upper", x: 2, y: 2, tile: 260 }]);
      const before = store.getCurrent().maps[map.id];
      expect(before.upperTiles[14]).toBe(260);
      expect(before.upperTiles[20]).toBe(280);
      const expectedUpper = [...before.upperTiles];
      expectedUpper[14] = 237;

      paintTilesBulk(map.id, [{ layer: "upper", x: 2, y: 2, tile: 237 }]);

      const after = store.getCurrent().maps[map.id];
      expect(after.upperTiles).toEqual(expectedUpper);
      expect(after.lowerTiles).toEqual(before.lowerTiles);
    });

    it.each([true, false])("painting over 262 preserves unrelated adjacent 263 (clusterExpand=%s)", (clusterExpand) => {
      const { project, map } = fixture(namespace);
      store.replace(project);
      paintTilesBulk(map.id, [
        { layer: "upper", x: 2, y: 2, tile: 262 },
        { layer: "upper", x: 3, y: 2, tile: 263 },
      ]);
      const before = store.getCurrent().maps[map.id];
      expect(before.upperTiles[14]).toBe(262);
      expect(before.upperTiles[15]).toBe(263);
      const expectedUpper = [...before.upperTiles];
      expectedUpper[14] = 237;

      paintTilesBulk(map.id, [{ layer: "upper", x: 2, y: 2, tile: 237 }], { clusterExpand });

      const after = store.getCurrent().maps[map.id];
      expect(after.upperTiles).toEqual(expectedUpper);
      expect(after.lowerTiles).toEqual(before.lowerTiles);
    });
  });
}

describe("Combined Town tree replacement remains intact", () => {
  it.each(TRUNKS)("places trunk %i lower and replaces its whole tree with a prop", (trunk) => {
    const { project, map } = fixture("town");
    store.replace(project);
    paintTilesBulk(map.id, [{ layer: "upper", x: 2, y: 3, tile: trunk }]);
    const before = store.getCurrent().maps[map.id];
    expect(before.lowerTiles[20]).toBe(trunk);
    expect(before.upperTiles[14]).toBe(trunk - 30);
    expect(before.upperTiles[20]).toBe(TILE.EMPTY);
    if (trunk >= 292) {
      const dx = trunk === 292 ? 1 : -1;
      expect(before.lowerTiles[20 + dx]).toBe(trunk + dx);
      expect(before.upperTiles[14 + dx]).toBe(trunk + dx - 30);
    }

    paintTilesBulk(map.id, [{ layer: "upper", x: 2, y: 2, tile: 237 }]);

    const after = store.getCurrent().maps[map.id];
    const expectedUpper = Array(36).fill(TILE.EMPTY);
    expectedUpper[14] = 237;
    expect(after.upperTiles).toEqual(expectedUpper);
    expect(after.lowerTiles).toEqual(Array(36).fill(TILE.GRASS));
  });
});
