/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { newM2Command } from "@/editor/eventCommandFactory";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX, resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { normalizeEventPage } from "@/editor/eventPages";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/12-m2-map-move";
import { mapTarget } from "@/editor/smallTask/target";
import { QUERY_TOOLS } from "@/editor/tools/queryTools";
import { APPLY_SMALL_TASK_PRIMITIVE, runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject, ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { runtimeEventViewById } from "@/project/runtimeEventState";
import { EMPTY_SCRIPT_EFFECTS } from "@/project/script/types";
import { startSession } from "@/project/session";
import type { Command, GameEvent, M2CommandFields, Project } from "@/project/types";
import corpusJson from "../../harness-data/small-task-corpus/12-m2-map-move.json";
import seededCorpusJson from "./12-m2-map-move/seeded-corpus.json";
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
  { id: "069", fixture: "maou", command: "change-parallax-back", insert: { resourceId: BACKDROP, flowPercent: 100 },
    stored: { resourceId: BACKDROP }, update: { flowPercent: 0, flowDurationMs: 1000 },
    changed: { flowPercent: 0, flowDurationMs: 1000 }, bad: { resourceId: "없는-배경" } },
  { id: "070", fixture: "blank", command: "set-encounter-rate", insert: { value: 0 }, stored: { value: 0 },
    update: { value: 8 }, changed: { value: 8 }, bad: { value: -1 } },
  { id: "085", fixture: "built", command: "end-event-processing", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "086", fixture: "maou", command: "erase-event", insert: {}, stored: {}, update: {}, changed: {} },
  { id: "203", fixture: "blank", command: "spawn-event", insert: { prefabId: OTHER, x: 2, y: 3 },
    stored: { prefabId: OTHER, eventId: `${OTHER}_spawn`, x: 2, y: 3 }, update: { eventId: "map_move_copy", y: 5 },
    changed: { eventId: "map_move_copy", y: 5 }, bad: { prefabId: "없는-원본" } },
  { id: "204", fixture: "built", command: "remove-event", insert: {}, stored: { eventId: "" },
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
    const args = { index: 0, expectedHash: eventCommandHash(command), ...row.update };
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
  const { after } = runPrimitive(project, target, "m2.037.update", {
    index: 0, branchPath: [0, 0], expectedHash: eventCommandHash(resolveCommandAtPath(commandsOf(project), [0, 0, 0])!),
    xVariableId: VARIABLES.y,
  });
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
  const command = newM2Command("m2-070-set-encounter-rate");
  const { project, target } = seed("blank", [command, TAIL]);
  for (const [index, expectedHash] of [[0, "stale"], [1, eventCommandHash(command)], [2, eventCommandHash(command)]] as const) {
    expect(() => runPrimitive(project, target, "m2.070.update", { index, value: 12, expectedHash }))
      .toThrow(STALE_COMMAND_LIST);
  }
  expect(commandsOf(project)).toEqual([command, TAIL]);
});

it("작은 일에서 읽은 해시로 해당 줄만 고치고 오래됐거나 해시가 없으면 거절한다", async () => {
  const old = newM2Command("m2-070-set-encounter-rate");
  const another = { ...old, fields: { value: 10 } };
  const { project, target, map } = seed("blank", [another, old]);
  expect(() => runPrimitive(project, target, "m2.070.update", { index: 0, value: 12 })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "m2.070.update", {
    index: 0, value: 12, expectedHash: eventCommandHash(old),
  })).toThrow(STALE_COMMAND_LIST);
  const read = QUERY_TOOLS.find(tool => tool.name === "get_event")!;
  const lookup = await read.run(project, { mapId: map.id, eventId: HOST, includeCommandHashes: true });
  const { commandHashes } = lookup.data as { commandHashes: { pageId: string; commands: { index: number; hash: string }[] }[] };
  const chosen = commandHashes.find(page => page.pageId === PAGE)!.commands[1];
  const ctx = { project, smallTaskTarget: target };
  await runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, {
    id: "m2.070.update", args: { index: chosen.index, value: 12, expectedHash: chosen.hash },
  });
  expect(commandsOf(ctx.project)).toEqual([another, { ...old, fields: { value: 12 } }]);
});

it("없는 분기나 목록 끝을 넘어가는 위치에 명령을 넣지 않는다", () => {
  const { project, target } = seed("blank", [TAIL]);
  for (const args of [{ branchPath: [0] }, { branchPath: [0, 0] }, { index: 2 }]) {
    expect(() => runPrimitive(project, target, "m2.058.insert", args)).toThrow(PrimitiveError);
  }
  expect(commandsOf(project)).toEqual([TAIL]);
});

it("고른 분기와 페이지에만 쓰고 다른 페이지·조건·이벤트는 보존한다", () => {
  const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: SWITCH, value: true }, then: [], else: [TAIL] };
  const { project, map, target } = seed("blank", [fork]);
  const host = map.events.find(event => event.id === HOST)!;
  host.pages![0].conditions = [{ kind: "switch", switchId: SWITCH, value: true }];
  host.pages!.push(normalizeEventPage({ id: "other-page", name: "다른 페이지", commands: [TAIL] }));
  const args = { branchPath: [0, FORK_THEN_BRANCH_INDEX] };
  expect(() => runPrimitive(project, eventTarget(project, map.id, HOST), "m2.058.insert", args))
    .toThrow(SELECT_EVENT_PAGE);
  const { after } = runPrimitive(project, target, "m2.058.insert", args);
  const afterMap = after.maps[map.id];
  const afterHost = afterMap.events.find(event => event.id === HOST)!;
  expect(afterHost.pages).toEqual([
    { ...host.pages![0], commands: [{ ...fork, then: [newM2Command("m2-058-wait-for-all-movement")] }] },
    host.pages![1],
  ]);
  expect(afterMap.events.find(event => event.id === OTHER)).toBe(map.events.find(event => event.id === OTHER));
  const primitive = PRIMITIVES.find(row => row.id === "m2.058.insert")!;
  const scope = primitive.scope({ project, target }, args);
  const escaped = structuredClone(after);
  escaped.maps[map.id].events.find(event => event.id === HOST)!.pages![0].conditions = [];
  expect(checkSmallTaskScope(project, escaped, scope).ok).toBe(false);
  expect(() => runPrimitive(project, target, "m2.058.insert", { ...args, pageId: "other-page" })).toThrow(PrimitiveError);
});

it("좌표만 수정할 때 대상이 비어 있으면 이동 대상을 선택하도록 안내한다", () => {
  const command = { ...newM2Command("m2-040-set-event-location"), fields: { target: "", x: 1, y: 2 } };
  const { project, target } = seed("blank", [command]);
  const args = { index: 0, expectedHash: eventCommandHash(command), x: 3 };
  expect(() => runPrimitive(project, target, "m2.040.update", args)).toThrow("이벤트를 선택해 주세요");
  const { after } = runPrimitive(project, target, "m2.040.update", { ...args, target: "this-event" });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { target: HOST, x: 3, y: 2 } });
});

it("다른 맵에 있는 이벤트와 교환할 수 있으며 양쪽 맵의 저작 위치는 보존한다", () => {
  const { project, target, map } = seed("blank", []);
  const other = map.events.find(event => event.id === OTHER)!;
  map.events = map.events.filter(event => event !== other);
  project.maps.remote = { ...map, id: "remote", name: "항구", events: [other] };
  const { after } = runPrimitive(project, target, "m2.041.insert", { eventB: OTHER });
  expect(after.maps.remote).toBe(project.maps.remote);
  const session = startSession(after, 7);
  expect(createInterpreter(commandsOf(after), session, after).start()).toMatchObject({ kind: "relocateEvents", eventIds: [HOST, OTHER] });
  expect(session.eventLocations).toMatchObject({
    [HOST]: { mapId: "remote", x: other.x, y: other.y },
    [OTHER]: { mapId: map.id, x: 1, y: 1 },
  });
});

it("공백만 있는 구역 동작 대상이나 좌표 결과 기록처는 거절한다", () => {
  const { project, target } = seed("blank");
  expect(() => runPrimitive(project, target, "m2.207.insert", { regionId: REGION, switchId: "  " })).toThrow("앞뒤 공백");
  expect(() => runPrimitive(project, target, "m2.205.insert", { resultSwitchId: "  " })).toThrow("앞뒤 공백");
});

it("가로 좌표에 변수만 지정하면 실행할 때 변수를 읽고, 고정 축이 맵 밖이면 거절한다", () => {
  const args = { xVariableId: VARIABLES.x, y: 3 };
  const { interpreter, session } = interpret("m2.205.insert", args);
  session.variables[VARIABLES.x] = 5;
  expect(interpreter.start()).toMatchObject({ kind: "pathfindMove", x: 5, y: 3 });
  const { project, map, target } = seed("blank");
  expect(() => runPrimitive(project, target, "m2.205.insert", { ...args, y: map.height })).toThrow("좌표가 맵 범위 밖");
  expect(() => runPrimitive(project, target, "m2.205.insert", { ...args, xSource: "fixed", xVariableId: "없는-변수" }))
    .toThrow("좌표 변수를 찾을 수 없습니다");
  expect(() => runPrimitive(project, target, "m2.205.insert", { xSource: "variable", xVariableId: "" }))
    .toThrow(/변수를/u);
});

it("중첩된 길찾기의 숫자 좌표로 해당 축만 전환하고 이전 변수 모드로 되돌린다", async () => {
  const command = {
    ...newM2Command("m2-205-pathfind-move"),
    fields: { target: "player", xSource: "variable", xVariableId: VARIABLES.x, yVariableId: VARIABLES.y, speed: 4, wait: true },
  };
  const choice: Command = { kind: "choices", options: [
    { text: "이동", branch: [command] }, { text: "대기", branch: [TAIL] },
  ] };
  const { project, target, map } = seed("blank", [choice]);
  const args = { index: 0, branchPath: [0, 0], expectedHash: eventCommandHash(command) };
  expect(() => runPrimitive(project, target, "m2.205.update", { ...args, x: map.width })).toThrow("좌표가 맵 범위 밖");
  const { after } = runPrimitive(project, target, "m2.205.update", { ...args, x: 0 });
  expect(commandsOf(after)).toEqual([{ ...choice, options: [
    { text: "이동", branch: [{ ...command, fields: { ...command.fields, x: 0, xSource: "fixed" } }] },
    { text: "대기", branch: [TAIL] },
  ] }]);
  const session = startSession(after, 7);
  session.variables[VARIABLES.x] = 5;
  session.variables[VARIABLES.y] = 6;
  const play = (project: Project) => createInterpreter(commandsOf(project), session, project);
  const fixed = play(after);
  expect(fixed.start().kind).toBe("choices");
  expect(fixed.resume(0)).toMatchObject({ kind: "pathfindMove", x: 0, y: 6 });
  const explicitVariable = runPrimitive(project, target, "m2.205.update", { ...args, x: 0, xSource: "variable" });
  const variable = play(explicitVariable.after);
  expect(variable.start().kind).toBe("choices");
  expect(variable.resume(0)).toMatchObject({ kind: "pathfindMove", x: 5, y: 6 });
  await expectUndoRestores(project, after, target);
});

it("기존 지형 읽기 명령이 다른 맵을 가리키면 그 맵의 좌표를 검사한다", () => {
  const command = {
    ...newM2Command("m2-042-get-terrain-id"), fields: { variableId: VARIABLES.x, mapId: "map_small", x: 1, y: 1 },
  };
  const { project, target, map } = seed("blank", [command]);
  project.maps.map_small = { ...map, id: "map_small", width: 2, height: 2, events: [] };
  const args = { index: 0, expectedHash: eventCommandHash(command) };
  expect(() => runPrimitive(project, target, "m2.042.update", { ...args, x: 2 })).toThrow("좌표가 맵 범위 밖");
  const { after } = runPrimitive(project, target, "m2.042.update", { ...args, x: 0 });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { mapId: "map_small", x: 0, y: 1 } });
});

it("그림만 바꾸는 먼 배경 명령은 흐름 설정을 쓰지 않는다", () => {
  const { project, target } = seed("blank", []);
  const { after } = runPrimitive(project, target, "m2.069.insert", { resourceId: BACKDROP });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { resourceId: BACKDROP } });
  expect(commandsOf(after)[0]).not.toHaveProperty("fields.flowPercent");
  expect(commandsOf(after)[0]).not.toHaveProperty("fields.flowDurationMs");
  expect(() => runPrimitive(project, target, "m2.069.insert", {})).toThrow("먼 배경 그림을 고르거나");
  expect(() => runPrimitive(project, target, "m2.069.insert", { resourceId: BACKDROP, flowDurationMs: 100 }))
    .toThrow("흐름 배율도 입력해 주세요");
  const session = startSession(after, 7);
  const first = createInterpreter([{
    ...newM2Command("m2-069-change-parallax-back"), fields: { resourceId: "", flowPercent: 0 },
  }], session, after);
  expect(first.start().kind).toBe("done");
  const changed = createInterpreter(commandsOf(after), session, after);
  expect(changed.start().kind).toBe("done");
  expect(session.m2Runtime?.map.parallax_flow.value).toBe("0|0");
  expect(session.m2Runtime?.map.parallax_override.value).toBe(BACKDROP);
  const reset = runPrimitive(project, target, "m2.069.insert", { resourceId: "" });
  expect(reset.sentence).toContain("맵에 설정한 먼 배경 그림");
  expect(createInterpreter(commandsOf(reset.after), session, reset.after).start().kind).toBe("done");
  expect(session.m2Runtime?.map.parallax_override.value).toBe("");
  expect(session.m2Runtime?.map.parallax_flow.value).toBe("0|0");
});

it("흐름이 있던 먼 배경 줄을 기본 그림으로 고치고 흐름 설정을 되돌린다", async () => {
  const command = {
    ...newM2Command("m2-069-change-parallax-back"),
    fields: { value: BACKDROP, target: BACKDROP, flowPercent: 50, flowDurationMs: 1500 },
  };
  const { project, target } = seed("blank", [command]);
  const args = { index: 0, expectedHash: eventCommandHash(command), resourceId: "" };
  const { after, sentence } = runPrimitive(project, target, "m2.069.update", args);
  expect(sentence).toContain("맵에 설정한 먼 배경 그림");
  expect(commandsOf(after)).toEqual([{ ...command, fields: { value: "", target: "", resourceId: "" } }]);
  const session = startSession(project, 7);
  expect(createInterpreter([command], session, project).start().kind).toBe("done");
  expect(session.m2Runtime?.map.parallax_override.value).toBe(BACKDROP);
  expect(createInterpreter(commandsOf(after), session, after).start().kind).toBe("done");
  expect(session.m2Runtime?.map.parallax_override.value).toBe("");
  expect(session.m2Runtime?.map.parallax_flow.value).toBe("50|1500");
  const flowOnly = runPrimitive(project, target, "m2.069.update", { ...args, flowPercent: 0 });
  expect(flowOnly.sentence).toContain("기존 먼 배경 그림을 유지");
  expect(commandsOf(flowOnly.after)[0]).toMatchObject({ fields: { resourceId: "", flowPercent: 0, flowDurationMs: 1500 } });
  expect(() => runPrimitive(project, target, "m2.069.update", { ...args, flowDurationMs: 500 })).toThrow("흐름 배율도 입력");
  await expectUndoRestores(project, after, target);
});

it("옛 화면 이동 명령의 속도를 고치면 실행 시간에도 반영된다", () => {
  const command = {
    ...newM2Command("m2-049-scroll-map"),
    fields: { target: "right", value: 2, durationMs: 3000, wait: true, return: true, lock: false },
  };
  const { project, target } = seed("blank", [command]);
  const { after } = runPrimitive(project, target, "m2.049.update", {
    index: 0, expectedHash: eventCommandHash(command), speed: 5, mode: "lock",
  });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { wait: "true", target: "right", value: 2 } });
  const session = startSession(after, 7);
  expect(createInterpreter(commandsOf(after), session, after).start()).toMatchObject({
    kind: "scrollMap", direction: "right", distanceTiles: 2, durationMs: 600, returnToPlayer: false, lock: true,
  });
});

it("전투 빈도를 숫자로 고치면 편집기에서도 숫자 입력으로 표시할 값을 저장한다", () => {
  const command = {
    ...newM2Command("m2-070-set-encounter-rate"),
    fields: { value: VARIABLES.x, valueSource: "variable", valueVariableId: VARIABLES.x },
  };
  const { project, target } = seed("blank", [command]);
  const { after } = runPrimitive(project, target, "m2.070.update", {
    index: 0, expectedHash: eventCommandHash(command), value: 8,
  });
  expect(commandsOf(after)[0]).toMatchObject({ fields: { value: 8, valueSource: "number", valueVariableId: "" } });
});

const COPY = "spawned_guide";
const SPAWN = { ...newM2Command("m2-203-spawn-event"), fields: { prefabId: OTHER, eventId: COPY, x: 2, y: 3 } };
const REMOVE = { ...newM2Command("m2-204-remove-event"), fields: { eventId: COPY } };

const spawnReferenceSites: Record<string, (project: Project) => void> = {
  "뒤쪽 명령": project => { commandsOf(project).push(REMOVE); },
  "공용 이벤트": project => {
    project.commonEvents = [{ id: "cleanup", name: "복제 정리", trigger: "none", commands: [{ kind: "loop", body: [REMOVE] }] }];
  },
  "페이지 조건": project => {
    const other = project.maps[project.startMapId].events.find(event => event.id === OTHER)!;
    other.pages = [normalizeEventPage({
      id: "other-page", name: "구역 확인", conditions: [{ kind: "insideLocation", eventId: COPY, locationId: REGION, inside: true }],
    })];
  },
  "부대": project => {
    project.database.troops = [{
      id: "guard_troop", name: "경비대", enemyIds: [], autoAlign: false, battleEventPages: [], afterBattle: { victory: [REMOVE] },
    }];
  },
  "설정집": project => {
    project.world = {
      entities: [{ id: "guide", type: "character", name: "안내원", summary: "", origin: "user", refs: [{ kind: "event", id: COPY }] }],
      relations: [],
    };
  },
  "셀프 스위치": project => { project.session.selfSwitches = { [COPY]: { A: true } }; },
  "옛 위치 교환의 값 필드": project => {
    commandsOf(project).push({
      ...newM2Command("m2-041-swap-event-location"), fields: { target: OTHER, value: COPY },
    });
  },
  "스크립트": project => {
    commandsOf(project).push({ kind: "script", source: `game.setSelfSwitch("A", true, "${COPY}");`, compiled: "" });
  },
};

it.each(Object.entries(spawnReferenceSites))("%s에 생성 ID 참조가 남으면 변경을 거절한다", (_site, addReference) => {
  const { project, target } = seed("blank", [SPAWN]);
  addReference(project);
  expect(() => runPrimitive(project, target, "m2.203.update", {
    index: 0, eventId: "another_guide", expectedHash: eventCommandHash(SPAWN),
  })).toThrow("기존 식별자를 참조하는 곳");
});

it("계산된 복제 ID를 쓰는 스크립트가 있으면 초안과 저장본 모두에서 ID 변경을 거절한다", async () => {
  const { project, target } = seed("blank", [SPAWN]);
  const live = structuredClone(project);
  const other = live.maps[live.startMapId].events.find(event => event.id === OTHER)!;
  const source = 'await game.cmd({ kind: "m2Command", commandId: "m2-204-remove-event", fields: { eventId: ["spawned", "guide"].join("_") } });';
  other.draft = { kind: "edit", original: structuredClone(other) };
  other.commands = [{ kind: "script", source, compiled: source, effects: EMPTY_SCRIPT_EFFECTS }];
  const args = { index: 0, expectedHash: eventCommandHash(SPAWN) };
  expect(() => runPrimitive(project, target, "m2.203.update", { ...args, eventId: "another_guide" }, undefined, live))
    .toThrow("스크립트의 참조 여부");
  const { after } = runPrimitive(project, target, "m2.203.update", { ...args, y: 4 }, undefined, live);
  expect(commandsOf(after)[0]).toMatchObject({ fields: { eventId: COPY, y: 4 } });
  const committed: Project = { ...project, commonEvents: [
    { id: "cleanup", name: "복제 정리", trigger: "none", commands: other.commands },
  ] };
  const context = { project: committed, smallTaskTarget: target };
  await expect(runSmallTaskPrimitiveTool(context, APPLY_SMALL_TASK_PRIMITIVE, {
    id: "m2.203.update", args: { ...args, eventId: "another_guide" },
  })).rejects.toThrow("스크립트의 참조 여부");
});

it("라이브러리에서 조합한 제거 플래그가 있으면 제거 대상 변경을 거절한다", () => {
  const command = { ...REMOVE, fields: { eventId: OTHER } };
  const { project, target } = seed("blank", [command]);
  const source = 'exports.check = async id => game.cmd({ kind: "fork", condition: { kind: "flag", flag: "event-removed:" + id, value: true }, then: [] });';
  project.scriptLibrary = [{ id: "cleanup", source, compiled: source, effects: EMPTY_SCRIPT_EFFECTS }];
  expect(() => runPrimitive(project, target, "m2.204.update", {
    index: 0, expectedHash: eventCommandHash(command), eventId: HOST,
  })).toThrow("스크립트의 참조 여부");
});

it("복제본의 제거 플래그가 저장돼 있으면 자기 제거 대상을 바꾸지 않는다", () => {
  const self = { ...REMOVE, fields: { eventId: "" } };
  const { project, target, map } = seed("blank", [self]);
  const spawner = map.events.find(event => event.id === OTHER)!;
  spawner.commands = [{ ...SPAWN, fields: { ...SPAWN.fields, prefabId: HOST } }];
  const args = { index: 0, expectedHash: eventCommandHash(self), eventId: HOST };
  const withCopyFlag = { ...project, flags: { ...project.flags, [`event-removed:${COPY}`]: true } };
  expect(() => runPrimitive(withCopyFlag, target, "m2.204.update", args))
    .toThrow("이벤트가 제거되었는지 확인하는 곳");
  const withUnrelatedFlag = { ...project, flags: { ...project.flags, "event-removed:unrelated": true } };
  expect(commandsOf(runPrimitive(withUnrelatedFlag, target, "m2.204.update", args).after)[0])
    .toMatchObject({ fields: { eventId: HOST } });
});

it("기존 또는 이미 생성하도록 정한 이벤트 ID를 다시 할당하지 않는다", () => {
  const { project, target } = seed("blank", [SPAWN]);
  for (const eventId of [COPY, OTHER]) {
    expect(() => runPrimitive(project, target, "m2.203.insert", { prefabId: OTHER, eventId })).toThrow("이미 있습니다");
  }
  expect(() => runPrimitive(project, target, "m2.203.insert", { prefabId: OTHER, eventId: "  " })).toThrow("앞뒤 공백");
  for (const eventId of ["this-event", "__proto__", "_swap"]) {
    expect(() => runPrimitive(project, target, "m2.203.insert", { prefabId: OTHER, eventId })).toThrow("다른 식별자");
  }
});

it("복제 원본 맵을 지정한 기존 명령에서는 그 맵 안의 원본만 허용한다", () => {
  const command = { ...SPAWN, fields: { ...SPAWN.fields, templateMapId: "remote", templateEventId: OTHER } };
  const { project, target, map } = seed("blank", [command]);
  const args = { index: 0, expectedHash: eventCommandHash(command), y: 4 };
  expect(() => runPrimitive(project, target, "m2.203.update", args))
    .toThrow("원본의 맵을 찾을 수 없습니다");
  const remote = { ...map, id: "remote", events: [] };
  const withoutTemplate = { ...project, maps: { ...project.maps, remote } };
  expect(() => runPrimitive(withoutTemplate, target, "m2.203.update", args))
    .toThrow("원본 맵에서 복제할 이벤트를 찾을 수 없습니다");
  const template = map.events.find(event => event.id === OTHER)!;
  const withTemplate = { ...project, maps: { ...project.maps, remote: { ...remote, events: [template] } } };
  expect(commandsOf(runPrimitive(withTemplate, target, "m2.203.update", args).after)[0]).toEqual({
    ...command, fields: { ...command.fields, y: 4 },
  });
});

it("옛 생성 명령에서 원본만 바꾸면 제거 명령이 가리키는 생성 ID가 유지된다", () => {
  const command = { ...newM2Command("m2-203-spawn-event"), fields: { templateEventId: OTHER, x: 2, y: 3 } };
  const { project, target } = seed("blank", [command, { ...REMOVE, fields: { eventId: `${OTHER}_spawn` } }]);
  const { after } = runPrimitive(project, target, "m2.203.update", {
    index: 0, prefabId: HOST, expectedHash: eventCommandHash(command),
  });
  expect(commandsOf(after)[0]).toMatchObject({
    fields: { prefabId: HOST, templateEventId: HOST, eventId: `${OTHER}_spawn` },
  });
});

it("같은 실행 경로에서 앞서 생성한 이벤트만 제거 대상으로 인정한다", () => {
  const fork: Command = { kind: "fork", condition: { kind: "switch", switchId: SWITCH, value: true }, then: [SPAWN], else: [] };
  const { project, target } = seed("blank", [fork]);
  const remove = (branchPath: number[], index?: number) => runPrimitive(project, target, "m2.204.insert", {
    eventId: COPY, branchPath, ...(index === undefined ? {} : { index }),
  });
  expect(() => remove([0, FORK_THEN_BRANCH_INDEX], 0)).toThrow("이벤트를 찾을 수 없습니다");
  expect(() => remove([0, FORK_ELSE_BRANCH_INDEX])).toThrow("이벤트를 찾을 수 없습니다");
  expect(() => remove([])).toThrow("이벤트를 찾을 수 없습니다");
  expect(commandsOf(remove([0, FORK_THEN_BRANCH_INDEX]).after)).toEqual([{ ...fork, then: [SPAWN, REMOVE] }]);
  const repeated = seed("blank", [SPAWN, { ...fork, then: [REMOVE] }]);
  expect(() => runPrimitive(repeated.project, repeated.target, "m2.204.insert", { eventId: COPY }))
    .toThrow("이벤트를 찾을 수 없습니다");
  const skipped = seed("blank", [{ kind: "gotoLabel", name: "끝" }, SPAWN, { kind: "label", name: "끝" }]);
  expect(() => runPrimitive(skipped.project, skipped.target, "m2.204.insert", { eventId: COPY }))
    .toThrow("이벤트를 찾을 수 없습니다");
  const missingTemplate = seed("blank", [{ ...SPAWN, fields: { ...SPAWN.fields, prefabId: "missing" } }]);
  expect(() => runPrimitive(missingTemplate.project, missingTemplate.target, "m2.204.insert", { eventId: COPY }))
    .toThrow("이벤트를 찾을 수 없습니다");
});

it("공용 이벤트가 복제본을 제거할 수 있거나 반복을 돌며 재생성하지 않으면 제거를 거절한다", () => {
  const call = seed("blank", [SPAWN, { kind: "callCommonEvent", commonEventId: "cleanup" }]);
  call.project.commonEvents = [{ id: "cleanup", name: "복제 정리", trigger: "none", commands: [REMOVE] }];
  expect(() => runPrimitive(call.project, call.target, "m2.204.insert", { eventId: COPY })).toThrow("이벤트를 찾을 수 없습니다");
  const repeated = seed("blank", [SPAWN, { kind: "loop", body: [] }]);
  expect(() => runPrimitive(repeated.project, repeated.target, "m2.204.insert", {
    branchPath: [1, LOOP_BODY_BRANCH_INDEX], eventId: COPY,
  })).toThrow("이벤트를 찾을 수 없습니다");
});

it("기존 제거 명령의 대상 맵과 저장된 제거 플래그를 검사한다", () => {
  const command = { ...REMOVE, fields: { eventId: OTHER, mapId: "remote" } };
  const { project, target, map } = seed("blank", [command]);
  const args = { index: 0, expectedHash: eventCommandHash(command), eventId: HOST };
  const apply = (snapshot: Project) => runPrimitive(snapshot, target, "m2.204.update", args);
  expect(() => apply(project)).toThrow("이벤트를 제거할 맵을 찾을 수 없습니다");
  const remote = { ...map, id: "remote", events: [] };
  expect(() => apply({ ...project, maps: { ...project.maps, remote } })).toThrow("이벤트를 찾을 수 없습니다");
  const host = map.events.find(event => event.id === HOST)!;
  const withDestination = { ...project, maps: { ...project.maps, remote: { ...remote, events: [host] } } };
  const withFlag = { ...withDestination, flags: { ...project.flags, [`event-removed:${OTHER}`]: true } };
  expect(() => apply(withFlag)).toThrow("이벤트가 제거되었는지 확인하는 곳");
  expect(commandsOf(apply(withDestination).after)[0]).toEqual({
    ...command, fields: { eventId: HOST, mapId: "remote" },
  });
});

type SeededCorpusCase = CorpusCase & { setup?: { commands: Command[] }; refusalMessage?: string };
const corpus = [...corpusJson, ...seededCorpusJson] as readonly SeededCorpusCase[];

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
    let args = entry.args;
    if (entry.setup && target.kind === "event" && !Object.hasOwn(args, "expectedHash")) {
      const page = before.maps[target.mapId].events.find(event => event.id === target.eventId)?.pages?.find(page => page.id === target.pageId);
      const branch = Array.isArray(args.branchPath) ? args.branchPath : [];
      const command = page && resolveCommandAtPath(page.commands, [...branch, Number(args.index)]);
      expect(command, "수정할 시드 명령").toBeTruthy();
      args = { ...args, expectedHash: eventCommandHash(command!) };
    }
    const run = () => runPrimitive(before, target, entry.primitive, args, entry.selection);
    if (entry.expectRefusal) {
      const refusal = entry.refusalMessage
        ? expect.objectContaining({ name: "PrimitiveError", message: expect.stringContaining(entry.refusalMessage) })
        : PrimitiveError;
      expect(run).toThrow(refusal);
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

it.each(["생략", "빈 문자열", "this-event"] as const)("자기 제거 대상을 %s(으)로 지정한 복제본은 자신만 제거한다", async mode => {
  const explicit = { ...REMOVE, fields: { eventId: OTHER } };
  const { project, target } = seed("blank", mode === "this-event" ? [explicit] : []);
  const result = mode === "this-event"
    ? runPrimitive(project, target, "m2.204.update", { index: 0, expectedHash: eventCommandHash(explicit), eventId: mode })
    : runPrimitive(project, target, "m2.204.insert", mode === "생략" ? {} : { eventId: "" });
  const { after } = result;
  expect(commandsOf(after)[0]).toMatchObject({ fields: { eventId: "" } });
  const map = after.maps[after.startMapId];
  const session = startSession(after, 7);
  const spawn = { ...SPAWN, fields: { ...SPAWN.fields, prefabId: HOST, templateEventId: HOST, mapId: map.id, templateMapId: map.id, sourceMapId: map.id } };
  expect(createInterpreter([spawn], session, after).start()).toEqual({ kind: "spawnEvent", eventId: COPY });
  const copy = runtimeEventViewById(after, map, session, {}, COPY)!;
  expect(copy.event.id).toBe(COPY);
  expect(createInterpreter(copy.page!.commands, session, after, { currentEventId: copy.event.id }).start())
    .toEqual({ kind: "removeEvent", eventId: COPY });
  expect(runtimeEventViewById(after, map, session, {}, COPY)).toBeUndefined();
  expect(runtimeEventViewById(after, map, session, {}, HOST)).toBeDefined();
  expect(session.flags[`event-removed:${COPY}`]).toBe(true);
  expect(session.flags[`event-removed:${HOST}`]).toBeUndefined();
  await expectUndoRestores(project, after, target);
});

it("다른 맵으로 옮겨진 이벤트는 저장된 this-event 제거를 원래 맵에 기록한다", () => {
  const command = { ...REMOVE, fields: { eventId: "this-event", mapId: "remote" } };
  const { project, map } = seed("blank", [command]);
  project.maps.remote = { ...map, id: "remote", events: [] };
  const session = startSession(project, 7);
  session.currentMapId = "remote";
  session.eventLocations = { [HOST]: { mapId: "remote", x: 1, y: 1 } };
  expect(createInterpreter(commandsOf(project), session, project, { currentEventId: HOST }).start())
    .toEqual({ kind: "removeEvent", eventId: HOST });
  expect(session.removedEventIds?.[map.id]).toEqual([HOST]);
  expect(runtimeEventViewById(project, map, session, {}, HOST)).toBeUndefined();
});
