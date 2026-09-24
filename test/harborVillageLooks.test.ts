// 2026-09-24 등대지기 도그푸딩: 64×40 설원 항구 마을의 시각 검수 지적을 LLM 없이 재현한다.
// author_village(항구 테마 → 서쪽 물 띠 + 동쪽 숲 띠, morphology street) 결과 맵을 칸 단위로 판정한다.
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { FOREST_GROVE_GROUP } from "@/project/defaults/forestGrove";
import type { GameMap, Project } from "@/project/types";

const THEME = "눈보라가 그치지 않는 눈 덮인 항구 마을. 상점·여관·등대지기 집, 부두와 등대";

function harborVillage(seed: number): { readonly project: Project; readonly map: GameMap } {
  const context: ToolContext = { project: createEmptyToolProject("항구 마을 검수") };
  const result = runTool(context, "author_village", {
    target: { kind: "new", mapId: "m", name: "성에항", width: 64, height: 40, tilesetId: "forest_harmony_snow" },
    houseCount: 6, countPolicy: "exact", seed, morphology: "street", forestDensity: "normal",
    groundTheme: "snow", theme: THEME, npcCount: 0, interior: false,
  });
  expect(result.ok, result.summary).toBe(true);
  return { project: context.project, map: context.project.maps.m! };
}

const villages = [1, 2, 3].map(seed => ({ seed, ...harborVillage(seed) }));

/** 4-connected canopy components of at least `min` cells, with the share of their bounding box they fill. */
function canopyBlocks(project: Project, map: GameMap, min = 40): { cells: number; fill: number; at: string }[] {
  const group = project.tilesets[map.tilesetId]?.autotileGroups?.find(g => g.id === FOREST_GROVE_GROUP);
  const canopy = new Set(group?.memberTileIds ?? []);
  const W = map.width;
  const cells = new Set(map.upperTiles.flatMap((tile, index) => canopy.has(tile) ? [index] : []));
  const seen = new Set<number>();
  const blocks: { cells: number; fill: number; at: string }[] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const component = [start];
    seen.add(start);
    for (let i = 0; i < component.length; i++) {
      const x = component[i]! % W, y = Math.floor(component[i]! / W);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const next = ny * W + nx;
        if (nx >= 0 && nx < W && ny >= 0 && ny < map.height && cells.has(next) && !seen.has(next)) { seen.add(next); component.push(next); }
      }
    }
    if (component.length < min) continue;
    const xs = component.map(i => i % W), ys = component.map(i => Math.floor(i / W));
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
    blocks.push({ cells: component.length, fill: component.length / (w * h), at: `${Math.min(...xs)},${Math.min(...ys)} ${w}×${h}` });
  }
  return blocks;
}

describe("harbor village exterior looks", () => {
  it("never paints a forest mass as a solid straight-edged rectangle", () => {
    // Before: the east forest band (x 59..63) and the forest beside fields were 100%-filled rectangles of the
    // flat dark canopy tile, which the visual reviewer read as unpainted black voids.
    for (const { seed, project, map } of villages) {
      const blocks = canopyBlocks(project, map);
      expect(blocks.length, `seed ${seed}: forest present`).toBeGreaterThan(0);
      for (const block of blocks) expect(block.fill, `seed ${seed} canopy ${block.at}`).toBeLessThan(0.9);
    }
  });
});
