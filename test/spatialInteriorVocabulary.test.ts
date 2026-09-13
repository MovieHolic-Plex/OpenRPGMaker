import { describe, it, expect } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { spatialId, own } from "../src/project/spatial/domain";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import {
  fixtureDocument,
  reinstantiateSpace,
  spaceCompilerFixture,
  spaceRoot,
  interiorAtlas,
} from "./support/spatialSpaceCompilerFixture";
function room(kit: string, chips: string[] = []) {
  const project = structuredClone(spaceCompilerFixture());
  fixtureDocument(project).library.objects["wall-prop"] = {
    id: spatialId("wall-prop"),
    name: "Wall prop",
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    graphic: { tilesetId: interiorAtlas, kitId: kit },
    anchors: [],
    chips,
  };
  return reinstantiateSpace(project, (s) => ({
    ...s,
    objectSlots: [
      {
        id: spatialId("prop"),
        objectDesignId: spatialId("wall-prop"),
        quantity: 1,
        required: true,
        placement: { mode: "auto" },
      },
    ],
  }));
}
function compiled(project: ReturnType<typeof room>) {
  const result = compileSpatialOccurrence(project, { occurrenceId: spaceRoot });
  const root = own(fixtureDocument(result).occurrences, spaceRoot);
  return { result, map: result.maps[root.bindings[0]!.mapId]! };
}
describe("frozen interior placement vocabulary", () => {
  it("freezes snap/role alongside pixels and survives project save/load", () => {
    const project = room("bed_v");
    const child = Object.values(fixtureDocument(project).occurrences).find(
      (o) => o.kind === "object",
    )!;
    expect(child.snapshot.kitCells["wall-prop"]!.interior).toMatchObject({
      id: "bed_v",
      snap: "wall-north",
      role: "bed",
    });
    const { map } = compiled(deserialize(serialize(project)));
    expect(map.upperTiles.slice(4 * map.width, 5 * map.width)).toContain(324);
  });
  it("freezes effective upper wall pixels and preserves the wall under a window", () => {
    const project = room("window", ["wall"]);
    const { map } = compiled(project);
    const i = map.upperTiles.findIndex(
      (t) =>
        t ===
        snapshotGraphic(project, { tilesetId: interiorAtlas, kitId: "window" })
          .cells[0]!.tile,
    );
    expect(Math.floor(i / map.width)).toBe(2);
    expect([74, 75, 76, 77]).toContain(map.lowerTiles[i]);
  });
  it("keeps wall investigation reachable after compiling and saving", () => {
    const { result, map } = compiled(room("religious", ["wall", "event"]));
    expect(map.events).toHaveLength(1);
    expect(map.events[0]!.y).toBe(4);
    expect(compiled(deserialize(serialize(result))).map).toEqual(map);
  });
  it("does not consult edited live kit metadata when recompiling a frozen occurrence", () => {
    const project = room("bed_v");
    const before = compiled(project).map;
    const changed = structuredClone(project);
    changed.tilesets[interiorAtlas]!.structureKits!.push({
      id: "bed_v",
      kind: "section",
      width: 1,
      height: 1,
      rows: [{ tiles: [72] }],
      ai: { description: "changed", placementRules: "", snap: "floor" },
    });
    expect(compiled(changed).map).toEqual(before);
  });
  it("keeps legacy snapshots without metadata at their original floor placement", () => {
    const project = structuredClone(room("bed_v"));
    for (const o of Object.values(fixtureDocument(project).occurrences))
      for (const raster of Object.values(o.snapshot.kitCells))
        delete (raster as { interior?: unknown }).interior;
    const before = compiled(project).map;
    expect(
      before.upperTiles.slice(4 * before.width, 5 * before.width),
    ).not.toContain(324);
    expect(compiled(deserialize(serialize(project))).map).toEqual(before);
  });
  it("preserves explicit fixed investigation coordinates", () => {
    const project = reinstantiateSpace(
      room("religious", ["wall", "event"]),
      (s) => ({
        ...s,
        objectSlots: s.objectSlots.map((slot) => ({
          ...slot,
          placement: { mode: "fixed", x: 1, y: 1 },
        })),
      }),
    );
    expect(compiled(project).map.events[0]).toMatchObject({ x: 3, y: 5 });
  });
  it("does not reinterpret outdoor kit layers as interior wall furniture", () => {
    const project = structuredClone(room("bed_v"));
    const atlas = "easyrpg_chipset_combined_town";
    (project.tilesets[atlas]!.structureKits ??= []).push({
      id: "outdoor-wall",
      kind: "section",
      width: 1,
      height: 1,
      rows: [{ tiles: [243] }],
      ai: { description: "", placementRules: "", snap: "wall-any" },
    });
    const raster = snapshotGraphic(project, {
      tilesetId: atlas,
      kitId: "outdoor-wall",
    });
    expect(raster.interior).toBeUndefined();
    expect(raster.cells).toEqual([{ x: 0, y: 0, layer: "lower", tile: 243 }]);
  });
});
