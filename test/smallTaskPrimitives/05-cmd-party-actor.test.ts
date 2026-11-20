/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/05-cmd-party-actor";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { charsetFollowerGraphic } from "@/project/followers";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const fixtures = ["blank", "built", "maou"] as const;
const eventId = "ev_actor_test";
const pageId = "page_actor_test";
const actorId = "actor_hero";
const skillId = "skill_fire";
const life = "life_trial_fishing";
const variableId = "var_actor_test";
const spriteId = "tex_easyrpg_charset_people1";
const text: Command = { kind: "text", body: "잠시 쉬었다 가요." };

function fixture(name: typeof fixtures[number], commands: Command[]) {
  const source = loadFixture(name);
  const starter = source.maps[source.startMapId] ? source : createBlankProject();
  const mapId = starter.startMapId;
  const map = starter.maps[mapId]!;
  const page: EventPage = {
    id: pageId, name: "연습 페이지", graphic: {}, trigger: { kind: "action" },
    movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", conditions: [], commands,
  };
  const neighbor = { ...page, id: "page_actor_other", name: "옆 페이지", commands: [text] };
  const event: GameEvent = { id: eventId, name: "연습 이벤트", x: 2, y: 2, trigger: page.trigger, commands: [], pages: [neighbor, page] };
  const project: Project = {
    ...source,
    startMapId: mapId,
    startPos: starter.startPos,
    mapTree: starter.mapTree,
    maps: { ...source.maps, [mapId]: { ...map, events: [...map.events, event] } },
    database: {
      ...source.database,
      lifeSkills: [...(source.database.lifeSkills ?? []), { id: life, name: "낚시", skillType: "fishing", maxLevel: 5, levelUpRewards: [] }],
    },
    variables: [...source.variables, { id: variableId, name: "보상 점수" }],
  };
  return { project, target: mapTarget(project, mapId, eventId, pageId)!, mapId };
}

function pages(project: Project, mapId: string) {
  return project.maps[mapId].events.find(event => event.id === eventId)!.pages!;
}

type Example = {
  initial: Command;
  insert: Record<string, unknown>;
  inserted: Command;
  update: Record<string, unknown>;
  updated: Command;
  invalid: Record<string, unknown>;
};

const cases: Example[] = [
  {
    initial: { kind: "learnSkill", actorId, skillId },
    insert: { actorId, skillId }, inserted: { kind: "learnSkill", actorId, skillId },
    update: { action: "forget" }, updated: { kind: "learnSkill", actorId, skillId, action: "forget" },
    invalid: { skillId: "skill_missing" },
  },
  {
    initial: { kind: "changeExp", actorId, op: "+=", amount: 10 },
    insert: { actorId, amountVariableId: variableId },
    inserted: { kind: "changeExp", actorId, op: "+=", amount: { kind: "var", id: variableId } },
    update: { amount: 50, op: "=" }, updated: { kind: "changeExp", actorId, op: "=", amount: 50 },
    invalid: { amountVariableId: "var_missing" },
  },
  {
    initial: { kind: "changeLevel", actorId, op: "+=", amount: 1 },
    insert: { actorId }, inserted: { kind: "changeLevel", actorId, op: "+=", amount: 1 },
    update: { op: "=", amount: 5 }, updated: { kind: "changeLevel", actorId, op: "=", amount: 5 },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "changeLifeSkillExp", skillId: life, op: "+=", amount: 10 },
    insert: { skillId: life }, inserted: { kind: "changeLifeSkillExp", skillId: life, op: "+=", amount: 10 },
    update: { op: "-=", amountVariableId: variableId },
    updated: { kind: "changeLifeSkillExp", skillId: life, op: "-=", amount: { kind: "var", id: variableId } },
    invalid: { skillId: "life_missing" },
  },
  {
    initial: { kind: "promoteActor", actorId, successBranch: [text], failureBranch: [{ kind: "wait", ms: 0 }] },
    insert: { actorId },
    inserted: { kind: "promoteActor", actorId, toClassId: "", successBranch: [], failureBranch: [] },
    update: { toClassId: "class_guardian" },
    updated: { kind: "promoteActor", actorId, toClassId: "class_guardian", successBranch: [text], failureBranch: [{ kind: "wait", ms: 0 }] },
    invalid: { toClassId: "class_missing" },
  },
  {
    initial: { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "" },
    insert: { actorId, equipmentId: "equip_sword" },
    inserted: { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "equip_sword" },
    update: { slot: "shield", equipmentId: "equip_oak_shield" },
    updated: { kind: "changeEquipment", actorId, slot: "shield", equipmentId: "equip_oak_shield" },
    invalid: { equipmentId: "equip_missing" },
  },
  {
    initial: { kind: "changeActorHp", actorId, op: "-=", amount: 10 },
    insert: { actorId }, inserted: { kind: "changeActorHp", actorId, op: "-=", amount: 10 },
    update: { op: "+=", amount: 50, amountMode: "percent" },
    updated: { kind: "changeActorHp", actorId, op: "+=", amount: 50, amountMode: "percent" },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "changeActorMp", actorId, op: "-=", amount: 5 },
    insert: { actorId }, inserted: { kind: "changeActorMp", actorId, op: "-=", amount: 5 },
    update: { op: "=", amount: 0 }, updated: { kind: "changeActorMp", actorId, op: "=", amount: 0 },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "recoverAll", actorId },
    insert: {}, inserted: { kind: "recoverAll", actorId: "" },
    update: { actorId: "" }, updated: { kind: "recoverAll", actorId: "" },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "changeParty", actorId, action: "add" },
    insert: { actorId }, inserted: { kind: "changeParty", actorId, action: "add" },
    update: { action: "lead" }, updated: { kind: "changeParty", actorId, action: "lead" },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "storeParty", partySetId: "정찰대", actorIds: [actorId], x: 2, y: 3 },
    insert: {}, inserted: { kind: "storeParty", partySetId: "party_a" },
    update: { partySetId: "  선발대  " }, updated: { kind: "storeParty", partySetId: "선발대", actorIds: [actorId], x: 2, y: 3 },
    invalid: { actorIds: ["actor_missing"] },
  },
  {
    initial: { kind: "recallParty", partySetId: "후발대" },
    insert: {}, inserted: { kind: "recallParty", partySetId: "party_a" },
    update: { partySetId: "선발대" }, updated: { kind: "recallParty", partySetId: "선발대" },
    invalid: { partySetId: " " },
  },
  {
    initial: { kind: "addFollower", actorId, name: "시온" },
    insert: { spriteId, characterIndex: 2, name: "강아지" },
    inserted: { kind: "addFollower", actorId: "", name: "강아지", graphic: charsetFollowerGraphic(spriteId, 2) },
    update: { name: "길잡이" }, updated: { kind: "addFollower", actorId, name: "길잡이" },
    invalid: { actorId: "actor_missing" },
  },
  {
    initial: { kind: "removeFollower", all: true },
    insert: {}, inserted: { kind: "removeFollower", all: true },
    update: { name: "강아지" }, updated: { kind: "removeFollower", all: false, name: "강아지" },
    invalid: { all: false, name: "" },
  },
];

describe.each(cases)("$initial.kind", sample => {
  for (const action of ["insert", "update"] as const) {
    const kind = sample.initial.kind;
    const index = cases.indexOf(sample) + Number(action === "update");
    const fixtureName = kind === "changeParty" && action === "update" ? "maou" : fixtures[index % 2]!;
    it(`${action}로 한 줄을 편집하고 범위를 지키며 한 번에 되돌린다`, async () => {
      const id = `cmd.${kind}.${action}`;
      const seed = action === "insert" ? [text] : [sample.initial, text];
      const { project, target, mapId } = fixture(fixtureName, seed);
      const args = action === "insert" ? { ...sample.insert, index: 0 } : { ...sample.update, index: 0, expectedHash: eventCommandHash(sample.initial) };
      const originalPages = structuredClone(pages(project, mapId));
      const result = runPrimitive(project, target, id, args);
      const expected = action === "insert" ? sample.inserted : sample.updated;
      expect(pages(result.after, mapId)[1]!.commands).toEqual([expected, text]);
      expect(jsonEqual(pages(project, mapId), originalPages)).toBe(true);
      expect(pages(result.after, mapId)[0]).toBe(pages(project, mapId)[0]);
      expectKoreanSentence(result.sentence, target);
      expect(result.sentence).toMatch(/[.]$/u);
      expect(result.sentence).not.toMatch(/\b(?:actor|class|skill|equip|life|var|party|tex|page|ev)_|[{}\[\]]/u);

      const primitive = PRIMITIVES.find(entry => entry.id === id)!;
      const scope = primitive.scope({ project, target }, { ...args, pageId: "page_actor_other" });
      expect(scope).toEqual({ kind: "eventPage", mapId, eventId, pageId });
      const afterMap = result.after.maps[mapId]!;
      const escaped = {
        ...result.after,
        maps: {
          ...result.after.maps,
          [mapId]: { ...afterMap, events: afterMap.events.map(event => event.id === eventId
            ? { ...event, pages: event.pages!.map(page => page.id === pageId ? page : { ...page, commands: [] }) }
            : event) },
        },
      };
      expect(checkSmallTaskScope(project, escaped, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
      expect(() => runPrimitive(project, target, id, { ...args, branchPath: [0, 999] })).toThrow(/범위 밖/u);
      expect(() => runPrimitive(project, target, id, { ...args, ...sample.invalid })).toThrow(PrimitiveError);
      await expectUndoRestores(project, result.after, target);
    }, fixtureName === "maou" ? 180_000 : undefined);
  }
});

it("분기 안에 넣은 줄을 고칠 때 이웃 줄과 지문으로 보호한 내용을 보존한다", () => {
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [text], else: [text] };
  const { project, target, mapId } = fixture("blank", [fork, text]);
  const branchPath = [0, FORK_THEN_BRANCH_INDEX];
  const added = runPrimitive(project, target, "cmd.changeLevel.insert", { branchPath, actorId, amount: 3 });
  const command: Command = { kind: "changeLevel", actorId, op: "+=", amount: 3 };
  expect(pages(added.after, mapId)[1]!.commands).toEqual([{ ...fork, then: [text, command] }, text]);
  const update = { branchPath, index: 1, amount: 5, expectedHash: eventCommandHash(command) };
  const changed = runPrimitive(added.after, target, "cmd.changeLevel.update", update);
  expect(pages(changed.after, mapId)[1]!.commands).toEqual([{ ...fork, then: [text, { ...command, amount: 5 }] }, text]);
  expect(() => runPrimitive(changed.after, target, "cmd.changeLevel.update", update)).toThrow(/바뀌었습니다/u);
});

it("선택한 페이지에 없는 줄, 다른 페이지 지정과 파티 위치 오류를 거부한다", () => {
  const { project, target, mapId } = fixture("built", [text]);
  expect(() => runPrimitive(project, target, "cmd.changeLevel.update", { index: 0, amount: 2, expectedHash: eventCommandHash(text) })).toThrow(/범위 밖/u);
  expect(() => runPrimitive(project, target, "cmd.changeLevel.insert", { actorId, pageId: "page_actor_other" })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { mapId: "map_missing", x: 1, y: 1 })).toThrow(/맵/u);
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { mapId, x: project.maps[mapId].width })).toThrow(/범위 밖/u);
});

it("파티 저장의 사전 편성과 위치를 지우면 실행 시 편성과 위치를 다시 사용한다", () => {
  const command: Command = { kind: "storeParty", partySetId: "정찰대", actorIds: [actorId], x: 2, y: 3 };
  const { project, target, mapId } = fixture("blank", [command]);
  const { after } = runPrimitive(project, target, "cmd.storeParty.update", {
    index: 0, expectedHash: eventCommandHash(command), actorIds: null, x: null, y: null,
  });
  expect(jsonEqual(pages(after, mapId)[1]!.commands[0], { kind: "storeParty", partySetId: "정찰대" })).toBe(true);
});

function applyAndRun(edits: ReadonlyArray<readonly [string, Record<string, unknown>]>, arrange?: (session: ReturnType<typeof startSession>) => void) {
  const { project, target, mapId } = fixture("blank", []);
  const after = edits.reduce((draft, [id, args]) => runPrimitive(draft, target, id, args).after, project);
  const session = startSession(after, 1);
  arrange?.(session);
  const interpreter = createInterpreter(pages(after, mapId)[1]!.commands, session, after, { currentEventId: eventId });
  expect(interpreter.start()).toEqual({ kind: "done" });
  return session;
}

it("실행하면 화염을 배우고 경험치가 변수 값만큼 늘어난다", () => {
  const session = applyAndRun([
    ["cmd.learnSkill.insert", { actorId, skillId }],
    ["cmd.changeExp.insert", { actorId, amountVariableId: variableId }],
  ], session => {
    session.actorSkillIds[actorId] = [];
    session.actorExperience[actorId] = 0;
    session.variables[variableId] = 37;
  });
  expect(session.actorSkillIds[actorId]).toEqual([skillId]);
  expect(session.actorExperience[actorId]).toBe(37);
});

it("완전 회복을 실행하면 파티의 체력과 마력이 최대치로 복구된다", () => {
  const session = applyAndRun([
    ["cmd.changeActorHp.insert", { actorId, op: "=", amount: 0 }],
    ["cmd.changeActorMp.insert", { actorId, op: "=", amount: 0 }],
    ["cmd.recoverAll.insert", {}],
  ]);
  const vitals = session.actorVitals[actorId]!;
  expect(vitals.hp).toBe(vitals.maxHp);
  expect(vitals.mp).toBe(vitals.maxMp);
  expect(vitals.maxHp).toBeGreaterThan(0);
  expect(vitals.maxMp).toBeGreaterThan(0);
});

it("파티 저장과 불러오기가 바뀐 멤버를 되돌린다", () => {
  const session = applyAndRun([
    ["cmd.storeParty.insert", { partySetId: "선발대" }],
    ["cmd.changeParty.insert", { actorId: "actor_mage", action: "add" }],
    ["cmd.recallParty.insert", { partySetId: "선발대" }],
  ], session => { session.partyActorIds = [actorId]; });
  expect(session.flags.recallPartySuccess).toBe(true);
  expect(session.partyActorIds).toEqual([actorId]);
});

it("이름으로 한 동행자만 제거한다", () => {
  const session = applyAndRun([
    ["cmd.addFollower.insert", { spriteId, name: "강아지" }],
    ["cmd.addFollower.insert", { spriteId, name: "고양이" }],
    ["cmd.removeFollower.insert", { name: "강아지" }],
  ]);
  expect(session.followers.map(follower => follower.name)).toEqual(["고양이"]);
});
