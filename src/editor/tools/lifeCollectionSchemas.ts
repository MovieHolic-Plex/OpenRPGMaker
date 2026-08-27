// editor/tools/lifeCollectionSchemas.ts
// 생활 수집 파사드(lifeCollectionTools.ts)의 파라미터 스키마 조각.
// 객체 파라미터는 반드시 실제 properties 를 선언한다 — 빈 `{type:"object"}` 는 strict
// function-calling 경로에서 모델이 `{}` 만 보내게 만든다(openwiki/editor-ai-tools.md 2026-08-23).
// 유니온(oneOf/anyOf)은 쓰지 않는다: Gemini 계열 게이트웨이가 요청 전체를 400 으로 죽인다.
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { RECT_SCHEMA } from "./schemaShapes";
import type { JsonSchema } from "./types";

export const WEATHER_KINDS = ["none", "rain", "storm", "snow", "fog"] as const;

/** `FishSpeciesRecord` (project/types/database.ts). */
export const FISH_SPECIES_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "어종 id(고유)" },
    name: { type: "string" },
    itemId: { type: "string", description: "낚였을 때 지급되는 database.items 의 아이템 id" },
    skillXp: { type: "integer", description: "낚시 스킬 경험치(기본 0)" },
  },
  required: ["id", "name", "itemId"],
  additionalProperties: false,
};

/** `FishingCatchRule` — 어종별 가중치와 계절/시간대/날씨 필터. */
export const FISHING_CATCH_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    fishId: { type: "string", description: "database.fishSpecies 의 어종 id" },
    weight: { type: "integer", description: "가중치(1 이상). 생략 시 1" },
    seasons: { type: "array", description: "생략 시 모든 계절", items: { type: "string", enum: [...SEASONS] } },
    timePhases: { type: "array", description: "생략 시 모든 시간대", items: { type: "string", enum: [...TIME_PHASES] } },
    weatherKinds: { type: "array", description: "생략 시 모든 날씨", items: { type: "string", enum: [...WEATHER_KINDS] } },
    minSkillLevel: { type: "integer", description: "요구 낚시 스킬 레벨(1~99)" },
  },
  required: ["fishId"],
  additionalProperties: false,
};

/** `FishingSpotDefinition` — 맵 위 사각 영역 + 어획 규칙. */
export const FISHING_SPOT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "낚시터 id(고유). 같은 id 로 다시 보내면 그 낚시터만 교체된다" },
    name: { type: "string" },
    mapId: { type: "string", description: "project.maps 의 맵 id" },
    area: { ...RECT_SCHEMA, description: "낚시 가능한 타일 영역 {x,y,w,h}" },
    catches: { type: "array", description: "어획 표(비우면 낚이지 않는다)", items: FISHING_CATCH_SCHEMA },
  },
  required: ["id", "mapId", "area", "catches"],
  additionalProperties: false,
};

/** `ForageEntryDefinition` — itemId 고정 또는 계절별 드롭. */
export const FORAGE_ENTRY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "채집 항목 id(고유)" },
    weight: { type: "integer", description: "가중치(1 이상). 생략 시 1" },
    itemId: { type: "string", description: "계절 무관 고정 아이템 id" },
    seasonalDrops: {
      type: "object",
      description: "계절별 아이템 id. itemId 와 둘 중 하나는 있어야 한다",
      properties: {
        spring: { type: "string" },
        summer: { type: "string" },
        fall: { type: "string" },
        winter: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  required: ["id"],
  additionalProperties: false,
};

/** `ForageAreaDefinition` — 하루 스폰 정책 + 채집 표. */
export const FORAGE_AREA_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "채집 구역 id(고유). 같은 id 로 다시 보내면 그 구역만 교체된다" },
    name: { type: "string" },
    mapId: { type: "string", description: "project.maps 의 맵 id" },
    area: { ...RECT_SCHEMA, description: "채집물이 스폰되는 타일 영역 {x,y,w,h}" },
    dailySpawnCount: { type: "integer", description: "하루에 새로 스폰되는 개수" },
    maxActive: { type: "integer", description: "동시에 존재할 수 있는 최대 개수" },
    spawnEveryDays: { type: "integer", description: "스폰 주기(일). 생략 시 매일" },
    despawnAfterDays: { type: "integer", description: "며칠 뒤 사라지는가(1 이상)" },
    entries: { type: "array", description: "채집 표", items: FORAGE_ENTRY_SCHEMA },
  },
  required: ["id", "mapId", "area", "dailySpawnCount", "maxActive", "despawnAfterDays", "entries"],
  additionalProperties: false,
};

/** `BundleRewardDefinition` — 박물관 보상 지급 내용. */
export const BUNDLE_REWARD_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    gold: { type: "integer" },
    itemRewards: {
      type: "array",
      items: {
        type: "object",
        properties: { itemId: { type: "string" }, count: { type: "integer" } },
        required: ["itemId", "count"],
        additionalProperties: false,
      },
    },
    switchId: { type: "string", description: "보상 시 켜지는 스위치 id" },
    worldUnlockIds: { type: "array", items: { type: "string" } },
    recipeIds: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

/** `MuseumRewardDefinition` — minDonations 또는 requiredItemIds 중 하나는 있어야 한다. */
export const MUSEUM_REWARD_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "보상 id(고유). 같은 id 로 다시 보내면 그 보상만 교체된다" },
    name: { type: "string" },
    minDonations: { type: "integer", description: "누적 기부 개수 조건(1 이상)" },
    requiredItemIds: { type: "array", description: "특정 아이템 기부 조건", items: { type: "string" } },
    reward: BUNDLE_REWARD_SCHEMA,
  },
  required: ["id"],
  additionalProperties: false,
};
