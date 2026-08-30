// editor/tools/village/authoringData.ts
// 사용자 저작 마을 데이터 → 하네스 입력 어댑터.
//
// 이 파일이 "사용자가 데이터베이스에서 정한 값" 과 "코드 상수" 가 만나는 유일한 지점이다.
// 우선순위: 명시 인자(AI가 문장에서 뽑은 값) > 사용자 프리셋 > 테마 추론 > 씨앗값 파생.
// 저장된 레코드는 신뢰하지 않는다 — 열거형·범위를 여기서 좁히고, 못 쓰는 값은 경고로 흘린다.

import { HOUSE_KITS, isHouseKitId, type HouseKitId } from "@/editor/houseKit";
import { HOUSE_TEMPLATE_DEFS, houseTemplateWingsAt, type HouseTemplateDef } from "@/project/defaults/houseTemplateCatalog";
import type { Project } from "@/project/types";
import type { VillageHouseTemplateRecord, VillageLayoutPresetRecord, VillageTemplateWing } from "@/project/types/village";
import type { HouseTemplate } from "./constants";

export interface VillageAuthoringData {
  readonly templates: readonly VillageHouseTemplateRecord[];
  readonly presets: readonly VillageLayoutPresetRecord[];
}

// 열거형·범위의 정본. 데이터베이스 「마을」탭이 이 목록을 그대로 select 로 그리므로,
// 화면에서 고를 수 있는 값과 하네스가 받아들이는 값이 어긋날 수 없다. 전에 여기서
// 갈라진 적이 있는 항목(roadWidth 2~3, roadNaturalness 하한 0.35)은 특히 그렇다.
export const VILLAGE_PATH_STYLES = ["sand", "dirt", "stone"] as const;
export const VILLAGE_YARD_STYLES = ["mixed", "garden", "workshop", "market", "minimal"] as const;
export const VILLAGE_PLAZA_STYLES = ["market", "garden", "empty"] as const;
export const VILLAGE_PLAZA_LAYOUTS = ["center", "north", "south", "west", "east"] as const;
export const VILLAGE_EDGE_TREE_STYLES = ["conifer", "dense", "none"] as const;
export const VILLAGE_LAYOUT_IDS = ["plaza-ring", "street-grid", "clusters"] as const;
export const VILLAGE_GROUND_THEME_IDS = ["grass", "snow"] as const;

// 날개 하한 3×3 은 내장 34종에서 뽑은 값이다 — 「현관 오두막」의 뒷채가 3×3 이고 「ㄷ자」의
// 두 다리도 3×3 이다. 여기를 3×4 로 조이면 내장 형태를 복제해 온 순간 화면이 "규약 위반" 을
// 띄우는데 하네스는 잘 짓는다. 검증은 test/villageAuthoringData.test.ts 의 34종 왕복이 맡는다.
export const VILLAGE_RANGE = {
  roadWidth: { min: 2, max: 3 },
  roadNaturalness: { min: 0.35, max: 1 },
  houseCount: { min: 1, max: 32 },
  npcCount: { min: 0, max: 512 },
  templateW: { min: 3, max: 8 },
  templateH: { min: 4, max: 24 },
  wingW: { min: 3, max: 8 },
  wingH: { min: 3, max: 24 },
} as const;

/** 프로젝트에 저장된 마을 저작 레코드. 없으면 빈 목록 — 하네스는 코드 카탈로그로 동작한다. */
export function villageAuthoringData(project: Project | undefined): VillageAuthoringData {
  return {
    templates: project?.villageTemplates ?? [],
    presets: project?.villagePresets ?? [],
  };
}

function defToTemplate(def: HouseTemplateDef): HouseTemplate {
  return {
    ...def,
    wingsAt: (x: number, y: number) => houseTemplateWingsAt(def, x, y),
  };
}

/** 사용자 형태 레코드를 시공 가능한 템플릿으로 좁힌다. 규약 위반이면 이유를 준다. */
export function templateFromRecord(record: VillageHouseTemplateRecord): { template: HouseTemplate } | { reason: string } {
  const { id, name, w, h } = record;
  const { templateW, templateH, wingW, wingH } = VILLAGE_RANGE;
  if (!id.trim()) return { reason: "id가 비어 있습니다" };
  if (!Number.isInteger(w) || w < templateW.min || w > templateW.max) {
    return { reason: `폭은 ${templateW.min}~${templateW.max}칸이어야 합니다 (지금 ${w})` };
  }
  if (!Number.isInteger(h) || h < templateH.min || h > templateH.max) {
    return { reason: `높이는 ${templateH.min}~${templateH.max}칸이어야 합니다 (지금 ${h})` };
  }
  const wings = record.wings ?? [];
  if (wings.length === 0) return { reason: "날개가 없습니다" };
  for (const wing of wings) {
    if (![wing.x, wing.y, wing.w, wing.h].every((value) => Number.isInteger(value))) return { reason: "날개 좌표가 정수가 아닙니다" };
    if (wing.x < 0 || wing.y < 0) return { reason: "날개 좌표가 음수입니다" };
    if (wing.w < wingW.min || wing.h < wingH.min) return { reason: `날개는 최소 ${wingW.min}×${wingH.min}칸이어야 합니다` };
    if (wing.x + wing.w > w || wing.y + wing.h > h) return { reason: "날개가 바운딩 박스를 넘습니다" };
  }
  if (record.kitId !== undefined && !isHouseKitId(record.kitId)) return { reason: `모르는 재료 킷: ${record.kitId}` };
  const stories = record.stories === 2 ? 2 : record.stories === 3 ? 3 : 1;
  const shape = shapeReason({ ...record, stories });
  if (shape) return { reason: shape };
  const def: HouseTemplateDef = {
    id,
    name: name.trim() || id,
    w,
    h,
    stories,
    ...(record.lowWall ? { lowWall: true } : {}),
    ...(record.kitId !== undefined && isHouseKitId(record.kitId) ? { kitId: record.kitId } : {}),
    ...(record.roofDeck ? { roofDeck: true } : {}),
    wings: wings.map((wing) => ({ x: wing.x, y: wing.y, w: wing.w, h: wing.h })),
  };
  return { template: defToTemplate(def) };
}

/**
 * 한 열이 이어져야 하는 최소 행 수 — 벽 밴드 + 지붕 2행.
 * 화면이 날개를 새로 만들 때 이 높이로 시작해야 「추가」 직후 규약 위반이 되지 않는다.
 */
export function minWingRun(options: { readonly stories?: number; readonly lowWall?: boolean }): number {
  const stories = options.stories === 3 ? 3 : options.stories === 2 ? 2 : 1;
  return (options.lowWall ? 2 : 2 + (2 * stories - 1)) + 2;
}

/**
 * 시공기(`houseKit.ts` 의 `stampFootprintHouseKit`)가 실제로 요구하는 기하 규약.
 * 여기서 안 보면 화면은 "통과" 라고 하는데 시공은 집을 한 채도 못 세운다 — 8×8 에
 * 위 4행만 폭 8, 아래 4행은 왼쪽 4칸인 ㅜ 자 형태로 실측했다(2026-08-30).
 *  · 벽 밴드 = lowWall ? 2 : 2 + (2×층수 − 1) 행. 그 위에 지붕이 최소 2행 더 붙는다.
 *  · 그래서 **열마다** 이어진 칸이 (벽 밴드 + 2) 행 이상이어야 한다. 위 예에서 오른쪽
 *    열은 4행뿐이라 1층 기준 5행을 못 채운다.
 *  · A자 지붕 킷은 지붕이 피라미드라 날개 하나 + 높이가 폭에 묶인다.
 */
function shapeReason(record: {
  readonly w: number;
  readonly h: number;
  readonly stories: 1 | 2 | 3;
  readonly lowWall?: boolean;
  readonly kitId?: string;
  readonly wings: readonly VillageTemplateWing[];
}): string | undefined {
  const wallBandRows = record.lowWall ? 2 : 2 + (2 * record.stories - 1);
  const minRun = minWingRun(record);
  if (record.kitId !== undefined && isHouseKitId(record.kitId) && HOUSE_KITS[record.kitId].roof.kind === "aframe") {
    if (record.wings.length !== 1) return "A자 지붕 킷은 날개 하나짜리 직사각형만 됩니다";
    const wing = record.wings[0]!;
    const required = wallBandRows + Math.floor((wing.w - 1) / 2) + 1;
    if (wing.h !== required) {
      return `A자 지붕 킷은 폭 ${wing.w}일 때 높이가 정확히 ${required}칸이어야 합니다 (지금 ${wing.h})`;
    }
  }
  const filled = (x: number, y: number): boolean =>
    record.wings.some((wing) => x >= wing.x && x < wing.x + wing.w && y >= wing.y && y < wing.y + wing.h);
  for (let x = 0; x < record.w; x += 1) {
    let run = 0;
    for (let y = 0; y <= record.h; y += 1) {
      if (y < record.h && filled(x, y)) {
        run += 1;
        continue;
      }
      if (run > 0 && run < minRun) {
        return `x=${x} 열이 이어서 ${run}칸뿐입니다 — 한 열은 ${minRun}칸 이상이어야 합니다 (벽 ${wallBandRows} + 지붕 2)`;
      }
      run = 0;
    }
  }
  return undefined;
}

export interface TemplateCatalogResult {
  readonly templates: readonly HouseTemplate[];
  readonly warnings: readonly string[];
}

/**
 * 시공에 쓸 형태 카탈로그.
 *  · 내장 34종 + 사용자 형태. 같은 id면 사용자 것이 이긴다(오버라이드).
 *  · allowIds(프리셋 화이트리스트)가 있으면 그 id만 남긴다. 하나도 안 남으면 전체로 되돌린다.
 */
export function villageTemplateCatalog(
  project: Project | undefined,
  allowIds?: readonly string[],
): TemplateCatalogResult {
  const warnings: string[] = [];
  const byId = new Map<string, HouseTemplate>();
  for (const def of HOUSE_TEMPLATE_DEFS) byId.set(def.id, defToTemplate(def));
  for (const record of villageAuthoringData(project).templates) {
    const resolved = templateFromRecord(record);
    if ("reason" in resolved) {
      warnings.push(`사용자 집 형태 "${record.name || record.id}" 를 건너뜁니다: ${resolved.reason}`);
      continue;
    }
    byId.set(resolved.template.id, resolved.template);
  }
  const all = [...byId.values()];
  const wanted = allowIds?.filter((id) => id.trim()) ?? [];
  if (wanted.length === 0) return { templates: all, warnings };
  const missing = wanted.filter((id) => !byId.has(id));
  if (missing.length > 0) warnings.push(`프리셋이 가리키는 형태 id를 찾을 수 없습니다: ${missing.join(", ")}`);
  const filtered = all.filter((template) => wanted.includes(template.id));
  if (filtered.length === 0) {
    warnings.push("프리셋의 형태 목록이 전부 비어 카탈로그 전체를 씁니다.");
    return { templates: all, warnings };
  }
  return { templates: filtered, warnings };
}

export function villagePresetById(project: Project | undefined, presetId: string): VillageLayoutPresetRecord | undefined {
  return villageAuthoringData(project).presets.find((preset) => preset.id === presetId);
}

/** 프리셋에서 하네스 인자로 쓸 수 있는 값만 뽑는다 — 열거형·범위를 통과한 것만. */
export interface PresetOverrides {
  readonly pathStyle?: (typeof VILLAGE_PATH_STYLES)[number];
  /** `villagePlan.KitMix` 와 같은 모양이어야 한다 — 하네스가 이 값을 기본값으로 그대로 넘긴다. */
  readonly kitMix?: "mixed" | HouseKitId;
  readonly yardStyle?: (typeof VILLAGE_YARD_STYLES)[number];
  readonly plazaStyle?: (typeof VILLAGE_PLAZA_STYLES)[number];
  readonly plazaLayout?: (typeof VILLAGE_PLAZA_LAYOUTS)[number];
  readonly edgeTrees?: (typeof VILLAGE_EDGE_TREE_STYLES)[number];
  readonly settlementLayout?: (typeof VILLAGE_LAYOUT_IDS)[number];
  readonly groundTheme?: (typeof VILLAGE_GROUND_THEME_IDS)[number];
  readonly roadWidth?: number;
  readonly roadNaturalness?: number;
  readonly houseCount?: number;
  readonly npcCount?: number;
  readonly templateIds?: readonly string[];
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function pickInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  return value < min || value > max ? undefined : value;
}

export function presetOverrides(preset: VillageLayoutPresetRecord | undefined): PresetOverrides {
  if (!preset) return {};
  const { roadWidth, roadNaturalness, houseCount, npcCount } = VILLAGE_RANGE;
  const kitMix = typeof preset.kitMix === "string"
    && (preset.kitMix === "mixed" || isHouseKitId(preset.kitMix))
    ? preset.kitMix
    : undefined;
  const naturalness = typeof preset.roadNaturalness === "number" && Number.isFinite(preset.roadNaturalness)
    ? Math.min(roadNaturalness.max, Math.max(roadNaturalness.min, preset.roadNaturalness))
    : undefined;
  return {
    ...defined("pathStyle", pick(preset.pathStyle, VILLAGE_PATH_STYLES)),
    ...defined("kitMix", kitMix),
    ...defined("yardStyle", pick(preset.yardStyle, VILLAGE_YARD_STYLES)),
    ...defined("plazaStyle", pick(preset.plazaStyle, VILLAGE_PLAZA_STYLES)),
    ...defined("plazaLayout", pick(preset.plazaLayout, VILLAGE_PLAZA_LAYOUTS)),
    ...defined("edgeTrees", pick(preset.edgeTrees, VILLAGE_EDGE_TREE_STYLES)),
    ...defined("settlementLayout", pick(preset.settlementLayout, VILLAGE_LAYOUT_IDS)),
    ...defined("groundTheme", pick(preset.groundTheme, VILLAGE_GROUND_THEME_IDS)),
    ...defined("roadWidth", pickInt(preset.roadWidth, roadWidth.min, roadWidth.max)),
    ...defined("roadNaturalness", naturalness),
    ...defined("houseCount", pickInt(preset.houseCount, houseCount.min, houseCount.max)),
    ...defined("npcCount", pickInt(preset.npcCount, npcCount.min, npcCount.max)),
    ...(preset.templateIds && preset.templateIds.length > 0 ? { templateIds: [...preset.templateIds] } : {}),
  };
}

/** 통과한 값만 키로 남긴다 — `undefined` 를 그대로 얹으면 `?? 기본값` 폴백이 깨진다. */
function defined<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
