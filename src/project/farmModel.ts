import { isSeason, type Season } from "@/project/gameTime";
import type { AnimalRecord, CropGraphicStage, CropRecord, FarmTool } from "@/project/types";

export const FARM_TOOLS = ["hoe", "wateringCan", "axe", "pickaxe"] as const satisfies readonly FarmTool[];

export function isFarmTool(value: unknown): value is FarmTool {
  return typeof value === "string" && (FARM_TOOLS as readonly string[]).includes(value);
}

export function normalizeCropRecord(record: Partial<CropRecord> & Pick<CropRecord, "id" | "name">): CropRecord {
  const seedItemId = cleanId(record.seedItemId);
  const harvestItemId = cleanId(record.harvestItemId);
  const stages = normalizeStages(record.stages);
  const seasons = normalizeSeasons(record.seasons);
  const regrowDays = positiveInteger(record.regrow?.days, 0);
  const graphicStages = normalizeGraphicStages(record.graphicStages);
  return {
    id: record.id,
    name: textOrDefault(record.name, "작물"),
    seedItemId: seedItemId || "item_seed",
    harvestItemId: harvestItemId || "item_crop",
    harvestCount: positiveInteger(record.harvestCount, 1),
    stages,
    seasons: seasons.length > 0 ? seasons : ["spring"],
    ...(regrowDays > 0 ? { regrow: { days: regrowDays } } : {}),
    ...(graphicStages.length > 0 ? { graphicStages } : {}),
  };
}

// 농장 동물 레코드 정규화 — crops/monsterSpecies 와 동일 계약. 이전에는 database.animals 가
// `database.animals ?? []` 로 정규화 없이 통과해, 임의 필드·비정상 수치가 그대로 영속화됐다.
export function normalizeAnimalRecord(record: Partial<AnimalRecord> & Pick<AnimalRecord, "id" | "name">): AnimalRecord {
  const produceItemId = cleanId(record.produceItemId);
  const graphicResourceId = cleanId(record.graphicResourceId);
  const animalType = typeof record.animalType === "string" && record.animalType.trim()
    ? record.animalType.trim()
    : "chicken";
  return {
    id: record.id,
    name: textOrDefault(record.name, "동물"),
    animalType,
    ...(produceItemId ? { produceItemId } : {}),
    produceDays: clampInteger(record.produceDays, 1, 3650, 1),
    friendshipRequired: clampInteger(record.friendshipRequired, 0, 1000, 0),
    ...(graphicResourceId ? { graphicResourceId } : {}),
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function normalizeStages(stages: readonly Partial<{ readonly days: number }>[] | undefined): CropRecord["stages"] {
  const normalized = (stages ?? [])
    .map((stage) => ({ days: positiveInteger(stage.days, 1) }))
    .filter((stage) => stage.days > 0);
  return normalized.length > 0 ? normalized : [{ days: 1 }];
}

function normalizeSeasons(seasons: readonly unknown[] | undefined): Season[] {
  const result: Season[] = [];
  const seen = new Set<Season>();
  for (const season of seasons ?? []) {
    if (!isSeason(season) || seen.has(season)) continue;
    seen.add(season);
    result.push(season);
  }
  return result;
}

function normalizeGraphicStages(stages: readonly Partial<CropGraphicStage>[] | undefined): CropGraphicStage[] {
  return (stages ?? []).flatMap((stage): CropGraphicStage[] => {
    const resourceId = cleanId(stage.resourceId);
    const frame = typeof stage.frame === "string" || typeof stage.frame === "number" ? stage.frame : undefined;
    const label = typeof stage.label === "string" && stage.label.trim().length > 0 ? stage.label.trim() : undefined;
    if (!resourceId && frame === undefined && !label) return [];
    return [{ ...(resourceId ? { resourceId } : {}), ...(frame !== undefined ? { frame } : {}), ...(label ? { label } : {}) }];
  });
}

function textOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function cleanId(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function positiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}
