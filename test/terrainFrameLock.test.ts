import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runHeadlessToolWithProject } from "@/headless";
import type { Project } from "@/project/types";

function framed(kind: "cells" | "frame"): { project: Project; mapId: string; locked: number[] } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const n = map.width * map.height;
  const levels = new Array<number>(n).fill(0);
  for (let y = 0; y < 3; y++) for (let x = 0; x < map.width; x++) levels[y * map.width + x] = 2;
  map.relief = { width: map.width, height: map.height, levels };
  const locked = levels.flatMap((v, i) => (v ? [i] : []));
  map.terrainDesign = kind === "cells" ? { lockedCells: locked } : { frameLock: true };
  return { project, mapId: map.id, locked };
}

const snapshot = (p: Project, mapId: string, cells: readonly number[]) => {
  const m = p.maps[mapId]!;
  return JSON.stringify(cells.map((i) => [m.lowerTiles[i], m.upperTiles[i], m.relief?.levels[i] ?? 0, m.terrainDesign?.waterDepth?.[i] ?? 0]));
};

describe("틀 고정 — AI 쓰기 확정 단계", () => {
  for (const assistantRun of [true, false]) {
    it(`fill_region 이 잠긴 칸을 덮으면 거부하고 칸 좌표를 돌려준다 (assistantRun=${assistantRun})`, () => {
      const { project, mapId, locked } = framed("cells");
      const before = snapshot(project, mapId, locked);
      const map = project.maps[mapId]!;
      const { result, project: next } = runHeadlessToolWithProject(project, "fill_region", { mapId, rect: { x: 0, y: 0, w: map.width, h: 3 }, material: "물" }, { assistantRun });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("terrain-frame-locked");
      expect(result.issues?.[0]?.message).toMatch(/\(0,0\)/);
      expect(snapshot(next, mapId, locked)).toBe(before);
    });
  }

  it("틀 고정은 높이를 바꾸는 sculpt_relief 를 거부하고 타일 칠하기는 허용한다", () => {
    const { project, mapId, locked } = framed("frame");
    const sculpt = runHeadlessToolWithProject(project, "sculpt_relief", { mapId, reset: true, ops: [] }, { assistantRun: true });
    expect(sculpt.result.ok).toBe(false);
    expect(snapshot(sculpt.project, mapId, locked)).toBe(snapshot(project, mapId, locked));
    const fill = runHeadlessToolWithProject(project, "fill_region", { mapId, rect: { x: 0, y: 5, w: 4, h: 3 }, material: "잔디" }, { assistantRun: true });
    expect(fill.result.issues?.some((issue) => issue.code === "terrain-frame-locked") ?? false).toBe(false);
    expect(fill.project.maps[mapId]!.relief!.levels).toEqual(project.maps[mapId]!.relief!.levels);
  });
});
