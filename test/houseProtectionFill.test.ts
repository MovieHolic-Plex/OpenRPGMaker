import { describe, expect, it } from "vitest";
import { getTool, runTool } from "@/editor/tools";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { cellsInFillShape } from "@/editor/tools/v3/constructionTools";
import { DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";
import { completedHouseProject, houseMap, HOUSE_RECT } from "./fixtures/completedHouse";

function fillTool() {
  const tool = getTool("fill_region");
  if (!tool) throw new Error("Missing fill tool");
  return tool;
}

function fixture() {
  const project = completedHouseProject();
  const map = houseMap(project);
  // Passable roof/deck, empty wing gap, ordered stacks and empty stacks are all owned.
  map.lowerTiles.fill(TILE.GRASS);
  map.lowerTiles[4 * map.width + 4] = TILE.EMPTY;
  map.lowerTileStacks = { [4 * map.width + 4]: [], [5 * map.width + 4]: [72, TILE.GRASS] };
  map.upperTiles[5 * map.width + 4] = 200;
  map.upperTileStacks = { [4 * map.width + 4]: [], [5 * map.width + 4]: [199, 200] };
  return { project };
}

function changedCells(before: GameMap, after: GameMap): number {
  return before.lowerTiles.reduce((count, lower, index) => count + Number(
    lower !== after.lowerTiles[index] || before.upperTiles[index] !== after.upperTiles[index],
  ), 0);
}

describe("fill_region completed-house protection", () => {
  it.each([
    { material: "물", layer: "lower" },
    { material: "물", layer: "lower", clearUpper: false },
    { material: "모래", layer: "lower" },
    { material: "모래", layer: "lower", clearUpper: true },
    { material: "물", layer: "upper" },
    { material: "모래", layer: "upper", clearUpper: true },
  ])("accepts permitted ground while preserving both house layers and stacks: %j", (options) => {
    // Given a fill crossing the full house bbox and north ridge.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    const before = structuredClone(map);
    const houses = captureHouseProtection(ctx.project);
    map.upperTiles[2 * map.width + 2] = 199;
    before.upperTiles[2 * map.width + 2] = 199;

    // When executed through the real transaction and unchanged final invariant.
    const result = runTool(ctx, "fill_region", {
      mapId: map.id, rect: { x: 2, y: 2, w: 6, h: 5 }, ...options,
      force: true, selection: HOUSE_RECT,
    });

    // Then only the ten unowned cells can change, and the receipt matches reality.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(changedCells(before, houseMap(ctx.project))).toBe(10);
    expect(result.data).toMatchObject({ filled: 10, mutatedCells: 10, skipped: { structure: 20 } });
    const clears = options.layer === "lower" && (options.clearUpper ?? options.material === "물");
    expect(result.data).toMatchObject({ upperCleared: clears ? 1 : 0 });
    expect(houseMap(ctx.project).upperTiles[2 * map.width + 2]).toBe(
      options.layer === "upper" ? options.material === "물" ? LAKE_AUTOTILE_TILE.BODY : SAND_TILE.BODY : clears ? TILE.EMPTY : 199,
    );
  });

  it.each(["rect", "ellipse", "circle"] as const)("skips protected cells inside the %s mask before direct writes", (shape) => {
    // Given a known shape and metadata-only house cells, including the empty gap.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    const rect = { x: 2, y: 1, w: 7, h: 7 };
    const mask = cellsInFillShape(map, rect, shape);
    const houses = captureHouseProtection(ctx.project);
    const protectedKeys = new Set(houses.flatMap((house) => house.cells.map(({ x, y }) => `${x},${y}`)));
    const skipped = mask.filter(({ x, y }) => protectedKeys.has(`${x},${y}`)).length;
    const before = structuredClone(map);

    // When the real tool definition runs without a transaction rollback safety net.
    const result = fillTool().run(ctx.project, { mapId: map.id, rect, shape, material: "모래", clearUpper: true });

    // Then every permitted shape cell changes, not the protected cells or box corners.
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(changedCells(before, map)).toBe(mask.length - skipped);
    expect(result.data).toMatchObject({ filled: mask.length - skipped, mutatedCells: mask.length - skipped,
      skipped: { structure: skipped }, maskCells: mask.length, gapCells: 0 });
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (!mask.some((cell) => cell.x === x && cell.y === y)) expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
      }
    }
  });

  it("reports zero placement when every requested cell is protected", () => {
    // Given an entirely protected selection with no impassable wall expansion.
    const ctx = fixture();
    const before = structuredClone(ctx.project);
    // When force-like arguments accompany an all-house fill.
    const result = fillTool().run(ctx.project, {
      mapId: ctx.project.startMapId, rect: HOUSE_RECT, material: "물", clearUpper: true, force: true,
    });
    // Then the operation is a truthful no-op, not claimed terrain placement.
    expect(ctx.project).toEqual(before);
    expect(result.data).toMatchObject({ filled: 0, mutatedCells: 0, reshaped: 0, upperCleared: 0,
      skipped: { structure: 16 } });
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it.each(["lower", "upper"] as const)("retains fill-only structure fallback in the %s layer without house metadata", (layer) => {
    // Given an unfinished structure with a role only in the selected layer.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    delete map.layoutPlan;
    const tileset = ctx.project.tilesets[map.tilesetId];
    tileset.tileGroups?.push({ id: "fill-roof", name: "Fill roof", role: "roof", defaultLayer: "upper", tileIds: [199],
      description: "Fixture roof", placementRules: "" });
    map[layer === "lower" ? "lowerTiles" : "upperTiles"][2 * map.width + 2] = 199;
    const before = structuredClone(map);
    // When lower terrain fill explicitly requests upper clearing.
    const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 1, y: 2, w: 2, h: 1 }, material: "모래", clearUpper: true });
    // Then both layers at the structure stay intact, while adjacent ground changes.
    expect(map.lowerTiles[2 * map.width + 2]).toBe(before.lowerTiles[2 * map.width + 2]);
    expect(map.upperTiles[2 * map.width + 2]).toBe(before.upperTiles[2 * map.width + 2]);
    expect(map.lowerTiles[2 * map.width + 1]).not.toBe(before.lowerTiles[2 * map.width + 1]);
    expect(result.data).toMatchObject({ filled: 1, mutatedCells: 1, skipped: { structure: 1 } });
    expect(map.layoutPlan).toBeUndefined();
  });

  it.each(["house", "upper-roof"] as const)("preserves a %s neighbor while retaining it as an autotile connectivity input", (owner) => {
    // Given sand outside the requested mask that would normally be reshaped.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    map.lowerTiles[4 * map.width + 6] = SAND_TILE.BODY;
    if (owner === "upper-roof") {
      delete map.layoutPlan;
      map.upperTiles[4 * map.width + 6] = 199;
      ctx.project.tilesets[map.tilesetId].tileGroups?.push({ id: "neighbor-roof", name: "Neighbor roof", role: "roof", defaultLayer: "upper",
        tileIds: [199], description: "Fixture roof", placementRules: "" });
    }
    const before = structuredClone(map);
    // When only its east neighbor is filled.
    const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 7, y: 4, w: 1, h: 1 }, material: "모래" });
    // Then the protected neighbor stays exact; the new tile connects west (mask 8).
    expect(map.lowerTiles[4 * map.width + 6]).toBe(SAND_TILE.BODY);
    expect(map.upperTiles[4 * map.width + 6]).toBe(before.upperTiles[4 * map.width + 6]);
    expect(map.lowerTiles[4 * map.width + 7]).toBe(DEFAULT_SAND_AUTOTILE_GROUP.variantMap["8"]);
    expect(map.lowerTiles[4 * map.width + 7]).not.toBe(DEFAULT_SAND_AUTOTILE_GROUP.variantMap["0"]);
    expect(result.data).toMatchObject({ filled: 1, mutatedCells: changedCells(before, map), skipped: { structure: 0 } });
  });

  it("preserves reloaded human placement bounds without claiming a north ridge", () => {
    // Given a persisted placement (not a layout house).
    const ctx = fixture();
    const map = houseMap(ctx.project);
    delete map.layoutPlan;
    map.structurePlacements = [{ id: "human", kitId: "removed-kit", ...HOUSE_RECT,
      before: { lower: Array(16).fill(TILE.GRASS), upper: Array(16).fill(TILE.EMPTY) }, afterHash: "human-edited" }];
    ctx.project = deserialize(serialize(ctx.project));
    const houses = captureHouseProtection(ctx.project);
    // When a fill straddles the reloaded placement and its unowned north row.
    const result = runTool(ctx, "fill_region", { mapId: map.id, rect: { x: 3, y: 2, w: 4, h: 2 }, material: "모래" });
    // Then the north row changes and the human placement remains exact.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(result.data).toMatchObject({ filled: 4, mutatedCells: 4, skipped: { structure: 4 } });
  });

  it("filters protected wall-gap expansion cells as well as requested cells", () => {
    // Given an unowned cell separated from a wall by a passable, owned gap.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    map.lowerTiles[4 * map.width + 4] = 15;
    const houses = captureHouseProtection(ctx.project);
    // When wall-flush expansion adds the protected gap to the fill candidates.
    const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 2, y: 4, w: 1, h: 1 }, material: "모래" });
    // Then the gap is reported as skipped, never painted.
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(result.data).toMatchObject({ filled: 1, mutatedCells: 1, gapCells: 1, skipped: { structure: 1 } });
  });

  it.each([false, true])("reports final mutations rather than paint and reshape attempts (neighbor=%s)", (neighbor) => {
    // Given either unchanged grass or an unprotected sand neighbor needing reshaping.
    const ctx = fixture();
    const map = houseMap(ctx.project);
    if (neighbor) map.lowerTiles[10 * map.width + 11] = SAND_TILE.BODY;
    const before = structuredClone(map);
    // When one unowned cell is filled.
    const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 10, y: 10, w: 1, h: 1 }, material: neighbor ? "모래" : "잔디" });
    // Then the receipt counts final unique changes, including the neighbor but not unchanged grass.
    expect(changedCells(before, map)).toBe(neighbor ? 2 : 0);
    expect(result.data).toMatchObject({ filled: 1, mutatedCells: neighbor ? 2 : 0 });
  });

  it.each(["물", "모래"])("accepts %s around a real authored, saved and reloaded roof-deck house", (material) => {
    // Given a house produced by the real authoring tool, including its recorded ladder.
    const ctx = { project: completedHouseProject() };
    const map = houseMap(ctx.project);
    delete map.layoutPlan;
    map.lowerTiles.fill(TILE.GRASS);
    map.upperTiles.fill(TILE.EMPTY);
    const built = runTool(ctx, "author_house", { kind: "single", mapId: map.id, kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 7, h: 8 }], roofDeck: true, interior: "exterior-only", yard: [] });
    expect(built.ok, JSON.stringify(built.issues)).toBe(true);
    ctx.project = deserialize(serialize(ctx.project));
    const before = structuredClone(houseMap(ctx.project));
    const houses = captureHouseProtection(ctx.project);
    expect(before.upperTiles[10 * before.width + 6]).toBe(322);
    // When a straddling terrain fill includes the ridge, deck, ladder and yard.
    const result = runTool(ctx, "fill_region", { mapId: map.id, rect: { x: 1, y: 1, w: 9, h: 10 }, material });
    // Then the real transaction accepts useful terrain without modifying any house cell.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(changedCells(before, houseMap(ctx.project))).toBeGreaterThan(0);
    expect(result.data).toMatchObject({ mutatedCells: changedCells(before, houseMap(ctx.project)) });
  });
});
