import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { NpcRewardRequirement } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import type { Command, GameEvent } from "@/project/types";
import { declaredIntent } from "./intentFixture";

const NPC = "npc_amendment";
const OLD = "Set NPC reward amount to 2";
const NEW = "Change NPC reward amount to 3 instead";
const OTHER = "Set ether reward amount to 4";
const AMBIGUOUS = "Set the other reward amount to 2";
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture", apiKey: "fixture", maxToolCalls: 1, autonomyLevel: "balanced" as const };
const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const reward = (count: number, itemId = "item_potion", oneTime = true): NpcRewardRequirement => ({ target: { eventId: NPC }, grants: [{ kind: "item", id: itemId, count }], oneTime });
function npc(amount: number, ether = 4, repeat = false, ambiguous = false): GameEvent {
  const commands: Command[] = [
    { kind: "changeItem", itemId: "item_potion", op: "+=", amount },
    { kind: "changeItem", itemId: ambiguous ? "item_potion" : "item_ether", op: "+=", amount: ether },
    ...(!repeat ? [{ kind: "setSelfSwitch", key: "A", value: true } satisfies Command] : []),
  ];
  const page = { id: "grant", name: "Reward", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" as const }, priority: "same" as const,
    overlapForbidden: true, movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands };
  return { id: NPC, name: "Reward", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [page,
    ...(!repeat ? [{ ...page, id: "claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "Claimed" }] } satisfies NonNullable<GameEvent["pages"]>[number]] : []),
  ] };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://fixture.invalid"); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory(); resetIntentDeclarationCache();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetIntentDeclarationCache(); });

type Options = { pending?: boolean; other?: "retain" | "violate"; partialPending?: boolean; lateValid?: boolean; ambiguous?: boolean; repeat?: boolean;
  amendment?: "missing" | "wrong-id" | "forged-anchor" | "mismatched-field" | "recovery" };
function setup(options: Options = {}) {
  const project = createBlankProject(), mapId = project.startMapId;
  project.maps[mapId]!.events = [npc(1, options.ambiguous ? 1 : 4, false, options.ambiguous)]; store.replace(project);
  const oldRaw = options.other || options.partialPending ? `${OLD}; ${OTHER}` : options.ambiguous ? `${OLD}; ${AMBIGUOUS}` : OLD;
  let amount = 2, writes = 0, declarations = 0;
  const repairs: string[] = [], requests: ChatRequest[] = [], events: SessionEvent[] = [];
  const entry = (raw: string, quote: string, value: number, commandIndex: number, bound = true) => ({ source: [anchor(raw, quote)], criteria: [{
    kind: "valueEquals", subject: { kind: "event", mapId, eventId: NPC }, path: ["pages", "0", "commands", String(commandIndex), "amount"], value,
  }], bindings: bound ? [{ source: { start: raw.indexOf(quote) + quote.indexOf(String(value)), end: raw.indexOf(quote) + quote.indexOf(String(value)) + 1, quote: String(value) }, role: "value", criterionIndex: 0, fieldPath: ["value"] }] : [] });
  const session = new AssistantSession(project, { config, contextOptions: { currentMapId: mapId }, declareIntent: async facts => {
    declarations++;
    const amended = facts.userText === NEW;
    if (!facts.extractionRepair) amount = amended ? 3 : 2;
    if (facts.extractionRepair) repairs.push(facts.extractionRepair.requestId);
    const includeAmendment = amended && options.amendment !== "missing" && (options.amendment !== "recovery" || declarations > 2);
    const source = anchor(NEW);
    const entries = amended ? [entry(NEW, NEW, 3, options.amendment === "mismatched-field" ? 1 : 0, options.amendment !== "recovery" || declarations > 2)]
      : [entry(oldRaw, OLD, 2, 0), ...(options.other || options.partialPending ? [entry(oldRaw, OTHER, 4, 1)] : options.ambiguous ? [entry(oldRaw, AMBIGUOUS, 2, 1)] : [])];
    const oldRewards = options.other ? [{ ...reward(2), grants: [...reward(2).grants, ...reward(4, "item_ether").grants] }] : [reward(2)];
    return { intent: declaredIntent({ mode: "modify", npcRewards: !amended && (options.pending || options.partialPending) && !(options.lateValid && facts.extractionRepair) ? { invalidReason: "Malformed original reward extraction" }
      : amended ? [reward(3, "item_potion", !options.repeat)] : oldRewards,
      requestRequirements: { entries, ...(includeAmendment ? { amendments: [{ obligationId: options.amendment === "wrong-id" ? "request-1:source:99" : "request-1:source:0",
        source: options.amendment === "forged-anchor" ? { ...source, quote: "forged" } : source }] } : {}) },
    }), elapsedMs: 0 };
  }, chat: async (_config, request): Promise<ChatResult> => {
    requests.push(request);
    if (!request.tools?.length) return { message: { role: "assistant", content: '{"action":"direct"}' }, finishReason: "stop" };
    writes++;
    return { message: { role: "assistant", content: null, tool_calls: [{ id: `amend_${writes}`, type: "function", function: {
      name: "upsert_event", arguments: JSON.stringify({ mapId, event: npc(amount, amount === 3 && options.other === "violate" ? 0 : options.ambiguous ? 1 : 4, amount === 3 && options.repeat, options.ambiguous) }),
    } }] }, finishReason: "tool_calls" };
  } });
  const collect = (event: SessionEvent) => events.push(event);
  const runFirst = () => session.sendUserMessage(oldRaw, collect, undefined, { autonomous: !(options.pending || options.partialPending || options.ambiguous) });
  const runAmendment = async () => {
    const beforeWrites = writes, controller = new AbortController();
    return session.sendUserMessage(NEW, event => {
      collect(event);
      if (event.type === "run_state" && event.execution.state === "recovering"
        && (repairs.length > 0 || (writes > beforeWrites && (options.amendment !== "recovery" || declarations > 2)))) controller.abort();
    }, controller.signal, { autonomous: true });
  };
  const activeRewards = (): NpcRewardRequirement[] => {
    const content = requests.at(-1)?.messages.slice().reverse().find(message => typeof message.content === "string" && message.content.startsWith("[NPC reward contract] "))?.content;
    if (typeof content !== "string") throw new Error("Expected active machine reward contract");
    return JSON.parse(content.slice("[NPC reward contract] ".length).split(" — ")[0]!);
  };
  return { session, project, oldRaw, runFirst, runAmendment, repairs, activeRewards, events };
}

describe("source-approved NPC reward amendments", () => {
  it.each(["zero-grant", "repeatable"] as const)("host source withdrawal retires only its owned count, not %s enforcement", async violation => {
    const h = setup(); await h.runFirst();
    const snapshot = h.session.getAcceptanceSnapshot();
    if (!snapshot) throw new Error("Missing canonical source assessment");
    expect(h.session.withdrawRequirement({ acceptanceId: snapshot.id, requirementId: "request-1:source:0", reason: "No exact count required" })).toBe(true);
    store.update(project => { project.maps[project.startMapId]!.events = [npc(3)]; });
    h.session.refreshAcceptance(store.getCurrent());
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("verified");
    store.update(project => { project.maps[project.startMapId]!.events = [npc(violation === "zero-grant" ? 0 : 3, 4, violation === "repeatable")]; });
    h.session.refreshAcceptance(store.getCurrent());
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(h.session.getAcceptanceSnapshot()?.items.find(item => item.id === "request-1:source:0")?.withdrawal?.source).toBe("user");
    expect(snapshot.items[0]?.withdrawal).toBeUndefined();
  });

  it.each([false, true])("NPC-amendment-2-to-3-retires-owned-count-pending=%s", async pending => {
    const h = setup({ pending });
    const first = await h.runFirst();
    expect(first.execution?.state).toBe(pending ? "manual-segment" : "verified-local");
    const result = await h.runAmendment();
    expect(result.execution?.state).toBe("verified-local");
    expect(h.repairs).toEqual([]);
    expect(verifyNpcRewardsPlayable(store.getCurrent(), [reward(3)]).ok).toBe(true);
    expect(h.activeRewards().flatMap(requirement => requirement.grants).some(grant => grant.count === 2)).toBe(false);
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([
      { rawInstruction: OLD, units: [{ source: anchor(OLD), supersededBy: "request-2" }] },
      { rawInstruction: NEW, units: [{ source: anchor(NEW), coverage: "declared" }] },
    ]);
  });

  it.each(["retain", "violate"] as const)("NPC-amendment-keeps-unrelated-same-target-grant-%s", async other => {
    const h = setup({ other });
    expect((await h.runFirst()).execution?.state).toBe("verified-local");
    const result = await h.runAmendment();
    expect(result.execution?.state).toBe(other === "retain" ? "verified-local" : "aborted");
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), [reward(3)]).ok).toBe(true);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), [reward(4, "item_ether")]).ok).toBe(other === "retain");
    const grants = h.activeRewards().flatMap(requirement => requirement.grants);
    expect(grants.some(grant => grant.kind === "item" && grant.id === "item_potion" && grant.count === 2)).toBe(false);
    expect(grants.some(grant => grant.kind === "item" && grant.id === "item_ether" && grant.count === 4)).toBe(true);
    const units = h.session.getHarnessSnapshot().requests![0]!.units;
    expect(units[0]?.supersededBy).toBe("request-2"); expect(units[1]?.supersededBy).toBeUndefined();
  });

  it("NPC-amendment-of-amount-does-not-waive-one-time-condition", async () => {
    const h = setup({ repeat: true });
    expect((await h.runFirst()).execution?.state).toBe("verified-local");
    expect((await h.runAmendment()).execution?.state).toBe("aborted");
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), [reward(3, "item_potion", false)]).ok).toBe(true);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), [reward(3)]).ok).toBe(false);
    expect(h.activeRewards().some(requirement => requirement.oneTime && requirement.grants.some(grant => grant.id === "item_potion" && grant.count === undefined))).toBe(true);
  });

  it.each(["missing", "wrong-id", "forged-anchor", "mismatched-field", "recovery"] as const)("NPC-amendment-without-ledger-authority-keeps-original-%s", async amendment => {
    const h = setup({ amendment }); await h.runFirst();
    expect((await h.runAmendment()).execution?.state).toBe("aborted");
    expect(h.session.getHarnessSnapshot().requests![0]!.units[0]?.supersededBy).toBeUndefined();
    expect(h.activeRewards().flatMap(requirement => requirement.grants).some(grant => grant.count === 2)).toBe(true);
  });

  it("NPC-amendment-partial-supersession-keeps-ambiguous-pending-extraction", async () => {
    const h = setup({ partialPending: true }); await h.runFirst();
    expect((await h.runAmendment()).execution?.state).toBe("aborted");
    expect(h.repairs).toEqual(["request-1"]);
    expect(h.events.filter(event => event.type === "tool_call")).toEqual([]);
    const units = h.session.getHarnessSnapshot().requests![0]!.units;
    expect(units[0]?.supersededBy).toBe("request-2"); expect(units[1]?.supersededBy).toBeUndefined();
  });

  it.each(["retain", "violate"] as const)("NPC-amendment-late-valid-partial-recovery-projects-owned-count-ether-%s", async other => {
    const h = setup({ pending: true, lateValid: true, other });
    expect((await h.runFirst()).execution?.state).toBe("manual-segment");
    const result = await h.runAmendment();
    expect(result.execution?.state).toBe(other === "retain" ? "verified-local" : "aborted");
    expect(h.repairs).toEqual(["request-1"]);
    expect(verifyNpcRewardsPlayable(store.getCurrent(), [reward(3)]).ok).toBe(true);
    expect(verifyNpcRewardsPlayable(store.getCurrent(), [reward(4, "item_ether")]).ok).toBe(other === "retain");
    const active = h.activeRewards(), grants = active.flatMap(requirement => requirement.grants);
    expect(grants.some(grant => grant.id === "item_potion" && grant.count === 2)).toBe(false);
    expect(grants.some(grant => grant.id === "item_potion" && grant.count === 3)).toBe(true);
    expect(grants.some(grant => grant.id === "item_ether" && grant.count === 4)).toBe(true);
    expect(active.some(requirement => requirement.oneTime && requirement.grants.some(grant => grant.id === "item_potion" && grant.count === undefined))).toBe(true);
    expect(h.session.getHarnessSnapshot().requests).toMatchObject([
      { rawInstruction: `${OLD}; ${OTHER}`, units: [{ source: anchor(h.oldRaw, OLD), supersededBy: "request-2" }, { source: anchor(h.oldRaw, OTHER) }] },
      { rawInstruction: NEW, units: [{ coverage: "declared" }] },
    ]);
    expect(h.session.getHarnessSnapshot().requests![0]!.units[1]?.supersededBy).toBeUndefined();
  });

  it("NPC-amendment-ambiguous-grant-to-source-mapping-cannot-retire-count", async () => {
    const h = setup({ ambiguous: true }); await h.runFirst();
    expect((await h.runAmendment()).execution?.state).toBe("aborted");
    expect(h.session.getHarnessSnapshot().requests![0]!.units[0]?.supersededBy).toBe("request-2");
    expect(h.activeRewards().flatMap(requirement => requirement.grants).some(grant => grant.count === 2)).toBe(true);
  });
});
