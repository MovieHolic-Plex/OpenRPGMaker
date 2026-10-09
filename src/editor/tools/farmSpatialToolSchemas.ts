// editor/tools/farmSpatialToolSchemas.ts
// farmSpatialTools.ts 의 파라미터 스키마. 객체 파라미터는 반드시 실제 properties 를 선언한다
// (bare {type:"object"} 는 strict function-calling 에서 모델이 {} 만 보내게 만든다 —
// openwiki/editor-ai-tools.md 2026-08-23 실측 사건). 유니온(oneOf/anyOf)은 쓰지 않는다.
import { SPATIAL_ORIENTATIONS } from "@/project/spatialPlacements";
import type { JsonSchema } from "./types";

const ORIENTATION_SCHEMA: JsonSchema = { type: "string", enum: [...SPATIAL_ORIENTATIONS] };

const FOOTPRINT_SCHEMA: JsonSchema = {
  type: "object",
  description: "타일 단위 발자국. 1..16, 넓이 합 128 이하.",
  properties: { width: { type: "integer" }, height: { type: "integer" } },
  required: ["width", "height"],
};

const ORIENTATION_GRAPHICS_SCHEMA: JsonSchema = {
  type: "object",
  description: "방향별 그래픽 리소스 id. 생략한 방향은 graphicResourceId 를 쓴다.",
  properties: {
    down: { type: "string" },
    left: { type: "string" },
    right: { type: "string" },
    up: { type: "string" },
  },
};

const COST_SCHEMA: JsonSchema = {
  type: "object",
  description: "건설/업그레이드 비용. gold 와 items 중 하나만 줘도 된다.",
  properties: {
    gold: { type: "integer" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { itemId: { type: "string" }, count: { type: "integer" } },
        required: ["itemId", "count"],
      },
    },
  },
};

export const FARM_BUILDING_TYPE_PARAMETERS: JsonSchema = {
  type: "object",
  properties: {
    buildingType: {
      type: "object",
      description: "범용 농장 건물 유형. levels 는 level 1 부터 빈틈 없이 오름차순.",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        levels: {
          type: "array",
          description: "레벨 정의. level 1 이 신축, 이후 레벨이 업그레이드.",
          items: {
            type: "object",
            properties: {
              level: { type: "integer" },
              name: { type: "string" },
              footprint: FOOTPRINT_SCHEMA,
              capacity: { type: "integer" },
              cost: COST_SCHEMA,
              graphicResourceId: { type: "string" },
              orientationGraphicResourceIds: ORIENTATION_GRAPHICS_SCHEMA,
            },
            required: ["level", "footprint", "capacity", "graphicResourceId"],
          },
        },
        allowedMapIds: {
          type: "array",
          description: "배치 가능한 맵 id. 생략/빈 배열이면 모든 맵 허용.",
          items: { type: "string" },
        },
      },
      required: ["id", "name", "levels"],
    },
  },
  required: ["buildingType"],
};

export const HOME_DECORATION_TYPE_PARAMETERS: JsonSchema = {
  type: "object",
  properties: {
    decorationType: {
      type: "object",
      description: "집 장식 유형. placementItemId 는 배치에 소모되는 DB 아이템.",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        placementItemId: { type: "string" },
        footprint: FOOTPRINT_SCHEMA,
        blocksMovement: { type: "boolean", description: "생략 시 true(통행 차단)." },
        allowedOrientations: {
          type: "array",
          description: "허용 방향. 생략 시 down.",
          items: ORIENTATION_SCHEMA,
        },
        graphicResourceId: { type: "string" },
        orientationGraphicResourceIds: ORIENTATION_GRAPHICS_SCHEMA,
        allowedMapIds: {
          type: "array",
          description: "배치 가능한 맵 id. 생략/빈 배열이면 모든 맵 허용.",
          items: { type: "string" },
        },
      },
      required: ["id", "name", "placementItemId", "graphicResourceId"],
    },
  },
  required: ["decorationType"],
};

export const FARM_ANIMAL_BUILDING_PARAMETERS: JsonSchema = {
  type: "object",
  properties: {
    building: {
      type: "object",
      description: "P1 축사(가축 집). 좌표는 mapId 맵 범위 안이어야 한다.",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        mapId: { type: "string" },
        x: { type: "integer" },
        y: { type: "integer" },
        capacity: { type: "integer" },
        allowedSpeciesIds: {
          type: "array",
          description: "허용 가축 종 id(database.farmAnimalSpecies). 빈 배열이면 어떤 종도 못 들어간다.",
          items: { type: "string" },
        },
      },
      required: ["id", "name", "mapId", "x", "y"],
    },
  },
  required: ["building"],
};

export const SESSION_FARM_STATE_PARAMETERS: JsonSchema = {
  type: "object",
  description: "세 섹션은 각각 독립이다. 보낸 섹션만 바뀌고 나머지 섹션은 그대로 보존된다.",
  properties: {
    farmAnimals: {
      type: "object",
      description: "시작 가축(session.farmAnimals). instanceId 로 upsert, remove 로 삭제.",
      properties: {
        upsert: {
          type: "array",
          items: {
            type: "object",
            properties: {
              instanceId: { type: "string" },
              speciesId: { type: "string" },
              name: { type: "string" },
              buildingId: { type: "string", description: "system.farmAnimalBuildings 의 축사 id" },
              eventId: { type: "string" },
            },
            required: ["instanceId", "speciesId", "name"],
          },
        },
        remove: { type: "array", items: { type: "string" } },
      },
    },
    farmBuildingPlacements: {
      type: "object",
      description: "시작 범용 농장 건물 배치(session.farmBuildingPlacements).",
      properties: {
        upsert: {
          type: "array",
          items: {
            type: "object",
            properties: {
              instanceId: { type: "string" },
              typeId: { type: "string", description: "database.farmBuildingTypes 의 유형 id" },
              level: { type: "integer", description: "생략 시 1" },
              mapId: { type: "string" },
              x: { type: "integer" },
              y: { type: "integer" },
              orientation: ORIENTATION_SCHEMA,
            },
            required: ["instanceId", "typeId", "mapId", "x", "y"],
          },
        },
        remove: { type: "array", items: { type: "string" } },
      },
    },
    homeDecorationPlacements: {
      type: "object",
      description: "시작 집 장식 배치(session.homeDecorationPlacements).",
      properties: {
        upsert: {
          type: "array",
          items: {
            type: "object",
            properties: {
              instanceId: { type: "string" },
              typeId: { type: "string", description: "database.homeDecorationTypes 의 유형 id" },
              mapId: { type: "string" },
              x: { type: "integer" },
              y: { type: "integer" },
              orientation: ORIENTATION_SCHEMA,
            },
            required: ["instanceId", "typeId", "mapId", "x", "y"],
          },
        },
        remove: { type: "array", items: { type: "string" } },
      },
    },
  },
};
