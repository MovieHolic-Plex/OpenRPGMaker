import { describe, expect, it } from "vitest";
import { cloneExtraLayers, cropExtraLayers, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { normalizeTerrainDesign, normalizeTerrainStamps } from "@/project/terrainDesign";
import { restoreLockedTerrainCells } from "@/project/terrainLocks";
import { captureTerrainStamp, transformTerrainStamp, transformedRamp, symmetricStampPlacement } from "@/editor/terrainStamps";
import { emptyRelief } from "@/project/relief/edit";
import { runtimeMap } from "@/project/runtimeMap";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { canMove, isPassable } from "@/project/collision";
import type { GameMap } from "@/project/types";
function map(): GameMap { return { id: "terrain", name: "terrain", width: 8, height: 8, tileSize: 16, tilesetId: "ground", lowerTiles: new Array(64).fill(0), upperTiles: new Array(64).fill(-1), events: [] }; }
describe("terrain design persistence and transformed content", () => {
  it("opens shallow water, blocks deep water and props, and permits bridge decks", () => {
    const p = createBlankProject(), m = map(); m.tilesetId = p.maps[p.startMapId].tilesetId;
    const tileset = p.tilesets[m.tilesetId];
    tileset.passability = [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }];
    tileset.priority = ["lower", "lower"];
    m.terrainDesign = { waterDepth: new Array(64).fill(0) }; m.terrainDesign.waterDepth![18] = 1; setLayerTileAt(m, 1, 18, 1);
    expect(canMove(p, m, 1, 2, 2, 2)).toBe(true);
    setLayerTileAt(m, 4, 18, 1); expect(isPassable(p, m, 2, 2)).toBe(false); setLayerTileAt(m, 4, 18, -1);
    m.terrainDesign.waterDepth![18] = 3; expect(isPassable(p, m, 2, 2)).toBe(false);
    m.relief = emptyRelief(8, 8); m.relief.ramps = new Array(64).fill(0); m.relief.ramps[18] = 9; setLayerTileAt(m, 1, 18, 0);
    expect(isPassable(p, m, 2, 2)).toBe(true);
  });
  it("keeps old maps absent, rejects invalid dimensions, and normalizes cell values", () => {
    expect(normalizeTerrainDesign(undefined, 4)).toBeUndefined();
    expect(normalizeTerrainDesign({ lockedCells: [0, 0, 4, -1], waterDepth: [0, 1, 99, NaN] }, 4)).toEqual({ lockedCells: [0], waterDepth: [0, 1, 14, 0] });
    expect(normalizeTerrainDesign({ waterDepth: [1] }, 4)).toBeUndefined();
  });
  it("clones depth/locks and moves both through a cropped map", () => {
    const before = map(); before.terrainDesign = { lockedCells: [18], waterDepth: new Array(64).fill(0) }; before.terrainDesign.waterDepth![18] = 3;
    const clone = cloneExtraLayers(before); clone.terrainDesign!.waterDepth![18] = 1;
    expect(before.terrainDesign.waterDepth![18]).toBe(3);
    cropExtraLayers(before, 8, 8, 2, 2, 3, 3);
    expect(before.terrainDesign!.lockedCells).toEqual([0]); expect(before.terrainDesign!.waterDepth![0]).toBe(3);
  });
  it("preserves all four layers, shadow, height, ramp and water in locked cells", () => {
    const before = map(); before.relief = emptyRelief(8, 8); before.relief.levels[18] = 2; before.relief.ramps = new Array(64).fill(0); before.relief.ramps[18] = 9;
    before.terrainDesign = { lockedCells: [18], waterDepth: new Array(64).fill(0) }; before.terrainDesign.waterDepth![18] = 2;
    setLayerTileAt(before, 2, 18, 5); setLayerTileAt(before, 4, 18, 7);
    setShadowAt(before, 18, 5);
    const next = { ...before, lowerTiles: before.lowerTiles.slice(), upperTiles: before.upperTiles.slice(), ...cloneExtraLayers(before) };
    for (const layer of [1, 2, 3, 4] as const) setLayerTileAt(next, layer, 18, 9); next.relief!.levels[18] = 4; next.relief!.ramps![18] = 0; next.terrainDesign!.waterDepth![18] = 0;
    setShadowAt(next, 18, 15);
    restoreLockedTerrainCells(before, next);
    for (const layer of [1, 2, 3, 4] as const) expect(layerTileAt(next, layer, 18)).toBe(layerTileAt(before, layer, 18));
    expect(next.relief!.levels[18]).toBe(2); expect(next.relief!.ramps![18]).toBe(9); expect(next.terrainDesign!.waterDepth![18]).toBe(2);
    expect(shadowAt(next, 18)).toBe(5);
  });
  it("composes map reflections after a rotated stamp and reflects its whole rectangle", () => {
    const stamp = captureTerrainStamp(map(), { x: 1, y: 1 }, { x: 3, y: 4 }, "rectangle");
    expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, false, 1, 40, 30)).toEqual({ anchor: { x: 31, y: 6 }, rotation: 3, mirror: true });
    expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, false, 2, 40, 30)).toEqual({ anchor: { x: 5, y: 21 }, rotation: 1, mirror: true });
    expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, true, 4, 40, 40)).toEqual({ anchor: { x: 31, y: 5 }, rotation: 2, mirror: true });
  });
  it("rotates ramp direction and keeps multipart prop pixels upright", () => {
    const source = map(); source.relief = emptyRelief(8, 8); source.relief.ramps = new Array(64).fill(0); source.relief.ramps[18] = 1;
    setLayerTileAt(source, 3, 27, 7); setLayerTileAt(source, 3, 35, 8);
    const stamp = captureTerrainStamp(source, { x: 1, y: 1 }, { x: 6, y: 6 }, "hill"), rotated = transformTerrainStamp(stamp, 1, false);
    expect(rotated.cells.filter(c => c.ramp === 3)).toHaveLength(1);
    const top = rotated.cells.findIndex(c => c.layers[2] === 7); expect(rotated.cells[top + rotated.width]!.layers[2]).toBe(8);
    expect(normalizeTerrainStamps(JSON.parse(JSON.stringify([rotated])))?.[0]?.cells).toEqual(rotated.cells);
    expect(transformedRamp(3, 0, true)).toBe(4); expect(transformedRamp(5, 1, false)).toBe(7); expect(transformedRamp(9, 1, true)).toBe(9);
  });
  it("clears replaced runtime water depth without altering authored metadata", () => {
    const original = map(); original.terrainDesign = { waterDepth: new Array(64).fill(0) }; original.terrainDesign.waterDepth![18] = 3;
    const projected = runtimeMap(original, { mapOverrides: { terrain: { lower: { "18": 1 }, upper: {} } } });
    expect(projected.terrainDesign!.waterDepth![18]).toBe(0); expect(original.terrainDesign.waterDepth![18]).toBe(3); expect(layerTileAt(original, 1, 18)).toBe(0);
  });
});
