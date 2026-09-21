// editor/tools/lifeEconomyToolSchemas.ts
// LIFE_ECONOMY_TOOLS 의 파라미터 스키마 상수. 프로바이더 엄격 검증 규약을 따른다:
// oneOf/anyOf 금지, 모든 array 노드에 items, 모든 object 노드에 실제 properties.
import type { JsonSchema } from "./types";

const ITEM_AMOUNT_SCHEMA: JsonSchema = {
  type: "object",
  description: "아이템 수량. itemId 는 database.items 의 id 여야 한다.",
  properties: {
    itemId: { type: "string" },
    count: { type: "integer", minimum: 1 },
  },
  required: ["itemId", "count"],
  additionalProperties: false,
};

export const CRAFT_RECIPE_PARAMS: JsonSchema = {
  type: "object",
  properties: {
    recipe: {
      type: "object",
      description: "제작 레시피 1건. 기존 id는 전달 필드만 수정하고 생략한 필드는 보존한다. ingredients 배열은 전달하면 교체한다. 신규 레시피에는 outputItemId가 필요하다.",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        ingredients: { type: "array", items: ITEM_AMOUNT_SCHEMA },
        outputItemId: { type: "string" },
        outputCount: { type: "integer", minimum: 1 },
        goldCost: { type: "integer", minimum: 0 },
        requiresUnlock: { type: "boolean", description: "true 면 세션이 레시피를 해금해야 제작 가능." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  required: ["recipe"],
  additionalProperties: false,
};

export const DELETE_BY_ID_PARAMS: JsonSchema = {
  type: "object",
  properties: { id: { type: "string", description: "지울 레시피 id." } },
  required: ["id"],
  additionalProperties: false,
};

export const ITEM_UPGRADE_PARAMS: JsonSchema = {
  type: "object",
  properties: {
    upgrade: {
      type: "object",
      description: "아이템 업그레이드 규칙 1건. 같은 id 가 있으면 통째로 교체한다.",
      properties: {
        id: { type: "string" },
        fromItemId: { type: "string" },
        toItemId: { type: "string" },
        goldCost: { type: "integer", minimum: 0 },
        ingredients: { type: "array", items: ITEM_AMOUNT_SCHEMA },
        capability: {
          type: "object",
          description: "도구 성능(범위/에너지 배율). areaWidth·areaHeight 는 1~9, 곱이 81 이하, energyMultiplier > 0.",
          properties: {
            areaWidth: { type: "integer", minimum: 1, maximum: 9 },
            areaHeight: { type: "integer", minimum: 1, maximum: 9 },
            energyMultiplier: { type: "number" },
          },
          required: ["areaWidth", "areaHeight", "energyMultiplier"],
          additionalProperties: false,
        },
      },
      required: ["id", "fromItemId", "toItemId"],
      additionalProperties: false,
    },
  },
  required: ["upgrade"],
  additionalProperties: false,
};

export const SELL_PRICES_PARAMS: JsonSchema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      description: "판매가 행 목록. itemId 기준 upsert(기존 행은 가격만 갱신)이며 전달하지 않은 행은 그대로 남는다.",
      items: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          price: { type: "integer", minimum: 0 },
        },
        required: ["itemId", "price"],
        additionalProperties: false,
      },
    },
    removeItemIds: {
      type: "array",
      description: "판매가 표에서 지울 itemId 목록. 지우면 기본 판매가(구매가의 절반)로 되돌아간다.",
      items: { type: "string" },
    },
  },
  additionalProperties: false,
};

export const TOOL_ACTION_PARAMS: JsonSchema = {
  type: "object",
  properties: {
    rule: {
      type: "object",
      description: "도구→월드 행동 규칙 1건. 같은 id 가 있으면 통째로 교체한다.",
      properties: {
        id: { type: "string" },
        farmTool: { type: "string", enum: ["hoe", "wateringCan", "axe", "pickaxe"] },
        itemId: { type: "string", description: "이 규칙을 만족시키는 아이템 id(생략 시 farmTool 종류로 판정)." },
        requiresFarmable: { type: "boolean", description: "true 면 맵의 farmableArea 안에서만 동작." },
        targetPlaceableKind: { type: "string", description: "대상 배치물 종류(chop→tree, mine→rock)." },
        action: { type: "string", enum: ["till", "water", "chop", "mine", "fish", "harvest"] },
      },
      required: ["id", "action"],
      additionalProperties: false,
    },
  },
  required: ["rule"],
  additionalProperties: false,
};

export const LIFE_ECONOMY_CONFIG_PARAMS: JsonSchema = {
  type: "object",
  properties: {
    energy: {
      type: "object",
      description: "생활 에너지 풀. max 필수. initial/restorePerDay 는 max 로 클램프된다.",
      properties: {
        max: { type: "integer", minimum: 1 },
        initial: { type: "integer", minimum: 0 },
        restorePerDay: { type: "integer", minimum: 0 },
      },
      required: ["max"],
      additionalProperties: false,
    },
    shipping: {
      type: "object",
      description: "출하 상자와 밤 정산 정책. allowedItemIds 를 생략하면 판매가가 있는 모든 아이템을 받는다.",
      properties: {
        enabled: { type: "boolean" },
        historyLimit: { type: "integer", minimum: 0 },
        allowedItemIds: { type: "array", items: { type: "string" } },
      },
      required: ["enabled"],
      additionalProperties: false,
    },
    bundles: {
      type: "array",
      description: "기부 꾸러미 정의 전체 목록(전달하면 이 섹션만 통째로 교체).",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          requirements: { type: "array", items: ITEM_AMOUNT_SCHEMA },
          reward: {
            type: "object",
            properties: {
              gold: { type: "integer", minimum: 0 },
              itemRewards: { type: "array", items: ITEM_AMOUNT_SCHEMA },
              switchId: { type: "string" },
              worldUnlockIds: { type: "array", items: { type: "string" } },
              recipeIds: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
        },
        required: ["id", "requirements"],
        additionalProperties: false,
      },
    },
    worldUnlocks: {
      type: "array",
      description: "지역 해금 정의 전체 목록(전달하면 이 섹션만 통째로 교체).",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          switchId: { type: "string", description: "해금 시 함께 켜지는 스위치 id." },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    makers: {
      type: "array",
      description: "가공 설비 정의 전체 목록(전달하면 이 섹션만 통째로 교체).",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          inputs: { type: "array", items: ITEM_AMOUNT_SCHEMA },
          outputs: { type: "array", items: ITEM_AMOUNT_SCHEMA },
          durationMinutes: { type: "integer", minimum: 1 },
        },
        required: ["id", "inputs", "outputs", "durationMinutes"],
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
