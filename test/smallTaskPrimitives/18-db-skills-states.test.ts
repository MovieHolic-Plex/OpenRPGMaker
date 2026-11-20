/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { resolveSkillChoreography, retroFxSheetKeys } from "@/assets/retroSkillCatalog";
import type { MutableBattler } from "@/battle/battleBattlers";
import { runStateUpkeep } from "@/battle/battleStates";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { mapTarget, type SmallTaskTarget } from "@/editor/smallTask/target";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/18-db-skills-states";
import corpus from "../../harness-data/small-task-corpus/18-db-skills-states.json";
import { expectApplies, expectUndoRestores, loadFixture } from "./harness";

type Collection = "skills" | "states" | "skillChoreographies" | "battleAnimations";
type Fixture = "blank" | "built" | "maou";

const sheet = retroFxSheetKeys()[0]!;
const ids: Record<Collection, string> = {
  skills: "skill_unit18_spare",
  states: "state_unit18_spare",
  skillChoreographies: "chor_unit18_spare",
  battleAnimations: "anim_unit18_spare",
};
const target = (collection: Collection, id = ids[collection]): SmallTaskTarget =>
  ({ kind: "dbEntry", collection, id, label: "선택한 항목" });

const fixtures = new Map<Fixture, Project>();

function fixtureProject(fixture: Fixture): Project {
  const cached = fixtures.get(fixture);
  if (cached) return cached;
  const project = loadFixture(fixture);
  // 자료집 기록 비교와 무관한 큰 타일 참고문서는 검수 사본에서 덜어 낸다.
  const tilesets = Object.fromEntries(Object.entries(project.tilesets)
    .map(([id, tileset]) => [id, { ...tileset, referenceDocuments: [] }]));
  const base = { ...project, tilesets };
  fixtures.set(fixture, base);
  return base;
}

beforeAll(() => {
  for (const fixture of ["blank", "built", "maou"] as const) fixtureProject(fixture);
}, 180_000);

function withRecords(fixture: Fixture): Project {
  const project = fixtureProject(fixture);
  const { database } = project;
  return {
    ...project,
    database: {
      ...database,
      skills: [...database.skills, normalizeSkillRecord({ id: ids.skills, name: "화염", mpCost: { flat: 8, percentMax: 5 } })],
      states: [...database.states, { id: ids.states, name: "독", recoverNaturallyChance: 20 }],
      skillChoreographies: [...database.skillChoreographies ?? [], {
        id: ids.skillChoreographies, name: "불꽃", motion: "cast",
        layers: [{ sheet, anchor: "target", repeat: 2 }, { sheet, anchor: "user" }],
      }],
      battleAnimations: [...database.battleAnimations, {
        id: ids.battleAnimations, name: "불똥", frames: [{ cells: [], hold: 4 }], blendMode: "screen",
      }],
    },
  };
}

const edits = [
  { collection: "skills", fixture: "blank", edit: "create", args: { name: "얼음 화살", mpCost: 5 }, id: "skill_small_task_1",
    stored: normalizeSkillRecord({ id: "skill_small_task_1", name: "얼음 화살", mpCost: { flat: 5, percentMax: 0 } }) },
  { collection: "skills", fixture: "built", edit: "update", args: { name: "치유", mpCost: 3 }, id: ids.skills,
    stored: normalizeSkillRecord({ id: ids.skills, name: "치유", mpCost: { flat: 3, percentMax: 5 } }) },
  { collection: "skills", fixture: "blank", edit: "mpCost.set", args: { mpCost: 0 }, id: ids.skills,
    stored: normalizeSkillRecord({ id: ids.skills, name: "화염", mpCost: { flat: 0, percentMax: 5 } }) },
  { collection: "skills", fixture: "maou", edit: "delete", args: {}, id: ids.skills, stored: undefined },
  { collection: "states", fixture: "maou", edit: "create", args: { name: "냉기", clearOnBattleEnd: true }, id: "state_small_task_1",
    stored: { id: "state_small_task_1", name: "냉기", clearOnBattleEnd: true } },
  { collection: "states", fixture: "blank", edit: "update", args: { recoverTurns: 3, recoverChance: 75 }, id: ids.states,
    stored: { id: ids.states, name: "독", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 75 } },
  { collection: "states", fixture: "built", edit: "recoverTurns.set", args: { recoverTurns: 4 }, id: ids.states,
    stored: { id: ids.states, name: "독", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 100 } },
  { collection: "states", fixture: "built", edit: "delete", args: {}, id: ids.states, stored: undefined },
  { collection: "skillChoreographies", fixture: "built", edit: "create", args: { name: "별빛", anchor: "screen" }, id: "chor_custom",
    stored: { id: "chor_custom", name: "별빛", motion: "cast", layers: [{ sheet, anchor: "screen" }] } },
  { collection: "skillChoreographies", fixture: "maou", edit: "update", args: { speed: 1.5, anchor: "screen" }, id: ids.skillChoreographies,
    stored: { id: ids.skillChoreographies, name: "불꽃", motion: "cast", speed: 1.5, layers: [{ sheet, anchor: "screen", repeat: 2 }, { sheet, anchor: "user" }] } },
  { collection: "skillChoreographies", fixture: "blank", edit: "delete", args: {}, id: ids.skillChoreographies, stored: undefined },
  { collection: "battleAnimations", fixture: "blank", edit: "create", args: { name: "번개", scope: "allTargets" }, id: "anim_small_task_1",
    stored: normalizeBattleAnimationRecord({ id: "anim_small_task_1", name: "번개", scope: "allTargets" }) },
  { collection: "battleAnimations", fixture: "built", edit: "update", args: { position: "feet", blendMode: "normal" }, id: ids.battleAnimations,
    stored: { id: ids.battleAnimations, name: "불똥", frames: [{ cells: [], hold: 4 }], position: "feet" } },
  { collection: "battleAnimations", fixture: "maou", edit: "delete", args: {}, id: ids.battleAnimations, stored: undefined },
] as const;

it.each(edits)("$collection $edit — 저장값·한국어 설명·범위·되돌리기", async ({ collection, fixture, edit, args, id, stored }) => {
  const before = withRecords(fixture);
  const selected = target(collection);
  const primitiveId = `db.${collection}.${edit}`;
  const original = before.database[collection]!;
  const originalRows = structuredClone(original);
  const { after, sentence } = runPrimitive(before, selected, primitiveId, args);
  const updated = after.database[collection]!;
  expect(updated.find(row => row.id === id)).toStrictEqual(stored);
  expect(updated.filter(row => row.id !== id)).toEqual(original.filter(row => row.id !== id));
  expect(original).toEqual(originalRows);
  expect(after.maps).toBe(before.maps);
  for (const other of Object.keys(ids) as Collection[]) {
    if (other !== collection) expect(after.database[other]).toBe(before.database[other]);
  }
  expect(sentence).toMatch(/[가-힣]/u);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(sentence).not.toMatch(/[{}\[\]]|\b[a-z]+_[a-z0-9_]+\b/iu);
  const wrongCollection = collection === "states" ? "skills" : "states";
  expect(() => runPrimitive(before, target(wrongCollection), primitiveId, args)).toThrow(/범위 밖/u);
  await expectUndoRestores(before, after, selected);
}, 120_000);

it.each([
  ["skills", { animationId: "anim_missing_unit18" }, "전투 애니메이션"],
  ["skills", { stateId: "state_missing_unit18" }, "부여할 상태"],
  ["skills", { retroChoreographyId: "chor_missing_unit18" }, "스킬 연출"],
  ["states", { iconResourceId: "icon_missing_unit18" }, "상태 아이콘"],
  ["skillChoreographies", { sheet: "fx_missing_unit18" }, "효과 그림"],
  ["battleAnimations", { resourceId: "image_missing_unit18" }, "그림 소재"],
] as const)("%s에서 없는 참조를 거절한다", (collection, args, reason) => {
  const before = withRecords("blank");
  const call = () => runPrimitive(before, target(collection), `db.${collection}.update`, args);
  expect(call).toThrow(PrimitiveError);
  expect(call).toThrow(reason);
});

it("다른 항목의 식별자를 인자로 넘겨도 고쳐지지 않는다", () => {
  const before = withRecords("blank");
  const rows = structuredClone(before.database.skills);
  expect(() => runPrimitive(before, target("skills"), "db.skills.update", { id: "skill_attack", name: "다른 이름" })).toThrow(PrimitiveError);
  expect(jsonEqual(before.database.skills, rows)).toBe(true);
});

it("삭제하려는 상태·연출·애니메이션·스킬의 기존 참조를 지킨다", () => {
  const before = withRecords("blank");
  const skill = before.database.skills.at(-1)!;
  skill.retroChoreographyId = ids.skillChoreographies;
  skill.animationId = ids.battleAnimations;
  skill.stateEffects = [{ stateId: ids.states, chance: 100, operation: "add" }];
  before.commonEvents = [...before.commonEvents, {
    id: "ce_unit18", name: "스킬을 가르치는 이벤트", trigger: "none",
    commands: [{ kind: "learnSkill", actorId: before.database.actors[0]!.id, skillId: skill.id }],
  }];
  for (const collection of Object.keys(ids) as Collection[]) {
    expect(() => runPrimitive(before, target(collection), `db.${collection}.delete`, {})).toThrow(/사용 중/u);
  }
  expect(() => runPrimitive(before, target("skills", "skill_attack"), "db.skills.delete", {})).toThrow(/기본 항목/u);
});

it("예전 프로젝트의 연출 목록이 없어도 연출을 추가할 수 있다", () => {
  const before = withRecords("blank");
  delete before.database.skillChoreographies;
  const { after } = runPrimitive(before, target("skillChoreographies", ""), "db.skillChoreographies.create", { name: "불빛" });
  expect(after.database.skillChoreographies?.map(row => row.name)).toEqual(["불빛"]);
  expect(before.database.skillChoreographies).toBeUndefined();
});

it("추가한 기술을 이벤트에서 배울 수 있다", () => {
  const before = withRecords("built");
  const { after } = runPrimitive(before, target("skills"), "db.skills.create", { name: "얼음 화살" });
  const actorId = after.system.startActorIds[0]!;
  const skillId = after.database.skills.at(-1)!.id;
  const session = startSession(after, 42);
  expect(createInterpreter([{ kind: "learnSkill", actorId, skillId }], session, after).start()).toEqual({ kind: "done" });
  expect(session.actorSkillIds?.[actorId]).toContain(skillId);
});

it("독이 세 번째 턴부터 확정 해제된다", () => {
  const before = withRecords("blank");
  const { after } = runPrimitive(before, target("states", "state_poison"), "db.states.update", { recoverTurns: 3 });
  const battler: MutableBattler = {
    id: "battler", recordId: "enemy_slime", name: "슬라임", hp: 100, maxHp: 100, mp: 10, maxMp: 10,
    attackPower: 10, defense: 10, mind: 10, agility: 10, chargeRate: 1, gauge: 0,
    skillIds: [], hidden: false, defending: false, stateIds: ["state_poison"], stateTurns: {},
  };
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual(["state_poison"]);
});

it("추가한 애니메이션을 호출한 이벤트는 재생을 마칠 때까지 기다린다", () => {
  const before = withRecords("built");
  const { after } = runPrimitive(before, target("battleAnimations"), "db.battleAnimations.create", { name: "번개" });
  const animationId = after.database.battleAnimations.at(-1)!.id;
  const session = startSession(after, 42);
  const command = { kind: "showAnimation", target: "player", animationId, wait: true } as const;
  const interpreter = createInterpreter([command], session, after);
  expect(interpreter.start()).toEqual(command);
  expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
});

it("변경한 도트 연출의 첫 효과 위치를 재생기가 읽는다", () => {
  const before = withRecords("blank");
  const { after } = runPrimitive(before, target("skillChoreographies"), "db.skillChoreographies.update", { anchor: "screen" });
  const result = resolveSkillChoreography({ id: ids.skills, retroChoreographyId: ids.skillChoreographies }, after.database.skillChoreographies);
  expect(result?.skill.layers[0]?.anchor).toBe("screen");
  expect(result?.skill.layers[1]?.anchor).toBe("user");
});

it("지도 선택으로 자료집 추가 범위를 열 수 없다", () => {
  const before = withRecords("built");
  const selected = mapTarget(before, before.startMapId)!;
  expect(() => PRIMITIVES[0]!.scope({ project: before, target: selected }, { name: "번개" })).toThrow(/범위 밖/u);
});

// 공용 코퍼스는 고정 픽스처에서만 대상을 고른다. 픽스처에 없는 프로젝트 소유 연출은
// 이 테스트에서 시드하고 같은 적용·경로·되돌리기 검사로 검증한다.
const seededCases = (corpus as CorpusCase[])
  .filter(entry => entry.target.kind === "dbEntry" && entry.target.collection === "skillChoreographies");
it.each(seededCases)("$request", async entry => {
  const base = fixtureProject(entry.fixture);
  const before: Project = {
    ...base,
    database: {
      ...base.database,
      skillChoreographies: [{ id: "chor_unit18_corpus", name: "불꽃", motion: "cast", layers: [{ sheet, anchor: "target" }] }],
    },
  };
  const selected = resolveTarget(before, entry.target);
  if (entry.expectRefusal) {
    expect(() => runPrimitive(before, selected, entry.primitive, entry.args)).toThrow(PrimitiveError);
    return;
  }
  const { after } = expectApplies(before, selected, entry.primitive, entry.args);
  for (const check of entry.expect ?? []) {
    const actual = readCheckPath(after, check.at);
    if (check.count !== undefined) expect(actual).toHaveLength(check.count);
    else expect(actual).toEqual(check.equals);
  }
  await expectUndoRestores(before, after, selected);
});
