import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAiActivityLogs, listAiActivityLogs } from "@/ai/activityLog";
import { startPiRunLog } from "@/ai/piAgent/activityLog";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";

function storageStub(): void {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v); },
    removeItem: (k: string) => { storage.delete(k); },
    clear: () => storage.clear(),
  });
}

/** 팀장이 시공 하나를 배정해 완료까지 간 보드. 실제 이벤트 스트림과 같은 순서로 접는다. */
function builtBoard(): TeamBoardState {
  let board = createTeamBoardState("team", "마을 셋");
  board = reduceTeamBoard(board, {
    type: "agent_spawn", agentId: "orchestrator-1", role: "orchestrator", mapId: null, mapName: null, task: "마을 셋",
  });
  board = reduceTeamBoard(board, {
    type: "agent_spawn", agentId: "b1", role: "builder", mapId: "map_a", mapName: "달빛 숲", task: "집 한 채", memberId: "gardener", label: "정원사",
  });
  board = reduceTeamBoard(board, {
    type: "agent_done", agentId: "b1", ok: true, summary: "집 한 채를 지었습니다",
    stats: { ms: 1_000, turns: 3, toolCalls: 12, toolErrors: 1 }, changedKeys: ["maps.map_a"], spills: ["tilesets"], conflicts: [],
  });
  return board;
}

describe("Pi 실행 활동 로그", () => {
  beforeEach(() => {
    storageStub();
    clearAiActivityLogs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("시작은 pending 행 하나, 종료는 같은 행을 갱신한다", async () => {
    const run = startPiRunLog({
      instruction: "마을 셋", mode: "team", mapIds: ["map_a"], mapId: "map_a", mapName: "달빛 숲", provider: "google-antigravity", model: "gemini-3.7-flash",
    });
    await run.started;
    const pending = listAiActivityLogs().filter((row) => row.id === run.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.channel).toBe("pi");
    expect(pending[0]?.instruction).toBe("마을 셋");
    expect(pending[0]?.mapId).toBe("map_a");
    expect(pending[0]?.result).toMatchObject({ ok: false, pending: true });

    await run.finish({ board: builtBoard(), applied: true, changedCount: 3, stoppedReason: "적용됨" });

    // 행이 늘지 않는다 — 시작·종료가 같은 id 로 upsert 된다.
    const settled = listAiActivityLogs().filter((row) => row.id === run.id);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.channel).toBe("pi");
    expect(settled[0]?.result.pending).toBeUndefined();
    expect(settled[0]?.result).toMatchObject({ ok: true, applied: true, stoppedReason: "적용됨" });
  });

  it("하위 에이전트를 툴 호출로, 서사를 감사 항목으로 남긴다", async () => {
    const run = startPiRunLog({
      instruction: "마을 셋", mode: "team", mapIds: [], mapId: null, mapName: null, provider: "p", model: "m",
    });
    await run.started;
    await run.finish({ board: builtBoard(), applied: false, changedCount: 3, stoppedReason: "검토 대기" });

    const row = listAiActivityLogs().find((entry) => entry.id === run.id);
    expect(row?.result).toMatchObject({ ok: true, applied: false, stoppedReason: "검토 대기" });
    // 시공 행은 팀원 이름과 종류를 함께 남긴다 — 로그만 보고 누가 했는지 안다.
    expect(row?.toolCalls.find((call) => call.name === "pi:시공")?.summary).toContain("정원사");
    expect(row?.toolCalls.find((call) => call.name === "pi:시공")).toMatchObject({ ok: true, args: { memberId: "gardener" } });
    expect(row?.audit.some((entry) => entry.kind === "user" && entry.text === "마을 셋")).toBe(true);
    // 범위 밖으로 버려진 키와 검토 대기 결말이 감사에 남는다 — 이게 없으면 "왜 안 바뀌었나" 를 못 묻는다.
    expect(row?.audit.some((entry) => entry.kind === "status" && entry.text.includes("범위 밖 변경 버림"))).toBe(true);
    expect(row?.audit.some((entry) => entry.kind === "status" && entry.text.includes("검토 대기"))).toBe(true);
  });

  it("실패는 ok=false 로 남고 이유가 실린다", async () => {
    const run = startPiRunLog({
      instruction: "마을 셋", mode: "single", mapIds: ["map_a"], mapId: "map_a", mapName: "달빛 숲", provider: "p", model: "m",
    });
    await run.started;
    await run.finish({ board: createTeamBoardState("single", "마을 셋"), applied: false, changedCount: 0, error: "Pi 에이전트 실행 실패: 500" });

    const row = listAiActivityLogs().find((entry) => entry.id === run.id);
    expect(row?.result).toMatchObject({ ok: false, applied: false, error: "Pi 에이전트 실행 실패: 500" });
  });
});
