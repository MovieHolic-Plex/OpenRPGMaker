// test/regionTaskApplyFlow.test.ts
// 우클릭 드래그 → 영역 작업의 **결정(적용)** 경로 계약.
//
// 고정하는 네 가지:
//  1) 팝오버는 대상 영역 옆에 선다(자기가 바꾸는 곳과 캔버스 고스트 미리보기를 덮지 않는다).
//  2) 검토 단계는 결정 우선 순서다 — 결정 버튼 줄이 진단(details)보다 앞에 온다.
//  3) 검토 단계의 Enter 는 "적용"이다. 예전에는 단계와 무관하게 execute() 라서, 결과를 보고
//     Enter 를 누르면 방금 만든 제안을 버리고 AI 를 한 번 더 호출했다.
//  4) 탐색용 변경 행이 포커스를 가진 Enter 는 제안 전체 적용으로 새지 않는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeRegionTaskModal,
  openRegionTaskModal,
  placePopoverBesideRect,
} from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, flushFakeAnimationFrames, installFakeDom } from "./fakeDom";

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
  /** error 등급 소견 한 건 주입 — 검증게이트가 없어도 진단은 계속 보인다. */
  readonly errorIssue?: string;
  readonly eventChange?: boolean;
};

function fakePendingResult(hooks: PendingHooks): RegionTaskResult {
  const project = {
    maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } },
    tilesets: {},
  };
  const clippedProject = hooks.eventChange
    ? {
      ...project,
      maps: {
        m1: {
          ...project.maps.m1,
          events: [{ id: "npc-review", x: 1, y: 1, trigger: "action", commands: [] }],
        },
      },
    }
    : project;
  const changedEvents = hooks.eventChange ? 1 : 0;
  const report = {
    issues: hooks.errorIssue
      ? [{ code: "preflight", severity: "error", message: hooks.errorIssue }]
      : [{ code: "schedule", severity: "warning", message: "NPC 일정 확인" }],
    metrics: {
      changedCells: 3, changedEvents, passableChangedCells: 2, isolatedChangedCells: 0,
      scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
      roomScoreAverage: null,
    },
  } as never;
  const pending = setPendingRegionApply({
    baseProject: project as never,
    clippedProject: clippedProject as never,
    mapId: "m1",
    region: REGION,
    changedCells: 3,
    changedEvents,
    instruction: "테스트",
    getCurrentProject: () => project as never,
    report,
    reviewProject: (candidate) => ({ project: candidate, report }),
    onApply: hooks.onApply,
    onDiscard: () => {},
    onSettle: () => {},
  });
  return {
    ok: true, applied: false, changedCells: 3, changedEvents, clippedCells: 0,
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

  it("기본 간격만 좁으면 간격 0으로 줄여 영역에 닿게 세운다", () => {
    const placed = placePopoverBesideRect({
      avoid: { x: 400, y: 0, width: 8, height: 600 },
      width: 380,
      height: 400,
      viewport: { width: 800, height: 600 },
      margin: 12,
    });
    expect(placed).toEqual({ x: 408, y: 100 });
  });

  it("완전히 비킬 수 없으면 뷰포트 안에서 겹침이 가장 작은 쪽을 고른다", () => {
    const huge = { x: 100, y: 20, width: 1000, height: 760 };
    const placed = placePopoverBesideRect({ avoid: huge, width: 380, height: 400, viewport, margin: 12 });
    expect(placed).toEqual({ x: 808, y: 200 });
    expect(placed!.x).toBeGreaterThanOrEqual(12);
    expect(placed!.x + 380).toBeLessThanOrEqual(viewport.width - 12);
    expect(placed!.y).toBeGreaterThanOrEqual(12);
    expect(placed!.y + 400).toBeLessThanOrEqual(viewport.height - 12);
  });

  it("회피 영역이 없을 때만 null을 반환한다", () => {
    expect(placePopoverBesideRect({ width: 380, height: 400, viewport, margin: 12 })).toBeNull();
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
  it("검토 DOM 삽입 직후 동기 재배치하고 진단 토글 뒤에도 다시 맞춘다", async () => {
    restoreDom = installFakeDom({ animationFrames: "manual" });
    const g = globalThis as typeof globalThis & { innerWidth?: number; innerHeight?: number };
    const prevW = Object.getOwnPropertyDescriptor(globalThis, "innerWidth");
    const prevH = Object.getOwnPropertyDescriptor(globalThis, "innerHeight");
    Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 600 });

    let signalRepositioned: (() => void) | undefined;
    const repositioned = new Promise<void>((resolve) => { signalRepositioned = resolve; });
    try {
      const root = openModal({
        mapId: "m1",
        region: REGION,
        initialInstruction: "테스트",
        autoRun: true,
        anchor: { x: 100, y: 500 },
        avoid: { x: 50, y: 450, width: 100, height: 100 },
        run: async () => fakePendingResult({ onApply: () => {} }),
        renderSnapshot: () => Promise.resolve(document.createElement("div")),
      });
      const popover = findByTestId(root, "region-task-popover")!;
      Object.defineProperty(popover, "isConnected", { configurable: true, value: true });
      popover.getBoundingClientRect = () => {
        const diagnostics = findByTestId(popover, "region-task-diagnostics");
        const reviewVisible = popover.dataset.stage === "review";
        const height = reviewVisible
          ? diagnostics?.getAttribute("open") !== null ? 500 : 300
          : 200;
        if (diagnostics && reviewVisible) signalRepositioned?.();
        return {
          width: 380, height, left: 0, top: 0, right: 380, bottom: height,
          x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect;
      };

      await Promise.race([
        repositioned,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("synchronous reposition was not observed")), 1000)),
      ]);
      expect(popover.style.top).toBe("288px");

      flushFakeAnimationFrames();
      const diagnostics = findByTestId(root, "region-task-diagnostics")!;
      diagnostics.setAttribute("open", "");
      diagnostics.dispatchEvent(new Event("toggle"));
      flushFakeAnimationFrames();
      expect(popover.style.top).toBe("88px");
    } finally {
      if (prevW) Object.defineProperty(globalThis, "innerWidth", prevW);
      else Reflect.deleteProperty(g, "innerWidth");
      if (prevH) Object.defineProperty(globalThis, "innerHeight", prevH);
      else Reflect.deleteProperty(g, "innerHeight");
    }
  });

  it("결정 버튼 줄이 진단 접이식보다 앞에 온다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const actionsIndex = childIndexByTestId(root, "region-task-compare-actions");
    const diagnosticsIndex = childIndexByTestId(root, "region-task-diagnostics");
    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(diagnosticsIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeLessThan(diagnosticsIndex);
  });

  it("지표·이슈는 진단 접이식 안에 들어간다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const diagnostics = findByTestId(root, "region-task-diagnostics");
    expect(diagnostics).not.toBeNull();
    for (const testid of [
      "region-task-review-metrics",
      "region-task-review-issues",
    ]) {
      expect(findByTestId(diagnostics!, testid), testid).not.toBeNull();
    }
  });

  it("주의만 있으면 진단은 접힌 채로, error 소견이 있으면 펼친 채로 시작한다", async () => {
    const clean = await openInReview({ onApply: () => {} });
    expect(findByTestId(clean.root, "region-task-diagnostics")?.getAttribute("open")).toBeNull();
    closeRegionTaskModal();
    restoreDom?.();
    restoreDom = null;

    // error 소견은 적용을 막지 않는다 — 다만 접힌 채로 숨기지도 않는다.
    const flagged = await openInReview({ onApply: () => {}, errorIssue: "통행 불가 칸이 생깁니다" });
    expect(findByTestId(flagged.root, "region-task-diagnostics")?.getAttribute("open")).not.toBeNull();
    expect(findByTestId(flagged.root, "region-task-verdict")?.textContent).toBe("확인 1건");
    // "적용 차단" 목록은 존재 자체가 사라졌다 — 소견은 진단 안에만 있다.
    expect(findByTestId(flagged.root, "region-task-blockers")).toBeNull();
  });

  it("검토에 들어오면 적용 버튼이 포커스를 받는다", async () => {
    const { root } = await openInReview({ onApply: () => {} });
    const apply = findByTestId(root, "region-task-apply");
    expect((document as unknown as { activeElement: unknown }).activeElement).toBe(apply);
  });
});

describe("자동완성 Escape", () => {
  it("드롭다운만 닫고 창은 살려 둔다", async () => {
    restoreDom = installFakeDom();
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "/";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    const autocomplete = findByTestId(root, "region-task-autocomplete");
    expect(autocomplete?.classList.contains("hidden")).toBe(false);

    const escape = new Event("keydown", { bubbles: true }) as Event & { key?: string };
    escape.key = "Escape";
    input?.dispatchEvent(escape);

    expect(autocomplete?.classList.contains("hidden")).toBe(true);
    expect(findByTestId(root, "region-task-input")).not.toBeNull();
    expect(root.parentNode).not.toBeNull();
  });
});

describe("검토 단계 단축키", () => {
  it("Enter 는 재실행이 아니라 적용이다", async () => {
    const onApply = vi.fn();
    const { run } = await openInReview({ onApply });
    expect(run).toHaveBeenCalledTimes(1);
    // 포커스가 버튼에 없는 상태(캔버스를 보다가 Enter)를 재현한다.
    (document as unknown as { activeElement: unknown }).activeElement = null;

    pressKeyOnDocument("Enter");

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
    await flush();
  });

  it("이벤트 변경 행의 Enter 는 적용하지 않고 중립 포커스의 Enter 만 적용한다", async () => {
    const onApply = vi.fn();
    const { root } = await openInReview({ onApply, eventChange: true });
    const changeRow = findByTestId(root, "region-task-change-row-event-npc-review");
    expect(changeRow).not.toBeNull();

    changeRow?.focus();
    pressKeyOnDocument("Enter");
    expect(onApply).not.toHaveBeenCalled();

    document.body.focus();
    pressKeyOnDocument("Enter");
    expect(onApply).toHaveBeenCalledTimes(1);
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

  it("Enter 는 지시 단계에서 실행하고 검토 단계에서 적용한다", async () => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
    const onApply = vi.fn();
    const run = vi.fn(async () => fakePendingResult({ onApply }));
    openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "숲으로 채워",
      run: run as never,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    document.body.focus();

    pressKeyOnDocument("Enter");
    expect(run).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    await flush();

    document.body.focus();
    pressKeyOnDocument("Enter");
    expect(run).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    await flush();
  });
});
