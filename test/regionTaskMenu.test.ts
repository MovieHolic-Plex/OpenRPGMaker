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
  it("AI 작업 항목 1개를 만들고 action이 선택 영역으로 모달을 연다", () => {
    const openModal = vi.fn();
    const items = regionTaskMenuItems(SELECTION, openModal);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.testId).toBe("region-ai-task-menu-item");
    expect(item.label).toContain("AI 작업");

    item.action();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith({
      mapId: "m1",
      region: { x: 2, y: 3, width: 4, height: 5 },
    });
  });
});
