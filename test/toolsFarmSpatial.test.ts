import { describe, expect, it, vi } from "vitest";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

vi.mock("../electron/shared/lifeSim", () => ({ LIFE_SIM_ENABLED: true, LIFE_SIM_CLOSED_TITLE: "", LIFE_SIM_CLOSED_BODY: "", LIFE_SIM_CLOSED_NOTICE: "" }));

// 농장 공간 저작 파사드: 2026-08-27 커버리지 감사가 "UI 는 쓰는데 툴은 못 쓴다"로 집어낸
// database.farmBuildingTypes / database.homeDecorationTypes / system.farmAnimalBuildings /
// session.farmAnimals·farmBuildingPlacements·homeDecorationPlacements 를 실제로 쓰는지 증명한다.
// 거부 경로는 "모델이 다음 수를 둘 수 있는 메시지"인지(유효 값 나열) 함께 고정한다.
describe("toolsFarmSpatial", () => {
  isolateTimers();
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
});

// 생활 수집 저작 파사드(어종/낚시터/계절 채집/박물관/수집 도감)가 실제로 어느 Project 필드를
// 쓰는지, 그리고 잘못된 id 를 모델이 고칠 수 있는 메시지로 거부하는지 고정한다.
// 2026-08-27 커버리지 감사에서 "UI 는 쓰는데 툴은 못 쓰는" 필드로 지목된 지점들이다.
describe("toolsLifeCollections", () => {
  isolateTimers();
  const ITEM_ID = "item_potion";
  const OTHER_ITEM_ID = "item_capture_orb";
  function context(): ToolContext {
    return { project: createBlankProject() };
  }
  function mapId(ctx: ToolContext): string {
    return ctx.project.startMapId;
  }
  function errorText(result: ToolResult): string {
    return [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" | ");
  }
  function seedFish(ctx: ToolContext, id: string, itemId = ITEM_ID): void {
    const result = runTool(ctx, "upsert_fish_species", { fish: { id, name: id, itemId, skillXp: 5 } });
    expect(result.ok, errorText(result)).toBe(true);
  }
  describe("upsert_fish_species / delete_fish_species → database.fishSpecies", () => {
    it("writes the record and updates in place on the second upsert", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      expect(ctx.project.database.fishSpecies).toEqual([
        { id: "fish_river", name: "fish_river", itemId: ITEM_ID, skillXp: 5 },
      ]);

      const renamed = runTool(ctx, "upsert_fish_species", { fish: { id: "fish_river", name: "강 물고기", itemId: OTHER_ITEM_ID } });
      expect(renamed.ok, errorText(renamed)).toBe(true);
      expect(ctx.project.database.fishSpecies).toHaveLength(1);
      expect(ctx.project.database.fishSpecies?.[0]?.name).toBe("강 물고기");
      expect(ctx.project.database.fishSpecies?.[0]?.itemId).toBe(OTHER_ITEM_ID);
    });

    it("rejects an unknown itemId and names valid item ids", () => {
      const ctx = context();
      const result = runTool(ctx, "upsert_fish_species", { fish: { id: "fish_bad", name: "x", itemId: "item_nope" } });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain(ITEM_ID);
      expect(ctx.project.database.fishSpecies ?? []).toHaveLength(0);
    });

    it("deletes by id and prunes fishing catches that referenced the species", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      seedFish(ctx, "fish_lake");
      const spots = runTool(ctx, "configure_fishing", {
        enabled: true,
        spots: [
          { id: "spot_river", mapId: mapId(ctx), area: { x: 0, y: 0, w: 3, h: 3 }, catches: [{ fishId: "fish_river", weight: 1 }] },
          { id: "spot_mixed", mapId: mapId(ctx), area: { x: 4, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_river", weight: 1 }, { fishId: "fish_lake", weight: 2 }] },
        ],
      });
      expect(spots.ok, errorText(spots)).toBe(true);

      const deleted = runTool(ctx, "delete_fish_species", { id: "fish_river" });
      expect(deleted.ok, errorText(deleted)).toBe(true);
      expect(ctx.project.database.fishSpecies?.map((row) => row.id)).toEqual(["fish_lake"]);
      expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_mixed"]);
      expect(ctx.project.system.fishing?.spots[0]?.catches.map((row) => row.fishId)).toEqual(["fish_lake"]);
    });

    it("rejects deleting an unknown fish and names the existing ids", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      const result = runTool(ctx, "delete_fish_species", { id: "fish_ghost" });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain("fish_river");
    });
  });
  describe("configure_fishing → system.fishing", () => {
    it("writes spots with area and catch filters, merges by id, and keeps sibling systems", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      seedFish(ctx, "fish_lake");
      const museum = runTool(ctx, "configure_museum", {
        enabled: true,
        eligibleItemIds: [ITEM_ID],
        rewards: [{ id: "museum_first", name: "첫 기부", minDonations: 1, reward: { gold: 100 } }],
      });
      expect(museum.ok, errorText(museum)).toBe(true);

      const first = runTool(ctx, "configure_fishing", {
        enabled: true,
        energyCost: 2,
        spots: [{
          id: "spot_river",
          name: "강 낚시터",
          mapId: mapId(ctx),
          area: { x: 1, y: 2, w: 4, h: 3 },
          catches: [{ fishId: "fish_river", weight: 3, seasons: ["spring", "summer"], timePhases: ["morning"], weatherKinds: ["none", "rain"], minSkillLevel: 2 }],
        }],
      });
      expect(first.ok, errorText(first)).toBe(true);
      const fishing = ctx.project.system.fishing;
      expect(fishing?.enabled).toBe(true);
      expect(fishing?.energyCost).toBe(2);
      expect(fishing?.spots).toHaveLength(1);
      expect(fishing?.spots[0]?.area).toEqual({ x: 1, y: 2, w: 4, h: 3 });
      expect(fishing?.spots[0]?.catches[0]).toEqual({
        fishId: "fish_river",
        weight: 3,
        seasons: ["spring", "summer"],
        timePhases: ["morning"],
        weatherKinds: ["none", "rain"],
        minSkillLevel: 2,
      });

      const second = runTool(ctx, "configure_fishing", {
        spots: [{ id: "spot_lake", mapId: mapId(ctx), area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_lake", weight: 1 }] }],
      });
      expect(second.ok, errorText(second)).toBe(true);
      expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_river", "spot_lake"]);
      expect(ctx.project.system.fishing?.energyCost).toBe(2);
      expect(ctx.project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first"]);

      const replaced = runTool(ctx, "configure_fishing", {
        replaceSpots: true,
        spots: [{ id: "spot_lake", mapId: mapId(ctx), area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_lake", weight: 1 }] }],
      });
      expect(replaced.ok, errorText(replaced)).toBe(true);
      expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_lake"]);
    });

    it("rejects an unknown mapId and names valid map ids", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      const result = runTool(ctx, "configure_fishing", {
        spots: [{ id: "spot_bad", mapId: "map_nope", area: { x: 0, y: 0, w: 1, h: 1 }, catches: [{ fishId: "fish_river", weight: 1 }] }],
      });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain(mapId(ctx));
      expect(ctx.project.system.fishing).toBeUndefined();
    });

    it("rejects an unknown fishId and names valid fish ids", () => {
      const ctx = context();
      seedFish(ctx, "fish_river");
      const result = runTool(ctx, "configure_fishing", {
        spots: [{ id: "spot_bad", mapId: mapId(ctx), area: { x: 0, y: 0, w: 1, h: 1 }, catches: [{ fishId: "fish_ghost", weight: 1 }] }],
      });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain("fish_river");
    });
  });
  describe("configure_seasonal_forage → system.seasonalForage", () => {
    it("writes areas with spawn policy and merges a second area by id", () => {
      const ctx = context();
      const first = runTool(ctx, "configure_seasonal_forage", {
        enabled: true,
        areas: [{
          id: "forage_farm",
          name: "농장 채집",
          mapId: mapId(ctx),
          area: { x: 0, y: 0, w: 5, h: 5 },
          dailySpawnCount: 2,
          maxActive: 6,
          despawnAfterDays: 3,
          entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: ITEM_ID, winter: OTHER_ITEM_ID } }],
        }],
      });
      expect(first.ok, errorText(first)).toBe(true);
      const forage = ctx.project.system.seasonalForage;
      expect(forage?.enabled).toBe(true);
      expect(forage?.areas[0]).toEqual({
        id: "forage_farm",
        name: "농장 채집",
        mapId: mapId(ctx),
        area: { x: 0, y: 0, w: 5, h: 5 },
        dailySpawnCount: 2,
        maxActive: 6,
        despawnAfterDays: 3,
        entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: ITEM_ID, winter: OTHER_ITEM_ID } }],
      });

      const second = runTool(ctx, "configure_seasonal_forage", {
        areas: [{
          id: "forage_woods",
          mapId: mapId(ctx),
          area: { x: 6, y: 6, w: 3, h: 3 },
          dailySpawnCount: 1,
          maxActive: 2,
          despawnAfterDays: 2,
          entries: [{ id: "forage_wood", weight: 1, itemId: ITEM_ID }],
        }],
      });
      expect(second.ok, errorText(second)).toBe(true);
      expect(ctx.project.system.seasonalForage?.areas.map((area) => area.id)).toEqual(["forage_farm", "forage_woods"]);
    });

    it("rejects an unknown drop itemId and names valid item ids", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_seasonal_forage", {
        areas: [{
          id: "forage_bad",
          mapId: mapId(ctx),
          area: { x: 0, y: 0, w: 1, h: 1 },
          dailySpawnCount: 1,
          maxActive: 1,
          despawnAfterDays: 1,
          entries: [{ id: "forage_x", weight: 1, itemId: "item_nope" }],
        }],
      });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain(ITEM_ID);
      expect(ctx.project.system.seasonalForage).toBeUndefined();
    });
  });
  describe("configure_museum → system.museum", () => {
    it("writes eligible items and rewards, unions ids and merges rewards by id", () => {
      const ctx = context();
      const first = runTool(ctx, "configure_museum", {
        enabled: true,
        eligibleItemIds: [ITEM_ID],
        rewards: [{ id: "museum_first", name: "첫 기부", minDonations: 1, reward: { gold: 50, itemRewards: [{ itemId: ITEM_ID, count: 1 }] } }],
      });
      expect(first.ok, errorText(first)).toBe(true);
      expect(ctx.project.system.museum?.eligibleItemIds).toEqual([ITEM_ID]);
      expect(ctx.project.system.museum?.rewards[0]).toEqual({
        id: "museum_first",
        name: "첫 기부",
        minDonations: 1,
        reward: { gold: 50, itemRewards: [{ itemId: ITEM_ID, count: 1 }] },
      });

      const second = runTool(ctx, "configure_museum", {
        eligibleItemIds: [OTHER_ITEM_ID],
        rewards: [{ id: "museum_full", requiredItemIds: [ITEM_ID, OTHER_ITEM_ID], reward: { gold: 500 } }],
      });
      expect(second.ok, errorText(second)).toBe(true);
      expect(ctx.project.system.museum?.eligibleItemIds).toEqual([ITEM_ID, OTHER_ITEM_ID]);
      expect(ctx.project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first", "museum_full"]);
      expect(ctx.project.system.museum?.enabled).toBe(true);
    });

    it("rejects an unknown eligible itemId and names valid item ids", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_museum", { enabled: true, eligibleItemIds: ["item_nope"] });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain(ITEM_ID);
      expect(ctx.project.system.museum).toBeUndefined();
    });
  });
  describe("configure_collections → system.collections", () => {
    it("writes trackedItemIds, unions on merge and replaces on demand", () => {
      const ctx = context();
      const first = runTool(ctx, "configure_collections", { enabled: true, trackedItemIds: [ITEM_ID] });
      expect(first.ok, errorText(first)).toBe(true);
      expect(ctx.project.system.collections).toEqual({ enabled: true, trackedItemIds: [ITEM_ID] });

      const second = runTool(ctx, "configure_collections", { trackedItemIds: [OTHER_ITEM_ID] });
      expect(second.ok, errorText(second)).toBe(true);
      expect(ctx.project.system.collections?.trackedItemIds).toEqual([ITEM_ID, OTHER_ITEM_ID]);

      const replaced = runTool(ctx, "configure_collections", { replaceTrackedItemIds: true, trackedItemIds: [OTHER_ITEM_ID] });
      expect(replaced.ok, errorText(replaced)).toBe(true);
      expect(ctx.project.system.collections?.trackedItemIds).toEqual([OTHER_ITEM_ID]);
    });

    it("rejects an unknown tracked itemId and names valid item ids", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_collections", { enabled: true, trackedItemIds: ["item_nope"] });
      expect(result.ok).toBe(false);
      expect(errorText(result)).toContain(ITEM_ID);
      expect(ctx.project.system.collections).toBeUndefined();
    });
  });
});
