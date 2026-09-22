import { describe, expect, it } from "vitest";
import { mapCellApply } from "@/editor/incrementalMapApply";
import { changedProjectKeys } from "@/ai/piAgent/protocol";
import { createBlankMap } from "@/project/defaults";
import type { Project } from "@/project/types";

function project(): Project {
  const map = createBlankMap("m1", 8, 6);
  map.id = "m1";
  return { maps: { m1: map }, tilesets: { ts: { id: "ts", image: "x" } }, database: { actors: [] } } as unknown as Project;
}

describe("mapCellApply", () => {
  it("returns only the painted cells when the rest of the project is the same object", () => {
    const before = project();
    const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
    map.lowerTiles[3] = 9;
    const after = { ...before, maps: { ...before.maps, m1: map } };
    const cells = mapCellApply(before, after, "m1");
    expect(cells?.mapId).toBe("m1");
    expect(cells?.cells.some((cell) => cell.x === 3 && cell.y === 0 && cell.layer === "lower")).toBe(true);
    expect(cells!.cells.filter((cell) => cell.layer === "lower")).toHaveLength(1);
  });

  it("keeps a full redraw when the tileset object changes", () => {
    const before = project();
    const after = { ...before, tilesets: { ...before.tilesets } };
    expect(mapCellApply(before, after, "m1")).toBeNull();
  });
});

describe("changedProjectKeys", () => {
  it("does not treat a shared tileset reference as a change", () => {
    const before = project();
    const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
    map.lowerTiles[0] = 4;
    const after = { ...before, maps: { ...before.maps, m1: map } };
    expect(changedProjectKeys(before, after)).toEqual(["maps.m1"]);
  });
});
