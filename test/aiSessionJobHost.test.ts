import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AssistantSession } from "@/ai/assistantSessionCore";
import { createSessionJobHost, jsonValue, type SessionJobState } from "@/ai/jobs/sessionHost";
import { parseSessionJobState, parseProject } from "@/ai/jobs/checkpointState";
import { executeAssistantJob, type AssistantJobPayload } from "@/ai/jobs/executors/assistantJob";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobCheckpoint, AiJobInput, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import type { ChatResult } from "@/ai/llmClient";
import type { SessionEvent } from "@/ai/assistantSessionCore";
import { fixedDeclarer, declaredIntent } from "./intentFixture";

const config = { authMode: "chatgpt" as const, providerId: "google-antigravity", agentMode: "chat" as const,
  model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 4096 };
const captured = { domain: "database" as const, preferenceMemorySection: "captured preference", budgetChars: 18000 };
function memoryHost(project = createBlankProject()) {
  const blobs = new Map<string, JsonValue>();
  let checkpoint: AiJobCheckpoint | null = null;
  const ref = (key: string): BlobRef => ({ sha256: key.padStart(64, "0"), byteLength: 0, mediaType: "application/json" });
  const host: AiJobHost = {
    jobId: "job-1", attemptId: "attempt-1", dependencies: [],
    readBlob: async () => { throw new Error("Unexpected binary read"); },
    putBlob: async () => { throw new Error("Unexpected binary write"); },
    readJson: async r => structuredClone(blobs.get(r.sha256)!),
    putJson: async value => { const key = String(blobs.size); blobs.set(key.padStart(64, "0"), structuredClone(value)); return ref(key); },
    loadCheckpoint: async () => structuredClone(checkpoint),
    saveCheckpoint: async value => { checkpoint = { ...structuredClone(value), version: 1, jobId: host.jobId, attemptId: host.attemptId, inputSha256: "input" }; return ref("checkpoint"); },
    providerOperation: async () => { throw new Error("Unexpected provider operation"); },
  };
  blobs.set("base".padStart(64, "0"), jsonValue(project));
  const payload: AssistantJobPayload = { instruction: "Register the supplied item", config, domain: "database", context: { budgetChars: captured.budgetChars, preferenceMemorySection: captured.preferenceMemorySection } };
  const input: AiJobInput & { family: "assistant" } = { version: 1, family: "assistant", project: { backend: "local", projectId: "snapshot-A" },
    projectSnapshot: ref("base"), artwork: [], target: {}, mode: "review", payload: jsonValue(payload) as JsonObject, dependsOn: [] };
  return { host, input, checkpoint: () => checkpoint, blobs };
}
const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function wire(result: ChatResult): JsonValue { return jsonValue({ choices: [{ message: result.message, finish_reason: result.finishReason }] }); }
beforeEach(() => resetIntentDeclarationCache());

describe("store-free session execution host", () => {
  it("validates complete project and checkpoint structure before execution", async () => {
    const f = memoryHost();
    const provider = vi.fn(async () => wire(final("Done"))); f.host.providerOperation = provider;
    const malformedRef = await f.host.putJson({ version: 4, maps: {}, database: {}, tilesets: {} });
    await expect(executeAssistantJob({ ...f.input, projectSnapshot: malformedRef }, f.host)).rejects.toThrow();
    await f.host.saveCheckpoint({ stageKey: "assistant/execute", state: { version: 1, startedAt: "not-a-clock", toolRefs: [] }, artifacts: [] });
    await expect(executeAssistantJob(f.input, f.host)).rejects.toThrow(/checkpoint clock/);
    expect(provider).not.toHaveBeenCalled();
  });

  it("reports an unfinished real work plan separately from a final message", async () => {
    const project = createBlankProject(); const { host } = memoryHost(project);
    const job = createSessionJobHost(host, project, { startedAt: "2026-09-06T00:00:00.000Z", tools: [], draft: project }, captured);
    const plan = { goal: "two records", layers: [{ title: "records", items: [{ title: "two", instruction: "upsert_item and set_title_screen", successTools: ["upsert_item", "set_title_screen"] }] }] };
    const steps = [final(JSON.stringify({ action: "new_plan", ...plan })), tool("set_work_plan", plan)];
    const session = new AssistantSession(project, { host: job.execution, config: { ...config, agentMode: "auto", maxToolCalls: 1, apiKey: "", baseUrl: "" },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }), contextOptions: captured, yieldToUi: async () => {},
      chat: async () => { const next = steps.shift(); if (!next) throw new Error("Unexpected provider call"); return next; } });
    await session.sendUserMessage("Register records");
    expect(session.getExecutionCompletionProblem()).toBe("work-plan-incomplete");
  });

  it.each(["invalid", "apiKey"])("rejects unsupported captured auth mode %s before any paid operation", async (authMode) => {
    const f = memoryHost();
    const provider = vi.fn(async () => wire(final("Done")));
    f.host.providerOperation = provider;
    const payload = { ...f.input.payload, config: { ...config, authMode } };
    await expect(executeAssistantJob({ ...f.input, payload }, f.host)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });

  it("retains budget-limited output privately without completing generation", async () => {
    const f = memoryHost();
    const responses = [wire(final(JSON.stringify(declaredIntent({ mode: "modify" })))), wire(tool("upsert_item", { item: { id: "budget-item", name: "Budget", price: 10 } }))];
    f.host.providerOperation = async () => { const result = responses.shift(); if (!result) throw new Error("Unexpected dispatch"); return result; };
    const payload = { ...f.input.payload, config: { ...config, maxTokens: 1 } };
    await expect(executeAssistantJob({ ...f.input, payload }, f.host)).rejects.toThrow(/ASSISTANT_INCOMPLETE/);
    expect(f.checkpoint()?.stageKey).toBe("assistant/partial");
    expect(f.checkpoint()?.state.completed).toBeUndefined();
  });

  it("does not retain full projects in the read-only tool journal", () => {
    const project = createBlankProject(); const { host } = memoryHost(project);
    const state: SessionJobState = { startedAt: "2026-09-06T00:00:00.000Z", draft: project, tools: [] };
    const job = createSessionJobHost(host, project, state, captured);
    job.execution.runTool({ project }, "get_project_summary", {});
    expect(state.tools[0]).not.toHaveProperty("project");
    expect(JSON.stringify(state.tools).length).toBeLessThan(JSON.stringify(project).length / 4);
  });

  it("runs a real milestone without editor application or false save evidence", async () => {
    const project = createBlankProject();
    const { host, checkpoint } = memoryHost(project);
    const state: SessionJobState = { startedAt: "2026-09-06T00:00:00.000Z", tools: [], draft: structuredClone(project) };
    const job = createSessionJobHost(host, project, state, captured);
    const plan = { goal: "register", layers: [{ title: "database", items: [{ title: "item", instruction: "upsert_item", successTools: ["upsert_item"] }] }] };
    const steps = [final(JSON.stringify({ action: "new_plan", ...plan })), tool("set_work_plan", plan),
      tool("upsert_item", { item: { id: "job-item", name: "Private", price: 10 } }), final("Done")];
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, { host: job.execution,
      config: { ...config, agentMode: "auto", apiKey: "", baseUrl: "" },
      contextOptions: captured, declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async () => { const next = steps.shift(); if (!next) throw new Error("Unexpected extra provider call"); return next; }, yieldToUi: async () => {},
    });
    const result = await session.sendUserMessage("Register one item", event => events.push(event), undefined, { autonomous: true });
    expect(result.stoppedReason).toBe("final");
    expect(events.some(event => event.type === "milestone_checkpointed")).toBe(true);
    expect(events.some(event => event.type === "milestone_applied")).toBe(false);
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(result.proposedCalls.map(call => call.name)).toContain("upsert_item");
    expect(project.database.items.some(item => item.id === "job-item")).toBe(false);
    const saved = await parseSessionJobState(checkpoint()!.state, host);
    expect(jsonValue(saved.draft)).toEqual(jsonValue(parseProject(session.getProposedProject())));
    expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text === "job:persistence-not-applicable")).toBe(true);
  }, 30000);

  it("resumes tool IDs and paid responses from a durable checkpoint after a response-boundary crash", async () => {
    const f = memoryHost();
    const responses = [wire(final(JSON.stringify(declaredIntent({ mode: "modify", tools: ["upsert_item"] })))),
      wire(tool("upsert_item", { item: { name: "Stable allocated item", price: 10 } })), wire(final("Done"))];
    const ledger = new Map<string, { request: JsonValue; response: JsonValue }>();
    let crash = true;
    let dispatches = 0;
    f.host.providerOperation = async ({ key, request }) => {
      const previous = ledger.get(key);
      if (previous) { expect(request).toEqual(previous.request); return structuredClone(previous.response); }
      const response = responses[dispatches++];
      if (!response) throw new Error("Unexpected provider dispatch");
      ledger.set(key, { request: structuredClone(request), response });
      if (key === "assistant/provider/2" && crash) { crash = false; throw new Error("worker interrupted after durable response"); }
      return response;
    };
    await expect(executeAssistantJob(f.input, f.host)).rejects.toThrow("worker interrupted");
    const before = structuredClone(f.checkpoint()!.state);
    expect((before.toolRefs as JsonValue[]).length).toBeGreaterThan(0);
    resetIntentDeclarationCache(); // a fresh attempt uses a fresh browser realm
    const result = await executeAssistantJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(dispatches).toBe(3);
    expect(result.attemptId).toBe("attempt-2");
    expect(f.checkpoint()!.state.toolRefs).toEqual(before.toolRefs);
    expect(result.payload.persistence).toBe("not-applicable");
    const after = f.blobs.get(result.generatedSnapshot!.sha256)! as JsonObject;
    expect(after).toEqual(jsonValue((await parseSessionJobState(f.checkpoint()!.state, f.host)).draft));
    // Completed resume does not rerun session tools or request a provider.
    const replay = await executeAssistantJob(f.input, { ...f.host, attemptId: "attempt-3" });
    expect(replay.payload).toEqual(result.payload);
    expect(replay.generatedSnapshot).toEqual(result.generatedSnapshot);
    expect(dispatches).toBe(3);
  }, 30000);

  it("does not continue paid work when intent dispatch fails", async () => {
    const f = memoryHost();
    const provider = vi.fn(async () => { throw new Error("physical outcome unknown"); });
    f.host.providerOperation = provider;
    await expect(executeAssistantJob(f.input, f.host)).rejects.toThrow("physical outcome unknown");
    expect(provider).toHaveBeenCalledTimes(1);
  }, 30000);

  it("uses captured preferences/domains and explicitly rejects live history reads", async () => {
    const project = createBlankProject(); const { host } = memoryHost(project);
    const job = createSessionJobHost(host, project, { startedAt: "2026-09-06T00:00:00.000Z", draft: project, tools: [] }, captured);
    expect(job.execution.activeDomains(null).has("database")).toBe(true);
    expect(job.execution.preferenceSection()).toBe(captured.preferenceMemorySection);
    expect(job.execution.budgetChars(1)).toBe(captured.budgetChars);
    expect(job.execution.runTool({ project }, "list_project_commits", {}).issues?.[0]?.code).toBe("job-history-unavailable");
  });
});
