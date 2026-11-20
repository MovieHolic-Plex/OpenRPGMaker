import { compactMapLayers, EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt, TILE_LAYER_NOS } from "@/project/mapLayers";
import { jsonEqual } from "@/util/structuralJson";
import type { GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";
import { assertTileReferencesPreserved } from "./references";

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Point = Pick<Rect, "x" | "y">;
const STACK_KEYS = ["lowerTileStacks", "upperTileStacks"] as const;
const EMPTY_TILE = -1;

export function hostRegion(ctx: PrimitiveContext, wholeMap = false): { map: GameMap; rect: Rect } {
  const target = ctx.target;
  if (target.kind !== "map" || !Object.hasOwn(ctx.project.maps, target.mapId)) {
    throw new PrimitiveError("맵을 찾을 수 없어요.");
  }
  const map = ctx.project.maps[target.mapId]!;
  if (map.id !== target.mapId) throw new PrimitiveError("선택한 맵을 다시 열어 주세요.");
  const bounds = { x: 0, y: 0, w: map.width, h: map.height };
  const rect = ctx.selection?.rect ?? (wholeMap ? bounds : undefined);
  if (!rect) throw new PrimitiveError("작업할 맵 영역을 먼저 선택해 주세요.");
  assertInside(bounds, rect, "선택 영역이 맵을 벗어나요.");
  return { map, rect };
}

export function assertInside(region: Rect, area: Rect, message = "선택한 영역을 벗어나요."): void {
  if (![area.x, area.y, area.w, area.h].every(Number.isSafeInteger) ||
      area.w < 1 || area.h < 1 || area.x < region.x || area.y < region.y ||
      area.x + area.w > region.x + region.w || area.y + area.h > region.y + region.h) {
    throw new PrimitiveError(`범위 밖: ${message}`);
  }
}

export function forEachCell(rect: Rect, visit: (x: number, y: number) => void): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) visit(x, y);
  }
}

export function getTileset(project: Project, map: GameMap) {
  const tileset = Object.hasOwn(project.tilesets, map.tilesetId) && project.tilesets[map.tilesetId];
  if (!tileset) throw new PrimitiveError("이 맵의 타일셋을 찾을 수 없어요.");
  return tileset;
}

export function requireTile(project: Project, map: GameMap, tile: unknown): number {
  const tileset = getTileset(project, map);
  if (typeof tile !== "number" || !Number.isSafeInteger(tile) || tile < 0 || tile >= tileset.count) {
    throw new PrimitiveError("이 맵의 타일셋에 없는 타일이에요.");
  }
  return tile;
}

function copyTileMap(map: GameMap): GameMap {
  const copy = { ...map, lowerTiles: map.lowerTiles.slice(), upperTiles: map.upperTiles.slice() };
  for (const key of EXTRA_LAYER_KEYS) {
    if (map[key]) copy[key] = map[key].slice();
  }
  for (const key of STACK_KEYS) {
    if (map[key]) copy[key] = { ...map[key] };
  }
  return copy;
}

export function tileCellChanged(before: GameMap, after: GameMap, index: number): boolean {
  return TILE_LAYER_NOS.some(layer => layerTileAt(before, layer, index) !== layerTileAt(after, layer, index))
    || shadowAt(before, index) !== shadowAt(after, index)
    || STACK_KEYS.some(key => !jsonEqual(before[key]?.[index], after[key]?.[index]));
}

export function editTiles(
  project: Project, map: GameMap, edit: (draft: Project, next: GameMap) => void,
): Project {
  const next = copyTileMap(map);
  const draft = { ...project, maps: { ...project.maps, [map.id]: next } };
  edit(draft, next);
  for (const index of map.terrainDesign?.lockedCells ?? []) {
    if (tileCellChanged(map, next, index)) {
      throw new PrimitiveError("범위 밖: 보호된 타일이 포함되어 있어요.");
    }
  }
  assertTileReferencesPreserved(project, draft, map, next);
  compactMapLayers(next);
  // 이전 저장본이 갖고 있던 빈 선택 배열은 편집 여부와 관계없이 보존한다.
  for (const key of EXTRA_LAYER_KEYS) {
    if (!next[key] && map[key]?.every(tile => tile === (key === "shadowBits" ? 0 : EMPTY_TILE))) next[key] = map[key];
  }
  return draft;
}

function writeStack(map: GameMap, key: (typeof STACK_KEYS)[number], index: number, stack: number[] | undefined): void {
  if (stack) {
    (map[key] ??= {})[index] = stack.slice();
  } else if (map[key]?.[index]) {
    delete map[key][index];
    if (Object.keys(map[key]).length === 0) delete map[key];
  }
}

/** Reads the original map even when source and destination overlap. */
export function writeTileCell(
  source: GameMap, sourceIndex: number, next: GameMap, index: number,
  options: { ground?: number; shadow?: (bits: number) => number } = {},
): void {
  for (const layer of TILE_LAYER_NOS) {
    const tile = sourceIndex >= 0 ? layerTileAt(source, layer, sourceIndex) : layer === 1 ? options.ground ?? EMPTY_TILE : EMPTY_TILE;
    setLayerTileAt(next, layer, index, tile);
  }
  const bits = shadowAt(source, sourceIndex);
  setShadowAt(next, index, options.shadow ? options.shadow(bits) : bits);
  for (const key of STACK_KEYS) writeStack(next, key, index, source[key]?.[sourceIndex]);
}

export function offsetRect(rect: Rect, offset: Point): Rect {
  return { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
}

export function includesCell(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
