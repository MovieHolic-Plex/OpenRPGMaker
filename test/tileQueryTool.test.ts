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
