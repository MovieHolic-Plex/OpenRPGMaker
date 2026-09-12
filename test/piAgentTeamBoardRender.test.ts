// 팀 보드·팀 패널이 「누가(어떤 종류의 팀원이) 무슨 업무를 받았는지」를 실제로 그리는지.
// 리듀서 단위 테스트는 상태만 보므로, 화면에 나오는지는 여기서 확인한다.
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createTeamBoardState, reduceTeamBoard, type TeamBoardState } from "@/ai/piAgent/teamBoardState";
import type { PiTeamSpec } from "@/ai/piAgent/teamSpec";
import { TEAM_SPEC_STORAGE_KEY, __resetTeamSpecCache } from "@/ai/piAgent/teamSpecStore";
import { createTeamBoard } from "@/editor/panels/aiTeamBoard";
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
  const scope = globalThis as unknown as { document: unknown; window: unknown; localStorage: unknown; HTMLElement: unknown };
  scope.document = window.document;
  scope.window = window;
  scope.HTMLElement = window.HTMLElement;
  scope.localStorage = new MemoryStorage();
  __resetTeamSpecCache();
  publishTeamActivity(null);
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
  // 깨질 것: 팀원 이름만 그리면(구 동작) 정원사 행이 시공인지 검수인지 화면에서 알 수 없다.
  it("행에 팀원 이름과 종류 배지가 함께 나온다", () => {
    const board = createTeamBoard(boardWithFix());
    const rows = [...board.root.querySelectorAll("[data-testid='ai-team-agent']")];
    const first = rows[0]!.textContent ?? "";
    expect(first).toContain("정원사");
    expect(first).toContain("시공");
    expect(rows[1]!.textContent ?? "").toContain("검수");
  });

  // 깨질 것: 재배정 행에 표시가 없으면 같은 맵에 시공 행이 둘 쌓였을 때 어느 것이 검수 지적
  // 때문에 다시 돈 것인지 구분할 수 없다.
  it("수정 배정 행은 재배정임을 밝히고 원인 검수를 가리킨다", () => {
    const board = createTeamBoard(boardWithFix());
    const rows = [...board.root.querySelectorAll("[data-testid='ai-team-agent']")];
    const fixRow = rows.find((row) => row.getAttribute("data-agent-id") === "b2")!;
    expect(fixRow.querySelector("[data-testid='ai-team-fix-of']")).not.toBeNull();
    expect(fixRow.textContent ?? "").toContain("검수 지적");
    // 원인이 아닌 첫 시공 행에는 붙지 않는다.
    expect(rows.find((row) => row.getAttribute("data-agent-id") === "b1")!.querySelector("[data-testid='ai-team-fix-of']")).toBeNull();
  });

  // 깨질 것: 단일 /pi 실행은 행이 사용자 지시를 그대로 물고 와 같은 문장이 카드 제목·행·말풍선에
  // 세 번 나왔다(2026-09-12 질문 턴 실측). 보드 지시와 같은 행 지시는 echo 다.
  it("행 지시가 보드 지시와 같으면 echo 를 그리지 않고, 다른 지시는 남긴다", () => {
    let state = createTeamBoardState("single", "맵 정보 알려줘");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "a1", role: "builder", mapId: "map_a", mapName: "빈 맵", task: "맵 정보 알려줘" });
    let board = createTeamBoard(state);
    let row = board.root.querySelector("[data-testid='ai-team-agent']")!;
    expect(row.querySelector(".ai-team-task")).toBeNull();

    // 팀 모드에서 팀장이 다르게 써 내린 위임 지시는 여전히 보인다.
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "a2", role: "builder", mapId: "map_a", mapName: "빈 맵", task: "맵 이름과 크기만 조회" });
    board.update(state);
    row = board.root.querySelector("[data-agent-id='a2']")!;
    expect(row.querySelector(".ai-team-task")?.textContent).toContain("맵 이름과 크기만 조회");
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
