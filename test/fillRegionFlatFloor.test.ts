// fill_region 이 오토타일이 아닌 실내 바닥(나무 바닥·돌바닥·카펫)도 채운다 — 2026-09-24 꿈 세계 도그푸딩.
// 실내 칩셋 방을 만들며 「실내 나무 바닥」「실내 돌바닥」「붉은 카펫」이 전부 「면 채우기 재료가 아닙니다」로 거부됐다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const MAP_ID = "map_blank_start";
const INTERIOR = "easyrpg_chipset_interior";

function interiorContext(): ToolContext {
  const project = createBlankProject();
  const map = project.maps[MAP_ID]!;
  map.tilesetId = INTERIOR;
  map.lowerTiles.fill(0);
  map.upperTiles.fill(0);
  return { project };
}

const at = (ctx: ToolContext, x: number, y: number) => {
  const map = ctx.project.maps[MAP_ID]!;
  return map.lowerTiles[y * map.width + x];
};

describe("fill_region 실내 바닥", () => {
  it("실내 나무 바닥으로 방 바닥을 채운다", () => {
    const ctx = interiorContext();
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 6, h: 4 }, material: "실내 나무 바닥" });
    expect(result.ok, result.summary).toBe(true);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 8; x++) expect(at(ctx, x, y)).toBe(72);
    expect(at(ctx, 1, 2)).toBe(0);
  });

  it("실내 돌바닥도 채운다", () => {
    const ctx = interiorContext();
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 1, y: 1, w: 3, h: 3 }, material: "실내 돌바닥" });
    expect(result.ok, result.summary).toBe(true);
    expect(at(ctx, 2, 2)).toBe(12);
  });

  it("3×3 테두리 카펫은 가장자리에 테두리, 안쪽에 몸통을 깐다", () => {
    const ctx = interiorContext();
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 4, h: 3 }, material: "붉은 카펫" });
    expect(result.ok, result.summary).toBe(true);
    expect(at(ctx, 3, 3)).toBe(375); // 왼위
    expect(at(ctx, 4, 3)).toBe(376); // 위
    expect(at(ctx, 6, 3)).toBe(377); // 오른위
    expect(at(ctx, 3, 4)).toBe(405); // 왼
    expect(at(ctx, 5, 4)).toBe(406); // 몸통
    expect(at(ctx, 6, 5)).toBe(437); // 오른아래
  });

  it("벽 재료는 여전히 거부한다", () => {
    const ctx = interiorContext();
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 1, y: 1, w: 3, h: 3 }, material: "크림 회벽" });
    expect(result.ok).toBe(false);
  });
});
