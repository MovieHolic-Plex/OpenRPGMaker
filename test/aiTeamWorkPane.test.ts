// 작업 페인(aiTeamWorkPane) — 조수 데크 「작업」 탭과 스튜디오 상세가 같은 컴포넌트로
// 팀원 열·과정 열·검토 스트립을 그리는지. 상태는 리듀서로 만들고 버스 슬롯으로 검토 액션을 잇는다.
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, markTeamBoardReview, reduceTeamBoard, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { createTeamWorkPane } from "@/editor/panels/aiTeamWorkPane";

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
