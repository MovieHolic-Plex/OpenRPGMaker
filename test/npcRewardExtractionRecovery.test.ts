import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache, type IntentDeclarationOutcome } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import type { GameEvent } from "@/project/types";
import type { IntentFacts } from "@/ai/intentDeclaration";

const RAW = "Author the requested reward NPC";
const NPC = "h3_reward";
const REWARDS = [{ target: { eventId: NPC }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true }] as const;
const SOURCE = { start: 0, end: RAW.length, quote: RAW };
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture", apiKey: "fixture", maxToolCalls: 1, autonomyLevel: "balanced" as const };
const response = (value: unknown): ChatResult => ({ message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" });
const requirements = (mapId: string) => ({ entries: [{ source: [SOURCE], criteria: [{
  kind: "entityCount", collection: { kind: "events", mapId }, selector: { ids: [NPC] }, comparison: "eq", count: 1, basis: "requestDelta",
}], bindings: [] }] });
const declaration = (mapId: string, npcRewards: unknown = REWARDS) => ({ mode: "modify", needsPlan: false, targetMapId: mapId, requestRequirements: requirements(mapId), ...(npcRewards === "omit" ? {} : { npcRewards }) });
function rewardNpc(id = NPC): GameEvent {
  const page = { id: "grant", name: "Reward", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" as const },
    priority: "same" as const, overlapForbidden: true, movement: { type: "fixed" as const, speed: 3, frequency: 3 },
    commands: [{ kind: "changeItem" as const, itemId: "item_potion", op: "+=" as const, amount: 2 }, { kind: "setSelfSwitch" as const, key: "A" as const, value: true }],
  };
  return { id, name: "Reward", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [page,
    { ...page, id: "claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "Claimed" }] },
  ] };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://fixture.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetIntentDeclarationCache(); });

function setup(provider: (request: ChatRequest, call: number, mapId: string) => Promise<ChatResult>, options: { confirm?: boolean; queued?: () => string | null; onWriter?: () => void; write?: (n: number, mapId: string) => ChatResult } = {}) {
  const project = createBlankProject();
  project.maps[project.startMapId]!.events = [];
  store.replace(project);
  const declarations: ChatRequest[] = [], outcomes: IntentDeclarationOutcome[] = [], events: SessionEvent[] = [];
  const factsSeen: IntentFacts[] = [], writerRequests: ChatRequest[] = [];
  let writerCalls = 0;
  const adapter = createLlmIntentDeclarer({ getConfig: () => config, chat: async (_config, request) => {
    declarations.push(request);
    return provider(request, declarations.length, project.startMapId);
  } });
  const session = new AssistantSession(project, {
    config: { ...config, ...(options.confirm ? { autonomyLevel: "confirm" } : {}) },
    contextOptions: { currentMapId: project.startMapId }, peekPendingUserMessage: options.queued,
    declareIntent: async (facts, signal) => { factsSeen.push(structuredClone(facts)); const result = await adapter(facts, signal); outcomes.push(result); return result; },
    chat: async (_config, request) => {
      writerCalls++; writerRequests.push(request); options.onWriter?.();
      if (!request.tools?.length) return response({ action: "direct" });
      if (options.write) return options.write(writerCalls, project.startMapId);
      return { message: { role: "assistant", content: null, tool_calls: [{ id: `h3_write_${writerCalls}`, type: "function", function: {
        name: "upsert_event", arguments: JSON.stringify({ mapId: project.startMapId, event: rewardNpc() }),
      } }] }, finishReason: "tool_calls" };
    },
  });
  const collect = (event: SessionEvent) => events.push(event);
  return { project, session, declarations, outcomes, events, factsSeen, writerRequests, collect, writerCalls: () => writerCalls };
}

function requestData(request: ChatRequest): unknown {
  const content = request.messages[1]?.content;
  if (typeof content !== "string") throw new Error("Expected declaration user payload");
  const data = content.split("\n").find(line => line.startsWith('{"requestSource":'));
  if (!data) throw new Error("Expected machine request context");
  return JSON.parse(data);
}

describe("H3 reward extraction through the real adapter and public session", () => {
  it.each(["empty", "invalid", "omitted-repair"] as const)("H3-%s-extraction-recovers-before-any-writer", async variant => {
    let h: ReturnType<typeof setup>;
    h = setup(async (_request, n, mapId) => {
      expect(h.writerCalls()).toBe(0);
      if (n <= 2) return response(declaration(mapId, variant === "invalid" ? [{ target: {}, grants: [] }] : []));
      if (variant === "omitted-repair" && n === 3) return response(declaration(mapId, "omit"));
      return response(declaration(mapId));
    });
    const original = structuredClone(h.project);
    const controller = new AbortController();
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.writerCalls() > 0) controller.abort();
    }, controller.signal, { autonomous: true, scope: { mapId: original.startMapId, region: { x: 2, y: 3, width: 4, height: 4 } } });
    expect(result.execution?.state).toBe("verified-local");
    expect(h.declarations).toHaveLength(variant === "omitted-repair" ? 4 : 3);
    expect(requestData(h.declarations[2]!)).toMatchObject({ extractionRepair: { kind: "npc-rewards", requestId: "request-1", previous: { invalidReason: expect.any(String) }, reason: expect.any(String) } });
    expect(h.factsSeen.every(facts => facts.userText === RAW)).toBe(true);
    expect(h.factsSeen[1]).toMatchObject({ maps: h.factsSeen[0]!.maps, currentMap: h.factsSeen[0]!.currentMap, selection: { mapId: original.startMapId, x: 2, y: 3, width: 4, height: 4 } });
    expect(h.events.findIndex(event => event.type === "run_state" && event.execution.state === "recovering")).toBeLessThan(h.events.findIndex(event => event.type === "tool_call"));
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([{ requestId: "request-1", rawInstruction: RAW, units: [{ source: SOURCE, coverage: "declared" }] }]);
    expect(new Set(h.events.flatMap(event => event.type === "run_state" ? [event.execution.requestId] : []))).toEqual(new Set(["request-1"]));
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(verifyNpcRewardsPlayable(store.getCurrent(), REWARDS).ok).toBe(true);
    expect(store.getCurrent().meta.title).toBe(original.meta.title);
    expect(store.getCurrent().maps[original.startMapId]!.events).toHaveLength(1);
    expect(h.writerCalls()).toBe(1);
  });

  it("H3-indefinitely-malformed-is-abortable-with-no-planner-or-writer", async () => {
    const h = setup(async (_request, _n, mapId) => response(declaration(mapId, [])));
    const controller = new AbortController();
    const original = structuredClone(store.getCurrent());
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.declarations.length >= 4) controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("aborted");
    expect(h.declarations).toHaveLength(4);
    expect(h.writerCalls()).toBe(0);
    expect(h.events.some(event => event.type === "tool_call")).toBe(false);
    expect(store.getCurrent()).toEqual(original);
    expect(h.session.getHarnessSnapshot().requests).toHaveLength(1);
  });

  it.each(["aborted", "queued", "project-switch"] as const)("H3-late-repair-cannot-cross-%s", async boundary => {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    let queued: string | null = null;
    const h = setup(async (_request, n, mapId) => {
      if (n <= 2) return response(declaration(mapId, []));
      enter(); await held; return response(declaration(mapId));
    }, { queued: () => queued });
    const controller = new AbortController();
    const original = structuredClone(store.getCurrent());
    const running = h.session.sendUserMessage(RAW, h.collect, controller.signal, { autonomous: true });
    try {
      expect(await Promise.race([entered.then(() => true), running.then(() => false)])).toBe(true);
      if (boundary === "aborted") controller.abort();
      if (boundary === "queued") queued = "New user instruction";
      if (boundary === "project-switch") { const next = createBlankProject(); next.meta.title = "Other project"; store.replaceProject(next); }
      release();
      expect((await running).execution?.state).toBe(boundary);
      expect(h.writerCalls()).toBe(0);
      expect(h.session.getHarnessSnapshot().requests).toHaveLength(1);
      if (boundary === "project-switch") expect(store.getCurrent().meta.title).toBe("Other project");
      else expect(store.getCurrent()).toEqual(original);
    } finally { controller.abort(); release(); await running; }
  });

  it.each([1, 2, 3].flatMap(at => [401, 403, undefined].map(status => ({ at, status }))))("H3-real-adapter-failure-at-$at-status-$status-is-external", async ({ at, status }) => {
    const controller = new AbortController();
    const h = setup(async (_request, n, mapId) => {
      if (n >= at) throw new LlmError("H3 provider boundary", status);
      return response(declaration(mapId, []));
    }, { onWriter: () => controller.abort() });
    const result = await h.session.sendUserMessage(RAW, h.collect, controller.signal, { autonomous: true });
    expect(result.execution).toMatchObject({ state: "external-blocker", requestId: "request-1", blocker: {
      kind: status === undefined ? "transport" : "auth", evidence: { origin: "transport", code: status === undefined ? "transport-failed" : String(status) },
    } });
    expect(h.declarations).toHaveLength(at);
    expect(h.writerCalls()).toBe(0);
    expect(h.outcomes.at(-1)).toMatchObject({ failure: { kind: "provider", message: "H3 provider boundary" } });
    expect(h.events.some(event => event.type === "tool_call")).toBe(false);
    expect(h.session.getHarnessSnapshot().requests).toHaveLength(1);
  });

  it.each(["plan", "confirm"] as const)("H3-%s-does-not-repair-or-write-until-explicit-continue", async mode => {
    const h = setup(async (_request, n, mapId) => response(declaration(mapId, n <= 2 ? [] : REWARDS)), { confirm: mode === "confirm" });
    const first = await h.session.sendUserMessage(RAW, h.collect, undefined, { autonomous: true, composerMode: mode === "plan" ? "plan" : "do" });
    expect(first.execution?.state).toBe("preview");
    expect(h.writerCalls()).toBe(0); expect(h.declarations).toHaveLength(2);
    const controller = new AbortController();
    const result = await h.session.sendUserMessage("continue", event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.writerCalls() > 0) controller.abort();
    }, controller.signal, { autonomous: true, goalAction: "resume" });
    expect(result.execution?.state).toBe("verified-local");
    expect(h.session.getHarnessSnapshot().requests).toHaveLength(1);
    expect(verifyNpcRewardsPlayable(store.getCurrent(), REWARDS).ok).toBe(true);
  });

  it.each(["invalid-response", "provider-rejection"] as const)("H3-abort-precedes-%s-without-in-call-repair", async kind => {
    const controller = new AbortController();
    const h = setup(async (_request, _n, mapId) => {
      controller.abort();
      if (kind === "provider-rejection") throw new LlmError("Late unauthorized response", 401);
      return response(declaration(mapId, []));
    });
    const result = await h.session.sendUserMessage(RAW, h.collect, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("aborted");
    expect(h.declarations).toHaveLength(1);
    expect(h.writerCalls()).toBe(0);
    expect(h.outcomes[0]).toMatchObject({ failure: { kind: "aborted" } });
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "external-blocker")).toBe(false);
  });

  it("H3-ask-and-detached-calls-do-not-acquire-recovery-authorization", async () => {
    const h = setup(async (_request, _n, mapId) => response(declaration(mapId, [])));
    const original = structuredClone(store.getCurrent());
    const ask = await h.session.sendUserMessage(RAW, h.collect, undefined, { autonomous: true, composerMode: "ask" });
    expect(ask.stoppedReason).not.toBe("error");
    expect(h.session.getHarnessSnapshot().requests?.[0]?.authoring).toBe(false);
    expect(h.declarations).toHaveLength(2);
    expect(store.getCurrent()).toEqual(original);
    const writerCount = h.writerCalls();
    const detached = await h.session.sendUserMessage(RAW, h.collect);
    expect(detached.stoppedReason).toBe("error");
    expect(h.declarations).toHaveLength(4);
    expect(h.writerCalls()).toBe(writerCount);
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
  });

  it("H3-repair-preserves-prior-rewards-and-adopts-current-rewards-once", async () => {
    const priorId = "h3_prior", firstRaw = "Author the prior reward NPC";
    const priorRewards = [{ ...REWARDS[0], target: { eventId: priorId } }];
    const h = setup(async (_request, n, mapId) => {
      if (n === 1) return response({ ...declaration(mapId, priorRewards), requestRequirements: { entries: [{
        source: [{ start: 0, end: firstRaw.length, quote: firstRaw }],
        criteria: [{ kind: "entityCount", collection: { kind: "events", mapId }, selector: { ids: [priorId] }, comparison: "eq", count: 1, basis: "requestDelta" }], bindings: [],
      }] } });
      return response(declaration(mapId, n <= 3 ? [] : REWARDS));
    }, { write: (n, mapId) => {
      const prior = rewardNpc(priorId);
      if (n > 1) prior.pages![0]!.commands = [{ kind: "text", body: "No grant" }];
      const events = n === 1 ? [prior] : [{ ...rewardNpc(), x: 5 }, prior];
      return { message: { role: "assistant", content: null, tool_calls: events.map(event => ({ id: `h3_${n}_${event.id}`, type: "function", function: { name: "upsert_event", arguments: JSON.stringify({ mapId, event }) } })) }, finishReason: "tool_calls" };
    } });
    expect((await h.session.sendUserMessage(firstRaw, h.collect, undefined, { autonomous: true })).execution?.state).toBe("verified-local");
    const beforeWriters = h.writerCalls();
    const controller = new AbortController();
    const result = await h.session.sendUserMessage(RAW, event => {
      h.collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering" && h.writerCalls() > beforeWriters) controller.abort();
    }, controller.signal, { autonomous: true });
    expect(result.execution?.state).toBe("aborted");
    expect(h.declarations).toHaveLength(4);
    expect(h.writerRequests.at(-1)!.messages.some(message => typeof message.content === "string" && message.content.includes(JSON.stringify([...priorRewards, ...REWARDS])))).toBe(true);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), priorRewards).ok).toBe(false);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), REWARDS).ok).toBe(true);
    expect(h.session.getHarnessSnapshot().requests?.map(request => request.rawInstruction)).toEqual([firstRaw, RAW]);
  });
});
