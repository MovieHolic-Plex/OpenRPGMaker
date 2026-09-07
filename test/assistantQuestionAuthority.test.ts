import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { IntentFacts, IntentMode } from "@/ai/intentDeclaration";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { getTool } from "@/editor/tools";

const RAW = 'Set title to "Unmet target"';
const TARGET = "Unmet target";
const QUESTION = "What is the project title?";
const ANSWER = "H5_ANSWER_SENTINEL";
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture", apiKey: "fixture", maxToolCalls: 1, autonomyLevel: "balanced" as const };
const final = (content = ANSWER): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tool = (name: string, args: unknown, id: string): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const title = (n: number) => tool("set_title_screen", { title: TARGET }, `h5_title_${n}`);
const authored = (mode: IntentMode) => ({ mode, needsPlan: false, requestRequirements: { entries: [{
  source: [{ start: 0, end: RAW.length, quote: RAW }], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: TARGET }],
  bindings: [{ source: { start: RAW.indexOf('"'), end: RAW.length, quote: JSON.stringify(TARGET) }, role: "value", criterionIndex: 0, fieldPath: ["value"] }],
}] } });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://fixture.invalid"); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetIntentDeclarationCache(); });

function setup(declare: (facts: IntentFacts, n: number) => unknown | Promise<unknown>, options: {
  chat?: (request: ChatRequest, n: number) => ChatResult | Promise<ChatResult>; initialTitle?: string; confirm?: boolean; queued?: () => string | null;
} = {}) {
  const project = createBlankProject();
  if (options.initialTitle !== undefined) project.meta.title = options.initialTitle;
  store.replace(project);
  const factsSeen: IntentFacts[] = [], declarationRequests: ChatRequest[] = [], writerRequests: ChatRequest[] = [], events: SessionEvent[] = [];
  const adapter = createLlmIntentDeclarer({ getConfig: () => config, chat: async (_config, request) => {
    declarationRequests.push(request);
    return final(JSON.stringify(await declare(factsSeen[factsSeen.length - 1]!, declarationRequests.length)));
  } });
  const session = new AssistantSession(project, { config: { ...config, ...(options.confirm ? { autonomyLevel: "confirm" } : {}) },
    contextOptions: { currentMapId: project.startMapId }, peekPendingUserMessage: options.queued,
    declareIntent: async (facts, signal) => { factsSeen.push(structuredClone(facts)); return adapter(facts, signal); },
    chat: async (_config, request) => {
      writerRequests.push(request);
      return options.chat ? options.chat(request, writerRequests.length) : title(writerRequests.length);
    },
  });
  const collect = (event: SessionEvent) => events.push(event);
  return { session, project, factsSeen, declarationRequests, writerRequests, events, collect };
}
async function retainUnmet(h: ReturnType<typeof setup>) {
  const controller = new AbortController();
  const result = await h.session.sendUserMessage(RAW, event => {
    h.collect(event);
    if (event.type === "run_state" && event.execution.state === "recovering") controller.abort();
  }, controller.signal, { autonomous: true, composerMode: "do" });
  expect(result.execution?.state).toBe("aborted");
  expect(h.session.getHarnessSnapshot().requests?.[0]).toMatchObject({ authoring: true, rawInstruction: RAW, units: [{ coverage: "declared" }] });
  expect(store.getCurrent().meta.title).not.toBe(TARGET);
}

describe("H5 current-request answer-only authority", () => {
  it.each([
    "Resize current map to 22x17; do not change the title.",
    "Resize current map to 22x17",
    "Do not change the title",
  ].flatMap(raw => [false, true].map(empty => ({ raw, empty }))))("H5-omitted-source-constraints-cannot-become-answer raw=$raw empty=$empty", async ({ raw, empty }) => {
    const h = setup(() => ({ mode: "question", needsPlan: false, ...(empty ? { requestRequirements: { entries: [] } } : {}) }), { chat: () => final() });
    const before = structuredClone(store.getCurrent()), controller = new AbortController();
    const result = await h.session.sendUserMessage(raw, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering") controller.abort();
    }, controller.signal, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("aborted");
    expect(h.events.filter(event => event.type === "run_state" && event.execution.state === "recovering")).toHaveLength(1);
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "answer")).toBe(false);
    expect(h.writerRequests).toHaveLength(0);
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([{ authoring: true, rawInstruction: raw }]);
    const units = h.session.getHarnessSnapshot().requests?.[0]?.units;
    expect(units?.length).toBe(raw.includes(";") ? 2 : 1);
    expect(units?.every(unit => unit.coverage === "uncovered" && !unit.withdrawal && !unit.supersededBy)).toBe(true);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(result.runOutcome).toMatchObject({ goal: "incomplete", delivery: "no-change" });
    expect(result.appliedCalls ?? []).toEqual([]); expect(result.proposedCalls).toEqual([]);
    expect(store.getCurrent()).toEqual(before);
  });

  it.each(["ask", "plan"] as const)("H5-omitted-source-constraints-preserve-explicit-%s", async mode => {
    const raw = "Resize current map to 22x17; do not change the title.";
    const h = setup(() => ({ mode: "question", needsPlan: false }), { chat: () => final() });
    const before = structuredClone(store.getCurrent());
    const result = await h.session.sendUserMessage(raw, h.collect, undefined, { autonomous: true, composerMode: mode });
    expect(result.execution?.state).toBe(mode === "ask" ? "answer" : "preview");
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls ?? []).toEqual([]);
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
    expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(mode !== "ask");
    expect(store.getCurrent()).toEqual(before);
  });

  it("H5-omitted-source-constraints-recover-through-anchored-extraction-and-real-apply", async () => {
    const raw = "Resize current map to 22x17; do not change the title.", first = "Resize current map to 22x17", second = "do not change the title";
    let h: ReturnType<typeof setup>;
    h = setup((_facts, n) => n === 1 ? { mode: "question", needsPlan: false } : { mode: "modify", needsPlan: false, requestRequirements: { entries: [
      { source: [{ start: 0, end: first.length, quote: first }], criteria: [{ kind: "mapDimensions", target: { mapId: h.project.startMapId }, width: 22, height: 17 }], bindings: [
        { source: { start: raw.indexOf("22"), end: raw.indexOf("22") + 2, quote: "22" }, role: "width", criterionIndex: 0, fieldPath: ["width"] },
        { source: { start: raw.indexOf("17"), end: raw.indexOf("17") + 2, quote: "17" }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
      ] },
      { source: [{ start: raw.indexOf(second), end: raw.indexOf(second) + second.length, quote: second }],
        criteria: [{ kind: "entityPreserve", subject: { kind: "project" }, path: ["meta", "title"] }],
        bindings: [{ source: { start: raw.indexOf("not"), end: raw.indexOf("not") + 3, quote: "not" }, role: "prohibit", criterionIndex: 0, fieldPath: [] }],
      },
    ] } }, { chat: (_request, n) => tool("resize_map", { mapId: h.project.startMapId, width: 22, height: 17 }, `omission_resize_${n}`) });
    const before = store.getCurrent().meta.title, controller = new AbortController();
    const result = await h.session.sendUserMessage(raw, event => {
      h.collect(event);
      // The expected first recovery repairs extraction. A failed repair or any later
      // writer recovery terminates immediately rather than passing by eventual luck.
      if (event.type === "run_state" && event.execution.state === "recovering" && (h.declarationRequests.length >= 2 || h.writerRequests.length > 0)) controller.abort();
    }, controller.signal, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("verified-local");
    expect(h.factsSeen[1]?.intentModeRepair).toEqual({ requestId: "request-1", previousMode: "question", reason: "unresolved-source-constraints" });
    expect(h.declarationRequests).toHaveLength(2); expect(h.writerRequests).toHaveLength(1);
    expect(store.getCurrent().maps[h.project.startMapId]).toMatchObject({ width: 22, height: 17 });
    expect(store.getCurrent().meta.title).toBe(before);
    expect(h.session.getHarnessSnapshot().requests?.[0]).toMatchObject({ authoring: true, rawInstruction: raw, units: [{ coverage: "declared" }, { coverage: "declared" }] });
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["resize_map"]);
  });

  it.each(['What does "No Signal" mean?', "1. What is the project title?"])("H5-informational-format-and-quoted-words-remain-answer raw=%s", async raw => {
    const h = setup(() => ({ mode: "question", needsPlan: false }), { chat: () => final() });
    const result = await h.session.sendUserMessage(raw, h.collect, undefined, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("answer");
    expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(false);
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls ?? []).toEqual([]);
  });

  it("H5-two-send-question-contradiction-recovers-and-verifies-both-requests", async () => {
    let second = false, secondWriterCalls = 0, firstSecondWriterDeclaration = 0;
    let h: ReturnType<typeof setup>;
    h = setup((_facts, n) => authored(n === 2 ? "question" : "modify"), { chat: () => {
      if (!second) return final();
      if (++secondWriterCalls === 1) { firstSecondWriterDeclaration = h.declarationRequests.length; return final(); }
      return title(secondWriterCalls);
    } });
    await retainUnmet(h); second = true;
    const controller = new AbortController();
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.declarationRequests.length > 3) controller.abort();
    }, controller.signal, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("verified-local");
    expect(firstSecondWriterDeclaration).toBe(3);
    expect(h.declarationRequests).toHaveLength(3);
    expect(h.factsSeen[2]).toMatchObject({ userText: RAW, intentModeRepair: { requestId: "request-2", previousMode: "question" } });
    const payload = h.declarationRequests[2]!.messages[1]!.content;
    if (typeof payload !== "string") throw new Error("Expected declaration context");
    const machine = payload.split("\n").find(line => line.startsWith('{"requestSource":'));
    expect(JSON.parse(machine!)).toMatchObject({ intentModeRepair: { requestId: "request-2", previousMode: "question" } });
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([
      { requestId: "request-1", authoring: true, rawInstruction: RAW, units: [{ coverage: "declared" }] },
      { requestId: "request-2", authoring: true, rawInstruction: RAW, units: [{ coverage: "declared" }] },
    ]);
    expect(h.session.getAcceptanceSnapshot()?.items.every(item => item.status === "verified")).toBe(true);
    expect(store.getCurrent().meta.title).toBe(TARGET);
    expect(h.events.some(event => event.type === "run_state" && event.execution.requestId === "request-2" && event.execution.state === "answer")).toBe(false);
  });

  it("H5-repeated-inconsistency-is-abortable-without-normal-authoring", async () => {
    const h = setup(() => authored("question"));
    const controller = new AbortController();
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.declarationRequests.length >= 3) controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("aborted");
    expect(h.declarationRequests).toHaveLength(3); expect(h.writerRequests).toHaveLength(0);
    expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(true);
    expect(h.session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
  });

  it.each(["initial", "recovery-event"] as const)("H5-applied-evidence-finishes-without-extra-model-approval-%s", async stage => {
    const h = setup(() => authored("question"), { ...(stage === "initial" ? { initialTitle: TARGET } : {}) });
    const controller = new AbortController();
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (stage === "recovery-event" && event.type === "run_state" && event.execution.state === "recovering") store.update(project => { project.meta.title = TARGET; });
      if (event.type === "run_state" && event.execution.state === "recovering" && h.declarationRequests.length > 1) controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(h.declarationRequests).toHaveLength(1); expect(h.writerRequests).toHaveLength(0);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(true);
  });

  it.each([false, true])("H5-legitimate-question-answers-without-resuming-older-scope-prior=%s", async prior => {
    const h = setup(facts => facts.userText === QUESTION ? { mode: "question" } : authored("modify"), { chat: () => final() });
    if (prior) await retainUnmet(h);
    const at = h.writerRequests.length, eventAt = h.events.length, original = structuredClone(store.getCurrent());
    const result = await h.session.sendUserMessage(QUESTION, h.collect, undefined, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("answer"); expect(result.assistantText).toBe(ANSWER);
    expect(h.writerRequests.length - at).toBe(1);
    expect(h.events.slice(eventAt).some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
    expect(h.writerRequests[at]!.tools?.some(tool => getTool(tool.function.name)?.mode === "write")).toBe(false);
    expect(store.getCurrent()).toEqual(original);
    expect(h.session.getHarnessSnapshot().requests?.at(-1)?.authoring).toBe(false);
    if (prior) {
      expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(true);
      expect(h.session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
    } else expect(h.session.getAcceptanceSnapshot()).toBeNull();
  });

  it("H5-explicit-ask-overrides-authored-extraction-and-refuses-writes", async () => {
    let asking = false, asks = 0;
    const h = setup(() => authored("modify"), { chat: () => !asking ? final() : ++asks === 1 ? title(1) : final() });
    await retainUnmet(h); asking = true; h.session.updateConfig({ ...config, maxToolCalls: 2 });
    const original = structuredClone(store.getCurrent()), at = h.events.length;
    const result = await h.session.sendUserMessage(RAW, h.collect, undefined, { autonomous: true, composerMode: "ask" });
    expect(result.execution?.state).toBe("answer"); expect(result.assistantText).toBe(ANSWER);
    expect(h.declarationRequests).toHaveLength(2);
    expect(h.events.slice(at).find(event => event.type === "tool_call" && event.name === "set_title_screen")).toMatchObject({ result: { ok: false, issues: [{ code: "composer-mode-ask" }] } });
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([{ authoring: true }, { authoring: false }]);
    expect(store.getCurrent()).toEqual(original);
  });

  it.each(["question", "ask"] as const)("H5-explicit-resume-after-%s-recovers-original-unresolved-source-and-scope", async interlude => {
    let resuming = false, resumeWrites = 0;
    const h = setup((facts, n) => facts.userText === QUESTION ? { mode: "question" } : n === 1 ? { mode: "modify" } : authored("modify"), {
      chat: () => !resuming || ++resumeWrites === 1 ? final() : title(resumeWrites),
    });
    const scope = { mapId: h.project.startMapId, region: { x: 1, y: 2, width: 3, height: 4 } };
    const firstAbort = new AbortController();
    const first = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering") firstAbort.abort();
    }, firstAbort.signal, { autonomous: true, scope });
    expect(first.execution?.state).toBe("aborted");
    expect(h.session.getHarnessSnapshot().requests?.[0]).toMatchObject({ requestId: "request-1", authoring: true, units: [{ coverage: "uncovered" }] });
    const answer = await h.session.sendUserMessage(QUESTION, h.collect, undefined, { autonomous: true, composerMode: interlude === "ask" ? "ask" : "do" });
    expect(answer.assistantText).toBe(ANSWER);
    const declarationsBeforeResume = h.factsSeen.length;
    resuming = true;
    const controller = new AbortController();
    const resumed = await h.session.sendUserMessage("continue", event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && resumeWrites > 2) controller.abort();
    }, controller.signal, { autonomous: true, goalAction: "resume" });
    expect(resumed.execution).toMatchObject({ requestId: "request-1", state: "verified-local" });
    expect(h.factsSeen.slice(declarationsBeforeResume)).toHaveLength(1);
    expect(h.factsSeen.at(-1)).toMatchObject({ userText: RAW, maps: h.factsSeen[0]!.maps,
      selection: { mapId: scope.mapId, x: 1, y: 2, width: 3, height: 4 } });
    expect(h.session.getHarnessSnapshot().requests?.map(request => [request.requestId, request.rawInstruction, request.authoring])).toEqual([
      ["request-1", RAW, true], ["request-2", QUESTION, false],
    ]);
    expect(store.getCurrent().meta.title).toBe(TARGET);
  });

  it("H5-answer-read-does-not-replan-or-complete-an-older-work-item", async () => {
    let asking = false, questionCalls = 0;
    const plan = { goal: "Pending title", layers: [{ title: "Inspect", items: [{ title: "Inspect project", instruction: "Read project", successTools: ["get_project_summary"] }] }] };
    const h = setup(facts => facts.userText === QUESTION ? { mode: "question" } : authored("modify"), { chat: (request, n) => {
      if (!asking) return tool("set_work_plan", plan, `old_plan_${n}`);
      questionCalls++;
      if (!request.tools?.length) return final('{"action":"resume"}');
      return questionCalls === 1 ? tool("get_project_summary", {}, "answer_read") : final();
    } });
    await retainUnmet(h); asking = true; h.session.updateConfig({ ...config, maxToolCalls: 3 });
    const before = h.session.getWorkPlan(), at = h.writerRequests.length;
    const result = await h.session.sendUserMessage(QUESTION, h.collect, undefined, { autonomous: true });
    expect(result.assistantText).toBe(ANSWER); expect(result.execution?.state).toBe("answer");
    expect(h.writerRequests.slice(at)).toHaveLength(2);
    expect(h.writerRequests.slice(at).every(request => Boolean(request.tools?.length))).toBe(true);
    expect(h.events.find(event => event.type === "tool_call" && event.name === "get_project_summary")).toMatchObject({ result: { ok: true } });
    expect(h.session.getWorkPlan()).toEqual(before);
  });

  it.each(["complete", "aborted", "queued", "project-switch"] as const)("H5-older-uncovered-backlog-after-compatible-applied-work-%s", async boundary => {
    const oldRaw = "Resize current map to 22x17";
    let stage: "old" | "new" = "old", queued: string | null = null, oldDeclarations = 0, recoveries = 0;
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
    const oldRepairs: IntentFacts[] = [];
    let h: ReturnType<typeof setup>;
    h = setup(async facts => {
      if (facts.userText !== oldRaw) return authored("modify");
      if (++oldDeclarations === 1) return { mode: "modify", needsPlan: false };
      oldRepairs.push(structuredClone(facts)); enter();
      if (boundary !== "complete") await held;
      return { mode: "modify", needsPlan: false, requestRequirements: { entries: [{
        source: [{ start: 0, end: oldRaw.length, quote: oldRaw }], criteria: [{ kind: "mapDimensions", target: { mapId: h.project.startMapId }, width: 22, height: 17 }],
        bindings: [
          { source: { start: oldRaw.indexOf("22"), end: oldRaw.indexOf("22") + 2, quote: "22" }, role: "width", criterionIndex: 0, fieldPath: ["width"] },
          { source: { start: oldRaw.indexOf("17"), end: oldRaw.length, quote: "17" }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
        ],
      }] } };
    }, { queued: () => queued, chat: (_request, n) => stage === "old" ? final()
      : oldRepairs.length ? tool("resize_map", { mapId: h.project.startMapId, width: 22, height: 17 }, `backlog_resize_${n}`) : title(n) });
    const map = h.project.maps[h.project.startMapId]!;
    const scope = { mapId: map.id, region: { x: 0, y: 0, width: map.width, height: map.height } };
    const first = await h.session.sendUserMessage(oldRaw, h.collect, undefined, { scope });
    expect(first.execution?.state).toBe("manual-segment");
    expect(h.session.getHarnessSnapshot().requests?.[0]?.units[0]?.coverage).toBe("uncovered");
    stage = "new";
    const controller = new AbortController();
    const running = h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering") {
        recoveries++;
        if ((!oldRepairs.length && recoveries >= 2) || recoveries > 4) controller.abort();
      }
    }, controller.signal, { autonomous: true });
    try {
      if (boundary !== "complete") {
        expect(await Promise.race([entered.then(() => true), running.then(() => false)])).toBe(true);
        expect(store.getCurrent().meta.title).toBe(TARGET);
        if (boundary === "aborted") controller.abort();
        if (boundary === "queued") queued = "Latest user instruction";
        if (boundary === "project-switch") { const next = createBlankProject(); next.meta.title = "Other project"; store.replaceProject(next); }
        release();
      }
      const result = await running;
      expect(result.execution).toMatchObject({ requestId: "request-2", state: boundary === "complete" ? "verified-local" : boundary });
      expect(oldRepairs).toHaveLength(1);
      expect(oldRepairs[0]).toMatchObject({ userText: oldRaw, maps: h.factsSeen[0]!.maps, currentMap: h.factsSeen[0]!.currentMap,
        selection: { mapId: map.id, x: 0, y: 0, width: map.width, height: map.height }, requestCoverage: [{ id: "request-1:source:0" }] });
      const requests = h.session.getHarnessSnapshot().requests!;
      expect(requests.map(request => [request.requestId, request.rawInstruction, request.authoring])).toEqual([["request-1", oldRaw, true], ["request-2", RAW, true]]);
      if (boundary === "complete") {
        expect(store.getCurrent().maps[map.id]).toMatchObject({ width: 22, height: 17 });
        expect(store.getCurrent().meta.title).toBe(TARGET);
        expect(requests[0]?.units[0]?.coverage).toBe("declared");
        expect(h.session.getAcceptanceSnapshot()?.items.every(item => item.status === "verified")).toBe(true);
        expect(result.appliedCalls?.map(call => call.name)).toEqual(expect.arrayContaining(["set_title_screen", "resize_map"]));
      } else {
        expect(requests[0]?.units[0]?.coverage).toBe("uncovered");
        expect(h.events.some(event => event.type === "tool_call" && event.name === "resize_map")).toBe(false);
        expect(store.getCurrent().maps[map.id]).toMatchObject({ width: map.width, height: map.height });
        expect(store.getCurrent().meta.title).toBe(boundary === "project-switch" ? "Other project" : TARGET);
      }
    } finally { controller.abort(); release(); await running; }
  });

  it("H5-backlog-selection-excludes-an-older-answer-only-source", async () => {
    let authoring = false, writes = 0;
    const h = setup(facts => facts.userText === QUESTION ? { mode: "question" } : authored("modify"), {
      chat: () => !authoring || ++writes === 1 ? final() : title(writes),
    });
    expect((await h.session.sendUserMessage(QUESTION, h.collect, undefined, { autonomous: true })).assistantText).toBe(ANSWER);
    authoring = true;
    const result = await h.session.sendUserMessage(RAW, h.collect, undefined, { autonomous: true });
    expect(result.execution?.state).toBe("verified-local");
    expect(h.declarationRequests).toHaveLength(2);
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([{ authoring: false, units: [{ coverage: "uncovered" }] }, { authoring: true }]);
    expect(store.getCurrent().meta.title).toBe(TARGET);
  });

  it.each(["plan", "confirm"] as const)("H5-conflict-%s-waits-for-explicit-authorization", async mode => {
    const h = setup((_facts, n) => authored(n === 1 ? "question" : "modify"), { confirm: mode === "confirm" });
    const preview = await h.session.sendUserMessage(RAW, h.collect, undefined, { autonomous: true, composerMode: mode === "plan" ? "plan" : "do" });
    expect(preview.execution?.state).toBe("preview"); expect(h.writerRequests).toHaveLength(0);
    expect(h.declarationRequests).toHaveLength(1);
    const controller = new AbortController();
    const result = await h.session.sendUserMessage("continue", event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.declarationRequests.length > 2) controller.abort();
    }, controller.signal, { autonomous: true, goalAction: "resume" });
    expect(result.execution?.state).toBe("verified-local"); expect(store.getCurrent().meta.title).toBe(TARGET);
    expect(h.declarationRequests).toHaveLength(2);
    expect(h.session.getHarnessSnapshot().requests).toHaveLength(1);
  });

  it.each(["aborted", "queued", "project-switch"] as const)("H5-repair-await-honors-%s", async boundary => {
    let enter!: () => void, release!: () => void, queued: string | null = null;
    const entered = new Promise<void>(resolve => { enter = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
    const h = setup(async (_facts, n) => { if (n === 1) return authored("question"); enter(); await held; return authored("modify"); }, { queued: () => queued });
    const controller = new AbortController(), original = structuredClone(store.getCurrent());
    const running = h.session.sendUserMessage(RAW, h.collect, controller.signal, { autonomous: true });
    try {
      expect(await Promise.race([entered.then(() => true), running.then(() => false)])).toBe(true);
      if (boundary === "aborted") controller.abort();
      if (boundary === "queued") queued = "New user instruction";
      if (boundary === "project-switch") { const next = createBlankProject(); next.meta.title = "Other project"; store.replaceProject(next); }
      release();
      expect((await running).execution?.state).toBe(boundary);
      expect(h.writerRequests).toHaveLength(0);
      expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(true);
      if (boundary !== "project-switch") expect(store.getCurrent()).toEqual(original);
      else expect(store.getCurrent().meta.title).toBe("Other project");
    } finally { controller.abort(); release(); await running; }
  });
});
