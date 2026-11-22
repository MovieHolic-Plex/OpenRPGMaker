// 지형 리뷰 F8: 높이 붓 획을 되돌리면 맵 전체 relief 를 다시 구웠다(120×120 에서 2초). 되돌리기는 붓 획과 같은 부분 갱신으로 알린다.
import { beforeEach, describe, expect, it } from "vitest";
import { recordMapEditIfChanged, resetMapEditHistory, undoMapEdit, redoMapEdit } from "@/editor/mapEditHistory";
import { paintRelief } from "@/editor/tileActions";
import { createBlankProject } from "@/project/defaults";
import { store, type ProjectChangeDescriptor } from "@/project/store";

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
