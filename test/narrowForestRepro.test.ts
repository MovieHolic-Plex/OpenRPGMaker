import { describe, expect, it } from "vitest";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { passableCellCount } from "@/editor/tools/mapHelpers";
import { forestCoverageTarget } from "@/editor/tools/forestDensity";
import { createBlankProject } from "@/project/defaults";
import { isTreeTrunkTileId } from "@/project/tilesetHarness";
import { runTool } from "@/editor/tools/toolRunner";
import type { GameMap } from "@/project/types";

const props = CONSTRUCTION_TOOLS_V3.find((entry) => entry.name === "place_props")!;

function narrowForest() {
  const context = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: "map_n", name: "좁은 숲", width: 20, height: 15 }).ok).toBe(true);
  const result = props.run(context.project, {
    mapId: "map_n",
    area: { x: 0, y: 0, w: 5, h: 15 },
    material: "침엽수",
    density: "dense",
    seed: 11,
  });
  return { project: context.project, map: context.project.maps.map_n! as GameMap, result };
}

describe("narrow dense forest", () => {
  it("5x15 영역에서도 dense 커버리지·통행 계약을 지킨다", () => {
    const { project, map } = narrowForest();
    let covered = 0;
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const i = y * map.width + x;
        const u = map.upperTiles[i] ?? -1;
        const l = map.lowerTiles[i] ?? -1;
        // 밑동(290/292/293)은 lower 정위치 — upper 점유만 세면 나무 칸을 놓친다.
        if (u >= 0 || isTreeTrunkTileId(l)) covered += 1;
      }
    }
    expect(covered / 75).toBeGreaterThanOrEqual(forestCoverageTarget("dense") - 0.05);
    const inner = { x: 1, y: 1, w: 3, h: 13 };
    expect(passableCellCount(project, map, inner) / (inner.w * inner.h)).toBeLessThan(0.3);
  });

  it("가장자리는 속보다 덤불이 듬성듬성하다", () => {
    const { map } = narrowForest();
    const isBush = (x: number, y: number): boolean => (map.upperTiles[y * map.width + x] ?? -1) === 289;
    let edgeBush = 0;
    let edgeCells = 0;
    let innerBush = 0;
    let innerCells = 0;
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const onEdge = x === 0 || x === 4 || y === 0 || y === 14;
        if (onEdge) {
          edgeCells += 1;
          if (isBush(x, y)) edgeBush += 1;
        } else {
          innerCells += 1;
          if (isBush(x, y)) innerBush += 1;
        }
      }
    }
    expect(edgeBush / edgeCells).toBeLessThan(innerBush / innerCells);
  });
});
