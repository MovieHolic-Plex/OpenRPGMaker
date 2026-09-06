import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import { AssistantSession, type ProposedCall, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload } from "./independentReviewFixture";

const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const approve = (revision: number): ChatResult => final(JSON.stringify({ revision, verdict: "approved", summary: "Title checked", findings: [] }));

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred not initialized"); };
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

async function bounded<T>(signal: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([signal, new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error("Review boundary not reached")), 30_000);
    })]);
  } finally {
    clearTimeout(deadline);
  }
}

let restoreDom: () => void;
beforeEach(() => {
  restoreDom = installFakeDom();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  resetMapEditHistory();
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(null, { status: 201 })));
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers();
  restoreDom(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

function fixture(reviewer: (revision: number, attempt: number) => ChatResult | Promise<ChatResult> = approve) {
  let writerCalls = 0, reviewCalls = 0;
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12, maxTokens: 16000 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: [] }),
    yieldToUi: async () => {},
    chat: async (_config, request) => {
      const input = independentReviewPayload(request);
      if (input) return reviewer(input.revision, ++reviewCalls);
      if (++writerCalls > 1) return final("Writer finished");
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: "Reviewed title" }),
      } }] }, finishReason: "tool_calls" };
    },
  });
  const host = createProposalHost({ proposalNoticeHost: document.createElement("div"),
    controller: { session, auditHistory: [], statusTimeline: [] },
    appendBubble: (_role, text) => { const bubble = document.createElement("div"); bubble.textContent = text; return bubble; },
    setStatus: () => {},
  });
  return { session, host, writerCalls: () => writerCalls, reviewCalls: () => reviewCalls };
}

describe("review approval ownership", () => {
  it.each([
    { autonomous: false, freshSignal: false }, { autonomous: false, freshSignal: true },
    { autonomous: true, freshSignal: false }, { autonomous: true, freshSignal: true },
  ])("requires fresh review after approval-event cancellation (%j)", async ({ autonomous, freshSignal }) => {
    // Given an independently reviewed draft cancelled before application.
    const entered = deferred<number>();
    const release = deferred<ChatResult>();
    const f = fixture((revision, attempt) => {
      if (attempt === 1) return approve(revision);
      entered.resolve(revision);
      return release.promise;
    });
    const before = store.getCurrent();
    const controller = new AbortController();
    const cancelled = await f.session.sendUserMessage("Change title", event => {
      if (event.type === "result_review") controller.abort();
    }, controller.signal, { autonomous });
    expect(cancelled.stoppedReason).toBe("aborted");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(await f.host.applyProposal(cancelled.proposedCalls)).toBe("rejected");

    // When retry replaces the signal, the old approval cannot authorize a real apply.
    const retry = f.session.retryLastTurn(() => {}, freshSignal ? new AbortController().signal : undefined);
    try {
      expect(await f.host.applyProposal(cancelled.proposedCalls)).toBe("rejected");
      expect(f.session.isDraftReviewApproved()).toBe(false);
      expect(store.getCurrent()).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      const revision = await bounded(entered.promise);
      expect(f.reviewCalls()).toBe(2);
      expect(f.writerCalls()).toBe(3);
      expect(await f.host.applyProposal(cancelled.proposedCalls)).toBe("rejected");
      release.resolve(approve(revision));
      const retried = await bounded(retry);

      // Then only the new current review authorizes the original edit, exactly once.
      expect(retried.stoppedReason).toBe("final");
      expect(retried.review?.status).toBe("approved");
      if (!autonomous) expect(await f.host.applyProposal(retried.proposedCalls)).toBe("applied");
      expect(store.getCurrent().system.titleScreen?.title).toBe("Reviewed title");
      expect(f.session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "set_title_screen")).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().system).toEqual(before.system);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    } finally {
      release.resolve(final("Discarded test response"));
      await bounded(retry);
    }
  });

  it("does not admit approval inside a review event before checking its output budget", async () => {
    const f = fixture(revision => ({ ...approve(revision), usage: { completion_tokens: 16000 } }));
    const before = store.getCurrent();
    const calls: ProposedCall[] = [];
    let applying: ReturnType<typeof f.host.applyProposal> | undefined;
    const result = await f.session.sendUserMessage("Change title", event => {
      if (event.type === "tool_call") calls.push({ ...event, summary: event.result.summary, destructive: false });
      if (event.type === "result_review") {
        expect(calls).toHaveLength(1);
        applying = f.host.applyProposal(calls);
        expect(f.session.isDraftReviewApproved()).toBe(false);
      }
    });
    expect(result.stoppedReason).toBe("token-budget");
    expect(await applying).toBe("rejected");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(store.getCurrent()).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it.each(["result_review", "assistant_message"] satisfies SessionEvent["type"][])("retires approval when the %s subscriber throws", async boundary => {
    const f = fixture();
    const failure = new Error("Subscriber failure");
    await expect(f.session.sendUserMessage("Change title", event => {
      if (event.type === boundary) throw failure;
    })).rejects.toBe(failure);
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("keeps a completed approval bound to its original signal on retry", async () => {
    const f = fixture(), controller = new AbortController();
    await f.session.sendUserMessage("Change title", () => {}, controller.signal);
    expect(f.session.isDraftReviewApproved()).toBe(true);
    controller.abort();
    expect(f.session.isDraftReviewApproved()).toBe(false);
    const retried = await f.session.retryLastTurn();
    expect(f.reviewCalls()).toBe(2);
    expect(retried.review?.status).toBe("approved");
  });

  it("retries an already-applied persistence proof without replaying writes or review", async () => {
    // Given a real reviewed/direct apply whose proof failed with storage disabled.
    const f = fixture();
    const result = await f.session.sendUserMessage("Change title");
    expect(await f.host.applyProposal(result.proposedCalls)).toBe("applied");
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "failed", verified: false });
    const applied = store.getCurrent();
    const replace = vi.spyOn(store, "replace");

    // When storage recovers, exercise the real save/read proof over a local wire fixture.
    vi.useFakeTimers(); // Disable unrelated autosave, not the proof's explicit flush/read.
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", "http://r3-proof.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture-anon");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "r3-local-proof");
    vi.stubGlobal("window", { location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    const rows = new Map<string, string>();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (!["/rest/v1/projects", "/rest/v1/maps", "/rest/v1/tilesets"].includes(path)) throw new Error(`Unexpected proof transport: ${path}`);
      if (init?.method === "DELETE") rows.delete(path);
      else if (init?.method && init.method !== "GET") rows.set(path,
        path === "/rest/v1/projects" ? `[${String(init.body)}]` : String(init.body));
      return new Response(rows.get(path) ?? "[]", { headers: { "Content-Type": "application/json" } });
    }));
    store._setPersistedBaselineForTest(null);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    await f.session.retryLastTurn();

    // Then the accepted revision is verified without any second edit or model request.
    expect(f.session.getRunEndProof(), f.session.getRunEndProof()?.reason).toMatchObject({ status: "succeeded", verified: true });
    expect(f.writerCalls()).toBe(2);
    expect(f.reviewCalls()).toBe(1);
    expect(replace).not.toHaveBeenCalled();
    expect(store.getCurrent()).toBe(applied);
  });
});
