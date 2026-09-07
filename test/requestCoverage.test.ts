import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { functionalFixture } from "./fixtures/functionalAcceptance";
import { parseRequestCoverage } from "@/ai/requestCoverage";

const config = { ...defaultAiConfig(), agentMode: "chat" as const, autonomyLevel: undefined, model: "test", liteModel: "test", maxToolCalls: 8 };
const reply = (value: unknown): ChatResult => ({ message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" });
afterEach(resetIntentDeclarationCache);

describe("independent request coverage enters the canonical ledger", () => {
  it("accepts the JSON fence returned by the live companion without dropping any clauses", () => {
    const facts = { userText: "Keep the sunset time undecided", currentMap: null, selection: null, maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false };
    const requirements = [{ text: facts.userText, criteria: [{ kind: "functionalUnresolved", reason: "No sunset evaluator" }] }];
    expect(parseRequestCoverage("```json\n" + JSON.stringify({ requirements }) + "\n```", facts, [])).toEqual(requirements);
  });
  it("retains words omitted even by the independent extractor as an unverified canonical obligation", async () => {
    const { project, origin, seller } = functionalFixture();
    let calls = 0;
    const session = new AssistantSession(project, { config, chat: async () => reply("COMPLETE"),
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => reply(++calls === 1
        ? { mode: "modify", needsPlan: false }
        : { requirements: [{ text: "Buy two potions", criteria: [{ kind: "shopPurchase", target: { mapId: origin.id }, start: project.startPos,
          seller: { eventId: seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 }] }] }) }),
    });
    await session.sendUserMessage("Buy two potions; refuse purchases after sunset.", () => {});
    const snapshot = session.getAcceptanceSnapshot();
    expect(snapshot?.items[0].evidence[0].passed).toBe(true);
    expect(snapshot?.items.some(item => item.evidence.some(evidence => !evidence.passed && evidence.observed.includes("refuse purchases after sunset")))).toBe(true);
    expect(session.getRunOutcome()?.goal).not.toBe("satisfied");
  });
  it.each(["omission", "empty", "invalid", "network"])("cannot satisfy a partial plan after %s coverage", async failure => {
    const { project, origin } = functionalFixture();
    let calls = 0, workerCalls = 0;
    const repairs: boolean[] = [];
    const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
      tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
    const session = new AssistantSession(project, { config,
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => {
        if (++calls === 1) return reply({ mode: "modify", needsPlan: false });
        if (failure === "network") throw new Error("coverage unavailable");
        return failure === "invalid" ? reply({}) : reply({ requirements: failure === "empty" ? [] : [
          { text: "refuse purchases after sunset", criteria: [{ kind: "functionalUnresolved", reason: "Sunset time is undecided and this behavior has no evaluator" }] },
        ] });
      } }),
      chat: async () => {
        if (++workerCalls === 1) return tool("set_work_plan", { goal: "Only count a map", layers: [{ title: "Work", items: [{ id: "work", title: "Read", instruction: "Read" }] }],
          requirements: [{ id: "request-1:coverage:0:0", title: "Optional easy substitute", required: false,
            criteria: [{ kind: "mapCount", targets: [{ mapId: origin.id }], count: 1 }] }] });
        if (workerCalls === 2) return tool("skip_work_item", { itemId: "work" });
        if (workerCalls === 3) return tool("repair_acceptance", { itemId: "request-1:coverage:0:0",
          criteria: [{ kind: "mapCount", targets: [{ mapId: origin.id }], count: 1 }] });
        return reply("COMPLETE");
      },
    });
    await session.sendUserMessage("Make a merchant; refuse purchases after sunset, but do not invent the sunset time.", event => {
      if (event.type === "tool_call" && event.name === "repair_acceptance") repairs.push(event.result.ok);
    });
    const snapshot = session.getAcceptanceSnapshot();
    expect(calls).toBe(2);
    expect(repairs).toEqual([false]);
    expect(snapshot?.items.some(item => item.required && item.source?.requestId === "request-1" && item.evidence.some(e => !e.passed))).toBe(true);
    expect(session.getRunOutcome()?.goal).not.toBe("satisfied");
    expect(snapshot?.items[0]?.evidence[0]?.expected).toContain('"kind":"functionalUnresolved"');
    expect(session.withdrawRequirement({ acceptanceId: snapshot!.id, requirementId: snapshot!.items[0].id, reason: "User explicitly removes this obligation" })).toBe(true);
    expect(project.maps[origin.id]).toBe(origin);
  });

  it("links every independently extracted clause to real immutable checks", async () => {
    const { project, origin, seller } = functionalFixture();
    const criteria = [{ kind: "shopPurchase", target: { mapId: origin.id }, start: project.startPos,
      seller: { eventId: seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 }];
    let calls = 0;
    const session = new AssistantSession(project, { config, chat: async () => reply("COMPLETE"),
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => reply(++calls === 1
        ? { mode: "modify", needsPlan: false }
        : { requirements: [{ text: "Let me buy two potions for ten gold each", criteria }] }) }),
    });
    await session.sendUserMessage("Let me buy two potions for ten gold each", () => {});
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [
      { id: "request-1:coverage:0:0", title: "Let me buy two potions for ten gold each", required: true, evidence: [{ passed: true }] },
    ] });
    const changed = structuredClone(project);
    changed.session.gold = 1;
    session.refreshAcceptance(changed);
    expect(session.getAcceptanceSnapshot()?.items[0].evidence[0].passed).toBe(false);
  });

  it("does not create obligations or run an audit for genuine questions", async () => {
    const { project } = functionalFixture();
    let calls = 0;
    const session = new AssistantSession(project, { config, chat: async () => reply("ANSWER"),
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => { calls++; return reply({ mode: "question" }); } }),
    });
    await session.sendUserMessage("How do shops work?", () => {}, undefined, { composerMode: "ask" });
    expect(calls).toBe(1);
    expect(session.getAcceptanceSnapshot()).toBeNull();
  });

  it.each([false, true])("keeps grouped R2 clarification and resume coverage distinct (audit failure=%s)", async auditFailure => {
    const { project, origin, seller } = functionalFixture();
    const firstText = "Keep this map and let me buy two potions at a price I will specify.";
    const nextText = "The price is ten gold each.";
    const known = { kind: "shopPurchase", target: { mapId: origin.id }, start: project.startPos,
      seller: { eventId: seller.id }, item: { id: "item_potion" }, count: 2 };
    const requirementId = "request-1:coverage:0:1";
    let turn = 0;
    const factsSeen: unknown[] = [];
    const declarer = createLlmIntentDeclarer({ getConfig: () => config,
      chat: async () => reply(++turn === 1 ? { mode: "modify", needsPlan: false }
        : { mode: "modify", needsPlan: false, functionalRefinements: [{ requirementId, criterion: { kind: "shopPurchase", unitPrice: 10 } }] }),
      audit: async () => reply(turn === 1 ? { requirements: [{ text: firstText, criteria: [
        { kind: "mapCount", targets: [{ mapId: origin.id }], count: 1 },
        { kind: "functionalUnresolved", reason: "Price is unspecified", expectations: known },
      ] }] } : { requirements: [], clarifies: auditFailure ? [] : [{ requirementId, text: nextText }] }),
    });
    const session = new AssistantSession(project, { config, chat: async () => reply("COMPLETE"),
      declareIntent: (facts, signal) => { factsSeen.push(facts); return declarer(facts, signal); } });
    await session.sendUserMessage(firstText, () => {});
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await session.sendUserMessage(nextText, () => {}, undefined, { goalAction: "resume" });
    expect(factsSeen[1]).toMatchObject({ unresolvedFunctional: [{ requirementId }] });
    expect(session.getAcceptanceSnapshot()?.status).toBe(auditFailure ? "blocked" : "verified");
    expect(session.getAcceptanceSnapshot()?.items.slice(0, 2)).toMatchObject([
      { evidence: [{ passed: true }] }, { id: requirementId, source: { requestId: "request-1", text: firstText },
        refinements: [{ text: nextText }], evidence: [{ passed: true }] },
    ]);
    if (auditFailure) expect(session.getAcceptanceSnapshot()?.items[2]).toMatchObject({
      required: true, source: { requestId: "request-2", text: nextText }, evidence: [{ passed: false }],
    });
  });
});
