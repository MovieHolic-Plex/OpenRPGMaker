/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/21-db-life-farm";
import type { Collection } from "@/editor/smallTask/primitives/units/21-db-life-farm/records";
import type { SmallTaskTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { testSeededCorpus } from "./21-db-life-farm/corpus";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const exampleId = "row_unit21";
const graphicResourceId = "generated-enemy-slime-01";
const seasons = ["spring", "summer", "fall", "winter"];

const examples = {
  monsterSpecies: {
    create: { name: "반딧불", captureRate: 0.25, maxHp: 24 },
    update: { attack: 17, dexNote: "밤에만 몸이 빛난다" },
    expected: {
      name: "반딧불", captureRate: 0.25,
      graphic: { graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 24, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
    },
    edited: { dexNote: "밤에만 몸이 빛난다", baseStats: { maxHp: 24, maxMp: 0, attack: 17, defense: 10, mind: 10, agility: 10 } },
    bad: { types: ["존재하지 않는 속성"] },
  },
  crops: {
    create: { name: "토마토", seedItemId: "item_potion", harvestItemId: "item_ether", growthDays: 3, regrowDays: 2 },
    update: { harvestCount: 3, regrowDays: 0 },
    expected: { name: "토마토", seedItemId: "item_potion", harvestItemId: "item_ether", harvestCount: 1, stages: [{ days: 3 }], seasons, regrow: { days: 2 } },
    edited: { harvestCount: 3, regrow: undefined },
    bad: { seedItemId: "item_missing" },
  },
  lifeSkills: {
    create: { name: "정원 돌보기" },
    update: { skillType: "fishing", maxLevel: 2 },
    expected: { name: "정원 돌보기", skillType: "farming", maxLevel: 10, levelUpRewards: [] },
    edited: { skillType: "fishing", maxLevel: 2 },
    bad: { maxLevel: 30 },
  },
  farmAnimalSpecies: {
    create: { name: "닭", feedItemId: "item_potion", productItemId: "item_ether" },
    update: { productCount: 3, productEveryDays: 2 },
    expected: { name: "닭", feedItemId: "item_potion", productItemId: "item_ether", productCount: 1, productEveryDays: 1, petFriendship: 10 },
    edited: { productCount: 3, productEveryDays: 2 },
    bad: { productItemId: "item_missing" },
  },
  fishSpecies: {
    create: { name: "은어", itemId: "item_potion", skillXp: 3 },
    update: { skillXp: 0 },
    expected: { name: "은어", itemId: "item_potion", skillXp: 3 },
    edited: { skillXp: 0 },
    bad: { itemId: "item_missing" },
  },
  farmBuildingTypes: {
    create: { name: "닭장", graphicResourceId, goldCost: 120, width: 2 },
    update: { goldCost: 500 },
    expected: { name: "닭장", levels: [{ level: 1, graphicResourceId, footprint: { width: 2, height: 1 }, capacity: 1, cost: { gold: 120 } }] },
    edited: { levels: [{ level: 1, graphicResourceId, footprint: { width: 2, height: 1 }, capacity: 1, cost: { gold: 500 } }] },
    bad: { allowedMapIds: ["map_missing"] },
  },
  homeDecorationTypes: {
    create: { name: "화분", placementItemId: "item_potion", graphicResourceId },
    update: { blocksMovement: true, allowedOrientations: ["left", "right"] },
    expected: { name: "화분", placementItemId: "item_potion", graphicResourceId, footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"] },
    edited: { blocksMovement: true, allowedOrientations: ["left", "right"] },
    bad: { graphicResourceId: "graphic_missing" },
  },
  schedules: {
    create: { name: "상점 일정" },
    update: { slotLabels: ["월요일 아침", "월요일 오후"], activityLabel: "광장에 가기", commonEventId: "ce_unit21" },
    expected: { title: "상점 일정", slots: [{ label: "1" }, { label: "2" }], activities: [] },
    edited: {
      slots: [{ label: "월요일 아침" }, { label: "월요일 오후" }],
      activities: [{ id: "activity_1", label: "광장에 가기", description: "", commonEventId: "ce_unit21" }],
    },
    bad: { activityLabel: "산책", commonEventId: "ce_missing" },
  },
} satisfies Record<Collection, {
  create: Record<string, unknown>; update: Record<string, unknown>;
  expected: Record<string, unknown>; edited: Record<string, unknown>; bad: Record<string, unknown>;
}>;

function targetFor(collection: Collection, id = exampleId): SmallTaskTarget {
  // The host supplies a collection for creation and a selected record for edits.
  return { kind: "dbEntry", collection, id, label: "자료집" };
}

function idFor(collection: Collection, operation: string) {
  return `db.${collection}.${operation}`;
}

const fixtureNames = ["blank", "built", "maou"] as const;
type Fixture = typeof fixtureNames[number];
const fixtures = new Map<Fixture, Project>();
const blankMapFixture = createBlankProject();

beforeAll(() => {
  // Building the flagship demo under parallel load can take longer than a record edit.
  fixtures.set("maou", loadFixture("maou"));
}, 180_000);

function setup(collection: Collection, sample: Fixture) {
  const original = fixtures.get(sample) ?? loadFixture(sample);
  fixtures.set(sample, original);
  const map = original.startMapId ? original : blankMapFixture;
  const requiredItems = [
    { id: "item_potion", name: "회복약" },
    { id: "item_ether", name: "마력약" },
  ].filter(item => !original.database.items.some(row => row.id === item.id)).map(normalizeItemRecord);
  // Keep the assets needed by reference validation and drop bulky unchanged tile reference docs.
  const project: Project = {
    ...original,
    commonEvents: [...original.commonEvents, { id: "ce_unit21", name: "광장 이동", trigger: "none", commands: [] }],
    database: { ...original.database, items: [...original.database.items, ...requiredItems] },
    maps: map.maps,
    startMapId: map.startMapId,
    startPos: map.startPos,
    mapTree: map.mapTree,
    tilesets: Object.fromEntries(Object.entries(original.tilesets).map(([id, tileset]) => [id, { ...tileset, referenceDocuments: [] }])),
  };
  if (collection !== "monsterSpecies" || sample === "blank") delete project.database[collection];
  return project;
}

function createRecord(project: Project, collection: Collection) {
  return runPrimitive(project, targetFor(collection), idFor(collection, "create"), { id: exampleId, ...examples[collection].create }).after;
}

function expectSentence(sentence: string, target: SmallTaskTarget) {
  expectKoreanSentence(sentence, target);
  expect(sentence).toMatch(/^[^.?!]+\.$/u);
}

for (const [index, collection] of (Object.keys(examples) as Collection[]).entries()) {
  const example = examples[collection];
  for (const [offset, operation] of (["create", "update", "delete"] as const).entries()) {
    const id = idFor(collection, operation);
    it(`${id}는 고른 항목만 바꾸고 한 번에 되돌린다`, async () => {
      const project = setup(collection, fixtureNames[(index + offset) % fixtureNames.length]!);
      const before = operation === "create" ? project : createRecord(project, collection);
      const target = targetFor(collection);
      const args = operation === "create" ? { id: exampleId, ...example.create } : operation === "update" ? example.update : {};
      const snapshot = structuredClone(before.database);
      const result = runPrimitive(before, target, id, args);
      expectSentence(result.sentence, target);
      const expected = { id: exampleId, ...example.expected, ...(operation === "update" ? example.edited : {}) };
      const priorRows = before.database[collection] ?? [];
      const expectedRows = operation === "create" ? [...priorRows, expected]
        : operation === "update" ? priorRows.map(row => row.id === exampleId ? expected : row)
        : priorRows.filter(row => row.id !== exampleId);
      expect(result.after.database[collection]).toEqual(expectedRows);
      expect(jsonEqual(result.after.database, { ...snapshot, [collection]: result.after.database[collection] })).toBe(true);
      expect(jsonEqual(before.database, snapshot)).toBe(true);
      expect(result.after.maps).toBe(before.maps);
      await expectUndoRestores(before, result.after, target);
    });
  }

  it(`${collection}의 다른 자료집 대상과 범위 밖 변경을 거절한다`, () => {
    const project = setup(collection, "blank");
    const before = createRecord(project, collection);
    const wrongTarget = targetFor(collection === "crops" ? "lifeSkills" : "crops");
    for (const primitive of PRIMITIVES.filter(row => row.covers.collections?.includes(collection))) {
      expect(() => primitive.scope({ project: before, target: wrongTarget }, {})).toThrow("범위 밖");
    }
    const target = targetFor(collection);
    expectRefused(before, wrongTarget, idFor(collection, "update"), example.update);
    const primitive = PRIMITIVES.find(row => row.id === idFor(collection, "update"))!;
    const allowed = runPrimitive(before, target, primitive.id, example.update).after;
    const smuggled = { ...allowed, meta: { ...allowed.meta, title: "다른 제목" } };
    expect(checkSmallTaskScope(before, smuggled, primitive.scope({ project: before, target }, example.update)))
      .toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it(`${collection}은 잘못된 입력과 사용 중인 항목 삭제를 거절한다`, () => {
    const before = createRecord(setup(collection, "blank"), collection);
    const target = targetFor(collection);
    expect(() => runPrimitive(before, target, idFor(collection, "update"), example.bad)).toThrow(/[가-힣]/u);
    const linked = { ...before, flags: { ...before.flags, [exampleId]: true } };
    expect(() => runPrimitive(linked, target, idFor(collection, "delete"), {})).toThrow("이 항목을 쓰는 곳이 있어");
    expect(() => runPrimitive(before, target, idFor(collection, "update"), { ...example.update, id: "other_row" })).toThrow(/[가-힣]/u);
  });
}

it("성장 기간 설정은 같은 단계 수와 저작 그림을 보존한다", async () => {
  const project = createRecord(setup("crops", "blank"), "crops");
  const [crop] = project.database.crops!;
  const graphicStages = [{ label: "익은 토마토" }];
  project.database.crops = [{ ...crop!, stages: [{ days: 2 }, { days: 1 }, { days: 2 }], graphicStages }];
  const target = targetFor("crops");
  const id = idFor("crops", "growthDays.set");
  const args = { growthDays: 4 };
  const result = runPrimitive(project, target, id, args);
  expect(result.after.database.crops).toEqual([{ ...project.database.crops[0], stages: [{ days: 2 }, { days: 1 }, { days: 1 }] }]);
  expectSentence(result.sentence, target);
  expect(result.sentence).toContain("4일");
  expect(() => runPrimitive(project, target, id, { growthDays: 2 })).toThrow("성장 단계 수");
  await expectUndoRestores(project, result.after, target);
});

it("건설비 설정은 재료와 다음 건물 등급을 보존한다", async () => {
  const project = createRecord(setup("farmBuildingTypes", "blank"), "farmBuildingTypes");
  const [building] = project.database.farmBuildingTypes!;
  const [base] = building!.levels;
  const items = [{ itemId: "item_potion", count: 3 }];
  const upgrade = { ...base!, level: 2, capacity: 2 };
  project.database.farmBuildingTypes = [{ ...building!, levels: [{ ...base!, cost: { gold: 120, items } }, upgrade] }];
  const target = targetFor("farmBuildingTypes");
  const id = idFor("farmBuildingTypes", "goldCost.set");
  const args = { goldCost: 500 };
  const result = runPrimitive(project, target, id, args);
  expect(result.after.database.farmBuildingTypes).toEqual([{ ...building, levels: [{ ...base, cost: { gold: 500, items } }, upgrade] }]);
  expectSentence(result.sentence, target);
  expect(result.sentence).toContain("500골드");
  await expectUndoRestores(project, result.after, target);
});

it("이벤트에서 새 몬스터 종을 일행에 넣는다", () => {
  const project = createRecord(setup("monsterSpecies", "blank"), "monsterSpecies");
  const session = startSession(project, 17);
  expect(createInterpreter([{ kind: "giveMonster", speciesId: exampleId, level: 3 }], session, project).start()).toEqual({ kind: "done" });
  expect(Object.values(session.monsterInstances ?? {})).toContainEqual(expect.objectContaining({ speciesId: exampleId, level: 3 }));
});

it("이벤트 경험치 지급에서 수정한 생활 스킬 상한을 적용한다", () => {
  const collection = "lifeSkills";
  const project = setup(collection, "blank");
  project.system = { ...project.system, skillSystem: { enabled: true } };
  const before = createRecord(project, collection);
  const { after } = runPrimitive(before, targetFor(collection), idFor(collection, "update"), { maxLevel: 2 });
  const session = startSession(after, 18);
  expect(createInterpreter([{ kind: "changeLifeSkillExp", skillId: exampleId, op: "+=", amount: 500 }], session, after).start()).toEqual({ kind: "done" });
  expect(session.lifeSkills?.[exampleId]).toMatchObject({ level: 2 });
});

it("이벤트가 물 준 작물을 하루 키우면 바꾼 기간에 익는다", () => {
  const collection = "crops";
  const before = createRecord(setup(collection, "blank"), collection);
  const { after } = runPrimitive(before, targetFor(collection), idFor(collection, "growthDays.set"), { growthDays: 4 });
  const session = startSession(after, 19);
  const mapId = after.startMapId;
  session.farmPlots = { [mapId]: { "1,1": { tilled: true, watered: true, cropId: exampleId, growthDays: 2, stage: 0 } } };
  const advance = () => createInterpreter([{ kind: "advanceCropGrowth", days: 1 }], session, after).start();
  expect(advance()).toEqual({ kind: "done" });
  expect(session.farmPlots[mapId]?.["1,1"]).toMatchObject({ growthDays: 3, stage: 0, watered: false });
  const plot = session.farmPlots[mapId]!;
  plot["1,1"] = { ...plot["1,1"]!, watered: true };
  expect(advance()).toEqual({ kind: "done" });
  expect(session.farmPlots[mapId]?.["1,1"]).toMatchObject({ growthDays: 4, stage: 1, watered: false });
});

it("공용 이벤트가 쓰는 몬스터 종은 삭제할 수 없다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const linked: Project = {
    ...before,
    commonEvents: [...before.commonEvents, {
      id: "ce_monster_gift", name: "몬스터 선물", trigger: "none",
      commands: [{ kind: "giveMonster", speciesId: exampleId, level: 3 }],
    }],
  };
  expectRefused(linked, targetFor(collection), idFor(collection, "delete"), {}, /이 항목을 쓰는 곳이 있어/u);
});

testSeededCorpus();
