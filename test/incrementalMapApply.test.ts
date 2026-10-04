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

describe("toolMapCellApply", () => {
  it("recognizes cloned inputs and covers overlays, shadows and stacks", async () => {
    const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
    const { setLayerTileAt, setShadowAt } = await import("@/project/mapLayers");
    const before = project();
    const after = structuredClone(before);
    const map = after.maps.m1!;
    setLayerTileAt(map, 2, 9, 10);
    setLayerTileAt(map, 4, 10, 11);
    setShadowAt(map, 11, 3);
    map.upperTileStacks = { 12: [1, 2] };
    expect(toolMapCellApply(before, after)).toEqual({ mapId: "m1", cells: [
      { x: 1, y: 1, layer: "lower" }, { x: 2, y: 1, layer: "upper" },
      { x: 3, y: 1, layer: "lower" }, { x: 4, y: 1, layer: "upper" },
    ] });
    expect(before.maps.m1!.lowerOverlayTiles).toBeUndefined();
  });
  it("keeps full notifications for multiple maps, events, metadata and project data", async () => {
    const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
    const before = project();
    before.maps.m2 = { ...before.maps.m1!, id: "m2" };
    for (const edit of [
      (p: Project) => { p.maps.m2!.lowerTiles[0] = 8; },
      (p: Project) => { p.maps.m1!.name = "renamed"; },
      (p: Project) => { p.maps.m1!.width += 1; },
      (p: Project) => { p.maps.m1!.events.push({ id: "new", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }); },
      (p: Project) => { p.database.actors = [{ id: "new" }] as never; },
      (p: Project) => { delete p.maps.m2; },
    ]) {
      const after = structuredClone(before);
      after.maps.m1!.lowerTiles[0] = 7;
      edit(after);
      expect(toolMapCellApply(before, after)).toBeNull();
    }
  });
});
