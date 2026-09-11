import { describe, expect, it } from "vitest";
import { PI_TEAM_ROLES, teamRoleSummaries } from "@/ai/piAgent/team";
import { createTeamBoardState, markTeamBoardAborted, markTeamBoardApplied, plainLine, reduceTeamBoard, teamBoardTotals } from "@/ai/piAgent/teamBoardState";
import { selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { parsePiCommand } from "@/editor/panels/aiPiAgentCommand";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

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
});

describe("/pi team 파서", () => {
  const project = seeded();
  it("team 키워드는 팀 모드, 맵 목록은 후보", () => {
    expect(parsePiCommand("/pi team 마을 셋", project, "map_a")).toEqual({ mode: "team", mapIds: [], task: "마을 셋" });
    expect(parsePiCommand("/pi team map_a,map_b 마을", project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], task: "마을" });
    expect(parsePiCommand("/pi 마을", project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], task: "마을" });
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
