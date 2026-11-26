// 팀 보드·팀 패널이 「누가(어떤 종류의 팀원이) 무슨 업무를 받았는지」를 실제로 그리는지.
// 리듀서 단위 테스트는 상태만 보므로, 화면에 나오는지는 여기서 확인한다.
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, markTeamBoardReview, reduceTeamBoard, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { __resetTeamSpecCache } from "@/ai/piAgent/teamSpecStore";
import { createTeamBoard } from "@/editor/panels/aiTeamBoard";
import { setActivityLevel } from "@/editor/panels/aiActivityPreference";
import { createTeamPanel } from "@/editor/panels/aiTeamPanel";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

let window: Window;

beforeEach(() => {
  window = new Window();
  const scope = globalThis as unknown as { document: unknown; window: unknown; localStorage: unknown; HTMLElement: unknown; Node: unknown };
  scope.document = window.document;
  scope.window = window;
  scope.HTMLElement = window.HTMLElement;
  scope.Node = window.Node;
  vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
  vi.stubGlobal("Event", window.Event);
  scope.localStorage = new MemoryStorage();
  __resetTeamSpecCache();
  publishTeamActivity(null);
  setActivityLevel("brief");
});

afterEach(() => {
  publishTeamActivity(null);
  __resetTeamSpecCache();
});

/** 시공(정원사) → 검수(품질) 지적 → 수정 시공까지 흐른 보드. */
function boardWithFix(): TeamBoardState {
  let state = createTeamBoardState("team", "마을");
  state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "map_a", mapName: "달빛 숲", task: "집 한 채", memberId: "gardener", label: "정원사" });
  state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "map_a", mapName: "달빛 숲", task: "검수", memberId: "qa", label: "품질" });
  state = reduceTeamBoard(state, { type: "review", agentId: "r1", mapId: "map_a", ok: false, findings: ["길 끊김 (3,4)"] });
  return reduceTeamBoard(state, { type: "agent_spawn", agentId: "b2", role: "builder", mapId: "map_a", mapName: "달빛 숲", task: "길 잇기", memberId: "gardener", label: "정원사", fixOf: "r1" });
}

describe("팀 보드 렌더", () => {
  it("검수 지적과 재배정의 원문은 기록을 펼칠 때 보존된다", () => {
    setActivityLevel("trace");
    const board = createTeamBoard(boardWithFix());
    document.body.append(board.root);
    for (const row of board.root.querySelectorAll<HTMLDetailsElement>(".ai-activity-entry")) {
      row.open = true; row.dispatchEvent(new Event("toggle"));
    }
    const text = board.root.querySelector(".ai-activity-entries")?.textContent ?? "";
    expect(text).toContain("길 끊김 (3,4)");
    expect(text).toContain('"fixOf": "r1"');
    expect(text).toContain("길 잇기");
  });

  it("같은 기록 갱신은 기존 활동 행을 보존한다", () => {
    setActivityLevel("trace");
    const state = boardWithFix();
    const board = createTeamBoard(state);
    const first = board.root.querySelector(".ai-activity-entry");
    expect(first).not.toBeNull();
    board.update(state);
    expect(board.root.querySelector(".ai-activity-entry")).toBe(first);
    expect(board.root.querySelectorAll(".ai-team-task")).toHaveLength(0);
  });
});

describe("단독 작업의 접힌 기록", () => {
  it("기록을 접어도 비교와 적용/버리기는 바깥에 남고, 상태 갱신은 펼침을 보존한다", () => {
    const state = createTeamBoardState("single", "이름 바꾸기");
    const board = createTeamBoard(state);
    const details = board.root.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(board.root.querySelector(".ai-team-title")).toBeNull();
    const preview = document.createElement("div");
    const onApply = vi.fn(), onDiscard = vi.fn();
    board.setReview({ preview, onApply, onDiscard });
    details.open = true;
    board.update(markTeamBoardReview(state, ["맵 이름"]));
    expect(board.root.querySelector("details")).toBe(details);
    expect(details.open).toBe(true);
    expect(preview.closest("details")).toBeNull();
    details.open = false;
    (board.root.querySelector('[data-testid="ai-team-apply"]') as HTMLElement).click();
    (board.root.querySelector('[data-testid="ai-team-discard"]') as HTMLElement).click();
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
    board.setReview(null);
    expect(board.root.querySelector('[data-testid="ai-team-apply"]')).toBeNull();
  });

  it("팀을 켜거나 실제 팀 작업이 있을 때만 팀 패널을 표시한다", () => {
    const panel = createTeamPanel();
    expect(panel.root.hidden).toBe(true);
    publishTeamActivity(createTeamBoardState("single", "수정"));
    expect(panel.root.hidden).toBe(true);
    panel.setEnabled(true);
    expect(panel.root.hidden).toBe(false);
    panel.setEnabled(false);
    expect(panel.root.hidden).toBe(true);
    publishTeamActivity(boardWithFix());
    expect(panel.root.hidden).toBe(false);
    publishTeamActivity(createTeamBoardState("single", "다음 수정"));
    expect(panel.root.hidden).toBe(true);
    panel.dispose();
  });
});
