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

/**
 * 칸 하나를 배경 자리로 비운다 — 모든 타일 층·덧칠 더미·그림자까지. 더미(`*TileStacks`)를 남기면 충돌·렌더가
 * 그 칸을 여전히 막힌 칸으로 본다(2026-10-21 적대 검수). 편집기 「윗줄 비우기」 와 조수 clearForBackground 가 같이 쓴다.
 */
export function clearMapCellForBackground(map: GameMap, index: number): void {
  map.lowerTiles[index] = -1;
  map.upperTiles[index] = -1;
  if (map.lowerOverlayTiles) map.lowerOverlayTiles[index] = -1;
  if (map.upperOverlayTiles) map.upperOverlayTiles[index] = -1;
  if (map.shadowBits) map.shadowBits[index] = 0;
  if (map.lowerTileStacks) delete map.lowerTileStacks[index];
  if (map.upperTileStacks) delete map.upperTileStacks[index];
}

/** 맵 위쪽에서부터 칸이 전부 빈 줄의 수. 지평선 견본은 7줄쯤 비어야 해·구름·실루엣이 보인다. */
export function emptyTopRows(map: Pick<GameMap, "width" | "height" | "lowerTiles">): number {
  let rows = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) if ((map.lowerTiles[y * map.width + x] ?? -1) >= 0) return rows;
    rows += 1;
  }
  return rows;
}

/** 지평선 견본의 볼거리(해·구름·실루엣)가 들어 있는 화면 위쪽 높이(논리 px). 그림 생성기와 같은 값. */
export const HORIZON_PRESET_FEATURE_HEIGHT = 112;
