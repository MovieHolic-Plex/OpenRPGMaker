// 조수 쓰기 도구가 MZ 4층(1~4층 + 그림자)을 쓴다 — 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 2.
// 층 인자는 문자열 enum("lower"|"upper"|"1".."4"), 옛 맵(선택 칸 없음)에는 어떤 도구도 새 키를 만들지 않는다.
import { describe, expect, it } from "vitest";
import { affectedRegions, TILE_WRITE_TOOLS } from "@/ai/buildSpec";
import { runTool, type ToolContext } from "@/editor/tools";
import { TILESET_REFERENCE_TILE_CHOOSERS } from "@/editor/tools/tilesetReferenceTools";
import { getTool } from "@/editor/tools/toolRegistry";
import { isPassable } from "@/project/collision";
import { FOUR_LAYER_GUIDANCE, FOUR_LAYER_GUIDANCE_SHORT } from "@/editor/tools/mapHelpers";
import { paintRoadRect } from "@/project/defaults/roadAutotile";
import { paintTownPathNetwork } from "@/project/defaults/townPathAutotile";
import { buildEdgeCornerVariantMap } from "@/project/defaults/autotileEngine";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import type { AutotileGroup, GameMap } from "@/project/types";

const MAP_ID = "map_blank_start";
// 2층 풀 장식 시험용 4방향 그룹(번호는 합성 — 기본 칩셋 내장 그룹과 겹치지 않게 고른다).
const DECO = { body: 10, edgeN: 11, edgeS: 12, edgeW: 13, edgeE: 14, cornerNW: 15, cornerNE: 16, cornerSW: 17, cornerSE: 18 } as const;
const DECO_GROUP: AutotileGroup = {
  id: "test-grass-deco", name: "풀 장식", neighborhood: 4,
  memberTileIds: Object.values(DECO), variantMap: buildEdgeCornerVariantMap(DECO),
};

function context(withDecoGroup = false): ToolContext {
  const project = createBlankProject();
  if (withDecoGroup) project.tilesets[DEFAULT_TILESET_ID]!.autotileGroups = [DECO_GROUP];
  return { project };
}
function mapOf(ctx: ToolContext): GameMap {
  return ctx.project.maps[MAP_ID]!;
}
function idx(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}
function expectNoExtraKeys(map: GameMap): void {
  for (const key of EXTRA_LAYER_KEYS) expect(key in map, key).toBe(false);
}
function ok(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  expect(result.ok, `${name}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
  return result;
}

describe("paint_tiles — 네 층", () => {
  it("2층·4층은 선택 칸에, 1·3층은 옛 칸에 쓰고 effectiveLayer 는 \"1\"..\"4\"", () => {
    const ctx = context();
    const map = mapOf(ctx);
    const r2 = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "cells", tile: 20, cells: [{ x: 3, y: 3 }] });
    expect(layerTileAt(mapOf(ctx), 2, idx(map, 3, 3))).toBe(20);
    expect(r2.data).toMatchObject({ effectiveLayer: "2", tilesTouched: 1 });
    const r4 = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "4", mode: "cells", tile: 21, cells: [{ x: 4, y: 3 }] });
    expect(layerTileAt(mapOf(ctx), 4, idx(map, 4, 3))).toBe(21);
    expect(r4.data).toMatchObject({ effectiveLayer: "4" });
    const r1 = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "1", mode: "cells", tile: TILE.GRASS, cells: [{ x: 5, y: 3 }] });
    expect(r1.data).toMatchObject({ effectiveLayer: "1" });
    const rLower = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "lower", mode: "cells", tile: TILE.GRASS, cells: [{ x: 6, y: 3 }] });
    expect(rLower.data).toMatchObject({ effectiveLayer: "1" });
  });

  it("1층을 칠하면 그 칸의 2층을 지우고, 마지막 2층 칸이 비면 키가 빠진다", () => {
    const ctx = context();
    ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "cells", tile: 20, cells: [{ x: 3, y: 3 }] });
    expect(mapOf(ctx).lowerOverlayTiles).toBeDefined();
    ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "1", mode: "cells", tile: TILE.GRASS, cells: [{ x: 3, y: 3 }] });
    expectNoExtraKeys(mapOf(ctx));
  });

  it("2층 오토타일 멤버는 2층 이웃 기준으로 재성형되고 1층은 그대로다", () => {
    const ctx = context(true);
    const lowerBefore = mapOf(ctx).lowerTiles.slice();
    ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "rect", tile: DECO.body, from: { x: 4, y: 4 }, to: { x: 6, y: 4 } });
    const map = mapOf(ctx);
    expect([4, 5, 6].map((x) => layerTileAt(map, 2, idx(map, x, 4)))).toEqual([DECO.cornerNW, DECO.edgeN, DECO.cornerNE]);
    expect(map.lowerTiles).toEqual(lowerBefore);
  });

  it("fill 모드는 1·2층만 — 2층은 2층 배열에서 번진다, 3층 fill 은 거부", () => {
    const ctx = context();
    const map = mapOf(ctx);
    for (let x = 2; x <= 4; x += 1) setLayerTileAt(map, 2, idx(map, x, 2), 30);
    const filled = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "fill", tile: 31, from: { x: 3, y: 2 } });
    expect(filled.data).toMatchObject({ tilesTouched: 3, effectiveLayer: "2" });
    expect([2, 3, 4].map((x) => layerTileAt(mapOf(ctx), 2, idx(map, x, 2)))).toEqual([31, 31, 31]);
    const upper = runTool(ctx, "paint_tiles", { mapId: MAP_ID, layer: "3", mode: "fill", tile: 31, from: { x: 3, y: 2 } });
    expect(upper.ok).toBe(false);
  });

  it("2·4층은 홈 레이어 라우팅을 받지 않는다(명시 선택 존중)", () => {
    const ctx = context();
    const tileset = ctx.project.tilesets[DEFAULT_TILESET_ID]!;
    // 1/3층 요청에서는 투명 배경 칩이 3층으로 옮겨지는 칩 — 2층을 명시하면 2층에 남는다.
    const upperOnly = [...Array(tileset.count).keys()].find((tile) => tileset.priority[tile] === "upper")!;
    const r = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "cells", tile: upperOnly, cells: [{ x: 2, y: 2 }] });
    expect(r.data).toMatchObject({ effectiveLayer: "2" });
    expect(layerTileAt(mapOf(ctx), 2, idx(mapOf(ctx), 2, 2))).toBe(upperOnly);
  });
});

describe("stamp_layer_block", () => {
  it("여러 층을 한 번에 찍는다 — -1 은 그대로, -2 는 비움, 1층 칸은 2층을 비우되 블록의 2층 값이 이긴다", () => {
    const ctx = context();
    const map = mapOf(ctx);
    setLayerTileAt(map, 2, idx(map, 3, 2), 44); // 1층 찍기로 지워질 2층
    setLayerTileAt(map, 2, idx(map, 4, 2), 45); // 블록 2층 값으로 바뀔 칸
    map.upperTiles[idx(map, 4, 3)] = 99; // -2 로 비울 3층
    const before = map.upperTiles[idx(map, 3, 3)];
    const result = ok(ctx, "stamp_layer_block", {
      mapId: MAP_ID, x: 3, y: 2,
      layers: {
        "1": [[TILE.GRASS, TILE.GRASS]],
        "2": [[-1, 46]],
        "3": [[-1, 120], [-1, -2]],
        "4": [[-1, 121]],
        shadow: [[-1, -1], [5, -1]],
      },
    });
    const after = mapOf(ctx);
    expect(layerTileAt(after, 2, idx(after, 3, 2))).toBe(TILE.EMPTY);
    expect(layerTileAt(after, 2, idx(after, 4, 2))).toBe(46);
    expect(after.upperTiles[idx(after, 4, 2)]).toBe(120);
    expect(after.upperTiles[idx(after, 4, 3)]).toBe(TILE.EMPTY);
    expect(after.upperTiles[idx(after, 3, 3)]).toBe(before);
    expect(layerTileAt(after, 4, idx(after, 4, 2))).toBe(121);
    expect(shadowAt(after, idx(after, 3, 3))).toBe(5);
    expect(result.data).toMatchObject({ cells: { "1": 2, "2": 1, "3": 2, "4": 1, shadow: 1 }, width: 2, height: 2 });
    expect(result.summary).toContain("1층 2칸");
  });

  it("범위 밖 번호나 맵 밖 칸이 하나라도 있으면 아무것도 쓰지 않는다", () => {
    const ctx = context();
    const snapshot = structuredClone(mapOf(ctx));
    const count = ctx.project.tilesets[DEFAULT_TILESET_ID]!.count;
    const outOfRange = runTool(ctx, "stamp_layer_block", { mapId: MAP_ID, x: 1, y: 1, layers: { "1": [[TILE.GRASS]], "3": [[count]] } });
    expect(outOfRange.ok).toBe(false);
    expect(outOfRange.issues?.[0]?.code).toBe("tile-out-of-range");
    const w = mapOf(ctx).width;
    const offMap = runTool(ctx, "stamp_layer_block", { mapId: MAP_ID, x: w - 1, y: 0, layers: { "2": [[20, 20]] } });
    expect(offMap.ok).toBe(false);
    // -1 칸은 쓰기가 아니라 맵 밖이어도 된다.
    ok(ctx, "stamp_layer_block", { mapId: MAP_ID, x: w - 1, y: 0, layers: { "2": [[-1, -1]], "4": [[22, -1]] } });
    expect(layerTileAt(mapOf(ctx), 4, w - 1)).toBe(22);
    const map = mapOf(ctx);
    setLayerTileAt(map, 4, w - 1, -1);
    delete map.upperOverlayTiles;
    expect(map).toEqual(snapshot);
  });

  it("찍은 뒤 1·2층 오토타일 멤버를 그 층 이웃 기준으로 재성형한다", () => {
    const ctx = context(true);
    ok(ctx, "stamp_layer_block", { mapId: MAP_ID, x: 4, y: 4, layers: { "2": [[DECO.body, DECO.body, DECO.body]] } });
    const map = mapOf(ctx);
    expect([4, 5, 6].map((x) => layerTileAt(map, 2, idx(map, x, 4)))).toEqual([DECO.cornerNW, DECO.edgeN, DECO.cornerNE]);
  });
});

describe("paint_shadow", () => {
  it("set·add·clear 와 사분면 이름·비트", () => {
    const ctx = context();
    ok(ctx, "paint_shadow", { mapId: MAP_ID, cells: [{ x: 2, y: 2, quarters: ["tl", "bl"] }, { x: 3, y: 2, bits: 2 }] });
    const map = mapOf(ctx);
    expect(shadowAt(map, idx(map, 2, 2))).toBe(5);
    expect(shadowAt(map, idx(map, 3, 2))).toBe(2);
    ok(ctx, "paint_shadow", { mapId: MAP_ID, mode: "add", cells: [{ x: 3, y: 2, quarters: ["br"] }] });
    expect(shadowAt(mapOf(ctx), idx(map, 3, 2))).toBe(10);
    ok(ctx, "paint_shadow", { mapId: MAP_ID, mode: "clear", cells: [{ x: 3, y: 2, bits: 8 }, { x: 2, y: 2 }] });
    expect(shadowAt(mapOf(ctx), idx(map, 3, 2))).toBe(2);
    expect(shadowAt(mapOf(ctx), idx(map, 2, 2))).toBe(0);
    ok(ctx, "paint_shadow", { mapId: MAP_ID, mode: "clear", cells: [{ x: 3, y: 2 }] });
    expectNoExtraKeys(mapOf(ctx));
  });

  it("맵 밖 칸이 섞이면 아무것도 쓰지 않는다, set 은 quarters/bits 가 필요하다", () => {
    const ctx = context();
    const bad = runTool(ctx, "paint_shadow", { mapId: MAP_ID, cells: [{ x: 1, y: 1, bits: 15 }, { x: -1, y: 0, bits: 1 }] });
    expect(bad.ok).toBe(false);
    expectNoExtraKeys(mapOf(ctx));
    expect(runTool(ctx, "paint_shadow", { mapId: MAP_ID, cells: [{ x: 1, y: 1 }] }).ok).toBe(false);
  });
});

function seedExtras(map: GameMap, x: number, y: number): void {
  setLayerTileAt(map, 2, idx(map, x, y), 20);
  setLayerTileAt(map, 4, idx(map, x, y), 21);
  setShadowAt(map, idx(map, x, y), 3);
  map.upperTiles[idx(map, x, y)] = 22;
}

describe("지우기·복사가 선택 층을 안다", () => {
  it("tile_erase shadow/2 는 그 층만, both·all 은 칸 전체를 비우고 키를 뺀다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 3, 3);
    ok(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 1, h: 1 }, layer: "shadow" });
    let map = mapOf(ctx);
    expect(map.shadowBits).toBeUndefined();
    expect(layerTileAt(map, 2, idx(map, 3, 3))).toBe(20);
    ok(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 1, h: 1 }, layer: "2" });
    map = mapOf(ctx);
    expect(map.lowerOverlayTiles).toBeUndefined();
    expect(layerTileAt(map, 4, idx(map, 3, 3))).toBe(21);
    for (const layer of ["both", "all"] as const) {
      const c = context();
      seedExtras(mapOf(c), 3, 3);
      ok(c, "tile_erase", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 1, h: 1 }, layer });
      const m = mapOf(c);
      expectNoExtraKeys(m);
      expect(m.upperTiles[idx(m, 3, 3)]).toBe(TILE.EMPTY);
    }
  });

  it("clear_region both 는 2·4층·그림자까지 비운다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 3, 3);
    ok(ctx, "clear_region", { mapId: MAP_ID, x: 3, y: 3, w: 1, h: 1 });
    expectNoExtraKeys(mapOf(ctx));
  });

  it("clear_map 은 선택 층까지 비운다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 3, 3);
    ok(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
    expectNoExtraKeys(mapOf(ctx));
  });

  it("mirror_region 은 선택 층을 옮기고 그림자 사분면도 뒤집는다", () => {
    const ctx = context();
    const map = mapOf(ctx);
    seedExtras(map, 2, 2); // shadow 3 = tl|tr
    setShadowAt(map, idx(map, 2, 2), 1); // tl 만
    ok(ctx, "mirror_region", { mapId: MAP_ID, x: 2, y: 2, w: 3, h: 1, axis: "horizontal" });
    const after = mapOf(ctx);
    expect(layerTileAt(after, 2, idx(after, 4, 2))).toBe(20);
    expect(layerTileAt(after, 2, idx(after, 2, 2))).toBe(TILE.EMPTY);
    expect(layerTileAt(after, 4, idx(after, 4, 2))).toBe(21);
    expect(shadowAt(after, idx(after, 4, 2))).toBe(2); // tl → tr
  });

  it("copy_map_region all 은 선택 층까지, lower 는 1·2층만(그림자 제외) 복사한다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 2, 2);
    ok(ctx, "copy_map_region", { from: { mapId: MAP_ID, x: 2, y: 2, w: 1, h: 1 }, to: { mapId: MAP_ID, x: 6, y: 6 } });
    let map = mapOf(ctx);
    expect(layerTileAt(map, 2, idx(map, 6, 6))).toBe(20);
    expect(layerTileAt(map, 4, idx(map, 6, 6))).toBe(21);
    expect(shadowAt(map, idx(map, 6, 6))).toBe(3);
    ok(ctx, "copy_map_region", { from: { mapId: MAP_ID, x: 2, y: 2, w: 1, h: 1 }, to: { mapId: MAP_ID, x: 8, y: 6 }, layers: "lower" });
    map = mapOf(ctx);
    expect(layerTileAt(map, 2, idx(map, 8, 6))).toBe(20);
    expect(layerTileAt(map, 4, idx(map, 8, 6))).toBe(TILE.EMPTY);
    expect(shadowAt(map, idx(map, 8, 6))).toBe(0);
  });

  it("fill_region layer 2 는 2층에 채우고 1층은 그대로, layer 1 은 그 칸 2층을 비운다", () => {
    const ctx = context();
    const lowerBefore = mapOf(ctx).lowerTiles.slice();
    const r = ok(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 3, h: 3 }, material: "모래", layer: "2" });
    const map = mapOf(ctx);
    expect(r.data).toMatchObject({ effectiveLayer: "2" });
    expect(map.lowerTiles).toEqual(lowerBefore);
    expect(layerTileAt(map, 2, idx(map, 6, 5))).toBeGreaterThanOrEqual(0);
    ok(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 3, h: 3 }, material: "모래", layer: "1" });
    expectNoExtraKeys(mapOf(ctx));
  });
});

describe("옛 맵(선택 칸 없음)은 어떤 도구를 거쳐도 새 키가 생기지 않는다", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["paint_tiles", { mapId: MAP_ID, layer: "lower", mode: "rect", tile: TILE.GRASS, from: { x: 1, y: 1 }, to: { x: 3, y: 3 } }],
    ["paint_tiles", { mapId: MAP_ID, layer: "upper", mode: "cells", tile: -1, cells: [{ x: 2, y: 2 }] }],
    ["paint_tiles", { mapId: MAP_ID, layer: "2", mode: "cells", tile: -1, cells: [{ x: 2, y: 2 }] }],
    ["fill_region", { mapId: MAP_ID, rect: { x: 4, y: 4, w: 3, h: 3 }, material: "모래" }],
    ["tile_erase", { mapId: MAP_ID, rect: { x: 4, y: 4, w: 2, h: 2 } }],
    ["tile_erase", { mapId: MAP_ID, rect: { x: 4, y: 4, w: 2, h: 2 }, layer: "shadow" }],
    ["clear_region", { mapId: MAP_ID, x: 1, y: 1, w: 3, h: 3 }],
    ["mirror_region", { mapId: MAP_ID, x: 1, y: 1, w: 4, h: 3, axis: "vertical" }],
    ["copy_map_region", { from: { mapId: MAP_ID, x: 1, y: 1, w: 2, h: 2 }, to: { mapId: MAP_ID, x: 6, y: 6 } }],
    ["paint_shadow", { mapId: MAP_ID, mode: "clear", cells: [{ x: 1, y: 1 }] }],
    ["clear_map", { mapId: MAP_ID, confirmDestroy: true }],
  ];
  it.each(calls)("%s", (name, args) => {
    const ctx = context();
    expectNoExtraKeys(mapOf(ctx));
    ok(ctx, name, args);
    expectNoExtraKeys(mapOf(ctx));
  });
});

describe("새 도구의 게이트 배선", () => {
  it("두 도구는 참고문서 게이트에, stamp_layer_block 은 기존 내용 보호에 들고 영향 상자는 가장 큰 배열이다", () => {
    expect(TILESET_REFERENCE_TILE_CHOOSERS.has("stamp_layer_block")).toBe(true);
    expect(TILESET_REFERENCE_TILE_CHOOSERS.has("paint_shadow")).toBe(true);
    expect(TILE_WRITE_TOOLS.has("stamp_layer_block")).toBe(true);
    // 보호 영역은 실제로 쓰는 칸(≠ -1)만 — 행마다 이어진 가로 줄.
    expect(affectedRegions("stamp_layer_block", { mapId: "m", x: 2, y: 3, layers: { "1": [[1, 1]], "3": [[-1], [-1], [5]] } }))
      .toEqual([{ mapId: "m", x: 2, y: 3, w: 2, h: 1 }, { mapId: "m", x: 2, y: 5, w: 1, h: 1 }]);
    expect(affectedRegions("stamp_layer_block", { mapId: "m", x: 0, y: 0, layers: { "3": [[7, -1, 7, 7]] } }))
      .toEqual([{ mapId: "m", x: 0, y: 0, w: 1, h: 1 }, { mapId: "m", x: 2, y: 0, w: 2, h: 1 }]);
  });
});

describe("고침 1차(리뷰)", () => {
  it("tile_erase 는 \"1\"(=lower)·\"3\"(=upper) 별칭도 받는다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 3, 3);
    ok(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 1, h: 1 }, layer: "3" });
    let map = mapOf(ctx);
    expect(map.upperTiles[idx(map, 3, 3)]).toBe(TILE.EMPTY);
    expect(map.upperOverlayTiles).toBeUndefined();
    expect(layerTileAt(map, 2, idx(map, 3, 3))).toBe(20);
    ok(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 1, h: 1 }, layer: "1" });
    map = mapOf(ctx);
    expect(map.lowerOverlayTiles).toBeUndefined();
    expect(shadowAt(map, idx(map, 3, 3))).toBe(3); // lower 범위는 그림자를 건드리지 않는다
  });

  it("2층 fill 은 (1층, 2층) 쌍으로 번진다 — 빈 2층이라도 시작 칸과 다른 1층을 넘지 않는다", () => {
    const ctx = context();
    const map = mapOf(ctx);
    // 1층: 가운데 3×2 풀밭(240)만 나머지(물 대용 1)와 다르다.
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) map.lowerTiles[idx(map, x, y)] = 1;
    for (let y = 4; y <= 5; y += 1) for (let x = 3; x <= 5; x += 1) map.lowerTiles[idx(map, x, y)] = TILE.GRASS;
    const lowerBefore = map.lowerTiles.slice();
    const r = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "fill", tile: 31, from: { x: 4, y: 4 } });
    expect(r.data).toMatchObject({ tilesTouched: 6, effectiveLayer: "2" });
    const after = mapOf(ctx);
    expect(after.lowerOverlayTiles!.filter((t) => t === 31)).toHaveLength(6);
    expect(layerTileAt(after, 2, idx(after, 2, 4))).toBe(TILE.EMPTY);
    expect(after.lowerTiles).toEqual(lowerBefore);
  });

  it("paint_tiles 3층 -1 은 그 칸 4층도 비운다, 3층 칠하기도 통행 경고를 낸다", () => {
    const ctx = context();
    seedExtras(mapOf(ctx), 3, 3);
    ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "3", mode: "cells", tile: -1, cells: [{ x: 3, y: 3 }] });
    const map = mapOf(ctx);
    expect(map.upperOverlayTiles).toBeUndefined();
    expect(layerTileAt(map, 2, idx(map, 3, 3))).toBe(20);
    // 통행 불가 3층 칩(★ 아님)을 찾아 칠하면 경고가 나온다.
    const tileset = ctx.project.tilesets[DEFAULT_TILESET_ID]!;
    const probe = structuredClone(map);
    const blocking = [...Array(tileset.count).keys()].find((t) => {
      if (tileset.priority[t] !== "upper") return false;
      probe.upperTiles[idx(probe, 6, 6)] = t;
      return !isPassable(ctx.project, probe, 6, 6);
    });
    expect(blocking).toBeDefined();
    const r = ok(ctx, "paint_tiles", { mapId: MAP_ID, layer: "3", mode: "cells", tile: blocking!, cells: [{ x: 6, y: 6 }] });
    expect(r.diff?.warnings.join(" ")).toContain("통행 불가");
  });

  it("stamp_layer_block reshape:false 는 찍은 자동타일 번호를 그대로 둔다", () => {
    const ctx = context(true);
    const r = ok(ctx, "stamp_layer_block", { mapId: MAP_ID, x: 4, y: 4, reshape: false, layers: { "2": [[DECO.body, DECO.body, DECO.body]] } });
    const map = mapOf(ctx);
    expect([4, 5, 6].map((x) => layerTileAt(map, 2, idx(map, x, 4)))).toEqual([DECO.body, DECO.body, DECO.body]);
    expect(r.data).toMatchObject({ reshaped: false });
  });

  it("paint_shadow quarters 는 자기 키만 받는다(프로토타입 키 거부)", () => {
    const ctx = context();
    expect(runTool(ctx, "paint_shadow", { mapId: MAP_ID, cells: [{ x: 1, y: 1, quarters: ["toString"] }] }).ok).toBe(false);
    expectNoExtraKeys(mapOf(ctx));
  });

  it("「1층 칠하기」 규칙을 안내 한 문장이 말하고, 보조 도구는 짧은 안내를 쓴다", () => {
    expect(FOUR_LAYER_GUIDANCE).toContain("1층을 칠하면 그 칸 2층이 지워진다");
    for (const name of ["paint_tiles", "fill_region", "stamp_layer_block"]) expect(getTool(name)!.description, name).toContain(FOUR_LAYER_GUIDANCE);
    for (const name of ["tile_erase", "paint_shadow"]) {
      expect(getTool(name)!.description, name).toContain(FOUR_LAYER_GUIDANCE_SHORT);
      expect(getTool(name)!.description, name).not.toContain(FOUR_LAYER_GUIDANCE);
    }
  });

  it("흙길·마을 길의 1층 쓰기도 그 칸 2층을 지우고, 옛 맵에는 키를 만들지 않는다", () => {
    const ctx = context();
    const map = mapOf(ctx);
    paintRoadRect(map, { x: 1, y: 1, width: 2, height: 1 });
    paintTownPathNetwork(map, [{ x: 1, y: 3, width: 2, height: 1 }]);
    expectNoExtraKeys(map);
    setLayerTileAt(map, 2, idx(map, 5, 1), 20);
    setLayerTileAt(map, 2, idx(map, 5, 3), 21);
    paintRoadRect(map, { x: 5, y: 1, width: 1, height: 1 });
    paintTownPathNetwork(map, [{ x: 5, y: 3, width: 1, height: 1 }]);
    expect(layerTileAt(map, 2, idx(map, 5, 1))).toBe(TILE.EMPTY);
    expect(layerTileAt(map, 2, idx(map, 5, 3))).toBe(TILE.EMPTY);
  });
});
