import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSessionCore";
import { createSessionProgressObserver, parseSessionProgress, SESSION_PLAN_LIMIT } from "@/ai/jobs/sessionProgress";
import { createSessionJobHost, createSessionCheckpointWriter } from "@/ai/jobs/sessionHost";
import { jsonObject, type SessionJobState } from "@/ai/jobs/checkpointState";
import type { JsonValue } from "@/ai/jobs/contracts";
import { workPlanFromSetToolArgs } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

const budget: SessionEvent = { type: "run_budget", turnIndex: 1, rounds: { used: 1, total: 8 }, driverContinuations: null };
const start = (name: string, index: number): SessionEvent => ({ type: "tool_started", name, index });
const done = (name: string): SessionEvent => ({ type: "tool_call", name, args: {}, result: { ok: true, summary: name } });
const plan = () => workPlanFromSetToolArgs({ goal: "inspect", layers: [{ title: "reads", items: [
  { title: "inspect", instruction: "get_project_summary", successTools: ["get_project_summary"] },
] }] }, new Date("2026-09-08T00:00:00Z"))!;

describe("session observation edges", () => {
  it("captures in-place draft changes before queued writes and reuses only identical bytes", async () => {
    const project = createBlankProject(), blobs: JsonValue[] = [], saved: Parameters<AiJobHost["saveCheckpoint"]>[0][] = [];
    const host: AiJobHost = { jobId: "capture", attemptId: "capture-attempt", dependencies: [],
      putJson: async value => { blobs.push(structuredClone(value)); return { sha256: String(blobs.length).padStart(64, "0"), byteLength: 1, mediaType: "application/json" }; },
      saveCheckpoint: async next => { saved.push(structuredClone(next)); return { sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" }; },
      loadCheckpoint: async () => null, readJson: async () => { throw new Error("Unexpected read"); },
      readBlob: async () => { throw new Error("Unexpected binary read"); }, putBlob: async () => { throw new Error("Unexpected binary write"); },
      providerOperation: async () => { throw new Error("Unexpected provider"); } };
    const state: SessionJobState = { startedAt: "2026-09-08T00:00:00Z", tools: [], draft: project };
    const job = createSessionJobHost(host, project, state, { domain: "core", budgetChars: 18000, preferenceMemorySection: "" });
    const before = project.meta.title, first = job.flush();
    project.meta.title = "in-place capture";
    const second = job.flush(), identical = job.flush();
    await Promise.all([first, second, identical]);
    expect(blobs).toHaveLength(2);
    expect(jsonObject(jsonObject(blobs[0]).meta).title).toBe(before);
    expect(jsonObject(jsonObject(blobs[1]).meta).title).toBe("in-place capture");
    expect(saved[0]!.state.draftRef).not.toEqual(saved[1]!.state.draftRef);
    expect(saved[1]!.state.draftRef).toEqual(saved[2]!.state.draftRef);
  });

  it("rejects every queued writer barrier with the original error and never invokes later storage", async () => {
    const writer = createSessionCheckpointWriter(), error = new Error("storage-failed");
    let writes = 0;
    const first = writer.write(async () => { writes++; throw error; });
    const second = writer.write(async () => { writes++; });
    expect(await Promise.allSettled([first, second])).toEqual([
      { status: "rejected", reason: error }, { status: "rejected", reason: error },
    ]);
    await expect(writer.write(async () => { writes++; })).rejects.toBe(error);
    expect(writes).toBe(1);
  });

  it("preserves parent tool identity around nested verification results", () => {
    const observer = createSessionProgressObserver();
    for (const event of [budget, start("complete_work_item", 1), start("validate_project", 2), done("validate_project")]) observer.observe(event);
    expect(observer.snapshot().currentTool).toEqual({ turnIndex: 1, index: 1, name: "complete_work_item" });
    observer.observe(done("complete_work_item"));
    const p = parseSessionProgress(observer.snapshot());
    expect(p.currentTool).toBeNull();
    expect(p.recentActivity.map(row => [row.name, row.index])).toEqual([["validate_project", 2], ["complete_work_item", 1]]);
  });

  it("keeps the replay frontier, deduplicates reconstruction and accepts legitimate replans", () => {
    const initial = createSessionProgressObserver(), completed = plan();
    completed.layers[0]!.items[0]!.status = "done"; completed.currentItemId = null;
    const events: SessionEvent[] = [budget, start("get_project_summary", 1), done("get_project_summary"), { type: "work_plan", plan: completed }];
    events.forEach(initial.observe);
    const saved = initial.snapshot(), replay = createSessionProgressObserver(saved);
    replay.observe(events[0]!);
    expect(replay.reconstructing()).toBe(true);
    expect(replay.snapshot()).toEqual(saved);
    events.slice(1).forEach(replay.observe);
    expect(replay.reconstructing()).toBe(false);
    expect(replay.snapshot()).toEqual(saved);
    const replacement = plan();
    replay.observe({ type: "work_plan", plan: replacement });
    expect(parseSessionProgress(replay.snapshot()).workPlan).toEqual(replacement);
    expect(replay.snapshot().recentActivity).toEqual(saved.recentActivity);
    expect(replay.snapshot().revision).toBeGreaterThan(saved.revision);
  });

  it("omits an oversized latest plan explicitly without mutating the actual plan", () => {
    const observer = createSessionProgressObserver(), large = { ...plan(), plannerNote: "x".repeat(SESSION_PLAN_LIMIT) };
    observer.observe(budget); observer.observe({ type: "work_plan", plan: large });
    expect(parseSessionProgress(observer.snapshot())).toMatchObject({ workPlan: null, workPlanOmitted: true });
    expect(large.plannerNote.length).toBe(SESSION_PLAN_LIMIT);
    observer.observe({ type: "work_plan", plan: plan() });
    expect(observer.snapshot()).not.toHaveProperty("workPlanOmitted");
    expect(parseSessionProgress(observer.snapshot()).workPlan).toEqual(plan());
  });

  it("bounds unknown tool labels and oversized usage with explicit information loss", () => {
    const observer = createSessionProgressObserver(), name = "x".repeat(513);
    observer.observe(budget); observer.observe(start(name, 1));
    expect(parseSessionProgress(observer.snapshot()).currentTool).toMatchObject({ name: name.slice(0, 512), nameTruncated: true });
    observer.observe(done(name));
    expect(parseSessionProgress(observer.snapshot()).recentActivity[0]).toMatchObject({ nameTruncated: true, truncated: true });
    const counts = { calls: 1, callsWithoutUsage: 1, promptTokens: 0, completionTokens: 0 };
    const sample = { ...counts, byModel: [{ ...counts, model: name }] };
    expect(parseSessionProgress(observer.snapshot(sample))).toMatchObject({ usage: null, usageOmitted: true });
    expect(sample.byModel[0]!.model).toBe(name);
    expect(parseSessionProgress(observer.snapshot({ ...counts, byModel: [{ ...counts, model: "actual-model" }] }))).not.toHaveProperty("usageOmitted");
  });

  it("rejects extra nested fields and inconsistent usage rather than dropping them", () => {
    const observer = createSessionProgressObserver(); observer.observe(budget);
    const p = observer.snapshot();
    for (const invalid of [
      { ...p, budget: { ...p.budget, rounds: { used: 1, total: 8, prompt: "not allowed" } } },
      { ...p, usage: { calls: 1, promptTokens: 0, completionTokens: 0, callsWithoutUsage: 1, byModel: [] } },
      { ...p, workPlan: { ...plan(), layers: [{ ...plan().layers[0], messages: [] }] } },
      { ...p, currentTool: { turnIndex: 1, index: 1, name: "get_project_summary", args: {} } },
    ]) expect(() => parseSessionProgress(invalid)).toThrow();
  });

  it("emits actual continuation changes and exhaustion independently of per-turn rounds", async () => {
    const project = createBlankProject();
    const ref = { sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" };
    const host: AiJobHost = { jobId: "numeric", attemptId: "numeric-attempt", dependencies: [],
      putJson: async () => ref, saveCheckpoint: async () => ref, loadCheckpoint: async () => null,
      readJson: async () => { throw new Error("Unexpected read"); }, readBlob: async () => { throw new Error("Unexpected binary read"); },
      putBlob: async () => { throw new Error("Unexpected binary write"); }, providerOperation: async () => { throw new Error("Unexpected provider transport"); } };
    const job = createSessionJobHost(host, project, { startedAt: "2026-09-08T00:00:00Z", tools: [], draft: project },
      { domain: "core", budgetChars: 18000, preferenceMemorySection: "" });
    const events: Extract<SessionEvent, { type: "run_budget" }>[] = [];
    let calls = 0;
    const session = new AssistantSession(project, { host: job.execution,
      config: { authMode: "chatgpt", providerId: "google-antigravity", agentMode: "chat", apiKey: "", baseUrl: "",
        model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 1, maxTokens: 1000000 },
      contextOptions: { budgetChars: 18000 }, declareIntent: fixedDeclarer({ mode: "modify", tools: ["get_project_summary"] }),
      yieldToUi: async () => {},
      chat: async (): Promise<ChatResult> => {
        const index = calls++;
        const name = index === 0 ? "set_work_plan" : "get_project_summary";
        const args = index === 0 ? { goal: "unfinished", layers: [{ title: "work", items: [
          { title: "write", instruction: "upsert_item", successTools: ["upsert_item"] },
        ] }] } : {};
        return { message: { role: "assistant", content: null, tool_calls: [{ id: `call-${index}`, type: "function",
          function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
      },
    });
    await session.sendUserMessage("Inspect", event => { if (event.type === "run_budget") events.push(event); }, undefined, { autonomous: true });
    expect(calls).toBe(49);
    expect(new Set(events.map(e => e.driverContinuations?.used))).toEqual(new Set(Array.from({ length: 49 }, (_, i) => i)));
    expect(events.at(-1)).toMatchObject({ turnIndex: 49, rounds: { used: 1, total: 1 }, driverContinuations: { used: 48, total: 48, exhausted: true } });
    expect(new Set(events.filter(e => e.rounds?.used === 1).map(e => e.turnIndex)).size).toBe(49);
    expect(session.getUsageTotals()).toMatchObject({ calls: 49, callsWithoutUsage: 49 });
  }, 60000);
});
