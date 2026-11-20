import { describe, expect, it } from "vitest";
import { filterProps, groupProps, recommendProps, propsForTileset } from "@/editor/propRecommendations";
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
  it("keeps pedestals out of beds and uses the object name before ambiguous ids", () => {
    const { tileset } = fixture();
    tileset.structureKits!.push(
      { id: "key-pedestal", kind: "section", name: "열쇠 받침대", width: 1, height: 1, rows: [{ tiles: [5] }], ai: { description: "", placementRules: "", tags: ["JRPG 장치"] } },
      { id: "flower-bed", kind: "section", name: "꽃 화분", width: 1, height: 1, rows: [{ tiles: [6] }] },
    );
    const choices = propsForTileset(tileset);
    expect(choices.find(choice => choice.id === "key-pedestal")?.category).toBe("devices");
    expect(choices.find(choice => choice.id === "flower-bed")?.category).toBe("plants");
  });

  it("groups bundled props by manifest order and searches catalog fields across groups", () => {
    const { map, tileset } = fixture();
    for (const id of ["anchor_decor", "bed_double", "birch_tree"]) {
      tileset.structureKits!.push({
        id: `bd-object:${id}`, kind: "section", name: "이전 저장 이름", width: 1, height: 1,
        rows: [{ tiles: [-1], upperTiles: [7] }],
        ai: { description: "", placementRules: "", tags: ["이전 저장 태그"] },
      });
    }
    const entries = recommendProps(map, tileset);
    const { groups, ungrouped } = groupProps(entries);
    expect(groups.map(({ group, entries }) => [group.id, entries.map(({ choice }) => choice.name)])).toEqual([
      ["nature", ["자작나무"]], ["indoor", ["더블 침대"]], ["harbor", ["닻 장식"]],
    ]);
    expect(ungrouped.map(({ choice }) => choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
    expect(filterProps(entries, undefined, "자작").map(({ choice }) => choice.id)).toEqual(["bd-object:birch_tree"]);
    expect(filterProps(entries, undefined, "OR_DEC").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
    expect(filterProps(entries, undefined, "ARBO").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
    expect(groupProps(filterProps(entries, undefined, "버들항 기본 기물")).groups.map(({ group }) => group.id))
      .toEqual(["nature", "indoor", "harbor"]);
    expect(groupProps(filterProps(entries, undefined, "이전 저장 태그"))).toEqual({ groups: [], ungrouped: [] });
  });
});
