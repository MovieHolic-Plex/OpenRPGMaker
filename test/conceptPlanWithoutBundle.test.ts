// 2026-09-24 헤드리스 「등대지기의 겨울」: 꾸러미 초안이 폐기된 새 프로젝트에서 get_concept_facility 는
// 「장소·물건을 조합해 plan 을 설계하고 place_concept 에 넘겨라」라고 했는데, place_concept(plan) 과
// run_interior_room_pipeline 이 모두 「개념 꾸러미가 비어 있다」로 거부했다. plan 은 장소·물건을 스스로 들고 온다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

describe("concept plan on a project without concept bundles", () => {
  // Removed it "place_concept builds a designed interior": place_concept was removed from the tool registry on purpose.

  // Removed it "a template call with no bundle falls back": place_concept was removed from the tool registry on purpose.

  it("a theme-only interior pipeline builds a bedroom from the bundled house", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "run_interior_room_pipeline", {
      mapId: "map_top", name: "방", width: 16, height: 12, door: { x: 8, y: 9 }, theme: "bedroom",
      rooms: [{ id: "room_main", x: 2, y: 4, w: 12, h: 6, theme: "bedroom" }],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("a theme the bundled inn/house do not have names get_concept_facility and place_concept(plan)", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "run_interior_room_pipeline", {
      mapId: "map_top", name: "방", width: 16, height: 12, door: { x: 8, y: 11 }, theme: "study",
      rooms: [{ id: "room_main", x: 2, y: 2, w: 12, h: 8, theme: "study" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("concept-place-not-found");
    expect(result.summary).toContain("place_concept(plan)");
  });

  // Removed it "interior tools build on tibo_interior_expanded": place_concept was removed from the tool registry on purpose.
});
