import type { AutotileGroup, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import { autotileGroupsForTileset } from "./autotileGroups";
import {
  bundledAssetRef,
  COMBINED_TOWN_RETRO_WORLD_NAME,
  COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY,
  COMBINED_TOWN_RETRO_WORLD_TILE_COUNT,
  COMBINED_TOWN_RETRO_WORLD_TILESET_ID,
  DEFAULT_TILE_COUNT,
  DEFAULT_TILE_SIZE,
  DEFAULT_TILES_PER_ROW,
  RETRO_WORLD_TILE_OFFSET,
} from "./constants";

/**
 * 「합본 마을 + 레트로 월드맵」 혼합 칩셋의 타일셋 정의를 두 원본 정의에서 **조립**한다.
 *
 * 왜 스냅샷 JSON 이 아니라 조립인가: Tibo 실내 확장은 복구된 저장본이라 JSON 이 정본이지만,
 * 이 칩셋은 원본 둘이 코드 안에 살아 있다. 합본 마을 하네스(통행·레이어·그룹·라벨 교정)가
 * 바뀌면 위 반쪽도 같이 바뀌어야 하므로, 새 프로젝트를 만들 때마다 원본에서 다시 잇는다.
 *
 * 규약:
 *  · 위 480칸(0~479) = 합본 마을 그대로. ID 가 같으므로 TILE.* 상수·오토타일 기본 그룹·물
 *    애니 스트립이 그대로 맞는다.
 *  · 아래 480칸(480~959) = 레트로 월드맵. 통행·레이어·라벨은 원본 정의를 그대로 옮기고,
 *    타일 번호를 담는 필드(그룹 tileIds·오토타일 멤버/변형표)는 RETRO_WORLD_TILE_OFFSET 만큼 민다.
 *  · kind 는 "custom" — 480칸 규격 판정(isStandard480Tileset)에 걸리지 않게 하고, 그림판은
 *    Tibo 확장과 같은 확장 시트 경로를 탄다.
 *
 * 이 타일셋은 isCombinedTownTileset 이 아니다. 마을 시공(author_village·유기 호수 등)은 합본
 * 마을 전용 판정을 유지하며, 여기서는 붓·채우기·오토타일·맵 생성(settlement 프로필)만 기대한다.
 */
export function composeCombinedTownRetroWorldTileset(town: TilesetDef, retroWorld: TilesetDef): TilesetDef {
  assertStandardSheet(town, "합본 마을");
  assertStandardSheet(retroWorld, "레트로 월드맵");
  const offset = RETRO_WORLD_TILE_OFFSET;
  const tileset: TilesetDef = {
    id: COMBINED_TOWN_RETRO_WORLD_TILESET_ID,
    name: COMBINED_TOWN_RETRO_WORLD_NAME,
    image: bundledAssetRef(COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY),
    kind: "custom",
    tileSize: DEFAULT_TILE_SIZE,
    tilesPerRow: DEFAULT_TILES_PER_ROW,
    count: COMBINED_TOWN_RETRO_WORLD_TILE_COUNT,
    passability: [...clone(town.passability), ...clone(retroWorld.passability)],
    priority: [...town.priority, ...retroWorld.priority],
    terrain: [...town.terrain, ...retroWorld.terrain],
    tileMeta: [...paddedTileMeta(town), ...paddedTileMeta(retroWorld)],
    tileGroups: [
      ...clone(town.tileGroups ?? []),
      ...(retroWorld.tileGroups ?? []).map((group) => offsetTileGroup(group, offset)),
    ],
    // 기본 칩셋은 내장 오토타일(흙길·모래·자갈…)을 런타임 폴백으로 받지만 이 타일셋은 그 판정
    // 밖이다 — 위 반쪽이 같은 그림이므로 같은 그룹을 데이터로 심어 붓이 똑같이 이어지게 한다.
    autotileGroups: [
      ...autotileGroupsForTileset(town).map((group) => clone(group)),
      ...(retroWorld.autotileGroups ?? []).map((group) => offsetAutotileGroup(group, offset)),
    ],
  };
  if (town.palettePresets) tileset.palettePresets = clone(town.palettePresets);
  if (town.structureKits) tileset.structureKits = clone(town.structureKits);
  return tileset;
}

export function isCombinedTownRetroWorldTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY;
}

/** 이 타일셋 안에서 합본 마을 반쪽(ID 불변 구간)에 속하는 타일인가. */
export function isCombinedTownHalfTile(tile: number): boolean {
  return tile >= 0 && tile < RETRO_WORLD_TILE_OFFSET;
}

function assertStandardSheet(tileset: TilesetDef, label: string): void {
  if (tileset.count !== DEFAULT_TILE_COUNT || tileset.passability.length !== DEFAULT_TILE_COUNT
    || tileset.priority.length !== DEFAULT_TILE_COUNT || tileset.terrain.length !== DEFAULT_TILE_COUNT) {
    throw new Error(`${label} 타일셋이 480칸 규격이 아닙니다(count=${tileset.count}) — 혼합 칩셋을 조립할 수 없습니다.`);
  }
}

function paddedTileMeta(tileset: TilesetDef): TileAiMetadata[] {
  const meta = clone(tileset.tileMeta ?? []);
  while (meta.length < tileset.count) meta.push({ label: "", description: "", source: "unknown" });
  return meta.slice(0, tileset.count);
}

function offsetTileGroup(group: TileGroupMetadata, offset: number): TileGroupMetadata {
  const next = clone(group);
  next.tileIds = next.tileIds.map((tile) => tile + offset);
  if (next.previewMap) {
    next.previewMap.lowerTiles = next.previewMap.lowerTiles.map((tile) => (tile < 0 ? tile : tile + offset));
    next.previewMap.upperTiles = next.previewMap.upperTiles.map((tile) => (tile < 0 ? tile : tile + offset));
  }
  // 원본 시트 좌표(sourceRect/sourceBlocks)는 다른 시트의 자리이므로 옮기지 않고 비운다.
  delete next.sourceRect;
  delete next.sourceBlocks;
  return next;
}

function offsetAutotileGroup(group: AutotileGroup, offset: number): AutotileGroup {
  const shift = (tiles: number[] | undefined): number[] | undefined => tiles?.map((tile) => tile + offset);
  return {
    ...group,
    memberTileIds: shift(group.memberTileIds) ?? [],
    connectTileIds: shift(group.connectTileIds),
    triggerTileIds: shift(group.triggerTileIds),
    variantMap: Object.fromEntries(Object.entries(group.variantMap).map(([mask, tile]) => [mask, tile + offset])),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
