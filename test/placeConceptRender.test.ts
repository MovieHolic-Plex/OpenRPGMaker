// 보고서 렌더러가 에디터와 같은 규칙으로 그리는지 잠근다.
// 깨지는 지점: 천장(430 계열)·벽 프레임 셀을 원시 시트 셀로 그리면 풀밭 조각이 찍힌다(2026-09-02 verdict.png).
import { describe, expect, it } from "vitest";
import { isCeilingTile } from "@/editor/interiorHouseWallGrammar";
import { INTERIOR_ROOM_TILESET_ID, VR } from "@/editor/interiorRoomPipeline";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { GameMap } from "@/project/types";
import { lowerCellDrawPlan, renderInteriorMapPng } from "../scripts/lib/renderInteriorMapPng.mts";

function buildDefaultInn(): { map: GameMap; context: ToolContext } {
  const context: ToolContext = { project: createBlankProject() };
  const result = runTool(context, "place_concept", { query: "여관", mapId: "map_inn_render", seed: 7 }, { dryRun: false });
  if (!result.ok) throw new Error(result.summary);
  return { map: context.project.maps.map_inn_render!, context };
}

describe("place_concept 보고서 렌더러", () => {
  it("바닥에 붙은 천장 셀은 쿼터 합성으로 그리고, 나무 바닥은 원시 셀로 그린다", () => {
    const { map, context } = buildDefaultInn();
    const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    let composed = 0;
    let ceilingBorderCells = 0;
    let rawFloor = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.lowerTiles[y * map.width + x]!;
        const plan = lowerCellDrawPlan(map, tileset, x, y);
        if (tile === VR.FLOOR) {
          expect(plan.kind).toBe("raw");
          rawFloor += 1;
          continue;
        }
        if (!isCeilingTile(tile)) continue;
        // 천장 가장자리 = 4방 중 하나가 천장이 아닌 셀. 에디터는 이 셀을 쿼터로 성형한다.
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
        const border = neighbors.some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
          return !isCeilingTile(map.lowerTiles[ny * map.width + nx]!);
        });
        if (!border) continue;
        ceilingBorderCells += 1;
        if (plan.kind === "quarters") composed += 1;
      }
    }
    expect(rawFloor).toBeGreaterThan(0);
    expect(ceilingBorderCells).toBeGreaterThan(0);
    expect(composed, "천장 가장자리 셀이 원시 셀로 그려졌다").toBe(ceilingBorderCells);
  });

  it("PNG 크기는 타일 16px × 배율을 따른다", () => {
    const { map, context } = buildDefaultInn();
    const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const png = renderInteriorMapPng(map, tileset, { scale: 2 });
    expect(png.width).toBe(map.width * 32);
    expect(png.height).toBe(map.height * 32);
  });
});
