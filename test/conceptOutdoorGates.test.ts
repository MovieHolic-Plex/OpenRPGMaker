import { describe, expect, it } from "vitest";
import { ensureConceptBundles, liveBundlesForTileset } from "@/editor/conceptBundleResolve";
import type { ToolContext } from "@/editor/tools/types";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

describe("Phase 5 실외 확장 — 스코프 게이트와 명시적 거부", () => {
  it("미시드 실외는 live에서 빈 배열 — 템플릿이 새지 않는다", () => {
    const context = ctx();
    expect(liveBundlesForTileset(context.project, COMBINED_TOWN_TILESET_ID)).toEqual([]);
    expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("ensure는 실외를 손대지 않는다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, COMBINED_TOWN_TILESET_ID);
    expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("실내 칩셋은 여전히 초안을 시드한다", () => {
    const context = ctx();
    ensureConceptBundles(context.project, INTERIOR_ROOM_TILESET_ID);
    expect((context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles ?? []).length).toBeGreaterThan(0);
  });

  // Removed it "place_concept는 실내 칩셋이 아니면": place_concept was removed from the tool registry on purpose.

  // Removed it "실외 전용 시설명은 실내 스코프에서": place_concept was removed from the tool registry on purpose.

  // Removed it "get_concept_facility는 실외를 읽되": get_concept_facility was removed from the tool registry on purpose.

  // Removed it "place_concept는 실내 칩셋에서 그대로": place_concept was removed from the tool registry on purpose.
});
