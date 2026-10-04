import { describe, expect, it } from "vitest";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { teamActivityAge, teamObservation } from "@/editor/panels/aiTeamObservation";
import { activityPhase } from "@/ai/activityTrace";

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
    expect(a.action).toBe("다음 모델 응답을 기다리는 중");
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
    expect(view.action).toBe("모델 응답을 받는 중");
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
    expect(teamObservation(state.agents[0], state.trace).action).toBe("모델 응답을 받는 중");
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
