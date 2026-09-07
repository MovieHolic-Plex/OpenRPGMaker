import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import type { Command } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { fixedDeclarer } from "./intentFixture";
import { CHIEF, event, page, prerequisiteFixture } from "./npcPrerequisiteFixture";

type Component = "gold" | "item" | "monster";
const ITEM = "item_potion";
const SPECIES = "species_leafling";
const reward = (kind: Component, amount = 20): Command[] => kind === "gold"
  ? [{ kind: "changeGold", op: "+=", amount }]
  : kind === "item" ? [{ kind: "changeItem", itemId: ITEM, op: "+=", amount }]
  : Array.from({ length: amount }, (): Command => ({ kind: "giveMonster", speciesId: SPECIES, level: 5 }));
const grant = (kind: Component) => kind === "gold" ? { kind, count: 20 } as const
  : { kind, id: kind === "item" ? ITEM : SPECIES, count: 20 } as const;
const delta = (kind: Component, amount: number) => kind === "gold" ? { gold: amount }
  : kind === "item" ? { inventory: { [ITEM]: amount } } : { monsters: { [SPECIES]: amount } };

function approachFixture(kind: Component = "gold", earlyAmount = 20, explicit = false) {
  const f = prerequisiteFixture();
  f.requirement = { ...f.requirement, grants: [grant(kind)] };
  f.prelude.splice(0);
  f.chief.pages = [
    page("touch", [...reward(kind, earlyAmount), { kind: "setSwitch", switchId: "accepted", value: true }], [], { kind: "playerTouch" }, false),
    page("claim", [...reward(kind), { kind: "setSwitch", switchId: "paid", value: true }], [{ kind: "switch", switchId: "accepted", value: true }], { kind: "action" }, false),
    page("claimed", [], [{ kind: "switch", switchId: "paid", value: true }], { kind: "action" }, false),
  ];
  for (const p of f.chief.pages) p.footprint = { width: 3, height: 1 };
  if (explicit) f.prelude.push({ kind: "walk", mapId: f.village.id, to: { x: 5, y: 2 }, adjacent: true });
  return f;
}
function run(f: ReturnType<typeof prerequisiteFixture>) {
  const before = structuredClone(f.project);
  const result = verifyNpcRewardsPlayable(f.project, [f.requirement], new Map([[f.requirement, f.witness]]));
  expect(f.project).toEqual(before);
  return result;
}

afterEach(() => resetIntentDeclarationCache());
describe("bound NPC interactions before the protected claim snapshot", () => {
  it.each(["gold", "item", "monster"] as const)("rejects early %s equally on host and explicit approaches", kind => {
    for (const explicit of [false, true]) {
      const result = run(approachFixture(kind, 20, explicit));
      expect(result.ok, JSON.stringify(result)).toBe(false);
      expect(result.evidence?.[0]?.claim).toBeUndefined();
      expect(result.evidence?.[0]?.repeat).toBeUndefined();
      expect(result.evidence?.[0]?.final).toMatchObject(delta(kind, kind === "gold" ? 57 : 20));
    }
  });

  it.each(["gold", "item", "monster"] as const)("accepts zero early %s then exact +20 / 0 on both approaches", kind => {
    for (const explicit of [false, true]) {
      const result = run(approachFixture(kind, 0, explicit));
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.evidence?.[0]).toMatchObject({ claim: delta(kind, 20), repeat: delta(kind, 0), final: delta(kind, kind === "gold" ? 57 : 20) });
    }
  });

  it.each(["gold", "item"] as const)("rejects negative early %s delta, not just extra payment", kind => {
    const f = approachFixture(kind, -1);
    f.project.session.inventory[ITEM] = 1;
    if (kind === "item") f.chief.pages![0].commands[0] = { kind: "changeItem", itemId: ITEM, op: "-=", amount: 1 };
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(false);
    expect(result.evidence?.[0]?.claim).toBeUndefined();
  });

  it.each([false, true])("checks every touch within one walk, explicit=%s", explicit => {
    const f = approachFixture("gold", 20, explicit);
    f.chief.pages![0].commands[1] = { kind: "setSwitch", switchId: "first_touch", value: true };
    f.chief.pages!.splice(1, 0, page("refund", [
      ...reward("gold", -20), { kind: "setSwitch", switchId: "accepted", value: true },
    ], [{ kind: "switch", switchId: "first_touch", value: true }], { kind: "playerTouch" }, false));
    for (const p of f.chief.pages!) p.footprint = { width: 5, height: 1 };
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ movementSteps: 1, final: { gold: 57 } });
    expect(result.evidence?.[0]?.claim).toBeUndefined();
  });

  it("a nested foreign chaser cannot retire the early NPC interaction's baseline", () => {
    const f = prerequisiteFixture();
    const arrival = page("arrival", [{ kind: "setSwitch", switchId: "arrived", value: true }], [], { kind: "eventTouch" }, false);
    arrival.movement = { type: "chase", speed: 3, frequency: 8, pathfind: false };
    f.village.events.push(event("arrival", 6, 3, [arrival,
      page("arrived", [], [{ kind: "switch", switchId: "arrived", value: true }], { kind: "action" }, false),
    ]));
    f.chief.pages![0].commands.unshift({ kind: "wait", ms: 2000 }, ...reward("gold"));
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(false);
    expect(result.evidence?.[0], JSON.stringify(result)).toMatchObject({ phase: "prelude", final: { gold: 57 } });
    expect(result.evidence?.[0]?.claim).toBeUndefined();
  });

  it.each(["gold", "item", "monster"] as const)("allows an unrelated prerequisite chest's legitimate %s reward", kind => {
    const f = prerequisiteFixture();
    f.requirement = { ...f.requirement, grants: [grant(kind)] };
    f.chest.pages![0].commands.unshift(...reward(kind));
    f.chief.pages![1].commands.splice(0, 1, ...reward(kind));
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.evidence?.[0]).toMatchObject({ claim: delta(kind, 20), repeat: delta(kind, 0), final: delta(kind, kind === "gold" ? 77 : 40) });
  });

  it("does not ban unrequested components on the early bound-NPC interaction", () => {
    const f = approachFixture("gold", 0);
    f.chief.pages![0].commands.unshift(...reward("item"));
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.evidence?.[0]).toMatchObject({ claim: { gold: 20 }, repeat: { gold: 0 }, final: { gold: 57, inventory: { [ITEM]: 20 } } });
  });

  it("retains protected foreign-event denial on host approach", () => {
    const f = approachFixture("gold", 0);
    f.village.events.unshift(event("foreign", 3, 2, [page("foreign", reward("gold"), [], { kind: "playerTouch" }, false)]));
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "claim", instructions: 0, final: { gold: 37 } });
  });

  it("retains protected transfer denial on host approach without banning legitimate prelude transfers", () => {
    for (const explicit of [false, true]) {
      const f = approachFixture("gold", 0, explicit);
      f.chief.pages![0].commands.push({ kind: "transfer", mapId: f.village.id, x: 4, y: 2 });
      const result = run(f);
      expect(result.ok, JSON.stringify(result)).toBe(explicit);
      if (!explicit) {
        expect(result.evidence?.[0]).toMatchObject({ phase: "claim", final: { gold: 37 } });
        expect(result.evidence?.[0]?.claim).toBeUndefined();
      }
    }
  });

  it("keeps ordinary scene semantics: 37 +20 touch +20 claim +0 repeat =77", () => {
    const f = approachFixture();
    const before = structuredClone(f.project);
    const result = runSceneTest(f.project, { mapId: f.village.id, start: f.project.startPos, steps: [
      { kind: "walk", to: { x: 5, y: 2 }, adjacent: true },
      { kind: "snapshotRewards" }, { kind: "interact", eventId: CHIEF },
      { kind: "expect", interactionComplete: true, goldDelta: 20 },
      { kind: "snapshotRewards" }, { kind: "interact", eventId: CHIEF },
      { kind: "expect", interactionComplete: true, goldDelta: 0 },
    ] });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.gold).toBe(77);
    expect(f.project).toEqual(before);
  });

  it.each([false, true])("real AssistantSession rejects duplicate approach payment at tool and final closure, explicit=%s", async explicit => {
    const f = approachFixture("gold", 20, explicit);
    const { proof, result } = await sessionReplay(f);
    expect(proof.ok, JSON.stringify(proof)).toBe(false);
    expect(proof.data).toMatchObject({ executed: true, ok: false, evidence: [{ final: { gold: 57 } }] });
    expect(result.assistantText).not.toContain(COMPLETE);
  });

  it.each([false, true])("real AssistantSession accepts zero early then +20 / 0, explicit=%s", async explicit => {
    const { proof, result } = await sessionReplay(approachFixture("gold", 0, explicit));
    expect(proof.ok, JSON.stringify(proof)).toBe(true);
    expect(proof.data).toMatchObject({ executed: true, ok: true, evidence: [{ claim: { gold: 20 }, repeat: { gold: 0 }, final: { gold: 57 } }] });
    expect(result.assistantText).toBe(COMPLETE);
  });
});

const COMPLETE = "NPC_APPROACH_COMPLETION_SENTINEL";
async function sessionReplay(f: ReturnType<typeof prerequisiteFixture>) {
  const before = structuredClone(f.project);
  const events: SessionEvent[] = [];
  let called = false;
  const session = new AssistantSession(f.project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12, maxTokens: 32000 },
    declareIntent: fixedDeclarer({ mode: "modify", npcRewards: [f.requirement] }),
    chat: async () => {
      if (!called) {
        called = true;
        return { message: { role: "assistant", content: null, tool_calls: [{ id: "approach", type: "function", function: {
          name: "verify_npc_reward", arguments: JSON.stringify({ requirementIndex: 0, prelude: f.prelude }),
        } }] }, finishReason: "tool_calls" };
      }
      return { message: { role: "assistant", content: COMPLETE }, finishReason: "stop" };
    },
  });
  // Subscribe before dispatch; await the actual turn completion, never a timer/poll.
  const result = await session.sendUserMessage("Verify exactly 20 currency from the chief once", event => events.push(event));
  const proof = events.find(event => event.type === "tool_call" && event.name === "verify_npc_reward");
  if (proof?.type !== "tool_call") throw new Error("Missing native proof tool result");
  expect(f.project).toEqual(before);
  expect(session.getProposedProject()).toEqual(before);
  return { proof: proof.result, result };
}
