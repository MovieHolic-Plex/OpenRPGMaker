// 다듬기의 모달 계약 — 진입점·라우팅·승인 화면.
//
// 왜 UI 테스트가 필요한가: 다듬기는 "무엇을 만들지"가 없는 경로다. 입력창이 비어 있어도
// 실행돼야 하고, 승인 화면은 **주변까지 보이는 프레임**이어야 판단이 가능하다. 그리고
// 이벤트가 섞인 초안에서 부분 적용을 켜 두면 composePartialProject 가 타일만 옮기므로
// NPC 이동이 조용히 사라진다 — 그 가드가 실제로 걸려 있는지도 여기서 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import type { GameEvent, Project, RegionRect } from "@/project/types";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const REGION: RegionRect = { x: 3, y: 3, width: 3, height: 3 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  __clearPendingRegionApplyForTest();
  restoreDom = installFakeDom();
});

afterEach(() => {
  closeRegionTaskModal();
  __clearPendingRegionApplyForTest();
  restoreDom?.();
  restoreDom = null;
});

/** 10×10 최소 project 스텁 — 다듬기 미리보기가 맵 경계로 클램프되는 것까지 볼 수 있는 크기. */
function stubProject(options?: {
  readonly lower?: Readonly<Record<number, number>>;
  readonly events?: readonly GameEvent[];
}): Project {
  const w = 10, h = 10;
  const lowerTiles = new Array(w * h).fill(240);
  const upperTiles = new Array(w * h).fill(-1);
  for (const [index, tile] of Object.entries(options?.lower ?? {})) lowerTiles[Number(index)] = tile;
  return {
    maps: {
      m1: {
        id: "m1", name: "맵", width: w, height: h, tileSize: 16,
        lowerTiles, upperTiles, events: [...(options?.events ?? [])],
      },
    },
    tilesets: {},
  } as unknown as Project;
}

const EMPTY_REPORT = {
  issues: [],
  blockers: [],
  checkpoints: [],
  metrics: {
    changedCells: 0, changedEvents: 0, passableChangedCells: 0, isolatedChangedCells: 0,
    scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
    roomScoreAverage: null, deterministicRepairs: 0,
  },
} as never;

/** pending 승인 상태를 만들고 모달에 물려 비교 UI 가 그려질 때까지 flush. */
async function openWithPending(opts: {
  readonly base: Project;
  readonly clipped: Project;
  readonly changedCells: number;
  readonly instruction: string;
  readonly mode?: "task" | "polish";
  readonly report?: unknown;
}): Promise<FakeElement> {
  const pending = setPendingRegionApply({
    baseProject: opts.base,
    clippedProject: opts.clipped,
    mapId: "m1",
    region: REGION,
    changedCells: opts.changedCells,
    changedEvents: 0,
    instruction: opts.instruction,
    getCurrentProject: () => opts.base,
    report: (opts.report ?? EMPTY_REPORT) as never,
    onApply: () => {},
    onDiscard: () => {},
    onSettle: () => {},
  });
  const result: RegionTaskResult = {
    ok: true, applied: false, changedCells: opts.changedCells, changedEvents: 0, clippedCells: 0,
    proposedCalls: 1, assistantText: "", pending,
  };
  const root = openModal({
    mapId: "m1",
    region: REGION,
    initialInstruction: opts.instruction,
    autoRun: true,
    ...(opts.mode ? { mode: opts.mode } : {}),
    run: async () => result,
    renderSnapshot: async () => document.createElement("div"),
    projectForContext: () => opts.base,
  });
  await flush();
  return root;
}

describe("다듬기 진입점", () => {
  it("다듬기 버튼은 입력창이 비어 있어도 실행되고 mode:\"polish\" 로 라우팅한다", async () => {
    const run = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, clippedCells: 0,
      proposedCalls: 0, assistantText: "",
    } as RegionTaskResult));
    const root = openModal({ mapId: "m1", region: REGION, run, projectForContext: () => stubProject() });

    findByTestId(root, "region-task-polish")?.click();
    await flush();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0]).toMatchObject({ mode: "polish", instruction: POLISH_INSTRUCTION });
    // 입력창에도 그 문장이 남아야 「지시 수정」·「다시 만들기」가 같은 지시를 이어받는다.
    const textarea = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement | null;
    expect(textarea?.value).toBe(POLISH_INSTRUCTION);
  });

  it("자유 입력이 어울림 어휘면 다듬기로 라우팅한다", async () => {
    const run = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, clippedCells: 0,
      proposedCalls: 0, assistantText: "",
    } as RegionTaskResult));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "여기를 주변과 어울리게 정리해줘",
      run,
      projectForContext: () => stubProject(),
    });

    findByTestId(root, "region-task-run")?.click();
    await flush();

    expect(run.mock.calls[0]![0]).toMatchObject({ mode: "polish" });
  });

  it("일반 지시는 mode 를 넘기지 않는다 — 기존 호출 계약 유지", async () => {
    const run = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, clippedCells: 0,
      proposedCalls: 0, assistantText: "",
    } as RegionTaskResult));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "이 영역에 작은 오두막 한 채 지어줘",
      run,
      projectForContext: () => stubProject(),
    });

    findByTestId(root, "region-task-run")?.click();
    await flush();

    expect(run.mock.calls[0]![0]).not.toHaveProperty("mode");
  });

  it("options.mode 가 polish 면 autoRun 도 다듬기로 간다 (캔버스 「다듬기」 칩)", async () => {
    const run = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, clippedCells: 0,
      proposedCalls: 0, assistantText: "",
    } as RegionTaskResult));
    openModal({
      mapId: "m1",
      region: REGION,
      // 어휘로도 잡히지 않는 문장을 일부러 준다 — mode 가 실제로 전달되는지 보는 것이 목적이다.
      initialInstruction: "정리해줘",
      autoRun: true,
      mode: "polish",
      run,
      projectForContext: () => stubProject(),
    });
    await flush();

    expect(run.mock.calls[0]![0]).toMatchObject({ mode: "polish" });
  });
});

describe("다듬기 승인 화면", () => {
  const changedLower = { 33: 423, 34: 423, 35: 423 }; // (3,3) (4,3) (5,3)

  it("다듬기 초안 미리보기는 여백을 포함한 격자와 영역 테두리를 그린다", async () => {
    const base = stubProject();
    const clipped = stubProject({ lower: changedLower });
    const root = await openWithPending({
      base, clipped, changedCells: 3, instruction: POLISH_INSTRUCTION, mode: "polish",
    });

    const overlay = findByTestId(root, "region-task-change-overlay");
    expect(overlay).not.toBeNull();
    // 영역 3×3 + 여백 2칸씩 = 7×7 (10×10 맵 안이라 잘리지 않는다).
    expect(overlay?.dataset.cols).toBe("7");
    expect(overlay?.dataset.rows).toBe("7");
    expect(findByTestId(root, "region-task-region-frame")).not.toBeNull();
  });

  it("일반 영역 작업 미리보기는 영역만 크롭한다 — 여백 프레임은 다듬기 전용이다", async () => {
    const base = stubProject();
    const clipped = stubProject({ lower: changedLower });
    const root = await openWithPending({
      base, clipped, changedCells: 3, instruction: "이 영역에 오두막을 지어줘",
    });

    const overlay = findByTestId(root, "region-task-change-overlay");
    expect(overlay?.dataset.cols).toBe("3");
    expect(overlay?.dataset.rows).toBe("3");
    expect(findByTestId(root, "region-task-region-frame")).toBeNull();
  });

  it("이벤트 변경이 섞이면 부분 적용을 숨긴다 — 타일만 옮기면 이벤트가 사라진다", async () => {
    const npc: GameEvent = {
      id: "ev_npc", x: REGION.x + 1, y: REGION.y + 1, trigger: { kind: "action" }, commands: [],
    };
    const base = stubProject();
    // 청크가 2개 이상이어야 부분 적용이 원래 켜진다 — 떨어진 두 칸을 바꾼다.
    const clipped = stubProject({ lower: { 33: 423, 55: 423 }, events: [npc] });
    const root = await openWithPending({
      base, clipped, changedCells: 2, instruction: POLISH_INSTRUCTION, mode: "polish",
    });

    expect(findByTestId(root, "region-task-change-row-event-ev_npc")).not.toBeNull();
    const partialHost = findByTestId(root, "region-task-partial-host");
    expect(partialHost?.classList.contains("hidden")).toBe(true);
  });

  it("경계 어긋남·어울림 하락은 경고 칩으로 뜨고, 좋아진 점수는 침묵한다", async () => {
    const base = stubProject();
    const clipped = stubProject({ lower: changedLower });
    const warn = {
      ...(EMPTY_REPORT as unknown as Record<string, unknown>),
      metrics: {
        changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
        scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
        roomScoreAverage: null, deterministicRepairs: 0,
        blendScore: 48, blendScoreBefore: 62, brokenCrossings: 2, blockedEntrances: 0, seamCells: 4,
      },
    };
    const root = await openWithPending({
      base, clipped, changedCells: 3, instruction: POLISH_INSTRUCTION, mode: "polish", report: warn,
    });

    const metrics = findByTestId(root, "region-task-review-metrics");
    expect(metrics?.classList.contains("hidden")).toBe(false);
    expect(metrics?.textContent).toContain("경계 어긋남 2곳");
    expect(metrics?.textContent).toContain("어울림 62→48");
  });

  it("어울림이 올라간 초안은 지표 칩을 띄우지 않는다", async () => {
    const base = stubProject();
    const clipped = stubProject({ lower: changedLower });
    const good = {
      ...(EMPTY_REPORT as unknown as Record<string, unknown>),
      metrics: {
        changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
        scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: false, roomSessions: 0,
        roomScoreAverage: null, deterministicRepairs: 0,
        blendScore: 94, blendScoreBefore: 71, brokenCrossings: 0, blockedEntrances: 0, seamCells: 6,
      },
    };
    const root = await openWithPending({
      base, clipped, changedCells: 3, instruction: POLISH_INSTRUCTION, mode: "polish", report: good,
    });

    // 손볼 값이 없으면 진단 섹션 자체가 뜨지 않는다 — 이 파일의 기존 원칙이다.
    expect(findByTestId(root, "region-task-diagnostics")).toBeNull();
    expect(root.textContent).not.toContain("어울림");
  });
});
