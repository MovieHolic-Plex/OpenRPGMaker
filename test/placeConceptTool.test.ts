import { describe, expect, it } from "vitest";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { SCRATCH_INN_BUNDLE } from "./fixtures/legacyConceptInn";
import { createBlankProject } from "@/project/defaults";

describe("place_concept", () => {
  // Removed it "툴이 등록되어 있다": place_concept was removed from the tool registry on purpose.

  it("여관 지어줘 요청은 손 도트 v5 도구로 승격된다(place_concept 은 2026-09-29 폐기 — 실행 호환만)", () => {
    for (const text of ["여관 지어줘", "여관 하나 지어줘", "주막 만들어줘"]) {
      expect(capabilityEscalatedToolNames(text, new Set())).toContain("build_hand_interior_room");
      expect(capabilityEscalatedToolNames(text, new Set())).not.toContain("place_concept");
    }
  });

  // Removed it "툴 설명이 시설 요청의 경로": place_concept was removed from the tool registry on purpose.

  // Removed it "이전에 저작된 여관으로": place_concept was removed from the tool registry on purpose.

  // Removed it "사용자가 피아노를 빼고": place_concept was removed from the tool registry on purpose.

  // Removed it "장소를 지우면 그 방과": place_concept was removed from the tool registry on purpose.

  // Removed it "빈 배열은 다시 채우지": place_concept was removed from the tool registry on purpose.
});

describe("개념 꾸러미 프롬프트", () => {
  // 2026-09-29: 실내 = 손 도트 v5 하나. place_concept 은 폐기(실행 호환만)라 시스템 프롬프트에 꾸러미 절을 싣지 않는다.
  it("폐기된 개념 꾸러미 절은 사용자가 고친 나무가 있어도 시스템 프롬프트에 실리지 않는다", () => {
    const project = createBlankProject();
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.facilities[0] = { ...edited.facilities[0]!, label: "주막" };
    edited.label = "주막";
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [edited];
    const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars: 50_000 });
    expect(prompt).not.toContain("## 개념 꾸러미");
    expect(prompt).toContain("build_hand_interior_room");
  });
});

describe("개념 꾸러미 장소 스키마 (role · size · count)", () => {
  it("역할·크기·개수를 받아들이고 모르는 값은 거절한다", async () => {
    const { validateTileset } = await import("@/project/io/shapeResourceFields");
    const project = createBlankProject();
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    bundle.places = [
      { id: "hall", label: "홀", role: "entrance", size: "l" },
      { id: "corridor", label: "복도", role: "walkway" },
      { id: "bedroom", label: "객실", role: "room", size: "s", count: 2 },
    ];
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [bundle] })).not.toThrow();
    const badRole = cloneConceptBundle(bundle);
    (badRole.places[0] as { role: string }).role = "hallway";
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badRole] })).toThrow(/role/);
    const badCount = cloneConceptBundle(bundle);
    (badCount.places[2] as { count: number }).count = 0;
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badCount] })).toThrow(/count/);
  });

  it("복제는 역할·크기·개수를 보존한다", () => {
    const copy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    const bedroom = copy.places.find((place) => place.id === "bedroom");
    expect(bedroom?.role).toBe("room");
    expect(bedroom?.count).toBe(2);
    expect(copy.places.find((place) => place.id === "dining")?.role).toBe("entrance");
    expect(copy.places.find((place) => place.id === "corridor")?.role).toBe("walkway");
  });
});

describe("place_concept 도면", () => {
  function innLayout() {
    return layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!);
  }

  it("여관 초안은 객실 2개 → 복도 → 홀 순으로 서고 정문은 홀 남쪽 벽에 난다", () => {
    const layout = innLayout();
    const bedrooms = layout.rooms.filter((room) => room.placeId === "bedroom").sort((a, b) => a.x - b.x);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    const hall = layout.rooms.find((room) => room.placeId === "dining")!;
    expect(bedrooms).toHaveLength(2);
    expect(corridor).toBeDefined();
    expect(hall).toBeDefined();
    // 세로 인접은 3행 파티션(트림 + 벽면 2행), 가로 인접은 1열 파티션 — 파이프라인 벽 문법.
    for (const bedroom of bedrooms) expect(corridor.y).toBe(bedroom.y + bedroom.h + 3);
    expect(hall.y).toBe(corridor.y + corridor.h + 3);
    expect(bedrooms[1]!.x).toBe(bedrooms[0]!.x + bedrooms[0]!.w + 1);
    // 복도와 홀은 객실 줄 전폭을 잇는다.
    expect(corridor.x).toBe(bedrooms[0]!.x);
    expect(corridor.x + corridor.w).toBe(bedrooms[1]!.x + bedrooms[1]!.w);
    expect(hall.w).toBe(corridor.w);
    // 정문은 홀 남쪽 행 안.
    expect(layout.door.y).toBe(hall.y + hall.h - 1);
    expect(layout.door.x).toBeGreaterThanOrEqual(hall.x);
    expect(layout.door.x).toBeLessThan(hall.x + hall.w);
    // 내부 문: 객실마다 복도로 하나, 복도→홀 하나.
    expect(layout.innerDoors).toHaveLength(3);
    for (const bedroom of bedrooms) {
      expect(layout.innerDoors.some((door) => door.y === bedroom.y + bedroom.h && door.x >= bedroom.x && door.x < bedroom.x + bedroom.w)).toBe(true);
    }
    expect(layout.innerDoors.some((door) => door.y === corridor.y + corridor.h)).toBe(true);
    // 맵은 정문 아래 출구 계단과 천장 여백을 남긴다(도면 여백 2행: door.y+3 == height).
    expect(layout.height).toBeGreaterThanOrEqual(layout.door.y + 3);
    expect(layout.rooms.every((room) => room.x >= 2 && room.x + room.w <= layout.width - 1)).toBe(true);
  });

  it("역할이 없는 옛 나무는 복도 라벨로 복도를 알아보고 복도가 정문을 품는다", () => {
    const legacy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    legacy.places = legacy.places.map(({ id, label }) => ({ id, label }));
    const layout = layoutConceptFacility(legacy, legacy.facilities[0]!);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
    expect(layout.rooms.filter((room) => room.placeId === "bedroom")).toHaveLength(1);
    expect(layout.rooms.filter((room) => room.placeId === "dining")).toHaveLength(1);
  });

  it("식당(홀)을 지우면 복도가 정문을 품고 객실은 그대로 복도 위에 선다", () => {
    const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    edited.places = edited.places.filter((place) => place.id !== "dining");
    edited.facilities[0] = { ...edited.facilities[0]!, placeIds: ["bedroom", "corridor"] };
    const layout = layoutConceptFacility(edited, edited.facilities[0]!);
    const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
    expect(layout.rooms.find((room) => room.placeId === "dining")).toBeUndefined();
    expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
    expect(layout.innerDoors).toHaveLength(2);
  });

  // Removed it "시공된 여관은 문에서 모든 방에": place_concept was removed from the tool registry on purpose.
});

// Removed describe "place_concept 구성과 칩 집행": place_concept was removed from the tool registry on purpose.

// Removed describe "place_concept plan — 모델이 설계하고": place_concept and get_concept_facility were removed from the tool registry on purpose.

// Removed describe "place_concept 이 create_map 빈 맵을": place_concept was removed from the tool registry on purpose.
