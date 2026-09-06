import { describe, expect, it } from "vitest";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { isVerifyNpcRewardInput } from "@/ai/npcRewardWitness";
import { CHIEF, KEY, event, page, prerequisiteFixture } from "./npcPrerequisiteFixture";

const run = (f: ReturnType<typeof prerequisiteFixture>) => verifyNpcRewardsPlayable(f.project, [f.requirement], new Map([[f.requirement, f.witness]]));

describe("NPC prerequisite protected runtime replay", () => {
  it("R1 runs chief request, physical transfers, real chest, gold +20 and repeat 0 without changing project", () => {
    const f = prerequisiteFixture();
    const before = structuredClone(f.project);
    expect(verifyNpcRewardsPlayable(f.project, [f.requirement]).ok).toBe(false);
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.evidence?.[0]).toMatchObject({ target: f.witness.target, claim: { gold: 20 }, repeat: { gold: 0 }, final: { gold: 57, inventory: { [KEY]: 1 } } });
    expect(f.project).toEqual(before);
  });
  it("R2 revisits chest across round-trip transfers with one key", () => {
    const f = prerequisiteFixture();
    f.prelude.splice(6, 0, ...f.visitChest);
    const result = run(f);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.evidence?.[0]?.final.inventory[KEY]).toBe(1);
  });
  it.each(["missing-key", "out-missing", "back-missing", "out-blocked", "back-blocked", "out-wrong", "back-wrong", "missing-map", "landing-bounds", "landing-blocked", "start-bounds", "start-blocked"])("R3 rejects %s", variant => {
    const f = prerequisiteFixture();
    if (variant === "missing-key") f.chest.pages![0].commands = [];
    if (variant === "out-missing") f.out.pages![0].commands = [];
    if (variant === "back-missing") f.back.pages![0].commands = [];
    if (variant === "out-blocked") f.village.events.unshift(event("block", 8, 2, [page("block", [])]));
    if (variant === "back-blocked") f.cellar.events.unshift(event("block", 1, 2, [page("block", [])]));
    if (variant === "out-wrong") f.out.pages![0].commands = [{ kind: "transfer", mapId: f.village.id, x: 2, y: 2 }];
    if (variant === "back-wrong") f.back.pages![0].commands = [{ kind: "transfer", mapId: f.cellar.id, x: 2, y: 2 }];
    if (variant === "missing-map") delete f.project.maps[f.cellar.id];
    if (variant === "landing-bounds") f.out.pages![0].commands = [{ kind: "transfer", mapId: f.cellar.id, x: 999, y: 2 }];
    if (variant === "landing-blocked") f.cellar.events.push(event("block", 2, 2, [page("block", [])]));
    if (variant === "start-bounds") f.project.startPos.x = 999;
    if (variant === "start-blocked") f.village.events.push(event("block", 2, 2, [page("block", [])]));
    expect(run(f).ok).toBe(false);
  });
  it.each([0, 10])("R4 chest's prior +20 cannot satisfy chief +%s", amount => {
    const f = prerequisiteFixture();
    f.chest.pages![0].commands.unshift({ kind: "changeGold", op: "+=", amount: 20 });
    f.chief.pages![1].commands[0] = { kind: "changeGold", op: "+=", amount };
    expect(run(f).ok).toBe(false);
  });
  it("R5 rejects early chief payout even when protected claim is exact", () => {
    const f = prerequisiteFixture();
    f.chief.pages![0].commands.unshift({ kind: "changeGold", op: "+=", amount: 20 });
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]?.phase).toBe("prelude");
  });
  it("R6 rejects the wrong physical NPC", () => {
    const f = prerequisiteFixture();
    f.village.events.unshift(event("impostor", 5, 2, [page("fake", [{ kind: "changeGold", op: "+=", amount: 20 }])]));
    expect(run(f).ok).toBe(false);
  });
  it("R6 never rebinds a unique same-named replacement on another map", () => {
    const f = prerequisiteFixture();
    f.requirement = { ...f.requirement, target: { eventName: CHIEF } };
    expect(run(f).ok).toBe(true);
    f.village.events = f.village.events.filter(e => e.id !== CHIEF);
    f.cellar.events.push(f.chief);
    expect(run(f).ok).toBe(false);
  });
  it("R7 rejects chief transfer into a donor autorun even if it returns", () => {
    const f = prerequisiteFixture();
    f.chief.pages![1].commands = [{ kind: "transfer", mapId: f.cellar.id, x: 2, y: 2 }];
    f.cellar.events.push(event("donor", 10, 10, [page("donor", [
      { kind: "changeGold", op: "+=", amount: 20 }, { kind: "setSwitch", switchId: "paid", value: true },
      { kind: "transfer", mapId: f.village.id, x: 4, y: 2 },
    ], [{ kind: "item", itemId: KEY, present: true }], { kind: "auto" }, false)]));
    expect(run(f).ok).toBe(false);
  });
  it.each([false, true])("R8 rejects callMapEvent delegation, nested=%s", nested => {
    const f = prerequisiteFixture();
    const call = { kind: "callMapEvent" as const, eventId: "donor" };
    f.chief.pages![1].commands[0] = nested ? { kind: "fork", condition: { kind: "switch", switchId: "accepted", value: true }, then: [call], else: [] } : call;
    f.village.events.push(event("donor", 15, 12, [page("donor", [{ kind: "changeGold", op: "+=", amount: 20 }])]));
    expect(run(f).ok).toBe(false);
  });
  it.each(["pending", "budget", "unsupported"])("R9 fails %s rather than minting completion", variant => {
    const f = prerequisiteFixture();
    if (variant === "pending") f.chief.pages![0].commands.push({ kind: "choices", options: [{ text: "Accept", branch: [] }] });
    if (variant === "budget") f.chief.pages![1].commands.push({ kind: "loop", body: [{ kind: "setSwitch", switchId: "accepted", value: true }] });
    if (variant === "unsupported") f.chief.pages![1].commands.push({ kind: "inputNumber", variableId: "n", digits: 1 });
    expect(run(f).ok).toBe(false);
  });
  it.each(["chest", "transfer", "collision", "npc", "database", "start"])("R11 freshly replays after %s mutation", variant => {
    const f = prerequisiteFixture();
    expect(run(f).ok).toBe(true);
    if (variant === "chest") f.chest.pages![0].commands = [];
    if (variant === "transfer") f.back.pages![0].commands = [];
    if (variant === "collision") f.village.events.unshift(event("block", 8, 2, [page("block", [])]));
    if (variant === "npc") f.chief.pages![1].commands = [];
    if (variant === "database") f.project.database.items = f.project.database.items.filter(i => i.id !== KEY);
    if (variant === "start") f.project.startMapId = "missing";
    expect(run(f).ok).toBe(false);
  });
  it("ordinary scene behavior still supports callMapEvent", () => {
    const f = prerequisiteFixture();
    f.chief.pages = [page("call", [{ kind: "callMapEvent", eventId: "donor" }])];
    f.village.events.push(event("donor", 15, 12, [page("donor", [{ kind: "changeGold", op: "+=", amount: 20 }])]));
    const result = runSceneTest(f.project, { mapId: f.village.id, start: { x: 4, y: 2 }, steps: [{ kind: "face", dir: "right" }, { kind: "interact", eventId: CHIEF }, { kind: "expect", goldDelta: 20 }] });
    expect(result.ok).toBe(true);
  });

  it("R4 another physically visited NPC cannot lend its currency to the chief", () => {
    const f = prerequisiteFixture();
    f.village.events.push(event("donor", 7, 5, [page("donor", [{ kind: "changeGold", op: "+=", amount: 20 }])]));
    f.prelude.splice(6, 0, { kind: "walk", mapId: f.village.id, to: { x: 7, y: 5 }, adjacent: true }, { kind: "interact", mapId: f.village.id, eventId: "donor" });
    f.chief.pages![1].commands.shift();
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "claim", claim: { gold: 0 }, final: { gold: 57 } });
  });

  it.each(["item", "monster"] as const)("R5 detects earlier chief %s grants, including completed choices", kind => {
    const f = prerequisiteFixture();
    const grant = kind === "item" ? { kind, id: "item_potion", count: 1 } as const : { kind, id: "species_leafling", count: 1 } as const;
    f.requirement = { ...f.requirement, grants: [grant] };
    f.chief.pages![0].commands.push({ kind: "choices", options: [{ text: "Accept", branch: kind === "item"
      ? [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }]
      : [{ kind: "giveMonster", speciesId: "species_leafling", level: 5 }] }] });
    f.prelude.splice(2, 0, { kind: "choose", mapId: f.village.id, index: 0 });
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "prelude", failedStepIndex: 5 });
  });

  it("R6 rejects ambiguous copies of the same ID on different maps", () => {
    const f = prerequisiteFixture();
    f.requirement = { ...f.requirement, target: { eventId: CHIEF } };
    f.cellar.events.push(structuredClone(f.chief));
    expect(run(f).ok).toBe(false);
  });

  it("R7 rejects a donor chaser entering while the protected chief waits", () => {
    const f = prerequisiteFixture();
    f.chief.pages![1].commands = [{ kind: "wait", ms: 2000 }, { kind: "setSwitch", switchId: "paid", value: true }];
    const donor = page("donor", [{ kind: "changeGold", op: "+=", amount: 20 }], [{ kind: "item", itemId: KEY, present: true }], { kind: "eventTouch" });
    donor.movement = { type: "chase", speed: 3, frequency: 8, pathfind: false };
    f.village.events.push(event("chasing_donor", 6, 3, [donor]));
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "claim", final: { gold: 37 } });
  });

  it("R8 admits a legitimate route whose unexecuted branch contains callMapEvent", () => {
    const f = prerequisiteFixture();
    f.chief.pages![1].commands.unshift({ kind: "fork", condition: { kind: "item", itemId: KEY, present: false }, then: [{ kind: "callMapEvent", eventId: "donor" }] });
    expect(run(f).ok).toBe(true);
  });

  it("R8 missing scene-session common events are unverified, not grafted from project data", () => {
    const f = prerequisiteFixture();
    f.project.commonEvents.push({ id: "borrow", name: "Borrow", trigger: "none", commands: [{ kind: "callMapEvent", eventId: "donor" }] });
    f.chief.pages![1].commands.unshift({ kind: "callCommonEvent", commonEventId: "borrow" });
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "claim", final: { gold: 37 } });
    expect(startSession(f.project, 1).commonEvents).toBeUndefined();
  });

  it("R8 actual interpreter dispatch hooks survive nested common-event frames", () => {
    const f = prerequisiteFixture();
    const session = startSession(f.project, 1);
    session.commonEvents = [{ id: "nested", commands: [{ kind: "fork", condition: { kind: "item", itemId: KEY, present: false }, then: [{ kind: "callMapEvent", eventId: "donor" }] }] }];
    f.village.events.push(event("donor", 15, 12, [page("donor", [{ kind: "changeGold", op: "+=", amount: 20 }])]));
    const visited: string[] = [];
    const interpreter = createInterpreter([{ kind: "callCommonEvent", commonEventId: "nested" }], session, f.project, {
      beforeCommand: command => { visited.push(command.kind); if (command.kind === "callMapEvent") throw new Error("PROOF_MAP_EVENT_DENIED"); },
    });
    expect(() => interpreter.start()).toThrow("PROOF_MAP_EVENT_DENIED");
    expect(visited).toEqual(["callCommonEvent", "fork", "callMapEvent"]);
    expect(session.gold).toBe(37);
    const ordinary = startSession(f.project, 1);
    ordinary.commonEvents = session.commonEvents;
    expect(createInterpreter([{ kind: "callCommonEvent", commonEventId: "nested" }], ordinary, f.project).start()).toEqual({ kind: "done" });
    expect(ordinary.gold).toBe(57);
  });

  it.each([-1, 1, 0])("R9 resolves only a valid pending prelude choice (%s)", index => {
    const f = prerequisiteFixture();
    f.chief.pages![0].commands = [{ kind: "choices", cancelBehavior: "branch", cancelBranch: [{ kind: "setSwitch", switchId: "accepted", value: true }], options: [{ text: "Accept", branch: [{ kind: "setSwitch", switchId: "accepted", value: true }] }] }];
    f.prelude.splice(2, 0, { kind: "choose", mapId: f.village.id, index });
    expect(run(f).ok).toBe(index === 0);
  });

  it("R9 holds protected choices to the immutable claim and repeat selections", () => {
    const f = prerequisiteFixture();
    const payment = f.chief.pages![1].commands;
    f.chief.pages![1].commands = [{ kind: "choices", options: [{ text: "Decline", branch: [] }, { text: "Claim", branch: payment }] }];
    f.chief.pages![2].commands = [{ kind: "choices", options: [{ text: "Done", branch: [] }] }];
    f.requirement = { ...f.requirement, choices: [1], repeatChoices: [0] };
    expect(run(f).ok).toBe(true);
    f.requirement = { ...f.requirement, choices: [0] };
    expect(run(f).ok).toBe(false);
    f.requirement = { ...f.requirement, choices: [1], repeatChoices: [] };
    expect(run(f).ok).toBe(false);
  });

  it("R9 enforces the 100000 shared instruction budget across separate interactions", () => {
    const f = prerequisiteFixture();
    const instruction = { kind: "setSwitch", switchId: "accepted", value: true } as const;
    f.chief.pages![0].commands = Array.from({ length: 60000 }, () => ({ ...instruction }));
    f.chief.pages![1].commands.push(...Array.from({ length: 50000 }, () => ({ ...instruction })));
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "claim", instructions: 100000 });
  });

  it("R9 enforces 4096 walking steps across at most 256 actions", () => {
    const f = prerequisiteFixture();
    const distance = f.village.width - 3;
    const walks = Array.from({ length: Math.ceil(4096 / distance) + 2 }, (_, i) => ({ kind: "walk" as const, mapId: f.village.id, to: { x: i % 2 ? 1 : f.village.width - 2, y: 10 } }));
    expect(walks.length).toBeLessThanOrEqual(256);
    f.prelude.splice(0, f.prelude.length, ...walks);
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ phase: "prelude", movementSteps: 4096 });
  });

  it("R9 rejects action overflow and cancellation without completing the replay", () => {
    const f = prerequisiteFixture();
    expect(isVerifyNpcRewardInput({ requirementIndex: 0, prelude: Array.from({ length: 257 }, () => ({ kind: "face", mapId: f.village.id, dir: "right" })) })).toBe(false);
    const controller = new AbortController();
    controller.abort();
    const result = verifyNpcRewardsPlayable(f.project, [f.requirement], new Map([[f.requirement, f.witness]]), controller.signal);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]).toMatchObject({ instructions: 0, movementSteps: 0 });
  });

  it.each(["gold", "item", "monster"] as const)("R9 repeat rejects all reward components, including undeclared %s", kind => {
    const f = prerequisiteFixture();
    f.chief.pages![2].commands = kind === "gold" ? [{ kind: "changeGold", op: "+=", amount: 1 }]
      : kind === "item" ? [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }]
      : [{ kind: "giveMonster", speciesId: "species_leafling", level: 5 }];
    const result = run(f);
    expect(result.ok).toBe(false);
    expect(result.evidence?.[0]?.phase).toBe("repeat");
  });

  it("R10 validates every action and nested field before admission", () => {
    const f = prerequisiteFixture();
    for (const action of [
      { kind: "transfer", mapId: f.cellar.id, x: 2, y: 2 }, { kind: "snapshotRewards" }, { kind: "retryCheckpoint" },
      { kind: "advanceDays", days: 1 }, { kind: "gift", eventId: "donor", itemId: KEY },
      { kind: "interact", mapId: f.village.id, eventId: CHIEF, expect: {} }, { kind: "walk", to: { x: 2, y: 2 } },
      { kind: "move", mapId: f.village.id, dir: "right", to: { x: 2, y: 2 } },
      { kind: "walk", mapId: f.village.id, to: { x: 2, y: 2 }, receipt: { passed: true } },
    ]) expect(isVerifyNpcRewardInput({ requirementIndex: 0, prelude: [...f.prelude, action] })).toBe(false);
  });
});
