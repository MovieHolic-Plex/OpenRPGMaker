import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixture, plan, size, skip } from "./requiredOutcomeFixture";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { buildAiActivityLogRecord, serializeAiActivityLog } from "@/ai/activityLog";
import { buildRunRecap, parseRunRecapPayload, serializeRunRecap } from "@/ai/runRecap";
import { EMPTY_SESSION_USAGE } from "@/ai/sessionUsage";

beforeEach(resetIntentDeclarationCache);
afterEach(() => { resetIntentDeclarationCache(); vi.restoreAllMocks(); });

describe("run outcome session boundaries", () => {
  it("publishes one unassessed projection when a query returns", async () => {
    // Given a real session with only scripted LLM transport.
    const f = fixture();
    // When a read-only response finishes.
    const result = await f.run([[{ name: "get_project_summary", args: {} }]]);
    // Then every backend publication agrees without crediting project history.
    const expected = { execution: "response-final", goal: "unassessed", delivery: "no-change" };
    expect(result).toHaveProperty("runOutcome", expected);
    expect(f.session.getHarnessSnapshot()).toHaveProperty("runOutcome", expected);
    expect(result.recap).toHaveProperty("runOutcome", expected);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  });

  it("captures blocked execution when required work is skipped", async () => {
    // Given an unmet canonical requirement.
    const f = fixture();
    // When scheduling is finished by skipping.
    const result = await f.run([[plan([size]), skip]]);
    // Then final compatibility does not imply completion.
    expect(result.stoppedReason).toBe("final");
    expect(result).toHaveProperty("runOutcome", { execution: "blocked", goal: "incomplete", delivery: "no-change" });
  });

  it("captures awaiting user when plan mode stops before execution", async () => {
    // Given a plan-only user request.
    const f = fixture();
    // When the native planning tool publishes a plan.
    const result = await f.run([[plan()]], { composerMode: "plan" });
    // Then final is a wait rather than a completed goal.
    expect(result).toHaveProperty("runOutcome", { execution: "awaiting-user", goal: "unassessed", delivery: "no-change" });
  });

  it("captures cancellation when the entry signal is already aborted", async () => {
    // Given an aborted user turn.
    const f = fixture();
    // When the real session executes its cancellation path.
    const result = await f.session.sendUserMessage("Inspect", event => f.events.push(event), AbortSignal.abort());
    // Then cancellation is typed independently of legacy stoppedReason.
    const expected = { execution: "cancelled", goal: "incomplete", delivery: "no-change" };
    expect(result).toHaveProperty("runOutcome", expected);
    expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
    expect(result.recap?.runOutcome).toEqual(expected);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
    expect(f.session.getAcceptanceSnapshot()?.items).toMatchObject([{ id: "request-1:source:0", required: true,
      coverage: "uncovered", status: "blocked", source: { text: "Inspect" }, sourceSpan: { start: 0, end: 7, quote: "Inspect" } }]);
    expect(f.session.getAcceptanceSnapshot()?.items).toHaveLength(1);
    expect(f.events.filter(event => event.type === "tool_call")).toEqual([]);
  });
});

describe("run outcome serialization", () => {
  it("retains outcome and recap when activity crosses JSON serialization", () => {
    // Given settled typed facts, not model text.
    const runOutcome = { execution: "cancelled", goal: "incomplete", delivery: "persisted" } as const;
    const input = { channel: "chat", instruction: "Inspect", result: { ok: false, runOutcome,
      recap: { elapsedMs: 0, promptTokens: 0, completionTokens: 0, llmCalls: 0, toolCalls: 0,
        ralphContinues: 0, volumeContinues: 0, process: [], runOutcome } } } as const;
    // When the actual activity builder and serializer run.
    const serialized: unknown = JSON.parse(serializeAiActivityLog(buildAiActivityLogRecord(input)));
    // Then neither typed projection is dropped.
    expect(serialized).toHaveProperty("result.runOutcome", runOutcome);
    expect(serialized).toHaveProperty("result.recap.runOutcome", runOutcome);
  });

  it("roundtrips outcome when recap crosses its compact audit format", () => {
    // Given a typed recap input.
    const runOutcome = { execution: "failed", goal: "unassessed", delivery: "draft" } as const;
    const input = { elapsedMs: 0, usage: EMPTY_SESSION_USAGE, audit: [], stoppedReason: "final", proposedWrites: 1, runOutcome };
    // When the compact audit payload is serialized and parsed.
    const parsed = parseRunRecapPayload(serializeRunRecap(buildRunRecap(input)));
    // Then the projection survives without prose inference.
    expect(parsed).toHaveProperty("runOutcome", runOutcome);
  });

  it("preserves absence when legacy activity and recap have no outcome", () => {
    // Given legacy records.
    const recap = buildRunRecap({ elapsedMs: 0, usage: EMPTY_SESSION_USAGE, audit: [], stoppedReason: "final", proposedWrites: 0 });
    // When current serializers consume them.
    const record = buildAiActivityLogRecord({ channel: "chat", instruction: "Inspect", result: { ok: true } });
    // Then no authority is invented from final or ok.
    expect(record.result).not.toHaveProperty("runOutcome");
    expect(parseRunRecapPayload(serializeRunRecap(recap))).not.toHaveProperty("runOutcome");
  });
});
