/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { actorBattlers, enemyBattlers } from "@/battle/battleBattlers";
import { executeM2BattleCommand } from "@/battle/battleM2CommandExecutor";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/10-m2-actor-battle";
import { startSession } from "@/project/session";
import type { Command, EventPage, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, runHeadless } from "./harness";
import seededCorpus from "./10-m2-actor-battle/seeded-corpus.json";

const EVENT = "ev_actor_battle_test";
const PAGE = "pg_actor_battle_test";
const READ_ONLY_PAGE = "pg_actor_battle_other";
const CALLED_PAGE = "battle_page_reinforcements";
const hero = "actor_hero";
const original: Command = { kind: "text", body: "그대로 있는 대사." };

type M2 = Extract<Command, { kind: "m2Command" }>;
type RowCase = {
  number: string;
  commandId: string;
  args: Record<string, unknown>;
  stored: M2CommandFields;
  patch: Record<string, unknown>;
  updated: M2CommandFields;
};
const cases: readonly RowCase[] = [
  { number: "014", commandId: "m2-014-change-parameters", args: { target: hero, parameter: "attack", value: 3 },
    stored: { target: hero, parameter: "attack", operation: "add", value: 3, valueSource: "number", valueVariableId: "" },
    patch: { value: 7 }, updated: { value: 7 } },
  { number: "019", commandId: "m2-019-change-state", args: { value: "state_poison" },
    stored: { target: "party", operation: "add", value: "state_poison" },
    patch: { operation: "remove" }, updated: { operation: "remove" } },
  { number: "021", commandId: "m2-021-damage-processing", args: { value: 6 },
    stored: { target: "party", operation: "add", value: 6, valueSource: "number", valueVariableId: "" },
    patch: { operation: "remove" }, updated: { operation: "remove" } },
  { number: "022", commandId: "m2-022-change-actor-name", args: { target: hero, value: "카이" },
    stored: { target: hero, value: "카이" }, patch: { value: "하루" }, updated: { value: "하루" } },
  { number: "023", commandId: "m2-023-change-actor-nickname", args: { target: hero, value: "별지기" },
    stored: { target: hero, value: "별지기" }, patch: { value: "" }, updated: { value: "" } },
  { number: "024", commandId: "m2-024-change-actor-graphic", args: { target: hero, value: "tex_easyrpg_charset_actor1", characterIndex: 1 },
    stored: { target: hero, value: "tex_easyrpg_charset_actor1", characterIndex: 1 },
    patch: { value: "charset:tex_easyrpg_charset_actor1:3" },
    updated: { value: "charset:tex_easyrpg_charset_actor1:3", characterIndex: 3 } },
  { number: "025", commandId: "m2-025-change-actor-faceset", args: { target: hero, value: "easyrpg-faceset-actor1-00" },
    stored: { target: hero, value: "easyrpg-faceset-actor1-00" },
    patch: { value: "" }, updated: { value: "" } },
  { number: "091", commandId: "m2-091-change-actor-class", args: { value: "class_paladin" },
    stored: { target: "", value: "class_paladin" }, patch: { value: "class_mage" }, updated: { value: "class_mage" } },
  { number: "092", commandId: "m2-092-change-battle-commands", args: { target: hero, value: "cmd_defend" },
    stored: { target: hero, operation: "add", value: "cmd_defend" }, patch: { operation: "remove" }, updated: { operation: "remove" } },
  { number: "098", commandId: "m2-098-change-enemy-hp", args: { target: "enemy-1", operation: "remove", value: 8 },
    stored: { target: "enemy-1", operation: "remove", value: "8" },
    patch: { value: 4 }, updated: { value: "4" } },
  { number: "099", commandId: "m2-099-change-enemy-mp", args: { target: "all", value: 4 },
    stored: { target: "all", operation: "set", value: "4" },
    patch: { operation: "add" }, updated: { operation: "add" } },
  { number: "100", commandId: "m2-100-change-enemy-state", args: { target: "all", value: "state_poison" },
    stored: { target: "all", operation: "add", value: "state_poison" },
    patch: { value: "state_sleep" }, updated: { value: "state_sleep" } },
  { number: "101", commandId: "m2-101-enemy-encounter", args: { target: "enemy-1" },
    stored: { target: "enemy-1" }, patch: { target: "enemy_slime" }, updated: { target: "enemy_slime" } },
  { number: "102", commandId: "m2-102-change-battleback", args: { resourceId: "battle-scenery-cave" },
    stored: { resourceId: "battle-scenery-cave" }, patch: { resourceId: "battle-scenery-forest" }, updated: { resourceId: "battle-scenery-forest" } },
  { number: "104", commandId: "m2-104-battle-events", args: { target: CALLED_PAGE },
    stored: { target: CALLED_PAGE, note: "" }, patch: { target: "battle_page_second_wave" }, updated: { target: "battle_page_second_wave" } },
  { number: "105", commandId: "m2-105-abort-battle", args: {},
    stored: { note: "" }, patch: { note: "붕괴하면 중단" }, updated: { note: "붕괴하면 중단" } },
  { number: "107", commandId: "m2-107-force-escape", args: {},
    stored: { note: "" }, patch: { note: "안전 통로로 대피" }, updated: { note: "안전 통로로 대피" } },
  { number: "108", commandId: "m2-108-action-times", args: { target: hero, value: 2 },
    stored: { target: hero, operation: "set", value: "2" }, patch: { value: 3 }, updated: { value: "3" } },
  { number: "218", commandId: "m2-218-move-enemy", args: { x: 140, y: 90 },
    stored: { target: "enemy-1", x: 140, y: 90, durationMs: 400 }, patch: { y: 125 }, updated: { y: 125 } },
];

const fixtures = new Map<"blank" | "built" | "maou", Project>();
function cachedFixture(name: "blank" | "built" | "maou"): Project {
  const cached = fixtures.get(name);
  if (cached) return cached;
  const seed = loadFixture(name);
  fixtures.set(name, seed);
  return seed;
}

function fixture(name: "blank" | "built" | "maou" = "built", commands: Command[] = [original]) {
  const seed = cachedFixture(name);
  // 빈 시드에 맵이 없으면 완성 예제의 지도 구조를 빌린다.
  const built = cachedFixture("built");
  const selectedMap = seed.maps[seed.startMapId] ?? { ...built.maps[built.startMapId]!, events: [] };
  const page = (id: string, commands: Command[]): EventPage => ({
    id, name: id === PAGE ? "연습" : "다른 페이지", trigger: { kind: "action" }, conditions: [], commands,
    graphic: {}, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
  });
  const event = { id: EVENT, name: "전투 연습", x: 1, y: 1, commands: [], trigger: { kind: "action" } as const,
    pages: [page(READ_ONLY_PAGE, [original]), page(PAGE, commands)] };
  const troop = seed.database.troops[0];
  const battlePages = [CALLED_PAGE, "battle_page_second_wave"].map((id, i) => ({
    id, name: `증원 ${i + 1}`, conditions: [], span: "battle" as const, commands: [],
  }));
  const project: Project = {
    ...seed, startMapId: selectedMap.id,
    maps: { ...seed.maps, [selectedMap.id]: { ...selectedMap, events: [...selectedMap.events, event] } },
    database: troop ? { ...seed.database, troops: [{ ...troop, battleEventPages: [...(troop.battleEventPages ?? []), ...battlePages] }, ...seed.database.troops.slice(1)] } : seed.database,
  };
  const target = eventTarget(project, selectedMap.id, EVENT, PAGE);
  const read = (source: Project) => source.maps[selectedMap.id]!.events.find(e => e.id === EVENT)!.pages![1]!.commands;
  return { project, target, read };
}

describe("능력과 전투 명령 한 줄 저작", () => {
  for (const row of cases) {
    const originalM2: M2 = { kind: "m2Command", commandId: row.commandId, fields: row.stored };
    it(`m2.${row.number}.insert는 한 줄을 넣고 한 번에 복원한다`, async () => {
      const { project, target, read } = fixture();
      const { after, sentence } = runPrimitive(project, target, `m2.${row.number}.insert`, row.args);
      expect(jsonEqual(read(after), [original, originalM2])).toBe(true);
      expect(jsonEqual(read(project), [original])).toBe(true);
      expectKoreanSentence(sentence, target);
      await expectUndoRestores(project, after, target);
    });

    it(`m2.${row.number}.update는 바꾼 필드만 갱신하고 한 번에 복원한다`, async () => {
      const { project, target, read } = fixture("built", [originalM2, original]);
      const { after, sentence } = runPrimitive(project, target, `m2.${row.number}.update`, { index: 0, ...row.patch });
      const expected = { ...originalM2, fields: { ...row.stored, ...row.updated } };
      expect(jsonEqual(read(after), [expected, original])).toBe(true);
      expect(jsonEqual(read(project), [originalM2, original])).toBe(true);
      expectKoreanSentence(sentence, target);
      await expectUndoRestores(project, after, target);
    });

    it(`m2.${row.number}는 다른 페이지를 바꾸는 결과를 거절한다`, () => {
      const { project, target } = fixture("built", [originalM2, original]);
      const rejected: Project = { ...project, maps: { ...project.maps } };
      const map = project.maps[project.startMapId]!;
      rejected.maps[map.id] = {
        ...map, events: map.events.map(event => event.id === EVENT
          ? { ...event, pages: [{ ...event.pages![0]!, commands: [] }, event.pages![1]!] }
          : event),
      };
      for (const suffix of ["insert", "update"]) {
        const primitive = PRIMITIVES.find(entry => entry.id === `m2.${row.number}.${suffix}`)!;
        const scope = primitive.scope({ project, target }, { pageId: READ_ONLY_PAGE });
        expect(scope).toEqual({ kind: "eventPage", mapId: map.id, eventId: EVENT, pageId: PAGE });
        expect(checkSmallTaskScope(project, rejected, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
      }
    });
  }

  it("전투 애니메이션과 공통 이벤트 호출은 기존 명령을 가리킨다", () => {
    expect(PRIMITIVES.filter(row => row.aliasOf).map(row => [row.id, row.aliasOf])).toEqual([
      ["m2.103.insert", "cmd.showAnimation.insert"],
      ["m2.106.insert", "cmd.callCommonEvent.insert"],
    ]);
  });

  it("다른 명령 줄을 같은 명령으로 덮어쓸 수 없다", () => {
    const { project, target } = fixture();
    expect(() => runPrimitive(project, target, "m2.022.update", { index: 0, value: "카이" }))
      .toThrow(/같은 종류의 명령/);
  });

  it("해시가 오래된 수정은 같은 종류의 줄이어도 거절한다", () => {
    const row = cases.find(entry => entry.number === "022")!;
    const { project, target } = fixture("built", [{ kind: "m2Command", commandId: row.commandId, fields: row.stored }]);
    expect(() => runPrimitive(project, target, "m2.022.update", { index: 0, expectedHash: "old-hash", value: "하루" }))
      .toThrow(/줄의 내용이 바뀌었습니다/u);
  });

  it("옛 전투 편집기가 저장한 숫자 필드를 호환 형식으로 읽고 고친다", async () => {
    const command: M2 = {
      kind: "m2Command", commandId: "m2-098-change-enemy-hp",
      fields: { target: "enemy-1", operation: "remove", value: 10 },
    };
    const { project, target, read } = fixture("built", [command, original]);
    const { after } = runPrimitive(project, target, "m2.098.update", { index: 0, operation: "set" });
    expect(read(after)).toEqual([{ ...command, fields: { ...command.fields, operation: "set", value: "10" } }, original]);
    await expectUndoRestores(project, after, target);
  });

  it("분기 안에 삽입하고 같은 위치에서 수정해도 옆 분기는 보존한다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [], else: [original] };
    const { project, target, read } = fixture("built", [fork]);
    const path = { branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 0 };
    const first = runPrimitive(project, target, "m2.022.insert", { ...path, value: "카이" }).after;
    const next = runPrimitive(first, target, "m2.022.update", { ...path, value: "봄" }).after;
    expect(jsonEqual(read(next), [{ ...fork, then: [{ kind: "m2Command", commandId: "m2-022-change-actor-name", fields: { target: "", value: "봄" } }] }])).toBe(true);
  });

  it.each([
    ["m2.014.insert", { valueSource: "variable", valueVariableId: "missing_var" }, "변수"],
    ["m2.019.insert", { value: "missing_state" }, "상태"],
    ["m2.022.insert", { target: "missing_actor", value: "카이" }, "주인공"],
    ["m2.024.insert", { value: "missing_charset" }, "그림"],
    ["m2.025.insert", { value: "missing_face" }, "그림"],
    ["m2.091.insert", { value: "missing_class" }, "직업"],
    ["m2.092.insert", { value: "missing_command" }, "전투 명령"],
    ["m2.098.insert", { target: "enemy-999", value: 8 }, "적"],
    ["m2.102.insert", { resourceId: "battle-scenery-missing" }, "그림"],
    ["m2.104.insert", { target: "missing_battle_page" }, "전투 이벤트 페이지"],
  ] as const)("%s는 유효하지 않은 참조를 거절한다", (id, args, message) => {
    const { project, target } = fixture();
    expectRefused(project, target, id, args, new RegExp(message, "u"));
  });
});

describe("저장된 명령 실행", () => {
  it("빈 프로젝트에서 이름을 바꾼다", () => {
    const { project, target } = fixture("blank", []);
    const { after } = runPrimitive(project, target, "m2.022.insert", { target: hero, value: "카이" });
    const { session, step } = runHeadless(after, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(session.actorNames?.[hero]).toBe("카이");
  });

  it("완성 예제에서 변수에 적힌 만큼 공격력 보정을 올린다", () => {
    const { project, target } = fixture("built", []);
    const { after } = runPrimitive(project, target, "m2.014.insert", {
      target: hero, parameter: "attack", valueSource: "variable", valueVariableId: "var_0001",
    });
    const playProject = { ...after, session: { ...after.session, variables: { ...after.session.variables, var_0001: 7 } } };
    const { session, step } = runHeadless(playProject, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(session.actorParamBonuses?.[hero]?.attack).toBe(7);
  });

  it("마왕 편의점 예제에서 선두의 체력을 세 점 깎는다", () => {
    const { project, target } = fixture("maou", []);
    const { after } = runPrimitive(project, target, "m2.021.insert", { target: "party", value: 3 });
    const initial = startSession(project, 1);
    const firstActor = initial.partyActorIds[0]!;
    const before = initial.actorVitals[firstActor]!.hp;
    expect(before).toBeGreaterThan(3);
    const { session, step } = runHeadless(after, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(session.actorVitals[firstActor]!.hp).toBe(before - 3);
  }, 180_000);

  it("적 체력과 추가 행동이 실제 전투 집행기에 반영된다", () => {
    const { project, target, read } = fixture("built", []);
    const first = runPrimitive(project, target, "m2.098.insert", { target: "enemy-1", operation: "remove", value: 17 }).after;
    const after = runPrimitive(first, target, "m2.108.insert", { target: hero, value: 3 }).after;
    const enemies = enemyBattlers(after, after.database.troops[0]!);
    const actors = actorBattlers(after);
    const hp = enemies[0]!.hp;
    const extra: { actorId: string; amount: number }[] = [];
    for (const command of read(after)) {
      const result = executeM2BattleCommand(command as M2, {
        context: { turn: 1 }, enemies, actors,
        addExtraActorAction(actorId, amount) { extra.push({ actorId, amount }); },
      });
      expect(result).toEqual({ handled: true, forceEscape: false });
    }
    expect(enemies[0]!.hp).toBe(Math.max(0, hp - 17));
    expect(extra).toEqual([{ actorId: hero, amount: 3 }]);
  });
});

function corpusFixture(entry: CorpusCase): Project {
  const [, number, action] = entry.primitive.split(".");
  const row = cases.find(candidate => candidate.number === number)!;
  const command: M2 = { kind: "m2Command", commandId: row.commandId, fields: row.stored };
  return fixture(entry.fixture, action === "update" ? [command, original] : [original]).project;
}

// 공용 코퍼스가 픽스처 초기화를 지원할 때 이 자료도 공용 코퍼스로 옮길 수 있다.
describe("기존 명령과 전투 페이지를 둔 자연어 회귀 사례", () => {
  it.each(seededCorpus as CorpusCase[])("$request", async entry => {
    const project = corpusFixture(entry);
    const target = resolveTarget(project, entry.target);
    const apply = () => runPrimitive(project, target, entry.primitive, entry.args);
    if (entry.expectRefusal) {
      expect(apply).toThrow(PrimitiveError);
      return;
    }
    const { after, sentence } = apply();
    expectKoreanSentence(sentence, target);
    for (const check of entry.expect ?? []) expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
    await expectUndoRestores(project, after, target);
  });
});
