import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { addEquipmentSlot, equipmentSlots, equipmentSlotLabel, equipmentSlotRemovalBlocker, renameEquipmentSlot, removeEquipmentSlot } from "@/project/equipmentSlots";
import { transitionActorEquipment } from "@/project/equipmentRules";
import { serialize, deserialize } from "@/project/io/serialize";
import { normalizeActorRecord } from "@/project/actorModel";
import { actorDerivedStats } from "@/battle/battleBattlers";
import { startSession } from "@/project/session";
import { changeActorEquipment } from "@/project/sessionActorCommands";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, snapshotLoadBlocker, saveSlotKey } from "@/player/saveSlots";
import { isActorEquipmentRecord } from "@/player/saveSlotValidation";
import { store } from "@/project/store";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function fixture() {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const slot = addEquipmentSlot(project, "Boots");
  const boots = normalizeEquipmentRecord({
    id: "equip_test_custom_boots", name: "Boots", slot: slot.id,
    statBonuses: { attack: 2, defense: 3, mind: 4, agility: 7 },
    equippableActorIds: [actor.id], iconResourceId: project.database.equipment[0]!.iconResourceId,
    effectFlags: { ...project.database.equipment[0]!.effectFlags, doubleAttack: true },
  });
  project.database.equipment.push(boots);
  return { project, actor, slot, boots };
}

function node(root: FakeElement, id: string): FakeElement {
  const found = findByTestId(root, id);
  if (!found) throw new Error(`Missing UI control: ${id}`);
  return found;
}

describe("project-authored equipment slots", () => {
  it("retains a real custom slot in the runtime equipment projection", () => {
    const project = createBlankProject();
    project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
    const actor = project.database.actors[0]!;
    const boots = normalizeEquipmentRecord({ id: "equip_test_custom_boots", name: "Boots", slot: "slot_boots" });
    project.database.equipment.push(boots);
    expect(effectiveActorEquipment(project, actor, { slot_boots: boots.id }))
      .toEqual({ slot_boots: boots.id });
  });

  it("creates distinct stable IDs, renames in place, and removes only unused custom slots", () => {
    const { project, actor, slot, boots } = fixture();
    const second = addEquipmentSlot(project, "Boots");
    expect(second.id).not.toBe(slot.id);
    const order = equipmentSlots(project).map((entry) => entry.id);
    renameEquipmentSlot(project, slot.id, "Greaves");
    expect(equipmentSlotLabel(project, slot.id)).toBe("Greaves");
    expect(equipmentSlots(project).map((entry) => entry.id)).toEqual(order);
    expect(boots.slot).toBe(slot.id);
    expect(removeEquipmentSlot(project, slot.id)).toBe(false);
    expect(equipmentSlotRemovalBlocker(project, slot.id)).toBe("referenced");
    boots.slot = "accessory";
    actor.initialEquipment[slot.id] = boots.id;
    expect(removeEquipmentSlot(project, slot.id)).toBe(false);
    delete actor.initialEquipment[slot.id];
    project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [{ kind: "loop", body: [
      { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
    ] }] } as typeof project.commonEvents[number]);
    expect(removeEquipmentSlot(project, slot.id)).toBe(false);
    project.commonEvents.pop();
    expect(removeEquipmentSlot(project, slot.id)).toBe(true);
    expect(removeEquipmentSlot(project, "weapon")).toBe(false);
    expect(() => addEquipmentSlot(project, " ")).toThrow();
    expect(() => renameEquipmentSlot(project, second.id, " ")).toThrow();
  });

  it("roundtrips initial equipment, equips through menu and event authority, derives stats, and saves/reloads", () => {
    const { project, actor, slot, boots } = fixture();
    actor.initialEquipment = { [slot.id]: boots.id };
    renameEquipmentSlot(project, slot.id, "Greaves");
    const loaded = deserialize(serialize(project));
    const loadedActor = loaded.database.actors.find((entry) => entry.id === actor.id)!;
    expect(loadedActor.initialEquipment).toEqual({ [slot.id]: boots.id });
    expect(loaded.database.equipment.find((entry) => entry.id === boots.id)).toEqual(boots);
    expect(equipmentSlotLabel(loaded, slot.id)).toBe("Greaves");
    const session = startSession(loaded);
    expect(session.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
    expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" }).kind).toBe("accepted");
    expect(session.inventory[boots.id]).toBe(1);
    const options = { project: loaded, session, selectedCommand: "equipment" as const, equipmentActorId: actor.id, slots: [], waitModeEnabled: false };
    const slots = createStatusMenuDetail(options);
    expect(slots.entries.find((entry) => entry.testId === `status-menu-equipment-slot-${slot.id}`)).toMatchObject({ label: "Greaves" });
    const detail = createStatusMenuDetail({ ...options, equipmentSlotId: slot.id,
      onEquipItem: (actorId, slotId, equipmentId) => {
        expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId, slot: slotId, equipmentId }).kind).toBe("accepted");
      },
    });
    const candidate = detail.entries.find((entry) => entry.testId === `status-menu-equipment-item-${boots.id}`);
    expect(candidate?.onActivate).toBeTypeOf("function");
    candidate!.onActivate!();
    expect(session.inventory[boots.id]).toBeUndefined();
    const normalized = normalizeActorRecord(loadedActor);
    const base = actorDerivedStats(loaded, normalized, { level: 1, equipment: {} });
    const equipped = actorDerivedStats(loaded, normalized, { level: 1, equipment: effectiveActorEquipment(loaded, loadedActor, session.actorEquipment[actor.id]) });
    expect(equipped.agility - base.agility).toBe(7);
    expect(equipped.attack - base.attack).toBe(2);
    expect(equipped.equipmentEffects.doubleAttack).toBe(true);
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(loaded, session)).ok).toBe(true);
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("Save did not roundtrip");
    expect(snapshotLoadBlocker(loaded, read.snapshot)).toBeNull();
    const restored = applySaveSnapshot(loaded, read.snapshot);
    expect(restored.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
    expect(restored.inventory).toEqual(session.inventory);
    loaded.database.equipmentSlots = [];
    expect(snapshotLoadBlocker(loaded, read.snapshot)).not.toBeNull();
  });

  it("rejects unknown slots atomically, including empty-slot unequip, and preserves permissions and curse rules", () => {
    const { project, actor, slot, boots } = fixture();
    const input = { project, actorId: actor.id, equipment: {}, inventory: { [boots.id]: 1 }, slot: "missing" };
    expect(transitionActorEquipment(input)).toEqual({ kind: "rejected", reason: "invalidSlot" });
    expect(transitionActorEquipment({ ...input, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
    expect(transitionActorEquipment({ ...input, slot: "accessory", equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
    boots.equippableActorIds = [];
    project.database.classes.find((entry) => entry.id === actor.classId)!.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
    expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "notEquippable" });
    boots.equippableActorIds = [actor.id];
    boots.cursed = true;
    expect(transitionActorEquipment({ ...input, slot: slot.id, equipment: { [slot.id]: boots.id } })).toEqual({ kind: "rejected", reason: "cursedEquipment" });
    boots.twoHanded = true;
    expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
    expect(input.inventory).toEqual({ [boots.id]: 1 });
  });

  it.each(["missing", "", "__proto__"])("rejects unknown or unsafe authored slot %j on project reload", (id) => {
    const { project, boots } = fixture();
    boots.slot = id;
    expect(() => deserialize(serialize(project))).toThrow(/slot/i);
  });

  it("validates catalog identity, initial equipment, event slots, and all custom save values", () => {
    const { project, actor, slot } = fixture();
    project.database.equipmentSlots!.push({ ...slot });
    expect(() => deserialize(serialize(project))).toThrow(/Duplicate equipment slot/);
    project.database.equipmentSlots!.pop();
    actor.initialEquipment.missing = project.database.equipment[0]!.id;
    expect(() => deserialize(serialize(project))).toThrow(/slot/);
    delete actor.initialEquipment.missing;
    project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [
      { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
    ] } as typeof project.commonEvents[number]);
    expect(deserialize(serialize(project)).commonEvents.at(-1)!.commands[0]).toMatchObject({ slot: slot.id });
    project.commonEvents.at(-1)!.commands = [{ kind: "changeEquipment", actorId: actor.id, slot: "missing", equipmentId: "" }];
    expect(() => deserialize(serialize(project))).toThrow(/slot/);
    expect(isActorEquipmentRecord({ [actor.id]: { [slot.id]: 42 } })).toBe(false);
    const storage = new MemoryStorage();
    const snapshot = createSaveSnapshot(project, startSession(project));
    const malformed = JSON.parse(JSON.stringify(snapshot));
    malformed.session.actorEquipment[actor.id][slot.id] = 42;
    storage.setItem(saveSlotKey(1), JSON.stringify(malformed));
    expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
  });

  it("keeps catalog-free legacy projects and saves compatible, even after renaming built-in labels", () => {
    const project = createBlankProject();
    expect(project.database.equipmentSlots).toBeUndefined();
    const loaded = deserialize(serialize(project));
    expect(equipmentSlots(loaded).map((slot) => slot.id)).toEqual(["weapon", "shield", "helmet", "armor", "accessory"]);
    const actor = loaded.database.actors[0]!;
    const weapon = loaded.database.equipment.find((entry) => entry.slot === "weapon")!;
    weapon.twoHanded = true;
    weapon.equippableActorIds = [actor.id];
    renameEquipmentSlot(loaded, "weapon", "Main hand");
    const result = transitionActorEquipment({ project: loaded, actorId: actor.id, equipment: {}, inventory: { [weapon.id]: 1 }, slot: "weapon", equipmentId: weapon.id });
    expect(result).toMatchObject({ kind: "accepted", equipment: { weapon: weapon.id, shield: weapon.id }, inventory: {} });
    const snapshot = createSaveSnapshot(loaded, startSession(loaded));
    const legacy = { ...snapshot, session: { ...snapshot.session, actorEquipment: undefined } };
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, legacy);
    expect(readSaveSlot(storage, 1).kind).toBe("present");
    expect(applySaveSnapshot(loaded, legacy).actorEquipment[actor.id]).toEqual(actor.initialEquipment);
  });

  it("authors a custom slot inline, retains its ID on rename, and exposes it in the actor picker", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const equipmentId = project.database.equipment[0]!.id;
      store.replace(project);
      const form = document.createElement("section") as unknown as FakeElement;
      const render = () => {
        form.replaceChildren();
        renderEquipmentRecordForm(form as unknown as HTMLElement, store.getCurrent().database.equipment.find((entry) => entry.id === equipmentId)!, render);
      };
      render();
      node(form, "db-equipment-slot-new-label").value = "Boots";
      node(form, "db-equipment-slot-add").click();
      const slot = store.getCurrent().database.equipmentSlots![0]!;
      expect(slot.id).not.toBe("accessory");
      expect(store.getCurrent().database.equipment[0]!.slot).toBe(slot.id);
      const label = node(form, `db-equipment-slot-label-${slot.id}`);
      label.value = "Greaves";
      label.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipmentSlots![0]).toEqual({ id: slot.id, label: "Greaves" });
      expect(node(form, `db-equipment-slot-remove-${slot.id}`).disabled).toBe(true);
      const actor = store.getCurrent().database.actors[0]!;
      const panel = battlePanel(actor, () => undefined, () => undefined) as unknown as FakeElement;
      const picker = node(panel, `db-picker-actor-equipment-${slot.id}`);
      picker.value = equipmentId;
      picker.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
      expect(deserialize(serialize(store.getCurrent())).database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
    } finally {
      restoreDom();
    }
  });
});
