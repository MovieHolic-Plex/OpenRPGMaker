/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { collectDialogueLines } from "@/editor/dialogue/dialogueIndex";
import { getMapEditHistoryDepth, resetMapEditHistory } from "@/editor/mapEditHistory";
import { compileScriptAsync } from "@/editor/script/compile";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { dbTarget } from "@/editor/smallTask/target";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/28-project-data";
import { readClearRecord, recordEndingClear } from "@/player/clearRecord";
import { createInterpreter } from "@/player/interpreter";
import { clearRecordKey } from "@/player/saveSlots";
import { GOLD_MAX } from "@/project/economyValues";
import { forgetEventDraftVaultEntry, rememberEventDraftVaultEntry } from "@/project/eventDraftVault";
import { blueprintEndingId } from "@/project/gameBlueprint";
import { resolveScriptRefId } from "@/project/script/effects";
import { EMPTY_SCRIPT_EFFECTS } from "@/project/script/types";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EndingDef, GameEvent, Project } from "@/project/types";
import { listEndingRows } from "@/project/vnExtras";
import { structuralJson } from "@/util/structuralJson";
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

function withMapEvent(project: Project, event: GameEvent): Project {
  const map = project.maps[project.startMapId]!;
  return { ...project, maps: { ...project.maps, [map.id]: { ...map, events: [...map.events, event] } } };
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
    sentence: "스위치 이름을 「교대 근무 시작」으로 바꿔요.",
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
    sentence: "변수 이름을 「끝낸 일」로 바꿔요.",
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
    sentence: "엔딩 「봄의 노래」의 설정을 수정해요.",
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
    sentence: "게임 제목을 「달빛 편의점」으로 바꿔요.",
    check(before, after) {
      expect(after.meta).toEqual({ ...before.meta, title: "달빛 편의점" });
      expect(after.system).toEqual({ ...before.system, titleScreen: { ...before.system.titleScreen, title: "달빛 편의점" } });
      expect(after.session).toBe(before.session);
    },
  },
  {
    id: "system.startGold", fixture: "built", args: { gold: 300 },
    sentence: "시작 소지금을 300골드로 바꿔요.",
    check(before, after) {
      expect(after.session).toEqual({ ...before.session, gold: 300 });
      expect(after.system).toBe(before.system);
    },
  },
  {
    id: "system.startParty", fixture: "built", args: { actorIds: ["마도사", "actor_hero"] },
    sentence: "시작 파티를 「마도사」, 「시온」 순서로 바꿔요.",
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

it.each(cases)("$id 다른 영역의 변경을 끼우면 범위 가드가 거절", ({ id, fixture, args, prepare }) => {
  const original = fixtureProject(fixture);
  const project = prepare?.(original) ?? original;
  const primitive = PRIMITIVES.find(entry => entry.id === id)!;
  const ctx = { project, target: mapTarget(project) };
  const scope = primitive.scope(ctx, args);
  const outside = id.startsWith("system.")
    ? { ...project, switches: [...project.switches, { id: "sw_untargeted", name: "끼운 스위치" }] }
    : { ...project, meta: { ...project.meta, title: "끼운 제목" } };
  expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
});

it.each([
  ["switch.rename", "switches", "sw_0001"],
  ["variable.rename", "variables", "var_0001"],
  ["ending.update", "endings", unusedEnding.id],
  ["ending.remove", "endings", unusedEnding.id],
] as const)("%s 같은 종류의 다른 항목도 범위 밖이에요", (id, area, selectedId) => {
  const project = {
    ...blankWithUnusedEnding(),
    switches: [{ id: "sw_0001", name: "문 열림" }, { id: "sw_0002", name: "불 켜짐" }],
    variables: [{ id: "var_0001", name: "방문 횟수" }, { id: "var_0002", name: "남은 횟수" }],
    endings: [unusedEnding, { ...unusedEnding, id: "ending_other", name: "다른 결말" }],
  };
  const primitive = PRIMITIVES.find(entry => entry.id === id)!;
  const scope = primitive.scope({ project, target: mapTarget(project) }, { record: selectedId });
  expect(scope).toEqual({ kind: "projectArea", area, ids: [selectedId] });
  const records = project[area];
  const outside = { ...project, [area]: records.map(row => row.id === selectedId ? row : { ...row, name: "다른 변경" }) };
  expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false });
});

it.each([
  ["switch.define", "switches", "switch", "sw"], ["variable.define", "variables", "variable", "var"],
] as const)("%s 새 ID는 기존 표시 이름으로 찾는 스크립트 연결을 보존해요", (primitive, area, kind, prefix) => {
  const name = `${prefix}_0001`;
  const existing = { id: "existing", name };
  const project: Project = { ...fixtureProject("blank"), [area]: [existing] };
  const { after } = runPrimitive(project, mapTarget(project), primitive, { name: "새 항목" });
  expect(after[area]).toEqual([existing, { id: `${prefix}_0002`, name: "새 항목" }]);
  expect(resolveScriptRefId(after, kind, name)).toBe(existing.id);
});

it.each([
  ["switch.rename", "switches"], ["variable.rename", "variables"],
  ["ending.update", "endings"], ["ending.remove", "endings"],
] as const)("%s 같은 이름이 여럿이면 식별자를 입력해야 해요", (id, area) => {
  const one = { ...unusedEnding, id: "first", name: "같은 이름" };
  const two = { ...one, id: "second" };
  const project = { ...fixtureProject("blank"), [area]: [one, two] };
  const target = mapTarget(project);
  const args = id === "ending.remove" ? {} : { name: "새 이름" };
  expectRefused(project, target, id, { ...args, record: one.name }, /항목이 여러 개/u);
  const { after } = runPrimitive(project, target, id, { ...args, record: two.id });
  expect(after[area]).toEqual(id === "ending.remove" ? [one] : [one, { ...two, name: "새 이름" }]);
});

it("제목 설정이 없는 옛 프로젝트에서도 시작 화면 제목을 저장해요", async () => {
  const original = fixtureProject("blank");
  const project: Project = { ...original, system: { ...original.system } };
  delete project.system.titleScreen;
  const { after } = runPrimitive(project, mapTarget(project), "system.title", { title: "바다의 노래" });
  expect(after.meta.title).toBe("바다의 노래");
  expect(after.system.titleScreen?.title).toBe("바다의 노래");
  expect(project.system.titleScreen).toBeUndefined();
  await expectUndoRestores(project, after, mapTarget(project));
});

it("제목 카드만 고치고 저작된 오프닝은 수정 범위에도 넣지 않아요", () => {
  const original = fixtureProject("blank");
  const opening = { enabled: true, skippable: true, scenes: [{ id: "scene_title", kind: "text" as const, narration: `— ${original.meta.title} —`, durationMs: 4000 }] };
  const project = { ...original, system: { ...original.system, opening } };
  const args = { title: "바다의 노래" };
  const { after } = runPrimitive(project, mapTarget(project), "system.title", args);
  expect(after.system.opening).toEqual({ ...opening, scenes: [{ ...opening.scenes[0], narration: "— 바다의 노래 —" }] });

  const authored = { ...opening, scenes: [{ ...opening.scenes[0]!, narration: "그날 밤, 별이 바다로 떨어졌다." }] };
  const withStory = { ...project, system: { ...project.system, opening: authored } };
  const target = mapTarget(withStory);
  const scope = PRIMITIVES.find(entry => entry.id === "system.title")!.scope({ project: withStory, target }, args);
  expect(checkSmallTaskScope(withStory, { ...withStory, system: { ...withStory.system, opening } }, scope)).toMatchObject({ ok: false });
  expect(runPrimitive(withStory, target, "system.title", args).after.system.opening).toBe(authored);
});

it("시작 화면에 이미 맞는 제목이 있으면 프로젝트 제목만 범위에 넣어요", () => {
  const project = fixtureProject("built");
  const titleScreen = project.system.titleScreen!;
  const before = { ...project, meta: { ...project.meta, title: "이전 제목" } };
  const target = mapTarget(before);
  const args = { title: titleScreen.title };
  const scope = PRIMITIVES.find(entry => entry.id === "system.title")!.scope({ project: before, target }, args);
  expect(scope).toEqual({ kind: "projectArea", area: "system", ids: ["meta.title"] });
  expect(checkSmallTaskScope(before, { ...before, system: { ...before.system, titleScreen: { ...titleScreen, title: "다른 제목" } } }, scope))
    .toMatchObject({ ok: false });
  const { after } = runPrimitive(before, target, "system.title", args);
  expect(after.meta.title).toBe(args.title);
  expect(after.system).toBe(before.system);
  expect(runPrimitive(after, target, "system.title", args).after).toBe(after);
});

it.each([
  ["switch.rename", { record: "sw_missing", name: "새 이름" }, /스위치.*찾을 수 없어요/u],
  ["variable.define", { name: "   " }, /이름을 입력/u],
  ["ending.define", { name: "첫 결말", conditions: [{ kind: "switch", switchId: "sw_missing", value: true }] }, /엔딩 조건의 스위치/u],
  ["ending.update", { record: builtEndingId, conditions: [{ kind: "variable", variableId: "var_missing", op: ">=", value: 3 }] }, /엔딩 조건의 변수/u],
  ["ending.update", { record: builtEndingId }, /바꿀 엔딩 설정/u],
  ["ending.define", { name: "만남", conditions: [{ kind: "friendshipAtLeast", npcKey: "없는 인물", value: 3 }] }, /호감도를 확인할 인물/u],
  ["ending.define", { name: "만남", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 1001 }] }, /값의 형식/u],
  ["ending.define", { name: "만남", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 3.5 }] }, /값의 형식/u],
  ["ending.define", { name: "만남", priority: Number.MAX_SAFE_INTEGER + 1 }, /값의 형식|우선순위/u],
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
  const before = blankWithUnusedEnding();
  const project: Project = {
    ...before,
    commonEvents: [...before.commonEvents, {
      id: "ce_check_ending", name: "결말 확인", trigger: "none",
      commands: [{ kind: "fork", condition: { kind: "not", condition: { kind: "endingSeen", endingId: unusedEnding.id, value: true } }, then: [] }],
    }],
  };
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.name }, /쓰는 엔딩/u);
});

it("부대의 전투 후 분기에서 조건으로 고르는 결말도 삭제를 막아요", () => {
  const original = fixtureProject("built");
  const [troop] = original.database.troops;
  const project: Project = {
    ...original, endings: [unusedEnding],
    database: { ...original.database, troops: [{ ...troop!, afterBattle: { victory: [{ kind: "loop", body: [{ kind: "triggerEnding" }] }] } }] },
  };
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.id }, /쓰는 엔딩/u);
});

it("자료집 일정에서 해금에 쓰는 엔딩은 삭제할 수 없어요", () => {
  const original = blankWithUnusedEnding();
  const project: Project = {
    ...original,
    commonEvents: [{ id: "ce_walk", name: "산책", trigger: "none", commands: [] }],
    database: { ...original.database, schedules: [{
      id: "schedule_spring", title: "봄맞이", slots: [{ label: "아침" }], activities: [{
        id: "spring_walk", label: "산책", description: "강가를 걸어요.", commonEventId: "ce_walk",
        condition: { kind: "endingSeen", endingId: unusedEnding.id, value: true },
      }],
    }] },
  };
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.id }, /쓰는 엔딩/u);
});

it("공용 스크립트에서 쓰는 엔딩은 삭제할 수 없어요", () => {
  const source = `await game.cmd({ kind: "triggerEnding", endingId: "${unusedEnding.id}" });`;
  const project = { ...blankWithUnusedEnding(), scriptLibrary: [{ id: "epilogue", source, compiled: source }] };
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.id }, /공용 스크립트/u);
});

it("실행할 명령 종류를 계산하는 스크립트가 있으면 엔딩 삭제를 거절해요", async () => {
  const before = blankWithUnusedEnding();
  const source = `const kind = ["trigger", "Ending"].join("") as EventCommand["kind"];\nawait game.cmd({ kind, endingId: "${unusedEnding.id}" });`;
  const { ok, compiled, effects } = await compileScriptAsync(source, { project: before });
  expect(ok).toBe(true);
  expect(effects).toEqual(EMPTY_SCRIPT_EFFECTS);
  const project = withMapEvent(before, {
    id: "ev_epilogue", x: 2, y: 2, trigger: { kind: "action" },
    commands: [{ kind: "script", source, compiled, effects }],
  });
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.id }, /이벤트 스크립트/u);
}, 60_000);

it("시작 화면의 해금에 쓰는 엔딩만 삭제를 차단해요", () => {
  const before = blankWithUnusedEnding();
  const other = { ...unusedEnding, id: "ending_other", name: "다른 결말" };
  const titleScreen = { ...before.system.titleScreen!, variants: [{
    when: { kind: "endingSeen" as const, endingId: unusedEnding.id },
  }] };
  const project: Project = { ...before, endings: [unusedEnding, other], system: { ...before.system, titleScreen } };
  const target = mapTarget(project);
  expectRefused(project, target, "ending.remove", { record: unusedEnding.id }, /쓰는 엔딩/u);
  const { after } = runPrimitive(project, target, "ending.remove", { record: other.id });
  expect(after.endings).toEqual([unusedEnding]);
  expect(after.system.titleScreen).toBe(titleScreen);
});

it.each(["name", "text"])("자료집에 엔딩의 문장 수정 제안이 남아 있으면 삭제를 거절해요 (%s)", field => {
  const ending = { ...unusedEnding, id: "ending/old", epilogue: [{ kind: "say", text: "안녕." }] };
  const project = { ...fixtureProject("blank"), endings: [ending] };
  const line = collectDialogueLines(project).find(row => row.endingId === ending.id && row.field === field)!;
  const withProposal: Project = { ...project, dialogueDesk: { voices: [], proposals: [{
    id: "proposal_epilogue", lineId: line.id, baseHash: line.hash, before: line.text,
    after: "다음에 또 만나.", source: "human", createdAt: "2026-11-20",
  }] } };
  expectRefused(withProposal, mapTarget(withProposal), "ending.remove", { record: ending.id }, /문장 수정 제안/u);
});

it("이벤트 초안에서는 현재 본문과 저장될 원본의 엔딩 연결을 확인해요", () => {
  const before = blankWithUnusedEnding();
  const original: GameEvent = { id: "ev_epilogue", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "triggerEnding", endingId: unusedEnding.id }] };
  const draft = { ...original, commands: [], draft: { kind: "edit" as const, original } };
  const project = withMapEvent(before, draft);
  const args = { record: unusedEnding.id };
  expectRefused(project, mapTarget(project), "ending.remove", args, /쓰는 엔딩/u);
  const remoteDeleted = withMapEvent(before, { ...draft, draft: { ...draft.draft, conflict: { kind: "remote-delete", detectedAt: 1 } } });
  expect(runPrimitive(remoteDeleted, mapTarget(remoteDeleted), "ending.remove", args).after.endings).not.toContainEqual(unusedEnding);
});

it("청사진이 이름으로 가리키는 결말을 지우거나 연결이 끊기게 이름을 바꿀 수 없어요", () => {
  const original = blankWithUnusedEnding();
  const project: Project = {
    ...original,
    endings: [unusedEnding, { ...unusedEnding, id: "ending_other", name: "바다의 노래" }],
    gameBlueprint: {
      version: 1, title: "별의 항구", genre: "adventure", playerGoal: "등대를 다시 켜기",
      steps: [
        { id: "s1", place: "항구", event: "정비공", action: "열쇠를 받는다", feeling: "기대", gives: "열쇠" },
        { id: "s2", place: "등대", event: "발전기", action: "등불을 켠다", feeling: "안도", gives: "결말" },
      ],
      ending: { name: unusedEnding.name, how: "등대를 밝힌다", feeling: "안도" },
    },
  };
  const target = mapTarget(project);
  expectRefused(project, target, "ending.remove", { record: unusedEnding.id }, /게임 청사진/u);
  expectRefused(project, target, "ending.update", { record: unusedEnding.id, name: "봄의 소식" }, /게임 청사진/u);
  expect(runPrimitive(project, target, "ending.remove", { record: "ending_other" }).after.endings).toEqual([unusedEnding]);

  const second = project.endings![1]!;
  const unlinked = { ...project, endings: [{ ...unusedEnding, name: "옛 결말" }, second] };
  expectRefused(unlinked, target, "ending.remove", { record: second.id }, /게임 청사진/u);

  const fallback = { ...project, endings: [{ ...unusedEnding, name: "옛 결말" }] };
  expectRefused(fallback, target, "ending.define", { name: "또 다른 결말" }, /게임 청사진/u);
  expectRefused(fallback, target, "ending.define", { name: unusedEnding.name }, /게임 청사진/u);
});

it.each(["new", "edit", "vault"] as const)("맵 작업에서 %s 이벤트 초안에만 참조가 있어도 엔딩 삭제를 적용하지 않아요", kind => {
  const original: GameEvent = { id: "ev_working_ending", x: 2, y: 2, trigger: { kind: "action" }, commands: [] };
  const draft: GameEvent = {
    ...original, draft: { kind: kind === "edit" ? "edit" : "new", original },
    commands: [{ kind: "triggerEnding", endingId: unusedEnding.id }],
  };
  const project = blankWithUnusedEnding();
  store.replaceProject(kind === "vault" ? project : withMapEvent(project, draft));
  resetMapEditHistory();
  const live = store.getCurrent();
  if (kind === "vault") rememberEventDraftVaultEntry(live.startMapId, draft);
  try {
    const target = mapTarget(live);
    const before = smallTaskBase(live, target);
    expect(before.maps[before.startMapId].events).toEqual(kind === "edit" ? [original] : []);
    const { after } = runPrimitive(before, target, "ending.remove", { record: unusedEnding.id });
    expect(after.endings).toEqual([]);
    expect(() => commitSmallTask(live, before, after, target)).toThrow(/저장하지 않은 이벤트/u);
    expect(store.getCurrent()).toBe(live);
    expect(store.getCurrent().maps[before.startMapId].events).toEqual(kind === "vault" ? [] : [draft]);
    expect(getMapEditHistoryDepth()).toBe(0);
  } finally {
    if (kind === "vault") forgetEventDraftVaultEntry(live.startMapId, draft.id);
  }
});

it("엔딩과 무관한 초안은 삭제를 적용하고 되돌릴 때 모두 보존해요", async () => {
  const draft: GameEvent = {
    id: "ev_draft_greeting", x: 2, y: 2, trigger: { kind: "action" }, draft: { kind: "new" },
    commands: [{ kind: "text", body: "작성 중인 대사" }],
  };
  store.replaceProject(withMapEvent(blankWithUnusedEnding(), draft));
  resetMapEditHistory();
  const live = store.getCurrent();
  const target = mapTarget(live);
  const before = smallTaskBase(live, target);
  const { after } = runPrimitive(before, target, "ending.remove", { record: unusedEnding.id });
  const receipt = commitSmallTask(live, before, after, target);
  expect(store.getCurrent().endings).toEqual([]);
  expect(store.getCurrent().maps[before.startMapId].events).toEqual([draft]);
  expect(await receipt?.undo(async () => false)).toBe(true);
  expect(store.getCurrent().endings).toEqual([unusedEnding]);
  expect(store.getCurrent().maps[before.startMapId].events).toEqual([draft]);
});

it("엔딩을 같은 이름으로 다시 만들어도 예전 기기 기록에서 본 엔딩으로 표시되지 않아요", () => {
  const legacy = { ...unusedEnding, id: blueprintEndingId(unusedEnding.name) };
  const project = { ...fixtureProject("blank"), endings: [legacy] };
  const target = mapTarget(project);
  const key = clearRecordKey();
  const previous = localStorage.getItem(key);
  localStorage.removeItem(key);
  try {
    recordEndingClear(localStorage, project, startSession(project, 1), legacy.id);
    const seen = readClearRecord(localStorage)?.endingIds;
    expect(listEndingRows(project, seen)).toMatchObject([{ id: legacy.id, seen: true }]);
    const removed = runPrimitive(project, target, "ending.remove", { record: legacy.id }).after;
    const added = runPrimitive(removed, target, "ending.define", { name: legacy.name }).after;
    expect(added.endings?.[0]?.id).not.toBe(legacy.id);
    expect(listEndingRows(added, seen)).toMatchObject([{ name: legacy.name, seen: false }]);
  } finally {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  }
});

it("동명 엔딩을 추가하면 기존 엔딩과 다른 식별자를 부여해요", () => {
  const args = { name: unusedEnding.name };
  const before = blankWithUnusedEnding();
  const target = mapTarget(before);
  const first = runPrimitive(before, target, "ending.define", args).after;
  const second = runPrimitive(first, target, "ending.define", args).after;
  expect(second.endings?.map(ending => ending.name)).toEqual([args.name, args.name, args.name]);
  expect(new Set(second.endings?.map(ending => ending.id)).size).toBe(3);
});

it("우선순위가 소수인 옛 엔딩도 이름만 바꿀 수 있어요", () => {
  const oldEnding = { ...unusedEnding, priority: 0.5 };
  const project = { ...blankWithUnusedEnding(), endings: [oldEnding] };
  const { after } = runPrimitive(project, mapTarget(project), "ending.update", { record: oldEnding.id, name: "새 결말" });
  expect(after.endings).toEqual([{ ...oldEnding, name: "새 결말" }]);
});

it("스위치나 변수를 이름으로 찾는 스크립트가 있으면 이름 변경을 거절해요", () => {
  const original = fixtureProject("blank");
  const source = 'game.setSwitch("문 열림", true); game.addVar("잰 걸음", 3);';
  const project: Project = {
    ...original,
    switches: [{ id: "sw_other", name: "다른 문" }, { id: "sw_door", name: "문 열림" }],
    variables: [{ id: "var_steps", name: "잰 걸음" }],
    scriptLibrary: [{ id: "door", source, compiled: source, effects: {
      reads: [], writes: [{ kind: "switch", id: "문 열림" }, { kind: "variable", id: "잰 걸음" }], calls: [], dynamic: [],
    } }],
  };
  const target = mapTarget(project);
  expectRefused(project, target, "switch.rename", { record: "sw_door", name: "새 이름" }, /스크립트/u);
  expectRefused(project, target, "switch.rename", { record: "sw_other", name: "문 열림" }, /스크립트/u);
  expectRefused(project, target, "variable.rename", { record: "var_steps", name: "새 이름" }, /스크립트/u);
  const byId = 'game.setSwitch("sw_door", true);';
  const safe: Project = { ...project, scriptLibrary: [{ id: "door", source: byId, compiled: byId, effects: {
    reads: [], writes: [{ kind: "switch", id: "sw_door" }], calls: [], dynamic: [],
  } }] };
  const { after } = runPrimitive(safe, target, "switch.rename", { record: "sw_door", name: "문 열기" });
  expect(after.switches.find(record => record.id === "sw_door")?.name).toBe("문 열기");
});

it.each([
  ['game.setSwitch(game.getText("선택"), true);', [{ api: "setSwitch", line: 1 }]],
  ['const set = game.setSwitch; set("문 열림", true);', []],
  ['globalThis["game"]["getSwitch"]("문 열림");', []],
  ['const host = globalThis; host["game"].getSwitch("문 열림");', []],
] as const)("직접 확인할 수 없는 스크립트 접근은 이름 변경을 막아요 (%s)", (source, dynamic) => {
  const project: Project = {
    ...fixtureProject("blank"),
    switches: [{ id: "sw_door", name: "문 열림" }],
    scriptLibrary: [{ id: "door", source, compiled: source, effects: {
      reads: [], writes: [], calls: [], dynamic,
    } }],
  };
  expectRefused(project, mapTarget(project), "switch.rename", { record: "sw_door", name: "문 열기" }, /스크립트/u);
});

it("이름 조회와 무관한 간접 API와 고정 명령은 스위치·변수 이름 변경을 막지 않아요", async () => {
  const source = 'const log = game.log; const config = { "game": "demo" }; log(config["game"]); game["gold"]();\n'
    + 'const labels = { eval: "preview", Function: "show" }; log(labels);\n'
    + 'await game.cmd({ kind: "changeGold", op: "+=", amount: game.gold() });';
  const { ok, compiled, effects } = await compileScriptAsync(source, { typeCheck: false });
  expect(ok).toBe(true);
  const project: Project = {
    ...fixtureProject("blank"), switches: [{ id: "sw_door", name: "문 열림" }], variables: [{ id: "var_steps", name: "걸음" }],
    scriptLibrary: [{ id: "greeting", source, compiled, effects }],
  };
  const target = mapTarget(project);
  const renamed = runPrimitive(project, target, "switch.rename", { record: "sw_door", name: "문 열기" }).after;
  expect(renamed.switches[0]?.name).toBe("문 열기");
  const { after } = runPrimitive(renamed, target, "variable.rename", { record: "var_steps", name: "걸음 수" });
  expect(after.variables[0]?.name).toBe("걸음 수");
  expect(after.scriptLibrary).toBe(project.scriptLibrary);
});

it("다른 엔딩만 부르는 고정 명령과 엔딩과 무관한 game.cmd는 삭제를 막지 않아요", async () => {
  const other = { ...unusedEnding, id: "ending_other", name: "다른 결말" };
  const source = 'const config = { game: "demo" }; const label = config.game; game.log(label);\n'
    + 'await game.cmd({ kind: "changeGold", op: "+=", amount: game.gold() });\n'
    + `await game["cmd"]({ kind: "triggerEnding", endingId: "${other.id}" });`;
  const { ok, compiled, effects } = await compileScriptAsync(source, { typeCheck: false });
  expect(ok).toBe(true);
  const project: Project = {
    ...blankWithUnusedEnding(), endings: [unusedEnding, other],
    scriptLibrary: [{ id: "greeting", source, compiled, effects }],
  };
  const target = mapTarget(project);
  expectRefused(project, target, "ending.remove", { record: other.id }, /공용 스크립트/u);
  const { after } = runPrimitive(project, target, "ending.remove", { record: unusedEnding.id });
  expect(after.endings).toEqual([other]);
  await expectUndoRestores(project, after, target);
});

it("스크립트에 인라인으로 넣은 분기 조건의 엔딩 참조는 계속 보호해요", () => {
  const source = `await game.cmd({ kind: "fork", condition: { kind: "endingSeen", endingId: "${unusedEnding.id}", value: true }, then: [] });`;
  const project = { ...blankWithUnusedEnding(), scriptLibrary: [{ id: "epilogue", source, compiled: source }] };
  expectRefused(project, mapTarget(project), "ending.remove", { record: unusedEnding.id }, /공용 스크립트/u);
});

it("맵 작업으로 미저장 스크립트가 이름으로 찾는 스위치를 바꾸지 않아요", () => {
  const source = 'game.getSwitch("문 열림");';
  const event: GameEvent = {
    id: "ev_draft_switch", x: 2, y: 2, trigger: { kind: "action" }, draft: { kind: "new" },
    commands: [{ kind: "script", source, compiled: source }],
  };
  const fixture = fixtureProject("blank");
  const project = {
    ...fixture,
    switches: [{ id: "sw_door", name: "문 열림" }],
    session: { ...fixture.session, switches: { ...fixture.session.switches, sw_door: false } },
  };
  store.replaceProject(withMapEvent(project, event));
  resetMapEditHistory();
  const live = store.getCurrent();
  const target = mapTarget(live);
  const before = smallTaskBase(live, target);
  const { after } = runPrimitive(before, target, "switch.rename", { record: "sw_door", name: "문 열기" });
  expect(() => commitSmallTask(live, before, after, target)).toThrow(/저장하지 않은 이벤트 스크립트/u);
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryDepth()).toBe(0);
});

it("저장될 이벤트 원본에서 이름으로 읽는 스위치는 이름을 바꿀 수 없어요", () => {
  const before = { ...fixtureProject("blank"), switches: [{ id: "sw_door", name: "문 열림" }] };
  const source = 'game.getSwitch("문 열림");';
  const original: GameEvent = {
    id: "ev_open_door", x: 2, y: 2, trigger: { kind: "action" }, commands: [{
      kind: "script", source, compiled: source, effects: { ...EMPTY_SCRIPT_EFFECTS, reads: [{ kind: "switch", id: "문 열림" }] },
    }],
  };
  const project = withMapEvent(before, { ...original, commands: [], draft: { kind: "edit", original } });
  expectRefused(project, mapTarget(project), "switch.rename", { record: "sw_door", name: "문 열기" }, /스크립트/u);
});

it("인물의 호감도에 연결된 변수는 연결이 끊기는 이름으로 바꾸지 않아요", () => {
  const before = fixtureProject("blank");
  const project: Project = {
    ...before,
    variables: [{ id: "var_heart", name: "이루리 호감도" }],
    characters: { ruri: { displayName: "이루리" } },
  };
  const target = mapTarget(project);
  expectRefused(project, target, "variable.rename", { record: "var_heart", name: "새 이름" }, /호감도/u);
  expect(runPrimitive(project, target, "variable.rename", { record: "var_heart", name: "이루리의 친밀도" }).after.variables[0]?.name).toBe("이루리의 친밀도");
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

it("한 인물의 호감도 조건을 저장하고 플레이에서 그 인물의 값만 판정해요", async () => {
  const before = { ...fixtureProject("blank"), characters: { ruri: { displayName: "이루리" }, hana: { displayName: "유하나" } } };
  const target = mapTarget(before);
  const conditions = [{ kind: "friendshipAtLeast", npcKey: "ruri", value: 10 }];
  const { after } = runPrimitive(before, target, "ending.define", { name: "루리와 다시 만남", conditions });
  const ending = after.endings!.at(-1)!;
  expect(ending.conditions).toEqual(conditions);
  await expectUndoRestores(before, after, target);

  const session = startSession(after, 1);
  const trigger: Command = { kind: "triggerEnding", endingId: ending.id };
  expect(createInterpreter([{ kind: "changeFriendship", npcKey: "hana", delta: 10 }, trigger], session, after).start())
    .toEqual({ kind: "done" });
  expect(createInterpreter([{ kind: "changeFriendship", npcKey: "ruri", delta: 10 }, trigger], session, after).start())
    .toMatchObject({ kind: "returnToTitle", clear: { endingId: ending.id } });
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
