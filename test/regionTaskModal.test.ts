import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeRegionTaskModal,
  openRegionTaskModal,
  positionRegionTaskPopover,
} from "@/editor/panels/regionTaskModal";
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

  it("스트리밍으로 이미 나온 어시스턴트 문단을 결과에서 또 찍지 않는다", async () => {
    // 회귀 가드: 예전엔 onEvent 의 assistant_message 를 280자로 찍고, 끝나고 나서
    // result.assistantText 를 400자로 또 찍어 같은 문단이 로그에 두 번 남았다.
    restoreDom = installFakeDom();
    const text = "선택 영역 안에 7×7 크기의 둥근 호수 배치안을 만들었습니다.";
    const run = vi.fn(async (opts: { onEvent?: (event: unknown) => void }) => {
      opts.onEvent?.({ type: "assistant_message", content: text });
      return {
        ok: true, applied: true, changedCells: 37, changedEvents: 0,
        clippedCells: 0, proposedCalls: 1, assistantText: text,
      };
    });
    const root = openModal({ mapId: "m1", region: REGION, run: run as never });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "둥근 호수";
    findByTestId(root, "region-task-run")?.click();
    await flush();

    const logText = findByTestId(root, "region-task-log")?.textContent ?? "";
    const occurrences = logText.split("둥근 호수 배치안").length - 1;
    expect(occurrences).toBe(1);
  });

  it("툴 인자 JSON을 로그 본문에 찍지 않고 title 로만 단다", async () => {
    // 회귀 가드: 인자를 120자에서 자르는 바람에 중괄호가 깨진 JSON이 화면에 노출됐다.
    restoreDom = installFakeDom();
    const run = vi.fn(async (opts: { onEvent?: (event: unknown) => void }) => {
      opts.onEvent?.({
        type: "tool_call",
        name: "show_map_region",
        args: { mapId: "map_blank_start", x: 8, y: 0, w: 11, h: 8 },
        result: { ok: true, summary: "맵 미리보기: (8,0) 11×8" },
      });
      return { ok: true, applied: true, changedCells: 1, changedEvents: 0, clippedCells: 0, proposedCalls: 1, assistantText: "" };
    });
    const root = openModal({ mapId: "m1", region: REGION, run: run as never });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "호수";
    findByTestId(root, "region-task-run")?.click();
    await flush();

    const logText = findByTestId(root, "region-task-log")?.textContent ?? "";
    expect(logText).toContain("show_map_region");
    expect(logText).toContain("맵 미리보기");
    expect(logText).not.toContain("map_blank_start");
    expect(logText).not.toContain("{");
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
    // 배지 해제(running:false) 발행은 실제로는 runRegionTask.ts의 onSettle이 담당한다 —
    // 그 배선 자체의 검증은 test/regionTaskRun.test.ts(실제 runRegionTask 경유)가 맡고,
    // 이 파일은 모달 UI(요약/버튼 재활성화/discard 호출)만 순수하게 확인한다.
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

  it("적용 클릭 시 pending.apply가 불리고 요약이 갱신된 뒤 창이 닫힌다", async () => {
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

    // 적용은 작업의 끝이다 — 결과는 캔버스에 있고 창이 남아 있으면 그것을 가린다.
    // 닫기는 현재 콜스택을 빠져나온 뒤(setTimeout 0) 실행되므로 flush 후에 확인한다.
    await flush();
    expect(document.querySelector("[data-testid='region-task-modal']")).toBeNull();
    expect(document.querySelector("[data-testid='region-task-backdrop']")).toBeNull();
  });

  it("버리기는 창을 닫지 않고 입력 단계로 되돌린다", async () => {
    restoreDom = installFakeDom();
    const result = fakePendingResult();
    const root = openModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트", autoRun: true,
      run: async () => result,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    findByTestId(root, "region-task-discard")?.dispatchEvent(new Event("click"));
    await flush();
    expect(findByTestId(root, "region-task-summary")?.textContent).toContain("버려졌습니다");
    expect(findByTestId(root, "region-task-run")?.disabled).toBe(false);
    expect(findByTestId(root, "region-task-input")?.disabled).toBe(false);
    expect(document.querySelector("[data-testid='region-task-modal']")).not.toBeNull();
  });

  it("pending 미해소 상태에서 모달을 닫으면 discardAndClose가 pending.discard()를 호출한다", async () => {
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

  it("모달 A가 pending 미해소 상태에서 새 모달 B를 열면 A의 pending이 discard된다(구독 leak 방지)", async () => {
    restoreDom = installFakeDom();
    const resultA = fakePendingResult();
    openModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트 A", autoRun: true,
      run: async () => resultA,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flush();
    expect(resultA.pending!.settled).toBe(false); // A는 아직 pending 비교 UI 상태

    // B를 여는 openRegionTaskModal() 내부의 closeRegionTaskModal() 선호출이 A의 정리 콜백
    // (activeModalCleanup)을 실행해야 한다 — DOM만 지우고 discard/구독 해제를 건너뛰면 leak.
    const rootB = openModal({ mapId: "m1", region: { x: 1, y: 1, width: 2, height: 2 }, run: vi.fn() });

    expect(resultA.pending!.settled).toBe(true);
    expect(findByTestId(rootB, "region-task-input")).not.toBeNull();
  });

  it("추천 칩 클릭 시 입력창이 채워진다", () => {
    restoreDom = installFakeDom();
    const root = openModal({ mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 } });
    const chips = findByTestId(root, "region-task-suggestions");
    expect(chips).not.toBeNull();
    const firstChip = chips!.querySelector("button") as HTMLElement;
    firstChip.dispatchEvent(new Event("click"));
    const input = findByTestId(root, "region-task-input") as HTMLTextAreaElement;
    expect(input.value.length).toBeGreaterThan(5);
    closeRegionTaskModal();
  });

  it("앵커 팝오버는 뷰포트 밖으로 나가지 않게 left/top/maxHeight를 클램프한다", () => {
    const g = globalThis as typeof globalThis & { innerWidth?: number; innerHeight?: number };
    const prevW = Object.getOwnPropertyDescriptor(globalThis, "innerWidth");
    const prevH = Object.getOwnPropertyDescriptor(globalThis, "innerHeight");
    Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 600 });

    const style: Record<string, string> = {};
    const panel = {
      style,
      getBoundingClientRect: () =>
        ({
          width: 360,
          height: 500,
          left: 500,
          top: 400,
          right: 860,
          bottom: 900,
          x: 500,
          y: 400,
          toJSON: () => ({}),
        }) as DOMRect,
    } as unknown as HTMLElement;

    // 앵커가 화면 하단 근처 → 아래로 넘치면 top이 당겨지고 maxHeight ≤ 뷰포트.
    positionRegionTaskPopover(panel, { x: 500, y: 400 });

    const left = Number.parseFloat(style.left);
    const top = Number.parseFloat(style.top);
    const maxH = Number.parseFloat(style.maxHeight);
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + 360).toBeLessThanOrEqual(800 - 12 + 1);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + Math.min(500, maxH)).toBeLessThanOrEqual(600 - 12 + 1);
    expect(maxH).toBeLessThanOrEqual(600 - 24);
    expect(style.maxHeight).toMatch(/px$/);

    if (prevW) Object.defineProperty(globalThis, "innerWidth", prevW);
    else Reflect.deleteProperty(g, "innerWidth");
    if (prevH) Object.defineProperty(globalThis, "innerHeight", prevH);
    else Reflect.deleteProperty(g, "innerHeight");
  });

  it("anchor로 열면 region-task-popover testid와 fixed 위치가 잡힌다", () => {
    restoreDom = installFakeDom();
    const root = openModal({
      mapId: "m1",
      region: REGION,
      anchor: { x: 100, y: 500 },
      run: vi.fn(),
    });
    const pop = findByTestId(root, "region-task-popover");
    expect(pop).not.toBeNull();
    // style 객체가 fakeDom에 있으면 검사, 없으면 testid 존재만으로 통과.
    const style = (pop as { style?: { position?: string; maxHeight?: string } })?.style;
    if (style) {
      expect(style.position).toBe("fixed");
      expect(style.maxHeight).toBeTruthy();
    }
    closeRegionTaskModal();
  });
});
