/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/19-db-items-equipment";
import type { SmallTaskTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { goodsIndex } from "@/player/playSceneShopGoods";
import { useItemFromMenu } from "@/player/playerItemUse";
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { activeItemEffects } from "@/project/itemUsage";
import { startSession } from "@/project/session";
import type { Command, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import corpus from "../../harness-data/small-task-corpus/19-db-items-equipment.json";
import slotCorpus from "./19-db-items-equipment/slots-corpus.json";
import { expectApplies, expectUndoRestores, loadFixture } from "./harness";

type Collection = "items" | "equipment" | "equipmentSlots" | "elements";
type Args = Record<string, unknown>;

const ids: Record<Collection, string> = {
  items: "item_trial_tonic",
  equipment: "equip_trial_blade",
  equipmentSlots: "slot_trial_relic",
  elements: "element_trial_moon",
};
const names: Record<Collection, string> = {
  items: "달빛 물약",
  equipment: "연습 검",
  equipmentSlots: "유물 칸",
  elements: "달빛",
};

let maou: Project;

function target(collection: Collection, id = ids[collection]): SmallTaskTarget {
  return { kind: "dbEntry", collection, id, label: names[collection] };
}

function setup(name: "blank" | "built" | "maou"): Project {
  const base = name === "maou" ? maou : loadFixture(name);
  const project = { ...base, database: { ...base.database } };
  const actor = project.database.actors.find(candidate => candidate.id === project.system.startActorIds[0])!;
  project.database.items = [...project.database.items, normalizeItemRecord({
    id: ids.items, name: names.items, type: "medicine", occasion: "always", price: 50,
    hpRecovery: { flat: 20, percentMax: 15 },
  })];
  project.database.equipment = [...project.database.equipment, normalizeEquipmentRecord({
    id: ids.equipment, name: names.equipment, slot: "weapon", equippableActorIds: [actor.id],
    statBonuses: { attack: 3, defense: 4, mind: 5, agility: 6 }, twoHanded: true,
  })];
  project.database.equipmentSlots = [...project.database.equipmentSlots ?? [], { id: ids.equipmentSlots, label: names.equipmentSlots }];
  project.database.elements = [...project.database.elements ?? [], {
    id: ids.elements, name: names.elements, kind: "magical", rateLabels: ["A", "B", "C", "D", "E"],
    damageMultipliers: { A: 220, B: 150, C: 100, D: 50, E: 0 },
  }];
  return project;
}

type Case = {
  collection: Collection;
  action: string;
  fixture: "blank" | "built" | "maou";
  args: Args;
  resultId?: string;
  expected?: Record<string, unknown>;
  detail?: string;
};

const cases: readonly Case[] = [
  { collection: "items", action: "create", fixture: "blank", args: { name: "풀잎약", price: 80, hpRecovery: 30 },
    resultId: "item_small_1", expected: { name: "풀잎약", price: 80, type: "medicine", hpRecovery: { flat: 30, percentMax: 0 },
      occasion: "always", occasionField: true, occasionBattle: true } },
  { collection: "items", action: "update", fixture: "maou", args: { name: "별빛 물약", occasion: "field", mpRecovery: 45 },
    expected: { name: "별빛 물약", occasion: "field", occasionField: true, occasionBattle: false, mpRecovery: { flat: 45, percentMax: 0 } } },
  { collection: "items", action: "delete", fixture: "blank", args: {}, detail: "지워요" },
  { collection: "equipment", action: "create", fixture: "built", args: { name: "청동검", attack: 12, price: 250, attackElementIds: ["fire"] },
    resultId: "equip_small_1", expected: { name: "청동검", slot: "weapon", price: 250, attackElementIds: ["fire"],
      statBonuses: { attack: 12, defense: 0, mind: 0, agility: 0 } } },
  { collection: "equipment", action: "update", fixture: "blank", args: { slot: "armor", defense: 13, cursed: true },
    expected: { slot: "armor", twoHanded: false, cursed: true, statBonuses: { attack: 3, defense: 13, mind: 5, agility: 6 } } },
  { collection: "equipment", action: "delete", fixture: "maou", args: {}, detail: "지워요" },
  { collection: "equipmentSlots", action: "create", fixture: "blank", args: { label: "보조 손", equipsAs: "weapon" },
    resultId: "slot_small_1", expected: { label: "보조 손", equipsAs: "weapon" } },
  { collection: "equipmentSlots", action: "update", fixture: "built", args: { label: "부적", equipsAs: "accessory" },
    expected: { label: "부적", equipsAs: "accessory" } },
  { collection: "equipmentSlots", action: "delete", fixture: "blank", args: {}, detail: "지워요" },
  { collection: "elements", action: "create", fixture: "blank", args: { name: "번개" },
    resultId: "element_small_1", expected: { name: "번개", kind: "magical",
      rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } } },
  { collection: "elements", action: "update", fixture: "maou", args: { kind: "physical" },
    expected: { kind: "physical", name: "달빛", damageMultipliers: { A: 220, B: 150, C: 100, D: 50, E: 0 } } },
  { collection: "elements", action: "delete", fixture: "built", args: {}, detail: "지워요" },
  { collection: "items", action: "price.set", fixture: "blank", args: { price: 80 }, expected: { price: 80 }, detail: "가격을 80에" },
  { collection: "items", action: "hpRecovery.set", fixture: "maou", args: { hpRecovery: 200 },
    expected: { hpRecovery: { flat: 200, percentMax: 15 } }, detail: "회복량을 200에" },
];

describe("자료집 프리미티브", () => {
  // Build the authored demo only once so each operation measures the edit and its undo.
  beforeAll(() => { maou = loadFixture("maou"); }, 300_000);

  for (const test of cases) {
    const { collection, action, args, expected, resultId = ids[collection], detail } = test;
    const id = `db.${collection}.${action}`;
    it(`${id}는 선택 범위에서만 정확히 저장하고 한 번에 되돌린다`, async () => {
      const project = setup(test.fixture);
      const source = structuredClone(project.database[collection]);
      const selected = target(collection);
      const result = expectApplies(project, selected, id, args);
      const record = result.after.database[collection]?.find(row => row.id === resultId);
      if (expected) {
        const original = source?.find(row => row.id === resultId);
        if (original) expect(record).toEqual({ ...original, ...expected });
        else expect(record).toMatchObject({ id: resultId, ...expected });
      } else {
        expect(record).toBeUndefined();
      }

      const otherRows = (rows: Project["database"][Collection]) => rows?.filter(row => row.id !== resultId);
      expect(otherRows(result.after.database[collection])).toEqual(otherRows(source));
      expect(jsonEqual(project.database[collection], source)).toBe(true);
      expect(result.sentence).toMatch(/[가-힣].*\.$/u);
      expect(result.sentence).not.toMatch(/[_{}\[\]]/u);
      expect(result.sentence.length).toBeLessThanOrEqual(80);
      if (detail) expect(result.sentence).toContain(detail);

      const outside = target(collection === "items" ? "equipment" : "items");
      expect(() => runPrimitive(project, outside, id, args)).toThrow(/범위 밖/u);
      const primitive = PRIMITIVES.find(candidate => candidate.id === id)!;
      const scope = primitive.scope({ project, target: selected }, args);
      const tampered = { ...result.after, meta: { ...result.after.meta, title: "범위 밖 변경" } };
      expect(checkSmallTaskScope(project, tampered, scope)).toMatchObject({ ok: false, reason: expect.stringMatching(/범위 밖/u) });
      const sibling = source?.find(row => row.id !== resultId);
      if (sibling) {
        const rows = result.after.database[collection]!.filter(row => row.id !== sibling.id);
        const removedSibling = { ...result.after, database: { ...result.after.database, [collection]: rows } };
        expect(checkSmallTaskScope(project, removedSibling, scope)).toMatchObject({ ok: false });
      }

      await expectUndoRestores(project, result.after, selected);
    });
  }

  it("없는 연결과 항목의 식별자를 덮어쓰려는 입력을 거절한다", () => {
    const project = setup("blank");
    const fails = [
      ["items", "update", { skillId: "missing_skill" }],
      ["items", "create", { name: "잠금 도구", switchId: "missing_switch" }],
      ["equipment", "create", { name: "장화", slot: "missing_slot" }],
      ["equipment", "update", { attackElementIds: ["missing_element"] }],
      ["equipmentSlots", "update", { equipsAs: "missing_slot" }],
      ["equipmentSlots", "update", { equipsAs: ids.equipmentSlots }],
      ["items", "update", { id: "item_ether", price: 9 }],
    ] as const;
    for (const [collection, action, args] of fails) {
      const apply = () => runPrimitive(project, target(collection), `db.${collection}.${action}`, args);
      expect(apply).toThrow(PrimitiveError);
      expect(apply).toThrow(/[가-힣]/u);
    }
  });

  it("이미 사라진 선택에서는 새 항목도 추가할 수 없다", () => {
    const project = setup("blank");
    const selected = target("items");
    const { after } = runPrimitive(project, selected, "db.items.delete", {});
    expect(() => runPrimitive(after, selected, "db.items.create", { name: "새 물약" })).toThrow(/선택한 자료집 항목/u);
  });

  it("같은 식별자를 쓰는 두 항목을 한 번에 고치거나 삭제할 수 없다", () => {
    const project = setup("blank");
    const item = project.database.items.find(row => row.id === ids.items)!;
    project.database.items.push({ ...item, name: "또 다른 물약" });
    const before = structuredClone(project.database.items);
    expect(() => runPrimitive(project, target("items"), "db.items.update", { name: "새 이름" })).toThrow(/구분할 수 없어요/u);
    expect(() => runPrimitive(project, target("items"), "db.items.delete", {})).toThrow(/구분할 수 없어요/u);
    expect(project.database.items).toEqual(before);
  });

  it("상점 상품과 이벤트가 이미 사용하는 식별자로 새 아이템을 만들지 않는다", () => {
    const project = setup("blank");
    project.database.equipment.push(normalizeEquipmentRecord({ id: "item_small_1", name: "기존 검" }));
    project.commonEvents = [{
      id: "common_old_reward", name: "예전 보상", trigger: "none",
      commands: [{ kind: "changeItem", op: "+=", amount: 1, itemId: "item_small_2" }],
    }];
    const { after } = runPrimitive(project, target("items"), "db.items.create", { name: "새 회복약" });
    expect(goodsIndex(after).get("item_small_1")).toMatchObject({ name: "기존 검", source: "equipment" });
    expect(goodsIndex(after).has("item_small_2")).toBe(false);
    expect(after.database.items.at(-1)).toMatchObject({ id: "item_small_3", name: "새 회복약" });
    expect(after.commonEvents).toBe(project.commonEvents);
  });

  it("회복량·가격·이름의 입력 범위를 검사하고 약의 비율 회복량을 보존한다", () => {
    const project = setup("blank");
    const selected = target("items");
    for (const hpRecovery of [-1, 1000, 1.5, NaN]) {
      expect(() => runPrimitive(project, selected, "db.items.hpRecovery.set", { hpRecovery })).toThrow(PrimitiveError);
    }
    expect(() => runPrimitive(project, selected, "db.items.price.set", { price: 1_000_000 })).toThrow(PrimitiveError);
    for (const name of [" \t ", "\u200b"]) {
      expect(() => runPrimitive(project, selected, "db.items.update", { name })).toThrow(/이름을 입력/u);
    }
    const { after } = runPrimitive(project, selected, "db.items.hpRecovery.set", { hpRecovery: 0 });
    expect(after.database.items.find(row => row.id === ids.items)?.hpRecovery).toEqual({ flat: 0, percentMax: 15 });
    const goods = runPrimitive(project, selected, "db.items.update", { type: "normalGoods" }).after;
    expect(() => runPrimitive(goods, selected, "db.items.hpRecovery.set", { hpRecovery: 20 })).toThrow(/종류가 ‘약’/u);
  });

  it.each([["special", "activateSkillId"], ["book", "learnedSkillId"]] as const)(
    "%s 아이템의 게임에서 쓰이는 기술 연결도 바꾼다", (type, field) => {
      const project = setup("blank");
      const [oldSkill, newSkill] = project.database.skills;
      const item = project.database.items.find(row => row.id === ids.items)!;
      Object.assign(item, { type, skillId: oldSkill.id, [field]: oldSkill.id });
      const { after } = runPrimitive(project, target("items"), "db.items.update", { skillId: newSkill.id });
      const edited = after.database.items.find(row => row.id === ids.items)!;
      expect(activeItemEffects(edited)[field]).toBe(newSkill.id);
      expect(edited.skillId).toBe(oldSkill.id);
      expect(edited.hpRecovery).toEqual(item.hpRecovery);
      expect(item[field]).toBe(oldSkill.id);
    },
  );

  it("이벤트·장비·속성 연결과 기본 장비 칸을 삭제로부터 보호한다", () => {
    const project = setup("blank");
    const blankMap = createBlankProject();
    const map = blankMap.maps[blankMap.startMapId];
    project.maps = { [map.id]: map };
    project.startMapId = map.id;
    map.events = [...map.events, {
      id: "event_test_chest", name: "약 상자", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "changeItem", op: "+=", itemId: ids.items, amount: 3 }],
    }];
    const actor = project.database.actors.find(candidate => candidate.id === project.system.startActorIds[0])!;
    actor.initialEquipment = { ...actor.initialEquipment, weapon: ids.equipment };
    project.database.equipmentSlots!.push({ id: "slot_other", label: "다른 칸", equipsAs: ids.equipmentSlots });
    project.database.equipment.find(row => row.id === ids.equipment)!.attackElementIds = [ids.elements];
    for (const collection of ["items", "equipment", "equipmentSlots", "elements"] as const) {
      expect(() => runPrimitive(project, target(collection), `db.${collection}.delete`, {})).toThrow(/사용 중/u);
    }
    expect(() => runPrimitive(project, target("equipmentSlots", "weapon"), "db.equipmentSlots.delete", {})).toThrow(/기본 장비 칸/u);
    expect(() => runPrimitive(project, target("equipment"), "db.equipment.update", { slot: "armor" })).toThrow(/시작 장비/u);
  });

  it("예전 프로젝트의 기본 장비 칸 이름을 바꾸고 새 칸으로 연결한다", () => {
    const project = setup("blank");
    delete project.database.equipmentSlots;
    const selected = target("equipmentSlots", "weapon");
    expect(runPrimitive(project, selected, "db.equipmentSlots.update", { label: "무기", equipsAs: null }).after).toBe(project);
    const update = PRIMITIVES.find(row => row.id === "db.equipmentSlots.update")!;
    expect(update.scope({ project, target: selected }, { equipsAs: null })).not.toHaveProperty("create");
    const after = runPrimitive(project, target("equipmentSlots", "weapon"), "db.equipmentSlots.update", { label: "오른손" }).after;
    expect(after.database.equipmentSlots).toEqual([{ id: "weapon", label: "오른손" }]);
    expect(project.database.equipmentSlots).toBeUndefined();
    expect(runPrimitive(after, target("equipmentSlots", "weapon"), "db.equipmentSlots.create",
      { label: "왼손", equipsAs: "weapon" }).after.database.equipmentSlots).toEqual([
      { id: "weapon", label: "오른손" },
      { id: "slot_small_1", label: "왼손", equipsAs: "weapon" },
    ]);
  });

  it("공용 이벤트와 부대의 중첩 분기에서 쓰는 착용 칸을 보호하고 이름 변경을 허용한다", () => {
    const project = setup("blank");
    const actorId = project.system.startActorIds[0];
    const slot = ids.equipmentSlots;
    project.database.equipmentSlots!.find(row => row.id === slot)!.equipsAs = "weapon";
    project.database.equipment.find(row => row.id === ids.equipment)!.twoHanded = false;
    const commands: Command[] = [{ kind: "choices", options: [{ text: "착용", branch: [
      { kind: "changeEquipment", actorId, slot, equipmentId: ids.equipment },
    ] }] }];
    const commonEvents = [{ id: "common_equip", name: "장비 지급", trigger: "none" as const, commands }];
    const troop = normalizeTroopRecord({ id: "troop_equip", name: "연습 부대", battleEventPages: [
      { id: "page_equip", name: "착용 시험", span: "battle", conditions: [], commands },
    ] });
    for (const before of [
      { ...project, commonEvents },
      { ...project, database: { ...project.database, troops: [...project.database.troops, troop] } },
    ]) {
      expect(() => runPrimitive(before, target("equipmentSlots"), "db.equipmentSlots.update", { equipsAs: null })).toThrow(/기존 이벤트/u);
      expect(() => runPrimitive(before, target("equipment"), "db.equipment.update", { slot: "armor" })).toThrow(/기존 이벤트/u);
      expect(() => runPrimitive(before, target("equipment"), "db.equipment.update", { twoHanded: true })).toThrow(/기존 이벤트/u);
      expect(() => runPrimitive(before, target("equipment"), "db.equipment.delete", {})).toThrow(/사용 중/u);
      expect(() => runPrimitive(before, target("equipmentSlots"), "db.equipmentSlots.delete", {})).toThrow(/사용 중/u);
      const { after } = runPrimitive(before, target("equipmentSlots"), "db.equipmentSlots.update", { label: "새 칸 이름" });
      expect(after.commonEvents).toBe(before.commonEvents);
      expect(after.database.troops).toBe(before.database.troops);
      expect(after.database.equipmentSlots?.find(row => row.id === slot)).toEqual({ id: slot, label: "새 칸 이름", equipsAs: "weapon" });
    }
  });

  it("양손 무기로 바꿨을 때 시작 방패가 사라지는 편집을 거절한다", () => {
    const project = setup("blank");
    const weapon = project.database.equipment.find(row => row.id === ids.equipment)!;
    weapon.twoHanded = false;
    const shield = normalizeEquipmentRecord({ id: "equip_trial_shield", name: "연습 방패", slot: "shield" });
    project.database.equipment.push(shield);
    const actor = project.database.actors.find(row => row.id === project.system.startActorIds[0])!;
    actor.initialEquipment = { weapon: weapon.id, shield: shield.id };
    expect(() => runPrimitive(project, target("equipment"), "db.equipment.update", { twoHanded: true })).toThrow(/시작 장비/u);
  });

  it("쌍수 직업이 따로 있어도 현재 직업에서 방패 칸 착용이 끊기면 거절한다", () => {
    const project = setup("blank");
    const actor = project.database.actors.find(row => row.id === project.system.startActorIds[0])!;
    const job = project.database.classes.find(row => row.id === actor.classId)!;
    project.database.actors = project.database.actors.map(row => row === actor ? { ...row, options: { ...row.options, dualWield: false } } : row);
    project.database.classes = [...project.database.classes.map(row => row === job ? {
      ...row, options: { ...row.options, dualWield: false },
    } : row), { ...job, id: "class_dual_wield", options: { ...job.options, dualWield: true } }];
    Object.assign(project.database.equipment.find(row => row.id === ids.equipment)!, { slot: "shield", twoHanded: false });
    project.commonEvents = [{ id: "common_offhand", name: "왼손 장비", trigger: "none", commands: [
      { kind: "changeEquipment", actorId: actor.id, slot: "shield", equipmentId: ids.equipment },
    ] }];
    expect(() => runPrimitive(project, target("equipment"), "db.equipment.update", { slot: "weapon" })).toThrow(/기존 이벤트/u);
  });

  it("참조 정보가 없는 스크립트와 실행할 때 아이템을 고르는 스크립트의 참조를 보호한다", () => {
    const project = setup("blank");
    const source = `await game.cmd({ kind: "changeEquipment", actorId: "${project.system.startActorIds[0]}", slot: "${ids.equipmentSlots}", equipmentId: "${ids.equipment}" });`;
    project.scriptLibrary = [{ id: "equip_demo", source, compiled: source }];
    expect(() => runPrimitive(project, target("equipment"), "db.equipment.delete", {})).toThrow(/스크립트에서 사용 중/u);
    expect(() => runPrimitive(project, target("equipmentSlots"), "db.equipmentSlots.delete", {})).toThrow(/스크립트에서 사용 중/u);
    const dynamic = 'game.addItem(`item_${game.getVariable("reward")}`);';
    project.scriptLibrary = [{ id: "item_reward", source: dynamic, compiled: dynamic, effects: {
      reads: [], calls: [], writes: [], dynamic: [{ api: "addItem", line: 1 }],
    } }];
    expect(() => runPrimitive(project, target("items"), "db.items.delete", {})).toThrow(/실행할 때 아이템을 고르는 스크립트/u);
    expect(() => runPrimitive(project, target("equipment"), "db.equipment.delete", {})).toThrow(/실행할 때 아이템을 고르는 스크립트/u);
  });

  it("스크립트가 계산한 착용 칸과 상점 목록의 참조를 보호한다", () => {
    const project = setup("blank");
    const [equipmentPrefix, equipmentSuffix] = ids.equipment.split("_trial_");
    const [slotPrefix, slotSuffix] = ids.equipmentSlots.split("_trial_");
    const source = `const equipmentId = "${equipmentPrefix}_trial_" + "${equipmentSuffix}";
      const slot = "${slotPrefix}_trial_" + "${slotSuffix}";
      await game.cmd({ kind: "changeEquipment", actorId: "${project.system.startActorIds[0]}", slot, equipmentId });
      await game.cmd({ kind: "shop", itemIds: game.getText("goods").split(",") });`;
    const effects = { reads: [], calls: [], writes: [], dynamic: [] };
    project.scriptLibrary = [{ id: "computed_goods", source, compiled: source, effects }];
    for (const collection of ["items", "equipment", "equipmentSlots"] as const) {
      expect(() => runPrimitive(project, target(collection), `db.${collection}.delete`, {})).toThrow(/이벤트 명령에서 이 항목/u);
    }
    const unrelated = 'game.log("안내");';
    project.scriptLibrary = [{ id: "guide", source: unrelated, compiled: unrelated, effects }];
    expect(runPrimitive(project, target("equipment"), "db.equipment.delete", {}).after.database.equipment
      .some(row => row.id === ids.equipment)).toBe(false);
  });

  it("공용 이벤트의 아이템 조건은 이름을 바꾼 뒤에도 같은 항목을 가리킨다", () => {
    const project = setup("blank");
    project.commonEvents = [{ id: "common_condition", name: "물약 확인", trigger: "none", commands: [{
      kind: "fork", condition: { kind: "not", condition: { kind: "item", itemId: ids.items, present: true } },
      then: [], else: [],
    }] }];
    expect(() => runPrimitive(project, target("items"), "db.items.delete", {})).toThrow(/사용 중/u);
    const { after, sentence } = runPrimitive(project, target("items"), "db.items.update", { name: "별빛약" });
    expect(after.commonEvents).toBe(project.commonEvents);
    expect(after.database.items.find(row => row.id === ids.items)?.name).toBe("별빛약");
    expect(sentence).toContain("「별빛약」으로 바꿔요.");
  });

  it("몬스터 전투가 이름으로 판별하는 속성의 의미를 보존한다", () => {
    const project = setup("blank");
    project.system = { ...project.system, battleModel: "gen1", typeChart: undefined };
    project.database.elements = project.database.elements!.filter(row => row.id !== "fire");
    const element = project.database.elements.find(row => row.id === ids.elements)!;
    element.name = "불꽃";
    const selected = target("elements");
    expect(() => runPrimitive(project, selected, "db.elements.update", { name: "화염" })).toThrow(/속성의 판정/u);
    expect(() => runPrimitive(project, selected, "db.elements.delete", {})).toThrow(/기본 판정/u);
    const { after } = runPrimitive(project, selected, "db.elements.update", { name: "불" });
    expect(after.database.elements?.find(row => row.id === element.id)?.name).toBe("불");
  });

  it("장비 칸 연결만 해제하고 같은 이름의 칸을 서로 다른 항목으로 보존한다", () => {
    const project = setup("blank");
    project.database.equipmentSlots!.push({ id: "slot_small_1", label: "다른 칸" });
    const selected = target("equipmentSlots");
    const linked = runPrimitive(project, selected, "db.equipmentSlots.update", { equipsAs: "accessory" }).after;
    const cleared = runPrimitive(linked, selected, "db.equipmentSlots.update", { equipsAs: null }).after;
    expect(cleared.database.equipmentSlots).toEqual(project.database.equipmentSlots);
    const added = runPrimitive(cleared, selected, "db.equipmentSlots.create", { label: names.equipmentSlots }).after;
    expect(added.database.equipmentSlots?.at(-1)).toEqual({ id: "slot_small_2", label: names.equipmentSlots });
  });

  it("새 회복약을 이벤트로 세 개 받은 뒤 메뉴에서 사용한다", () => {
    const project = setup("blank");
    const { after } = runPrimitive(project, target("items"), "db.items.create", { name: "풀잎약", hpRecovery: 30 });
    const session = startSession(after, 19);
    const actorId = session.partyActorIds[0];
    session.actorVitals[actorId] = { ...session.actorVitals[actorId], hp: 1, maxHp: 100 };
    createInterpreter([{ kind: "changeItem", op: "+=", itemId: "item_small_1", amount: 3 }], session, after).start();
    expect(session.inventory.item_small_1).toBe(3);
    expect(useItemFromMenu(after, session, "item_small_1", actorId)).toMatchObject({ kind: "used" });
    expect(session.actorVitals[actorId].hp).toBe(31);
    expect(session.inventory.item_small_1).toBe(2);
  });

  it("이벤트가 연 상점에 바뀐 회복약 가격이 표시된다", () => {
    const project = setup("blank");
    const { after } = runPrimitive(project, target("items"), "db.items.price.set", { price: 80 });
    const session = startSession(after, 19);
    const shop = createInterpreter([{ kind: "shop", itemIds: [ids.items] }], session, after).start();
    expect(shop.kind).toBe("shop");
    if (shop.kind !== "shop") throw new Error("상점이 열리지 않았어요.");
    expect(shop.itemIds.map(id => goodsIndex(after).get(id)?.price)).toEqual([80]);
  });

  it("이벤트에서 일반 무기를 새 보조 칸에 착용한다", () => {
    const project = setup("blank");
    const changed = runPrimitive(project, target("equipment"), "db.equipment.update", { attack: 12, twoHanded: false }).after;
    const { after } = runPrimitive(changed, target("equipmentSlots"), "db.equipmentSlots.update", { equipsAs: "weapon" });
    const session = startSession(after, 19);
    const actorId = session.partyActorIds[0];
    session.inventory[ids.equipment] = 1;
    createInterpreter([{ kind: "changeEquipment", actorId, slot: ids.equipmentSlots, equipmentId: ids.equipment }], session, after).start();
    expect(session.actorEquipment[actorId][ids.equipmentSlots]).toBe(ids.equipment);
    expect(session.inventory[ids.equipment] ?? 0).toBe(0);
    expect(goodsIndex(after).get(ids.equipment)?.statBonuses?.attack).toBe(12);
  });
});

describe("자료집 한국어 회귀 요청", () => {
  // Import the corpus directly so file discovery in the browser-backed test environment
  // does not depend on the runtime URL of the shared test module.
  type UnitCase = CorpusCase & { setup?: { database: Pick<Project["database"], "equipmentSlots"> } };
  const fixtures = new Map<CorpusCase["fixture"], Project>();
  for (const entry of [...corpus, ...slotCorpus] as unknown as UnitCase[]) {
    it(entry.request, async () => {
      let fixture = fixtures.get(entry.fixture);
      if (!fixture) {
        fixture = loadFixture(entry.fixture);
        fixtures.set(entry.fixture, fixture);
      }
      // The shared fixtures have no authored slots. Seed each example before resolving its target.
      const project = entry.setup ? { ...fixture, database: { ...fixture.database, ...entry.setup.database } } : fixture;
      const selected = resolveTarget(project, entry.target);
      if (entry.expectRefusal) {
        expect(() => runPrimitive(project, selected, entry.primitive, entry.args)).toThrow(PrimitiveError);
        return;
      }
      const { after } = expectApplies(project, selected, entry.primitive, entry.args);
      if (entry.primitive.endsWith(".delete") && selected.kind === "dbEntry") {
        const rows = project.database[selected.collection] ?? [];
        expect(after.database[selected.collection]).toEqual(rows.filter(row => row.id !== selected.id));
      }
      for (const check of entry.expect ?? []) {
        const value = readCheckPath(after, check.at);
        if (check.count !== undefined) expect(value).toHaveLength(check.count);
        else expect(value).toEqual(check.equals);
      }
      await expectUndoRestores(project, after, selected);
    });
  }
});
