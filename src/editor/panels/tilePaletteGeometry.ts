export type SheetRangeRect = {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
};

export function normalizeSheetRect(startTile: number, endTile: number, tilesPerRow: number): SheetRangeRect {
  const start = tilePoint(startTile, tilesPerRow);
  const end = tilePoint(endTile, tilesPerRow);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    h: Math.abs(start.y - end.y) + 1,
    w: Math.abs(start.x - end.x) + 1,
    x,
    y,
  };
}

export function tilePoint(tile: number, tilesPerRow: number): { readonly x: number; readonly y: number } {
  return { x: tile % tilesPerRow, y: Math.floor(tile / tilesPerRow) };
}

export function tileIndexAtPoint(x: number, y: number, tilesPerRow: number): number {
  return y * tilesPerRow + x;
}

export function tileIdsInRect(
  rect: SheetRangeRect,
  count: number,
  tilesPerRow: number,
  acceptsTile: (tileId: number) => boolean
): readonly number[] {
  const tileIds: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const tileId = tileIndexAtPoint(x, y, tilesPerRow);
      if (tileId >= count) continue;
      if (acceptsTile(tileId)) tileIds.push(tileId);
    }
  }
  return tileIds;
}
