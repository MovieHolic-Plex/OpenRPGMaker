// 팀 보드·팀 패널이 「누가(어떤 종류의 팀원이) 무슨 업무를 받았는지」를 실제로 그리는지.
// 리듀서 단위 테스트는 상태만 보므로, 화면에 나오는지는 여기서 확인한다.
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, markTeamBoardReview, reduceTeamBoard, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import type { PiTeamSpec } from "@/ai/piAgent/teamSpec";
import { TEAM_SPEC_STORAGE_KEY, __resetTeamSpecCache } from "@/ai/piAgent/teamSpecStore";
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

const GARDENER_TEAM: PiTeamSpec = {
  version: 1,
  orchestratorNotes: "",
  members: [
    { id: "gardener", label: "정원사", kind: "builder", summary: "꾸민다", prompt: "꾸민다", toolDomains: [], maxTurns: 5, enabled: true },
    { id: "qa", label: "품질", kind: "reviewer", summary: "본다", prompt: "본다", toolDomains: [], maxTurns: 5, enabled: true },
  ],
};

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
  it("현행 기록에 담당자를 표시하고 숨긴 옛 팀원 목록은 만들지 않는다", () => {
    setActivityLevel("trace");
    const board = createTeamBoard(boardWithFix());
    expect(board.root.querySelector(".ai-activity-entries")?.textContent).toContain("정원사");
    expect(board.root.querySelector(".ai-activity-entries")?.textContent).toContain("품질");
    expect(board.root.querySelectorAll("[data-testid='ai-team-agent']")).toHaveLength(0);
  });

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

describe("검토 대기 카드의 적용 전 비교", () => {
  // 깨질 것(실측 2026-09-14): 검토 카드가 문장·칩·버튼만 그리면, 사용자는 "무엇이 바뀌는지"
  // 보지 못한 채 적용/버리기를 결정해야 한다 — "부탁했는데 before/after 가 안 보인다" 의 자리다.
  const reviewState = (): TeamBoardState =>
    markTeamBoardReview(createTeamBoardState("single", "마을"), ["타일 12"]);

  it("패널이 넘긴 적용 전 카드를 검토 자리에 그대로 세운다", () => {
    const board = createTeamBoard(createTeamBoardState("single", "마을"));
    const preview = document.createElement("div");
    preview.dataset.testid = "preview-fixture";

    board.setReview({ onApply: () => {}, onDiscard: () => {}, preview });
    board.update(reviewState());

    const block = board.root.querySelector("[data-testid='ai-team-review']")!;
    expect(block.contains(preview)).toBe(true);
    // 카드가 같은 사실을 이미 말하므로 칩 줄을 따로 그리지 않는다.
    expect(block.querySelector(".ai-change-chips")).toBeNull();
  });

  it("카드가 없으면 지금까지처럼 칩 줄만 그린다", () => {
    const board = createTeamBoard(reviewState());
    board.setReview({ onApply: () => {}, onDiscard: () => {} });
    board.update(reviewState());

    const block = board.root.querySelector("[data-testid='ai-team-review']")!;
    expect([...block.querySelectorAll(".ai-change-chip")].map((chip) => chip.textContent)).toEqual(["타일 12"]);
  });
});

describe("팀 패널 「지금」 렌더", () => {
  // 깨질 것: 팀원 이름만 그리면 스크린샷에서처럼 정원사 행에 종류 배지가 사라진다.
  it("팀원 행에 종류 배지가 함께 나온다", () => {
    localStorage.setItem(TEAM_SPEC_STORAGE_KEY, JSON.stringify(GARDENER_TEAM));
    __resetTeamSpecCache();
    const panel = createTeamPanel();
    publishTeamActivity(boardWithFix());
    // 「지금」 구획은 펼친 패널에만 그려진다.
    (panel.root.querySelector("[data-testid='ai-team-panel-toggle']") as unknown as HTMLElement).click();

    const rows = [...panel.root.querySelectorAll("[data-testid='ai-team-live-row']")];
    const gardener = rows.find((row) => (row.textContent ?? "").includes("정원사"))!;
    expect(gardener).toBeDefined();
    expect(gardener.textContent ?? "").toContain("시공");
    panel.dispose();
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

  it("접힌 요약에도 도구 오류와 검토 지적이 남는다", () => {
    let state = createTeamBoardState("single", "수정");
    // 실제 단독 경로처럼 agent_event 로 감싼다.
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "a", event: { type: "tool_end", id: "t", name: "paint", ok: false, summary: "실패" } });
    state = reduceTeamBoard(state, { type: "review", agentId: "r", mapId: "map_a", ok: false, findings: ["길 끊김", "출입구 막힘"] });
    const board = createTeamBoard(state);
    expect(board.root.querySelector("summary")?.textContent).toContain("도구 오류 1건");
    expect(board.root.querySelector("summary")?.textContent).toContain("검토 지적 2건");
    expect(board.root.querySelector("details")?.open).toBe(false);
  });

  it("경과 시간 갱신은 상세 행을 재생성하지 않는다", () => {
    vi.useFakeTimers();
    try {
      const state = reduceTeamBoard(createTeamBoardState("single", "조회"), { type: "start", provider: "p", model: "m", toolCount: 1 });
      const board = createTeamBoard(state);
      document.body.append(board.root);
      const row = board.root.querySelector('[data-testid="ai-team-agent"]');
      vi.advanceTimersByTime(1000);
      expect(board.root.querySelector('[data-testid="ai-team-agent"]')).toBe(row);
      board.root.remove();
      vi.advanceTimersByTime(1000);
    } finally { vi.useRealTimers(); }
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
