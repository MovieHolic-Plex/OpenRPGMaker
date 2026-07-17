import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import type { FootprintWing, HouseKitId, HouseKitWindowsOption } from "@/editor/houseKit";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { derivePatternGrammar } from "@/editor/tools/v3/rmTypeExpander";
import { buildEdgeCornerInnerVariantMap } from "@/project/defaults/autotileEngine";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { LintIssue } from "@/project/lint/projectLint";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { store } from "@/project/store";
import type { MapId, Project, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

export type BuildPalettePrimitive = "house" | "village" | "river" | "path" | "roof" | "npc" | "tree" | "prop";

export interface BuildPaletteSelection {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BuildPaletteResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly toolResults: readonly ToolResult[];
}

export type BuildHouseShapeId = "rect" | "l" | "u";

export interface BuildHouseShapePreset {
  readonly id: BuildHouseShapeId;
  readonly name: string;
}

export interface BuildHouseKitCard {
  readonly id: HouseKitId;
  readonly name: string;
}

export interface BuildPaletteApplyOptions {
  readonly houseShapeId?: BuildHouseShapeId;
  readonly houseKitId?: HouseKitId;
  readonly doorEvent?: boolean;
  readonly interior?: boolean;
  readonly windows?: HouseKitWindowsOption | boolean;
}

type PresetRole = "wall" | "door" | "window" | "roof" | "path" | "water" | "tree" | "prop";

const P = COMBINED_TOWN_HARNESS_PREFIX;

const LINT_FAILURE_MESSAGES: Record<string, string> = {
  "start-position": "시작 위치를 덮을 수 없습니다. 다른 영역을 선택하세요.",
  "transfer-impassable": "문 앞이 통행 불가 타일입니다. 문 앞이 트인 곳에 짓거나 앞의 장애물을 지워주세요.",
};

export const BUILD_PALETTE_PRESETS: Record<PresetRole, string> = {
  wall: `${P}plaster-wall-9slice`,
  door: `${P}doors`,
  window: `${P}windows`,
  roof: `${P}roof-wall-boundary`,
  path: `${P}dirt-road-autotile`,
  water: `${P}lake-water-autotile`,
  tree: `${P}conifer-tree`,
  prop: `${P}flower-props`,
};

export const HOUSE_SHAPE_PRESETS: readonly BuildHouseShapePreset[] = [
  { id: "rect", name: "직사각" },
  { id: "l", name: "ㄱ자" },
  { id: "u", name: "ㄷ자" },
];

export const HOUSE_KIT_CARDS: readonly BuildHouseKitCard[] = [
  { id: "blue-stone", name: "파랑 지붕+석벽" },
  { id: "bright-plaster", name: "밝은 오렌지 지붕+흰 회벽" },
  { id: "amber-wood", name: "오렌지 지붕+통나무" },
  { id: "slate-wood", name: "파랑 지붕+통나무" },
];

export const DEFAULT_HOUSE_SHAPE_ID: BuildHouseShapeId = "rect";
export const DEFAULT_HOUSE_KIT_ID: HouseKitId = "blue-stone";

interface PresetClaim {
  readonly name: string;
  readonly role: TileGroupRole;
  readonly layerHome: "lower" | "upper" | "perCell";
  readonly patternKind?: NonNullable<NonNullable<TileGroupMetadata["patternGrammar"]>["kind"]>;
}

const PRESET_CLAIMS: Record<PresetRole, PresetClaim> = {
  wall: { name: "흰 집 벽", role: "wall", layerHome: "lower", patternKind: "nine_slice_expandable" },
  door: { name: "문", role: "prop", layerHome: "lower", patternKind: "vertical_expandable" },
  window: { name: "창문", role: "prop", layerHome: "upper" },
  roof: { name: "직선 지붕", role: "roof", layerHome: "lower", patternKind: "horizontal_expandable" },
  path: { name: "흙길", role: "terrain", layerHome: "lower", patternKind: "autotile_3x3" },
  water: { name: "물", role: "water", layerHome: "lower" },
  tree: { name: "침엽수", role: "prop", layerHome: "perCell", patternKind: "vertical_expandable" },
  prop: { name: "꽃", role: "prop", layerHome: "upper" },
};

export function applyBuildPalettePrimitive(selection: BuildPaletteSelection, primitive: BuildPalettePrimitive, options: BuildPaletteApplyOptions = {}): BuildPaletteResult {
  const current = store.getCurrent();
  if (!current.maps[selection.mapId]) return { ok: false, summary: "선택한 맵을 찾을 수 없습니다.", toolResults: [] };
  recordProjectSnapshot(`건축 팔레트: ${primitive}`, selection.mapId, { kind: "project" });
  const result = applyBuildPalettePrimitiveToProject(structuredClone(current), selection, primitive, options);
  if (result.ok) store.replace(result.project);
  return result;
}

export function applyBuildPalettePrimitiveToProject(
  project: Project,
  selection: BuildPaletteSelection,
  primitive: BuildPalettePrimitive,
  options: BuildPaletteApplyOptions = {}
): BuildPaletteResult & { readonly project: Project } {
  const map = project.maps[selection.mapId];
  if (!map) return { ok: false, summary: "선택한 맵을 찾을 수 없습니다.", toolResults: [], project };
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return { ok: false, summary: "타일셋을 찾을 수 없습니다.", toolResults: [], project };
  const rect = clampSelection(selection, map.width, map.height);
  if (rect.width < 1 || rect.height < 1) return { ok: false, summary: "선택 영역이 맵 밖입니다.", toolResults: [], project };
  const houseShape = resolveHouseShapeId(options.houseShapeId);
  const houseKit = resolveHouseKitId(options.houseKitId);
  const validationFailure = validateBuildPalettePrimitive(rect, primitive, houseShape);
  if (validationFailure) return { ok: false, summary: validationFailure, toolResults: [], project };
  ensureBuildPalettePresets(tileset);

  const ctx: ToolContext = { project };
  const toolResults: ToolResult[] = [];
  const run = (name: string, args: Record<string, unknown>): boolean => {
    const result = runTool(ctx, name, args);
    toolResults.push(result);
    return result.ok;
  };

  let ok = true;
  if (primitive === "house") ok = stampHouse(rect, houseShape, houseKit, options, run);
  else if (primitive === "village") ok = stampVillage(rect, options, run);
  else if (primitive === "path") ok = stampPath(rect, run);
  else if (primitive === "river") ok = fillRoleTile(ctx.project, rect, "water");
  else if (primitive === "roof") ok = fillRoof(ctx.project, rect);
  else if (primitive === "tree") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), material: "침엽수", count: countForArea(rect, 6), naturalness: 0.55, seed: seedFor(rect, "tree") });
  else if (primitive === "prop") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), material: "꽃", count: countForArea(rect, 10), naturalness: 0.45, seed: seedFor(rect, "prop") });
  else if (primitive === "npc") ok = run("place_npc", { mapId: rect.mapId, x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2), name: "주민", pages: [{ lines: ["안녕하세요."] }] });

  const failed = toolResults.find((result) => !result.ok);
  const summary = failed
    ? summarizeToolFailure(failed)
    : ok ? summarizeBuildPaletteSuccess(primitive, toolResults) : `${primitive} 시공에 실패했습니다.`;
  return { ok: ok && !failed, summary, toolResults, project: ctx.project };
}

export function ensureBuildPalettePresets(tileset: TilesetDef): void {
  for (const role of Object.keys(BUILD_PALETTE_PRESETS) as PresetRole[]) {
    const group = tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_PRESETS[role]);
    if (!group) continue;
    const claim = PRESET_CLAIMS[role];
    group.name = claim.name;
    group.role = claim.role;
    group.layerHome = claim.layerHome;
    group.defaultLayer = claim.layerHome === "perCell" ? "mixed" : claim.layerHome;
    group.origin = "user";
    group.source = "user";
    if (role === "door") {
      group.patternGrammar = {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        parts: [{ role: "top", tileIds: [116] }, { role: "bottom", tileIds: [146] }],
        preserveCaps: true,
        repeat: "body",
      };
    } else if (role === "roof") {
      // 처마(405)는 가로로 균일 반복되는 기와 — 캡 구분 없이 동일 타일. 파란 계열(406~) 혼입 금지.
      group.patternGrammar = {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 2,
        parts: [{ role: "leftCap", tileIds: [ROOF_EAVE_TILE] }, { role: "repeatBody", tileIds: [ROOF_EAVE_TILE] }, { role: "rightCap", tileIds: [ROOF_EAVE_TILE] }],
        preserveCaps: true,
        repeat: "body",
      };
    } else if (claim.patternKind && (!group.patternGrammar || group.patternGrammar.kind !== claim.patternKind)) {
      group.patternGrammar = derivePatternGrammar(claim.patternKind, group.tileIds, tileset, { groupId: group.id, name: group.name });
    }
  }
  // 프리셋 외 추가 승인 그룹 — 집 키트가 쓰는 벽 세트는 place_door/place_window의
  // "승인된 벽 어휘" 검사를 통과해야 한다 (연습08 기준 집의 목골 석벽).
  for (const groupId of EXTRA_APPROVED_GROUP_IDS) {
    const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
    if (!group) continue;
    group.origin = "user";
    group.source = "user";
  }
  ensurePathAutotile(tileset);
}

const EXTRA_APPROVED_GROUP_IDS = [`${P}timber-stone-wall-9slice`, `${P}sand-autotile`] as const;

// 오렌지 직선 지붕 타일(타일시트 초확대 실측): 세로 3단 구조.
// 374 = 상단 마감(용마루, 위 밝은 줄) · 375 = 몸통 기와(균일 반복) · 405 = 최하단 처마(아래 밝은 줄).
// 404는 밝은 변형 몸통, 406부터는 파란 지붕 계열 — 섞으면 세로/색 줄무늬로 깨진다.
const ROOF_RIDGE_TILE = 374;
const ROOF_BODY_TILE = 375;
const ROOF_EAVE_TILE = 405;

// rect 안에 직선 지붕을 칠한다: 상단 1행 용마루 → 몸통 → 최하단 1행 처마. 1행이면 처마만.
function paintRoofRows(map: Project["maps"][string], x0: number, y0: number, w: number, rows: number): void {
  for (let dy = 0; dy < rows; dy++) {
    const tile = dy === rows - 1 ? ROOF_EAVE_TILE : dy === 0 ? ROOF_RIDGE_TILE : ROOF_BODY_TILE;
    for (let dx = 0; dx < w; dx++) {
      map.lowerTiles[(y0 + dy) * map.width + (x0 + dx)] = tile;
    }
  }
}

function stampHouse(
  rect: BuildPaletteSelection,
  shapeId: BuildHouseShapeId,
  kitId: HouseKitId,
  options: BuildPaletteApplyOptions,
  run: (name: string, args: Record<string, unknown>) => boolean
): boolean {
  const args: Record<string, unknown> = {
    mapId: rect.mapId,
    kitId,
    wings: houseKitWingsFromSelection(rect, shapeId),
  };
  if (options.doorEvent !== undefined) args.doorEvent = options.doorEvent;
  if (options.interior !== undefined) args.interior = options.interior;
  if (options.windows !== undefined) args.windows = normalizeWindowsArg(options.windows);
  return run("build_house_kit", args);
}

function stampVillage(
  rect: BuildPaletteSelection,
  options: BuildPaletteApplyOptions,
  run: (name: string, args: Record<string, unknown>) => boolean
): boolean {
  const args: Record<string, unknown> = {
    mapId: rect.mapId,
    bounds: toToolRect(rect),
    seed: seedFor(rect, "village"),
  };
  if (options.doorEvent !== undefined) args.doorEvent = options.doorEvent;
  if (options.interior !== undefined) args.interior = options.interior;
  if (options.windows !== undefined) args.windows = normalizeWindowsArg(options.windows);
  return run("build_village", args);
}

export function houseKitWingsFromSelection(rect: BuildPaletteSelection, shapeId: BuildHouseShapeId): FootprintWing[] {
  if (shapeId === "rect") return [{ x: rect.x, y: rect.y, w: rect.width, h: rect.height }];
  const topHeight = Math.min(rect.height, Math.max(5, Math.floor(rect.height * 0.62)));
  if (shapeId === "l") {
    const sideWidth = Math.min(rect.width, Math.max(3, Math.floor(rect.width / 2)));
    return [
      { x: rect.x, y: rect.y, w: rect.width, h: topHeight },
      { x: rect.x, y: rect.y, w: sideWidth, h: rect.height },
    ];
  }
  const sideWidth = Math.min(3, rect.width);
  return [
    { x: rect.x, y: rect.y, w: rect.width, h: topHeight },
    { x: rect.x, y: rect.y, w: sideWidth, h: rect.height },
    { x: rect.x + rect.width - sideWidth, y: rect.y, w: sideWidth, h: rect.height },
  ];
}

function validateBuildPalettePrimitive(rect: BuildPaletteSelection, primitive: BuildPalettePrimitive, houseShape: BuildHouseShapeId): string | null {
  if (primitive === "house") {
    return validateHouseKitSelection(rect, houseShape);
  }
  if (primitive === "village" && (rect.width < 36 || rect.height < 36)) {
    return "마을은 최소 36×36 영역이 필요합니다.";
  }
  if (primitive === "roof" && rect.width < 2) {
    return "지붕은 최소 2×1 영역이 필요합니다.";
  }
  return null;
}

export function validateHouseKitSelection(rect: BuildPaletteSelection, shapeId: BuildHouseShapeId): string | null {
  if (rect.width < 3 || rect.height < 5) return "집은 최소 3×5 영역이 필요합니다.";
  if (shapeId === "l" && (rect.width < 6 || rect.height < 6)) return "ㄱ자 집은 최소 6×6 영역이 필요합니다.";
  if (shapeId === "u" && (rect.width < 9 || rect.height < 6)) return "ㄷ자 집은 최소 9×6 영역이 필요합니다.";
  const intervalFailure = validateWingColumnIntervals(houseKitWingsFromSelection(rect, shapeId));
  return intervalFailure ?? null;
}

function validateWingColumnIntervals(wings: readonly FootprintWing[]): string | null {
  if (wings.some((wing) => wing.w < 3)) return "집 날개는 최소 폭 3이 필요합니다.";
  const xMin = Math.min(...wings.map((wing) => wing.x));
  const xMax = Math.max(...wings.map((wing) => wing.x + wing.w - 1));
  for (let x = xMin; x <= xMax; x += 1) {
    const spans = wings
      .filter((wing) => x >= wing.x && x < wing.x + wing.w)
      .map((wing) => ({ top: wing.y, bottom: wing.y + wing.h - 1 }))
      .sort((a, b) => a.top - b.top);
    let current: { top: number; bottom: number } | null = null;
    for (const span of spans) {
      if (!current || span.top > current.bottom + 1) {
        if (current && current.bottom - current.top + 1 < 5) return "집은 각 열 구간 높이 5 이상이 필요합니다.";
        current = { ...span };
      } else {
        current.bottom = Math.max(current.bottom, span.bottom);
      }
    }
    if (current && current.bottom - current.top + 1 < 5) return "집은 각 열 구간 높이 5 이상이 필요합니다.";
  }
  return null;
}

// 툴 스키마는 Gemini 호환을 위해 object 단일 타입 — 토글 boolean 을 {enabled} 로 변환한다.
function normalizeWindowsArg(value: HouseKitWindowsOption | boolean): Record<string, unknown> {
  if (value === true) return {};
  if (value === false) return { enabled: false };
  return { ...value };
}

function resolveHouseShapeId(id: BuildHouseShapeId | undefined): BuildHouseShapeId {
  return HOUSE_SHAPE_PRESETS.some((preset) => preset.id === id) ? id as BuildHouseShapeId : DEFAULT_HOUSE_SHAPE_ID;
}

function resolveHouseKitId(id: HouseKitId | undefined): HouseKitId {
  return HOUSE_KIT_CARDS.some((kit) => kit.id === id) ? id as HouseKitId : DEFAULT_HOUSE_KIT_ID;
}

function summarizeBuildPaletteSuccess(primitive: BuildPalettePrimitive, toolResults: readonly ToolResult[]): string {
  const last = toolResults.at(-1);
  if ((primitive === "house" || primitive === "village") && last?.summary) return last.summary;
  return `${primitive} 시공 완료`;
}

function summarizeToolFailure(result: ToolResult): string {
  const issue = result.issues?.find((entry) => entry.severity === "error");
  if (!issue) return result.summary;
  return friendlyLintMessage(issue);
}

function friendlyLintMessage(issue: LintIssue): string {
  const mapped = LINT_FAILURE_MESSAGES[issue.code];
  if (mapped) return mapped;
  return `시공할 수 없습니다: ${issue.message}`;
}

function stampPath(rect: BuildPaletteSelection, run: (name: string, args: Record<string, unknown>) => boolean): boolean {
  const y = rect.y + Math.floor(rect.height / 2);
  return run("lay_path", {
    mapId: rect.mapId,
    points: [{ x: rect.x, y }, { x: rect.x + rect.width - 1, y }],
    material: "흙길",
    naturalness: 0,
    seed: seedFor(rect, "path"),
  });
}

function fillRoleTile(project: Project, rect: BuildPaletteSelection, role: "water"): boolean {
  const map = project.maps[rect.mapId];
  const tileset = project.tilesets[map.tilesetId];
  const group = tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_PRESETS[role]);
  const tile = group?.patternGrammar?.parts.find((part) => part.role === "center")?.tileIds[0] ?? group?.tileIds[0] ?? TILE.WATER;
  forEachCell(rect, (x, y) => { map.lowerTiles[y * map.width + x] = tile; });
  return true;
}

function fillRoof(project: Project, rect: BuildPaletteSelection): boolean {
  const map = project.maps[rect.mapId];
  if (!map) return false;
  // 직선 지붕: 위 (h-1)행은 지붕면 기와, 최하단 1행은 처마. 1행 선택이면 처마만.
  paintRoofRows(map, rect.x, rect.y, rect.width, rect.height);
  return true;
}

function ensurePathAutotile(tileset: TilesetDef): void {
  const id = `${P}build-palette-dirt-road-8`;
  // 항상 최신 정의로 재생성한다(멱등) — 오목 코너(362)/외딴 점(360)이 없는
  // 구버전 정의가 프로젝트에 영속돼 있으면 여기서 교체된다.
  const next = {
    id,
    name: "건축 팔레트 흙길 8방향",
    neighborhood: 8 as const,
    memberTileIds: [
      DIRT_ROAD_TILE.CORNER_NORTH_WEST, DIRT_ROAD_TILE.EDGE_NORTH, DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      DIRT_ROAD_TILE.EDGE_WEST, DIRT_ROAD_TILE.BODY, DIRT_ROAD_TILE.EDGE_EAST,
      DIRT_ROAD_TILE.CORNER_SOUTH_WEST, DIRT_ROAD_TILE.EDGE_SOUTH, DIRT_ROAD_TILE.CORNER_SOUTH_EAST, DIRT_ROAD_TILE.BODY_ALT,
      DIRT_ROAD_TILE.ISOLATED, DIRT_ROAD_TILE.INNER_CORNER,
    ],
    variantMap: buildEdgeCornerInnerVariantMap({
      body: DIRT_ROAD_TILE.BODY,
      edgeN: DIRT_ROAD_TILE.EDGE_NORTH,
      edgeS: DIRT_ROAD_TILE.EDGE_SOUTH,
      edgeW: DIRT_ROAD_TILE.EDGE_WEST,
      edgeE: DIRT_ROAD_TILE.EDGE_EAST,
      cornerNW: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
      cornerNE: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      cornerSW: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
      cornerSE: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
      isolated: DIRT_ROAD_TILE.ISOLATED,
      inner: DIRT_ROAD_TILE.INNER_CORNER,
    }),
  };
  const existingIndex = (tileset.autotileGroups ?? []).findIndex((group) => group.id === id);
  if (existingIndex >= 0) {
    tileset.autotileGroups = tileset.autotileGroups!.map((group, index) => (index === existingIndex ? next : group));
    return;
  }
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), next];
}

function clampSelection(selection: BuildPaletteSelection, mapWidth: number, mapHeight: number): BuildPaletteSelection {
  const x = Math.max(0, selection.x);
  const y = Math.max(0, selection.y);
  const right = Math.min(mapWidth, selection.x + selection.width);
  const bottom = Math.min(mapHeight, selection.y + selection.height);
  return { mapId: selection.mapId, x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

function toToolRect(rect: BuildPaletteSelection): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

function forEachCell(rect: BuildPaletteSelection, visit: (x: number, y: number) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) visit(x, y);
  }
}

function countForArea(rect: BuildPaletteSelection, divisor: number): number {
  return Math.max(1, Math.floor((rect.width * rect.height) / divisor));
}

function seedFor(rect: BuildPaletteSelection, salt: string): number {
  let hash = 2166136261;
  for (const ch of `${rect.mapId}|${rect.x},${rect.y},${rect.width},${rect.height}|${salt}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
