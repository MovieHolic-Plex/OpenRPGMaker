// 맵 배경이 플레이에서 실제로 비칠 칸 — 렌더러 `playSceneMapRuntime.renderEmptyCellCover` 와 같은 판정.
//
// 편집기 배경 탭의 「지금 N칸에 보입니다 / 한 칸도 안 보입니다」 줄과 조수 도구의 0칸 경고가 같은 함수를 본다.
// 창 타일(#233·#258)은 합본 마을 칩셋에서만 투명하다 — 다른 칩셋의 같은 번호는 보통 그림이라 세지 않는다.

import { isPanoramaWindowTile } from "@/project/defaults/chipsetMapping";
import { isCombinedTownCompatibleTileset } from "@/project/tilesetHarness/combinedTown";
import type { GameMap, TilesetDef } from "@/project/types";

export type MapBackgroundVisibility = {
  /** 배경이 비칠 칸 수. */
  readonly visible: number;
  /** 하층이 빈 칸 수(빈 칸에도 보이기를 켜면 비칠 칸). */
  readonly empty: number;
  /** 맵 칸 수. */
  readonly total: number;
};

/** 칸 하나(행 우선 인덱스)에 배경이 비치는가. 편집기 게임 화면 미리보기가 덮인 칸을 어둡게 칠할 때 쓴다. */
export function mapBackgroundCellVisible(
  map: Pick<GameMap, "lowerTiles" | "upperTiles" | "background">,
  tileset?: Pick<TilesetDef, "image">,
): (index: number) => boolean {
  const showEmpty = map.background?.showInEmptyCells === true;
  const windows = tileset ? isCombinedTownCompatibleTileset(tileset) : true;
  return (index) => {
    const lower = map.lowerTiles[index] ?? -1;
    const upper = map.upperTiles[index] ?? -1;
    if (windows && (isPanoramaWindowTile(lower) || (lower < 0 && isPanoramaWindowTile(upper)))) return true;
    return showEmpty && lower < 0;
  };
}

export function mapBackgroundVisibility(
  map: Pick<GameMap, "lowerTiles" | "upperTiles" | "background">,
  tileset?: Pick<TilesetDef, "image">,
): MapBackgroundVisibility {
  const cellVisible = mapBackgroundCellVisible(map, tileset);
  let visible = 0;
  let empty = 0;
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    if ((map.lowerTiles[index] ?? -1) < 0) empty += 1;
    if (cellVisible(index)) visible += 1;
  }
  return { visible, empty, total: map.lowerTiles.length };
}
