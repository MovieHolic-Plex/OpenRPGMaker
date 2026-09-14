import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";

const final = (content = "ANSWER"): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", maxToolCalls: 12, maxTokens: 16000 } as const;
beforeEach(() => {
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(() => { resetIntentDeclarationCache(); resetMapEditHistory(); vi.restoreAllMocks(); });

function fixture(responses: ChatResult[], reviewer = approvedReviewResponse,
  declareIntent: AssistantSessionOptions["declareIntent"] = fixedDeclarer({ mode: "other" })) {
  const reviews: NonNullable<ReturnType<typeof independentReviewPayload>>[] = [];
  const requests: ChatRequest[] = [];
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent,
    yieldToUi: async () => {}, chat: async (_config, request) => {
      const input = independentReviewPayload(request);
      if (input) { reviews.push(input); return reviewer(request) ?? final(); }
      requests.push(request);
      return responses.shift() ?? final();
    } });
  return { session, reviews, requests };
}

describe("P2 projection composed with independent review", () => {
  it.each(["optional", "withdrawn"] as const)("does not turn %s requirements into independent-review blockers", async kind => {
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    const responses = [tool("set_work_plan", { goal: "Title", requirements: [{ id: "size", title: "Size",
      required: kind !== "optional", criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width + 1, height: map.height }] }],
      layers: [{ title: "Title", items: [{ title: "Title", instruction: "Set title", successTools: ["set_title_screen"] }] }] }),
      tool("set_title_screen", { title: "Reviewed title" })];
    const f = fixture(responses);
    const result = await f.session.sendUserMessage("Set title", event => {
      if (kind === "withdrawn" && event.type === "tool_call" && event.name === "set_work_plan") {
        const snapshot = f.session.getAcceptanceSnapshot();
        if (!snapshot) throw new Error("Missing adopted contract");
        expect(f.session.withdrawRequirement({ acceptanceId: snapshot.id, requirementId: "size", reason: "User scope change" })).toBe(true);
      }
    });
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]?.requiredProblems).toEqual([]);
    expect(result.review?.status).toBe("approved");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
    expect(store.getCurrent().system.titleScreen?.title).not.toBe("Reviewed title");
  });

  it.each([false, true])("keeps exact explicit draft verification and applied satisfaction distinct (autonomous=%s)", async autonomous => {
    const mapId = store.getCurrent().startMapId;
    const args = { mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    const f = fixture([tool("set_work_plan", { goal: "Title and route", requirements: [{ id: "route", title: "Route",
      criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }],
      layers: [{ title: "Work", items: [{ title: "Title", instruction: "Set title", successTools: ["set_title_screen"] }] }] }),
      tool("set_title_screen", { title: "Reviewed route" }), tool("check_reachability", args)]);
    const unsubscribe = store.subscribe(() => f.session.refreshAcceptance(store.getCurrent()));
    let result;
    try { result = await f.session.sendUserMessage("Title and route", undefined, undefined, { autonomous }); }
    finally { unsubscribe(); }
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]?.requiredProblems).toEqual([]);
    expect(result.review?.status).toBe("approved");
    expect(result.runOutcome).toEqual(autonomous
      ? { execution: "response-final", goal: "satisfied", delivery: "applied" }
      : { execution: "blocked", goal: "incomplete", delivery: "draft" });
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.status).toBe(autonomous ? "verified" : "verifying");
    expect(getMapEditHistoryEntries()).toHaveLength(autonomous ? 1 : 0);
    expect(f.session.isDraftReviewApproved()).toBe(!autonomous);
  });

  it.each(["ask", "plan-question"] as const)("answers %s without reviewing or authorizing a retained cancelled draft", async mode => {
    let asking = false;
    const f = fixture([tool("set_title_screen", { title: "Cancelled title" })], approvedReviewResponse,
      facts => fixedDeclarer({ mode: asking ? "question" : "other" })(facts));
    const controller = new AbortController();
    await f.session.sendUserMessage("Set title", event => { if (event.type === "tool_call") controller.abort(); }, controller.signal);
    asking = true;
    const result = await f.session.sendUserMessage("Why?", () => {}, undefined, { composerMode: mode === "ask" ? "ask" : "plan" });
    expect(f.reviews).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.assistantText).toBe("ANSWER");
    expect(result.proposedCalls).toEqual([]);
    expect(result.runOutcome?.delivery).toBe("no-change");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(f.session.getProposedProject().system.titleScreen?.title).toBe("Cancelled title");
  });

  it.each(["rejected", "budget"] as const)("projects %s review execution honestly without authorizing the draft", async ending => {
    const f = fixture([tool("set_title_screen", { title: "Unapproved title" })], request => {
      const input = independentReviewPayload(request);
      if (!input) return null;
      return final(JSON.stringify({ revision: input.revision, verdict: "changes_requested", summary: "Wrong title",
        findings: [{ id: "title", target: "/system/titleScreen/title", problem: "Wrong title", requestedChange: "Correct title", validation: "Read title" }] }));
    });
    if (ending === "budget") f.session.updateConfig({ ...config, maxToolCalls: 2 });
    const result = await f.session.sendUserMessage("Set title");
    expect(result.runOutcome).toEqual({ execution: ending === "budget" ? "budget-exhausted" : "blocked", goal: "unassessed", delivery: "draft" });
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

  it("resumes a failed new goal from its pre-await review baseline and fresh original context", async () => {
    let fail = false;
    const responses = [tool("set_title_screen", { title: "Committed old goal" }), final()];
    const f = fixture(responses, approvedReviewResponse,
      facts => { if (fail) throw new Error("NEW_GOAL_ENTRY_FAILURE"); return fixedDeclarer({ mode: "other" })(facts); });
    await f.session.sendUserMessage("Set title", undefined, undefined, { autonomous: true });
    store.update(project => {
      const item = project.database.items.find(item => item.id === "item_potion");
      if (!item) throw new Error("Missing fixture potion");
      item.price = 777;
    });
    fail = true;
    await f.session.sendUserMessage("New item goal", undefined, undefined, { goalAction: "new-goal" });
    fail = false;
    responses.push(tool("upsert_item", { item: { id: "item_potion", price: 888 } }));
    const resumed = await f.session.sendUserMessage("Continue", undefined, undefined, { goalAction: "resume" });
    expect(resumed.review?.status).toBe("approved");
    const reviewed = f.reviews.at(-1);
    const before = reviewed?.before.flatMap(context => context.entries);
    expect(before?.find(entry => entry.id === "/system")?.value).toMatchObject({ titleScreen: { title: "Committed old goal" } });
    expect(reviewed?.changes.find(change => change.path === "/database/items/item_potion")?.before).toMatchObject({ price: 777 });
    const originals = f.requests.at(-1)?.messages.flatMap(message => {
      if (message.role !== "user" || typeof message.content !== "string") return [];
      try {
        const parsed = JSON.parse(message.content);
        return parsed.originalContext ? [parsed.originalContext] : [];
      } catch { return []; } // Ordinary conversation text is not an original-context envelope.
    });
    expect(originals).toHaveLength(1);
    expect(originals?.[0].entries).toContainEqual({ entryId: "/system", value: store.getCurrent().system });
    expect(f.session.getProposedProject().database.items.find(item => item.id === "item_potion")?.price).toBe(888);
  });

  it("retires approval before a fresh send can fail in intent preparation", async () => {
    let fail = false;
    const f = fixture([tool("set_title_screen", { title: "Old approved title" })], approvedReviewResponse,
      facts => { if (fail) throw new Error("ENTRY_FAILURE"); return fixedDeclarer({ mode: "other" })(facts); });
    const old = await f.session.sendUserMessage("Set title");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    fail = true;
    const pending = f.session.sendUserMessage("Another request");
    try { expect(f.session.isDraftReviewApproved()).toBe(false); }
    finally { await pending; }
    expect(f.session.getRunOutcome()?.execution).toBe("failed");
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(old.review?.status).toBe("approved");
  });

  it("cannot keep apply authority when the host publishes rejection", async () => {
    const f = fixture([tool("set_title_screen", { title: "Rejected apply" })]);
    const result = await f.session.sendUserMessage("Set title");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    f.session.recordApplyRejected();
    expect(result.runOutcome).toEqual({ execution: "failed", goal: "unassessed", delivery: "draft" });
    expect(f.session.isDraftReviewApproved()).toBe(false);
    expect(f.session.getResultReview()?.status).toBe("unapproved");
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

  it("retires old review ownership synchronously at new-goal entry before fallible preparation", async () => {
    const f = fixture([tool("set_title_screen", { title: "Old approved title" })]);
    const old = await f.session.sendUserMessage("Set title");
    expect(old.review?.status).toBe("approved");
    const pending = f.session.sendUserMessage("New goal", () => {}, undefined, { goalAction: "new-goal" });
    try {
      expect(f.session.isDraftReviewApproved()).toBe(false);
      expect(f.session.getResultReview()).toBeNull();
    } finally { await pending; }
    expect(old.review?.status).toBe("approved");
  });
});
