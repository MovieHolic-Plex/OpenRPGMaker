import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleHistoryHotkey, isTextEditingFocus } from "@/editor/hotkeys";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit, getMapEditHistoryEntries, getMapEditRedoEntries, recordProjectSnapshot, redoMapEdit, redoToHistoryIndex, pendingHistoryLabels, recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";
import { deleteMap, deleteMapsInOrder, duplicateMap, resizeMap, setStartPos } from "@/editor/actions";
import type { GameMap, MapId } from "@/project/types";
import { addEvent } from "@/editor/eventActions";
import { applyMapEdgeDrag, NO_MAP_EDGE_SIDES } from "@/editor/mapEdgeGrow";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { paintRelief } from "@/editor/tileActions";
import { isolateTimers } from "./mergedTeardown";

describe("hotkeysTextEditingFocus", () => {
  isolateTimers();
  // P11-C: isTextEditingFocus 가 INPUT 이면 무조건 true 를 반환해 체크박스 토글 직후
  // Ctrl+Z 가 씹히던 결함 회귀 방지. 텍스트형 input 만 브라우저 텍스트 undo 에 양보한다.
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function inputTarget(type: string | null): FakeElement {
    const input = new FakeElement("input");
    if (type !== null) input.setAttribute("type", type);
    return input;
  }
  function ctrlZ(target: unknown): { event: KeyboardEvent; prevented: () => boolean } {
    let prevented = false;
    const event = {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent;
    return { event, prevented: () => prevented };
  }
  describe("isTextEditingFocus input type discrimination (P11-C)", () => {
    it("treats checkbox/radio/range/button-like inputs as NOT text editing", () => {
      for (const type of ["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image", "hidden"]) {
        const { event } = ctrlZ(inputTarget(type));
        expect(isTextEditingFocus(event), `type=${type}`).toBe(false);
      }
    });

    it("keeps text-like inputs, textarea, select and contentEditable as text editing", () => {
      for (const type of ["text", "number", "search", "password", "email", "url", "tel"]) {
        const { event } = ctrlZ(inputTarget(type));
        expect(isTextEditingFocus(event), `type=${type}`).toBe(true);
      }
      // type 속성이 없는 input 은 브라우저 기본이 text — 텍스트 편집으로 취급.
      expect(isTextEditingFocus(ctrlZ(inputTarget(null)).event)).toBe(true);
      expect(isTextEditingFocus(ctrlZ(new FakeElement("textarea")).event)).toBe(true);
      expect(isTextEditingFocus(ctrlZ(new FakeElement("select")).event)).toBe(true);
      const editable = new FakeElement("div");
      editable.isContentEditable = true;
      expect(isTextEditingFocus(ctrlZ(editable).event)).toBe(true);
    });
  });
  describe("handleHistoryHotkey with non-text focus (P11-C)", () => {
    it("processes Ctrl+Z when a checkbox has focus (preventDefault called)", () => {
      const { event, prevented } = ctrlZ(inputTarget("checkbox"));
      handleHistoryHotkey(event);
      expect(prevented()).toBe(true);
    });

    it("still yields to browser text undo when a text input has focus", () => {
      const { event, prevented } = ctrlZ(inputTarget("text"));
      expect(handleHistoryHotkey(event)).toBe(false);
      expect(prevented()).toBe(false);
    });
  });
});

// 맵 삭제 확인창은 "삭제 후 Ctrl+Z로 되돌릴 수 있습니다"(mapDeleteConfirm.ts:31)와
// "한 번의 실행 취소로 이 묶음 삭제를 되돌릴 수 있습니다"(:39)를 사용자에게 인쇄한다.
// 그 약속이 참이려면 삭제 경로 자체가 되돌리기 스냅샷을 남겨야 한다.
//
// 회귀 배경: deleteMap / deleteMapsInOrder 는 recordProjectSnapshot 없이 store.update 만
// 호출했다. 그래서 확인창이 보장한 Ctrl+Z 는 무관한 이전 편집을 되돌렸고, 삭제된 맵과
// 그 이벤트는 복구되지 않았다. 이 파일이 그 계약을 잠근다.
describe("mapDeleteUndo", () => {
  isolateTimers();
  beforeEach(() => {
    vi.unstubAllGlobals();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  function anyMap(): GameMap {
    const map = Object.values(store.getCurrent().maps)[0];
    if (!map) throw new Error("테스트 픽스처에 맵이 없습니다");
    return map;
  }
  /** 복제본을 만들어 삭제 대상(비시작 맵)을 확보한다. 삭제 전 히스토리는 비운다. */
  function spareMaps(count: number): readonly MapId[] {
    const source = anyMap().id;
    const created: MapId[] = [];
    for (let index = 0; index < count; index += 1) created.push(duplicateMap(source));
    resetMapEditHistory();
    return created;
  }
  describe("맵 삭제는 확인창이 약속한 되돌리기를 실제로 제공한다", () => {
    it("삭제한 맵을 스냅샷 하나로 복원한다(단일 삭제)", () => {
      const [spare] = spareMaps(1);
      if (!spare) throw new Error("복제 맵을 만들지 못했습니다");
      const before = structuredClone(store.getCurrent().maps[spare]);
      expect(before).toBeTruthy();
      expect(getMapEditHistoryState().canUndo).toBe(false);

      const result = deleteMap(spare);
      expect(result.ok).toBe(true);
      expect(store.getCurrent().maps[spare]).toBeUndefined();

      expect(getMapEditHistoryState().canUndo).toBe(true);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[spare]).toEqual(before);
    });

    it("묶음 삭제를 실행 취소 '한 번'으로 복원한다(재귀 삭제 문구의 약속)", () => {
      const spares = spareMaps(2);
      const [first, second] = spares;
      if (!first || !second) throw new Error("복제 맵을 만들지 못했습니다");
      const beforeFirst = structuredClone(store.getCurrent().maps[first]);
      const beforeSecond = structuredClone(store.getCurrent().maps[second]);

      const result = deleteMapsInOrder(spares);
      expect(result.ok).toBe(true);
      expect(store.getCurrent().maps[first]).toBeUndefined();
      expect(store.getCurrent().maps[second]).toBeUndefined();

      // "한 번의 실행 취소로 이 묶음 삭제를" — 스냅샷은 묶음당 1건이어야 한다.
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[first]).toEqual(beforeFirst);
      expect(store.getCurrent().maps[second]).toEqual(beforeSecond);
    });

    it("차단된 삭제는 히스토리를 오염시키지 않는다", () => {
      const [spare] = spareMaps(1);
      if (!spare) throw new Error("복제 맵을 만들지 못했습니다");
      expect(deleteMap(spare).ok).toBe(true);
      resetMapEditHistory();

      const missing = "map_does_not_exist" as MapId;
      expect(deleteMap(missing).ok).toBe(false);
      expect(deleteMapsInOrder([missing]).ok).toBe(false);

      expect(getMapEditHistoryState().canUndo).toBe(false);
    });
  });
});

describe("mapEditRedoEntries", () => {
  isolateTimers();
  beforeEach(() => {
    vi.unstubAllGlobals();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  /** 라벨 붙은 편집 1회 — 스냅샷을 남기고 실제로 타일을 바꾼다(dedup 에 삼켜지지 않게). */
  function edit(label: string, tile: number): void {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot(label, mapId, { kind: "map", mapId });
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = tile;
    });
  }
  function tile(): number {
    const project = store.getCurrent();
    return project.maps[project.startMapId].lowerTiles[0];
  }
  describe("redo 스택 목록화", () => {
    it("빈 스택은 양쪽 목록이 모두 비어 있다", () => {
      expect(getMapEditHistoryEntries()).toEqual([]);
      expect(getMapEditRedoEntries()).toEqual([]);
    });

    it("되돌리기 1건은 깊이 1로 노출된다", () => {
      edit("첫 칠하기", 11);

      const entries = getMapEditHistoryEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ label: "첫 칠하기", steps: 1 });
      expect(getMapEditRedoEntries()).toEqual([]);
    });

    it("undo 한 만큼 redo 목록이 자라고, 가까운 것이 먼저·깊이는 1부터 센다", () => {
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      edit("셋째 칠하기", 33);
      expect(undoMapEdit()).toBe(true);
      expect(undoMapEdit()).toBe(true);

      const redo = getMapEditRedoEntries();
      expect(redo.map((entry) => [entry.label, entry.steps])).toEqual([
        ["둘째 칠하기", 1],
        ["셋째 칠하기", 2],
      ]);
      // redo 목록의 index 는 redoMapEdit / redoToHistoryIndex 가 쓰는 스택 좌표다.
      expect(redo.map((entry) => entry.index)).toEqual([1, 0]);
      expect(redo.every((entry) => entry.current === false)).toBe(true);
    });

    it("undo 목록의 깊이는 revert 대상 index 와 짝이 맞는다", () => {
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      edit("셋째 칠하기", 33);

      const entries = getMapEditHistoryEntries();
      expect(entries.map((entry) => [entry.label, entry.index, entry.steps])).toEqual([
        ["셋째 칠하기", 2, 1],
        ["둘째 칠하기", 1, 2],
        ["첫 칠하기", 0, 3],
      ]);
    });

    it("깊은 redo 항목 선택은 표시된 깊이만큼 앞으로 가고 undo 엔트리 하나만 남긴다", () => {
      const original = tile();
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      edit("셋째 칠하기", 33);
      undoMapEdit();
      undoMapEdit();
      undoMapEdit();
      expect(getMapEditRedoEntries()).toHaveLength(3);
      const deepest = getMapEditRedoEntries()[2];
      expect(deepest.steps).toBe(3);

      expect(redoToHistoryIndex(deepest.index)).toBe(true);

      expect(tile()).toBe(33);
      expect(getMapEditRedoEntries()).toEqual([]);
      // 3단계를 한 번에 갔으므로 되돌리기도 한 번이면 원위치다.
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(tile()).toBe(original);
    });

    it("얕은 redo 항목 선택은 그보다 깊은 항목을 redo 목록에 남긴다", () => {
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      edit("셋째 칠하기", 33);
      undoMapEdit();
      undoMapEdit();
      undoMapEdit();

      const nearest = getMapEditRedoEntries()[0];
      expect(redoToHistoryIndex(nearest.index)).toBe(true);

      expect(tile()).toBe(11);
      expect(getMapEditRedoEntries().map((entry) => entry.label)).toEqual(["둘째 칠하기", "셋째 칠하기"]);
    });

    it("범위 밖 index 는 아무것도 하지 않는다", () => {
      edit("첫 칠하기", 11);
      undoMapEdit();

      expect(redoToHistoryIndex(-1)).toBe(false);
      expect(redoToHistoryIndex(9)).toBe(false);
      expect(redoToHistoryIndex(1.5)).toBe(false);
      expect(getMapEditRedoEntries()).toHaveLength(1);
    });

    it("새 편집은 redo 목록을 비운다", () => {
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      undoMapEdit();
      expect(getMapEditRedoEntries()).toHaveLength(1);

      edit("갈라진 편집", 99);

      expect(getMapEditRedoEntries()).toEqual([]);
    });

    it("10건을 넘어도 모델은 전부 돌려준다(자르기는 표시하는 쪽의 일)", () => {
      for (let step = 1; step <= 12; step += 1) edit(`편집 ${step}`, step);
      for (let step = 1; step <= 12; step += 1) undoMapEdit();

      expect(getMapEditRedoEntries()).toHaveLength(12);
      expect(getMapEditRedoEntries()[0].label).toBe("편집 1");
      expect(getMapEditRedoEntries()[11].steps).toBe(12);
    });

    it("redoMapEdit 한 걸음과 깊이 1 선택은 같은 결과를 낸다", () => {
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      undoMapEdit();
      undoMapEdit();
      redoMapEdit();
      const afterStep = { tile: tile(), redo: getMapEditRedoEntries().map((entry) => entry.label) };

      resetMapEditHistory();
      store.replace(createBlankProject());
      edit("첫 칠하기", 11);
      edit("둘째 칠하기", 22);
      undoMapEdit();
      undoMapEdit();
      redoToHistoryIndex(getMapEditRedoEntries()[0].index);

      expect({ tile: tile(), redo: getMapEditRedoEntries().map((entry) => entry.label) }).toEqual(afterStep);
    });
  });
});

// 맵 속성 창의 크기 적용은 범위 밖 타일·레이어를 버리고 밖 이벤트를 안쪽으로 옮긴다.
// 그 전 상태를 되돌리기 스택에 남기지 않으면 Ctrl+Z 가 「되돌릴 작업이 없습니다」가 되고
// 잘린 칸은 되살릴 수 없다. 이 파일이 그 계약을 잠근다.
describe("mapResizeUndo", () => {
  isolateTimers();
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

      expect(undoMapEdit()).toBe(true);
      expect(map().width).toBe(20);
      expect(map().height).toBe(15);
      expect(store.getCurrent().startPos).toEqual({ x: 18, y: 12 });
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
});

// 지형 리뷰 F8: 높이 붓 획을 되돌리면 맵 전체 relief 를 다시 구웠다(120×120 에서 2초). 되돌리기는 붓 획과 같은 부분 갱신으로 알린다.
describe("reliefUndoPartial", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  describe("높이 되돌리기는 바뀐 칸만 알린다", () => {
    it("undo·redo 가 reliefCells 를 단 맵 변경으로 높이를 되돌린다", () => {
      const mapId = store.getCurrent().startMapId;
      recordMapEditIfChanged(mapId, () => { paintRelief(mapId, 6, 6, "raise", { radius: 2, level: 1 }); }, { label: "높이 · 높이 올리기" });
      const raised = store.getCurrent().maps[mapId]!.relief!.levels.slice();
      expect(raised.some((v) => v > 0)).toBe(true);

      const changes: ProjectChangeDescriptor[] = [];
      const unsubscribe = store.subscribe((_project, change) => { changes.push(change); });
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId]!.relief?.levels.some((v) => v > 0) ?? false).toBe(false);
      expect(redoMapEdit()).toBe(true);
      unsubscribe();

      expect(store.getCurrent().maps[mapId]!.relief!.levels).toEqual(raised);
      const reliefChanges = changes.filter((c) => c.scope === "map" && "reliefCells" in c && (c.reliefCells?.length ?? 0) > 0);
      expect(reliefChanges.length).toBe(2);
    });
  });
});
