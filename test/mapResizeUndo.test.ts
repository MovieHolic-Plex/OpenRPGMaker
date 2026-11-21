// 맵 속성 창의 크기 적용은 범위 밖 타일·레이어를 버리고 밖 이벤트를 안쪽으로 옮긴다.
// 그 전 상태를 되돌리기 스택에 남기지 않으면 Ctrl+Z 가 「되돌릴 작업이 없습니다」가 되고
// 잘린 칸은 되살릴 수 없다. 이 파일이 그 계약을 잠근다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeDom } from "./fakeDom";
import { resizeMap, setStartPos } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import { applyMapEdgeDrag, NO_MAP_EDGE_SIDES } from "@/editor/mapEdgeGrow";
import {
  getMapEditHistoryState,
  pendingHistoryLabels,
  redoMapEdit,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { createBlankProject } from "@/project/defaults";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

const CROPPED = { x: 19, y: 14 } as const;
const KEPT = { x: 2, y: 3 } as const;
const OUTSIDE_EVENT = { x: 18, y: 12 } as const;

let restoreDom = (): void => undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom();
});

function mapId(): MapId {
  return store.getCurrent().startMapId;
}

function map(): GameMap {
  const current = store.getCurrent().maps[mapId()];
  if (!current) throw new Error("시작 맵이 없습니다");
  return current;
}

function at(width: number, x: number, y: number): number {
  return y * width + x;
}

/** 잘릴 칸과 남을 칸에 타일·레이어·그림자를 찍고, 안과 밖에 이벤트를 둔다. */
function plantCroppedContent(): { readonly outsideId: string; readonly insideId: string } {
  const id = mapId();
  store.update((project) => {
    const target = project.maps[id];
    if (!target) return;
    const index = (x: number, y: number) => at(target.width, x, y);
    target.lowerTiles[index(CROPPED.x, CROPPED.y)] = 111;
    target.upperTiles[index(CROPPED.x, CROPPED.y)] = 222;
    target.lowerTiles[index(KEPT.x, KEPT.y)] = 333;
    setLayerTileAt(target, 2, index(CROPPED.x, CROPPED.y), 444);
    setLayerTileAt(target, 4, index(CROPPED.x, CROPPED.y), 555);
    setShadowAt(target, index(CROPPED.x, CROPPED.y), 0b0101);
    setLayerTileAt(target, 2, index(KEPT.x, KEPT.y), 666);
  }, { scope: "map", mapId: id });
  const outsideId = addEvent(id, OUTSIDE_EVENT.x, OUTSIDE_EVENT.y);
  const insideId = addEvent(id, 1, 1);
  if (!outsideId || !insideId) throw new Error("이벤트를 만들지 못했습니다");
  resetMapEditHistory();
  return { outsideId, insideId };
}

describe("맵 크기 변경은 잘린 칸까지 되돌린다", () => {
  it("20×15 를 8×6 으로 줄인 뒤 Ctrl+Z 가 크기·타일·레이어·이벤트·시작 위치를 되돌리고 다시 실행도 된다", () => {
    const { outsideId, insideId } = plantCroppedContent();
    const id = mapId();
    expect(map().width).toBe(20);
    expect(map().height).toBe(15);
    expect(store.getCurrent().startPos).toEqual({ x: 10, y: 8 });
    expect(getMapEditHistoryState().canUndo).toBe(false);

    resizeMap(id, 8, 6);

    const shrunk = map();
    expect(shrunk.width).toBe(8);
    expect(shrunk.height).toBe(6);
    expect(shrunk.lowerTiles).toHaveLength(48);
    expect(shrunk.lowerTiles[at(8, KEPT.x, KEPT.y)]).toBe(333);
    expect(layerTileAt(shrunk, 2, at(8, KEPT.x, KEPT.y))).toBe(666);
    expect(shrunk.events.find((event) => event.id === outsideId)).toMatchObject({ x: 7, y: 5 });
    expect(store.getCurrent().startPos).toEqual({ x: 7, y: 5 });
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(pendingHistoryLabels().undo).toBe("맵 크기 20×15 → 8×6");

    expect(undoMapEdit()).toBe(true);
    const restored = map();
    expect(restored.width).toBe(20);
    expect(restored.height).toBe(15);
    expect(restored.lowerTiles[at(20, CROPPED.x, CROPPED.y)]).toBe(111);
    expect(restored.upperTiles[at(20, CROPPED.x, CROPPED.y)]).toBe(222);
    expect(layerTileAt(restored, 2, at(20, CROPPED.x, CROPPED.y))).toBe(444);
    expect(layerTileAt(restored, 4, at(20, CROPPED.x, CROPPED.y))).toBe(555);
    expect(shadowAt(restored, at(20, CROPPED.x, CROPPED.y))).toBe(0b0101);
    expect(restored.lowerTiles[at(20, KEPT.x, KEPT.y)]).toBe(333);
    expect(layerTileAt(restored, 2, at(20, KEPT.x, KEPT.y))).toBe(666);
    expect(restored.events.find((event) => event.id === outsideId)).toMatchObject({ x: OUTSIDE_EVENT.x, y: OUTSIDE_EVENT.y });
    expect(restored.events.find((event) => event.id === insideId)).toMatchObject({ x: 1, y: 1 });
    expect(store.getCurrent().startPos).toEqual({ x: 10, y: 8 });
    expect(undoMapEdit()).toBe(false);

    expect(redoMapEdit()).toBe(true);
    expect(map().width).toBe(8);
    expect(map().height).toBe(6);
    expect(map().lowerTiles).toHaveLength(48);
    expect(map().events.find((event) => event.id === outsideId)).toMatchObject({ x: 7, y: 5 });
    expect(store.getCurrent().startPos).toEqual({ x: 7, y: 5 });
    expect(map().lowerTiles.includes(111)).toBe(false);
  });

  it("시작 위치가 새 크기 안에 남아도 잘린 타일·레이어·이벤트 위치는 맵 스냅샷으로 돌아온다", () => {
    const { outsideId } = plantCroppedContent();
    setStartPos(1, 1);
    resetMapEditHistory();
    resizeMap(mapId(), 12, 10);

    expect(map().width).toBe(12);
    expect(map().height).toBe(10);
    expect(map().events.find((event) => event.id === outsideId)).toMatchObject({ x: 11, y: 9 });
    expect(store.getCurrent().startPos).toEqual({ x: 1, y: 1 });

    expect(undoMapEdit()).toBe(true);
    expect(map().width).toBe(20);
    expect(map().height).toBe(15);
    expect(map().lowerTiles[at(20, CROPPED.x, CROPPED.y)]).toBe(111);
    expect(layerTileAt(map(), 4, at(20, CROPPED.x, CROPPED.y))).toBe(555);
    expect(shadowAt(map(), at(20, CROPPED.x, CROPPED.y))).toBe(0b0101);
    expect(map().events.find((event) => event.id === outsideId)).toMatchObject(OUTSIDE_EVENT);
    expect(store.getCurrent().startPos).toEqual({ x: 1, y: 1 });

    expect(redoMapEdit()).toBe(true);
    expect(map().width).toBe(12);
    expect(map().events.find((event) => event.id === outsideId)).toMatchObject({ x: 11, y: 9 });
  });

  it("줄인 시작 맵을 되돌린 뒤 밖 칸을 시작 위치로 두고 다시 실행해도 시작 위치는 맵 안에 남는다", () => {
    setStartPos(1, 1);
    resetMapEditHistory();
    resizeMap(mapId(), 12, 10);
    expect(undoMapEdit()).toBe(true);
    expect(map().width).toBe(20);
    setStartPos(18, 12);

    expect(redoMapEdit()).toBe(true);
    expect(map().width).toBe(12);
    expect(map().height).toBe(10);
    expect(store.getCurrent().startPos).toEqual({ x: 11, y: 9 });
  });

  it("같은 크기와 상한 밖 크기는 되돌리기 칸을 만들지 않는다", () => {
    const id = mapId();
    const before = { width: map().width, height: map().height };
    resizeMap(id, before.width, before.height);
    resizeMap(id, MAX_TOOL_MAP_DIMENSION + 1, MAX_TOOL_MAP_DIMENSION + 1);
    expect(map().width).toBe(before.width);
    expect(map().height).toBe(before.height);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    expect(undoMapEdit()).toBe(false);
  });

  it("테두리 드래그는 크기 변경을 드래그 한 단계로만 되돌린다", () => {
    const id = mapId();
    const before = map().width;
    applyMapEdgeDrag(id, NO_MAP_EDGE_SIDES, { left: 0, right: 2, up: 0, down: 0 }, "edge-drag-1");
    expect(map().width).toBe(before + 2);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(map().width).toBe(before);
    expect(undoMapEdit()).toBe(false);
  });
});
