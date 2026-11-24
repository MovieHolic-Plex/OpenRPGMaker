import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getPendingRegionApply, setPendingRegionApply, subscribePendingRegionApply, __clearPendingRegionApplyForTest, type PendingRegionApplyInput } from "@/editor/regionTask/pendingRegionApply";
import { createBlankProject, createBlankProject as createBlankDefaultProject } from "@/project/defaults";
import type { Project, GameEvent } from "@/project/types";
import { closeRegionTaskModal, openRegionTaskModal, placePopoverBesideRect, isRegionTaskRegionLocked, positionRegionTaskPopover, retargetRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { type RegionTaskResult, runRegionTask, type RegionTaskDeps } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, flushFakeAnimationFrames, installFakeDom } from "./fakeDom";
import { clearAgentGhostPreview, subscribeAgentGhostPreview, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { clipEventsToRegion, clipMapCellsToRegion, type RegionRect } from "@/editor/regionTask/clipToRegion";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import { approvedReview } from "./independentReviewFixture";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("pendingRegionApply", () => {
  isolateTimers();
  const fakeProject = createBlankProject();
  function input(overrides: Partial<PendingRegionApplyInput> = {}): PendingRegionApplyInput {
    return {
      baseProject: fakeProject,
      clippedProject: fakeProject,
      mapId: fakeProject.startMapId,
      region: { x: 1, y: 2, width: 3, height: 4 },
      changedCells: 5,
      changedEvents: 1,
      instruction: "테스트",
      getCurrentProject: () => fakeProject,
      onApply: () => {},
      onDiscard: () => {},
      onSettle: () => {},
      ...overrides,
    };
  }
  describe("pendingRegionApply", () => {
    beforeEach(() => __clearPendingRegionApplyForTest());

    it("set 후 get으로 조회되고 apply는 onApply→onSettle 순서로 1회만 부른다", () => {
      const calls: string[] = [];
      const pending = setPendingRegionApply(input({
        onApply: () => calls.push("apply"),
        onSettle: () => calls.push("settle"),
      }));
      expect(getPendingRegionApply()).toBe(pending);
      expect(pending.settled).toBe(false);
      pending.apply();
      pending.apply(); // 두 번째는 no-op
      expect(calls).toEqual(["apply", "settle"]);
      expect(pending.settled).toBe(true);
      expect(getPendingRegionApply()).toBeNull();
    });

    it("discard는 onDiscard→onSettle을 부르고 이후 apply는 no-op", () => {
      const calls: string[] = [];
      const pending = setPendingRegionApply(input({
        onApply: () => calls.push("apply"),
        onDiscard: () => calls.push("discard"),
        onSettle: () => calls.push("settle"),
      }));
      pending.discard();
      pending.apply();
      expect(calls).toEqual(["discard", "settle"]);
      expect(getPendingRegionApply()).toBeNull();
    });

    it("새 pending 설정 시 기존 미해소 pending을 자동 discard 한다", () => {
      const calls: string[] = [];
      setPendingRegionApply(input({ onDiscard: () => calls.push("old-discard") }));
      const next = setPendingRegionApply(input({ instruction: "새 작업" }));
      expect(calls).toEqual(["old-discard"]);
      expect(getPendingRegionApply()).toBe(next);
    });

    it("구독자는 set/settle 때 호출된다", () => {
      let notified = 0;
      const unsubscribe = subscribePendingRegionApply(() => { notified += 1; });
      const pending = setPendingRegionApply(input());
      pending.discard();
      unsubscribe();
      setPendingRegionApply(input());
      expect(notified).toBe(2); // set 1회 + discard(settle) 1회
    });
  });
});

// test/regionTaskApplyFlow.test.ts
// 우클릭 드래그 → 영역 작업의 **결정(적용)** 경로 계약.
//
// 고정하는 네 가지:
//  1) 팝오버는 대상 영역 옆에 선다(자기가 바꾸는 곳과 캔버스 고스트 미리보기를 덮지 않는다).
//  2) 검토 단계는 결정 우선 순서다 — 결정 버튼 줄이 진단(details)보다 앞에 온다.
//  3) 검토 단계의 Enter 는 "적용"이다. 예전에는 단계와 무관하게 execute() 라서, 결과를 보고
//     Enter 를 누르면 방금 만든 제안을 버리고 AI 를 한 번 더 호출했다.
//  4) 탐색용 변경 행이 포커스를 가진 Enter 는 제안 전체 적용으로 새지 않는다.
describe("regionTaskApplyFlow", () => {
  isolateTimers();
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
        // ⚠ 생성기 키워드가 없는 문장이어야 한다 — "숲으로 채워" 는 이제 키워드 라우터가
        //   forest 생성기로 보내므로 조수 러너(run)가 불리지 않는다(스펙 §5.1).
        initialInstruction: "상인 NPC 를 놓아줘",
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
});

describe("regionTaskClip", () => {
  isolateTimers();
  const MAP_ID = "map_clip";
  const W = 10;
  function baseProject(width = W, height = W): Project {
    const context = { project: createBlankProject() };
    const result = runTool(context, "create_map", { id: MAP_ID, name: "클립 테스트", width, height });
    expect(result.ok, result.summary).toBe(true);
    return context.project;
  }
  function idx(x: number, y: number): number {
    return y * W + x;
  }
  const REGION: RegionRect = { x: 1, y: 1, width: 3, height: 3 };   // x,y ∈ {1,2,3}

  describe("clipMapCellsToRegion", () => {
    it("영역 밖 lower/upper 변경을 base로 되돌리고 영역 안은 보존한다", () => {
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      base.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안
      proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 영역 밖
      proposed.maps[MAP_ID].upperTiles[idx(8, 7)] = 9; // 영역 밖

      const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      expect(project.maps[MAP_ID].lowerTiles[idx(2, 2)]).toBe(5);
      expect(project.maps[MAP_ID].lowerTiles[idx(8, 8)]).toBe(TILE.EMPTY);
      expect(project.maps[MAP_ID].upperTiles[idx(8, 7)]).toBe(TILE.EMPTY);
      expect(clippedCells).toBe(2); // (8,8), (8,7)
    });

    it("영역 안 변경만 있으면 clippedCells=0이고 proposed를 그대로 반환한다", () => {
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].lowerTiles[idx(1, 1)] = 3;
      proposed.maps[MAP_ID].lowerTiles[idx(3, 3)] = 4;

      const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      expect(clippedCells).toBe(0);
      expect(project).toBe(proposed); // 무클립 시 동일 참조
    });

    it("base를 변형하지 않는다(순수)", () => {
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      const beforeLower = base.maps[MAP_ID].lowerTiles.slice();
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].lowerTiles[idx(9, 9)] = 42;

      clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      expect(base.maps[MAP_ID].lowerTiles).toEqual(beforeLower);
    });

    it("영역 밖 tileStacks도 base 상태로 복원한다", () => {
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].upperTileStacks = { [idx(9, 9)]: [1, 2], [idx(2, 2)]: [3] };

      const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      // 영역 밖 (9,9) 스택은 제거(base엔 없음), 영역 안 (2,2) 스택은 보존.
      expect(project.maps[MAP_ID].upperTileStacks?.[idx(9, 9)]).toBeUndefined();
      expect(project.maps[MAP_ID].upperTileStacks?.[idx(2, 2)]).toEqual([3]);
      expect(clippedCells).toBe(1);
    });

    it("대상 맵의 비타일 필드와 다른 맵 변경은 통과시킨다", () => {
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      const otherId = Object.keys(base.maps).find((id) => id !== MAP_ID);
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].name = "변경된 이름";
      proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 클립 대상
      if (otherId) proposed.maps[otherId].lowerTiles[0] = 99;

      const { project } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      expect(project.maps[MAP_ID].name).toBe("변경된 이름");
      expect(project.maps[MAP_ID].lowerTiles[idx(8, 8)]).toBe(TILE.EMPTY);
      if (otherId) expect(project.maps[otherId].lowerTiles[0]).toBe(99);
    });

    // 영역 작업은 맵 크기를 못 바꾼다 — 리사이즈는 영역 밖 변경이라 원래 맵으로 되돌리고 바뀐 폭·높이 합을 센다(clipToRegion.ts 크기 분기).
    it("맵 크기가 다르면(리사이즈) 원래 맵으로 되돌린다", () => {
      const base = baseProject();
      const proposed: Project = structuredClone(base);
      proposed.maps[MAP_ID].width = W + 2;
      proposed.maps[MAP_ID].lowerTiles = new Array((W + 2) * W).fill(3);

      const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

      expect(clippedCells).toBe(2);
      expect(project.maps[MAP_ID]).toBe(base.maps[MAP_ID]);
    });
  });
  // 이 블록이 고정하는 것: "영역 밖 이동을 막는다" 가 **삭제가 아니라 원상 복구**여야 한다.
  // 예전 구현은 `밖(base) + 안(proposed)` 두 목록을 이어 붙였고, 그래서 안에 있던 이벤트를
  // 모델이 1칸 밖으로 옮기면 두 목록 어디에도 들지 못해 이벤트가 통째로 사라졌다.
  describe("clipEventsToRegion", () => {
    const npc = (id: string, x: number, y: number): GameEvent => ({
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
    });

    it("영역 안 → 밖으로 옮긴 이벤트는 사라지지 않고 원위치로 되돌아온다", () => {
      const base = [npc("ev_in", 2, 2)];
      const proposed = [npc("ev_in", 8, 8)]; // 영역 밖

      const result = clipEventsToRegion(base, proposed, REGION);

      expect(result.map((event) => event.id)).toEqual(["ev_in"]);
      expect(result[0]).toMatchObject({ x: 2, y: 2 });
    });

    it("영역 밖 → 안으로 끌어온 이벤트는 밖 상태가 정본이고 id 가 중복되지 않는다", () => {
      const base = [npc("ev_out", 8, 8)];
      const proposed = [npc("ev_out", 2, 2)]; // 영역 안으로 이동 시도

      const result = clipEventsToRegion(base, proposed, REGION);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "ev_out", x: 8, y: 8 });
    });

    it("영역 안 이동은 허용하고, 영역 안 삭제도 허용한다(다듬기 전권)", () => {
      const base = [npc("ev_a", 1, 1), npc("ev_b", 3, 3), npc("ev_far", 9, 9)];
      const proposed = [npc("ev_a", 2, 3), npc("ev_far", 9, 9)]; // ev_b 삭제

      const result = clipEventsToRegion(base, proposed, REGION);

      const byId = new Map(result.map((event) => [event.id, event]));
      expect(byId.get("ev_a")).toMatchObject({ x: 2, y: 3 });
      expect(byId.has("ev_b")).toBe(false);
      expect(byId.get("ev_far")).toMatchObject({ x: 9, y: 9 });
    });

    it("영역 밖 신규 이벤트는 통과시키지 않는다", () => {
      const result = clipEventsToRegion([], [npc("ev_new", 8, 8)], REGION);
      expect(result).toEqual([]);
    });

    it("영역 안 신규 이벤트는 통과시킨다", () => {
      const result = clipEventsToRegion([], [npc("ev_new", 2, 2)], REGION);
      expect(result.map((event) => event.id)).toEqual(["ev_new"]);
    });

    it("영역 밖 이벤트 삭제는 되돌린다 — 밖은 base 가 정본이다", () => {
      const result = clipEventsToRegion([npc("ev_far", 9, 9)], [], REGION);
      expect(result.map((event) => event.id)).toEqual(["ev_far"]);
    });
  });
  describe("runRegionTask live ghost preview", () => {
    beforeEach(() => __clearPendingRegionApplyForTest());
    afterEach(() => __clearPendingRegionApplyForTest());

    it("성공한 쓰기 tool_call 뒤 세션 draft diff 프리뷰를 발행하고 승인 해소 시 clear한다", async () => {
      clearAgentGhostPreview();
      const base = baseProject();
      base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
      const draft: Project = structuredClone(base);
      draft.maps[MAP_ID].lowerTiles[idx(2, 2)] = 42;
      const seen: AgentGhostPreviewState[] = [];
      const unsubscribe = subscribeAgentGhostPreview((state) => seen.push(state));
      // 생산 세션과 같은 순서로 검수-준비 변환을 거친 후보를 발행한다:
      // runRegionTask가 등록한 setReviewDraftTransform(영역 클립 + 하우스 가드)을
      // sendUserMessage 안에서 후보에 적용하고, 독립 검수 승인 리뷰를 담은 턴을 반환한다.
      let candidate: Project = draft;
      let prepare: ((project: Project) => Project) | undefined;
      const deps: RegionTaskDeps = {
        getProject: () => base,
        applyProject: () => undefined,
        createSession: () => ({
          getProposedProject: () => candidate,
          setReviewDraftTransform: (transform) => { prepare = transform; },
          sendUserMessage: async (_message, onEvent) => {
            candidate = prepare?.(candidate) ?? candidate;
            onEvent?.({
              type: "tool_call",
              name: "paint_tiles",
              args: { mapId: MAP_ID },
              result: { ok: true, summary: "타일 변경" },
            });
            return { assistantText: "", proposedCalls: [], stoppedReason: "final", review: approvedReview };
          },
        }),
      };

      const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "칠해줘" }, deps);

      expect(result.ok).toBe(true);
      expect(seen.some((state) => state.previews.some((preview) =>
        preview.mapId === MAP_ID && preview.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")
      ))).toBe(true);
      // 승인 게이트(기본): run 직후에도 승인 전까지 고스트 프리뷰가 유지된다.
      expect(result.pending).toBeDefined();
      expect(seen.at(-1)?.previews.length).toBeGreaterThan(0);
      // discard로 게이트가 해소되면 그제서야 clear된다.
      const pending = result.pending;
      expect(pending).toBeDefined();
      pending?.discard();
      expect(seen.at(-1)?.previews).toEqual([]);
      unsubscribe();
    });
  });
});

// 영역작업(AI) 뒤의 검증게이트 배제 계약 (2026-08-30).
//
// 이 파일이 지키는 것은 하나다: **AI 가 만든 영역 초안은 사용자 결정에만 종속된다.**
// 진단(reviewRegionDraft)은 사실을 보고하되 적용을 거부하지도, 초안을 고치지도 못한다.
// 유일하게 남은 거부 사유는 기준 프로젝트 변경(stale base)과 적용 자체의 실패다.
describe("regionTaskGateExcluded", () => {
  isolateTimers();
  // TILE.* 는 합본 마을 칩 번호다 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵이 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;
  /** (1,1) 만 통행 가능하고 주변이 벽이라 시작 위치에서 갈 수 없는 초안. */
  function isolatedCellDraft(base: Project): Project {
    const draft = structuredClone(base);
    const map = draft.maps[draft.startMapId]!;
    for (let y = 0; y <= 2; y += 1) {
      for (let x = 0; x <= 2; x += 1) {
        // (1,1) 도 "변경된 셀" 이어야 진단 대상이 된다 — 통행 가능한 다른 타일로 바꾼다.
        map.lowerTiles[y * map.width + x] = x === 1 && y === 1 ? TILE.DARK_GRASS : TILE.WALL;
      }
    }
    return draft;
  }
  afterEach(() => __clearPendingRegionApplyForTest());
  describe("reviewRegionDraft — 진단만 하고 초안은 건드리지 않는다", () => {
    it("고립된 통행 셀을 error 로 보고하지만 원본으로 되돌리지 않는다", () => {
      const base = createBlankProject();
      const draft = isolatedCellDraft(base);
      const reviewed = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });

      expect(reviewed.report.issues.some((issue) =>
        issue.code === "disconnected-passable-cell" && issue.severity === "error")).toBe(true);
      // 예전에는 여기서 결정론 수리가 셀을 원본으로 복구했다 — 유령 미리보기와 적용 결과가 갈라졌다.
      expect([...reviewed.project.maps[base.startMapId]!.lowerTiles])
        .toEqual([...draft.maps[base.startMapId]!.lowerTiles]);
    });

    it("도달할 수 없는 자동 소품 조사 이벤트를 지우지 않는다", () => {
      const base = createBlankProject();
      const draft = isolatedCellDraft(base);
      draft.maps[base.startMapId]!.events.push({
        id: "ev_inspect_barrel",
        x: 1,
        y: 1,
        trigger: "action",
        commands: [{ kind: "text", body: "낡은 통이다" }],
      } as unknown as Project["maps"][string]["events"][number]);

      const reviewed = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });

      expect(reviewed.project.maps[base.startMapId]!.events.some((event) => event.id === "ev_inspect_barrel"))
        .toBe(true);
      expect(reviewed.report.issues.some((issue) => issue.code === "gameplay-event-unreachable")).toBe(true);
    });
  });
  describe("pendingRegionApply — 진단은 적용을 막지 못한다", () => {
    it("error 등급 소견이 있어도 사용자가 적용하면 적용된다", () => {
      const base = createBlankProject();
      const draft = isolatedCellDraft(base);
      let applied: Project | null = null;
      const pending = setPendingRegionApply({
        baseProject: base,
        clippedProject: draft,
        mapId: base.startMapId,
        region: REGION,
        changedCells: 8,
        changedEvents: 0,
        instruction: "벽으로 막힌 칸을 만든다",
        report: reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION }).report,
        getCurrentProject: () => base,
        onApply: (project) => { applied = project; },
        onDiscard: () => undefined,
        onSettle: () => undefined,
      });

      expect(pending.report?.issues.some((issue) => issue.severity === "error")).toBe(true);
      expect(pending.apply()).toMatchObject({ ok: true, applied: true });
      expect(applied).not.toBeNull();
      expect(pending.settled).toBe(true);
    });

    it("진단기가 예외를 던져도 적용은 진행된다", () => {
      const base = createBlankProject();
      let applies = 0;
      const pending = setPendingRegionApply({
        baseProject: base,
        clippedProject: structuredClone(base),
        mapId: base.startMapId,
        region: REGION,
        changedCells: 1,
        changedEvents: 0,
        instruction: "진단 실패",
        getCurrentProject: () => base,
        reviewProject: () => { throw new Error("진단기 버그"); },
        onApply: () => { applies += 1; },
        onDiscard: () => undefined,
        onSettle: () => undefined,
      });

      expect(pending.apply()).toMatchObject({ ok: true, applied: true });
      expect(applies).toBe(1);
      expect(pending.lastApplyError).toBeUndefined();
    });

    it("기준 프로젝트가 바뀌면 여전히 거부한다 — 이것은 검증이 아니라 동시편집 보호다", () => {
      const base = createBlankProject();
      const moved = structuredClone(base);
      moved.meta.title = "사용자가 그사이에 바꾼 프로젝트";
      let applies = 0;
      const pending = setPendingRegionApply({
        baseProject: base,
        clippedProject: structuredClone(base),
        mapId: base.startMapId,
        region: REGION,
        changedCells: 1,
        changedEvents: 0,
        instruction: "stale base",
        getCurrentProject: () => moved,
        onApply: () => { applies += 1; },
        onDiscard: () => undefined,
        onSettle: () => undefined,
      });

      const outcome = pending.apply();
      expect(outcome).toMatchObject({ ok: false, applied: false });
      expect(outcome.error).toContain("기준 프로젝트");
      expect(applies).toBe(0);
    });
  });
});

describe("regionTaskModal", () => {
  isolateTimers();
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
      expect(chip?.querySelector("svg")).not.toBeNull();
    });

    it("빈 지시로 실행하면 다듬기로 간다 — 버튼 하나가 두 뜻을 겸한다", () => {
      restoreDom = installFakeDom();
      const run = vi.fn();
      const root = openModal({ mapId: "m1", region: REGION, run });
      // 예전에는 "지시 내용을 입력하세요" 로 막았다. 빈 사각형에 할 수 있는 일이 하나뿐인데
      // (주변과 어울리게) 그걸 막고 다른 버튼을 찾게 하는 것은 왕복만 만든다(스펙 §5).
      expect(findByTestId(root, "region-task-run")?.textContent).toContain("다듬기");
      findByTestId(root, "region-task-run")?.click();
      expect(run).toHaveBeenCalledTimes(1);
      expect(run.mock.calls[0]![0]).toMatchObject({ mode: "polish" });
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
      expect(summary).toContain("적용됨");
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
      // ⚠ "나무" 는 생성기 키워드다 — 이제 forest 생성기로 라우팅되어 조수 러너가 안 불린다.
      if (input) input.value = "상인 NPC 를 놓아줘";
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
  // 창이 비모달이 된 뒤로 사용자는 창을 띄운 채 캔버스에서 영역을 다시 잡을 수 있다.
  // 그때 선택만 바뀌고 창이 옛 영역을 들고 있으면 「적용」이 **화면에 보이는 선택이 아닌**
  // 옛 영역을 고친다. 그래서 EditScene 의 우클릭 드래그가 이 두 함수로 창을 갈아 끼운다.
  describe("영역 재지정 (retargetRegionTaskModal)", () => {
    it("지시 단계에서는 새 영역으로 갈아 끼우고 적어 둔 지시문을 옮겨 온다", () => {
      restoreDom = installFakeDom();
      const root = openModal({ mapId: "m1", region: REGION, run: vi.fn() });
      const input = findByTestId(root, "region-task-input");
      if (input) input.value = "길을 깔아줘";
      expect(isRegionTaskRegionLocked()).toBe(false);

      expect(retargetRegionTaskModal({ x: 9, y: 9, width: 2, height: 2 })).toBe(true);

      // 창은 새로 지어졌으므로 body 에서 다시 찾는다 — 예전 노드는 떼어졌다.
      const body = document.body as unknown as FakeElement;
      expect(findByTestId(body, "region-task-chip")?.textContent).toContain("(9,9) 2×2");
      expect(findByTestId(body, "region-task-input")?.value).toBe("길을 깔아줘");
    });

    it("창이 없으면 아무것도 하지 않고 false", () => {
      restoreDom = installFakeDom();
      expect(isRegionTaskRegionLocked()).toBe(false);
      expect(retargetRegionTaskModal({ x: 1, y: 1, width: 3, height: 3 })).toBe(false);
    });

    it("실행 중에는 영역이 잠긴다 — 돌고 있는 작업을 말없이 버리지 않는다", async () => {
      restoreDom = installFakeDom();
      // 끝나지 않는 runner: 실행 단계에 머문다.
      const run = vi.fn(() => new Promise<never>(() => {}));
      const root = openModal({ mapId: "m1", region: REGION, run: run as never });
      const input = findByTestId(root, "region-task-input");
      // 생성기 키워드가 없는 문장 — 끝나지 않는 조수 러너에 머물러야 실행 단계가 유지된다.
      if (input) input.value = "상인 NPC 를 놓아줘";
      findByTestId(root, "region-task-run")?.click();
      await flush();

      expect(isRegionTaskRegionLocked()).toBe(true);
      expect(retargetRegionTaskModal({ x: 9, y: 9, width: 2, height: 2 })).toBe(false);
      expect(findByTestId(root, "region-task-chip")?.textContent).toContain("(2,3) 4×5");
    });
  });
  function fakePendingResult(overrides: Partial<RegionTaskResult> = {}): RegionTaskResult {
    const base = { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never;
    const clipped = { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: { x: 0, y: 0, width: 2, height: 2 },
      changedCells: 3,
      changedEvents: 0,
      instruction: "테스트",
      getCurrentProject: () => base,
      reviewProject: (project) => ({
        project,
        report: { issues: [], metrics: {} } as never,
      }),
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

    it("추천 칩이 SVG 아이콘과 라벨을 렌더한다", () => {
      restoreDom = installFakeDom();
      // 계열 소제목 검사는 「모두 보기」 시트와 함께 사라졌다 — 진입 화면에 계열이 없다.
      const root = openModal({ mapId: "m1", region: REGION });
      const chip = root.querySelector(".region-task-suggest-chip");
      expect(chip).not.toBeNull();
      expect(chip?.querySelector("svg")).not.toBeNull();
      expect(chip?.querySelector(".region-task-chip-label")).not.toBeNull();
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
});
