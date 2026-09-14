import { describe, expect, it } from "vitest";
import { runTool } from "../src/editor/tools/toolRunner";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { own, spatialId } from "../src/project/spatial/domain";
import { HOUSE_SHELL_CREAM_FACE_TILES } from "../src/project/defaults/interiorHouseWallTiles";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot, spaceDesign } from "./support/spatialSpaceCompilerFixture";

function cabinet({ overlap = true, y = 0, lower = false, duplicate = false } = {}) {
  const project = structuredClone(spaceCompilerFixture());
  const tileset = project.tilesets.easyrpg_chipset_interior!;
  tileset.structureKits!.push({ id: "overlap-cabinet", name: "Cabinet", kind: "section", width: 1, height: 2,
    rows: [{ tiles: [lower ? 148 : -1], upperTiles: [lower ? -1 : 148] }, { tiles: [-1], upperTiles: [178] }] });
  fixtureDocument(project).library.objects["overlap-cabinet"] = { id: spatialId("overlap-cabinet"), name: "Cabinet", revision: 1,
    tags: [], provenance: { origin: "user" }, graphic: { tilesetId: tileset.id, kitId: "overlap-cabinet" }, anchors: [], chips: [] };
  return reinstantiateSpace(project, space => ({ ...space, objectSlots: Array.from({ length: duplicate ? 2 : 1 }, (_, i) => ({
    id: spatialId(`cabinet-${i}`), objectDesignId: spatialId("overlap-cabinet"), quantity: 1, required: true,
    placement: { mode: "fixed" as const, x: 1, y, ...(overlap ? { wallOverlap: 1 as const } : {}) },
  })) }));
}

describe("fixed furniture wall overlap", () => {
  it("keeps the cabinet base on the floor and the wall intact through save/load/recompile", () => {
    const result = compileSpatialOccurrence(deserialize(serialize(cabinet())), { occurrenceId: spaceRoot });
    const mapId = own(fixtureDocument(result).occurrences, spaceRoot).bindings[0]!.mapId;
    const map = result.maps[mapId]!;
    expect(map.upperTiles[3 * map.width + 3]).toBe(148);
    expect(map.upperTiles[4 * map.width + 3]).toBe(178);
    expect(HOUSE_SHELL_CREAM_FACE_TILES).toContain(map.lowerTiles[3 * map.width + 3]);
    expect(map.lowerTiles[4 * map.width + 3]).toBe(72);
    const loaded = deserialize(serialize(result));
    expect(compileSpatialOccurrence(loaded, { occurrenceId: spaceRoot }).maps[mapId]).toEqual(map);
  });
  it("keeps old floor-only placement unchanged when overlap is absent", () => {
    const result = compileSpatialOccurrence(cabinet({ overlap: false }), { occurrenceId: spaceRoot });
    const map = result.maps[own(fixtureDocument(result).occurrences, spaceRoot).bindings[0]!.mapId]!;
    expect(map.upperTiles[3 * map.width + 3]).toBe(-1);
    expect(map.upperTiles[4 * map.width + 3]).toBe(148);
    expect(map.upperTiles[5 * map.width + 3]).toBe(178);
  });
  it.each([{ y: 1 }, { lower: true }, { duplicate: true }])("rejects missing wall, wall replacement or occupied upper cells: %j", options => {
    const input = cabinet(options), before = serialize(input);
    expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrow();
    expect(serialize(input)).toBe(before);
  });
  it("accepts explicit overlap through the actual AI upsert schema", () => {
    const project = cabinet({ overlap: false });
    const source = own(fixtureDocument(cabinet()).library.spaces, spaceDesign);
    const result = runTool({ project }, "upsert_spatial_design", { kind: "space", expectedRevision: 1, space: { ...source, revision: 2 } });
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
