import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAiActivityLogs, listAiActivityLogs } from "@/ai/activityLog";
import { recordPiIntentFailure, startPiRunLog } from "@/ai/piAgent/activityLog";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";
import type { AuditEntry } from "@/ai/session/types";

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

  // 2026-09-16 실측 회귀: Pi 턴이 카드까지 뜨고 성공했는데도 `window.__oprnAiBridge.audit()` 이
  // `[]` 였다. 감사 행은 여기서만 만들어지고 활동 로그로만 가고 끝났기 때문이다.
  it("종료는 기록한 것과 같은 감사 행을 호출자에게 돌려준다 (브리지 감사 원천)", async () => {
    const run = startPiRunLog({
      instruction: "집 한 채", mode: "single", mapIds: ["map_a"], mapId: "map_a", mapName: "달빛 숲", provider: "p", model: "m",
    });
    await run.started;
    const rows = await run.finish({ board: builtBoard(), applied: true, changedCount: 1, stoppedReason: "적용됨" });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((entry) => entry.kind === "user" && entry.text === "집 한 채")).toBe(true);
    expect(rows.some((entry) => entry.kind === "status" && entry.text.includes("적용됨"))).toBe(true);
    // 두 벌로 갈라지면 브리지와 로그가 다른 사실을 본다 — 같은 원천임을 여기서 고정한다.
    const row = listAiActivityLogs().find((entry) => entry.id === run.id);
    // tool 항목은 text 대신 summary 를 쓴다 — 합집합 타입이라 한 접근자로 편다.
    const labelOf = (entry: AuditEntry): string => ("text" in entry ? entry.text : entry.summary);
    expect(row?.audit.map(labelOf)).toEqual(rows.map(labelOf));
  });

  // 2026-09-28 실측 회귀: 「위로 올라가면 마을」 실패 로그에는 판정도, 「오류 5」의 문장도, 도구 인자도 없었다.
  it("의도 판정·도구 과정(인자·성공·실패)·실행 상태·판정 변경이 감사에 순서대로 남는다", async () => {
    let board = createTeamBoardState("single", "위로 올라가면 마을");
    board = reduceTeamBoard(board, { type: "agent_spawn", agentId: "map_a", role: "builder", mapId: "map_a", mapName: "빈 맵", task: "위로 올라가면 마을" });
    const event = (inner: Parameters<typeof reduceTeamBoard>[1]) => { board = reduceTeamBoard(board, { type: "agent_event", agentId: "map_a", event: inner }); };
    event({ type: "tool_start", id: "t1", name: "author_village", args: { target: { kind: "existing", mapId: "map_a" } } });
    event({ type: "tool_end", id: "t1", name: "author_village", ok: false, summary: "기존 맵 map_a에 이미 저작 내용이 있어 전체 재시공이 거부됐습니다" });
    event({ type: "execution_status", name: "village.contract_released", ok: false, summary: "마을 계약 해제 — village-requires-scope" });
    event({ type: "execution_status", name: "map.image.delivered", ok: true, summary: "이미지 전달" });
    event({ type: "tool_start", id: "t2", name: "author_village", args: { target: { kind: "new", mapId: "map_village" } } });
    event({ type: "tool_end", id: "t2", name: "author_village", ok: true, summary: "Village authored: 12/12 houses" });
    const run = startPiRunLog({
      instruction: "위로 올라가면 마을", mode: "single", mapIds: ["map_a"], mapId: "map_a", mapName: "빈 맵", provider: "p", model: "m",
      routing: "intent:llm mode=create construction=approach:north → 마을 계약: 새 맵 map_village",
    });
    await run.started;
    const rows = await run.finish({ board, applied: true, changedCount: 2, stoppedReason: "적용됨", notes: ["마을 계약 해제 — 일반 실행으로 이어 갔습니다."] });
    const lines = rows.map((entry) => entry.kind === "tool" ? `tool:${entry.ok ? "ok" : "fail"}:${entry.name}:${JSON.stringify(entry.args)}` : `${entry.kind}:${entry.text}`);
    expect(lines[0]).toBe("user:위로 올라가면 마을");
    expect(lines[1]).toBe("status:의도 판정: intent:llm mode=create construction=approach:north → 마을 계약: 새 맵 map_village");
    expect(lines).toContain(`tool:fail:author_village:${JSON.stringify({ 인자: 'target: {"kind":"existing","mapId":"map_a"}' })}`);
    expect(lines).toContain(`tool:ok:author_village:${JSON.stringify({ 인자: 'target: {"kind":"new","mapId":"map_village"}' })}`);
    expect(lines).toContain("status:실행 상태 village.contract_released ✗: 마을 계약 해제 — village-requires-scope");
    // 매 호출 반복되는 이미지 전달 알림은 과정을 붐비게만 해서 남기지 않는다.
    expect(lines.some((line) => line.includes("map.image.delivered"))).toBe(false);
    expect(lines.at(-2)).toBe("status:마을 계약 해제 — 일반 실행으로 이어 갔습니다.");
    expect(lines.at(-1)).toContain("적용됨");
    // 실패한 도구의 사유는 진단 메시지에도 올라간다 — 로그 첫 화면에서 보인다.
    const row = listAiActivityLogs().find((entry) => entry.id === run.id);
    expect(row?.diagnostics.messages.join("\n")).toContain("이미 저작 내용이 있어");
  });

  it("의도 해석이 실패한 턴도 실패 행 하나를 남긴다", async () => {
    await recordPiIntentFailure({ instruction: "위로 올라가면 마을", error: "시간 초과(30000ms)", mapId: "map_a", model: "m" });
    const row = listAiActivityLogs().find((entry) => entry.instruction === "위로 올라가면 마을");
    expect(row?.channel).toBe("pi");
    expect(row?.result).toMatchObject({ ok: false, applied: false, stoppedReason: "의도 해석 실패" });
    expect(row?.result.error).toContain("시간 초과");
    expect(row?.audit.some((entry) => entry.kind === "status" && entry.text.includes("의도 판정: 실패"))).toBe(true);
  });
});
