import { genId } from "@/util/id";
import type { GameMap, MapId, MapTreeNode } from "../types";
import { DEFAULT_TERRAIN_GAMEPLAY } from "../terrainDesign";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";
// 2026-10-07 저작권 정리: 합본 마을·레트로 집(EasyRPG) 칩셋으로 그리던 쇼케이스 맵(통나무집·EasyRPG 집 시험장)과
// 시작 마을 장식(길·통나무집·주민)은 지웠다. createStarterMap 은 이제 기본 칩셋(버들항)의 빈 풀밭이다.

const STARTER_MAP_SIZE = 30;

/**
 * 새 맵 바닥 채움 칸. `TILE.GRASS`(240)는 합본 마을 시트의 칸 번호라 버들항에서는 벽이다.
 * 버들항의 민무늬 풀 칸은 737 (openwiki/beodeul-city.md).
 */
const BEODEUL_PLAIN_GRASS_TILE = 737;

/** 합본 마을 번호(`TILE.GRASS`)를 쓰면 안 되는 칩셋의 민무늬 풀 칸. 그 밖의 칩셋은 undefined. */
export function plainGrassTileFor(tilesetId: string): number | undefined {
  return tilesetId === DEFAULT_TILESET_ID ? BEODEUL_PLAIN_GRASS_TILE : undefined;
}

export function blankFillTileFor(tilesetId: string, fallback: number = TILE.GRASS): number {
  if (tilesetId === "worldmap_authoring") return 0;
  return plainGrassTileFor(tilesetId) ?? fallback;
}

export function createBlankMap(
  name: string,
  width: number,
  height: number,
  tilesetId: string = DEFAULT_TILESET_ID,
  tileSize: number = DEFAULT_TILE_SIZE
): GameMap {
  const n = width * height;
  return {
    id: genId("map"),
    name,
    width,
    height,
    tilesetId,
    tileSize,
    lowerTiles: new Array<number>(n).fill(blankFillTileFor(tilesetId)),
    upperTiles: new Array<number>(n).fill(TILE.EMPTY),
    events: [],
    // 시야 차단은 선택 기능이다. 새 맵은 OFF를 명시적으로 저장한다.
    terrainDesign: { gameplay: { ...DEFAULT_TERRAIN_GAMEPLAY } },
  };
}

export function createStarterMap(): GameMap {
  return createBlankMap("마을", STARTER_MAP_SIZE, STARTER_MAP_SIZE, DEFAULT_TILESET_ID);
}

export function singleNodeTree(mapId: MapId): MapTreeNode {
  return { mapId, children: [] };
}
