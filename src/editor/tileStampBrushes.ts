import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import type { TilesetDef } from "@/project/types";

export type TileStampId = "road-plus" | "road-block" | "sand-block";

export type TileStampCell = {
  readonly dx: number;
  readonly dy: number;
  readonly tile: number;
};

export type TileStamp = {
  readonly id: TileStampId;
  readonly label: string;
  readonly description: string;
  readonly anchorTile: number;
  readonly cells: readonly TileStampCell[];
};

export const TILE_STAMPS: readonly TileStamp[] = [
  {
    id: "road-plus",
    label: "십자길",
    description: "중심에서 네 방향으로 이어지는 흙길 스탬프",
    anchorTile: DIRT_ROAD_TILE.BODY,
    cells: [
      { dx: 0, dy: -1, tile: DIRT_ROAD_TILE.BODY },
      { dx: -1, dy: 0, tile: DIRT_ROAD_TILE.BODY },
      { dx: 0, dy: 0, tile: DIRT_ROAD_TILE.BODY },
      { dx: 1, dy: 0, tile: DIRT_ROAD_TILE.BODY },
      { dx: 0, dy: 1, tile: DIRT_ROAD_TILE.BODY },
    ],
  },
  {
    id: "road-block",
    label: "3x3 길",
    description: "마을 광장이나 교차로를 빠르게 깔기 위한 흙길 블록",
    anchorTile: DIRT_ROAD_TILE.BODY,
    cells: squareStampCells(DIRT_ROAD_TILE.BODY),
  },
  {
    id: "sand-block",
    label: "3x3 모래",
    description: "해변이나 사막 가장자리를 잡기 위한 모래 블록",
    anchorTile: SAND_TILE.BODY,
    cells: squareStampCells(SAND_TILE.BODY),
  },
] as const;

export function tileStampById(id: TileStampId | null): TileStamp | null {
  if (id === null) return null;
  return TILE_STAMPS.find((stamp) => stamp.id === id) ?? null;
}

export function tileStampsForTile(tile: number, tileset?: TilesetDef): readonly TileStamp[] {
  const meaning = tileSemanticMeaning(tile, tileset);
  if (meaning.has("road") || meaning.has("dirt")) {
    return [roadPlusStamp(tile), roadBlockStamp(tile)];
  }
  if (meaning.has("sand") || meaning.has("desert")) {
    return [sandBlockStamp(tile)];
  }
  return [];
}

export function compatibleStampIdForTile(activeStampId: TileStampId | null, tile: number, tileset?: TilesetDef): TileStampId | null {
  if (activeStampId === null) return null;
  return tileStampsForTile(tile, tileset).some((stamp) => stamp.id === activeStampId) ? activeStampId : null;
}

export function isAutoConnectCandidate(tile: number, tileset?: TilesetDef): boolean {
  const meaning = tileSemanticMeaning(tile, tileset);
  return meaning.has("autotile") || meaning.has("road") || meaning.has("dirt");
}

function roadPlusStamp(tile: number): TileStamp {
  return {
    ...TILE_STAMPS[0],
    anchorTile: tile,
    cells: [
      { dx: 0, dy: -1, tile },
      { dx: -1, dy: 0, tile },
      { dx: 0, dy: 0, tile },
      { dx: 1, dy: 0, tile },
      { dx: 0, dy: 1, tile },
    ],
  };
}

function roadBlockStamp(tile: number): TileStamp {
  return { ...TILE_STAMPS[1], anchorTile: tile, cells: squareStampCells(tile) };
}

function sandBlockStamp(tile: number): TileStamp {
  return { ...TILE_STAMPS[2], anchorTile: tile, cells: squareStampCells(tile) };
}

function tileSemanticMeaning(tile: number, tileset?: TilesetDef): ReadonlySet<string> {
  const words = new Set<string>();
  const meta = tileset?.tileMeta?.[tile];
  addWords(words, meta?.label);
  addWords(words, meta?.description);
  addWords(words, meta?.role);
  addWords(words, meta?.repeatability);
  if (meta?.repeatability === "auto") words.add("autotile");

  for (const group of tileset?.tileGroups ?? []) {
    if (!group.tileIds.includes(tile)) continue;
    addWords(words, group.id);
    addWords(words, group.name);
    addWords(words, group.role);
    addWords(words, group.description);
    addWords(words, group.placementRules);
    addWords(words, group.patternGrammar?.kind);
    if (group.patternGrammar?.kind === "autotile_3x3") words.add("autotile");
  }

  if (words.size === 0) {
    const descriptor = describeChipsetTile(tile);
    descriptor.tags.forEach((tag) => words.add(tag));
    addWords(words, descriptor.key);
    addWords(words, descriptor.label);
    addWords(words, descriptor.description);
    addWords(words, descriptor.aiLabel);
  }
  return words;
}

function addWords(target: Set<string>, value: string | undefined): void {
  if (!value) return;
  const normalized = value.toLowerCase();
  for (const token of normalized.split(/[^a-z0-9가-힣]+/u)) {
    if (token) target.add(token);
  }
  if (normalized.includes("road")) target.add("road");
  if (normalized.includes("dirt")) target.add("dirt");
  if (normalized.includes("sand")) target.add("sand");
  if (normalized.includes("desert")) target.add("desert");
  if (normalized.includes("auto")) target.add("autotile");
  if (normalized.includes("흙길")) {
    target.add("road");
    target.add("dirt");
  }
  if (normalized.includes("모래") || normalized.includes("사막")) target.add("sand");
}

function squareStampCells(tile: number): readonly TileStampCell[] {
  const cells: TileStampCell[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      cells.push({ dx, dy, tile });
    }
  }
  return cells;
}
