import { FARMING_CROP_SPRITE_ASSETS, type FarmingCropSpriteAsset } from "@/assets/farmingSprites";
import { isSeason, type Season } from "@/project/gameTime";
import type { CropGraphicStage, CropRecord, FarmTool } from "@/project/types";

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
  // 저작하지 않은 그래픽은 절대 레코드에 심지 않는다. 심으면 직렬화가 그것을 프로젝트에 새기고
  // (작가가 되돌릴 수 없다), 슬러그가 우연히 맞은 작물에 엔진 아트가 영구히 붙는다.
  // 화면용 파생은 `cropGraphicStages` 가 읽을 때만 계산한다. `graphicStages: []` 는 명시적 opt-out.
  const graphicStages = record.graphicStages === undefined
    ? undefined
    : normalizeGraphicStages(record.graphicStages);
  return {
    id: record.id,
    name: textOrDefault(record.name, "작물"),
    seedItemId: seedItemId || "item_seed",
    harvestItemId: harvestItemId || "item_crop",
    harvestCount: positiveInteger(record.harvestCount, 1),
    stages,
    seasons: seasons.length > 0 ? seasons : ["spring"],
    ...(regrowDays > 0 ? { regrow: { days: regrowDays } } : {}),
    ...(graphicStages === undefined ? {} : { graphicStages }),
  };
}

/**
 * 화면에 쓸 성장 그래픽. 저작 graphicStages 가 있으면 그것만 쓰고(빈 배열 = "아트 없음" 선언),
 * 키 자체가 없을 때만 등록된 스프라이트에서 파생한다. 파생값은 프로젝트에 저장되지 않는다.
 */
export function cropGraphicStages(
  crop: Pick<CropRecord, "id" | "harvestItemId" | "stages" | "graphicStages">
): readonly CropGraphicStage[] {
  if (crop.graphicStages !== undefined) return crop.graphicStages;
  return autoGraphicStages(crop.id, crop.harvestItemId, crop.stages.length);
}

/**
 * 성장 단계 → `graphicStages` 인덱스. **마지막 그림은 "수확 가능" 전용으로 예약한다.**
 *
 * 예약하지 않으면 그림 수와 성장 단계 수가 같은 작물(감자: 단계 2 · 그림 2)에서
 * 아직 익지 않은 마지막 단계와 수확기가 같은 그림이 된다 — 실측으로 1일차(수확 불가)와
 * 2일차(수확 가능)의 밭 한 칸이 픽셀 단위로 동일했다(0/3120px). 그림이 같으면 플레이어는
 * 익은 것을 구별할 방법이 없고, 눌러도 수확되지 않는 이유를 알 수 없다.
 *
 * 저작자가 단계보다 그림을 더 많이 준 경우(N+1장)는 이미 수확기 칸을 따로 그린 것이므로
 * 그 배선을 그대로 존중한다. 그림이 하나뿐이면 예약할 것이 없어 그것만 쓴다.
 * 반환 -1 은 "그릴 그림이 없음"(호출자가 폴백).
 */
export function cropGraphicIndexForStage(
  graphicCount: number,
  growthStageCount: number,
  stage: number
): number {
  if (graphicCount <= 0) return -1;
  const last = graphicCount - 1;
  const current = Math.max(0, Math.trunc(stage));
  // 저작자가 수확기 그림을 따로 줬다 — 단계를 그대로 매핑한다.
  if (graphicCount > growthStageCount) return Math.min(current, last);
  const ready = growthStageCount > 0 && current >= growthStageCount;
  if (ready) return last;
  // 자라는 중에는 마지막 그림을 쓰지 않는다(그림이 하나뿐이면 어쩔 수 없이 그것을 쓴다).
  return Math.min(current, Math.max(0, last - 1));
}

// 저작된 graphicStages 가 없으면 등록된 작물 스프라이트에서 자동 배선한다.
// 작물 id(`crop_potato`) → 에셋 id(`farming-crop-potato`) 가 실제 규칙이고, 그게 안 맞으면
// 수확 아이템 id(`item_potato`)로 한 번 더 시도한다(두 접두사만 실제 데이터에 존재).
function autoGraphicStages(cropId: string, harvestItemId: string, stageCount: number): CropGraphicStage[] {
  const asset = autoCropSpriteAsset(cropId, harvestItemId);
  if (!asset) return [];
  const lastFrame = Math.max(0, asset.frameCount - 1);
  return Array.from({ length: stageCount }, (_, index) => ({
    resourceId: asset.id,
    // 프레임 수보다 성장 단계가 많아도 사라지지 않도록 마지막 프레임을 반복한다.
    frame: Math.min(index, lastFrame),
  }));
}

/** 작물이 자동 배선될 스프라이트 에셋. 저작 graphicStages 가 있으면 쓰이지 않는다. */
export function autoCropSpriteAsset(cropId: string, harvestItemId: string | undefined): FarmingCropSpriteAsset | undefined {
  return findCropSpriteAsset(cropId) ?? findCropSpriteAsset(harvestItemId ?? "");
}

function findCropSpriteAsset(id: string): FarmingCropSpriteAsset | undefined {
  const slug = id.replace(/^(crop|item)_/, "");
  if (!slug) return undefined;
  return FARMING_CROP_SPRITE_ASSETS.find((asset) => asset.id === `farming-crop-${slug}`);
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
