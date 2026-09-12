// 보고서 렌더러가 에디터와 같은 규칙으로 그리는지 잠근다.
// Interior 430-series ceilings are stored variants; only dark-wall 366 uses interior quarters.
import fs from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { isCeilingTile } from "@/editor/interiorHouseWallGrammar";
import { INTERIOR_ROOM_TILESET_ID, VR } from "@/editor/interiorRoomPipeline";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DARK_WALL_QUARTER_SOURCE as Q, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import type { GameMap } from "@/project/types";
import { INTERIOR_CHIPSET_PNG, lowerCellDrawPlan, renderInteriorMapPng } from "../scripts/lib/renderInteriorMapPng.mts";

const sheet = PNG.sync.read(fs.readFileSync(INTERIOR_CHIPSET_PNG));
const background = [20, 18, 24] as const;

// Independent pixel oracle: sample the shipped atlas, not the renderer's draw plan.
function expectCellPixels(png: PNG, x: number, y: number, source: (px: number, py: number) => number, underlay?: number): void {
  for (let py = 0; py < 16; py += 1) {
    for (let px = 0; px < 16; px += 1) {
      const expected: number[] = [...background];
      for (const tile of [...(underlay === undefined ? [] : [underlay]), source(px, py)]) {
        const si = ((Math.floor(tile / 30) * 16 + py) * sheet.width + (tile % 30) * 16 + px) * 4;
        const alpha = sheet.data[si + 3]! / 255;
        for (let c = 0; c < 3; c += 1) expected[c] = Math.round(sheet.data[si + c]! * alpha + expected[c]! * (1 - alpha));
      }
      const di = ((y * 16 + py) * png.width + x * 16 + px) * 4;
      expect([...png.data.subarray(di, di + 4)]).toEqual([...expected, 255]);
    }
  }
}

function buildDefaultInn(): { map: GameMap; context: ToolContext } {
  const context: ToolContext = { project: createBlankProject() };
  const result = runTool(context, "place_concept", { template: true, query: "여관", mapId: "map_inn_render", seed: 7 }, { dryRun: false });
  if (!result.ok) throw new Error(result.summary);
  return { map: context.project.maps.map_inn_render!, context };
}

describe("place_concept 보고서 렌더러", () => {
  it("저장 성형된 천장 가장자리와 나무 바닥은 원시 실내 시트 픽셀을 보존한다", () => {
    const { map, context } = buildDefaultInn();
    const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const png = renderInteriorMapPng(map, tileset, { scale: 1, background });
    let ceilingBorderCells = 0;
    let rawFloor = 0;
    let renderedCeilings = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.lowerTiles[y * map.width + x]!;
        const plan = lowerCellDrawPlan(map, tileset, x, y);
        if (tile === VR.FLOOR) {
          expect(plan).toEqual({ kind: "raw", tile });
          if (map.upperTiles[y * map.width + x]! < 0) expectCellPixels(png, x, y, () => tile);
          rawFloor += 1;
          continue;
        }
        if (!isCeilingTile(tile)) continue;
        // Border coverage remains geometric; no fixture-specific count is the oracle.
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
        const border = neighbors.some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
          return !isCeilingTile(map.lowerTiles[ny * map.width + nx]!);
        });
        if (!border) continue;
        ceilingBorderCells += 1;
        expect(plan).toEqual({ kind: "raw", tile });
        if (map.upperTiles[y * map.width + x]! < 0) {
          expectCellPixels(png, x, y, () => tile);
          renderedCeilings += 1;
        }
      }
    }
    expect(rawFloor).toBeGreaterThan(0);
    expect(ceilingBorderCells).toBeGreaterThan(0);
    expect(renderedCeilings).toBeGreaterThan(0);
  });

  it("366 암벽은 네 모서리 쿼터와 받침을 실제 PNG에 합성한다", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const map: GameMap = {
      ...project.maps[project.startMapId]!, tilesetId: INTERIOR_ROOM_TILESET_ID,
      width: 3, height: 3,
      lowerTiles: [72, 72, 72, 72, DARK_WALL_TILE.BODY, 72, 72, 72, 72],
      upperTiles: new Array(9).fill(-1), events: [],
    };
    expect(lowerCellDrawPlan(map, tileset, 1, 1)).toEqual({
      kind: "quarters", underlayTile: Q.center,
      sources: [
        { tile: Q.cornerNW, offsetX: 0, offsetY: 0 },
        { tile: Q.cornerNE, offsetX: 8, offsetY: 0 },
        { tile: Q.cornerSW, offsetX: 0, offsetY: 8 },
        { tile: Q.cornerSE, offsetX: 8, offsetY: 8 },
      ],
    });
    const png = renderInteriorMapPng(map, tileset, { scale: 1, background });
    expectCellPixels(png, 1, 1, (x, y) => y < 8
      ? (x < 8 ? Q.cornerNW : Q.cornerNE)
      : (x < 8 ? Q.cornerSW : Q.cornerSE), Q.center);
  });

  it("PNG 크기는 타일 16px × 배율을 따른다", () => {
    const { map, context } = buildDefaultInn();
    const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const png = renderInteriorMapPng(map, tileset, { scale: 2 });
    expect(png.width).toBe(map.width * 32);
    expect(png.height).toBe(map.height * 32);
  });
});
