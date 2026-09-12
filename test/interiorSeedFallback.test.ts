import { describe, expect, it } from "vitest";
import {
  createHouseInteriorMap,
  type InteriorBlueprintSource,
} from "@/editor/houseInteriors";
import {
  conceptHouseFloorPlan,
  isCodeDraftFacility,
  resolveHouseConcept,
} from "@/editor/interiorConceptPlan";
import {
  interiorVarietyReport,
  interiorVarietySummary,
} from "@/editor/tools/interiorVariety";
import { runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import type { InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { cloneConceptFacilityTemplates } from "@/project/defaults/conceptFacilityTemplates";
import type { GameMap } from "@/project/types";
import { preparedProject, exteriorSingle, requireHouseData } from "./support/authorHouseFacadeFixture";

function planOf(map: GameMap): InteriorRoomPlan {
  return map.roomHarnessPlan!.plan as InteriorRoomPlan;
}

/** 도면 서명 — interiorVariety.floorKey 와 같은 축(방 배치·문)을 테스트용으로 재구성. */
function blueprintKey(map: GameMap): string {
  const plan = planOf(map);
  const rooms = (plan.rooms ?? [])
    .map(room => `${room.x},${room.y},${room.w},${room.h},${plan.concept?.rooms[room.id]?.placeId ?? room.theme ?? room.id}`)
    .sort()
    .join(";");
  return `${plan.width}x${plan.height}|${plan.door.x},${plan.door.y}|${rooms}`;
}

function interiorArgs(overrides: Record<string, unknown> = {}) {
  return {
    project: preparedProject(),
    id: "seed_house", name: "집", returnMapId: "m1", returnX: 1, returnY: 1,
    exitEventId: "exit", seed: 7,
    ...overrides,
  } as const;
}

describe("코드 초안은 씨앗이다 — 저작된 꾸러미만 도면 정본", () => {
  it("isCodeDraftFacility: 초안 그대로는 true, 구조를 고친 꾸러미는 false", () => {
    const project = preparedProject();
    expect(isCodeDraftFacility(resolveHouseConcept(project, "dwelling"))).toBe(true);

    const cloned = cloneConceptFacilityTemplates();
    const house = cloned.find(bundle => bundle.id === "house")!;
    house.places.find(place => place.id === "kitchen")!.size = "l";
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = cloned;
    expect(isCodeDraftFacility(resolveHouseConcept(project, "dwelling"))).toBe(false);

    // 라벨·이름만 바꾼 초안은 도면이 아니라 여전히 씨앗이다.
    const relabeled = cloneConceptFacilityTemplates();
    relabeled.find(bundle => bundle.id === "house")!.facilities[0]!.label = "우리 집";
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = relabeled;
    expect(isCodeDraftFacility(resolveHouseConcept(project, "dwelling"))).toBe(true);
  });

  it("초안뿐인 프로젝트는 절차 도면으로 짓고 초안의 장소·물건을 씨앗으로 묶는다", () => {
    const project = preparedProject();
    const built = createHouseInteriorMap({ ...interiorArgs(), project });
    expect(built.interiorSource satisfies InteriorBlueprintSource).toBe("seed");

    const plan = planOf(built.map);
    // 절차 도면의 실루엣이다 — 초안 템플릿(민가 row 도면)의 방 배치와 달라야 한다.
    const templatePlan = conceptHouseFloorPlan(resolveHouseConcept(project, "dwelling"), {
      mapId: "tpl", name: "템플릿", seed: 7, level: 1,
    });
    expect(blueprintKey(built.map)).not.toBe(
      `${templatePlan.width}x${templatePlan.height}|${templatePlan.door.x},${templatePlan.door.y}|`
      + (templatePlan.rooms ?? []).map(r => `${r.x},${r.y},${r.w},${r.h},${templatePlan.concept?.rooms[r.id]?.placeId ?? r.theme ?? r.id}`).sort().join(";"),
    );
    // 씨앗 바인딩: 초안 꾸러미의 장소·물건이 방에 실렸다(composed 오버레이).
    expect(plan.concept?.facilityId).toBe("composed");
    const bound = Object.values(plan.concept!.rooms);
    expect(bound.length).toBeGreaterThan(0);
    expect(bound.every(room => room.things.length > 0 || room.placeId === "corridor")).toBe(true);
  });

  it("scale×program 이 다르면 씨앗 경로도 다른 도면을 낸다", () => {
    const a = createHouseInteriorMap({
      ...interiorArgs({ id: "a", seed: 11 }),
      exterior: { stories: 1, program: "dwelling" },
    });
    const b = createHouseInteriorMap({
      ...interiorArgs({ id: "b", seed: 11 }),
      exterior: { stories: 1, program: "inn" },
    });
    expect(a.interiorSource).toBe("seed");
    expect(b.interiorSource).toBe("seed");
    expect(blueprintKey(a.map)).not.toBe(blueprintKey(b.map));
  });

  it("구조를 고친 꾸러미는 authored 도면으로 짓고, interiorPlan 은 designed 로 최우선이다", () => {
    const project = preparedProject();
    const cloned = cloneConceptFacilityTemplates();
    cloned.find(bundle => bundle.id === "house")!.places.find(place => place.id === "living")!.size = "m";
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = cloned;
    expect(createHouseInteriorMap({ ...interiorArgs(), project }).interiorSource).toBe("authored");

    const ctx = { project: preparedProject() };
    const result = runAuthorHouse(ctx, {
      ...exteriorSingle, interior: "linked-interior", ownerName: "주민",
      interiorPlan: {
        places: [{ id: "hall", label: "홀", role: "entrance", size: "l", floor: "plank" }],
        things: [{ objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(requireHouseData(result.data).houses[0]!.interior!.designSource).toBe("planned");
  });

  it("author_house 결과에 interiorVariety 가 실리고 seed 출처가 기록된다", () => {
    const ctx = { project: preparedProject() };
    const result = runAuthorHouse(ctx, {
      ...exteriorSingle, interior: "linked-interior", ownerName: "주민",
    });
    expect(result.ok, result.summary).toBe(true);
    const data = requireHouseData(result.data);
    const house = data.houses[0]!.interior!;
    expect(house.designSource).toBe("seed");
    expect(data.interiorVariety?.interiors).toBe(1);
    expect(data.interiorVariety?.sources.seed).toBe(1);
    expect(result.summary).toContain("실내");
  });
});

describe("interiorVarietyReport — 같은 실내 찍어내기를 되읽는다", () => {
  it("같은 도면 두 채는 monotonous + 반복 경고를 낸다", () => {
    const seed = 7;
    const a = createHouseInteriorMap({ ...interiorArgs({ id: "r1", seed }) });
    const b = createHouseInteriorMap({ ...interiorArgs({ id: "r2", seed }) });
    const report = interiorVarietyReport([
      { source: "seed", maps: [a.map] },
      { source: "seed", maps: [b.map] },
    ]);
    expect(report.interiors).toBe(2);
    expect(report.distinctBlueprints).toBe(1);
    expect(report.repeatedBlueprints.length).toBe(1);
    expect(report.verdict).toBe("monotonous");
    expect(interiorVarietySummary(report)).toContain("도면 1종");
    expect(report.advice.join(" ")).toContain("interiorPlan");
  });

  it("다른 도면·물건 세트는 verdict 를 올린다", () => {
    const dwelling = createHouseInteriorMap({
      ...interiorArgs({ id: "d", seed: 3 }),
      exterior: { stories: 1, program: "dwelling" },
    });
    const inn = createHouseInteriorMap({
      ...interiorArgs({ id: "i", seed: 3 }),
      exterior: { stories: 1, program: "inn" },
    });
    const report = interiorVarietyReport([
      { source: "seed", maps: [dwelling.map] },
      { source: "seed", maps: [inn.map] },
    ]);
    expect(report.distinctBlueprints).toBe(2);
    expect(report.verdict).toBe("diverse");
    expect(report.repeatedBlueprints).toHaveLength(0);
  });

  it("가구 위치가 아니라 물건 세트가 같으면 identicalObjects 로 잡는다", () => {
    const a = createHouseInteriorMap({ ...interiorArgs({ id: "o1", seed: 5 }) });
    const b = createHouseInteriorMap({ ...interiorArgs({ id: "o2", seed: 6 }) });
    const report = interiorVarietyReport([
      { source: "seed", maps: [a.map] },
      { source: "seed", maps: [b.map] },
    ]);
    // 같은 program·같은 초안 씨앗 → 물건 세트는 동일해야 잡힌다(서로 다른 시드의 위치 흔들림은 무관).
    expect(report.identicalObjects).toBe(true);
    expect(report.advice.join(" ")).toContain("vocabularyGroups");
  });
});
