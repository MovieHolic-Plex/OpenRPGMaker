import { describe, expect, it, beforeEach } from "vitest";
import { mergesMapBundles, parsePiCommand, plainPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { handleCompanionRequest, isCompanionPath } from "../scripts/lib/ohMyPiHttp.mjs";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { DEFAULT_PI_TEAM, resolvePiRunPlan } from "@/ai/piAgent/executionRoute";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { createTeamBoardState, markTeamBoardDiscarded, markTeamBoardReview, reduceTeamBoard, markTeamBoardAborted, markTeamBoardApplied, markTeamBoardDone, plainLine, teamBoardTotals } from "@/ai/piAgent/teamBoardState";
import { PI_TEAM_ROLES, teamRoleSummaries } from "@/ai/piAgent/team";
import { selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { isolateTimers } from "./mergedTeardown";

describe("piAgentCommandAndRoute", () => {
  isolateTimers();
  describe("맵 묶음 병합 여부 = 가드 신호", () => {
    it("평문이라도 에이전트가 둘 이상이면 병합한다(팀 제외)", () => {
      expect(mergesMapBundles({ team: false, mapIds: ["a", "b"], scopedByUser: false, groupCount: 2 })).toBe(true);
      expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: true, groupCount: 1 })).toBe(true);
      expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: false, groupCount: 1 })).toBe(false);
      expect(mergesMapBundles({ team: true, mapIds: ["a", "b"], scopedByUser: true, groupCount: 1 })).toBe(false);
      expect(mergesMapBundles({ team: false, mapIds: [], scopedByUser: false, groupCount: 1 })).toBe(false);
    });
  });
  describe("/pi 명령 파서", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
    runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });

    it("접두사가 없으면 null", () => {
      expect(parsePiCommand("집 지어줘", ctx.project, "map_a")).toBeNull();
      expect(parsePiCommand("/pixel", ctx.project, "map_a")).toBeNull();
    });
    it("맵 목록이 없으면 현재 맵이 범위다", () => {
      expect(parsePiCommand("/pi 집 지어줘", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "집 지어줘" });
      expect(parsePiCommand("/pi 집 지어줘", ctx.project, null)).toEqual({ mode: "single", mapIds: [], currentMapId: null, task: "집 지어줘" });
    });
    // scopedByUser 는 이 갈래에서만 켜진다 — 사용자가 맵을 **직접 적은** 턴과 현재 맵으로 채운
    // 기본값을 구별한다. 병합이 범위 밖을 버리는 것은 전자뿐이다(2026-09-17).
    it("실존하는 맵 id 목록은 병렬 범위로 읽고, 사용자가 정한 범위로 표시한다", () => {
      expect(parsePiCommand("/pi map_a,map_b 집 한 채", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 한 채" });
      expect(parsePiCommand("/pi map_a,map_a 집", ctx.project, null)).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: null, scopedByUser: true, task: "집" });
      // 없는 id 는 지시문의 첫 단어일 뿐이다.
      expect(parsePiCommand("/pi map_zzz 집", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "map_zzz 집" });
    });
    it("team은 바로 팀 실행이며 기존 슬래시 명령도 호환된다", () => {
      // currentMapId 는 팀장이 「여기」를 푸는 기준이라 팀 턴에도 늘 실린다(2026-09-15) — 이 기대값은
      // 그때 갱신되지 않아 계속 빨간불이었다.
      expect(parsePiCommand("/team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
      expect(parsePiCommand("team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
      expect(parsePiCommand("team\nmap_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
      expect(parsePiCommand("/pi team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
      expect(parsePiCommand("/team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
      expect(parsePiCommand("/pi team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
      // 팀 키워드로 시작하는 일반 단어는 명령이 아니다.
      expect(parsePiCommand("/teamspeak 열어줘", ctx.project, "map_a")).toBeNull();
      expect(parsePiCommand("teamwork 설명해줘", ctx.project, "map_a")).toBeNull();
      expect(parsePiCommand("team", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "" });
      expect(parsePiCommand("/team", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "" });
    });
  });
  describe("동반 라우터 /v1/agent/run", () => {
    it("경로를 인식하고 어댑터의 NDJSON 을 실행 기록을 거쳐 seq 를 붙여 넘긴다", async () => {
      expect(isCompanionPath("/v1/agent/run?provider=openai-codex")).toBe(true);
      expect(isCompanionPath("/v1/agent/cancel")).toBe(true);
      const seen: unknown[] = [];
      const ndjson = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"type":"turn","index":1}\n')); c.close(); } });
      const adapters = { runAgent: async (provider: string, body: unknown, options: unknown) => { seen.push([provider, body, options]); return { stream: true, ndjson }; } };
      const result = await handleCompanionRequest(
        { method: "POST", url: "/v1/agent/run?provider=openai-codex", headers: {}, body: { task: "x", mapIds: [], project: {} } },
        adapters,
      );
      expect(result).toMatchObject({ status: 200, stream: true });
      // runId 를 안 보낸 옛 클라이언트도 호스트가 번호를 매겨 헤더로 알려 준다.
      expect(result.headers?.["X-Oprn-Run-Id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
      const text = await new Response(result.ndjson).text();
      expect(text.trim().split("\n").map((line) => JSON.parse(line))).toEqual([{ seq: 0, type: "turn", index: 1 }]);
      expect(seen).toHaveLength(1);
      const [provider, body, options] = seen[0] as [string, unknown, { signal?: AbortSignal }];
      expect(provider).toBe("openai-codex");
      expect(body).toEqual({ task: "x", mapIds: [], project: {} });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
    it("어댑터가 없으면 501", async () => {
      const result = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: {} }, {});
      expect(result.status).toBe(501);
    });
  });
});

// 조수 채팅의 실행 계획 — 루프는 Pi 하나다(2026-09-11).
//
// 예전에는 경로 enum(session | pi-agent | pi-team)이 «어느 루프로 가는가» 를 답했다. 조수 세션을
// deprecated 하면서 남은 결정은 둘뿐이다: «이 실행이 무엇을 해도 되는가»(자율성 다이얼 →
// readOnly·planOnly·턴 상한·추론)와 «몇 명이 도는가»(`AiConfig.piTeam`).
describe("piAgentExecutionRoute", () => {
  isolateTimers();
  class MemoryStorage {
    private map = new Map<string, string>();
    get length() { return this.map.size; }
    clear() { this.map.clear(); }
    getItem(key: string) { return this.map.get(key) ?? null; }
    key(index: number) { return [...this.map.keys()][index] ?? null; }
    removeItem(key: string) { this.map.delete(key); }
    setItem(key: string, value: string) { this.map.set(key, value); }
  }
  describe("자율성 다이얼 → Pi 실행 계획", () => {
    it("읽기 전용은 쓰기 없이 답만 한다", () => {
      // Break: readOnly 가 꺼지면 질문 턴이 프로젝트를 바꾼다 — 다이얼이 「읽기 전용」인데 실행되면
      // 사용자가 고른 유일한 안전장치가 사라진다.
      expect(resolvePiRunPlan(resolveAutonomy("readonly"))).toEqual({
        readOnly: true, planOnly: false, maxTurns: 50, thinkingLevel: "low",
      });
    });
    it("계획(확인) 턴은 실행도 막는다", () => {
      // 계획만 세우는데 쓰기 툴이 살아 있으면 "계획" 이 곧 실행이 된다(Pi 에는 세션 플래너가 없다).
      const plan = resolvePiRunPlan(resolveAutonomy("confirm"));
      expect(plan.readOnly).toBe(true);
      expect(plan.planOnly).toBe(true);
      expect(plan.maxTurns).toBe(50);
    });
    it("실행 레벨은 턴 상한·추론이 단조 증가한다", () => {
      const balanced = resolvePiRunPlan(resolveAutonomy("balanced"));
      const autonomous = resolvePiRunPlan(resolveAutonomy("autonomous"));
      const max = resolvePiRunPlan(resolveAutonomy("max"));
      expect([balanced.readOnly, balanced.planOnly]).toEqual([false, false]);
      expect([balanced.maxTurns, autonomous.maxTurns, max.maxTurns]).toEqual([200, 300, 600]);
      expect([balanced.thinkingLevel, autonomous.thinkingLevel, max.thinkingLevel]).toEqual(["low", "medium", "high"]);
    });
    // Break: 여기서 budgetCap(도구 호출 예산)을 다시 집어넣으면 「균형」이 16턴으로 돌아가고,
    // 다이얼을 고르는 것이 **안 고르는 것**(워커 기본 40턴)보다 나빠진다 — 2026-09-17 에 재현한
    // 턴 상한 중단 7건 중 4건이 이 조합이었다. 자율성 레벨은 turn 예산에서만 값을 가져온다.
    it("턴 상한은 도구 호출 예산이 아니라 piMaxTurns 에서 온다", () => {
      for (const level of ["balanced", "autonomous", "max"] as const) {
        const autonomy = resolveAutonomy(level);
        expect(resolvePiRunPlan(autonomy).maxTurns, level).toBe(autonomy.piMaxTurns);
        expect(resolvePiRunPlan(autonomy).maxTurns, level).not.toBe(autonomy.budgetCap);
      }
    });
  });
  describe("평문 지시는 팀 비트만 고른다", () => {
    // 실측(2026-09-15): 팀 모드가 현재 맵을 버려 팀장이 43맵 중 엉뚱한 맵에 배정했다. 사용자는 보통 «지금 보고 있는 맵» 을
    // 고치라고 말하므로, 팀도 현재 맵을 안다 — 후보는 그대로 프로젝트 전체(다른 맵을 지목한 지시가 되게)이고 기본 대상만 현재 맵이다.
    it("단독은 현재 맵이 범위, 팀은 후보 맵 없음 + 현재 맵을 기본 대상으로 싣는다", () => {
      expect(plainPiCommand("  집 지어  ", "single", "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "집 지어" });
      expect(plainPiCommand("집 지어", "team", "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "집 지어" });
    });
    it("현재 맵이 없으면 범위가 비고 지시는 그대로다", () => {
      expect(plainPiCommand("map_a 집 지어", "single", null)).toEqual({ mode: "single", mapIds: [], currentMapId: null, task: "map_a 집 지어" });
    });
  });
  describe("AI 설정의 팀·적용 방식", () => {
    beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage(); });

    it("옛 blob 은 팀 꺼짐 + DEFAULT으로 백필한다", () => {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-3.7-flash" }));
      const config = loadAiConfig();
      expect(config.piTeam).toBe(DEFAULT_PI_TEAM);
      expect(config.piApply).toBe("default");
    });
    it("팀 비트와 적용 방식은 저장되고 이상한 값은 기본으로 돌아간다", () => {
      saveAiConfig({ ...loadAiConfig(), piTeam: true, piApply: "auto" });
      expect(loadAiConfig().piTeam).toBe(true);
      expect(loadAiConfig().piApply).toBe("auto");
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!), piTeam: "yes", piApply: "later" }));
      expect(loadAiConfig().piTeam).toBe(false);
      expect(loadAiConfig().piApply).toBe("default");
    });
    it.each(["yolo", "auto", "default", "review", "step"] as const)("%s 모드가 저장·재로드된다", piApply => {
      saveAiConfig({ ...loadAiConfig(), piApply });
      expect(loadAiConfig().piApply).toBe(piApply);
    });
    it("옛 review 기본값은 DEFAULT로 전환하고 새 명시 선택은 보존한다", () => {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ piApply: "review", piTeam: true }));
      expect(loadAiConfig().piApply).toBe("default");
      expect(loadAiConfig().piTeam).toBe(true);
      saveAiConfig({ ...loadAiConfig(), piApply: "review" });
      expect(loadAiConfig().piApply).toBe("review");
      saveAiConfig({ ...loadAiConfig(), model: "kept-model" });
      expect(loadAiConfig().piApply).toBe("review");
    });
    it("경로 enum 시절의 `pi-team` 은 팀 비트로 승격한다", () => {
      // 옛 키를 버리면 사용자가 켜 둔 팀이 조용히 사라진다. `session`·`pi-agent` 는 둘 다 «Pi» 다.
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-team" }));
      expect(loadAiConfig().piTeam).toBe(true);
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "session" }));
      expect(loadAiConfig().piTeam).toBe(false);
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-agent" }));
      expect(loadAiConfig().piTeam).toBe(false);
    });
  });
  describe("검토 대기 단계", () => {
    it("검토 → 버림 / 검토 칩", () => {
      let state = createTeamBoardState("single", "x");
      state = reduceTeamBoard(state, { type: "start", provider: "p", model: "m", toolCount: 1 });
      state = markTeamBoardReview(state, ["타일 12", "이벤트 +1"]);
      expect(state.phase).toBe("검토 대기"); expect(state.reviewChips).toEqual(["타일 12", "이벤트 +1"]);
      const discarded = markTeamBoardDiscarded(state);
      expect(discarded.phase).toBe("버림"); expect(discarded.applied).toMatch(/그대로/);
    });
  });
});

describe("piAgentTeam", () => {
  isolateTimers();
  function seeded() {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
    runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });
    return ctx.project;
  }
  describe("팀 역할", () => {
    it("세 역할이 있고 검수는 읽기 툴만, 팀장은 소수 읽기 툴만 받는다", () => {
      expect(teamRoleSummaries().map((role) => role.id)).toEqual(["orchestrator", "builder", "reviewer"]);
      const readOnly = selectPiToolDefinitions(undefined, { readOnly: true });
      expect(readOnly.length).toBeGreaterThan(10);
      expect(readOnly.every((tool) => tool.mode === "read")).toBe(true);
      const orch = selectPiToolDefinitions(undefined, { toolNames: PI_TEAM_ROLES.orchestrator.toolNames });
      expect(orch.map((tool) => tool.name).sort()).toEqual(["get_database_records", "get_map_region", "run_lint"]);
    });
    it("팀장 프롬프트는 후보 맵과 사용자 지시를 담는다", () => {
      const project = seeded();
      const lines = PI_TEAM_ROLES.orchestrator.systemPrompt(project, ["map_a"], "집 지어");
      expect(lines.join("\n")).toMatch(/map_a "A" 10×10/);
      expect(lines.join("\n")).not.toMatch(/map_b/);
      expect(lines.at(-1)).toBe("사용자 지시: 집 지어");
      const all = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x").join("\n");
      expect(all).toMatch(/map_a/); expect(all).toMatch(/map_b/);
    });
    // 실측(2026-09-15): 후보만 43맵 주고 「여기」 힌트가 없으면 팀장이 다른 40×40 마을에 배정했다(재현 실행 1).
    // 사용자가 보고 있는 맵을 기본 대상으로 말해 준다 — 후보 목록은 그대로라 다른 맵을 지목한 지시도 된다.
    it("팀장 프롬프트는 사용자가 보고 있는 맵을 기본 대상으로 말한다", () => {
      const project = seeded();
      const lines = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "여기에 마을", undefined, "map_b");
      const text = lines.join("\n");
      expect(text).toMatch(/보고 있는 맵[^\n]*\n- map_b "B" 10×10/);
      expect(text).toMatch(/「여기」/);
      // 힌트는 후보 목록보다 앞에 온다 — 목록이 길어도 기본 대상이 먼저 읽힌다.
      expect(text.indexOf("보고 있는 맵")).toBeLessThan(text.indexOf("프로젝트의 맵:"));
      // 현재 맵이 없거나 후보 밖이면 힌트도 없다 — 후보를 제한한 사용자의 뜻이 우선이다.
      expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x").join("\n")).not.toMatch(/보고 있는 맵/);
      expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, ["map_a"], "x", undefined, "map_b").join("\n")).not.toMatch(/보고 있는 맵/);
      expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x", undefined, "map_zzz").join("\n")).not.toMatch(/보고 있는 맵/);
    });
  });
  describe("/pi team 파서", () => {
    const project = seeded();
    it("team 키워드는 팀 모드, 맵 목록은 후보", () => {
      expect(parsePiCommand("/pi team 마을 셋", project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
      expect(parsePiCommand("/pi team map_a,map_b 마을", project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "마을" });
      expect(parsePiCommand("/pi 마을", project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "마을" });
    });
  });
  describe("팀 보드 리듀서", () => {
    it("팀 이벤트를 행 단위 상태로 접는다", () => {
      let state = createTeamBoardState("team", "집");
      const events: PiAgentEvent[] = [
        { type: "team_start", task: "집", roles: teamRoleSummaries() },
        { type: "agent_spawn", agentId: "orchestrator-1", role: "orchestrator", mapId: null, mapName: null, task: "집" },
        { type: "agent_spawn", agentId: "builder-1", role: "builder", mapId: "map_a", mapName: "A", task: "집 한 채" },
        { type: "agent_event", agentId: "builder-1", event: { type: "turn", index: 2 } },
        { type: "agent_event", agentId: "builder-1", event: { type: "tool_start", id: "t1", name: "author_house", args: {} } },
        { type: "agent_event", agentId: "builder-1", event: { type: "tool_end", id: "t1", name: "author_house", ok: false, summary: "**겹침**" } },
        { type: "agent_done", agentId: "builder-1", ok: true, summary: "1개 키", stats: { ms: 3000, turns: 4, toolCalls: 3, toolErrors: 1 }, changedKeys: ["maps.map_a"], spills: ["maps.map_b"], conflicts: [] },
        { type: "agent_spawn", agentId: "reviewer-1", role: "reviewer", mapId: "map_a", mapName: "A", task: "검수" },
        { type: "review", agentId: "reviewer-1", mapId: "map_a", ok: false, findings: ["길 끊김 (3,4)"] },
        { type: "team_report", text: "끝" },
        { type: "agent_done", agentId: "orchestrator-1", ok: true, summary: "끝", stats: { ms: 9000, turns: 5, toolCalls: 3, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] },
      ];
      for (const event of events.slice(0, 6)) state = reduceTeamBoard(state, event);
      expect(state.agents[1]!.lastLine).toBe("✗ author_house — 겹침");
      expect(state.agents[1]!.lastKind).toBe("tool");
      for (const event of events.slice(6)) state = reduceTeamBoard(state, event);
      expect(state.phase).toBe("실행 중");
      expect(state.agents.map((agent) => [agent.agentId, agent.state])).toEqual([
        ["orchestrator-1", "완료"], ["builder-1", "완료"], ["reviewer-1", "완료"],
      ]);
      const builder = state.agents[1]!;
      expect(builder.turns).toBe(4); expect(builder.toolCalls).toBe(3); expect(builder.toolErrors).toBe(1);
      // 완료 뒤 마지막 줄은 보고문으로 바뀐다(중간 툴 실패 문구가 남지 않는다).
      expect(builder.lastLine).toBe("1개 키"); expect(builder.lastKind).toBe("text"); expect(builder.spills).toEqual(["maps.map_b"]);
      expect(state.agents[2]!.review).toEqual({ ok: false, findings: ["길 끊김 (3,4)"] });
      expect(state.report).toBe("끝");
      expect(teamBoardTotals(state)).toEqual({ agents: 3, toolCalls: 6, toolErrors: 1, running: 0 });
      state = reduceTeamBoard(state, { type: "done", project: seeded(), stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_a"] });
      expect(state.phase).toBe("적용 중");
      expect(markTeamBoardApplied(state, "적용").phase).toBe("적용됨");
      // 「적용됨」은 커밋된 실행에만 쓴다 — 적용 없이 끝난 정상 종료(계획·답변·무변경)는 「완료」다.
      expect(markTeamBoardDone(state, "답변").phase).toBe("완료");
      expect(markTeamBoardDone(state, "답변").applied).toBe("답변");
    });
    // 깨질 것: 팀원 이름이 roleLabel 을 덮으면 그 행이 시공인지 검수인지 알 방법이 사라진다
    // (팀 패널의 「지금」 구획에서 정원사 행에 종류 배지가 없던 이유).
    it("팀원 이름이 배지를 덮어도 종류 배지는 남는다", () => {
      let state = createTeamBoardState("team", "x");
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "M", task: "t", memberId: "gardener", label: "정원사" });
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "m", mapName: "M", task: "t", memberId: "qa", label: "품질" });
      expect(state.agents.map((agent) => [agent.roleLabel, agent.kindLabel])).toEqual([["정원사", "시공"], ["품질", "검수"]]);
    });

    // 깨질 것: 재배정 행이 원인이 된 검수를 가리키지 않으면, 같은 맵에 시공·수정 행이 나란히 쌓여
    // 사용자가 어느 것이 검수 지적 때문에 다시 돈 것인지 구분할 수 없다.
    it("수정 배정 행은 원인이 된 검수 행을 가리킨다", () => {
      let state = createTeamBoardState("team", "x");
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "M", task: "짓기" });
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "m", mapName: "M", task: "검수" });
      state = reduceTeamBoard(state, { type: "review", agentId: "r1", mapId: "m", ok: false, findings: ["길 끊김"] });
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b2", role: "builder", mapId: "m", mapName: "M", task: "길 잇기", fixOf: "r1" });
      expect(state.agents.map((agent) => agent.fixOf)).toEqual([null, null, "r1"]);
    });

    it("중단은 실행 중인 행만 중단으로 바꾼다", () => {
      let state = createTeamBoardState("single", "x");
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "a", role: "builder", mapId: "map_a", mapName: "A", task: "x" });
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b", role: "builder", mapId: "map_b", mapName: "B", task: "x" });
      state = reduceTeamBoard(state, { type: "agent_done", agentId: "a", ok: true, summary: "", stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
      const aborted = markTeamBoardAborted(state);
      expect(aborted.phase).toBe("중단");
      expect(aborted.agents.map((agent) => agent.state)).toEqual(["완료", "중단"]);
    });
    it("마지막 줄은 마크다운을 벗기고 한 줄로 접는다", () => {
      expect(plainLine("### 결과\n- **집 1**: `map_a` 완료\n- 길 연결")).toBe("결과 집 1: map_a 완료 길 연결");
      expect(plainLine("a".repeat(200), 20)).toHaveLength(21);
    });
    it("평평한 단일 이벤트도 한 행으로 모은다", () => {
      let state = createTeamBoardState("single", "x");
      state = reduceTeamBoard(state, { type: "start", provider: "p", model: "m", toolCount: 3 });
      state = reduceTeamBoard(state, { type: "assistant", text: "다 했다" });
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]!.lastLine).toBe("다 했다");
    });
  });
});
