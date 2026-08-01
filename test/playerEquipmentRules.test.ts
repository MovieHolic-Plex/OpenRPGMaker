import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { effectiveActorEquipment, equipmentSlotAccepts, logicalEquipmentIds, transitionActorEquipment } from "@/player/playerEquipmentRules";
import { changeActorEquipment } from "@/project/sessionActorCommands";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { equipStatusMenuItem } from "@/player/playerStatusMenuMutations";
import type { PlayScene } from "@/player/PlayScene";
import { store } from "@/project/store";

function setup() {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const sword = project.database.equipment.find((record) => record.slot === "weapon")!;
  const shield = project.database.equipment.find((record) => record.slot === "shield")!;
  sword.equippableActorIds = [actor.id];
  shield.equippableActorIds = [actor.id];
  return { project, actor, sword, shield };
}

describe("atomic equipment transition authority", () => {
  it("occupies both hands for a two-handed weapon while conserving one inventory copy", () => {
    const { project, actor, sword, shield } = setup();
    sword.twoHanded = true;
    const result = transitionActorEquipment({
      project,
      actorId: actor.id,
      equipment: { shield: shield.id },
      inventory: { [sword.id]: 1 },
      slot: "weapon",
      equipmentId: sword.id,
    });
    expect(result).toEqual({
      kind: "accepted",
      equipment: { weapon: sword.id, shield: sword.id },
      inventory: { [shield.id]: 1 },
    });
  });

  it("rejects cursed displacement atomically", () => {
    const { project, actor, sword, shield } = setup();
    shield.cursed = true;
    const beforeEquipment = { shield: shield.id };
    const beforeInventory = { [sword.id]: 1 };
    sword.twoHanded = true;
    const rejected = transitionActorEquipment({
      project,
      actorId: actor.id,
      equipment: beforeEquipment,
      inventory: beforeInventory,
      slot: "weapon",
      equipmentId: sword.id,
    });
    expect(rejected).toEqual({ kind: "rejected", reason: "cursedEquipment" });
    expect(beforeEquipment).toEqual({ shield: shield.id });
    expect(beforeInventory).toEqual({ [sword.id]: 1 });
  });

  it("normalizes malformed two-handed occupancy for reads without touching inventory", () => {
    const { project, actor, sword, shield } = setup();
    sword.twoHanded = true;
    expect(effectiveActorEquipment(project, actor, { weapon: sword.id, shield: shield.id })).toEqual({
      weapon: sword.id,
      shield: sword.id,
    });
  });

  it("projects a two-handed shield mirror as one logical item without dropping other slots", () => {
    const { project, sword } = setup();
    sword.twoHanded = true;

    expect(logicalEquipmentIds(project, {
      weapon: sword.id,
      shield: sword.id,
      armor: sword.id,
    })).toEqual([sword.id, sword.id]);
  });

  it("routes script equipment changes through inventory-conserving rejection-safe authority", () => {
    const { project, actor, sword } = setup();
    const session = startSession(project);
    session.actorEquipment[actor.id] = {};
    session.inventory = { [sword.id]: 1 };
    expect(changeActorEquipment(session, project, {
      kind: "changeEquipment",
      actorId: actor.id,
      slot: "weapon",
      equipmentId: sword.id,
    }).kind).toBe("accepted");
    expect(session.actorEquipment[actor.id]?.weapon).toBe(sword.id);
    expect(session.inventory[sword.id]).toBeUndefined();

    sword.cursed = true;
    const beforeEquipment = structuredClone(session.actorEquipment);
    const beforeInventory = structuredClone(session.inventory);
    expect(changeActorEquipment(session, project, {
      kind: "changeEquipment",
      actorId: actor.id,
      slot: "weapon",
      equipmentId: "",
    })).toEqual({ kind: "rejected", reason: "cursedEquipment" });
    expect(session.actorEquipment).toEqual(beforeEquipment);
    expect(session.inventory).toEqual(beforeInventory);
  });

  it.each(["actor", "class"] as const)("keeps shield candidates aligned with the %s dual-wield writer", (source) => {
    const { project, actor, sword } = setup();
    if (source === "actor") {
      actor.options.dualWield = true;
    } else {
      const actorClass = project.database.classes.find((record) => record.id === actor.classId);
      expect(actorClass).toBeDefined();
      if (actorClass) actorClass.options.dualWield = true;
    }

    expect(equipmentSlotAccepts(project, actor, "shield", sword)).toBe(true);
    const transition = transitionActorEquipment({
      project,
      actorId: actor.id,
      equipment: {},
      inventory: { [sword.id]: 1 },
      slot: "shield",
      equipmentId: sword.id,
    });
    expect(transition).toMatchObject({ kind: "accepted", equipment: { shield: sword.id } });

    const session = startSession(project);
    session.actorEquipment[actor.id] = {};
    session.inventory = { [sword.id]: 1 };
    const detail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "equipment",
      equipmentActorId: actor.id,
      equipmentSlotId: "shield",
      slots: [],
      waitModeEnabled: false,
    });
    expect(detail.entries.map((entry) => entry.testId)).toContain(`status-menu-equipment-item-${sword.id}`);
  });

  it("activates a dual-wield weapon from the shield screen into the shield slot", () => {
    const { project, actor, sword } = setup();
    actor.options.dualWield = true;
    const session = startSession(project);
    session.actorEquipment[actor.id] = {};
    session.inventory = { [sword.id]: 1 };
    store.replace(project);
    const scene = {
      getSession: () => session,
      syncRuntimeState: () => undefined,
    } as unknown as PlayScene;
    const detail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "equipment",
      equipmentActorId: actor.id,
      equipmentSlotId: "shield",
      slots: [],
      waitModeEnabled: false,
      onEquipItem: (actorId, slotId, equipmentId) => {
        equipStatusMenuItem(scene, actorId, slotId, equipmentId);
      },
    });

    const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-equipment-item-${sword.id}`);
    expect(entry).toBeDefined();
    entry?.onActivate?.();

    expect(session.actorEquipment[actor.id]).toEqual({ shield: sword.id });
    expect(session.inventory[sword.id]).toBeUndefined();
  });

  it("omits weapons from the shield candidates when neither actor nor class can dual-wield", () => {
    const { project, actor, sword } = setup();
    const session = startSession(project);
    session.actorEquipment[actor.id] = {};
    session.inventory = { [sword.id]: 1 };

    expect(equipmentSlotAccepts(project, actor, "shield", sword)).toBe(false);
    const detail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "equipment",
      equipmentActorId: actor.id,
      equipmentSlotId: "shield",
      slots: [],
      waitModeEnabled: false,
    });
    expect(detail.entries.map((entry) => entry.testId)).not.toContain(`status-menu-equipment-item-${sword.id}`);
  });

  it("rejects a two-handed weapon from the dual-wield shield slot before any state changes", () => {
    const { project, actor, sword } = setup();
    actor.options.dualWield = true;
    sword.twoHanded = true;
    const equipment = {};
    const inventory = { [sword.id]: 1 };

    expect(equipmentSlotAccepts(project, actor, "shield", sword)).toBe(false);
    expect(transitionActorEquipment({
      project,
      actorId: actor.id,
      equipment,
      inventory,
      slot: "shield",
      equipmentId: sword.id,
    })).toEqual({ kind: "rejected", reason: "invalidSlot" });
    expect(equipment).toEqual({});
    expect(inventory).toEqual({ [sword.id]: 1 });
  });
});
