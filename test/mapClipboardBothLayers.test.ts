import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { paintTile } from "@/editor/tileActions";
import { createBlankProject, TILE } from "@/project/defaults";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";
// TILE.* / 263·319·85·378 are combined-town chip ids; new projects start on beodeul_city since the 2026-10-07 copyright purge.
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

// 영역 복사/붙여넣기는 하위+상위 레이어를 통째로 옮겨야 한다(RM2K3 관례).
// 이전에는 현재 편집 레이어 하나만 복사되어 건물(하위 벽 + 상위 지붕) 같은
// 다층 구조가 반쪽만 복제되는 문제가 있었다.

function currentMap(): GameMap {
  const project = store.getCurrent();
  return project.maps[project.startMapId];
}

function lowerAt(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  return topTileInStack(map, "lower", i) ?? map.lowerTiles[i];
}

function upperAt(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  return topTileInStack(map, "upper", i) ?? map.upperTiles[i];
}

function startMapId(): MapId {
  return store.getCurrent().startMapId;
}

beforeEach(() => {
  store.replace(startOnRetiredCombinedTown(createBlankProject()));
  editorState.set({
    currentMapId: null,
    tool: "select",
    layer: "lower",
    selection: null,
    clipboard: null,
  });
});

describe("영역 복사/붙여넣기 — 두 레이어 통째로", () => {
  it("하위+상위 레이어가 함께 복사되어 붙여넣기된다", () => {
    const mapId = startMapId();
    // 원본 2x2: 하위 = 물/잔디, 상위 = 꽃/빈칸.
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    paintTile(mapId, "lower", 2, 1, TILE.GRASS);
    paintTile(mapId, "upper", 1, 1, TILE.FLOWERS);
    paintTile(mapId, "lower", 1, 2, TILE.GRASS);
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);

    selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 2, height: 2 });
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 5, 5)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 5, 5)).toBe(TILE.WATER);
    expect(upperAt(map, 5, 5)).toBe(TILE.FLOWERS);
    expect(lowerAt(map, 6, 5)).toBe(TILE.GRASS);
    expect(lowerAt(map, 5, 6)).toBe(TILE.GRASS);
    expect(lowerAt(map, 6, 6)).toBe(TILE.GRASS);
  });

  it("현재 편집 레이어와 무관하게 항상 두 레이어를 복사한다", () => {
    const mapId = startMapId();
    paintTile(mapId, "lower", 3, 3, TILE.WATER);
    paintTile(mapId, "upper", 3, 3, TILE.FLOWERS);

    // 상위 레이어 편집 모드에서 복사해도 하위 레이어까지 함께 담긴다.
    editorState.set({ layer: "upper" });
    selectTileRegion(mapId, { mapId, x: 3, y: 3, width: 1, height: 1 });
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 7, 7)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 7, 7)).toBe(TILE.WATER);
    expect(upperAt(map, 7, 7)).toBe(TILE.FLOWERS);
  });

  it("스택 소품(울타리)도 붙여넣기에서 함께 복원된다", () => {
    const mapId = startMapId();
    paintTile(mapId, "lower", 4, 4, TILE.GRASS);
    // 울타리는 stackable 소품 — 상위 레이어 스택에 쌓인다.
    paintTile(mapId, "lower", 4, 4, 378);

    selectTileRegion(mapId, { mapId, x: 4, y: 4, width: 1, height: 1 });
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 8, 8)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 8, 8)).toBe(TILE.GRASS);
    expect(upperAt(map, 8, 8)).toBe(378);
  });

  it("붙여넣기는 대상 영역의 두 레이어를 원본 상태로 덮어쓴다", () => {
    const mapId = startMapId();
    // 원본: 하위 잔디만, 상위 빈칸.
    paintTile(mapId, "lower", 1, 1, TILE.GRASS);
    // 대상: 상위에 꽃이 있던 자리 — 붙여넣기 후 원본의 빈 상위가 반영되어 지워져야 한다.
    paintTile(mapId, "upper", 9, 9, TILE.FLOWERS);

    selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 1, height: 1 });
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 9, 9)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 9, 9)).toBe(TILE.GRASS);
    expect(upperAt(map, 9, 9)).toBe(TILE.EMPTY);
  });
});

describe("보호(잠금) 칸 — 붙여넣기·영역 지우기도 못 바꾼다", () => {
  function lockCells(mapId: MapId, cells: readonly (readonly [number, number])[]): void {
    store.update((project) => {
      const map = project.maps[mapId]!;
      map.terrainDesign = { ...(map.terrainDesign ?? {}), lockedCells: cells.map(([x, y]) => y * map.width + x) };
    });
  }

  it("붙여넣기는 보호 칸을 건너뛰고 나머지 칸만 바꾼다", () => {
    const mapId = startMapId();
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    paintTile(mapId, "lower", 2, 1, TILE.WATER);
    paintTile(mapId, "lower", 5, 5, TILE.GRASS);
    paintTile(mapId, "lower", 6, 5, TILE.GRASS);
    lockCells(mapId, [[5, 5]]);
    const locked = lowerAt(currentMap(), 5, 5);
    const source = lowerAt(currentMap(), 2, 1);
    expect(locked).not.toBe(source);

    selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 2, height: 1 });
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 5, 5)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 5, 5)).toBe(locked);
    expect(lowerAt(map, 6, 5)).toBe(source);
  });

  it("영역 지우기는 보호 칸을 남기고 나머지 칸만 비운다", () => {
    const mapId = startMapId();
    paintTile(mapId, "lower", 3, 3, TILE.WATER);
    paintTile(mapId, "lower", 4, 3, TILE.WATER);
    lockCells(mapId, [[3, 3]]);
    const locked = lowerAt(currentMap(), 3, 3);
    expect(locked).not.toBe(TILE.EMPTY);

    selectTileRegion(mapId, { mapId, x: 3, y: 3, width: 2, height: 1 });
    expect(clearSelectionRegion(mapId)).toBe(true);

    const map = currentMap();
    expect(lowerAt(map, 3, 3)).toBe(locked);
    expect(lowerAt(map, 4, 3)).toBe(TILE.EMPTY);
  });
});
