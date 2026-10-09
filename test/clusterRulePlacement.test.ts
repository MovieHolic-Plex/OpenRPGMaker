import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject, TILE } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { compileTilesetKnowledge } from "@/project/tilesetKnowledge";
import { blockedFlag } from "@/project/tilesetPassage";
import type { GameMap } from "@/project/types";

const CONIFER_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
const BROADLEAF_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}broadleaf-tree-2x2`;

function context(): { readonly ctx: ToolContext; readonly map: GameMap } {
  const ctx: ToolContext = { project: createBlankProject() };
  const map = ctx.project.maps[ctx.project.startMapId];
  if (!map) throw new Error("missing start map");
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(TILE.EMPTY);
  ctx.project.startPos = { x: 0, y: 0 };
  return { ctx, map };
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function expectOk(result: ToolResult): void {
  expect(result.ok, result.summary).toBe(true);
}

function currentMap(ctx: ToolContext, mapId: string): GameMap {
  const map = ctx.project.maps[mapId];
  if (!map) throw new Error(`missing map: ${mapId}`);
  return map;
}

function countConiferPairs(map: GameMap): number {
  let count = 0;
  for (let y = 0; y < map.height - 1; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.upperTiles[at(map, x, y)] === 260 && map.lowerTiles[at(map, x, y + 1)] === 290) count += 1;
    }
  }
  return count;
}

describe("hard cluster rule placement", () => {
  it("paint_tiles가 침엽수 하단(290) 단독 칠하기를 상단(260) 동반 배치로 보정한다", () => {
    const { ctx, map } = context();

    const result = runTool(ctx, "paint_tiles", {
      cells: [{ x: 5, y: 5 }],
      layer: "upper",
      mapId: map.id,
      mode: "cells",
      tile: 290,
    });

    expectOk(result);
    const painted = currentMap(ctx, map.id);
    expect(result.data).toMatchObject({ autoClusterTiles: 1, skippedClusterCells: 0 });
    expect(painted.upperTiles[at(painted, 5, 4)]).toBe(260);
    expect(painted.lowerTiles[at(painted, 5, 5)]).toBe(290);
    expect(painted.upperTiles[at(painted, 5, 5)]).toBe(TILE.EMPTY);
  });

  it("paint_tiles가 y=0에서 침엽수 하단(290) 배치를 거부해 반쪽 타일을 남기지 않는다", () => {
    const { ctx, map } = context();

    const result = runTool(ctx, "paint_tiles", {
      cells: [{ x: 5, y: 0 }],
      layer: "upper",
      mapId: map.id,
      mode: "cells",
      tile: 290,
    });

    expectOk(result);
    const painted = currentMap(ctx, map.id);
    expect(result.summary).toContain("거부");
    expect(painted.upperTiles[at(painted, 5, 0)]).toBe(TILE.EMPTY);
  });

  // 2026-07-08 회귀: 동반 타일이 이웃 칸의 "기존" 상위 오브젝트를 조용히 덮어쓰던 버그.
  it("동반 타일 위치의 상위 레이어에 다른 오브젝트가 있으면 배치를 거부한다", () => {
    const { ctx, map } = context();
    // 침엽수 상단(260) 자리에 이미 다른 오브젝트 — 나무 상자 237. (예전 픽스처는 활엽수 반쪽 263 이었는데,
    // 2026-09-18 부터 post-write 보정이 짝 없는 활엽수 반쪽을 걷어내므로 나무 계열이 아닌 소품으로 바꿨다.)
    map.upperTiles[at(map, 5, 4)] = 237;

    const result = runTool(ctx, "paint_tiles", {
      cells: [{ x: 5, y: 5 }],
      layer: "upper",
      mapId: map.id,
      mode: "cells",
      tile: 290,
    });

    expectOk(result);
    const painted = currentMap(ctx, map.id);
    expect(result.summary).toContain("거부");
    expect(painted.upperTiles[at(painted, 5, 4)]).toBe(237); // 기존 오브젝트 보존
    expect(painted.upperTiles[at(painted, 5, 5)]).toBe(TILE.EMPTY);
  });

  it("동반 타일 위치에 같은 타일이 이미 있으면 재배치를 허용한다(멱등)", () => {
    const { ctx, map } = context();
    map.upperTiles[at(map, 5, 4)] = 260;

    const result = runTool(ctx, "paint_tiles", {
      cells: [{ x: 5, y: 5 }],
      layer: "upper",
      mapId: map.id,
      mode: "cells",
      tile: 290,
    });

    expectOk(result);
    const painted = currentMap(ctx, map.id);
    expect(painted.upperTiles[at(painted, 5, 4)]).toBe(260);
    expect(painted.lowerTiles[at(painted, 5, 5)]).toBe(290);
    expect(painted.upperTiles[at(painted, 5, 5)]).toBe(TILE.EMPTY);
  });

  it("paint_tiles가 활엽수 하단 좌측(292)에서 2x2 전체를 원자 배치한다", () => {
    const { ctx, map } = context();

    const result = runTool(ctx, "paint_tiles", {
      cells: [{ x: 4, y: 4 }],
      layer: "upper",
      mapId: map.id,
      mode: "cells",
      tile: 292,
    });

    expectOk(result);
    const painted = currentMap(ctx, map.id);
    expect(painted.upperTiles[at(painted, 4, 3)]).toBe(262);
    expect(painted.upperTiles[at(painted, 5, 3)]).toBe(263);
    expect(painted.lowerTiles[at(painted, 4, 4)]).toBe(292);
    expect(painted.lowerTiles[at(painted, 5, 4)]).toBe(293);
    expect(painted.upperTiles[at(painted, 4, 4)]).toBe(TILE.EMPTY);
    expect(painted.upperTiles[at(painted, 5, 4)]).toBe(TILE.EMPTY);
  });

  it("scatter_object가 침엽수를 1x2 원자 풋프린트로 배치하고 summary에 동반 타일을 표시한다", () => {
    const { ctx, map } = context();

    const result = runTool(ctx, "scatter_object", {
      area: { x: 2, y: 2, w: 6, h: 6 },
      avoidProtected: false,
      count: 3,
      groupId: CONIFER_GROUP_ID,
      mapId: map.id,
      maxGap: 4,
      minGap: 0,
    });

    expectOk(result);
    const scattered = currentMap(ctx, map.id);
    expect(result.summary).toContain("클러스터 동반");
    expect(countConiferPairs(scattered)).toBe(3);
  });

  it("scatter_object가 활엽수를 source_rect 기반 2x2 원자 풋프린트로 배치한다", () => {
    const { ctx, map } = context();

    const result = runTool(ctx, "scatter_object", {
      area: { x: 3, y: 3, w: 2, h: 2 },
      avoidProtected: false,
      count: 1,
      groupId: BROADLEAF_GROUP_ID,
      mapId: map.id,
      maxGap: 0,
      minGap: 0,
    });

    expectOk(result);
    const scattered = currentMap(ctx, map.id);
    expect(result.summary).toContain("4타일");
    expect(scattered.upperTiles[at(scattered, 3, 3)]).toBe(262);
    expect(scattered.upperTiles[at(scattered, 4, 3)]).toBe(263);
    expect(scattered.lowerTiles[at(scattered, 3, 4)]).toBe(292);
    expect(scattered.lowerTiles[at(scattered, 4, 4)]).toBe(293);
    expect(scattered.upperTiles[at(scattered, 3, 4)]).toBe(TILE.EMPTY);
    expect(scattered.upperTiles[at(scattered, 4, 4)]).toBe(TILE.EMPTY);
  });

  it("scatter_object가 9x9 물 아틀라스를 81칸 원자 풋프린트로 배치한다", () => {
    // Given
    const { ctx, map } = context();
    const tileset = ctx.project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const tileIds = Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 9 }, (_cell, column) => (row * tileset.tilesPerRow) + column),
    ).flat();
    const compiled = compileTilesetKnowledge({
      groupId: "ai-water-atlas",
      name: "AI 물 아틀라스",
      passage: blockedFlag(),
      template: "water-atlas-9x9",
      tileCount: tileset.count,
      tileIds,
      tilesPerRow: tileset.tilesPerRow,
    });
    if (compiled.kind !== "valid") throw new Error("water atlas did not compile");
    tileset.tileGroups = [...(tileset.tileGroups ?? []), compiled.value.group];

    // When
    const result = runTool(ctx, "scatter_object", {
      area: { x: 2, y: 2, w: 9, h: 9 },
      avoidProtected: false,
      count: 1,
      groupId: "ai-water-atlas",
      mapId: map.id,
      maxGap: 0,
      minGap: 0,
    });

    // Then
    expectOk(result);
    const scattered = currentMap(ctx, map.id);
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        expect(scattered.lowerTiles[at(scattered, 2 + column, 2 + row)]).toBe(tileIds[(row * 9) + column]);
      }
    }
  });
});
