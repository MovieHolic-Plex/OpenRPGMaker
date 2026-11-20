/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { newM2Command } from "@/editor/eventCommandFactory";
import { normalizeEventPage } from "@/editor/eventPages";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/12-m2-map-move";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject, ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { startSession } from "@/project/session";
import type { Command, GameEvent, M2CommandFields, Project } from "@/project/types";
import corpusJson from "../../harness-data/small-task-corpus/12-m2-map-move.json";
import { eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const HOST = "map_move_host";
const OTHER = "map_move_other";
const PAGE = "map_move_page";
const REGION = "map_move_region";
const VARIABLES = {
  location: "map_move_location",
  map: "map_move_map",
  x: "map_move_x",
  y: "map_move_y",
};
const SWITCH = "map_move_arrived";
const GRAPHIC = "easyrpg-charset-vehicles";
const BACKDROP = "oprn-pano-sky-day";
const TAIL = { kind: "text", body: "기존 명령입니다." } as const;

type FixtureName = Parameters<typeof loadFixture>[0];
type EditArgs = Record<string, unknown>;
type Row = {
  id: string;
  fixture: FixtureName;
  command: string;
  insert: EditArgs | ((project: Project) => EditArgs);
  stored: M2CommandFields | ((project: Project) => M2CommandFields);
  update: EditArgs;
  changed: M2CommandFields;
  bad?: EditArgs;
};

const cases: readonly Row[] = [
  { id: "026", fixture: "blank", command: "change-vehicle-graphic", insert: { vehicle: "ship", value: GRAPHIC },
    stored: { vehicle: "ship", value: GRAPHIC }, update: { vehicle: "airship" }, changed: { vehicle: "airship" }, bad: { value: "없는-그림" } },
  { id: "036", fixture: "blank", command: "get-player-location", insert: { variableId: VARIABLES.location },
    stored: { variableId: VARIABLES.location }, update: { variableId: VARIABLES.x }, changed: { variableId: VARIABLES.x }, bad: { variableId: "없는-변수" } },
  { id: "037", fixture: "built", command: "move-to-variable-location", insert: { mapVariableId: VARIABLES.map, xVariableId: VARIABLES.x, yVariableId: VARIABLES.y },
    stored: { mapVariableId: VARIABLES.map, xVariableId: VARIABLES.x, yVariableId: VARIABLES.y },
    update: { xVariableId: VARIABLES.y, yVariableId: VARIABLES.x }, changed: { xVariableId: VARIABLES.y, yVariableId: VARIABLES.x }, bad: { mapVariableId: "없는-변수" } },
  { id: "038", fixture: "maou", command: "get-on-off-vehicle", insert: { boarded: true },
    stored: { boarded: "true" }, update: { boarded: false }, changed: { boarded: "false" }, bad: { boarded: "일단 보류" } },
  { id: "039", fixture: "blank", command: "set-vehicle-location", insert: { vehicle: "raft", x: 2, y: 3 },
    stored: project => ({ vehicle: "raft", mapId: project.startMapId, x: 2, y: 3 }),
    update: { x: 4 }, changed: { x: 4 }, bad: { mapId: "없는-맵" } },
  { id: "040", fixture: "blank", command: "set-event-location", insert: { x: 2, y: 3 },
    stored: project => ({ target: HOST, mapId: project.startMapId, x: 2, y: 3 }),
    update: { target: OTHER, x: 4 }, changed: { target: OTHER, x: 4 }, bad: { target: "없는-이벤트" } },
  { id: "041", fixture: "built", command: "swap-event-location", insert: { eventB: OTHER },
    stored: { eventA: HOST, eventB: OTHER }, update: { eventA: OTHER, eventB: HOST },
    changed: { eventA: OTHER, eventB: HOST }, bad: { eventB: "없는-이벤트" } },
  { id: "042", fixture: "maou", command: "get-terrain-id", insert: { variableId: VARIABLES.location, x: 2, y: 3 },
    stored: { variableId: VARIABLES.location, x: 2, y: 3 }, update: { x: 4 }, changed: { x: 4 }, bad: { x: 99999 } },
  { id: "043", fixture: "blank", command: "get-event-id", insert: { variableId: VARIABLES.location, x: 2, y: 3 },
    stored: { variableId: VARIABLES.location, x: 2, y: 3 }, update: { x: 4 }, changed: { x: 4 }, bad: { variableId: "없는-변수" } },
  { id: "049", fixture: "built", command: "scroll-map", insert: { direction: "right", distance: 3, wait: false },
    stored: { direction: "right", distance: 3, wait: "false" }, update: { mode: "lock", speed: 5 },
    changed: { mode: "lock", speed: 5 }, bad: { distance: -3 } },
  { id: "058", fixture: "maou", command: "wait-for-all-movement", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "059", fixture: "blank", command: "stop-all-movement", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "068", fixture: "built", command: "change-tileset", insert: project => ({ value: project.maps[project.startMapId].tilesetId }),
    stored: project => ({ value: project.maps[project.startMapId].tilesetId }), update: { value: "tiles_map_move" },
    changed: { value: "tiles_map_move" }, bad: { value: "없는-타일셋" } },
  { id: "069", fixture: "maou", command: "change-parallax-back", insert: { resourceId: BACKDROP },
    stored: { resourceId: BACKDROP }, update: { flowPercent: 0, flowDurationMs: 1000 },
    changed: { flowPercent: 0, flowDurationMs: 1000 }, bad: { resourceId: "없는-배경" } },
  { id: "070", fixture: "blank", command: "set-encounter-rate", insert: { value: 0 }, stored: { value: 0 },
    update: { value: 8 }, changed: { value: 8 }, bad: { value: -1 } },
  { id: "085", fixture: "built", command: "end-event-processing", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "086", fixture: "maou", command: "erase-event", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "203", fixture: "blank", command: "spawn-event", insert: { prefabId: OTHER, x: 2, y: 3 },
    stored: { prefabId: OTHER, eventId: `${OTHER}_spawn`, x: 2, y: 3 }, update: { eventId: "map_move_copy", y: 5 },
    changed: { eventId: "map_move_copy", y: 5 }, bad: { prefabId: "없는-원본" } },
  { id: "204", fixture: "built", command: "remove-event", insert: {}, stored: { eventId: HOST },
    update: { eventId: OTHER }, changed: { eventId: OTHER }, bad: { eventId: "없는-이벤트" } },
  { id: "205", fixture: "maou", command: "pathfind-move", insert: { x: 2, y: 3 },
    stored: { x: 2, y: 3 }, update: { xSource: "variable", xVariableId: VARIABLES.x, resultSwitchId: SWITCH },
    changed: { xSource: "variable", xVariableId: VARIABLES.x, resultSwitchId: SWITCH }, bad: { xSource: "variable", xVariableId: "없는-변수" } },
  { id: "207", fixture: "blank", command: "region-trigger", insert: { regionId: REGION, switchId: SWITCH },
    stored: { regionId: REGION, switchId: SWITCH }, update: { action: "exit" },
    changed: { action: "exit" }, bad: { regionId: "없는-구역" } },
];

const fixtureCache = new Map<FixtureName, Project>();

function testFixture(name: FixtureName): Project {
  let project = fixtureCache.get(name);
  if (!project) {
    project = loadFixture(name);
    fixtureCache.set(name, project);
  }
  return project;
}

function seed(name: FixtureName, commands: Command[] = [TAIL]) {
  const project = cloneProjectSharingSharedDictionaries(testFixture(name));
  if (!project.startMapId) {
    const { startMapId, startPos, mapTree, maps } = createBlankProject();
    Object.assign(project, { startMapId, startPos, mapTree, maps });
  }
  const map = project.maps[project.startMapId];
  const event: GameEvent = {
    id: HOST, name: "문지기", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [normalizeEventPage({ id: PAGE, name: "첫 페이지", commands })],
  };
  map.events = [...map.events, event, {
    id: OTHER, name: "안내원", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
  }];
  map.locations = [...(map.locations ?? []), { id: REGION, name: "문 앞", x: 1, y: 1, w: 2, h: 2 }];
  project.variables = [...project.variables, ...Object.entries(VARIABLES).map(([key, id]) => ({
    id, name: ({ location: "위치", map: "맵", x: "가로", y: "세로" })[key] ?? "값",
  }))];
  project.switches = [...project.switches, { id: SWITCH, name: "도착" }];
  project.tilesets = {
    ...project.tilesets,
    tiles_map_move: { ...project.tilesets[map.tilesetId], id: "tiles_map_move", name: "새 그림 세트", referenceDocuments: [] },
  };
  ensureSwitchVariableSlots(project);
  return { project, map, target: eventTarget(project, map.id, HOST, PAGE) };
}

function commandsOf(project: Project) {
  return project.maps[project.startMapId].events.find(event => event.id === HOST)!.pages![0].commands;
}

function checkSentence(sentence: string, target: Parameters<typeof runPrimitive>[1]) {
  expectKoreanSentence(sentence, target);
  expect(sentence).toMatch(/^[^.!?]+\.$/u);
  expect(sentence).not.toMatch(/m2[-.]|map_move/u);
}

function expectedCommand(row: Row, project: Project) {
  const command = newM2Command(`m2-${row.id}-${row.command}`);
  const stored = typeof row.stored === "function" ? row.stored(project) : row.stored;
  return { ...command, fields: { ...command.fields, ...stored } };
}

describe.each(cases)("지도·이동 명령 $id", (row) => {
  // Building the flagship takes about a minute. Load it once, outside the per-edit timer.
  beforeAll(() => { testFixture(row.fixture); }, 120_000);

  it("선택한 페이지에만 정확한 줄을 넣고 한 번 되돌린다", async () => {
    const { project, target, map } = seed(row.fixture);
    const before = commandsOf(project).slice();
    const args = typeof row.insert === "function" ? row.insert(project) : row.insert;
    const id = `m2.${row.id}.insert`;
    const result = runPrimitive(project, target, id, args);
    checkSentence(result.sentence, target);
    expect(commandsOf(result.after)).toEqual([TAIL, expectedCommand(row, project)]);
    expect(commandsOf(project)).toEqual(before);
    const primitive = PRIMITIVES.find(candidate => candidate.id === id)!;
    expect(() => runPrimitive(project, mapTarget(project, map.id)!, id, args)).toThrow(/범위 밖/u);
    const escaped = {
      ...result.after,
      maps: { ...result.after.maps, [map.id]: { ...result.after.maps[map.id], name: "범위 밖 수정" } },
    };
    const attempted = checkSmallTaskScope(project, escaped, primitive.scope({ project, target }, args));
    expect(attempted.ok).toBe(false);
    if (!attempted.ok) expect(attempted.reason).toContain("범위 밖");
    if (row.bad) expect(() => runPrimitive(project, target, id, { ...args, ...row.bad })).toThrow(/[가-힣]/u);
    await expectUndoRestores(project, result.after, target);
  });

  it("같은 종류의 줄만 고치고 나머지 명령을 보존한다", async () => {
    const { project, target } = seed(row.fixture);
    const command = expectedCommand(row, project);
    commandsOf(project).unshift(command);
    const id = `m2.${row.id}.update`;
    const args = { index: 0, ...row.update };
    const result = runPrimitive(project, target, id, args);
    checkSentence(result.sentence, target);
    expect(commandsOf(result.after)).toEqual([{ ...command, fields: { ...command.fields, ...row.changed } }, TAIL]);
    expect(commandsOf(project)).toEqual([command, TAIL]);
    expect(() => runPrimitive(project, target, id, { ...args, index: 1 })).toThrow(/[가-힣]/u);
    if (row.bad) expect(() => runPrimitive(project, target, id, { ...args, ...row.bad })).toThrow(/[가-힣]/u);
    await expectUndoRestores(project, result.after, target);
  });
});

it("중첩된 선택지의 한 줄을 고치고 옛 이동 변수 키와 다른 분기를 보존한다", async () => {
  const { project, target } = seed("blank", [{
    kind: "choices",
    options: [
      { text: "이동", branch: [{
        kind: "m2Command", commandId: "m2-037-move-to-variable-location",
        fields: { mapId: VARIABLES.map, x: VARIABLES.x, y: VARIABLES.y },
      }] },
      { text: "제자리", branch: [TAIL] },
    ],
  }]);
  const { after } = runPrimitive(project, target, "m2.037.update", { index: 0, branchPath: [0, 0], xVariableId: VARIABLES.y });
  expect(commandsOf(after)).toEqual([{
    kind: "choices",
    options: [
      { text: "이동", branch: [{
        kind: "m2Command", commandId: "m2-037-move-to-variable-location",
        fields: { mapId: VARIABLES.map, x: VARIABLES.x, y: VARIABLES.y, xVariableId: VARIABLES.y },
      }] },
      { text: "제자리", branch: [TAIL] },
    ],
  }]);
  await expectUndoRestores(project, after, target);
});

it("그림을 생략한 먼 배경 흐름 조절을 허용한다", () => {
  const { project, target } = seed("blank", []);
  const { after } = runPrimitive(project, target, "m2.069.insert", { flowPercent: 0 });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { resourceId: "", flowPercent: 0 } });
});

it("다른 수정으로 오래된 명령 해시를 받으면 그 줄을 바꾸지 않는다", () => {
  const { project, target } = seed("blank", [newM2Command("m2-070-set-encounter-rate")]);
  expect(() => runPrimitive(project, target, "m2.070.update", {
    index: 0, value: 12, expectedHash: "stale",
  })).toThrow("그 줄의 내용이 바뀌었습니다");
});

type SeededCorpusCase = CorpusCase & { setup?: { commands: Command[] } };
const corpus = corpusJson as readonly SeededCorpusCase[];

describe("지도·이동 요청 코퍼스", () => {
  it.each(corpus)("$request", entry => {
    let before = testFixture(entry.fixture);
    const target = resolveTarget(before, entry.target);
    if (entry.setup) {
      if (target.kind !== "event") throw new Error("시드 명령을 넣을 이벤트가 필요합니다.");
      const map = before.maps[target.mapId];
      before = { ...before, maps: { ...before.maps, [map.id]: { ...map, events: map.events.map(event => {
        if (event.id !== target.eventId) return event;
        return { ...event, pages: event.pages?.map(page => page.id === target.pageId
          ? { ...page, commands: [...entry.setup!.commands, ...page.commands] } : page) };
      }) } } };
    }
    const run = () => runPrimitive(before!, target, entry.primitive, entry.args, entry.selection);
    if (entry.expectRefusal) {
      expect(run).toThrow(PrimitiveError);
      return;
    }
    const { after, sentence } = run();
    checkSentence(sentence, target);
    expect(entry.expect?.length).toBeGreaterThan(0);
    for (const check of entry.expect ?? []) {
      const value = readCheckPath(after, check.at);
      if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
      if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
    }
  });
});

function interpret(id: string, args: EditArgs = {}, commandAfter: Command[] = []) {
  const { project, target, map } = seed("blank", commandAfter);
  const { after } = runPrimitive(project, target, id, { index: 0, ...args });
  const session = startSession(after, 7);
  const interpreter = createInterpreter(commandsOf(after), session, after, { currentEventId: HOST });
  expect(session.currentMapId).toBe(map.id);
  return { after, interpreter, session };
}

it("삽입한 명령이 실제 주인공 칸을 변수에 기록한다", () => {
  const { interpreter, session } = interpret("m2.036.insert", { variableId: VARIABLES.location });
  session.x = 5;
  session.y = 7;
  expect(interpreter.start().kind).toBe("done");
  expect(session.variables[`${VARIABLES.location}_x`]).toBe(5);
  expect(session.variables[`${VARIABLES.location}_y`]).toBe(7);
});

it("삽입한 이벤트 위치 교환이 실제 두 런타임 위치를 맞바꾼다", () => {
  const { interpreter, session, after } = interpret("m2.041.insert", { eventB: OTHER });
  expect(interpreter.start()).toEqual({ kind: "relocateEvents", eventIds: [HOST, OTHER] });
  expect(session.eventLocations?.[HOST]).toMatchObject({ mapId: after.startMapId, x: 2, y: 3 });
  expect(session.eventLocations?.[OTHER]).toMatchObject({ mapId: after.startMapId, x: 1, y: 1 });
});

it("삽입한 종료 명령 뒤의 기존 대사는 실행하지 않는다", () => {
  const { interpreter } = interpret("m2.085.insert", {}, [TAIL]);
  expect(interpreter.start().kind).toBe("done");
});

it("삽입한 전체 이동 대기가 호스트에 대기 단계를 넘긴다", () => {
  const { interpreter } = interpret("m2.058.insert");
  expect(interpreter.start()).toEqual({ kind: "waitForAllMovement" });
});

it("복제한 이벤트를 다음 줄에서 제거하도록 저작할 수 있다", () => {
  const { project, target } = seed("blank", []);
  const resources = { prefabId: OTHER, x: 2, y: 3 };
  const { after: spawned } = runPrimitive(project, target, "m2.203.insert", resources);
  const { after } = runPrimitive(spawned, target, "m2.204.insert", { eventId: `${OTHER}_spawn` });
  const session = startSession(after, 7);
  const interpreter = createInterpreter(commandsOf(after), session, after, { currentEventId: HOST });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(interpreter.start()).toEqual({ kind: "spawnEvent", eventId: `${OTHER}_spawn` });
    expect(session.spawnedEvents?.[`${OTHER}_spawn`]).toMatchObject({ templateEventId: OTHER, x: 2, y: 3 });
    expect(interpreter.resume(undefined)).toEqual({ kind: "removeEvent", eventId: `${OTHER}_spawn` });
    expect(session.spawnedEvents?.[`${OTHER}_spawn`]).toBeUndefined();
  } finally {
    warn.mockRestore();
  }
});
