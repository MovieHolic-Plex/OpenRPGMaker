// 활동 로그 행이 «빠짐없이 남고 찾을 수 있는가» 를 잠근다.
//
// 실측 배경 (2026-08-30): 채팅 턴 1행에 audit 이 정확히 200칸으로 잘려 **첫 칸이 이미 턴 중간의
// `tools:escalated`** 였다. 사람 발언과 플래너 결정이 사라진 것이고, 잘렸다는 표시도 없어서
// "원래 그만큼이었다" 로 읽혔다. 툴도 114회 중 67개만 남았다. 그리고 남은 것조차 payload 안에만
// 있어 "set_event 를 부른 턴" 을 알려면 169KB 를 받아 grep 해야 했다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import {
  buildAiActivityLogRecord,
  clearAiActivityLogs,
  extractCommitIdsFromAudit,
  getAiActivityLog,
  listAiActivityLogs,
  recordAiActivity,
} from "@/ai/activityLog";

function stubStorage(): void {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  });
}

describe("ai activity record — 예산 절단과 평탄 색인", () => {
  beforeEach(() => {
    stubStorage();
    clearAiActivityLogs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps well past the old 200/80 caps when the rows are small", () => {
    const audit: AuditEntry[] = Array.from({ length: 900 }, (_, index) => ({
      kind: "status",
      text: `step ${index}`,
    }));
    const toolCalls = Array.from({ length: 300 }, (_, index) => ({
      name: `tool_${index}`,
      args: { index },
      ok: true,
      summary: "ok",
    }));
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "많이 해줘",
      result: { ok: true },
      audit,
      toolCalls,
    });
    // 칸수 상한이 사라졌다 — 짧은 행 900개는 전부 들어간다(옛 상한이면 200/80).
    expect(record.audit).toHaveLength(900);
    expect(record.toolCalls).toHaveLength(300);
    expect(record.truncated).toBeUndefined();
  });

  it("marks what the byte budget dropped instead of trimming silently", () => {
    // 한 칸은 clipText 로 4,000자에서 잘리므로 칸당 약 4KB 다 — 150칸이면 audit 예산(384KB)을 넘긴다.
    const fat = "가".repeat(20_000);
    const rows = 150;
    const audit: AuditEntry[] = Array.from({ length: rows }, (_, index) => ({
      kind: "status",
      text: `${index}:${fat}`,
    }));
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "무거운 턴",
      result: { ok: true },
      audit,
    });
    expect(record.audit.length).toBeLessThan(rows);
    expect(record.truncated?.audit).toBe(rows - record.audit.length);
    // 양 끝을 남긴다 — 버리는 건 가운데다. 첫 칸(사람 발언·플래너 결정 자리)이 사라지는 게
    // 이 작업의 출발점이었던 실패다.
    expect((record.audit[0] as { text: string }).text.startsWith("0:")).toBe(true);
    expect(record.audit.at(-1)?.kind).toBe("status");
    expect((record.audit.at(-1) as { text: string }).text.startsWith(`${rows - 1}:`)).toBe(true);
    // 가운데가 정말 빠졌는지 — 연속이면 절단이 아니라 그냥 다 담긴 것이다.
    const indices = record.audit.map((entry) => Number((entry as { text: string }).text.split(":")[0]));
    expect(indices.some((value, at) => at > 0 && value !== (indices[at - 1] as number) + 1)).toBe(true);
  });

  it("keeps both ends of a 100+ tool turn and still indexes what it dropped", () => {
    // 계획의 절단 회귀 항목: 툴 100개 넘는 턴에서 표기가 되고 앞부분이 살아 있는지.
    // 한 호출을 예산(128KB)의 1/20 쯤으로 부풀려 120개면 확실히 넘긴다.
    const fat = "가".repeat(4_000);
    const toolCalls = Array.from({ length: 120 }, (_, index) => ({
      name: `tool_${index}`,
      args: { note: fat },
      ok: index % 10 !== 0,
      summary: `${index}:${fat}`,
    }));
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "다 깔아줘",
      result: { ok: true },
      toolCalls,
    });

    expect(record.toolCalls.length).toBeLessThan(120);
    expect(record.truncated?.toolCalls).toBe(120 - record.toolCalls.length);
    expect(record.toolCalls[0]?.name).toBe("tool_0"); // 첫 호출이 남는다
    expect(record.toolCalls.at(-1)?.name).toBe("tool_119"); // 마지막 호출도 남는다
    // 색인은 절단 전 전체에서 만든다 — 가운데로 버려진 툴도 SQL 로 찾을 수 있어야 한다.
    expect(record.index.toolNames).toHaveLength(120);
    expect(record.index.toolNames).toContain("tool_60");
    expect(record.index.failedToolNames).toContain("tool_60");
  });

  it("builds the flat index that SQL containment can hit", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "석상에 말걸면 어케됨?",
      mapId: "map_blank_start",
      result: { ok: false },
      toolCalls: [
        { name: "paint_road", args: {}, ok: true, summary: "깔았다" },
        { name: "complete_work_item", args: {}, ok: false, summary: "거부" },
      ],
      audit: [
        { kind: "user", text: "석상에 말걸면 어케됨?\n\n[컨텍스트] 맵: 빈 맵" },
        { kind: "tool", name: "set_event", args: { mapId: "map_town" }, ok: true, summary: "이벤트" },
        { kind: "status", text: "마일스톤 적용: 석상 commit=bc9eb432-1111-2222-3333-444455556666" },
      ],
      uiActions: [
        { at: "2026-08-30T04:00:00.000Z", seq: 1, surface: "panel", action: "turn-rewind" },
        { at: "2026-08-30T04:00:01.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
      ],
    });

    expect(record.index.toolNames).toContain("paint_road");
    expect(record.index.toolNames).toContain("set_event");
    expect(record.index.failedToolNames).toEqual(["complete_work_item"]);
    expect(record.index.uiActions).toEqual(["turn-rewind"]); // 중복 제거
    expect(record.index.mapIds).toEqual(["map_blank_start", "map_town"]);
    expect(record.index.commitIds).toEqual(["bc9eb432-1111-2222-3333-444455556666"]);
    // 기계 footer 를 뗀 사람 문장만 색인한다 — 붙이면 모든 행이 같은 맵 이름으로 시작한다.
    expect(record.index.userTexts).toEqual(["석상에 말걸면 어케됨?"]);
    // 커밋 id 는 구조적으로도 결과에 실린다(예전에는 audit 텍스트를 정규식으로 긁어야 했다).
    expect(record.result.commitIds).toEqual(["bc9eb432-1111-2222-3333-444455556666"]);
  });

  it("keeps ui actions on the row and caps them without hiding the count", () => {
    const uiActions = Array.from({ length: 460 }, (_, index) => ({
      at: `2026-08-30T04:00:${String(index % 60).padStart(2, "0")}.000Z`,
      seq: index + 1,
      surface: "panel",
      action: `click:btn-${index}`,
    }));
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "많이 눌렀다",
      result: { ok: true },
      uiActions,
    });
    expect(record.uiActions).toHaveLength(400);
    expect(record.truncated?.uiActions).toBe(60);
    expect(record.uiActions?.at(-1)?.action).toBe("click:btn-459");
  });

  it("upserts the pending row into the finished row under one id", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    await recordAiActivity({
      id,
      channel: "chat",
      instruction: "니 추천대로",
      result: { ok: false, pending: true },
    });
    expect(getAiActivityLog(id)?.result.pending).toBe(true);

    await recordAiActivity({
      id,
      channel: "chat",
      instruction: "니 추천대로",
      result: { ok: true, proposedCalls: 3 },
      audit: [{ kind: "user", text: "니 추천대로" }],
    });
    const finished = getAiActivityLog(id);
    expect(finished?.result.pending).toBeUndefined();
    expect(finished?.result.proposedCalls).toBe(3);
    // 행이 늘지 않는다 — 시작·종료가 같은 id 로 덮인다.
    expect(listAiActivityLogs().filter((row) => row.id === id)).toHaveLength(1);
    expect(listAiActivityLogs()).toHaveLength(1);
  });

  it("records the orphaned turn instead of dropping it", async () => {
    const record = await recordAiActivity({
      channel: "chat",
      instruction: "늦게 도착한 턴",
      result: { ok: false, orphaned: true, stoppedReason: "ownership-lost" },
    });
    expect(record.result.orphaned).toBe(true);
    expect(record.result.stoppedReason).toBe("ownership-lost");
    expect(getAiActivityLog(record.id)?.result.orphaned).toBe(true);
  });

  it("writes a ui channel row that carries the pressed action names", async () => {
    const { recordAiUiActionBatch } = await import("@/ai/activityLog");
    const record = await recordAiUiActionBatch([
      { at: "2026-08-30T04:10:00.000Z", seq: 10, surface: "context-panel", action: "context-compact" },
      { at: "2026-08-30T04:10:02.000Z", seq: 11, surface: "panel", action: "dock-switch" },
    ]);
    expect(record?.channel).toBe("ui");
    // instruction 이 DB 의 유일한 평문 검색 축이다(`instruction=ilike.*dock-switch*`).
    expect(record?.instruction).toBe("[ui] context-compact, dock-switch");
    expect(record?.index.uiActions).toEqual(["context-compact", "dock-switch"]);
    expect(await recordAiUiActionBatch([])).toBeNull();
  });

  it("extracts commit ids from status lines through one shared helper", () => {
    expect(
      extractCommitIdsFromAudit([
        { kind: "status", text: "적용 commit=aaaaaaaa-1111-2222-3333-444444444444" },
        { kind: "status", text: "적용 commit=aaaaaaaa-1111-2222-3333-444444444444" },
        { kind: "user", text: "commit=cccccccc-1111-2222-3333-444444444444" },
      ]),
    ).toEqual(["aaaaaaaa-1111-2222-3333-444444444444"]);
  });
});
