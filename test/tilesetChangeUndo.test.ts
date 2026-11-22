// 지형 리뷰 F1: 칩셋을 바꾼 뒤 Ctrl+Z 한 번이 바로 앞 지형 획까지 지웠다.
// setMapTileset 이 맵 기록을 남기지 않아, 되돌리기가 획 시작 스냅샷(옛 칩셋·획 전 높이)을 복원했기 때문이다.
// 칩셋 변경은 그 자체로 되돌리기 한 단계여야 한다.
import { beforeEach, describe, expect, it } from "vitest";
import { setMapTileset } from "@/editor/actions";
import { pendingHistoryLabels, recordMapEditIfChanged, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { paintRelief } from "@/editor/tileActions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
});

describe("칩셋 변경은 되돌리기 한 단계다", () => {
  it("Ctrl+Z 한 번은 칩셋만 되돌리고 앞 지형 획은 남긴다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    const other = Object.values(project.tilesets).find((t) => t.id !== map.tilesetId && t.tileSize === map.tileSize);
    if (!other) throw new Error("같은 크기의 다른 칩셋이 픽스처에 없습니다");
    const originalTileset = map.tilesetId;

    recordMapEditIfChanged(map.id, () => { paintRelief(map.id, 5, 5, "raise", { radius: 2, level: 1 }); }, { label: "높이 · 높이 올리기" });
    const raised = store.getCurrent().maps[map.id]!.relief!.levels.filter((v) => v > 0).length;
    expect(raised).toBeGreaterThan(0);

    setMapTileset(map.id, other.id);
    expect(store.getCurrent().maps[map.id]!.tilesetId).toBe(other.id);
    expect(pendingHistoryLabels().undo).toContain("칩셋 변경");

    expect(undoMapEdit()).toBe(true);
    const afterUndo = store.getCurrent().maps[map.id]!;
    expect(afterUndo.tilesetId).toBe(originalTileset);
    expect(afterUndo.relief!.levels.filter((v) => v > 0).length).toBe(raised);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[map.id]!.relief?.levels.some((v) => v > 0) ?? false).toBe(false);
  });
});
