import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { fixedDeclarer } from "./intentFixture";
import { CHIEF, prerequisiteFixture } from "./npcPrerequisiteFixture";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";

const COMPLETE = "NPC_PREREQUISITE_COMPLETION_SENTINEL";
const final = (): ChatResult => ({ message: { role: "assistant", content: COMPLETE }, finishReason: "stop" });
const call = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null, tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function harness(f: ReturnType<typeof prerequisiteFixture>, replies: (ChatResult | Error)[]) {
  const events: SessionEvent[] = [];
  const requests: ChatRequest[] = [];
  const session = new AssistantSession(f.project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 18, maxTokens: 32000 },
    declareIntent: fixedDeclarer({ mode: "modify", npcRewards: [f.requirement] }),
    chat: async (_config, request) => { requests.push(request); const next = replies.shift(); if (next instanceof Error) throw next; return offlineChatResponse(next ?? final()); },
  });
  const onEvent = (e: SessionEvent) => events.push(e);
  const results = (name = "verify_npc_reward") => events.filter((e): e is Extract<SessionEvent, { type: "tool_call" }> => e.type === "tool_call" && e.name === name).map(e => e.result);
  return { session, replies, requests, events, onEvent, results };
}
afterEach(() => resetIntentDeclarationCache());
describe("request-bound verify_npc_reward session tool", () => {
  it("R1 exposes the tool and completes through its real session boundary", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude })]);
    const before = structuredClone(f.project);
    const result = await h.session.sendUserMessage("Verify the chief reward after acquiring the key", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(result.assistantText).toBe(COMPLETE);
    const schema = h.requests[0]?.tools?.find(t => t.function.name === "verify_npc_reward")?.function.parameters;
    expect(schema).toMatchObject({ additionalProperties: false, required: ["requirementIndex", "prelude"] });
    expect(Object.keys((schema as { properties: object }).properties).sort()).toEqual(["prelude", "requirementIndex"]);
    const ordinarySchema = h.requests[0]?.tools?.find(t => t.function.name === "set_build_spec")?.function.parameters;
    expect(ordinarySchema).toMatchObject({ properties: { reason: { type: "string" } }, required: expect.arrayContaining(["reason"]) });
    expect(h.session.getProposedProject()).toEqual(before);
  });
  it.each([
    { extra: true }, { passed: true }, { receipt: {} }, { reason: "Not an admitted field" }, { state: { gold: 20 } }, { requirementIndex: 99 },
    { prelude: [{ kind: "set", mapId: "map_blank_start", gold: 20 }] },
    { prelude: [{ kind: "move", mapId: "map_blank_start", to: { x: 2, y: 2 } }] },
    { prelude: [{ kind: "interact", mapId: "map_blank_start" }] },
    { prelude: [{ kind: "expect", goldDelta: 20 }] },
    { prelude: [{ kind: "walk", mapId: "map_blank_start", to: { x: 2, y: 2, extra: true } }] },
  ])("R10 rejects malformed input before execution %j", async extra => {
    const f = prerequisiteFixture();
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude, ...extra })]);
    await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results()[0]).toMatchObject({ ok: false, data: { executed: false } });
    expect(h.session.getProposedProject()).toEqual(f.project);
  });
  it("R12 valid failed replacement cannot fall back to an old pass or fresh-local proof", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
      call("verify_npc_reward", { requirementIndex: 0, prelude: [] }),
    ]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results().map(r => r.ok)).toEqual([true, false]);
    expect(result.assistantText).not.toContain(COMPLETE);
  });
  it("R12 preserves witness across retry and replan without weakening the requirement", async () => {
    const f = prerequisiteFixture();
    const interruption = Object.assign(new Error("Test authentication interruption"), { status: 401, name: "LlmError" });
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }), interruption]);
    expect((await h.session.sendUserMessage("Verify the chief reward", h.onEvent)).stoppedReason).toBe("error");
    h.replies.push(call("set_work_plan", { goal: "Finish", layers: [{ title: "Finish", items: [{ title: "Check", instruction: "Inspect database then finish", successTools: ["get_database_records"] }] }] }),
      call("get_database_records", { collection: "items" }), call("complete_work_item", { itemId: "L1-1" }));
    const retried = await h.session.retryLastTurn(h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(retried.assistantText).toBe(COMPLETE);
    expect(h.results("complete_work_item")[0]?.ok).toBe(true);
  });
  it("R13 cannot erase an unrelated failed scene check", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [
      call("run_scene_test", { mapId: f.village.id, start: f.project.startPos, steps: [{ kind: "expect", variableEquals: { unrelated: 99 } }] }),
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
    ]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results("run_scene_test")[0]?.data).toMatchObject({ ok: false });
    expect(h.results()[0]?.ok).toBe(true);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("R11/12 replays current content after a pass, replan, explicit completion and final skip", async () => {
    const f = prerequisiteFixture();
    const brokenChest = structuredClone(f.chest);
    brokenChest.pages![0].commands = [];
    const h = harness(f, [
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
      call("upsert_event", { mapId: f.cellar.id, event: brokenChest }),
      call("set_work_plan", { goal: "Finish", layers: [{ title: "Finish", items: [{ title: "Finish", instruction: "Finish existing reward request", successTools: ["get_database_records"] }] }] }),
      call("get_database_records", { collection: "items" }), call("complete_work_item", { itemId: "L1-1" }), call("skip_work_item", { itemId: "L1-1", note: "Ignore missing key" }),
    ]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(h.results("upsert_event")[0]?.ok).toBe(true);
    expect(h.results("complete_work_item")[0]?.ok).toBe(false);
    expect(h.results("skip_work_item")[0]?.ok).toBe(false);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("R12 preserves witness and immutable selections over a real user continuation", async () => {
    const f = prerequisiteFixture();
    const interruption = Object.assign(new Error("Test authentication interruption"), { status: 401, name: "LlmError" });
    const h = harness(f, [
      call("set_work_plan", { goal: "Finish", layers: [{ title: "Finish", items: [{ title: "Check", instruction: "Inspect database then finish", successTools: ["get_database_records"] }] }] }),
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }), interruption,
    ]);
    expect((await h.session.sendUserMessage("Verify the chief reward", h.onEvent)).stoppedReason).toBe("error");
    h.replies.push({ message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" },
      call("get_database_records", { collection: "items" }), call("complete_work_item", { itemId: "L1-1" }));
    const result = await h.session.sendUserMessage("계속", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(h.results("complete_work_item")[0]?.ok).toBe(true);
    expect(result.assistantText).toBe(COMPLETE);
  });

  it("R12 a new request lifetime does not inherit the earlier route", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude })]);
    expect((await h.session.sendUserMessage("Verify the chief reward", h.onEvent)).assistantText).toBe(COMPLETE);
    const result = await h.session.sendUserMessage("Verify this as a new independent reward request", h.onEvent);
    expect(result.assistantText).not.toContain(COMPLETE);
    expect(h.results()).toHaveLength(1);
  });

  it("R12 never falls back to an easier fresh-local pass after content changes", async () => {
    const f = prerequisiteFixture();
    const earlyChief = structuredClone(f.chief);
    earlyChief.pages = [earlyChief.pages![1], earlyChief.pages![2]];
    earlyChief.pages[0].conditions = [];
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }), call("upsert_event", { mapId: f.village.id, event: earlyChief })]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(h.results("upsert_event")[0]?.ok).toBe(true);
    expect(verifyNpcRewardsPlayable(h.session.getProposedProject(), [f.requirement]).ok).toBe(true);
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("R12 a valid replacement is run afresh and can repair a failed route", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: [] }), call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude })]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results().map(r => r.ok)).toEqual([false, true]);
    expect(result.assistantText).toBe(COMPLETE);
  });

  it("R12 keeps the stored program private from observer-owned arguments", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude })]);
    const result = await h.session.sendUserMessage("Verify the chief reward", event => {
      h.onEvent(event);
      if (event.type === "tool_call" && event.name === "verify_npc_reward" && Array.isArray(event.args?.prelude)) event.args.prelude.splice(0);
    });
    expect(h.results()[0]?.ok).toBe(true);
    expect(result.assistantText).toBe(COMPLETE);
  });

  it("R6 rejects session witness replacement after a same-named NPC moves to another map", async () => {
    const f = prerequisiteFixture();
    f.requirement = { ...f.requirement, target: { eventName: CHIEF } };
    const h = harness(f, [
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
      call("remove_event", { mapId: f.village.id, eventId: CHIEF }),
      call("upsert_event", { mapId: f.cellar.id, event: f.chief }),
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
    ]);
    const result = await h.session.sendUserMessage("Verify the chief reward", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(h.results("remove_event")[0]?.ok).toBe(true);
    expect(h.results("upsert_event")[0]?.ok).toBe(true);
    expect(h.results()[1]).toMatchObject({ ok: false, data: { executed: false } });
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it("R12 preserves the witness through the milestone application rebase boundary", async () => {
    const f = prerequisiteFixture();
    const interruption = Object.assign(new Error("Test authentication interruption"), { status: 401, name: "LlmError" });
    const h = harness(f, [call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }), interruption]);
    expect((await h.session.sendUserMessage("Verify the chief reward", h.onEvent)).stoppedReason).toBe("error");
    h.session.rebaseProject(structuredClone(h.session.getProposedProject()));
    expect((await h.session.retryLastTurn(h.onEvent)).assistantText).toBe(COMPLETE);
    expect(h.results()).toHaveLength(1);
  });

  it("R13 a reward proof cannot clear image or original-baseline change obligations", async () => {
    const f = prerequisiteFixture();
    const h = harness(f, [
      call("set_work_plan", { goal: "Required acceptance", acceptance: [
        { id: "image", title: "Image", criteria: [{ kind: "imageReviewed", target: { mapId: f.village.id } }] },
        { id: "change", title: "Change", criteria: [{ kind: "targetChange", target: { mapId: f.village.id } }] },
      ], layers: [{ title: "Finish", items: [{ title: "Check", instruction: "Verify reward", successTools: ["verify_npc_reward"] }] }] }),
      call("verify_npc_reward", { requirementIndex: 0, prelude: f.prelude }),
      call("complete_work_item", { itemId: "L1-1" }), call("review_acceptance", { itemId: "image", verdict: "pass", note: "Fake review" }),
    ]);
    const before = structuredClone(f.project);
    const result = await h.session.sendUserMessage("Verify reward while preserving acceptance obligations", h.onEvent);
    expect(h.results()[0]?.ok).toBe(true);
    expect(h.results("review_acceptance")[0]?.ok).toBe(false);
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(h.session.getProposedProject()).toEqual(before);
    expect(result.assistantText).not.toContain(COMPLETE);
  });
});
