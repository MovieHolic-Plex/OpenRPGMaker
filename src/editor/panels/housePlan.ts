import type { ToolContext } from "@/editor/tools";
import type { Project } from "@/project/types";
import type { BuildPaletteSelection } from "@/editor/panels/buildPaletteCore";

export type HousePresetId = "cottage-1f" | "house-2f" | "l-house-1f";
export type HouseShape = "rect" | "l";

export interface HousePreset {
  readonly id: HousePresetId;
  readonly name: string;
  readonly stories: 1 | 2;
  readonly shape: HouseShape;
  readonly wallSet: string;
  readonly roofSet: string;
  readonly doorSet: string;
  readonly windowSet: string;
}

export interface HouseMaterialSets {
  readonly wall: string;
  readonly roof: string;
  readonly door: string;
  readonly window: string;
}

export interface RoofTileSet {
  readonly ridge: number;
  readonly body: number;
  readonly eave: number;
}

export interface HouseDoorPlacement {
  readonly x: number;
  readonly y: number;
}

export interface HousePlanStamp {
  readonly door: HouseDoorPlacement;
  readonly wallSegments: readonly WallSegment[];
}

interface FootprintColumn {
  readonly x: number;
  readonly yTop: number;
  readonly yMax: number;
}

interface WallSegment {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly yMax: number;
}

type RunTool = (name: string, args: Record<string, unknown>) => boolean;

export function createHousePresets(materials: HouseMaterialSets): readonly HousePreset[] {
  return [
    { id: "cottage-1f", name: "1층집", stories: 1, shape: "rect", wallSet: materials.wall, roofSet: materials.roof, doorSet: materials.door, windowSet: materials.window },
    { id: "house-2f", name: "2층집", stories: 2, shape: "rect", wallSet: materials.wall, roofSet: materials.roof, doorSet: materials.door, windowSet: materials.window },
    { id: "l-house-1f", name: "ㄱ자집", stories: 1, shape: "l", wallSet: materials.wall, roofSet: materials.roof, doorSet: materials.door, windowSet: materials.window },
  ];
}

export function wallRowsForStories(stories: 1 | 2): number {
  return stories === 2 ? 4 : 2;
}

export function validateHousePlanSelection(rect: BuildPaletteSelection, preset: HousePreset): string | null {
  const wallRows = wallRowsForStories(preset.stories);
  if (rect.width < 2 || rect.height < wallRows) {
    return preset.stories === 2 ? "2층집은 최소 2×4 영역이 필요합니다." : "집은 최소 2×2 영역이 필요합니다.";
  }
  if (preset.shape === "l" && (rect.width < 4 || rect.height < wallRows + 2)) {
    return "ㄱ자집은 최소 4×4 영역이 필요합니다.";
  }
  return null;
}

export function stampHousePlan(
  ctx: ToolContext,
  rect: BuildPaletteSelection,
  preset: HousePreset,
  roofTiles: RoofTileSet,
  run: RunTool,
  runOptional: RunTool
): HousePlanStamp | null {
  const columns = buildFootprintColumns(rect, preset);
  if (columns.length === 0) return null;
  const wallRows = wallRowsForStories(preset.stories);
  const wallSegments = buildWallSegments(columns, wallRows);
  const doorSegment = longestSouthWallSegment(wallSegments);
  if (!doorSegment) return null;
  const door = { x: doorSegment.x + Math.floor(doorSegment.w / 2), y: doorSegment.yMax };

  for (const segment of wallSegments) {
    if (!run("build_wall", { mapId: rect.mapId, rect: buildWallToolRect(segment), wallVocabId: preset.wallSet })) return null;
  }
  if (!run("place_door", { mapId: rect.mapId, at: door, doorVocabId: preset.doorSet })) return null;

  paintHousePlanRoof(ctx.project.maps[rect.mapId], columns, wallRows, roofTiles);
  if (doorSegment.w >= 5 && wallRows >= 3) {
    const windowY = doorSegment.y + 1;
    runOptional("place_window", { mapId: rect.mapId, at: { x: door.x - 2, y: windowY }, windowVocabId: preset.windowSet });
    runOptional("place_window", { mapId: rect.mapId, at: { x: door.x + 2, y: windowY }, windowVocabId: preset.windowSet });
  }
  return { door, wallSegments };
}

export function buildHouseFootprintCells(rect: BuildPaletteSelection, preset: HousePreset): readonly { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (const column of buildFootprintColumns(rect, preset)) {
    for (let y = column.yTop; y <= column.yMax; y += 1) cells.push({ x: column.x, y });
  }
  return cells;
}

function buildFootprintColumns(rect: BuildPaletteSelection, preset: HousePreset): readonly FootprintColumn[] {
  if (preset.shape === "rect") {
    return Array.from({ length: rect.width }, (_, index) => ({ x: rect.x + index, yTop: rect.y, yMax: rect.y + rect.height - 1 }));
  }

  const splitX = rect.x + Math.floor(rect.width / 2);
  const splitY = rect.y + Math.floor(rect.height / 2);
  const columns: FootprintColumn[] = [];
  for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    columns.push({ x, yTop: rect.y, yMax: x < splitX ? splitY - 1 : rect.y + rect.height - 1 });
  }
  return columns.filter((column) => column.yMax >= column.yTop);
}

function buildWallSegments(columns: readonly FootprintColumn[], wallRows: number): readonly WallSegment[] {
  const segments: WallSegment[] = [];
  let current: WallSegment | null = null;
  for (const column of columns) {
    const y = column.yMax - wallRows + 1;
    if (y < column.yTop) continue;
    if (current && current.x + current.w === column.x && current.y === y && current.yMax === column.yMax) {
      current = { x: current.x, y: current.y, w: current.w + 1, h: current.h, yMax: current.yMax };
      segments[segments.length - 1] = current;
    } else {
      current = { x: column.x, y, w: 1, h: wallRows, yMax: column.yMax };
      segments.push(current);
    }
  }
  return segments;
}

function buildWallToolRect(segment: WallSegment): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  if (segment.h >= 3 || segment.y <= 0) return { x: segment.x, y: segment.y, w: segment.w, h: segment.h };
  return { x: segment.x, y: segment.y - 1, w: segment.w, h: 3 };
}

function longestSouthWallSegment(segments: readonly WallSegment[]): WallSegment | null {
  return segments.reduce<WallSegment | null>((best, segment) => {
    if (!best) return segment;
    if (segment.w > best.w) return segment;
    if (segment.w === best.w && segment.yMax > best.yMax) return segment;
    return best;
  }, null);
}

function paintHousePlanRoof(map: Project["maps"][string], columns: readonly FootprintColumn[], wallRows: number, roofTiles: RoofTileSet): void {
  for (const column of columns) {
    const roofBottom = column.yMax - wallRows;
    const rows = roofBottom - column.yTop + 1;
    if (rows <= 0) continue;
    for (let dy = 0; dy < rows; dy += 1) {
      const tile = dy === rows - 1 ? roofTiles.eave : dy === 0 ? roofTiles.ridge : roofTiles.body;
      map.lowerTiles[(column.yTop + dy) * map.width + column.x] = tile;
    }
  }
}
