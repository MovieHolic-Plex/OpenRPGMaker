// test/regionTaskUiAudit.test.ts
// 2026-08-30 영역 작업 UI 감사에서 고친 것들의 회귀 가드.
// 각 테스트는 "예전에 화면에서 무엇이 잘못 읽혔는지"를 주석에 남긴다 — 되돌아가면 여기서 잡힌다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { Project } from "@/project/types";

const REGION: RegionRect = { x: 0, y: 0, width: 3, height: 3 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function stubProject(lower: number[] = []): Project {
  const w = 10, h = 10;
  const lowerTiles = new Array(w * h).fill(0);
  const upperTiles = new Array(w * h).fill(-1);
  for (let i = 0; i < lower.length && i < w * h; i += 1) lowerTiles[i] = lower[i]!;
  return {
    maps: {
      m1: { id: "m1", name: "맵", width: w, height: h, tileSize: 16, lowerTiles, upperTiles, events: [] },
    },
    tilesets: {},
  } as unknown as Project;
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

describe("추천 카테고리 줄", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  it("카테고리를 고르면 「전체 추천」으로 돌아가는 칩이 함께 뜬다", () => {
    // 예전에는 카테고리를 고르면 칩이 1개만 남고 줄이 비어 보였고, 되돌아가는 길(같은 칩 다시
    // 누르기)이 화면에 표시되지 않아 필터를 걸면 나가는 문이 사라진 것처럼 보였다.
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    expect(findByTestId(root, "region-suggest-reset")).toBeNull();
    const polish = findByTestId(root, "region-category-polish") as unknown as HTMLElement | null;
    expect(polish).not.toBeNull();
    polish?.click();
    const reset = findByTestId(root, "region-suggest-reset") as unknown as HTMLElement | null;
    expect(reset).not.toBeNull();
    reset?.click();
    expect(findByTestId(root, "region-suggest-reset")).toBeNull();
  });

  it("어느 카테고리를 골라도 명령 칩이 2개 이상 남는다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    for (const id of ["tiles", "structures", "polish", "npc", "interaction", "combat", "mood", "composite"]) {
      const chip = findByTestId(root, `region-category-${id}`) as unknown as HTMLElement | null;
      if (!chip) continue;
      chip.click();
      const row = findByTestId(root, "region-task-suggestions");
      const buttons = row?.querySelectorAll("button") ?? [];
      // 「전체 추천」 칩 1개 + 명령 칩 2개 이상.
      expect(buttons.length, `${id} 카테고리`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("`/` 자동완성", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  it("카테고리가 켜져 있으면 그 카테고리 안에서 찾는다", () => {
    // 예전에는 「다듬기」를 골라 둔 채 `/` 를 쳐도 전체 목록이 나왔다 — 칩 필터와 `/` 목록이
    // 서로 다른 상태를 보고 있었다.
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    (findByTestId(root, "region-category-polish") as unknown as HTMLElement | null)?.click();
    const input = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    if (input) input.value = "/";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    const list = findByTestId(root, "region-task-autocomplete");
    expect(list?.classList.contains("hidden")).toBe(false);
    const labels = Array.from(list?.querySelectorAll("button") ?? []).map((item) => item.textContent ?? "");
    expect(labels.length).toBeGreaterThan(0);
    // 다듬기 카테고리에 없는 명령(상인·오두막)은 목록에 없다.
    expect(labels.join("|")).not.toContain("상인");
    expect(labels.join("|")).not.toContain("오두막");
  });
});

describe("AI 없이 실내 초안 줄", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  it("섹션 제목과 버튼이 같은 문구를 두 번 말하지 않는다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const button = findByTestId(root, "region-task-direct-room");
    expect(button?.textContent).toBe("초안 만들기");
    const disclosure = findByTestId(root, "region-task-direct-disclosure");
    expect(disclosure?.textContent).toContain("AI 없이 실내 초안 만들기");
    // 같은 문구가 두 번 나오지 않는다(제목 1회).
    const occurrences = (disclosure?.textContent ?? "").split("AI 없이 실내 초안").length - 1;
    expect(occurrences).toBe(1);
  });
});

describe("검토 화면", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  async function openReview(): Promise<FakeElement> {
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
        issues: [],
        blockers: [],
        checkpoints: [
          { id: "draft", label: "분리 초안", status: "done", detail: "ready" },
          { id: "approval", label: "내 결정 대기", status: "pending", detail: "적용 또는 버리기 선택" },
        ],
        metrics: {
          changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
          scheduledNpcs: 1, scheduleEntries: 1, timeSystemEnabled: false, roomSessions: 0,
          roomScoreAverage: null, deterministicRepairs: 0, unreachableObjectives: 2,
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

  it("부분 적용은 「고급」 밖, 검토 본문에 있다", async () => {
    // 예전에는 「고급(로그·부분 적용·스탬프)」 안이라, 검토의 핵심 결정을 하려면 접힌 섹션을
    // 열고 로그를 지나쳐 내려가야 했다.
    const root = await openReview();
    const compare = findByTestId(root, "region-task-compare-actions");
    expect(compare).not.toBeNull();
    const partial = findByTestId(root, "region-task-partial-host");
    expect(partial).not.toBeNull();
    // 부분 적용 호스트가 고급 본문(advanced-body) 안에 있지 않다.
    let node: FakeElement | null = partial as FakeElement | null;
    let insideAdvanced = false;
    while (node) {
      if (node.classList?.contains?.("region-task-advanced-body")) insideAdvanced = true;
      node = (node.parentNode as FakeElement | null) ?? null;
    }
    expect(insideAdvanced).toBe(false);
  });

  it("「승인 대기」는 통과 체크가 아니라 대기 상태로 그린다", async () => {
    const root = await openReview();
    const timeline = findByTestId(root, "region-task-checkpoint-timeline");
    // fakeDom 은 복합 클래스 선택자(.a.b)를 지원하지 않는다 — 한 클래스로 뽑고 걸러 본다.
    const checkpoints = Array.from(timeline?.querySelectorAll(".region-task-checkpoint") ?? []);
    const pending = checkpoints.find((chip) => chip.className.includes("is-pending"));
    expect(pending).toBeTruthy();
    expect(pending?.textContent).toContain("결정 대기");
    // 통과 체크와 같은 클래스를 쓰지 않는다.
    expect(pending?.className).not.toContain("is-done");
  });

  it("지표는 항목 칩이고 나쁜 값만 강조한다", async () => {
    // 예전에는 "변경 3칸 · 이벤트 0 · 통행 3칸 · 수리 0 · 목표 0개 도달 · 조합 100점 …" 한 줄이라
    // 무엇이 문제인지 읽을 수 없었다.
    const root = await openReview();
    const metrics = findByTestId(root, "region-task-review-metrics");
    const chips = Array.from(metrics?.querySelectorAll(".region-task-metric") ?? []);
    expect(chips.length).toBeGreaterThan(1);
    const warned = chips
      .filter((chip) => chip.className.includes("is-warn"))
      .map((chip) => chip.textContent ?? "");
    // 못 가는 목표 2개 + 시간 시스템 꺼짐(NPC 일정이 있는데) 둘 다 경고다.
    expect(warned.join("|")).toContain("못 가는 목표 2개");
    expect(warned.join("|")).toContain("시간 시스템 꺼짐");
    expect(metrics?.textContent).toContain("바뀐 칸 3칸");
  });

  it("미리보기에 비교 방법 안내가 있다", async () => {
    const root = await openReview();
    expect(findByTestId(root, "region-task-preview-hint")?.textContent).toContain("이전");
  });
});
