// test/tileQueryTool.test.ts
// tile_query ask:"vocab" 계약 테스트 — 시공 가능 그룹 id 전체 조회(2단계-B).

import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TilesetDef } from "@/project/types";

function context(): { ctx: ToolContext; tileset: () => TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  return { ctx, tileset: () => ctx.project.tilesets[DEFAULT_TILESET_ID] };
}

describe("tile_query ask:vocab", () => {
  it("승인 어휘 전체 그룹 목록을 role과 함께 돌려준다", () => {
    const { ctx } = context();
    const result = runTool(ctx, "tile_query", { ask: "vocab" }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { groups: { id: string; role: string }[] };
    expect(data.groups.length).toBeGreaterThan(10); // 하네스 23종이 승인 시드로 잡힘
    expect(data.groups.some((g) => g.role === "wall")).toBe(true);
    expect(result.summary).toContain("wall");
  });
});

describe("tile_query ask:labels tileset resolution", () => {
  it("defaults labels to startMap tileset so interior maps do not see combined-town labels", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.tilesetId = "easyrpg_chipset_interior";
    const ctx: ToolContext = { project };

    const result = runTool(ctx, "tile_query", { ask: "labels", query: "탁자" }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { tilesetId: string; labels: { label: string }[] };
    expect(data.tilesetId).toBe("easyrpg_chipset_interior");
    const labels = data.labels.map((l) => l.label);
    expect(labels.some((l) => l.includes("사각") || l.includes("긴 탁자") || l.includes("원형"))).toBe(true);
    expect(labels.some((l) => l === "가로 탁자 중" || l === "가로 탁자 좌")).toBe(false);
  });

  it("mapId overrides default when querying another map tileset", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    start.tilesetId = "easyrpg_chipset_interior";
    // add outdoor map
    const outdoorId = "map_outdoor";
    project.maps[outdoorId] = {
      ...structuredClone(start),
      id: outdoorId,
      name: "야외",
      tilesetId: DEFAULT_TILESET_ID,
    };
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "tile_query", { ask: "labels", query: "탁자", mapId: outdoorId }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { tilesetId: string; labels: { label: string }[] };
    expect(data.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(data.labels.some((l) => l.label.includes("가로 탁자"))).toBe(true);
  });
});
