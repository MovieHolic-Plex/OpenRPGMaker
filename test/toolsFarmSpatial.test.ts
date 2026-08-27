// 농장 공간 저작 파사드: 2026-08-27 커버리지 감사가 "UI 는 쓰는데 툴은 못 쓴다"로 집어낸
// database.farmBuildingTypes / database.homeDecorationTypes / system.farmAnimalBuildings /
// session.farmAnimals·farmBuildingPlacements·homeDecorationPlacements 를 실제로 쓰는지 증명한다.
// 거부 경로는 "모델이 다음 수를 둘 수 있는 메시지"인지(유효 값 나열) 함께 고정한다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const MAP_ID = "map_blank_start";
// graphicResourceId 는 참조다 — 프로젝트 무결성 검사가 실재하는 리소스를 요구하므로
// 픽스처가 upsert_resource 로 먼저 등록한다(에디터도 등록된 소재만 고르게 한다).
const GRAPHIC_IDS = ["res_barn_1", "res_barn_2", "res_table", "res_table_left", "res_farm_shed", "res_home_rug"] as const;

function context(): ToolContext {
  const project: Project = createBlankProject();
  const itemId = project.database.items[0]?.id;
  if (!itemId) throw new Error("blank project must contain an item fixture");
  project.database.farmAnimalSpecies = [{
    id: "species_cow",
    name: "소",
    feedItemId: itemId,
    productItemId: itemId,
    productCount: 1,
    productEveryDays: 1,
    petFriendship: 0,
  }];
  const ctx: ToolContext = { project };
  for (const id of GRAPHIC_IDS) {
    const registered = runTool(ctx, "upsert_resource", { resource: { id, name: id, kind: "chipset" } });
    if (!registered.ok) throw new Error(`fixture resource ${id} failed: ${firstMessage(registered)}`);
  }
  return ctx;
}

function itemId(ctx: ToolContext): string {
  const id = ctx.project.database.items[0]?.id;
  if (!id) throw new Error("blank project must contain an item fixture");
  return id;
}

function firstMessage(result: ToolResult): string {
  return result.issues?.[0]?.message ?? result.summary;
}

function seedTypes(ctx: ToolContext): void {
  const graphicResourceId = "res_farm_shed";
  ctx.project.database.farmBuildingTypes = [{
    id: "type_shed",
    name: "창고",
    levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId }],
  }];
  ctx.project.database.homeDecorationTypes = [{
    id: "type_rug",
    name: "러그",
    placementItemId: itemId(ctx),
    footprint: { width: 1, height: 1 },
    blocksMovement: false,
    allowedOrientations: ["down"],
    graphicResourceId: "res_home_rug",
  }];
}

describe("upsert_farm_building_type — database.farmBuildingTypes", () => {
  it("레벨/발자국/비용까지 database.farmBuildingTypes 에 쓴다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_building_type", {
      buildingType: {
        id: "type_barn",
        name: "곳간",
        allowedMapIds: [MAP_ID],
        levels: [
          { level: 1, footprint: { width: 3, height: 2 }, capacity: 6, graphicResourceId: "res_barn_1" },
          {
            level: 2,
            name: "곳간 확장",
            footprint: { width: 3, height: 3 },
            capacity: 10,
            graphicResourceId: "res_barn_2",
            cost: { gold: 500, items: [{ itemId: itemId(ctx), count: 3 }] },
          },
        ],
      },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    const record = ctx.project.database.farmBuildingTypes?.find((entry) => entry.id === "type_barn");
    expect(record?.name).toBe("곳간");
    expect(record?.allowedMapIds).toEqual([MAP_ID]);
    expect(record?.levels).toHaveLength(2);
    expect(record?.levels[0]?.footprint).toEqual({ width: 3, height: 2 });
    expect(record?.levels[1]?.capacity).toBe(10);
    expect(record?.levels[1]?.cost?.gold).toBe(500);
    expect(record?.levels[1]?.cost?.items).toEqual([{ itemId: itemId(ctx), count: 3 }]);
  });

  it("같은 id 는 교체한다(중복 추가 금지)", () => {
    const ctx = context();
    const args = (name: string) => ({
      buildingType: {
        id: "type_barn",
        name,
        levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId: "res_barn_1" }],
      },
    });
    expect(runTool(ctx, "upsert_farm_building_type", args("곳간")).ok).toBe(true);
    const second = runTool(ctx, "upsert_farm_building_type", args("큰 곳간"));
    expect(second.ok, firstMessage(second)).toBe(true);
    expect(ctx.project.database.farmBuildingTypes).toHaveLength(1);
    expect(ctx.project.database.farmBuildingTypes?.[0]?.name).toBe("큰 곳간");
  });

  it("없는 맵을 allowedMapIds 로 주면 유효한 맵 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_building_type", {
      buildingType: {
        id: "type_barn",
        name: "곳간",
        allowedMapIds: ["map_nope"],
        levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId: "res_barn_1" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("map_nope");
    expect(firstMessage(result)).toContain(MAP_ID);
    expect(ctx.project.database.farmBuildingTypes ?? []).toEqual([]);
  });

  it("등록되지 않은 graphicResourceId 는 유효한 리소스 id 와 등록 수단을 밝히며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_building_type", {
      buildingType: {
        id: "type_barn",
        name: "곳간",
        levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId: "res_nope" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("res_nope");
    expect(firstMessage(result)).toContain("res_barn_1");
    expect(firstMessage(result)).toContain("upsert_resource");
    expect(ctx.project.database.farmBuildingTypes ?? []).toEqual([]);
  });

  it("레벨이 비면 요구사항을 밝히며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_building_type", {
      buildingType: { id: "type_barn", name: "곳간", levels: [] },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("levels");
  });
});

describe("upsert_home_decoration_type — database.homeDecorationTypes", () => {
  it("배치 아이템/발자국/방향을 database.homeDecorationTypes 에 쓴다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_home_decoration_type", {
      decorationType: {
        id: "type_table",
        name: "식탁",
        placementItemId: itemId(ctx),
        footprint: { width: 2, height: 1 },
        blocksMovement: true,
        allowedOrientations: ["down", "left"],
        graphicResourceId: "res_table",
        orientationGraphicResourceIds: { left: "res_table_left" },
        allowedMapIds: [MAP_ID],
      },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    const record = ctx.project.database.homeDecorationTypes?.find((entry) => entry.id === "type_table");
    expect(record?.placementItemId).toBe(itemId(ctx));
    expect(record?.footprint).toEqual({ width: 2, height: 1 });
    expect(record?.blocksMovement).toBe(true);
    expect(record?.allowedOrientations).toEqual(["down", "left"]);
    expect(record?.graphicResourceId).toBe("res_table");
    expect(record?.orientationGraphicResourceIds?.left).toBe("res_table_left");
    expect(record?.allowedMapIds).toEqual([MAP_ID]);
  });

  it("등록되지 않은 graphicResourceId 는 유효한 리소스 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_home_decoration_type", {
      decorationType: {
        id: "type_table",
        name: "식탁",
        placementItemId: itemId(ctx),
        footprint: { width: 1, height: 1 },
        allowedOrientations: ["down"],
        graphicResourceId: "res_nope",
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("res_nope");
    expect(firstMessage(result)).toContain("res_table");
    expect(ctx.project.database.homeDecorationTypes ?? []).toEqual([]);
  });

  it("없는 아이템을 placementItemId 로 주면 유효한 아이템 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_home_decoration_type", {
      decorationType: {
        id: "type_table",
        name: "식탁",
        placementItemId: "item_nope",
        footprint: { width: 1, height: 1 },
        allowedOrientations: ["down"],
        graphicResourceId: "res_table",
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("item_nope");
    expect(firstMessage(result)).toContain(itemId(ctx));
    expect(ctx.project.database.homeDecorationTypes ?? []).toEqual([]);
  });
});

describe("upsert_farm_animal_building — system.farmAnimalBuildings", () => {
  it("맵/좌표/수용량/허용 종을 system.farmAnimalBuildings 에 쓴다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_animal_building", {
      building: { id: "building_barn", name: "축사", mapId: MAP_ID, x: 3, y: 4, capacity: 6, allowedSpeciesIds: ["species_cow"] },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    const record = ctx.project.system.farmAnimalBuildings?.find((entry) => entry.id === "building_barn");
    expect(record).toEqual({
      id: "building_barn",
      name: "축사",
      mapId: MAP_ID,
      x: 3,
      y: 4,
      capacity: 6,
      allowedSpeciesIds: ["species_cow"],
    });
  });

  it("없는 맵은 유효한 맵 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_animal_building", {
      building: { id: "building_barn", name: "축사", mapId: "map_nope", x: 0, y: 0, capacity: 4, allowedSpeciesIds: [] },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain(MAP_ID);
    expect(ctx.project.system.farmAnimalBuildings ?? []).toEqual([]);
  });

  it("없는 가축 종은 유효한 종 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_animal_building", {
      building: { id: "building_barn", name: "축사", mapId: MAP_ID, x: 0, y: 0, capacity: 4, allowedSpeciesIds: ["species_nope"] },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("species_nope");
    expect(firstMessage(result)).toContain("species_cow");
  });

  it("맵 범위를 벗어난 좌표는 범위를 밝히며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_farm_animal_building", {
      building: { id: "building_barn", name: "축사", mapId: MAP_ID, x: 99, y: 0, capacity: 4, allowedSpeciesIds: [] },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("20");
    expect(firstMessage(result)).toContain("15");
  });
});

describe("set_session_farm_state — 시작 상태 3배열", () => {
  it("가축/건물 배치/집 장식 배치를 각각 쓴다", () => {
    const ctx = context();
    seedTypes(ctx);
    ctx.project.system.farmAnimalBuildings = [{
      id: "building_barn",
      name: "축사",
      mapId: MAP_ID,
      x: 1,
      y: 1,
      capacity: 4,
      allowedSpeciesIds: ["species_cow"],
    }];
    const result = runTool(ctx, "set_session_farm_state", {
      farmAnimals: { upsert: [{ instanceId: "animal_1", speciesId: "species_cow", name: "누렁이", buildingId: "building_barn" }] },
      farmBuildingPlacements: {
        upsert: [{ instanceId: "place_shed", typeId: "type_shed", level: 1, mapId: MAP_ID, x: 2, y: 3, orientation: "down" }],
      },
      homeDecorationPlacements: {
        upsert: [{ instanceId: "place_rug", typeId: "type_rug", mapId: MAP_ID, x: 5, y: 6, orientation: "down" }],
      },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    expect(ctx.project.session.farmAnimals).toEqual([
      { instanceId: "animal_1", speciesId: "species_cow", name: "누렁이", buildingId: "building_barn" },
    ]);
    expect(ctx.project.session.farmBuildingPlacements).toEqual([
      { instanceId: "place_shed", typeId: "type_shed", level: 1, mapId: MAP_ID, x: 2, y: 3, orientation: "down" },
    ]);
    expect(ctx.project.session.homeDecorationPlacements).toEqual([
      { instanceId: "place_rug", typeId: "type_rug", mapId: MAP_ID, x: 5, y: 6, orientation: "down" },
    ]);
  });

  it("한 섹션만 보내면 다른 섹션은 보존한다", () => {
    const ctx = context();
    seedTypes(ctx);
    ctx.project.session.homeDecorationPlacements = [
      { instanceId: "place_rug", typeId: "type_rug", mapId: MAP_ID, x: 5, y: 6, orientation: "down" },
    ];
    const result = runTool(ctx, "set_session_farm_state", {
      farmAnimals: { upsert: [{ instanceId: "animal_1", speciesId: "species_cow", name: "누렁이" }] },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    expect(ctx.project.session.farmAnimals?.map((entry) => entry.instanceId)).toEqual(["animal_1"]);
    expect(ctx.project.session.homeDecorationPlacements).toHaveLength(1);
  });

  it("instanceId 로 upsert 하고 remove 로 지운다", () => {
    const ctx = context();
    seedTypes(ctx);
    ctx.project.session.farmAnimals = [
      { instanceId: "animal_1", speciesId: "species_cow", name: "누렁이" },
      { instanceId: "animal_2", speciesId: "species_cow", name: "검둥이" },
    ];
    ctx.project.session.farmBuildingPlacements = [
      { instanceId: "place_shed", typeId: "type_shed", level: 1, mapId: MAP_ID, x: 2, y: 3, orientation: "down" },
    ];
    const result = runTool(ctx, "set_session_farm_state", {
      farmAnimals: {
        upsert: [{ instanceId: "animal_2", speciesId: "species_cow", name: "이름 바꿈" }],
        remove: ["animal_1"],
      },
      farmBuildingPlacements: { remove: ["place_shed"] },
    });
    expect(result.ok, firstMessage(result)).toBe(true);
    expect(ctx.project.session.farmAnimals).toEqual([
      { instanceId: "animal_2", speciesId: "species_cow", name: "이름 바꿈" },
    ]);
    expect(ctx.project.session.farmBuildingPlacements).toEqual([]);
  });

  it("없는 speciesId 는 유효한 종 id 를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "set_session_farm_state", {
      farmAnimals: { upsert: [{ instanceId: "animal_1", speciesId: "species_nope", name: "누렁이" }] },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("species_nope");
    expect(firstMessage(result)).toContain("species_cow");
    expect(ctx.project.session.farmAnimals ?? []).toEqual([]);
  });

  it("없는 typeId 는 유효한 유형 id 를 알려주며 거부한다", () => {
    const ctx = context();
    seedTypes(ctx);
    const result = runTool(ctx, "set_session_farm_state", {
      farmBuildingPlacements: {
        upsert: [{ instanceId: "place_x", typeId: "type_nope", level: 1, mapId: MAP_ID, x: 1, y: 1, orientation: "down" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("type_nope");
    expect(firstMessage(result)).toContain("type_shed");
    expect(ctx.project.session.farmBuildingPlacements ?? []).toEqual([]);
  });

  it("맵 범위를 벗어난 배치는 범위를 밝히며 거부한다", () => {
    const ctx = context();
    seedTypes(ctx);
    const result = runTool(ctx, "set_session_farm_state", {
      homeDecorationPlacements: {
        upsert: [{ instanceId: "place_rug", typeId: "type_rug", mapId: MAP_ID, x: 1, y: 99, orientation: "down" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("15");
    expect(ctx.project.session.homeDecorationPlacements ?? []).toEqual([]);
  });

  it("빈 인자는 바꿀 섹션이 없다고 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "set_session_farm_state", {});
    expect(result.ok).toBe(false);
    expect(firstMessage(result)).toContain("farmAnimals");
  });
});
