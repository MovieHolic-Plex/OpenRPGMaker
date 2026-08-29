import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildRegionTaskMessage,
  countAddedMaps,
  countInRegionChangedCells,
  describeRegionTaskResult,
  runRegionTask,
  type RegionTaskDeps,
  type RegionTaskSessionLike,
} from "@/editor/regionTask/runRegionTask";
import { isRegionEscapingIntent, routeRegionIntent } from "@/editor/regionTask/regionIntentRouter";
import { __clearPendingRegionApplyForTest, getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { clearAgentGhostPreview, getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
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

  it("실내 요청은 독립 실내 세션만 안내하고 야외 facade를 배제한다", () => {
    const message = buildRegionTaskMessage("연금술사의 집 이라는 실내 를 하나 만드렁줘", "외곽", MAP_ID, REGION);
    expect(message).toContain("start_interior_room_session");
    expect(message).not.toContain("run_interior_room_pipeline");
    expect(message).not.toContain("author_house");
    expect(message).not.toContain("author_village");
    expect(message).not.toContain("이 작업은 아래 선택 영역 안에서만 수행하라");
    expect(message).toContain("새 맵 전체를 시공하라");
  });

  it("영역 작업의 bare 집 요청은 야외 집으로 바로 시공한다 (되묻지 않음)", () => {
    const message = buildRegionTaskMessage("이 영역에 집 만들어줘", "외곽", MAP_ID, REGION);
    // 영역 선택이 현재 맵 위이므로 야외 집 의도 — 되묻지 않고 author_house 시공.
    expect(message).not.toContain("야외 집(외장) / 실내 맵 / 둘 다");
    expect(message).toContain("author_house");
    expect(message).toContain("되묻지 말고");
  });

  it("'건물' 단어는 author_house facade 시그니처를 강제하지 않는다 (탑/성벽 오경로 방지)", () => {
    // 탑/성벽 등은 structure 가이드가 build_wall/create_farm_plot 로 안내한다.
    // bare fallback 이 /건물/ 을 잡아 author_house 시그니처를 내면 가이드와 충돌한다.
    const tower = buildRegionTaskMessage("탑 건물 지어줘", "외곽", MAP_ID, REGION);
    expect(tower).not.toContain("야외 집 시공: author_house");
    const wall = buildRegionTaskMessage("성벽 건물 지어", "외곽", MAP_ID, REGION);
    expect(wall).not.toContain("야외 집 시공: author_house");
    // bare '건물' 단독도 facade 시그니처 강제 없음 — 가이드가 LLM 에게 맨긴다.
    const bare = buildRegionTaskMessage("건물 지어", "외곽", MAP_ID, REGION);
    expect(bare).not.toContain("야외 집 시공: author_house");
    expect(bare).not.toContain("되묻지 말고");
  });
});

describe("isRegionEscapingIntent / routeRegionIntent — 실내·새 맵", () => {
  it("실내·새 맵 요청은 영역 우회 대상이다", () => {
    expect(isRegionEscapingIntent("연금술사의 집 이라는 실내 를 하나 만드렁줘")).toBe(true);
    expect(isRegionEscapingIntent("아니 새로운 맵을 만들어서 진행해달라니까")).toBe(true);
    expect(isRegionEscapingIntent("여기 나무 3그루 심어줘")).toBe(false);
  });

  it("실내+집 문구는 interior만 잡고 structure(야외 집)는 뺀다", () => {
    const routed = routeRegionIntent("연금술사의 집 이라는 실내 를 하나 만드렁줘");
    expect(routed).toContain("interior");
    expect(routed).not.toContain("structure");
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
              liteModel: "gpt-5.4-mini",
              maxTokens: 1024,
              model: "gpt-5.6-sol",
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
      expect(JSON.parse(bodies[0]).model).toBe("gpt-5.4-mini");
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

  it("영역 셀 0이어도 새 맵이 추가되면 적용한다(실내/create_map)", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    const interiorId = "map_interior_atelier";
    proposed.maps[interiorId] = {
      ...structuredClone(proposed.maps[MAP_ID]),
      id: interiorId,
      name: "연금술사의 집",
    };
    expect(countAddedMaps(base, proposed)).toBe(1);
    const { deps, applied } = makeDeps(base, proposed);
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "실내 맵 만들어", gate: "immediate" },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.changedCells).toBe(0);
    expect(result.mapsAdded).toBe(1);
    expect(applied()?.project.maps[interiorId]?.name).toBe("연금술사의 집");
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

  it("자동 discard 순서 — 새 작업(B) 완료 후 고스트 프리뷰가 B의 것으로 남는다(A의 뒤늦은 onSettle이 지우지 않음)", async () => {
    clearAgentGhostPreview();
    const base = baseProject();
    const proposedA: Project = structuredClone(base);
    proposedA.maps[MAP_ID].lowerTiles[idx(1, 1)] = 5; // A 변경 셀(영역 안)
    const proposedB: Project = structuredClone(base);
    proposedB.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // B 변경 셀(영역 안) — tile 5는 통행 가능·연결됨(리뷰에서 되돌려지지 않음)

    // write 툴(paint_tiles) tool_call을 흘려보내 ghostPreviewUpdater가 실제로 프리뷰를 갱신하게 한다.
    const sessionWithToolCall = (proposed: Project): Partial<RegionTaskSessionLike> => ({
      async sendUserMessage(_text, onEvent) {
        onEvent?.({ type: "tool_call", name: "paint_tiles", args: { mapId: MAP_ID }, result: { ok: true, summary: "" } });
        return finalTurn();
      },
      getProposedProject: () => proposed,
    });

    const { deps: depsA } = makeDeps(base, proposedA, sessionWithToolCall(proposedA));
    const resultA = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "A 작업" }, depsA);
    expect(resultA.pending).toBeDefined();
    expect(resultA.pending!.settled).toBe(false);
    expect(getAgentGhostPreviewState().previews.length).toBeGreaterThan(0); // A의 프리뷰가 반영됨

    // B 실행: 함수 초입에서 A를 선-discard한 뒤, B 자신의 flush로 프리뷰를 새로 세팅해야 한다.
    const { deps: depsB } = makeDeps(base, proposedB, sessionWithToolCall(proposedB));
    const resultB = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "B 작업" }, depsB);

    expect(resultA.pending!.settled).toBe(true); // B가 A를 자동 discard
    expect(resultB.pending).toBeDefined();
    expect(resultB.pending!.settled).toBe(false);
    expect(getPendingRegionApply()).toBe(resultB.pending); // 현재 pending은 B

    // 핵심 회귀 방지: A의 onSettle(전역 clearAgentGhostPreview)이 B가 이미 세팅한 프리뷰를 지우면 안 된다.
    expect(getAgentGhostPreviewState().previews.length).toBeGreaterThan(0);
  });
});

describe("describeRegionTaskResult — pending", () => {
  // 문구가 "제안 준비 … 적용 여부를 선택하세요" 였을 때는 반영 여부가 드러나지 않았다.
  // 2026-08-29 실측(모델은 "시공했습니다", 맵은 그대로)에 맞춰 미반영을 명시한다.
  it("pending이면 아직 반영되지 않았다고 말한다", () => {
    const text = describeRegionTaskResult({
      ok: true, applied: false, changedCells: 34, changedEvents: 2, clippedCells: 0,
      proposedCalls: 3, assistantText: "",
      pending: { settled: false } as never,
    });
    expect(text).toBe("승인 대기 — 34칸 타일 · 이벤트 2건 · 아직 반영되지 않았습니다");
  });
});

// 회귀: 이전에는 조기 return 경로(빈 지시·맵 없음·오류·무변경)에서 running:false가
// 발행되지 않아 맵의 '✨ AI 작업 중…' 배지가 영구히 남았다. pending 경로만 onSettle이
// 해제를 소유하고, 그 외 모든 경로는 finally가 running:false를 쏴야 한다.
describe("runRegionTask — running:false 배지 해제 회귀", () => {
  let restoreWindow: (() => void) | null = null;
  let events: (RegionTaskStatusDetail | null)[] = [];
  let listener: ((event: Event) => void) | null = null;

  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreWindow = installFakeWindow();
    events = [];
    listener = (event: Event): void => {
      events.push(regionTaskStatusDetail(event));
    };
    window.addEventListener(REGION_TASK_STATUS_EVENT, listener);
  });

  afterEach(() => {
    if (listener) window.removeEventListener(REGION_TASK_STATUS_EVENT, listener);
    listener = null;
    restoreWindow?.();
    restoreWindow = null;
  });

  it("빈 지시 조기 return에서도 running:false가 정확히 1회 발행된다", async () => {
    const base = baseProject();
    const { deps } = makeDeps(base, structuredClone(base));

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "   " }, deps);

    expect(result.ok).toBe(false);
    const runningFalse = events.filter((detail) => detail?.mapId === MAP_ID && detail?.running === false);
    expect(runningFalse.length).toBe(1);
  });

  it("pending 제안 등록 성공 시 반환 시점에는 running:false를 발행하지 않는다(해제 소유권은 onSettle)", async () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안 변경
    const { deps } = makeDeps(base, proposed);

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" }, deps);

    expect(result.ok).toBe(true);
    expect(result.pending).toBeDefined();
    // 반환 시점: 아직 settle 전이므로 finally가 running:false를 쏘면 안 된다.
    expect(events.some((detail) => detail?.mapId === MAP_ID && detail?.running === false)).toBe(false);

    // 해제 소유권 확인: onSettle(discard) 시점에 비로소 running:false 발행.
    result.pending!.discard();
    expect(events.some((detail) => detail?.mapId === MAP_ID && detail?.running === false)).toBe(true);
  });

  it("내부 예외 경로에서도 running:false가 발행된다", async () => {
    const base = baseProject();
    const { deps } = makeDeps(base, structuredClone(base), {
      async sendUserMessage() {
        throw new Error("네트워크 실패");
      },
    });

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "여기 채워" }, deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("네트워크");
    const runningFalse = events.filter((detail) => detail?.mapId === MAP_ID && detail?.running === false);
    expect(runningFalse.length).toBe(1);
  });
});
