import { describe, expect, it } from "vitest";
import { parseIntentDeclaration, parseNpcRewardRequirements, type IntentFacts, type NpcRewardRequirement } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { giveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";

const FACTS: IntentFacts = {
  userText: "Make Mira give two potions once.", currentMap: null, selection: null,
  maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false,
};
const REQUEST = [{ target: { eventName: "Mira" }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true }] satisfies NpcRewardRequirement[];
const ITEM: Command = { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 };
const MONSTER: Command = { kind: "giveMonster", speciesId: "species_leafling", level: 5 };
const MONSTER_REQUEST = [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster", id: "species_leafling", count: 1 }], oneTime: true }] satisfies NpcRewardRequirement[];

function fixture(commands: Command[], oneTime = true) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  map.events = [];
  const event: GameEvent = {
    id: "ev_mira", name: "Mira", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "reward", name: "Reward", conditions: [], graphic: { transparent: true },
      trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...commands, ...(oneTime ? [{ kind: "setSelfSwitch", key: "A", value: true } satisfies Command] : [])],
    }, ...(oneTime ? [{
      id: "claimed", name: "Claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }],
      graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "Already claimed." }],
    } satisfies NonNullable<GameEvent["pages"]>[number]] : [])],
  };
  map.events.push(event);
  return { project, map, event };
}

function sceneTool(project: ReturnType<typeof createBlankProject>, steps: unknown[]) {
  const tool = PLAY_TOOLS.find((entry) => entry.name === "run_scene_test");
  if (!tool) throw new Error("Missing scene tool");
  return tool.run(project, { mapId: project.startMapId, start: { x: 2, y: 2 }, steps });
}

describe("request-declared NPC rewards", () => {
  it("leaves ordinary NPCs and non-authoring declarations unchanged", () => {
    const { project } = fixture([{ kind: "text", body: "Hello." }]);
    expect(verifyNpcRewardsPlayable(project, undefined)).toEqual({ ok: true });
    const ordinary = parseIntentDeclaration(JSON.stringify({ mode: "create" }), FACTS);
    expect(ordinary.intent?.npcRewards).toBeUndefined();
    for (const mode of ["question", "other"]) {
      expect(parseIntentDeclaration(JSON.stringify({ mode, npcRewards: REQUEST }), FACTS).intent?.npcRewards).toBeUndefined();
    }
  });

  it.each([
    null, [], {}, [{ grants: [] }], [{ target: { eventId: "ev_mira" } }],
    [{ target: { eventId: "ev_mira" }, grants: [] }],
    [{ target: { eventId: "ev_mira", eventName: "Mira" }, grants: [{ kind: "item", id: "item_potion" }] }],
    ...[0, -1, 1.5, "2", null].map((count) => [{ target: { eventId: "ev_mira" }, grants: [{ kind: "item", id: "item_potion", count }] }]),
    [{ target: { eventId: "ev_mira" }, grants: [{ kind: "actor", id: "actor_hero" }] }],
    [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster" }] }],
    [{ ...REQUEST[0], oneTime: "true" }], [{ ...REQUEST[0], choices: [-1] }],
  ].map((npcRewards) => ({ npcRewards })))("keeps malformed opt-in data fail-closed: %j", ({ npcRewards }) => {
    const { intent } = parseIntentDeclaration(JSON.stringify({ mode: "modify", npcRewards }), FACTS);
    expect(intent?.source).toBe("llm");
    expect(intent?.npcRewards).toHaveProperty("invalidReason");
    expect(verifyNpcRewardsPlayable(createBlankProject(), intent?.npcRewards).ok).toBe(false);
  });

  it("requires a first-interaction delta even when the inventory already exceeds the reward", () => {
    const { project } = fixture([]);
    project.session.inventory.item_potion = 20;
    expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
  });

  it("accepts exact item and monster grants once without mutating the project", () => {
    const { project } = fixture([ITEM, MONSTER]);
    project.session.inventory.item_potion = 20;
    const before = structuredClone(project);
    const required: NpcRewardRequirement[] = [{
      target: { eventId: "ev_mira", mapId: project.startMapId },
      grants: [{ kind: "item", id: "item_potion", count: 2 }, { kind: "monster", id: "species_leafling", count: 1 }], oneTime: true,
    }];
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    expect(project).toEqual(before);
  });

  it("accepts an unspecified positive count but never a zero delta", () => {
    const { project, event } = fixture([ITEM]);
    const required: NpcRewardRequirement[] = [{ target: { eventId: event.id }, grants: [{ kind: "item", id: "item_potion" }] }];
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    if (event.pages?.[0]) event.pages[0].commands = [];
    expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
  });

  it.each(["removed", "wrong-item", "wrong-count", "repeatable", "shadowed-page", "wrong-repeat-grant"])("rejects %s item reward behavior", (variant) => {
    const { project, event } = fixture([ITEM], variant !== "repeatable");
    const rewardPage = event.pages?.[0];
    const claimedPage = event.pages?.[1];
    if (!rewardPage) throw new Error("Missing reward page");
    if (variant === "removed") rewardPage.commands = [{ kind: "text", body: "Reward delivered." }, { kind: "setSelfSwitch", key: "A", value: true }];
    if (variant === "wrong-item") rewardPage.commands = [{ kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 2 }];
    if (variant === "wrong-count") rewardPage.commands = [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }];
    if (variant === "shadowed-page" && claimedPage) claimedPage.conditions = [];
    if (variant === "wrong-repeat-grant" && claimedPage) claimedPage.commands = [{ kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 1 }];
    expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
  });

  it.each(["removed", "wrong-species", "actor-party", "repeatable"])("rejects %s collected monster behavior", (variant) => {
    const command: Command = variant === "wrong-species" ? { ...MONSTER, speciesId: "species_sparkit" }
      : variant === "actor-party" ? { kind: "changeParty", actorId: "actor_hero", action: "add" }
      : variant === "removed" ? { kind: "text", body: "Here is your monster." } : MONSTER;
    const { project } = fixture([command], variant !== "repeatable");
    expect(verifyNpcRewardsPlayable(project, MONSTER_REQUEST).ok).toBe(false);
  });

  it("resolves unique exact item and NPC names within the declared map", () => {
    const { project, map, event } = fixture([ITEM]);
    const potion = project.database.items.find((item) => item.id === "item_potion");
    if (!potion) throw new Error("Missing potion");
    project.maps.other = { ...structuredClone(map), id: "other", events: [structuredClone(event)] };
    const required: NpcRewardRequirement[] = [{ target: { eventName: "Mira", mapId: map.id }, grants: [{ kind: "item", name: potion.name, count: 2 }], oneTime: true }];
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
    project.database.items.push({ ...potion, id: "duplicate_potion" });
    expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
  });

  it.each(["missing-target", "ambiguous-target", "wrong-map", "missing-item", "hidden-behind-npc"])("rejects %s rather than picking another reward", (variant) => {
    const { project, map, event } = fixture([ITEM]);
    if (variant === "missing-target") map.events = [];
    if (variant === "ambiguous-target") map.events.push({ ...structuredClone(event), id: "duplicate" });
    if (variant === "wrong-map") map.id = "other";
    if (variant === "missing-item") project.database.items = project.database.items.filter((item) => item.id !== "item_potion");
    if (variant === "hidden-behind-npc") map.events.unshift({ ...structuredClone(event), id: "blocker", name: "Someone else" });
    const required = variant === "wrong-map" ? [{ ...REQUEST[0], target: { eventId: event.id, mapId: "missing" } }] : REQUEST;
    expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
  });

  it("uses declared starter choices and counts new box monsters when the party is full", () => {
    const { project } = fixture([]);
    const session = startSession(project, 1);
    for (let index = 0; index < 6; index++) giveMonster(project, session, { speciesId: "species_leafling", level: 5 });
    project.session.monsterInstances = session.monsterInstances;
    project.session.monsterParty = session.monsterParty;
    project.session.monsterBox = session.monsterBox;
    expect(verifyNpcRewardsPlayable(project, MONSTER_REQUEST).ok).toBe(false);
    const tool = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
    if (!tool) throw new Error("Missing starter tool");
    tool.run(project, { speciesIds: ["species_leafling", "species_sparkit"], actorEvent: { eventId: "ev_mira", x: 2, y: 3 } });
    const required: NpcRewardRequirement[] = [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster", id: "species_leafling", count: 1 }], oneTime: true, choices: [0] }];
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    expect(verifyNpcRewardsPlayable(project, [{ ...required[0], choices: [1] }]).ok).toBe(false);
    const proof = sceneTool(project, [
      { kind: "snapshotRewards" }, { kind: "interact", eventId: "ev_mira" }, { kind: "choose", index: 0 },
      { kind: "expect", ownedMonsterDelta: { species_leafling: 1 }, interactionComplete: true },
      { kind: "snapshotRewards" }, { kind: "interact", eventId: "ev_mira" },
      { kind: "expect", ownedMonsterDelta: { species_leafling: 0 }, interactionComplete: true },
    ]);
    expect(proof.data).toMatchObject({ ok: true, finalState: { ownedMonsterCounts: { species_leafling: 7 } } });
    expect(proof.data).toHaveProperty("finalState.monsterParty.length", 6);
    expect(proof.data).toHaveProperty("finalState.monsterBox.length", 1);
  });

  it("resolves the first-page display name used by starter authoring when no root name exists", () => {
    const { project, event } = fixture([MONSTER]);
    delete event.name;
    if (event.pages?.[0]) event.pages[0].name = "Mira";
    const species = project.database.monsterSpecies?.find((entry) => entry.id === "species_leafling");
    if (!species) throw new Error("Missing species");
    const required: NpcRewardRequirement[] = [{ target: { eventName: "Mira" }, grants: [{ kind: "monster", name: species.name, count: 1 }], oneTime: true }];
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    expect(verifyNpcRewardsPlayable(project, [{ ...required[0], target: { eventName: "mira" } }]).ok).toBe(false);
  });

  it("checks declared repeat choices against the same session rather than resetting the guard", () => {
    const { project, event } = fixture([{
      kind: "choices", options: [{ text: "Claim", branch: [{
        kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false },
        then: [ITEM, { kind: "setSelfSwitch", key: "A", value: true }],
      }] }],
    }], false);
    const required = parseNpcRewardRequirements([{ ...REQUEST[0], choices: [0], repeatChoices: [0] }]);
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    if (event.pages?.[0]) event.pages[0].commands = [{ kind: "choices", options: [{ text: "Claim", branch: [ITEM] }] }];
    expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
  });

  it("rejects unfinished choices even if a reward was already granted", () => {
    const { project } = fixture([ITEM, { kind: "choices", options: [{ text: "OK", branch: [] }] }]);
    expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
    const required = parseNpcRewardRequirements([{ ...REQUEST[0], choices: [0] }]);
    expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
    expect(verifyNpcRewardsPlayable(project, parseNpcRewardRequirements([{ ...REQUEST[0], choices: [99] }])).ok).toBe(false);
  });

  it("keeps explicit reward expectations even before the target exists", () => {
    const parsed = parseIntentDeclaration(JSON.stringify({ mode: "modify", npcRewards: REQUEST }), FACTS);
    expect(parsed.intent).toMatchObject({ npcRewards: REQUEST });
  });

  it("does not accept text and a claimed switch as an inventory delta", () => {
    const { project } = fixture([{ kind: "text", body: "Take these potions." }]);
    project.session.inventory.item_potion = 20;
    const result = sceneTool(project, [
      { kind: "interact", eventId: "ev_mira" },
      { kind: "expect", inventoryDelta: { item_potion: 2 }, interactionComplete: true },
    ]);
    expect(result.data).toMatchObject({ ok: false });
  });

  it("does not accept changeParty as a collected monster grant", () => {
    const { project } = fixture([{ kind: "changeParty", actorId: "actor_hero", action: "add" }]);
    const result = sceneTool(project, [
      { kind: "interact", eventId: "ev_mira" },
      { kind: "expect", ownedMonsterDelta: { species_leafling: 1 } },
    ]);
    expect(result.data).toMatchObject({ ok: false });
  });
});
