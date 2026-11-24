/** @vitest-environment happy-dom */
import { beforeAll, expect, it, vi } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { BUNDLED_BATTLE_MOTIONS } from "@/assets/battleMotionCatalog";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { GENERATED_EFFECT_SHEET_ASSETS } from "@/assets/generatedEffectSheets";
import { resolveSkillChoreography, retroFxSheetKeys } from "@/assets/retroSkillCatalog";
import type { MutableBattler } from "@/battle/battleBattlers";
import { consumeBattleSkillResource } from "@/battle/battleSkillUse";
import { applyStateEffects, clearBattleEndStates, RAGE_STATE_ID, runStateUpkeep } from "@/battle/battleStates";
import { statesKeptAfterBattle } from "@/project/battleEndStates";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createInterpreter } from "@/player/interpreter";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import type { Command, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { dbTarget, mapTarget, type SmallTaskTarget } from "@/editor/smallTask/target";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { plainSummary } from "@/editor/smallTask/plainSummary";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { renderRetroChoreographyTab, resetRetroChoreographyViewState } from "@/editor/panels/databaseRetroChoreographyView";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/18-db-skills-states";
import { getTool } from "@/editor/tools/toolRegistry";
import { getLocale, setLocale, t } from "@/i18n";
import { store } from "@/project/store";
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
  // 코퍼스처럼 편집기 정규화를 마친 뒤 기준 프로젝트로 사용한다.
  ensureSwitchVariableSlots(base);
  removeLegacySpriteReferences(base);
  fixtures.set(fixture, base);
  return base;
}

beforeAll(() => {
  for (const fixture of ["blank", "built", "maou"] as const) fixtureProject(fixture);
}, 600_000);

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
    stored: { id: "state_small_task_1", name: "냉기", clearOnBattleEnd: true, runtimeEffects: { removeOnBattleEnd: true } } },
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
  expect(() => runPrimitive(before, target("skills", "skill_attack"), "db.skills.delete", {})).toThrow(/기본으로 사용/u);
});

function openEventDraft(project: Project, command: Command): Project {
  const map = project.maps[project.startMapId]!;
  const original: GameEvent = { id: "ev_unit18_draft", x: 0, y: 0, trigger: { kind: "action" }, commands: [] };
  store.replaceProject({ ...project, maps: { ...project.maps, [map.id]: { ...map, events: [...map.events, original] } } });
  store.updateEvent(map.id, original.id, event => {
    event.draft = { kind: "edit", original };
    event.commands = [command];
  }, { scope: "map", mapId: map.id, label: "열린 이벤트 편집" });
  return store.getCurrent();
}

it.each(["skills", "battleAnimations"] as const)("열린 이벤트 작업본에서 쓰는 %s 삭제를 게시 직전에 막는다", collection => {
  const project = withRecords("built");
  const live = openEventDraft(project, collection === "skills"
    ? { kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: ids.skills }
    : { kind: "showAnimation", target: "player", animationId: ids.battleAnimations });
  const selected = target(collection);
  const before = smallTaskBase(live, selected);
  const { after } = runPrimitive(before, selected, `db.${collection}.delete`, {});
  expect(after.database[collection]?.some(row => row.id === ids[collection])).toBe(false);
  expect(() => commitSmallTask(live, before, after, selected)).toThrow(/열린 이벤트/u);
  expect(store.getCurrent()).toBe(live);
});

it("열린 이벤트 작업본이 참조하는 식별자를 건너뛰어 새 스킬을 저장한다", () => {
  const project = withRecords("built");
  const command: Command = {
    kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: "skill_small_task_1",
  };
  const live = openEventDraft(project, command);
  const mapId = live.startMapId;
  const draft = live.maps[mapId]!.events.find(event => event.id === "ev_unit18_draft")!;
  const selected = target("skills");
  const before = smallTaskBase(live, selected);
  const draftSource = { maps: { [mapId]: { events: [draft] } } };
  const { after } = runPrimitive(before, selected, "db.skills.create", { name: "새 스킬" }, undefined, draftSource);

  expect(after.database.skills.at(-1)?.id).toBe("skill_small_task_2");
  expect(after.maps).toBe(before.maps);
  expect(commitSmallTask(live, before, after, selected)).not.toBeNull();
  const committed = store.getCurrent();
  expect(committed.database.skills.at(-1)?.id).toBe("skill_small_task_2");
  expect(committed.maps[mapId]!.events.find(event => event.id === draft.id)).toEqual(draft);
});

it("작업본 없이 만든 새 스킬의 식별자가 열린 이벤트와 겹치면 게시를 막는다", () => {
  const project = withRecords("built");
  const newId = "skill_small_task_1";
  const live = openEventDraft(project, { kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: newId });
  const selected = target("skills");
  const before = smallTaskBase(live, selected);
  const { after } = runPrimitive(before, selected, "db.skills.create", { name: "새 스킬" });
  expect(after.database.skills.at(-1)?.id).toBe(newId);
  expect(() => commitSmallTask(live, before, after, selected)).toThrow(/열린 이벤트/u);
  expect(store.getCurrent()).toBe(live);
});

it.each(["source", "compiled"] as const)("열린 초안 스크립트의 %s에만 있는 중첩 스킬 ID와의 충돌을 막는다", field => {
  const project = withRecords("built");
  const newId = "skill_small_task_1";
  const command = {
    kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 },
    then: [{ kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: newId }],
  };
  const live = openEventDraft(project, {
    kind: "script", source: "", compiled: "",
    effects: { reads: [], writes: [], calls: [], dynamic: [] },
    [field]: `await game.cmd(${JSON.stringify(command)});`,
  });
  const selected = target("skills");
  const before = smallTaskBase(live, selected);
  const { after } = runPrimitive(before, selected, "db.skills.create", { name: "새 스킬" });
  expect(after.database.skills.at(-1)?.id).toBe(newId);
  expect(() => commitSmallTask(live, before, after, selected)).toThrow(/열린 이벤트.*같은 식별자/u);
  expect(store.getCurrent()).toBe(live);
});

it("다른 자료집 묶음의 같은 ID 선언이 스킬 삭제를 막지 않는다", () => {
  const before = withRecords("blank");
  before.database.states.push({ id: ids.skills, name: "같은 ID의 상태" });
  const { after } = runPrimitive(before, target("skills"), "db.skills.delete", {});
  expect(after.database.skills.some(row => row.id === ids.skills)).toBe(false);
  expect(after.database.states).toBe(before.database.states);
});

it("중첩된 이벤트의 조건과 명령, 적 그룹 조건, 상태 내성 표의 참조를 각각 보호한다", () => {
  const before = withRecords("built");
  const map = before.maps[before.startMapId]!;
  const troop = before.database.troops[0]!;
  const actor = before.database.actors[0]!;
  const event: GameEvent = {
    id: "ev_unit18", x: 0, y: 0, trigger: { kind: "action" },
    commands: [{
      kind: "fork", condition: { kind: "partyKnowsSkill", skillId: ids.skills },
      then: [], else: [{ kind: "showAnimation", target: "player", animationId: ids.battleAnimations }],
    }],
  };
  const project: Project = {
    ...before,
    maps: {
      ...before.maps,
      [map.id]: { ...map, events: [...map.events, event] },
    },
    database: {
      ...before.database,
      troops: [{ ...troop, battleEventPages: [{
        id: "page_unit18", name: "상태 확인", span: "battle", conditions: [{ kind: "enemyState", stateId: ids.states }], commands: [],
      }] }, ...before.database.troops.slice(1)],
    },
  };
  for (const collection of ["skills", "states", "battleAnimations"] as const) {
    expect(() => runPrimitive(project, target(collection), `db.${collection}.delete`, {})).toThrow(/사용 중/u);
  }
  const withResistance: Project = {
    ...before,
    database: { ...before.database, actors: [{ ...actor, stateRates: { ...actor.stateRates, [ids.states]: "A" } }, ...before.database.actors.slice(1)] },
  };
  expect(() => runPrimitive(withResistance, target("states"), "db.states.delete", {})).toThrow(/사용 중/u);
});

it("연결을 식별자로 유지한 채 이름을 바꾸고 공용 이벤트에서 새 이름의 스킬을 배운다", () => {
  const before = withRecords("built");
  const actorId = before.system.startActorIds[0]!;
  before.commonEvents = [...before.commonEvents, {
    id: "ce_unit18", name: "기술 배우기", trigger: "none",
    commands: [{ kind: "learnSkill", actorId, skillId: ids.skills }],
  }];
  const { after } = runPrimitive(before, target("skills"), "db.skills.update", { name: "작은 불씨" });
  expect(after.commonEvents).toBe(before.commonEvents);
  expect(after.database.skills.find(row => row.id === ids.skills)?.name).toBe("작은 불씨");
  const session = startSession(after, 42);
  expect(createInterpreter(after.commonEvents.at(-1)!.commands, session, after).start()).toEqual({ kind: "done" });
  expect(session.actorSkillIds?.[actorId]).toContain(ids.skills);
});

it("폭주 효과와 계산된 애니메이션 연결을 삭제로 끊지 않는다", () => {
  const before = withRecords("blank");
  before.database.skills.at(-1)!.effect = { kind: "rage" };
  expect(() => runPrimitive(before, target("states", RAGE_STATE_ID), "db.states.delete", {})).toThrow(/폭주 스킬/u);

  const withScript: Project = {
    ...before,
    commonEvents: [{
      id: "ce_unit18", name: "애니메이션 재생", trigger: "none",
      commands: [{
        kind: "script", source: "await game.showAnimation('player', game.getText('effect'));",
        compiled: "await game.showAnimation('player', game.getText('effect'));",
        effects: { reads: [], writes: [], calls: [], dynamic: [{ api: "showAnimation", line: 1 }] },
      }],
    }],
  };
  expect(() => runPrimitive(withScript, target("battleAnimations"), "db.battleAnimations.delete", {})).toThrow(/스크립트/u);
});

it("아직 이벤트에서 불러오지 않는 공용 스크립트의 계산된 스킬 참조를 보호한다", () => {
  const before = withRecords("blank");
  const source = "export const teach = (actorId, skillId) => game.learnSkill(actorId, skillId);";
  before.scriptLibrary = [{
    id: "lib_unit18", source, compiled: source,
    effects: { reads: [], writes: [], calls: [], dynamic: [{ api: "learnSkill", line: 1 }] },
  }];
  expect(() => runPrimitive(before, target("skills"), "db.skills.delete", {})).toThrow(/스크립트/u);
  expect(runPrimitive(before, target("battleAnimations"), "db.battleAnimations.delete", {}).after.database.battleAnimations
    .some(row => row.id === ids.battleAnimations)).toBe(false);
});

it("몬스터의 접촉 특성이 고르는 첫 상태를 삭제하지 않는다", () => {
  const before = withRecords("blank");
  before.system = { ...before.system, battleModel: "gen1" };
  const primary = before.database.states.at(-1)!;
  primary.gen1MajorStatus = "freeze";
  const alternate = { ...primary, id: "state_unit18_other_freeze" };
  before.database.states = [...before.database.states.filter(row => row === primary || row.gen1MajorStatus !== "freeze"), alternate];
  before.database.monsterSpecies = [normalizeMonsterSpeciesRecord({
    id: "species_unit18", name: "서리 몬스터", ability: { name: "서리 피부", kind: "contactStatus", status: "freeze", percent: 30 },
  })];
  expect(() => runPrimitive(before, target("states"), "db.states.delete", {})).toThrow(/접촉 특성/u);
  const { after } = runPrimitive(before, target("states", alternate.id), "db.states.delete", {});
  expect(after.database.states.find(row => row.gen1MajorStatus === "freeze")?.id).toBe(primary.id);
});

it("대상이 없거나 식별자가 중복이면 삭제와 수정을 거절한다", () => {
  const before = withRecords("blank");
  for (const id of ["", "skill_absent"]) {
    expect(() => runPrimitive(before, target("skills", id), "db.skills.create", { name: "새 스킬" })).toThrow(/범위 밖/u);
    expect(() => runPrimitive(before, target("skills", id), "db.skills.update", { mpCost: 5 })).toThrow(/범위 밖/u);
    expect(() => runPrimitive(before, target("skills", id), "db.skills.delete", {})).toThrow(/범위 밖/u);
  }
  const duplicate = before.database.skills.at(-1)!;
  const withDuplicate: Project = {
    ...before,
    database: { ...before.database, skills: [...before.database.skills, duplicate] },
  };
  for (const [edit, args] of [["update", { mpCost: 5 }], ["delete", {}]] as const) {
    expect(() => runPrimitive(withDuplicate, target("skills"), `db.skills.${edit}`, args)).toThrow(/중복/u);
  }
  expect(withDuplicate.database.skills.slice(-2)).toEqual([duplicate, duplicate]);
});

it.each([
  ["states", "stateId"], ["battleAnimations", "animationId"], ["skillChoreographies", "retroChoreographyId"],
] as const)("%s의 어느 항목인지 확정할 수 없으면 스킬에 연결하지 않는다", (collection, field) => {
  const before = withRecords("blank");
  const records = before.database[collection] as { id: string }[];
  records.push({ ...records.at(-1)! });
  expect(() => runPrimitive(before, target("skills"), "db.skills.update", { [field]: ids[collection] })).toThrow(/중복/u);
});

it("공용 범위 검사에서 다른 행 수정과 두 번째 새 행을 막는다", () => {
  const before = withRecords("blank");
  const ctx = { project: before, target: target("skills") };
  const create = PRIMITIVES.find(entry => entry.id === "db.skills.create")!;
  const update = PRIMITIVES.find(entry => entry.id === "db.skills.update")!;
  const remove = PRIMITIVES.find(entry => entry.id === "db.skills.delete")!;
  const selected = [{ collection: "skills", id: ids.skills }];
  expect(create.scope(ctx, { name: "새 기술" })).toEqual({ kind: "dbEntries", entries: [], create: { collection: "skills", max: 1 } });
  expect(update.scope(ctx, { name: "바뀐 이름" })).toEqual({ kind: "dbEntries", entries: selected });
  expect(remove.scope(ctx, {})).toEqual({ kind: "dbEntries", entries: selected, remove: true });
  expect(() => create.scope({ ...ctx, target: target("skills", "skill_absent") }, { name: "새 기술" })).toThrow(/범위 밖/u);
  const skills = before.database.skills.map((row, index) => index === 0 ? { ...row, name: "선택 밖" } : row);
  expect(checkSmallTaskScope(before, { ...before, database: { ...before.database, skills } },
    update.scope(ctx, { name: "바뀐 이름" })).ok).toBe(false);
  const added = create.apply(ctx, { name: "새 기술" });
  const twice = create.apply({ ...ctx, project: added }, { name: "다른 새 기술" });
  expect(checkSmallTaskScope(before, twice, create.scope(ctx, { name: "새 기술" })).ok).toBe(false);
});

it("새 스킬이 기존 공용 이벤트의 끊어진 연결에 쓰이지 않는다", () => {
  const before = withRecords("blank");
  const oldId = "skill_small_task_1";
  before.commonEvents = [{
    id: "ce_unit18", name: "옛 스킬 가르치기", trigger: "none",
    commands: [{ kind: "learnSkill", actorId: before.database.actors[0]!.id, skillId: oldId }],
  }];
  const { after } = runPrimitive(before, target("skills"), "db.skills.create", { name: "새 스킬" });
  expect(after.database.skills.at(-1)?.id).toBe("skill_small_task_2");
  expect(after.database.skills.some(row => row.id === oldId)).toBe(false);
  expect(after.commonEvents).toBe(before.commonEvents);
});

it("음원과 폐기된 소재를 거절하고 자료집에서 고를 수 있는 그림은 연결하거나 해제한다", () => {
  const before = withRecords("blank");
  const iconId = CC0_ICON_ASSETS[0].id;
  const battleImage = GENERATED_EFFECT_SHEET_ASSETS[0]!.id;
  expect(() => runPrimitive(before, target("states"), "db.states.update", { iconResourceId: "cc0-music-field-loop" })).toThrow(/상태 아이콘/u);
  expect(() => runPrimitive(before, target("battleAnimations"), "db.battleAnimations.update", { resourceId: "easyrpg-battle-retired-unit18" })).toThrow(/그림 소재/u);
  const icon = runPrimitive(before, target("states"), "db.states.update", { iconResourceId: iconId }).after;
  expect(icon.database.states.at(-1)?.iconResourceId).toBe(iconId);
  expect(runPrimitive(icon, target("states"), "db.states.update", { iconResourceId: "" }).after.database.states.at(-1)?.iconResourceId).toBeUndefined();
  const animation = runPrimitive(before, target("battleAnimations"), "db.battleAnimations.update", { resourceId: battleImage }).after;
  expect(animation.database.battleAnimations.at(-1)?.resourceId).toBe(battleImage);
  expect(runPrimitive(animation, target("battleAnimations"), "db.battleAnimations.update", { resourceId: "" }).after.database.battleAnimations.at(-1)?.resourceId).toBeUndefined();
});

it("픽셀 효과 애니메이션에서 그림과 큰 표시 설정을 거절하고 전투 겹치기 방식을 편집한다", () => {
  const before = withRecords("blank");
  before.database.battleAnimations.at(-1)!.pixelFx = { effectId: "impact/sword-light" };
  const update = (args: Record<string, unknown>) => runPrimitive(before, target("battleAnimations"), "db.battleAnimations.update", args);
  expect(() => update({ resourceId: GENERATED_EFFECT_SHEET_ASSETS[0]!.id })).toThrow(/픽셀 효과/u);
  expect(() => update({ large: true })).toThrow(/픽셀 효과/u);
  expect(() => update({ large: false })).toThrow(/픽셀 효과/u);
  expect(update({ blendMode: "add" }).after.database.battleAnimations.at(-1)?.blendMode).toBe("add");
  expect(before.database.battleAnimations.at(-1)?.resourceId).toBeUndefined();
});

it.each(["skillChoreographies", "battleAnimations"] as const)("작은 일 도구로 선택한 %s 원본을 읽는다", async collection => {
  const before = withRecords("blank");
  const id = ids[collection];
  const record = before.database[collection]?.at(-1);
  const reply = await getTool("get_database_records")!.run(before, { collection, ids: [id], include: "full" });
  expect(reply.data).toMatchObject({ collection, total: 1, records: [record] });
});

it("번들과 같은 이름의 프로젝트 연출도 겹치지 않는 식별자를 얻고 실제로 연결된다", () => {
  const before = withRecords("blank");
  const builtin = BUNDLED_BATTLE_MOTIONS[0]!;
  const { after } = runPrimitive(before, target("skillChoreographies"), "db.skillChoreographies.create", { name: builtin.id.slice("chor_".length) });
  const id = after.database.skillChoreographies!.at(-1)!.id;
  expect(id).toBe(`${builtin.id}_2`);
  const linked = runPrimitive(after, target("skills"), "db.skills.update", { retroChoreographyId: id }).after;
  expect(resolveSkillChoreography(linked.database.skills.at(-1), linked.database.skillChoreographies)?.origin).toBe("project");
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

function battlerWithStates(...stateIds: string[]): MutableBattler {
  return {
    id: "battler", recordId: "enemy_slime", name: "슬라임", hp: 100, maxHp: 100, mp: 10, maxMp: 10,
    attackPower: 10, defense: 10, mind: 10, agility: 10, chargeRate: 1, gauge: 0,
    skillIds: [], hidden: false, defending: false, stateIds, stateTurns: {},
  };
}

it("같은 상태의 부여와 해제가 충돌하면 부여만 적용하고 다른 효과는 유지한다", () => {
  const before = withRecords("blank");
  before.database.skills.at(-1)!.stateEffects = [
    { stateId: ids.states, chance: 25, operation: "add" },
    { stateId: "state_poison", chance: 100, operation: "remove" },
    { stateId: ids.states, chance: 100, operation: "remove" },
  ];
  const { after } = runPrimitive(before, target("skills"), "db.skills.update", { stateId: ids.states });
  const effects = after.database.skills.at(-1)?.stateEffects;
  expect(effects).toEqual(before.database.skills.at(-1)!.stateEffects!.slice(0, 2));
  const battler = battlerWithStates("state_poison");
  expect(applyStateEffects(after, battler, effects, () => 0)).toEqual({ added: [ids.states], removed: ["state_poison"] });
  expect(battler.stateIds).toEqual([ids.states]);
});

it.each([
  ["state_poison", true],
  [ids.states, false],
] as const)("전투 종료 설정을 전투 스냅샷과 필드 세션에 같은 값으로 적용한다 (%s)", (id, clear) => {
  const before = withRecords("blank");
  before.database.states.at(-1)!.runtimeEffects = { removeOnBattleEnd: true, attackMultiplier: 2 };
  const { after } = runPrimitive(before, target("states", id), "db.states.update", { clearOnBattleEnd: clear });
  const battler = battlerWithStates(id);
  clearBattleEndStates(after, battler);
  const kept = clear ? [] : [id];
  expect(battler.stateIds).toEqual(kept);
  expect(statesKeptAfterBattle(after, [id])).toEqual(kept);
  if (!clear) expect(after.database.states.at(-1)?.runtimeEffects?.attackMultiplier).toBe(2);
});

it("독이 세 번째 턴부터 확정 해제된다", () => {
  const before = withRecords("blank");
  const { after } = runPrimitive(before, target("states", "state_poison"), "db.states.update", { recoverTurns: 3 });
  const battler = battlerWithStates("state_poison");
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual(["state_poison"]);
});

it("선고와 최대 지속 턴을 보존하고 적용할 수 있는 해제 턴만 받아들인다", () => {
  const before = withRecords("blank");
  const state = before.database.states.at(-1)!;
  state.runtimeEffects = { maxTurns: 3, doomTurns: 4, attackMultiplier: 2 };
  const apply = (recoverTurns: number) => runPrimitive(before, target("states"), "db.states.recoverTurns.set", { recoverTurns });
  expect(() => apply(4)).toThrow(/지속 턴/u);
  expect(() => runPrimitive(before, target("states"), "db.states.update", { recoverTurns: 3, recoverChance: 50 })).toThrow(/지속 턴/u);
  const { after } = apply(3);
  expect(after.database.states.at(-1)?.runtimeEffects).toEqual(state.runtimeEffects);
  const battler = battlerWithStates(ids.states);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([ids.states]);
  const withDoom: Project = {
    ...before,
    database: {
      ...before.database,
      states: [...before.database.states.slice(0, -1), { ...state, runtimeEffects: { doomTurns: 4 } }],
    },
  };
  expect(() => runPrimitive(withDoom, target("states"), "db.states.recoverTurns.set", { recoverTurns: 4 })).toThrow(/선고/u);
});

it.each([
  { from: 3, maxTurns: 3 },
  { from: 4, maxTurns: 3 },
  { from: undefined, maxTurns: 3 },
  { from: 3, doomTurns: 3 },
])("확률만 바꿔도 선고·최대 지속 턴과 실제 회복 시작 턴을 비교한다 (%j)", ({ from, maxTurns, doomTurns }) => {
  const before = withRecords("blank");
  const state = before.database.states.at(-1)!;
  state.recoverNaturallyFromTurn = from;
  state.runtimeEffects = { maxTurns, doomTurns };

  expect(() => runPrimitive(before, target("states"), "db.states.update", { recoverChance: 50 })).toThrow(/선고나 최대 지속 턴/u);
  expect(state.recoverNaturallyChance).toBe(20);
});

it("최대 지속 턴 전에 자연 회복 기회가 있으면 확률만 바꾼다", () => {
  const before = withRecords("blank");
  const state = before.database.states.at(-1)!;
  state.recoverNaturallyFromTurn = 2;
  state.runtimeEffects = { maxTurns: 3 };
  const { after } = runPrimitive(before, target("states"), "db.states.update", { recoverChance: 50 });
  const battler = battlerWithStates(state.id);
  expect(runStateUpkeep(after, battler, () => 0.4).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0.4).removedStateIds).toEqual([state.id]);
  expect(after.database.states.at(-1)?.runtimeEffects).toEqual({ maxTurns: 3 });
});

it("최대 지속 턴을 보존하면서 자연 회복 확률을 0으로 끈다", () => {
  const before = withRecords("blank");
  const state = before.database.states.at(-1)!;
  state.recoverNaturallyFromTurn = 3;
  state.runtimeEffects = { maxTurns: 3 };
  const { after } = runPrimitive(before, target("states"), "db.states.update", { recoverChance: 0 });
  expect(after.database.states.at(-1)?.recoverNaturallyChance).toBe(0);
  const battler = battlerWithStates(state.id);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([]);
  expect(runStateUpkeep(after, battler, () => 0).removedStateIds).toEqual([state.id]);
});

it("전투 불능의 자연 회복과 피격 해제를 거절한다", () => {
  const before = withRecords("blank");
  if (!before.database.states.some(row => row.id === "state_death")) {
    before.database.states.push({ id: "state_death", name: "전투 불능" });
  }
  for (const args of [{ recoverTurns: 3 }, { recoverChance: 100 }, { recoverWhenHitChance: 50 }, { clearOnBattleEnd: true }]) {
    expect(() => runPrimitive(before, target("states", "state_death"), "db.states.update", args)).toThrow(/전투 불능/u);
  }
});

it("마력 소모를 실제로 바꾸고 PP를 쓰는 스킬에서는 안내한다", () => {
  const before = withRecords("blank");
  const apply = (project: Project) => runPrimitive(project, target("skills"), "db.skills.mpCost.set", { mpCost: 3 });
  const user = battlerWithStates();
  user.mp = user.maxMp = 100;
  expect(consumeBattleSkillResource(apply(before).after, user, ids.skills)).toEqual({ kind: "mp", remaining: 92 });
  const { skills } = before.database;
  const withPp: Project = {
    ...before,
    system: { ...before.system, battleModel: "gen1" },
    database: { ...before.database, skills: [...skills.slice(0, -1), { ...skills.at(-1)!, maxPp: 10 }] },
  };
  expect(() => apply(withPp)).toThrow(/사용 횟수/u);
  expect(consumeBattleSkillResource(withPp, user, ids.skills)).toEqual({ kind: "pp", remaining: 9 });
});

it("포켓몬식 전투가 읽는 빙결 해제 확률은 바꾸고 무시되는 회복 설정은 거절한다", () => {
  const before = withRecords("blank");
  before.system = { ...before.system, battleModel: "gen1" };
  const selected = target("states");
  const update = (project: Project, args: Record<string, unknown>) => runPrimitive(project, selected, "db.states.update", args);
  expect(() => update(before, { recoverChance: 50 })).toThrow(/포켓몬식 전투/u);
  expect(() => update(before, { recoverWhenHitChance: 50 })).toThrow(/포켓몬식 전투/u);
  expect(() => runPrimitive(before, selected, "db.states.recoverTurns.set", { recoverTurns: 3 })).toThrow(/포켓몬식 전투/u);
  const { states } = before.database;
  const withFreezeState: Project = {
    ...before,
    database: { ...before.database, states: [...states.slice(0, -1), { ...states.at(-1)!, gen1MajorStatus: "freeze" }] },
  };
  expect(update(withFreezeState, { recoverChance: 50 }).after.database.states.at(-1)?.recoverNaturallyChance).toBe(50);
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

it("전투 애니메이션과 프로젝트 도트 연출에서 선택한 항목으로 작은 일을 연다", () => {
  store.replaceProject(withRecords("blank"));
  resetDatabaseRecordViewSession();
  resetRetroChoreographyViewState();
  const host = document.createElement("div");
  host.setAttribute("role", "dialog");
  document.body.append(host);
  const htmlDocument: { createElement(tag: string): HTMLElement } = document;
  const createElement = htmlDocument.createElement.bind(htmlDocument);
  const create = vi.spyOn(htmlDocument, "createElement").mockImplementation(tag => {
    const element = createElement(tag);
    if (tag === "section") element.showPopover = () => {};
    return element;
  });
  const trigger = '[data-testid="small-task-open"]';
  const openAndCheck = (label: string) => {
    host.querySelector<HTMLButtonElement>(trigger)!.click();
    expect(host.querySelector(".small-task strong")?.textContent).toBe(label);
    expect(host.querySelector<HTMLInputElement>(".small-task input")?.disabled).toBe(false);
    host.querySelector<HTMLButtonElement>(".small-task header button")!.click();
  };

  try {
    setSelectedRecordId("battleAnimations", ids.battleAnimations);
    renderRecordTab(host, "battleAnimations", () => {});
    openAndCheck("전투 애니메이션 · 불똥");
    host.querySelector<HTMLButtonElement>('[data-testid="db-animation-frame-0"]')!.click();
    openAndCheck("전투 애니메이션 · 불똥");

    const renderChoreographies = () => renderRetroChoreographyTab(host, renderChoreographies);
    renderChoreographies();
    host.querySelector<HTMLButtonElement>(`[data-testid="db-retro-choreo-row-${ids.skillChoreographies}"]`)!.click();
    openAndCheck("스킬 연출 · 불꽃");
    host.querySelector<HTMLButtonElement>('[data-testid="db-retro-choreo-badge-default"]')!.closest("button")!.click();
    expect(host.querySelector(trigger)).toBeNull();
  } finally {
    host.querySelector<HTMLButtonElement>(".small-task header button")?.click();
    create.mockRestore();
    resetRetroChoreographyViewState();
    resetDatabaseRecordViewSession();
    host.remove();
  }
});

it.each([
  ["en", "Skill choreography · Ember", "Removed Skill choreography"],
  ["ja", "スキル演出 · Ember", "スキル演出を削除"],
  ["zh", "技能演出 · Ember", "已删除 技能演出"],
] as const)("%s 편집기의 도트 연출 대상과 삭제 요약에 번역한 항목 종류를 표시한다", async (locale, label, summary) => {
  const before = withRecords("blank");
  const record = before.database.skillChoreographies!.at(-1)!;
  record.name = "Ember";
  const selected = dbTarget(before, "skillChoreographies", record.id)!;
  record.name = record.id;
  const { after } = runPrimitive(before, target("skillChoreographies"), "db.skillChoreographies.delete", {});
  const previous = getLocale();
  try {
    await setLocale(locale);
    expect(t(selected.label)).toBe(label);
    expect(plainSummary(before, after)).toEqual({ headline: summary, lines: [summary] });
  } finally {
    await setLocale(previous);
  }
});

it("지도 선택으로 자료집 추가 범위를 열 수 없다", () => {
  const before = withRecords("built");
  const selected = mapTarget(before, before.startMapId)!;
  expect(() => PRIMITIVES[0]!.scope({ project: before, target: selected }, { name: "번개" })).toThrow(/범위 밖/u);
});
