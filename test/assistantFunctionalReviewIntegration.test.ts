import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { store } from "@/project/store";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { functionalFixture } from "./fixtures/functionalAcceptance";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";

const final = (content = "FUNCTIONAL_WRITER_DONE"): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", maxToolCalls: 12, maxTokens: 16000 } as const;
beforeEach(() => {
  resetIntentDeclarationCache(); resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
});
afterEach(() => { resetIntentDeclarationCache(); resetMapEditHistory(); vi.restoreAllMocks(); });

function fixture(options: { broken?: boolean; review?: "approved" | "rejected" | "stale"; unresolved?: boolean } = {}) {
  const f = functionalFixture();
  if (options.broken) f.project.session.gold = 1;
  store.replace(f.project);
  const criterion = { kind: "shopPurchase" as const, target: { mapId: f.origin.id }, start: f.project.startPos,
    seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 };
  const responses = [tool("set_title_screen", { title: "Reviewed functional title" })];
  const reviews: NonNullable<ReturnType<typeof independentReviewPayload>>[] = [];
  const requests: ChatRequest[] = [];
  const events: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), { config, yieldToUi: async () => {},
    declareIntent: fixedDeclarer({ mode: "modify", functionalAcceptance: options.unresolved
      ? [{ kind: "functionalUnresolved", reason: "Request price missing", expectations: { kind: "shopPurchase", count: 2 } }]
      : [criterion] }),
    chat: async (_config, request) => {
      const input = independentReviewPayload(request);
      if (input) {
        expect(request.tools ?? []).toEqual([]);
        reviews.push(input);
        if (options.review === "rejected") return final(JSON.stringify({ revision: input.revision, verdict: "changes_requested",
          summary: "Title rejected", findings: [{ id: "title", target: "/system/titleScreen", problem: "Wrong title",
            requestedChange: "Repair title", validation: "Read the revised title" }] }));
        if (options.review === "stale") return final(JSON.stringify({ revision: input.revision - 1, verdict: "approved", summary: "Old approval", findings: [] }));
        return approvedReviewResponse(request)!;
      }
      requests.push(request);
      return responses.shift() ?? final();
    } });
  return { ...f, criterion, session, responses, reviews, requests, events,
    send: (text = "Make the two-potion ten-gold purchase work and set the title", options?: Parameters<AssistantSession["sendUserMessage"]>[3]) =>
      session.sendUserMessage(text, event => events.push(event), undefined, options) };
}

describe("functional request acceptance AND independent approval", () => {
  it.each([false, true])("evaluates the exact draft but only verifies applied content (autonomous=%s)", async autonomous => {
    const h = fixture();
    const unsubscribe = store.subscribe(() => h.session.refreshAcceptance(store.getCurrent()));
    let result;
    try { result = await h.send(undefined, { autonomous }); } finally { unsubscribe(); }
    expect(h.reviews).toHaveLength(1);
    expect(h.reviews[0].acceptance).toMatchObject({ items: [{ source: { requestId: "request-1" }, status: "verified",
      evidence: [{ passed: true, expected: JSON.stringify(h.criterion) }] }] });
    expect(h.reviews[0].requiredProblems).toEqual([]);
    expect(result.review?.status).toBe("approved");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe(autonomous ? "verified" : "verifying");
    expect(result.runOutcome).toEqual(autonomous
      ? { execution: "response-final", goal: "satisfied", delivery: "applied" }
      : { execution: "blocked", goal: "incomplete", delivery: "draft" });
    expect(h.session.isDraftReviewApproved()).toBe(!autonomous);
    expect(getMapEditHistoryEntries()).toHaveLength(autonomous ? 1 : 0);
  });

  it.each(["broken", "unresolved"] as const)("model approval cannot override %s request-owned executable checks", async kind => {
    const h = fixture({ broken: kind === "broken", unresolved: kind === "unresolved" });
    const result = await h.send(undefined, { autonomous: true });
    expect(h.reviews.length).toBeGreaterThan(0);
    for (const input of h.reviews) {
      expect(input.requiredProblems.length).toBeGreaterThan(0);
      expect(input.acceptance).toMatchObject({ items: [{ evidence: [{ passed: false }] }] });
    }
    expect(result.review?.status).toBe("changes_requested");
    expect(h.session.isDraftReviewApproved()).toBe(false);
    expect(result.runOutcome).toMatchObject({ goal: "incomplete", delivery: "draft" });
    expect(getMapEditHistoryEntries()).toEqual([]);
    expect(store.getCurrent().system.titleScreen?.title).not.toBe("Reviewed functional title");
  });

  it.each(["rejected", "stale"] as const)("functional success cannot bypass %s independent review", async review => {
    const h = fixture({ review });
    await h.send(undefined, { autonomous: true });
    expect(h.reviews.length).toBeGreaterThan(0);
    for (const input of h.reviews) {
      expect(input.requiredProblems).toEqual([]);
      expect(input.acceptance).toMatchObject({ status: "verified" });
    }
    expect(h.session.isDraftReviewApproved()).toBe(false);
    expect(h.session.getRunOutcome()?.delivery).toBe("draft");
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

  it.each(["ask", "typed-continue", "host-resume"] as const)("retains failing request ownership without borrowing approval on %s", async action => {
    const h = fixture({ broken: true });
    await h.send();
    const original = h.session.getAcceptanceSnapshot()!.items[0];
    const reviewCount = h.reviews.length;
    await h.send(action === "ask" ? "Continue" : "계속", action === "ask" ? { composerMode: "ask" }
      : action === "host-resume" ? { goalAction: "resume" } : undefined);
    const current = h.session.getAcceptanceSnapshot()!.items[0];
    expect(current.source).toEqual(original.source);
    expect(current.id).toBe(original.id);
    expect(current.evidence[0].expected).toBe(original.evidence[0].expected);
    expect(current.evidence[0].passed).toBe(false);
    expect(h.session.isDraftReviewApproved()).toBe(false);
    expect(getMapEditHistoryEntries()).toEqual([]);
    if (action === "ask") {
      expect(h.reviews).toHaveLength(reviewCount);
      expect(h.session.getRunOutcome()?.delivery).toBe("no-change");
    }
  });

  it("retires previously successful functional and review evidence after a live edit", async () => {
    const h = fixture();
    await h.send();
    expect(h.session.isDraftReviewApproved()).toBe(true);
    expect(h.reviews[0].acceptance).toMatchObject({ status: "verified" });
    store.update(project => { project.session.gold = 1; });
    h.session.refreshAcceptance(store.getCurrent());
    expect(h.session.isDraftReviewApproved()).toBe(false);
    expect(h.session.getAcceptanceSnapshot()?.items[0].evidence[0].passed).toBe(false);
    await h.send("Continue", { goalAction: "resume", autonomous: true });
    expect(store.getCurrent().session.gold).toBe(1);
    expect(h.session.isDraftReviewApproved()).toBe(false);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });
});
