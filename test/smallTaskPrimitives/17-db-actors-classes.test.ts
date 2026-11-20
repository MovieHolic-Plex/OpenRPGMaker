/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import type { FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/17-db-actors-classes";
import type { SmallTaskTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createActorRecord } from "@/project/actorModel";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
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
      characterAppearances: [...(project.database.characterAppearances ?? []), look],
    },
  };
}

function target(collection: Collection, id: string): SmallTaskTarget {
  return { kind: "dbEntry", collection, id, label: "자료집 항목" };
}

const actorTarget = target("actors", spareActor.id);
const classTarget = target("classes", spareClass.id);
const lookTarget = target("characterAppearances", look.id);

function grownHp() {
  const start = spareClass.parameterCurves.maxHp[0];
  return Array.from({ length: 99 }, (_, index) => {
    const fraction = index / 98;
    return Math.round(start + (6800 - start) * (fraction + fraction * fraction) / 2);
  });
}

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
    expected: (p: Project) => [...p.database.classes.slice(0, -1), { ...spareClass, parameterCurves: { ...spareClass.parameterCurves, maxHp: grownHp() } }] },
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
    for (const name of ["blank", "built", "maou"] as const) fixtures.set(name, loadFixture(name));
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

  it("시작 주인공과 참조 중인 직업·외형은 삭제를 거절한다", () => {
    const before = projectWithRows("blank");
    const starter = target("actors", before.system.startActorIds[0]);
    expect(() => runPrimitive(before, starter, "db.actors.delete", {})).toThrow("사용 중인 주인공");
    expect(() => runPrimitive(before, classTarget, "db.classes.delete", {})).toThrow("사용 중인 직업");
    const { after } = runPrimitive(before, actorTarget, "db.actors.update", { appearanceId: look.id });
    expect(() => runPrimitive(after, lookTarget, "db.characterAppearances.delete", {})).toThrow("사용 중인 캐릭터 외형");
  });

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
