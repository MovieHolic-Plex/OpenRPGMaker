// 2026-09-24 헤드리스 「등대지기의 겨울」: 꾸러미 초안이 폐기된 새 프로젝트에서 get_concept_facility 는
// 「장소·물건을 조합해 plan 을 설계하고 place_concept 에 넘겨라」라고 했는데, place_concept(plan) 과
// run_interior_room_pipeline 이 모두 「개념 꾸러미가 비어 있다」로 거부했다. plan 은 장소·물건을 스스로 들고 온다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const LIGHTHOUSE_PLAN = {
  wall: "stone-brick",
  places: [{ id: "hall", label: "등대 전망대 홀", role: "entrance", shape: "rect", size: "l", floor: "stone" }],
  things: [
    { id: "th_desk", objectId: "reading_table", placeIds: ["hall"], chips: ["block"] },
    { id: "th_books", objectId: "bookshelf", placeIds: ["hall"], chips: ["block"] },
    { id: "th_barrel", objectId: "barrel", placeIds: ["hall"], chips: ["block"] },
  ],
};

describe("concept plan on a project without concept bundles", () => {
  it("place_concept builds a designed interior from its own plan", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "place_concept", { mapId: "map_lighthouse_top", query: "등대", name: "등대 꼭대기 화로", plan: LIGHTHOUSE_PLAN });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_lighthouse_top).toBeDefined();
  });

  it("a template call with no bundle still refuses, pointing at the plan path", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "place_concept", { mapId: "map_inn", query: "여관", template: true });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("plan");
  });

  it("a theme-only interior pipeline names get_concept_facility and place_concept(plan)", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "run_interior_room_pipeline", {
      mapId: "map_top", name: "방", width: 16, height: 12, door: { x: 8, y: 11 }, theme: "study",
      rooms: [{ id: "room_main", x: 2, y: 2, w: 12, h: 8, theme: "study" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("concept-bundle-empty");
    expect(result.summary).toContain("place_concept(plan)");
  });
});
