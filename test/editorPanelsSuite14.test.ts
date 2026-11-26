import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createPiGhostBridge } from "@/editor/panels/aiPiGhostBridge";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider } from "@/editor/agentGhostPreview";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { installFakeDom, findByTestId, renderWithFakeDom, FakeElement } from "./fakeDom";
import { AI_AUTHORING_EXAMPLES, buildAiAuthoringExamples, buildRecentAiWorkCard, buildTryRegionCard, buildVisualStartGallery, defaultAiVisualStartPrompts, formatRelativeTime, summarizeActivityResult, buildSuggestionRows, rankAuthoringExamples } from "@/editor/panels/aiStartScreenCards";
import type { AiActivityLogRecord } from "@/ai/activityLog";
import { editorState } from "@/editor/editorState";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { fetchCompanion } from "@/ai/companionConnection";
import { getAiTransportHealth, reportTransportHealth, resetAiTransportHealth, type AiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { deriveRunOutcome, type RunOutcomeFacts } from "@/ai/runOutcome";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import { aiDayKey, formatAiDayLabel, parseAiDayDate, statusToneOf } from "@/editor/panels/aiChatPanelHelpers";
import { ensureDayDivider, markPriorTurns } from "@/editor/panels/aiConversationLog";
import type { WorkPlan } from "@/ai/workPlan";
import { closeWorkPlanBook, openWorkPlanBook, updateWorkPlanBook, workPlanBookIsOpen } from "@/editor/panels/aiWorkPlanModal";
import { workPlanBookPages } from "@/editor/panels/aiWorkPlanPages";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

describe("aiPiGhostBridge", () => {
  isolateTimers();
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
    return ctx.project;
  }
  /** 워커가 하는 일: 프로젝트를 제자리에서 바꾸고 증분 이벤트를 만든다. */
  function workerDelta(shadow: Record<string, GameMap>, next: Record<string, GameMap>): PiAgentEvent {
    return { type: "map_delta", maps: diffMapsForDelta(shadow, next) };
  }
  /** 스로틀 타이머를 손으로 돌린다 — 실제 시간에 기대지 않는다. */
  function fakeTimers() {
    const queued: Array<() => void> = [];
    return {
      setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
      clearTimeoutFn: () => { /* 취소는 flush/cancel 이 pending 플래그로 막는다 */ },
      tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
    };
  }
  describe("aiPiGhostBridge", () => {
    beforeEach(() => {
      setAiLiveCanvasEnabled(true);
      clearAgentGhostPreview();
      setAgentGhostDraftMapProvider(null);
    });

    afterEach(() => {
      setAiLiveCanvasEnabled(true);
    });

    it("map_delta 를 받아 고스트 프리뷰를 그린다 — 턴이 끝나기 전에", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      timers.tick();

      const previews = getAgentGhostPreviewState().previews;
      expect(previews).toHaveLength(1);
      expect(previews[0]!.mapId).toBe("map_east");
      expect(previews[0]!.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")).toBe(true);
      bridge.dispose();
    });

    it("툴마다 오는 증분이 누적된다 — 마지막 증분만 그리지 않는다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      let shadow = clone(base.maps);
      const working = clone(base);
      for (const index of [10, 11, 12]) {
        working.maps.map_east!.lowerTiles[index] = 5;
        const event = workerDelta(shadow, working.maps);
        shadow = clone(working.maps);
        bridge.handleEvent(event);
        timers.tick();
      }

      const cells = getAgentGhostPreviewState().previews.flatMap((preview) => preview.cells);
      expect(cells.filter((cell) => cell.layer === "lower")).toHaveLength(3);
      bridge.dispose();
    });

    it("초안 맵을 공급한다 — 렌더러가 컴포지터 경로로 실제 타일을 찍을 수 있게", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));

      expect(getAgentGhostDraftMap("map_east")!.lowerTiles[42]).toBe(7);
      expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);
      bridge.dispose();
      expect(getAgentGhostDraftMap("map_east")).toBeUndefined();
    });

    it("tool_start 가 실행 중 도구와 그 대상 맵을 세운다", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
      expect(getAgentGhostPreviewState().runningToolName).toBe("paint_tiles");
      expect(getAgentGhostPreviewState().runningToolMapId).toBe("map_east");
      bridge.dispose();
    });

    it("팀 이벤트(agent_event)는 한 겹 벗겨서 같은 길로 흐른다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent({ type: "agent_event", agentId: "builder-1", event: workerDelta(base.maps, working.maps) });
      timers.tick();

      expect(getAgentGhostPreviewState().previews).toHaveLength(1);
      bridge.dispose();
    });

    it("done 은 밀린 증분을 즉시 그리고 실행 중 도구를 내린다 — 그림은 남는다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      // 스로틀 타이머를 돌리지 않는다 — done 이 직접 비워야 한다.
      bridge.handleEvent({ type: "done", project: working, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] });

      expect(getAgentGhostPreviewState().previews).toHaveLength(1);
      expect(getAgentGhostPreviewState().runningToolName).toBe("");
      bridge.dispose();
    });

    it("dispose 는 그림을 지우고 초안 공급을 끊는다 — 적용·버리기·중단이 부르는 길", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(1);

      bridge.dispose();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      // dispose 뒤에 늦게 도착한 이벤트는 죽은 다리를 되살리지 않는다.
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    });

    it("헤드리스에서는 초안만 갱신하고 맵 연출은 그리지 않는다", () => {
      setAiLiveCanvasEnabled(false);
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);

      setAiLiveCanvasEnabled(true);
      expect(getAgentGhostPreviewState().previews.some((preview) => preview.cells.length > 0)).toBe(true);
      bridge.dispose();
    });

    it("빈 증분은 아무것도 예약하지 않는다", () => {
      const base = seed();
      let applied = 0;
      const bridge = createPiGhostBridge({ baseProject: base, apply: () => { applied += 1; } });
      bridge.handleEvent({ type: "map_delta", maps: [] });
      bridge.flush();
      expect(applied).toBe(0);
      bridge.dispose();
    });
  });
});

// 승인 카드 제거 후에도 즉시 적용 경로의 soft-confirm 합의 훅이 동작하는지 고정한다.
describe("aiProposalSoftConfirm", () => {
  isolateTimers();
  describe("soft-confirm 자동 합의", () => {
    it("proposedCalls의 vocabSoftConfirm을 수집해 즉시 origin:user로 마킹한다", () => {
      const project = createEmptyToolProject();
      const tilesetId = Object.keys(project.tilesets)[0];
      const tileset = project.tilesets[tilesetId];
      tileset.tileGroups = [...(tileset.tileGroups ?? []), {
        id: "g-soft", name: "soft 재료", role: "prop", defaultLayer: "lower",
        tileIds: [5], description: "", placementRules: "", origin: "ai",
      } as never];
      const calls = [{
        name: "place_props", args: {},
        result: { ok: true, summary: "", data: { vocabSoftConfirm: {
          kind: "group", groupId: "g-soft", tileIds: [5], name: "soft 재료", role: "prop", layerHome: "lower", tilesetId,
        } } },
      }] as never;
      expect(collectVocabSoftConfirms(calls).length).toBe(1);
      const marked = markSoftVocabApprovalsOnProject(project, calls);
      expect(marked).toBe(1);
      expect(project.tilesets[tilesetId].tileGroups?.find((g) => g.id === "g-soft")?.origin).toBe("user");
    });
  });
});

describe("aiStartScreenCards", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom({ window: true });
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, String(value)),
        removeItem: (key: string) => void storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
      selection: null,
    });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  const NOW = new Date("2026-07-10T12:00:00Z");
  function record(overrides: Partial<AiActivityLogRecord> = {}): AiActivityLogRecord {
    return {
      id: "log1",
      at: "2026-07-10T11:55:00Z",
      channel: "region",
      instruction: "이 영역을 잔디로 채워줘",
      result: { ok: true, applied: true, changedCells: 34, changedEvents: 2 },
      toolCalls: [],
      audit: [],
      ...overrides,
    } as AiActivityLogRecord;
  }
  describe("formatRelativeTime", () => {
    it("분/시간/일 단위", () => {
      expect(formatRelativeTime("2026-07-10T11:59:40Z", NOW)).toBe("방금 전");
      expect(formatRelativeTime("2026-07-10T11:55:00Z", NOW)).toBe("5분 전");
      expect(formatRelativeTime("2026-07-10T09:00:00Z", NOW)).toBe("3시간 전");
      expect(formatRelativeTime("2026-07-08T12:00:00Z", NOW)).toBe("2일 전");
    });
  });
  describe("summarizeActivityResult", () => {
    it("적용/오류/무변경을 요약한다", () => {
      expect(summarizeActivityResult(record())).toBe("34칸 · 이벤트 2건");
      expect(summarizeActivityResult(record({ result: { ok: false, applied: false, error: "boom" } as never }))).toBe("오류");
      expect(summarizeActivityResult(record({ result: { ok: true, applied: false, changedCells: 0, changedEvents: 0 } as never }))).toBe("변경 없음");
    });
  });
  describe("buildTryRegionCard", () => {
    it("예시 칩 클릭 시 onPick에 instruction을 넘긴다", () => {
      const picked: string[] = [];
      const card = renderWithFakeDom(() =>
        buildTryRegionCard({
          commands: [{ id: "c1", label: "🌊 호수", instruction: "둥근 호수를 만들어줘", category: "타일" }],
          onPick: (instruction) => picked.push(instruction),
        }),
      );
      expect(findByTestId(card, "ai-start-try-region")).not.toBeNull();
      findByTestId(card, "ai-start-try-c1")!.dispatchEvent(new Event("click"));
      expect(picked).toEqual(["둥근 호수를 만들어줘"]);
    });
  });
  describe("buildAiAuthoringExamples", () => {
    it("길·NPC·상점·상자·집·퀘스트 예제를 빠짐없이 제공하고 클릭한 문장을 넘긴다", () => {
      expect(new Set(AI_AUTHORING_EXAMPLES.map((example) => example.kind))).toEqual(
        new Set(["road", "npc", "shop", "chest", "house", "quest"]),
      );
      const picked: Array<{ instruction: string; id: string }> = [];
      const examples = renderWithFakeDom(() =>
        buildAiAuthoringExamples({
          onPick: (instruction, id) => picked.push({ instruction, id }),
        }),
      );

      expect(findByTestId(examples, "ai-authoring-examples")).not.toBeNull();
      expect(examples.querySelectorAll("button")).toHaveLength(6);
      findByTestId(examples, "ai-authoring-example-shop")!.click();
      expect(picked).toEqual([
        {
          id: "shop",
          instruction: AI_AUTHORING_EXAMPLES.find((example) => example.id === "shop")!.instruction,
        },
      ]);
    });

    it("예제 칩 mousedown 은 기본 포커스 이동을 막고 같은 문장을 넘긴다", () => {
      const picked: string[] = [];
      const examples = renderWithFakeDom(() =>
        buildAiAuthoringExamples({
          onPick: (instruction) => picked.push(instruction),
        }),
      );
      const shop = findByTestId(examples, "ai-authoring-example-shop");
      if (!shop) throw new Error("shop example chip missing");
      const down = new Event("mousedown", { bubbles: true, cancelable: true });
      shop.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(picked).toEqual([
        AI_AUTHORING_EXAMPLES.find((example) => example.id === "shop")!.instruction,
      ]);
    });
  });
  describe("buildRecentAiWorkCard", () => {
    it("기록이 있으면 최근 항목을 렌더, 없으면 null", () => {
      const built = buildRecentAiWorkCard([record()], NOW);
      expect(built).not.toBeNull();
      const card = renderWithFakeDom(() => built!);
      expect(findByTestId(card, "ai-start-recent-work")).not.toBeNull();
      expect(card.textContent).toContain("34칸");
      expect(card.textContent).toContain("5분 전");
      expect(buildRecentAiWorkCard([], NOW)).toBeNull();
    });
  });
  describe("buildVisualStartGallery", () => {
    it("모자이크 헬퍼는 호출 시에만 썸을 만들고 5열 갤러리를 부팅 빈 면으로 쓰지 않는다", () => {
      // Break: panel boot still mounts ai-start-visual-gallery as the empty product.
      const project = createBlankProject();
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID] ?? Object.values(project.tilesets)[0] ?? null;
      const gallery = renderWithFakeDom(() =>
        buildVisualStartGallery({
          tileset,
          onPick: () => undefined,
        }),
      );
      expect(findByTestId(gallery, "ai-start-visual-stage-place")).toBeTruthy();
      expect(defaultAiVisualStartPrompts().length).toBeGreaterThanOrEqual(3);

      const panel = renderWithFakeDom(() => renderAiChatPanel());
      if (panel.classList.contains("is-collapsed")) {
        findByTestId(panel, "ai-collapsed-restore")?.click();
      }
      const chips = findByTestId(panel, "ai-composer-chips");
      expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
      expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
      expect(chips?.querySelectorAll("button").length ?? 0).toBe(0);
    });
  });
});

describe("aiSuggestionRows", () => {
  isolateTimers();
  describe("추천 행 — 맵 진단 순서의 실행 문장 (데크 D5)", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("길이 없으면 길이 첫 행, 사람이 없으면 NPC·상점이 그 다음", () => {
      // Break: 순서가 고정이라 빈 맵에서도 「보물상자」 가 먼저 온다.
      const ranked = rankAuthoringExamples({ hasPath: false, eventCount: 0 });
      expect(ranked.slice(0, 3).map((example) => example.kind)).toEqual(["road", "npc", "shop"]);
      const populated = rankAuthoringExamples({ hasPath: true, eventCount: 5 });
      expect(populated.map((example) => example.kind)).toEqual(AI_AUTHORING_EXAMPLES.map((example) => example.kind));
    });

    it("행은 문장 + 종류이고 누르면 지시 전문을 넘긴다 — 상한 3", () => {
      // Break: 행이 라벨 한 단어만 보이거나, 6개가 다 나와 컴포저 위를 채운다.
      const picked: string[] = [];
      const rows = buildSuggestionRows({ examples: AI_AUTHORING_EXAMPLES, onPick: (instruction) => picked.push(instruction) });
      const buttons = rows.querySelectorAll(".ai-suggest-row");
      expect(buttons.length).toBe(3);
      expect(buttons[0]?.querySelector(".ai-suggest-row-text")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.title);
      expect(buttons[0]?.querySelector(".ai-suggest-row-why")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.label);
      (buttons[0] as unknown as FakeElement).click();
      expect(picked).toEqual([AI_AUTHORING_EXAMPLES[0]?.instruction]);
    });
  });
});

// 상태바 "AI 연결됨" 칩 진실화 — 실제 요청 성패(전송 건강)를 함께 판정하는지.
// 배경(2026-08-19 적대 평가 P0): 설정 모양만 보고 ready 를 내보내, 모든 턴이 404 로
// 죽는 동안에도 "AI 연결됨"이라고 표시했다.
describe("aiTransportHealth", () => {
  isolateTimers();
  const proxyConfig: AiConfig = {
    authMode: "apiKey",
    baseUrl: "/api/cliproxy",
    model: "test-model",
    apiKey: "",
    maxToolCalls: 8,
    maxTokens: 1024,
  };
  describe("AI 연동 칩 × 전송 건강", () => {
    beforeEach(() => {
      resetAiTransportHealth();
    });

    it("프록시 설정이면 기본은 연결됨", () => {
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
      expect(status.label).toBe("Google 연결됨");
    });

    it("404 실패가 기록되면 '연결됨' 대신 응답 오류를 보고한다", () => {
      reportTransportHealth(false, 404, "요청 실패(404)");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("offline");
      expect(status.label).toContain("404");
      expect(status.title).toContain("실패");
    });

    it("성공이 기록되면 자동으로 연결됨으로 복구된다", () => {
      reportTransportHealth(false, 404, "요청 실패(404)");
      reportTransportHealth(true, 200);
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
    });

    it("429 뒤 내 PC 프로그램 감지(/v1/local-agents) 성공은 한도 표시를 지우지 않고, 모델 호출 성공만 지운다", async () => {
      const reply = (status: number, headers: Record<string, string> = {}) => async () => new Response("{}", { status, headers });
      await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(429, { "retry-after": "600" }) });
      await vi.waitFor(() => expect(getAiTransportHealth()?.status).toBe(429));
      expect(getAiTransportHealth()?.message).toContain("Retry-After 600");

      await fetchCompanion("/v1/local-agents", undefined, { fetchImpl: reply(200) });
      // fetchCompanion 은 해제를 `import("@/ai/llmClient").then(...)` 으로 미룬다 — 같은 import 를 기다리면 그보다 먼저 걸린 해제가 끝난 뒤다.
      await import("@/ai/llmClient");
      expect(getAiTransportHealth()?.status).toBe(429);

      await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(200) });
      await vi.waitFor(() => expect(getAiTransportHealth()?.ok).toBe(true));
    });

    it("429(사용량 제한)는 연결 문제로 취급하지 않는다", () => {
      // llmClient 는 429 를 아예 기록하지 않지만, 방어적으로 기록되더라도 칩은 붉히지 않는다.
      reportTransportHealth(false, 429, "사용량 제한");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
    });

    it("네트워크 오류(상태 코드 없음)도 응답 오류로 보고한다", () => {
      reportTransportHealth(false, undefined, "네트워크 오류(/api/x)");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("offline");
    });
  });
});

describe("aiVisualEvidenceReceipt", () => {
  isolateTimers();
  // 이 파일이 지키는 것: "자료를 조회했다" / "이미지가 실제 요청에 실렸다" / "품질 검사를 했다" /
  // "실제 플레이로 확인했다" 는 서로 다른 사실이다. 영수증은 **전달 사실만** 말한다.
  // 모델이 그림을 이해했거나 보기 좋다고 판단했다는 주장은 여기서 만들어내지 않는다.

  const baseFacts: RunOutcomeFacts = Object.freeze({
    execution: "response-final", acceptance: null,
    hasPendingDraft: false, hasApplied: false, persistence: "none",
  });
  function mapRegion(project: Project) {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing start map");
    return { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height };
  }
  describe("visual delivery receipt", () => {
    it("reports no attachment when the run never rendered an image", () => {
      // Given: a run with no renderer at all.
      const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 0, attached: 0 } };
      // When
      const outcome = deriveRunOutcome(facts);
      // Then
      expect(outcome.imageAttached).toBe(false);
      expect(outcome.visualDelivery).toEqual({ attempted: 0, attached: 0 });
    });

    it("reports no attachment when rendering was attempted but nothing was acknowledged", () => {
      // Given: renderer threw or returned an empty list, so nothing reached the request.
      const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 2, attached: 0 } };
      // When
      const outcome = deriveRunOutcome(facts);
      // Then
      expect(outcome.imageAttached).toBe(false);
      expect(outcome.visualDelivery).toEqual({ attempted: 2, attached: 0 });
    });

    it("reports attachment only for images the provider actually acknowledged", () => {
      // Given
      const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 3, attached: 1 } };
      // When
      const outcome = deriveRunOutcome(facts);
      // Then
      expect(outcome.imageAttached).toBe(true);
      expect(outcome.visualDelivery).toEqual({ attempted: 3, attached: 1 });
    });

    it("keeps the delivery axis independent of goal and persistence axes", () => {
      // Given: a verified, persisted run that never sent an image.
      const facts: RunOutcomeFacts = { ...baseFacts, acceptance: "verified", hasApplied: true,
        persistence: "verified-current", visualDelivery: { attempted: 1, attached: 0 } };
      // When
      const outcome = deriveRunOutcome(facts);
      // Then: goal/delivery stay unchanged; the image axis does not inherit their success.
      expect(outcome.goal).toBe("satisfied");
      expect(outcome.delivery).toBe("persisted-verified");
      expect(outcome.imageAttached).toBe(false);
    });

    it("omits the receipt entirely for callers that do not report delivery facts", () => {
      // Given: a legacy caller.
      // When
      const outcome = deriveRunOutcome(baseFacts);
      // Then: absence is not a false claim in either direction.
      expect(outcome.imageAttached).toBe(false);
      expect(outcome.visualDelivery).toBeUndefined();
    });
  });
  describe("AssistantImageEvidence delivery facts", () => {
    it("counts a capture as attached only after the provider acknowledges it", () => {
      // Given
      const project = createBlankProject();
      const evidence = new AssistantImageEvidence();
      const receipt = evidence.capture(project, mapRegion(project));
      if (!receipt) throw new Error("Expected a real capture receipt");
      // Then: captured is not attached.
      expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 0 });
      // When
      evidence.deliver([receipt]);
      // Then
      expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 1 });
    });

    it("does not count a receipt from another run or revision", () => {
      // Given: a receipt captured against a different project revision.
      const project = createBlankProject();
      const evidence = new AssistantImageEvidence();
      const foreign = new AssistantImageEvidence().capture(project, mapRegion(project));
      if (!foreign) throw new Error("Expected a real capture receipt");
      // When: a foreign receipt is offered for delivery.
      evidence.deliver([foreign]);
      // Then
      expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
    });

    it("retires delivered facts when the authored content moved on", () => {
      // Given
      const project = createBlankProject();
      const evidence = new AssistantImageEvidence();
      const receipt = evidence.capture(project, mapRegion(project));
      if (!receipt) throw new Error("Expected a real capture receipt");
      evidence.deliver([receipt]);
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("Missing start map");
      // When: the map actually changes after the image was sent.
      const moved: Project = { ...project, maps: { ...project.maps,
        [map.id]: { ...map, events: [...map.events, { id: "receipt-drift", x: 1, y: 1, pages: [] }] } } };
      evidence.current(moved);
      // Then: a stale image is not a current delivery receipt.
      expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
    });
  });
  describe("run outcome surface", () => {
    it("maps the receipt onto the concise result element without claiming comprehension", () => {
      // Given
      const restore = installFakeDom();
      try {
        const attached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 1 } });
        const unattached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 0 } });
        const unknown = deriveRunOutcome(baseFacts);
        // When
        const attachedEl = renderRunOutcome(attached);
        const unattachedEl = renderRunOutcome(unattached);
        const unknownEl = renderRunOutcome(unknown);
        // Then: machine-consumed state, and absence stays absent.
        expect(attachedEl.dataset.imageDelivery).toBe("attached");
        expect(unattachedEl.dataset.imageDelivery).toBe("unattached");
        expect(unknownEl.dataset.imageDelivery).toBeUndefined();
        // The other axes are untouched by the receipt.
        expect(attachedEl.dataset.goal).toBe("unassessed");
        expect(attachedEl.dataset.delivery).toBe("no-change");
      } finally { restore(); }
    });
  });
});

describe("aiVisualPolish", () => {
  isolateTimers();
  describe("AI 상태 톤(제안 6)", () => {
    it("대기/오류/진행/완료를 구분한다", () => {
      expect(statusToneOf("대기")).toBe("idle");
      expect(statusToneOf("새 대화")).toBe("idle");
      expect(statusToneOf("오류")).toBe("error");
      expect(statusToneOf("오류: 키 없음")).toBe("error");
      expect(statusToneOf("적용 실패")).toBe("error");
      expect(statusToneOf("계획 중… 12초 · 도구 3")).toBe("running");
      expect(statusToneOf("실행 중(flash) … 3초 · 도구 1/200")).toBe("running");
      expect(statusToneOf("중단 중…")).toBe("running");
      expect(statusToneOf("적용됨")).toBe("ok");
      expect(statusToneOf("완료")).toBe("ok");
      expect(statusToneOf("완료 — 변경 없음(린트 경고)")).toBe("ok");
    });
  });
  describe("AI 기록 날짜/턴 접기(제안 6)", () => {
    it("같은 날에는 구분선을 한 번만 넣고, 이전 턴을 접는다", () => {
      const restore = installFakeDom();
      try {
        const log = document.createElement("div") as unknown as FakeElement;
        const day = new Date("2026-07-11T10:00:00");
        expect(aiDayKey(day)).toBe("2026-07-11");
        expect(formatAiDayLabel(day)).toContain("2026");
        const labeled = new Date(2026, 6, 11, 10, 0, 0);
        expect(formatAiDayLabel(labeled, "ko")).toMatch(/2026년/);
        expect(formatAiDayLabel(labeled, "en")).toMatch(/July/);
        expect(formatAiDayLabel(labeled, "ja")).toMatch(/2026年7月11日/);
        expect(formatAiDayLabel(labeled, "en")).not.toMatch(/[가-힣]/);
        expect(parseAiDayDate("2026-07-11T12:00:00").getDate()).toBe(11);

        const first = ensureDayDivider(log as unknown as HTMLElement, day);
        const second = ensureDayDivider(log as unknown as HTMLElement, day);
        expect(first).toBeTruthy();
        expect(second).toBeNull();
        expect(findByTestId(log, "ai-day-divider")).toBeTruthy();

        const user = document.createElement("div") as unknown as FakeElement;
        user.className = "ai-command-row";
        user.dataset.testid = "ai-command-row";
        user.dataset.role = "user";
        user.textContent = "호수 만들어줘";
        const assistant = document.createElement("div") as unknown as FakeElement;
        assistant.className = "ai-command-row";
        assistant.dataset.testid = "ai-command-row";
        assistant.dataset.role = "assistant";
        assistant.textContent = "초안입니다.";
        log.append(user, assistant);

        markPriorTurns(log as unknown as HTMLElement);

        const group = findByTestId(log, "ai-turn-group");
        expect(group).toBeTruthy();
        expect(group?.className).toContain("is-collapsed");
        expect(group?.className).toContain("is-prior-turn");
        expect(findByTestId(log, "ai-turn-group-toggle")?.textContent).toContain("호수");
        // 구분선은 유지, 턴 본문은 그룹 안.
        expect(findByTestId(log, "ai-day-divider")).toBeTruthy();
        expect(findByTestId(group!, "ai-turn-group-body")?.childNodes.length).toBe(2);
      } finally {
        restore();
      }
    });
  });
});

describe("aiWorkPlanBook", () => {
  isolateTimers();
  function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
    return {
      id: "plan-1",
      goal: "강가 마을을 만든다",
      createdAt: "2026-09-03T00:00:00.000Z",
      currentLayerIndex: 0,
      currentItemId: "L1-1",
      plannerNote: "물은 먼저, 집은 나중에",
      layers: [
        {
          id: "L1",
          title: "터 잡기",
          items: [
            {
              id: "L1-1",
              title: "강 그리기",
              instruction: "fill_region 으로 강을 깐다",
              doneWhen: "강 타일이 맵에 있다",
              status: "in_progress",
            },
            {
              id: "L1-2",
              title: "다리",
              instruction: "paint_road 로 다리를 놓는다",
              status: "pending",
            },
          ],
        },
        {
          id: "L2",
          title: "살림",
          items: [
            {
              id: "L2-1",
              title: "집 3채",
              instruction: "author_house 3",
              status: "pending",
            },
          ],
        },
      ],
      ...overrides,
    };
  }
  describe("workPlanBookPages", () => {
    it("표지 한 장과 레이어마다 한 장을 만든다", () => {
      const pages = workPlanBookPages(samplePlan());
      expect(pages.map((page) => page.kind)).toEqual(["cover", "layer", "layer"]);
      const cover = pages[0];
      if (cover?.kind !== "cover") throw new Error("cover missing");
      expect(cover.goal).toBe("강가 마을을 만든다");
      expect(cover.plannerNote).toBe("물은 먼저, 집은 나중에");
      expect(cover.done).toBe(0);
      expect(cover.total).toBe(3);
      expect(cover.layers.map((layer) => layer.title)).toEqual(["터 잡기", "살림"]);
      expect(cover.layers[0]?.current).toBe(true);
      expect(pages[1]?.kind === "layer" && pages[1].items).toHaveLength(2);
    });

    it("layers 가 없어도 표지는 남긴다", () => {
      const pages = workPlanBookPages({ goal: "던전 하나" } as unknown as WorkPlan);
      expect(pages).toHaveLength(1);
      expect(pages[0]?.kind).toBe("cover");
      if (pages[0]?.kind !== "cover") throw new Error("cover missing");
      expect(pages[0].goal).toBe("던전 하나");
      expect(pages[0].total).toBe(0);
    });
  });
  describe("작업 계획 책 모달", () => {
    let restore: (() => void) | null = null;

    afterEach(() => {
      closeWorkPlanBook();
      resetModalStackForTest();
      restore?.();
      restore = null;
    });

    function mount(plan: WorkPlan = samplePlan()): FakeElement {
      restore = installFakeDom();
      const overlay = openWorkPlanBook({ plan, active: true }) as unknown as FakeElement;
      return overlay;
    }

    it("표지에서 시작해 다음/점이 레이어 페이지를 연다", () => {
      const overlay = mount();
      expect(workPlanBookIsOpen()).toBe(true);
      expect(modalStackDepthForTest()).toBe(1);
      expect(findByTestId(overlay, "ai-plan-book-title")?.textContent).toBe("강가 마을을 만든다");
      expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("1 / 3");
      const sheets = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']");
      expect(sheets.map((sheet) => sheet.dataset.kind)).toEqual(["cover", "layer", "layer"]);
      expect(sheets[0]?.className).toContain("is-current");
      expect(findByTestId(overlay, "ai-plan-book-progress")?.textContent).toBe("0/3 완료");
      expect(overlay.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(3);

      findByTestId(overlay, "ai-plan-book-next")?.click();
      expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
      const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
        .find((sheet) => sheet.className.includes("is-current"));
      expect(current?.dataset.kind).toBe("layer");
      expect(current?.textContent).toContain("강 그리기");
      expect(current?.textContent).toContain("fill_region 으로 강을 깐다");
      expect(current?.textContent).toContain("완료 조건 · 강 타일이 맵에 있다");
      expect(current?.textContent).toContain("진행 중");

      overlay.querySelectorAll("[data-testid='ai-plan-book-dot']")[2]?.click();
      expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
      const last = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
        .find((sheet) => sheet.className.includes("is-current"));
      expect(last?.textContent).toContain("집 3채");
    });

    it("목차 행은 해당 레이어 페이지로 점프한다", () => {
      const overlay = mount();
      const rows = overlay.querySelectorAll("[data-testid='ai-plan-book-toc-row']");
      expect(rows).toHaveLength(2);
      rows[1]?.click();
      expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
      const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
        .find((sheet) => sheet.className.includes("is-current"));
      expect(current?.textContent).toContain("살림");
    });

    it("같은 계획을 다시 열면 페이지를 유지한 채 내용만 갱신한다", () => {
      const overlay = mount();
      findByTestId(overlay, "ai-plan-book-next")?.click();
      const advanced = samplePlan({
        layers: samplePlan().layers.map((layer, index) =>
          index === 0
            ? {
                ...layer,
                items: layer.items.map((item) =>
                  item.id === "L1-1" ? { ...item, status: "done" as const } : item,
                ),
              }
            : layer,
        ),
      });
      updateWorkPlanBook({ plan: advanced, active: true });
      expect(document.querySelectorAll("[data-testid='ai-plan-book-overlay']")).toHaveLength(1);
      expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
      expect(overlay.querySelector("[data-status='done']")?.textContent).toContain("강 그리기");
    });

    it("닫기 버튼은 오버레이와 모달 스택을 걷는다", () => {
      const overlay = mount();
      findByTestId(overlay, "ai-plan-book-close")?.click();
      expect(workPlanBookIsOpen()).toBe(false);
      expect(document.querySelector("[data-testid='ai-plan-book']")).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });
  });
});
