// 팀 보드 행의 과정 로그 계약 — 팀 데크 트랜스크립트가 그리는 데이터.
import { describe, expect, it } from "vitest";
import { createTeamBoardState, reduceTeamBoard, TEAM_AGENT_LOG_CAP, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { requestTeamStop, setTeamStopHandler } from "@/ai/piAgent/teamActivity";

const STATS = { ms: 1200, turns: 2, toolCalls: 3, toolErrors: 0 };

function spawnBuilder(state: TeamBoardState, agentId = "b1"): TeamBoardState {
  return reduceTeamBoard(state, { type: "agent_spawn", agentId, role: "builder", mapId: "map_a", mapName: "달빛 숲", task: "집 한 채", memberId: "gardener", label: "정원사" });
}

function agentEvent(state: TeamBoardState, agentId: string, event: Parameters<typeof reduceTeamBoard>[1]): TeamBoardState {
  return reduceTeamBoard(state, { type: "agent_event", agentId, event });
}

describe("팀 보드 행 로그", () => {
  it("배정 → 턴 → 툴 시작/끝 → 말 순서로 쌓이고, 툴은 같은 id 로 제자리에서 닫힌다", () => {
    let state = spawnBuilder(createTeamBoardState("team", "마을"));
    state = agentEvent(state, "b1", { type: "turn", index: 1 });
    state = agentEvent(state, "b1", { type: "tool_start", id: "t1", name: "paint_tiles", args: {} });
    state = agentEvent(state, "b1", { type: "tool_start", id: "t2", name: "get_map_region", args: {} });
    state = agentEvent(state, "b1", { type: "tool_end", id: "t1", name: "paint_tiles", ok: true, summary: "12칸" });
    state = agentEvent(state, "b1", { type: "assistant", text: "**지붕**을 얹었습니다." });
    const log = state.agents[0]!.log;
    expect(log.map((entry) => entry.kind)).toEqual(["task", "turn", "tool", "tool", "text"]);
    expect(log[0]).toEqual({ kind: "task", text: "집 한 채" });
    expect(log[2]).toEqual({ kind: "tool", id: "t1", name: "paint_tiles", ok: true, summary: "12칸" });
    expect(log[3]).toMatchObject({ kind: "tool", id: "t2", ok: null });
    expect(log[4]).toEqual({ kind: "text", text: "지붕을 얹었습니다." });
    expect(state.agents[0]!.toolCalls).toBe(2);
  });

  it("tool_start 의 인자는 사람이 읽는 한 줄로 남고, 같은 id 로 닫혀도 유지된다", () => {
    let state = spawnBuilder(createTeamBoardState("team", "마을"));
    state = agentEvent(state, "b1", { type: "tool_start", id: "t1", name: "place_structure", args: { x: 13, y: 5, kind: "대장간" } });
    expect(state.agents[0]!.log.at(-1)).toMatchObject({ kind: "tool", ok: null, args: "x: 13 · y: 5 · kind: 대장간" });
    state = agentEvent(state, "b1", { type: "tool_end", id: "t1", name: "place_structure", ok: true, summary: "6×5" });
    expect(state.agents[0]!.log.at(-1)).toMatchObject({ kind: "tool", ok: true, summary: "6×5", args: "x: 13 · y: 5 · kind: 대장간" });
  });

  it("짝 없는 tool_end 는 닫힌 행으로 덧붙인다", () => {
    let state = spawnBuilder(createTeamBoardState("team", "마을"));
    state = agentEvent(state, "b1", { type: "tool_end", id: "orphan", name: "x", ok: false, summary: "실패" });
    expect(state.agents[0]!.log.at(-1)).toEqual({ kind: "tool", id: "orphan", name: "x", ok: false, summary: "실패" });
    expect(state.agents[0]!.toolErrors).toBe(1);
  });

  it("상한을 넘으면 앞을 버리고 버린 수를 센다", () => {
    let state = spawnBuilder(createTeamBoardState("team", "마을"));
    for (let index = 1; index <= TEAM_AGENT_LOG_CAP + 25; index += 1) {
      state = agentEvent(state, "b1", { type: "turn", index });
    }
    const agent = state.agents[0]!;
    expect(agent.log.length).toBe(TEAM_AGENT_LOG_CAP);
    expect(agent.droppedLog).toBe(26);
    expect(agent.log[0]).toEqual({ kind: "turn", index: 26 });
    expect(agent.log.at(-1)).toEqual({ kind: "turn", index: TEAM_AGENT_LOG_CAP + 25 });
  });

  it("검수·완료·오류가 행으로 남고 lastLine 계약은 그대로다", () => {
    let state = createTeamBoardState("team", "마을");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "map_a", mapName: "달빛 숲", task: "검수", memberId: "qa", label: "품질" });
    state = reduceTeamBoard(state, { type: "review", agentId: "r1", mapId: "map_a", ok: false, findings: ["길 끊김 (3,4)"] });
    state = spawnBuilder(state, "b2");
    state = agentEvent(state, "b2", { type: "error", message: "provider timeout" });
    state = reduceTeamBoard(state, { type: "agent_done", agentId: "b2", ok: false, summary: "", stats: STATS, changedKeys: [], spills: [], conflicts: [] });
    const reviewer = state.agents.find((agent) => agent.agentId === "r1")!;
    const builder = state.agents.find((agent) => agent.agentId === "b2")!;
    expect(reviewer.log.at(-1)).toEqual({ kind: "review", ok: false, findings: ["길 끊김 (3,4)"] });
    expect(reviewer.lastLine).toBe("검수 지적 1건");
    expect(builder.log.map((entry) => entry.kind)).toEqual(["task", "error", "done"]);
    expect(builder.log.at(-1)).toEqual({ kind: "done", ok: false, summary: "", stats: STATS });
    expect(builder.state).toBe("실패");
  });

  it("중지 슬롯 — 등록된 실행이 없으면 false, 있으면 부르고 true", () => {
    setTeamStopHandler(null);
    expect(requestTeamStop()).toBe(false);
    let called = 0;
    setTeamStopHandler(() => { called += 1; });
    expect(requestTeamStop()).toBe(true);
    expect(called).toBe(1);
    setTeamStopHandler(null);
  });
});
