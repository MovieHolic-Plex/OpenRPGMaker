import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { buildEightNeighborVariantMap, derivePatternGrammar } from "@/editor/tools/v3/rmTypeExpander";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { LintIssue } from "@/project/lint/projectLint";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { store } from "@/project/store";
import type { MapId, Project, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

export type BuildPalettePrimitive = "house" | "river" | "path" | "roof" | "npc" | "tree" | "prop";

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

export function applyBuildPalettePrimitive(selection: BuildPaletteSelection, primitive: BuildPalettePrimitive): BuildPaletteResult {
  const current = store.getCurrent();
  if (!current.maps[selection.mapId]) return { ok: false, summary: "선택한 맵을 찾을 수 없습니다.", toolResults: [] };
  recordProjectSnapshot(`건축 팔레트: ${primitive}`, selection.mapId, { kind: "project" });
  const result = applyBuildPalettePrimitiveToProject(structuredClone(current), selection, primitive);
  if (result.ok) store.replace(result.project);
  return result;
}

export function applyBuildPalettePrimitiveToProject(
  project: Project,
  selection: BuildPaletteSelection,
  primitive: BuildPalettePrimitive
): BuildPaletteResult & { readonly project: Project } {
  const map = project.maps[selection.mapId];
  if (!map) return { ok: false, summary: "선택한 맵을 찾을 수 없습니다.", toolResults: [], project };
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return { ok: false, summary: "타일셋을 찾을 수 없습니다.", toolResults: [], project };
  const rect = clampSelection(selection, map.width, map.height);
  if (rect.width < 1 || rect.height < 1) return { ok: false, summary: "선택 영역이 맵 밖입니다.", toolResults: [], project };
  const validationFailure = validateBuildPalettePrimitive(rect, primitive);
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
  if (primitive === "house") ok = stampHouse(rect, run);
  else if (primitive === "path") ok = stampPath(rect, run);
  else if (primitive === "river") ok = fillRoleTile(ctx.project, rect, "water");
  else if (primitive === "roof") ok = fillRoof(ctx.project, rect);
  else if (primitive === "tree") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), propVocabId: BUILD_PALETTE_PRESETS.tree, count: countForArea(rect, 6), naturalness: 0.55, seed: seedFor(rect, "tree") });
  else if (primitive === "prop") ok = run("place_props", { mapId: rect.mapId, area: toToolRect(rect), propVocabId: BUILD_PALETTE_PRESETS.prop, count: countForArea(rect, 10), naturalness: 0.45, seed: seedFor(rect, "prop") });
  else if (primitive === "npc") ok = run("place_npc", { mapId: rect.mapId, x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2), name: "주민", pages: [{ lines: ["안녕하세요."] }] });

  const failed = toolResults.find((result) => !result.ok);
  const summary = failed ? summarizeToolFailure(failed) : ok ? `${primitive} 시공 완료` : `${primitive} 시공에 실패했습니다.`;
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
      group.patternGrammar = {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 2,
        parts: [{ role: "leftCap", tileIds: [404] }, { role: "repeatBody", tileIds: [405] }, { role: "rightCap", tileIds: [406] }],
        preserveCaps: true,
        repeat: "body",
      };
    } else if (claim.patternKind && (!group.patternGrammar || group.patternGrammar.kind !== claim.patternKind)) {
      group.patternGrammar = derivePatternGrammar(claim.patternKind, group.tileIds, tileset, { groupId: group.id, name: group.name });
    }
  }
  ensurePathAutotile(tileset);
}

function stampHouse(rect: BuildPaletteSelection, run: (name: string, args: Record<string, unknown>) => boolean): boolean {
  if (rect.width < 2 || rect.height < 2) return false;
  const wallRect = { x: rect.x, y: rect.y + 1, w: rect.width, h: rect.height - 1 };
  const doorX = rect.x + Math.floor(rect.width / 2);
  const doorY = rect.y + rect.height - 1;
  return run("build_wall", { mapId: rect.mapId, rect: wallRect, wallVocabId: BUILD_PALETTE_PRESETS.wall })
    && run("place_door", { mapId: rect.mapId, at: { x: doorX, y: doorY }, doorVocabId: BUILD_PALETTE_PRESETS.door })
    && run("build_roof", { mapId: rect.mapId, roofVocabId: BUILD_PALETTE_PRESETS.roof, wallRect });
}

function validateBuildPalettePrimitive(rect: BuildPaletteSelection, primitive: BuildPalettePrimitive): string | null {
  if (primitive === "house" && (rect.width < 2 || rect.height < 2)) {
    return "집은 최소 2×2 영역이 필요합니다.";
  }
  if (primitive === "roof" && rect.width < 2) {
    return "지붕은 최소 2×1 영역이 필요합니다.";
  }
  return null;
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
  const tileset = project.tilesets[map.tilesetId];
  const group = tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_PRESETS.roof);
  const parts = group?.patternGrammar?.parts ?? [];
  const left = parts.find((part) => part.role === "leftCap")?.tileIds[0] ?? group?.tileIds[0];
  const body = parts.find((part) => part.role === "repeatBody")?.tileIds[0] ?? left;
  const right = parts.find((part) => part.role === "rightCap")?.tileIds[0] ?? body;
  if (left === undefined || body === undefined || right === undefined) return false;
  forEachCell(rect, (x, y) => {
    const tile = x === rect.x ? left : x === rect.x + rect.width - 1 ? right : body;
    map.lowerTiles[y * map.width + x] = tile;
  });
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
