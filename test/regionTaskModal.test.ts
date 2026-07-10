import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
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
  it("영역 칩·입력·실행·헤더 로그 버튼을 렌더한다", () => {
    restoreDom = installFakeDom();
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
    expect(findByTestId(root, "region-task-input")).not.toBeNull();
    expect(findByTestId(root, "region-task-run")).not.toBeNull();
    const copy = findByTestId(root, "region-task-copy-log");
    expect(copy).not.toBeNull();
    expect(copy?.textContent).toBe("로그");
    expect(copy?.getAttribute("disabled")).not.toBeNull();
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
      changedEvents: 0,
      clippedCells: 2,
      proposedCalls: 1,
      assistantText: "완료",
      log: {
        kind: "region-task-log" as const,
        exportedAt: "2026-07-10T00:00:00.000Z",
        mapId: "m1",
        mapName: "맵",
        region: REGION,
        instruction: "침엽수로 채워",
        composedMessage: "침엽수로 채워",
        result: {
          ok: true,
          applied: true,
          changedCells: 5,
          changedEvents: 0,
          clippedCells: 2,
          proposedCalls: 1,
          assistantText: "완료",
        },
        toolCalls: [],
        uiEvents: [],
        audit: [],
        harness: null,
      },
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
    const copy = findByTestId(root, "region-task-copy-log");
    expect(copy?.getAttribute("disabled")).toBeNull();
  });

  it("실행 후 로그 버튼이 클립보드에 JSON을 복사한다", async () => {
    restoreDom = installFakeDom();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });
    const run = vi.fn(async () => ({
      ok: true,
      applied: true,
      changedCells: 1,
      changedEvents: 0,
      clippedCells: 0,
      proposedCalls: 1,
      assistantText: "ok",
      log: {
        kind: "region-task-log" as const,
        exportedAt: "2026-07-10T00:00:00.000Z",
        mapId: "m1",
        mapName: "맵",
        region: REGION,
        instruction: "나무",
        composedMessage: "나무",
        result: {
          ok: true,
          applied: true,
          changedCells: 1,
          changedEvents: 0,
          clippedCells: 0,
          proposedCalls: 1,
          assistantText: "ok",
        },
        toolCalls: [{ name: "place_props", args: { count: 1 }, summary: "배치" }],
        uiEvents: [],
        audit: [],
        harness: null,
      },
    }));
    const root = openModal({ mapId: "m1", region: REGION, run });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "나무";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    findByTestId(root, "region-task-copy-log")?.click();
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = writeText.mock.calls[0]?.[0] as string;
    expect(payload).toContain("region-task-log");
    expect(payload).toContain("place_props");
  });
});

function fakePendingResult(overrides: Partial<RegionTaskResult> = {}): RegionTaskResult {
  const pending = setPendingRegionApply({
    baseProject: { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never,
    clippedProject: { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never,
    mapId: "m1",
    region: { x: 0, y: 0, width: 2, height: 2 },
    changedCells: 3,
    changedEvents: 0,
    instruction: "테스트",
    onApply: () => {},
    onDiscard: () => {},
    onSettle: () => {},
  });
  return {
    ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
    proposedCalls: 1, assistantText: "", pending, ...overrides,
  };
}

describe("pending 비교 UI", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("pending 결과면 before/after 썸네일과 적용/버리기 버튼을 렌더한다", async () => {
    restoreDom = installFakeDom();
    const stub = () => Promise.resolve(document.createElement("div"));
    const root = openModal({
      mapId: "m1",
      region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트",
      autoRun: true,
      run: async () => fakePendingResult(),
      renderSnapshot: stub,
    });
    await flush();
    expect(findByTestId(root, "region-task-compare")).not.toBeNull();
    expect(findByTestId(root, "region-task-before")).not.toBeNull();
    expect(findByTestId(root, "region-task-after")).not.toBeNull();
    expect(findByTestId(root, "region-task-apply")).not.toBeNull();
    expect(findByTestId(root, "region-task-discard")).not.toBeNull();
  });

  it("적용 클릭 시 pending.apply가 불리고 요약이 갱신된다", async () => {
    restoreDom = installFakeDom();
    const result = fakePendingResult();
    const root = openModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트", autoRun: true,
      run: async () => result,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    findByTestId(root, "region-task-apply")?.dispatchEvent(new Event("click"));
    expect(result.pending!.settled).toBe(true);
    expect(findByTestId(root, "region-task-summary")?.textContent).toContain("적용됨");
  });

  it("pending 미해소 상태에서 모달을 닫으면 discard 된다", async () => {
    restoreDom = installFakeDom();
    const result = fakePendingResult();
    const root = openModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트", autoRun: true,
      run: async () => result,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    findByTestId(root, "region-task-close")?.dispatchEvent(new Event("click"));
    expect(result.pending!.settled).toBe(true); // 닫기 = discard
  });
});
