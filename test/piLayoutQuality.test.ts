import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { inspectPiLayoutQuality, measureLayoutQuality, piLayoutRepairPrompt } from "@/ai/piAgent/layoutQuality";

function fixture(): { project: Project; floor: number; wall: number } {
  const project = createBlankProject();
  const tileset = Object.values(project.tilesets)[0]!;
  const floor = tileset.passability.findIndex(p => p && p.up && p.down && p.left && p.right);
  const wall = tileset.passability.findIndex(p => p && !p.up && !p.down && !p.left && !p.right);
  expect(floor).toBeGreaterThanOrEqual(0);
  expect(wall).toBeGreaterThanOrEqual(0);
  return { project, floor, wall };
}

function addMap(project: Project, id: string, w: number, h: number, floor: number): GameMap {
  const tilesetId = Object.keys(project.tilesets)[0]!;
  const map = { id, name: id, width: w, height: h, tilesetId, tileSize: 16,
    lowerTiles: new Array(w * h).fill(floor), upperTiles: new Array(w * h).fill(-1), events: [] } as unknown as GameMap;
  project.maps[id] = map;
  return map;
}

describe("배치 품질 검사", () => {
  it("빈 바닥·빈 정사각형을 재고, 흩어 놓은 3층은 대칭으로 보지 않는다", () => {
    const { project, floor } = fixture();
    const map = addMap(project, "m", 20, 10, floor);
    const empty = measureLayoutQuality(project, map)!;
    expect(empty.empty).toBe(100);
    expect(empty.square).toBe(10);
    expect(empty.emptiestWindows.length).toBeGreaterThan(0);
    // 두 칸마다 3층 → 모든 바닥 칸 곁에 물체가 있다.
    for (let y = 0; y < 10; y += 2) for (let x = (y / 2) % 2; x < 20; x += 3) map.upperTiles[y * 20 + x] = floor;
    const filled = measureLayoutQuality(project, map)!;
    expect(filled.empty).toBeLessThan(30);
    expect(filled.square).toBeLessThanOrEqual(2);
  });

  it("좌우 거울 배치는 대칭 배수가 높다", () => {
    const { project, floor } = fixture();
    const map = addMap(project, "m", 20, 10, floor);
    for (const [x, y] of [[2, 1], [4, 3], [3, 6], [6, 8], [1, 4], [5, 2], [7, 5]]) {
      map.upperTiles[y! * 20 + x!] = floor;
      map.upperTiles[y! * 20 + (19 - x!)] = floor;
    }
    expect(measureLayoutQuality(project, map)!.mirror).toBeGreaterThan(2.2);
  });

  it("막힌 칸(벽)은 바닥으로 세지 않는다", () => {
    const { project, floor, wall } = fixture();
    const map = addMap(project, "m", 20, 10, wall);
    for (let x = 0; x < 20; x++) map.lowerTiles[x] = floor;
    expect(measureLayoutQuality(project, map)!.floorCells).toBe(20);
  });

  it("이번 실행이 크게 칠한 맵만, 제외 목록을 빼고 묻는다", () => {
    const { project: base, floor, wall } = fixture();
    addMap(base, "old", 20, 10, wall);
    addMap(base, "tiny_edit", 20, 10, floor);
    const project = structuredClone(base);
    project.maps.old!.lowerTiles.fill(floor);            // 전면 재칠 → 대상
    project.maps.tiny_edit!.lowerTiles[0] = wall;        // 한 칸 수정 → 제외
    addMap(project, "fresh", 20, 10, floor);             // 새 맵 → 범위 밖이어도 대상
    addMap(project, "village", 20, 10, floor);           // 마을 계약이 따로 본다
    const issues = inspectPiLayoutQuality(project, base, ["old", "tiny_edit"], ["village"]);
    expect(issues.map(i => i.mapId).sort()).toEqual(["fresh", "old"]);
    const prompt = piLayoutRepairPrompt(issues);
    expect(prompt).toContain("빈 바닥 100%");
    expect(prompt).toContain("show_map_region");
  });
});
