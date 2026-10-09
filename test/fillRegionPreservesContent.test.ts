// fill_region 이 「채우기」만 하고 남의 것을 지우지 않는다는 계약 — 2026-09-03 적대적 리뷰(07·06·03·08) 재현.
//   (1) lower 채움은 상위 레이어 소품을 지우지 않는다(clearUpper 를 명시해야 지운다)
//   (2) 벽·지붕·건물 구조 타일 칸은 건너뛰고 경고한다
//   (3) 통행 불가 재료(물)는 이벤트 칸을 건너뛰고, 시작 위치에서 나가는 통로를 남긴다
//   (4) 「벽 틈 메움」으로 요청 rect 밖 칸이 늘어나면 요약에 그 수를 밝힌다
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";

const MAP_ID = "map_blank_start";
const CONIFER_TOP = 260;
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;

function context(): ToolContext {
  return { project: createBlankProject() };
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
    map.lowerTiles[5 * map.width + 12] = wallTile(ctx);
    expect(isPassable(ctx.project, map, 12, 5)).toBe(false);
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 6, h: 3 }, material: "모래" });
    expect(result.ok, result.summary).toBe(true);
    expect(lowerAt(ctx, 11, 5), "틈 칸 (11,5)").not.toBe(TILE.GRASS);
    expect(result.summary).toContain("벽 틈 메움 1칸");
  });
});
