import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHOICE_CANCEL_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/05-cmd-party-actor";
import { mapTarget } from "@/editor/smallTask/target";
import { commitChangeset } from "@/editor/tools/changeset";
import { createInterpreter } from "@/player/interpreter";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { charsetFollowerGraphic } from "@/project/followers";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { cloneProject, createBlankProjectCopy, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

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
  const starter = source.maps[source.startMapId] ? source : createBlankProjectCopy();
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
    switches: [...source.switches],
    variables: [...source.variables, { id: variableId, name: "보상 점수" }],
    session: { ...source.session, switches: { ...source.session.switches }, variables: { ...source.session.variables } },
  };
  ensureSwitchVariableSlots(project);
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

it("분기 안에서 수정·이동·삭제할 때 현재 줄의 지문을 사용하고 이웃 줄을 보존한다", () => {
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [text], else: [text] };
  const { project, target, mapId } = fixture("blank", [fork, text]);
  const branchPath = [0, FORK_THEN_BRANCH_INDEX];
  const added = runPrimitive(project, target, "cmd.changeLevel.insert", { branchPath, actorId, amount: 3 });
  const command: Command = { kind: "changeLevel", actorId, op: "+=", amount: 3 };
  expect(pages(added.after, mapId)[1]!.commands).toEqual([{ ...fork, then: [text, command] }, text]);
  const update = { branchPath, index: 1, amount: 5, expectedHash: eventCommandHash(command) };
  const changed = runPrimitive(added.after, target, "cmd.changeLevel.update", update);
  const updated = { ...command, amount: 5 };
  expect(pages(changed.after, mapId)[1]!.commands).toEqual([{ ...fork, then: [text, updated] }, text]);
  expect(() => runPrimitive(changed.after, target, "cmd.changeLevel.update", update)).toThrow(STALE_COMMAND_LIST);

  const move = { branchPath, index: 1, toIndex: 0, expectedHash: update.expectedHash };
  expect(() => runPrimitive(changed.after, target, "cmd.move", move)).toThrow(STALE_COMMAND_LIST);
  const expectedHash = eventCommandHash(updated);
  const moved = runPrimitive(changed.after, target, "cmd.move", { ...move, expectedHash });
  expect(pages(moved.after, mapId)[1]!.commands).toEqual([{ ...fork, then: [updated, text] }, text]);
  expect(() => runPrimitive(moved.after, target, "cmd.delete", { branchPath, index: 1, expectedHash })).toThrow(STALE_COMMAND_LIST);
  const deleted = runPrimitive(moved.after, target, "cmd.delete", { branchPath, index: 0, expectedHash });
  expect(pages(deleted.after, mapId)[1]!.commands).toEqual([fork, text]);
  expect(pages(deleted.after, mapId)[0]).toBe(pages(project, mapId)[0]);
});

it("두 분기가 같은 목록을 공유할 때 한 분기만 고치는 요청을 거부한다", () => {
  const command: Command = { kind: "changeLevel", actorId, op: "+=", amount: 1 };
  const branch = [command];
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: branch, else: branch };
  const { project, target, mapId } = fixture("blank", [fork]);
  const branchPath = [0, FORK_THEN_BRANCH_INDEX];
  expect(() => runPrimitive(project, target, "cmd.changeLevel.update", {
    branchPath, index: 0, expectedHash: eventCommandHash(command), amount: 5,
  })).toThrow(/선택한 분기만/u);
  expect(() => runPrimitive(project, target, "cmd.changeLevel.insert", { branchPath, actorId })).toThrow(/선택한 분기만/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([fork]);
  expect(branch).toEqual([{ kind: "changeLevel", actorId, op: "+=", amount: 1 }]);
});

it("배열이 아직 없는 취소 분기에 처음 명령을 넣는다", () => {
  const choice: Command = { kind: "choices", options: [{ text: "계속", branch: [text] }], cancelBehavior: "branch" };
  const { project, target, mapId } = fixture("blank", [choice]);
  const branchPath = [0, CHOICE_CANCEL_BRANCH_INDEX];
  const { after } = runPrimitive(project, target, "cmd.learnSkill.insert", { branchPath, actorId, skillId });
  expect(pages(after, mapId)[1]!.commands).toEqual([{ ...choice, cancelBranch: [{ kind: "learnSkill", actorId, skillId }] }]);
  expect(choice.cancelBranch).toBeUndefined();
  expect(() => runPrimitive(project, target, "cmd.learnSkill.update", {
    branchPath, index: 0, expectedHash: eventCommandHash(text), skillId,
  })).toThrow(/명령 분기/u);
});

it("두 곳에서 공유하는 명령에 새 분기 배열을 만들지 않는다", () => {
  const choice: Command = { kind: "choices", options: [{ text: "계속", branch: [] }], cancelBehavior: "branch" };
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [choice], else: [choice] };
  const { project, target } = fixture("blank", [fork]);
  const branchPath = [0, FORK_THEN_BRANCH_INDEX, 0, CHOICE_CANCEL_BRANCH_INDEX];
  expect(() => runPrimitive(project, target, "cmd.learnSkill.insert", { branchPath, actorId, skillId })).toThrow(/선택한 분기만/u);
  expect(choice.cancelBranch).toBeUndefined();
});

it("선택한 페이지에 없는 줄, 다른 페이지 지정과 파티 위치 오류를 거부한다", () => {
  const { project, target, mapId } = fixture("built", [text]);
  const eventOnly = mapTarget(project, mapId, eventId)!;
  expect(() => runPrimitive(project, eventOnly, "cmd.changeLevel.insert", { actorId })).toThrow(SELECT_EVENT_PAGE);
  expect(() => runPrimitive(project, target, "cmd.changeLevel.update", { index: 0, amount: 2, expectedHash: eventCommandHash(text) })).toThrow(/범위 밖/u);
  expect(() => runPrimitive(project, target, "cmd.changeLevel.insert", { actorId, pageId: "page_actor_other" })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { mapId: "map_missing", x: 1, y: 1 })).toThrow(/맵/u);
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { mapId, x: project.maps[mapId].width })).toThrow(/범위 밖/u);
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { y: -1 })).toThrow(PrimitiveError);
});

it("파티 저장과 불러오기 설명에 저작한 이름과 밑줄을 표시한다", () => {
  const { project, target } = fixture("blank", []);
  const stored = runPrimitive(project, target, "cmd.storeParty.insert", { partySetId: "  camp_party  " });
  const recalled = runPrimitive(project, target, "cmd.recallParty.insert", { partySetId: "scout_party" });
  expect(stored.sentence).toContain("「camp_party」");
  expect(recalled.sentence).toContain("「scout_party」");
  expect(stored.sentence.length).toBeLessThanOrEqual(80);
  expect(recalled.sentence.length).toBeLessThanOrEqual(80);
});

it.each([
  ["changeExp", { amount: -1 }],
  ["changeLevel", { op: "=", amount: 0 }],
  ["changeLevel", { op: "=", amount: 100 }],
  ["changeLifeSkillExp", { skillId: life, amount: 1.5 }],
  ["changeActorHp", { amount: 101, amountMode: "percent" }],
  ["changeActorMp", { amount: Number.MAX_SAFE_INTEGER + 1 }],
  ["changeEquipment", { slot: "helmet", equipmentId: "equip_sword" }],
  ["changeEquipment", { equipmentId: " " }],
  ["promoteActor", { toClassId: " " }],
  ["addFollower", { spriteId: "speaker_sound", characterIndex: 0 }],
  ["addFollower", { name: " " }],
  ["removeFollower", { name: " " }],
  ["removeFollower", { all: true, name: "길잡이" }],
] as const)("%s 명령에 잘못된 값을 넣지 않는다 (%j)", (kind, args) => {
  const { project, target, mapId } = fixture("blank", [text]);
  const withActor = kind === "changeLifeSkillExp" || kind === "removeFollower" ? {} : { actorId };
  expect(() => runPrimitive(project, target, `cmd.${kind}.insert`, { ...withActor, ...args })).toThrow(PrimitiveError);
  expect(pages(project, mapId)[1]?.commands).toEqual([text]);
});

it("체력 변경을 백분율로 바꿀 때 기존 수치도 확인한다", () => {
  const command: Command = { kind: "changeActorHp", actorId, op: "+=", amount: 120 };
  const { project, target } = fixture("blank", [command]);
  expect(() => runPrimitive(project, target, "cmd.changeActorHp.update", {
    index: 0, expectedHash: eventCommandHash(command), amountMode: "percent",
  })).toThrow(/0부터 100/u);
});

it("등록된 효과음을 동행자의 걷기 그림으로 쓰지 않는다", () => {
  const { project, target } = fixture("blank", []);
  project.assets = {
    ...project.assets,
    uploaded: { ...project.assets.uploaded, uploaded_sound: { id: "uploaded_sound", name: "종소리", kind: "sound", meta: {} } },
  };
  expect(() => runPrimitive(project, target, "cmd.addFollower.insert", { spriteId: "uploaded_sound" })).toThrow(/걷기 그림/u);
});

it("주인공의 걷기 그림과 별도로 지정한 그림을 동시에 쓰지 않는다", () => {
  const { project, target } = fixture("blank", []);
  expect(() => runPrimitive(project, target, "cmd.addFollower.insert", { actorId, spriteId })).toThrow(/자기 걷기 그림/u);
});

it("업로드한 걷기 그림에서 캐릭터 칸을 바꿀 때 방향과 자세를 유지한다", () => {
  const uploadId = "uploaded_guide";
  const oldFrame = { characterIndex: 1, direction: "left", pattern: 2 } as const;
  const command: Command = {
    kind: "addFollower", name: "길잡이",
    graphic: { sprite: { type: "uploaded", id: uploadId }, direction: "left", pattern: charsetFrameIndex(oldFrame), scale: 2 },
  };
  const { project, target, mapId } = fixture("blank", [command]);
  project.assets = {
    ...project.assets,
    uploaded: { ...project.assets.uploaded, [uploadId]: { id: uploadId, name: "길잡이 걷기", kind: "charset", meta: {} } },
  };
  const edit = { index: 0, expectedHash: eventCommandHash(command), characterIndex: 3 };
  const { after } = runPrimitive(project, target, "cmd.addFollower.update", edit);
  expect(pages(after, mapId)[1]?.commands).toEqual([
    { ...command, graphic: { ...command.graphic, pattern: charsetFrameIndex({ ...oldFrame, characterIndex: 3 }) } },
  ]);
  const inserted = runPrimitive(project, target, "cmd.addFollower.insert", { spriteId: uploadId });
  expect(pages(inserted.after, mapId)[1]?.commands[1]).toMatchObject({ graphic: { sprite: { type: "uploaded", id: uploadId } } });
});

it("캐릭터 칸만 고치면 기존 그림 식별자와 그 이름을 쓰는 명령을 보존한다", () => {
  const alias = "easyrpg-charset-people1";
  const graphic = { ...charsetFollowerGraphic(spriteId, 0), sprite: { type: "bundled", id: alias } } as const;
  const command: Command = { kind: "addFollower", graphic };
  const removal: Command = { kind: "removeFollower", name: alias };
  const { project, target, mapId } = fixture("blank", [command, removal]);
  const edit = { index: 0, expectedHash: eventCommandHash(command), characterIndex: 2 };
  const { after } = runPrimitive(project, target, "cmd.addFollower.update", edit);
  expect(pages(after, mapId)[1]?.commands).toEqual([
    { ...command, graphic: { ...graphic, pattern: charsetFollowerGraphic(spriteId, 2).pattern } }, removal,
  ]);
});

it("공용 이벤트의 분기가 참조하는 파티 저장 이름은 바꾸지 않는다", () => {
  const command: Command = { kind: "storeParty", partySetId: "  정찰대 " };
  const { project, target, mapId } = fixture("blank", [command]);
  project.commonEvents = [...project.commonEvents, {
    id: "ce_recall_patrol", name: "정찰대 부르기", trigger: "none", commands: [
      { kind: "loop", body: [{ kind: "recallParty", partySetId: "정찰대" }, { kind: "breakLoop" }] },
    ],
  }];
  const edit = { index: 0, expectedHash: eventCommandHash(command) };
  expect(() => runPrimitive(project, target, "cmd.storeParty.update", { ...edit, partySetId: "후발대" })).toThrow(/불러오는 명령/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command]);
  const { after } = runPrimitive(project, target, "cmd.storeParty.update", { ...edit, partySetId: "정찰대" });
  expect(pages(after, mapId)[1]?.commands).toEqual([{ ...command, partySetId: "정찰대" }]);
  expect(after.commonEvents).toBe(project.commonEvents);
});

it("부대의 전투 후 명령이 참조하는 동행자 기본 이름을 바꾸지 않는다", () => {
  const command: Command = { kind: "addFollower", actorId };
  const { project: base, target, mapId } = fixture("built", [command]);
  const name = base.database.actors.find(actor => actor.id === actorId)!.name;
  const [troop, ...rest] = base.database.troops;
  const project: Project = {
    ...base,
    database: { ...base.database, troops: [{ ...troop!, afterBattle: { victory: [{ kind: "removeFollower", name: `${name} (2)` }] } }, ...rest] },
  };
  expect(() => runPrimitive(project, target, "cmd.addFollower.update", {
    index: 0, expectedHash: eventCommandHash(command), actorId: "actor_mage",
  })).toThrow(/동행자를 가리키는 다른 명령/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command]);
});

it("다른 이벤트의 동행 확인 조건에 사용되는 이름은 바꾸지 않는다", () => {
  const command: Command = { kind: "addFollower", actorId, name: "길잡이" };
  const { project: base, target, mapId } = fixture("blank", [command]);
  const query: Command = {
    kind: "m2Command", commandId: "m2-217-data-query",
    fields: { query: "followerPresent", target: "길잡이 (2)", variableId },
  };
  const checkEvent: GameEvent = {
    id: "ev_escort_check", x: 3, y: 2, trigger: { kind: "action" }, commands: [query],
  };
  const map = base.maps[mapId];
  const project = { ...base, maps: { ...base.maps, [mapId]: { ...map, events: [...map.events, checkEvent] } } };
  expect(() => runPrimitive(project, target, "cmd.addFollower.update", {
    index: 0, expectedHash: eventCommandHash(command), name: "새 길잡이",
  })).toThrow(/동행자를 가리키는 다른 명령/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command]);
});

it("두 동행자 중 한 명에게 붙은 번호 이름을 다른 동행자가 가로챌 수 없다", () => {
  const guide: Command = { kind: "addFollower", actorId, name: "길잡이" };
  const otherGuide: Command = { ...guide, actorId: "actor_mage" };
  const removal: Command = { kind: "removeFollower", name: "길잡이 (2)" };
  const { project, target, mapId } = fixture("blank", [guide, otherGuide, removal]);
  const edit = { index: 0, expectedHash: eventCommandHash(guide) };
  expect(() => runPrimitive(project, target, "cmd.addFollower.update", { ...edit, name: "길잡이 (2)" }))
    .toThrow(/동행자를 가리키는 다른 명령/u);
  const { after } = runPrimitive(project, target, "cmd.addFollower.update", { ...edit, name: "길잡이" });
  expect(pages(after, mapId)[1]!.commands).toEqual([guide, otherGuide, removal]);
});

it.each([
  { kind: "removeFollower", name: "길잡이 (2)" },
  { kind: "m2Command", commandId: "m2-217-data-query", fields: { query: "followerPresent", target: "길잡이 (2)", variableId } },
  { kind: "addLight", source: { id: "escort_light", at: { eventId: "길잡이 (2)" }, radius: 2 } },
] satisfies Command[])("번호가 붙은 이름을 참조하는 $kind 명령을 보존한다", reference => {
  const command: Command = { kind: "addFollower", actorId, name: "길잡이 (2)" };
  const { project, target, mapId } = fixture("blank", [command, reference]);
  expect(() => runPrimitive(project, target, "cmd.addFollower.update", {
    index: 0, expectedHash: eventCommandHash(command), name: "길잡이",
  })).toThrow(/동행자를 가리키는 다른 명령/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command, reference]);
});

it("광원이 주인공 식별자로 동행자를 따라가면 이름이 같아도 주인공 교체를 거부한다", () => {
  const command: Command = { kind: "addFollower", actorId, name: "길잡이" };
  const { project, target, mapId } = fixture("blank", [command]);
  const light = { id: "escort_light", at: { eventId: actorId }, radius: 2 };
  const edit = { index: 0, expectedHash: eventCommandHash(command), actorId: "actor_mage" };
  const map = project.maps[mapId];
  const mapLighting: Project = {
    ...project, maps: { ...project.maps, [mapId]: { ...map, defaultLighting: { ambient: 0.4, sources: [light] } } },
  };
  const commonEventLighting: Project = {
    ...project, commonEvents: [...project.commonEvents, {
      id: "ce_escort_light", name: "동행자 등불", trigger: "none", commands: [{ kind: "addLight", source: light }],
    }],
  };
  expect(() => runPrimitive(mapLighting, target, "cmd.addFollower.update", edit)).toThrow(/맵의 조명/u);
  expect(() => runPrimitive(commonEventLighting, target, "cmd.addFollower.update", edit)).toThrow(/동행자를 가리키는 다른 명령/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command]);
});

it("파티 저장의 사전 편성과 위치를 지우면 실행 시 편성과 위치를 다시 사용한다", () => {
  const command: Command = { kind: "storeParty", partySetId: "정찰대", actorIds: [actorId], x: 2, y: 3 };
  const { project, target, mapId } = fixture("blank", [command]);
  const { after } = runPrimitive(project, target, "cmd.storeParty.update", {
    index: 0, expectedHash: eventCommandHash(command), actorIds: null, x: null, y: null,
  });
  expect(jsonEqual(pages(after, mapId)[1]!.commands[0], { kind: "storeParty", partySetId: "정찰대" })).toBe(true);
});

it("다른 맵의 파티 저장 위치에는 두 좌표가 필요하고 불러올 때 지정한 칸으로 이동한다", () => {
  const command: Command = { kind: "storeParty", partySetId: "정찰대" };
  const recall: Command = { kind: "recallParty", partySetId: "정찰대" };
  const { project: base, target, mapId } = fixture("blank", [command, recall]);
  const destination = createBlankMap("작은 야영지", 3, 3);
  const project = { ...base, maps: { ...base.maps, [destination.id]: destination } };
  const location = { mapId: destination.id, x: 1, y: 2 };
  const row = { index: 0, expectedHash: eventCommandHash(command) };
  expect(() => runPrimitive(project, target, "cmd.storeParty.insert", { mapId: destination.id, x: 1 }))
    .toThrow(/가로와 세로 좌표/u);
  expect(() => runPrimitive(project, target, "cmd.storeParty.update", { ...row, mapId: destination.id, y: 2 }))
    .toThrow(/가로와 세로 좌표/u);
  expect(pages(project, mapId)[1]?.commands).toEqual([command, recall]);

  const { after } = runPrimitive(project, target, "cmd.storeParty.update", { ...row, ...location });
  const saved = pages(after, mapId)[1]!.commands[0]!;
  expect(() => runPrimitive(after, target, "cmd.storeParty.update", { ...row, expectedHash: eventCommandHash(saved), y: null }))
    .toThrow(/가로와 세로 좌표/u);
  const session = startSession(after, 1);
  session.x = destination.width + 1;
  session.y = destination.height + 1;
  const interpreter = createInterpreter(pages(after, mapId)[1]!.commands, session, after, { currentEventId: eventId });
  expect(interpreter.start()).toEqual({ kind: "transfer", ...location });
  expect(session.partySets?.["정찰대"]).toMatchObject(location);
  expect(session.flags.storePartySuccess).toBe(true);
  expect(session.flags.recallPartySuccess).toBe(true);
});

it("맵을 생략한 파티 저장 좌표는 이동 뒤 실제 맵에서 검사한다", () => {
  const { project: base, target, mapId } = fixture("blank", []);
  const x = base.maps[mapId].width;
  const destination = createBlankMap("넓은 야영지", x + 2, 4);
  const project = { ...base, maps: { ...base.maps, [destination.id]: destination } };
  const { after: stored } = runPrimitive(project, target, "cmd.storeParty.insert", { partySetId: "야영조", x });
  const { after } = runPrimitive(stored, target, "cmd.storeParty.insert", { partySetId: "야영조", x: destination.width });
  const session = startSession(after, 1);
  const arrival = { kind: "transfer", mapId: destination.id, x: 1, y: 2 } as const;
  const recall: Command = { kind: "recallParty", partySetId: "야영조" };
  const commands = [arrival, ...pages(after, mapId)[1]!.commands, recall];
  const interpreter = createInterpreter(commands, session, after, { currentEventId: eventId, continueAfterTransfer: true });
  expect(interpreter.start()).toMatchObject(arrival);
  Object.assign(session, { currentMapId: arrival.mapId, x: arrival.x, y: arrival.y });
  expect(interpreter.resume()).toEqual({ kind: "done" });
  expect(session.partySets?.["야영조"]).toMatchObject({ mapId: destination.id, x, y: arrival.y });
  expect(session.flags.storePartySuccess).toBe(false);
  expect(session.flags.recallPartySuccess).toBeUndefined();
});

function applyAndRun(edits: ReadonlyArray<readonly [string, Record<string, unknown>]>, arrange?: (session: ReturnType<typeof startSession>) => void) {
  const { project, target, mapId } = fixture("blank", []);
  project.system = { ...project.system, skillSystem: { ...project.system.skillSystem, enabled: true } };
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

it("생활 스킬 경험치가 실행 시 변수 값만큼 늘어난다", () => {
  const session = applyAndRun([
    ["cmd.changeLifeSkillExp.insert", { skillId: life, amountVariableId: variableId }],
  ], session => { session.variables[variableId] = 25; });
  expect(session.lifeSkills?.[life]?.xp).toBe(25);
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

it.each(["", "party", "all"])("파티 전체 대상 %j의 변경을 최종 적용하고 파티에만 실행한다", party => {
  const mage = "actor_mage";
  const reserve = "actor_guardian";
  const { project, target, mapId } = fixture("blank", []);
  const edits = [
    ["cmd.learnSkill.insert", { actorId: party, skillId }],
    ["cmd.changeExp.insert", { actorId: party, op: "=", amount: 42 }],
    ["cmd.changeActorHp.insert", { actorId: party, op: "=", amount: 0 }],
    ["cmd.changeActorMp.insert", { actorId: party, op: "=", amount: 0 }],
  ] as const;
  const after = edits.reduce((draft, [id, args]) => runPrimitive(draft, target, id, args).after, project);
  const commit = commitChangeset(after, project);
  expect(commit.blocking).toEqual([]);
  expect(commit.ok).toBe(true);
  const event = after.maps[mapId].events.find(event => event.id === eventId)!;
  expect(validateEventDraftBody(after, mapId, event).issues).not.toContainEqual(
    expect.objectContaining({ code: "reference.actor.missing" }),
  );

  const session = startSession(after, 1);
  session.partyActorIds = [actorId, mage];
  session.actorVitals[mage]!.mp = 5;
  const reserveVitals = { ...session.actorVitals[reserve] };
  const reserveExperience = session.actorExperience[reserve];
  const reserveSkills = session.actorSkillIds[reserve]?.slice();
  const interpreter = createInterpreter(pages(after, mapId)[1]!.commands, session, after, { currentEventId: eventId });
  expect(interpreter.start()).toEqual({ kind: "done" });
  for (const id of session.partyActorIds) {
    expect(session.actorVitals[id]).toMatchObject({ hp: 0, mp: 0 });
    expect(session.actorExperience[id]).toBe(42);
    expect(session.actorSkillIds[id]).toContain(skillId);
  }
  expect(session.actorVitals[reserve]).toEqual(reserveVitals);
  expect(session.actorExperience[reserve]).toBe(reserveExperience);
  expect(session.actorSkillIds[reserve]).toEqual(reserveSkills);
});

it("최종 적용에서 알 수 없는 체력 변경 대상을 거부한다", () => {
  const { project, mapId } = fixture("blank", []);
  const after = cloneProject(project);
  pages(after, mapId)[1]!.commands.push({ kind: "changeActorHp", actorId: "actor_missing", op: "-=", amount: 1 });
  const result = commitChangeset(after, project);
  expect(result.ok).toBe(false);
  expect(result.blocking.map(issue => issue.message).join("\n")).toMatch(/changeActorHp.*actor_missing/u);
  const event = after.maps[mapId].events.find(event => event.id === eventId)!;
  expect(validateEventDraftBody(after, mapId, event).issues).toContainEqual(
    expect.objectContaining({ code: "reference.actor.missing", message: expect.stringContaining("actor_missing") }),
  );
});

it("초안에서는 개별 주인공이 필요한 레벨 변경에 파티 전체 대상을 허용하지 않는다", () => {
  const { project, mapId } = fixture("blank", [{ kind: "changeLevel", actorId: "party", op: "+=", amount: 1 }]);
  const event = project.maps[mapId].events.find(event => event.id === eventId)!;
  expect(validateEventDraftBody(project, mapId, event).issues).toContainEqual(
    expect.objectContaining({ code: "reference.actor.missing", message: expect.stringContaining("party") }),
  );
});

it.each([4, 5])("승급 명령을 수정한 뒤 레벨 %i에 맞는 기존 분기만 실행한다", level => {
  const toClassId = "class_guardian";
  const command: Command = {
    kind: "promoteActor", actorId,
    successBranch: [{ kind: "setVariable", variableId, op: "=", value: 1 }],
    failureBranch: [{ kind: "setVariable", variableId, op: "=", value: -1 }],
  };
  const { project: base, target, mapId } = fixture("blank", [command]);
  const classId = base.database.actors.find(actor => actor.id === actorId)!.classId;
  const classes = base.database.classes.map(record => record.id === classId
    ? { ...record, promotions: [{ toClassId, requires: { level: 5 } }] }
    : record);
  const project = { ...base, database: { ...base.database, classes } };
  const { after } = runPrimitive(project, target, "cmd.promoteActor.update", {
    index: 0, expectedHash: eventCommandHash(command), toClassId,
  });
  const session = startSession(after, 1);
  session.actorLevels[actorId] = level;
  const interpreter = createInterpreter(pages(after, mapId)[1]!.commands, session, after, { currentEventId: eventId });
  expect(interpreter.start()).toEqual({ kind: "done" });
  expect(session.flags.promoteActorSuccess).toBe(level === 5);
  expect(session.variables[variableId]).toBe(level === 5 ? 1 : -1);
  expect(session.classOverrides?.[actorId]).toBe(level === 5 ? toClassId : undefined);
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
    ["cmd.removeFollower.insert", { name: " 강아지 " }],
  ]);
  expect(session.followers.map(follower => follower.name)).toEqual(["고양이"]);
});
