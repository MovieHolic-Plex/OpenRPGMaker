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
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { startSession } from "@/project/session";
import type { GameEvent, Project } from "@/project/types";
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
  // The flagship project can take over three minutes to build on shared workers.
  fixtures.set("maou", loadFixture("maou"));
}, 300_000);

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
  const target = targetFor(collection, project.database[collection]?.[0]?.id);
  return runPrimitive(project, target, idFor(collection, "create"), { id: exampleId, ...examples[collection].create }).after;
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
      const target = targetFor(collection, operation === "create" ? before.database[collection]?.[0]?.id : exampleId);
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
      expect(result.after).toEqual({ ...before, database: { ...snapshot, [collection]: expectedRows } });
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

it("전투가 끝난 뒤 실행하는 분기 속의 일정표를 삭제할 수 없다", () => {
  const collection = "schedules";
  const before = createRecord(setup(collection, "blank"), collection);
  before.database.troops = [{
    id: "troop_unit21", name: "경비대", enemyIds: [], autoAlign: true, battleEventPages: [],
    afterBattle: { victory: [{
      kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [],
      else: [{ kind: "planSchedule", scheduleId: exampleId }],
    }] },
  }];
  expectRefused(before, targetFor(collection), idFor(collection, "delete"), {}, /이 항목을 쓰는 곳이 있어/u);
});

it("조건이 참조하는 몬스터 종의 표시 이름만 바꿀 수 있고 삭제는 거절한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const linked: Project = { ...before, commonEvents: [{
    id: "ce_unit21_check", name: "일행 검사", trigger: "none",
    commands: [{
      kind: "fork", condition: { kind: "not", condition: { kind: "monsterSpecies", speciesId: exampleId, present: true } },
      then: [],
    }],
  }] };
  const target = targetFor(collection);
  const after = runPrimitive(linked, target, idFor(collection, "update"), { name: "빛벌레" }).after;
  expect(after.database.monsterSpecies?.[0]).toMatchObject({ id: exampleId, name: "빛벌레" });
  expect(after.commonEvents).toBe(linked.commonEvents);
  expectRefused(after, target, idFor(collection, "delete"), {}, /이 항목을 쓰는 곳이 있어/u);
});

it("도감의 발견 스위치를 쓰는 몬스터 종은 삭제할 수 없다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  before.system = { ...before.system, monsterCollection: true };
  const discovered = `mx_seen_${exampleId}`;
  before.switches = [...before.switches, { id: discovered, name: "반딧불 발견" }];
  before.commonEvents = [...before.commonEvents, {
    id: "ce_unit21_discovered", name: "도감 확인", trigger: "none",
    commands: [{ kind: "fork", condition: { kind: "switch", switchId: discovered, value: true }, then: [] }],
  }];
  expectRefused(before, targetFor(collection), idFor(collection, "delete"), {}, /이 항목을 쓰는 곳이 있어/u);
});

it("공용 이벤트의 스크립트와 스크립트 보관함에서 쓰는 몬스터 종은 삭제할 수 없다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const source = `await game.cmd({ kind: "giveMonster", speciesId: '${exampleId}', level: 3 });`;
  const script = { source, compiled: source };
  const eventProject: Project = { ...before, commonEvents: [{
    id: "ce_monster_script", name: "몬스터 선물", trigger: "none",
    commands: [{ kind: "script", ...script }],
  }] };
  const libraryProject: Project = { ...before, scriptLibrary: [{ id: "monster-gift", ...script }] };
  for (const project of [eventProject, libraryProject]) {
    expectRefused(project, targetFor(collection), idFor(collection, "delete"), {}, /스크립트에서.*쓰고 있을/u);
  }
});

it("스크립트가 몬스터 종의 ID를 계산해서 지급할 수 있으면 삭제를 거절한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const source = 'await game.cmd({ kind: "giveMonster", speciesId: "row_" + "unit21", level: 3 });';
  before.commonEvents = [{ id: "ce_dynamic_gift", name: "선물", trigger: "none", commands: [{ kind: "script", source, compiled: source }] }];
  expectRefused(before, targetFor(collection), idFor(collection, "delete"), {}, /스크립트에서/u);
});

it("작업본과 저장 원본의 참조를 보호하고 원격 삭제 충돌을 닫은 뒤에는 삭제할 수 있다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const map = before.maps[before.startMapId]!;
  const event: GameEvent = { id: "ev_gift", x: 1, y: 1, trigger: { kind: "action" }, commands: [] };
  const original: GameEvent = { ...event, commands: [{ kind: "giveMonster", speciesId: exampleId, level: 3 }] };
  const edit = { ...event, draft: { kind: "edit" as const, original } };
  const target = targetFor(collection);
  const deletion = idFor(collection, "delete");
  const projectWithEvent = (row: Project["maps"][string]["events"][number]): Project => ({
    ...before, maps: { ...before.maps, [map.id]: { ...map, events: [row] } },
  });
  expectRefused(projectWithEvent(edit), target, deletion, {}, /이 항목을 쓰는 곳/u);
  const conflict = { kind: "remote-delete" as const, detectedAt: 1 };
  expectRefused(projectWithEvent({ ...edit, commands: original.commands, draft: { ...edit.draft, conflict } }),
    target, deletion, {}, /이 항목을 쓰는 곳/u);
  const live = projectWithEvent({ ...edit, draft: { ...edit.draft, conflict } });
  const saved = projectViewWithoutEventDrafts(live);
  expect(() => runPrimitive(saved, target, deletion, {}, undefined, live)).toThrow(/삭제할 수 없습니다/u);
  const { after } = runPrimitive(saved, target, deletion, {});
  expect(after.database.monsterSpecies).toEqual([]);
});

it("대사에 이전 이름을 따로 적어 둔 항목은 이름 변경과 삭제를 거절한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  before.commonEvents = [{
    id: "ce_monster_text", name: "도감 안내", trigger: "none",
    commands: [{ kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [],
      else: [{ kind: "text", body: "반딧불을 찾아보세요." }] }],
  }];
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { name: "빛벌레" }, /기존 이름을 쓰는 곳/u);
  expectRefused(before, targetFor(collection), idFor(collection, "delete"), {}, /기존 이름을 쓰는 곳/u);
  const { after } = runPrimitive(before, targetFor(collection), idFor(collection, "update"), { attack: 24 });
  expect(after.commonEvents).toBe(before.commonEvents);
});

it("원정 도감에 가려지는 종 설명 수정만 거절한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  before.system = { ...before.system, monsterCampaign: {
    id: "test_campaign", name: "원정", speciesIds: [exampleId], speciesNotes: { [exampleId]: "원정 기록" },
    badges: [], locations: [], objectives: [],
  } };
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { dexNote: "새 기록" }, /원정에서 정한 설명/u);
});

it("낚시터가 요구하는 스킬과 레벨을 남기고 스킬 없이 낚시 경험치를 붙일 수 없다", () => {
  let before = createRecord(setup("fishSpecies", "blank"), "fishSpecies");
  before = createRecord(before, "lifeSkills");
  const [fish] = before.database.fishSpecies!;
  const [skill] = before.database.lifeSkills!;
  before.database.lifeSkills = [{ ...skill!, id: "skill_unit21_fishing", skillType: "fishing" }];
  before.system = { ...before.system, skillSystem: { enabled: true }, fishing: { enabled: true, spots: [{
    id: "spot_unit21", mapId: before.startMapId, area: { x: 1, y: 1, w: 1, h: 1 },
    catches: [{ fishId: exampleId, weight: 1, minSkillLevel: 3 }],
  }] } };
  const target = targetFor("lifeSkills", "skill_unit21_fishing");
  expectRefused(before, target, idFor("lifeSkills", "delete"), {}, /낚시터 설정/u);
  expectRefused(before, target, idFor("lifeSkills", "update"), { skillType: "farming" }, /낚시터 설정/u);
  expectRefused(before, target, idFor("lifeSkills", "update"), { maxLevel: 2 }, /낚시터 설정/u);
  const { after } = runPrimitive(before, target, idFor("lifeSkills", "update"), { maxLevel: 3 });
  expect(after.database.lifeSkills?.[0]?.maxLevel).toBe(3);
  before.database.lifeSkills = [];
  before.database.fishSpecies = [{ ...fish!, skillXp: 0 }];
  expectRefused(before, targetFor("fishSpecies"), idFor("fishSpecies", "update"), { skillXp: 2 }, /낚시터 설정/u);
});

it("농장 건물과 집 장식에는 실제 그림을 연결할 수 있다", () => {
  const before = setup("farmBuildingTypes", "blank");
  const sound = "se_unit21";
  before.assets = { ...before.assets, uploaded: { ...before.assets.uploaded, [sound]: {
    id: sound, kind: "sound", name: "효과음", dataUrl: "data:audio/wav;base64,AA==", meta: {},
  } } };
  for (const collection of ["farmBuildingTypes", "homeDecorationTypes"] as const) {
    const target = targetFor(collection);
    const id = idFor(collection, "create");
    const args = { ...examples[collection].create, id: exampleId };
    for (const invalid of [sound, "constructor", "없는-이미지"]) {
      expectRefused(before, target, id, { ...args, graphicResourceId: invalid }, /맵에 놓을 수 있는 그림/u);
    }
    const { after } = runPrimitive(before, target, id, { ...args, graphicResourceId: "farming-crop-potato" });
    const row = after.database[collection]?.[0];
    expect(row && ("levels" in row ? row.levels[0]?.graphicResourceId : row.graphicResourceId)).toBe("farming-crop-potato");
  }
});

it("성장 기간을 바꿔도 이미 다른 작물에 연결된 씨앗은 그대로 둘 수 있다", () => {
  const collection = "crops";
  const before = createRecord(setup(collection, "blank"), collection);
  const [crop] = before.database.crops!;
  before.database.crops = [crop!, { ...crop!, id: "other_crop", name: "감자" }];
  const after = runPrimitive(before, targetFor(collection), idFor(collection, "growthDays.set"), { growthDays: 2 }).after;
  expect(after.database.crops?.[1]).toEqual(before.database.crops[1]);
});

it("이미 연결된 씨앗을 다른 작물에 새로 연결할 수 없다", () => {
  const collection = "crops";
  const before = createRecord(setup(collection, "blank"), collection);
  const [crop] = before.database.crops!;
  before.database.crops = [crop!, { ...crop!, id: "other_crop", name: "감자", seedItemId: "item_ether" }];
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { seedItemId: "item_ether" }, /이미 다른 작물/u);
  expectRefused(before, targetFor(collection), idFor(collection, "create"), {
    ...examples.crops.create, id: "new_crop",
  }, /이미 다른 작물/u);
});

it("작물 이름의 길이 상한을 유니코드 코드 포인트로 센다", () => {
  const collection = "crops";
  const before = createRecord(setup(collection, "blank"), collection);
  const name = "🌱".repeat(120);
  const { after } = runPrimitive(before, targetFor(collection), idFor(collection, "update"), { name });
  expect(after.database.crops?.find(row => row.id === exampleId)?.name).toBe(name);
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { name: name + "🌱" }, /형식/u);
});

it("사용 중인 일정표의 칸을 모두 지워 계획을 열 수 없는 상태로 만들 수 없다", () => {
  const collection = "schedules";
  const before = createRecord(setup(collection, "blank"), collection);
  before.commonEvents = [...before.commonEvents, {
    id: "ce_unit21_plan", name: "계획 세우기", trigger: "none",
    commands: [{ kind: "planSchedule", scheduleId: exampleId }],
  }];
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { slotLabels: [] }, /일정 칸을 하나 이상/u);
});

it("설치된 건물의 크기나 장식의 방향을 바꿔 시작 배치를 깨뜨릴 수 없다", () => {
  let before = createRecord(setup("farmBuildingTypes", "blank"), "farmBuildingTypes");
  before = createRecord(before, "homeDecorationTypes");
  const { startMapId: mapId } = before;
  before.session = {
    ...before.session,
    farmBuildingPlacements: [{ instanceId: "shed", typeId: exampleId, level: 1, mapId, x: 1, y: 1, orientation: "down" }],
    homeDecorationPlacements: [{ instanceId: "plant", typeId: exampleId, mapId, x: 3, y: 1, orientation: "down" }],
  };
  expect(collectProjectReferenceIssues(before).filter(issue => issue.includes("Placements"))).toEqual([]);
  expectRefused(before, targetFor("farmBuildingTypes"), idFor("farmBuildingTypes", "update"), { width: 3 }, /이미 배치한/u);
  expectRefused(before, targetFor("homeDecorationTypes"), idFor("homeDecorationTypes", "update"), { allowedOrientations: ["up"] }, /이미 배치한/u);
  const after = runPrimitive(before, targetFor("homeDecorationTypes"), idFor("homeDecorationTypes", "update"), {
    allowedOrientations: ["down", "up"],
  }).after;
  expect(after.session).toBe(before.session);
});

it("사라진 선택, 중복된 선택, 이미 쓰는 ID와 빈 이름의 작업을 거절한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const [row] = before.database.monsterSpecies!;
  expectRefused(before, targetFor(collection, "gone"), idFor(collection, "update"), { name: "새 이름" }, /찾을 수 없어요/u);
  expectRefused(before, targetFor(collection, "gone"), idFor(collection, "create"), { id: "new_monster", name: "새 종" }, /찾을 수 없어요/u);
  expectRefused(before, targetFor(collection), idFor(collection, "create"), { id: exampleId, name: "새 이름" }, /같은 ID/u);
  expectRefused(before, targetFor(collection), idFor(collection, "update"), { name: " \t " }, /값의 형식/u);
  before.database.monsterSpecies = [row!, { ...row!, name: "같은 ID" }];
  expectRefused(before, targetFor(collection), idFor(collection, "delete"), {}, /구별할 수 없어요/u);
});

it("생성 범위는 한 항목 추가만 허용하고 수정과 삭제 범위는 선택한 행으로 한정한다", () => {
  const collection = "monsterSpecies";
  const before = createRecord(setup(collection, "blank"), collection);
  const target = targetFor(collection);
  const sibling = { ...before.database.monsterSpecies![0]!, id: "other_monster", name: "불나비" };
  before.database.monsterSpecies!.push(sibling);
  for (const operation of ["create", "update", "delete"] as const) {
    const primitive = PRIMITIVES.find(row => row.id === idFor(collection, operation))!;
    const args = operation === "create" ? { id: "new_monster", name: "나방" }
      : operation === "update" ? { name: "빛벌레" } : {};
    const { after } = runPrimitive(before, target, primitive.id, args);
    const scope = primitive.scope({ project: before, target }, args);
    expect(checkSmallTaskScope(before, after, scope)).toEqual({ ok: true });
    const rows = after.database.monsterSpecies!;
    const changedSibling = rows.map(row => row.id === sibling.id ? { ...row, name: "다른 종" } : row);
    const outside = { ...after, database: { ...after.database, monsterSpecies: changedSibling } };
    expect(checkSmallTaskScope(before, outside, scope).ok).toBe(false);
    if (operation === "create") {
      const twoNew = { ...after, database: { ...after.database, monsterSpecies: [...rows, { ...sibling, id: "extra_monster" }] } };
      expect(checkSmallTaskScope(before, twoNew, scope).ok).toBe(false);
    }
  }
});

testSeededCorpus();
