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
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
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
  beforeAll(() => { maou = loadFixture("maou"); }, 120_000);

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
    const after = runPrimitive(project, target("equipmentSlots", "weapon"), "db.equipmentSlots.update", { label: "오른손" }).after;
    expect(after.database.equipmentSlots).toEqual([{ id: "weapon", label: "오른손" }]);
    expect(project.database.equipmentSlots).toBeUndefined();
    expect(runPrimitive(after, target("equipmentSlots", "weapon"), "db.equipmentSlots.create",
      { label: "왼손", equipsAs: "weapon" }).after.database.equipmentSlots).toEqual([
      { id: "weapon", label: "오른손" },
      { id: "slot_small_1", label: "왼손", equipsAs: "weapon" },
    ]);
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
      for (const check of entry.expect ?? []) {
        const value = readCheckPath(after, check.at);
        if (check.count !== undefined) expect(value).toHaveLength(check.count);
        else expect(value).toEqual(check.equals);
      }
      await expectUndoRestores(project, after, selected);
    });
  }
});
