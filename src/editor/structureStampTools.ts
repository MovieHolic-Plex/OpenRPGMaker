import { stampDbHouseVariant } from "@/project/defaults/dbExtractedHouseVariants";
import type { SmallHouseMaterial, TilePoint } from "@/project/defaults/dbExtractedHouseTemplate";
import { INTERIOR_HOUSE_TILESET_ID, stampInteriorHouse10x10 } from "@/editor/interiorStructureStamp";
import { TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

export type StructureStampId = "house-template" | "house-wide" | "house-compact" | "house-l" | "house-interior-10x10";
type ExteriorStructureStampId = Exclude<StructureStampId, "house-interior-10x10">;

export type StructureStamp = {
  readonly id: StructureStampId;
  readonly label: string;
  readonly description: string;
};

export type StructureStampPlacement = {
  readonly id: StructureStampId;
  readonly material?: SmallHouseMaterial;
  readonly origin: TilePoint;
};

export type StructureStampCell = TilePoint & {
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

export const STRUCTURE_STAMPS: readonly StructureStamp[] = [
  { id: "house-template", label: "기본 집", description: "small_house_01 집 키트 기반 집" },
  { id: "house-wide", label: "넓은 집", description: "가로로 넓은 집" },
  { id: "house-compact", label: "작은 집", description: "작게 압축된 집" },
  { id: "house-l", label: "ㄴ자 집", description: "ㄴ자 형태의 집" },
  { id: "house-interior-10x10", label: "10x10 실내", description: "작은집 내부 바닥, 벽, 침대, 책장, 식탁 배치" },
] as const;

export function structureStampById(id: StructureStampId | null): StructureStamp | null {
  if (id === null) return null;
  return STRUCTURE_STAMPS.find((stamp) => stamp.id === id) ?? null;
}

export function placeStructureStamp(mapId: MapId, placement: StructureStampPlacement): void {
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map) return;
    applyStructureStampToMap(map, placement);
  }, { scope: "map", mapId });
}

export function applyStructureStampToMap(map: GameMap, placement: StructureStampPlacement): void {
  if (!canPlaceStructureStampOnMap(map, placement.id)) return;
  if (placement.id === "house-interior-10x10") {
    stampInteriorHouse10x10(map, placement.origin);
    return;
  }
  stampDbHouseVariant(map, {
    approachHeight: 3,
    includeFence: false,
    material: placement.material ?? "plaster",
    origin: placement.origin,
    variant: variantForStamp(placement.id),
  });
}

export function canPlaceStructureStampOnMap(map: Pick<GameMap, "tilesetId">, id: StructureStampId): boolean {
  const isInteriorMap = map.tilesetId === INTERIOR_HOUSE_TILESET_ID;
  return id === "house-interior-10x10" ? isInteriorMap : !isInteriorMap;
}

export function previewStructureStampCells(map: GameMap, placement: StructureStampPlacement): readonly StructureStampCell[] {
  const preview = emptyPreviewMap(map);
  applyStructureStampToMap(preview, placement);
  return changedCells(preview);
}

function variantForStamp(id: ExteriorStructureStampId): "template" | "wide" | "compact" | "l" {
  switch (id) {
    case "house-template":
      return "template";
    case "house-wide":
      return "wide";
    case "house-compact":
      return "compact";
    case "house-l":
      return "l";
  }
}

function emptyPreviewMap(source: GameMap): GameMap {
  const tileCount = source.width * source.height;
  return {
    events: [],
    height: source.height,
    id: source.id,
    lowerTiles: new Array<number>(tileCount).fill(TILE.GRASS),
    name: source.name,
    tileSize: source.tileSize,
    tilesetId: source.tilesetId,
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    width: source.width,
  };
}

function changedCells(map: GameMap): readonly StructureStampCell[] {
  const cells: StructureStampCell[] = [];
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const lower = map.lowerTiles[index] ?? TILE.GRASS;
    if (lower !== TILE.GRASS) cells.push({ layer: "lower", tile: lower, x, y });
    const upper = map.upperTiles[index] ?? TILE.EMPTY;
    if (upper !== TILE.EMPTY) cells.push({ layer: "upper", tile: upper, x, y });
  }
  return cells;
}
