// Life-collection authored-data facades. Database 어종/낚시/채집/박물관 탭이 쓰는 저작 데이터를
// 2026-08-27 커버리지 감사에서 지적된 대로 툴로 도달하게 한다. 값 정규화는 p2FoundationRecords 의
// 프로젝트 정규화기를 재사용하고, 툴은 그 앞에서 id 참조 검증 + 오류 메시지에 유효값 나열을 담당한다.
//
// 병합 규칙(모든 configure_* 공통): 각 configure_* 는 자기 system 필드 하나만 건드린다 — 형제 시스템은
// 절대 지우지 않는다. 항목 배열(spots/areas/rewards)은 같은 id 로 보낸 항목만 교체하고 기존 항목은
// 유지한다. replaceSpots/replaceAreas/replaceRewards 로 전체 교체를 명시할 수 있다. eligibleItemIds /
// trackedItemIds 는 합집합으로 누적되고 replace* 플래그로 교체한다.
import {
  normalizeCollectionSystem,
  normalizeFishSpeciesRecords,
  normalizeFishingSystem,
  normalizeMuseumSystem,
  normalizeSeasonalForage,
} from "@/project/p2FoundationRecords";
import { isSeason, isTimePhase, SEASONS, TIME_PHASES, type Season, type TimePhase } from "@/project/gameTime";
import { isWeatherKind } from "@/project/p1FoundationRecords";
import type {
  BundleRewardDefinition,
  CollectionSystemConfig,
  FishSpeciesRecord,
  FishingCatchRule,
  FishingSpotDefinition,
  FishingSystemConfig,
  ForageAreaDefinition,
  ForageEntryDefinition,
  ItemAmount,
  MuseumRewardDefinition,
  MuseumSystemConfig,
  Project,
  Rect,
  SeasonalForageConfig,
  WeatherKind,
} from "@/project/types";
import {
  FISH_SPECIES_SCHEMA,
  FISHING_SPOT_SCHEMA,
  FORAGE_AREA_SCHEMA,
  MUSEUM_REWARD_SCHEMA,
  WEATHER_KINDS,
} from "./lifeCollectionSchemas";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sampleList(ids: readonly string[]): string {
  const head = ids.slice(0, 12).join(", ");
  return ids.length > 12 ? `${head} …` : head;
}

/** 모델이 바로 고칠 수 있게, 거부 메시지에 유효 id 를 최대 12개까지 나열한다. */
function requireKnownId(label: string, raw: unknown, valid: readonly string[]): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ToolError(`${label} 가 필요합니다.`, { code: "invalid-args" });
  const id = raw.trim();
  if (!valid.includes(id)) {
    throw new ToolError(
      `${label} '${id}' 을(를) 찾을 수 없습니다. 사용 가능한 id(${valid.length}개): ${sampleList(valid)}`,
      { code: "invalid-args" },
    );
  }
  return id;
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ToolError(`${label}.${key} 에 문자열이 필요합니다.`, { code: "invalid-args" });
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireInteger(record: Record<string, unknown>, key: string, label: string, min: number): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new ToolError(`${label}.${key} 는 ${min} 이상의 정수여야 합니다.`, { code: "invalid-args" });
  }
  return value;
}

function optionalInteger(record: Record<string, unknown>, key: string, label: string, min: number): number | undefined {
  if (record[key] === undefined) return undefined;
  return requireInteger(record, key, label, min);
}

function parseEnumArray<T>(
  value: unknown,
  guard: (raw: unknown) => raw is T,
  allowed: readonly string[],
  label: string,
): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label} 는 배열이어야 합니다.`, { code: "invalid-args" });
  const parsed: T[] = [];
  for (const entry of value) {
    if (!guard(entry)) {
      throw new ToolError(`${label} 에 허용되지 않는 값이 있습니다. 허용값: ${allowed.join(", ")}`, { code: "invalid-args" });
    }
    parsed.push(entry);
  }
  return parsed;
}

function parseRect(value: unknown, label: string): Rect {
  if (!isRecord(value)) throw new ToolError(`${label} 는 {x,y,w,h} 객체여야 합니다.`, { code: "invalid-args" });
  return {
    x: requireInteger(value, "x", label, 0),
    y: requireInteger(value, "y", label, 0),
    w: requireInteger(value, "w", label, 1),
    h: requireInteger(value, "h", label, 1),
  };
}

function parseArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ToolError(`${label} 는 배열이어야 합니다.`, { code: "invalid-args" });
  return value;
}

function unionById<T extends { readonly id: string }>(existing: readonly T[], incoming: readonly T[], replace: boolean): T[] {
  if (replace) return [...incoming];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}

function unionIds(existing: readonly string[], incoming: readonly string[], replace: boolean): string[] {
  return replace ? [...new Set(incoming)] : [...new Set([...existing, ...incoming])];
}

function itemIds(draft: Project): string[] {
  return draft.database.items.map((item) => item.id);
}

function fishIds(draft: Project): string[] {
  return (draft.database.fishSpecies ?? []).map((fish) => fish.id);
}

function mapIds(draft: Project): string[] {
  return Object.keys(draft.maps);
}

function requireBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ToolError(`${label} 는 boolean 이어야 합니다.`, { code: "invalid-args" });
  return value;
}

// ------------------------------------------------------------------ 어종 (database.fishSpecies)

function parseFish(raw: unknown, draft: Project): FishSpeciesRecord {
  if (!isRecord(raw)) throw new ToolError("fish 는 객체여야 합니다.", { code: "invalid-args" });
  const skillXp = optionalInteger(raw, "skillXp", "fish", 0);
  const candidate: FishSpeciesRecord = {
    id: requireString(raw, "id", "fish"),
    name: optionalText(raw.name) ?? requireString(raw, "id", "fish"),
    itemId: requireKnownId("fish.itemId", raw.itemId, itemIds(draft)),
    ...(skillXp !== undefined ? { skillXp } : {}),
  };
  const normalized = normalizeFishSpeciesRecords([candidate])?.[0];
  if (!normalized) throw new ToolError("어종 레코드를 정규화하지 못했습니다.", { code: "invalid-args" });
  return normalized;
}

const upsertFishSpecies: ToolDefinition = {
  name: "upsert_fish_species",
  description:
    "어종 레코드(database.fishSpecies)를 등록/수정한다. Database 낚시 탭이 쓰는 저작 데이터. " +
    "같은 id 면 그 레코드만 교체하고 나머지 어종은 유지한다. itemId 는 database.items 의 아이템만 허용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { fish: FISH_SPECIES_SCHEMA },
    required: ["fish"],
    additionalProperties: false,
  },
  invalidArgsExample: { fish: { id: "fish_river", name: "강 물고기", itemId: "item_fish", skillXp: 8 } },
  run(draft, args): ToolExecResult {
    const fish = parseFish(args.fish, draft);
    const existing = draft.database.fishSpecies ?? [];
    draft.database.fishSpecies = unionById(existing, [fish], false);
    return { summary: `어종 ${fish.name}(${fish.id}) 저장`, data: { fish } };
  },
};

const deleteFishSpecies: ToolDefinition = {
  name: "delete_fish_species",
  description:
    "어종 레코드(database.fishSpecies)를 id 로 삭제한다. Database 낚시 탭과 같이, 그 어종을 참조하던 " +
    "system.fishing 낚시터의 어획 규칙도 함께 지우고 어획 규칙이 하나도 남지 않은 낚시터는 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "삭제할 어종 id" } },
    required: ["id"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const id = requireKnownId("어종", args.id, fishIds(draft));
    draft.database.fishSpecies = (draft.database.fishSpecies ?? []).filter((fish) => fish.id !== id);
    const fishing = draft.system.fishing;
    if (fishing) {
      draft.system.fishing = {
        ...fishing,
        spots: fishing.spots
          .map((spot) => ({ ...spot, catches: spot.catches.filter((rule) => rule.fishId !== id) }))
          .filter((spot) => spot.catches.length > 0),
      };
    }
    return { summary: `어종 ${id} 삭제`, data: { id } };
  },
};

// ------------------------------------------------------------------ 낚시 (system.fishing)

function parseCatch(raw: unknown, draft: Project): FishingCatchRule {
  if (!isRecord(raw)) throw new ToolError("catches 항목은 객체여야 합니다.", { code: "invalid-args" });
  const seasons = parseEnumArray<Season>(raw.seasons, isSeason, SEASONS, "catches.seasons");
  const timePhases = parseEnumArray<TimePhase>(raw.timePhases, isTimePhase, TIME_PHASES, "catches.timePhases");
  const weatherKinds = parseEnumArray<WeatherKind>(raw.weatherKinds, isWeatherKind, WEATHER_KINDS, "catches.weatherKinds");
  const minSkillLevel = optionalInteger(raw, "minSkillLevel", "catches", 1);
  return {
    fishId: requireKnownId("catches.fishId", raw.fishId, fishIds(draft)),
    weight: optionalInteger(raw, "weight", "catches", 1) ?? 1,
    ...(seasons ? { seasons } : {}),
    ...(timePhases ? { timePhases } : {}),
    ...(weatherKinds ? { weatherKinds } : {}),
    ...(minSkillLevel !== undefined ? { minSkillLevel } : {}),
  };
}

function parseSpot(raw: unknown, draft: Project): FishingSpotDefinition {
  if (!isRecord(raw)) throw new ToolError("spots 항목은 객체여야 합니다.", { code: "invalid-args" });
  const name = optionalText(raw.name);
  return {
    id: requireString(raw, "id", "spots"),
    ...(name ? { name } : {}),
    mapId: requireKnownId("spots.mapId", raw.mapId, mapIds(draft)),
    area: parseRect(raw.area, "spots.area"),
    catches: parseArray(raw.catches, "spots.catches").map((rule) => parseCatch(rule, draft)),
  };
}

const configureFishing: ToolDefinition = {
  name: "configure_fishing",
  description:
    "낚시 시스템(system.fishing)을 설정한다: enabled·energyCost·낚시터(맵/영역/어획 표). " +
    "부분 패치다 — 보내지 않은 필드는 그대로 두고, 형제 시스템(박물관/채집/도감)은 건드리지 않는다. " +
    "spots 는 같은 id 만 교체하고 기존 낚시터는 유지한다(전체 교체는 replaceSpots:true). " +
    "mapId 는 project.maps, catches[].fishId 는 database.fishSpecies 만 허용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "낚시 사용 여부. 새로 만들 때 생략하면 true" },
      energyCost: { type: "integer", description: "낚시 1회 기력 소모" },
      spots: { type: "array", description: "낚시터 목록(같은 id 만 교체)", items: FISHING_SPOT_SCHEMA },
      replaceSpots: { type: "boolean", description: "true 면 기존 낚시터를 전부 버리고 spots 로 교체" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: {
    enabled: true,
    spots: [{ id: "spot_river", mapId: "map_1", area: { x: 0, y: 0, w: 4, h: 4 }, catches: [{ fishId: "fish_river", weight: 1 }] }],
  },
  run(draft, args): ToolExecResult {
    const existing = draft.system.fishing;
    const enabled = requireBoolean(args.enabled, "enabled");
    const energyCost = optionalInteger(args, "energyCost", "fishing", 0);
    const replaceSpots = requireBoolean(args.replaceSpots, "replaceSpots") ?? false;
    const incoming = args.spots === undefined ? undefined : parseArray(args.spots, "spots").map((spot) => parseSpot(spot, draft));
    if (enabled === undefined && energyCost === undefined && incoming === undefined) {
      throw new ToolError("바꿀 낚시 설정이 없습니다. enabled/energyCost/spots 중 하나는 보내세요.", { code: "invalid-args" });
    }
    const nextEnergyCost = energyCost ?? existing?.energyCost;
    const candidate: FishingSystemConfig = {
      enabled: enabled ?? existing?.enabled ?? true,
      ...(nextEnergyCost !== undefined ? { energyCost: nextEnergyCost } : {}),
      spots: unionById(existing?.spots ?? [], incoming ?? [], replaceSpots && incoming !== undefined),
    };
    const normalized = normalizeFishingSystem(candidate);
    if (!normalized) throw new ToolError("낚시 설정을 정규화하지 못했습니다.", { code: "invalid-args" });
    draft.system.fishing = normalized;
    return { summary: `낚시 설정(낚시터 ${normalized.spots.length}곳)`, data: { fishing: normalized } };
  },
};

// ------------------------------------------------------------------ 계절 채집 (system.seasonalForage)

function parseForageEntry(raw: unknown, draft: Project): ForageEntryDefinition {
  if (!isRecord(raw)) throw new ToolError("entries 항목은 객체여야 합니다.", { code: "invalid-args" });
  const valid = itemIds(draft);
  const itemId = raw.itemId === undefined ? undefined : requireKnownId("entries.itemId", raw.itemId, valid);
  const seasonalDrops: Partial<Record<Season, string>> = {};
  if (raw.seasonalDrops !== undefined) {
    if (!isRecord(raw.seasonalDrops)) throw new ToolError("entries.seasonalDrops 는 객체여야 합니다.", { code: "invalid-args" });
    for (const season of SEASONS) {
      const drop = raw.seasonalDrops[season];
      if (drop === undefined) continue;
      seasonalDrops[season] = requireKnownId(`entries.seasonalDrops.${season}`, drop, valid);
    }
  }
  if (!itemId && Object.keys(seasonalDrops).length === 0) {
    throw new ToolError("entries 항목에 itemId 또는 seasonalDrops 중 하나가 필요합니다.", { code: "invalid-args" });
  }
  return {
    id: requireString(raw, "id", "entries"),
    weight: optionalInteger(raw, "weight", "entries", 1) ?? 1,
    ...(itemId ? { itemId } : {}),
    ...(Object.keys(seasonalDrops).length > 0 ? { seasonalDrops } : {}),
  };
}

function parseForageArea(raw: unknown, draft: Project): ForageAreaDefinition {
  if (!isRecord(raw)) throw new ToolError("areas 항목은 객체여야 합니다.", { code: "invalid-args" });
  const name = optionalText(raw.name);
  const spawnEveryDays = optionalInteger(raw, "spawnEveryDays", "areas", 1);
  return {
    id: requireString(raw, "id", "areas"),
    ...(name ? { name } : {}),
    mapId: requireKnownId("areas.mapId", raw.mapId, mapIds(draft)),
    area: parseRect(raw.area, "areas.area"),
    dailySpawnCount: requireInteger(raw, "dailySpawnCount", "areas", 0),
    maxActive: requireInteger(raw, "maxActive", "areas", 0),
    ...(spawnEveryDays !== undefined ? { spawnEveryDays } : {}),
    despawnAfterDays: requireInteger(raw, "despawnAfterDays", "areas", 1),
    entries: parseArray(raw.entries, "areas.entries").map((entry) => parseForageEntry(entry, draft)),
  };
}

const configureSeasonalForage: ToolDefinition = {
  name: "configure_seasonal_forage",
  description:
    "계절 채집(system.seasonalForage)을 설정한다: enabled·채집 구역(맵/영역/일일 스폰 수/최대 동시/소멸 일수/채집 표). " +
    "부분 패치다 — 형제 시스템은 건드리지 않고, areas 는 같은 id 만 교체하며 기존 구역은 유지한다" +
    "(전체 교체는 replaceAreas:true). mapId 는 project.maps, 드롭 아이템은 database.items 만 허용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "채집 사용 여부. 새로 만들 때 생략하면 true" },
      areas: { type: "array", description: "채집 구역 목록(같은 id 만 교체)", items: FORAGE_AREA_SCHEMA },
      replaceAreas: { type: "boolean", description: "true 면 기존 구역을 전부 버리고 areas 로 교체" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: {
    enabled: true,
    areas: [{
      id: "forage_farm",
      mapId: "map_1",
      area: { x: 0, y: 0, w: 5, h: 5 },
      dailySpawnCount: 2,
      maxActive: 6,
      despawnAfterDays: 3,
      entries: [{ id: "forage_berry", weight: 1, itemId: "item_berry" }],
    }],
  },
  run(draft, args): ToolExecResult {
    const existing = draft.system.seasonalForage;
    const enabled = requireBoolean(args.enabled, "enabled");
    const replaceAreas = requireBoolean(args.replaceAreas, "replaceAreas") ?? false;
    const incoming = args.areas === undefined ? undefined : parseArray(args.areas, "areas").map((area) => parseForageArea(area, draft));
    if (enabled === undefined && incoming === undefined) {
      throw new ToolError("바꿀 채집 설정이 없습니다. enabled/areas 중 하나는 보내세요.", { code: "invalid-args" });
    }
    const candidate: SeasonalForageConfig = {
      enabled: enabled ?? existing?.enabled ?? true,
      areas: unionById(existing?.areas ?? [], incoming ?? [], replaceAreas && incoming !== undefined),
    };
    const normalized = normalizeSeasonalForage(candidate);
    if (!normalized) throw new ToolError("채집 설정을 정규화하지 못했습니다.", { code: "invalid-args" });
    draft.system.seasonalForage = normalized;
    return { summary: `계절 채집 설정(구역 ${normalized.areas.length}개)`, data: { seasonalForage: normalized } };
  },
};

// ------------------------------------------------------------------ 박물관 (system.museum)

function parseReward(raw: unknown, draft: Project): BundleRewardDefinition {
  if (!isRecord(raw)) throw new ToolError("reward 는 객체여야 합니다.", { code: "invalid-args" });
  const gold = optionalInteger(raw, "gold", "reward", 0);
  const switchId = optionalText(raw.switchId);
  const itemRewards = raw.itemRewards === undefined
    ? undefined
    : parseArray(raw.itemRewards, "reward.itemRewards").map((entry): ItemAmount => {
      if (!isRecord(entry)) throw new ToolError("reward.itemRewards 항목은 객체여야 합니다.", { code: "invalid-args" });
      return {
        itemId: requireKnownId("reward.itemRewards.itemId", entry.itemId, itemIds(draft)),
        count: requireInteger(entry, "count", "reward.itemRewards", 1),
      };
    });
  const worldUnlockIds = raw.worldUnlockIds === undefined
    ? undefined
    : parseArray(raw.worldUnlockIds, "reward.worldUnlockIds").map((id, index) => requireString({ id }, "id", `reward.worldUnlockIds[${index}]`));
  const recipeIds = raw.recipeIds === undefined
    ? undefined
    : parseArray(raw.recipeIds, "reward.recipeIds").map((id, index) => requireString({ id }, "id", `reward.recipeIds[${index}]`));
  return {
    ...(gold !== undefined ? { gold } : {}),
    ...(itemRewards !== undefined ? { itemRewards } : {}),
    ...(switchId ? { switchId } : {}),
    ...(worldUnlockIds !== undefined ? { worldUnlockIds } : {}),
    ...(recipeIds !== undefined ? { recipeIds } : {}),
  };
}

function parseMuseumReward(raw: unknown, draft: Project): MuseumRewardDefinition {
  if (!isRecord(raw)) throw new ToolError("rewards 항목은 객체여야 합니다.", { code: "invalid-args" });
  const name = optionalText(raw.name);
  const minDonations = optionalInteger(raw, "minDonations", "rewards", 1);
  const requiredItemIds = raw.requiredItemIds === undefined
    ? undefined
    : parseArray(raw.requiredItemIds, "rewards.requiredItemIds").map((id) => requireKnownId("rewards.requiredItemIds", id, itemIds(draft)));
  if (minDonations === undefined && (requiredItemIds === undefined || requiredItemIds.length === 0)) {
    throw new ToolError("rewards 항목에 minDonations 또는 requiredItemIds 중 하나가 필요합니다.", { code: "invalid-args" });
  }
  return {
    id: requireString(raw, "id", "rewards"),
    ...(name ? { name } : {}),
    ...(minDonations !== undefined ? { minDonations } : {}),
    ...(requiredItemIds !== undefined ? { requiredItemIds } : {}),
    ...(raw.reward !== undefined ? { reward: parseReward(raw.reward, draft) } : {}),
  };
}

const configureMuseum: ToolDefinition = {
  name: "configure_museum",
  description:
    "박물관(system.museum)을 설정한다: enabled·기부 가능 아이템(eligibleItemIds)·보상(rewards). " +
    "부분 패치다 — 형제 시스템은 건드리지 않고, eligibleItemIds 는 기존 목록과 합집합, rewards 는 같은 id " +
    "만 교체하며 기존 보상은 유지한다(전체 교체는 replaceEligibleItemIds/replaceRewards:true). " +
    "아이템 id 는 database.items 만 허용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "박물관 사용 여부. 새로 만들 때 생략하면 true" },
      eligibleItemIds: { type: "array", description: "기부 가능 아이템 id(기본은 기존 목록과 합집합)", items: { type: "string" } },
      replaceEligibleItemIds: { type: "boolean", description: "true 면 eligibleItemIds 를 그대로 교체" },
      rewards: { type: "array", description: "보상 목록(같은 id 만 교체)", items: MUSEUM_REWARD_SCHEMA },
      replaceRewards: { type: "boolean", description: "true 면 기존 보상을 전부 버리고 rewards 로 교체" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: {
    enabled: true,
    eligibleItemIds: ["item_fish"],
    rewards: [{ id: "museum_first", name: "첫 기부", minDonations: 1, reward: { gold: 100 } }],
  },
  run(draft, args): ToolExecResult {
    const existing = draft.system.museum;
    const enabled = requireBoolean(args.enabled, "enabled");
    const replaceEligible = requireBoolean(args.replaceEligibleItemIds, "replaceEligibleItemIds") ?? false;
    const replaceRewards = requireBoolean(args.replaceRewards, "replaceRewards") ?? false;
    const eligible = args.eligibleItemIds === undefined
      ? undefined
      : parseArray(args.eligibleItemIds, "eligibleItemIds").map((id) => requireKnownId("eligibleItemIds", id, itemIds(draft)));
    const rewards = args.rewards === undefined
      ? undefined
      : parseArray(args.rewards, "rewards").map((reward) => parseMuseumReward(reward, draft));
    if (enabled === undefined && eligible === undefined && rewards === undefined) {
      throw new ToolError("바꿀 박물관 설정이 없습니다. enabled/eligibleItemIds/rewards 중 하나는 보내세요.", { code: "invalid-args" });
    }
    const candidate: MuseumSystemConfig = {
      enabled: enabled ?? existing?.enabled ?? true,
      eligibleItemIds: unionIds(existing?.eligibleItemIds ?? [], eligible ?? [], replaceEligible && eligible !== undefined),
      rewards: unionById(existing?.rewards ?? [], rewards ?? [], replaceRewards && rewards !== undefined),
    };
    const normalized = normalizeMuseumSystem(candidate);
    if (!normalized) throw new ToolError("박물관 설정을 정규화하지 못했습니다.", { code: "invalid-args" });
    draft.system.museum = normalized;
    return {
      summary: `박물관 설정(기부 아이템 ${normalized.eligibleItemIds.length}종, 보상 ${normalized.rewards.length}개)`,
      data: { museum: normalized },
    };
  },
};

// ------------------------------------------------------------------ 수집 도감 (system.collections)

const configureCollections: ToolDefinition = {
  name: "configure_collections",
  description:
    "수집 도감(system.collections)을 설정한다: enabled·추적 아이템(trackedItemIds). " +
    "부분 패치다 — 형제 시스템은 건드리지 않고, trackedItemIds 는 기존 목록과 합집합으로 누적한다" +
    "(그대로 교체는 replaceTrackedItemIds:true). 아이템 id 는 database.items 만 허용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "도감 사용 여부. 새로 만들 때 생략하면 true" },
      trackedItemIds: { type: "array", description: "도감이 추적할 아이템 id", items: { type: "string" } },
      replaceTrackedItemIds: { type: "boolean", description: "true 면 trackedItemIds 를 그대로 교체" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { enabled: true, trackedItemIds: ["item_fish", "item_berry"] },
  run(draft, args): ToolExecResult {
    const existing = draft.system.collections;
    const enabled = requireBoolean(args.enabled, "enabled");
    const replace = requireBoolean(args.replaceTrackedItemIds, "replaceTrackedItemIds") ?? false;
    const tracked = args.trackedItemIds === undefined
      ? undefined
      : parseArray(args.trackedItemIds, "trackedItemIds").map((id) => requireKnownId("trackedItemIds", id, itemIds(draft)));
    if (enabled === undefined && tracked === undefined) {
      throw new ToolError("바꿀 도감 설정이 없습니다. enabled/trackedItemIds 중 하나는 보내세요.", { code: "invalid-args" });
    }
    const nextTracked = tracked === undefined
      ? existing?.trackedItemIds
      : unionIds(existing?.trackedItemIds ?? [], tracked, replace);
    const candidate: CollectionSystemConfig = {
      enabled: enabled ?? existing?.enabled ?? true,
      ...(nextTracked !== undefined ? { trackedItemIds: nextTracked } : {}),
    };
    const normalized = normalizeCollectionSystem(candidate);
    if (!normalized) throw new ToolError("도감 설정을 정규화하지 못했습니다.", { code: "invalid-args" });
    draft.system.collections = normalized;
    return { summary: `수집 도감 설정(추적 ${normalized.trackedItemIds?.length ?? 0}종)`, data: { collections: normalized } };
  },
};

export const LIFE_COLLECTION_TOOLS: readonly ToolDefinition[] = [
  upsertFishSpecies,
  deleteFishSpecies,
  configureFishing,
  configureSeasonalForage,
  configureMuseum,
  configureCollections,
];
