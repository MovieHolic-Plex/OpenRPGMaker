import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMapEditHistoryEntries,
  getMapEditRedoEntries,
  recordProjectSnapshot,
  redoMapEdit,
  redoToHistoryIndex,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

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
