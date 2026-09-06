import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTimeout as clearDeadline, setTimeout as setDeadline } from "node:timers";
import type { Project } from "@/project/types";
import type { ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type RunEndProofState } from "@/ai/assistantSession";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";

const projectId = "p1-session-proof-fixture";
type Row = { project_id: string; current_json: Project; current_sha256: string };
const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const plan = {
  goal: "Set the title", layers: [{ title: "Title", items: [{
    title: "Title", instruction: "set_title_screen", successTools: ["set_title_screen"],
  }] }],
};

async function waitForSignal(signal: Promise<void>): Promise<void> {
  let deadline: ReturnType<typeof setDeadline> | undefined;
  try {
    await Promise.race([signal, new Promise<never>((_resolve, reject) => {
      deadline = setDeadline(() => reject(new Error("Transport did not reach the subscribed boundary")), 30_000);
    })]);
  } finally {
    clearDeadline(deadline);
  }
}

async function fixture(withPlan = true) {
  let row: Row | undefined;
  let read: (() => Promise<Response>) | undefined;
  let write: (() => Promise<void>) | undefined;
  const requests: { path: string; method: string }[] = [];
  const commits: string[] = [];
  let commitResponse: (() => Promise<Response>) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    requests.push({ path, method });
    if (path === "/rest/v1/projects") {
      if (method !== "GET") {
        if (write) await write();
        row = JSON.parse(String(init?.body));
        return Response.json(method === "PATCH" ? [row] : []);
      }
      return read ? read() : Response.json(row ? [row] : []);
    }
    if (path === "/rest/v1/project_commits" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      commits.push(body[0].commit_id);
      if (commitResponse) return commitResponse();
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let wrote = false;
  let failFinal = false;
  let chatCalls = 0;
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: withPlan ? "auto" : "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: withPlan }),
    yieldToUi: async () => {},
    chat: async (_config, request) => {
      chatCalls += 1;
      if (wrote && failFinal) { failFinal = false; throw Object.assign(new Error("scripted-final-failure"), { name: "LlmError", status: 401 }); }
      if (!request.tools?.length) return final(JSON.stringify(wrote ? { action: "resume" } : { action: "new_plan", ...plan }));
      if (wrote) return final("Finished.");
      wrote = true;
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: "accepted-session-title" }),
      } }] }, finishReason: "tool_calls" };
    },
  });
  return {
    store, session, requests, commits,
    failFinal: () => { failFinal = true; },
    chatCalls: () => chatCalls,
    setRead: (next: () => Promise<Response>) => { read = next; },
    setWrite: (next: () => Promise<void>) => { write = next; },
    setCommit: (next: () => Promise<Response>) => { commitResponse = next; },
    row: () => { if (!row) throw new Error("No saved row"); return row; },
    run: (onEvent: Parameters<typeof session.sendUserMessage>[1] = () => {}, signal?: AbortSignal) =>
      session.sendUserMessage("Set the title", onEvent, signal, { autonomous: true }),
    savedAudits: () => session.getAuditEntries().filter((entry) => entry.kind === "status" && entry.text.split(" ")[0] === "agent_run_saved"),
  };
}

describe("AssistantSession accepted-revision proof", () => {
  beforeEach(() => {
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
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("projects initialized proof events and rechecks freshness after the final status subscriber", async () => {
    const f = await fixture();
    expect(f.session.getRunEndProof()).toBeNull();
    expect(f.session.getHarnessSnapshot().runEndProof).toBeNull();
    const states: RunEndProofState[] = [];
    const result = await f.session.proveAppliedRevision((event) => {
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
    const result = await f.session.proveAppliedRevision((event) => {
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
    const result = await f.session.proveAppliedRevision((event) => {
      if (event.type === "persistence_proof" && event.state.status === "succeeded" && !nested) {
        nested = f.session.proveAppliedRevision(() => {}, controller.signal);
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
    const result = await f.session.proveAppliedRevision((event) => {
      if (event.type === "status") nested = f.session.proveAppliedRevision(() => {}, controller.signal);
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
    const result = await f.session.proveAppliedRevision((event) => {
      if (event.type !== "persistence_proof" || nested) return;
      const matches = boundary === "initial" ? event.state.status === "attempted" && !event.state.receipt
        : boundary === "receipt" ? event.state.status === "attempted" && !!event.state.receipt
        : event.state.status === (boundary === "failure" ? "failed" : "succeeded");
      if (!matches) return;
      nested = f.session.proveAppliedRevision(() => {}, controller.signal);
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
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    f.setWrite(() => { started.resolve(); return release.promise; });
    const outer = f.session.proveAppliedRevision();
    try {
      await waitForSignal(started.promise);
      const controller = new AbortController();
      controller.abort();
      const nested = await f.session.proveAppliedRevision(() => {}, controller.signal);
      expect(nested).toMatchObject({ status: "failed", reason: "cancelled", verified: false });
      release.resolve();
      expect(await outer).toEqual(nested);
      expect(f.session.getRunEndProof()).toEqual(nested);
      expect(f.requests.filter((r) => r.method === "GET")).toHaveLength(0);
      expect(f.savedAudits()).toHaveLength(0);
    } finally {
      release.resolve();
      await outer;
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
    const started = Promise.withResolvers<void>();
    const reply = Promise.withResolvers<Response>();
    const controller = new AbortController();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const outer = f.session.proveAppliedRevision(() => {}, controller.signal);
    try {
      await waitForSignal(started.promise);
      const row = structuredClone(f.row());
      f.setRead(async () => Response.json([f.row()]));
      const nextController = new AbortController();
      if (newer === "cancelled") nextController.abort();
      const nested = await f.session.proveAppliedRevision(() => {}, nextController.signal);
      expect(nested).toMatchObject({ status: newer === "cancelled" ? "failed" : "succeeded", verified: newer === "succeeded" });
      if (older === "cancelled") controller.abort();
      if (older === "mismatch") row.current_json.meta.title = "old-read-mismatch";
      reply.resolve(Response.json([row]));
      expect(await outer).toEqual(nested);
      expect(f.session.getRunEndProof()).toEqual(nested);
      expect(f.savedAudits()).toHaveLength(newer === "succeeded" ? 1 : 0);
      expect(f.session.getAuditEntries().filter((entry) => entry.kind === "status")).toHaveLength(1);
    } finally {
      reply.resolve(Response.json([f.row()]));
      await outer;
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
    await f.session.proveAppliedRevision();
    expect(f.requests).toHaveLength(requests);
    f.store.update((draft) => { draft.meta.title = "new-revision"; });
    expect(f.session.getRunEndProof()?.verified).toBe(false);
    const next = await f.session.proveAppliedRevision();
    expect(next).toMatchObject({ status: "succeeded", verified: true, commitId: null });
    expect(next.receipt?.revisionId).not.toBe(receipt?.revisionId);
    expect(f.savedAudits()).toHaveLength(2);
  });

  it.each(["cancelled", "disabled", "target", "content", "local-edit"] as const)("does not promote %s during the read or replace editor state", async (failure) => {
    const f = await fixture();
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    const reply = Promise.withResolvers<Response>();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const reload = vi.spyOn(f.store, "reloadFromRemote");
    const running = f.run(() => {}, controller.signal);
    await started.promise;
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
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "succeeded", verified: true, commitId: applied.commit.commitId });
    expect(f.commits).toHaveLength(1);
  });

  it("does not correlate a later human edit with an in-flight apply commit", async () => {
    const f = await fixture(false);
    await f.run();
    const started = Promise.withResolvers<void>();
    const reply = Promise.withResolvers<Response>();
    f.setCommit(() => { started.resolve(); return reply.promise; });
    const { applyProposedProject } = await import("@/editor/tools/applyChangesetToStore");
    const applying = applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "title", toolNames: ["set_title_screen"] });
    await started.promise;
    f.store.update((draft) => { draft.meta.title = "human-during-commit"; });
    reply.resolve(Response.json([]));
    const applied = await applying;
    if (!applied.ok) throw new Error(applied.issue);
    expect(applied.commitProject).not.toBe(f.store.getCurrent());
    f.session.recordAppliedProject(applied);
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "succeeded", verified: true, commitId: null });
    expect(f.store.getCurrent().meta.title).toBe("human-during-commit");
  });

  it("retryLastTurn retries failed proof without replaying the LLM or applied tools", async () => {
    const f = await fixture();
    f.setRead(async () => new Response("unavailable", { status: 503 }));
    await f.run();
    const receipt = f.session.getRunEndProof()?.receipt;
    const chats = f.chatCalls();
    f.setRead(async () => Response.json([f.row()]));
    await f.session.retryLastTurn();
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, receipt });
    expect(f.chatCalls()).toBe(chats);
    expect(f.commits).toHaveLength(1);
  });

  it("retryLastTurn proves already applied milestones after a recovered LLM failure", async () => {
    const f = await fixture();
    f.failFinal();
    expect((await f.run()).stoppedReason).toBe("error");
    expect(f.session.getRunEndProof()).toBeNull();
    const commits = f.commits.length;
    expect((await f.session.retryLastTurn()).stoppedReason).toBe("final");
    expect(f.session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true });
    expect(f.commits).toHaveLength(commits);
  });

  it("a clean saved response without an accepted receipt cannot become proof", async () => {
    const f = await fixture();
    const reads = vi.spyOn(f.store, "verifyPersistedRevision");
    vi.spyOn(f.store, "flush").mockResolvedValue({ kind: "saved" });
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "failed", verified: false, reason: "missing-receipt" });
    expect(reads).not.toHaveBeenCalled();
    expect(f.savedAudits()).toHaveLength(0);
  });
});
