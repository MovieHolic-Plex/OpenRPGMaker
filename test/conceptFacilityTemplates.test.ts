// 개념 꾸러미 시설 초안 묶음 — 여관 하나가 아니라 시설 아홉 종을 place_concept 이 짓는다.
// 초안마다: 스키마 검증 통과 · 카탈로그 id 정합 · 시공 시 plan/walkability 경고 0 · 물건 전부 앉음 · 필수 물건이 맵에 있음.
import { describe, expect, it } from "vitest";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import {
  CONCEPT_FLOOR_TILES,
  ensureConceptBundles,
  layoutConceptFacility,
  liveBundlesForTileset,
  resolveConceptFacility,
} from "@/editor/conceptBundleResolve";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { PLACE_CONCEPT_TOOL } from "@/editor/tools/placeConceptTool";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import {
  CONCEPT_FACILITY_TEMPLATES,
  cloneConceptFacilityTemplates,
  conceptFacilityTemplateLabels,
  SCRATCH_GUILD_BUNDLE,
  SCRATCH_SMITHY_BUNDLE,
  SCRATCH_WAREHOUSE_BUNDLE,
} from "@/project/defaults/conceptFacilityTemplates";
import { SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { validateTileset } from "@/project/io/shapeResourceFields";
import type { ConceptBundleRecord, GameMap } from "@/project/types";

type Built = {
  readonly map: GameMap;
  readonly warnings: readonly string[];
  readonly rooms: readonly { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number; floorTile?: number }[];
  readonly wallMaterial: string;
};

function buildTemplate(bundle: ConceptBundleRecord, seed = 7): Built {
  const context: ToolContext = { project: createBlankProject() };
  const mapId = `map_${bundle.id}_tpl`;
  const result = runTool(context, "place_concept", { query: bundle.facilities[0]!.label, mapId, seed }, { dryRun: false });
  expect(result.ok, `${bundle.id}: ${result.summary}`).toBe(true);
  const data = result.data as { rooms: Built["rooms"]; wallMaterial: string };
  return {
    map: context.project.maps[mapId]!,
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    rooms: data.rooms,
    wallMaterial: data.wallMaterial,
  };
}

function objectTiles(objectId: string): Set<number> {
  return new Set(interiorObjectById(objectId)?.cells.map((cell) => cell.tile) ?? []);
}

function mapHasObject(map: GameMap, objectId: string): boolean {
  const tiles = objectTiles(objectId);
  return map.upperTiles.some((tile) => tiles.has(tile)) || map.lowerTiles.some((tile) => tiles.has(tile));
}

describe("개념 꾸러미 초안 묶음 — 데이터 정합", () => {
  it("아홉 시설이고 여관이 첫째다", () => {
    expect(CONCEPT_FACILITY_TEMPLATES.length).toBe(9);
    expect(CONCEPT_FACILITY_TEMPLATES[0]).toBe(SCRATCH_INN_BUNDLE);
    expect(new Set(CONCEPT_FACILITY_TEMPLATES.map((bundle) => bundle.id)).size).toBe(9);
    expect(conceptFacilityTemplateLabels()).toEqual(["여관", "민가", "상점", "술집", "서재", "대장간", "교회", "창고", "길드"]);
  });

  it("모든 초안이 타일셋 검증을 통과한다(역할·크기·개수·바닥·벽)", () => {
    const tileset = createBlankProject().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: cloneConceptFacilityTemplates() })).not.toThrow();
    const badFloor = cloneConceptFacilityTemplates();
    (badFloor[1]!.places[0] as { floor: string }).floor = "carpet";
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: badFloor })).toThrow(/floor/);
    const badWall = cloneConceptFacilityTemplates();
    (badWall[5]!.facilities[0] as { wall: string }).wall = "marble";
    expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: badWall })).toThrow(/wall/);
  });

  it("장소·물건 id 가 꾸러미 안에서 유일하고 참조가 끊기지 않으며 물건 그림이 카탈로그에 있다", () => {
    for (const bundle of CONCEPT_FACILITY_TEMPLATES) {
      const placeIds = bundle.places.map((place) => place.id);
      expect(new Set(placeIds).size, `${bundle.id} 장소 id 중복`).toBe(placeIds.length);
      const thingIds = bundle.things.map((thing) => thing.id);
      expect(new Set(thingIds).size, `${bundle.id} 물건 id 중복`).toBe(thingIds.length);
      for (const facility of bundle.facilities) {
        for (const id of facility.placeIds) expect(placeIds, `${bundle.id}.${facility.id} → ${id}`).toContain(id);
      }
      for (const thing of bundle.things) {
        expect(thing.placeIds.length, `${bundle.id}.${thing.id} 장소 없음`).toBeGreaterThan(0);
        for (const id of thing.placeIds) expect(placeIds, `${bundle.id}.${thing.id} → ${id}`).toContain(id);
        expect(interiorObjectById(thing.objectId), `${bundle.id}.${thing.id} 그림 ${thing.objectId} 없음`).toBeDefined();
      }
      // 정문을 품는 장소가 하나는 있다(도면이 마지막 방을 승격하지 않아도 되게).
      expect(bundle.places.some((place) => place.role === "entrance"), `${bundle.id} 정문 장소 없음`).toBe(true);
    }
  });

  it("복제는 바닥·벽 재질을 보존한다", () => {
    const copies = cloneConceptFacilityTemplates();
    const smithy = copies.find((bundle) => bundle.id === "smithy")!;
    expect(smithy.facilities[0]!.wall).toBe("stone-brick");
    expect(smithy.places.find((place) => place.id === "workshop")?.floor).toBe("stone");
    expect(copies.find((bundle) => bundle.id === "inn")!.facilities[0]!.wall).toBeUndefined();
  });
});

describe("개념 꾸러미 초안 묶음 — 시드와 호출", () => {
  it("실내 칩셋에 꾸러미가 없으면 아홉 초안을 전부 시드하고 빈 배열은 두지 않는다", () => {
    const project = createBlankProject();
    expect(project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles).toBeUndefined();
    expect(liveBundlesForTileset(project, INTERIOR_ROOM_TILESET_ID).map((bundle) => bundle.id)).toEqual(CONCEPT_FACILITY_TEMPLATES.map((bundle) => bundle.id));
    ensureConceptBundles(project);
    expect(project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles?.map((bundle) => bundle.id)).toEqual(CONCEPT_FACILITY_TEMPLATES.map((bundle) => bundle.id));
    const emptied = createBlankProject();
    emptied.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [];
    ensureConceptBundles(emptied);
    expect(emptied.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles).toEqual([]);
  });

  it("시설명으로 각 초안이 풀리고 없는 이름은 부를 수 있는 시설을 알려준다", () => {
    const project = createBlankProject();
    for (const bundle of CONCEPT_FACILITY_TEMPLATES) {
      const resolved = resolveConceptFacility(project, bundle.facilities[0]!.label);
      expect(resolved?.bundle.id, bundle.facilities[0]!.label).toBe(bundle.id);
    }
    expect(resolveConceptFacility(project, "성당")).toBeUndefined();
    const result = runTool({ project }, "place_concept", { query: "성당", mapId: "map_x" }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("교회");
    expect(result.summary).toContain("여관");
  });

  it("툴 설명에 초안 시설명이 전부 있고 「X 지어줘」가 place_concept 를 승격한다", () => {
    for (const label of conceptFacilityTemplateLabels()) {
      expect(PLACE_CONCEPT_TOOL.description, label).toContain(label);
      expect(capabilityEscalatedToolNames(`${label} 지어줘`, new Set()), `${label} 지어줘`).toContain("place_concept");
      expect(capabilityEscalatedToolNames(`${label} 하나 만들어줘`, new Set()), `${label} 하나 만들어줘`).toContain("place_concept");
    }
  });

  it("시스템 프롬프트: 초안 그대로면 시설명 한 줄, 사용자가 고친 나무면 시설별 줄에 바닥·벽 재질", () => {
    // 빈 프로젝트의 프롬프트는 20,000자 예산 중 약 19,250자를 이미 쓴다 — 초안 9종을 시설별로 싣으면
    // 뒤의 스타일 문서 발췌가 밀려난다(test/worldAiExclusion). 초안일 때는 한 줄, 고친 나무일 때만 상세.
    const blank = createBlankProject();
    const compact = buildSystemPrompt(blank, { currentMapId: blank.startMapId, budgetChars: 50_000 });
    const section = compact.slice(compact.indexOf("## 개념 꾸러미"), compact.indexOf("## 타일셋 실내 문법"));
    expect(section.length).toBeLessThan(600);
    expect(section).toContain("query=시설명");
    for (const label of conceptFacilityTemplateLabels()) expect(section, label).toContain(label);
    expect(section).not.toContain("석재 벽돌");

    const edited = createBlankProject();
    ensureConceptBundles(edited, INTERIOR_ROOM_TILESET_ID);
    const detailed = buildSystemPrompt(edited, { currentMapId: edited.startMapId, budgetChars: 50_000 });
    for (const label of conceptFacilityTemplateLabels()) expect(detailed, label).toContain(`query="${label}"`);
    expect(detailed).toContain("석재 벽돌");
    expect(detailed).toContain("돌 바닥");
  });
});

describe("개념 꾸러미 초안 묶음 — 시공", () => {
  for (const bundle of CONCEPT_FACILITY_TEMPLATES) {
    it(`${bundle.label}: plan/walkability 경고 없이 서고 물건이 전부 앉는다`, () => {
      const built = buildTemplate(bundle);
      const bad = built.warnings.filter((line) => line.startsWith("plan:") || line.startsWith("walkability:") || line.includes("자리 없음") || line.includes("정의를 찾지 못함"));
      expect(bad, `${bundle.label}\n${built.warnings.join("\n")}`).toEqual([]);
      for (const thing of bundle.things.filter((entry) => entry.required)) {
        expect(mapHasObject(built.map, thing.objectId), `${bundle.label}: 필수 ${thing.label}(${thing.objectId}) 없음`).toBe(true);
      }
      const layout = layoutConceptFacility(bundle, bundle.facilities[0]!);
      expect(built.rooms.length).toBe(layout.rooms.length);
      expect(built.map.events.some((event) => event.id.startsWith("ev_concept_")), `${bundle.label}: 칩 이벤트 없음`).toBe(true);
    });
  }

  it("도면은 불필요한 바깥 여백 없이 구조물에 딱 맞는다 — 축소 회귀 계약", () => {
    for (const bundle of CONCEPT_FACILITY_TEMPLATES) {
      const layout = layoutConceptFacility(bundle, bundle.facilities[0]!);
      const right = Math.max(...layout.rooms.map((room) => room.x + room.w));
      // 구조물 오른쪽 끝에서 맵 오른쪽 끝까지 2열 이하 (벽+천장 보더 1 + 여유 1).
      expect(layout.width - right, `${bundle.id} 가로 여백`).toBeLessThanOrEqual(2);
      // 정문 아래는 출구 계단+천장 여백 2행이면 충분하다.
      expect(layout.height - layout.door.y, `${bundle.id} 세로 여백`).toBeLessThanOrEqual(3);
    }
  });

  it("도면은 시설마다 다르다 — 방 수·정문·너비가 한 가지로 수렴하지 않는다", () => {
    const shapes = new Set(CONCEPT_FACILITY_TEMPLATES.map((bundle) => {
      const layout = layoutConceptFacility(bundle, bundle.facilities[0]!);
      return `${layout.rooms.length}:${layout.width}x${layout.height}`;
    }));
    expect(shapes.size).toBeGreaterThanOrEqual(5);
  });

  it("대장간은 돌 바닥·석재 벽돌로, 길드는 금빛 벽돌로 선다", () => {
    const smithy = buildTemplate(SCRATCH_SMITHY_BUNDLE);
    expect(smithy.wallMaterial).toBe("stone-brick");
    const workshop = smithy.rooms.find((room) => room.placeId === "workshop")!;
    expect(workshop.floorTile).toBe(CONCEPT_FLOOR_TILES.stone);
    let stone = 0;
    for (let y = workshop.y; y < workshop.y + workshop.h; y += 1) {
      for (let x = workshop.x; x < workshop.x + workshop.w; x += 1) {
        if (smithy.map.lowerTiles[y * smithy.map.width + x] === CONCEPT_FLOOR_TILES.stone) stone += 1;
      }
    }
    expect(stone).toBeGreaterThan(workshop.w * workshop.h / 2);
    // 크림 벽면(74–77/104–107)이 남아 있지 않다 — 석재 세트로 리틴트됐다.
    const creamFace = smithy.map.lowerTiles.filter((tile) => [74, 75, 76, 77, 104, 105, 106, 107].includes(tile)).length;
    expect(creamFace).toBe(0);
    const guild = buildTemplate(SCRATCH_GUILD_BUNDLE);
    expect(guild.wallMaterial).toBe("gold-brick");
    const inn = buildTemplate(SCRATCH_INN_BUNDLE);
    expect(inn.wallMaterial).toBe("cream");
    expect(inn.map.lowerTiles.filter((tile) => [74, 75, 76, 77, 104, 105, 106, 107].includes(tile)).length).toBeGreaterThan(0);
  });

  it("창고는 방 하나짜리 시설이고 상자·술통 적재와 노획 이벤트를 보존한다", () => {
    const built = buildTemplate(SCRATCH_WAREHOUSE_BUNDLE);
    expect(built.rooms).toHaveLength(1);
    expect(built.rooms[0]!.role).toBe("entrance");
    const crate = objectTiles("crate");
    const barrel = objectTiles("barrel");
    const crates = built.map.lowerTiles.filter((tile) => crate.has(tile)).length;
    const barrels = built.map.upperTiles.filter((tile) => barrel.has(tile)).length;
    expect(crates).toBe(6);
    expect(barrels).toBe(4);
    const loots = built.map.events.filter((event) => event.id.startsWith("ev_concept_") && (event.pages ?? []).length === 2);
    expect(loots.length).toBe(3);
  });
});
