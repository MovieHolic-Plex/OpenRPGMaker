// Life-system authored-data facades. The Database 생활/날씨/가축 tabs persist these
// records; without typed tools the assistant reports the editor cannot author them.
import { normalizeDailyWeatherConfig, normalizeFarmAnimalSpeciesRecords } from "@/project/p1FoundationRecords";
import { normalizeLifeSkillRecord } from "@/project/skillModel";
import type { DailyWeatherConfig, FarmAnimalSpeciesRecord, LifeSkillRecord, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { mergeRecordPatch } from "./mergeRecordPatch";

const LIFE_SKILL_TYPES = ["farming", "mining", "foraging", "fishing", "combat"] as const;
type LifeSkillType = (typeof LIFE_SKILL_TYPES)[number];

function requireIdName(value: unknown, label: string): { id: string; name: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!id || !name) throw new ToolError(`${label}에 id와 name이 필요합니다.`, { code: "invalid-args" });
  return { id, name };
}

function upsertById<T extends { id: string }>(list: T[], record: T): T[] {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index < 0) return [...list, record];
  return list.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}

function parseLifeSkill(value: unknown, existing?: LifeSkillRecord): LifeSkillRecord {
  const identity = requireIdName(value, "skill");
  const record = mergeRecordPatch(existing, value as Record<string, unknown>);
  const skillType = record.skillType;
  if (typeof skillType !== "string" || !LIFE_SKILL_TYPES.includes(skillType as LifeSkillType)) {
    throw new ToolError(`skill.skillType은 ${LIFE_SKILL_TYPES.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const maxLevel = typeof record.maxLevel === "number" ? record.maxLevel : 10;
  return normalizeLifeSkillRecord({
    ...existing,
    id: identity.id,
    name: identity.name,
    skillType: skillType as LifeSkillType,
    maxLevel,
  });
}

function parseAnimalSpecies(value: unknown, existing?: FarmAnimalSpeciesRecord): FarmAnimalSpeciesRecord {
  const identity = requireIdName(value, "farmAnimalSpecies");
  const record = mergeRecordPatch(existing, value as Record<string, unknown>);
  const feedItemId = typeof record.feedItemId === "string" ? record.feedItemId : "";
  const productItemId = typeof record.productItemId === "string" ? record.productItemId : "";
  if (!feedItemId || !productItemId) {
    throw new ToolError("farmAnimalSpecies에 feedItemId와 productItemId가 필요합니다.", { code: "invalid-args" });
  }
  const normalizedList = normalizeFarmAnimalSpeciesRecords([{
    ...existing,
    id: identity.id,
    name: identity.name,
    feedItemId,
    productItemId,
    productCount: typeof record.productCount === "number" ? record.productCount : 1,
    productEveryDays: typeof record.productEveryDays === "number" ? record.productEveryDays : 1,
    petFriendship: typeof record.petFriendship === "number" ? record.petFriendship : 0,
  }]) ?? [];
  const normalized = normalizedList[0];
  if (!normalized) throw new ToolError("가축 종 정규화에 실패했습니다.", { code: "invalid-args" });
  return normalized;
}

const upsertLifeSkill: ToolDefinition = {
  name: "upsert_life_skill",
  description: "생활 스킬(농사/채광/채집/낚시/전투) 레코드를 등록/수정한다. Database 생활 스킬 탭과 같은 저작 데이터.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      skill: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          skillType: { type: "string", enum: [...LIFE_SKILL_TYPES] },
          maxLevel: { type: "integer" },
          description: { type: "string" },
        },
        required: ["id", "name", "skillType"],
        additionalProperties: false,
      },
    },
    required: ["skill"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const identity = requireIdName(args.skill, "skill");
    const skill = parseLifeSkill(args.skill, draft.database.lifeSkills?.find((entry) => entry.id === identity.id));
    draft.database.lifeSkills = upsertById(draft.database.lifeSkills ?? [], skill);
    return { summary: `생활 스킬 ${skill.name}`, data: { skill } };
  },
};

const upsertLifeSystem: ToolDefinition = {
  name: "upsert_life_system",
  description: "생활 시스템 설정: 일일 날씨(dailyWeather)·가축 종(farmAnimalSpecies). 레시피/출하/에너지도 이 툴로 확장한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      dailyWeather: {
        type: "object",
        description: "일일 날씨 테이블. enabled와 계절별 가중치.",
        properties: {
          enabled: { type: "boolean" },
          forecastDays: { type: "integer" },
          seasons: {
            type: "object",
            properties: {
              spring: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, weight: { type: "number" }, intensity: { type: "number" } }, additionalProperties: false } },
              summer: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, weight: { type: "number" }, intensity: { type: "number" } }, additionalProperties: false } },
              fall: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, weight: { type: "number" }, intensity: { type: "number" } }, additionalProperties: false } },
              winter: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, weight: { type: "number" }, intensity: { type: "number" } }, additionalProperties: false } },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      farmAnimalSpecies: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          feedItemId: { type: "string" },
          productItemId: { type: "string" },
          productCount: { type: "integer" },
          productEveryDays: { type: "integer" },
          petFriendship: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const changed: string[] = [];
    if (args.dailyWeather && typeof args.dailyWeather === "object" && !Array.isArray(args.dailyWeather)) {
      draft.system.dailyWeather = normalizeDailyWeatherConfig(mergeRecordPatch(draft.system.dailyWeather, args.dailyWeather as Record<string, unknown>) as unknown as DailyWeatherConfig);
      changed.push("날씨");
    }
    if (args.farmAnimalSpecies) {
      const identity = requireIdName(args.farmAnimalSpecies, "farmAnimalSpecies");
      const species = parseAnimalSpecies(args.farmAnimalSpecies, draft.database.farmAnimalSpecies?.find((entry) => entry.id === identity.id));
      draft.database.farmAnimalSpecies = upsertById(draft.database.farmAnimalSpecies ?? [], species);
      changed.push(`가축=${species.id}`);
    }
    if (changed.length === 0) throw new ToolError("바꿀 생활 시스템 필드가 없습니다.", { code: "invalid-args" });
    return { summary: `생활 시스템 ${changed.join(", ")}`, data: { changed } };
  },
};

export const LIFE_SYSTEM_TOOLS: readonly ToolDefinition[] = [upsertLifeSkill, upsertLifeSystem];
