/** @vitest-environment happy-dom */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { getMapEditHistoryDepth, resetMapEditHistory } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/17-db-actors-classes";
import { SmallTaskError, type SmallTaskTarget } from "@/editor/smallTask/target";
import { resolveDialogueSpeakerName, resolveDialogueText } from "@/player/dialogue";
import { createInterpreter } from "@/player/interpreter";
import { createActorRecord } from "@/project/actorModel";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { expectApplies, expectUndoRestores, loadFixture } from "./harness";

const charset = "easyrpg-charset-actor1";
const face = "easyrpg-faceset-actor1-03";
const look = { id: "appearance_spare", name: "여행복", description: "낡은 망토", charset: { resourceId: charset, characterIndex: 2 } };
const spareClass = normalizeClassRecord({ id: "class_spare", name: "경비병" });
const spareActor = { ...createActorRecord("actor_spare", spareClass.id), name: "지후", nickname: "" };

type Collection = "actors" | "classes" | "characterAppearances";
const fixtures = new Map<FixtureName, Project>();

function projectWithRows(kind: FixtureName): Project {
  const project = fixtures.get(kind)!;
  return {
    ...project,
    database: {
      ...project.database,
      actors: [...project.database.actors, spareActor],
      classes: [...project.database.classes, spareClass],
      characterAppearances: [...(project.database.characterAppearances ?? []), { id: "appearance_other", name: "평상복", description: "" }, look],
    },
  };
}

function target(collection: Collection, id: string): Extract<SmallTaskTarget, { kind: "dbEntry" }> {
  return { kind: "dbEntry", collection, id, label: "자료집 항목" };
}

function commonCommands(project: Project, commands: Command[]): Project {
  return { ...project, commonEvents: [...project.commonEvents, { id: "ce_review", name: "검수", trigger: "none", commands }] };
}

function liveWithDraft(command: (actorCount: number) => Command): Project {
  const project = projectWithRows("built");
  store.replaceProject(project);
  resetMapEditHistory();
  store.updateMap(project.startMapId, map => {
    map.events.push({ id: "ev_review_draft", name: "초안", x: 2, y: 2,
      commands: [command(project.database.actors.length)], trigger: { kind: "action" }, draft: { kind: "new" } });
  });
  return store.getCurrent();
}

const actorTarget = target("actors", spareActor.id);
const classTarget = target("classes", spareClass.id);
const lookTarget = target("characterAppearances", look.id);

const cases = [
  { id: "db.actors.create", fixture: "blank", target: actorTarget, args: { name: "미나", initialLevel: 3 },
    expected: (p: Project) => [...p.database.actors, { ...createActorRecord("actor_small_task_1", spareClass.id), name: "미나", nickname: "", initialLevel: 3 }] },
  { id: "db.actors.update", fixture: "maou", target: actorTarget, args: { name: "새이름 actor_hidden", nickname: "길잡이", initialLevel: 4, maxLevel: 40, appearanceId: look.id },
    expected: (p: Project) => [...p.database.actors.slice(0, -1), { ...spareActor, name: "새이름 actor_hidden", nickname: "길잡이", initialLevel: 4, maxLevel: 40, appearanceId: look.id }] },
  { id: "db.actors.delete", fixture: "built", target: actorTarget, args: {},
    expected: (p: Project) => p.database.actors.slice(0, -1) },
  { id: "db.classes.create", fixture: "maou", target: classTarget, args: { name: "별빛술사" },
    expected: (p: Project) => [...p.database.classes, normalizeClassRecord({ id: "class_small_task_1", name: "별빛술사" })] },
  { id: "db.classes.update", fixture: "built", target: classTarget, args: { maxHpAtLevel99: 6800 },
    expected: (p: Project) => [...p.database.classes.slice(0, -1), { ...spareClass, parameterCurves: {
      ...spareClass.parameterCurves, maxHp: [...spareClass.parameterCurves.maxHp.slice(0, -1), 6800],
    } }] },
  { id: "db.classes.delete", fixture: "blank", target: classTarget, args: {}, removeActor: true,
    expected: (p: Project) => p.database.classes.slice(0, -1) },
  { id: "db.characterAppearances.create", fixture: "built", target: lookTarget, args: { name: "축제복", faceResourceId: face },
    expected: (p: Project) => [...p.database.characterAppearances!, { id: "appearance_small_task_1", name: "축제복", description: "", face: { resourceId: face } }] },
  { id: "db.characterAppearances.update", fixture: "maou", target: lookTarget, args: { name: "눈길 외투", faceResourceId: face, characterIndex: 5 },
    expected: (p: Project) => [...p.database.characterAppearances!.slice(0, -1), { ...look, name: "눈길 외투", charset: { ...look.charset, characterIndex: 5 }, face: { resourceId: face } }] },
  { id: "db.characterAppearances.delete", fixture: "blank", target: lookTarget, args: {},
    expected: (p: Project) => p.database.characterAppearances!.slice(0, -1) },
] as const;

describe("자료집 주인공·직업·외형의 작은 일", () => {
  // 마왕 편의점 데모 생성은 맵·이벤트 저작을 포함하므로 한 번만 준비한다.
  beforeAll(() => {
    for (const name of ["blank", "built", "maou"] as const) {
      const fixture = loadFixture(name);
      // 편집기에서 여는 프로젝트와 같이 정규화한 뒤 동결된 기준본으로 사용한다.
      ensureSwitchVariableSlots(fixture);
      removeLegacySpriteReferences(fixture);
      fixtures.set(name, fixture);
    }
  }, 180_000);

  it.each(cases)("$id 저장값·한국어 미리보기·범위·되돌리기", async example => {
    const before = projectWithRows(example.fixture);
    if ("removeActor" in example) before.database.actors.pop();
    const original = { ...before, database: structuredClone(before.database) };
    const collection = example.id.split(".")[1] as Collection;
    const { after, sentence } = expectApplies(before, example.target, example.id, example.args);
    expect(after.database[collection]).toEqual(example.expected(before));
    expect(after.maps).toBe(before.maps);
    expect(jsonEqual(before, original)).toBe(true);
    expect(sentence).toMatch(/[가-힣].*\.$/u);
    expect(sentence.length).toBeLessThanOrEqual(80);
    expect(sentence).not.toMatch(/[{}\[\]]|\b(?:actor|class|appearance)_\w+|\bdb\./u);

    const wrong = collection === "actors" ? classTarget : actorTarget;
    expect(() => runPrimitive(before, wrong, example.id, example.args)).toThrow(/범위 밖/u);
    const primitive = PRIMITIVES.find(row => row.id === example.id)!;
    const scope = primitive.scope({ project: before, target: example.target }, example.args);
    const outside = checkSmallTaskScope(before, { ...after, meta: { ...after.meta, title: "요청 밖 제목" } }, scope);
    expect(outside).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    const other = before.database[collection]!.find(row => row.id !== example.target.id)!;
    const changedRows = after.database[collection]!.map(row => row.id === other.id ? { ...row, name: "다른 항목" } : row);
    expect(checkSmallTaskScope(before, { ...after, database: { ...after.database, [collection]: changedRows } }, scope).ok).toBe(false);
    const extraRows = [...after.database[collection]!, { ...other, id: "unexpected_row" }];
    expect(checkSmallTaskScope(before, { ...after, database: { ...after.database, [collection]: extraRows } }, scope).ok).toBe(false);
    expect(() => runPrimitive(before, target(collection, "missing_row"), example.id, example.args)).toThrow("선택한 항목을 다시 골라");
    await expectUndoRestores(before, after, example.target);
  });

  it("긴 이름이 들어간 미리보기에서 식별자와 줄바꿈을 가린다", () => {
    const before = projectWithRows("blank");
    const name = `actor_hidden \n ${"긴 이름 ".repeat(30)}`;
    const { after, sentence } = runPrimitive(before, actorTarget, "db.actors.update", { name });
    expect(after.database.actors.at(-1)?.name).toBe(name.trim());
    expect(sentence).not.toMatch(/actor_hidden|[\r\n]/u);
    expect(sentence.length).toBeLessThanOrEqual(80);
  });

  it("잘못된 연결과 단계 범위를 거절하고 기존 값을 보존한다", () => {
    const before = projectWithRows("blank");
    expect(() => runPrimitive(before, actorTarget, "db.actors.update", { classId: "class_missing" })).toThrow("연결할 직업");
    expect(() => runPrimitive(before, actorTarget, "db.actors.update", { appearanceId: "appearance_missing" })).toThrow("캐릭터 외형");
    expect(() => runPrimitive(before, actorTarget, "db.actors.update", { initialLevel: 10, maxLevel: 4 })).toThrow("시작 레벨");
    expect(() => runPrimitive(before, lookTarget, "db.characterAppearances.update", { faceResourceId: charset })).toThrow(PrimitiveError);
    expect(() => runPrimitive(before, lookTarget, "db.characterAppearances.update", { charsetResourceId: null, characterIndex: 2 })).toThrow("걷기 그림");
    expect(before.database.actors.at(-1)).toBe(spareActor);
    expect(before.database.characterAppearances?.at(-1)).toBe(look);
  });

  it("직업의 99레벨 체력만 수정하고 직접 만든 중간값을 보존한다", async () => {
    const before = projectWithRows("blank");
    const maxHp = spareClass.parameterCurves.maxHp.map((value, index) => index === 49 ? 2023 : value);
    const curves = { ...spareClass.parameterCurves, maxHp };
    before.database.classes[before.database.classes.length - 1] = { ...spareClass, parameterCurves: curves };
    const { after, sentence } = runPrimitive(before, classTarget, "db.classes.update", { maxHpAtLevel99: 6800 });
    expect(after.database.classes.at(-1)?.parameterCurves).toEqual({ ...curves, maxHp: [...maxHp.slice(0, -1), 6800] });
    expect(sentence).toContain("99레벨 최대 체력만");
    expect(before.database.classes.at(-1)?.parameterCurves).toBe(curves);
    await expectUndoRestores(before, after, classTarget);
  });

  it("1레벨 체력보다 낮은 99레벨 체력은 생성과 수정에서 모두 거절한다", () => {
    const before = projectWithRows("blank");
    const start = spareClass.parameterCurves.maxHp[0];
    for (const operation of ["create", "update"]) {
      expect(() => runPrimitive(before, classTarget, `db.classes.${operation}`, { name: "성문지기", maxHpAtLevel99: start - 1 }))
        .toThrow("99레벨 최대 체력은 1레벨 최대 체력 이상이어야 해요.");
    }
    const { after } = runPrimitive(before, classTarget, "db.classes.create", { name: "성문지기", maxHpAtLevel99: 6800 });
    const curve = after.database.classes.at(-1)!.parameterCurves.maxHp;
    expect([curve[0], curve[49], curve[98]]).toEqual([start, Math.round(start + (6800 - start) * 0.375), 6800]);
  });

  it("98레벨보다 낮은 99레벨 체력 수정은 마지막 레벨에서 체력이 떨어지므로 거절한다", () => {
    const before = projectWithRows("blank");
    const previous = spareClass.parameterCurves.maxHp[97];
    expect(() => runPrimitive(before, classTarget, "db.classes.update", { maxHpAtLevel99: previous - 1 }))
      .toThrow("99레벨 최대 체력은 98레벨 최대 체력 이상이어야 해요.");
    const { after } = runPrimitive(before, classTarget, "db.classes.update", { maxHpAtLevel99: previous });
    expect(after.database.classes.at(-1)?.parameterCurves.maxHp.slice(-2)).toEqual([previous, previous]);
  });

  it.each([
    [actorTarget, "db.actors.create", { name: "   " }, "이름을 입력"],
    [actorTarget, "db.actors.update", { initialLevel: 0 }, "형식을 확인"],
    [actorTarget, "db.actors.update", { maxLevel: 100 }, "형식을 확인"],
    [actorTarget, "db.actors.update", { id: "actor_hero", name: "대상 바꾸기" }, "형식을 확인"],
    [classTarget, "db.classes.update", { maxHpAtLevel99: 100_000 }, "형식을 확인"],
    [lookTarget, "db.characterAppearances.update", { characterIndex: 8 }, "형식을 확인"],
    [lookTarget, "db.characterAppearances.update", { charsetResourceId: "   " }, "외형에 넣을"],
  ] as const)("%o %s 입력값 경계를 확인한다", (selected, primitive, args, reason) => {
    expect(() => runPrimitive(projectWithRows("blank"), selected, primitive, args)).toThrow(reason);
  });

  it("시작 주인공과 참조 중인 직업·외형은 삭제를 거절한다", () => {
    const before = projectWithRows("blank");
    const starter = target("actors", before.system.startActorIds[0]);
    expect(() => runPrimitive(before, starter, "db.actors.delete", {})).toThrow("사용 중인 주인공");
    expect(() => runPrimitive(before, classTarget, "db.classes.delete", {})).toThrow("사용 중인 직업");
    const { after } = runPrimitive(before, actorTarget, "db.actors.update", { appearanceId: look.id });
    expect(() => runPrimitive(after, lookTarget, "db.characterAppearances.delete", {})).toThrow("사용 중인 캐릭터 외형");
  });

  it("공용 이벤트의 중첩 조건과 전투 실패 분기에 남은 참조를 보호한다", () => {
    const before = projectWithRows("built");
    const troop = before.database.troops[0];
    const project = commonCommands(before, [{
      kind: "battleProcessing", troopId: troop.id, canEscape: false, canLose: true, branchOnResult: true,
      defeatBranch: [{ kind: "fork", condition: { kind: "actor", actorId: spareActor.id, present: true }, then: [
        { kind: "changeFace", resourceId: "", appearanceId: look.id, position: "left", flipHorizontally: false },
      ] }],
    }]);
    expect(() => runPrimitive(project, actorTarget, "db.actors.delete", {})).toThrow("사용 중인 주인공");
    expect(() => runPrimitive(project, lookTarget, "db.characterAppearances.delete", {})).toThrow("사용 중인 캐릭터 외형");
    const { after } = runPrimitive(project, actorTarget, "db.actors.update", { name: "지안" });
    expect(after.database.actors.at(-1)?.id).toBe(spareActor.id);
    expect(after.commonEvents).toBe(project.commonEvents);
  });

  it("전투 페이지 조건과 다른 직업의 승급 대상을 보호한다", () => {
    const before = projectWithRows("built");
    const troop = before.database.troops[0];
    before.database.troops = [{ ...troop, battleEventPages: [{
      id: "bp_review", name: "검수", span: "battle",
      conditions: [{ kind: "actorTurn", actorId: spareActor.id, turn: 1 }], commands: [],
    }] }, ...before.database.troops.slice(1)];
    before.database.actors.pop();
    const existingClass = before.database.classes[0];
    before.database.classes[0] = { ...existingClass, promotions: [{ toClassId: spareClass.id, requires: {} }] };
    expect(() => runPrimitive(before, classTarget, "db.classes.delete", {})).toThrow("사용 중인 직업");
    const withActor: Project = {
      ...before,
      database: { ...before.database, actors: [...before.database.actors, spareActor] },
    };
    expect(() => runPrimitive(withActor, actorTarget, "db.actors.delete", {})).toThrow("사용 중인 주인공");
  });

  it("앞 행을 삭제해도 전투 뒤 대사의 주인공 번호가 다른 인물을 가리키지 않게 한다", () => {
    const before = projectWithRows("built");
    const nextActor = { ...spareActor, id: "actor_next", name: "하루" };
    before.database.actors.push(nextActor);
    const troop = before.database.troops[0];
    const body = `\\n[ ${before.database.actors.length} ] 님!`;
    before.database.troops = [{ ...troop, afterBattle: { victory: [{ kind: "text", body }] } }, ...before.database.troops.slice(1)];
    expect(resolveDialogueText(body, { project: before, session: { variables: {} } })).toBe("하루 님!");
    expect(() => runPrimitive(before, actorTarget, "db.actors.delete", {})).toThrow("대사의 주인공 번호");
    expect(before.database.actors.at(-2)).toBe(spareActor);

    const blank = projectWithRows("blank");
    const escapedOnly = commonCommands(blank, [{ kind: "text", body: `\\N[1], \\\\N[${blank.database.actors.length}]` }]);
    expect(runPrimitive(escapedOnly, actorTarget, "db.actors.delete", {}).after.database.actors).not.toContain(spareActor);
  });

  it("이름으로 연결한 화자를 보호하고 ID로 연결한 외형의 이름은 바꿀 수 있다", () => {
    const named = commonCommands(projectWithRows("blank"), [{ kind: "loop", body: [
      { kind: "text", speaker: spareActor.name, body: "안녕" },
      { kind: "text", speaker: look.name, body: "여행 출발" },
    ] }]);
    const withPortrait = runPrimitive(named, lookTarget, "db.characterAppearances.update", { faceResourceId: face }).after;
    expect(() => runPrimitive(withPortrait, actorTarget, "db.actors.update", { name: "유진" })).toThrow("대사의 화자");
    expect(() => runPrimitive(withPortrait, lookTarget, "db.characterAppearances.update", { name: "겨울 외투" })).toThrow("대사의 화자");
    expect(() => runPrimitive(withPortrait, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");

    const byId = runPrimitive(projectWithRows("blank"), actorTarget, "db.actors.update", { appearanceId: look.id }).after;
    const renamed = runPrimitive(byId, lookTarget, "db.characterAppearances.update", { name: "겨울 외투" }).after;
    expect(renamed.database.characterAppearances?.at(-1)).toMatchObject({ id: look.id, name: "겨울 외투" });
    expect(renamed.database.actors).toBe(byId.database.actors);
  });

  it("기존 이벤트가 가리키는 빈 ID를 새 주인공에게 재사용하지 않는다", () => {
    const before = commonCommands(projectWithRows("blank"), [{ kind: "changeParty", actorId: "actor_small_task_1", action: "add" }]);
    const { after } = runPrimitive(before, actorTarget, "db.actors.create", { name: "미나" });
    expect(after.database.actors.at(-1)).toMatchObject({ id: "actor_small_task_2", name: "미나" });
    expect(after.commonEvents).toBe(before.commonEvents);
  });

  it("직업과 외형을 추가할 때 기존 참조가 남아 있는 ID를 건너뛴다", () => {
    const before = commonCommands(projectWithRows("blank"), [
      { kind: "changeFace", resourceId: "", appearanceId: "appearance_small_task_1", position: "left", flipHorizontally: false },
    ]);
    before.database.actors.push({ ...spareActor, id: "actor_old", classId: "class_small_task_1" });
    const createdClass = runPrimitive(before, classTarget, "db.classes.create", { name: "밤 경비" }).after;
    expect(createdClass.database.classes.at(-1)?.id).toBe("class_small_task_2");
    const createdLook = runPrimitive(before, lookTarget, "db.characterAppearances.create", { name: "여행복" }).after;
    expect(createdLook.database.characterAppearances?.at(-1)?.id).toBe("appearance_small_task_2");
  });

  it("구형 대사의 줄 배열과 에필로그의 병렬 대사에 남은 주인공 번호를 보호한다", () => {
    const before = projectWithRows("blank");
    const line = `\\N[${before.database.actors.length}] 님!`;
    // 구형 저장본은 body 대신 lines를 사용한다.
    const legacyText = { kind: "text", lines: [line] } as unknown as Command;
    const legacy = commonCommands(before, [legacyText]);
    expect(createInterpreter([legacyText], startSession(legacy), legacy).start()).toMatchObject({ body: line });
    expect(() => runPrimitive(legacy, actorTarget, "db.actors.delete", {})).toThrow("대사의 주인공 번호");

    const ending: NonNullable<Project["endings"]>[number] = {
      id: "ending_review", name: "검수 엔딩", conditions: [], priority: 0,
      epilogue: [{ kind: "parallel", beats: [{ kind: "say", lines: [line] }] }],
    };
    const epilogue = { ...before, endings: [ending] };
    expect(createInterpreter([{ kind: "triggerEnding", endingId: ending.id }], startSession(epilogue), epilogue).start())
      .toMatchObject({ body: line });
    expect(() => runPrimitive(epilogue, actorTarget, "db.actors.delete", {})).toThrow("대사의 주인공 번호");
  });

  it("대사의 아직 빈 주인공 번호를 새 동료에게 연결하지 않는다", () => {
    const before = projectWithRows("blank");
    const line = `\\N[${before.database.actors.length + 1}] 님!`;
    const project = commonCommands(before, [{ kind: "text", body: line }]);
    expect(() => runPrimitive(project, actorTarget, "db.actors.create", { name: "미나" })).toThrow("대사의 주인공 번호");
  });

  it("제어 문자로 꾸민 화자 이름과 글자 순서로 찾는 주인공 이름을 보호한다", () => {
    const before = projectWithRows("blank");
    const withPortrait = runPrimitive(before, lookTarget, "db.characterAppearances.update", { faceResourceId: face }).after;
    const portrait = commonCommands(withPortrait, [{ kind: "text", speaker: `\\C[2]${look.name}`, body: "출발" }]);
    expect(() => runPrimitive(portrait, lookTarget, "db.characterAppearances.update", { name: "겨울 외투" })).toThrow("대사의 화자");
    expect(() => runPrimitive(portrait, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");

    const withRenamedActor: Project = {
      ...before,
      database: {
        ...before.database,
        actors: before.database.actors.map(actor => actor.id === spareActor.id ? { ...actor, name: "김지후" } : actor),
      },
    };
    const stage = commonCommands(withRenamedActor, [{ kind: "text", speaker: "김후", body: "안녕" }]);
    expect(() => runPrimitive(stage, actorTarget, "db.actors.update", { name: "이누리" })).toThrow("대사의 화자");
  });

  it("문자열 변수로 고르는 화자 초상을 삭제하거나 이름을 바꾸지 않는다", () => {
    const base = projectWithRows("blank");
    const before = runPrimitive(base, lookTarget, "db.characterAppearances.update", { faceResourceId: face }).after;
    const speaker = "[빠르게]여행\\t[ outfit ]";
    const dialogue = { kind: "text", speaker, body: "출발" } as const;
    const project = commonCommands(before, [{ kind: "loop", body: [dialogue] }]);
    expect(resolveDialogueSpeakerName(speaker, { project, session: { variables: {}, stringVariables: { outfit: "복" } } })).toBe(look.name);
    expect(() => runPrimitive(project, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");
    expect(() => runPrimitive(project, lookTarget, "db.characterAppearances.update", { name: "겨울 외투" })).toThrow("대사의 화자");

    const numbered = runPrimitive(before, lookTarget, "db.characterAppearances.update", { name: "여행복2" }).after;
    const mixedSpeaker = "\\T[outfit]\\V[1]";
    const numberedDialogue = commonCommands(numbered, [{ ...dialogue, speaker: mixedSpeaker }]);
    expect(resolveDialogueSpeakerName(mixedSpeaker, {
      project: numberedDialogue, session: { variables: { var_0001: 2 }, stringVariables: { outfit: "여행복" } },
    })).toBe("여행복2");
    expect(() => runPrimitive(numberedDialogue, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");

    const otherSpeakers = commonCommands(before, [
      { ...dialogue, speaker: "경비병 \\T[outfit]" },
      { ...dialogue, speaker: "\\\\T[outfit]" },
      { ...dialogue, speaker: undefined, body: "\\T[outfit]" },
    ]);
    expect(runPrimitive(otherSpeakers, lookTarget, "db.characterAppearances.delete", {}).after.database.characterAppearances)
      .not.toContainEqual(expect.objectContaining({ id: look.id }));
  });

  it("같은 이름의 뒤쪽 외형으로 화자 초상이 바뀌는 삭제도 막는다", () => {
    const before = projectWithRows("blank");
    const fallback = { ...look, id: "appearance_fallback", face: { resourceId: face } };
    const project = commonCommands(before, [{ kind: "text", speaker: "\\T[outfit]", body: "출발" }]);
    project.database.characterAppearances = [...before.database.characterAppearances!, fallback];
    expect(() => runPrimitive(project, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");
  });

  it("숫자 변수 화자가 연결할 수 있는 외형을 보호한다", () => {
    const before = projectWithRows("blank");
    const speaker = "여행복\\V[1]";
    for (const suffix of ["-2", "02", "10000000"]) {
      const project = commonCommands({ ...before, database: { ...before.database, characterAppearances: [
        { ...look, name: `여행복${suffix}`, face: { resourceId: face } },
      ] } }, [{ kind: "text", speaker, body: "출발" }]);
      const apply = () => runPrimitive(project, lookTarget, "db.characterAppearances.delete", {});
      if (suffix === "-2") {
        expect(resolveDialogueSpeakerName(speaker, { project, session: { variables: { var_0001: -2 } } })).toBe(`여행복${suffix}`);
        expect(apply).toThrow("대사의 화자");
      } else {
        expect(apply().after.database.characterAppearances).toEqual([]);
      }
      if (suffix === "10000000") {
        const seeded = { ...project, session: { ...project.session, variables: { ...project.session.variables, var_0001: 10_000_000 } } };
        expect(() => runPrimitive(seeded, lookTarget, "db.characterAppearances.delete", {})).toThrow("대사의 화자");
      }
    }
  });

  it("번호를 쓰는 화자는 주인공의 바뀐 이름을 따라간다", () => {
    const before = projectWithRows("blank");
    const speaker = `\\N[${before.database.actors.length}]`;
    const project = commonCommands(before, [{ kind: "text", speaker, body: "안녕" }]);
    const { after } = runPrimitive(project, actorTarget, "db.actors.update", { name: "이누리" });
    expect(after.commonEvents).toBe(project.commonEvents);
    expect(resolveDialogueText(speaker, { project: after, session: { variables: {} } })).toBe("이누리");
  });

  it("실행할 때 앞뒤 공백을 떼는 구형 명령의 주인공 참조를 보호한다", () => {
    const before = commonCommands(projectWithRows("blank"), [{
      kind: "m2Command", commandId: "m2-078-open-menu-screen", fields: { screen: "skills", actorId: ` ${spareActor.id} ` },
    }]);
    expect(createInterpreter(before.commonEvents.at(-1)!.commands, startSession(before), before).start())
      .toMatchObject({ kind: "openMenuScreen", screen: "skills", actorId: spareActor.id });
    expect(() => runPrimitive(before, actorTarget, "db.actors.delete", {})).toThrow("사용 중인 주인공");
  });

  it("전투 명령 변경의 공백 붙은 주인공 ID를 보호한다", () => {
    const commands: Command[] = [{
      kind: "m2Command", commandId: "m2-092-change-battle-commands",
      fields: { target: "actor", actorId: ` ${spareActor.id} `, operation: "set", value: "cmd_attack" },
    }];
    const before = commonCommands(projectWithRows("blank"), commands);
    const session = startSession(before);
    createInterpreter(commands, session, before).start();
    expect(session.actorBattleCommands?.[spareActor.id]).toEqual(["cmd_attack"]);
    expect(() => runPrimitive(before, actorTarget, "db.actors.delete", {})).toThrow("사용 중인 주인공");
  });

  it.each([
    ["화자 번호", (number: number): Command => ({ kind: "text", speaker: `\\N[${number}]`, body: "출발" }), "대사의 주인공 번호"],
    ["명령 참조", (): Command => ({ kind: "changeParty", actorId: spareActor.id, action: "add" }), "쓰는 자료집 항목"],
    ["공백을 포함한 ID", (): Command => ({ kind: "m2Command", commandId: "m2-078-open-menu-screen",
      fields: { screen: "skills", actorId: ` ${spareActor.id} ` } }), "사용 중인 주인공"],
  ] as const)("열린 이벤트 초안의 %s 때문에 주인공 삭제를 적용 전에 거절한다", (_name, command, reason) => {
    const live = liveWithDraft(command);
    const before = smallTaskBase(live, actorTarget);
    expect(before.maps[before.startMapId].events.some(event => event.id === "ev_review_draft")).toBe(false);
    const { after } = runPrimitive(before, actorTarget, "db.actors.delete", {});
    expect(() => runPrimitive(before, actorTarget, "db.actors.delete", {}, undefined, live)).toThrow(reason);
    const commit = () => commitSmallTask(live, before, after, actorTarget);
    expect(commit).toThrow(SmallTaskError);
    expect(commit).toThrow(reason);
    expect(store.getCurrent()).toBe(live);
    expect(getMapEditHistoryDepth()).toBe(0);
  });

  it.each(["주인공 번호", "생성 ID"] as const)("열린 이벤트 초안의 %s와 충돌하는 주인공 생성을 막는다", reference => {
    const live = liveWithDraft(count => reference === "주인공 번호"
      ? { kind: "text", speaker: `\\N[${count + 1}]`, body: "출발" }
      : { kind: "changeParty", actorId: "actor_small_task_1", action: "add" });
    const before = smallTaskBase(live, actorTarget);
    const args = { name: "미나" };
    const { after } = runPrimitive(before, actorTarget, "db.actors.create", args);
    expect(after.database.actors.at(-1)?.id).toBe("actor_small_task_1");
    if (reference === "주인공 번호") {
      expect(() => runPrimitive(before, actorTarget, "db.actors.create", args, undefined, live)).toThrow("대사의 주인공 번호");
    } else {
      const safe = runPrimitive(before, actorTarget, "db.actors.create", args, undefined, live).after;
      expect(safe.database.actors.at(-1)?.id).toBe("actor_small_task_2");
    }
    expect(() => commitSmallTask(live, before, after, actorTarget)).toThrow(reference === "주인공 번호" ? "대사의 주인공 번호" : "새 항목의 식별자");
    expect(store.getCurrent()).toBe(live);
    expect(getMapEditHistoryDepth()).toBe(0);
  });

  it("사용하지 않는 주인공·직업·외형을 삭제한 뒤 SQLite에서 다시 읽는다", async () => {
    const before = projectWithRows("built");
    const after = [actorTarget, classTarget, lookTarget].reduce((project, selected) => {
      if (selected.kind !== "dbEntry") throw new Error("Expected database target");
      return runPrimitive(project, selected, `db.${selected.collection}.delete`, {}).after;
    }, before);
    const projectDir = await mkdtemp(join(tmpdir(), "oprn-db-primitive-"));
    try {
      const local = await initLocalProjectStore({ projectDir });
      try {
        expect((await local.saveProject(before)).kind).toBe("saved");
        expect((await local.saveProject(after)).kind).toBe("saved");
      } finally {
        local.close();
      }
      const reopened = await openLocalProjectStore({ projectDir });
      try {
        const database = reopened.loadSnapshot()?.project.database;
        for (const collection of ["actors", "classes", "characterAppearances"] as const) {
          expect(database?.[collection]?.map(row => row.id)).toEqual(after.database[collection]?.map(row => row.id));
        }
      } finally {
        reopened.close();
      }
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 60_000);

  it("새 동료를 게임에서 파티에 합류시킨다", () => {
    const before = projectWithRows("blank");
    const { after } = runPrimitive(before, actorTarget, "db.actors.create", { name: "미나", initialLevel: 5 });
    const actor = after.database.actors.at(-1)!;
    const session = startSession(after);
    createInterpreter([{ kind: "changeParty", actorId: actor.id, action: "add" }], session, after).start();
    expect(session.partyActorIds).toContain(actor.id);
    expect(session.actorVitals[actor.id]?.maxHp).toBe(actor.parameterCurves.maxHp[4]);
  });

  it("수정한 시작 레벨을 기준으로 이벤트가 레벨을 올린다", () => {
    const before = projectWithRows("blank");
    const { after } = runPrimitive(before, actorTarget, "db.actors.update", { initialLevel: 7 });
    const session = startSession(after);
    expect(session.actorLevels[spareActor.id]).toBe(7);
    createInterpreter([{ kind: "changeLevel", actorId: spareActor.id, op: "+=", amount: 2 }], session, after).start();
    expect(session.actorLevels[spareActor.id]).toBe(9);
  });

  it("대사에서 수정한 외형의 얼굴이 표시된다", () => {
    const before = projectWithRows("built");
    const { after } = runPrimitive(before, lookTarget, "db.characterAppearances.update", { faceResourceId: face });
    const result = createInterpreter([
      { kind: "changeFace", resourceId: "", appearanceId: look.id, position: "left", flipHorizontally: false },
      { kind: "text", body: "안녕!" },
    ], startSession(after), after).start();
    expect(result).toMatchObject({ kind: "text", face: { resourceId: face } });
  });
});
