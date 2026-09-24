import type { GameMap } from "@/project/types";

export interface MapTexture {
  /** 가장 흔한 아래층 타일이 차지하는 비율(0~1). */
  dominantShare: number;
  /** 위층이 찬 칸 비율(0~1). */
  upperShare: number;
  dominantTile: number;
}

/** 가장 흔한 아래층 타일 비율과 위층이 찬 칸 비율. */
export function mapTexture(map: GameMap): MapTexture {
  const counts = new Map<number, number>();
  for (const tile of map.lowerTiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  let dominantTile = 0, top = 0;
  for (const [tile, count] of counts) if (count > top) { top = count; dominantTile = tile; }
  const cells = Math.max(1, map.width * map.height);
  const upper = map.upperTiles.filter((tile) => tile > 0).length;
  return { dominantShare: top / cells, upperShare: upper / cells, dominantTile };
}

/** 한 가지 바닥이 대부분이고 위층 장식이 거의 없는 「빈 판」 맵. */
export function isBareBoard(texture: MapTexture): boolean {
  return texture.dominantShare >= 0.75 && texture.upperShare < 0.03;
}
