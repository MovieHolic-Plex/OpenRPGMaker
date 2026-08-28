// test/regionTaskApplyFlow.test.ts
// 우클릭 드래그 → 영역 작업의 **결정(적용)** 경로 계약.
//
// 고정하는 세 가지:
//  1) 팝오버는 대상 영역 옆에 선다(자기가 바꾸는 곳과 캔버스 고스트 미리보기를 덮지 않는다).
//  2) 검토 단계는 결정 우선 순서다 — 결정 버튼 줄이 진단(details)보다 앞에 온다.
//  3) 검토 단계의 Enter 는 "적용"이다. 예전에는 단계와 무관하게 execute() 라서, 결과를 보고
//     Enter 를 누르면 방금 만든 제안을 버리고 AI 를 한 번 더 호출했다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeRegionTaskModal,
  openRegionTaskModal,
  placePopoverBesideRect,
} from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const REGION = { x: 0, y: 0, width: 2, height: 2 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

type PendingHooks = {
  readonly onApply: () => void;
  readonly blockers?: readonly string[];
};

function fakePendingResult(hooks: PendingHooks): RegionTaskResult {
  const project = {
    maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } },
    tilesets: {},
  } as never;
  const report = {
    issues: [{ code: "schedule", severity: "warning", message: "NPC 일정 확인" }],
    blockers: hooks.blockers ?? [],
    checkpoints: [{ id: "draft", label: "분리 초안", status: "done", detail: "ready" }],
    metrics: {
      changedCells: 3, changedEvents: 0, passableChangedCells: 2, isolatedChangedCells: 0,
      scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
      roomScoreAverage: null, deterministicRepairs: 0,
    },
    repairLimit: 8,
  } as never;
  const pending = setPendingRegionApply({
    baseProject: project,
    clippedProject: project,
    mapId: "m1",
    region: REGION,
    changedCells: 3,
    changedEvents: 0,
    instruction: "테스트",
    getCurrentProject: () => project,
    report,
    reviewProject: (candidate) => ({ project: candidate, report }),
    onApply: hooks.onApply,
    onDiscard: () => {},
    onSettle: () => {},
  });
  return {
    ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
    proposedCalls: 1, assistantText: "", pending, review: pending.report,
  };
}

async function openInReview(hooks: PendingHooks): Promise<{
  root: FakeElement;
  run: ReturnType<typeof vi.fn>;
}> {
  __clearPendingRegionApplyForTest();
  restoreDom = installFakeDom();
  const run = vi.fn(async () => fakePendingResult(hooks));
  const root = openModal({
    mapId: "m1",
    region: REGION,
    initialInstruction: "테스트",
    autoRun: true,
    run: run as never,
    renderSnapshot: () => Promise.resolve(document.createElement("div")),
  });
  await flush();
  return { root, run };
}

function pressKeyOnDocument(key: string): void {
  const event = new Event("keydown") as Event & { key?: string };
  event.key = key;
  (document as unknown as { dispatchEvent: (event: Event) => boolean }).dispatchEvent(event);
}

function childIndexByTestId(root: FakeElement, testid: string): number {
  const host = findByTestId(root, "region-task-compare");
  const compareHost = host?.parentNode as FakeElement | null;
  const children = compareHost?.children ?? [];
  return children.findIndex((child) => {
    if (child.dataset?.testid === testid) return true;
    return Boolean(findByTestId(child, testid) && child.dataset?.testid);
  });
}

describe("placePopoverBesideRect", () => {
  const viewport = { width: 1200, height: 800 };
  const avoid = { x: 400, y: 300, width: 200, height: 150 };

  it("자리가 있으면 영역 오른쪽에 세운다", () => {
    const placed = placePopoverBesideRect({ avoid, width: 380, height: 400, viewport, margin: 12 });
    expect(placed).toEqual({ x: avoid.x + avoid.width + 12, y: 175 });
  });

  it("오른쪽이 좁으면 왼쪽으로 뒤집는다", () => {
    const rightEdge = { x: 950, y: 300, width: 200, height: 150 };
    const placed = placePopoverBesideRect({ avoid: rightEdge, width: 380, height: 400, viewport, margin: 12 });
    expect(placed?.x).toBe(rightEdge.x - 380 - 12);
  });

  it("좌우가 모두 좁으면 아래로 내린다", () => {
    const wide = { x: 12, y: 20, width: 1176, height: 120 };
    const placed = placePopoverBesideRect({ avoid: wide, width: 380, height: 400, viewport, margin: 12 });
    expect(placed?.y).toBe(wide.y + wide.height + 12);
  });

  it("사방에 자리가 없으면 null (호출부가 anchor 배치로 되돌린다)", () => {
    const huge = { x: 0, y: 0, width: 1200, height: 800 };
    expect(placePopoverBesideRect({ avoid: huge, width: 380, height: 400, viewport, margin: 12 })).toBeNull();
  });

  it("세로 배치도 뷰포트 안으로 클램프한다", () => {
    const placed = placePopoverBesideRect({
      avoid: { x: 400, y: 700, width: 200, height: 80 },
      width: 380,
      height: 400,
      viewport,
      margin: 12,
    });
    expect(placed?.y).toBeLessThanOrEqual(viewport.height - 12 - 400);
    expect(placed?.y).toBeGreaterThanOrEqual(12);
  });
});

describe("검토 단계 배치", () => {
  it("결정 버튼 줄이 진단 접이식보다 앞에 온다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const actionsIndex = childIndexByTestId(root, "region-task-compare-actions");
    const diagnosticsIndex = childIndexByTestId(root, "region-task-diagnostics");
    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(diagnosticsIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeLessThan(diagnosticsIndex);
  });

  it("체크포인트·지표·이슈는 진단 접이식 안에 들어간다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const diagnostics = findByTestId(root, "region-task-diagnostics");
    expect(diagnostics).not.toBeNull();
    for (const testid of [
      "region-task-checkpoint-timeline",
      "region-task-review-metrics",
      "region-task-review-issues",
    ]) {
      expect(findByTestId(diagnostics!, testid), testid).not.toBeNull();
    }
  });

  it("차단이 없으면 진단은 접힌 채로, 차단이 있으면 펼친 채로 시작한다", async () => {
    const clean = await openInReview({ onApply: () => {} });
    expect(findByTestId(clean.root, "region-task-diagnostics")?.getAttribute("open")).toBeNull();
    closeRegionTaskModal();
    restoreDom?.();
    restoreDom = null;

    const blocked = await openInReview({ onApply: () => {}, blockers: ["통행 불가 칸이 생깁니다"] });
    expect(findByTestId(blocked.root, "region-task-diagnostics")?.getAttribute("open")).not.toBeNull();
  });

  it("검토에 들어오면 적용 버튼이 포커스를 받는다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const apply = findByTestId(root, "region-task-apply");
    expect((document as unknown as { activeElement: unknown }).activeElement).toBe(apply);
  });
});

describe("검토 단계 단축키", () => {
  it("Enter 는 재실행이 아니라 적용이다", async () => {
    const onApply = vi.fn();
    const { root, run } = await openInReview({ onApply });
    expect(run).toHaveBeenCalledTimes(1);
    // 포커스가 버튼에 없는 상태(캔버스를 보다가 Enter)를 재현한다.
    (document as unknown as { activeElement: unknown }).activeElement = null;

    pressKeyOnDocument("Enter");

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(findByTestId(root, "region-task-summary")?.textContent).toContain("적용됨");
    await flush();
  });

  it("적용 버튼이 포커스인 상태에서는 document 단축키가 물러난다", async () => {
    // 실제 앱의 검토 진입 상태는 apply 포커스다. 그때 document 핸들러까지 Enter 를 처리하면
    // 브라우저의 버튼 기본 동작과 겹쳐 pending.apply() 가 두 번 불린다.
    const onApply = vi.fn();
    const { root } = await openInReview({ onApply });
    const apply = findByTestId(root, "region-task-apply");
    expect((document as unknown as { activeElement: unknown }).activeElement).toBe(apply);

    pressKeyOnDocument("Enter");
    expect(onApply).not.toHaveBeenCalled();

    apply?.dispatchEvent(new Event("click"));
    expect(onApply).toHaveBeenCalledTimes(1);
    await flush();
  });

  it("적용 뒤 예약된 닫기는 그 사이 새로 열린 모달을 닫지 않는다", async () => {
    const onApply = vi.fn();
    const { root } = await openInReview({ onApply });
    (document as unknown as { activeElement: unknown }).activeElement = null;
    pressKeyOnDocument("Enter");
    expect(onApply).toHaveBeenCalledTimes(1);

    // 예약된 close 가 아직 안 돌았는데 다른 경로가 새 모달을 연다.
    const replacement = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
    expect(findByTestId(replacement, "region-task-input")).not.toBeNull();
    await flush();

    expect(findByTestId(replacement, "region-task-input")).not.toBeNull();
    expect(replacement.parentNode).not.toBeNull();
    expect(root.parentNode).toBeNull();
  });

  it("R 은 같은 지시로 다시 생성한다", async () => {
    const onApply = vi.fn();
    const { run } = await openInReview({ onApply });
    (document as unknown as { activeElement: unknown }).activeElement = null;

    pressKeyOnDocument("r");
    await flush();

    expect(onApply).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("지시 단계의 Enter 는 그대로 실행이다", async () => {
    restoreDom = installFakeDom();
    const run = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0,
      clippedCells: 0, proposedCalls: 0, assistantText: "",
    }));
    const root = openModal({ mapId: "m1", region: REGION, run: run as never });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "숲으로 채워";
    (document as unknown as { activeElement: unknown }).activeElement = null;

    pressKeyOnDocument("Enter");

    expect(run).toHaveBeenCalledTimes(1);
  });
});
