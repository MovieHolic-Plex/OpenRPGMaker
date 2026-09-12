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

describe("Phase 5 실외 확장 — 스코프 게이트와 명시적 거부", () => {
  it("미시드 실외는 live에서 빈 배열 — 템플릿이 새지 않는다", () => {
    const context = ctx();
    expect(liveBundlesForTileset(context.project, DEFAULT_TILESET_ID)).toEqual([]);
    expect(context.project.tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("ensure는 실외를 손대지 않는다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, DEFAULT_TILESET_ID);
    expect(context.project.tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("실내 칩셋은 여전히 초안을 시드한다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, INTERIOR_ROOM_TILESET_ID);
    expect((context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles ?? []).length).toBeGreaterThan(0);
  });

  it("place_concept는 실내 칩셋이 아니면 invalid-tileset으로 거절하고 쓰지 않는다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      template: true,
      query: "여관",
      mapId: "map_outdoor_test",
      tilesetId: DEFAULT_TILESET_ID,
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-tileset")).toBe(true);
    expect(context.project.tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
    expect(context.project.maps.map_outdoor_test).toBeUndefined();
  });

  it("실외 전용 시설명은 실내 스코프에서 concept-not-found다 — 누수 시공 없음", () => {
    const context = ctx();
    context.project.tilesets[DEFAULT_TILESET_ID]!.scratchConceptBundles = [{
      id: "bundle_out",
      label: "실외",
      facilities: [{ id: "market", label: "시장", placeIds: ["stall"] }],
      places: [{ id: "stall", label: "좌판", role: "room" }],
      things: [],
    }];
    const result = runTool(context, "place_concept", {
      template: true,
      query: "시장",
      mapId: "map_market_leak",
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "concept-not-found")).toBe(true);
    expect(context.project.maps.map_market_leak).toBeUndefined();
  });

  it("get_concept_facility는 실외를 읽되 쓰지 않는다", () => {
    const context = ctx();
    const result = runTool(context, "get_concept_facility", {
      query: "여관",
      tilesetId: DEFAULT_TILESET_ID,
    }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(context.project.tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("place_concept는 실내 칩셋에서 그대로 짓는다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      template: true,
      query: "여관",
      mapId: "map_inn_p5",
      seed: 7,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });
});
