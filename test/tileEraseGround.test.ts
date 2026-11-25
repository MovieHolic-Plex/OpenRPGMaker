import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext } from "@/editor/tools";
import { setTileLayerOverride, markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { isPassable } from "@/project/collision";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { blockedFlag, passableFlag, setPassageMark } from "@/project/tilesetPassage";
import { confirmUserTileMetadata } from "@/project/tilesetPalette";
import { completedHouseProject, houseMap, HOUSE_RECT } from "./fixtures/completedHouse";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

const MAP_ID = "erase_ground";
const RECT = { x: 1, y: 1, w: 10, h: 8 };

// 이 파일의 칸 번호(벽 306·13, 풀 240, 바닥 222, 상자 237, 지붕 385 …)와 재료 이름(「목골 석벽 집 벽 확장」·「나무 상자」)은 합본 마을 칩셋의 것이다.
// 기본 칩셋이 버들항(beodeul_city)으로 바뀌고(2026-09-30) 합본 마을·실내 시트가 번들에서 빠진 뒤(2026-10-07) create_map 은 버들항 맵을 만들어
// 240 은 벽, 풀은 737 이 됐고 열여섯 경우가 공개 기준선(0d4f13e7c)부터 떨어졌다. 옛 저장본처럼 그 타일셋 정의를 든 프로젝트에서 합본 마을 맵을 만든다
// — 편집기는 그런 저장본을 계속 읽고, tile_erase 의 «관찰된 바닥» 규칙은 칩셋과 무관하게 같아야 한다.
function context(): ToolContext {
  const ctx = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
  const created = runTool(ctx, "create_map", {
    id: MAP_ID, name: "Erase ground fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" }, tilesetId: COMBINED_TOWN_TILESET_ID,
  });
  expect(created.ok, JSON.stringify(created.issues)).toBe(true);
  expect(ctx.project.maps[MAP_ID].tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
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
    // 집 픽스처의 바닥(TILE.GRASS 240)도 합본 마을 번호다 — 버들항 맵에서는 240 이 벽이라 «복원할 바닥 없음» 이 집 보호보다 먼저 나왔다.
    const project = withRetiredEasyRpgTilesets(completedHouseProject());
    houseMap(project).tilesetId = COMBINED_TOWN_TILESET_ID;
    const ctx = { project };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "tile_erase", { mapId: ctx.project.startMapId, rect: HOUSE_RECT, layer });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(ctx.project).toEqual(before);
  });
});
