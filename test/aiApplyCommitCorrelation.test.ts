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
import { installHookedMemoryRepository } from "./support/hookedMemoryRepository";

const projectId = "p1-apply-correlation-fixture";

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

// The store persists through the project repository (SQLite host / Electron / memory); the LegacyDb REST rows this file used to
// mock are no longer read by src. The same seams — the saved row, the commit log and request counts — come from a hooked memory repository.
async function fixture() {
  const repo = installHookedMemoryRepository(projectId);
  disposeRepository = repo.dispose;
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(await repo.seedLoaded(createBlankProject()));
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    chat: async () => { throw new Error("No LLM calls allowed in apply/proof regression"); },
    yieldToUi: async () => {},
  });
  return { session, commits: repo.commits, requests: repo.requests, snapshot: repo.snapshot, setCommit: repo.setCommit };
}

let disposeRepository: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers(); // Freeze unrelated autosave; real bounded signals drive the test.
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
});

afterEach(() => {
  disposeRepository?.();
  disposeRepository = undefined;
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
    const f = await fixture();
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
    const reply = Promise.withResolvers<void>();
    if (scenario === "async-commit-edit") {
      f.setCommit(() => { started.resolve(); return bounded(reply.promise); });
    }
    try {
      const applying = applyProposedProject(proposed, {
        base: f.session.getProposalBase(), baseline: new AuthoredProjectBaseline(before),
        source: "agent", summary: "Apply correlation", toolNames: ["set_title_screen"], resetProject,
      });
      if (scenario === "async-commit-edit") {
        await bounded(started.promise);
        store.update((draft) => { draft.meta.title = laterTitle; });
        reply.resolve();
      }
      const applied = await bounded(applying);
      if (!applied.ok) throw new Error(applied.issue);
      expect(subscriberRan).toBe(scenario === "synchronous-subscriber");
      expect(applied.applied).toBe(store.getCurrent());
      expect(applied.applied.meta.title).toBe(scenario === "healthy" ? proposed.meta.title : laterTitle);
      expect(applied.commit.persisted).toBe(true);
      expect(applied.commit.commitId).toMatch(/^[a-f0-9-]{36}$/);
      // One AI commit for this apply. A later human edit saved by the proof flush may add its own manual (human) commit.
      const aiCommits = f.commits.filter((commit) => commit.authorKind === "agent");
      expect(aiCommits, JSON.stringify(f.commits)).toHaveLength(1);
      const wireHash = createHash("sha256").update(serialize(projectWithoutEventDrafts(proposed))).digest("hex");
      expect(aiCommits[0]).toMatchObject({ commitId: applied.commit.commitId, sha256: wireHash });

      // Real session recording and save/read proof, not a mocked identity comparison.
      f.session.recordAppliedProject(applied);
      const proof = await bounded(f.session.proveAppliedRevision());
      expect(proof).toMatchObject({ status: "succeeded", verified: true });
      expect((await f.snapshot()).project.meta.title).toBe(applied.applied.meta.title);
      expect(proof.commitId).toBe(scenario === "healthy" ? applied.commit.commitId : null);
      expect(applied.commitProject?.meta.title).toBe("actual-ai-apply");
      if (scenario === "healthy") expect(applied.commitProject).toBe(store.getCurrent());
      else expect(applied.commitProject).not.toBe(store.getCurrent());
      expect(f.requests.filter((request) => request.op === "commit-list")).toHaveLength(0);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().meta.title).toBe(before.meta.title);
    } finally {
      unsubscribe();
      reply.resolve();
    }
  }, 60_000);
});
