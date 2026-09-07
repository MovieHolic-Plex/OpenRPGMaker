import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTimeout as clearDeadline, setTimeout as setDeadline } from "node:timers";
import type { Project } from "@/project/types";
import type { ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type RunEndProofState, type SessionEvent } from "@/ai/assistantSession";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import type { NpcRewardRequirements } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { isPassable } from "@/project/collision";

const projectId = "p1-session-proof-fixture";
type Row = { project_id: string; current_json: Project; current_sha256: string };
const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const plan = {
  goal: "Set the title", layers: [{ title: "Title", items: [{
    title: "Title", instruction: "set_title_screen", successTools: ["set_title_screen"],
  }] }],
};
const terminalExecution = (events: readonly SessionEvent[]) => events.filter((event): event is Extract<SessionEvent, { type: "run_state" }> => event.type === "run_state").at(-1)?.execution;
const toolAudit = (session: AssistantSession) => session.getAuditEntries().filter(entry => entry.kind === "tool");

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function createProofScope(parent?: AbortSignal) {
  const lifecycle = new AbortController();
  const errors = new Set<unknown>();
  const operations = new Set<{ stop: () => Promise<void> }>();
  const waits = new Set<Promise<unknown>>();
  const deadlines = new Set<ReturnType<typeof setDeadline>>();
  const parentAbort = () => lifecycle.abort(parent!.reason);
  parent?.addEventListener("abort", parentAbort, { once: true });
  if (parent?.aborted) parentAbort();
  const unexpected = (error: unknown) => !(lifecycle.signal.aborted && error === lifecycle.signal.reason);
  let closing: Promise<void> | undefined;
  return {
    signal: lifecycle.signal,
    operationCount: () => operations.size,
    deadlineCount: () => deadlines.size,
    run<T>(start: (signal: AbortSignal) => Promise<T>, release: () => void, controller = new AbortController()) {
      lifecycle.signal.throwIfAborted();
      const abort = () => controller.abort(lifecycle.signal.reason);
      lifecycle.signal.addEventListener("abort", abort, { once: true });
      // The actual API starts immediately; no transport cancellation behavior is mocked away.
      const running = (async () => start(controller.signal))().then(value => {
        lifecycle.signal.throwIfAborted();
        return value;
      });
      const settled = running.then(() => undefined, error => { if (unexpected(error)) errors.add(error); });
      let stopping: Promise<void> | undefined;
      const operation = { stop: (): Promise<void> => stopping ??= (async () => {
        controller.abort();
        try { release(); } catch (error) { errors.add(error); }
        await settled;
        lifecycle.signal.removeEventListener("abort", abort);
        operations.delete(operation);
      })() };
      operations.add(operation);
      return { running, stop: operation.stop };
    },
    wait(signal: Promise<void>, operation?: Promise<unknown>): Promise<void> {
      lifecycle.signal.throwIfAborted();
      let deadline: ReturnType<typeof setDeadline> | undefined;
      let abort!: () => void;
      const cancellation = new Promise<never>((_resolve, reject) => {
        abort = () => reject(lifecycle.signal.reason);
        lifecycle.signal.addEventListener("abort", abort, { once: true });
        deadline = setDeadline(() => reject(new Error("Transport did not reach the subscribed boundary")), 30_000);
        deadlines.add(deadline);
      });
      const waiting = Promise.race([signal, cancellation, ...(operation ? [operation.then(() => {
        throw new Error("Operation settled before the subscribed boundary");
      })] : [])]).finally(() => {
        clearDeadline(deadline); deadlines.delete(deadline!);
        lifecycle.signal.removeEventListener("abort", abort);
      });
      waits.add(waiting);
      void waiting.then(() => waits.delete(waiting), error => {
        waits.delete(waiting); if (unexpected(error)) errors.add(error);
      });
      return waiting;
    },
    close(): Promise<void> {
      return closing ??= (async () => {
        lifecycle.abort(new Error("Proof fixture ended"));
        const results = await Promise.allSettled([...operations].map(operation => operation.stop()).concat([...waits].map(wait => wait.then(() => undefined))));
        for (const result of results) if (result.status === "rejected" && unexpected(result.reason)) errors.add(result.reason);
        parent?.removeEventListener("abort", parentAbort);
        if (errors.size) throw new AggregateError([...errors], "Proof fixture operation or cleanup failed");
      })();
    },
  };
}
let proofScope: ReturnType<typeof createProofScope>;
const waitForSignal = (signal: Promise<void>, operation?: Promise<unknown>) => proofScope.wait(signal, operation);

async function fixture(withPlan = true, autonomous = withPlan, withNpc = false, withExactCheck = false) {
  let row: Row | undefined;
  let read: ((url: URL) => Promise<Response>) | undefined;
  let write: (() => Promise<void>) | undefined;
  const requests: { path: string; method: string }[] = [];
  const commits: string[] = [];
  const commitAuthors: { id: string; kind: string }[] = [];
  let commitResponse: (() => Promise<Response>) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input)), path = url.pathname;
    const method = init?.method ?? "GET";
    requests.push({ path, method });
    if (path === "/rest/v1/projects") {
      if (method !== "GET") {
        if (write) await write();
        row = JSON.parse(String(init?.body));
        return Response.json(method === "PATCH" ? [row] : []);
      }
      return read ? read(url) : Response.json(row ? [row] : []);
    }
    if (path === "/rest/v1/project_commits" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      commits.push(body[0].commit_id);
      commitAuthors.push({ id: body[0].commit_id, kind: body[0].author_kind });
      if (commitResponse) return commitResponse();
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  // Adapt the store-proof fixture shape: one walkable map/tileset, full database and resources.
  // Bundled tileset authoring catalogs are not part of receipt/retry behavior under test.
  const map = project.maps[project.startMapId]!;
  const image = project.tilesets[map.tilesetId]!.image;
  map.tilesetId = "proof-tileset"; map.lowerTiles.fill(0);
  project.tilesets = { [map.tilesetId]: { id: map.tilesetId, name: "Proof tileset", image, kind: "custom",
    tileSize: map.tileSize, tilesPerRow: 1, count: 1, passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0] } };
  expect(isPassable(project, map, project.startPos.x, project.startPos.y)).toBe(true);
  const npcRewards: NpcRewardRequirements | undefined = withNpc ? [{ target: { eventId: "proof_reward" }, grants: [{ kind: "item", id: "item_potion", count: 2 }] }] : undefined;
  if (withNpc) project.maps[project.startMapId]!.events = [{ id: "proof_reward", name: "Reward", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [{
    id: "grant", name: "Reward", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 }],
  }] }];
  store.replace(project);
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let wrote = false;
  let checked = false;
  let failFinal = false;
  let answerOnly = false;
  let chatCalls = 0;
  const titleInstruction = 'Set title to "accepted-session-title"';
  const instruction = titleInstruction + (withNpc ? "; verify the reward NPC" : "");
  const requestRequirements = { entries: [{ source: [{ start: 0, end: titleInstruction.length, quote: titleInstruction }], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "accepted-session-title" }], bindings: [{ source: { start: titleInstruction.indexOf('"'), end: titleInstruction.length, quote: '"accepted-session-title"' }, role: "value", criterionIndex: 0, fieldPath: ["value"] }] },
    ...(withNpc ? [{ source: [{ start: titleInstruction.length + 2, end: instruction.length, quote: "verify the reward NPC" }], criteria: [{ kind: "entityCount", collection: { kind: "events", mapId: project.startMapId }, selector: { ids: ["proof_reward"] }, count: 1, comparison: "eq", basis: "current" }], bindings: [] }] : []),
  ] };
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: withPlan ? "auto" : "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    declareIntent: facts => fixedDeclarer(answerOnly ? { mode: "question" } : { mode: "modify", needsPlan: withPlan, requestRequirements, npcRewards })(facts),
    yieldToUi: async () => {},
    chat: async (_config, request) => {
      chatCalls += 1;
      if (wrote && failFinal) { failFinal = false; wrote = false; throw Object.assign(new Error("scripted-final-failure"), { name: "LlmError", status: 401 }); }
      if (!request.tools?.length) return final(JSON.stringify(wrote ? { action: "resume" } : { action: "new_plan", ...plan,
        ...(withExactCheck ? { requirements: [{ id: "exact-lint", title: "Current lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }] } : {}),
      }));
      if (wrote && withExactCheck && !checked) {
        checked = true;
        return { message: { role: "assistant", content: null, tool_calls: [{ id: "lint", type: "function", function: { name: "run_lint", arguments: "{}" } }] }, finishReason: "tool_calls" };
      }
      if (wrote) return final("Finished.");
      wrote = true;
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: failFinal ? "pending-session-title" : "accepted-session-title" }),
      } }] }, finishReason: "tool_calls" };
    },
  });
  // Call through to the public APIs, adding only the test-lifecycle cancellation boundary.
  const tracked = <T>(start: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) =>
    proofScope.run(lifecycle => start(signal ? AbortSignal.any([signal, lifecycle]) : lifecycle), () => {}).running;
  const prove = (...args: Parameters<typeof session.proveAppliedRevision>) => tracked(signal => session.proveAppliedRevision(args[0], signal, args[2]), args[1]);
  const retry = (...args: Parameters<typeof session.retryLastTurn>) => tracked(signal => session.retryLastTurn(args[0], signal), args[1]);
  const send = (...args: Parameters<typeof session.sendUserMessage>) => tracked(signal => session.sendUserMessage(args[0], args[1], signal, args[3]), args[2]);
  return {
    store, session, requests, commits, commitAuthors, npcRewards, prove, retry, send,
    failFinal: () => { failFinal = true; },
    answerOnly: () => { answerOnly = true; },
    chatCalls: () => chatCalls,
    setRead: (next: (url: URL) => Promise<Response>) => { read = next; },
    setWrite: (next: () => Promise<void>) => { write = next; },
    setCommit: (next: () => Promise<Response>) => { commitResponse = next; },
    row: () => { if (!row) throw new Error("No saved row"); return row; },
    run: (onEvent: Parameters<typeof session.sendUserMessage>[1] = () => {}, signal?: AbortSignal) =>
      send(instruction, onEvent, signal, { autonomous }),
    savedAudits: () => session.getAuditEntries().filter((entry) => entry.kind === "status" && entry.text.split(" ")[0] === "agent_run_saved"),
  };
}

describe("AssistantSession accepted-revision proof", () => {
  beforeEach(({ signal }) => {
    proofScope = createProofScope(signal);
    vi.useFakeTimers(); // Disable unrelated autosave; no timer advancement synchronizes the test.
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", "http://p1-session.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId);
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    });
  });
  afterEach(async () => {
    try {
      // Vitest runs afterEach before onTestFinished: drain while this fixture's globals still exist.
      await proofScope.close();
      expect(proofScope.operationCount()).toBe(0); expect(proofScope.deadlineCount()).toBe(0);
    } finally {
      vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    }
  });

  it.each(["before", "after"] as const)("fixture cleanup aborts/releases/awaits %s the read boundary", async boundary => {
    const f = await fixture();
    const entered = deferred<void>(), response = deferred<Response>();
    let reached = false, released = 0;
    f.setRead(() => { reached = true; entered.resolve(); return response.promise; });
    const { running } = proofScope.run(signal => f.session.proveAppliedRevision(undefined, signal), () => {
      released++; response.resolve(Response.json([]));
    });
    const waiting = waitForSignal(entered.promise, running);
    try {
      if (boundary === "after") await waiting;
      const closing = proofScope.close();
      expect(released).toBe(1);
      await closing;
      if (boundary === "before") await expect(waiting).rejects.toBe(proofScope.signal.reason);
      await expect(running).rejects.toBe(proofScope.signal.reason);
      expect(reached).toBe(boundary === "after");
      expect(proofScope.operationCount()).toBe(0); expect(proofScope.deadlineCount()).toBe(0);
      expect(f.session.getRunEndProof()).toMatchObject({ status: "failed", verified: false, reason: "cancelled" });
      expect(f.savedAudits()).toHaveLength(0);
      expect(f.requests.filter(request => request.method === "GET" && request.path === "/rest/v1/projects")).toHaveLength(boundary === "after" ? 1 : 0);
    } finally { response.resolve(Response.json([])); await proofScope.close(); }
  });

  it("fixture lifecycle cancellation rejects an unreached wait and clears its real deadline", async () => {
    const parent = new AbortController(), scope = createProofScope(parent.signal);
    const entered = deferred<void>(), reason = new Error("Simulated test lifecycle cancellation");
    const waiting = scope.wait(entered.promise);
    expect(scope.deadlineCount()).toBe(1);
    parent.abort(reason);
    await expect(waiting).rejects.toBe(reason);
    await scope.close();
    expect(scope.deadlineCount()).toBe(0);
  });

  it("fixture cleanup propagates unexpected operation errors", async () => {
    const scope = createProofScope(), failure = new Error("Unexpected fixture operation failure");
    const { running } = scope.run(async () => { throw failure; }, () => {});
    await expect(running).rejects.toBe(failure);
    await expect(scope.close()).rejects.toMatchObject({ errors: [failure] });
    expect(scope.operationCount()).toBe(0); expect(scope.deadlineCount()).toBe(0);
  });

  it("projects initialized proof events and rechecks freshness after the final status subscriber", async () => {
    const f = await fixture();
    expect(f.session.getRunEndProof()).toBeNull();
    expect(f.session.getHarnessSnapshot().runEndProof).toBeNull();
    const states: RunEndProofState[] = [];
    const result = await f.prove((event) => {
      if (event.type === "persistence_proof") {
        expect(f.session.getRunEndProof()).toEqual(event.state);
        states.push(event.state);
      } else if (event.type === "status" && states.at(-1)?.status === "succeeded") {
        f.store.update((draft) => { draft.meta.title = "subscriber-edit"; });
      }
    });
    expect(states.map(({ status, verified }) => ({ status, verified }))).toEqual([
      { status: "attempted", verified: false },
      { status: "attempted", verified: false },
      { status: "succeeded", verified: true },
    ]);
    expect(result).toMatchObject({ status: "succeeded", verified: false });
    expect(f.session.getRunEndProof()).toEqual(result);
    expect(f.session.getHarnessSnapshot().runEndProof).toEqual(result);
    expect(f.store.getCurrent().meta.title).toBe("subscriber-edit");
  });

  it.each(["edit", "cancel"] as const)("rechecks %s from a synchronous proof subscriber", async (action) => {
    const f = await fixture();
    const controller = new AbortController();
    const result = await f.prove((event) => {
      if (event.type !== "persistence_proof" || event.state.status !== "succeeded") return;
      if (action === "cancel") controller.abort();
      else f.store.update((draft) => { draft.meta.title = "proof-subscriber-edit"; });
    }, controller.signal);
    expect(result).toMatchObject({ status: "failed", verified: false, reason: action === "cancel" ? "cancelled" : "stale" });
    expect(f.session.getRunEndProof()).toEqual(result);
    expect(f.savedAudits()).toHaveLength(0);
  });

  it("does not publish success after a proof subscriber starts a cancelled proof", async () => {
    const f = await fixture();
    const controller = new AbortController();
    controller.abort();
    let nested: Promise<RunEndProofState> | undefined;
    const result = await f.prove((event) => {
      if (event.type === "persistence_proof" && event.state.status === "succeeded" && !nested) {
        nested = f.prove(() => {}, controller.signal);
      }
    });
    expect(nested).toBeDefined();
    expect(await nested).toMatchObject({ status: "failed", verified: false, reason: "cancelled" });
    expect(result).toEqual(await nested);
    expect(f.session.getRunEndProof()).toEqual(result);
    expect(f.savedAudits()).toHaveLength(0);
  });

  it("returns the latest emitted state when a status subscriber starts a cancelled proof", async () => {
    const f = await fixture();
    const controller = new AbortController();
    controller.abort();
    let nested: Promise<RunEndProofState> | undefined;
    const result = await f.prove((event) => {
      if (event.type === "status") nested = f.prove(() => {}, controller.signal);
    });
    expect(nested).toBeDefined();
    expect(await nested).toMatchObject({ status: "failed", verified: false, reason: "cancelled" });
    expect(result).toEqual(await nested);
    expect(f.session.getRunEndProof()).toEqual(result);
    // This callback runs after a legitimately published success audit.
    expect(f.savedAudits()).toHaveLength(1);
  });

  it.each(["initial", "receipt", "failure", "success-throw"])("preserves cancellation superseding the %s callback", async (boundary) => {
    const f = await fixture();
    const controller = new AbortController();
    controller.abort();
    if (boundary === "failure") f.setRead(async () => new Response("unavailable", { status: 503 }));
    let nested: Promise<RunEndProofState> | undefined;
    const result = await f.prove((event) => {
      if (event.type !== "persistence_proof" || nested) return;
      const matches = boundary === "initial" ? event.state.status === "attempted" && !event.state.receipt
        : boundary === "receipt" ? event.state.status === "attempted" && !!event.state.receipt
        : event.state.status === (boundary === "failure" ? "failed" : "succeeded");
      if (!matches) return;
      nested = f.prove(() => {}, controller.signal);
      if (boundary === "success-throw") throw new Error("superseded subscriber failed");
    });
    expect(nested).toBeDefined();
    expect(await nested).toMatchObject({ status: "failed", verified: false, reason: "cancelled" });
    expect(result).toEqual(await nested);
    expect(f.session.getRunEndProof()).toEqual(result);
    expect(f.savedAudits()).toHaveLength(0);
    expect(f.session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => entry.text.split(" ")[0]))
      .toEqual(["agent_run:proof-failed"]);
    if (boundary === "initial") expect(f.requests).toHaveLength(0);
    if (boundary === "receipt") expect(f.requests.filter((r) => r.method === "GET")).toHaveLength(0);
  });

  it("does not resume publication after a pending flush is superseded", async () => {
    const f = await fixture();
    const started = deferred<void>();
    const release = deferred<void>();
    f.setWrite(() => { started.resolve(); return release.promise; });
    const { running: outer, stop } = proofScope.run(signal => f.session.proveAppliedRevision(undefined, signal), () => release.resolve());
    try {
      await waitForSignal(started.promise, outer);
      const controller = new AbortController();
      controller.abort();
      const nested = await f.prove(() => {}, controller.signal);
      expect(nested).toMatchObject({ status: "failed", reason: "cancelled", verified: false });
      release.resolve();
      expect(await outer).toEqual(nested);
      expect(f.session.getRunEndProof()).toEqual(nested);
      expect(f.requests.filter((r) => r.method === "GET")).toHaveLength(0);
      expect(f.savedAudits()).toHaveLength(0);
    } finally {
      await stop();
    }
  }, 60_000);

  it.each([
    { newer: "cancelled", older: "verified" },
    { newer: "cancelled", older: "mismatch" },
    { newer: "succeeded", older: "verified" },
    { newer: "succeeded", older: "mismatch" },
    { newer: "succeeded", older: "cancelled" },
  ])("keeps newer $newer proof when an overlapping read ends $older", async ({ newer, older }) => {
    const f = await fixture();
    const started = deferred<void>();
    const reply = deferred<Response>();
    const controller = new AbortController();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const { running: outer, stop } = proofScope.run(signal => f.session.proveAppliedRevision(() => {}, signal), () => reply.resolve(Response.json([])), controller);
    try {
      await waitForSignal(started.promise, outer);
      const row = structuredClone(f.row());
      f.setRead(async () => Response.json([f.row()]));
      const nextController = new AbortController();
      if (newer === "cancelled") nextController.abort();
      const nested = await f.prove(() => {}, nextController.signal);
      expect(nested).toMatchObject({ status: newer === "cancelled" ? "failed" : "succeeded", verified: newer === "succeeded" });
      if (older === "cancelled") controller.abort();
      if (older === "mismatch") row.current_json.meta.title = "old-read-mismatch";
      reply.resolve(Response.json([row]));
      expect(await outer).toEqual(nested);
      expect(f.session.getRunEndProof()).toEqual(nested);
      expect(f.savedAudits()).toHaveLength(newer === "succeeded" ? 1 : 0);
      expect(f.session.getAuditEntries().filter((entry) => entry.kind === "status")).toHaveLength(1);
    } finally {
      await stop();
    }
  }, 60_000);

  it("does not claim verified after a failed proof read through actual session completion", async () => {
    const f = await fixture();
    f.setRead(async () => new Response("unavailable", { status: 503 }));
    const result = await f.run();
    expect(result.appliedCalls?.map((call) => call.name)).toEqual(["set_title_screen"]);
    expect(f.session.getHarnessSnapshot().workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(f.requests.filter((r) => r.path === "/rest/v1/projects" && r.method === "GET")).toHaveLength(1);
    expect(f.savedAudits()).toHaveLength(0);
    expect(f.session.getRunEndProof()).toMatchObject({ status: "failed", verified: false, reason: "failed" });
  }, 60_000);

  it("retries failed proof for the same plan/revision, deduplicates success, and reproves a changed revision", async () => {
    const f = await fixture();
    f.setRead(async () => new Response("unavailable", { status: 503 }));
    await f.run();
    const receipt = f.session.getRunEndProof()?.receipt;
    expect(receipt?.projectId).toBe(projectId);
    f.setRead(async () => Response.json([f.row()]));
    // The user completion entry point, not a private proof method, retries the completed plan.
    await f.run();
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, receipt });
    expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
    expect(f.requests.filter((r) => r.path === "/rest/v1/projects" && r.method === "GET")).toHaveLength(2);
    expect(f.requests.filter((r) => r.path === "/rest/v1/projects" && r.method !== "GET")).toHaveLength(1);
    const requests = f.requests.length;
    await f.prove();
    expect(f.requests).toHaveLength(requests);
    f.store.update((draft) => { draft.meta.title = "new-revision"; });
    expect(f.session.getRunEndProof()?.verified).toBe(false);
    const next = await f.prove();
    expect(next).toMatchObject({ status: "succeeded", verified: true, commitId: null });
    expect(next.receipt?.revisionId).not.toBe(receipt?.revisionId);
    expect(f.savedAudits()).toHaveLength(2);
  });

  it.each(["cancelled", "disabled", "target", "content", "local-edit"] as const)("does not promote %s during the read or replace editor state", async (failure) => {
    const f = await fixture();
    const controller = new AbortController();
    const started = deferred<void>();
    const reply = deferred<Response>();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const reload = vi.spyOn(f.store, "reloadFromRemote");
    const { running, stop } = proofScope.run(signal => f.run(event => {
      // A human edit revokes the title predicate. The intentionally final-only
      // provider cannot repair it; stop on recovery rather than a removed cap.
      if (failure === "local-edit" && event.type === "run_state" && event.execution.state === "recovering") controller.abort();
    }, signal), () => reply.resolve(Response.json([])), controller);
    try {
      await waitForSignal(started.promise, running);
      expect(f.session.getRunEndProof()).toMatchObject({ status: "attempted", verified: false });
      const row = structuredClone(f.row());
      if (failure === "cancelled") controller.abort();
      if (failure === "disabled") f.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      if (failure === "target") row.project_id = "other-project";
      if (failure === "content") row.current_json.meta.title = "other-content";
      if (failure === "local-edit") f.store.update((draft) => { draft.meta.title = "human-edit"; });
      const live = f.store.getCurrent();
      reply.resolve(Response.json([row]));
      await running;
      expect(f.savedAudits()).toHaveLength(0);
      expect(f.session.getRunEndProof()).toMatchObject({ status: "failed", verified: false,
        reason: failure === "local-edit" ? "stale" : failure === "target" || failure === "content" ? `mismatch-${failure}` : failure });
      expect(f.store.getCurrent()).toBe(live);
      expect(reload).not.toHaveBeenCalled();
      if (failure === "local-edit") {
        expect(f.store.getCurrent().meta.title).toBe("human-edit");
        expect(f.store.hasUnsavedChanges()).toBe(true);
        expect(f.session.getRunEndProof()?.proof).toMatchObject({ kind: "verified", isCurrent: false });
      }
    } finally { await stop(); }
  });

  it("uses the real apply commit, not a newest remote commit read", async () => {
    const f = await fixture();
    await f.run();
    const proof = f.session.getRunEndProof();
    expect(proof).toMatchObject({ status: "succeeded", verified: true, commitId: f.commits[0] });
    expect(proof?.commitId).toMatch(/^[a-f0-9-]{36}$/);
    expect(f.requests.filter((r) => r.path === "/rest/v1/project_commits" && r.method === "GET")).toHaveLength(0);
  });

  it("project proof can succeed when the separate commit log fails", async () => {
    const f = await fixture();
    f.setCommit(async () => new Response("unavailable", { status: 503 }));
    await f.run();
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, commitId: null });
    expect(f.savedAudits()).toHaveLength(1);
  });

  it("proves a normal no-plan apply through the reusable path without replaying the tool", async () => {
    const f = await fixture(false);
    const result = await f.run();
    expect(f.session.getHarnessSnapshot().workPlan).toBeNull();
    expect(f.session.getRunEndProof()).toBeNull();
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    const { applyProposedProject } = await import("@/editor/tools/applyChangesetToStore");
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied);
    f.session.rebaseProject(f.store.getCurrent());
    expect(await f.prove()).toMatchObject({ status: "succeeded", verified: true, commitId: applied.commit.commitId });
    expect(f.commits).toHaveLength(1);
  });

  it("does not correlate a later human edit with an in-flight apply commit", async () => {
    const f = await fixture(false);
    await f.run();
    const started = deferred<void>();
    const reply = deferred<Response>();
    f.setCommit(() => { started.resolve(); return reply.promise; });
    const { applyProposedProject } = await import("@/editor/tools/applyChangesetToStore");
    const { running: applying, stop } = proofScope.run(() => applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "title", toolNames: ["set_title_screen"] }), () => reply.resolve(Response.json([])));
    try {
      await waitForSignal(started.promise, applying);
      f.store.update((draft) => { draft.meta.title = "human-during-commit"; });
      reply.resolve(Response.json([]));
      const applied = await applying;
      if (!applied.ok) throw new Error(applied.issue);
      expect(applied.commitProject).not.toBe(f.store.getCurrent());
      f.session.recordAppliedProject(applied);
      expect(await f.prove()).toMatchObject({ status: "succeeded", verified: true, commitId: null });
      expect(f.store.getCurrent().meta.title).toBe("human-during-commit");
    } finally { await stop(); }
  });

  it("M1 retryLastTurn finalizes successful proof without replaying the LLM or applied tools", async () => {
    const f = await fixture();
    f.setRead(async () => new Response("unavailable", { status: 503 }));
    const initial = await f.run();
    expect(initial.execution).toMatchObject({ state: "external-blocker", blocker: { kind: "persistence" } });
    const receipt = f.session.getRunEndProof()?.receipt;
    const chats = f.chatCalls();
    const tools = toolAudit(f.session), events: SessionEvent[] = [];
    f.setRead(async () => Response.json([f.row()]));
    const result = await f.retry(event => events.push(event));
    expect(result.stoppedReason).toBe("final");
    expect(result.execution).toMatchObject({ requestId: initial.execution!.requestId, state: "verified" });
    expect(result.execution?.blocker).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(terminalExecution(events)).toEqual(result.execution);
    expect(f.session.getHarnessSnapshot().execution).toEqual(result.execution);
    expect(result.appliedCalls).toEqual(initial.appliedCalls);
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, receipt });
    expect(f.chatCalls()).toBe(chats);
    expect(f.commits).toHaveLength(1);
    expect(toolAudit(f.session)).toEqual(tools);
  });

  it("M1 repeated proof failure remains an evidenced blocker and can later succeed", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 }));
    const initial = await f.run(), chats = f.chatCalls(), tools = toolAudit(f.session), events: SessionEvent[] = [];
    const failed = await f.retry(event => events.push(event));
    expect(failed).toMatchObject({ stoppedReason: "error", execution: { requestId: initial.execution!.requestId, state: "external-blocker", blocker: { kind: "persistence", evidence: { origin: "store" } } } });
    expect(terminalExecution(events)).toEqual(failed.execution);
    expect(f.session.getRunEndProof()).toMatchObject({ status: "failed", verified: false });
    f.setRead(async () => Response.json([f.row()]));
    const recovered = await f.retry();
    expect(recovered.execution?.state).toBe("verified"); expect(recovered.execution?.blocker).toBeUndefined();
    expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1);
    expect(toolAudit(f.session)).toEqual(tools); expect(recovered.appliedCalls).toEqual(initial.appliedCalls);
  });

  it.each(["aborted", "project-switch", "switch-and-abort"] as const)("M1 proof retry honors after-await %s without replay", async boundary => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 }));
    const initial = await f.run(), chats = f.chatCalls(), tools = toolAudit(f.session), events: SessionEvent[] = [];
    const entered = deferred<void>(), response = deferred<Response>();
    f.setRead(() => { entered.resolve(); return response.promise; });
    const controller = new AbortController(), identity = f.store.getProjectIdentity().id;
    const unsubscribe = f.store.subscribe(() => { if (boundary === "switch-and-abort" && f.store.getProjectIdentity().id !== identity) controller.abort(); });
    const { running, stop } = proofScope.run(signal => f.session.retryLastTurn(event => events.push(event), signal), () => { unsubscribe(); response.resolve(Response.json([])); }, controller);
    try {
      await waitForSignal(entered.promise, running);
      const row = structuredClone(f.row());
      if (boundary === "aborted") controller.abort();
      else { const next = createBlankProject(); next.meta.title = "New project"; f.store.replaceProject(next); }
      if (boundary === "switch-and-abort") expect(controller.signal.aborted).toBe(true);
      response.resolve(Response.json([row]));
      const result = await running;
      expect(result).toMatchObject({ stoppedReason: "aborted", execution: { requestId: initial.execution!.requestId, state: boundary === "aborted" ? "aborted" : "project-switch" } });
      expect(terminalExecution(events)).toEqual(result.execution);
      expect(events.some(event => event.type === "run_state" && event.execution.state === "verified")).toBe(false);
      expect(f.store.getCurrent().meta.title).toBe(boundary === "aborted" ? "accepted-session-title" : "New project");
      expect(f.savedAudits()).toHaveLength(0);
      expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1); expect(toolAudit(f.session)).toEqual(tools);
    } finally { await stop(); }
  });

  it("M1 already-aborted proof retry performs no transport", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 })); await f.run();
    const requests = f.requests.length, chats = f.chatCalls(), events: SessionEvent[] = [], controller = new AbortController();
    controller.abort();
    const result = await f.retry(event => events.push(event), controller.signal);
    expect(result).toMatchObject({ stoppedReason: "aborted", execution: { state: "aborted" } });
    expect(terminalExecution(events)).toEqual(result.execution);
    expect(f.requests).toHaveLength(requests); expect(f.chatCalls()).toBe(chats);
  });

  it.each([false, true])("M1 current acceptance and receipt decide stale proof retry (reopened=%s)", async reopened => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 }));
    await f.run(); const oldReceipt = f.session.getRunEndProof()!.receipt!, chats = f.chatCalls(), tools = toolAudit(f.session);
    const agentCommits = f.commitAuthors.filter(commit => commit.kind === "agent");
    expect(agentCommits).toHaveLength(1);
    let retryReads = 0;
    const isProofRead = (url: URL) => url.searchParams.get("select")?.split(",").includes("project_id") === true;
    const humanCommitted = deferred<void>();
    f.setCommit(async () => { if (f.commitAuthors.at(-1)?.kind === "human") humanCommitted.resolve(); return Response.json([]); });
    const entered = deferred<void>(), response = deferred<Response>(), events: SessionEvent[] = [];
    f.setRead(url => {
      if (!isProofRead(url)) return Promise.resolve(Response.json([f.row()]));
      retryReads++; entered.resolve(); return response.promise;
    });
    const { running, stop } = proofScope.run(signal => f.session.retryLastTurn(event => events.push(event), signal), () => response.resolve(Response.json([])));
    try {
      await waitForSignal(entered.promise, running); const oldRow = structuredClone(f.row());
      f.store.update(project => { if (reopened) project.meta.title = "Human edit"; else project.maps[project.startMapId]!.name = "Human map edit"; });
      f.setRead(async url => {
        // Optimistic save preflight is not another proof attempt.
        if (isProofRead(url) && ++retryReads > 2) throw new Error("Unexpected repeated stale-proof read");
        return Response.json([f.row()]);
      }); response.resolve(Response.json([oldRow]));
      const result = await running;
      expect(result.execution?.state).toBe(reopened ? "manual-segment" : "verified");
      expect(result.execution?.blocker).toBeUndefined(); expect(terminalExecution(events)).toEqual(result.execution);
      expect(f.session.getAcceptanceSnapshot()?.status === "verified").toBe(!reopened);
      if (reopened) { expect(f.store.getCurrent().meta.title).toBe("Human edit"); expect(f.session.getRunEndProof()?.verified).toBe(false); }
      else {
        await waitForSignal(humanCommitted.promise);
        expect(f.store.getCurrent().maps[f.store.getCurrent().startMapId]!.name).toBe("Human map edit");
        expect(f.session.getRunEndProof()).toMatchObject({ verified: true, commitId: null });
        expect(f.session.getRunEndProof()?.receipt?.revisionId).not.toBe(oldReceipt.revisionId);
        expect(f.commitAuthors.filter(commit => commit.kind === "human")).toHaveLength(1);
      }
      expect(f.commitAuthors.filter(commit => commit.kind === "agent")).toEqual(agentCommits);
      expect(retryReads).toBe(reopened ? 1 : 2);
      expect(f.chatCalls()).toBe(chats); expect(toolAudit(f.session)).toEqual(tools);
    } finally { await stop(); }
  });

  it("M1 proof retry preserves local-only completion without inventing an outage", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 })); await f.run();
    f.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    const requests = f.requests.length, chats = f.chatCalls(), events: SessionEvent[] = [];
    const result = await f.retry(event => events.push(event));
    expect(result).toMatchObject({ stoppedReason: "final", execution: { state: "verified-local" } });
    expect(result.execution?.blocker).toBeUndefined(); expect(terminalExecution(events)).toEqual(result.execution);
    expect(f.session.getRunEndProof()?.verified).toBe(false);
    expect(f.requests).toHaveLength(requests); expect(f.chatCalls()).toBe(chats);
  });

  it("M1 live domain acceptance can reopen while source predicates still pass", async () => {
    const f = await fixture(true, true, true);
    f.setRead(async () => new Response("unavailable", { status: 503 })); await f.run();
    expect(verifyNpcRewardsPlayable(f.store.getCurrent(), f.npcRewards).ok).toBe(true);
    const chats = f.chatCalls(), tools = toolAudit(f.session), events: SessionEvent[] = [];
    const entered = deferred<void>(), response = deferred<Response>();
    f.setRead(() => { entered.resolve(); return response.promise; });
    const { running, stop } = proofScope.run(signal => f.session.retryLastTurn(event => events.push(event), signal), () => response.resolve(Response.json([])));
    try {
      await waitForSignal(entered.promise, running); const row = structuredClone(f.row());
      f.store.update(project => {
        const command = project.maps[project.startMapId]!.events[0]!.pages![0]!.commands[0]!;
        if (command.kind !== "changeItem") throw new Error("Expected fixture reward command");
        command.amount = 0;
      });
      f.session.refreshAcceptance(f.store.getCurrent());
      expect(f.session.getAcceptanceSnapshot()?.items.filter(item => item.id.startsWith("request-")).every(item => item.evidence.every(proof => proof.passed))).toBe(true);
      expect(verifyNpcRewardsPlayable(f.store.getCurrent(), f.npcRewards).ok).toBe(false);
      f.setRead(async () => Response.json([f.row()])); response.resolve(Response.json([row]));
      const result = await running;
      expect(result.execution?.state).toBe("manual-segment"); expect(result.execution?.blocker).toBeUndefined();
      expect(terminalExecution(events)).toEqual(result.execution);
      expect(verifyNpcRewardsPlayable(f.store.getCurrent(), f.npcRewards).ok).toBe(false);
      expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1); expect(toolAudit(f.session)).toEqual(tools);
    } finally { await stop(); }
  });

  it("M1 proof-only retry also finalizes an ordinary manually applied proposal", async () => {
    const f = await fixture(false); await f.run();
    const { applyProposedProject } = await import("@/editor/tools/applyChangesetToStore");
    const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "title", toolNames: ["set_title_screen"] });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(f.store.getCurrent());
    f.setRead(async () => new Response("unavailable", { status: 503 })); await f.prove();
    const chats = f.chatCalls(), tools = toolAudit(f.session), events: SessionEvent[] = [];
    f.setRead(async () => Response.json([f.row()]));
    const result = await f.retry(event => events.push(event));
    expect(result.execution?.state).toBe("verified"); expect(terminalExecution(events)).toEqual(result.execution);
    expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1); expect(toolAudit(f.session)).toEqual(tools);
  });

  it("M1 exact registered verification reopens on an external edit despite passing source predicates", async () => {
    const f = await fixture(true, true, false, true);
    f.setRead(async () => new Response("unavailable", { status: 503 }));
    const original = await f.run();
    expect(original.runOutcome).toMatchObject({ goal: "satisfied", delivery: "persisted" });
    const calls = f.chatCalls(), tools = toolAudit(f.session), reads = f.requests.length;
    f.store.update(project => { project.maps[project.startMapId]!.name = "External map edit"; });
    const retry = await f.retry();
    expect(retry.runOutcome).toMatchObject({ execution: "blocked", goal: "incomplete", delivery: "persisted" });
    expect(retry.execution?.state).toBe("manual-segment");
    const snapshot = f.session.getAcceptanceSnapshot();
    expect(snapshot?.items.find(item => item.id === "request-1:source:0")?.status).toBe("verified");
    expect(snapshot?.items.find(item => item.id === "exact-lint")?.evidence[0]?.passed).toBe(false);
    expect(f.requests).toHaveLength(reads);
    expect(f.chatCalls()).toBe(calls); expect(toolAudit(f.session)).toEqual(tools);
    expect(original).toBe(retry); // Main's mutable result owner, not a competing retry verdict.
  });

  it("M1 an answer-only context cannot retry an older authoring proof", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 })); await f.run();
    f.answerOnly();
    const answer = await f.send("What is the title?", undefined, undefined, { autonomous: true });
    expect(answer.execution?.state).toBe("answer");
    const requests = f.requests.length, chats = f.chatCalls();
    await f.retry();
    expect(f.requests).toHaveLength(requests); expect(f.chatCalls()).toBe(chats);
    expect(f.session.getHarnessSnapshot().execution).toEqual(answer.execution);
    expect(f.session.getHarnessSnapshot().requests?.map(request => request.authoring)).toEqual([true, false]);
  });

  it("M1 an obsolete proof retry cannot finalize a newer answer context", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 }));
    const initial = await f.run(), oldEvents: SessionEvent[] = [];
    const entered = deferred<void>(), response = deferred<Response>();
    f.setRead(() => { entered.resolve(); return response.promise; });
    const { running, stop } = proofScope.run(signal => f.session.retryLastTurn(event => oldEvents.push(event), signal), () => response.resolve(Response.json([])));
    try {
      await waitForSignal(entered.promise, running); const row = structuredClone(f.row());
      f.answerOnly(); const answer = await f.send("What is the title?", undefined, undefined, { autonomous: true });
      const afterAnswer = oldEvents.length, chats = f.chatCalls();
      response.resolve(Response.json([row])); const retired = await running;
      expect(retired).toMatchObject({ stoppedReason: "aborted", execution: { requestId: initial.execution!.requestId, state: "aborted" } });
      expect(f.session.getHarnessSnapshot().execution).toEqual(answer.execution);
      expect(oldEvents.slice(afterAnswer).some(event => event.type === "run_state")).toBe(false);
      expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1);
    } finally { await stop(); }
  });

  it("M1 an obsolete proof retry cannot finalize a newer resumed owner with the same request ID", async () => {
    const f = await fixture(); f.setRead(async () => new Response("unavailable", { status: 503 }));
    const initial = await f.run(), oldEvents: SessionEvent[] = [];
    const entered = deferred<void>(), response = deferred<Response>();
    f.setRead(() => { entered.resolve(); return response.promise; });
    const { running, stop } = proofScope.run(signal => f.session.retryLastTurn(event => oldEvents.push(event), signal), () => response.resolve(Response.json([])));
    try {
      await waitForSignal(entered.promise, running); const row = structuredClone(f.row());
      f.answerOnly(); const answer = await f.send("What is the title?", undefined, undefined, { autonomous: true });
      expect(answer.execution).toMatchObject({ requestId: "request-2", state: "answer" });
      f.setRead(async () => Response.json([f.row()]));
      const resumed = await f.send("continue", undefined, undefined, { autonomous: true, goalAction: "resume" });
      expect(resumed.execution).toMatchObject({ requestId: initial.execution!.requestId, state: "verified" });
      const proof = f.session.getRunEndProof(), chats = f.chatCalls(), tools = toolAudit(f.session), at = oldEvents.length;
      expect(proof?.verified).toBe(true);
      response.resolve(Response.json([row])); const retired = await running;
      expect(retired).toMatchObject({ stoppedReason: "aborted", execution: { requestId: initial.execution!.requestId, state: "aborted" } });
      expect(oldEvents.slice(at).some(event => event.type === "run_state" || event.type === "run_recap")).toBe(false);
      expect(f.session.getHarnessSnapshot().execution).toEqual(resumed.execution);
      expect(f.session.getRunEndProof()).toEqual(proof);
      expect(f.chatCalls()).toBe(chats); expect(f.commits).toHaveLength(1); expect(toolAudit(f.session)).toEqual(tools);
      expect(f.session.getHarnessSnapshot().requests?.map(request => request.requestId)).toEqual(["request-1", "request-2"]);
    } finally { await stop(); }
  });

  it("retryLastTurn proves already applied milestones after a recovered LLM failure", async () => {
    const f = await fixture();
    f.failFinal();
    expect((await f.run()).stoppedReason).toBe("error");
    expect(f.session.getRunEndProof()).toBeNull();
    const commits = f.commits.length;
    expect((await f.retry()).stoppedReason).toBe("final");
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true });
    expect(f.commits).toHaveLength(commits + 1);
    expect(f.session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "set_title_screen" && entry.args.title === "pending-session-title")).toHaveLength(1);
  });

  it("C3-direct-proof: authorized no-plan writes use the real accepted receipt", async () => {
    const f = await fixture(false, true);
    const result = await f.run();
    expect(result.execution?.state).toBe("verified");
    expect(f.session.getRunEndProof()?.verified).toBe(true);
    expect(result.proposedCalls).toHaveLength(0);
    expect(f.savedAudits()).toHaveLength(1);
  });

  it("a clean saved response without an accepted receipt cannot become proof", async () => {
    const f = await fixture();
    const reads = vi.spyOn(f.store, "verifyPersistedRevision");
    vi.spyOn(f.store, "flush").mockResolvedValue({ kind: "saved" });
    expect(await f.prove()).toMatchObject({ status: "failed", verified: false, reason: "missing-receipt" });
    expect(reads).not.toHaveBeenCalled();
    expect(f.savedAudits()).toHaveLength(0);
  });
});
