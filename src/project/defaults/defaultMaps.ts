import { genId } from "@/util/id";
import type { GameMap, MapId, MapTreeNode, TilesetDef } from "../types";
import { DEFAULT_TERRAIN_GAMEPLAY } from "../terrainDesign";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";
// 2026-10-07 저작권 정리: 합본 마을·레트로 집(EasyRPG) 칩셋으로 그리던 쇼케이스 맵(통나무집·EasyRPG 집 시험장)과
// 시작 마을 장식(길·통나무집·주민)은 지웠다. createStarterMap 은 이제 기본 칩셋(버들항)의 빈 풀밭이다.

const STARTER_MAP_SIZE = 30;

/**
 * 새 맵 바닥 채움 칸.
 *
 * 타일 번호는 칩셋마다 독립적이라 `TILE.GRASS`(240)를 공용 기본값으로 쓰면 안 된다.
 * 240은 옛 합본 마을 시트의 번호일 뿐이며, 다른 칩셋에서는 벽·장식·빈 칸이 될 수 있다.
 */
const BEODEUL_PLAIN_GRASS_TILE = 737;

/** 메타데이터를 아직 갖지 않은 번들 칩셋의 안전한 민무늬 바닥. */
const BUNDLED_PLAIN_GROUND_TILES: Record<string, number> = {
  beodeul_city: BEODEUL_PLAIN_GRASS_TILE,
  joseon_baram: 0,
  modern_city: 17,
  jp_city: 725,
  // 1번 오크 판자와 205번 수리용 석재는 고정 조각이라 반복 시 이음선이 튄다. 반복 가능한 성채 포석 577번을 쓴다.
  wizarding_world: 577,
  // 해적 군도: 맨 모래(pi-sand 첫 칸, 자리 키 핀 고정).
  pirate_isles: 1,
  // 1번 = 풀밭(반복 가능한 아래층 바닥).
  sengoku_edo: 1,
  // 3번 = 하늘섬 풀밭(반복 가능한 아래층 바닥). 섬·하늘은 compose_sky_island_map 이 깐다.
  sky_island: 3,
  // 스팀펑크 도시: 4번 = 판석 보도(반복 가능한 아래층 바닥, 굽기 핀 tiledata/steampunk-city/bake-pins.json 이 번호를 고정한다).
  steampunk_city: 4,
  // 24번 = 캠퍼스 잔디(반복 가능한 아래층 바닥).
  modern_campus: 1,
  // SF 정거장: 갑판 판 기본 변형(sf:floor:deck-plate 첫 칸, 자리 키 핀 고정).
  sf_station: 60,
  // 선사 시대 원시 세계: 4번 = 원시 풀밭(반복 가능한 아래층 바닥, 굽기 핀 tiledata/prehistoric/bake-pins.json 이 번호를 고정한다).
  prehistoric: 4,
  scarloxy_chipset_grassland: 0,
  scarloxy_chipset_wilds: 0,
  atlas_biome_interior: 258,
};

type BlankFillTileset = Pick<TilesetDef, "tileMeta">;

function semanticGroundTile(tileset: BlankFillTileset | undefined): number | undefined {
  const meta = tileset?.tileMeta;
  if (!meta) return undefined;
  let best: { tile: number; score: number } | undefined;
  for (let tile = 0; tile < meta.length; tile += 1) {
    const entry = meta[tile];
    if (!entry || entry.defaultLayer !== "lower" || entry.passage !== "passable") continue;
    const text = [entry.label, entry.description, ...(entry.tags ?? [])].join(" ").toLowerCase();
    let score = 0;
    if (/grass|green|잔디|풀|초원/.test(text)) score += 6;
    if (/ground|terrain|field|지형|마당|흙|땅/.test(text)) score += 4;
    if (/floor|바닥|널마루|마루/.test(text)) score += 3;
    // 고정 조각(모서리·전이·수리 슬롯)은 반복 채움에서 이음선이 튄다.
    if (entry.repeatability === "repeat" || entry.repeatability === "auto") score += 2;
    if (/road|asphalt|sidewalk|water|wall|roof|길|도로|보도|물|벽|지붕/.test(text)) score -= 5;
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && tile < best.tile)) best = { tile, score };
  }
  return best?.tile;
}

/** 칩셋 정본 메타데이터 또는 번들 기본값에서 새 맵 바닥을 고른다. */
export function plainGrassTileFor(tilesetId: string, tileset?: BlankFillTileset): number | undefined {
  // 번들 칩셋은 공간별 특수 바닥(포션실·온실·건물 내부)이 더 높은 점수를 받을 수 있다.
  // 새 맵의 정본 바닥은 먼저 고정하고, 업로드/미지 칩셋만 메타데이터에서 추론한다.
  if (Object.hasOwn(BUNDLED_PLAIN_GROUND_TILES, tilesetId)) return BUNDLED_PLAIN_GROUND_TILES[tilesetId];
  return semanticGroundTile(tileset);
}

export function blankFillTileFor(tilesetId: string, fallback = 0, tileset?: BlankFillTileset): number {
  if (tilesetId === "worldmap_authoring") return 0;
  return plainGrassTileFor(tilesetId, tileset) ?? (tilesetId === DEFAULT_TILESET_ID ? BEODEUL_PLAIN_GRASS_TILE : fallback);
}

export function createBlankMap(
  name: string,
  width: number,
  height: number,
  tilesetId: string = DEFAULT_TILESET_ID,
  tileSize: number = DEFAULT_TILE_SIZE,
  tileset?: BlankFillTileset
): GameMap {
  const n = width * height;
  return {
    id: genId("map"),
    name,
    width,
    height,
    tilesetId,
    tileSize,
    lowerTiles: new Array<number>(n).fill(blankFillTileFor(tilesetId, 0, tileset)),
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
