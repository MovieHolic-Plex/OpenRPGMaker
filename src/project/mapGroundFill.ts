import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import type { GameMap } from "@/project/types";

/**
 * 맵을 넓힐 때 새로 생기는 아래층(lowerTiles) 칸을 채우는 규칙 — 기본 타일이 쭉 이어지게 한다.
 *
 * - 가장 가까운 기존 칸을 복제한다(오른쪽·아래로 늘면 마지막 열·행, 왼쪽·위는 첫 열·행, 모서리는 모서리 칸).
 * - 복제할 칸이 물·길(주변 칸으로 모양이 정해지는 오토타일)이면 그 지형이 맵 밖으로 끝없이 이어지므로,
 *   대신 그 맵의 바탕 타일(물·길·빈칸을 뺀 가장 흔한 아래층 타일)을 쓴다. 바탕이 없으면 잔디.
 * - 위층·확장 레이어·그림자·이벤트·통행은 복사하지 않는다(호출자가 비운다).
 */
export type GroundFillSource = Pick<GameMap, "lowerTiles" | "width" | "height">;

export function mapBaseGroundTile(map: GroundFillSource, isFeature: (tile: number) => boolean): number {
  const counts = new Map<number, number>();
  for (const tile of map.lowerTiles) {
    if (tile === TILE.EMPTY || isFeature(tile)) continue;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  let best: number = TILE.GRASS;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      best = tile;
      bestCount = count;
    }
  }
  return best;
}

export function groundFeaturePredicate(map: Pick<GameMap, "tilesetId">, tilesets: Record<string, unknown> | undefined): (tile: number) => boolean {
  const tileset = tilesets?.[map.tilesetId] as Parameters<typeof isLakeAutotileTile>[1];
  return (tile) => isRoadTile(tile) || isLakeAutotileTile(tile, tileset);
}

/** `source` 의 아래층을 (x - originX, y - originY) 로 옮겨 새 크기 격자에 놓고, 밖으로 나가는 빈 칸을 규칙대로 채운다. */
export function extendedLowerTiles(
  source: GroundFillSource,
  width: number,
  height: number,
  isFeature: (tile: number) => boolean,
  originX = 0,
  originY = 0,
): number[] {
  const out = new Array<number>(width * height).fill(TILE.EMPTY);
  if (source.width <= 0 || source.height <= 0) return out;
  const base = mapBaseGroundTile(source, isFeature);
  for (let y = 0; y < height; y += 1) {
    const sy = y - originY;
    const cy = Math.max(0, Math.min(source.height - 1, sy));
    for (let x = 0; x < width; x += 1) {
      const sx = x - originX;
      const inside = sx >= 0 && sy >= 0 && sx < source.width && sy < source.height;
      const tile = source.lowerTiles[cy * source.width + Math.max(0, Math.min(source.width - 1, sx))] ?? TILE.EMPTY;
      if (inside) out[y * width + x] = tile;
      else out[y * width + x] = tile === TILE.EMPTY || isFeature(tile) ? base : tile;
    }
  }
  return out;
}
