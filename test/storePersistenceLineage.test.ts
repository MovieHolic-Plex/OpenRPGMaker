import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";

const projectId = "p1-lineage-fixture";
type Row = { project_id: string; current_json: Project; current_sha256: string };

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Lineage fixture signal deadline")), 60_000);
    })]);
  } finally { clearTimeout(timer); }
}

async function fixture() {
  let row: Row | undefined;
  let patchGate: { started: ReturnType<typeof Promise.withResolvers<void>>; release: ReturnType<typeof Promise.withResolvers<void>> } | undefined;
  const commitSignals = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  const savedTitles = new Map<string, string>();
  const commitHashes = new Map<string, string>();
  const requests: { path: string; method: string; expectedSha: string | null }[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== "p1-lineage.invalid") throw new Error(`Unexpected host: ${url.hostname}`);
    const method = init?.method ?? "GET";
    const expectedSha = url.searchParams.get("current_sha256");
    requests.push({ path: url.pathname, method, expectedSha });
    if (url.pathname === "/rest/v1/projects") {
      if (method === "POST" || method === "PATCH") {
        if (method === "PATCH") {
          if (patchGate) {
            const gate = patchGate;
            patchGate = undefined;
            gate.started.resolve();
            await bounded(gate.release.promise);
          }
          // Evaluate CAS after release, against the row that exists at acceptance time.
          if (expectedSha !== `eq.${row?.current_sha256}`) return Response.json([]);
        }
        const submitted: Row = JSON.parse(String(init?.body));
        row = submitted;
        savedTitles.set(submitted.current_sha256, submitted.current_json.meta.title);
        return Response.json(method === "PATCH" ? [row] : []);
      }
      return Response.json(row ? [row] : []);
    }
    if (url.pathname === "/rest/v1/project_commits" && method === "POST") {
      const commits: { commit_id: string; current_sha256: string }[] = JSON.parse(String(init?.body));
      for (const commit of commits) commitHashes.set(commit.commit_id, commit.current_sha256);
    }
    if (url.pathname === "/rest/v1/project_changes" && method === "POST") {
      const changes: { commit_id: string }[] = JSON.parse(String(init?.body));
      for (const change of changes) {
        const hash = commitHashes.get(change.commit_id);
        const title = hash ? savedTitles.get(hash) : undefined;
        if (title) commitSignals.get(title)?.resolve();
      }
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(url.pathname)) {
      return Response.json([]);
    }
    throw new Error(`Unexpected transport: ${method} ${url.pathname}`);
  }));
  const { store } = await import("@/project/store");
  const { AssistantSession } = await import("@/ai/assistantSession");
  const { serializeForComparison } = await import("@/project/io");
  const { projectWithoutEventDrafts } = await import("@/project/eventDrafts");
  const { sha256HexText } = await import("@/util/sha256");
  const identity = (project: Project) => sha256HexText(serializeForComparison(projectWithoutEventDrafts(project)));
  const commitSignal = () => {
    const committed = Promise.withResolvers<void>();
    commitSignals.set(store.getCurrent().meta.title, committed);
    return committed.promise;
  };
  const flush = async () => {
    const commit = commitSignal();
    const result = await store.flush();
    await bounded(commit);
    if (result.kind !== "saved" || !result.receipt) throw new Error("Expected accepted receipt");
    return result.receipt;
  };
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store.update((draft) => { draft.meta.title = "before-pending-save"; });
  await flush();
  // Actual initial save and ordinary normalized loader, before racing a real PATCH.
  expect((await store.reloadFromRemote({ force: true })).kind).toBe("reloaded");
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    chat: async () => { throw new Error("No LLM call allowed in lineage proof"); },
    yieldToUi: async () => {},
  });
  return {
    store, session, identity, flush, commitSignal, requests,
    row: () => { if (!row) throw new Error("No saved row"); return row; },
    holdPatch: () => {
      const gate = { started: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
      patchGate = gate;
      return gate;
    },
    savedAudits: () => session.getAuditEntries().filter((entry) => entry.kind === "status" && entry.text.split(" ")[0] === "agent_run_saved"),
  };
}

describe("accepted receipt content lineage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers(); // Freeze unrelated autosave; event signals use bounded native deadlines.
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", "http://p1-lineage.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId);
    vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    });
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it.each(["reload", "load", "reconnect"])("does not resurrect saved authority after %s during PATCH", async (replacement) => {
    const f = await fixture();
    f.store.update((draft) => { draft.meta.title = "accepted-pending-save"; });
    const gate = f.holdPatch();
    const committed = f.commitSignal();
    const pending = f.session.proveAppliedRevision();
    let replacementGate: ReturnType<typeof f.holdPatch> | undefined;
    let replacementSaving: ReturnType<typeof f.store.flush> | undefined;
    try {
      await bounded(gate.started.promise);
      // Preserve manual reload policy: without explicit force dirty content cannot be replaced.
      expect((await f.store.reloadFromRemote()).kind).toBe("cancelled");
      if (replacement === "reload") expect((await f.store.reloadFromRemote({ force: true })).kind).toBe("reloaded");
      else if (replacement === "load") await f.store.load();
      else expect((await f.store.reconnectRemotePersistence()).kind).toBe("connected");
      const live = f.store.getCurrent();
      expect(live.meta.title).toBe("before-pending-save");
      // Explicit replacement persistence queues behind A. Hold its own PATCH so
      // A's historical read-back proof observes A before B is accepted, without
      // depending on hash/network timing or awaiting B while A is still held.
      replacementGate = f.holdPatch();
      const replacementCommitted = f.commitSignal();
      replacementSaving = f.store.flush();
      const adoptedBaseline = structuredClone(f.store._getPersistedBaselineForTest());
      gate.release.resolve();
      await bounded(replacementGate.started.promise);
      const result = await bounded(pending);
      await bounded(committed);
      const receipt = result.receipt;
      if (!receipt) throw new Error("Pending save must retain its historical receipt");
      expect(f.row().current_json.meta.title).toBe("accepted-pending-save");
      expect(receipt.contentIdentity).toBe(await f.identity(f.row().current_json));
      expect(await f.identity(live)).not.toBe(receipt.contentIdentity);
      expect(f.requests.some((request) => request.method === "PATCH" && request.expectedSha?.startsWith("eq."))).toBe(true);
      expect(result.proof).toMatchObject({ kind: "verified", isCurrent: false, receipt });
      expect(result).toMatchObject({ status: "failed", verified: false, reason: "stale" });
      expect(f.savedAudits()).toHaveLength(0);
      expect(f.session.getRunEndProof()?.verified).toBe(false);
      expect(f.store.isPersistenceReceiptCurrent(receipt)).toBe(false);
      expect(f.store._getPersistedBaselineForTest()).toEqual(adoptedBaseline);
      expect(f.store.hasUnsavedChanges()).toBe(true);
      replacementGate.release.resolve();
      const replacementFlush = await bounded(replacementSaving);
      await bounded(replacementCommitted);
      if (replacementFlush.kind !== "saved") throw new Error("Replacement must be clean");
      expect(replacementFlush.receipt?.contentIdentity).toBe(await f.identity(live));
      expect(replacementFlush.receipt).toBeDefined();
      expect(f.row().current_json.meta.title).toBe("before-pending-save");
      expect(replacementFlush.receipt?.contentIdentity).toBe(await f.identity(f.row().current_json));
      const replacementBaseline = structuredClone(f.store._getPersistedBaselineForTest());
      // A's historical result cannot replace B's now-published receipt or baseline.
      const clean = await f.store.flush();
      expect(clean).toEqual({ kind: "saved", sha256: replacementFlush.sha256, receipt: replacementFlush.receipt });
      if (clean.kind !== "saved") throw new Error("Expected clean saved result");
      expect(clean.receipt).toBe(replacementFlush.receipt);
      expect(f.store.getCurrent()).toBe(live);
      expect(f.store._getPersistedBaselineForTest()).toEqual(replacementBaseline);
      expect(f.store.hasUnsavedChanges()).toBe(false);
      // A later authored save must recover normally, without reviving the old receipt.
      f.store.update((draft) => { draft.meta.title = "later-legitimate-save"; });
      const laterCommit = f.commitSignal();
      const later = await f.session.proveAppliedRevision();
      await bounded(laterCommit);
      expect(later).toMatchObject({ status: "succeeded", verified: true });
      expect(later.receipt?.revisionId).not.toBe(receipt.revisionId);
      expect(f.savedAudits()).toHaveLength(1);
      expect(f.store.isPersistenceReceiptCurrent(receipt)).toBe(false);
      expect(f.store.getCurrent().meta.title).toBe("later-legitimate-save");
    } finally {
      gate.release.resolve();
      replacementGate?.release.resolve();
      await bounded(pending);
      await bounded(committed);
      if (replacementSaving) await bounded(replacementSaving);
    }
  }, 60_000);

  it.each(["reload", "load", "reconnect", "adopt", "fallback"])("invalidates an already published receipt on %s even for identical content", async (replacement) => {
    const f = await fixture();
    f.store.update((draft) => { draft.meta.title = "published-before-adoption"; });
    const receipt = await f.flush();
    expect(f.store.isPersistenceReceiptCurrent(receipt)).toBe(true);
    const project = structuredClone(f.store.getCurrent());
    if (replacement === "reload") await f.store.reloadFromRemote({ force: true });
    else if (replacement === "load") await f.store.load();
    else if (replacement === "reconnect") await f.store.reconnectRemotePersistence();
    else if (replacement === "adopt") await f.store.loadNewRemoteProject(project, { projectId });
    else await f.store.loadFallbackProject(project);
    expect(await f.identity(f.store.getCurrent())).toBe(receipt.contentIdentity);
    expect(f.store.isPersistenceReceiptCurrent(receipt)).toBe(false);
    if (replacement !== "fallback") {
      expect(await f.store.verifyPersistedRevision(receipt)).toMatchObject({ kind: "verified", isCurrent: false });
      f.store.update((draft) => { draft.meta.title = "saved-after-adoption"; });
      const later = await f.flush();
      expect(f.store.isPersistenceReceiptCurrent(later)).toBe(true);
      expect(f.store.isPersistenceReceiptCurrent(receipt)).toBe(false);
    }
  }, 60_000);
});
