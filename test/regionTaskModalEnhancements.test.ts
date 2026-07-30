// test/regionTaskModalEnhancements.test.ts
// 영역 작업 박스 고도화(A 부분 적용 + E 동적 추천 + F 단축키/자동완성/통계칩) 통합 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeRegionTaskModal,
  openRegionTaskModal,
} from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { runDirectInteriorRoomDraft } from "@/editor/regionTask/runDirectRoomDraft";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { Project, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 0, y: 0, width: 3, height: 3 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

// 기존 regionTaskModal.test.ts 의 flush 패턴 — microtask 큐 draining.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

/** 최소 project 스텁 — E/F 순수 함수가 안전하게 동작할 만큼의 shape. */
function stubProject(lower: number[] = [], upper: number[] = []): Project {
  const w = 10, h = 10;
  const lowerTiles = new Array(w * h).fill(0);
  const upperTiles = new Array(w * h).fill(-1);
  for (let i = 0; i < lower.length && i < w * h; i += 1) lowerTiles[i] = lower[i]!;
  for (let i = 0; i < upper.length && i < w * h; i += 1) upperTiles[i] = upper[i]!;
  return {
    maps: {
      m1: { id: "m1", name: "맵", width: w, height: h, tileSize: 16, lowerTiles, upperTiles, events: [] },
    },
    tilesets: {},
  } as unknown as Project;
}

describe("F: 영역 통계 칩", () => {
  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  it("헤더에 통계 칩이 렌더된다 (빈 값이 아니면 텍스트 표시)", () => {
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      projectForContext: () => stubProject([240, 240, 240, 240, 240, 240, 240, 240, 240]),
    });
    const chip = findByTestId(root, "region-task-stats-chip");
    expect(chip).not.toBeNull();
    expect(chip?.textContent || "").not.toBe("");
  });
});

describe("E: 동적 추천", () => {
  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  it("projectForContext 주입 시 추천 칩 4개 렌더", () => {
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      projectForContext: () => stubProject(),
    });
    const suggestions = findByTestId(root, "region-task-suggestions");
    expect(suggestions).not.toBeNull();
    const chips = suggestions?.querySelectorAll("button");
    expect(chips?.length).toBe(4);
  });
});

describe("A: 부분 적용", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  // 공통: pending 결과를 만들어 모달에 전달하고 비교 UI가 렌더될 때까지 flush.
  async function setupPartialApply(): Promise<FakeElement> {
    const base = stubProject([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const clipped = stubProject([120, 120, 120, 0, 0, 0, 0, 0, 0]);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: REGION,
      changedCells: 3,
      changedEvents: 0,
      instruction: "물 채우기",
      getCurrentProject: () => base,
      report: {
        issues: [{ code: "npc-schedule-time-disabled", severity: "warning", message: "NPC 일정은 시간 시스템이 필요합니다." }],
        blockers: [],
        checkpoints: [
          { id: "draft", label: "분리 초안", status: "done", detail: "ready" },
          { id: "approval", label: "승인 대기", status: "done", detail: "ready" },
        ],
        metrics: {
          changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
          scheduledNpcs: 1, scheduleEntries: 1, timeSystemEnabled: false, roomSessions: 0,
          roomScoreAverage: null, deterministicRepairs: 0,
        },
        repairLimit: 8,
      },
      onApply: () => {},
      onDiscard: () => {},
      onSettle: () => {},
    });
    const result: RegionTaskResult = {
      ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
      proposedCalls: 1, assistantText: "", pending,
    };
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "물 채우기",
      autoRun: true,
      run: async () => result,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => base,
    });
    await flush();
    return root;
  }

  it("pending 시 chunk tree + 부분 적용 버튼 렌더", async () => {
    const root = await setupPartialApply();
    const chunkTree = findByTestId(root, "region-task-chunk-tree");
    expect(chunkTree).not.toBeNull();
    expect(chunkTree?.classList.contains("hidden")).toBe(false);
    expect(findByTestId(root, "region-task-partial-apply")).not.toBeNull();
    // 재설계 전에는 "✓ 모두 적용"이었다. 이제 「선택 적용」은 「고급」 안으로 들어가고
    // 주 버튼은 하나뿐이라 "모두"로 구분할 대상이 없다 — 대신 실제 변경 칸 수를 보여 준다.
    expect(findByTestId(root, "region-task-apply")?.textContent).toContain("적용");
    expect(findByTestId(root, "region-task-apply")?.textContent).toContain("3칸");
  });

  it("부분 적용 라벨은 청크 개수가 아니라 칸 수를 보여 준다", async () => {
    // 회귀 가드: 예전엔 selectedChunkIds.size 를 "N칸"으로 찍어, 3칸짜리 청크 하나를
    // 고르면 "선택 1칸 적용"이라고 표시했다(정반대로 읽히는 오표기).
    const root = await setupPartialApply();
    const partialBtn = findByTestId(root, "region-task-partial-apply");
    expect(partialBtn?.textContent).toContain("3칸");
    expect(partialBtn?.textContent).not.toContain("1칸");
  });

  it("chunk 체크 해제 시 부분 적용 버튼 라벨 갱신", async () => {
    const root = await setupPartialApply();
    const partialBtn = findByTestId(root, "region-task-partial-apply") as unknown as HTMLButtonElement | null;
    expect(partialBtn).not.toBeNull();
    const beforeText = partialBtn?.textContent;
    const firstCb = root.querySelector(".region-task-chunk-cb") as HTMLInputElement | null;
    if (firstCb) {
      firstCb.checked = false;
      firstCb.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(partialBtn?.textContent).not.toEqual(beforeText);
  });
});



describe("safe harness review surface", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  it("shows checkpoint timeline, gameplay metrics, and structured issues in review", async () => {
    const base = stubProject();
    const clipped = stubProject([120, 120, 120]);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: REGION,
      changedCells: 3,
      changedEvents: 0,
      instruction: "안전 검토",
      getCurrentProject: () => base,
      report: {
        issues: [{ code: "schedule", severity: "warning", message: "NPC 일정 확인", mapId: "m1", x: 1, y: 1 }],
        blockers: [],
        checkpoints: [{ id: "draft", label: "분리 초안", status: "done", detail: "ready" }],
        metrics: {
          changedCells: 3, changedEvents: 0, passableChangedCells: 2, isolatedChangedCells: 0,
          scheduledNpcs: 1, scheduleEntries: 1, timeSystemEnabled: false, roomSessions: 0,
          roomScoreAverage: null, deterministicRepairs: 0,
        },
        repairLimit: 8,
      },
      onApply: () => undefined,
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });
    const result: RegionTaskResult = {
      ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
      proposedCalls: 1, assistantText: "", pending, review: pending.report,
    };
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "안전 검토",
      autoRun: true,
      run: async () => result,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => base,
    });
    await flush();
    expect(findByTestId(root, "region-task-checkpoint-timeline")?.textContent).toContain("분리 초안");
    expect(findByTestId(root, "region-task-review-metrics")?.textContent).toContain("NPC 일정 1명");
    expect(findByTestId(root, "region-task-review-issues")?.textContent).toContain("NPC 일정 확인");
  });
});



describe("quota-independent interior entry", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  it("starts a connected room from the UI without invoking the AI runner", async () => {
    const base = createBlankProject();
    const before = JSON.stringify(base);
    const aiRun = vi.fn(async (): Promise<RegionTaskResult> => {
      throw new Error("AI runner must not be called");
    });
    const root = openModal({
      mapId: base.startMapId,
      region: { x: 0, y: 0, width: 4, height: 4 },
      run: aiRun,
      runDirectRoomDraft: (options) => runDirectInteriorRoomDraft({ ...options, seed: 77 }, {
        getProject: () => base,
        applyProject: () => undefined,
      }),
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => base,
    });

    findByTestId(root, "region-task-direct-room")?.click();
    await flush();
    await flush();

    expect(aiRun).not.toHaveBeenCalled();
    expect(findByTestId(root, "region-task-room-controls")).not.toBeNull();
    expect(findByTestId(root, "region-task-room-checkpoint-preview")?.textContent).toContain("완성 실내 미리보기");
    expect(findByTestId(root, "region-task-room-checkpoint-5")?.classList.contains("is-selected")).toBe(true);
    expect(findByTestId(root, "region-task-checkpoint-timeline")?.textContent).toContain("게임플레이 사전검사");
    expect(findByTestId(root, "region-task-partial-apply")).toBeNull();
    expect(JSON.stringify(base)).toBe(before);

    findByTestId(root, "region-task-discard")?.click();
    await flush();
    expect(JSON.stringify(base)).toBe(before);
  });
});
