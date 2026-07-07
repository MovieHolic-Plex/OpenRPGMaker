import type { ToolContext } from "@/editor/tools";
import { TILE } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { BuildPaletteSelection } from "@/editor/panels/buildPaletteCore";

export type HousePresetId = "cottage-1f" | "house-2f" | "l-house-1f" | "blue-cottage-1f" | "bright-l-1f";
export type HouseShape = "rect" | "l";
export type RoofMaterialId = "orange-classic" | "orange-bright" | "blue";

export interface HousePreset {
  readonly id: HousePresetId;
  readonly name: string;
  readonly stories: 1 | 2;
  readonly shape: HouseShape;
  readonly roofMaterial: RoofMaterialId;
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

// 지붕 재질 세트 — 사용자 예시 맵 학습 결과(docs/knowledge/2026-07-08-roof-tile-semantics-learned.md).
// classic: 하위 레이어만(용마루/몸통/처마). blue/bright: 대각·용마루·트림 마감을 상위 레이어에 얹는다.
export interface RoofMaterialSet {
  readonly id: RoofMaterialId;
  readonly kind: "classic" | "blue" | "bright";
  readonly ridge?: number;
  readonly body: number;
  readonly eave: number;
  readonly leftEdge?: number;
  readonly rightEdge?: number;
  readonly upper?: {
    readonly ridgeLine?: number;
    readonly ridgeCapLeft?: number;
    readonly ridgeCapRight?: number;
    readonly trimLeft?: number;
    readonly trimRight?: number;
    readonly trimCapLeft?: number;
    readonly trimCapRight?: number;
    readonly cornerNW?: number;
    readonly cornerNE?: number;
    readonly cornerSW?: number;
    readonly cornerSE?: number;
  };
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
  const shared = { wallSet: materials.wall, roofSet: materials.roof, doorSet: materials.door, windowSet: materials.window } as const;
  return [
    { id: "cottage-1f", name: "1층집", stories: 1, shape: "rect", roofMaterial: "orange-classic", ...shared },
    { id: "house-2f", name: "2층집", stories: 2, shape: "rect", roofMaterial: "orange-classic", ...shared },
    { id: "l-house-1f", name: "ㄱ자집", stories: 1, shape: "l", roofMaterial: "orange-classic", ...shared },
    // 학습 예시(연습02/08)에서 배운 세트 — 파랑 지붕 오두막, 밝은 오렌지 ㄱ자.
    { id: "blue-cottage-1f", name: "파랑1층", stories: 1, shape: "rect", roofMaterial: "blue", ...shared },
    { id: "bright-l-1f", name: "밝은ㄱ자", stories: 1, shape: "l", roofMaterial: "orange-bright", ...shared },
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
  roofMaterial: RoofMaterialSet,
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

  paintHousePlanRoof(ctx.project.maps[rect.mapId], columns, wallRows, roofMaterial);
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

function paintHousePlanRoof(map: Project["maps"][string], columns: readonly FootprintColumn[], wallRows: number, set: RoofMaterialSet): void {
  const spans = new Map<number, { readonly top: number; readonly bottom: number }>();
  for (const column of columns) {
    const bottom = column.yMax - wallRows;
    if (bottom < column.yTop) continue;
    spans.set(column.x, { top: column.yTop, bottom });
  }
  if (spans.size === 0) return;
  const isRoof = (x: number, y: number): boolean => {
    const span = spans.get(x);
    return !!span && y >= span.top && y <= span.bottom;
  };
  const setLower = (x: number, y: number, tile: number): void => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    map.lowerTiles[y * map.width + x] = tile;
  };
  // 상위 마감은 비어 있을 때만 얹는다 — 이웃의 기존 오버레이(나무/다른 지붕)를 덮지 않는다.
  const setUpperIfEmpty = (x: number, y: number, tile: number | undefined): void => {
    if (tile === undefined || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const index = y * map.width + x;
    if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
  };

  if (set.kind === "classic") {
    for (const [x, span] of spans) {
      for (let y = span.top; y <= span.bottom; y += 1) {
        setLower(x, y, y === span.bottom ? set.eave : y === span.top ? set.ridge ?? set.body : set.body);
      }
    }
    return;
  }

  if (set.kind === "blue") {
    // 연습02 문법: 몸통 406, 좌/우 수직 가장자리 437/407, 처마(최하행) 467,
    // 가장자리 열의 최상단은 하위를 비워 두고 상위 대각 모서리(356/357), 처마 모서리엔 386/387.
    for (const [x, span] of spans) {
      const leftIsRoof = isRoof(x - 1, span.top);
      const rightIsRoof = isRoof(x + 1, span.top);
      for (let y = span.top; y <= span.bottom; y += 1) {
        const isEdgeLeft = !isRoof(x - 1, y);
        const isEdgeRight = !isRoof(x + 1, y);
        if (y === span.bottom) {
          setLower(x, y, set.eave);
          if (isEdgeLeft) setUpperIfEmpty(x, y, set.upper?.cornerSW);
          if (isEdgeRight) setUpperIfEmpty(x, y, set.upper?.cornerSE);
          continue;
        }
        if (y === span.top && isEdgeLeft && !leftIsRoof) {
          setUpperIfEmpty(x, y, set.upper?.cornerNW);
          continue;
        }
        if (y === span.top && isEdgeRight && !rightIsRoof) {
          setUpperIfEmpty(x, y, set.upper?.cornerNE);
          continue;
        }
        setLower(x, y, isEdgeLeft ? set.leftEdge ?? set.body : isEdgeRight ? set.rightEdge ?? set.body : set.body);
      }
    }
    return;
  }

  // bright(연습08 문법): 하위 = 몸통 404 + 처마행 405. 상위 = 지붕 위 한 줄 용마루 374(+캡 354/355),
  // 지붕 좌우 바깥 열 수직 트림 376/377(+하단 캡 384/385).
  for (const [x, span] of spans) {
    for (let y = span.top; y <= span.bottom; y += 1) {
      setLower(x, y, y === span.bottom ? set.eave : set.body);
    }
    const ridgeY = span.top - 1;
    setUpperIfEmpty(x, ridgeY, set.upper?.ridgeLine);
    if (!isRoof(x - 1, span.top)) setUpperIfEmpty(x - 1, ridgeY, set.upper?.ridgeCapLeft);
    if (!isRoof(x + 1, span.top)) setUpperIfEmpty(x + 1, ridgeY, set.upper?.ridgeCapRight);
    for (let y = span.top; y < span.bottom; y += 1) {
      if (!isRoof(x - 1, y)) setUpperIfEmpty(x - 1, y, set.upper?.trimLeft);
      if (!isRoof(x + 1, y)) setUpperIfEmpty(x + 1, y, set.upper?.trimRight);
    }
    if (!isRoof(x - 1, span.bottom)) setUpperIfEmpty(x - 1, span.bottom, set.upper?.trimCapLeft);
    if (!isRoof(x + 1, span.bottom)) setUpperIfEmpty(x + 1, span.bottom, set.upper?.trimCapRight);
  }
}
