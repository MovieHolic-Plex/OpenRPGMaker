import { describe, expect, it } from "vitest";
import { followRegionsFromDeltas } from "@/editor/aiFollowCamera";
import { applyMapDeltas, diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

function seed(): Project {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 20, height: 16 });
  if (!result.ok) throw new Error(result.summary);
  return ctx.project;
}

function regionsFor(before: Record<string, GameMap>, after: Record<string, GameMap>) {
  const deltas = diffMapsForDelta(before, after);
  const applied = applyMapDeltas(before, deltas);
  return followRegionsFromDeltas(deltas, (id) => applied[id]);
}

describe("followRegionsFromDeltas", () => {
  it("bounds a few painted cells on the map that changed", () => {
    const project = seed();
    const before = structuredClone(project.maps);
    const map = structuredClone(project.maps.map_east!);
    const lower = [...map.lowerTiles];
    lower[3 * map.width + 4] = 7;
    lower[5 * map.width + 9] = 7;
    const after = { ...before, map_east: { ...map, lowerTiles: lower } };
    const regions = regionsFor(before, after);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ mapId: "map_east", x: 4, y: 3, w: 6, h: 3 });
    expect(regions[0]!.cells).toEqual([{ x: 4, y: 3, layer: "lower" }, { x: 9, y: 5, layer: "lower" }]);
  });

  it("covers the whole map when a new map arrives", () => {
    const project = seed();
    const before = structuredClone(project.maps);
    const { map_east: _east, ...without } = before;
    const regions = regionsFor(without, before);
    expect(regions.find((region) => region.mapId === "map_east")).toMatchObject({ x: 0, y: 0, w: 20, h: 16 });
  });

  it("follows an event moved to a new cell", () => {
    const project = seed();
    const npc = { id: "ev_npc", name: "NPC", x: 2, y: 2, pages: [] } as unknown as GameMap["events"][number];
    const before = { ...structuredClone(project.maps), map_east: { ...project.maps.map_east!, events: [npc] } };
    const map = { ...before.map_east, events: [{ ...npc, x: 12, y: 10 }] };
    const regions = regionsFor(before, { ...before, map_east: map });
    expect(regions[0]).toMatchObject({ mapId: "map_east", x: 12, y: 10, w: 1, h: 1 });
  });
});
