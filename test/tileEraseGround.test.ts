import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext } from "@/editor/tools";
import { setTileLayerOverride, markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { blockedFlag, passableFlag, setPassageMark } from "@/project/tilesetPassage";
import { confirmUserTileMetadata } from "@/project/tilesetPalette";
import { completedHouseProject, HOUSE_RECT } from "./fixtures/completedHouse";

const MAP_ID = "erase_ground";
const RECT = { x: 1, y: 1, w: 10, h: 8 };

function context(): ToolContext {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", {
    id: MAP_ID, name: "Erase ground fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" },
  });
  expect(created.ok, JSON.stringify(created.issues)).toBe(true);
  return ctx;
}

describe("tile_erase compatible observed ground", () => {
  it("create_map's wall306 border cannot replace its 80 grass interior cells", () => {
    const ctx = context();
    const before = structuredClone(ctx.project.maps[MAP_ID]);
    expect(before.lowerTiles.filter(tile => tile === 306)).toHaveLength(40);
    expect(before.lowerTiles.filter(tile => tile === 240)).toHaveLength(80);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ groundTile: 240, cleared: 80, requested: 80, skipped: 0 });
    expect(ctx.project.maps[MAP_ID]).toEqual(before);
    for (let y = 1; y < 9; y += 1) {
      for (let x = 1; x < 11; x += 1) expect(isPassable(ctx.project, ctx.project.maps[MAP_ID], x, y)).toBe(true);
    }
  });

  it.each([RECT, { x: 0, y: 0, w: 12, h: 10 }])("captured wall distribution cannot restore wall13 (%j)", (rect) => {
    const ctx = context();
    const wall = runTool(ctx, "build_wall", {
      mapId: MAP_ID, rect: { x: 0, y: 0, w: 12, h: 10 }, material: "목골 석벽 집 벽 확장",
    });
    expect(wall.ok, JSON.stringify(wall.issues)).toBe(true);
    const counts = new Map<number, number>();
    for (const tile of ctx.project.maps[MAP_ID].lowerTiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({ 12: 1, 13: 10, 14: 1, 42: 8, 43: 80, 44: 8, 72: 1, 73: 10, 74: 1 });
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]).toMatchObject({ code: "erase-ground-unresolved", mapId: MAP_ID });
    expect(ctx.project).toEqual(before);
  });

  it.each([
    { tilesetId: COMBINED_TOWN_TILESET_ID, floor: 222, crate: 237 },
    { tilesetId: COMBINED_TOWN_TILESET_ID, floor: 240, crate: 237 },
    { tilesetId: "easyrpg_chipset_interior", floor: 72, crate: 295 },
  ])("preserves $tilesetId floor$floor after real 2/2 crate placement", ({ tilesetId, floor, crate }) => {
    const ctx = context();
    const map = ctx.project.maps[MAP_ID];
    map.tilesetId = tilesetId;
    map.lowerTiles.fill(floor);
    const tilesetsBefore = structuredClone(ctx.project.tilesets);
    const placed = runTool(ctx, "place_props", { mapId: MAP_ID, area: RECT, material: "나무 상자", count: 2, seed: 7 });
    expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
    expect(ctx.project.maps[MAP_ID].upperTiles.filter(tile => tile === crate)).toHaveLength(2);
    const erased = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
    expect(erased.ok, JSON.stringify(erased.issues)).toBe(true);
    expect(erased.data).toMatchObject({ groundTile: floor, cleared: 80 });
    expect(ctx.project.maps[MAP_ID].lowerTiles).toEqual(Array(120).fill(floor));
    expect(ctx.project.maps[MAP_ID].upperTiles).toEqual(Array(120).fill(TILE.EMPTY));
    expect(ctx.project.tilesets).toEqual(tilesetsBefore);
  });

  it.each([
    { name: "roof even with corrupted open/lower runtime", tile: 385, open: true, authored: false },
    { name: "prop even with authored open/lower rules", tile: 237, open: true, authored: true },
    { name: "wall even with authored open/lower rules", tile: 13, open: true, authored: true },
    { name: "blocked floor", tile: 222, open: false, authored: false },
    { name: "water even with authored open/lower rules", tile: TILE.WATER, open: true, authored: true },
  ])("excludes $name in favor of observed ground", ({ tile, open, authored }) => {
    const ctx = context();
    const map = ctx.project.maps[MAP_ID];
    const tileset = ctx.project.tilesets[map.tilesetId];
    map.lowerTiles.fill(tile);
    map.lowerTiles[13] = 240;
    tileset.passability[tile] = open ? passableFlag() : blockedFlag();
    tileset.priority[tile] = "lower";
    if (authored) {
      setTileLayerOverride(tileset, tile, "lower");
      setPassageMark(tileset, tile, "o");
      markUserTileRuntimeMetadata(tileset, tile, { passage: "passable" });
    }
    const before = structuredClone(tileset);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ groundTile: 240 });
    for (let y = 1; y < 9; y += 1) {
      for (let x = 1; x < 11; x += 1) expect(ctx.project.maps[MAP_ID].lowerTiles[y * 12 + x]).toBe(240);
    }
    expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
  });

  it.each(["both", "lower"])("no observed ground fails before mutating the real module draft (%s)", (layer) => {
    const ctx = context();
    const map = ctx.project.maps[MAP_ID];
    map.lowerTiles.fill(TILE.EMPTY);
    map.upperTiles.fill(237);
    const before = structuredClone(ctx.project);
    const args = { mapId: MAP_ID, rect: RECT, layer };
    expect(() => getTool("tile_erase")!.run(ctx.project, args)).toThrow(expect.objectContaining({ code: "erase-ground-unresolved" }));
    expect(ctx.project).toEqual(before);
    const original = ctx.project;
    const result = runTool(ctx, "tile_erase", args);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("erase-ground-unresolved");
    expect(ctx.project).toBe(original);
    expect(ctx.project).toEqual(before);
  });

  it("upper-only erase does not require ground and preserves lower cells", () => {
    const ctx = context();
    ctx.project.maps[MAP_ID].lowerTiles.fill(13);
    ctx.project.maps[MAP_ID].upperTiles.fill(237);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 0, y: 0, w: 12, h: 10 }, layer: "upper" });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ cleared: 120 });
    expect(ctx.project.maps[MAP_ID].lowerTiles).toEqual(Array(120).fill(13));
    expect(ctx.project.maps[MAP_ID].upperTiles).toEqual(Array(120).fill(TILE.EMPTY));
  });

  it.each(["upper", "solid", "role"])("preserves authored %s exclusion of an otherwise valid floor", (rule) => {
    const ctx = context();
    const map = ctx.project.maps[MAP_ID];
    const tileset = ctx.project.tilesets[map.tilesetId];
    map.lowerTiles.fill(222);
    map.lowerTiles[13] = 240;
    if (rule === "upper") setTileLayerOverride(tileset, 222, "upper");
    if (rule === "solid") {
      setPassageMark(tileset, 222, "x");
      markUserTileRuntimeMetadata(tileset, 222, { passage: "solid" });
    }
    if (rule === "role") tileset.tileMeta![222] = confirmUserTileMetadata(tileset.tileMeta![222], { role: "prop" });
    const before = structuredClone(tileset);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ groundTile: 240 });
    expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
  });

  it("honors an explicitly authored ground role and lower/passable override without rewriting its group", () => {
    const ctx = context();
    const map = ctx.project.maps[MAP_ID];
    const tileset = ctx.project.tilesets[map.tilesetId];
    map.lowerTiles.fill(13);
    tileset.tileMeta![13] = confirmUserTileMetadata(tileset.tileMeta![13], { role: "ground", passage: "passable" });
    setTileLayerOverride(tileset, 13, "lower");
    setPassageMark(tileset, 13, "o");
    const before = structuredClone(tileset);
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ groundTile: 13 });
    expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
  });

  it.each(["both", "lower", "upper"])("retains recorded house ownership atomically (%s)", (layer) => {
    const ctx = { project: completedHouseProject() };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "tile_erase", { mapId: ctx.project.startMapId, rect: HOUSE_RECT, layer });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(ctx.project).toEqual(before);
  });
});
