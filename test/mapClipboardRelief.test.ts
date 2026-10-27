import { beforeEach, describe, expect, it } from "vitest";
import { editorState, type TileClipboard } from "@/editor/editorState";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { pasteGhostLiftSteps, pasteStampLiftField } from "@/editor/pastePreviewGhost";
import { createBlankProject } from "@/project/defaults";
import type { ReliefData } from "@/project/relief/types";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

function mapId(): MapId {
  return store.getCurrent().startMapId;
}

function currentMap(): GameMap {
  const map = store.getCurrent().maps[mapId()];
  if (!map) throw new Error("missing map");
  return map;
}

function levelAt(map: GameMap, x: number, y: number): number {
  return map.relief?.levels[y * map.width + x] ?? 0;
}

function rampAt(map: GameMap, x: number, y: number): number {
  return map.relief?.ramps?.[y * map.width + x] ?? 0;
}

function putRelief(relief: ReliefData): void {
  store.update((project) => {
    const map = project.maps[mapId()];
    if (map) map.relief = relief;
  });
}

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({
    currentMapId: null,
    tool: "select",
    layer: "lower",
    selection: null,
    clipboard: null,
  });
});

describe("영역 복사/붙여넣기 — 높이", () => {
  it("언덕·경사로·벽 장식을 붙여넣고, 한 번의 되돌리기와 다시 실행으로 돌아온다", () => {
    const id = mapId();
    const map = currentMap();
    const levels = new Array(map.width * map.height).fill(0);
    const ramps = new Array(map.width * map.height).fill(0);
    levels[1 * map.width + 2] = 3;
    ramps[1 * map.width + 2] = 1;
    levels[1 * map.width + 3] = 4;
    putRelief({
      width: map.width,
      height: map.height,
      levels,
      ramps,
      style: "dirt",
      wallDecor: [
        { x: 2, y: 1, row: 1, tile: 7 },
        { x: 0, y: 0, row: 1, tile: 9 },
      ],
    });
    resetMapEditHistory();

    selectTileRegion(id, { mapId: id, x: 2, y: 1, width: 2, height: 1 });
    expect(copySelection(id)).toBe(true);
    expect(pasteClipboard(id, 6, 4)).toBe(true);

    const pasted = currentMap();
    expect(levelAt(pasted, 6, 4)).toBe(3);
    expect(levelAt(pasted, 7, 4)).toBe(4);
    expect(rampAt(pasted, 6, 4)).toBe(1);
    expect(rampAt(pasted, 7, 4)).toBe(0);
    expect(levelAt(pasted, 2, 1)).toBe(3);
    expect(pasted.relief?.style).toBe("dirt");
    expect(pasted.relief?.wallDecor).toEqual(expect.arrayContaining([
      { x: 0, y: 0, row: 1, tile: 9 },
      { x: 6, y: 4, row: 1, tile: 7 },
    ]));
    expect(pasted.relief?.wallDecor?.some((decor) => decor.x === 2 && decor.y === 1)).toBe(true);

    expect(undoMapEdit()).toBe(true);
    const undone = currentMap();
    expect(levelAt(undone, 6, 4)).toBe(0);
    expect(rampAt(undone, 6, 4)).toBe(0);
    expect(undone.relief?.wallDecor?.some((decor) => decor.x === 6 && decor.y === 4)).toBe(false);
    expect(levelAt(undone, 2, 1)).toBe(3);

    expect(redoMapEdit()).toBe(true);
    expect(levelAt(currentMap(), 6, 4)).toBe(3);
    expect(rampAt(currentMap(), 6, 4)).toBe(1);
  });

  it("평지를 붙이거나 영역을 지우면 그 칸의 언덕만 내리고, 맵이 평지가 되면 relief 를 뺀다", () => {
    const id = mapId();
    const map = currentMap();
    const levels = new Array(map.width * map.height).fill(0);
    levels[5 * map.width + 5] = 2;
    levels[5 * map.width + 6] = 2;
    putRelief({ width: map.width, height: map.height, levels, wallDecor: [{ x: 5, y: 5, row: 1, tile: 4 }] });
    resetMapEditHistory();

    selectTileRegion(id, { mapId: id, x: 0, y: 0, width: 1, height: 1 });
    expect(copySelection(id)).toBe(true);
    expect(editorState.get().clipboard?.relief?.levels).toEqual([0]);
    expect(pasteClipboard(id, 5, 5)).toBe(true);

    const flattened = currentMap();
    expect(levelAt(flattened, 5, 5)).toBe(0);
    expect(levelAt(flattened, 6, 5)).toBe(2);
    expect(flattened.relief?.wallDecor?.some((decor) => decor.x === 5) ?? false).toBe(false);

    selectTileRegion(id, { mapId: id, x: 6, y: 5, width: 1, height: 1 });
    expect(clearSelectionRegion(id)).toBe(true);
    expect(currentMap().relief).toBeUndefined();
  });

  it("높이가 없는 옛 클립보드는 목적지 언덕을 그대로 둔다", () => {
    const id = mapId();
    const map = currentMap();
    const levels = new Array(map.width * map.height).fill(0);
    levels[4 * map.width + 4] = 2;
    putRelief({ width: map.width, height: map.height, levels });
    const legacy: TileClipboard = {
      width: 1,
      height: 1,
      lower: { tiles: [map.lowerTiles[0] ?? 0], stacks: [[]] },
      upper: { tiles: [-1], stacks: [[]] },
    };
    editorState.set({ clipboard: legacy });
    expect(pasteClipboard(id, 4, 4)).toBe(true);
    expect(levelAt(currentMap(), 4, 4)).toBe(2);
  });

  it("붙여넣기 고스트는 스탬프 높이로 들리고, 평지 스탬프는 땅바닥에 둔다", () => {
    const raised: TileClipboard = {
      width: 3,
      height: 3,
      lower: { tiles: Array(9).fill(1), stacks: Array.from({ length: 9 }, () => []) },
      upper: { tiles: Array(9).fill(-1), stacks: Array.from({ length: 9 }, () => []) },
      relief: { levels: Array(9).fill(3) },
    };
    const field = pasteStampLiftField(raised);
    expect(field).not.toBeNull();
    // 렌더가 그리는 들림이다. 한 줄짜리 능선은 깎여 0이 되므로, 살아남는 고원의 가운데를 본다.
    expect(pasteGhostLiftSteps(field, 1, 1)).toBe(3);
    expect(pasteStampLiftField(raised)).toBe(field);

    const flat: TileClipboard = {
      width: 1,
      height: 1,
      lower: { tiles: [1], stacks: [[]] },
      upper: { tiles: [-1], stacks: [[]] },
      relief: { levels: [0] },
    };
    expect(pasteStampLiftField(flat)).toBeNull();
    expect(pasteGhostLiftSteps(null, 0, 0)).toBe(0);

    const legacy: TileClipboard = {
      width: 1,
      height: 1,
      lower: { tiles: [1], stacks: [[]] },
      upper: { tiles: [-1], stacks: [[]] },
    };
    expect(pasteStampLiftField(legacy)).toBeNull();
  });
});
