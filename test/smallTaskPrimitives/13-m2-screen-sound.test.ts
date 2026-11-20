/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { newM2Command } from "@/editor/eventCommandFactory";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/13-m2-screen-sound";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { DEPRECATED_M2_COMMAND_IDS } from "@/project/eventCommands/m2CatalogData";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

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
  { row: "030", id: "m2-030-change-screen-transition", fields: { value: "fade" }, prior: { value: "none" } },
  { row: "044", id: "m2-044-hide-screen", fields: {}, swap: "m2-045-show-screen" },
  { row: "045", id: "m2-045-show-screen", fields: {}, swap: "m2-044-hide-screen" },
  { row: "046", id: "m2-046-tint-screen", fields: { color: "blue", saturation: 80 }, expected: { value: "" }, prior: { color: "red", value: "#ff0000" } },
  { row: "047", id: "m2-047-flash-screen", fields: { color: "#101020", durationMs: 650 } },
  { row: "048", id: "m2-048-shake-screen", fields: { intensity: "6", durationMs: 1000, direction: "vertical" }, expected: { value: 6 } },
  { row: "052", id: "m2-052-move-picture", fields: { pictureId: "pic2", x: 72, y: 45, durationMs: 900, waitForPicture: true } },
  { row: "056", id: "m2-056-flash-event", fields: { target: "ev_stage_boss", color: "green" }, expected: { value: "green" } },
  { row: "063", id: "m2-063-memorize-current-bgm", fields: {}, swap: "m2-064-play-memorized-bgm" },
  { row: "064", id: "m2-064-play-memorized-bgm", fields: {}, swap: "m2-063-memorize-current-bgm" },
  { row: "201", id: "m2-201-camera-control", fields: { mode: "follow", targetEventId: "ev_stage_boss", wait: false, durationMs: 700 } },
  { row: "202", id: "m2-202-screen-effect", fields: { effect: "letterbox", value: "12", durationMs: 600 } },
  { row: "210", id: "m2-210-sound-layer", fields: { channel: "ambient", resourceId: SOUND, volume: 35, fadeMs: 900 } },
  { row: "224", id: "m2-224-particle-effect", fields: { preset: "petals", target: "tile", x: 3, y: 4, durationMs: 1300 } },
  { row: "225", id: "m2-225-sprite-look", fields: { target: "event", eventId: "ev_stage_boss", pose: "fallen", opacity: "60" } },
  { row: "226", id: "m2-226-lift-ride", fields: { mode: "arrive", direction: "down", distance: 3, se: "" } },
];

const trigger = { kind: "action" } as const;
const prefix: Command = { kind: "text", body: "막이 오릅니다." };

function stagePage(id: string, commands: Command[]): EventPage {
  return {
    id, name: "무대 연출", conditions: [], graphic: {}, trigger, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
}

const fixtures = new Map<Fixture, Project>();

beforeAll(() => {
  fixtures.set("maou", loadFixture("maou"));
}, 300_000);

function setup(fixture: Fixture, commands: Command[] = [prefix]) {
  if (!fixtures.has(fixture)) fixtures.set(fixture, loadFixture(fixture));
  const base = fixtures.get(fixture)!;
  const blank = base.startMapId && base.maps[base.startMapId] ? base : createBlankProject();
  const mapId = blank.startMapId;
  const map = base.maps[mapId] ?? blank.maps[mapId]!;
  const page = stagePage("stage_fx", commands);
  const sibling = stagePage("stage_other", [prefix]);
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
    delete base.fields.scale;
    delete base.fields.opacity;
  }
  return { ...base, fields: { ...base.fields, ...sample.fields, ...sample.expected } };
}

describe.each(cases)("화면·소리 명령 $row", sample => {
  const offset = cases.indexOf(sample);
  const fixture = (["blank", "built", "maou"] as const)[offset % 3]!;

  it("선택한 페이지에 한 줄을 추가하고 한 번에 되돌립니다", async () => {
    const { project, target, commandsOf, event, mapId } = setup(fixture);
    const originalMaps = structuredClone(project.maps);
    const result = runPrimitive(project, target, `m2.${sample.row}.insert`, sample.fields);

    expect(commandsOf(result.after)).toEqual([prefix, expectedInsert(sample)]);
    expectKoreanSentence(result.sentence);
    expect(jsonEqual(project.maps, originalMaps)).toBe(true);
    await expectUndoRestores(project, result.after, target);

    const primitive = PRIMITIVES.find(p => p.id === `m2.${sample.row}.insert`)!;
    const scope = primitive.scope({ project, target }, { pageId: "stage_other" });
    expect(scope).toEqual({ kind: "eventPage", mapId, eventId: event.id, pageId: "stage_fx" });
    const outside = { ...result.after, maps: structuredClone(result.after.maps) };
    outside.maps[mapId]!.events.find(e => e.id === event.id)!.pages![0]!.commands.push(expectedInsert(sample));
    expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it("한 줄만 수정해 기존 필드를 보존하고 한 번에 되돌립니다", async () => {
    const baseRow = newM2Command(sample.swap ?? sample.id);
    if (!sample.swap) baseRow.fields = { ...baseRow.fields, duration: 900, ...sample.prior };
    const { project, target, commandsOf } = setup(fixture, [prefix, baseRow, prefix]);
    const values = { ...sample.fields, index: 1, expectedHash: eventCommandHash(baseRow) };
    const originalMaps = structuredClone(project.maps);
    const result = runPrimitive(project, target, `m2.${sample.row}.update`, values);

    expect(commandsOf(result.after)).toEqual([prefix, sample.swap ? expectedInsert(sample) : {
      ...baseRow, fields: { ...baseRow.fields, ...sample.fields, ...sample.expected },
    }, prefix]);
    expectKoreanSentence(result.sentence);
    expect(jsonEqual(project.maps, originalMaps)).toBe(true);
    expect(() => runPrimitive(project, target, `m2.${sample.row}.update`, { ...values, index: 0 })).toThrow(/범위 밖/u);
    await expectUndoRestores(project, result.after, target);
  });
});

it("은퇴한 애니메이션 중복 행의 추가를 한국어로 거절합니다", () => {
  const { project, target } = setup("blank");
  expect(DEPRECATED_M2_COMMAND_IDS["m2-055-show-animation"]?.supersededBy).toBe("m2-054-show-animation");
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
  const { after } = runPrimitive(project, target, "m2.225.update", { index: 0, reset: true });
  expect(commandsOf(after)).toEqual([{ ...old, fields: { target: "player", reset: true } }]);
});

it.each([
  ["056", { target: "missing" }, /대상 이벤트/u],
  ["201", { targetEventId: "missing" }, /대상 이벤트/u],
  ["201", { target: "screen", x: -1, y: 2 }, /범위 밖/u],
  ["210", { resourceId: "missing" }, /소리 자료/u],
  ["224", { target: "event", eventId: "missing" }, /대상 이벤트/u],
  ["225", { target: "event", eventId: "missing" }, /대상 이벤트/u],
  ["226", { se: "missing" }, /효과음/u],
] as const)("행 %s의 잘못된 참조를 거절합니다", (row, values, message) => {
  const { project, target } = setup("blank");
  expect(() => runPrimitive(project, target, `m2.${row}.insert`, values)).toThrow(message);
});

it("분기 안의 한 줄을 갱신하며 오래된 줄 확인값은 거절합니다", () => {
  const flash = newM2Command("m2-047-flash-screen");
  const fork: Command = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [flash], else: [prefix] };
  const { project, target, commandsOf } = setup("blank", [fork, prefix]);
  const args = { index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX], color: "red", expectedHash: eventCommandHash(flash) };
  expect(commandsOf(runPrimitive(project, target, "m2.047.update", args).after)).toEqual([
    { ...fork, then: [{ ...flash, fields: { ...flash.fields, color: "red" } }] }, prefix,
  ]);
  expect(() => runPrimitive(project, target, "m2.047.update", { ...args, expectedHash: "오래된 값" })).toThrow(/내용이 바뀌었습니다/u);
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

  it("그림의 크기와 투명도는 위치만 옮길 때 이어집니다", () => {
    const { after, commands } = insert("052", { pictureId: "pic2", x: 72, y: 45, durationMs: 900, waitForPicture: true });
    const session = startSession(after);
    session.pictures = {
      pic2: { pictureId: "pic2", resourceId: "무대 그림", x: 18, y: 20, scale: 60, opacity: 100 },
    };
    expect(createInterpreter(commands, session).start()).toMatchObject({
      kind: "showPicture", pictureId: "pic2", resourceId: "무대 그림", x: 72, y: 45, scale: 60, opacity: 100, durationMs: 900,
    });
  });
});
