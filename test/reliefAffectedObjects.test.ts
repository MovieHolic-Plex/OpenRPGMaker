import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { clearReliefAffectedObjects } from "@/project/relief/affectedObjects";
import { setLayerTileAt } from "@/project/mapLayers";

describe("height edit object cleanup", () => {
  it("removes overlapping structures, doodads, events, and untracked upper tiles", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.width = map.height = 8;
    map.lowerTiles = Array(64).fill(1);
    map.upperTiles = Array(64).fill(-1);
    const structureIndex = 2 * 8 + 2;
    setLayerTileAt(map, 1, structureIndex, 7);
    map.structurePlacements = [{ id: "house", kitId: "house", x: 2, y: 2, w: 2, h: 2, before: { lower: [1, 1, 1, 1], upper: [-1, -1, -1, -1] }, afterHash: "" }];
    map.doodadGroups = [{ id: "tree", label: "나무", kitId: "tree", cells: [{ index: 4 * 8 + 4, tile: 9, before: -1 }] }];
    setLayerTileAt(map, 3, 4 * 8 + 4, 9);
    setLayerTileAt(map, 3, 5 * 8 + 5, 10);
    map.events = [{ id: "npc", x: 5, y: 5, trigger: { kind: "action" }, commands: [] }];

    const result = clearReliefAffectedObjects(map, new Set([structureIndex, 4 * 8 + 4, 5 * 8 + 5]));

    expect(result.structureCount).toBe(1);
    expect(result.doodadCount).toBe(1);
    expect(result.eventIds).toEqual(["npc"]);
    expect(map.structurePlacements).toBeUndefined();
    expect(map.doodadGroups).toBeUndefined();
    expect(map.events).toEqual([]);
    expect(map.lowerTiles[structureIndex]).toBe(1);
    expect(map.upperTiles[4 * 8 + 4]).toBe(-1);
    expect(map.upperTiles[5 * 8 + 5]).toBe(-1);
  });
});
