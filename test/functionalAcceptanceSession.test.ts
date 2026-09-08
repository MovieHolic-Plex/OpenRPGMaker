import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createLlmIntentDeclarer, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { functionalFixture } from "./fixtures/functionalAcceptance";

const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 16 };
const final = (): ChatResult => ({ message: { role: "assistant", content: "FUNCTIONAL_COMPLETE" }, finishReason: "stop" });
const call = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function harness(options: { invalid?: boolean; ordinary?: boolean; noRewards?: boolean; gold?: number; planner?: boolean; steps?: ChatResult[] } = {}) {
  const fixture = functionalFixture();
  const { project, origin, destination, outgoing, returning, seller, reward } = fixture;
  if (options.gold !== undefined) project.session.gold = options.gold;
  const functionalAcceptance = [
    { kind: "shopPurchase", target: { mapId: origin.id }, start: project.startPos, seller: { eventId: seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 },
    { kind: "mapRoundTrip", target: { mapId: origin.id }, start: project.startPos, destination: { mapId: destination.id }, outgoing: { eventId: outgoing.id }, returning: { eventId: returning.id } },
  ];
  const npcRewards = [{ target: { eventId: reward.id }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true }];
  const declaration = { mode: options.ordinary ? "question" : "modify", space: "none", needsPlan: options.planner === true,
    ...(options.ordinary ? {} : { functionalAcceptance: options.invalid ? [{ kind: "shopPurchase" }] : functionalAcceptance,
      ...(options.noRewards ? {} : { npcRewards }) }) };
  const intent = createLlmIntentDeclarer({ getConfig: () => config,
    audit: async () => ({ message: { role: "assistant", content: JSON.stringify({ requirements: [{
      text: "Allow buying two potions at ten gold, round-trip travel, and Mira's two-potion one-time reward",
      criteria: [...functionalAcceptance, ...(options.noRewards ? [] : npcRewards.map(requirement => ({ kind: "npcReward", requirement })))],
    }] }) }, finishReason: "stop" }),
    chat: async () => ({ message: { role: "assistant", content: JSON.stringify(declaration) }, finishReason: "stop" }) });
  const events: SessionEvent[] = [];
  let index = 0;
  let plannerCalls = 0;
  const session = new AssistantSession(project, { config, declareIntent: intent, chat: async (_config, request) => {
    if (options.planner && !request.tools?.length) {
      plannerCalls++;
      return { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", goal: "Unrelated planner replacement",
        layers: [{ title: "Read", items: [{ title: "Read", instruction: "Read only", successTools: ["get_database_records"] }] }] }) }, finishReason: "stop" };
    }
    return options.steps?.[index++] ?? final();
  } });
  return { ...fixture, session, events, plannerCalls: () => plannerCalls, run: () => session.sendUserMessage("Allow buying two potions at ten gold, round-trip travel, and Mira's two-potion one-time reward", event => events.push(event)) };
}
afterEach(resetIntentDeclarationCache);

describe("request declaration to immutable functional session acceptance", () => {
  it("adopts all requested checks through the actual lite declaration parser without manually injected plan criteria", async () => {
    const h = harness();
    await h.run();
    expect(h.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [
      { required: true, source: { requestId: "request-1" }, evidence: [{ passed: true }] },
      { required: true, evidence: [{ passed: true }] }, { required: true, evidence: [{ passed: true }] },
    ] });
  });
  it("keeps mandatory behavior when the actual planner returns unrelated work without criteria", async () => {
    const h = harness({ planner: true, gold: 1, steps: [call("skip_work_item", { itemId: "L1-1" })] });
    expect((await h.run()).assistantText).not.toBe("FUNCTIONAL_COMPLETE");
    expect(h.plannerCalls()).toBeGreaterThan(0);
    expect(h.session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ required: true, evidence: [{ passed: false }] });
  });
  it("does not impose unrequested functional requirements", async () => {
    const h = harness({ ordinary: true });
    h.origin.events = [];
    expect((await h.run()).assistantText).toBe("FUNCTIONAL_COMPLETE");
    expect(h.session.getAcceptanceSnapshot()).toBeNull();
  });
  it("keeps malformed functional declarations blocked instead of dropping them", async () => {
    const h = harness({ invalid: true });
    expect((await h.run()).assistantText).not.toBe("FUNCTIONAL_COMPLETE");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });
  it("retains expectations across plan replacement, skip and attempted repair", async () => {
    const plan = { goal: "Replacement", layers: [{ title: "Work", items: [{ id: "work", title: "Read only", instruction: "Read only" }] }] };
    const h = harness({ noRewards: true, gold: 1, steps: [
      call("set_work_plan", plan), call("skip_work_item", { itemId: "work" }),
      call("set_work_plan", { ...plan, requirements: [{ id: "request-1:functional:0", title: "Easy", required: false,
        criteria: [{ kind: "mapCount", targets: [{ mapId: "map_blank_start" }], count: 1 }] }] }),
      call("repair_acceptance", { itemId: "request-1:functional:0", criteria: [{ kind: "mapCount", targets: [{ mapId: "map_blank_start" }], count: 1 }] }),
    ] });
    const result = await h.run();
    expect(result.assistantText).not.toBe("FUNCTIONAL_COMPLETE");
    expect(h.session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ required: true, evidence: [{ passed: false }] });
    expect(h.events.find(event => event.type === "tool_call" && event.name === "repair_acceptance")).toMatchObject({ result: { ok: false } });
  });
  it("revalidates latest canonical content and cannot retain stale success", async () => {
    const h = harness();
    await h.run();
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    const changed = structuredClone(h.project);
    changed.session.gold = 1;
    h.session.refreshAcceptance(changed);
    expect(h.session.getAcceptanceSnapshot()?.items[0].evidence[0].passed).toBe(false);
  });
});
