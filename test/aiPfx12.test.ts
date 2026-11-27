import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { BLIND_MODEL_FINDING, isBlindImageStatus } from "../scripts/lib/piTeamRuntime";
import { createTeamBoardState, reduceTeamBoard, markTeamBoardReview, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { teamActivityAge, teamObservation } from "@/editor/panels/aiTeamObservation";
import { activityPhase } from "@/ai/activityTrace";
import { Window } from "happy-dom";
import { setTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { createTeamWorkPane } from "@/editor/panels/aiTeamWorkPane";
import { isolateTimers } from "./mergedTeardown";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

describe("aiTeam", () => {
  isolateTimers();
  describe("aiTeamBlindImageGate", () => {
    isolateTimers();
    describe("J69 follow-up: blind-model image gate message", () => {
      it("recognises a not-delivered image status", () => {
        expect(isBlindImageStatus({ type: "execution_status", name: "map.image.delivered", ok: false })).toBe(true);
        expect(isBlindImageStatus({ type: "execution_status", name: "presentation.image.delivered", ok: false })).toBe(true);
        expect(isBlindImageStatus({ type: "execution_status", name: "map.background.delivered", ok: false })).toBe(true);
      });
      it("ignores delivered images and other statuses", () => {
        expect(isBlindImageStatus({ type: "execution_status", name: "map.image.delivered", ok: true })).toBe(false);
        expect(isBlindImageStatus({ type: "execution_status", name: "first_scene.review_passed", ok: false })).toBe(false);
        expect(isBlindImageStatus({ type: "tool_end", name: "map.image.delivered", ok: false })).toBe(false);
      });
      it("blames the model", () => {
        expect(BLIND_MODEL_FINDING).toContain("이 모델은 그림을 못 본다");
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
});

// test/aiWorkItemOutcomeGateSmoke.test.ts
//
// 2026-08-28 회귀 재현(project oprn-4f65d09fb1, 요청 "음 다른맵을 더 만들자").
// 플래너 항목은
//   instruction "create_map 후 지형 및 길 타일 페인팅"
//   doneWhen    "맵이 생성되고 기본 지형이 칠해짐"
//   successTools ["create_map"]
// 였고, advanceWorkPlanFromTools 가 doneWhen 을 읽지 않으므로 create_map 성공 3초 만에
// 항목이 done 으로 넘어갔다. 남은 결과물은 잔디 단색 맵(고유 타일 1종·이벤트 0)이었다.
//
// 여기서는 실제 세션 루프 + 실제 툴 실행기 + 가짜 LLM(scriptedChat)으로 그 순서를 그대로
// 재생해, 산출물 게이트가 자동 완료를 막는지 / 채우면 통과하는지를 증명한다.
describe("aiWorkItemOutcomeGateSmoke", () => {
  isolateTimers();
  function installHermeticEnv(project: Project): void {
    // This smoke measures the work-item outcome gate. The beodeul_city default now ships reference docs, so fill_region
    // would first stop at the separate reference-read gate (tileset-reference-read-required, src/ai/tilesetReferenceEvidence.ts).
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.referenceDocuments;
      for (const kit of tileset.structureKits ?? []) delete kit.referenceDocuments;
    }
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
  }
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  type ChatResult = import("@/ai/llmClient").ChatResult;
  async function load() {
    const [assistantSession, defaults] = await Promise.all([
      import("@/ai/assistantSession"),
      import("@/project/defaults"),
    ]);
    return { AssistantSession: assistantSession.AssistantSession, createBlankProject: defaults.createBlankProject };
  }
  function toolCallResult(name: string, args: unknown, id: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }
  function finalResult(text: string): ChatResult {
    return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
  }
  function exhausted(): never {
    throw new (class extends Error {
      readonly status = 401;
      constructor() {
        super("scripted chat exhausted");
        this.name = "LlmError";
      }
    })();
  }
  // 모델·보조모델 id 가 임의 문자열이면 창이 보수 폴백 128,000 토큰으로 잡히는데, 툴 카탈로그만 98K 토큰이라
  // 이 스모크가 검증하려는 산출물 게이트 대신 원본 매니페스트 자리 부족으로 턴이 죽는다
  // (`original-context-window-exceeded`). 산출물 게이트를 재는 픽스처이므로 실제 카탈로그 모델을 쓴다.
  // 좁은 창(128K 급 모델) 자체의 계약은 test/aiToolCatalogBudget.test.ts 가 따로 감시한다.
  const CONFIG = {
    authMode: "apiKey" as const,
    agentMode: "auto" as const,
    baseUrl: "x",
    model: "gemini-3.7-flash",
    liteModel: "gemini-3.7-flash-lite",
    apiKey: "sk",
    maxToolCalls: 8,
    maxTokens: 512,
  };
  const FIELD_MAP_ID = "map_field_forest";
  /** 실제로 관측된 계획 모양 — doneWhen 은 페인팅까지 요구하는데 successTools 는 create_map 하나. */
  const PAINT_PLAN = {
    goal: "탐험 가능한 신규 야외 필드 맵 생성",
    layers: [
      {
        title: "신규 맵 생성 및 기본 지형 구성",
        items: [
          {
            title: "야외 필드(숲길/외곽) 맵 생성",
            instruction: "create_map으로 30x30 크기의 야외 필드 맵 생성 후 지형 및 길 타일 페인팅",
            doneWhen: "새로운 야외 필드 맵이 생성되고 기본 지형이 칠해짐",
            successTools: ["create_map"],
            mapTargets: [FIELD_MAP_ID],
          },
        ],
      },
    ],
  };
  const createMapCall = (id: string) =>
    toolCallResult("create_map", { id: FIELD_MAP_ID, name: "초록바람 숲길", width: 30, height: 30 }, id);
  const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
    session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));
  function scriptedChat(steps: readonly ChatResult[]): () => Promise<ChatResult> {
    let index = 0;
    return async () => (index < steps.length ? steps[index++]! : exhausted());
  }
  describe("산출물 게이트 통합 스모크 — 만들고 안 채운 맵", () => {
    it("create_map 만 성공하면 successTools 를 채워도 항목이 완료되지 않는다", async () => {
      const { AssistantSession, createBlankProject } = await load();
      const project = createBlankProject();
      installHermeticEnv(project);
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: scriptedChat([
          finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
          toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
          createMapCall("c_map"),
          finalResult("야외 필드 맵을 생성했습니다."),
        ]),
      });

      await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

      const audits = statusTexts(session);
      expect(audits.some((text) => text.includes("자동 완료 차단"))).toBe(true);
      expect(audits.some((text) => text.includes("WorkPlan 자동 완료:"))).toBe(false);

      // 실제로 잔디 단색 맵이 남았는지 — 게이트가 막아야 하는 그 상태다.
      const created = session.getProposedProject().maps[FIELD_MAP_ID];
      expect(created).toBeDefined();
      expect(new Set(created!.lowerTiles).size).toBe(1);
      expect(created!.events.length).toBe(0);
    }, 30000);

    it("같은 항목에서 지형을 칠하면 자동 완료된다", async () => {
      const { AssistantSession, createBlankProject } = await load();
      const project = createBlankProject();
      installHermeticEnv(project);
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: scriptedChat([
          finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
          toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
          createMapCall("c_map"),
          // fill_region 은 공간 빌드 스펙 게이트 대상이라 밑그림을 먼저 낸다(실제 모델도 같은 순서).
          toolCallResult(
            "set_build_spec",
            {
              mapId: FIELD_MAP_ID,
              title: "숲길 호수",
              assets: [{ id: "lake", kind: "terrain", x: 4, y: 4, w: 10, h: 10 }],
            },
            "c_spec",
          ),
          toolCallResult(
            "fill_region",
            { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "circle" },
            "c_fill",
          ),
          finalResult("야외 필드 맵을 만들고 호수를 칠했습니다."),
        ]),
      });

      await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

      const created = session.getProposedProject().maps[FIELD_MAP_ID];
      expect(created).toBeDefined();
      expect(new Set(created!.lowerTiles).size).toBeGreaterThan(1);
      expect(statusTexts(session).some((text) => text.includes("WorkPlan 자동 완료:"))).toBe(true);
    }, 30000);

    it("완성도 경고만 남았을 때 명시 complete_work_item 은 통과한다(교착 없음)", async () => {
      const { AssistantSession, createBlankProject } = await load();
      const project = createBlankProject();
      installHermeticEnv(project);
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: scriptedChat([
          finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
          toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
          createMapCall("c_map"),
          toolCallResult(
            "set_build_spec",
            {
              mapId: FIELD_MAP_ID,
              title: "숲길 호수",
              assets: [
                { id: "lake", kind: "terrain", x: 4, y: 4, w: 10, h: 10 },
                // 밑그림에만 있고 끝까지 칠하지 않는 에셋 — 완성도 경고의 근거다.
                { id: "grove", kind: "decor", x: 16, y: 2, w: 4, h: 4 },
              ],
            },
            "c_spec",
          ),
          toolCallResult(
            "fill_region",
            { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "circle" },
            "c_fill",
          ),
          // 밑그림 에셋 하나를 안 칠한 채로 명시 완료를 시도해 완성도 경고를 남긴다.
          toolCallResult("complete_work_item", { note: "숲은 다음 항목에서 정리" }, "c_done"),
          finalResult("완료했습니다."),
        ]),
      });

      await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

      const audits = statusTexts(session);
      // 자동 완료는 완성도 경고로 막히고,
      expect(audits.some((text) => text.includes("자동 완료 차단") && text.includes("완성도 경고"))).toBe(true);
      // 모델이 명시 완료를 부르면 산출물 게이트만 보므로 진행된다.
      const completed = session
        .getAuditEntries()
        .some((entry) => entry.kind === "tool" && String((entry as { summary?: string }).summary ?? "").startsWith("완료:"));
      expect(completed).toBe(true);
    }, 30000);
  });
});
