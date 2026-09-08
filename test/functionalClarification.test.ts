import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { functionalFixture } from "./fixtures/functionalAcceptance";

const originalText = "The seller must sell two potions; clarify the missing price and entry.";
const clarificationText = "Use the project entry and test_seller, two item_potion at ten gold each.";
const id = "request-1:functional:0";
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 10 };
const final = (): ChatResult => ({ message: { role: "assistant", content: "CLARIFICATION_COMPLETE" }, finishReason: "stop" });
const call = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function setup(first: unknown, next: readonly Record<string, unknown>[]) {
  const f = functionalFixture();
  const full = { kind: "shopPurchase", target: { mapId: f.origin.id }, start: f.project.startPos,
    seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 };
  let declarationIndex = 0;
  let userText = originalText;
  const factsSeen: unknown[] = [];
  const declarer = createLlmIntentDeclarer({ getConfig: () => config,
    audit: async () => ({ message: { role: "assistant", content: JSON.stringify(declarationIndex === 1
      ? { requirements: [{ text: originalText, criteria: [first] }] }
      : { requirements: [], clarifies: [{ requirementId: id, text: userText }] }) }, finishReason: "stop" }),
    chat: async () => ({
    message: { role: "assistant", content: JSON.stringify({ mode: "modify", space: "none", needsPlan: false,
      ...(declarationIndex++ === 0 ? { functionalAcceptance: [first] } : next[declarationIndex - 2]) }) }, finishReason: "stop",
  }) });
  const declareIntent: IntentDeclarer = async (facts, signal) => { factsSeen.push(facts); userText = facts.userText; return declarer(facts, signal); };
  const worker: ChatResult[] = [];
  const events: SessionEvent[] = [];
  const session = new AssistantSession(f.project, { config, declareIntent, chat: async () => worker.shift() ?? final() });
  return { ...f, full, session, worker, events, factsSeen,
    send: (text: string, options?: Parameters<AssistantSession["sendUserMessage"]>[3]) => session.sendUserMessage(text, event => events.push(event), undefined, options) };
}
const known = { kind: "shopPurchase", seller: { eventId: "test_seller" }, item: { id: "item_potion" }, count: 2 };
const unresolved = { kind: "functionalUnresolved", reason: "Specify price and entry", expectations: known };
const full = { ...known, target: { mapId: "map_blank_start" }, start: { x: 1, y: 1 }, unitPrice: 10 };
const refinement = (criterion: unknown, corrections?: string[]) => ({ functionalRefinements: [{ requirementId: id, criterion, ...(corrections ? { corrections } : {}) }] });
afterEach(resetIntentDeclarationCache);

describe("trusted user clarification refines original unresolved acceptance", () => {
  it("resolves a reason-only placeholder through the next actual user declaration, retaining source and identity", async () => {
    const h = setup({ kind: "functionalUnresolved", reason: "Specify quantity and price" }, [refinement(full)]);
    await h.send(originalText);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await h.send(clarificationText);
    expect(h.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id,
      source: { requestId: "request-1", text: originalText },
      refinements: [{ requestId: "request-2", text: clarificationText }], evidence: [{ passed: true }] }] });
    expect(h.session.getAcceptanceSnapshot()?.items).toHaveLength(1);
    expect(h.factsSeen[1]).toMatchObject({ unresolvedFunctional: [{ requirementId: id, source: { text: originalText } }] });
  });
  it("also accepts a genuine user clarification sent through the host resume action", async () => {
    const h = setup(unresolved, [refinement(full)]);
    await h.send(originalText);
    await h.send(clarificationText, { goalAction: "resume" });
    expect(h.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id,
      source: { requestId: "request-1" }, refinements: [{ requestId: "request-2", text: clarificationText }] }] });
  });
  it("retains known expectations during partial clarification, then completes when the missing price is supplied", async () => {
    const h = setup(unresolved, [refinement({ kind: "shopPurchase", target: full.target, start: full.start }), refinement({ kind: "shopPurchase", unitPrice: 10 })]);
    await h.send(originalText);
    await h.send("Use the actual project entry; I have not specified price yet.");
    const partial = h.session.getAcceptanceSnapshot();
    expect(partial?.status).toBe("blocked");
    expect(JSON.parse(partial!.items[0].evidence[0].expected)).toMatchObject({ kind: "functionalUnresolved", expectations: { ...known, target: full.target, start: full.start } });
    await h.send("The price is ten gold each.");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(JSON.parse(h.session.getAcceptanceSnapshot()!.items[0].evidence[0].expected)).toEqual(full);
  });
  it("rejects conflicting known quantities unless the trusted declaration identifies an explicit user correction", async () => {
    const h = setup(unresolved, [refinement({ ...full, count: 1 }), refinement({ ...full, count: 1 }, ["count"])]);
    await h.send(originalText);
    await h.send(clarificationText);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await h.send("Correction: I want one potion, not two, for ten gold.");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(JSON.parse(h.session.getAcceptanceSnapshot()!.items[0].evidence[0].expected)).toEqual({ ...full, count: 1 });
  });
  it("worker repair and replacement plans cannot resolve a placeholder or weaken its resolved contract", async () => {
    const h = setup(unresolved, [refinement(full), refinement({ ...full, count: 1 }, ["count"])]);
    const replacement = () => call("set_work_plan", { goal: "Replace", layers: [{ title: "Work", items: [{ title: "Read", instruction: "Read" }] }],
      requirements: [{ id, title: "Easy", required: false, criteria: [{ ...full, count: 1 }] }] });
    h.worker.push(call("repair_acceptance", { itemId: id, criteria: [full] }), replacement());
    await h.send(originalText);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    h.worker.push(call("repair_acceptance", { itemId: id, criteria: [{ ...full, count: 1 }] }), replacement());
    await h.send(clarificationText);
    expect(h.session.getAcceptanceSnapshot()?.items[0].status).toBe("verified");
    expect(JSON.parse(h.session.getAcceptanceSnapshot()!.items[0].evidence[0].expected)).toEqual(full);
    await h.send("Another attempted refinement of the already concrete requirement.");
    expect(JSON.parse(h.session.getAcceptanceSnapshot()!.items[0].evidence[0].expected)).toEqual(full);
    expect(h.events.filter(event => event.type === "tool_call" && event.name === "repair_acceptance").every(event => event.type === "tool_call" && !event.result.ok)).toBe(true);
  });
  it("a still ambiguous or unlinked declaration cannot retire the original obligation", async () => {
    const h = setup(unresolved, [refinement({ kind: "functionalUnresolved", reason: "Still ambiguous" }),
      { functionalRefinements: [{ requirementId: "not-the-original", criterion: full }] }]);
    await h.send(originalText);
    await h.send("I'm not sure about the price.");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await h.send(clarificationText);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });
});
