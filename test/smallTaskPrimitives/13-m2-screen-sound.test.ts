/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { newM2Command } from "@/editor/eventCommandFactory";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { primitivesForTarget } from "@/editor/smallTask/primitives/registry";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/13-m2-screen-sound";
import { createInterpreter } from "@/player/interpreter";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { DEPRECATED_M2_COMMAND_IDS } from "@/project/eventCommands/m2CatalogData";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { showPictureState, startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { cloneProject, createBlankProjectCopy, eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

type Fixture = "blank" | "built" | "maou";
type Sample = {
  row: string;
  id: string;
  fields: M2CommandFields;
  expected?: M2CommandFields;
  prior?: M2CommandFields;
  swap?: string;
};

const SOUND = "cc0-se-osx-machine-02";
const cases: Sample[] = [
  { row: "044", id: "m2-044-hide-screen", fields: {}, swap: "m2-045-show-screen" },
  { row: "045", id: "m2-045-show-screen", fields: {}, swap: "m2-044-hide-screen" },
  { row: "046", id: "m2-046-tint-screen", fields: { color: "blue", saturation: 80 }, expected: { value: "" }, prior: { color: "red", value: "#ff0000" } },
  { row: "047", id: "m2-047-flash-screen", fields: { color: "#101020", durationMs: 650 } },
  { row: "048", id: "m2-048-shake-screen", fields: { intensity: "6", durationMs: 1000, direction: "vertical" }, expected: { value: 6 } },
  { row: "052", id: "m2-052-move-picture", fields: { pictureId: "pic2", x: 72, y: 45, durationMs: 900, waitForPicture: true } },
  { row: "063", id: "m2-063-memorize-current-bgm", fields: {}, swap: "m2-064-play-memorized-bgm" },
  { row: "064", id: "m2-064-play-memorized-bgm", fields: {}, swap: "m2-063-memorize-current-bgm" },
  { row: "201", id: "m2-201-camera-control", fields: { mode: "follow", targetEventId: "ev_stage_boss", wait: false, durationMs: 700 } },
  { row: "202", id: "m2-202-screen-effect", fields: { effect: "letterbox", value: "12", durationMs: 600 } },
  { row: "210", id: "m2-210-sound-layer", fields: { channel: "ambient", resourceId: SOUND, volume: 35, fadeMs: 900 } },
  { row: "224", id: "m2-224-particle-effect", fields: { preset: "petals", target: "tile", x: 3, y: 4, durationMs: 1300 } },
  { row: "225", id: "m2-225-sprite-look", fields: { target: "event", eventId: "ev_stage_boss", pose: "fallen", opacity: "60" } },
  { row: "226", id: "m2-226-lift-ride", fields: { mode: "arrive", direction: "down", distance: 3, se: SOUND } },
];

const trigger = { kind: "action" } as const;
const prefix: Command = { kind: "text", body: "막이 오릅니다." };
const picture: Command = { kind: "showPicture", pictureId: "pic2", resourceId: "무대 그림", x: 18, y: 20, scale: 60, opacity: 100 };

function stagePage(id: string, commands: Command[]): EventPage {
  return {
    id, name: "무대 연출", conditions: [], graphic: {}, trigger, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
}

const fixtures = new Map<Fixture, Project>();

function fixtureProject(fixture: Fixture): Project {
  const cached = fixtures.get(fixture);
  if (cached) return cached;
  const project = loadFixture(fixture);
  // Match the editor's normalization before runPrimitive freezes the fixture.
  ensureSwitchVariableSlots(project);
  removeLegacySpriteReferences(project);
  fixtures.set(fixture, project);
  return project;
}

beforeAll(() => {
  fixtureProject("maou");
}, 600_000);

function setup(fixture: Fixture, commands: Command[] = [prefix], siblingId = "stage_other") {
  const base = fixtureProject(fixture);
  const blank = base.startMapId && base.maps[base.startMapId] ? base : createBlankProjectCopy();
  const mapId = blank.startMapId;
  const map = base.maps[mapId] ?? blank.maps[mapId]!;
  const page = stagePage("stage_fx", commands);
  const sibling = stagePage(siblingId, [prefix, picture]);
  const event: GameEvent = { id: "ev_stage_fx", name: "무대", x: 1, y: 1, commands: [], trigger, pages: [sibling, page] };
  const boss: GameEvent = { id: "ev_stage_boss", name: "무대 지킴이", x: 2, y: 2, commands: [], trigger, pages: [stagePage("stage_boss", [])] };
  const project: Project = {
    ...base,
    startMapId: mapId,
    mapTree: base.maps[mapId] ? base.mapTree : blank.mapTree,
    maps: { ...base.maps, [mapId]: { ...map, events: [...map.events, event, boss] } },
  };
  const target = eventTarget(project, mapId, event.id, page.id);
  const commandsOf = (project: Project) => project.maps[mapId]!.events.find(e => e.id === event.id)!.pages![1]!.commands;
  return { project, target, commandsOf, mapId, event };
}

function expectedInsert(sample: Sample): Command {
  const base = newM2Command(sample.id);
  if (sample.row === "052") {
    for (const key of ["x", "y", "scale", "opacity"]) delete base.fields[key];
  }
  if (sample.row === "201") delete base.fields.zoom;
  if (sample.row === "224" || sample.row === "225") delete base.fields.eventId;
  return { ...base, fields: { ...base.fields, ...sample.fields, ...sample.expected } };
}

describe.each(cases)("화면·소리 명령 $row", sample => {
  const offset = cases.indexOf(sample);
  const fixture = (["blank", "built", "maou"] as const)[offset % 3]!;

  it("선택한 페이지에 한 줄을 추가하고 한 번에 되돌립니다", async () => {
    const commands = sample.row === "052" ? [prefix, picture] : [prefix];
    const { project, target, commandsOf, event, mapId } = setup(fixture, commands);
    const originalMaps = structuredClone(project.maps);
    const result = runPrimitive(project, target, `m2.${sample.row}.insert`, sample.fields);

    expect(commandsOf(result.after)).toEqual([...commands, expectedInsert(sample)]);
    expectKoreanSentence(result.sentence);
    expect(jsonEqual(project.maps, originalMaps)).toBe(true);
    await expectUndoRestores(project, result.after, target);

    const primitive = PRIMITIVES.find(p => p.id === `m2.${sample.row}.insert`)!;
    const scope = primitive.scope({ project, target }, { pageId: "stage_other" });
    expect(scope).toEqual({ kind: "eventPage", mapId, eventId: event.id, pageId: "stage_fx" });
    const map = result.after.maps[mapId]!;
    const events = map.events.map(entry => entry.id === event.id ? {
      ...entry,
      pages: entry.pages!.map((page, index) => index === 0
        ? { ...page, commands: [...page.commands, expectedInsert(sample)] }
        : page),
    } : entry);
    const outside = { ...result.after, maps: { ...result.after.maps, [mapId]: { ...map, events } } };
    expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it("한 줄만 수정해 기존 필드를 보존하고 한 번에 되돌립니다", async () => {
    const baseRow = newM2Command(sample.swap ?? sample.id);
    if (!sample.swap) baseRow.fields = { ...baseRow.fields, duration: 900, ...sample.prior };
    const preceding = sample.row === "052" ? picture : prefix;
    const { project, target, commandsOf } = setup(fixture, [preceding, baseRow, prefix]);
    const values = { ...sample.fields, index: 1, expectedHash: eventCommandHash(baseRow) };
    const originalMaps = structuredClone(project.maps);
    const result = runPrimitive(project, target, `m2.${sample.row}.update`, values);

    const fields = { ...baseRow.fields, ...sample.fields, ...sample.expected };
    if (sample.row === "224") delete fields.eventId;
    expect(commandsOf(result.after)).toEqual([preceding, sample.swap ? expectedInsert(sample) : { ...baseRow, fields }, prefix]);
    expectKoreanSentence(result.sentence);
    expect(jsonEqual(project.maps, originalMaps)).toBe(true);
    expect(() => runPrimitive(project, target, `m2.${sample.row}.update`, { ...values, index: 0 })).toThrow(STALE_COMMAND_LIST);
    expect(() => runPrimitive(project, target, `m2.${sample.row}.update`, {
      ...values, index: 0, expectedHash: eventCommandHash(preceding),
    })).toThrow(/범위 밖/u);
    await expectUndoRestores(project, result.after, target);
  });
});

it("은퇴한 애니메이션 중복 행의 추가를 한국어로 거절합니다", () => {
  const { project, target } = setup("blank");
  expect(DEPRECATED_M2_COMMAND_IDS["m2-055-show-animation"]?.supersededByKind).toBe("showAnimation");
  expect(PRIMITIVES.some(p => p.id.startsWith("m2.055."))).toBe(false);
  try {
    runPrimitive(project, target, "m2.055.insert", {});
    expect.unreachable("은퇴한 명령을 추가했습니다.");
  } catch (error) {
    expect(error).toBeInstanceOf(PrimitiveError);
    expect((error as Error).message).toMatch(/[가-힣]/u);
  }
});

it.each([
  ["050", "setWeather"], ["054", "showAnimation"], ["066", "playMovie"], ["212", "cutsceneControl"],
])("행 %s을 네이티브 명령에 연결합니다", (row, kind) => {
  expect(PRIMITIVES.find(p => p.id === `m2.${row}.insert`)).toMatchObject({
    aliasOf: `cmd.${kind}.insert`, covers: { m2Ids: row === "054" ? ["m2-054", "m2-055"] : [`m2-${row}`] }, hidden: true,
  });
});

it("연출 종류를 바꿀 때 원래 명령을 확인하고 새 종류의 필드로 교체합니다", () => {
  const old = { ...newM2Command("m2-225-sprite-look"), fields: { pose: "fallen", opacity: "30" } };
  const { project, target, commandsOf } = setup("built", [old, prefix]);
  const args = { index: 0, replaceFrom: "225", expectedHash: eventCommandHash(old), color: "red" };
  const { after } = runPrimitive(project, target, "m2.047.update", args);
  const flash = newM2Command("m2-047-flash-screen");
  expect(commandsOf(after)).toEqual([{ ...flash, fields: { ...flash.fields, color: "red" } }, prefix]);
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, replaceFrom: "046" })).toThrow(/범위 밖/u);
});

it("모습 초기화는 같은 줄에 남아 있던 투명도와 자세를 해제합니다", () => {
  const old = { ...newM2Command("m2-225-sprite-look"), fields: { target: "player", pose: "fallen", opacity: "0" } };
  const { project, target, commandsOf } = setup("blank", [old]);
  const { after } = runPrimitive(project, target, "m2.225.update", { index: 0, expectedHash: eventCommandHash(old), reset: true });
  expect(commandsOf(after)).toEqual([{ ...old, fields: { target: "player", reset: true } }]);
});

it.each([
  ["201", { targetEventId: "missing" }, /대상 이벤트/u],
  ["201", { target: "screen", x: -1, y: 2 }, /범위 밖/u],
  ["201", { mode: "follow", x: 9999 }, /범위 밖/u],
  ["201", { mode: "zoom", durationMs: 60001 }, /형식/u],
  ["201", { mode: "zoom" }, /확대 배율/u],
  ["201", { targetEventId: "ev_stage_boss", x: 2 }, /하나만/u],
  ["210", { resourceId: "missing" }, /소리 자료/u],
  ["210", { resourceId: " " }, /소리 자료/u],
  ["052", { pictureId: "missing" }, /그림 칸을 표시하는 명령/u],
  ["052", { pictureId: " " }, /그림 칸 이름/u],
  ["052", { pictureId: "__proto__" }, /그림 칸 이름/u],
  ["046", { value: "256,0,0" }, /화면 색/u],
  ["202", { effect: "flash", value: "상아빛?" }, /섬광 색/u],
  ["202", { effect: "letterbox", value: "26" }, /0에서 25/u],
  ["202", { effect: "freeze", value: "사파이어" }, /색감/u],
  ["202", { effect: "weather", value: "snow,11" }, /날씨/u],
  ["202", { effect: "doorOpen", value: "1,1,0,2,slide" }, /문 크기|가로·세로 크기/u],
  ["224", { target: "event", eventId: "missing" }, /대상 이벤트/u],
  ["224", { target: "player", eventId: "ev_stage_boss" }, /특정 이벤트/u],
  ["225", { target: "event", eventId: "missing" }, /대상 이벤트/u],
  ["225", { angle: "361" }, /기울기/u],
  ["226", { se: "missing" }, /효과음/u],
  ["226", { se: "" }, /기계음을 끄는 기능/u],
  ["226", { width: 1.5 }, /형식/u],
] as const)("행 %s의 잘못된 입력을 거절합니다", (row, values, message) => {
  const { project, target } = setup("blank");
  expect(() => runPrimitive(project, target, `m2.${row}.insert`, values)).toThrow(message);
});

it("분기 안의 한 줄을 갱신하며 오래된 줄 확인값은 거절합니다", () => {
  const flash = newM2Command("m2-047-flash-screen");
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [flash], else: [prefix] };
  const { project, target, commandsOf } = setup("blank", [fork, prefix]);
  const args = { index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX], color: "red", expectedHash: eventCommandHash(flash) };
  expect(commandsOf(runPrimitive(project, target, "m2.047.insert", { branchPath: args.branchPath }).after)).toEqual([
    { ...fork, then: [flash, flash] }, prefix,
  ]);
  expect(commandsOf(runPrimitive(project, target, "m2.047.update", args).after)).toEqual([
    { ...fork, then: [{ ...flash, fields: { ...flash.fields, color: "red" } }] }, prefix,
  ]);
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, expectedHash: "오래된 값" })).toThrow(STALE_COMMAND_LIST);
  expect(() => runPrimitive(project, target, "m2.047.update", { index: 0, branchPath: args.branchPath, color: "red" })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, branchPath: [0] })).toThrow(/분기 위치/u);
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, branchPath: [0, 99] })).toThrow(/분기/u);
});

it("페이지가 여러 개면 대상에 페이지를 명시해야 합니다", () => {
  const { project, mapId, event } = setup("blank");
  const target = eventTarget(project, mapId, event.id);
  expect(() => runPrimitive(project, target, "m2.047.insert", { color: "red" })).toThrow(SELECT_EVENT_PAGE);
});

it("같은 식별자를 가진 페이지를 골랐으면 편집을 거절합니다", () => {
  const { project, target } = setup("blank", [prefix], "stage_fx");
  const before = cloneProject(project);
  expect(() => runPrimitive(project, target, "m2.047.insert", { color: "red" })).toThrow(/범위 밖.*같은 식별자/u);
  expect(jsonEqual(project, before)).toBe(true);
});

it.each(["030", "056"])("재생 경로가 없는 연출 %s을 숨기고 직접 호출도 거절합니다", row => {
  const old = newM2Command("m2-047-flash-screen");
  const { project, target } = setup("blank", [old]);
  expect(primitivesForTarget(target).some(p => p.id.startsWith(`m2.${row}.`))).toBe(false);
  expect(() => runPrimitive(project, target, `m2.${row}.insert`, {})).toThrow(/게임에서 지원하지 않습니다/u);
  expect(() => runPrimitive(project, target, `m2.${row}.update`, {
    index: 0, expectedHash: eventCommandHash(old), replaceFrom: "047",
  })).toThrow(/게임에서 지원하지 않습니다/u);
});

it("그림을 직접 불러오는 옛 이동 줄은 교체하거나 다른 그림 칸으로 바꿀 수 없습니다", () => {
  const old = { ...newM2Command("m2-052-move-picture"), fields: { pictureId: "legacy", resourceId: "무대 그림" } };
  const { project, target } = setup("blank", [old]);
  const args = { index: 0, expectedHash: eventCommandHash(old) };
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, replaceFrom: "052" })).toThrow(/그림을 불러옵니다/u);
  expect(() => runPrimitive(project, target, "m2.052.update", { ...args, pictureId: "pic2" })).toThrow(/그림을 불러옵니다/u);
});

it("뒤에서 호출한 공용 이벤트의 재생이 읽는 배경 음악 기억 줄을 유지합니다", () => {
  const old = newM2Command("m2-063-memorize-current-bgm");
  const call: Command = { kind: "callCommonEvent", commonEventId: "ce_replay" };
  const branch: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [old] };
  const { project: base, target, commandsOf } = setup("blank", [branch, call]);
  const project: Project = {
    ...base,
    commonEvents: [...base.commonEvents, {
      id: "ce_replay", name: "배경 음악 복원", trigger: "none",
      commands: [newM2Command("m2-064-play-memorized-bgm")],
    }],
  };
  expect(() => runPrimitive(project, target, "m2.064.update", {
    branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 0, expectedHash: eventCommandHash(old),
  })).toThrow(/배경 음악을 다시 재생하는 명령/u);

  const session = startSession(project);
  session.audio = { bgm: { resourceId: SOUND, loop: true, volume: 65 } };
  expect(createInterpreter(commandsOf(project), session, project).start()).toMatchObject({
    kind: "playAudio", channel: "bgm", resourceId: SOUND, volume: 65,
  });
});

it("다른 맵이나 호출하지 않은 공용 이벤트의 배경 음악 재생은 교체를 막지 않습니다", async () => {
  const old = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const { project: base, target, mapId, event, commandsOf } = setup("blank", [old]);
  const project: Project = {
    ...base,
    commonEvents: [...base.commonEvents, { id: "ce_other", name: "다른 음악", trigger: "none", commands: [replay] }],
    maps: { ...base.maps, other_map: {
      ...base.maps[mapId]!, id: "other_map", events: [{ ...event, pages: [stagePage("other_page", [replay])] }],
    } },
  };
  const { after } = runPrimitive(project, target, "m2.064.update", { index: 0, expectedHash: eventCommandHash(old) });
  expect(commandsOf(after)).toEqual([replay]);
  expect(after.commonEvents).toBe(project.commonEvents);
  expect(after.maps.other_map).toBe(project.maps.other_map);
  await expectUndoRestores(project, after, target);
});

it("뒤의 기억 줄이 재생에 쓸 값을 다시 저장하면 첫 줄을 바꿀 수 있습니다", () => {
  const remember = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const { project, target, commandsOf } = setup("blank", [remember, remember, replay]);
  const { after } = runPrimitive(project, target, "m2.047.update", {
    index: 0, replaceFrom: "063", expectedHash: eventCommandHash(remember),
  });
  expect(commandsOf(after)).toEqual([newM2Command("m2-047-flash-screen"), remember, replay]);
});

it("이동 명령이 다음 배경 음악 기억 줄을 건너뛰면 첫 기억 줄을 유지합니다", () => {
  const remember = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const { project, target } = setup("blank", [
    remember, { kind: "gotoLabel", name: "restore" }, remember, { kind: "label", name: "restore" }, replay,
  ]);
  expect(() => runPrimitive(project, target, "m2.047.update", {
    index: 0, replaceFrom: "063", expectedHash: eventCommandHash(remember),
  })).toThrow(/배경 음악을 다시 재생하는 명령/u);
});

it("호출한 공용 이벤트가 배경 음악을 다시 기억하면 첫 기억 줄을 바꿀 수 있습니다", () => {
  const remember = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const call: Command = { kind: "callCommonEvent", commonEventId: "ce_remember" };
  const { project: base, target, commandsOf } = setup("blank", [remember, call, replay]);
  const replace = (commands: Command[]) => runPrimitive({
    ...base, commonEvents: [...base.commonEvents, { id: "ce_remember", name: "배경 음악 갱신", trigger: "none", commands }],
  }, target, "m2.047.update", { index: 0, replaceFrom: "063", expectedHash: eventCommandHash(remember) });

  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [remember] };
  const expected = [newM2Command("m2-047-flash-screen"), call, replay];
  expect(commandsOf(replace([remember]).after)).toEqual(expected);
  expect(commandsOf(replace([{ ...fork, else: [remember] }]).after)).toEqual(expected);
  expect(() => replace([replay, remember])).toThrow(/배경 음악을 다시 재생하는 명령/u);
  expect(() => replace([fork])).toThrow(/배경 음악을 다시 재생하는 명령/u);
});

it("다음 반복에서 재생할 배경 음악을 기억하는 줄을 유지합니다", () => {
  const remember = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const { project, target } = setup("blank", [{ kind: "loop", body: [replay, remember] }]);
  expect(() => runPrimitive(project, target, "m2.064.update", {
    branchPath: [0, LOOP_BODY_BRANCH_INDEX], index: 1, expectedHash: eventCommandHash(remember),
  })).toThrow(/배경 음악을 다시 재생하는 명령/u);
});

it("현재 이벤트나 호출한 공용 이벤트가 실행을 끝내면 그 뒤의 BGM 재생은 교체를 막지 않습니다", () => {
  const remember = newM2Command("m2-063-memorize-current-bgm");
  const replay = newM2Command("m2-064-play-memorized-bgm");
  const end = newM2Command("m2-085-end-event-processing");
  const args = { index: 0, replaceFrom: "063", expectedHash: eventCommandHash(remember) };

  const direct = setup("blank", [remember, end, replay]);
  expect(() => runPrimitive(direct.project, direct.target, "m2.047.update", args)).not.toThrow();
  const beforeEnd = setup("blank", [remember, replay, end]);
  expect(() => runPrimitive(beforeEnd.project, beforeEnd.target, "m2.047.update", args))
    .toThrow(/배경 음악을 다시 재생하는 명령/u);

  const called = setup("blank", [remember, { kind: "callCommonEvent", commonEventId: "ce_end" }, replay]);
  const project: Project = {
    ...called.project, commonEvents: [...called.project.commonEvents, { id: "ce_end", name: "실행 종료", trigger: "none", commands: [end] }],
  };
  const session = startSession(project);
  session.audio = { bgm: { resourceId: SOUND, loop: true } };
  expect(createInterpreter(called.commandsOf(project), session, project).start()).toEqual({ kind: "done" });
  expect(() => runPrimitive(project, called.target, "m2.047.update", args)).not.toThrow();
});

it("카메라를 주인공에게 돌려놓으면 이전 이벤트 참조와 좌표를 지웁니다", () => {
  const old = { ...newM2Command("m2-201-camera-control"), fields: {
    mode: "follow", target: "this-event", targetEventId: "ev_stage_boss", x: 3, y: 4, zoom: 2, wait: false,
  } };
  const { project, target, commandsOf } = setup("blank", [old]);
  const { after } = runPrimitive(project, target, "m2.201.update", {
    index: 0, expectedHash: eventCommandHash(old), mode: "return",
  });
  expect(commandsOf(after)).toEqual([{ ...old, fields: { mode: "return", target: "player", wait: false } }]);
});

it("옛 직접 지정 색이 새로 고른 모습 색을 덮어쓰지 않습니다", () => {
  const old = { ...newM2Command("m2-225-sprite-look"), fields: { target: "player", tint: "red", tintHex: "#ff0000" } };
  const { project, target, commandsOf } = setup("blank", [old]);
  const { after } = runPrimitive(project, target, "m2.225.update", { index: 0, expectedHash: eventCommandHash(old), tint: "blue" });
  expect(commandsOf(after)).toEqual([{ ...old, fields: { target: "player", tint: "blue" } }]);
});

it("검은 띠를 날씨 효과로 바꿀 때 이전 효과의 숫자를 재사용하지 않습니다", () => {
  const old = { ...newM2Command("m2-202-screen-effect"), fields: { effect: "letterbox", value: "15", durationMs: 600 } };
  const { project, target, commandsOf } = setup("blank", [old]);
  const { after } = runPrimitive(project, target, "m2.202.update", { index: 0, expectedHash: eventCommandHash(old), effect: "weather" });
  expect(commandsOf(after)).toEqual([{ ...old, fields: { effect: "weather", value: "", durationMs: 600 } }]);
});

it("승강 발판의 기준점만 맵 안에 있을 때는 거절합니다", () => {
  const { project, target, mapId } = setup("blank");
  expect(() => runPrimitive(project, target, "m2.226.insert", { x: project.maps[mapId]!.width - 1, y: 0, width: 2 })).toThrow(/범위 밖/u);
});

it("옛 승강 발판의 치수는 실행 값으로 검사하고 저장값을 보존합니다", () => {
  const old = { ...newM2Command("m2-226-lift-ride"), fields: { x: 2, y: 2, width: 1.5, depth: 1.5, wait: true } };
  const { project, target, commandsOf } = setup("blank", [old]);
  const args = { index: 0, expectedHash: eventCommandHash(old), wait: false };
  const { after } = runPrimitive(project, target, "m2.226.update", args);
  expect(commandsOf(after)).toEqual([{ ...old, fields: { ...old.fields, wait: false } }]);
  expect(() => runPrimitive(project, target, "m2.226.update", { ...args, width: 1.5 })).toThrow(PrimitiveError);
});

it.each(["party", "none"])("%s 승강 발판의 도착 영역 전체가 맵 안에 있어야 합니다", riders => {
  const { project, target, mapId } = setup("blank");
  const height = project.maps[mapId]!.height;
  const apply = (y: number, direction: "up" | "down") => runPrimitive(project, target, "m2.226.insert", {
    mode: "move", riders, direction, distance: 1, x: 0, y, depth: 2,
  });
  expect(() => apply(0, "up")).toThrow(/범위 밖/u);
  expect(() => apply(height - 2, "down")).toThrow(/범위 밖/u);
  expect(() => apply(height - 3, "down")).not.toThrow();
});

it("그림 이동을 추가하거나 대상을 바꿀 때 이후 줄과 다른 분기의 표시는 인정하지 않습니다", () => {
  const old = { ...newM2Command("m2-052-move-picture"), fields: { pictureId: "old" } };
  const branch: Command = {
    kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [picture], else: [old, picture],
  };
  const { project, target } = setup("blank", [branch]);
  const fields = { branchPath: [0, FORK_ELSE_BRANCH_INDEX], index: 0, pictureId: "pic2", x: 72 };
  expect(() => runPrimitive(project, target, "m2.052.insert", fields)).toThrow(/그림 칸을 표시하는 명령/u);
  expect(() => runPrimitive(project, target, "m2.052.update", { ...fields, expectedHash: eventCommandHash(old) }))
    .toThrow(/그림 칸을 표시하는 명령/u);
});

it("앞서 표시한 그림이라도 실행할 수 있는 분기에서 지우면 이동을 거절합니다", () => {
  const branch: Command = {
    kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [{ kind: "erasePicture", pictureId: "pic2" }],
  };
  const { project, target } = setup("blank", [picture, branch]);
  expect(() => runPrimitive(project, target, "m2.052.insert", { pictureId: "pic2", x: 72 }))
    .toThrow(/그림 칸을 표시하는 명령/u);
});

it("이동 명령으로 건너뛴 그림 표시는 인정하지 않습니다", () => {
  const { project, target } = setup("blank", [
    { kind: "gotoLabel", name: "move" }, picture, { kind: "label", name: "move" },
  ]);
  expect(() => runPrimitive(project, target, "m2.052.insert", { pictureId: "pic2", x: 72 }))
    .toThrow(/그림 칸을 표시하는 명령/u);
});

it("조건의 양쪽 분기에서 같은 그림 칸을 표시하면 뒤에서 이동할 수 있습니다", () => {
  const branch: Command = {
    kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [picture], else: [picture],
  };
  const { project, target, commandsOf } = setup("blank", [branch]);
  const { after } = runPrimitive(project, target, "m2.052.insert", { pictureId: "pic2", x: 72 });
  expect(commandsOf(after).at(-1)).toMatchObject({ kind: "m2Command", commandId: "m2-052-move-picture" });

  const optional = setup("blank", [{ ...branch, else: undefined }]);
  expect(() => runPrimitive(optional.project, optional.target, "m2.052.insert", { pictureId: "pic2", x: 72 }))
    .toThrow(/그림 칸을 표시하는 명령/u);
});

it("반복 중 그림이 지워지면 매회 다시 표시한 뒤에만 이동할 수 있습니다", () => {
  const erase: Command = { kind: "erasePicture", pictureId: "pic2" };
  const move = { branchPath: [1, LOOP_BODY_BRANCH_INDEX], pictureId: "pic2", x: 72 };
  const missing = setup("blank", [picture, { kind: "loop", body: [erase] }]);
  expect(() => runPrimitive(missing.project, missing.target, "m2.052.insert", { ...move, index: 0 }))
    .toThrow(/그림 칸을 표시하는 명령/u);

  const redisplayed = setup("blank", [picture, { kind: "loop", body: [picture, erase] }]);
  expect(() => runPrimitive(redisplayed.project, redisplayed.target, "m2.052.insert", { ...move, index: 1 })).not.toThrow();
});

it("반복문을 빠져나간 뒤에는 탈출 전에 표시한 그림만 이동할 수 있습니다", () => {
  const erase: Command = { kind: "erasePicture", pictureId: "pic2" };
  const stop: Command = { kind: "breakLoop" };
  const move = { pictureId: "pic2", x: 72 };
  const missing = setup("blank", [picture, { kind: "loop", body: [erase, stop, picture] }]);
  expect(() => runPrimitive(missing.project, missing.target, "m2.052.insert", move)).toThrow(/그림 칸을 표시하는 명령/u);

  const displayed = setup("blank", [{ kind: "loop", body: [picture, stop, erase] }]);
  expect(() => runPrimitive(displayed.project, displayed.target, "m2.052.insert", move)).not.toThrow();
});

describe("저장한 연출 명령의 헤드리스 실행", () => {
  function insert(row: string, args: Record<string, unknown>) {
    const { project, target, commandsOf } = setup("blank", []);
    const { after } = runPrimitive(project, target, `m2.${row}.insert`, args);
    return { after, commands: commandsOf(after) };
  }

  it("빨간 섬광이 지정한 시간 동안 재생됩니다", () => {
    const { after, commands } = insert("047", { color: "red", durationMs: 650 });
    expect(createInterpreter(commands, startSession(after)).start()).toEqual({
      kind: "flashScreen", red: 255, green: 0, blue: 0, durationMs: 650,
    });
  });

  it("세로 흔들기의 시간과 강도가 모두 전달됩니다", () => {
    const { after, commands } = insert("048", { direction: "vertical", durationMs: 1000, intensity: "6" });
    expect(createInterpreter(commands, startSession(after)).start()).toEqual({
      kind: "shakeScreen", direction: "vertical", durationMs: 1000, intensity: 6,
    });
  });

  it("카메라가 같은 맵의 지정한 이벤트를 따라갑니다", () => {
    const { after, commands } = insert("201", { mode: "follow", targetEventId: "ev_stage_boss", durationMs: 800, wait: false });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "cameraControl", mode: "follow", target: { kind: "event", eventId: "ev_stage_boss" }, durationMs: 800, wait: false,
    });
  });

  it("카메라의 확대 배율을 전달합니다", () => {
    const { after, commands } = insert("201", { mode: "zoom", zoom: 2 });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "cameraControl", zoom: 2,
    });
  });

  it("카메라에 맵의 왼쪽 위 칸을 좌표로 지정할 수 있습니다", () => {
    const { after, commands } = insert("201", { x: 0, y: 0 });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "cameraControl", target: { kind: "position", x: 0, y: 0 },
    });
  });

  it("카메라를 원위치로 돌릴 때 기본 배율은 플레이어가 정합니다", () => {
    const { after, commands } = insert("201", { mode: "return" });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "cameraControl", mode: "return", zoom: undefined,
    });
  });

  it("꽃잎이 지정한 맵 칸에 표시됩니다", () => {
    const { after, commands } = insert("224", { preset: "petals", target: "tile", x: 3, y: 4, sizePercent: 150, wait: true });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "particleEffect", preset: "petals", target: { kind: "tile", x: 3, y: 4 }, sizePercent: 150, wait: true,
    });
  });

  it("소리 겹치기로 지정한 음량과 전환 시간이 전달됩니다", () => {
    const { after, commands } = insert("210", { channel: "ambient", resourceId: SOUND, volume: 35, fadeMs: 900 });
    expect(createInterpreter(commands, startSession(after)).start()).toMatchObject({
      kind: "playAudio", channel: "ambient", resourceId: SOUND, loop: true, volume: 35, fadeInMs: 900,
    });
  });

  it("그림을 가로로 옮겨도 세로 위치와 크기, 투명도가 이어집니다", () => {
    const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 0 }, then: [] };
    const { project, target, commandsOf } = setup("blank", [picture, fork]);
    const { after } = runPrimitive(project, target, "m2.052.insert", {
      branchPath: [1, FORK_THEN_BRANCH_INDEX], pictureId: "pic2", x: 72, durationMs: 900, waitForPicture: true,
    });
    const session = startSession(after);
    const interpreter = createInterpreter(commandsOf(after), session);
    const display = interpreter.start();
    expect(display).toMatchObject({ kind: "showPicture", x: 18 });
    if (display.kind !== "showPicture") throw new Error("그림 표시를 재생하지 않았습니다.");
    showPictureState(session, display);
    expect(interpreter.resume(undefined)).toMatchObject({
      kind: "showPicture", pictureId: "pic2", resourceId: "무대 그림", x: 72, y: 20, scale: 60, opacity: 100, durationMs: 900,
    });
  });
});
