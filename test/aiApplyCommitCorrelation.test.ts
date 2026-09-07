import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { createHash } from "node:crypto";
import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const projectId = "p1-apply-correlation-fixture";
type ProjectRow = { project_id: string; current_json: Project; current_sha256: string };
type CommitRow = { commit_id: string; current_sha256: string };

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Apply correlation signal timed out")), 15_000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function fixture() {
  let row: ProjectRow | undefined;
  const commits: CommitRow[] = [];
  const requests: { path: string; method: string }[] = [];
  let commitResponse: (() => Promise<Response>) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== "p1-apply.invalid") throw new Error(`Unexpected target: ${url.origin}`);
    const method = init?.method ?? "GET";
    requests.push({ path: url.pathname, method });
    if (url.pathname === "/rest/v1/projects") {
      if (method === "GET") return Response.json(row ? [row] : []);
      if (method === "PATCH") {
        const expectedSha = url.searchParams.get("current_sha256");
        if (expectedSha && expectedSha !== `eq.${row?.current_sha256}`) return Response.json([]);
      }
      row = JSON.parse(String(init?.body));
      return Response.json(method === "PATCH" ? [row] : []);
    }
    if (url.pathname === "/rest/v1/project_commits" && method === "POST") {
      const submitted: CommitRow[] = JSON.parse(String(init?.body));
      commits.push(...submitted);
      if (commitResponse) return commitResponse();
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(url.pathname)) {
      return Response.json([]);
    }
    throw new Error(`Unexpected transport: ${method} ${url.pathname}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    chat: async () => { throw new Error("No LLM calls allowed in apply/proof regression"); },
    yieldToUi: async () => {},
  });
  return { session, commits, requests, row: () => row,
    setCommitResponse: (next: () => Promise<Response>) => { commitResponse = next; } };
}

beforeEach(() => {
  vi.useFakeTimers(); // Freeze unrelated autosave; real bounded signals drive the test.
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://p1-apply.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId);
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
});

afterEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
  _resetEditActivityForTest();
  _resetEventDraftVaultForTest();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each([false, true])("actual apply commit correlation (resetProject=%s)", (resetProject) => {
  it.each(["synchronous-subscriber", "healthy", "async-commit-edit"])("proves %s content without donating commit identity", async (scenario) => {
    const f = fixture();
    const before = store.getCurrent();
    const proposed = structuredClone(before);
    proposed.meta.title = "actual-ai-apply";
    const laterTitle = "subscriber-edit-not-in-ai-commit";
    let subscriberRan = false;
    const unsubscribe = store.subscribe((_project, change) => {
      if (scenario !== "synchronous-subscriber" || subscriberRan || change.origin !== "ai") return;
      subscriberRan = true;
      store.update((draft) => { draft.meta.title = laterTitle; });
    });
    const started = Promise.withResolvers<void>();
    const reply = Promise.withResolvers<Response>();
    if (scenario === "async-commit-edit") {
      f.setCommitResponse(() => { started.resolve(); return bounded(reply.promise); });
    }
    try {
      const applying = applyProposedProject(proposed, {
        baseline: new AuthoredProjectBaseline(before),
        source: "agent", summary: "Apply correlation", toolNames: ["set_title_screen"], resetProject,
      });
      if (scenario === "async-commit-edit") {
        await bounded(started.promise);
        store.update((draft) => { draft.meta.title = laterTitle; });
        reply.resolve(Response.json([]));
      }
      const applied = await bounded(applying);
      if (!applied.ok) throw new Error(applied.issue);
      expect(subscriberRan).toBe(scenario === "synchronous-subscriber");
      expect(applied.applied).toBe(store.getCurrent());
      expect(applied.applied.meta.title).toBe(scenario === "healthy" ? proposed.meta.title : laterTitle);
      expect(applied.commit.persisted).toBe(true);
      expect(applied.commit.commitId).toMatch(/^[a-f0-9-]{36}$/);
      expect(f.commits).toHaveLength(1);
      const wireHash = createHash("sha256").update(serialize(projectWithoutEventDrafts(proposed))).digest("hex");
      expect(f.commits[0]).toMatchObject({ commit_id: applied.commit.commitId, current_sha256: wireHash });

      // Real session recording and save/read proof, not a mocked identity comparison.
      f.session.recordAppliedProject(applied);
      const proof = await bounded(f.session.proveAppliedRevision());
      expect(proof).toMatchObject({ status: "succeeded", verified: true });
      expect(f.row()?.current_json.meta.title).toBe(applied.applied.meta.title);
      expect(proof.commitId).toBe(scenario === "healthy" ? applied.commit.commitId : null);
      expect(applied.commitProject?.meta.title).toBe("actual-ai-apply");
      if (scenario === "healthy") expect(applied.commitProject).toBe(store.getCurrent());
      else expect(applied.commitProject).not.toBe(store.getCurrent());
      expect(f.requests.filter((request) => request.path === "/rest/v1/project_commits" && request.method === "GET")).toHaveLength(0);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().meta.title).toBe(before.meta.title);
    } finally {
      unsubscribe();
      reply.resolve(Response.json([]));
    }
  }, 60_000);
});
