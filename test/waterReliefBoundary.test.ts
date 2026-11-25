// 지형 리뷰 F4·F5: 물이 단 경계를 넘어 깔려 절벽 띠가 연못을 가로지르고, 강 붓이 고원을 벽 없이 갈랐다.
import { beforeEach, describe, expect, it } from "vitest";
import { runHeadlessToolWithProject } from "@/headless";
import { paintTerrainBrush } from "@/editor/terrainBrush";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

function halfPlateau(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const levels = new Array<number>(map.width * map.height).fill(0);
  for (let y = 0; y < 6; y++) for (let x = 0; x < map.width; x++) levels[y * map.width + x] = 2;
  map.relief = { width: map.width, height: map.height, levels };
  return { project, mapId: map.id };
}

describe("물과 높이 경계", () => {
  beforeEach(() => store.replace(createBlankProject()));

  it("fill_region 물은 가장 낮은 단 칸에만 깔고 넘친 칸 수를 경고한다", () => {
    const { project, mapId } = halfPlateau();
    const { result, project: next } = runHeadlessToolWithProject(project, "fill_region", { mapId, rect: { x: 2, y: 4, w: 6, h: 4 }, material: "버들항 물" }, { assistantRun: true });
    expect(result.ok).toBe(true);
    const map = next.maps[mapId]!, before = project.maps[mapId]!;
    for (let y = 4; y < 6; y++) for (let x = 2; x < 8; x++) expect(map.lowerTiles[y * map.width + x]).toBe(before.lowerTiles[y * map.width + x]);
    expect(map.relief!.levels[4 * map.width + 2]).toBe(2);
    expect(JSON.stringify(result.warnings ?? result.diff?.warnings ?? [])).toContain("높이가 다른 12칸");
  });

  it("강 붓은 첫 칸과 다른 높이의 땅을 깎지 않고 건너뛴 칸 수를 돌려준다", () => {
    const { project, mapId } = halfPlateau();
    store.replace(project);
    const refused = paintTerrainBrush(mapId, 5, 6, "water", 3, 0);
    const map = store.getCurrent().maps[mapId]!;
    expect(refused).toBeGreaterThan(0);
    for (let x = 0; x < map.width; x++) expect(map.relief!.levels[5 * map.width + x]).toBe(2);
  });
});
