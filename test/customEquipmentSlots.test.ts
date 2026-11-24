import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { effectiveActorEquipment, transitionActorEquipment } from "@/project/equipmentRules";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { addEquipmentSlot, equipmentSlots, equipmentSlotLabel, equipmentSlotRemovalBlocker, renameEquipmentSlot, removeEquipmentSlot } from "@/project/equipmentSlots";
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
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { parseEmotionCycle, renderSystemTab } from "@/editor/panels/databaseSystemView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { isolateTimers } from "./mergedTeardown";

describe("customEquipmentSlots", () => {
  isolateTimers();
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
});

// 전투 자원·감정·장비 부여·장비 강화의 편집기 노출(#7 #9 #16 #21 #23). 폼에서 바꾼 값이 저장값에 닿는지 본다.
describe("mgL3BattleResourceEditor", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.database.states = [{ id: "state_joy", name: "기쁨" }];
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "equip_blade", name: "검", slot: "weapon" }),
      normalizeEquipmentRecord({ id: "equip_blade_plus", name: "검+", slot: "weapon" }),
    ];
    store.replace(project);
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const node = findByTestId(root, testid);
    if (!node) throw new Error(`missing ${testid}`);
    return node;
  }
  function change(root: FakeElement, testid: string, value: string): void {
    const node = byTestId(root, testid);
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
  function check(root: FakeElement, testid: string, checked: boolean): void {
    const node = byTestId(root, testid);
    node.checked = checked;
    node.dispatchEvent(new Event("change"));
  }
  describe("skill form: battle resource costs", () => {
    it("writes resource2Cost / limitSkill / partyGaugeCost and clears them at zero", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      const form = document.createElement("section") as unknown as FakeElement;
      renderSkillRecordForm(form as unknown as HTMLElement, store.getCurrent().database.skills[0]!);
      const current = () => store.getCurrent().database.skills.find((skill) => skill.id === skillId)!;
      change(form, "db-field-skill-resource2-cost", "30");
      check(form, "db-field-skill-limit", true);
      change(form, "db-field-skill-party-gauge-cost", "50");
      expect(current()).toMatchObject({ resource2Cost: 30, limitSkill: true, partyGaugeCost: 50 });
      change(form, "db-field-skill-resource2-cost", "0");
      check(form, "db-field-skill-limit", false);
      expect(current().resource2Cost).toBeUndefined();
      expect(current().limitSkill).toBeUndefined();
    });
  });
  describe("state form: emotion family and tier", () => {
    it("sets the family, then the tier, and clearing the family removes the emotion", () => {
      const current = () => store.getCurrent().database.states[0]!;
      const render = (): FakeElement => {
        const form = document.createElement("section") as unknown as FakeElement;
        renderStateRecordForm(form as unknown as HTMLElement, current());
        return form;
      };
      change(render(), "db-state-emotion-family", "기쁨");
      expect(current().emotion).toEqual({ family: "기쁨", tier: 1 });
      change(render(), "db-state-emotion-tier", "3");
      expect(current().emotion).toEqual({ family: "기쁨", tier: 3 });
      change(render(), "db-state-emotion-family", "");
      expect(current().emotion).toBeUndefined();
    });
  });
  describe("equipment form: grants and half MP", () => {
    it("toggles granted skills, sets a granted skill command, and exposes the half-MP flag", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      const current = () => store.getCurrent().database.equipment.find((record) => record.id === "equip_blade")!;
      const form = document.createElement("section") as unknown as FakeElement;
      const rerender = (): void => {
        form.replaceChildren();
        renderEquipmentRecordForm(form as unknown as HTMLElement, current(), rerender);
      };
      rerender();
      check(form, `db-field-equipment-grant-skill-${skillId}`, true);
      expect(current().grantsSkillIds).toEqual([skillId]);
      change(form, "db-field-equipment-grant-command-skill", skillId);
      expect(current().grantsCommand).toMatchObject({ id: "cmd_equip_equip_blade", kind: "skill", skillId });
      check(form, "db-field-equipment-effect-half-mp", true);
      expect(current().effectFlags.halfMpCost).toBe(true);
      check(form, `db-field-equipment-grant-skill-${skillId}`, false);
      change(form, "db-field-equipment-grant-command-skill", "");
      expect(current().grantsSkillIds).toBeUndefined();
      expect(current().grantsCommand).toBeUndefined();
    });
  });
  describe("system tab: battle resources", () => {
    // 시스템 탭은 HUD 편집기(databaseFieldHud)까지 한꺼번에 그리는데, 그 편집기가 ResizeObserver 를
    // 무조건 만든다. 공용 fakeDom 에는 없다(actionCombatEditorFields 도 같은 이유로 깨져 있다) —
    // 이 파일에서만 관찰을 하지 않는 대역을 끼운다. 검사 대상(전투 자원 필드)은 크기와 무관하다.
    let restoreResizeObserver: (() => void) | undefined;
    beforeEach(() => {
      const scope = globalThis as { ResizeObserver?: unknown };
      const previous = scope.ResizeObserver;
      scope.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} };
      restoreResizeObserver = () => { scope.ResizeObserver = previous; };
    });
    afterEach(() => restoreResizeObserver?.());

    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }

    it("enables and disables each gauge, the weakness option, and parses the emotion cycle", () => {
      const system = () => store.getCurrent().system;
      check(renderSystem(), "db-field-system-limit-gauge", true);
      check(renderSystem(), "db-field-system-resource2", true);
      check(renderSystem(), "db-field-system-party-gauge", true);
      check(renderSystem(), "db-field-system-weakness-extra-action", true);
      expect(system().limitGauge?.enabled).toBe(true);
      expect(system().resource2?.enabled).toBe(true);
      expect(system().partyGauge?.enabled).toBe(true);
      expect(system().weaknessExtraAction).toBe(true);
      change(renderSystem(), "db-field-system-resource2-max", "60");
      expect(system().resource2?.max).toBe(60);
      change(renderSystem(), "db-field-system-emotion-cycle", "기쁨>분노=1.5\n엉터리\n분노 > 슬픔 = 2");
      expect(system().emotionCycle).toEqual([
        { attackerFamily: "기쁨", targetFamily: "분노", multiplier: 1.5 },
        { attackerFamily: "분노", targetFamily: "슬픔", multiplier: 2 },
      ]);
      check(renderSystem(), "db-field-system-limit-gauge", false);
      check(renderSystem(), "db-field-system-weakness-extra-action", false);
      change(renderSystem(), "db-field-system-emotion-cycle", "");
      expect(system().limitGauge).toBeUndefined();
      expect(system().weaknessExtraAction).toBeUndefined();
      expect(system().emotionCycle).toBeUndefined();
    });

    it("parseEmotionCycle drops malformed and negative lines", () => {
      expect(parseEmotionCycle("a>b=-1\na>b\n>b=2\nx>y=0.5")).toEqual([{ attackerFamily: "x", targetFamily: "y", multiplier: 0.5 }]);
    });
  });
  describe("life crafting: equipment upgrade target", () => {
    it("switching an upgrade row to equipment lists equipment and stores target", () => {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      byTestId(host, "db-life-section-upgrades").click();
      byTestId(host, "db-life-add").click();
      check(host, "db-life-upgrade-target-equipment", true);
      const rule = () => store.getCurrent().system.itemUpgrades![0]!;
      expect(rule()).toMatchObject({ target: "equipment", fromItemId: "equip_blade", toItemId: "equip_blade" });
      change(host, "db-life-upgrade-to-item", "equip_blade_plus");
      expect(rule().toItemId).toBe("equip_blade_plus");
      check(host, "db-life-upgrade-target-equipment", false);
      expect(rule().target).toBeUndefined();
    });
  });
});
