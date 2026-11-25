import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { installFakeDom, findByTestId, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { AI_AUTHORING_EXAMPLES, buildAiAuthoringExamples, buildRecentAiWorkCard, buildTryRegionCard, buildVisualStartGallery, defaultAiVisualStartPrompts, formatRelativeTime, summarizeActivityResult } from "@/editor/panels/aiStartScreenCards";
import type { AiActivityLogRecord } from "@/ai/activityLog";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { createTeamBoardState, reduceTeamBoard, markTeamBoardReview, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { teamActivityAge, teamObservation } from "@/editor/panels/aiTeamObservation";
import { activityPhase } from "@/ai/activityTrace";
import { Window } from "happy-dom";
import { setTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { createTeamWorkPane } from "@/editor/panels/aiTeamWorkPane";
import { fetchCompanion } from "@/ai/companionConnection";
import { getAiTransportHealth, reportTransportHealth, resetAiTransportHealth, type AiConfig, AI_CONFIG_STORAGE_KEY, loadAiConfig, defaultAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { deriveRunOutcome, type RunOutcomeFacts } from "@/ai/runOutcome";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import type { Project } from "@/project/types";
import type { WorkPlan } from "@/ai/workPlan";
import { closeWorkPlanBook, openWorkPlanBook, updateWorkPlanBook, workPlanBookIsOpen } from "@/editor/panels/aiWorkPlanModal";
import { workPlanBookPages } from "@/editor/panels/aiWorkPlanPages";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { AI_WORK_STRIP_MAX_VISIBLE, aiWorkCardCount, beginAiWorkCard, getAiWorkStripElement, resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
import type { ChangePreviewInput } from "@/editor/panels/aiChangePreview";
import { REGION_SURFACE_MAX_TOOL_CALLS, TILESET_ANALYSIS_MAX_TOKENS, isAssistantEndpointReady, resolveSurfaceAiConfig, type AiSurface } from "@/ai/assistantEndpoint";
import { ASSISTANT_CHATGPT_MODEL } from "@/ai/chatgptDefault";
import { assistantRoleModel, configWithAutoAssistantRoles, resolveAssistantRoles, type AssistantRole, type RoleAssignment } from "@/ai/assistantRoles";
import { mockConnectedRoutes } from "@/editor/panels/aiRoleMatrixSettings";
import { configForProviderSelection } from "@/ai/providerSelection";
import { isStoreCardRequest, STORE_TOOLS } from "@/editor/tools/storeTools";
import { storeCardFromEvent } from "@/editor/panels/aiStoreCard";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { battleBackdropPreviewUrl, nextBattleScenery, readBattleScenery } from "@/editor/panels/battleSceneryPicker";
import { applyBattleMethod } from "@/project/battleMethod";
import { isolateTimers } from "./mergedTeardown";

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

describe("aiTeamObservation", () => {
  isolateTimers();
  function team() {
    let state = createTeamBoardState("team", "観察");
    for (const id of ["a", "b"]) state = reduceTeamBoard(state, {
      type: "agent_spawn", agentId: id, role: "builder", mapId: id, mapName: `맵 ${id}`, task: `배정 ${id}`, at: 1000,
    });
    return state;
  }
  describe("agent observation receipts", () => {
    it("keeps concurrent calls separate even when actors reuse a call ID", () => {
      let state = team();
      for (const id of ["a", "b"]) state = reduceTeamBoard(state, { type: "agent_event", agentId: id,
        event: { type: "tool_start", id: "same", name: "get_map_region", args: {}, at: 2000 } });
      state = reduceTeamBoard(state, { type: "agent_event", agentId: "a",
        event: { type: "tool_end", id: "same", name: "get_map_region", ok: true, summary: "입구 확인", at: 3000 } });
      const a = teamObservation(state.agents[0], state.trace), b = teamObservation(state.agents[1], state.trace);
      expect(a.result).toBe("맵을 살펴봤어요");
      expect(a.recent.at(-1)?.label).toBe("입구 확인");
      expect(a.action).toBe("생각 중");
      expect(b.action).toBe("맵을 살펴보는 중");
      expect(b.result).toBe("아직 처리 결과가 없어요");
      expect(b.lastAt).toBe(2000);
      expect(b.scope).toBe("맵 b");
    });

    it("does not expose private thinking or turn tool receipts into save claims", () => {
      let state = team();
      state = reduceTeamBoard(state, { type: "agent_event", agentId: "a",
        event: { type: "delta", kind: "thinking", text: "PRIVATE_THINKING", at: 3000 } });
      const view = teamObservation(state.agents[0], state.trace);
      expect(JSON.stringify(view)).not.toContain("PRIVATE_THINKING");
      expect(view.action).toBe("생각 중");
      expect(view.result).not.toMatch(/저장|적용|반영/);
    });

    it("does not use heartbeat receipts to claim recent work", () => {
      let state = team();
      state = reduceTeamBoard(state, { type: "agent_event", agentId: "a",
        event: { type: "heartbeat", at: 50000 } });
      expect(teamObservation(state.agents[0], state.trace).lastAt).toBe(1000);
      expect(teamActivityAge(1000, 5000)).toBe("최근 활동 4초 전");
      expect(teamActivityAge(undefined)).toBe("활동 시각 기록 없음");
    });

    it("uses an updated stream receipt even when its row precedes a later turn", () => {
      let state = team();
      for (const event of [
        { type: "delta" as const, kind: "text" as const, text: "first", at: 2000 },
        { type: "turn" as const, index: 2, at: 3000 },
        { type: "delta" as const, kind: "text" as const, text: "next", at: 4000 },
      ]) state = reduceTeamBoard(state, { type: "agent_event", agentId: "a", event });
      expect(teamObservation(state.agents[0], state.trace).action).toBe("생각 중");
    });

    it("reports termination even when a tool never returns", () => {
      let state = team();
      state = reduceTeamBoard(state, { type: "agent_event", agentId: "a",
        event: { type: "tool_start", id: "t", name: "paint_tiles", args: {}, at: 2000 } });
      state = reduceTeamBoard(state, { type: "agent_done", agentId: "a", ok: false, summary: "接続中断",
        stats: { ms: 2000, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [], at: 4000 });
      expect(teamObservation(state.agents[0], state.trace).action).toBe("작업을 끝내지 못했어요");
      const interrupted = teamObservation(state.agents[0], activityPhase(state.trace!, "실패", 4000));
      expect(interrupted.result).toContain("종료 응답 없음");
      expect(interrupted.result).not.toContain("칠했어요");
    });

    it("orders overlapping tool receipts by completion time", () => {
      let state = team();
      for (const event of [
        { type: "tool_start" as const, id: "a", name: "get_map_region", args: {}, at: 2000 },
        { type: "tool_start" as const, id: "b", name: "paint_tiles", args: {}, at: 3000 },
        { type: "tool_end" as const, id: "b", name: "paint_tiles", ok: true, summary: "먼저 끝난 칠하기", at: 4000 },
        { type: "tool_end" as const, id: "a", name: "get_map_region", ok: true, summary: "나중에 끝난 조회", at: 5000 },
      ]) state = reduceTeamBoard(state, { type: "agent_event", agentId: "a", event });
      const observed = teamObservation(state.agents[0], state.trace);
      expect(observed.result).toBe("맵을 살펴봤어요");
      expect(observed.recent.at(-1)?.label).toBe("나중에 끝난 조회");
      expect(observed.recent.at(-1)?.at).toBe(5000);
    });
  });
});

// 작업 페인(aiTeamWorkPane) — 조수 데크 「작업」 탭과 스튜디오 상세가 같은 컴포넌트로
// 팀원 열·과정 열·검토 스트립을 그리는지. 상태는 리듀서로 만들고 버스 슬롯으로 검토 액션을 잇는다.
describe("aiTeamWorkPane", () => {
  isolateTimers();
  let window: Window;
  beforeEach(() => {
    window = new Window();
    const scope = globalThis as unknown as { document: unknown; window: unknown; HTMLElement: unknown; Node: unknown };
    scope.document = window.document;
    scope.window = window;
    scope.HTMLElement = window.HTMLElement;
    scope.Node = window.Node;
  });
  afterEach(() => {
    setTeamReviewActions(null);
    window.close();
  });
  function q(root: HTMLElement, testid: string): HTMLElement | null {
    return root.querySelector(`[data-testid="${testid}"]`);
  }
  function qa(root: HTMLElement, testid: string): HTMLElement[] {
    return [...root.querySelectorAll(`[data-testid="${testid}"]`)] as HTMLElement[];
  }
  function agentEvent(state: TeamBoardState, agentId: string, event: Parameters<typeof reduceTeamBoard>[1]): TeamBoardState {
    return reduceTeamBoard(state, { type: "agent_event", agentId, event });
  }
  function teamRun(): TeamBoardState {
    // These assertions exercise the trace-less transcript fallback.
    let state: TeamBoardState = { ...createTeamBoardState("team", "대장간 거리"), trace: undefined };
    state = reduceTeamBoard(state, { type: "team_start", task: state.task, roles: [] });
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "lead", role: "orchestrator", mapId: null, mapName: null, task: state.task });
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "map_a", mapName: "시장 마을", task: "대장간 2채", memberId: "architect", label: "건축가" });
    state = agentEvent(state, "b1", { type: "turn", index: 1 });
    state = agentEvent(state, "b1", { type: "tool_start", id: "t1", name: "paint_tiles", args: { x: 13, y: 5 } });
    state = agentEvent(state, "b1", { type: "tool_end", id: "t1", name: "paint_tiles", ok: true, summary: "12칸" });
    return state;
  }
  describe("작업 페인", () => {
    it("상태가 없으면 빈 안내, 실행이 오면 팀장 먼저 선 팀원 열과 최근 팀원의 과정이 흐른다", () => {
      const pane = createTeamWorkPane();
      expect(q(pane.root, "ai-team-work-empty")!.hasAttribute("hidden")).toBe(false);
      pane.update(teamRun());
      expect(q(pane.root, "ai-team-work-empty")!.hasAttribute("hidden")).toBe(true);
      const members = qa(pane.root, "ai-team-work-member");
      expect(members.map((node) => node.dataset.agentId)).toEqual(["lead", "b1"]);
      expect(qa(pane.root, "ai-team-work-member-kind").map((node) => node.textContent)).toEqual(["팀장", "시공"]);
      expect(members[1]!.getAttribute("aria-selected")).toBe("true");
      expect(q(pane.root, "ai-team-tx-name")!.textContent).toBe("건축가");
      const tool = q(pane.root, "ai-team-tx-tool")!;
      expect(tool.dataset.state).toBe("ok");
      expect(pane.root.querySelector(".ai-team-work-body")!.classList.contains("is-single")).toBe(false);
    });

    it("팀원을 누르면 고정되고, 새 배정이 와도 따라가지 않는다", () => {
      const pane = createTeamWorkPane();
      let state = teamRun();
      pane.update(state);
      qa(pane.root, "ai-team-work-member")[0]!.click();
      // 팀장은 이름이 종류 배지와 같아 헤더에 배지만 남는다 — 과정 열이 팀장을 보고 있는지는 배지로 본다.
      expect(q(pane.root, "ai-team-tx-kind")!.textContent).toBe("팀장");
      expect(q(pane.root, "ai-team-tx-name")!.hidden).toBe(true);
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b2", role: "builder", mapId: "map_b", mapName: "숲", task: "길 정비", memberId: "gardener", label: "정원사" });
      pane.update(state);
      expect(q(pane.root, "ai-team-tx-kind")!.textContent).toBe("팀장");
      expect(q(pane.root, "ai-team-tx-name")!.hidden).toBe(true);
      expect(qa(pane.root, "ai-team-work-member").length).toBe(3);
    });

    it("한 명뿐인 실행은 팀원 열 없이 과정만 남긴다", () => {
      const pane = createTeamWorkPane();
      let state: TeamBoardState = { ...createTeamBoardState("single", "우물 옆 벤치"), trace: undefined };
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "agent-1", role: "builder", mapId: "map_a", mapName: "시장 마을", task: "우물 옆 벤치" });
      state = agentEvent(state, "agent-1", { type: "tool_start", id: "t1", name: "place_event", args: {} });
      pane.update(state);
      expect(pane.root.querySelector(".ai-team-work-body")!.classList.contains("is-single")).toBe(true);
      expect(q(pane.root, "ai-team-tx-tool")).not.toBeNull();
      // 라벨 없는 시공은 이름이 종류와 같다 — 「시공 시공」 이 되지 않게 배지만 남긴다.
      expect(q(pane.root, "ai-team-tx-kind")!.textContent).toBe("시공");
      expect(q(pane.root, "ai-team-tx-name")!.hidden).toBe(true);
    });

    it("검토 대기면 스트립이 서고, 버튼은 버스의 검토 액션을 부른다", () => {
      const pane = createTeamWorkPane();
      let applied = 0;
      let discarded = 0;
      let opened = 0;
      setTeamReviewActions({ apply: () => { applied += 1; }, discard: () => { discarded += 1; }, openReport: () => { opened += 1; } });
      pane.update(markTeamBoardReview(teamRun(), ["타일 12칸"]));
      const strip = q(pane.root, "ai-team-work-review")!;
      expect(strip.hasAttribute("hidden")).toBe(false);
      expect(strip.textContent).toContain("타일 12칸");
      q(pane.root, "ai-team-work-apply")!.click();
      q(pane.root, "ai-team-work-discard")!.click();
      q(pane.root, "ai-team-work-report")!.click();
      expect([applied, discarded, opened]).toEqual([1, 1, 1]);
    });

    it("검토 액션이 없으면 버튼은 비활성, 보고서 버튼은 아예 없다", () => {
      const pane = createTeamWorkPane();
      setTeamReviewActions(null);
      pane.update(markTeamBoardReview(teamRun(), []));
      expect((q(pane.root, "ai-team-work-apply") as HTMLButtonElement).disabled).toBe(true);
      expect(q(pane.root, "ai-team-work-report")).toBeNull();
    });

    it("상세 보기는 툴 인자 줄과 배정 전문을 편다 — 압축 보기는 숨긴다", () => {
      const detail = createTeamWorkPane({ detail: true });
      detail.update(teamRun());
      expect(q(detail.root, "ai-team-tx-args")!.textContent).toBe("x: 13 · y: 5");
      expect(detail.root.querySelector(".ai-team-work-member-task")).not.toBeNull();
      const compact = createTeamWorkPane();
      compact.update(teamRun());
      expect(q(compact.root, "ai-team-tx-args")).toBeNull();
    });

    it("새 실행(지시가 바뀜)이 오면 고정을 풀고 새 팀원을 따라간다", () => {
      const pane = createTeamWorkPane();
      let first = teamRun();
      pane.update(first);
      qa(pane.root, "ai-team-work-member")[0]!.click();
      let second: TeamBoardState = { ...createTeamBoardState("team", "숲길 정비"), trace: undefined };
      second = reduceTeamBoard(second, { type: "agent_spawn", agentId: "g1", role: "builder", mapId: "map_b", mapName: "숲", task: "숲길", memberId: "gardener", label: "정원사" });
      pane.update(second);
      expect(q(pane.root, "ai-team-tx-name")!.textContent).toBe("정원사");
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

// 조수가 한 일 — 캔버스 하단 가로 띠(aiWorkStrip). 대화 창에서 빠진 작업 산출물이 여기로 온다(방향 G, 2026-09-17).
describe("aiWorkStrip", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function strip(): FakeElement {
    const root = getAiWorkStripElement() as unknown as FakeElement | null;
    if (!root) throw new Error("작업 띠가 없다");
    return root;
  }
  function cards(): FakeElement[] {
    return strip().querySelectorAll("[data-testid=ai-work-card]");
  }
  function stepEntry(text: string): HTMLElement {
    const entry = document.createElement("div");
    entry.className = "ai-tool-activity-line ai-act";
    entry.dataset.testid = "ai-tool-entry";
    entry.textContent = text;
    return entry;
  }
  function changedPreview(title = "광장 바닥 8×6"): ChangePreviewInput {
    const before = store.getCurrent();
    const mapId = before.startMapId;
    const after = structuredClone(before);
    after.maps[mapId]!.lowerTiles[0] = (after.maps[mapId]!.lowerTiles[0] ?? 0) + 1;
    return { before, after, mapId, title, chips: ["타일 48", "이벤트 +1"], onUndo: vi.fn() };
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    resetAiWorkStripForTest();
    restoreDom?.();
    restoreDom = null;
  });
  describe("작업 띠 — 카드 생명주기", () => {
    it("첫 카드가 생기면 띠가 body 에 붙고 머리 알약이 개수를 말한다", () => {
      // Break: 띠가 채팅 로그 안에 붙거나, 카드 수가 머리에 안 나온다.
      const card = beginAiWorkCard({ title: "우물 놓고 상인 세워줘", onStop: vi.fn() });
      const root = strip();
      expect((document.body as unknown as FakeElement).children).toContain(root);
      expect(root.hidden).toBe(false);
      expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("조수가 한 일");
      expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("1");
      expect(card.root.dataset.state).toBe("running");
      expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")).not.toBeNull();
      expect(root.className).toContain("is-running");
    });

    it("진행 중 카드는 중지 버튼으로 onStop 을 부르고, 단계는 쓰기만 세고 조회는 개수만", () => {
      const onStop = vi.fn();
      const card = beginAiWorkCard({ title: "길 깔아줘", onStop });
      card.noteReadOnly();
      card.noteReadOnly();
      card.appendStep(stepEntry("길 6칸"));
      findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")?.click();
      expect(onStop).toHaveBeenCalledTimes(1);
      expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-step-count")?.textContent).toBe("1단계");
      expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-steps")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);
    });

    it("변경이 붙은 카드는 끝나면 완료 상태 + 맵에서 보기·이 작업만 되돌리기, 중지 버튼은 사라진다", () => {
      const preview = changedPreview();
      const card = beginAiWorkCard({ title: "광장", onStop: vi.fn() });
      card.appendStep(stepEntry("바닥 48칸"));
      card.attachChange(preview);
      card.finish({ ok: true });
      const root = card.root as unknown as FakeElement;
      expect(root.dataset.state).toBe("done");
      expect(findByTestId(root, "ai-work-card-stop")).toBeNull();
      expect(root.querySelector(".ai-work-card-title")?.textContent).toBe("광장 바닥 8×6");
      expect(findByTestId(root, "ai-work-card-meta")?.textContent).toContain("타일 48");
      expect(findByTestId(root, "ai-work-card-locate")).not.toBeNull();
      findByTestId(root, "ai-work-card-undo")?.click();
      expect(preview.onUndo).toHaveBeenCalledTimes(1);
      expect(root.className).toContain("is-undone");
      expect(card.discardIfEmpty()).toBe(false);
      expect(aiWorkCardCount()).toBe(1);
    });

    it("말만 한 턴(조회만·변경 없음)의 카드는 닫을 때 띠에서 빠지고 띠는 숨는다", () => {
      // Break: 질문에 답만 한 턴이 「조수가 한 일」 로 남아 띠를 채운다.
      const card = beginAiWorkCard({ title: "이 영역 크기 알려줘" });
      card.noteReadOnly();
      card.finish({ ok: true });
      expect(card.discardIfEmpty()).toBe(true);
      expect(aiWorkCardCount()).toBe(0);
      expect(strip().hidden).toBe(true);
    });

    it("카드 본문을 누르면 그 카드만 펼쳐져 변경 카드(전→후)와 단계가 그려지고, 나머지는 썸네일 칩", () => {
      const first = beginAiWorkCard({ title: "첫 일" });
      first.appendStep(stepEntry("a"));
      first.finish({ ok: true });
      const second = beginAiWorkCard({ title: "둘째 일" });
      second.appendStep(stepEntry("b"));
      second.attachChange(changedPreview("둘째 변경"));
      second.finish({ ok: true });

      const secondRoot = second.root as unknown as FakeElement;
      expect(findByTestId(secondRoot, "ai-change-card")).toBeNull(); // 펼치기 전엔 안 그린다
      secondRoot.querySelector(".ai-work-card-body")!.click();
      expect(secondRoot.className).toContain("is-open");
      expect(secondRoot.getAttribute("aria-expanded")).toBe("true");
      expect((first.root as unknown as FakeElement).className).toContain("is-mini");
      expect(strip().className).toContain("has-open");
      const changeCard = findByTestId(secondRoot, "ai-change-card");
      expect(changeCard).not.toBeNull();
      expect(changeCard?.querySelector(".ai-change-title")?.textContent).toBe("둘째 변경");
      expect(findByTestId(secondRoot, "ai-work-card-detail")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);

      // 다시 누르면 접힌다.
      secondRoot.querySelector(".ai-work-card-body")!.click();
      expect(secondRoot.className).not.toContain("is-open");
      expect((first.root as unknown as FakeElement).className).not.toContain("is-mini");
    });

    it("머리 알약은 띠를 접고, 넘치는 카드는 오래된 것부터 「+N」 뒤로 숨긴다", () => {
      for (let index = 0; index < AI_WORK_STRIP_MAX_VISIBLE + 2; index += 1) {
        const card = beginAiWorkCard({ title: `일 ${index + 1}` });
        card.appendStep(stepEntry(`s${index}`));
        card.finish({ ok: true });
      }
      const all = cards();
      expect(all).toHaveLength(AI_WORK_STRIP_MAX_VISIBLE + 2);
      expect(all.slice(0, 2).every((card) => card.hidden)).toBe(true);
      expect(all.slice(2).every((card) => !card.hidden)).toBe(true);
      const overflow = findByTestId(strip(), "ai-work-strip-overflow");
      expect(overflow?.hidden).toBe(false);
      expect(overflow?.textContent).toBe("+2");
      overflow?.click();
      expect(cards().every((card) => !card.hidden)).toBe(true);

      const toggle = findByTestId(strip(), "ai-work-strip-toggle");
      toggle?.click();
      expect(strip().className).toContain("is-folded");
      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      toggle?.click();
      expect(strip().className).not.toContain("is-folded");
    });
  });
});

describe("assistantEndpoint", () => {
  isolateTimers();
  const ALL_SURFACES: readonly AiSurface[] = [
    "chat",
    "region",
    "cluster",
    "event-command",
    "structure-kit",
    "tileset-analysis",
  ];
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        removeItem: (key: string) => void values.delete(key),
        clear: () => values.clear(),
      },
    });
    resetAiConnectionStatusCache();
    resetAiTransportHealth();
  });
  afterEach(() => {
    resetAiConnectionStatusCache();
    resetAiTransportHealth();
    Reflect.deleteProperty(globalThis, "localStorage");
    vi.unstubAllGlobals();
  });
  function companionConfig(overrides: Partial<AiConfig> = {}): AiConfig {
    return {
      authMode: "chatgpt",
      providerId: "openai-codex",
      baseUrl: "",
      model: ASSISTANT_CHATGPT_MODEL,
      liteModel: ASSISTANT_CHATGPT_MODEL,
      apiKey: "",
      maxToolCalls: 60,
      maxTokens: 32768,
      reasoningEffort: "medium",
      ...overrides,
    };
  }
  describe("resolveSurfaceAiConfig", () => {
    it("keeps the region surface tool-call ceiling at the generous chat default", () => {
      expect(REGION_SURFACE_MAX_TOOL_CALLS).toBe(2000);
    });

    it("Given any surface When resolving Then the endpoint fields stay identical to the assistant config", () => {
      // 이 스펙이 막는 결함: 표면이 자기 baseUrl/authMode/providerId 를 정하면 '조수 하나로 통일' 이
      // 깨진다. 과거 타일셋 AI 가 직접 baseUrl 을 조립하다 조용히 죽은 경로가 그것이었다.
      const base = companionConfig();

      for (const surface of ALL_SURFACES) {
        const resolved = resolveSurfaceAiConfig(surface, base);
        expect(resolved.authMode, surface).toBe(base.authMode);
        expect(resolved.baseUrl, surface).toBe(base.baseUrl);
        expect(resolved.providerId, surface).toBe(base.providerId);
        expect(resolved.apiKey, surface).toBe(base.apiKey);
      }
    });

    it("Given the chat surface When resolving Then the stored supervisor config passes through untouched", () => {
      const base = companionConfig();

      expect(resolveSurfaceAiConfig("chat", base)).toEqual(base);
    });

    // 7bd18dcc0 (#4775) routes Codex batch work through Deep and sets Sol's minimum effort to medium.
    it.each([
      { setting: "legacy lite model", base: companionConfig({ model: "gpt-6.2-astra", reasoningEffort: "off" }) },
      {
        setting: "explicit execution role",
        base: companionConfig({
          model: "gpt-6.2-astra",
          liteModel: "gpt-6.2-astra",
          reasoningEffort: "high",
          roleModels: { deep: { provider: "openai-codex", model: ASSISTANT_CHATGPT_MODEL, thinkingLevel: "medium" } },
        }),
      },
    ])("Given batch surfaces with $setting When resolving Then they use Sol at medium effort", ({ base }) => {
      for (const surface of ["region", "cluster", "event-command"] as const) {
        const resolved = resolveSurfaceAiConfig(surface, base);
        expect(resolved.model, surface).toBe("gpt-6.2-sol");
        expect(resolved.reasoningEffort, surface).toBe("medium");
      }
    });

    it.each(["medium", "high"] as const)("Given supervisor surfaces at %s effort When resolving Then they keep the supervisor model and effort", (reasoningEffort) => {
      const base = companionConfig({ liteModel: "gpt-6.2-astra", reasoningEffort });

      for (const surface of ["chat", "structure-kit", "tileset-analysis"] as const) {
        const resolved = resolveSurfaceAiConfig(surface, base);
        expect(resolved.model, surface).toBe("gpt-6.2-sol");
        expect(resolved.reasoningEffort, surface).toBe(reasoningEffort);
      }
    });

    it("Given the region surface When the user allows more tool calls Then the surface ceiling wins", () => {
      const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5000 }));

      expect(resolved.maxToolCalls).toBe(REGION_SURFACE_MAX_TOOL_CALLS);
    });

    it("Given the region surface When the user allows fewer tool calls Then the user value is respected", () => {
      // 상한이지 하한이 아니다 — 사용자가 더 조심스럽게 골랐으면 그 값이 남아야 한다.
      const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5 }));

      expect(resolved.maxToolCalls).toBe(5);
    });

    it("Given the tileset surface When the user budget is larger Then the mapping budget is pinned, not raised", () => {
      // 실측 근거: cpen 은 max_tokens 8192 통과, 32768 은 422. 사용자 예산으로 올리면 그 조합이 깨진다.
      const resolved = resolveSurfaceAiConfig("tileset-analysis", companionConfig({ maxTokens: 32768 }));

      expect(resolved.maxTokens).toBe(TILESET_ANALYSIS_MAX_TOKENS);
    });

    it("Given a surface with no policy knobs When resolving Then the base object is returned as-is", () => {
      const base = companionConfig();

      expect(resolveSurfaceAiConfig("chat", base)).toBe(base);
    });
  });
  describe("isAssistantEndpointReady", () => {
    it("Given browser-stored config When the auth cache is cold Then the first attempt stays available", () => {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        authMode: "apiKey",
        baseUrl: "https://discarded.invalid/v1",
        apiKey: "discarded-key",
        model: "   ",
      }));

      const config = loadAiConfig();
      const status = getAiConnectionStatus(config);

      // loadAiConfig normalizes this otherwise-invalid blob to OAuth plus a default model. Shape readiness alone
      // is therefore true in every browser; the live status is the part that can later close the gate.
      expect(config.authMode).toBe("chatgpt");
      expect(config.model.trim()).not.toBe("");
      expect(status.kind).toBe("checking");
      expect(isAssistantEndpointReady(config, status)).toBe(true);
    });

    it("Given browser-stored config When refresh reports logged out Then readiness blocks", async () => {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        authMode: "chatgpt",
        providerId: "google-antigravity",
        model: "gemini-3.7-flash",
      }));
      vi.stubGlobal("fetch", vi.fn(async () => new Response(
        JSON.stringify({ connected: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )));

      await refreshAiConnectionStatus();
      const config = loadAiConfig();
      const status = getAiConnectionStatus(config);

      expect(status.kind).toBe("disconnected");
      expect(isAssistantEndpointReady(config, status)).toBe(false);
    });

    it("Given companion transport When no client key is stored Then it is ready", () => {
      // OAuth(동반 서비스)는 자격 증명을 브라우저에 두지 않는 것이 정상 상태다.
      expect(isAssistantEndpointReady(companionConfig())).toBe(true);
    });

    it("Given no configured model When judging readiness Then it is not ready", () => {
      // 이 스펙이 막는 결함: 타일셋 AI 만 모델을 보지 않아 버튼이 열려 있었고 `model: ""` 로 요청이 나갔다.
      // 이 상태는 주입 설정(노드 스크립트·벤치마크·테스트)에서만 온다 — loadAiConfig 는 모델을 백필한다.
      expect(isAssistantEndpointReady(companionConfig({ model: "   ", liteModel: "" }))).toBe(false);
    });

    it("Given a blank config When resolving a batch surface Then the lite default hides the absence", () => {
      // 준비 판정이 표면을 인자로 받지 않는 이유. Codex 실행 역할은 모델이 하나도 없을 때
      // 제공자의 기본 모델을 채우므로, 해석된 설정으로 판정하면 배치 표면은 영원히 '준비됨' 이 된다 —
      // 설정이 빈 상태에서 조수만 거부하고 영역·클러스터는 기본 모델로 요청을 보내는 갈림이 그것이다.
      const blank = companionConfig({ model: "   ", liteModel: "" });

      expect(resolveSurfaceAiConfig("region", blank).model.trim()).not.toBe("");
      expect(isAssistantEndpointReady(blank)).toBe(false);
    });

    it("Given a relative baseUrl gateway When the client has no key Then proxy auth is exempt", () => {
      const config = companionConfig({ authMode: "apiKey", baseUrl: "/api/ai", apiKey: "" });

      expect(isAssistantEndpointReady(config)).toBe(true);
    });

    it("Given an absolute gateway baseUrl When the client has no key Then it is not ready", () => {
      const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "" });

      expect(isAssistantEndpointReady(config)).toBe(false);
    });

    it("Given an absolute gateway baseUrl and a key When judging readiness Then it is ready", () => {
      const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "sk-test" });

      expect(isAssistantEndpointReady(config)).toBe(true);
    });

    it("Given only a supervisor model When resolving a batch surface Then the lite tier follows it", () => {
      // Codex 실행 역할은 liteModel 이 비면 감독 model 을 따라간다. 기본값과 다른 모델로 폴백을 검증한다.
      const base = companionConfig({ model: "gpt-6.2-astra", liteModel: "" });

      expect(resolveSurfaceAiConfig("region", base).model).toBe("gpt-6.2-astra");
    });
  });
});

// 조수 역할 배정(src/ai/assistantRoles.ts) — 연결 조합마다 역할 여섯이 어떻게 채워지고, 못 채운 역할이 무엇으로 물러나는지.
describe("assistantRoles", () => {
  isolateTimers();
  const ok = (a: RoleAssignment) => (a.status === "ok" ? `${a.model.provider}/${a.model.model}` : `missing: ${a.degrade}`);
  const table = (spec: string) => {
    const roles = resolveAssistantRoles(mockConnectedRoutes(spec));
    return Object.fromEntries(Object.entries(roles).map(([role, a]) => [role, ok(a)])) as Record<AssistantRole, string>;
  };
  describe("resolveAssistantRoles — 연결 조합", () => {
    it("Gemini 만: 검토자는 3.8 flash 를 쓰고, 그림은 ChatGPT 연결을 안내한다", () => {
      expect(table("gemini")).toEqual({
        main: "google-antigravity/gemini-4-argon",
        smol: "google-antigravity/gemini-3.8-flash",
        advisor: "google-antigravity/gemini-3.8-flash",
        vision: "google-antigravity/gemini-4-argon",
        image: "missing: 그림은 ChatGPT 로만 그려요. AI 설정에서 ChatGPT 로그인을 연결해 주세요.",
        pixel: "google-antigravity/gemini-4-argon",
      });
    });

    it("옛 Google 그림 지정 대신 연결된 ChatGPT 를 쓴다", () => {
      const roles = resolveAssistantRoles(
        [{ provider: "gpt", providerId: "openai-codex", models: ["gpt-6.1-sol"] }, ...mockConnectedRoutes("gemini")],
        { image: { provider: "google-antigravity", model: "gemini-3.1-flash-image", thinkingLevel: "off" } },
      );
      expect(ok(roles.image)).toBe("openai-codex/codex-image-default");
    });

    it("Claude 만: 그림 생성은 없다고 말하고, 나머지는 로컬 Claude Code 로 채운다", () => {
      const t = table("claude");
      // 오너 결정 2026-11-23: Claude 경로는 주·눈·도트가 Sonnet 5.5 한 모델이다. 잔일 칸(Haiku)은 없다 — 주 모델이 대신한다.
      expect(t.main).toBe("local-cli:claude/claude-sonnet-5-5");
      expect(t.smol).toMatch(/^missing: 주 모델이 대신함/u);
      // 검토자도 Sonnet 5.5 high(N6 2026-11-16, 모델은 2026-11-23) — Claude 만 있으면 주 모델과 같은 모델이 문맥만 따로 본다.
      expect(t.advisor).toBe("local-cli:claude/claude-sonnet-5-5");
      expect(t.vision).toBe("local-cli:claude/claude-sonnet-5-5");
      expect(t.pixel).toBe("local-cli:claude/claude-sonnet-5-5");
      expect(t.image).toMatch(/^missing: 그림은 ChatGPT 로만 그려요/u);
    });

    it("GPT + DeepSeek: 주는 GPT, 검토자는 다른 계열(DeepSeek), 그림은 GPT Image, DeepSeek 은 그림을 못 받아 눈은 GPT", () => {
      const t = table("gpt,deepseek");
      expect(t.main).toBe("openai-codex/gpt-6.2-sol");
      expect(t.smol).toBe("openai-codex/gpt-6-luna");
      expect(t.advisor).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
      expect(t.vision).toBe("openai-codex/gpt-6.2-sol");
      expect(t.image).toBe("openai-codex/codex-image-default");
      expect(t.pixel).toBe("openai-codex/gpt-6.2-sol");
    });

    it("넷 다: 주는 Claude Sonnet 5.5 high, 검토자는 다른 계열(Gemini Argon), 잔일은 다른 계정의 싼 모델(Claude 에는 잔일 칸이 없다), 그림은 GPT Image", () => {
      const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt,claude,deepseek"));
      expect(roles.main).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
      const t = table("gemini,gpt,claude,deepseek");
      expect(t.advisor).toBe("google-antigravity/gemini-4-argon");
      expect(t.smol).toBe("google-antigravity/gemini-3.8-flash");
      expect(t.image).toBe("openai-codex/codex-image-default");
      expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
    });

    it("Claude 가 없으면 주 작업은 Argon medium 으로 물러난다", () => {
      const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt"));
      expect(roles.main).toMatchObject({ status: "ok", model: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } });
    });

    it("연결 없음: 여섯 다 missing 이고 각자 물러나는 말을 한다", () => {
      const roles = resolveAssistantRoles([]);
      expect(Object.values(roles).every((a) => a.status === "missing")).toBe(true);
      expect(ok(roles.smol)).toContain("주 모델이 대신함");
      expect(ok(roles.advisor)).toContain("검토자 꺼짐");
      expect(ok(roles.vision)).toContain("그림 검사 없음");
    });
  });
  describe("resolveAssistantRoles — 규칙", () => {
    it("검토자는 다른 계열이 없으면 같은 계열의 다른 모델, 그것도 없으면 같은 모델에 표시를 단다", () => {
      const sameOnly = resolveAssistantRoles(mockConnectedRoutes("deepseek"));
      expect(sameOnly.advisor.status === "ok" && sameOnly.advisor.note).toMatch(/주 모델과 같은 모델/u);
    });

    it("DeepSeek 엔드포인트가 그림을 받으면 눈을 맡길 수 있다", () => {
      const roles = resolveAssistantRoles([{ provider: "deepseek", providerId: "openai-compat:inferhub", models: ["deepseek-v4.1-flash"], supportsImages: true }]);
      expect(ok(roles.vision)).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
      expect(ok(resolveAssistantRoles(mockConnectedRoutes("deepseek")).vision)).toMatch(/^missing/u);
    });

    it("엔드포인트가 낸 모델 목록에 없는 모델은 배정하지 않는다", () => {
      const roles = resolveAssistantRoles([{ provider: "gemini", providerId: "openai-compat:cliproxy-argon", models: ["gemini-4-argon-medium"] }]);
      expect(ok(roles.main)).toBe("openai-compat:cliproxy-argon/gemini-4-argon");
      expect(ok(roles.image)).toMatch(/^missing/u);
    });

    it("직접 고른 칸이 이기고, 연결 안 된 계정을 고르면 이유와 함께 물러난다", () => {
      const routes = mockConnectedRoutes("gemini");
      const pick = resolveAssistantRoles(routes, { advisor: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "high" } });
      expect(pick.advisor).toMatchObject({ status: "ok", source: "override" });
      const off = resolveAssistantRoles(routes, { advisor: "off" });
      expect(ok(off.advisor)).toMatch(/직접 끔/u);
      const gone = resolveAssistantRoles(routes, { smol: { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "low" } });
      expect(ok(gone.smol)).toMatch(/연결돼 있지 않음/u);
    });
  });
  describe("assistantRoleModel / configWithAutoAssistantRoles", () => {
    it("자동 배정이 잔일·검토자 칸을 채우고, 직접 고른 칸은 건드리지 않는다", () => {
      // 주 모델이 Google(Argon)인 설정 — 공장 기본은 Claude 라(2026-11-23) Google 계정을 고른 설정으로 만든다.
      const base = configForProviderSelection(defaultAiConfig(), "google-antigravity");
      const auto = configWithAutoAssistantRoles(base, mockConnectedRoutes("gemini,gpt"));
      expect(assistantRoleModel(auto, "advisor")?.provider).toBe("openai-codex");
      expect(assistantRoleModel(auto, "smol")?.model).toBe("gemini-3.8-flash");
      const pinned = configWithAutoAssistantRoles({ ...base, assistantRoles: { advisor: "off" }, modelSelectionOverrides: { advisor: true } }, mockConnectedRoutes("gemini,gpt"));
      expect(assistantRoleModel(pinned, "advisor")).toBeUndefined();
      expect(configWithAutoAssistantRoles(base, []).assistantRoles).toEqual({});
    });

    it("주·눈·도트·그림은 기존 칸을 읽는다", () => {
      const base = defaultAiConfig();
      // 공장 기본(2026-11-23): Claude Sonnet 5.5 · high 한 모델.
      const sonnetHigh = { provider: "anthropic", model: "claude-sonnet-5-5", thinkingLevel: "high" };
      expect(assistantRoleModel(base, "main")).toEqual(sonnetHigh);
      expect(assistantRoleModel(base, "vision")).toEqual(sonnetHigh);
      // 도트 칸은 비어 있어 계획 모델을 따른다.
      expect(assistantRoleModel(base, "pixel")).toEqual(sonnetHigh);
      expect(assistantRoleModel(base, "image")?.model).toBe(base.imageModel);
    });
  });
});

// 조수 스토어 도구(storeTools.ts): 묻기·제안은 카드 데이터만 돌려주고, 스토어 통신은 prepare 가 데스크톱 다리로 한다.
describe("assistantStoreTools", () => {
  isolateTimers();
  const tool = (name: string) => STORE_TOOLS.find((t) => t.name === name)!;
  const project = () => createBlankProject();
  const g = globalThis as { window?: unknown };
  afterEach(() => { delete g.window; });
  describe("조수 스토어 도구", () => {
    it("ask_missing_tiles 는 카드 질문만 돌려준다(종류 기본 tileset, 빈 값은 거절)", () => {
      const r = tool("ask_missing_tiles").run(project(), { need: "신전 타일이 없어요.", query: "신전" });
      expect(r.data).toEqual({ kind: "store-missing-tiles", need: "신전 타일이 없어요.", query: "신전", itemKind: "tileset", purpose: null });
      expect(isStoreCardRequest(r.data)).toBe(true);
      expect(() => tool("ask_missing_tiles").run(project(), { need: "", query: "x" })).toThrow();
    });

    it("store_publish 는 프로젝트에 있는 것만 제안하고, 올리지 않는다", () => {
      const p = project();
      const tilesetId = Object.keys(p.tilesets)[0]!;
      const r = tool("store_publish").run(p, { tilesetIds: [tilesetId], title: "숲", summary: "숲 타일", kind: "tileset", license: "없는 라이선스" });
      expect(r.data).toMatchObject({ kind: "store-publish-proposal", tilesetIds: [tilesetId], license: "OPRN-GAME", aiGenerated: true, aiMade: [], targetSlug: null });
      expect(() => tool("store_publish").run(p, { tilesetIds: ["nope"], title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow(/nope/);
      expect(() => tool("store_publish").run(p, { title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow();
      expect(tool("store_publish").mode).toBe("read");
    });

    it("store_publish 의 「AI 생성」은 조수가 끄지 못하고, AI 가 만든 그림이 들면 잠글 목록을 붙인다", () => {
      const p = project();
      p.assets.uploaded.drawn = { id: "drawn", name: "조수 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {}, generatedBy: "image-generation" };
      p.assets.uploaded.mine = { id: "mine", name: "내 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {} };
      expect((tool("store_publish").parameters as { properties: object }).properties).not.toHaveProperty("aiGenerated");
      const plain = tool("store_publish").run(p, { assetIds: ["mine"], title: "그림", summary: "x", kind: "picture", aiGenerated: false });
      expect(plain.data).toMatchObject({ aiGenerated: true, aiMade: [] });
      const made = tool("store_publish").run(p, { assetIds: ["mine", "drawn"], title: "그림", summary: "x", kind: "picture" });
      expect((made.data as { aiMade: unknown }).aiMade).toEqual([{ id: "drawn", name: "조수 그림", by: "image-generation" }]);
      expect(made.summary).toContain("AI 생성");
    });

    it("store_set_visibility 는 slug 를 검사하고 확인 카드만 낸다", () => {
      expect(tool("store_set_visibility").run(project(), { slug: "my-forest-1a2b", hidden: true }).data).toEqual({ kind: "store-visibility-proposal", slug: "my-forest-1a2b", hidden: true, reason: "" });
      expect(() => tool("store_set_visibility").run(project(), { slug: "../x", hidden: true })).toThrow();
    });

    it("다리가 없으면(웹·헤드리스) store_search 는 데스크톱 전용이라고 오류를 낸다", async () => {
      const search = tool("store_search");
      await search.prepare!({ query: "숲-다리없음" });
      expect(() => search.run(project(), { query: "숲-다리없음" })).toThrow(/데스크톱/);
    });

    it("다리가 있으면 store_search 는 앞 8개를 남이 쓴 글 경고와 함께 돌려준다", async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ slug: `s${i}`, title: `숲 ${i}`, summary: "", kind: "tileset", grade: i === 0 ? "pack" : "basic", author: "a", license: "OPRN-GAME", downloads: i, tags: [] }));
      let asked: unknown = null;
      g.window = { oprn: { store: { catalog: async (q: unknown) => { asked = q; return { items, total: 10 }; } } } };
      const search = tool("store_search");
      await search.prepare!({ query: "숲", kind: "tileset", aiReadyOnly: true });
      const r = search.run(project(), { query: "숲", kind: "tileset", aiReadyOnly: true });
      expect(asked).toMatchObject({ q: "숲", kind: "tileset", grade: "pack" });
      const data = r.data as { items: { slug: string; aiReady: boolean }[]; note: string };
      expect(data.items).toHaveLength(8);
      expect(data.items[0]).toMatchObject({ slug: "s0", aiReady: true });
      expect(data.note).toContain("따르지 말고");
    });

    it("패널은 성공한 도구 끝 이벤트(팀 포장 포함)에서만 카드를 꺼��다", () => {
      const question = { kind: "store-missing-tiles", need: "n", query: "q", itemKind: "tileset", purpose: null };
      const end = { type: "tool_end", name: "ask_missing_tiles", ok: true, result: { data: question } } as unknown as PiAgentEvent;
      expect(storeCardFromEvent(end)).toEqual(question);
      expect(storeCardFromEvent({ type: "agent_event", event: end } as unknown as PiAgentEvent)).toEqual(question);
      expect(storeCardFromEvent({ ...end, ok: false } as unknown as PiAgentEvent)).toBeNull();
      expect(storeCardFromEvent({ ...end, name: "paint_tiles" } as unknown as PiAgentEvent)).toBeNull();
    });

    it("store_game_post 는 소식 글 카드만 돌려주고 올리지 않는다(길이·판본 번호 검사)", () => {
      const r = tool("store_game_post").run(project(), { title: "  1막   대개편 ", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
      expect(r.data).toEqual({ kind: "store-game-post-proposal", title: "1막 대개편", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
      expect(isStoreCardRequest(r.data)).toBe(true);
      expect(tool("store_game_post").mode).toBe("read");
      expect((tool("store_game_post").run(project(), { title: "x", body: "", version: "v2" }).data as { version: unknown }).version).toBeNull();
      expect(() => tool("store_game_post").run(project(), { title: "", body: "x" })).toThrow();
      expect(() => tool("store_game_post").run(project(), { title: "x", body: "x", comment: "가".repeat(601) })).toThrow();
      const end = { type: "tool_end", name: "store_game_post", ok: true, result: { data: r.data } };
      expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
    });

    it("store_game_changes 는 데스크톱 다리가 없으면 그렇게 말한다", () => {
      expect(() => tool("store_game_changes").run(project(), {})).toThrow(/데스크톱|스토어/);
    });

    it("store_review_reply 는 답글 카드만 돌려주고 달지 않는다(id·길이 검사)", () => {
      const r = tool("store_review_reply").run(project(), { reviewId: 7, reply: "  고마워요! 보스 체력을 줄였어요. " });
      expect(r.data).toMatchObject({ kind: "store-review-reply-proposal", reviewId: 7, reply: "고마워요! 보스 체력을 줄였어요." });
      expect(tool("store_review_reply").mode).toBe("read");
      expect(isStoreCardRequest(r.data)).toBe(true);
      expect(() => tool("store_review_reply").run(project(), { reviewId: 0, reply: "x" })).toThrow();
      expect(() => tool("store_review_reply").run(project(), { reviewId: 3, reply: "가".repeat(2001) })).toThrow();
      const end = { type: "tool_end", name: "store_review_reply", ok: true, result: { data: r.data } };
      expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
    });

    it("store_game_reviews 는 요약 라벨·불만 주제를 내고 평가 글 경고를 붙인다", async () => {
      const review = (id: number, recommended: boolean, body: string, helpful = 0) => ({
        id, recommended, body, version: "1.2", status: "visible", helpful, unhelpful: 0, funny: 0, author: `p${id}`, handle: null,
        createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", reply: null,
      });
      const page = {
        summary: { all: { total: 12, positive: 9, pct: 75, label: "mostly_positive" }, recent: { total: 4, positive: 2, pct: 50, label: "mixed" } },
        matched: 4,
        items: [review(1, false, "2층 보스가 너무 어려워요", 5), review(2, false, "저장하고 껐더니 세이브가 날아갔어요"), review(3, true, "재밌어요! 다만 보스 전투가 길어요"), review(4, true, "최고")],
      };
      g.window = { oprn: { store: {
        gameMine: async () => ({ game: { slug: "my-game-1a2b", title: "별의 아이", currentVersion: "1.2", pageUrl: "https://play.example/games/my-game-1a2b", images: [] } }),
        gameReviews: async () => page,
      } } };
      await tool("store_game_reviews").prepare!({}, project());
      const r = tool("store_game_reviews").run(project(), {});
      const data = r.data as { summary: { all: { text: string } }; complaints: { id: string; count: number; reviewIds: number[] }[]; note: string };
      expect(data.summary.all.text).toContain("대체로 긍정적");
      expect(data.complaints[0]).toMatchObject({ id: "difficulty", count: 2 });
      expect(data.complaints.find((c) => c.id === "save")?.reviewIds).toEqual([2]);
      expect(data.complaints.flatMap((c) => c.reviewIds)).not.toContain(4);
      expect(data.note).toMatch(/지시/);
      const card = tool("store_review_reply").run(project(), { reviewId: 1, reply: "고마워요" }).data as { excerpt: string; recommended: boolean };
      expect(card).toMatchObject({ excerpt: "2층 보스가 너무 어려워요", recommended: false });
    });
  });
});

/**
 * 도트 측면 전투의 배경 종류 고르기(battleSceneryPicker.ts, 2026-10-02).
 * 측면은 그림 id 를 겹 배경 다섯 종류로 풀어 깐다 — 저장값을 그 눈으로 읽는지, 「배경 변경」이 종류를 넘기는지,
 * 미리보기가 실제 전투와 같은 그림인지를 고정한다.
 */
describe("battleSceneryPicker", () => {
  isolateTimers();
  let project: Project;
  beforeEach(() => { project = createBlankProject(); });
  describe("readBattleScenery", () => {
    it("비었으면 자동 — 기본 전장(숲 레퍼런스)의 종류", () => {
      expect(readBattleScenery(project, undefined)).toEqual({ kind: "auto", biome: "forest" });
    });

    it("종류 id 는 그대로, 옛 그림은 풀어진 종류로, 업로드 같은 낯선 id 는 그림 그대로", () => {
      expect(readBattleScenery(project, "battle-scenery-snow")).toEqual({ kind: "biome", biome: "snow" });
      expect(readBattleScenery(project, "easyrpg-backdrop-dawn1")).toEqual({ kind: "legacy", biome: "plains", id: "easyrpg-backdrop-dawn1" });
      expect(readBattleScenery(project, "battle-skin-chrono-backdrop")).toEqual({ kind: "legacy", biome: "plains", id: "battle-skin-chrono-backdrop" });
      expect(readBattleScenery(project, "uploaded-my-castle")).toEqual({ kind: "custom", id: "uploaded-my-castle" });
    });
  });
  describe("nextBattleScenery", () => {
    it("자동·옛 그림 → 풀밭, 그다음 차례로 돌고 사막 뒤엔 풀밭", () => {
      expect(nextBattleScenery(undefined)).toBe("battle-scenery-plains");
      expect(nextBattleScenery("easyrpg-backdrop-dawn1")).toBe("battle-scenery-plains");
      expect(nextBattleScenery("battle-scenery-plains")).toBe("battle-scenery-forest");
      expect(nextBattleScenery("battle-scenery-desert")).toBe("battle-scenery-plains");
    });
  });
  describe("battleBackdropPreviewUrl", () => {
    it("도트 측면은 종류의 미리보기 그림, 몬스터 대치는 고른 그림", () => {
      expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1")).toContain("battle-scenery/plains/preview.png");
      expect(battleBackdropPreviewUrl(project, undefined)).toBeUndefined();
      expect(battleBackdropPreviewUrl(project, undefined, { showAuto: true })).toContain("battle-scenery/forest/preview.png");
      applyBattleMethod(project, "monster");
      expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1") ?? "").not.toContain("battle-scenery");
    });
  });
});
