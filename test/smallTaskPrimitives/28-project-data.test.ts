/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { dbTarget } from "@/editor/smallTask/target";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/28-project-data";
import { createInterpreter } from "@/player/interpreter";
import { GOLD_MAX } from "@/project/economyValues";
import { startSession } from "@/project/session";
import type { Command, EndingDef, Project } from "@/project/types";
import { structuralJson } from "@/util/structuralJson";
import corpus from "../../harness-data/small-task-corpus/28-project-data.json";
import endingRemovalCases from "./28-project-data/ending-remove-corpus.json";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, mapTarget } from "./harness";

type Fixture = Parameters<typeof loadFixture>[0];
type Args = Record<string, unknown>;
const fixtures = new Map<Fixture, Project>();
function fixtureProject(fixture: Fixture): Project {
  const cached = fixtures.get(fixture);
  if (cached) return cached;
  const project = loadFixture(fixture);
  if (fixture === "blank") {
    const map = { ...createBlankMap("검수 시작 맵", 8, 8), id: "map_project_data" };
    project.maps = { [map.id]: map };
    project.mapTree = { mapId: map.id, children: [] };
    project.startMapId = map.id;
    project.startPos = { x: 3, y: 3 };
  }
  ensureSwitchVariableSlots(project);
  removeLegacySpriteReferences(project);
  fixtures.set(fixture, project);
  return project;
}

beforeAll(() => {
  fixtureProject("built");
  fixtureProject("maou");
}, 180_000);

const switchId = "sw_mk_on_shift";
const variableId = "var_mk_tasks";
const builtEndingId = "ending_8hw9rp";
const unusedEnding: EndingDef = { id: "ending_unused", name: "폐기한 결말", conditions: [], priority: 7 };

function blankWithUnusedEnding(): Project {
  const project = fixtureProject("blank");
  return { ...project, endings: [...(project.endings ?? []), unusedEnding] };
}

const cases: readonly {
  id: string;
  fixture: Fixture;
  args: Args;
  sentence: string;
  prepare?: (project: Project) => Project;
  check(before: Project, after: Project): void;
}[] = [
  {
    id: "switch.define", fixture: "blank", args: { name: " 문 열림 " },
    sentence: "「문 열림」 스위치를 추가해요.",
    check(before, after) {
      const added = after.switches.at(-1)!;
      expect(after.switches).toEqual([...before.switches, { id: added.id, name: "문 열림" }]);
      expect(after.session).toEqual(before.session);
    },
  },
  {
    id: "switch.rename", fixture: "maou", args: { record: "근무 중", name: "교대 근무 시작" },
    sentence: "선택한 스위치 이름을 「교대 근무 시작」(으)로 바꿔요.",
    check(before, after) {
      expect(after.switches).toEqual(before.switches.map(record => record.id === switchId ? { ...record, name: "교대 근무 시작" } : record));
      expect(after.session).toBe(before.session);
      expect(after.maps).toBe(before.maps);
    },
  },
  {
    id: "variable.define", fixture: "built", args: { name: "남은 열쇠" },
    sentence: "「남은 열쇠」 변수를 추가해요.",
    check(before, after) {
      const added = after.variables.at(-1)!;
      expect(after.variables).toEqual([...before.variables, { id: added.id, name: "남은 열쇠" }]);
      expect(after.session).toEqual(before.session);
    },
  },
  {
    id: "variable.rename", fixture: "maou", args: { record: variableId, name: "끝낸 일" },
    sentence: "선택한 변수 이름을 「끝낸 일」(으)로 바꿔요.",
    check(before, after) {
      expect(after.variables).toEqual(before.variables.map(record => record.id === variableId ? { ...record, name: "끝낸 일" } : record));
      expect(after.session).toBe(before.session);
      expect(after.maps).toBe(before.maps);
    },
  },
  {
    id: "ending.define", fixture: "maou",
    args: { name: "평화", conditions: [{ kind: "switch", switchId: "근무 중", value: true }] },
    sentence: "「평화」 엔딩을 추가해요.",
    check(before, after) {
      const added = after.endings!.at(-1)!;
      expect(after.endings).toEqual([...before.endings!, {
        id: added.id, name: "평화", conditions: [{ kind: "switch", switchId, value: true }], priority: 0,
      }]);
      expect(after.switches).toBe(before.switches);
    },
  },
  {
    id: "ending.update", fixture: "built",
    args: { record: "봄을 기다리는 노래", name: "봄의 노래", priority: 3, conditions: [{ kind: "variable", variableId: "var_0001", op: ">=", value: 3 }] },
    sentence: "「봄의 노래」 엔딩을 수정해요.",
    check(before, after) {
      expect(after.endings).toEqual(before.endings!.map(record => record.id === builtEndingId
        ? { ...record, name: "봄의 노래", priority: 3, conditions: [{ kind: "variable", variableId: "var_0001", op: ">=", value: 3 }] }
        : record));
      expect(after.maps).toBe(before.maps);
    },
  },
  {
    id: "ending.remove", fixture: "built", args: { record: unusedEnding.name },
    prepare(project) { return { ...project, endings: [...(project.endings ?? []), unusedEnding] }; },
    sentence: "「폐기한 결말」 엔딩을 삭제해요.",
    check(before, after) {
      expect(after.endings).toEqual(before.endings!.filter(record => record.id !== unusedEnding.id));
      expect(after.maps).toBe(before.maps);
    },
  },
  {
    id: "system.title", fixture: "maou", args: { title: " 달빛 편의점 " },
    sentence: "게임 제목을 「달빛 편의점」(으)로 바꿔요.",
    check(before, after) {
      expect(after.meta).toEqual({ ...before.meta, title: "달빛 편의점" });
      expect(after.system).toEqual({ ...before.system, titleScreen: { ...before.system.titleScreen, title: "달빛 편의점" } });
      expect(after.session).toBe(before.session);
    },
  },
  {
    id: "system.startGold", fixture: "built", args: { gold: 300 },
    sentence: "시작 소지금을 300 골드로 바꿔요.",
    check(before, after) {
      expect(after.session).toEqual({ ...before.session, gold: 300 });
      expect(after.system).toBe(before.system);
    },
  },
  {
    id: "system.startParty", fixture: "built", args: { actorIds: ["마도사", "actor_hero"] },
    sentence: "「마도사」, 「시온」(으)로 시작해요.",
    check(before, after) {
      expect(after.system).toEqual({ ...before.system, startActorIds: ["actor_mage", "actor_hero"] });
      expect(after.session).toEqual({ ...before.session, partyActorIds: ["actor_mage", "actor_hero"] });
    },
  },
];

it.each(cases)("$id 저장값·요약·순수 적용·한 번 실행 취소", async ({ id, fixture, args, sentence, prepare, check }) => {
  const original = fixtureProject(fixture);
  const before = prepare?.(original) ?? original;
  const target = mapTarget(before);
  const snapshot = structuralJson(before);
  const result = runPrimitive(before, target, id, args);
  expect(result.sentence).toBe(sentence);
  expectKoreanSentence(result.sentence);
  check(before, result.after);
  expect(structuralJson(before) === snapshot).toBe(true);
  await expectUndoRestores(before, result.after, target);
  expect(structuralJson(before) === snapshot).toBe(true);
});

it.each(cases)("$id 자료집 레코드에서 실행하면 범위 밖으로 거절", ({ id, args }) => {
  const project = fixtureProject("built");
  const wrong = dbTarget(project, "actors", project.database.actors[0]!.id)!;
  expectRefused(project, wrong, id, args);
});

it("지워진 맵을 대상으로 프로젝트 자료를 바꾸지 않아요", () => {
  const project = fixtureProject("built");
  const stale = { ...mapTarget(project), mapId: "map_missing" };
  expectRefused(project, stale, "system.startGold", { gold: 3 });
});

it.each(cases)("$id 다른 영역의 변경을 끼우면 범위 가드가 거절", ({ id, args }) => {
  const project = fixtureProject("built");
  const primitive = PRIMITIVES.find(entry => entry.id === id)!;
  const ctx = { project, target: mapTarget(project) };
  const scope = primitive.scope(ctx, args);
  expect(primitive.scope(ctx, { ...args, record: "other_record" })).toEqual(scope);
  const outside = id.startsWith("system.")
    ? { ...project, switches: [...project.switches, { id: "sw_untargeted", name: "끼운 스위치" }] }
    : { ...project, meta: { ...project.meta, title: "끼운 제목" } };
  expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
});

it.each([
  ["switch.rename", { record: "sw_missing", name: "새 이름" }, /스위치.*찾을 수 없어요/u],
  ["variable.define", { name: "   " }, /이름을 입력/u],
  ["ending.define", { name: "첫 결말", conditions: [{ kind: "switch", switchId: "sw_missing", value: true }] }, /엔딩 조건의 스위치/u],
  ["ending.update", { record: builtEndingId, conditions: [{ kind: "variable", variableId: "var_missing", op: ">=", value: 3 }] }, /엔딩 조건의 변수/u],
  ["ending.remove", { record: builtEndingId }, /이벤트나 조건에서 쓰는 엔딩/u],
  ["system.title", { title: "   " }, /게임 제목을 입력/u],
  ["system.startGold", { gold: GOLD_MAX + 1 }, /소지금|값의 형식/u],
  ["system.startParty", { actorIds: ["actor_missing"] }, /배우.*찾을 수 없어요/u],
  ["system.startParty", { actorIds: ["actor_hero", "actor_hero"] }, /같은 배우/u],
  ["system.startParty", { actorIds: [] }, /배우를 한 명|값의 형식/u],
] as const)("%s 잘못된 값을 한국어로 거절", (id, args, reason) => {
  const project = fixtureProject("built");
  const target = mapTarget(project);
  expect(() => runPrimitive(project, target, id, args)).toThrow(PrimitiveError);
  expectRefused(project, target, id, args, reason);
});

it("엔딩을 본 기록을 확인하는 중첩 조건도 삭제를 막아요", () => {
  const project = blankWithUnusedEnding();
  project.commonEvents.push({
    id: "ce_check_ending", name: "결말 확인", trigger: "none",
    commands: [{ kind: "fork", condition: { kind: "not", condition: { kind: "endingSeen", endingId: unusedEnding.id, value: true } }, then: [] }],
  });
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.name }, /쓰는 엔딩/u);
});

// 공용 러너의 디렉터리 URL이 브라우저 주소로 변환되는 환경에서도 같은 사례를 실행한다.
type ProjectDataCase = CorpusCase & { seedEnding?: EndingDef };
const corpusCases = [...corpus, ...endingRemovalCases] as ProjectDataCase[];
it.each(corpusCases)("$request", async ({ fixture, target: selector, primitive, args, expect: checks, expectRefusal, seedEnding }) => {
  const original = fixtureProject(fixture);
  // 고정 픽스처의 엔딩은 이벤트에 연결되어 있으므로 삭제 성공 사례에는 별도의 시드를 둔다.
  const before = seedEnding ? { ...original, endings: [...(original.endings ?? []), seedEnding] } : original;
  const target = resolveTarget(before, selector);
  if (expectRefusal) {
    expect(() => runPrimitive(before, target, primitive, args)).toThrow(PrimitiveError);
    return;
  }
  const { after, sentence } = runPrimitive(before, target, primitive, args);
  expectKoreanSentence(sentence, target);
  for (const check of checks) {
    const value = readCheckPath(after, check.at);
    if (check.count !== undefined) expect(value).toHaveLength(check.count);
    else expect(value).toEqual(check.equals);
  }
  await expectUndoRestores(before, after, target);
});

it("새 스위치가 꺼짐으로 시작하고 이벤트에서 켜면 조건 분기를 지나가요", () => {
  const before = fixtureProject("built");
  const { after } = runPrimitive(before, mapTarget(before), "switch.define", { name: "보물방 열림" });
  const id = after.switches.at(-1)!.id;
  const session = startSession(after, 1);
  expect(session.switches[id]).toBe(false);
  const commands: Command[] = [
    { kind: "setSwitch", switchId: id, value: true },
    { kind: "fork", condition: { kind: "switch", switchId: id, value: true }, then: [{ kind: "changeGold", op: "+=", amount: 3 }] },
  ];
  const startingGold = session.gold;
  expect(createInterpreter(commands, session, after).start()).toEqual({ kind: "done" });
  expect(session.gold).toBe(startingGold + 3);
});

it("새 변수가 0으로 시작하고 값이 바뀌면 엔딩의 문턱을 판정해요", () => {
  const before = fixtureProject("built");
  const vars = runPrimitive(before, mapTarget(before), "variable.define", { name: "호감" }).after;
  const varId = vars.variables.at(-1)!.id;
  const { after } = runPrimitive(vars, mapTarget(vars), "ending.define", {
    name: "함께 걷는 길", conditions: [{ kind: "variable", variableId: varId, op: ">=", value: 3 }],
  });
  const id = after.endings!.at(-1)!.id;
  const session = startSession(after, 1);
  expect(session.variables[varId]).toBe(0);
  expect(createInterpreter([
    { kind: "setVariable", variableId: varId, op: "=", value: 3 },
    { kind: "triggerEnding", endingId: id },
  ], session, after).start())
    .toMatchObject({ kind: "returnToTitle", title: "함께 걷는 길", clear: { endingId: id } });
});

it("게임이 바꾼 소지금으로 시작하고 명령이 그 잔액을 사용해요", () => {
  const before = fixtureProject("built");
  const { after } = runPrimitive(before, mapTarget(before), "system.startGold", { gold: 300 });
  const session = startSession(after, 1);
  expect(createInterpreter([{ kind: "changeGold", op: "-=", amount: 12 }], session, after).start()).toEqual({ kind: "done" });
  expect(session.gold).toBe(288);
});

it("첫 플레이에서도 시작 파티 순서와 선두가 적용돼요", () => {
  const before = fixtureProject("built");
  const { after } = runPrimitive(before, mapTarget(before), "system.startParty", { actorIds: ["actor_mage", "actor_hero"] });
  const session = startSession(after, 1);
  const commands: Command[] = [{
    kind: "fork",
    condition: { kind: "partyLeader", actorId: "actor_mage" },
    then: [{ kind: "changeGold", op: "+=", amount: 3 }],
  }];
  const startingGold = session.gold;
  expect(createInterpreter(commands, session, after).start()).toEqual({ kind: "done" });
  expect(session.partyActorIds).toEqual(["actor_mage", "actor_hero"]);
  expect(session.gold).toBe(startingGold + 3);
});
