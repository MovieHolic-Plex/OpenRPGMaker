import { describe, expect, it, vi } from "vitest";
import {
  isCellInsideSelection,
  regionTaskMenuItems,
  type RegionSelection,
} from "@/editor/panels/mapSelectionContextMenu";

const SELECTION: RegionSelection = { mapId: "m1", x: 2, y: 3, width: 4, height: 5 }; // x∈[2,6), y∈[3,8)

describe("isCellInsideSelection", () => {
  it("경계를 반개구간으로 판정한다", () => {
    expect(isCellInsideSelection(SELECTION, 2, 3)).toBe(true);
    expect(isCellInsideSelection(SELECTION, 5, 7)).toBe(true);
    expect(isCellInsideSelection(SELECTION, 6, 7)).toBe(false); // x 상한 제외
    expect(isCellInsideSelection(SELECTION, 2, 8)).toBe(false); // y 상한 제외
    expect(isCellInsideSelection(SELECTION, 1, 3)).toBe(false);
  });
});

describe("regionTaskMenuItems", () => {
  it("AI 작업 항목 1개를 만들고 action이 선택을 조수 턴 스코프로 무장시킨다", () => {
    const requestAssistant = vi.fn();
    const items = regionTaskMenuItems(SELECTION, requestAssistant);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.testId).toBe("region-ai-task-menu-item");
    expect(item.label).toContain("AI 작업");

    item.action();
    // 실행체는 조수 세션 하나다 — 항목은 팝오버를 여는 대신 브리지 이벤트 1건만 낸다.
    expect(requestAssistant).toHaveBeenCalledTimes(1);
    expect(requestAssistant).toHaveBeenCalledWith(SELECTION, { focus: true });
  });
});
