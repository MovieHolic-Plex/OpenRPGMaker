import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { NpcRewardRequirements } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";
import { declaredIntent, fixedDeclarer } from "./intentFixture";

const COMPLETE = "MODEL_COMPLETION_SENTINEL";
const NPC = "ev_reward_session";
describe.each(["items-monsters", "gold"] as const)("%s reward lifecycle", rewardKind => {
const REQUIRED: NpcRewardRequirements = [{
  target: { eventId: NPC }, oneTime: true,
  grants: rewardKind === "gold" ? [{ kind: "gold", count: 20 }]
    : [{ kind: "item", id: "item_potion", count: 2 }, { kind: "monster", id: "species_leafling", count: 1 }],
}];
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 18, maxTokens: 32000 };
const final = (): ChatResult => ({ message: { role: "assistant", content: COMPLETE }, finishReason: "stop" });
function call(name: string, args: unknown): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: `${name}_call`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}
function npc(variant: "text" | "once" | "repeat"): GameEvent {
  const grants: Command[] = variant === "text" ? [] : rewardKind === "gold" ? [{ kind: "changeGold", op: "+=", amount: 20 }] : [
    { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
    { kind: "giveMonster", speciesId: "species_leafling", level: 5 },
  ];
  const page = {
    id: "reward", name: "Mira", conditions: [], graphic: { transparent: true },
    trigger: { kind: "action" as const }, priority: "same" as const, overlapForbidden: true,
    movement: { type: "fixed" as const, speed: 3, frequency: 3 },
    commands: [...grants, { kind: "text", body: "Here are your rewards." } satisfies Command,
      ...(variant !== "repeat" ? [{ kind: "setSelfSwitch", key: "A", value: true } satisfies Command] : [])],
  };
  return { id: NPC, name: "Mira", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [page,
    ...(variant !== "repeat" ? [{ ...page, id: "claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "Already claimed." }] } satisfies NonNullable<GameEvent["pages"]>[number]] : []),
  ] };
}
const plan = (tools: string[]) => ({ goal: "Reward request", layers: [{ title: "Author", items: tools.map((tool, i) => ({ title: `Item ${i}`, instruction: `Use ${tool}`, successTools: [tool] })) }] });
function harness(steps: readonly (ChatResult | Error)[], options: { required?: NpcRewardRequirements; noContract?: boolean; declarer?: IntentDeclarer; maxToolCalls?: number; pause?: () => string | null } = {}) {
  const project = createBlankProject();
  project.session.gold = 37;
  project.maps[project.startMapId].events = [];
  const requests: ChatRequest[] = [];
  const events: SessionEvent[] = [];
  let index = 0;
  const session = new AssistantSession(project, {
    config: { ...config, ...(options.maxToolCalls ? { maxToolCalls: options.maxToolCalls } : {}) },
    declareIntent: options.declarer ?? fixedDeclarer({ mode: "modify", npcRewards: options.noContract ? undefined : options.required ?? REQUIRED }),
    peekPendingUserMessage: options.pause,
    chat: async (_config, request) => {
      requests.push(request);
      const next = steps[index++];
      if (next instanceof Error) throw next;
      return next ?? final();
    },
  });
  return { session, project, requests, events, onEvent: (event: SessionEvent) => events.push(event) };
}
const writeNpc = (mapId: string, variant: "text" | "once" | "repeat") => call("upsert_event", { mapId, event: npc(variant) });
const tools = (events: SessionEvent[], name: string) => events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call" && event.name === name);
const hasContract = (request: ChatRequest) => request.messages.some((message) => typeof message.content === "string" && message.content.includes(JSON.stringify(REQUIRED)));

afterEach(() => resetIntentDeclarationCache());

describe("NPC reward request lifetime in AssistantSession", () => {
  it("does not dispatch authoring or planner calls for an unrepairable reward declaration", async () => {
    const h = harness([call("set_title_screen", { title: "Must not change" })], {
      required: { invalidReason: "npcRewards: invalid target" },
    });
    const originalTitle = h.project.meta.title;
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent, undefined, { autonomous: true });
    expect(h.requests).toHaveLength(0);
    expect(h.events.filter((event) => event.type === "tool_call")).toEqual([]);
    expect(h.session.getProposedProject().meta.title).toBe(originalTitle);
    expect(result.stoppedReason).toBe("error");
  });

  it.each([
    { variant: "text", pass: false, noContract: false },
    { variant: "once", pass: true, noContract: false },
    { variant: "repeat", pass: false, noContract: false },
    { variant: "text", pass: true, noContract: true },
  ] as const)("direct $variant NPC, contract opt-out=$noContract", async ({ variant, pass, noContract }) => {
    const mapId = createBlankProject().startMapId;
    const h = harness([writeNpc(mapId, variant)], { noContract });
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "upsert_event")[0]?.result.ok).toBe(true);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), noContract ? undefined : REQUIRED).ok).toBe(pass);
    expect(result.assistantText === COMPLETE).toBe(pass);
    if (!pass) expect(h.events.filter((event) => event.type === "assistant_message").some((event) => event.content.includes(COMPLETE))).toBe(false);
    expect(h.requests.length).toBeLessThanOrEqual(7);
  });

  it.each(([[], { invalidReason: "npcRewards: invalid grant" }, [{ target: { eventId: "missing_npc" }, grants: [{ kind: "item", id: "item_potion", count: 1 }] }]] satisfies NpcRewardRequirements[]).map((required) => ({ required })))("does not finalize unresolved or invalid obligations %j", async ({ required }) => {
    const h = harness([], { required });
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(result.assistantText).not.toContain(COMPLETE);
    expect(h.requests.length).toBeLessThanOrEqual(5);
  });

  it("uses bounded repair to correct the real NPC rather than weaken the request", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([writeNpc(mapId, "text"), final(), writeNpc(mapId, "once"), final()]);
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "upsert_event")).toHaveLength(2);
    expect(result.assistantText).toBe(COMPLETE);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), REQUIRED).ok).toBe(true);
  });

  it("allows an earlier DB item but refuses final explicit completion and skip with missing rewards", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([
      call("set_work_plan", plan(["upsert_item", "upsert_event"])),
      call("upsert_item", { item: { id: "item_potion", name: "Revised potion" } }),
      writeNpc(mapId, "text"), call("complete_work_item", { itemId: "L1-2" }), call("skip_work_item", { itemId: "L1-2", note: "Skip reward" }),
    ]);
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "upsert_item")[0]?.result.ok).toBe(true);
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(tools(h.events, "complete_work_item")[0]?.result.ok).toBe(false);
    expect(tools(h.events, "skip_work_item")[0]?.result.ok).toBe(false);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("gates a non-final item that actually authors the declared NPC", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([call("set_work_plan", plan(["upsert_event", "upsert_item"])), writeNpc(mapId, "text"), call("complete_work_item", { itemId: "L1-1" })]);
    await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "complete_work_item")[0]?.result.ok).toBe(false);
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
  });

  it("cannot erase the obligation by replanning into an unrelated skipped plan", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([call("set_work_plan", plan(["upsert_event", "upsert_item"])), writeNpc(mapId, "text"), call("set_work_plan", plan(["get_database_records"])), call("skip_work_item", { itemId: "L1-1", note: "Everything is unnecessary" })]);
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "set_work_plan")).toHaveLength(2);
    expect(tools(h.events, "skip_work_item")[0]?.result.ok).toBe(false);
    expect(result.assistantText).not.toContain(COMPLETE);
    expect(h.requests.every(hasContract)).toBe(true);
  });

  it("rechecks a previously completed NPC after its grants are removed", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([call("set_work_plan", plan(["upsert_event"])), writeNpc(mapId, "once"), writeNpc(mapId, "text"), call("complete_work_item", { itemId: "L1-1" })]);
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "upsert_event").every((event) => event.result.ok)).toBe(true);
    expect(h.events.some(event => event.type === "work_plan" && event.plan.layers[0]?.items[0]?.status === "done")).toBe(true);
    expect(tools(h.events, "complete_work_item")[0]?.result.ok).toBe(false);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("completes an actual one-time NPC plan and accepts idempotent explicit completion", async () => {
    const mapId = createBlankProject().startMapId;
    const h = harness([call("set_work_plan", plan(["upsert_event"])), writeNpc(mapId, "once"), call("complete_work_item", { itemId: "L1-1" })]);
    const result = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(tools(h.events, "complete_work_item")[0]?.result.ok).toBe(true);
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(result.assistantText).toBe(COMPLETE);
  });

  it("preserves the obligation through plan-only confirmation and the actual planner replan", async () => {
    let declarations = 0;
    const planner = (action: string, tools: string[]): ChatResult => ({ message: { role: "assistant", content: JSON.stringify({ action, ...plan(tools) }) }, finishReason: "stop" });
    const h = harness([planner("new_plan", ["upsert_event"]), planner("replan", ["get_database_records"]), call("skip_work_item", { itemId: "L1-1", note: "No reward work left" })], {
      declarer: async () => { declarations++; return { intent: declaredIntent({ mode: "modify", needsPlan: true, npcRewards: REQUIRED }), elapsedMs: 0 }; },
    });
    await h.session.sendUserMessage("Plan the requested reward NPC", h.onEvent, undefined, { composerMode: "plan" });
    expect(tools(h.events, "upsert_event")).toHaveLength(0);
    const result = await h.session.sendUserMessage("계속", h.onEvent);
    expect(declarations).toBe(1);
    expect(h.session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.startsWith("planner:replan"))).toBe(true);
    expect(tools(h.events, "skip_work_item")[0]?.result.ok).toBe(false);
    expect(h.requests.every(hasContract)).toBe(true);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("retains the captured requirement and context on retryLastTurn", async () => {
    const mapId = createBlankProject().startMapId;
    const error = Object.assign(new Error("Test authentication interruption"), { status: 401, name: "LlmError" });
    const h = harness([writeNpc(mapId, "text"), error]);
    expect((await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent)).stoppedReason).toBe("error");
    const retryAt = h.requests.length;
    const result = await h.session.retryLastTurn(h.onEvent);
    expect(result.assistantText).not.toContain(COMPLETE);
    expect(h.requests.slice(retryAt).every(hasContract)).toBe(true);
  });

  it("preserves the request across the real autonomous synthetic continuation", async () => {
    let declarations = 0;
    let calls = 0;
    const h = harness([call("set_work_plan", plan(["upsert_event", "upsert_item"]))], {
      maxToolCalls: 1,
      declarer: async () => { declarations++; return { intent: declaredIntent({ mode: "modify", npcRewards: REQUIRED }), elapsedMs: 0 }; },
      pause: () => ++calls >= 2 ? "User has a new message" : null,
    });
    await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent, undefined, { autonomous: true });
    expect(declarations).toBe(1);
    expect(h.session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.startsWith("agent_run:auto-continue"))).toBe(true);
    expect(h.requests.length).toBeGreaterThan(1);
    expect(h.requests.every(hasContract)).toBe(true);
  });

  it.each(["new-request", "ask"] as const)("clears old obligations for %s", async (mode) => {
    let declarations = 0;
    const h = harness([], { declarer: async () => ({ intent: declaredIntent({ mode: "modify", ...(declarations++ === 0 || mode === "ask" ? { npcRewards: REQUIRED } : {}) }), elapsedMs: 0 }) });
    const initial = await h.session.sendUserMessage("Create the requested reward NPC", h.onEvent);
    expect(initial.assistantText).not.toContain(COMPLETE);
    const at = h.requests.length;
    const next = await h.session.sendUserMessage("An unrelated question", h.onEvent, undefined, { composerMode: mode === "ask" ? "ask" : "do" });
    expect(next.assistantText).toBe(COMPLETE);
    expect(h.requests.slice(at).some(hasContract)).toBe(false);
  });
});
});
