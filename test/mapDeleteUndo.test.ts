// 맵 삭제 확인창은 "삭제 후 Ctrl+Z로 되돌릴 수 있습니다"(mapDeleteConfirm.ts:31)와
// "한 번의 실행 취소로 이 묶음 삭제를 되돌릴 수 있습니다"(:39)를 사용자에게 인쇄한다.
// 그 약속이 참이려면 삭제 경로 자체가 되돌리기 스냅샷을 남겨야 한다.
//
// 회귀 배경: deleteMap / deleteMapsInOrder 는 recordProjectSnapshot 없이 store.update 만
// 호출했다. 그래서 확인창이 보장한 Ctrl+Z 는 무관한 이전 편집을 되돌렸고, 삭제된 맵과
// 그 이벤트는 복구되지 않았다. 이 파일이 그 계약을 잠근다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMap, deleteMapsInOrder, duplicateMap } from "@/editor/actions";
import {
  getMapEditHistoryState,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

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
