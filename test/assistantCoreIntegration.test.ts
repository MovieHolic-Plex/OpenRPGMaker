import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { buildAiActivityLogRecord, serializeAiActivityLog } from "@/ai/activityLog";
import { buildRunRecap, parseRunRecapPayload, serializeRunRecap } from "@/ai/runRecap";
import { EMPTY_SESSION_USAGE } from "@/ai/sessionUsage";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { fixedDeclarer } from "./intentFixture";

const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture", apiKey: "fixture", maxToolCalls: 1 };
const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const titleContract = (raw: string, value: string) => ({ entries: [{ source: [anchor(raw)], criteria: [
  { kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value },
], bindings: [{ source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath: ["value"] }] }] });
const final = (): ChatResult => ({ message: { role: "assistant", content: "ANSWER" }, finishReason: "stop" });
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function projectFixture() {
  const project = createBlankProject(), map = project.maps[project.startMapId]!;
  const image = project.tilesets[map.tilesetId]!.image;
  map.tilesetId = "core-tile"; map.lowerTiles.fill(0);
  project.tilesets = { [map.tilesetId]: { id: map.tilesetId, name: "Core tile", image, kind: "custom", tileSize: map.tileSize,
    count: 1, tilesPerRow: 1, passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0] } };
  store.replace(project);
  return store.getCurrent();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://core-fixture.invalid"); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
});
afterEach(() => { resetMapEditHistory(); resetIntentDeclarationCache(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("host answer classification in the canonical owner", () => {
  it.each(["Resize current map to 22x17", "Do not change the title"])("cannot directly demote omitted source constraints: %s", raw => {
    const project = projectFixture(), ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    ledger.startRequest("r", raw, project);
    expect(ledger.markAnswer("r")).toBe(false);
    expect(ledger.getRequests()).toMatchObject([{ authoring: true, rawInstruction: raw, units: [{ coverage: "uncovered" }] }]);
    expect(ledger.evaluate(project)).toMatchObject({ status: "blocked", items: [{ id: "r:source:0", required: true }] });
  });

  it("removes only unvalidated current answer source, without inventing withdrawal or rewriting history", () => {
    const project = projectFixture(), ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    ledger.startRequest("r1", "What is the title?", project);
    const historical = ledger.evaluate(project);
    expect(historical.status).toBe("blocked");
    expect(ledger.markAnswer("r1")).toBe(true);
    expect(ledger.getRequests()).toMatchObject([{ authoring: false, units: [{ coverage: "uncovered" }] }]);
    expect(ledger.getRequests()[0]?.units[0]?.withdrawal).toBeUndefined();
    ledger.adoptRequestRequirements("r1", titleContract("What is the title?", "Forged"));
    expect(ledger.evaluate(project).items).toEqual([]);
    expect(historical.items[0]).toMatchObject({ required: true, status: "blocked", coverage: "uncovered" });
    expect(historical.items[0]?.withdrawal).toBeUndefined();
  });

  it.each(["source", "planner", "volume"] as const)("cannot classify away validated %s authority", kind => {
    const project = projectFixture(), ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    const raw = 'Set title to "Required"'; ledger.startRequest("r", raw, project);
    if (kind === "source") ledger.adoptRequestRequirements("r", titleContract(raw, "Required"));
    if (kind === "planner") ledger.adopt([{ id: "planner", title: "Planner", criteria: null }], project, { requestId: "r", text: raw, scope: null });
    if (kind === "volume") ledger.requireVolume("r", { authoredMaps: 1, multiPageNpcs: 0, shops: 0, quests: 0 }, project);
    expect(ledger.markAnswer("r")).toBe(false);
    expect(ledger.getRequests()[0]?.authoring).toBe(true);
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it("cannot retroactively reclassify an older active request", () => {
    const project = projectFixture(), ledger = new AssistantAcceptanceLedger("goal", "Goal", project);
    ledger.startRequest("old", "Old requirement", project);
    ledger.startRequest("new", "Current question", project);
    expect(ledger.markAnswer("old")).toBe(false);
    expect(ledger.markAnswer("new")).toBe(true);
    expect(ledger.evaluate(project)).toMatchObject({ status: "blocked", items: [{ id: "old:source:0", required: true }] });
  });
});

describe("main request/apply/result seams", () => {
  it("project retirement during terminal detail publication outranks its coincident abort", async () => {
    const project = projectFixture(), raw = 'Set title to "Required"';
    const controller = new AbortController(), identity = store.getProjectIdentity().id;
    const unsubscribe = store.subscribe(() => { if (store.getProjectIdentity().id !== identity) controller.abort(); });
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, { config, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: titleContract(raw, "Required") }),
      chat: async () => tool("set_title_screen", { title: "Required" }),
    });
    try {
      const result = await session.sendUserMessage(raw, event => {
        events.push(event);
        if (event.type === "run_state" && event.execution.state === "verified-local") store.replaceProject(createBlankProject());
      }, controller.signal, { autonomous: true });
      expect(result.execution?.state).toBe("project-switch");
      expect(result.runOutcome?.execution).toBe("cancelled");
      expect(result.recap?.execution).toEqual(result.execution);
      expect(result.appliedCalls).toHaveLength(1);
      expect(events.filter(event => event.type === "run_state").at(-1)).toMatchObject({ execution: result.execution });
    } finally { unsubscribe(); }
  });

  it.each([1, 3])("continues past %s model quick replies and applies the anchored request exactly once", async markers => {
    const project = projectFixture(), raw = 'Set title to "Required"'; let calls = 0, plannerCalls = 0;
    const events: SessionEvent[] = [], checkpoints: string[] = [];
    const session = new AssistantSession(project, { config: { ...config, maxToolCalls: 3 }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: titleContract(raw, "Required") }),
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          plannerCalls++;
          return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
        }
        calls++;
        if (calls === 1) return tool("set_work_plan", { goal: "Title", layers: [{ title: "Edit", items: [
          { title: "Title", instruction: "Set title", successTools: ["set_title_screen"] },
        ] }] });
        expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("in_progress");
        expect(session.getHarnessSnapshot().requests).toMatchObject([{ requestId: "request-1", rawInstruction: raw, authoring: true,
          units: [{ coverage: "declared", source: anchor(raw), criteria: titleContract(raw, "Required").entries[0]!.criteria }] }]);
        expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
        expect(store.getCurrent().meta.title).toBe(project.meta.title);
        if (calls <= markers + 1) return { message: { role: "assistant", content: `${QUICK_REPLY_MARKER} A | B` }, finishReason: "stop" };
        if (calls === markers + 2) return tool("set_title_screen", { title: "Required" });
        throw new Error("Unexpected replay after the required title write");
      },
    });
    const result = await session.sendUserMessage(raw, event => {
      events.push(event);
      if (event.type === "milestone_applied") checkpoints.push(store.getCurrent().meta.title);
    }, undefined, { autonomous: true });
    expect(result.error).toBeUndefined();
    expect(result.runOutcome).toEqual({ execution: "response-final", goal: "satisfied", delivery: "applied" });
    expect(result.execution).toMatchObject({ requestId: "request-1", state: "verified-local", segment: markers + 1 });
    expect(calls).toBe(markers + 2); expect(result.proposedCalls).toEqual([]);
    expect(plannerCalls).toBe(markers === 3 ? 1 : 0);
    expect(result.appliedCalls).toMatchObject([{ name: "set_title_screen", args: { title: "Required" } }]);
    expect(result.appliedCalls).toHaveLength(1);
    expect(checkpoints).toEqual(["Required"]);
    expect(events.filter(event => event.type === "tool_call" && event.name === "set_title_screen")).toHaveLength(1);
    expect(store.getCurrent().meta.title).toBe("Required");
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(session.getHarnessSnapshot().requests).toHaveLength(1);
    expect(session.getAuditEntries().filter(entry => entry.kind === "user")).toHaveLength(1);
  });

  it.each(["aborted", "queued", "project-switch", "external-blocker"] as const)("preserves %s after a model quick reply", async boundary => {
    const project = projectFixture(), raw = 'Set title to "Required"', controller = new AbortController();
    let calls = 0, queued: string | null = null;
    const states: string[] = [];
    const session = new AssistantSession(project, { config: { ...config, maxToolCalls: 3 }, yieldToUi: async () => {},
      peekPendingUserMessage: () => queued,
      declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: titleContract(raw, "Required") }),
      chat: async () => {
        if (++calls === 1) return tool("set_work_plan", { goal: "Title", layers: [{ title: "Edit", items: [{ title: "Title", instruction: "Set title" }] }] });
        if (calls === 2) return { message: { role: "assistant", content: `${QUICK_REPLY_MARKER} A | B` }, finishReason: "stop" };
        if (boundary === "external-blocker") throw Object.assign(new Error("fixture provider authorization"), { status: 401 });
        return tool("set_title_screen", { title: "Required" });
      },
    });
    try {
      const result = await session.sendUserMessage(raw, event => {
        if (event.type !== "run_state") return;
        states.push(event.execution.state);
        if (event.execution.state !== "recovering") return;
        if (boundary === "aborted") controller.abort();
        if (boundary === "queued") queued = 'Set title to "Correction"';
        if (boundary === "project-switch") store.replaceProject(createBlankProject());
      }, controller.signal, { autonomous: true });
      expect(states).toContain("recovering");
      expect(result.execution?.state).toBe(boundary);
      expect(result.runOutcome?.goal).not.toBe("satisfied");
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(result.proposedCalls).toEqual([]);
      expect(store.getCurrent().meta.title).toBe(project.meta.title);
      expect(calls).toBe(boundary === "external-blocker" ? 3 : 2);
      if (boundary === "external-blocker") expect(result.execution?.blocker).toMatchObject({ kind: "auth", requestId: "request-1",
        obligationIds: ["request-1:source:0"], sourceSpans: [anchor(raw)], evidence: { origin: "transport", code: "401" } });
    } finally { controller.abort(); }
  });

  it("keeps detached quick-reply scheduling finite without applying the source", async () => {
    const project = createBlankProject(), raw = 'Set title to "Required"'; let calls = 0;
    const session = new AssistantSession(project, { config: { ...config, maxToolCalls: 3 }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: titleContract(raw, "Required") }),
      chat: async () => ++calls === 1 ? tool("set_work_plan", { goal: "Title", layers: [{ title: "Edit", items: [{ title: "Title", instruction: "Set title" }] }] })
        : { message: { role: "assistant", content: `${QUICK_REPLY_MARKER} A | B` }, finishReason: "stop" },
    });
    const result = await session.sendUserMessage(raw, undefined, undefined, { autonomous: false });
    expect(result.runOutcome).toEqual({ execution: "awaiting-user", goal: "incomplete", delivery: "no-change" });
    expect(calls).toBe(2); expect(result.appliedCalls ?? []).toEqual([]);
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject().meta.title).toBe(project.meta.title);
  });

  it("does not turn an Ask quick reply into authorized execution", async () => {
    const project = projectFixture(); let calls = 0;
    const session = new AssistantSession(project, { config, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "question" }),
      chat: async () => ++calls === 1 ? { message: { role: "assistant", content: `${QUICK_REPLY_MARKER} A | B` }, finishReason: "stop" }
        : tool("set_title_screen", { title: "Forbidden" }),
    });
    const result = await session.sendUserMessage("What is the title?", undefined, undefined, { autonomous: true, composerMode: "ask" });
    expect(result.execution?.state).toBe("answer"); expect(calls).toBe(1);
    expect(result.appliedCalls ?? []).toEqual([]); expect(result.proposedCalls).toEqual([]);
    expect(store.getCurrent().meta.title).toBe(project.meta.title);
  });

  it.each(["chat", "auto"] as const)("Do crosses finite segments in %s mode without losing authorization", async agentMode => {
    const project = projectFixture(), raw = 'Set title to "Required"'; let calls = 0;
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, { config: { ...config, agentMode, autonomyLevel: "balanced" }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, requestRequirements: titleContract(raw, "Required") }),
      chat: async () => tool("set_title_screen", { title: ++calls === 1 ? "Interim" : "Required" }),
    });
    const result = await session.sendUserMessage(raw, event => events.push(event), undefined, { autonomous: true, composerMode: "do" });
    expect(result.execution).toMatchObject({ state: "verified-local", segment: 2 });
    expect(result.runOutcome).toEqual({ execution: "response-final", goal: "satisfied", delivery: "applied" });
    expect(result.appliedCalls).toHaveLength(2); expect(calls).toBe(2);
    expect(events.filter(event => event.type === "run_state" && event.execution.state === "running" && event.execution.rounds === 1)
      .map(event => event.type === "run_state" && event.execution.segment)).toEqual([1, 2]);
    const snapshot = session.getAcceptanceSnapshot(), historical = structuredClone(result);
    store.update(project => { project.meta.title = "External edit"; });
    expect(session.getRunOutcome()?.goal).toBe("incomplete");
    expect(session.getHarnessSnapshot().execution?.state).toBe("manual-segment");
    expect(session.getAcceptanceSnapshot()).toBe(snapshot);
    expect(result).toEqual(historical);
  });

  it.each([false, true])("explicit new goal retires old source/domain/draft before held preparation (fail=%s)", async fail => {
    const project = projectFixture(), oldRaw = 'Set title to "Old"', newRaw = 'Set title to "New"';
    let release!: () => void, enter!: () => void, stage = 0;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const declarations: string[] = [], writerTitles: string[] = [], events: SessionEvent[] = [];
    const preparationError = new Error("Held preparation failed");
    const session = new AssistantSession(project, { config, yieldToUi: async () => {},
      prepareProjectWiki: async () => { if (stage) { enter(); await held; if (fail) throw preparationError; } return undefined; },
      declareIntent: facts => { declarations.push(facts.userText); return fixedDeclarer({ mode: "modify",
        requestRequirements: titleContract(facts.userText, stage ? "New" : "Old"),
        ...(!stage ? { npcRewards: [{ target: { eventId: "missing-old-npc" }, grants: [{ kind: "item", id: "item_potion", count: 2 }] }] } : {}),
      })(facts); },
      chat: async () => { const title = stage ? "New" : "Old"; writerTitles.push(title); return tool("set_title_screen", { title }); },
    });
    const old = await session.sendUserMessage(oldRaw), history = session.getAcceptanceSnapshot();
    expect(old.proposedCalls).toHaveLength(1); expect(history?.status).not.toBe("verified");
    const oldRequests = session.getHarnessSnapshot().requests;
    expect(session.getRunEndProof()).toBeNull();
    const frozen = structuredClone(old); stage = 1;
    const controller = new AbortController();
    const running = session.sendUserMessage(newRaw, event => events.push(event), controller.signal, { autonomous: true, goalAction: "new-goal" });
    try {
      expect(session.getHarnessSnapshot().requests?.map(request => request.rawInstruction)).toEqual([newRaw]);
      expect(session.getAcceptanceHistory()).toEqual([history]);
      expect(session.getRequestHistory()[0]?.[0]?.rawInstruction).toBe(oldRaw);
      expect(session.getProposedProject().meta.title).toBe(project.meta.title);
      expect(await Promise.race([entered.then(() => true), running.then(() => false)])).toBe(true);
      const captured = session.getAcceptanceSnapshot();
      expect(captured).toMatchObject({ status: "blocked", items: [{ id: "request-2:source:0", required: true,
        status: "blocked", coverage: "uncovered", source: { requestId: "request-2", text: newRaw, scope: null }, sourceSpan: anchor(newRaw) }] });
      expect(captured?.items).toHaveLength(1);
      const newRequests = session.getHarnessSnapshot().requests;
      expect(newRequests).toEqual([{ requestId: "request-2", rawInstruction: newRaw, authoring: true,
        units: [{ id: "request-2:source:0", source: anchor(newRaw), coverage: "uncovered", criteria: null }] }]);
      expect(writerTitles).toEqual(["Old"]);
      expect(session.getRunEndProof()).toBeNull();
      release(); const result = await running;
      expect(result.runOutcome).toMatchObject({ execution: fail ? "failed" : "response-final", goal: fail ? "incomplete" : "satisfied", delivery: fail ? "no-change" : "applied" });
      expect(result.appliedCalls?.length ?? 0).toBe(fail ? 0 : 1);
      expect(declarations).toEqual(fail ? [oldRaw] : [oldRaw, newRaw]);
      expect(writerTitles).toEqual(fail ? ["Old"] : ["Old", "New"]);
      expect(result.proposedCalls).toEqual([]);
      expect(result.execution?.requestId).toBe("request-2");
      expect(session.getAcceptanceHistory()).toEqual([history]);
      expect(session.getRequestHistory()).toEqual([oldRequests]);
      expect(old).toEqual(frozen);
      if (fail) {
        expect(result.stoppedReason).toBe("error");
        expect(result.error).toBe(preparationError.message);
        expect(session.getAcceptanceSnapshot()).toEqual(captured);
        expect(session.getHarnessSnapshot().requests).toEqual(newRequests);
        expect(session.getWorkPlan()).toBeNull();
        expect(session.getProposedProject().meta.title).toBe(project.meta.title);
        expect(store.getCurrent().meta.title).toBe(project.meta.title);
        expect(session.getRunEndProof()).toBeNull();
        expect(events.filter(event => event.type === "tool_call" || event.type === "milestone_applied" || event.type === "persistence_proof")).toEqual([]);
      }
      if (!fail) expect(store.getCurrent().meta.title).toBe("New");
    } finally { controller.abort(); release(); await running; }
  });

  it.each(["ask", "plan"] as const)("raw continue and model reset cannot escalate %s", async mode => {
    const project = projectFixture(), raw = 'Set title to "Forbidden"';
    const session = new AssistantSession(project, { config, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", resetsContext: true, requestRequirements: titleContract(raw, "Forbidden") }),
      chat: async (_config, request) => request.tools?.length ? tool("set_title_screen", { title: "Forbidden" })
        : { message: { role: "assistant", content: '{"action":"direct"}' }, finishReason: "stop" },
    });
    await session.sendUserMessage(raw, undefined, undefined, { composerMode: mode, autonomous: true });
    const result = await session.sendUserMessage("continue", undefined, undefined, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe(mode === "ask" ? "answer" : "preview");
    expect(result.appliedCalls).toEqual([]); expect(result.proposedCalls).toEqual([]);
    expect(store.getCurrent().meta.title).toBe(project.meta.title);
    expect(session.getHarnessSnapshot().requests).toHaveLength(1);
  });

  it("a second ordinary Do confirms a Confirm preview without creating another source owner", async () => {
    const project = projectFixture(), raw = 'Set title to "Confirmed"'; let writes = 0;
    const session = new AssistantSession(project, { config: { ...config, autonomyLevel: "confirm" }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: titleContract(raw, "Confirmed") }),
      chat: async (_config, request) => request.tools?.length ? (writes++, tool("set_title_screen", { title: "Confirmed" }))
        : { message: { role: "assistant", content: '{"action":"direct"}' }, finishReason: "stop" },
    });
    const preview = await session.sendUserMessage(raw, undefined, undefined, { autonomous: true, composerMode: "do" });
    expect(preview.execution?.state).toBe("preview"); expect(writes).toBe(0);
    const result = await session.sendUserMessage("continue", undefined, undefined, { autonomous: true, composerMode: "do" });
    expect(result.execution?.state).toBe("verified-local"); expect(writes).toBe(1);
    expect(session.getHarnessSnapshot().requests?.map(request => request.rawInstruction)).toEqual([raw]);
  });

  it("pages exact UTF-16 raw source through the exposed read-only dispatcher", async () => {
    const project = projectFixture(), raw = "a".repeat(8191) + "\uD83D\uDE00" + "tail";
    const events: SessionEvent[] = []; let round = 0;
    const session = new AssistantSession(project, { config: { ...config, maxToolCalls: 4 }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "question" }), chat: async (_config, request) => {
        expect(request.tools?.some(tool => tool.function.name === "get_request_contract")).toBe(true);
        return ++round === 1 ? tool("get_request_contract", {}) : round === 2 ? tool("get_request_contract", { requestId: "request-1", offset: 8191, limit: 1 })
          : round === 3 ? tool("get_request_contract", { requestId: "request-1", offset: 8192, limit: 8193 }) : final();
      },
    });
    await session.sendUserMessage(raw, event => events.push(event), undefined, { composerMode: "ask" });
    const results = events.flatMap(event => event.type === "tool_call" && event.name === "get_request_contract" ? [event.result] : []);
    expect(results[0]).toMatchObject({ ok: true, data: { requests: [{ requestId: "request-1", length: raw.length }] } });
    expect(results[1]).toMatchObject({ ok: true, data: { text: raw.slice(8191, 8192), nextOffset: 8192 } });
    expect(results[2]?.ok).toBe(false);
    expect(session.getHarnessSnapshot().requests?.[0]?.rawInstruction).toBe(raw);
  });

  it("roundtrips both result axes and counts the full audit rather than the 80-row display", () => {
    const runOutcome = { execution: "failed", goal: "incomplete", delivery: "applied" } as const;
    const execution = { requestId: "r", state: "external-blocker", segment: 64, rounds: 1, roundCap: 1,
      blocker: { kind: "auth", requestId: "r", obligationIds: ["r:source:0"], sourceSpans: [anchor("Required")],
        evidence: { origin: "transport", code: "401", details: "Unauthorized fixture" }, neededAction: "Reconnect" } } as const;
    const recap = buildRunRecap({ elapsedMs: 0, usage: EMPTY_SESSION_USAGE, stoppedReason: "error", proposedWrites: 64, runOutcome, execution,
      audit: Array.from({ length: 100 }, () => ({ kind: "status", text: "ralph:continue" })) });
    expect(recap.process).toHaveLength(80); expect(recap.ralphContinues).toBe(100);
    expect(parseRunRecapPayload(serializeRunRecap(recap))).toMatchObject({ runOutcome, execution, ralphContinues: 100 });
    const record = buildAiActivityLogRecord({ channel: "chat", instruction: "Required", result: { ok: false, runOutcome, execution, requests: [], acceptance: null } });
    expect(JSON.parse(serializeAiActivityLog(record))).toMatchObject({ result: { runOutcome, execution, requests: [], acceptance: null } });
    expect(new AssistantSession(projectFixture()).getExecution()).toBeUndefined();
  });
});
