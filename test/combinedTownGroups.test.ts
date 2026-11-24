import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject, TILE } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX, COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness/combinedTownGroups";
import { compileTilesetKnowledge } from "@/project/tilesetKnowledge";
import { blockedFlag } from "@/project/tilesetPassage";
import type { GameMap } from "@/project/types";
import { startOnRetiredCombinedTown, RETIRED_COMBINED_TOWN_TILESET_ID, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { applyCombinedTownHarness } from "@/project/tilesetHarness/combinedTown";
import { TERRAIN_TAG } from "@/project/defaults/chipsetMapping";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";
import { isPassable } from "@/project/collision";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { bagMaterialRejectMessage, isBagGroup, isBagGroupId, isBagMaterialQuery } from "@/project/materialPolicy";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { formatMaterialLabelHint } from "@/editor/regionTask/runRegionTask";
import { isolateTimers } from "./mergedTeardown";

describe("clusterRulePlacement", () => {
  isolateTimers();
  const CONIFER_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
  const BROADLEAF_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}broadleaf-tree-2x2`;
  function context(): { readonly ctx: ToolContext; readonly map: GameMap } {
    const ctx: ToolContext = { project: startOnRetiredCombinedTown(createBlankProject()) };
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
});

describe("combinedTownTerrainTag", () => {
  isolateTimers();
  /** terrain 배열을 오염시킨 뒤 하네스를 다시 적용해, 실제로 재기록된 값을 본다. */
  function reappliedTerrain(): readonly number[] {
    const tileset = defaultTileset();
    tileset.terrain = tileset.terrain.map(() => 99);
    applyCombinedTownHarness(tileset);
    return tileset.terrain;
  }
  function groupById(fragment: string) {
    const group = COMBINED_TOWN_HARNESS_GROUPS.find((g) => g.id.includes(fragment));
    if (!group) throw new Error(`기대한 하네스 그룹 없음: ${fragment}`);
    return group;
  }
  describe("combinedTown terrainTag (특성화)", () => {
    it("하네스 그룹 목록은 비어 있지 않다", () => {
      // 아래 순회 테스트가 공집합을 돌며 통과하는 상황을 막는다.
      expect(COMBINED_TOWN_HARNESS_GROUPS.length).toBeGreaterThan(0);
      expect(COMBINED_TOWN_HARNESS_GROUPS.some((g) => g.role === "water")).toBe(true);
    });

    it("water 역할 그룹만 water 태그를 요구한다", () => {
      const tileset = defaultTileset();
      for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
        const wantsWater = roleCapabilities(tileset, group.role).terrainTag === "water";
        expect(wantsWater, `그룹 ${group.id}`).toBe(group.role === "water");
      }
    });

    it("흙길 그룹은 role 이 terrain 이라 태그를 id 로 판정한다", () => {
      const road = COMBINED_TOWN_HARNESS_GROUPS.find((g) => g.id.includes("dirt-road"));
      expect(road).toBeDefined();
      expect(road!.role).toBe("terrain");
    });

    // 위 두 테스트는 terrainTagForGroup 을 부르지 않는다. 아래가 실제 기록값을 본다.
    // 한계: 기본 타일셋에서는 칩셋 폴백이 이미 강제값과 같아(물 1, 흙길 0) **분기 삭제**는
    // 관측되지 않는다. 이 테스트가 잡는 것은 강제값 자체가 틀어지는 변이다.
    it("물 그룹 타일은 WATER, 흙길 타일은 NORMAL 지형 태그를 받는다", () => {
      const terrain = reappliedTerrain();
      for (const tile of groupById("lake-water").tileIds) {
        expect(terrain[tile], `물 타일 ${tile}`).toBe(TERRAIN_TAG.WATER);
      }
      for (const tile of groupById("dirt-road").tileIds) {
        expect(terrain[tile], `흙길 타일 ${tile}`).toBe(TERRAIN_TAG.NORMAL);
      }
    });
  });
});

// fill_region 이 「채우기」만 하고 남의 것을 지우지 않는다는 계약 — 2026-09-03 적대적 리뷰(07·06·03·08) 재현.
//   (1) lower 채움은 상위 레이어 소품을 지우지 않는다(clearUpper 를 명시해야 지운다)
//   (2) 벽·지붕·건물 구조 타일 칸은 건너뛰고 경고한다
//   (3) 통행 불가 재료(물)는 이벤트 칸을 건너뛰고, 시작 위치에서 나가는 통로를 남긴다
//   (4) 「벽 틈 메움」으로 요청 rect 밖 칸이 늘어나면 요약에 그 수를 밝힌다
describe("fillRegionPreservesContent", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  const CONIFER_TOP = 260;
  const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;
  function context(): ToolContext {
    // 재료 이름(모래·물)·벽 9분할 그룹·TILE.* 는 합본 마을 칩셋 기준이다 — 2026-10-07 정리 뒤 기본이 beodeul_city 라
    // 옛 저장본처럼 시작 맵을 합본 마을에 둔다.
    return { project: startOnRetiredCombinedTown(createBlankProject()) };
  }
  function lowerAt(ctx: ToolContext, x: number, y: number): number {
    const map = ctx.project.maps[MAP_ID];
    return map.lowerTiles[y * map.width + x];
  }
  function upperAt(ctx: ToolContext, x: number, y: number): number {
    const map = ctx.project.maps[MAP_ID];
    return map.upperTiles[y * map.width + x];
  }
  function wallTile(ctx: ToolContext): number {
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((entry) => entry.id === WALL_GROUP_ID);
    if (!group) throw new Error("벽 그룹 없음");
    return group.tileIds[Math.floor(group.tileIds.length / 2)];
  }
  describe("fill_region — 남의 것을 지우지 않는다", () => {
    it("lower 채움은 상위 레이어 소품(나무)을 그대로 둔다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.upperTiles[5 * map.width + 6] = CONIFER_TOP;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "모래" });
      expect(result.ok, result.summary).toBe(true);
      expect(upperAt(ctx, 6, 5)).toBe(CONIFER_TOP);
      expect(lowerAt(ctx, 6, 5)).not.toBe(TILE.GRASS);
    });

    it("clearUpper:true 를 명시하면 상위를 비우고 요약에 그 수를 적는다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.upperTiles[5 * map.width + 6] = CONIFER_TOP;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "모래", clearUpper: true });
      expect(result.ok, result.summary).toBe(true);
      expect(upperAt(ctx, 6, 5)).toBe(TILE.EMPTY);
      expect(result.summary).toContain("상위 1칸 비움");
    });

    it("통행 불가 재료(물)는 기본으로 상위 소품을 비운다 — 물 위 소품은 배치 검증 error", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.upperTiles[5 * map.width + 6] = CONIFER_TOP;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "물" });
      expect(result.ok, result.summary).toBe(true);
      expect(upperAt(ctx, 6, 5)).toBe(TILE.EMPTY);
      expect(result.summary).toContain("상위 1칸 비움");
    });

    it("물이라도 clearUpper:false 를 명시하면 상위 소품을 남긴다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.upperTiles[5 * map.width + 6] = CONIFER_TOP;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "물", clearUpper: false });
      expect(result.ok, result.summary).toBe(true);
      expect(upperAt(ctx, 6, 5)).toBe(CONIFER_TOP);
    });

    it("벽·건물 구조 타일 칸은 건너뛰고 「구조물」 경고를 남긴다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      const wall = wallTile(ctx);
      map.lowerTiles[6 * map.width + 7] = wall;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 5, h: 4 }, material: "모래" });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, 7, 6)).toBe(wall);
      expect(lowerAt(ctx, 5, 4)).not.toBe(TILE.GRASS);
      expect((result.diff?.warnings ?? []).join("\n")).toContain("구조물");
    });

    it("통행 불가 재료(물)는 이벤트 칸을 건너뛰고 경고한다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.events.push({ id: "ev_npc", x: 6, y: 5, trigger: { kind: "action" }, commands: [], pages: [] });
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "물" });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, 6, 5)).toBe(TILE.GRASS);
      expect(lowerAt(ctx, 5, 4)).not.toBe(TILE.GRASS);
      expect((result.diff?.warnings ?? []).join("\n")).toMatch(/\(6,5\).*이벤트/u);
    });

    it("통행 가능 재료(모래)는 이벤트 칸도 채운다 — 과보호하지 않는다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.events.push({ id: "ev_npc", x: 6, y: 5, trigger: { kind: "action" }, commands: [], pages: [] });
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 4, h: 3 }, material: "모래" });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, 6, 5)).not.toBe(TILE.GRASS);
    });

    it("시작 위치 주변을 물로 채우면 밖으로 나가는 통로를 남기고 경고한다", () => {
      const ctx = context();
      const start = ctx.project.startPos;
      expect(start).toEqual({ x: 10, y: 8 });
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 8, y: 6, w: 5, h: 5 }, material: "물" });
      expect(result.ok, result.summary).toBe(true);
      const project = ctx.project;
      const map = project.maps[MAP_ID];
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: start.x + dx, y: start.y + dy }));
      const openNeighbours = neighbours.filter((cell) => isPassable(project, map, cell.x, cell.y));
      expect(openNeighbours.length, "시작 위치 이웃 중 통행 가능 칸").toBeGreaterThan(0);
      // 통로는 rect 가장자리까지 이어져야 한다 — 이웃 한 칸만 비우면 한 걸음 뒤에 다시 막힌다.
      const exit = openNeighbours[0];
      const dx = Math.sign(exit.x - start.x);
      const dy = Math.sign(exit.y - start.y);
      for (let step = 1; step <= 2; step += 1) {
        const cell = { x: start.x + dx * step, y: start.y + dy * step };
        expect(isPassable(project, map, cell.x, cell.y), `통로 ${step}칸째 (${cell.x},${cell.y})`).toBe(true);
      }
      expect((result.diff?.warnings ?? []).join("\n")).toContain("통로");
    });

    it("시작 위치 옆 이벤트 칸은 출구로 치지 않는다 — 다른 방향으로 통로를 낸다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      const start = ctx.project.startPos;
      map.events.push({ id: "ev_sign", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [], pages: [] });
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 8, y: 6, w: 5, h: 5 }, material: "물" });
      expect(result.ok, result.summary).toBe(true);
      const project = ctx.project;
      const after = project.maps[MAP_ID];
      expect(lowerAt(ctx, start.x, start.y - 1), "간판 칸은 이벤트 보호로 물이 아니다").toBe(TILE.GRASS);
      const openWithoutEvent = [[1, 0], [-1, 0], [0, 1]].filter(([dx, dy]) => isPassable(project, after, start.x + dx, start.y + dy));
      expect(openWithoutEvent.length, "간판이 아닌 쪽으로 열린 이웃").toBeGreaterThan(0);
      expect((result.diff?.warnings ?? []).join("\n")).toContain("통로");
    });

    it("벽 틈 메움으로 요청 rect 밖 칸이 늘면 요약에 그 수를 밝힌다", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      // 혼자 선 한 칸은 벽으로 치지 않는다(wallFlush e0be8616a2) — 이어진 벽 줄(12,4~6)을 세운다. 틈은 rect 오른쪽 세 줄(11,4~6).
      for (const y of [4, 5, 6]) map.lowerTiles[y * map.width + 12] = wallTile(ctx);
      expect(isPassable(ctx.project, map, 12, 5)).toBe(false);
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 6, h: 3 }, material: "모래" });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, 11, 5), "틈 칸 (11,5)").not.toBe(TILE.GRASS);
      expect(result.summary).toContain("벽 틈 메움 3칸");
    });
  });
});

describe("materialPolicy", () => {
  isolateTimers();
  const BAG_ID = `${COMBINED_TOWN_HARNESS_PREFIX}small-props`;
  describe("materialPolicy bag demotion", () => {
    it("detects bag group ids and labels", () => {
      expect(isBagGroupId(BAG_ID)).toBe(true);
      expect(isBagGroupId("small-props")).toBe(true);
      expect(isBagGroupId(`${COMBINED_TOWN_HARNESS_PREFIX}wood-box`)).toBe(false);
      expect(isBagMaterialQuery("마을 소품")).toBe(true);
      expect(isBagMaterialQuery("small-props")).toBe(true);
      expect(isBagMaterialQuery("나무 상자")).toBe(false);
      expect(isBagGroup({ id: BAG_ID, name: "마을 소품", description: "잔여 소품 가방" })).toBe(true);
      expect(bagMaterialRejectMessage("마을 소품")).toMatch(/가방|구체 라벨/);
    });

    it("resolveMaterialByLabel rejects bag labels and group ids", () => {
      // The labels below are combined-town harness groups; that sheet left createBlankProject() in the 2026-10-07 copyright purge.
      const ts = retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID);
      expect(resolveMaterialByLabel(ts, "마을 소품").status).toBe("missing");
      expect(resolveMaterialByLabel(ts, BAG_ID).status).toBe("missing");
      const ok = resolveMaterialByLabel(ts, "나무 상자");
      expect(ok.status === "approved" || ok.status === "soft").toBe(true);
    });

    it("place_props rejects bag material", () => {
      const ctx = { project: createBlankProject() };
      const mapId = "map_bag";
      expect(runTool(ctx, "create_map", { id: mapId, name: "bag", width: 16, height: 12 }).ok).toBe(true);
      ctx.project.maps[mapId].lowerTiles.fill(TILE.GRASS);
      ctx.project.maps[mapId].upperTiles.fill(TILE.EMPTY);
      const result = runTool(ctx, "place_props", {
        mapId,
        area: { x: 2, y: 2, w: 8, h: 6 },
        material: "마을 소품",
        count: 3,
        seed: 1,
      });
      expect(result.ok).toBe(false);
      expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toMatch(/가방|구체 라벨|small-props|마을 소품/);
    });

    it("formatMaterialLabelHint omits bag group name from examples", () => {
      const project = createBlankProject();
      const tileset = Object.values(project.tilesets)[0]!;
      const hint = formatMaterialLabelHint(tileset);
      expect(hint).not.toContain("마을 소품");
      expect(hint).not.toContain("small-props");
      expect(hint).toMatch(/침엽수|나무 상자|그룹 id 금지|가방/);
    });
  });
});
