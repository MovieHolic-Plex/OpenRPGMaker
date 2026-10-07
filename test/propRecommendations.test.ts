import { describe, expect, it } from "vitest";
import { filterProps, recommendProps, propsForTileset } from "@/editor/propRecommendations";
import type { GameMap, TilesetDef } from "@/project/types";

function fixture() {
  const tileset: TilesetDef = { id: "props", name: "Props", image: { type: "uploaded", id: "props-image" }, kind: "custom", tileSize: 32, tilesPerRow: 4, count: 8,
    passability: Array(8).fill("o"), priority: Array(8).fill("upper"), terrain: Array(8).fill(0),
    structureKits: [
      { id: "chair-red", kind: "section", name: "붉은 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [1] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
      { id: "chair-blue", kind: "section", name: "푸른 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [2] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
      { id: "statue", kind: "section", name: "광장 석상", width: 1, height: 2, rows: [{ tiles: [-1], upperTiles: [3] }, { tiles: [-1], upperTiles: [4] }] },
      { id: "broken", kind: "section", name: "손상된 기물", width: 1, height: 1, rows: [{ tiles: [8] }] },
      { id: "wrong-size", kind: "section", name: "16px 기물", tileSize: 16, width: 1, height: 1, rows: [{ tiles: [2] }] },
    ] };
  const map = { id: "map", name: "광장", tilesetId: tileset.id, tileSize: 32, width: 10, height: 10, locations: [] } as unknown as GameMap;
  return { map, tileset };
}

describe("map prop recommendations", () => {
  it("uses valid native cells from the map's own chipset and ranks place matches first", () => {
    const { map, tileset } = fixture();
    const entries = recommendProps(map, tileset);
    expect(entries.map(entry => entry.choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
    expect(entries[0]!.choice.stamp).toMatchObject({ width: 1, height: 2, source: { tilesetId: "props", tileSize: 32 }, cells: [{ dx: 0, dy: 0, layer: "upper", tile: 3 }, { dx: 0, dy: 1, layer: "upper", tile: 4 }] });
    expect(propsForTileset(tileset)).toBe(propsForTileset(tileset));
  });
  it("keeps color variants from filling the first recommendations", () => {
    const { map, tileset } = fixture();
    map.name = "새 맵";
    expect(recommendProps(map, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "statue", "chair-blue"]);
  });
  it("refuses foreign chipsets, mismatched tile sizes, and objects too large for the map", () => {
    const { map, tileset } = fixture();
    expect(recommendProps({ ...map, tilesetId: "other" }, tileset)).toEqual([]);
    expect(recommendProps({ ...map, tileSize: 16 }, tileset)).toEqual([]);
    expect(recommendProps({ ...map, height: 1 }, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
  });
  it("groups objects by type and searches the whole catalog before paging", () => {
    const { map, tileset } = fixture();
    tileset.structureKits!.push(...Array.from({ length: 8 }, (_, index) => ({
      id: `workbench-${index}`, kind: "section" as const, name: `작업대 ${index}`, width: 1, height: 1, rows: [{ tiles: [5] }],
      ai: { description: "대장간 제작", placementRules: "", tags: ["대장간"] },
    })));
    const entries = recommendProps(map, tileset);
    expect(filterProps(entries, "seating", "").map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
    expect(filterProps(entries, "tables", "대장간 작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
    expect(entries.slice(0, 6).some(entry => entry.choice.id === "workbench-7")).toBe(false);
    expect(filterProps(entries, undefined, "작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
    expect(filterProps(entries, "beds", "의자")).toEqual([]);
  });
});
