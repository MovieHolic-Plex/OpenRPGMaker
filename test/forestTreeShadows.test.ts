/**
 * 숲마을 나무 밑 그림자 — 밑동 칸과 발치 칸의 2층에 그림자 칸이 자동으로 놓이는지.
 *
 * 2026-09-27 「작은 숲속에 오두막」: 굽이숲 밑동·낱그루 밑동이 받침 잔디 위에 그대로 앉아
 * 수관 아래와 뿌리 둘레가 밝은 풀밭이었다(「나무들 하단에 그림자가 없으니 너무 어색하다」).
 */
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { layerTileAt } from "@/project/mapLayers";
import { createBlankProject } from "@/project/defaults";
import { applyForestTreeShadows, repairForestTreeShadowPassage, tilesetHasTreeShadows } from "@/project/defaults/forestHarmonyTreeShadows";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { cellPassability, tilePassability } from "@/project/collision";
import shadows from "@/assets/forestHarmonyTreeShadows.json";

const MAP_ID = "map_blank_start";

function setup() {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "resize_map", { mapId: MAP_ID, width: 40, height: 24 }).ok).toBe(true);
  return ctx;
}

describe("나무 밑 그림자", () => {
  it("나무를 심는 도구가 밑동과 발치 2층에 그림자를 놓고 타일셋에 그림자 칸을 붙인다", () => {
    const ctx = setup();
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 24 }, material: "숲 나무 · 큰 참나무", count: 2, seed: 5 });
    expect(result.ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    expect(tilesetHasTreeShadows(tileset)).toBe(true);
    const trunkTiles = new Set(Object.keys(shadows.trunk).map(Number));
    const trunks = map.lowerTiles.flatMap((tile, index) => (trunkTiles.has(tile) ? [index] : []));
    expect(trunks.length).toBeGreaterThan(0);
    for (const index of trunks) expect(layerTileAt(map, 2, index)).toBeGreaterThanOrEqual(0);
    // 발치: 뿌리 줄 바로 아래 칸 중 하나 이상에 그림자.
    const feet = trunks.map((index) => index + map.width).filter((index) => !trunkTiles.has(map.lowerTiles[index]!));
    expect(feet.some((index) => layerTileAt(map, 2, index) >= 0)).toBe(true);
  });

  // 2026-09-28 실측: 그림자 칸이 ○ 라서 통행 판정(위층부터 ★·빈칸 건너뛰기)이 2층에서 멈췄다 —
  // AI 조수 숲마을에서 막혀야 할 밑동 108칸이 뚫려 주인공이 나무를 걸어 지나갔다.
  it("그림자가 밑동·발치 칸의 통행을 바꾸지 않는다", () => {
    const ctx = setup();
    expect(runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 24 }, material: "숲 나무 · 큰 참나무", count: 3, seed: 5 }).ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    const shaded = map.lowerTiles.flatMap((_, index) => (layerTileAt(map, 2, index) >= 0 ? [index] : []));
    expect(shaded.length).toBeGreaterThan(0);
    for (const index of shaded) {
      expect(cellPassability(tileset, map, index)).toEqual(tilePassability(tileset, map.lowerTiles[index]!, map.upperTiles[index]!));
    }
  });

  it("옛 판(○)으로 붙은 그림자 칸을 불러올 때 ★ 로 고친다", () => {
    const ctx = setup();
    expect(runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 24 }, material: "숲 나무 · 큰 참나무", count: 1, seed: 5 }).ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    const trunk = map.lowerTiles.findIndex((tile) => Object.keys(shadows.trunk).includes(String(tile)));
    const shadow = layerTileAt(map, 2, trunk);
    tileset.priority[shadow] = "lower";
    tileset.tileMeta![shadow] = { ...tileset.tileMeta![shadow]!, passage: "passable" };
    const pass = cellPassability(tileset, map, trunk);
    expect(pass.up || pass.down || pass.left || pass.right).toBe(true);
    expect(ensureBundledTilesets(ctx.project)).toBe(true);
    expect(tileset.priority[shadow]).toBe("upper");
    expect(tileset.tileMeta![shadow]!.passage).toBe("star");
    expect(cellPassability(tileset, map, trunk)).toEqual(tilePassability(tileset, map.lowerTiles[trunk]!, map.upperTiles[trunk]!));
    expect(repairForestTreeShadowPassage(tileset)).toBe(false);
  });

  it("굽이숲 수관 아래 밑동에도 드리우고, 다시 돌려도 바뀌지 않는다", () => {
    const ctx = setup();
    expect(runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 24 }, material: "활엽수", density: "dense" }).ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const shaded = map.lowerTiles.filter((_, index) => layerTileAt(map, 2, index) >= 0).length;
    expect(shaded).toBeGreaterThan(0);
    expect(applyForestTreeShadows(map, ctx.project.tilesets[map.tilesetId])).toBe(0);
  });

  it("밑동이 사라지면 그 그림자도 지우고, 사람이 놓은 2층은 건드리지 않는다", () => {
    const ctx = setup();
    expect(runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 0, y: 0, w: 40, h: 24 }, material: "숲 나무 · 활엽수", count: 1, seed: 2 }).ok).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    const shadedCells = map.lowerTiles.flatMap((_, index) => (layerTileAt(map, 2, index) >= 0 ? [index] : []));
    expect(shadedCells.length).toBeGreaterThan(0);
    const kept = shadedCells[0]!;
    map.lowerOverlayTiles![kept] = 240; // 사람이 놓은 2층
    for (let index = 0; index < map.lowerTiles.length; index += 1) map.lowerTiles[index] = 240;
    applyForestTreeShadows(map, tileset);
    expect(layerTileAt(map, 2, kept)).toBe(240);
    expect(shadedCells.filter((index) => index !== kept).every((index) => layerTileAt(map, 2, index) < 0)).toBe(true);
  });

  it("stamp_object 로 찍은 나무에도 그림자가 붙고, 잎 없는 숲 벽은 거절·목록에서 빠진다", () => {
    const ctx = setup();
    const oak = runTool(ctx, "stamp_object", { objectId: "group:forest_harmony/forest-trees:big-oak", mapId: MAP_ID, x: 4, y: 4 });
    expect(oak.ok, oak.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    expect(map.lowerTiles.some((_, index) => layerTileAt(map, 2, index) >= 0)).toBe(true);
    const wall = runTool(ctx, "stamp_object", { objectId: "group:forest_harmony/forest-trees:forest-wall", mapId: MAP_ID, x: 20, y: 4 });
    expect(wall.ok).toBe(false);
    expect(wall.summary).toContain("density");
    const listed = runTool(ctx, "list_spatial_designs", { kind: "object" });
    expect(JSON.stringify(listed.data)).not.toContain("forest-trees:forest-wall");
  });
});
