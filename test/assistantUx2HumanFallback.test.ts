import { describe, expect, it, vi } from "vitest";
import type { GameMap } from "@/project/types";
import { changedAssistantMapCells } from "@/editor/assistantHumanEdits";

vi.mock("@/project/store", () => ({ store: {} }));
function map(): GameMap {
  return { id: "m", name: "M", width: 16, height: 16, tileSize: 16, tilesetId: "t",
    lowerTiles: Array(256).fill(0), upperTiles: Array(256).fill(-1), events: [] };
}

describe("descriptor-free human map edits", () => {
  it("finds exact changed relief cells while leaving identical tile arrays unread", () => {
    const before = map();
    const unread = new Proxy(before.lowerTiles, { get(target, key, receiver) {
      if (typeof key === "string" && /^\d+$/.test(key)) throw new Error("unchanged grid read");
      return Reflect.get(target, key, receiver);
    } });
    before.lowerTiles = unread;
    const after = { ...before, relief: { width: 16, height: 16, levels: Array(256).fill(0), ramps: Array(256).fill(0) } };
    after.relief.levels[7] = 3; after.relief.ramps[8] = 2;
    expect([...changedAssistantMapCells(before, after)].sort((a, b) => a - b)).toEqual([7, 8]);
  });

  it("reports moved sparse walls, locks and group membership without freezing unrelated cells", () => {
    const before = map();
    before.relief = { width: 16, height: 16, levels: Array(256).fill(0), wallDecor: [{ x: 2, y: 1, row: 1, tile: 4 }] };
    before.terrainDesign = { lockedCells: [40] };
    before.doodadGroups = [{ id: "g", label: "tree", kitId: "tree", cells: [{ index: 50, tile: 4, before: 0 }] }];
    const after = { ...before, relief: { ...before.relief, wallDecor: [{ x: 3, y: 1, row: 1, tile: 4 }] },
      terrainDesign: { lockedCells: [41] }, doodadGroups: [] };
    expect([...changedAssistantMapCells(before, after)].sort((a, b) => a - b)).toEqual([18, 19, 40, 41, 50]);
  });

  it("compares descriptor-free restored arrays and tile stacks by value", () => {
    const before = map(), after = structuredClone(before);
    after.upperTiles[23] = 8;
    after.lowerTileStacks = { 24: [2, 3] };
    expect([...changedAssistantMapCells(before, after)].sort((a, b) => a - b)).toEqual([23, 24]);
    expect(changedAssistantMapCells(before, structuredClone(before)).size).toBe(0);
  });
  it("uses exact layer and shadow defaults without collapsing explicit negative tiles", () => {
    const before = map(), after = { ...before,
      lowerOverlayTiles: Array(256).fill(-1), upperOverlayTiles: Array(256).fill(-1), shadowBits: Array(256).fill(0) };
    expect(changedAssistantMapCells(before, after).size).toBe(0);
    after.lowerOverlayTiles[1] = 0; after.upperOverlayTiles[2] = -2; after.shadowBits[3] = 4;
    expect([...changedAssistantMapCells(before, after)].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

});
