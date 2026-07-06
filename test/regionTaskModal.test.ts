import { afterEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const REGION = { x: 2, y: 3, width: 4, height: 5 };

// 모달은 HTMLElement를 반환하지만 fakeDom 아래에선 실제로 FakeElement다.
function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("openRegionTaskModal", () => {
  it("영역 칩·입력·실행 버튼을 렌더한다", () => {
    restoreDom = installFakeDom();
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
    expect(findByTestId(root, "region-task-input")).not.toBeNull();
    expect(findByTestId(root, "region-task-run")).not.toBeNull();
    const chip = findByTestId(root, "region-task-chip");
    expect(chip?.textContent).toContain("(2,3) 4×5");
  });

  it("빈 지시로 실행하면 runner를 호출하지 않고 안내한다", () => {
    restoreDom = installFakeDom();
    const run = vi.fn();
    const root = openModal({ mapId: "m1", region: REGION, run });
    findByTestId(root, "region-task-run")?.click();
    expect(run).not.toHaveBeenCalled();
    expect(findByTestId(root, "region-task-summary")?.textContent).toContain("입력");
  });

  it("지시를 넣고 실행하면 영역·지시로 runner를 부르고 결과를 요약한다", async () => {
    restoreDom = installFakeDom();
    const run = vi.fn(async () => ({
      ok: true,
      applied: true,
      changedCells: 5,
      clippedCells: 2,
      proposedCalls: 1,
      assistantText: "완료",
    }));
    const root = openModal({ mapId: "m1", region: REGION, run });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "침엽수로 채워";
    findByTestId(root, "region-task-run")?.click();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ mapId: "m1", region: REGION, instruction: "침엽수로 채워" }),
    );

    await flush();
    const summary = findByTestId(root, "region-task-summary")?.textContent ?? "";
    expect(summary).toContain("완료");
    expect(summary).toContain("5칸");
    expect(summary).toContain("2칸");
  });
});
