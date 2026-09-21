import type { PassFlag, TilesetDef } from "../types";
import {
  SLATES_32_FRAME_COUNT,
  SLATES_32_TEXTURE_KEY,
  SLATES_32_TILES_PER_ROW,
  SLATES_32_TILE_SIZE,
} from "@/assets/bundled";

/**
 * Slates 32×32px orthogonal tileset (Ivan Voirol, CC-BY 4.0).
 *
 * 16px 규격이 아닌 **첫 번들 칩셋**이다. 그래서 다른 번들 칩셋과 달리
 * `tileSize: 32` · `tilesPerRow: 56` 을 자기 정의에 들고 있고, 프레임 등록도 이 기하로 한다
 * (`bundledChipsetTileSize`/`bundledChipsetTilesPerRow`). 셋이 어긋나면 팔레트가 엉뚱한
 * 조각을 보여주고 캔버스가 반 칸씩 밀린다.
 *
 * 통행/레이어는 시트를 보고 판정하지 않는다 — 이 시트에는 저작된 메타데이터가 없으므로
 * **전부 통행 가능·하위**로 시작하고, 저작자가 칠하면서 정한다. 자동으로 '벽일 것' 이라고
 * 추정해 통행을 막으면 게임이 걸어다닐 수 없는 맵이 조용히 만들어진다.
 */
export const SLATES_32_ID = "slates_32";
export const SLATES_32_NAME = "Slates 32px · Ivan Voirol (CC-BY 4.0)";

function passable(): PassFlag {
  return { up: true, down: true, left: true, right: true };
}

export function createSlates32Tileset(): TilesetDef {
  const count = SLATES_32_FRAME_COUNT;
  return {
    id: SLATES_32_ID,
    name: SLATES_32_NAME,
    image: { type: "bundled", id: SLATES_32_TEXTURE_KEY },
    kind: "custom",
    tileSize: SLATES_32_TILE_SIZE,
    tilesPerRow: SLATES_32_TILES_PER_ROW,
    count,
    passability: Array.from({ length: count }, passable),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    tileMeta: Array.from({ length: count }, () => ({ label: "", description: "", source: "unknown" as const })),
    tileGroups: [],
  };
}
