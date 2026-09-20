import type { PassFlag, TilesetDef } from "../types";
import {
  CASTLE_REFERENCE_TILE_COUNT,
  CASTLE_REFERENCE_TILESET_ID,
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILE_SIZE,
  CASTLE_REFERENCE_TILES_PER_ROW,
} from "./constants";

/** Tileset for the pixel-faithful reference board. The original castle atlas remains the authoring set. */
export function createCastleReferenceTileset(): TilesetDef {
  const passable: PassFlag = { up: true, down: true, left: true, right: true };
  return {
    id: CASTLE_REFERENCE_TILESET_ID,
    name: "성채 참고 이미지 · 큰 돌다리 제거",
    image: { type: "bundled", id: CASTLE_REFERENCE_TILESET_TEXTURE_KEY },
    kind: "custom",
    tileSize: CASTLE_REFERENCE_TILE_SIZE,
    tilesPerRow: CASTLE_REFERENCE_TILES_PER_ROW,
    count: CASTLE_REFERENCE_TILE_COUNT,
    passability: Array.from({ length: CASTLE_REFERENCE_TILE_COUNT }, () => ({ ...passable })),
    priority: Array.from({ length: CASTLE_REFERENCE_TILE_COUNT }, () => "lower"),
    terrain: Array.from({ length: CASTLE_REFERENCE_TILE_COUNT }, () => 0),
  };
}
