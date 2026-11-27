import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleHistoryHotkey, isTextEditingFocus } from "@/editor/hotkeys";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit, getMapEditHistoryEntries, getMapEditRedoEntries, recordProjectSnapshot, redoMapEdit, redoToHistoryIndex, pendingHistoryLabels, recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";
import { deleteMap, deleteMapsInOrder, duplicateMap, resizeMap, setStartPos, addChildMap, addMap, createMapFromSpec } from "@/editor/actions";
import type { GameMap, MapId } from "@/project/types";
import { addEvent } from "@/editor/eventActions";
import { applyMapEdgeDrag, NO_MAP_EDGE_SIDES } from "@/editor/mapEdgeGrow";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { paintRelief } from "@/editor/tileActions";
import { isolateTimers } from "./mergedTeardown";
import { selectEditorMap } from "@/editor/mapSelection";
import { editorState } from "@/editor/editorState";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankMap } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import { deserialize, serialize } from "@/project/io";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { computeMapViewport, formatViewportContextBlock, mapRegionForContext, mapRegionImagePayload } from "@/ai/mapViewportContext";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { defaultAiConfig } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

describe("mapEditHistory", () => {
  isolateTimers();
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
});

// OPRN-OUT-018 — 지원 상한을 "생성/크기변경 전 경로 + lint" 한 곳으로 맞춘다.
//
// 실측 결함: create_map·resize_map·generate_map·author_village 는 257을 거부했는데
// build_world 만 상한이 없어 257×257 셀 배열을 실제로 할당했고(라이브 재현: 제안 생성은
// 성공, 이어진 검토가 입력 크기 HTTP 400 으로 실패), projectLint 는 그 맵을 warning 으로만
// 보고해 "지원하지 않는데 존재하는" 상태가 그대로 남았다.
//
// 경계는 항상 짝으로 본다 — 현재 1024는 통과, 1025는 할당 전에 거부.
describe("mapSizeGuard", () => {
  isolateTimers();
  const OVER = MAX_TOOL_MAP_DIMENSION + 1;
  function ctx(): ToolContext {
    return { project: withRetiredEasyRpgTilesets(createBlankProject()) };
  }
  /** 거부 메시지는 상한과 회복 수단(맵 분할 + transfer 연결)을 함께 말해야 한다. */
  function expectRejection(summary: string): void {
    expect(summary).toContain(`최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}`);
    expect(summary).toContain("여러 맵");
    expect(summary).toContain("transfer");
  }
  describe("build_world 맵 크기 상한", () => {
    it(`${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION} 노드는 만든다`, () => {
      const context = ctx();
      const result = runTool(context, "build_world", {
        plan: {
          nodes: [{ mapId: "map_world_max", role: "field", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION }],
          edges: [],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.maps.map_world_max?.width).toBe(MAX_TOOL_MAP_DIMENSION);
    });

    it(`${OVER}×${OVER} 노드는 셀 할당 전에 거부한다`, () => {
      const context = ctx();
      const result = runTool(context, "build_world", {
        plan: {
          nodes: [{ mapId: "map_world_over", role: "field", width: OVER, height: OVER }],
          edges: [],
        },
      });
      expect(result.ok).toBe(false);
      expectRejection(result.summary);
      expect(context.project.maps.map_world_over).toBeUndefined();
    });

    it("size:{w,h} 별칭으로 우회할 수 없다", () => {
      const context = ctx();
      const result = runTool(context, "build_world", {
        plan: {
          nodes: [{ mapId: "map_world_alias", role: "town", size: { w: OVER, h: 40 } }],
          edges: [],
        },
      });
      expect(result.ok).toBe(false);
      expectRejection(result.summary);
      expect(context.project.maps.map_world_alias).toBeUndefined();
    });

    it("초대형 노드 하나가 섞이면 같은 요청의 정상 노드도 만들지 않는다", () => {
      const context = ctx();
      const result = runTool(context, "build_world", {
        plan: {
          nodes: [
            { mapId: "map_world_ok", role: "town", width: 30, height: 30 },
            { mapId: "map_world_bad", role: "dungeon", width: OVER, height: 30 },
          ],
          edges: [],
        },
      });
      expect(result.ok).toBe(false);
      expect(context.project.maps.map_world_ok).toBeUndefined();
      expect(context.project.maps.map_world_bad).toBeUndefined();
    });
  });
  describe("plan_world 크기 힌트 상한", () => {
    it("build_world 가 그대로 읽는 초대형 힌트는 계획 단계에서 거부한다", () => {
      const context = ctx();
      const result = runTool(context, "plan_world", {
        nodes: [{ mapId: "map_plan_over", role: "field", width: OVER, height: OVER }],
        edges: [],
      });
      expect(result.ok).toBe(false);
      expectRejection(result.summary);
      expect(context.project.worldGraph?.nodes.some((node) => node.mapId === "map_plan_over")).not.toBe(true);
    });

    it(`${MAX_TOOL_MAP_DIMENSION} 힌트는 계획으로 등록한다`, () => {
      const context = ctx();
      const result = runTool(context, "plan_world", {
        nodes: [{ mapId: "map_plan_max", role: "field", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION }],
        edges: [],
      });
      expect(result.ok, result.summary).toBe(true);
    });
  });
  describe("나머지 조수 생성/크기변경 경로", () => {
    it.each([{ size: 512 }, { size: 1024 }])('official $size×$size maps retain the edge cells through export and reload', ({ size }) => {
      const context = ctx();
      const created = runTool(context, 'create_map', { name: `${size} 경계`, width: size, height: size, id: 'map_edge' });
      expect(created.ok, created.summary).toBe(true);
      const map = context.project.maps.map_edge!;
      expect(map.lowerTiles).toHaveLength(size * size);
      const edgeTile = map.lowerTiles[0] === 0 ? 1 : 0;
      map.lowerTiles[size * size - 1] = edgeTile;
      map.upperTiles[size * size - 1] = edgeTile;
      map.lowerOverlayTiles = new Array(size * size).fill(-1);
      map.upperOverlayTiles = new Array(size * size).fill(-1);
      map.shadowBits = new Array(size * size).fill(0);
      map.lowerOverlayTiles[size * size - 1] = edgeTile;
      map.upperOverlayTiles[size * size - 1] = edgeTile;
      map.shadowBits[size * size - 1] = 15;
      const restored = deserialize(serialize(context.project)).maps.map_edge!;
      expect([restored.width, restored.height]).toEqual([size, size]);
      for (const layer of [restored.lowerTiles, restored.upperTiles, restored.lowerOverlayTiles, restored.upperOverlayTiles]) {
        expect(layer).toHaveLength(size * size);
        expect(layer![size * size - 1]).toBe(edgeTile);
      }
      expect(restored.shadowBits).toHaveLength(size * size);
      expect(restored.shadowBits![size * size - 1]).toBe(15);
      expect(projectLint(context.project).filter(issue => issue.code === 'map-size')).toEqual([]);
    });
    it.each([
      ["create_map", { name: "경계", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION, id: "map_edge" }, true],
      ["create_map", { name: "초과", width: OVER, height: OVER, id: "map_edge" }, false],
      ["generate_map", { theme: "forest", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION, id: "map_edge" }, true],
      ["generate_map", { theme: "forest", width: OVER, height: OVER, id: "map_edge" }, false],
    ] as const)("%s %o → ok:%s", (tool, args, ok) => {
      const context = ctx();
      const result = runTool(context, tool, { ...args,
        // 2026-10-07 정리 뒤 generate_map 프로필은 Scarloxy 만 남았다(mapGenerationProfiles.ts) — 합본 마을은 unsupported-tileset.
        ...(tool === 'generate_map' ? { tilesetId: 'scarloxy_chipset_grassland' } : {}) });
      expect(result.ok, result.summary).toBe(ok);
      if (!ok) {
        expectRejection(result.summary);
        expect(context.project.maps.map_edge).toBeUndefined();
      }
    });

    it("resize_map 은 지원 상한까지 늘리고 초과는 거부한다", () => {
      const context = ctx();
      expect(runTool(context, "create_map", { name: "확장", width: 12, height: 12, id: "map_resize" }).ok).toBe(true);
      const grown = runTool(context, "resize_map", { mapId: "map_resize", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION });
      expect(grown.ok, grown.summary).toBe(true);
      const over = runTool(context, "resize_map", { mapId: "map_resize", width: OVER, height: MAX_TOOL_MAP_DIMENSION });
      expect(over.ok).toBe(false);
      expectRejection(over.summary);
      expect(context.project.maps.map_resize?.width).toBe(MAX_TOOL_MAP_DIMENSION);
    });

    // start_dungeon_room_session / start_interior_room_session cases retired: both tools were removed before the public baseline (2026-10-09).

    // author_village case retired: the tool was removed on purpose (CONSTRUCTION_WRITE_SUPERSEDED in src/editor/tools/toolRegistry.ts).

    it("build_village/build_castle 은 상한을 넘는 맵을 만들지 않는다", () => {
      const context = ctx();
      const village = runTool(context, "build_village", { name: "큰 마을", width: OVER, height: OVER, seed: 7 });
      if (village.ok) {
        for (const map of Object.values(context.project.maps)) {
          expect(map.width).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
          expect(map.height).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
        }
      }
    });
  });
  describe("사람 생성/크기변경 경로", () => {
    const withDom = <T>(run: () => T): T => {
      const restore = installFakeDom();
      try {
        return run();
      } finally {
        restore();
      }
    };

    it("addMap 은 초대형 요청으로 맵을 만들지 않는다", () => {
      withDom(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        const id = addMap("초대형", OVER, OVER);
        expect(id).toBe("");
        expect(Object.values(store.getCurrent().maps).some((map) => map.width > MAX_TOOL_MAP_DIMENSION)).toBe(false);
      });
    });

    it("addChildMap 도 초대형 요청으로 맵을 만들지 않는다", () => {
      withDom(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        const parentId = store.getCurrent().startMapId;
        const id = addChildMap(parentId, "초대형 하위", { width: OVER, height: 20 });
        expect(id).toBe("");
        expect(Object.values(store.getCurrent().maps).some((map) => map.width > MAX_TOOL_MAP_DIMENSION)).toBe(false);
      });
    });

    it("addMap 은 지원 상한을 그대로 만든다", () => {
      withDom(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        const id = addMap("경계", MAX_TOOL_MAP_DIMENSION, MAX_TOOL_MAP_DIMENSION);
        expect(id).not.toBe("");
        expect(store.getCurrent().maps[id]?.width).toBe(MAX_TOOL_MAP_DIMENSION);
      });
    });

    it("resizeMap 은 초대형 크기로 바꾸지 않는다", () => {
      withDom(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        const before = store.getCurrent().maps[mapId]!.width;
        resizeMap(mapId, OVER, OVER);
        expect(store.getCurrent().maps[mapId]?.width).toBe(before);
      });
    });

    it("createMapFromSpec 은 상한 밖 스펙으로 초대형 맵을 남기지 않는다", () => {
      withDom(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        const id = createMapFromSpec({
          name: "스펙 초과",
          width: OVER,
          height: OVER,
          tilesetId: store.getCurrent().maps[store.getCurrent().startMapId]!.tilesetId,
          parentId: "",
          preset: "blank",
        });
        const created = id ? store.getCurrent().maps[id] : undefined;
        expect(created?.width ?? 0).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
        expect(created?.height ?? 0).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
      });
    });
  });
  describe("lint 계약이 생성 계약과 일치한다", () => {
    it(`${OVER} 맵은 error 로 보고한다(warning-only 미지원 상태 금지)`, () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const huge = createBlankMap("외부 초대형", OVER, 12);
      project.maps[huge.id] = huge;
      project.mapTree.children.push({ mapId: huge.id, children: [] });

      const issues = projectLint(project);
      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "error", code: "map-size", mapId: huge.id })
      );
      expect(issues.some((issue) => issue.code === "map-size" && issue.severity === "warning")).toBe(false);
    });

    it(`${MAX_TOOL_MAP_DIMENSION} 맵은 보고하지 않는다`, () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const edge = createBlankMap("경계 맵", MAX_TOOL_MAP_DIMENSION, MAX_TOOL_MAP_DIMENSION);
      project.maps[edge.id] = edge;
      project.mapTree.children.push({ mapId: edge.id, children: [] });

      expect(projectLint(project).some((issue) => issue.code === "map-size")).toBe(false);
    });
  });
  describe("이미 들어온 초대형 맵(외부/구 데이터)", () => {
    /** 프로젝트에 이미 초대형 맵이 있는 상태(구 저장본/외부 임포트 재현). */
    function contextWithOversizedMap(): { context: ToolContext; hugeId: string } {
      const context = ctx();
      const huge = createBlankMap("외부 초대형", OVER, OVER);
      context.project.maps[huge.id] = huge;
      context.project.mapTree.children.push({ mapId: huge.id, children: [] });
      return { context, hugeId: huge.id };
    }

    // map-size 를 error 로 올리면 커밋 게이트가 걸린다. 기준선 대조가 없으면 "고치려는 조건이
    // 고치는 경로를 막는" 교착이 된다 — 선재 초과 맵이 무관한 편집까지 거부하면 안 된다.
    it("선재 초대형 맵이 무관한 편집을 막지 않는다", () => {
      const { context } = contextWithOversizedMap();
      const created = runTool(context, "create_map", { name: "정상 맵", width: 20, height: 15, id: "map_unrelated" });
      expect(created.ok, created.summary).toBe(true);
      expect(context.project.maps.map_unrelated?.width).toBe(20);
    });

    it("조수 경로에서도 렌더 없이 삭제할 수 있다", () => {
      const { context, hugeId } = contextWithOversizedMap();
      const removed = runTool(context, "remove_map", { mapId: hugeId });
      expect(removed.ok, removed.summary).toBe(true);
      expect(context.project.maps[hugeId]).toBeUndefined();
      expect(projectLint(context.project).some((issue) => issue.code === "map-size")).toBe(false);
    });

    it("캔버스를 열지 않고도 식별하고 지울 수 있다", () => {
      const restore = installFakeDom();
      try {
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        const huge = createBlankMap("외부 초대형", OVER, OVER);
        project.maps[huge.id] = huge;
        project.mapTree.children.push({ mapId: huge.id, children: [] });
        store.replace(project);
        editorState.set({ currentMapId: store.getCurrent().startMapId, selectedEventId: null, selectedEventPageId: null });

        // 식별: lint 가 mapId 를 짚어 준다.
        const found = projectLint(store.getCurrent()).find((issue) => issue.code === "map-size");
        expect(found?.mapId).toBe(huge.id);

        // 편집 캔버스는 열리지 않는다 — 현재 맵이 바뀌지 않아야 한다.
        const beforeMapId = editorState.get().currentMapId;
        expect(selectEditorMap(huge.id)).toBe(false);
        expect(editorState.get().currentMapId).toBe(beforeMapId);

        // 제거는 그래도 된다.
        const removed = deleteMap(huge.id);
        expect(removed.ok, "ok" in removed && !removed.ok ? removed.message : "").toBe(true);
        expect(store.getCurrent().maps[huge.id]).toBeUndefined();
      } finally {
        restore();
      }
    });
  });
});

describe("mapViewportContext", { timeout: 120000 }, () => {
  isolateTimers();
  // 시험 시간 한도는 수집 때 읽혀 beforeAll 안 vi.setConfig 는 듣지 않는다 — describe 옵션 timeout 으로 둔다.
  // createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
  // CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
  describe("computeMapViewport", () => {
    const map = { id: "map_a", width: 40, height: 30 };

    it("centers on camera world mid and reports visible tile rect", () => {
      // tileSize 16: 보이는 월드 사각형 320×240 → 20×15 칸, 좌상단 (160,80) = 타일 (10,5)
      const snap = computeMapViewport(map, {
        worldLeftPx: 160,
        worldTopPx: 80,
        worldWidthPx: 320,
        worldHeightPx: 240,
        tileSize: 16,
      });
      expect(snap.mapId).toBe("map_a");
      // world center (320, 200) / 16 → tile (20, 12)
      expect(snap.centerX).toBe(20);
      expect(snap.centerY).toBe(12);
      // maxSpan 16: visible was 20×15 → clamped
      expect(snap.w).toBeLessThanOrEqual(16);
      expect(snap.h).toBeLessThanOrEqual(16);
      expect(snap.x).toBeGreaterThanOrEqual(0);
      expect(snap.x + snap.w).toBeLessThanOrEqual(40);
    });

    it("clamps to map bounds near origin", () => {
      const snap = computeMapViewport(map, {
        worldLeftPx: 0,
        worldTopPx: 0,
        worldWidthPx: 64,
        worldHeightPx: 64,
        tileSize: 16,
      });
      expect(snap.centerX).toBe(2);
      expect(snap.centerY).toBe(2);
      expect(snap.x).toBe(0);
      expect(snap.y).toBe(0);
      expect(snap.w).toBe(4);
      expect(snap.h).toBe(4);
    });

    it("uses the zoom-corrected worldView so the reported center is the visual center", () => {
      // 실측 회귀(줌 2): scroll(400,300), 캔버스 1133×700 → worldView.x = 400 + 1133/2 - 1133/4 = 683.25.
      // 옛 입력 모양은 worldLeft=scrollX 라 중심을 (42,29)로 보고했다 — 실제 시각 중심은 (60,40)으로 18칸/11칸 어긋났다.
      const big = { id: "map_big", width: 200, height: 200 };
      const snap = computeMapViewport(big, {
        worldLeftPx: 683.25,
        worldTopPx: 475,
        worldWidthPx: 566.5,
        worldHeightPx: 350,
        tileSize: 16,
      });
      expect(snap.centerX).toBe(60);
      expect(snap.centerY).toBe(40);
      expect(snap.x).toBeLessThanOrEqual(60);
      expect(snap.x + snap.w).toBeGreaterThan(60);
      expect(snap.y).toBeLessThanOrEqual(40);
      expect(snap.y + snap.h).toBeGreaterThan(40);
    });
  });
  describe("mapRegionForContext / formatViewportContextBlock", () => {
    it("uses viewport clip when map matches", () => {
      const map = { id: "m", width: 50, height: 50 };
      const region = mapRegionForContext(map, {
        mapId: "m",
        centerX: 20,
        centerY: 10,
        x: 12,
        y: 4,
        w: 16,
        h: 12,
      });
      expect(region).toEqual({ x: 12, y: 4, w: 16, h: 12 });
    });

    it("falls back to top-left when no viewport", () => {
      const map = { id: "m", width: 50, height: 50 };
      expect(mapRegionForContext(map, null)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
    });

    it("formats Korean viewport block with center coords", () => {
      const text = formatViewportContextBlock(
        { mapId: "map_market", centerX: 7, centerY: 4, x: 2, y: 1, w: 10, h: 8 },
        "장터",
      );
      // 마지막 칸은 x+w-1 / y+h-1 — 반열림 끝값(12,9)은 영역에 없는 칸이라 찍히면 모델이 한 칸 밀린다.
      expect(text).toContain("(2,1)~(11,8)");
      expect(text).not.toContain("(2,1)~(12,9)");
      expect(text).toContain("(7, 4)");
      expect(text).toContain("map_market");
      expect(text).toContain("장터");
    });
  });
  describe("buildSystemPrompt with viewport", () => {
    it("summarizes around viewport instead of always (0,0)", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      // paint a unique lower tile far from origin so grid summary differs
      const farX = 18;
      const farY = 18;
      map.lowerTiles[farY * map.width + farX] = 222;

      const without = buildSystemPrompt(project, { currentMapId: mapId, budgetChars: 50_000 });
      expect(without).toContain("좌상단");

      const withVp = buildSystemPrompt(project, {
        currentMapId: mapId,
        budgetChars: 50_000,
        viewport: {
          mapId,
          centerX: farX,
          centerY: farY,
          x: farX - 4,
          y: farY - 4,
          w: 8,
          h: 8,
        },
      });
      expect(withVp).toContain("뷰포트");
      expect(withVp).toContain(`(${farX}, ${farY})`);
      expect(withVp).not.toContain("좌상단 일부만 표시(뷰포트 없음)");
    });
  });
  describe("mapRegionImagePayload", () => {
    it("exports lower/upper grids for vision render", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.lowerTiles[0] = 240;
      map.upperTiles[1] = 237;
      const payload = mapRegionImagePayload(project, mapId, { x: 0, y: 0, w: 2, h: 1 });
      expect(payload).not.toBeNull();
      expect(payload!.lower[0]![0]).toBe(240);
      expect(payload!.upper[0]![1]).toBe(237);
      expect(payload!.tilesetId).toBe(map.tilesetId);
    });
  });
  describe("AssistantSession viewport user turn", () => {
    it("prepends viewport block to the user message text", async () => {
      const { AssistantSession } = await import("@/ai/assistantSession");
      const project = createBlankProject();
      const mapId = project.startMapId;
      const session = new AssistantSession(project, {
        contextOptions: {
          currentMapId: mapId,
          viewport: {
            mapId,
            centerX: 5,
            centerY: 6,
            x: 1,
            y: 2,
            w: 8,
            h: 6,
          },
        },
        chat: async () => ({
          message: { role: "assistant", content: "ok" },
          finishReason: "stop",
        }),
      });
      await session.sendUserMessage("여기 나무 심어줘");
      const user = session.getMessages().find((m) => m.role === "user");
      expect(typeof user?.content).toBe("string");
      expect(String(user?.content)).toContain("화면 중앙 타일");
      expect(String(user?.content)).toContain("(5, 6)");
      expect(String(user?.content)).toContain("여기 나무 심어줘");
    });

    it.each([
      { reference: "explicit viewport", requestText: "화면 오른쪽 위에 숲을깔라", hasViewSpec: true },
      { reference: "unspecified direction", requestText: "오른쪽 위에 숲을깔라", hasViewSpec: false },
      { reference: "map despite screen reference", requestText: "화면을 참고해서 맵 오른쪽 위에 숲을깔라", hasViewSpec: false },
      { reference: "quoted sign text", requestText: "표지판 문구를 정확히 「화면 오른쪽 위에 숲을깔라」로 만들어 줘.", hasViewSpec: false },
      { reference: "separate objects", requestText: "화면 오른쪽에 연못을 만들고 위에 나무를 심어 줘.", hasViewSpec: false },
    ])("uses visible-camera geometry, not the 16-tile clip, only for $reference", async ({ requestText, hasViewSpec }) => {
      const { AssistantSession } = await import("@/ai/assistantSession");
      const project = createBlankProject();
      const mapId = project.startMapId;
      // Keep both the visible frame and context clip inside the actual map.
      project.maps[mapId] = { ...createBlankMap("Viewport test", 40, 30), id: mapId };
      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
        declareIntent: fixedDeclarer({ mode: "modify" }),
        contextOptions: {
          currentMapId: mapId,
          viewport: {
            mapId,
            centerX: 20,
            centerY: 12,
            x: 12,
            y: 4,
            w: 16,
            h: 16,
            viewX: 10,
            viewY: 4,
            viewW: 20,
            viewH: 12,
          },
        },
        chat: async () => ({
          message: { role: "assistant", content: "ok" },
          finishReason: "stop",
        }),
      });
      await session.sendUserMessage(requestText);
      // Inspect the real turn's machine-consumed obligation, not prompt wording.
      expect(session["turnImplicitSpec"]).toBeNull();
      const spec = session["turnViewSpec"];
      if (hasViewSpec) {
        expect(spec?.mapId).toBe(mapId);
        // The clip's northeast quadrant is (20,4) 8x8; the camera's is 10x6.
        expect(spec?.assets.map(({ kind, x, y, w, h }) => ({ kind, x, y, w, h }))).toEqual([
          { kind: "prop", x: 20, y: 4, w: 10, h: 6 },
        ]);
      } else {
        expect(spec).toBeNull();
      }
    });
  });
});
