import type { TilesetDef } from "@/project/types";

export type PaletteStampLayer = "lower" | "upper";

export type PaletteStampCell = {
  readonly dx: number;
  readonly dy: number;
  readonly layer: PaletteStampLayer;
  readonly tile: number;
};

export type PaletteStamp = {
  readonly cells: readonly PaletteStampCell[];
  readonly height: number;
  readonly source: {
    readonly endTile: number;
    readonly startTile: number;
  };
  readonly width: number;
};

export type PaletteStampDragInput = {
  readonly endTile: number;
  readonly startTile: number;
  readonly tileset: TilesetDef;
};

export type PaletteStampDisplayDragInput = PaletteStampDragInput & {
  readonly displayTiles: readonly number[];
  readonly displayTilesPerRow: number;
};

export function createPaletteStampFromDrag(input: PaletteStampDragInput): PaletteStamp {
  const start = tilePointFor(input.startTile, input.tileset.tilesPerRow);
  const end = tilePointFor(input.endTile, input.tileset.tilesPerRow);
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const cells: PaletteStampCell[] = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const tile = y * input.tileset.tilesPerRow + x;
      if (tile >= input.tileset.count) continue;
      cells.push({
        dx: x - left,
        dy: y - top,
        layer: input.tileset.priority[tile] ?? "lower",
        tile,
      });
    }
  }
  return {
    cells,
    height: bottom - top + 1,
    source: { endTile: input.endTile, startTile: input.startTile },
    width: right - left + 1,
  };
}

export function createPaletteStampFromDisplayDrag(input: PaletteStampDisplayDragInput): PaletteStamp {
  const startIndex = input.displayTiles.indexOf(input.startTile);
  const endIndex = input.displayTiles.indexOf(input.endTile);
  if (startIndex < 0 || endIndex < 0) return createPaletteStampFromDrag(input);
  const start = tilePointFor(startIndex, input.displayTilesPerRow);
  const end = tilePointFor(endIndex, input.displayTilesPerRow);
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const cells: PaletteStampCell[] = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const displayIndex = y * input.displayTilesPerRow + x;
      const tile = input.displayTiles[displayIndex];
      if (tile === undefined || tile >= input.tileset.count) continue;
      cells.push({
        dx: x - left,
        dy: y - top,
        layer: input.tileset.priority[tile] ?? "lower",
        tile,
      });
    }
  }
  return {
    cells,
    height: bottom - top + 1,
    source: { endTile: input.endTile, startTile: input.startTile },
    width: right - left + 1,
  };
}

export function paletteStampIncludesTile(stamp: PaletteStamp | null, tile: number, tilesPerRow: number): boolean {
  if (!stamp) return false;
  void tilesPerRow;
  return stamp.cells.some((cell) => cell.tile === tile);
}

function tilePointFor(tile: number, tilesPerRow: number): { readonly x: number; readonly y: number } {
  return {
    x: tile % tilesPerRow,
    y: Math.floor(tile / tilesPerRow),
  };
}
