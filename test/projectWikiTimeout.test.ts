import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTimeout as clearDrainTimeout, setTimeout as setDrainTimeout } from "node:timers";
import { AssistantSession, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import { extractProjectWiki } from "@/ai/projectWikiClient";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createProjectWikiCoordinator, type WikiCoordinatorDependencies } from "@/editor/projectWikiCoordinator";
import { createBlankProject } from "@/project/defaults";
import { getMapEditHistoryEntries, peekPreviousProject, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

function signal<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const call = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const requestText = "Display the requested title without changing the map or project records";

const disposals: (() => Promise<void>)[] = [];

function fixture(testSignal: AbortSignal, overrides: Partial<WikiCoordinatorDependencies> = {}) {
  vi.useFakeTimers(); // Freeze unrelated autosave/edit-log jobs; never advance them to trigger extraction.
  const deadline = new AbortController();
  let timeoutMs: number | undefined;
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
    timeoutMs = ms;
    return deadline.signal;
  });
  const expireExtraction = () => {
    if (timeoutMs === undefined) throw new Error("Extraction deadline was not scheduled");
    vi.setSystemTime(Date.now() + timeoutMs);
    deadline.abort(new DOMException("Extraction deadline", "TimeoutError"));
  };
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const tileset = project.tilesets[map.tilesetId];
  // The blank map needs one passable tile, not every bundled chipset's metadata.
  // Retain real map/database/system data, lint, registered tools and store writers.
  map.lowerTiles.fill(0);
  project.tilesets = { [map.tilesetId]: {
    id: map.tilesetId, name: "Wiki fixture tileset", image: tileset.image, kind: "custom",
    tileSize: map.tileSize, tilesPerRow: 1, count: 1,
    passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0],
  } };
  project.meta.title = "Before authoring";
  project.worldCanon = { name: "Canon", body: "Manually maintained" };
  project.world = { entities: [
    { id: "w_old", type: "concept", name: "Moon", summary: "Stone moon", origin: "ai",
      wiki: { kind: "knowledge", basis: "explicit", topic: "moon", sources: [{ id: "old", kind: "user", text: "Stone moon", at: 1 }] } },
    { id: "w_current", type: "concept", name: "Moon", summary: "Glass moon", origin: "ai",
      wiki: { kind: "knowledge", basis: "explicit", topic: "moon", supersedes: ["w_old"], sources: [{ id: "current", kind: "user", text: "Glass moon", at: 2 }] } },
    { id: "w_manual", type: "place", name: "Archive", summary: "Keep intact", origin: "user", locked: true },
  ], relations: [{ a: "w_current", b: "w_manual", kind: "custom" }] };
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
  recordProjectSnapshot("Existing history");
  const before = structuredClone(store.getCurrent());
  const historyBefore = getMapEditHistoryEntries();
  const previousBefore = peekPreviousProject();
  const started = signal<ChatRequest>();
  const aborted = signal<unknown>();
  const transport = signal<ChatResult>();
  const settled = signal<void>();
  const extracted = signal<void>();
  const cancellation = new AbortController();
  const onTestAbort = () => cancellation.abort(testSignal.reason);
  testSignal.addEventListener("abort", onTestAbort, { once: true });
  if (testSignal.aborted) onTestAbort();
  const turns: Promise<TurnResult>[] = [];
  const children: Promise<unknown>[] = [transport.promise];
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= (async () => {
    cancellation.abort();
    // Abort wins first. Settle even a transport that ignores cancellation, including
    // when an assertion exited before the test supplied its scripted response.
    transport.resolve(response('{"upserts":[]}'));
    const results = await Promise.allSettled(turns);
    // Child rejections are consumed by their real session/coordinator callers.
    // Collect after turns settle: preparation may have started after disposal began.
    await Promise.allSettled(children);
    testSignal.removeEventListener("abort", onTestAbort);
    const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    if (failures.length) throw new AggregateError(failures, "Wiki fixture turn rejected during disposal");
  })();
  disposals.push(dispose);
  const order: string[] = [];
  const chat = vi.fn((_config: unknown, request: ChatRequest) => {
    order.push("extraction");
    request.signal!.addEventListener("abort", () => aborted.resolve(request.signal!.reason), { once: true });
    started.resolve(request);
    const pending = transport.promise.finally(() => settled.resolve());
    children.push(pending);
    return pending;
  });
  const history = vi.fn(async () => [{ id: "history", kind: "user" as const, text: "Earlier conversation", at: 0 }]);
  const flush = vi.fn(async () => { order.push("saved-local"); return { kind: "saved-local" as const }; });
  const deliveries: string[] = [];
  const outcomes: unknown[] = [];
  const coordinator = createProjectWikiCoordinator({
    getConfig: defaultAiConfig, history, flush,
    extract: (input, options) => {
      const pending = extractProjectWiki(input, { ...options, chat }).finally(() => extracted.resolve());
      children.push(pending);
      return pending;
    },
    ...overrides,
  });
  const events: SessionEvent[] = [];
  const declareIntent = vi.fn(async (...args: Parameters<ReturnType<typeof fixedDeclarer>>) => {
    order.push("intent");
    return fixedDeclarer({ mode: "modify", needsPlan: true, tools: ["set_title_screen"] })(...args);
  });
  let authorRound = 0;
  const authored = vi.fn(async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
    if (!request.tools?.length) {
      order.push("planner");
      return response(JSON.stringify({ action: "new_plan", goal: requestText,
        requirements: [
          { id: "title", title: "Requested title", required: true, criteria: [{ kind: "gameTitle", title: "Requested title" }] },
          { id: "keep", title: "Preserve map", required: true, criteria: [{ kind: "preserve", target: { mapId: project.startMapId } }] },
        ],
        layers: [{ title: "Author", items: [{ id: "title-work", title: "Title", instruction: requestText, successTools: ["set_title_screen"] }] }],
      }));
    }
    order.push("authoring");
    switch (authorRound++) {
      case 0: return call("get_original_context", { snapshotId: "original-1", action: "read", entryId: "/project" });
      case 1: return call("review_acceptance", { itemId: "title", verdict: "pass" });
      case 2: return call("repair_acceptance", { itemId: "title", criteria: [{ kind: "gameTitle", title: "Before authoring" }] });
      case 3: return call("set_title_screen", { title: "Requested title" });
      default: return response("AUTHORING_RESULT");
    }
  });
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "auto", model: "test", liteModel: "test", maxToolCalls: 8 },
    declareIntent, chat: authored, contextOptions: { currentMapId: project.startMapId },
    prepareProjectWiki: async input => {
      const outcome = await coordinator.prepare({ ...input, onDelivery: milestone => {
        deliveries.push(milestone.kind); input.onDelivery?.(milestone);
      } });
      outcomes.push(outcome);
      return outcome;
    },
  });
  const scope = null;
  const run = (caller?: AbortSignal) => {
    const signal = caller ? AbortSignal.any([caller, cancellation.signal]) : cancellation.signal;
    const pending = session.sendUserMessage(requestText, event => events.push(event), signal, { scope, goalAction: "new-goal" });
    turns.push(pending);
    return pending;
  };
  const unchanged = () => {
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toEqual(historyBefore);
    expect(peekPreviousProject()).toEqual(previousBefore);
    expect(session.baselineProject).toEqual(before);
    expect(session.getProposedProject().world).toEqual(before.world);
    expect(history).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    expect(deliveries).toEqual([]);
  };
  return { before, project, scope, session, coordinator, order, chat, authored, declareIntent, flush, history,
    outcomes, deliveries, events, started, aborted, transport, settled, extracted, deadline, timeout, run, unchanged, dispose, expireExtraction };
}
function patch(request: ChatRequest, change: Record<string, unknown> = {}) {
  const payload = JSON.parse(String(request.messages.find(message => message.role === "user")!.content));
  return JSON.stringify({ upserts: [{ id: "w_new", type: "concept", name: "Archive rule", summary: "New fact",
    wiki: { kind: "knowledge", basis: "explicit", topic: "archive", sourceIds: [payload.sources[0].id] }, ...change }] });
}
afterEach(async () => {
  let timer: ReturnType<typeof setDrainTimeout> | undefined;
  try {
    const results = await Promise.race([
      Promise.allSettled(disposals.splice(0).map(dispose => dispose())),
      new Promise<never>((_, reject) => { timer = setDrainTimeout(() => reject(new Error("Wiki fixture disposal did not settle")), 5_000); }),
    ]);
    const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    if (failures.length) throw new AggregateError(failures, "Wiki fixture disposal failed");
  } finally { clearDrainTimeout(timer); }
  // Never restore shared globals while an owned operation is still running.
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});

describe("own extraction timeout through the normal user-turn boundary", () => {
  it.for(["valid", "malformed", "rejected"])("defers, initializes original authoring and rejects late %s settlement", async (late, context) => {
    const h = fixture(context.signal);
    const pending = h.run();
    const request = await h.started.promise;
    expect(h.timeout).toHaveBeenCalledExactlyOnceWith(45_000);
    expect(h.declareIntent).not.toHaveBeenCalled();
    expect(request.disableTransientRetry).toBe(true);
    const payload = JSON.parse(String(request.messages.find(message => message.role === "user")!.content));
    expect(payload.userText).toBe(requestText);
    expect(payload.sources).toEqual([expect.objectContaining({ kind: "user", text: requestText })]);
    h.expireExtraction();
    expect(await h.aborted.promise).toBe(h.deadline.signal.reason);
    const result = await pending;
    expect(h.outcomes).toEqual([{ kind: "deferred", reason: "extraction-timeout" }]);
    expect(h.events.filter(event => event.type === "status" && event.text.startsWith("wiki:deferred extraction-timeout"))).toHaveLength(1);
    expect(h.session.canRetryLastTurn()).toBe(false);
    expect(h.order.slice(0, 4)).toEqual(["extraction", "intent", "planner", "authoring"]);
    expect(h.session.getWorkPlan()?.goal).toBe(requestText);
    expect(h.session.getAcceptanceSnapshot()?.items).toMatchObject([
      { id: "title", required: true, source: { requestId: "request-1", text: requestText, scope: h.scope } },
      { id: "keep", required: true, source: { requestId: "request-1", text: requestText, scope: h.scope } },
    ]);
    const original = h.events.find(event => event.type === "tool_call" && event.name === "get_original_context");
    expect(original).toMatchObject({ result: { ok: true, data: { snapshotId: "original-1", entryId: "/project" } } });
    if (original?.type !== "tool_call" || !original.result.ok) throw new Error("Missing original read");
    expect(JSON.parse((original.result.data as { text: string }).text).meta).toEqual(h.before.meta);
    expect(h.events.find(event => event.type === "tool_call" && event.name === "review_acceptance")).toMatchObject({ result: { ok: false } });
    expect(h.events.find(event => event.type === "tool_call" && event.name === "repair_acceptance")).toMatchObject({ result: { ok: false, data: { code: "immutable-valid" } } });
    expect(h.events.find(event => event.type === "tool_call" && event.name === "set_title_screen")).toMatchObject({ result: { ok: true } });
    expect(result.proposedCalls.map(call => call.name)).toContain("set_title_screen");
    expect(result.appliedCalls).toEqual([]);
    expect(h.session.getProposedProject().system.titleScreen?.title).toBe("Requested title");
    h.unchanged();
    // Observe the losing transport's exact settlement, not a delay or polling window.
    if (late === "rejected") h.transport.reject(new Error("Late provider failure"));
    else h.transport.resolve(response(late === "valid" ? patch(request) : "not JSON"));
    await h.settled.promise;
    await h.extracted.promise;
    h.unchanged();
    expect(h.chat).toHaveBeenCalledTimes(1);
  });

  it.for(["test-abort", "early-exit"])("drains owned operations before reset on %s", async (exit, context) => {
    const lifecycle = new AbortController();
    const h = fixture(AbortSignal.any([context.signal, lifecycle.signal]));
    const pending = h.run();
    const request = await h.started.promise;
    const completed = { turn: false, extraction: false, transport: false };
    void pending.then(() => { completed.turn = true; });
    void h.extracted.promise.then(() => { completed.extraction = true; });
    void h.settled.promise.then(() => { completed.transport = true; });
    const failure = new Error("Simulated test failure");
    if (exit === "test-abort") {
      lifecycle.abort(failure); // Same signal path Vitest aborts on test-budget expiry.
      expect(await h.aborted.promise).toBe(failure);
      await h.dispose();
    } else {
      await expect((async () => {
        try { throw failure; } // Early assertion/exception before scripted settlement.
        finally { await h.dispose(); }
      })()).rejects.toBe(failure);
    }
    expect(completed).toEqual({ turn: true, extraction: true, transport: true });
    expect((await pending).stoppedReason).toBe("aborted");
    expect(h.authored).not.toHaveBeenCalled();
    h.unchanged();
    h.transport.resolve(response(patch(request))); // Cannot resurrect disposed work.
    h.unchanged();
  });

  it("drains a turn cancelled before extraction starts", async context => {
    const h = fixture(context.signal);
    const pending = h.run();
    await h.dispose();
    expect((await pending).stoppedReason).toBe("aborted");
    expect(h.chat).not.toHaveBeenCalled();
    expect(h.authored).not.toHaveBeenCalled();
    h.unchanged();
  });

  it.for(["caller", "caller-timeout", "both", "deadline-then-caller", "identity"])("does not defer %s invalidation", async (invalidation, context) => {
    const identity = { value: "project/scope-1" };
    const h = fixture(context.signal, { getIdentity: () => identity.value });
    const caller = new AbortController();
    const pending = h.run(caller.signal);
    await h.started.promise;
    if (invalidation === "identity") identity.value = "project/scope-2";
    else if (invalidation === "deadline-then-caller") void h.aborted.promise.then(() => caller.abort());
    else caller.abort(invalidation === "caller-timeout" ? new DOMException("Caller deadline", "TimeoutError") : undefined);
    if (["identity", "both", "deadline-then-caller"].includes(invalidation)) h.expireExtraction();
    await h.aborted.promise;
    const result = await pending;
    expect(result.stoppedReason).toBe(invalidation === "identity" ? "error" : "aborted");
    expect(h.outcomes).toEqual([]);
    expect(h.declareIntent).not.toHaveBeenCalled();
    expect(h.authored).not.toHaveBeenCalled();
    h.unchanged();
    h.transport.resolve(response('{"upserts":[]}'));
    await h.settled.promise;
    h.unchanged();
  });

  it.for(["world-edit", "map-removed", "no-wiki", "backfill"])("does not defer an ineligible %s checkpoint", async (change, context) => {
    const h = fixture(context.signal, change === "no-wiki" ? { history: async () => [] } : {});
    if (change === "no-wiki" || change === "backfill") store.update(project => { delete project.world; });
    const pending = h.run();
    await h.started.promise;
    if (change === "world-edit") store.update(project => {
      project.world = { ...project.world!, entities: project.world!.entities.map(entity => entity.id === "w_current" ? { ...entity, locked: true } : entity) };
    });
    if (change === "map-removed") store.update(project => { delete project.maps[project.startMapId]; });
    const beforeTimeout = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    h.expireExtraction();
    await h.aborted.promise;
    expect((await pending).stoppedReason).toBe("error");
    expect(h.outcomes).toEqual([]);
    expect(h.authored).not.toHaveBeenCalled();
    expect(h.deliveries).toEqual([]);
    expect(h.flush).not.toHaveBeenCalled();
    h.transport.resolve(response('{"upserts":[]}'));
    await h.settled.promise;
    expect(store.getCurrent()).toEqual(beforeTimeout);
    expect(getMapEditHistoryEntries()).toEqual(history);
  });

  it.for(["edit", "replacement"])("rejects same-ID map %s and its late patch", async (change, context) => {
    const h = fixture(context.signal);
    const pending = h.run();
    const request = await h.started.promise;
    const mapId = h.project.startMapId;
    store.update(project => {
      const map = project.maps[mapId];
      if (change === "edit") map.name = "Edited while extracting";
      else project.maps[mapId] = { ...map, encounterRate: (map.encounterRate ?? 0) + 1 };
    });
    const current = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    h.expireExtraction();
    await h.aborted.promise;
    const result = await pending;
    h.transport.resolve(response(patch(request)));
    await h.settled.promise;
    await h.extracted.promise;
    expect(result.stoppedReason).toBe("error");
    expect(h.outcomes).toEqual([]);
    expect(h.declareIntent).not.toHaveBeenCalled();
    expect(h.authored).not.toHaveBeenCalled();
    expect(h.deliveries).toEqual([]);
    expect(h.flush).not.toHaveBeenCalled();
    expect(store.getCurrent()).toEqual(current);
    expect(getMapEditHistoryEntries()).toEqual(history);
    expect(h.session.baselineProject).toEqual(h.before);
    expect(h.session.getProposedProject()).toEqual(h.before);
  });

  it.for(["unknown-timeout", "network", "malformed", "protected", "supersession", "concurrent", "save"])("keeps %s errors fatal", async (failure, context) => {
    const h = fixture(context.signal, failure === "save" ? { flush: async () => { throw new Error("Persistence failure"); } } : {});
    const pending = h.run();
    const request = await h.started.promise;
    if (failure === "unknown-timeout") h.transport.reject(new DOMException("Unknown deadline", "TimeoutError"));
    else if (failure === "network") h.transport.reject(new Error("Provider failure"));
    else if (failure === "malformed") h.transport.resolve(response("not JSON"));
    else if (failure === "protected") h.transport.resolve(response(patch(request, { id: "w_manual" })));
    else if (failure === "supersession") {
      const payload = JSON.parse(patch(request));
      payload.upserts[0].wiki.supersedes = ["w_current"];
      h.transport.resolve(response(JSON.stringify(payload)));
    } else if (failure === "concurrent") {
      const payload = JSON.parse(patch(request));
      payload.upserts[0].wiki.topic = "moon";
      store.update(project => {
        project.world = { ...project.world!, entities: project.world!.entities.map(entity => entity.id === "w_current" ? { ...entity, locked: true } : entity) };
      });
      h.transport.resolve(response(JSON.stringify(payload)));
    } else h.transport.resolve(response(patch(request)));
    const result = await pending;
    expect(result.stoppedReason).toBe("error");
    expect(h.outcomes).toEqual([]);
    expect(h.declareIntent).not.toHaveBeenCalled();
    expect(h.authored).not.toHaveBeenCalled();
    if (failure === "save") {
      expect(h.deliveries).toEqual(["applied"]);
      expect(result.runOutcome?.delivery).toBe("applied");
    } else if (failure !== "concurrent") h.unchanged();
    else {
      expect(store.getCurrent().world?.entities).toHaveLength(3);
      expect(store.getCurrent().world?.entities[1].locked).toBe(true);
      expect(h.deliveries).toEqual([]);
      expect(h.flush).not.toHaveBeenCalled();
    }
  });

  it("applies a timely valid patch and awaits persistence before ordinary authoring", async context => {
    const h = fixture(context.signal);
    const pending = h.run();
    const request = await h.started.promise;
    h.transport.resolve(response(patch(request)));
    const result = await pending;
    expect(h.order.slice(0, 5)).toEqual(["extraction", "saved-local", "intent", "planner", "authoring"]);
    expect(h.outcomes).toEqual([store.getCurrent().world]);
    expect(h.deliveries).toEqual(["applied"]);
    expect(result.runOutcome?.delivery).toBe("draft"); // Detached authoring still needs application; local wiki save is not remote persistence.
    expect(store.getCurrent().world?.entities).toHaveLength(4);
    expect(store.getCurrent().world?.entities.slice(0, 3)).toEqual(h.before.world!.entities);
    expect(h.session.baselineProject.world).toEqual(store.getCurrent().world);
    expect(h.session.getProposedProject().world).toEqual(store.getCurrent().world);
    expect(h.flush).toHaveBeenCalledTimes(1);
    expect(h.chat).toHaveBeenCalledTimes(1);
    expect(peekPreviousProject()).toEqual(h.before); // Identical before-snapshots are coalesced by real history.
  });
});
