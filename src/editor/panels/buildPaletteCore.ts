import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  buildHouseFootprintCells,
  createHousePresets,
  stampHousePlan,
  validateHousePlanSelection,
  type HousePreset,
  type HousePresetId,
  type RoofMaterialId,
  type RoofMaterialSet,
} from "@/editor/panels/housePlan";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { buildEightNeighborVariantMap, derivePatternGrammar } from "@/editor/tools/v3/rmTypeExpander";
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

export interface BuildPaletteApplyOptions {
  readonly housePresetId?: HousePresetId;
}

type PresetRole = "wall" | "door" | "window" | "roof" | "path" | "water" | "tree" | "prop";

const P = COMBINED_TOWN_HARNESS_PREFIX;

const LINT_FAILURE_MESSAGES: Record<string, string> = {
  "start-position": "시작 위치를 덮을 수 없습니다. 다른 영역을 선택하세요.",
};

export const BUILD_PALETTE_PRESETS: Record<PresetRole, string> = {
  wall: `${P}plaster-wall-9slice`,
  door: `${P}doors`,
  window: `${P}windows`,
  roof: `${P}roof-wall-boundary`,
  path: `${P}dirt-road-autotile`,
  water: `${P}lake-water-autotile`,
  tree: `${P}conifer-tree`,
  prop: `${P}small-props`,
};

export const HOUSE_PRESETS = createHousePresets({
  wall: BUILD_PALETTE_PRESETS.wall,
  roof: BUILD_PALETTE_PRESETS.roof,
  door: BUILD_PALETTE_PRESETS.door,
  window: BUILD_PALETTE_PRESETS.window,
});

export const DEFAULT_HOUSE_PRESET_ID: HousePresetId = "cottage-1f";

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
  prop: { name: "마을 소품", role: "prop", layerHome: "upper" },
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
  const housePreset = resolveHousePreset(options.housePresetId);
  const validationFailure = validateBuildPalettePrimitive(rect, primitive, housePreset);
  if (validationFailure) return { ok: false, summary: validationFailure, toolResults: [], project };
  ensureBuildPalettePresets(tileset);

  const ctx: ToolContext = { project };
  const toolResults: ToolResult[] = [];
  const run = (name: string, args: Record<string, unknown>): boolean => {
    const result = runTool(ctx, name, args);
    toolResults.push(result);
    return result.ok;
  };
  // 장식(창문 등) 전용: 실패해도 전체 시공을 실패로 만들지 않는다.
  const runOptional = (name: string, args: Record<string, unknown>): boolean => runTool(ctx, name, args).ok;

  let ok = true;
  let villageBuilt: { built: number; requested: number } | null = null;
  if (primitive === "house") ok = stampHouse(ctx, rect, housePreset, run, runOptional);
  else if (primitive === "village") {
    villageBuilt = stampVillage(ctx, rect, housePreset, run, runOptional);
    ok = villageBuilt.built > 0;
  }
  else if (primitive === "path") ok = stampPath(rect, run);
  else if (primitive === "river") ok = fillRoleTile(ctx.project, rect, "water");
  else if (primitive === "roof") ok = fillRoof(ctx.project, rect);
  else if (primitive === "tree") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), propVocabId: BUILD_PALETTE_PRESETS.tree, count: countForArea(rect, 6), naturalness: 0.55, seed: seedFor(rect, "tree") });
  else if (primitive === "prop") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), propVocabId: BUILD_PALETTE_PRESETS.prop, count: countForArea(rect, 10), naturalness: 0.45, seed: seedFor(rect, "prop") });
  else if (primitive === "npc") ok = run("place_npc", { mapId: rect.mapId, x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2), name: "주민", pages: [{ lines: ["안녕하세요."] }] });

  const failed = toolResults.find((result) => !result.ok);
  const summary = failed
    ? summarizeToolFailure(failed)
    : villageBuilt
      ? `마을 시공 완료: ${villageBuilt.requested}채 중 ${villageBuilt.built}채`
      : ok ? `${primitive} 시공 완료` : `${primitive} 시공에 실패했습니다.`;
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
  // 프리셋 외 추가 승인 그룹 — 하네싱 키트가 쓰는 벽 세트는 place_door/place_window의
  // "승인된 벽 어휘" 검사를 통과해야 한다 (연습08 기준 집의 목골 석벽).
  for (const groupId of EXTRA_APPROVED_GROUP_IDS) {
    const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
    if (!group) continue;
    group.origin = "user";
    group.source = "user";
  }
  ensurePathAutotile(tileset);
}

const EXTRA_APPROVED_GROUP_IDS = [`${P}timber-stone-wall-9slice`] as const;

// 오렌지 직선 지붕 타일(타일시트 초확대 실측): 세로 3단 구조.
// 374 = 상단 마감(용마루, 위 밝은 줄) · 375 = 몸통 기와(균일 반복) · 405 = 최하단 처마(아래 밝은 줄).
// 404는 밝은 변형 몸통, 406부터는 파란 지붕 계열 — 섞으면 세로/색 줄무늬로 깨진다.
const ROOF_RIDGE_TILE = 374;
const ROOF_BODY_TILE = 375;
const ROOF_EAVE_TILE = 405;

// 지붕 재질 세트 — 사용자 예시 맵(fable-village 연습02/08) 학습 결과.
// 상세 문법: docs/knowledge/2026-07-08-roof-tile-semantics-learned.md
const ROOF_MATERIAL_SETS: Record<RoofMaterialId, RoofMaterialSet> = {
  "orange-classic": { id: "orange-classic", kind: "classic", ridge: ROOF_RIDGE_TILE, body: ROOF_BODY_TILE, eave: ROOF_EAVE_TILE },
  "orange-bright": {
    id: "orange-bright",
    kind: "bright",
    body: 404,
    eave: 405,
    upper: { ridgeLine: 374, ridgeCapLeft: 354, ridgeCapRight: 355, trimLeft: 376, trimRight: 377, trimCapLeft: 384, trimCapRight: 385 },
  },
  blue: {
    id: "blue",
    kind: "blue",
    body: 406,
    eave: 467,
    leftEdge: 437,
    rightEdge: 407,
    upper: { cornerNW: 356, cornerNE: 357, cornerSW: 386, cornerSE: 387 },
  },
};

function roofMaterialForPreset(preset: HousePreset): RoofMaterialSet {
  return ROOF_MATERIAL_SETS[preset.roofMaterial];
}

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
  ctx: ToolContext,
  rect: BuildPaletteSelection,
  preset: HousePreset,
  run: (name: string, args: Record<string, unknown>) => boolean,
  runOptional: (name: string, args: Record<string, unknown>) => boolean
): boolean {
  // 지붕은 벽/문 툴 커밋 후 직접 칠한다. runTool이 ctx.project를 draft로 교체하므로
  // 열 단위 페인트는 housePlan 내부에서 항상 최신 ctx.project를 참조한다.
  return stampHousePlan(ctx, rect, preset, roofMaterialForPreset(preset), run, runOptional) !== null;
}

function stampVillage(
  ctx: ToolContext,
  rect: BuildPaletteSelection,
  preset: HousePreset,
  run: (name: string, args: Record<string, unknown>) => boolean,
  runOptional: (name: string, args: Record<string, unknown>) => boolean
): { readonly requested: number; readonly built: number } {
  const requested = Math.max(2, Math.min(5, Math.floor((rect.width * rect.height) / 70)));
  const placements = planVillagePlacements(ctx.project, rect, preset, requested);
  const doors: { x: number; y: number }[] = [];
  for (const placement of placements) {
    const stamped = stampHousePlan(ctx, placement, preset, roofMaterialForPreset(preset), run, runOptional);
    if (stamped) doors.push(stamped.door);
  }
  if (doors.length >= 2) {
    const points = doors.map((door) => ({ x: door.x, y: Math.min(rect.y + rect.height - 1, door.y + 1) }));
    run("lay_path", { mapId: rect.mapId, points, pathVocabId: BUILD_PALETTE_PRESETS.path, naturalness: 0, seed: seedFor(rect, "village-path") });
  }
  return { requested, built: doors.length };
}

function planVillagePlacements(project: Project, rect: BuildPaletteSelection, preset: HousePreset, requested: number): BuildPaletteSelection[] {
  const map = project.maps[rect.mapId];
  if (!map) return [];
  const rng = seededRandom(seedFor(rect, "village"));
  const houseW = Math.max(4, Math.min(6, Math.floor(rect.width / 3)));
  const houseH = Math.max(preset.stories === 2 ? 5 : 4, Math.min(6, Math.floor(rect.height / 2)));
  const occupied = new Set<string>();
  const placements: BuildPaletteSelection[] = [];
  const candidates: BuildPaletteSelection[] = [];
  for (let y = rect.y; y <= rect.y + rect.height - houseH; y += 1) {
    for (let x = rect.x; x <= rect.x + rect.width - houseW; x += 1) candidates.push({ mapId: rect.mapId, x, y, width: houseW, height: houseH });
  }
  candidates.sort(() => rng() - 0.5);
  for (const candidate of candidates) {
    if (placements.length >= requested) break;
    if (footprintTouchesStart(project, candidate, preset)) continue;
    if (footprintConflicts(candidate, preset, occupied)) continue;
    placements.push(candidate);
    reserveFootprint(candidate, preset, occupied);
  }
  return placements;
}

function footprintTouchesStart(project: Project, rect: BuildPaletteSelection, preset: HousePreset): boolean {
  if (project.startMapId !== rect.mapId) return false;
  return buildHouseFootprintCells(rect, preset).some((cell) => cell.x === project.startPos.x && cell.y === project.startPos.y);
}

function footprintConflicts(rect: BuildPaletteSelection, preset: HousePreset, occupied: Set<string>): boolean {
  return buildHouseFootprintCells(rect, preset).some((cell) => occupied.has(cellKey(cell.x, cell.y)));
}

function reserveFootprint(rect: BuildPaletteSelection, preset: HousePreset, occupied: Set<string>): void {
  for (const cell of buildHouseFootprintCells(rect, preset)) {
    for (let y = cell.y - 1; y <= cell.y + 1; y += 1) {
      for (let x = cell.x - 1; x <= cell.x + 1; x += 1) occupied.add(cellKey(x, y));
    }
  }
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function validateBuildPalettePrimitive(rect: BuildPaletteSelection, primitive: BuildPalettePrimitive, housePreset: HousePreset): string | null {
  if (primitive === "house") {
    return validateHousePlanSelection(rect, housePreset);
  }
  if (primitive === "village" && (rect.width < 9 || rect.height < 6)) {
    return "마을은 최소 9×6 영역이 필요합니다.";
  }
  if (primitive === "roof" && rect.width < 2) {
    return "지붕은 최소 2×1 영역이 필요합니다.";
  }
  return null;
}

function resolveHousePreset(id: HousePresetId | undefined): HousePreset {
  return HOUSE_PRESETS.find((preset) => preset.id === id) ?? HOUSE_PRESETS.find((preset) => preset.id === DEFAULT_HOUSE_PRESET_ID) ?? HOUSE_PRESETS[0];
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
    pathVocabId: BUILD_PALETTE_PRESETS.path,
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
  if (tileset.autotileGroups?.some((group) => group.id === id)) return;
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), {
    id,
    name: "건축 팔레트 흙길 8방향",
    neighborhood: 8,
    memberTileIds: [
      DIRT_ROAD_TILE.CORNER_NORTH_WEST, DIRT_ROAD_TILE.EDGE_NORTH, DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      DIRT_ROAD_TILE.EDGE_WEST, DIRT_ROAD_TILE.BODY, DIRT_ROAD_TILE.EDGE_EAST,
      DIRT_ROAD_TILE.CORNER_SOUTH_WEST, DIRT_ROAD_TILE.EDGE_SOUTH, DIRT_ROAD_TILE.CORNER_SOUTH_EAST, DIRT_ROAD_TILE.BODY_ALT,
    ],
    variantMap: buildEightNeighborVariantMap({
      body: DIRT_ROAD_TILE.BODY,
      edgeN: DIRT_ROAD_TILE.EDGE_NORTH,
      edgeS: DIRT_ROAD_TILE.EDGE_SOUTH,
      edgeW: DIRT_ROAD_TILE.EDGE_WEST,
      edgeE: DIRT_ROAD_TILE.EDGE_EAST,
      cornerNW: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
      cornerNE: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      cornerSW: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
      cornerSE: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
    }),
  }];
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
