import { DUNGEON_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import { dungeonTerrainBlockRoles } from "./dungeonTerrainAutotiles";
import type { TerrainQuarterKit } from "./terrainQuarterAutotile";
import type { TilesetDef } from "../types";

// 던전 칩셋(easyrpg_chipset_dungeon) 지형 12블록의 RM2k3식 8×8 쿼터 합성 킷.
// 저장 타일은 9-슬라이스+오목 통짜 결과를 유지하고, 렌더 시점에 셀의 쿼터마다
// v/h/d 이웃 연결로 소스 타일의 같은 위치 쿼터를 고른다(terrainQuarterSourcesForKit).
// 이것으로 구멍 대각의 오목 소스(4-노치 통짜)가 노치 1개짜리 정확한 코너로 그려진다.
//
// combined-town 흙길/모래 킷과 타일 id가 겹치므로(블록 위치가 같음) 반드시
// 텍스처 가드를 통과한 경우에만 이 킷을 쓴다 — chipsetQuarterComposition이 우선 조회.

let cachedKits: readonly TerrainQuarterKit[] | null = null;

function buildKits(): readonly TerrainQuarterKit[] {
  return dungeonTerrainBlockRoles().map((roles) => ({
    body: roles.body,
    edgeNorth: roles.edgeNorth,
    edgeSouth: roles.edgeSouth,
    edgeWest: roles.edgeWest,
    edgeEast: roles.edgeEast,
    cornerNorthWest: roles.cornerNorthWest,
    cornerNorthEast: roles.cornerNorthEast,
    cornerSouthWest: roles.cornerSouthWest,
    cornerSouthEast: roles.cornerSouthEast,
    inner: roles.inner,
    isolated: roles.isolated,
    targetTiles: roles.memberTileIds,
    connect: new Set<number>(roles.connectTileIds),
  }));
}

export function isDungeonQuarterTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === DUNGEON_TEXTURE_KEY;
}

/** 던전 칩셋이면 쿼터 킷 12종, 아니면 null. */
export function dungeonTerrainQuarterKits(
  tileset: Pick<TilesetDef, "image">
): readonly TerrainQuarterKit[] | null {
  if (!isDungeonQuarterTileset(tileset)) return null;
  cachedKits ??= buildKits();
  return cachedKits;
}
