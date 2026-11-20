/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { HEROES_CHARSET_ASSETS } from "@/assets/heroesCharsets";
import { SHARED_PORTRAIT_ASSETS } from "@/assets/sharedPortraitAssets";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { getPrimitive, primitivesForTarget } from "@/editor/smallTask/primitives/registry";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/10-m2-actor-battle";
import { ROWS, validateFields } from "@/editor/smallTask/primitives/units/10-m2-actor-battle/fields";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { APPLY_SMALL_TASK_PRIMITIVE, runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { commandPanel, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import { resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { store } from "@/project/store";
import type { Command, EventPage, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { dbTarget, eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, runHeadless } from "./harness";
import seededCorpus from "./10-m2-actor-battle/seeded-corpus.json";

const EVENT = "ev_actor_battle_test";
const PAGE = "pg_actor_battle_test";
const READ_ONLY_PAGE = "pg_actor_battle_other";
const CALLED_PAGE = "battle_page_reinforcements";
const hero = "actor_hero";
const original: Command = { kind: "text", body: "그대로 있는 대사." };
const battleOnly = new Set(["098", "099", "100", "101", "102", "104", "105", "107", "108", "218"]);

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
    stored: { target: "actor", actorId: hero, operation: "add", value: "cmd_defend" }, patch: { operation: "remove" }, updated: { operation: "remove" } },
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
  // Match editor normalization before primitives freeze the fixture's shared data.
  ensureSwitchVariableSlots(seed);
  removeLegacySpriteReferences(seed);
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
    const expectedHash = eventCommandHash(originalM2);
    if (battleOnly.has(row.number)) {
      it(`m2.${row.number}는 맵 이벤트의 동작 목록에서 숨기고 직접 호출도 거절한다`, () => {
        const { project, target, read } = fixture("built", [originalM2, original]);
        const insert = `m2.${row.number}.insert`;
        const update = `m2.${row.number}.update`;
        const offered = primitivesForTarget(target).map(primitive => primitive.id);
        expect(offered).not.toContain(insert);
        expect(offered).not.toContain(update);
        expectRefused(project, target, insert, row.args, /맵 이벤트에서 실행되지/u);
        expectRefused(project, target, update, { index: 0, expectedHash, ...row.patch }, /맵 이벤트에서 실행되지/u);
        expect(read(project)).toEqual([originalM2, original]);
      });
      continue;
    }

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
      const { after, sentence } = runPrimitive(project, target, `m2.${row.number}.update`, { index: 0, expectedHash, ...row.patch });
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

  it("자료집의 적 그룹 선택으로 전투 이벤트 페이지 범위를 대신할 수 없다", () => {
    const { project } = fixture();
    const troop = project.database.troops[0]!;
    const target = dbTarget(project, "troops", troop.id);
    expectRefused(project, target, "m2.104.insert", { target: CALLED_PAGE });
  });

  it.each([98, 99, 108])("m2.%i의 예전 숫자 필드를 카탈로그 문자열로 읽는다", number => {
    const { project } = fixture();
    const previous = { target: number === 108 ? hero : "all", value: 4, operation: "set" };
    const patch = { operation: "add" };
    const fields = { ...previous, ...patch };
    validateFields(project, ROWS[number]!, fields, patch, previous);
    expect(fields).toEqual({ target: previous.target, value: "4", operation: "add" });
    expect(previous.value).toBe(4);
  });

  for (const [alias, canonical, args, stored] of [
    ["m2.103.insert", "cmd.showAnimation.insert", { animationId: "review_animation" }, { kind: "showAnimation", animationId: "review_animation" }],
    ["m2.106.insert", "cmd.callCommonEvent.insert", { index: 1, commonEventId: "review_common_event" }, { kind: "callCommonEvent", commonEventId: "review_common_event" }],
  ] as const) {
    it.runIf(getPrimitive(canonical) !== undefined)(`${alias}가 합류한 정본 명령을 실행한다`, async () => {
      const { project: baseline, target, read } = fixture();
      const animation = baseline.database.battleAnimations[0]!;
      const project: Project = {
        ...baseline,
        commonEvents: [...baseline.commonEvents, { id: "review_common_event", name: "공용 호출", trigger: "none", commands: [] }],
        database: {
          ...baseline.database,
          battleAnimations: [...baseline.database.battleAnimations, { ...animation, id: "review_animation", name: "빛" }],
        },
      };
      expect(getPrimitive(alias)).toBe(getPrimitive(canonical));
      const { after } = runPrimitive(project, target, alias, { ...args });
      expect(read(after)).toEqual([original, expect.objectContaining(stored)]);
      await expectUndoRestores(project, after, target);
    });
  }

  it("다른 명령 줄을 같은 명령으로 덮어쓸 수 없다", () => {
    const { project, target } = fixture();
    expectRefused(project, target, "m2.022.update", { index: 0, expectedHash: eventCommandHash(original), value: "카이" }, /이 종류의 명령/u);
  });

  it("같은 종류의 다른 줄의 해시나 해시가 없는 수정은 거절한다", () => {
    const row = cases.find(entry => entry.number === "022")!;
    const first: M2 = { kind: "m2Command", commandId: row.commandId, fields: row.stored };
    const second: M2 = { ...first, fields: { ...first.fields, value: "새봄" } };
    const { project, target, read } = fixture("built", [first, second]);
    const args = { index: 1, value: "하루" };
    expectRefused(project, target, "m2.022.update", args, /값의 형식/u);
    expect(() => runPrimitive(project, target, "m2.022.update", { ...args, expectedHash: eventCommandHash(first) }))
      .toThrow(STALE_COMMAND_LIST);
    expectRefused(project, target, "m2.022.update", { index: 1, expectedHash: eventCommandHash(second) }, /바꿀 값을/u);
    expect(read(project)).toEqual([first, second]);
  });

  it("인자로 읽기 전용 페이지를 지정해도 선택 대상을 바꿀 수 없다", () => {
    const { project, target } = fixture();
    expectRefused(project, target, "m2.022.insert", { pageId: READ_ONLY_PAGE, value: "하루" }, /값의 형식/u);
  });

  it("페이지가 여러 개면 편집기에서 고른 페이지가 필요하다", () => {
    const { project, target } = fixture();
    const eventOnly = eventTarget(project, target.mapId, target.eventId);
    expect(() => runPrimitive(project, eventOnly, "m2.022.insert", { value: "하루" })).toThrow(SELECT_EVENT_PAGE);
  });

  it("맵 저장 키와 내부 식별자가 다르면 다른 맵에 쓰지 않는다", () => {
    const { project, target } = fixture();
    const map = project.maps[target.mapId]!;
    const other = { ...map, id: "another_map" };
    const malformed = { ...project, maps: { ...project.maps, [target.mapId]: other, [other.id]: other } };
    expectRefused(malformed, target, "m2.022.insert", { value: "하루" }, /이벤트를 담은 맵/u);
  });

  it("이벤트 읽기에서 받은 위치와 해시로 분기 안의 줄만 고친다", async () => {
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [], else: [original] };
    const { project, target, read } = fixture("built", [fork]);
    const path = { branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 0 };
    const first = runPrimitive(project, target, "m2.022.insert", { ...path, value: "카이" }).after;
    const ctx = { project: first, assistantRun: true, smallTaskTarget: target };
    const result = await runToolAsync(ctx, "get_event", { mapId: target.mapId, eventId: target.eventId, includeCommandHashes: true });
    expect(result.ok, result.summary).toBe(true);
    const { commandHashes } = result.data as {
      commandHashes: { pageId: string; commands: { index: number; branchPath: number[]; hash: string }[] }[];
    };
    const row = commandHashes.find(page => page.pageId === PAGE)!.commands.find(row => jsonEqual(row.branchPath, path.branchPath))!;
    expect(row).toMatchObject(path);
    await expect(runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, {
      id: "m2.022.update", args: { index: row.index, branchPath: row.branchPath, expectedHash: row.hash, value: "봄" },
    })).resolves.toMatchObject({ ok: true });
    expect(read(ctx.project)).toEqual([{ ...fork, then: [{ kind: "m2Command", commandId: "m2-022-change-actor-name", fields: { target: "", value: "봄" } }] }]);
  });

  it.each([
    [{ branchPath: [0] }, /분기 위치/u],
    [{ branchPath: [0, -33] }, /명령 분기를/u],
    [{ index: 2 }, /명령 줄을/u],
    [{ index: Number.MAX_SAFE_INTEGER + 1 }, /값의 형식/u],
  ] as const)("없는 명령 위치를 거절한다 (%j)", (args, reason) => {
    const { project, target } = fixture();
    expectRefused(project, target, "m2.022.insert", { ...args, value: "카이" }, reason);
  });

  it.each([
    ["m2.014.insert", { valueSource: "variable", valueVariableId: "missing_var" }, "변수"],
    ["m2.019.insert", { value: "missing_state" }, "상태"],
    ["m2.022.insert", { target: "missing_actor", value: "카이" }, "주인공"],
    ["m2.022.insert", { target: hero, value: "  " }, "이름을 입력"],
    ["m2.022.insert", { target: hero, value: "가".repeat(13) }, "값의 형식"],
    ["m2.023.insert", { target: hero, value: "별명\n다음 줄" }, "값의 형식"],
    ["m2.024.insert", { value: "missing_charset" }, "그림"],
    ["m2.024.insert", { value: "tex_easyrpg_charset_actor1#8" }, "여덟째"],
    ["m2.024.insert", { value: "", characterIndex: 2 }, "먼저 걷기 그림"],
    ["m2.025.insert", { value: "missing_face" }, "그림"],
    ["m2.091.insert", { value: "missing_class" }, "직업"],
    ["m2.092.insert", { value: "missing_command" }, "전투 명령"],
    ["m2.021.insert", { value: Number.MAX_SAFE_INTEGER + 1 }, "값의 형식"],
  ] as const)("%s는 유효하지 않은 참조를 거절한다", (id, args, message) => {
    const { project, target } = fixture();
    expectRefused(project, target, id, args, new RegExp(message, "u"));
  });

  it("걷기 그림으로 등록되지 않은 스프라이트를 거절한다", () => {
    const { project, target } = fixture();
    const id = "non_charset_sprite";
    const assets: Project["assets"] = {
      ...project.assets,
      uploaded: { ...project.assets.uploaded, [id]: { id, name: "다른 그림", kind: "sprite", meta: {} } },
    };
    expectRefused({ ...project, assets }, target, "m2.024.insert", { target: hero, value: id }, /그림을 찾을/u);
  });

  it("전투 명령 교체 목록이 비어 있으면 실제로 읽는 단일 명령을 검사한다", () => {
    const command: M2 = {
      kind: "m2Command", commandId: "m2-092-change-battle-commands",
      fields: { target: "actor", actorId: hero, operation: "set", slots: " , ", value: "missing_command" },
    };
    const { project, target } = fixture("built", [command]);
    expectRefused(project, target, "m2.092.update", { index: 0, expectedHash: eventCommandHash(command), target: hero }, /전투 명령/u);
  });

  it("주인공의 직업에만 있는 명령도 전투 메뉴에 지정할 수 있다", () => {
    const { project, target } = fixture("built", []);
    const actor = project.database.actors.find(record => record.id === hero)!;
    const command = { id: "class_only_defense", name: "철벽", kind: "defend" } as const;
    const database = {
      ...project.database,
      classes: project.database.classes.map(record => record.id === actor.classId
        ? { ...record, battleCommands: [...record.battleCommands, command] } : record),
    };
    const { after } = runPrimitive({ ...project, database }, target, "m2.092.insert", {
      target: hero, operation: "set", value: command.id,
    });
    const { session } = runHeadless(after, target.mapId, target.eventId);
    expect(session.actorBattleCommands?.[hero]).toEqual([command.id]);
    expect(battleCommandsForActor(after, hero, { overrideCommandIds: session.actorBattleCommands?.[hero] }))
      .toEqual([expect.objectContaining({ id: command.id, kind: "defend" })]);
  });

  it("전직한 직업의 전용 명령을 쓰고 이전 직업 명령으로 덮어쓰지 않는다", async () => {
    const { project, target } = fixture("built", []);
    const actor = project.database.actors.find(record => record.id === hero)!;
    const nextClass = project.database.classes.find(record => record.id !== actor.classId)!;
    const oldCommand = { id: "old_class_command", name: "수비", kind: "defend" } as const;
    const newCommand = { id: "new_class_command", name: "전술", kind: "skill" } as const;
    const database = {
      ...project.database,
      classes: project.database.classes.map(record => record.id === actor.classId
        ? { ...record, battleCommands: [oldCommand] }
        : record.id === nextClass.id ? { ...record, battleCommands: [newCommand] } : record),
    };
    const setCommand = (source: Project, value: string) => runPrimitive(source, target, "m2.092.insert", {
      target: hero, operation: "set", value,
    }).after;
    const beforeChange = setCommand({ ...project, database }, oldCommand.id);
    const changed = runPrimitive(beforeChange, target, "m2.091.insert", { target: hero, value: nextClass.id }).after;
    const battleMenu = (source: Project) => {
      const { session } = runHeadless(source, target.mapId, target.eventId);
      expect(session.classOverrides?.[hero]).toBe(nextClass.id);
      return battleCommandsForActor(source, hero, {
        classId: session.classOverrides?.[hero], overrideCommandIds: session.actorBattleCommands?.[hero],
      });
    };
    // 이미 세션에 저장된 옛 직업 명령과 전직 뒤 새로 실행한 옛 직업 명령을 모두 검사한다.
    expect(battleMenu(changed)).toEqual([newCommand]);
    const withNew = setCommand(changed, newCommand.id);
    expect(runHeadless(withNew, target.mapId, target.eventId).session.actorBattleCommands?.[hero]).toEqual([newCommand.id]);
    const after = setCommand(withNew, oldCommand.id);
    expect(battleMenu(after)).toEqual([newCommand]);
    await expectUndoRestores(changed, withNew, target);
  });

  it.each(["gauge", "strict"] as const)("마지막 전투 명령을 빼면 %s 메뉴의 대기로 차례를 진행한다", async battleFlow => {
    const { project, target } = fixture("built", []);
    const actor = project.database.actors.find(record => record.id === hero)!;
    const command = { id: "last_guard", name: "철벽", kind: "defend" } as const;
    const database = {
      ...project.database,
      classes: project.database.classes.map(record => record.id === actor.classId
        ? { ...record, battleCommands: [command] } : record),
    };
    const { after } = runPrimitive({ ...project, database }, target, "m2.092.insert", {
      target: hero, operation: "remove", value: command.id,
    });
    const { session } = runHeadless(after, target.mapId, target.eventId);
    expect(session.actorBattleCommands?.[hero]).toEqual([]);
    expect(battleCommandsForActor(after, hero, { overrideCommandIds: session.actorBattleCommands?.[hero] })).toEqual([]);
    session.partyActorIds = [hero];
    store.replaceProject(after);
    const runtime = createBattleRuntime({
      project: after, troopId: after.database.troops[0]!.id, sessionState: session,
      battleFlow, canLose: true, canEscape: false, rng: () => 0.5,
    });
    try {
      for (let step = 0; step < 10 && runtime.snapshot().phase === "charging"; step += 1) runtime.tick(10_000);
      const snapshot = runtime.snapshot();
      expect(snapshot.phase).toBe("actorCommand");
      expect(snapshot.activeActorId).toBe(hero);
      const panel = commandPanel(snapshot, {
        runtime, submenu: null, setSubmenu() {}, setDirectorState() {}, render() {},
        runActorCommand: command => runtime.performActorCommand(command),
        beginTargetCommand() {}, confirmTargetSelection() {},
      });
      expect(panel.querySelector('[data-testid="actor-command-defend"]')).toBeNull();
      const pass = panel.querySelector<HTMLButtonElement>('[data-testid="actor-command-pass"]');
      expect(pass?.textContent).toContain("대기");
      pass!.click();
      const advanced = runtime.snapshot();
      expect(advanced.timeline).toContainEqual(expect.objectContaining({ commandKind: "pass" }));
      expect(actorCommandDirectorState({ kind: "pass" }, snapshot, advanced).lines)
        .toEqual([expect.stringContaining("차례를 넘겼다.")]);
    } finally {
      runtime.cancel();
    }
    await expectUndoRestores(project, after, target);
  });

  it.each([false, true])("장비 스킬 메뉴에서 실행 가능한 기술이 있는지 확인한다 (%s)", canUseSkill => {
    const { project: source } = fixture("built", []);
    const skillIds = ["skill_test_rune_one", "skill_test_rune_two"];
    const equipment = normalizeEquipmentRecord({
      id: "equip_test_runes", name: "룬 검", slot: "weapon", equippableActorIds: [hero],
      grantsSkillIds: skillIds, grantsCommand: { id: "cmd_test_runes", name: "룬 기술", kind: "skill" },
    });
    const baseSkill = source.database.skills.find(skill => skill.id === "skill_attack")!;
    const expensive = { flat: 100_000, percentMax: 0 };
    const project: Project = { ...source, database: {
      ...source.database,
      equipment: [...source.database.equipment, equipment],
      skills: [
        ...source.database.skills.map(skill => ({ ...skill, mpCost: expensive })),
        ...skillIds.map((id, index) => ({ ...baseSkill, id, mpCost: canUseSkill && index === 0 ? { flat: 0, percentMax: 0 } : expensive })),
      ],
    } };
    const session = startSession(project);
    session.partyActorIds = [hero];
    session.actorEquipment[hero] = { weapon: equipment.id };
    session.actorBattleCommands = { [hero]: [] };
    store.replaceProject(project);
    const runtime = createBattleRuntime({
      project, troopId: project.database.troops[0]!.id, sessionState: session,
      battleFlow: "strict", canLose: true, canEscape: false, rng: () => 0.5,
    });
    try {
      const snapshot = runtime.snapshot();
      expect(snapshot.phase).toBe("actorCommand");
      let submenu: BattleCommandSubmenu = null;
      const panel = () => commandPanel(snapshot, {
        runtime, submenu, setSubmenu(value) { submenu = value; }, setDirectorState() {}, render() {},
        runActorCommand() {}, beginTargetCommand() {}, confirmTargetSelection() {},
      });
      const root = panel();
      root.querySelector<HTMLButtonElement>('[data-testid="actor-command-cmd_test_runes"]')!.click();
      expect(submenu).toMatchObject({ kind: "skill" });
      const choices = panel();
      expect(choices.querySelector(`[data-testid="actor-skill-${skillIds[0]}"]`)?.getAttribute("aria-disabled"))
        .toBe(canUseSkill ? null : "true");
      expect(choices.querySelector(`[data-testid="actor-skill-${skillIds[1]}"]`)?.getAttribute("aria-disabled")).toBe("true");
      expect(Boolean(root.querySelector('[data-testid="actor-command-pass"]'))).toBe(!canUseSkill);
    } finally {
      runtime.cancel();
    }
  });

  it("예전의 주인공 직접 지정 줄을 수정해도 전투 메뉴가 해당 주인공에게만 바뀐다", () => {
    const command: M2 = {
      kind: "m2Command", commandId: "m2-092-change-battle-commands",
      fields: { target: hero, operation: "set", value: "", slots: "cmd_attack,cmd_item" },
    };
    const { project, target, read } = fixture("built", [command]);
    const { after } = runPrimitive(project, target, "m2.092.update", {
      index: 0, expectedHash: eventCommandHash(command), value: "cmd_defend",
    });
    expect(read(after)).toEqual([{ ...command, fields: { target: "actor", actorId: hero, operation: "set", value: "cmd_defend" } }]);
    const { session } = runHeadless(after, target.mapId, target.eventId);
    expect(session.actorBattleCommands).toEqual({ [hero]: ["cmd_defend"] });

    const toParty = runPrimitive(after, target, "m2.092.update", {
      index: 0, expectedHash: eventCommandHash(read(after)[0]!), target: "party",
    }).after;
    expect(read(toParty)).toEqual([{ ...command, fields: { target: "party", operation: "set", value: "cmd_defend" } }]);
  });
});

describe("저장된 명령 실행", () => {
  it("빈 프로젝트에서 이름을 바꾼다", () => {
    const { project, target } = fixture("blank", []);
    const { after } = runPrimitive(project, target, "m2.022.insert", { target: hero, value: "카이" });
    const { session, step } = runHeadless(after, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(session.actorNames?.[hero]).toBe("카이");
    expect(after.database).toBe(project.database);
    expect(after.commonEvents).toBe(project.commonEvents);
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

  it("변수를 쓰던 능력치 줄에 고정 숫자를 주면 플레이에서도 그 숫자를 쓴다", () => {
    const { project, target, read } = fixture("built", []);
    const first = runPrimitive(project, target, "m2.014.insert", {
      target: hero, parameter: "attack", valueVariableId: "var_0001",
    }).after;
    const { after } = runPrimitive(first, target, "m2.014.update", {
      index: 0, expectedHash: eventCommandHash(read(first)[0]!), value: 12,
    });
    expect(read(after)[0]).toMatchObject({ fields: { value: 12, valueSource: "number", valueVariableId: "" } });
    const { session, step } = runHeadless(after, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(session.actorParamBonuses?.[hero]?.attack).toBe(12);
  });

  it("공용 걷기 시트와 공용 흉상을 골라 플레이에 반영한다", () => {
    const { project, target } = fixture("built", []);
    const sheet = HEROES_CHARSET_ASSETS[0]!;
    const portrait = SHARED_PORTRAIT_ASSETS[0]!;
    const first = runPrimitive(project, target, "m2.024.insert", { target: hero, value: `charset:${sheet.textureKey}:3` }).after;
    const { after } = runPrimitive(first, target, "m2.025.insert", { target: hero, value: portrait.id });
    const { session, step } = runHeadless(after, target.mapId, target.eventId);
    expect(step).toEqual({ kind: "done" });
    expect(resolvePlayerSpriteResource(after, session)).toMatchObject({ resourceId: sheet.id, characterIndex: 3 });
    const actor = project.database.actors.find(record => record.id === hero)!;
    expect(resolveActorFaceResourceId(session, actor, after)).toBe(portrait.id);
  });

  it.each<M2CommandFields>([
    { value: "tex_easyrpg_charset_actor1", characterIndex: 4 },
    { value: "tex_easyrpg_charset_actor1#4" },
    { value: "charset:tex_easyrpg_charset_actor1:4" },
  ])("걷기 시트만 바꿀 때 기존 인물 칸을 보존한다 (%j)", async fields => {
    const command: M2 = { kind: "m2Command", commandId: "m2-024-change-actor-graphic", fields: { target: hero, ...fields } };
    const { project, target, read } = fixture("built", [command]);
    const sheet = HEROES_CHARSET_ASSETS.find(asset => asset.textureKey !== "tex_easyrpg_charset_actor1")!;
    const { after } = runPrimitive(project, target, "m2.024.update", {
      index: 0, expectedHash: eventCommandHash(command), value: sheet.textureKey,
    });
    const { session } = runHeadless(after, target.mapId, target.eventId);
    expect(resolvePlayerSpriteResource(after, session)).toMatchObject({ resourceId: sheet.id, characterIndex: 4 });
    const cleared = runPrimitive(after, target, "m2.024.update", {
      index: 0, expectedHash: eventCommandHash(read(after)[0]!), value: "",
    }).after;
    expect(read(cleared)).toEqual([{ ...command, fields: { target: hero, value: "" } }]);
    await expectUndoRestores(project, after, target);
  });
});

function corpusFixture(entry: CorpusCase) {
  const [, number, action] = entry.primitive.split(".");
  const row = cases.find(candidate => candidate.number === number)!;
  const command: M2 = { kind: "m2Command", commandId: row.commandId, fields: row.stored };
  const { project } = fixture(entry.fixture, action === "update" ? [command, original] : [original]);
  const args = action === "update" ? { expectedHash: eventCommandHash(command), ...entry.args } : entry.args;
  return { project, args };
}

// 공용 코퍼스가 픽스처 초기화를 지원할 때 이 자료도 공용 코퍼스로 옮길 수 있다.
describe("기존 명령을 둔 요청과 맵에서 쓸 수 없는 전투 명령 요청", () => {
  it.each(seededCorpus as CorpusCase[])("$request", async entry => {
    const { project, args } = corpusFixture(entry);
    const target = resolveTarget(project, entry.target);
    const apply = () => runPrimitive(project, target, entry.primitive, args);
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
