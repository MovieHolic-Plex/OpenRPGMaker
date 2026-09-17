import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

const MAP_ID = "map_blank_start";

function tileCounts(map: { width: number; height: number; lowerTiles: readonly number[]; upperTiles: readonly number[] }, tileId: number): number {
  let count = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (map.lowerTiles[index] === tileId || map.upperTiles[index] === tileId) count += 1;
    }
  }
  return count;
}

describe("place_props adversarial hardening", () => {
  it("단일 타일로 해석되는 수역 재료(물)도 소품 산포를 거절한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const before = tileCounts(ctx.project.maps[MAP_ID], 0);
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "물", count: 4 });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("material-not-prop");
    expect(tileCounts(ctx.project.maps[MAP_ID], 0)).toBe(before);
  });

  it("단일 타일로 해석되는 벽 재료(돌벽→타일 12·role=wall)도 소품 산포를 거절한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "돌벽", count: 4 });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("material-not-prop");
  });

  it("단일 타일 경로의 0배치는 영역을 넓혀 재시도하고 그 사실을 경고로 남긴다", () => {
    // 2026-09-18: 요청 영역이 꽉 차면 placement-zero 로 거부하던 것을, 2칸씩 최대 3번 넓혀 놓는다.
    const ctx: ToolContext = { project: createBlankProject() };
    const map = ctx.project.maps[MAP_ID];
    for (let y = 2; y < 8; y += 1) {
      for (let x = 2; x < 8; x += 1) map.upperTiles[y * map.width + x] = 288;
    }
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "팻말", count: 4 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("넓힘");
    expect((result.diff?.warnings ?? []).some((w) => w.includes("놓을 자리가 없어") && w.includes("넓혀"))).toBe(true);
  });

  it("맵을 다 채워 넓혀도 자리가 없으면 여전히 placement-zero 실패다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const map = ctx.project.maps[MAP_ID];
    map.upperTiles.fill(288);
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "팻말", count: 4 });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("placement-zero");
  });

  it("맵 밖 영역은 tile_erase 오진단이 아니라 영역 밖 실패다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "키큰 풀", count: 4 });
    expect(result.ok).toBe(false);
    expect(`${result.summary}`).toContain("밖입니다");
    expect(`${result.summary}`).not.toContain("tile_erase");
  });

  it("도메인 직접 호출의 맵 밖 영역은 placement-zero로 영역 밖을 말한다", () => {
    const project = createBlankProject();
    expect(() => placePropsOnDraft(project, { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "덤불", count: 4 }))
      .toThrowError(/밖에 있습니다/);
    try {
      placePropsOnDraft(project, { mapId: MAP_ID, area: { x: -40, y: -40, w: 6, h: 6 }, material: "덤불", count: 4 });
      expect.unreachable();
    } catch (error) {
      expect((error as { code?: string }).code).toBe("placement-zero");
      expect(`${(error as Error).message}`).not.toContain("tile_erase");
    }
  });

  it("맵을 삐져나가는 영역은 거절된다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 13, y: 11, w: 10, h: 6 }, material: "키큰 풀", count: 4 });
    expect(result.ok).toBe(false);
  });

  it("count 0·음수는 거절된다", () => {
    const zero: ToolContext = { project: createBlankProject() };
    expect(runTool(zero, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "키큰 풀", count: 0 }).ok).toBe(false);
    const negative: ToolContext = { project: createBlankProject() };
    expect(runTool(negative, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "키큰 풀", count: -3 }).ok).toBe(false);
  });

  it("trunkVisible·origins는 사일런트 드롭 대신 거절된다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 2, y: 2, w: 10, h: 10 },
      material: "침엽수",
      count: 4,
      trunkVisible: true,
      origins: [{ x: 2, y: 2 }],
    });
    expect(result.ok).toBe(false);
    expect(`${result.summary}`).toContain("trunkVisible");
  });

  it("소품 재료(덤불)는 그대로 산포한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 2, y: 2, w: 10, h: 10 }, material: "덤불", count: 4 });
    expect(result.ok, result.summary).toBe(true);
    expect(tileCounts(ctx.project.maps[MAP_ID], TILE.EMPTY)).toBeLessThan(ctx.project.maps[MAP_ID].width * ctx.project.maps[MAP_ID].height);
  });
});
