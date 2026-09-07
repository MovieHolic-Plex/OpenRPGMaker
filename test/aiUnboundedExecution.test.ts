import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { AiConfig, ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

const config = { authMode: "apiKey" as const, agentMode: "chat" as const, baseUrl: "fixture", model: "fixture", apiKey: "fixture", maxToolCalls: 1, maxTokens: 512, autonomyLevel: "balanced" as const };
const INPUT = 'Set the project title to exactly "Final 64"';
const requirements = { entries: [{ source: [{ start: 0, end: INPUT.length, quote: INPUT }], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Final 64" }], bindings: [{ source: { start: INPUT.indexOf('"'), end: INPUT.length, quote: '"Final 64"' }, role: "value", criterionIndex: 0, fieldPath: ["value"] }] }] };
const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const write = (n: number, tokens = 20): ChatResult => ({ message: { role: "assistant", content: null, tool_calls: [{ id: `title_${n}`, type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: n === 64 ? "Final 64" : `Stage ${n}`, reason: "requested checkpoint" }) } }] }, finishReason: "tool_calls", usage: { prompt_tokens: 10, completion_tokens: tokens, total_tokens: tokens + 10 } });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://fixture.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function setup(chat: NonNullable<ConstructorParameters<typeof AssistantSession>[1]>["chat"], settings: AiConfig = config) {
  const project = createBlankProject(); store.replace(project);
  return new AssistantSession(project, { config: settings, chat, declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, requestRequirements: requirements }) });
}

describe("one authorized execution", () => {
  it("C2 ask source cannot prohibit a later authorized request", async () => {
    let calls = 0;
    const session = setup(async () => ++calls === 1 ? final("Answer only") : write(64));
    await session.sendUserMessage("Do not change anything; explain the title", undefined, undefined, { autonomous: true, composerMode: "ask" });
    const controller = new AbortController();
    const result = await session.sendUserMessage(INPUT, event => {
      if (event.type === "run_state" && event.execution.state === "recovering") controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(store.getCurrent().meta.title).toBe("Final 64");
  });
  it("C4 extractor recovery transport failure is a typed external blocker", async () => {
    const project = createBlankProject(); store.replace(project);
    let declarations = 0;
    const session = new AssistantSession(project, { config, chat: async () => final("done"), declareIntent: async facts => {
      if (++declarations > 1) throw Object.assign(new Error("fixture extractor authorization"), { status: 401 });
      return fixedDeclarer({ mode: "modify" })(facts);
    } });
    const result = await session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true });
    expect(result.execution).toMatchObject({ state: "external-blocker", blocker: { kind: "auth", evidence: { code: "401" } } });
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
  });
  it("C4-stall-changes-strategy / C4-duplicate-refusal-not-replayed", async () => {
    const project = createBlankProject(); store.replace(project);
    const raw = "Resize current map to 22x17", mapId = project.startMapId;
    let writerCalls = 0, deferred = 0, failedExecutions = 0, recoveries = 0;
    const requestRequirements = { entries: [{ source: [{ start: 0, end: raw.length, quote: raw }], criteria: [{ kind: "mapDimensions", target: { mapId }, width: 22, height: 17 }], bindings: [
      { source: { start: raw.indexOf("22"), end: raw.indexOf("22") + 2, quote: "22" }, role: "width", criterionIndex: 0, fieldPath: ["width"] },
      { source: { start: raw.indexOf("17"), end: raw.length, quote: "17" }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
    ] }] };
    const session = new AssistantSession(project, { config, contextOptions: { currentMapId: mapId }, declareIntent: fixedDeclarer({ mode: "modify", targetMapId: mapId, requestRequirements }), chat: async (_config, request) => {
      if (!request.tools?.length) return final(JSON.stringify({ action: "direct" }));
      const n = ++writerCalls;
      return { message: { role: "assistant", content: null, tool_calls: [{ id: `resize_${n}`, type: "function", function: { name: "resize_map", arguments: JSON.stringify({ mapId, width: n <= 5 ? 0 : 22, height: 17, reason: `attempt ${n}` }) } }] }, finishReason: "tool_calls" };
    } });
    const result = await session.sendUserMessage(raw, event => {
      if (event.type === "run_state" && event.execution.state === "recovering") recoveries++;
      if (event.type === "tool_call" && event.name === "resize_map" && !event.result.ok) {
        if ((event.result.data as { executed?: boolean } | undefined)?.executed === false) deferred++; else failedExecutions++;
      }
    }, undefined, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(failedExecutions).toBe(4);
    expect(deferred).toBe(1);
    expect(recoveries).toBeGreaterThan(0);
    expect(store.getCurrent().maps[mapId]).toMatchObject({ width: 22, height: 17 });
  }, 60000);
  it.each(["plan", "confirm"] as const)("C1-confirm-continue / plan-only %s", async mode => {
    let writes = 0;
    const session = setup(async (_config, request) => request.tools?.length ? (writes++, write(64)) : final(JSON.stringify({ action: "direct" })), { ...config, autonomyLevel: mode === "confirm" ? "confirm" : "balanced" });
    const preview = await session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true, composerMode: mode === "plan" ? "plan" : "do" });
    expect(preview.execution?.state).toBe("preview"); expect(writes).toBe(0);
    const result = await session.sendUserMessage("continue", undefined, undefined, { autonomous: true, goalAction: "resume" });
    expect(result.execution?.state).toBe("verified-local"); expect(writes).toBe(1);
    expect(session.getHarnessSnapshot().requests).toHaveLength(1);
  });
  it("C4-project-switch", async () => {
    let entered!: () => void, release!: (result: ChatResult) => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const response = new Promise<ChatResult>(resolve => { release = resolve; });
    const session = setup(async () => { entered(); return response; });
    const running = session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true });
    await started;
    const next = createBlankProject(); next.meta.title = "Other project"; store.replaceProject(next);
    release(write(64));
    const result = await running;
    expect(result.execution?.state).toBe("project-switch");
    expect(store.getCurrent().meta.title).toBe("Other project");
  });
  it.each([false, true])("U1c identity retirement takes precedence over abort (switch=%s)", async switching => {
    let entered!: () => void, release!: (result: ChatResult) => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const response = new Promise<ChatResult>(resolve => { release = resolve; });
    const controller = new AbortController();
    const session = setup(async () => { entered(); return response; });
    const identity = store.getProjectIdentity().id, originalTitle = store.getCurrent().meta.title;
    const states: string[] = [];
    const unsubscribe = store.subscribe(() => { if (store.getProjectIdentity().id !== identity) controller.abort(); });
    const running = session.sendUserMessage(INPUT, event => { if (event.type === "run_state") states.push(event.execution.state); }, controller.signal, { autonomous: true });
    try {
      await started;
      if (switching) { const next = createBlankProject(); next.meta.title = "Other project"; store.replaceProject(next); }
      else controller.abort();
      expect(controller.signal.aborted).toBe(true);
      release(write(64));
      const result = await running;
      expect(result).toMatchObject({ stoppedReason: "aborted", execution: { state: switching ? "project-switch" : "aborted" } });
      expect(states.at(-1)).toBe(result.execution?.state);
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(store.getCurrent().meta.title).toBe(switching ? "Other project" : originalTitle);
    } finally { controller.abort(); unsubscribe(); release(write(64)); await running; }
  });
  it("C1-retry-resumes-driver", async () => {
    let calls = 0;
    const session = setup(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("fixture auth"), { status: 401 });
      return calls === 2 ? write(1) : write(64);
    });
    const failed = await session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true });
    expect(failed.execution).toMatchObject({ state: "external-blocker", blocker: { evidence: { origin: "transport", code: "401" } } });
    const resumed = await session.retryLastTurn();
    expect(resumed.execution?.state).toBe("verified-local");
    expect(store.getCurrent().meta.title).toBe("Final 64");
    expect(resumed.appliedCalls).toHaveLength(2);
    expect(session.getHarnessSnapshot().requests).toHaveLength(1);
  });
  it.each([undefined, "balanced"] as const)("C1-default-and-balanced %s", async autonomyLevel => {
    let calls = 0;
    const session = setup(async () => ++calls === 1 ? write(1) : write(64), { ...config, autonomyLevel });
    const result = await session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true });
    expect(result.execution).toMatchObject({ state: "verified-local", segment: 2 });
    expect(calls).toBe(2);
  });
  it("C1-token-rollover / C1-batch-tail", async () => {
    let calls = 0;
    const batch = write(1, 512);
    batch.message.tool_calls!.push(...write(2).message.tool_calls!);
    const session = setup(async () => ++calls === 1 ? batch : write(64), { ...config, maxToolCalls: 8 });
    const result = await session.sendUserMessage(INPUT, undefined, undefined, { autonomous: true });
    expect(result.execution).toMatchObject({ state: "verified-local", segment: 2 });
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["Stage 1", "Stage 2", "Final 64"]);
    const messages = session.getMessages();
    for (const call of batch.message.tool_calls!) expect(messages.filter(message => message.role === "tool" && message.tool_call_id === call.id)).toHaveLength(1);
  });
  it("C4-abort-after-await", async () => {
    const controller = new AbortController();
    let release!: (result: ChatResult) => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const response = new Promise<ChatResult>(resolve => { release = resolve; });
    const session = setup(async () => { started(); return response; });
    const before = store.getCurrent().meta.title;
    const running = session.sendUserMessage(INPUT, undefined, controller.signal, { autonomous: true });
    await entered;
    controller.abort(); release(write(64));
    const result = await running;
    expect(result.stoppedReason).toBe("aborted");
    expect(store.getCurrent().meta.title).toBe(before);
    expect(result.appliedCalls ?? []).toHaveLength(0);
  });
  it("C4-queued-before-rollover", async () => {
    let queued: string | null = null, calls = 0;
    const project = createBlankProject(); store.replace(project);
    const session = new AssistantSession(project, { config, declareIntent: fixedDeclarer({ requestRequirements: requirements }), peekPendingUserMessage: () => queued, chat: async () => { calls++; return write(1); } });
    const result = await session.sendUserMessage(INPUT, event => { if (event.type === "milestone_applied") queued = "Replace the title"; }, undefined, { autonomous: true });
    expect(result.execution?.state).toBe("queued");
    expect(calls).toBe(1);
    expect(store.getCurrent().meta.title).toBe("Stage 1");
  });
  it("C2-user-amendment-only", async () => {
    const project = createBlankProject(); store.replace(project);
    const first = 'Set the title to "A"', correction = 'Replace the previous title with "B"';
    let calls = 0;
    const session = new AssistantSession(project, { config, chat: async () => {
      const result = write(1); result.message.tool_calls![0]!.function.arguments = JSON.stringify({ title: ++calls === 1 ? "A" : "B" }); return result;
    }, declareIntent: async facts => {
      const value = facts.userText === first ? "A" : "B";
      return fixedDeclarer({ mode: "modify", requestRequirements: { entries: [{ source: [{ start: 0, end: facts.userText.length, quote: facts.userText }], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value }], bindings: [{ source: { start: facts.userText.indexOf('"'), end: facts.userText.length, quote: JSON.stringify(value) }, role: "value", criterionIndex: 0, fieldPath: ["value"] }] }], ...(value === "B" ? { amendments: [{ obligationId: "request-1:source:0", source: { start: 0, end: correction.length, quote: correction } }] } : {}) } })(facts);
    } });
    expect((await session.sendUserMessage(first, undefined, undefined, { autonomous: true })).execution?.state).toBe("verified-local");
    const controller = new AbortController();
    const result = await session.sendUserMessage(correction, event => { if (event.type === "run_state" && event.execution.state === "recovering") controller.abort(); }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(store.getCurrent().meta.title).toBe("B");
    expect(session.getHarnessSnapshot().requests?.[0]?.units[0]).toMatchObject({ supersededBy: "request-2" });
  });
  it("C1-64-real-segments", async () => {
    let calls = 0;
    const session = setup(async () => ++calls <= 64 ? write(calls) : final("done"));
    const checkpoints: string[] = [], segments: number[] = [];
    const result = await session.sendUserMessage(INPUT, event => {
      if (event.type === "milestone_applied") checkpoints.push(store.getCurrent().meta.title);
      if (event.type === "run_state") segments.push(event.execution.segment);
    }, undefined, { autonomous: true });
    expect(checkpoints).toEqual(Array.from({ length: 64 }, (_, i) => i === 63 ? "Final 64" : `Stage ${i + 1}`));
    expect(new Set(segments).size).toBeGreaterThan(48);
    expect(store.getCurrent().meta.title).toBe("Final 64");
    expect(result.execution?.state).toBe("verified-local");
    expect(result.proposedCalls).toHaveLength(0);
    expect(result.appliedCalls).toHaveLength(64);
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(calls).toBe(64);
  }, 180000);

  it("C3-direct-done-without-write / C4-internal-is-not-external", async () => {
    const controller = new AbortController();
    const states: string[] = [];
    const session = setup(async () => final("done"));
    const result = await session.sendUserMessage(INPUT, event => {
      if (event.type === "run_state") {
        states.push(event.execution.state);
        if (event.execution.state === "recovering") controller.abort();
      }
    }, controller.signal, { autonomous: true });
    expect(states).toContain("recovering");
    expect(states).not.toContain("external-blocker");
    expect(result.stoppedReason).toBe("aborted");
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
  });

  it("C2-source-before-direct: source exists before asynchronous declaration", async () => {
    const project = createBlankProject(); store.replace(project);
    let seen: unknown;
    let session: AssistantSession;
    session = new AssistantSession(project, { config, chat: async () => final("done"), declareIntent: async facts => {
      seen = session.getHarnessSnapshot().requests;
      return fixedDeclarer({ mode: "modify", needsPlan: false, requestRequirements: requirements })(facts);
    } });
    await session.sendUserMessage(INPUT, undefined, undefined, { instruction: INPUT });
    expect(seen).toMatchObject([{ rawInstruction: INPUT, units: [{ coverage: "uncovered" }] }]);
  });
});
