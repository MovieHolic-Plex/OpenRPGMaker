import { describe, expect, it } from "vitest";
import { actorBattlers } from "@/battle/battleBattlers";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { giveMonster } from "@/project/monsterCollection";
import { createBlankProject } from "@/project/defaults";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { startSession } from "@/project/session";
import { useItemFromMenu } from "@/player/playerItemUse";

describe("finite-use item authority integration", () => {
  it("threads a battle successful-use cursor through event snapshot and back to session", () => {
    const project = createBlankProject();
    const item = normalizeItemRecord({
      id: "finite_potion",
      name: "Finite potion",
      type: "medicine",
      scope: "ally",
      consumable: true,
      consumptionLimit: 3,
      occasion: "battle",
      hpRecovery: { flat: 10, percentMax: 0 },
    });
    project.database.items.push(item);
    const actorId = project.system.startActorIds[0]!;
    const session = startSession(project);
    session.inventory[item.id] = 1;
    session.actorVitals[actorId]!.hp = Math.max(1, session.actorVitals[actorId]!.hp - 20);
    const troopId = project.database.troops[0]!.id;
    const runtime = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      party: {
        levels: session.actorLevels,
        experience: session.actorExperience,
        vitals: session.actorVitals,
        equipment: session.actorEquipment,
        skillIds: session.actorSkillIds,
        classOverrides: session.classOverrides,
        stateIds: session.actorStateIds,
        partyActorIds: session.partyActorIds,
      },
      sessionState: {
        switches: session.switches,
        variables: session.variables,
        inventory: session.inventory,
        itemUseCharges: session.itemUseCharges,
        gold: session.gold,
        partyActorIds: session.partyActorIds,
      },
    });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "item", itemId: item.id, targetEnemyId: "" });
    const state = runtime.snapshot().eventState;
    expect(state.inventory[item.id]).toBe(1);
    expect(state.itemUseCharges?.[item.id]).toBe(1);
    applyBattleRewardsToSession(session, { result: "escape", rewards: { exp: 0, gold: 0, items: [] }, eventState: state }, project);
    expect(session.inventory[item.id]).toBe(1);
    expect(session.itemUseCharges?.[item.id]).toBe(1);
  });

  it("rejects an actor-restricted battle item without changing effects or finite-use state", () => {
    const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({ usableActorIds: ["other_actor"] });

    runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

    const snapshot = runtime.snapshot();
    expect(snapshot.actors.find((actor) => actor.recordId === actorId)?.hp).toBe(initialHp);
    expect(snapshot.eventState.inventory[itemId]).toBe(1);
    expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(1);
  });

  it("rejects a class-restricted battle item without changing effects or finite-use state", () => {
    const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({ usableClassIds: ["other_class"] });

    runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

    const snapshot = runtime.snapshot();
    expect(snapshot.actors.find((actor) => actor.recordId === actorId)?.hp).toBe(initialHp);
    expect(snapshot.eventState.inventory[itemId]).toBe(1);
    expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(1);
  });

  it("applies and advances finite-use state for an eligible restricted battle item", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({
      project,
      usableActorIds: [actor.id],
      usableClassIds: [actor.classId],
    });

    runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

    const snapshot = runtime.snapshot();
    expect(snapshot.actors.find((entry) => entry.recordId === actorId)?.hp).toBeGreaterThan(initialHp);
    expect(snapshot.eventState.inventory[itemId]).toBe(1);
    expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(2);
  });

  it("routes battle-event item changes through the finite-use transition authority", () => {
    const project = createBlankProject();
    const item = normalizeItemRecord({
      id: "finite_event_item",
      name: "Finite event item",
      consumable: true,
      consumptionLimit: 3,
    });
    project.database.items.push(item);
    const troop = project.database.troops[0]!;
    troop.battleEventPages = [{
      id: "remove_finite_item",
      name: "Remove finite item",
      conditions: [],
      span: "battle",
      commands: [{ kind: "changeItem", itemId: item.id, op: "-=", amount: 1 }],
    }];
    const originalInventory = { [item.id]: 1 };
    const originalCharges = { [item.id]: 2 };
    const state = {
      switches: {},
      variables: {},
      inventory: originalInventory,
      itemUseCharges: originalCharges,
    };

    createBattleEventRuntime({
      project,
      troopRecord: troop,
      actors: [],
      enemies: [],
      stateIds: [],
      state,
    }).applyTroopEvents({ turn: 0 });

    expect(state.inventory).not.toBe(originalInventory);
    expect(state.itemUseCharges).not.toBe(originalCharges);
    expect(state.inventory[item.id]).toBeUndefined();
    expect(state.itemUseCharges[item.id]).toBeUndefined();
  });

  it("counts mirrored two-handed equipment stats once in battle", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const weapon = project.database.equipment.find((record) => record.slot === "weapon")!;
    weapon.twoHanded = true;
    weapon.statBonuses = { attack: 17, defense: 3, mind: 2, agility: 1 };
    const withoutEquipment = actorBattlers(project, {
      partyActorIds: [actor.id],
      equipment: { [actor.id]: {} },
    })[0]!;
    const withEquipment = actorBattlers(project, {
      partyActorIds: [actor.id],
      equipment: { [actor.id]: { weapon: weapon.id, shield: weapon.id } },
    })[0]!;

    expect(withEquipment.attackPower - withoutEquipment.attackPower).toBe(17);
    expect(withEquipment.defense - withoutEquipment.defense).toBe(3);
    expect(withEquipment.mind - withoutEquipment.mind).toBe(2);
    expect(withEquipment.agility - withoutEquipment.agility).toBe(1);
  });

  it("persists defeat-branch item consumption without granting victory rewards", () => {
    const project = createBlankProject();
    const item = normalizeItemRecord({ id: "finite_defeat_item", name: "Finite defeat item", consumable: true, consumptionLimit: 3 });
    project.database.items.push(item);
    const session = startSession(project);
    session.inventory[item.id] = 1;
    session.itemUseCharges = { [item.id]: 1 };
    const actorId = session.partyActorIds[0]!;
    const initialExperience = session.actorExperience[actorId]!;
    const initialGold = session.gold;

    const levelUps = applyBattleRewardsToSession(session, {
      result: "defeat",
      canLose: true,
      rewards: { exp: 999, gold: 999, items: ["item_bomb"] },
      eventState: {
        switches: session.switches,
        variables: session.variables,
        inventory: { [item.id]: 1 },
        itemUseCharges: { [item.id]: 2 },
      },
    }, project);

    expect(session.inventory[item.id]).toBe(1);
    expect(session.itemUseCharges?.[item.id]).toBe(2);
    expect(session.actorExperience[actorId]).toBe(initialExperience);
    expect(session.gold).toBe(initialGold);
    expect(session.inventory.item_bomb).toBeUndefined();
    expect(levelUps).toEqual([]);
  });

  it("round-trips finite-use state through a save snapshot", () => {
    const project = createBlankProject();
    const item = normalizeItemRecord({ id: "finite", name: "Finite", consumable: true, consumptionLimit: 4 });
    project.database.items.push(item);
    const session = startSession(project);
    session.inventory[item.id] = 2;
    session.itemUseCharges = { [item.id]: 3 };
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.inventory[item.id]).toBe(2);
    expect(restored.itemUseCharges?.[item.id]).toBe(3);
  });

  it("preserves the FIFO cursor when a partially charged final care-item copy is used", () => {
    const { project, session, itemId, instanceId } = setupFiniteCareItem(1, 1);

    expect(useItemFromMenu(project, session, itemId, undefined, instanceId).kind).toBe("used");
    expect(session.inventory[itemId]).toBe(1);
    expect(session.itemUseCharges?.[itemId]).toBe(2);
  });

  it("finishes a charged FIFO care-item copy without consuming its uncharged tail", () => {
    const { project, session, itemId, instanceId } = setupFiniteCareItem(2, 2);

    expect(useItemFromMenu(project, session, itemId, undefined, instanceId).kind).toBe("used");
    expect(session.inventory[itemId]).toBe(1);
    expect(session.itemUseCharges?.[itemId]).toBeUndefined();
  });
});

function setupRestrictedBattleItem({
  project = createBlankProject(),
  usableActorIds = [],
  usableClassIds = [],
}: {
  project?: ReturnType<typeof createBlankProject>;
  usableActorIds?: string[];
  usableClassIds?: string[];
}) {
  const item = normalizeItemRecord({
    id: "restricted_finite_potion",
    name: "Restricted finite potion",
    type: "medicine",
    scope: "ally",
    consumable: true,
    consumptionLimit: 3,
    occasion: "battle",
    hpRecovery: { flat: 10, percentMax: 0 },
    usableActorIds,
    usableClassIds,
  });
  project.database.items.push(item);
  const actorId = project.system.startActorIds[0]!;
  const session = startSession(project);
  session.inventory[item.id] = 1;
  session.itemUseCharges = { [item.id]: 1 };
  session.actorVitals[actorId]!.hp = Math.max(1, session.actorVitals[actorId]!.hp - 20);
  const initialHp = session.actorVitals[actorId]!.hp;
  const runtime = createBattleRuntime({
    project,
    troopId: project.database.troops[0]!.id,
    canEscape: true,
    canLose: true,
    party: {
      levels: session.actorLevels,
      experience: session.actorExperience,
      vitals: session.actorVitals,
      equipment: session.actorEquipment,
      skillIds: session.actorSkillIds,
      classOverrides: session.classOverrides,
      stateIds: session.actorStateIds,
      partyActorIds: session.partyActorIds,
    },
    sessionState: {
      switches: session.switches,
      variables: session.variables,
      inventory: session.inventory,
      itemUseCharges: session.itemUseCharges,
      gold: session.gold,
      partyActorIds: session.partyActorIds,
    },
  });
  runtime.tick(1_000);
  return { runtime, actorId, itemId: item.id, initialHp };
}

function setupFiniteCareItem(count: number, charge: number) {
  const project = createBlankProject();
  const item = normalizeItemRecord({
    id: "finite_care",
    name: "Finite care",
    type: "special",
    scope: "none",
    consumable: true,
    consumptionLimit: 3,
    occasion: "field",
    careProfile: { kind: "feed", friendshipDelta: 1, expDelta: 0 },
  });
  project.database.items.push(item);
  const session = startSession(project);
  session.inventory[item.id] = count;
  session.itemUseCharges = { [item.id]: charge };
  const speciesId = project.database.monsterSpecies?.[0]?.id;
  if (!speciesId) throw new Error("Expected a default monster species");
  const gifted = giveMonster(project, session, { speciesId, level: 1 });
  if (!gifted.ok) throw new Error("Expected default monster species to be giftable");
  return { project, session, itemId: item.id, instanceId: gifted.instance.instanceId };
}
