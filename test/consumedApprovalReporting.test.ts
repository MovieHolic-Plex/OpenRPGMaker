// Consumed-approval reporting: a successful subscribed autonomous apply must keep
// reporting the recorded approved revision, while consumed authority stays unusable.
// Real store + real subscription coupling + public session/autonomous apply;
// only model transport is scripted.
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { store } from "@/project/store";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";

const PROJECT_ID = "rpg-zzu-test-project";

function installHermeticEnv(project: Project): void {
  resetIntentDeclarationCache();
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", "http://smoke.invalid");
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  vi.stubGlobal("fetch", (async () => Response.json([])) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function toolCallResult(name: string, args: unknown, id: string): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [
    { id, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ] }, finishReason: "tool_calls" };
}
function finalResult(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" };
}

const ORCH_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x", model: "supervisor-model", liteModel: "executor-model", apiKey: "sk",
  maxToolCalls: 16, maxTokens: 16000,
};

function priceFixture() {
  const project = createBlankProject();
  installHermeticEnv(project);
  const plan = { goal: "price 333",
    layers: [{ title: "Batch one", items: [{ title: "First good",
      instruction: "upsert price 333", successTools: ["upsert_item"] }] }] };
  let price = 333;
  const stepsFor = (p: number): ChatResult[] => [
    finalResult(JSON.stringify({ action: "new_plan", ...plan })),
    toolCallResult("set_work_plan", plan, "c_plan"),
    toolCallResult("upsert_item", { item: { id: "item_potion", price: p } }, "c_write"),
    finalResult("Draft ready for review"),
  ];
  let steps = stepsFor(price);
  let index = 0;
  let verdict: "approved" | "changes_requested" = "approved";
  const reviews: { revision: number; verdict: string }[] = [];
  const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
    const review = independentReviewPayload(request);
    if (review) {
      expect(request.tools).toEqual([]);
      reviews.push({ revision: review.revision, verdict });
      if (verdict === "approved") {
        const approval = approvedReviewResponse(request);
        if (approval) return approval;
      }
      return { message: { role: "assistant", content: JSON.stringify({ revision: review.revision,
        verdict: "changes_requested", summary: "Fixture rejection",
        findings: [{ id: "f", target: "/database/items/item_potion", problem: "rejected",
          requestedChange: "do not apply", validation: "none" }] }) }, finishReason: "stop" };
    }
    if (index >= steps.length) return finalResult("Finished, awaiting review");
    return steps[index++];
  };
  const session = new AssistantSession(project, {
    config: ORCH_CONFIG, chat, yieldToUi: async () => {},
    // Mirror the production fallback intent for a DB edit (no target map, no readBeforeWrite),
    // so no map-scoped acceptance ledger can block the turn.
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
  });
  // Production host coupling: the subscribed editor refreshes acceptance on every
  // store change, including the session's own store.replace from apply.
  let subscriptionFires = 0;
  const unsubscribe = store.subscribe(() => {
    subscriptionFires++;
    session.refreshAcceptance(store.getCurrent());
  });
  const events: SessionEvent[] = [];
  const run = () => session.sendUserMessage("Set potion price to 333",
    event => events.push(event), undefined, { autonomous: true });
  return { session, run, reviews, events,
    subscriptionFires: () => subscriptionFires, done: () => unsubscribe(),
    nextTurn: (next: "approved" | "changes_requested", p: number) => { price = p; steps = stepsFor(p); index = 0; verdict = next; } };
}

describe("consumed approval reporting (subscribed autonomous apply)", () => {
  it("successful consumed apply reports the recorded approval with its revision", async () => {
    const f = priceFixture();
    try {
      const result = await f.run();
      expect(result.stoppedReason, result.error).toBe("final");
      expect(result.appliedCalls?.map(call => call.name)).toEqual(["upsert_item"]);
      expect(store.getCurrent().database.items.find(i => i.id === "item_potion")?.price).toBe(333);
      expect(f.subscriptionFires()).toBeGreaterThanOrEqual(1);
      expect(f.reviews).toHaveLength(1);
      // The recorded historical verdict keeps its approved status and revision.
      expect(result.review?.status).toBe("approved");
      expect(result.review?.revision).toBe(f.reviews[0]!.revision);
    } finally { f.done(); }
  }, 60_000);

  it("a later rejected turn never replays the consumed approval", async () => {
    const f = priceFixture();
    try {
      const first = await f.run();
      expect(first.review?.status).toBe("approved");
      expect(store.getCurrent().database.items.find(i => i.id === "item_potion")?.price).toBe(333);
      // A new turn writes a new proposal (retiring the recorded verdict) and its
      // reviewer rejects: the old approval must not replay as the new verdict.
      f.nextTurn("changes_requested", 444);
      const events: SessionEvent[] = [];
      const second = await f.session.sendUserMessage("Set potion price to 444",
        event => events.push(event), undefined, { autonomous: true });
      expect(second.review?.status).toBe("changes_requested");
      expect(store.getCurrent().database.items.find(i => i.id === "item_potion")?.price).toBe(333);
      expect(f.session.isDraftReviewApproved()).toBe(false);
    } finally { f.done(); }
  }, 60_000);

  it("cancellation before any apply preserves no approval to report", async () => {
    const f = priceFixture();
    try {
      const controller = new AbortController();
      const events: SessionEvent[] = [];
      const result = await f.session.sendUserMessage("Set potion price to 333", event => {
        events.push(event);
        if (event.type === "tool_call" && event.name === "upsert_item") controller.abort();
      }, controller.signal, { autonomous: true });
      expect(result.stoppedReason).toBe("aborted");
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(result.review?.status).not.toBe("approved");
      expect(f.session.isDraftReviewApproved()).toBe(false);
      expect(store.getCurrent().database.items.find(i => i.id === "item_potion")?.price).toBe(50);
    } finally { f.done(); }
  }, 60_000);

  it("consumed authority stays unusable: no approval replay for later work", async () => {
    const f = priceFixture();
    try {
      const first = await f.run();
      expect(first.review?.status).toBe("approved");
      // Live authority is consumed: the same draft no longer reads as approved.
      expect(f.session.isDraftReviewApproved()).toBe(false);
      // A fresh turn retires the recorded verdict; nothing replays it.
      const events: SessionEvent[] = [];
      const second = await f.session.sendUserMessage("What does the potion cost?",
        event => events.push(event), undefined, { composerMode: "ask" });
      expect(second.stoppedReason).toBe("final");
      expect(second.review ?? f.session.getResultReview()).toBeNull();
    } finally { f.done(); }
  }, 60_000);
});
