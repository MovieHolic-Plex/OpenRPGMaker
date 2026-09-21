// editor/tools/village/authoringData.ts
// 사용자 저작 마을 데이터 → 하네스 입력 어댑터.
//
// 이 파일이 "사용자가 데이터베이스에서 정한 값" 과 "코드 상수" 가 만나는 유일한 지점이다.
// 우선순위: 명시 인자(AI가 문장에서 뽑은 값) > 사용자 프리셋 > 테마 추론 > 씨앗값 파생.
// 저장된 레코드는 신뢰하지 않는다 — 열거형·범위를 여기서 좁히고, 못 쓰는 값은 경고로 흘린다.

import { isHouseKitId, type HouseKitId } from "@/editor/houseKit";
import { AUTHORED_HOUSE_FORM_DEFS, type AuthoredHouseFormDef } from "@/project/defaults/authoredHouseFormCatalog";
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

/** 원형이 정하는 값. 프리셋 레코드의 부분집합이며 전부 `presetOverrides` 가 다시 검증한다. */
export interface VillageArchetypeValues {
  readonly pathStyle?: (typeof VILLAGE_PATH_STYLES)[number];
  readonly yardStyle?: (typeof VILLAGE_YARD_STYLES)[number];
  readonly plazaStyle?: (typeof VILLAGE_PLAZA_STYLES)[number];
  readonly plazaLayout?: (typeof VILLAGE_PLAZA_LAYOUTS)[number];
  readonly edgeTrees?: (typeof VILLAGE_EDGE_TREE_STYLES)[number];
  readonly kitMix?: "mixed" | HouseKitId;
}

export interface VillageArchetype {
  readonly id: string;
  readonly name: string;
  /** 이 원형을 고르게 만드는 테마 낱말. 전부 리터럴이라 `includes` 로 판정한다. */
  readonly keywords: readonly string[];
  readonly note: string;
  readonly values: VillageArchetypeValues;
}

/**
 * 마을 원형 — 예전에는 `builder.ts` 의 `inferIntentFromTheme` 안에 정규식 6갈래로만 있었다.
 *
 * 그때는 이 값에 닿는 길이 자유 문장 `theme` 하나뿐이었다. "항구 마을"은 걸리고 "바닷가 촌"은
 * 안 걸리는데 사용자는 왜 다른지 알 수 없었고, 프리셋 레코드가 0개면 프롬프트의 프리셋 섹션이
 * 통째로 빠지므로 AI 는 `presetId` 로 지목할 후보 자체를 못 봤다.
 *
 * 그래서 여기를 정본으로 올린다 — 테마 추론(`matchVillageArchetype`)과 데이터베이스 「마을」탭의
 * 「원형에서 만들기」가 **같은 배열**을 읽는다. 한쪽만 고쳐서 갈라질 자리를 없앤다.
 *
 * 순서가 계약이다: 위에서부터 첫 일치를 쓴다. 「장터」는 「어촌」보다 앞에 둔다.
 * 물가만으로 시장을 만들지 않되, "항구 장터"처럼 명시한 시장은 유지한다.
 *
 * 씨앗값 파생 항목(roadWidth·roadNaturalness·settlementLayout)과 houseCount·npcCount·groundTheme 은
 * 일부러 비운다. 매번 달라야 하는 다양성 장치라 원형이 굳히면 같은 마을만 나온다 — 프리셋에서
 * undefined 로 남으면 하네스가 seed 로 정한다.
 */
export const VILLAGE_ARCHETYPES: readonly VillageArchetype[] = [
  {
    id: "castle-stone",
    name: "성곽·석조",
    keywords: ["성곽", "석조", "돌길", "성문", "castle", "citadel"],
    note: "포석 돌길과 작업장 마당. 광장은 정원으로 둔다.",
    values: { pathStyle: "stone", yardStyle: "workshop", plazaStyle: "garden", edgeTrees: "conifer" },
  },
  {
    id: "market-fair",
    name: "장터·시장",
    keywords: ["장터", "시장", "market", "fair", "축제"],
    note: "모래길과 노점 마당. 광장 위치는 배치가 정하게 둔다.",
    values: { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", edgeTrees: "conifer" },
  },
  {
    id: "harbor-coast",
    name: "어촌·항구",
    keywords: ["어촌", "항구", "바다", "호수", "강가", "해안", "coast", "harbor", "lake", "river", "beach", "sand"],
    note: "모래길과 혼합 마당. 광장은 남쪽 빈터이며 물가만으로 시장을 추가하지 않는다.",
    values: { pathStyle: "sand", yardStyle: "mixed", plazaStyle: "empty", plazaLayout: "south", edgeTrees: "conifer" },
  },
  {
    id: "farm-rural",
    name: "농촌·목장",
    keywords: ["농", "밭", "촌락", "farm", "rural", "목장", "목축"],
    note: "흙길과 텃밭 마당. 바깥 숲을 빽빽하게 두르고 광장은 가운데.",
    values: { pathStyle: "dirt", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "dense", plazaLayout: "center" },
  },
  {
    id: "mine-mountain",
    name: "광산·산골",
    keywords: ["광산", "산골", "mine", "mountain", "채석"],
    note: "흙길과 작업장 마당. 광장은 빈터로 두고 재료를 청석으로 고정한다.",
    values: { pathStyle: "dirt", yardStyle: "workshop", plazaStyle: "empty", edgeTrees: "dense", kitMix: "blue-stone" },
  },
  {
    id: "garden-bloom",
    name: "정원·꽃",
    keywords: ["정원", "꽃", "garden"],
    note: "모래길과 텃밭 마당. 광장도 정원으로 맞춘다.",
    values: { pathStyle: "sand", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "conifer" },
  },
];

/**
 * 테마 문장에서 원형을 찾는다. 위에서부터 첫 일치 — `VILLAGE_ARCHETYPES` 의 순서가 곧 우선순위다.
 * 낱말이 전부 리터럴이라 정규식 없이 `includes` 로 판정한다. 시장과 물가가 겹치면 시장이 우선한다.
 */
export function matchVillageArchetype(theme: string): VillageArchetype | undefined {
  const normalized = theme.trim().toLowerCase();
  if (!normalized) return undefined;
  return VILLAGE_ARCHETYPES.find((archetype) => archetype.keywords.some((keyword) => normalized.includes(keyword)));
}

export function villageArchetypeById(id: string): VillageArchetype | undefined {
  return VILLAGE_ARCHETYPES.find((archetype) => archetype.id === id);
}

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

/**
 * 저작 셀 레시피 → 슬롯 카탈로그 템플릿. 날개는 bbox 한 장이라 배치·보호·울타리는 기존
 * 사각형 문법을 그대로 타고, 스탬프만 houses.ts 가 레시피로 분기한다.
 */
export function formToTemplate(form: AuthoredHouseFormDef): HouseTemplate {
  const wing = { x: 0, y: 0, w: form.w, h: form.h };
  return {
    id: form.id,
    name: form.name,
    w: form.w,
    h: form.h,
    stories: form.stories,
    kitId: form.kitId,
    wings: [wing],
    wingsAt: (x: number, y: number) => [{ x, y, w: form.w, h: form.h }],
    form,
  };
}

/**
 * 마을 슬롯에 들어가는 저작 형태 — 폭이 슬롯 상한(8)을 넘는 레시피(저택·쌍박공 11칸)는
 * author_house 로만 쓴다. 정주지·왕궁 도시 참고 형태가 여기서 34종 날개 형태와 같은 후보 풀에 섞인다.
 */
export function villageFormTemplates(): HouseTemplate[] {
  return AUTHORED_HOUSE_FORM_DEFS.filter((form) => form.w <= VILLAGE_RANGE.templateW.max).map(formToTemplate);
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
    if (wing.stories !== undefined && ![1, 2, 3].includes(wing.stories)) return { reason: "날개 층수는 1·2·3 중 하나여야 합니다" };
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
    wings: wings.map((wing) => ({
      x: wing.x,
      y: wing.y,
      w: wing.w,
      h: wing.h,
      ...(wing.stories === undefined ? {} : { stories: wing.stories }),
    })),
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
 */
function shapeReason(record: {
  readonly w: number;
  readonly h: number;
  readonly stories: 1 | 2 | 3;
  readonly lowWall?: boolean;
  readonly kitId?: string;
  readonly wings: readonly VillageTemplateWing[];
}): string | undefined {
  const filled = (x: number, y: number): boolean =>
    record.wings.some((wing) => x >= wing.x && x < wing.x + wing.w && y >= wing.y && y < wing.y + wing.h);
  /**
   * 그 열을 덮는 날개의 층수 — 계단식 2층은 열마다 벽 밴드가 다르다.
   * 층수를 선언한 날개가 이긴다(시공기 `storiesAt` 과 같은 규칙).
   */
  const storiesAtColumn = (x: number): number => {
    const containing = record.wings.filter((wing) => x >= wing.x && x < wing.x + wing.w);
    for (const wing of containing) if (wing.stories !== undefined) return wing.stories;
    return record.stories;
  };
  for (let x = 0; x < record.w; x += 1) {
    const columnBand = record.lowWall ? 2 : 2 + (2 * storiesAtColumn(x) - 1);
    const columnRun = minWingRun({ stories: storiesAtColumn(x), lowWall: record.lowWall });
    let run = 0;
    for (let y = 0; y <= record.h; y += 1) {
      if (y < record.h && filled(x, y)) {
        run += 1;
        continue;
      }
      if (run > 0 && run < columnRun) {
        return `x=${x} 열이 이어서 ${run}칸뿐입니다 — 이 열(${storiesAtColumn(x)}층)은 ${columnRun}칸 이상이어야 합니다 (벽 ${columnBand} + 지붕 2)`;
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
 *  · 내장 34종 + 참고 사례 셀 레시피(폭 8 이하) + 사용자 형태. 같은 id면 사용자 것이 이긴다(오버라이드).
 *  · allowIds(프리셋 화이트리스트)가 있으면 그 id만 남긴다. 하나도 안 남으면 전체로 되돌린다.
 */
export function villageTemplateCatalog(
  project: Project | undefined,
  allowIds?: readonly string[],
): TemplateCatalogResult {
  const warnings: string[] = [];
  const byId = new Map<string, HouseTemplate>();
  for (const def of HOUSE_TEMPLATE_DEFS) byId.set(def.id, defToTemplate(def));
  for (const template of villageFormTemplates()) byId.set(template.id, template);
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
