// 마을 계층 계획(VillagePlan): LLM/에디터가 쓰는 의도 문서.
// 타일을 바꾸지 않고 검증·정규화만 한다. 시공은 build_village가 맡는다.

import type { BuildSpec, SpecAsset } from "@/ai/buildSpec";
import type { HouseKitId } from "@/editor/houseKit";
import type { Project } from "@/project/types";
import { isYardDecorKind, type YardDecorKind } from "./houseLotDecor";
import { ToolError } from "./types";
import {
  inferRequirementsFromQuery,
  requirementsSummary,
  styleHintsFromRequirements,
  type LandmarkKind,
  type VillageRequirements,
} from "./villageRequirements";

export type RoadStyle = "sand" | "dirt";
export type KitMix = "mixed" | "blue-stone" | "bright-plaster";
export type YardStyle = "mixed" | "garden" | "workshop" | "market" | "minimal";
export type PlazaStyle = "market" | "garden" | "empty";
export type EdgeTrees = "conifer" | "dense" | "none";
export type PlazaLayout = "center" | "north" | "south" | "west" | "east";

/**
 * 멀티턴 시공 레이어. LLM이 buildOrder로 순서를 기획한다.
 * 호수/강 마을 → water를 settlement 앞. 일반 마을 → 집·길(settlement) 후 숲.
 */
export type VillageBuildLayerId =
  | "plan"
  | "map"
  | "water"
  | "settlement"
  | "forest_conifer"
  | "forest_big"
  | "critique"
  | "look";

export const ALL_VILLAGE_BUILD_LAYERS: readonly VillageBuildLayerId[] = [
  "plan",
  "map",
  "water",
  "settlement",
  "forest_conifer",
  "forest_big",
  "critique",
  "look",
] as const;

export interface VillageHousePlan {
  readonly id: string;
  readonly kitId: HouseKitId;
  readonly yard: readonly YardDecorKind[];
  readonly ownerName?: string;
}

export interface VillageNpcPlan {
  readonly name: string;
  readonly lines: readonly string[];
}

export interface VillagePlan {
  readonly version: 1;
  readonly id: string;
  readonly theme: string;
  /** 사용자 쿼리에서 뽑은 상식 필수 스펙(강/숲/장터 등). */
  readonly requirements: VillageRequirements;
  readonly pathStyle: RoadStyle;
  readonly kitMix: KitMix;
  readonly yardStyle: YardStyle;
  readonly plazaStyle: PlazaStyle;
  readonly edgeTrees: EdgeTrees;
  readonly plazaLayout: PlazaLayout;
  readonly houses: readonly VillageHousePlan[];
  readonly npcs: readonly VillageNpcPlan[];
  readonly fences: boolean;
  readonly decor: boolean;
  readonly interior: boolean;
  readonly seed: number;
  readonly mapName?: string;
  readonly width?: number;
  readonly height?: number;
  /**
   * 시공 레이어 순서(LLM 기획). 예: 호수마을 ["plan","map","water","settlement","forest_conifer",...],
   * 산골 ["plan","map","settlement","forest_conifer","forest_big",...].
   * settlement 내부는 항상 집→길→울타리→소품·NPC.
   */
  readonly buildOrder: readonly VillageBuildLayerId[];
  readonly summary: string;
}

export interface PlanIssue {
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface NormalizePlanResult {
  readonly plan: VillagePlan;
  readonly issues: readonly PlanIssue[];
  readonly ok: boolean;
}

// 마을 집 수 경계 — plan/build 공유 단일 소스(구버그: plan=12 vs build=32로 파일마다 달라 드리프트).
// 32는 대형 마을(100×100 등) 시공 상한. 일반 마을은 area/budget 게이트가 실질 상한을 낮춘다.
export const MIN_HOUSES = 4;
export const MAX_HOUSES = 32;
const DEFAULT_SEED = 1;

export function normalizeVillagePlan(raw: unknown, seedFallback = DEFAULT_SEED): NormalizePlanResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError("plan은 객체여야 합니다.", { code: "invalid-args" });
  }
  const input = raw as Record<string, unknown>;
  const issues: PlanIssue[] = [];

  const theme = typeof input.theme === "string" ? input.theme.trim() : "";
  if (!theme) issues.push({ severity: "warning", message: "theme이 비어 있다. 기본 톤으로 정규화한다." });

  // 쿼리 상식 스펙 — theme/query 문자열에서 강·숲·장터 등 필수 요소 추출
  const queryText = typeof input.query === "string" && input.query.trim() ? input.query.trim() : theme;
  const requirements = input.requirements && typeof input.requirements === "object"
    ? mergeRequirements(queryText, input.requirements as Partial<VillageRequirements>)
    : inferRequirementsFromQuery(queryText);
  if (requirements.landmarks.length > 0) {
    issues.push({
      severity: "warning",
      message: `쿼리 상식 스펙: ${requirementsSummary(requirements)}`,
    });
  }

  const inferred = { ...inferFromTheme(theme), ...styleHintsFromRequirements(requirements) };
  const pathStyle = enumOr(input.pathStyle, ["sand", "dirt"] as const, inferred.pathStyle ?? "sand", "pathStyle", issues);
  const kitMix = enumOr(input.kitMix, ["mixed", "blue-stone", "bright-plaster"] as const, inferred.kitMix ?? "mixed", "kitMix", issues);
  const yardStyle = enumOr(input.yardStyle, ["mixed", "garden", "workshop", "market", "minimal"] as const, inferred.yardStyle ?? "mixed", "yardStyle", issues);
  const plazaStyle = enumOr(input.plazaStyle, ["market", "garden", "empty"] as const, inferred.plazaStyle ?? "market", "plazaStyle", issues);
  const edgeTrees = enumOr(input.edgeTrees, ["conifer", "dense", "none"] as const, inferred.edgeTrees ?? "conifer", "edgeTrees", issues);
  const plazaLayout = enumOr(input.plazaLayout, ["center", "north", "south", "west", "east"] as const, inferred.plazaLayout ?? "center", "plazaLayout", issues);

  const seed = typeof input.seed === "number" && Number.isInteger(input.seed) ? input.seed : seedFallback;
  const fences = input.fences !== false;
  const decor = input.decor !== false;
  const interior = input.interior !== false;

  const houses = normalizeHouses(input.houses ?? input.housePlans, kitMix, issues);
  const npcs = normalizeNpcs(input.npcs, issues);

  const id = typeof input.id === "string" && input.id.trim()
    ? input.id.trim()
    : `vplan_${Math.abs(hashString(`${theme}|${seed}|${houses.length}`)).toString(36)}`;

  const mapName = typeof input.mapName === "string" && input.mapName.trim()
    ? input.mapName.trim()
    : typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : theme
        ? `${theme}`
        : "마을 50x50";

  const width = optionalSize(input.width, "width", issues);
  const height = optionalSize(input.height, "height", issues);

  const buildOrder = normalizeBuildOrder(input.buildOrder, requirements, edgeTrees, issues);

  const summary = [
    buildPlanSummary({
      theme: theme || "(테마 없음)",
      pathStyle,
      yardStyle,
      plazaStyle,
      plazaLayout,
      edgeTrees,
      houseCount: houses.length,
      npcCount: npcs.length,
      fences,
      decor,
    }),
    requirementsSummary(requirements),
    `시공순서: ${buildOrder.filter((l) => l !== "plan" && l !== "map" && l !== "critique" && l !== "look").join("→")}`,
  ].join(" | ");

  const plan: VillagePlan = {
    version: 1,
    id,
    theme,
    requirements,
    pathStyle,
    kitMix,
    yardStyle,
    plazaStyle,
    edgeTrees,
    plazaLayout,
    houses,
    npcs,
    fences,
    decor,
    interior,
    seed,
    mapName,
    buildOrder,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    summary,
  };

  const errors = issues.filter((issue) => issue.severity === "error");
  return { plan, issues, ok: errors.length === 0 };
}

/**
 * requirements 기반 기본 시공 순서.
 * - 강/호수/항구 마을: water를 settlement 앞 (지형 자리 확보)
 * - 숲 필요 시 settlement 뒤 forest
 * - settlement 내부는 코드가 집→길 순 고정
 */
export function defaultVillageBuildOrder(
  requirements: VillageRequirements,
  edgeTrees: EdgeTrees = "conifer",
): VillageBuildLayerId[] {
  const hasWater = requirements.landmarks.some(
    (k) => k === "river" || k === "lake" || k === "harbor",
  );
  const hasForest = requirements.landmarks.includes("forest") || edgeTrees !== "none";
  const order: VillageBuildLayerId[] = ["plan", "map"];
  if (hasWater) order.push("water");
  order.push("settlement");
  if (hasForest) {
    order.push("forest_conifer", "forest_big");
  }
  order.push("critique", "look");
  return order;
}

function normalizeBuildOrder(
  raw: unknown,
  requirements: VillageRequirements,
  edgeTrees: EdgeTrees,
  issues: PlanIssue[],
): VillageBuildLayerId[] {
  const fallback = defaultVillageBuildOrder(requirements, edgeTrees);
  if (!Array.isArray(raw) || raw.length === 0) {
    issues.push({
      severity: "warning",
      message: `buildOrder 자동: ${fallback.join("→")} (호수/강이면 water 선시공, 그다음 집·길)`,
    });
    return fallback;
  }
  const allowed = new Set<string>(ALL_VILLAGE_BUILD_LAYERS);
  const parsed: VillageBuildLayerId[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !allowed.has(entry)) {
      issues.push({ severity: "warning", message: `buildOrder 무시 항목: ${String(entry)}` });
      continue;
    }
    if (!parsed.includes(entry as VillageBuildLayerId)) parsed.push(entry as VillageBuildLayerId);
  }
  // plan/map/critique/look 보장
  if (!parsed.includes("plan")) parsed.unshift("plan");
  if (!parsed.includes("map")) {
    const pi = parsed.indexOf("plan");
    parsed.splice(pi + 1, 0, "map");
  }
  if (!parsed.includes("settlement")) {
    // water 있으면 water 다음, 아니면 map 다음
    const wi = parsed.indexOf("water");
    const insertAt = wi >= 0 ? wi + 1 : parsed.indexOf("map") + 1;
    parsed.splice(insertAt, 0, "settlement");
  }
  if (!parsed.includes("critique")) parsed.push("critique");
  if (!parsed.includes("look")) parsed.push("look");
  // requirements 누락 레이어 soft-fill
  const hasWater = requirements.landmarks.some(
    (k) => k === "river" || k === "lake" || k === "harbor",
  );
  const hasForest = requirements.landmarks.includes("forest") || edgeTrees !== "none";
  if (hasWater && !parsed.includes("water")) {
    const mi = parsed.indexOf("map");
    parsed.splice(mi + 1, 0, "water");
    issues.push({ severity: "warning", message: "buildOrder에 water 없음 → map 다음에 삽입" });
  }
  if (hasForest && !parsed.includes("forest_conifer")) {
    const si = parsed.indexOf("settlement");
    parsed.splice(si + 1, 0, "forest_conifer");
  }
  if (hasForest && !parsed.includes("forest_big")) {
    const fi = parsed.indexOf("forest_conifer");
    parsed.splice(fi + 1, 0, "forest_big");
  }
  return parsed;
}

/** VillagePlan → build_village args (결정론 시공 입력). */
export function villagePlanToBuildArgs(plan: VillagePlan, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    theme: plan.theme || undefined,
    query: plan.requirements.query,
    requirements: plan.requirements,
    pathStyle: plan.pathStyle,
    kitMix: plan.kitMix,
    yardStyle: plan.yardStyle,
    plazaStyle: plan.plazaStyle,
    edgeTrees: plan.edgeTrees,
    plazaLayout: plan.plazaLayout,
    fences: plan.fences,
    decor: plan.decor,
    interior: plan.interior,
    doorEvent: plan.interior,
    seed: plan.seed,
    name: plan.mapName,
    ...(plan.width !== undefined ? { width: plan.width } : {}),
    ...(plan.height !== undefined ? { height: plan.height } : {}),
    houses: plan.houses.length,
    housePlans: plan.houses.map((house) => ({
      kitId: house.kitId,
      yard: [...house.yard],
    })),
    npcs: plan.npcs.map((npc) => ({
      name: npc.name,
      lines: [...npc.lines],
    })),
    planId: plan.id,
    ...extra,
  };
}

function mergeRequirements(query: string, partial: Partial<VillageRequirements>): VillageRequirements {
  const base = inferRequirementsFromQuery(query);
  if (!partial.landmarks) return base;
  const landmarks = [...new Set([...(partial.landmarks as LandmarkKind[]), ...base.landmarks])];
  return {
    ...base,
    ...partial,
    query: partial.query ?? base.query,
    landmarks,
    mustHaveVillage: true,
    mustExist: [
      "주거 마을(집·길·주민)",
      ...landmarks.map((kind) => {
        const labels: Record<string, string> = {
          river: "강/하천 수역",
          lake: "호수/연못",
          forest: "숲/나무 군락",
          market: "장터/시장 분위기(광장 소품)",
          harbor: "포구/항구 느낌(물가+모래)",
          farm: "농/밭 분위기(넓은 잔디·마당)",
        };
        return labels[kind] ?? kind;
      }),
    ],
    riverSide: partial.riverSide ?? base.riverSide,
    forestSide: partial.forestSide ?? base.forestSide,
  };
}

export function storeVillagePlan(project: Project, plan: VillagePlan): void {
  const bag = (project as Project & { villagePlans?: Record<string, VillagePlan> });
  const next = { ...(bag.villagePlans ?? {}) };
  next[plan.id] = plan;
  bag.villagePlans = next;
}

export function loadVillagePlan(project: Project, planId: string): VillagePlan | undefined {
  const bag = project as Project & { villagePlans?: Record<string, VillagePlan> };
  return bag.villagePlans?.[planId];
}

export function storeVillageSpec(project: Project, planId: string, spec: BuildSpec): void {
  const bag = project as Project & { villageSpecs?: Record<string, BuildSpec> };
  bag.villageSpecs = { ...(bag.villageSpecs ?? {}), [planId]: spec };
}

export function loadVillageSpec(project: Project, planId: string): BuildSpec | undefined {
  const bag = project as Project & { villageSpecs?: Record<string, BuildSpec> };
  return bag.villageSpecs?.[planId];
}

/**
 * VillagePlan → set_build_spec 용 BuildSpec.
 * 집 밴드·광장·외곽이 서로 겹치지 않게 잡아 스펙 검증을 통과시킨다.
 * (실제 시공 좌표와 1:1은 아니어도, 예산 영역 게이트 역할)
 */
export function villagePlanToBuildSpec(
  plan: VillagePlan,
  mapId: string,
  width: number,
  height: number,
): BuildSpec {
  const margin = 2;
  const plazaW = Math.min(8, Math.max(4, width - margin * 4));
  const plazaH = Math.min(6, Math.max(4, height - margin * 4));
  let plazaX = Math.floor(width / 2) - Math.floor(plazaW / 2);
  let plazaY = Math.floor(height / 2) - Math.floor(plazaH / 2);
  if (plan.plazaLayout === "north") plazaY = margin + Math.floor(height * 0.18);
  if (plan.plazaLayout === "south") plazaY = height - margin - plazaH - Math.floor(height * 0.12);
  if (plan.plazaLayout === "west") plazaX = margin + Math.floor(width * 0.15);
  if (plan.plazaLayout === "east") plazaX = width - margin - plazaW - Math.floor(width * 0.15);
  plazaX = clamp(plazaX, margin, width - margin - plazaW);
  plazaY = clamp(plazaY, margin, height - margin - plazaH);

  const gap = 1;
  const northH = Math.max(4, plazaY - margin - gap);
  const southY = plazaY + plazaH + gap;
  const southH = Math.max(4, height - margin - southY);

  const assets: SpecAsset[] = [
    {
      id: "plaza-road",
      kind: "road",
      x: plazaX,
      y: plazaY,
      w: plazaW,
      h: plazaH,
      style: plan.pathStyle,
      note: "광장",
      overExisting: "keep",
    },
    {
      id: "avenue-road",
      kind: "road",
      x: margin,
      y: plazaY + Math.floor(plazaH / 2),
      w: Math.max(4, width - margin * 2),
      h: 1,
      style: plan.pathStyle,
      note: "횡단 대로",
      overExisting: "keep",
    },
    {
      id: "homes-north",
      kind: "house",
      x: margin,
      y: margin,
      w: Math.max(4, width - margin * 2),
      h: northH,
      note: "북쪽 주택 밴드",
      overExisting: "keep",
    },
    {
      id: "homes-south",
      kind: "house",
      x: margin,
      y: southY,
      w: Math.max(4, width - margin * 2),
      h: southH,
      note: "남쪽 주택 밴드",
      overExisting: "keep",
    },
    {
      id: "edge-props",
      kind: "prop",
      x: 0,
      y: 0,
      w: width,
      h: height,
      layer: "upper",
      note: "외곽 나무·장식(상위)",
      overExisting: "keep",
    },
  ];

  // 쿼리 필수 랜드마크 예산 영역
  const strip = Math.max(5, Math.floor(Math.min(width, height) * 0.12));
  if (plan.requirements.landmarks.includes("river") || plan.requirements.landmarks.includes("harbor")) {
    const side = plan.requirements.riverSide;
    const water =
      side === "west" ? { x: 0, y: 1, w: strip, h: height - 2 }
        : side === "east" ? { x: width - strip, y: 1, w: strip, h: height - 2 }
          : side === "north" ? { x: 1, y: 0, w: width - 2, h: strip }
            : { x: 1, y: height - strip, w: width - 2, h: strip };
    assets.push({
      id: "req-river",
      kind: "terrain",
      ...water,
      style: "water",
      note: `필수 강/수역 (${side})`,
      overExisting: "keep",
    });
  }
  if (plan.requirements.landmarks.includes("forest")) {
    const depth = Math.max(4, Math.floor(Math.min(width, height) * 0.14));
    const side = plan.requirements.forestSide;
    const forest =
      side === "east" ? { x: width - depth - 1, y: 2, w: depth, h: height - 4 }
        : side === "west" ? { x: 1, y: 2, w: depth, h: height - 4 }
          : side === "north" ? { x: 2, y: 1, w: width - 4, h: depth }
            : { x: 2, y: height - depth - 1, w: width - 4, h: depth };
    assets.push({
      id: "req-forest",
      kind: "prop",
      ...forest,
      layer: "upper",
      note: `필수 숲 (${side})`,
      overExisting: "keep",
    });
  }

  // avenue와 plaza는 road-road 겹침 허용. homes와 plaza/avenue가 겹치면 안 됨 —
  // northH/southY 계산으로 분리. edge-props는 upper라 house/road와 겹침 허용.

  return {
    mapId,
    title: plan.theme || plan.mapName || "village",
    assets,
    buildOrder: ["road", "house", "prop"],
    pathWidth: 1,
    density: plan.edgeTrees === "dense" ? "dense" : plan.edgeTrees === "none" ? "spacious" : "normal",
    layoutStyle: "straight",
  };
}

function normalizeHouses(raw: unknown, kitMix: KitMix, issues: PlanIssue[]): VillageHousePlan[] {
  if (raw === undefined) {
    issues.push({ severity: "warning", message: `houses 미지정 → 기본 ${MIN_HOUSES}채(스타일 팩 마당).` });
    return defaultHouses(MIN_HOUSES, kitMix);
  }
  if (typeof raw === "number" && Number.isInteger(raw)) {
    const count = clamp(raw, MIN_HOUSES, MAX_HOUSES);
    if (raw < MIN_HOUSES || raw > MAX_HOUSES) {
      issues.push({ severity: "warning", message: `집 수 ${raw} → ${count}으로 클램프.` });
    }
    return defaultHouses(count, kitMix);
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    issues.push({ severity: "error", message: "houses는 정수 또는 [{kitId?, yard?}] 배열이어야 한다." });
    return defaultHouses(MIN_HOUSES, kitMix);
  }
  if (raw.length < MIN_HOUSES) {
    issues.push({ severity: "warning", message: `집 계획 ${raw.length}채 → 최소 ${MIN_HOUSES}채까지 패딩.` });
  }
  const out: VillageHousePlan[] = [];
  const target = clamp(raw.length, MIN_HOUSES, MAX_HOUSES);
  for (let i = 0; i < target; i += 1) {
    const entry = raw[i];
    if (entry === undefined) {
      out.push(defaultHouse(i, kitMix));
      continue;
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({ severity: "error", message: `houses[${i}]는 객체여야 한다.` });
      out.push(defaultHouse(i, kitMix));
      continue;
    }
    const rec = entry as Record<string, unknown>;
    let kitId: HouseKitId = kitMix === "mixed"
      ? (i % 2 === 0 ? "blue-stone" : "bright-plaster")
      : kitMix;
    if (rec.kitId === "blue-stone" || rec.kitId === "bright-plaster") kitId = rec.kitId;
    else if (rec.kitId !== undefined) {
      issues.push({ severity: "error", message: `houses[${i}].kitId 무효: ${String(rec.kitId)}` });
    }
    const yard = normalizeYard(rec.yard, i, issues);
    const ownerName = typeof rec.ownerName === "string" && rec.ownerName.trim() ? rec.ownerName.trim() : undefined;
    const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : `house_${i + 1}`;
    out.push({ id, kitId, yard, ...(ownerName ? { ownerName } : {}) });
  }
  return out;
}

function normalizeYard(raw: unknown, index: number, issues: PlanIssue[]): YardDecorKind[] {
  if (raw === undefined) return ["mailbox", "flowers"];
  if (!Array.isArray(raw)) {
    issues.push({ severity: "error", message: `houses[${index}].yard는 문자열 배열이어야 한다.` });
    return ["mailbox"];
  }
  const yard: YardDecorKind[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isYardDecorKind(item)) yard.push(item);
    else issues.push({ severity: "error", message: `houses[${index}].yard 태그 무효: ${String(item)}` });
  }
  return yard.length > 0 ? yard : ["mailbox"];
}

function normalizeNpcs(raw: unknown, issues: PlanIssue[]): VillageNpcPlan[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ severity: "error", message: "npcs는 배열이어야 한다." });
    return [];
  }
  const out: VillageNpcPlan[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({ severity: "error", message: `npcs[${i}]는 객체여야 한다.` });
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const name = typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : `주민${i + 1}`;
    let lines: string[] = ["오늘도 마을이 분주하군요."];
    if (Array.isArray(rec.lines) && rec.lines.every((line) => typeof line === "string" && line.length > 0)) {
      lines = rec.lines as string[];
    } else if (rec.lines !== undefined) {
      issues.push({ severity: "error", message: `npcs[${i}].lines는 문자열 배열이어야 한다.` });
    }
    out.push({ name, lines });
  }
  return out;
}

function defaultHouses(count: number, kitMix: KitMix): VillageHousePlan[] {
  return Array.from({ length: count }, (_, i) => defaultHouse(i, kitMix));
}

function defaultHouse(index: number, kitMix: KitMix): VillageHousePlan {
  const kitId: HouseKitId = kitMix === "mixed"
    ? (index % 2 === 0 ? "blue-stone" : "bright-plaster")
    : kitMix;
  const yards: YardDecorKind[][] = [
    ["mailbox", "flowers"],
    ["firewood", "pot"],
    ["bench_h", "jar"],
    ["fruit_box", "flowers"],
  ];
  return {
    id: `house_${index + 1}`,
    kitId,
    yard: yards[index % yards.length] as YardDecorKind[],
  };
}

function inferFromTheme(theme: string): Partial<Pick<VillagePlan, "pathStyle" | "kitMix" | "yardStyle" | "plazaStyle" | "edgeTrees" | "plazaLayout">> {
  if (!theme) return {};
  const t = theme.toLowerCase();
  if (/어촌|항구|바다|호수|강가|해안|coast|harbor|lake|river|beach/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", plazaLayout: "south", edgeTrees: "conifer" };
  }
  if (/장터|시장|market|fair|축제/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market" };
  }
  if (/농|밭|촌락|farm|rural|목장/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "dense" };
  }
  if (/광산|산골|mine|mountain/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "workshop", plazaStyle: "empty", edgeTrees: "dense", kitMix: "blue-stone" };
  }
  if (/정원|꽃|garden/.test(t)) {
    return { pathStyle: "sand", yardStyle: "garden", plazaStyle: "garden" };
  }
  return {};
}

function buildPlanSummary(input: {
  theme: string;
  pathStyle: RoadStyle;
  yardStyle: YardStyle;
  plazaStyle: PlazaStyle;
  plazaLayout: PlazaLayout;
  edgeTrees: EdgeTrees;
  houseCount: number;
  npcCount: number;
  fences: boolean;
  decor: boolean;
}): string {
  return [
    `「${input.theme}」`,
    `집 ${input.houseCount}채`,
    `길 ${input.pathStyle}`,
    `마당 ${input.yardStyle}`,
    `광장 ${input.plazaStyle}/${input.plazaLayout}`,
    `외곽나무 ${input.edgeTrees}`,
    input.fences ? "울타리" : "울타리없음",
    input.decor ? "소품on" : "소품off",
    input.npcCount > 0 ? `NPC계획 ${input.npcCount}` : "NPC기본",
  ].join(" · ");
}

function enumOr<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
  issues: PlanIssue[],
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  issues.push({ severity: "error", message: `${label}는 ${allowed.join("|")} 중 하나여야 한다 (got ${String(value)}).` });
  return fallback;
}

function optionalSize(value: unknown, label: string, issues: PlanIssue[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ severity: "error", message: `${label}는 정수여야 한다.` });
    return undefined;
  }
  if (value < 36 || value > 256) {
    issues.push({ severity: "warning", message: `${label}=${value}는 시공 시 36~256으로 클램프된다.` });
  }
  return value;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}
