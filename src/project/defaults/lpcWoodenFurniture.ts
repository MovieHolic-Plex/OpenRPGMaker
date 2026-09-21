import type { PassFlag, TileAiMetadata, TilesetDef } from "../types";
import {
  LPC_WOODEN_FURNITURE_TILESET_ID,
  LPC_WOODEN_FURNITURE_TILESET_NAME,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_TILE_COUNT,
} from "./constants";

/**
 * [LPC] Wooden Furniture (bluecarrot16, Sharm, Reemax 외 · CC-BY-SA 3.0 / GPL 3.0).
 *
 * LPC 표준 32×32px 타일 시트(512×1024, 16열×32행 = 512칸)다. 이 시트에는 RM2K 오토타일이나
 * 물 애니메이션이 없으므로 16px RM2K 애니 스트립 인덱스가 의미를 갖지 않는다 — 성채 칩셋과
 * 같은 `kind: "custom"` 으로 등록해 스트립 등록을 건너뛴다.
 *
 * 통행/레이어는 Slates 32px와 같은 계약(전부 통행 가능·하위)으로 시작한다. 자동으로 "가구는
 * 막힘"이라 추정하면 저작자가 칠할 수 없는 맵이 조용히 만들어진다. 칸 단위 조정과 검토는
 * 타일 메타데이터 도구의 몫이다. 시트는 16px 열 구분선 하나 없는 무구분 아틀라스라
 * 팔레트도 원본 열 배열 그대로 보여준다(tilePaletteGrid source-layout 규약).
 */
export function createLpcWoodenFurnitureTileset(): TilesetDef {
  const count = LPC_WOODEN_FURNITURE_TILE_COUNT;
  const passable: PassFlag = { up: true, down: true, left: true, right: true };
  const tileMeta: TileAiMetadata[] = Array.from({ length: count }, () => ({
    label: "",
    description: "",
    source: "unknown" as const,
  }));
  return {
    id: LPC_WOODEN_FURNITURE_TILESET_ID,
    name: LPC_WOODEN_FURNITURE_TILESET_NAME,
    image: { type: "bundled", id: LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY },
    kind: "custom",
    tileSize: LPC_WOODEN_FURNITURE_TILE_SIZE,
    tilesPerRow: LPC_WOODEN_FURNITURE_TILES_PER_ROW,
    count,
    passability: Array.from({ length: count }, () => ({ ...passable })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    tileMeta,
    tileGroups: [],
  };
}
