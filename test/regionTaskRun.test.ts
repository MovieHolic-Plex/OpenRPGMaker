import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRegionTaskMessage,
  countInRegionChangedCells,
  describeRegionTaskResult,
  runRegionTask,
  type RegionTaskDeps,
  type RegionTaskSessionLike,
} from "@/editor/regionTask/runRegionTask";
import { __clearPendingRegionApplyForTest, getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail, type RegionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { implicitSpecFromContext } from "@/ai/buildSpec";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const MAP_ID = "map_region";
const W = 10;
const REGION: RegionRect = { x: 1, y: 1, width: 3, height: 3 };

function baseProject(): Project {
  const context = { project: createBlankProject() };
  const result = runTool(context, "create_map", { id: MAP_ID, name: "영역 맵", width: W, height: W });
  expect(result.ok, result.summary).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  return context.project;
}

function idx(x: number, y: number): number {
  return y * W + x;
}

// window 스텁 — dispatchRegionTaskStatus/REGION_TASK_STATUS_EVENT 배선 검증용
// 최소 이벤트 버스(test/regionTaskStatus.test.ts와 동일 패턴).
function installFakeWindow(): () => void {
  const listeners = new Map<string, EventListener[]>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
    },
  });
  return () => Reflect.deleteProperty(globalThis, "window");
}

// turn result 형태를 만족하는 최소 스텁.
function finalTurn(assistantText = "완료"): TurnResult {
  return { assistantText, proposedCalls: [], stoppedReason: "final" };
}

function makeDeps(base: Project, proposed: Project, session?: Partial<RegionTaskSessionLike>): {
  deps: RegionTaskDeps;
  applied: () => { project: Project; label: string; mapId: string } | null;
} {
  let appliedRef: { project: Project; label: string; mapId: string } | null = null;
  const fullSession: RegionTaskSessionLike = {
    async sendUserMessage(_text, onEvent) {
      onEvent?.({ type: "status", text: "테스트 진행" });
      return finalTurn();
    },
    getProposedProject: () => proposed,
    ...session,
  };
  const deps: RegionTaskDeps = {
    getProject: () => base,
    applyProject: (project, label, mapId) => {
      appliedRef = { project, label, mapId };
    },
    createSession: () => fullSession,
  };
  return { deps, applied: () => appliedRef };
}

describe("buildRegionTaskMessage", () => {
  it("[컨텍스트] 라인이 implicitSpecFromContext에 선택 영역으로 파싱된다", () => {
    const message = buildRegionTaskMessage("여기 채워", "마을 맵", MAP_ID, REGION);
    const spec = implicitSpecFromContext(message);
    expect(spec).not.toBeNull();
    const asset = spec?.assets[0];
    expect(asset).toMatchObject({ x: 1, y: 1, w: 3, h: 3 });
  });
});

describe("countInRegionChangedCells", () => {
  it("영역 안 변경만 센다", () => {
    const base = baseProject();
    const next: Project = structuredClone(base);
    next.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 안
    next.maps[MAP_ID].lowerTiles[idx(9, 9)] = 7; // 밖
    expect(countInRegionChangedCells(base, next, MAP_ID, REGION)).toBe(1);
  });
});

describe("runRegionTask", () => {
  it("기본 세션 생성은 보조 모델(liteModel)로 chat 요청을 만든다", async () => {
    const base = baseProject();
    store.replace(base);
    const bodies: string[] = [];
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => key === AI_CONFIG_STORAGE_KEY
          ? JSON.stringify({
              apiKey: "sk-test",
              baseUrl: "https://example.test/v1",
              liteModel: "region-lite-model",
              maxTokens: 1024,
              model: "region-main-model",
              reasoningEffort: "medium",
            })
          : null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
      },
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "완료" }, finish_reason: "stop" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    try {
      const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "여기 채워" });
      expect(result.ok).toBe(true);
      expect(result.applied).toBe(false);
      expect(JSON.parse(bodies[0]).model).toBe("region-lite-model");
    } finally {
      if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
      else Reflect.deleteProperty(globalThis, "fetch");
      if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("영역 안 변경을 적용하고 영역 밖은 클립한다(undo 1개 형태)", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안
    proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 영역 밖 → 클립 대상
    const { deps, applied } = makeDeps(base, proposed);

    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "여기 채워", gate: "immediate" },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.changedCells).toBe(1);
    expect(result.clippedCells).toBe(1);
    const rec = applied();
    expect(rec).not.toBeNull();
    expect(rec?.mapId).toBe(MAP_ID);
    expect(rec?.label.startsWith("영역 작업:")).toBe(true);
    expect(rec?.project.maps[MAP_ID].lowerTiles[idx(2, 2)]).toBe(5);
    expect(rec?.project.maps[MAP_ID].lowerTiles[idx(8, 8)]).toBe(TILE.EMPTY);
  });

  it("영역 안 변경이 없으면 적용하지 않는다", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 영역 밖만
    const { deps, applied } = makeDeps(base, proposed);

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "여기 채워" }, deps);

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.changedCells).toBe(0);
    expect(result.clippedCells).toBe(1);
    expect(applied()).toBeNull();
  });

  it("영역 안 NPC만 바뀌어도 적용한다(타일 0칸이어도)", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].events = [
      {
        id: "ev_npc_1",
        name: "주민",
        x: 2,
        y: 2,
        pages: [{ id: "p1", conditions: [], trigger: "action", commands: [] }],
      } as Project["maps"][string]["events"][number],
    ];
    const { deps, applied } = makeDeps(base, proposed);
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "NPC 배치", gate: "immediate" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.changedEvents).toBe(1);
    expect(applied()?.project.maps[MAP_ID].events?.some((e) => e.id === "ev_npc_1")).toBe(true);
  });

  it("빈 지시는 오류로 막는다", async () => {
    const base = baseProject();
    const { deps, applied } = makeDeps(base, structuredClone(base));
    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "   " }, deps);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(applied()).toBeNull();
  });

  it("세션 오류를 결과로 전달하고 적용하지 않는다", async () => {
    const base = baseProject();
    const { deps, applied } = makeDeps(base, structuredClone(base), {
      async sendUserMessage() {
        throw new Error("네트워크 실패");
      },
    });
    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "여기 채워" }, deps);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("네트워크");
    expect(applied()).toBeNull();
  });
});

describe("승인 게이트 (gate: approval 기본)", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("성공 시 적용하지 않고 pending을 반환한다", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안
    const { deps, applied } = makeDeps(base, proposed);

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" }, deps);

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.pending).toBeDefined();
    expect(applied()).toBeNull(); // 아직 미적용
    result.pending!.apply();
    expect(applied()).not.toBeNull(); // apply 시점에만 store 반영
    expect(getPendingRegionApply()).toBeNull();
  });

  it("discard 시 applyProject가 호출되지 않는다", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5;
    const { deps, applied } = makeDeps(base, proposed);

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" }, deps);
    result.pending!.discard();
    expect(applied()).toBeNull();
  });

  it("pending.discard() 시 실제 onSettle 배선이 running:false 배지 해제 이벤트를 발행한다", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안
    const { deps } = makeDeps(base, proposed);

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" }, deps);
    expect(result.pending).toBeDefined();

    const restoreWindow = installFakeWindow();
    try {
      const events: (RegionTaskStatusDetail | null)[] = [];
      const listener = (event: Event): void => { events.push(regionTaskStatusDetail(event)); };
      window.addEventListener(REGION_TASK_STATUS_EVENT, listener);
      result.pending!.discard();
      window.removeEventListener(REGION_TASK_STATUS_EVENT, listener);
      expect(events.some((detail) => detail?.mapId === MAP_ID && detail?.running === false)).toBe(true);
    } finally {
      restoreWindow();
    }
  });

  it("gate: immediate는 기존처럼 즉시 적용한다", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5;
    const { deps, applied } = makeDeps(base, proposed);

    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘", gate: "immediate" },
      deps,
    );

    expect(result.applied).toBe(true);
    expect(result.pending).toBeUndefined();
    expect(applied()).not.toBeNull();
  });
});

describe("describeRegionTaskResult — pending", () => {
  it("pending이면 확인 대기 문구", () => {
    const text = describeRegionTaskResult({
      ok: true, applied: false, changedCells: 34, changedEvents: 2, clippedCells: 0,
      proposedCalls: 3, assistantText: "",
      pending: { settled: false } as never,
    });
    expect(text).toBe("제안 준비 — 34칸 타일 · 이벤트 2건 · 적용 여부를 선택하세요");
  });
});
