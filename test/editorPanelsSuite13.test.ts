import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { effectiveActorEquipment, transitionActorEquipment } from "@/project/equipmentRules";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { addEquipmentSlot, equipmentSlots, equipmentSlotLabel, equipmentSlotRemovalBlocker, renameEquipmentSlot, removeEquipmentSlot } from "@/project/equipmentSlots";
import { serialize, deserialize } from "@/project/io/serialize";
import { normalizeActorRecord } from "@/project/actorModel";
import { actorDerivedStats, classicEnemyFormation, enemyBattlers } from "@/battle/battleBattlers";
import { startSession } from "@/project/session";
import { changeActorEquipment } from "@/project/sessionActorCommands";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, snapshotLoadBlocker, saveSlotKey } from "@/player/saveSlots";
import { isActorEquipmentRecord } from "@/player/saveSlotValidation";
import { store } from "@/project/store";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { el } from "@/util/dom";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { monsterSpeciesReferenceMessage } from "@/editor/databaseReferences";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { kindOfBattleEventCondition } from "@/editor/panels/databaseTroopBattleEventConditions";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { MonsterSpeciesRecord, TroopRecord } from "@/project/types";
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

describe("databaseAnimationCellStaleClosure", () => {
  isolateTimers();
  // P2/P8 회귀 스펙(qa-battle Major): 셀 값을 인라인 수정한 직후 '셀 추가/삭제'를 누르면
  // 렌더 시점 셀 배열(스테일 클로저)이 프레임을 덮어써 방금 수정한 값이 조용히 롤백되던 결함.
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    (globalThis as unknown as { Image: new () => object }).Image = class {
      addEventListener(): void {}
      set src(_value: string) {}
    };
    store.replace(createBlankProject());
    resetMapEditHistory();
    editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function renderForm(): { form: FakeElement; animationId: string } {
    const animation = store.getCurrent().database.battleAnimations[0];
    if (!animation) throw new Error("expected default battle animation");
    const form = el("div") as unknown as FakeElement;
    renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
    return { form, animationId: animation.id };
  }
  function storedCells(animationId: string): readonly { x: number }[] {
    const record = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
    return record?.frames?.[0]?.cells ?? [];
  }
  describe("battle animation cell mutations refetch from the store (P2)", () => {
    it("keeps an inline cell edit when 셀 추가 is clicked right after", () => {
      const { form, animationId } = renderForm();
      const xInput = findByTestId(form, "db-animation-cell-x-0");
      if (!xInput) throw new Error("missing cell x input");
      xInput.value = "55";
      xInput.dispatchEvent(new Event("input"));
      expect(storedCells(animationId)[0]?.x).toBe(55);

      const add = findByTestId(form, "db-animation-cell-add");
      if (!add) throw new Error("missing cell add button");
      add.dispatchEvent(new Event("click"));

      const cells = storedCells(animationId);
      expect(cells.length).toBe(2);
      // 스테일 클로저였다면 여기서 x 가 0 으로 롤백된다.
      expect(cells[0]?.x).toBe(55);
    });

    it("keeps an inline cell edit when another cell is deleted right after", () => {
      const { form, animationId } = renderForm();
      // 셀을 하나 늘려 2개로 만든 뒤 다시 그린다.
      const add = findByTestId(form, "db-animation-cell-add");
      if (!add) throw new Error("missing cell add button");
      add.dispatchEvent(new Event("click"));
      expect(storedCells(animationId).length).toBe(2);

      const form2 = el("div") as unknown as FakeElement;
      const animation = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
      if (!animation) throw new Error("missing animation");
      renderBattleAnimationRecordForm(form2 as unknown as HTMLElement, animation);

      const xInput = findByTestId(form2, "db-animation-cell-x-0");
      if (!xInput) throw new Error("missing cell x input");
      xInput.value = "77";
      xInput.dispatchEvent(new Event("input"));

      const deleteSecond = findByTestId(form2, "db-animation-cell-delete-1");
      if (!deleteSecond) throw new Error("missing cell delete button");
      deleteSecond.dispatchEvent(new Event("click"));

      const cells = storedCells(animationId);
      expect(cells.length).toBe(1);
      expect(cells[0]?.x).toBe(77);
    });
  });
});

describe("databaseClassLearnedSkills", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("class learned skills editor", () => {
    it("editing the first row does not drop the rest of learnedSkills", () => {
      const klass = store.getCurrent().database.classes[0];
      const skills = store.getCurrent().database.skills;
      if (!klass || skills.length < 2) throw new Error("fixture needs a class and two skills");
      updateDatabaseRecord("classes", klass.id, {
        learnedSkills: [
          { level: 1, skillId: skills[0]!.id },
          { level: 8, skillId: skills[1]!.id },
        ],
      });

      const form = document.createElement("section") as unknown as FakeElement;
      renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);

      const level = findByTestId(form, "db-field-class-skill-level");
      expect(level).not.toBeNull();
      level!.value = "3";
      level!.dispatchEvent(new Event("input"));

      const after = store.getCurrent().database.classes[0]!;
      expect(after.learnedSkills).toHaveLength(2);
      expect(after.learnedSkills[0]).toEqual({ level: 3, skillId: skills[0]!.id });
      expect(after.learnedSkills[1]).toEqual({ level: 8, skillId: skills[1]!.id });
    });

    it("add button appends a learned-skill row instead of replacing the array", () => {
      const klass = store.getCurrent().database.classes[0];
      const skills = store.getCurrent().database.skills;
      if (!klass || !skills[0]) throw new Error("fixture needs a class and a skill");
      updateDatabaseRecord("classes", klass.id, {
        learnedSkills: [{ level: 1, skillId: skills[0].id }],
      });

      const form = document.createElement("section") as unknown as FakeElement;
      renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);
      findByTestId(form, "db-add-class-skill")?.click();

      const after = store.getCurrent().database.classes[0]!;
      expect(after.learnedSkills.length).toBe(2);
      expect(after.learnedSkills[0]?.skillId).toBe(skills[0].id);
    });
  });
});

describe("databaseCollectionTabsHardening", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function species(patch: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">): MonsterSpeciesRecord {
    return normalizeMonsterSpeciesRecord(patch);
  }
  function firstEnemyForm(): { form: FakeElement; enemyId: string } {
    const enemy = store.getCurrent().database.enemies[0];
    if (!enemy) throw new Error("enemy fixture missing");
    const form = new FakeElement("div");
    renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
    return { form, enemyId: enemy.id };
  }
  function setNumber(form: FakeElement, testid: string, value: string): FakeElement {
    const input = findByTestId(form, testid);
    if (!input) throw new Error(`missing field ${testid}`);
    input.value = value;
    input.dispatchEvent(new Event("input"));
    return input;
  }
  describe("F1 포획률 스케일 마이그레이션", () => {
    it("0~100 스케일로 저작된 값을 0~1로 이관하고 이미 0~1인 값은 그대로 둔다", () => {
      expect(species({ id: "a", name: "a", captureRate: 40 }).captureRate).toBe(0.4);
      expect(species({ id: "a", name: "a", captureRate: 0.4 }).captureRate).toBe(0.4);
    });

    it("출하 기본 종족이 1.0으로 뭉개지지 않는다", () => {
      const records = defaultBattleRecords().monsterSpecies ?? [];
      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        expect(record.captureRate).toBeLessThanOrEqual(1);
        expect(record.captureRate).toBeLessThan(1);
      }
    });
  });
  describe("F2 적 그룹 좌표", () => {
    it("에디터가 만든 좌표가 런타임에서 재배치되지 않는다", () => {
      const project = store.getCurrent();
      const enemyId = project.database.enemies[0]?.id;
      if (!enemyId) throw new Error("enemy fixture missing");
      const members = [0, 1, 2, 3].map((index) => ({ enemyId, ...classicEnemyFormation(index), hidden: false }));
      for (const member of members) expect(member.x).toBeLessThanOrEqual(150);
      const troop: TroopRecord = {
        ...project.database.troops[0]!,
        members,
        enemyIds: members.map((member) => member.enemyId),
      };
      const battlers = enemyBattlers(project, troop);
      battlers.forEach((battler, index) => {
        expect(battler.battleX).toBe(members[index]!.x);
        expect(battler.battleY).toBe(members[index]!.y);
      });
    });
  });
  describe("F3 전투 이벤트 조건 편집", () => {
    it("첫 조건을 편집해도 추가 조건이 살아 있다", () => {
      const troopId = store.getCurrent().database.troops[0]!.id;
      store.update((project) => {
        const troop = project.database.troops.find((entry) => entry.id === troopId)!;
        troop.battleEventPages = [
          {
            id: "page-1",
            name: "테스트",
            span: "battle",
            conditions: [
              { kind: "turn", start: 1, interval: 1 },
              { kind: "switch", switchId: "0001", value: true },
            ],
            commands: [],
          },
        ];
      });
      const troop = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!;
      const page = troop.battleEventPages[0]!;
      const stored = page.conditions;
      updateTroopBattleEventPage(troop, page, { conditions: [{ kind: "turn", start: 3, interval: 1 }, ...stored.slice(1)] });
      const after = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!.battleEventPages[0]!;
      expect(after.conditions).toHaveLength(2);
      expect(after.conditions[1]?.kind).toBe("switch");
    });

    it("전용 폼이 없는 조건 종류는 undefined 를 반환해 편집을 잠근다", () => {
      expect(kindOfBattleEventCondition({ kind: "selfSwitch", switchId: "A", value: true } as never)).toBeUndefined();
      expect(kindOfBattleEventCondition({ kind: "turn", start: 1, interval: 1 })).toBe("turn");
      expect(kindOfBattleEventCondition(undefined)).toBe("none");
    });
  });
  describe("F4/F6 적 숫자 필드", () => {
    it("레벨 입력이 화면값과 저장값 모두 99로 클램프된다", () => {
      const { form, enemyId } = firstEnemyForm();
      const input = setNumber(form, "db-field-enemy-level", "120");
      expect(input.value).toBe("99");
      expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemyId)?.level).toBe(99);
    });

    it("드롭률 입력이 화면에서 100으로 클램프된다", () => {
      const { form } = firstEnemyForm();
      expect(setNumber(form, "db-field-enemy-drop-rate", "500").value).toBe("100");
    });
  });
  describe("F9 공격 패턴 표", () => {
    it("행동이 0개면 유령 행 대신 빈 상태를 보여주고, 행 추가가 실제 행동을 만든다", () => {
      const enemy = store.getCurrent().database.enemies[0]!;
      store.update((project) => {
        const target = project.database.enemies.find((entry) => entry.id === enemy.id)!;
        target.actions = [];
      });
      const live = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)!;
      const form = new FakeElement("div");
      renderEnemyRecordForm(form as unknown as HTMLElement, live);
      expect(findByTestId(form, "db-enemy-actions-empty")).toBeTruthy();
      expect(findByTestId(form, "db-enemy-action-row-0")).toBeFalsy();
      findByTestId(form, "db-enemy-action-add")?.click();
      expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)?.actions).toHaveLength(1);
    });
  });
  describe("F5 진화 사이클", () => {
    it("A→B→A 를 사이클로 검출하고 검증 이슈를 낸다", () => {
      const a = species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] });
      const b = species({ id: "sp_b", name: "B", evolutions: [{ toSpeciesId: "sp_a", requires: { level: 9 } }] });
      expect(monsterEvolutionCycleSpeciesIds([a, b])).toEqual(["sp_a", "sp_b"]);
      store.update((project) => {
        project.database.monsterSpecies = [a, b];
      });
      const issues = collectProjectReferenceIssues(store.getCurrent());
      expect(issues.filter((issue) => issue.includes("사이클"))).toHaveLength(1);
    });
  });
  describe("F16 종족 삭제 가드", () => {
    it("giveMonster 명령이 참조하는 종족은 삭제 가드에 걸린다", () => {
      store.update((project) => {
        project.database.monsterSpecies = [species({ id: "sp_a", name: "A" })];
        project.commonEvents = [
          { id: "ce_1", name: "테스트", trigger: "none", commands: [{ kind: "giveMonster", speciesId: "sp_a", level: 5 }] } as never,
        ];
      });
      expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeUndefined();
      expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeNull();
    });

    it("다른 종족의 진화 대상이면 삭제 가드에 걸린다", () => {
      store.update((project) => {
        project.database.monsterSpecies = [
          species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] }),
          species({ id: "sp_b", name: "B" }),
        ];
      });
      expect(monsterSpeciesReferenceMessage("sp_b")).toContain("진화");
    });
  });
});
