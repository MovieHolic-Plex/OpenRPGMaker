import { describe, expect, it } from "vitest";
import { activityPayload, activityPhase, createActivityTrace, recordActivityEvent, ACTIVITY_ENTRY_LIMIT } from "@/ai/activityTrace";

describe("display-independent AI execution receipts", () => {
  it("pairs overlapping tools by agent and call id and retains long inputs and structured results", () => {
    let trace = createActivityTrace("집 배치", "project-a", 1000);
    const args = { note: "x".repeat(500), mapId: "map-a" };
    for (const actor of ["builder-a", "builder-b"]) trace = recordActivityEvent(trace, { type: "agent_event", agentId: actor, event: { type: "tool_start", id: "call-1", name: "get_map_region", args, at: 1000 } });
    trace = recordActivityEvent(trace, { type: "agent_event", agentId: "builder-b", event: { type: "tool_end", id: "call-1", name: "get_map_region", ok: true, summary: "확인", result: { count: 16 }, at: 1250 } });
    expect(trace.entries[0]?.status).toBe("running");
    expect(trace.entries[1]).toMatchObject({ actor: "builder-b", status: "ok", input: { args }, output: { count: 16 }, durationMs: 250 });
  });
  it("retains receipts past the legacy 200-row UI cap and reports bounded loss", () => {
    let trace = createActivityTrace("긴 작업", "project-a", 0);
    for (let i = 0; i < ACTIVITY_ENTRY_LIMIT + 5; i++) trace = recordActivityEvent(trace, { type: "turn", index: i, at: i });
    expect(trace.entries).toHaveLength(ACTIVITY_ENTRY_LIMIT);
    expect(trace.dropped).toBe(5);
    expect(trace.entries[0]?.output).toEqual({ index: 5 });
  });
  it("never persists private thinking, credentials, or entire project snapshots", () => {
    let trace = createActivityTrace("作業", "project-a", 0);
    trace = recordActivityEvent(trace, { type: "delta", kind: "thinking", text: "private text", at: 1 });
    expect(JSON.stringify(trace)).not.toContain("private text");
    const safe = activityPayload({ apiKey: "secret-key", nested: { refresh_token: "secret-token" }, message: "Bearer abcdefghijklmnop", project: { secret: "project-content" }, note: "a".repeat(25000) });
    expect(JSON.stringify(safe)).not.toMatch(/secret-key|secret-token|abcdefghijklmnop|project-content/);
    expect(JSON.stringify(safe)).toContain("생략");
  });
  it("does not equate tool success or draft completion with application or saving", () => {
    let trace = createActivityTrace("초안", "project-a", 0);
    trace = recordActivityEvent(trace, { type: "tool_start", id: "1", name: "paint_road", args: {}, at: 1 });
    trace = activityPhase(trace, "중단", 10);
    expect(trace.entries[0]).toMatchObject({ status: "info", endedAt: 10 });
    expect(trace.entries[0]?.summary).toContain("종료 응답 없음");
    expect(trace.entries.some(e => e.name === "save.accepted")).toBe(false);
  });
  it("coalesces connection receipts and explains legacy result limitations", () => {
    let trace = createActivityTrace("연결", "project-a", 0);
    for (let i = 0; i < 10; i++) trace = recordActivityEvent(trace, { type: "heartbeat", at: i });
    expect(trace.entries).toHaveLength(1);
    expect(trace.entries[0]?.output).toMatchObject({ count: 10 });
    trace = recordActivityEvent(trace, { type: "tool_end", id: "legacy", name: "find_events", ok: true, summary: "조회 완료" });
    expect(JSON.stringify(trace.entries.at(-1)?.output)).toContain("결과 요약만 제공");
  });
});
