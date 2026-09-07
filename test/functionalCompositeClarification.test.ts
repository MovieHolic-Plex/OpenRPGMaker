import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache, INTENT_DECLARATION_TIMEOUT_MS } from "@/ai/intentDeclarationClient";
import type { IntentFacts } from "@/ai/intentDeclaration";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { functionalFixture } from "./fixtures/functionalAcceptance";

const placeholder = { kind: "functionalUnresolved", reason: "Clarify the key, repeat reward and escape ending chain" };
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 };
type Call = { name: string; args: Record<string, unknown> };
const reply = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const refine = (criterion: unknown, selector: Record<string, unknown> = { criterionIndex: 3 }) => ({ requirementId: "acceptance-contract", ...selector, criterion });
function harness(sceneEnding = true, maxToolCalls = config.maxToolCalls) {
  const f = functionalFixture();
  f.destination.width = 12;
  f.destination.height = 10;
  f.project.endings = [{ id: "ending_escape", name: "Escape", conditions: [], priority: 1 }];
  if (sceneEnding) f.seller.pages![0]!.commands = [{ kind: "changeItem", itemId: "item_potion", op: "-=", amount: 1 }, { kind: "triggerEnding", endingId: "ending_escape" }];
  const args = { mapId: f.origin.id, start: f.project.startPos, steps: [
    { kind: "walk", to: { x: f.reward.x, y: f.reward.y }, adjacent: true },
    { kind: "snapshotRewards" }, { kind: "interact", eventId: f.reward.id },
    { kind: "expect", inventoryDelta: { item_potion: 2 }, interactionComplete: true },
    { kind: "snapshotRewards" }, { kind: "interact", eventId: f.reward.id },
    { kind: "expect", inventoryDelta: { item_potion: 0 }, interactionComplete: true },
    { kind: "walk", to: { x: f.seller.x, y: f.seller.y }, adjacent: true },
    { kind: "snapshotRewards" }, { kind: "interact", eventId: f.seller.id },
    { kind: "expect", inventoryDelta: { item_potion: -1 }, endingReached: "ending_escape", interactionComplete: true },
  ] };
  const criterion = { kind: "toolVerdict", tool: "run_scene_test", args, interactionTargets: [
    { stepIndex: 2, mapId: f.origin.id, eventId: f.reward.id },
    { stepIndex: 5, mapId: f.origin.id, eventId: f.reward.id },
    { stepIndex: 9, mapId: f.origin.id, eventId: f.seller.id },
  ] };
  const siblings = [
    { kind: "mapCount", targets: [{ mapId: f.origin.id }, { mapId: f.destination.id }], count: 2 },
    { kind: "mapDimensions", target: { mapId: f.origin.id }, width: f.origin.width, height: f.origin.height },
    { kind: "mapDimensions", target: { mapId: f.destination.id }, width: 12, height: 10 },
  ];
  const requirements: { id: string; title: string; required?: boolean; criteria: unknown[] }[] = [
    { id: "acceptance-contract", title: "Original compound contract", required: true, criteria: [...siblings, placeholder] },
    { id: "preserved", title: "Preserve original map", criteria: [{ kind: "preserve", target: { mapId: f.origin.id } }] },
    { id: "ending", title: "Independent ending", criteria: [placeholder] },
    { id: "optional", title: "Optional", required: false, criteria: [placeholder] },
    { id: "withdrawn", title: "Withdrawn", criteria: [placeholder] },
  ];
  let declaration: Record<string, unknown> = {};
  let classifierFailure = false;
  let timeoutEntered: (() => void) | undefined;
  const requests: ChatRequest[] = [];
  const facts: IntentFacts[] = [];
  const declarer = createLlmIntentDeclarer({ getConfig: () => config, chat: async (_config, request) => {
    requests.push(request);
    if (classifierFailure) throw new Error("offline classifier unavailable");
    if (timeoutEntered) return new Promise<ChatResult>((_resolve, reject) => {
      request.signal!.addEventListener("abort", () => reject(new Error("classifier timeout")), { once: true });
      timeoutEntered!();
    });
    return reply(JSON.stringify({ mode: "modify", space: "none", needsPlan: false, ...declaration }));
  } });
  let calls: Call[] = [];
  const events: SessionEvent[] = [];
  const network = vi.fn(() => { throw new Error("Unexpected network in clarification regression"); });
  vi.stubGlobal("fetch", network);
  const session: AssistantSession = new AssistantSession(f.project, { config: { ...config, maxToolCalls },
    peekPendingUserMessage: () => session.getAuditEntries().some(entry => entry.kind === "user" && entry.text === "계속") ? "User pending" : null,
    declareIntent: async (input, signal) => { facts.push(input); return declarer(input, signal); },
    chat: async (_config, request) => {
      if (!request.tools?.length) return reply(JSON.stringify({ action: "resume" }));
      const queued = calls; calls = [];
      return queued.length ? { message: { role: "assistant", content: null, tool_calls: queued.map((call, index) => ({
        id: `call-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : reply("COMPLETE");
    },
  });
  return { ...f, session, criterion, siblings, requirements, facts, requests, events,
    failClassifier: () => { classifierFailure = true; },
    timeoutClassifier: () => new Promise<void>(resolve => { timeoutEntered = resolve; }),
    async send(text: string, refinements: unknown = [], queued: Call[] = [], options?: Parameters<AssistantSession["sendUserMessage"]>[3]) {
      declaration = { functionalRefinements: refinements }; calls = queued; events.length = 0;
      const result = await session.sendUserMessage(text, event => events.push(event), undefined, options);
      expect(calls).toEqual([]); expect(network).not.toHaveBeenCalled(); return result;
    },
    async adopt(options?: Parameters<AssistantSession["sendUserMessage"]>[3]) {
      await this.send("Retain both existing maps and verify the original chain and independent promises.", [], [{ name: "set_work_plan", args: {
        goal: "Original goal", requirements, layers: [{ title: "Verify", items: [{ id: "verify", title: "Verify", instruction: "Verify originals", requirementIds: ["acceptance-contract"] }] }],
      } }], options);
      expect(session.getAcceptanceSnapshot()?.items.find(item => item.id === "acceptance-contract")?.evidence).toHaveLength(requirements[0]!.criteria.length);
    },
  };
}
const contract = (h: ReturnType<typeof harness>) => h.session.getAcceptanceSnapshot()!.items.find(item => item.id === "acceptance-contract")!;
afterEach(() => { resetIntentDeclarationCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("normal user/classifier dispatch specializes composite functional leaves", () => {
  it("enumerates index 3 on the emitted classifier payload and retains siblings, owners and independent promises", async () => {
    const h = harness(); await h.adopt();
    const before = h.session.getAcceptanceSnapshot()!;
    const withdrawn = { acceptanceId: before.id, requirementId: "withdrawn", reason: "Explicit user withdrawal" };
    expect(h.session.withdrawRequirement(withdrawn)).toBe(true);
    await h.send("Clarify the chain with the exact original reward, repeat and ending_escape consumption.", [refine(h.criterion)]);
    expect(h.facts.at(-1)?.unresolvedFunctional).toEqual(expect.arrayContaining([
      expect.objectContaining({ requirementId: "acceptance-contract", criterionIndex: 3, source: before.items[0]!.source }),
      expect.objectContaining({ requirementId: "ending", criterionIndex: 0 }),
    ]));
    expect(h.facts.at(-1)?.unresolvedFunctional?.map(entry => entry.requirementId)).not.toContain("optional");
    expect(h.facts.at(-1)?.unresolvedFunctional?.map(entry => entry.requirementId)).not.toContain("withdrawn");
    const payload = h.requests.at(-1)!.messages[1]!.content;
    if (typeof payload !== "string") throw new Error("Expected classifier JSON facts");
    const supplied = payload.split("\n").find(line => line.startsWith('[{"requirementId"'));
    expect(JSON.parse(supplied!)).toEqual(h.facts.at(-1)?.unresolvedFunctional);
    expect(contract(h)).toMatchObject({ id: before.items[0]!.id, required: true, source: before.items[0]!.source,
      refinements: [{ requestId: "request-2" }] });
    expect(contract(h).evidence.slice(0, 3)).toEqual(before.items[0]!.evidence.slice(0, 3));
    expect(JSON.parse(contract(h).evidence[3]!.expected)).toEqual(h.criterion);
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "ending")).toEqual(before.items.find(item => item.id === "ending"));
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "withdrawn")?.withdrawal).toMatchObject(withdrawn);
    expect(h.session.getVerificationSnapshot().requirements).toContainEqual(expect.objectContaining({
      checkId: `${before.id}:acceptance-contract:3`, ownerId: `${before.id}:acceptance-contract`, args: h.criterion.args,
      interactionTargets: h.criterion.interactionTargets, initialState: { session: h.project.session, flags: h.project.flags,
        switches: h.project.switches.map(entry => entry.id), variables: h.project.variables.map(entry => entry.id) }, status: "unverified",
    }));
  });

  it("a passing pre-refinement probe grants no authority; fresh exact execution proves ending and consumption", async () => {
    const h = harness(); await h.adopt();
    const scene = { name: "run_scene_test", args: h.criterion.args };
    await h.send("Probe the chain without changing any promises.", [], [scene]);
    expect(h.events).toContainEqual(expect.objectContaining({ type: "tool_call", name: "run_scene_test", result: expect.objectContaining({ ok: true, data: expect.objectContaining({ ok: true }) }) }));
    await h.send("Clarify both original chain and independent ending with this exact scene.", [refine(h.criterion), { requirementId: "ending", criterion: h.criterion }]);
    expect(contract(h).evidence[3]?.passed).toBe(false);
    expect(h.session.getVerificationSnapshot().requirements.every(entry => entry.status === "unverified")).toBe(true);
    await h.send("Execute the newly declared scene.", [], [scene]);
    expect(contract(h).evidence[3]?.passed).toBe(true);
    expect(h.session.getVerificationSnapshot().requirements.every(entry => entry.status === "passed")).toBe(true);
    expect(h.events).toContainEqual(expect.objectContaining({ type: "tool_call", name: "run_scene_test", result: expect.objectContaining({
      data: expect.objectContaining({ ok: true, finalState: expect.objectContaining({ endingsReached: ["ending_escape"], inventory: expect.objectContaining({ item_potion: 1 }) }) }),
    }) }));
  });

  it("protects the original request initial state and preserve baseline across clarification", async () => {
    const h = harness(); await h.adopt();
    const changed = h.session.getProposedProject(); changed.session.gold = 999; changed.maps[h.origin.id]!.name = "Changed";
    expect(h.session.syncBaselineFromStoreIfClean(changed)).toBe(true);
    await h.send("Clarify only the unresolved chain, retaining the original state.", [refine(h.criterion)], [{ name: "run_scene_test", args: h.criterion.args }]);
    expect(h.session.getVerificationSnapshot().requirements[0]?.initialState).toMatchObject({ session: { gold: 100 } });
    expect(contract(h).evidence[3]?.passed).toBe(false);
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "preserved")?.evidence[0]?.passed).toBe(false);
    expect(h.session.syncBaselineFromStoreIfClean(h.project)).toBe(true);
    await h.send("Rerun from the protected original state.", [], [{ name: "run_scene_test", args: h.criterion.args }]);
    expect(contract(h).evidence[3]?.passed).toBe(true);
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "preserved")?.evidence[0]?.passed).toBe(true);
  });

  it.each([{}, { criterionIndex: -1 }, { criterionIndex: 4 }, { criterionIndex: 1 }, { criterionIndex: 1.5 }, { criterionIndex: "3" }, { criterionIndex: 3, requirementId: "missing" }])("rejects invalid/ambiguous selector %j without changing the contract", async selector => {
    const h = harness(); await h.adopt(); const before = contract(h);
    await h.send("Clarify the selected original leaf.", [refine(h.criterion, selector)]);
    expect(contract(h)).toEqual(before); expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
  });

  it.each(["missing-owner", "wrong-event", "duplicate-owner", "boolean-ending", "unknown-args", "unnamed-interaction", "set", "empty", "vacuous", "zero-only", "other-tool"])("rejects %s canonical specialization atomically", async invalid => {
    const h = harness(); await h.adopt(); const before = contract(h);
    const bad = structuredClone(h.criterion) as { kind: string; tool: string; args: Record<string, unknown>; interactionTargets: unknown[] };
    if (invalid === "missing-owner") bad.interactionTargets.pop();
    if (invalid === "wrong-event") bad.interactionTargets[0] = { stepIndex: 2, mapId: h.origin.id, eventId: "foreign" };
    if (invalid === "duplicate-owner") bad.interactionTargets.push(bad.interactionTargets[0]);
    if (invalid === "boolean-ending") bad.args.steps = [{ kind: "interact", eventId: h.seller.id }, { kind: "expect", endingReached: true }];
    if (invalid === "unknown-args") bad.args.passed = true;
    if (invalid === "unnamed-interaction") bad.args.steps = [{ kind: "interact" }, { kind: "expect", endingReached: "ending_escape" }];
    if (invalid === "set") bad.args.steps = [{ kind: "set", inventory: { item_potion: 2 } }, ...h.criterion.args.steps];
    if (invalid === "empty") { bad.args.steps = []; bad.interactionTargets = []; }
    if (invalid === "vacuous" || invalid === "zero-only") {
      bad.args.steps = [{ kind: "interact", eventId: h.seller.id }, { kind: "expect", ...(invalid === "vacuous" ? { interactionComplete: true, mapId: h.origin.id } : { goldDelta: 0, inventoryDelta: {} }) }];
      bad.interactionTargets = [{ stepIndex: 0, mapId: h.origin.id, eventId: h.seller.id }];
    }
    if (invalid === "other-tool") { bad.tool = "run_lint"; bad.args = {}; bad.interactionTargets = []; }
    await h.send("Clarify with a valid entry followed by an invalid entry.", [{ requirementId: "ending", criterion: h.criterion }, refine(bad)]);
    expect(contract(h)).toEqual(before);
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "ending")?.refinements).toBeUndefined();
    expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
  });

  it.each(["unknown-selector", "malformed-entry", "duplicate-selector", "optional", "withdrawn"])("rejects mixed batch %s without a partial valid refinement", async invalid => {
    const h = harness(); await h.adopt();
    expect(h.session.withdrawRequirement({ acceptanceId: h.session.getAcceptanceSnapshot()!.id, requirementId: "withdrawn", reason: "User removed" })).toBe(true);
    const before = contract(h);
    const second = invalid === "malformed-entry" ? { bad: true } : invalid === "duplicate-selector" ? refine(h.criterion)
      : { requirementId: invalid === "unknown-selector" ? "absent" : invalid, criterion: h.criterion };
    await h.send("Clarify both entries together.", [refine(h.criterion), second]);
    expect(contract(h)).toEqual(before); expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
  });

  it.each(["ask", "driver", "continue", "fallback"] as const)("%s cannot acquire refinement authority", async route => {
    if (route === "driver") {
      const h = harness(true, 1);
      await h.adopt({ autonomous: true });
      expect(h.session.getAuditEntries()).toContainEqual(expect.objectContaining({ kind: "user", text: "계속" }));
      expect(h.requests).toHaveLength(1); // Synthetic continuation uses the real classifier fast path.
      expect(JSON.parse(contract(h).evidence[3]!.expected)).toEqual(placeholder);
      expect(contract(h).refinements).toBeUndefined();
      expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
      return;
    }
    const h = harness(); await h.adopt(); const before = contract(h); const count = h.requests.length;
    if (route === "fallback") h.failClassifier();
    await h.send(route === "continue" ? "Continue." : "Clarify the ending chain.", [refine(h.criterion)], [],
      route === "ask" ? { composerMode: "ask" } : undefined);
    expect(contract(h)).toEqual(before); expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
    if (route === "continue") expect(h.requests).toHaveLength(count);
  });

  it("classifier deadline cannot authorize a refinement", async () => {
    const h = harness(); await h.adopt(); const before = contract(h);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const entered = h.timeoutClassifier();
    const sent = h.send("Clarify the ending chain after the deadline.", [refine(h.criterion)]);
    await entered;
    await vi.advanceTimersByTimeAsync(INTENT_DECLARATION_TIMEOUT_MS);
    await sent;
    expect(contract(h)).toEqual(before);
    expect(h.session.getVerificationSnapshot().requirements).toEqual([]);
  });

  it("refines two leaves of one promise atomically and preserves typed expectations and prior refinement metadata", async () => {
    const h = harness(false);
    const known = { kind: "shopPurchase", seller: { eventId: h.seller.id }, item: { id: "item_potion" }, count: 2 };
    h.requirements[0]!.criteria[3] = { ...placeholder, expectations: known };
    h.requirements[0]!.criteria.push(placeholder);
    await h.adopt(); const before = contract(h);
    await h.send("Clarify the entry for the purchase and independently specify the ending scene.", [
      refine({ kind: "shopPurchase", target: { mapId: h.origin.id }, start: h.project.startPos }),
      refine(h.criterion, { criterionIndex: 4 }),
    ]);
    const partial = contract(h);
    expect(partial.refinements).toHaveLength(1);
    expect(JSON.parse(partial.evidence[3]!.expected)).toMatchObject({ expectations: { ...known, target: { mapId: h.origin.id }, start: h.project.startPos } });
    expect(JSON.parse(partial.evidence[4]!.expected)).toEqual(h.criterion);
    await h.send("A scene cannot replace the known purchase quantities.", [refine(h.criterion)]);
    expect(contract(h)).toEqual(partial);
    await h.send("Keep two potions at ten gold each.", [refine({ kind: "shopPurchase", unitPrice: 10 })]);
    expect(contract(h).evidence[3]?.passed).toBe(true);
    expect(contract(h).evidence.slice(0, 3)).toEqual(before.evidence.slice(0, 3));
    expect(contract(h).source).toEqual(before.source);
    expect(contract(h).refinements).toEqual([partial.refinements![0], expect.objectContaining({ requestId: "request-4" })]);
    expect(contract(h).evidence[4]).toEqual(partial.evidence[4]);
  });

  it.each(["shopPurchase", "mapRoundTrip", "npcReward"] as const)("retains existing concrete kind %s at composite index 3", async kind => {
    const h = harness(false); await h.adopt(); const before = contract(h);
    const criterion = kind === "shopPurchase" ? { kind, target: { mapId: h.origin.id }, start: h.project.startPos,
      seller: { eventId: h.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 }
      : kind === "mapRoundTrip" ? { kind, target: { mapId: h.origin.id }, start: h.project.startPos,
        destination: { mapId: h.destination.id }, outgoing: { eventId: h.outgoing.id }, returning: { eventId: h.returning.id } }
      : { kind, requirement: { target: { mapId: h.origin.id, eventId: h.reward.id }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true } };
    await h.send("Clarify the original requested concrete behavior.", [refine(criterion)]);
    expect(contract(h).evidence.slice(0, 3)).toEqual(before.evidence.slice(0, 3));
    expect(contract(h).evidence[3]?.passed).toBe(true);
    expect(JSON.parse(contract(h).evidence[3]!.expected)).toEqual(criterion);
    const accepted = contract(h);
    await h.send("Worker repair and replan do not replace the now-concrete leaf.", [refine(h.criterion)], [
      { name: "repair_acceptance", args: { itemId: "acceptance-contract", criteria: [...h.siblings, h.criterion] } },
      { name: "set_work_plan", args: { goal: "Replacement", requirements: [{ id: "acceptance-contract", title: "Replacement", required: false, criteria: [h.criterion] }],
        layers: [{ title: "Read", items: [{ title: "Read", instruction: "Read" }] }] } },
    ]);
    expect(contract(h)).toEqual(accepted);
    expect(h.events).toContainEqual(expect.objectContaining({ type: "tool_call", name: "repair_acceptance", result: expect.objectContaining({ ok: false }) }));
  });
});
