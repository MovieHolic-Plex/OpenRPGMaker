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
    // 문맥 추천 4개 + 줄 끝의 「모두 보기」 칩 1개.
    const chips = suggestions?.querySelectorAll("button");
    expect(chips?.length).toBe(5);
    expect(findByTestId(root, "region-task-browse-all")).not.toBeNull();
  });
});

describe("A: 부분 적용", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  // 공통: pending 결과를 만들어 모달에 전달하고 비교 UI가 렌더될 때까지 flush.
  // 청크가 **2개, 크기가 다르게** 나오도록 심는다. 청크 묶음은 4방 flood fill 이고 타일 값이
  // 아니라 "바뀌었는지"만 보므로, 두 덩어리 사이에 바뀌지 않은 줄이 있어야 갈라진다.
  // 맵 폭 10 · 영역 3×3 → 인덱스 0·1·2 = 첫 줄, 20 = 셋째 줄 왼쪽, 그 사이 10 은 그대로 둔다.
  // 결과: 3칸 청크 + 1칸 청크 = 4칸. 크기가 같으면 "청크 개수를 칸 수로 찍는" 오표기를 못 잡는다.
  async function setupPartialApply(): Promise<FakeElement> {
    const base = stubProject([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const clippedLower = new Array<number>(21).fill(0);
    clippedLower[0] = 120;
    clippedLower[1] = 120;
    clippedLower[2] = 120;
    clippedLower[20] = 121;
    const clipped = stubProject(clippedLower);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: REGION,
      changedCells: 4,
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
          changedCells: 4, changedEvents: 0, passableChangedCells: 4, isolatedChangedCells: 0,
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
      ok: true, applied: false, changedCells: 4, changedEvents: 0, clippedCells: 0,
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

  it("pending 시 chunk tree 렌더, 적용 버튼은 하나뿐", async () => {
    const root = await setupPartialApply();
    const chunkTree = findByTestId(root, "region-task-chunk-tree");
    expect(chunkTree).not.toBeNull();
    expect(chunkTree?.classList.contains("hidden")).toBe(false);
    // 적용 버튼은 하나다. 예전에는 「적용 · N칸」(전량)과 「선택한 M칸만 적용」(부분)이
    // 따로 있어서, 구역 체크를 풀고 아래 큰 버튼을 누르면 의도와 반대로 전부 적용됐다.
    expect(findByTestId(root, "region-task-partial-apply")).toBeNull();
    expect(findByTestId(root, "region-task-apply")?.textContent).toContain("적용");
    expect(findByTestId(root, "region-task-apply")?.textContent).toContain("4칸");
  });

  it("적용 버튼 라벨은 청크 개수가 아니라 칸 수를 보여 준다", async () => {
    // 회귀 가드: 예전엔 selectedChunkIds.size 를 "N칸"으로 찍어, 3칸짜리 청크 하나를
    // 고르면 "선택 1칸 적용"이라고 표시했다(정반대로 읽히는 오표기).
    const root = await setupPartialApply();
    const apply = findByTestId(root, "region-task-apply");
    const boxes = root.querySelectorAll(".region-task-chunk-cb") as unknown as HTMLInputElement[];
    expect(boxes.length).toBe(2);
    // 1칸 청크(둘째)를 뺀다 → 남는 것은 3칸짜리 청크 하나. 청크 개수로 세면 "1칸"이 된다.
    const second = boxes[1]!;
    second.checked = false;
    second.dispatchEvent(new Event("change", { bubbles: true }));
    expect(apply?.textContent).toContain("3칸");
    expect(apply?.textContent).not.toContain("1칸");
  });

  it("chunk 체크를 풀면 적용 버튼의 라벨과 범위가 함께 좁아진다", async () => {
    const root = await setupPartialApply();
    const apply = findByTestId(root, "region-task-apply") as unknown as HTMLButtonElement | null;
    expect(apply).not.toBeNull();
    expect(apply?.textContent).toContain("4칸");
    const boxes = root.querySelectorAll(".region-task-chunk-cb") as unknown as HTMLInputElement[];
    // 3칸 청크를 뺀다 → 1칸만 남는다.
    const first = boxes[0]!;
    first.checked = false;
    first.dispatchEvent(new Event("change", { bubbles: true }));
    expect(apply?.textContent).toBe("선택한 1칸만 적용");
    expect(apply?.disabled).toBe(false);
    // 전부 풀면 적용할 게 없다 — 버튼이 잠기고 라벨이 다음 행동을 말한다.
    const second = boxes[1]!;
    second.checked = false;
    second.dispatchEvent(new Event("change", { bubbles: true }));
    expect(apply?.textContent).toBe("적용할 구역을 고르세요");
    expect(apply?.disabled).toBe(true);
    // 다시 전부 켜면 전량 라벨로 되돌아온다.
    for (const box of boxes) {
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(apply?.textContent).toContain("4칸");
    expect(apply?.disabled).toBe(false);
  });

  it("부분 선택으로 적용한 뒤 같은 버튼을 다시 눌러도 두 번 적용되지 않는다", async () => {
    const base = stubProject([0, 0, 0]);
    const clipped = stubProject([120, 0, 120]);
    const onApply = vi.fn();
    const report = {
      issues: [],
      blockers: [],
      checkpoints: [],
      metrics: {
        changedCells: 2, changedEvents: 0, passableChangedCells: 2, isolatedChangedCells: 0,
        scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
        roomScoreAverage: null, deterministicRepairs: 0,
      },
      repairLimit: 8,
    } as never;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: REGION,
      changedCells: 2,
      changedEvents: 0,
      instruction: "분리 적용",
      getCurrentProject: () => base,
      report,
      reviewProject: (candidate) => ({ project: candidate, report }),
      onApply,
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });
    const applyProject = vi.spyOn(pending, "applyProject");
    const result: RegionTaskResult = {
      ok: true, applied: false, changedCells: 2, changedEvents: 0, clippedCells: 0,
      proposedCalls: 0, assistantText: "", pending,
    };
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      runDirectRoomDraft: async () => result,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => base,
    });

    findByTestId(root, "region-task-direct-room")?.click();
    await flush();
    const firstCb = root.querySelector(".region-task-chunk-cb") as HTMLInputElement | null;
    expect(firstCb).not.toBeNull();
    if (firstCb) {
      firstCb.checked = false;
      firstCb.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const apply = findByTestId(root, "region-task-apply");
    // 체크를 하나 풀었으니 같은 버튼이 **부분** 적용으로 바뀐다 — 전량 apply() 가 아니라
    // 합성 프로젝트를 넘기는 applyProject() 를 탄다.
    apply?.click();
    expect(applyProject).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    // settle 뒤 남은 activation(포커스 Enter·중복 클릭)은 아무 것도 하지 않는다.
    apply?.click();
    expect(applyProject).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});



describe("safe harness review surface", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  it("shows only blocking checkpoints, warn metrics, and structured issues in review", async () => {
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
    // 통과한 검사("분리 초안" done)는 더 이상 화면에 쓰지 않는다 — 손봐야 하는 것만 남는다.
    expect(findByTestId(root, "region-task-checkpoint-timeline")?.className).toContain("hidden");
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
    // 사전검사를 통과했으면 그 사실을 화면에 쓰지 않는다(초록 체크 줄 없음).
    expect(findByTestId(root, "region-task-checkpoint-timeline")?.textContent ?? "").not.toContain("게임플레이 사전검사");
    // 구조 제안(실내·맵 추가)은 타일만 떼어내면 문·맵 연결이 끊기므로 부분 적용을 제공하지
    // 않는다 — 구역 체크 칸이 숨고, 적용 버튼은 전량 그대로다.
    expect(findByTestId(root, "region-task-partial-host")?.classList.contains("hidden")).toBe(true);
    expect(findByTestId(root, "region-task-apply")?.textContent).toContain("적용");
    expect(JSON.stringify(base)).toBe(before);

    findByTestId(root, "region-task-discard")?.click();
    await flush();
    expect(JSON.stringify(base)).toBe(before);
  });
});
