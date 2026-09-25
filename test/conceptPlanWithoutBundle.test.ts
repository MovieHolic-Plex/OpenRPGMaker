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

  it("a template call with no bundle falls back to the bundled inn", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const result = runTool(ctx, "place_concept", { mapId: "map_inn", query: "여관", template: true });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_inn).toBeDefined();
  });

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

  // 2026-09-25 조수 시험 「여관 1층」: 실내 도구 셋이 tibo_interior_expanded 를 거부했다. 0~479칸이 실내 칩셋과 같은 그림이다.
  it("interior tools build on tibo_interior_expanded with the same tiles as the interior chipset", () => {
    const tibo: { project: Project } = { project: createBlankProject() };
    const easy: { project: Project } = { project: createBlankProject() };
    const args = { query: "민가", mapId: "map_house", template: true, seed: 3 };
    const a = runTool(tibo, "place_concept", { ...args, tilesetId: "tibo_interior_expanded" });
    const b = runTool(easy, "place_concept", args);
    expect(a.ok, a.summary).toBe(true);
    expect(b.ok, b.summary).toBe(true);
    expect(tibo.project.maps.map_house?.tilesetId).toBe("tibo_interior_expanded");
    expect(tibo.project.maps.map_house?.lowerTiles).toEqual(easy.project.maps.map_house?.lowerTiles);
    expect(tibo.project.maps.map_house?.upperTiles).toEqual(easy.project.maps.map_house?.upperTiles);
    const pipeline = runTool(tibo, "run_interior_room_pipeline", {
      mapId: "map_room", name: "방", width: 16, height: 12, door: { x: 8, y: 9 }, theme: "kitchen",
      rooms: [{ id: "room_main", x: 2, y: 4, w: 12, h: 6, theme: "kitchen" }], tilesetId: "tibo_interior_expanded",
    });
    expect(pipeline.ok, pipeline.summary).toBe(true);
    expect(tibo.project.maps.map_room?.tilesetId).toBe("tibo_interior_expanded");
  });
});
