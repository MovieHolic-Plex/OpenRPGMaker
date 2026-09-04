import { describe, expect, it } from "vitest";
import { ensureConceptBundles, liveBundlesForTileset } from "@/editor/conceptBundleResolve";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

describe("Phase 5 실외 확장 — 게이트 개방과 명시적 거부", () => {
  it("다른 칩셋은 빈 꾸러미로 열린다 — undefined(미시드)가 아니다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, DEFAULT_TILESET_ID);
    expect(context.project.tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toEqual([]);
    expect(liveBundlesForTileset(context.project, DEFAULT_TILESET_ID)).toEqual([]);
  });

  it("실내 칩셋은 여전히 초안을 시드한다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, INTERIOR_ROOM_TILESET_ID);
    expect((context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles ?? []).length).toBeGreaterThan(0);
  });

  it("place_concept는 실내 칩셋이 아니면 invalid-tileset으로 거절한다", () => {
    const result = runTool(ctx(), "place_concept", {
      query: "여관",
      mapId: "map_outdoor_test",
      tilesetId: DEFAULT_TILESET_ID,
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-tileset")).toBe(true);
  });

  it("place_concept는 실내 칩셋에서 그대로 짓는다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_p5",
      seed: 7,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });
});
