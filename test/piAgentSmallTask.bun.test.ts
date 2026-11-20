import { expect, test } from "bun:test";
import type { StreamFn } from "@oh-my-pi/pi-agent-core";
import { createAssistantMessageEventStream, type AssistantMessage } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import type { PiAgentRequest } from "../src/ai/piAgent/protocol.ts";
import { mapTarget } from "../src/editor/smallTask/target.ts";
import { SMALL_TASK_SCOPE_REFUSAL } from "../src/editor/smallTask/tools.ts";
import { APPLY_SMALL_TASK_PRIMITIVE, LIST_SMALL_TASK_PRIMITIVES } from "../src/editor/tools/smallTaskPrimitiveTools.ts";
import { createBlankProject } from "../src/project/defaults/blankProject.ts";
import { eventCommandHash } from "../src/project/eventCommands/singleCommandOps.ts";
import { layerTileAt } from "../src/project/mapLayers.ts";
import type { Command, EventPage, GameEvent } from "../src/project/types.ts";

type Call = { name: string; args: Record<string, unknown> };
type ModelContext = Parameters<StreamFn>[1];

function scripted(calls: readonly Call[], seen: ModelContext[] = []): StreamFn {
  return (model, context) => {
    const step = calls[seen.length];
    seen.push(context);
    const call = step && { type: "toolCall" as const, id: `call-${seen.length}`, name: step.name, arguments: step.args };
    const reason = call ? "toolUse" : "stop";
    const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const message: AssistantMessage = {
      role: "assistant", content: call ? [call] : [{ type: "text", text: "마쳤어요." }],
      api: model.api, provider: model.provider, model: model.id,
      usage: { ...zero, totalTokens: 0, cost: { ...zero, total: 0 } },
      stopReason: reason, timestamp: Date.now(),
    };
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      stream.push({ type: "start", partial: message });
      if (call) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: message });
      stream.push({ type: "done", reason, message });
    });
    return stream;
  };
}

function fixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  map.tilesetId = "tileset_test";
  map.lowerTiles.fill(0);
  project.tilesets = {
    [map.tilesetId]: {
      id: map.tilesetId, name: "검수 타일셋", image: { type: "bundled", id: "tex_default_tiles" }, kind: "custom",
      tileSize: map.tileSize, tilesPerRow: 1, count: 1, priority: ["lower"], terrain: [0],
      passability: [{ up: true, down: true, left: true, right: true }],
    },
  };
  project.assets = { sprites: {}, uploaded: {} };
  project.resourceProfiles = [];
  const commands: Command[] = ["처음", "둘째", "마지막"].map(body => ({ kind: "text", body }));
  const page: EventPage = {
    id: "page_selected", name: "인사", commands, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  const event = { id: "event_selected", name: "안내인", x: 2, y: 3, trigger: page.trigger, commands: [],
    pages: [{ ...page, id: "page_other" }, page] };
  map.events = [event, { ...event, id: "event_other" }];
  const target = mapTarget(project, mapId, event.id, page.id)!;
  const request = {
    provider: "google-antigravity", mode: "single", task: "안내인의 대사를 정리해 줘", project, mapIds: [mapId],
    smallTask: { target, maxToolCalls: 4 },
  } satisfies PiAgentRequest;
  return { request, project, mapId, event, commands };
}

const apply = (id: string, args: Call["args"]): Call => ({ name: APPLY_SMALL_TASK_PRIMITIVE, args: { id, args } });

test("작은 일 Pi 실행이 동작을 읽고 고른 페이지에서 cmd.delete와 cmd.move를 적용한다", async () => {
  const { request, project, mapId, event, commands } = fixture();
  const seen: ModelContext[] = [];
  const done = await runPiAgent(request, { streamFn: scripted([
    { name: LIST_SMALL_TASK_PRIMITIVES, args: {} },
    { name: "get_event", args: { mapId, eventId: event.id, includeCommandHashes: true } },
    apply("cmd.delete", { index: 1, expectedHash: eventCommandHash(commands[1]!) }),
    apply("cmd.move", { index: 1, toIndex: 0, expectedHash: eventCommandHash(commands[2]!) }),
  ], seen) });

  expect(seen[0]?.tools?.map(tool => tool.name)).toEqual(expect.arrayContaining([LIST_SMALL_TASK_PRIMITIVES, APPLY_SMALL_TASK_PRIMITIVE]));
  const list = seen[1]?.messages.find(message => message.role === "toolResult" && message.toolName === LIST_SMALL_TASK_PRIMITIVES);
  const content = list?.role === "toolResult" ? list.content.find(part => part.type === "text") : undefined;
  expect(JSON.parse(content?.text ?? "null")).toMatchObject({
    ok: true, data: expect.arrayContaining([{ id: "cmd.delete", title: expect.any(String), args: expect.any(Object) },
      { id: "cmd.move", title: expect.any(String), args: expect.any(Object) }]),
  });
  expect(done).toMatchObject({ smallTask: true, changedKeys: [`maps.${mapId}`], stats: { toolCalls: 4, toolErrors: 0 } });
  expect(done.stoppedEarly).toBeUndefined();
  const [selected, other] = done.project.maps[mapId].events;
  expect(selected!.pages![1]!.commands).toEqual([{ kind: "text", body: "마지막" }, { kind: "text", body: "처음" }]);
  expect(selected!.pages![0]).toEqual(event.pages[0]!);
  expect(other).toEqual(project.maps[mapId].events[1]!);
  expect(project.maps[mapId].events[0]!.pages![1]!.commands).toHaveLength(3);
});

test("작은 일 Pi 실행은 열린 초안이 읽는 스위치의 마지막 쓰기 재지정을 거절한다", async () => {
  const { request, project, mapId, event } = fixture();
  const switchId = "sw_draft_gate";
  const nextSwitchId = "sw_other_gate";
  project.switches = [{ id: switchId, name: "초안 문" }, { id: nextSwitchId, name: "다른 문" }];
  const write: Command = { kind: "setSwitch", switchId, value: true };
  event.pages = [event.pages[0]!, { ...event.pages[1]!, commands: [write] }];
  const draft = { ...event, id: "event_draft", draft: { kind: "new" as const }, pages: [{
    ...event.pages[1], conditions: [{ kind: "switch" as const, switchId, value: true }], commands: [],
  }] };
  const update = apply("cmd.setSwitch.update", { index: 0, expectedHash: eventCommandHash(write), switchId: nextSwitchId });
  const blocked = await runPiAgent({
    ...request, smallTask: { ...request.smallTask, draftSource: { maps: { [mapId]: { events: [draft] } } } },
  }, { streamFn: scripted([update]) });
  expect(blocked.stoppedEarly).toContain("값을 바꾸는 명령이 이 줄뿐입니다");
  expect(blocked.project).toBe(project);

  const allowed = await runPiAgent(request, { streamFn: scripted([update]) });
  expect(allowed.stoppedEarly).toBeUndefined();
  expect(allowed.project.maps[mapId].events[0]?.pages?.[1]?.commands).toEqual([{ ...write, switchId: nextSwitchId }]);
}, 20_000);

test("작은 일 Pi 실행은 맵 대상에 cmd.delete를 쓰면 거절한다", async () => {
  const { request, project, mapId } = fixture();
  const target = mapTarget(project, mapId)!;
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, target } },
    { streamFn: scripted([apply("cmd.delete", { index: 0 })]) });
  expect(done.stoppedEarly).toContain("범위 밖");
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 Pi 실행은 요청에 포함된 새 이벤트 초안이 참조하는 출현 명령을 보호한다", async () => {
  const { request, project, mapId, event, commands } = fixture();
  const spawn = { id: "slimes", troopId: "troop_slime", area: { x: 1, y: 1, w: 1, h: 1 }, maxAlive: 1 };
  const command: Command = { kind: "spawnFieldEnemy", spawn };
  event.pages = [event.pages[0]!, { ...event.pages[1]!, commands: [command, ...commands] }];
  const original = { id: "event_draft", x: 3, y: 3, trigger: event.trigger, commands: [] };
  const draft: GameEvent = {
    ...original,
    commands: [{ kind: "despawnFieldEnemy", spawnId: spawn.id }],
    draft: { kind: "new", original },
  };
  const draftSource = { maps: { [mapId]: { events: [draft] } } };
  const deletion = apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(command) });
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, draftSource } },
    { streamFn: scripted([deletion]) });

  expect(done.stoppedEarly).toContain("제거하는 명령");
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
  const withoutDraft = await runPiAgent(request, { streamFn: scripted([deletion]) });
  expect(withoutDraft.stoppedEarly).toBeUndefined();
  expect(withoutDraft.project.maps[mapId].events[0]?.pages?.[1]?.commands).toEqual(commands);
});

test("작은 일 Pi 실행은 다른 이벤트의 열린 초안이 읽는 현대 명령 기록을 보호한다", async () => {
  const { request, project, mapId, event } = fixture();
  const variableId = project.variables[0]!.id;
  const submit = {
    kind: "m2Command", commandId: "m2-222-high-score",
    fields: { action: "submit", scoreId: "경주", valueVariableId: variableId },
  } satisfies Command;
  const read = { ...submit, fields: { action: "read", scoreId: "경주", resultVariableId: variableId } };
  event.pages[1]!.commands = [submit];
  const original = project.maps[mapId].events[1]!;
  const draft: GameEvent = {
    ...original, pages: [{ ...original.pages![0]!, commands: [read] }], draft: { kind: "edit", original },
  };
  const draftSource = { maps: { [mapId]: { events: [draft] } } };
  const draftRequest = { ...request, smallTask: { ...request.smallTask, draftSource } };
  const args = { index: 0, expectedHash: eventCommandHash(submit) };
  for (const call of [apply("cmd.delete", args), apply("m2.222.update", { ...args, scoreId: "걷기" })]) {
    const done = await runPiAgent(draftRequest, { streamFn: scripted([call]) });
    expect(done.stoppedEarly).toContain("점수를 올리는 마지막 명령");
    expect(done.changedKeys).toEqual([]);
    expect(done.project).toBe(project);
  }
});

test("작은 일 Pi 실행은 범위 밖 줄로 이동하면 앞선 삭제도 버린다", async () => {
  const { request, project, commands } = fixture();
  const done = await runPiAgent(request, { streamFn: scripted([
    apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(commands[0]!) }),
    apply("cmd.move", { index: 0, toIndex: 2, expectedHash: eventCommandHash(commands[1]!) }),
  ]) });

  expect(done.stoppedEarly).toContain("도착 위치를 찾을 수 없어요");
  expect(done.stats).toMatchObject({ toolCalls: 2, toolErrors: 1 });
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

for (const [id, extra] of [["cmd.delete", {}], ["cmd.move", { toIndex: 0 }]] as const) {
  test(`${id}: 앞선 삭제로 줄이 밀린 뒤 해시 누락과 불일치를 거절한다`, async () => {
    const { request, project, commands } = fixture();
    for (const [hashArg, reason] of [
      [{}, "동작에 필요한 값의 형식을 확인해 주세요."],
      [{ expectedHash: eventCommandHash(commands[1]!) }, "명령 목록이 바뀌었어요. 이벤트를 다시 읽어 주세요."],
    ] as const) {
      const done = await runPiAgent(request, { streamFn: scripted([
        apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(commands[0]!) }),
        apply(id, { index: 1, ...extra, ...hashArg }),
      ]) });
      expect(done.stoppedEarly).toBe(reason);
      expect(done.stats).toMatchObject({ toolCalls: 2, toolErrors: 1 });
      expect(done.changedKeys).toEqual([]);
      expect(done.project).toBe(project);
    }
  });
}

test("작은 일 Pi 실행은 여러 페이지 중 고른 페이지가 없으면 삭제를 거절한다", async () => {
  const { request, project, mapId, event, commands } = fixture();
  const target = mapTarget(project, mapId, event.id)!;
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, target } }, {
    streamFn: scripted([apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(commands[0]!) })]),
  });
  expect(done.stoppedEarly).toBe("이벤트 페이지가 여러 개예요. 고칠 페이지를 선택해 주세요.");
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 Pi 실행은 기존 paint_tiles 결과에서 선택 영역 밖의 타일 변경을 거절한다", async () => {
  const { request, project, mapId } = fixture();
  const target = mapTarget(project, mapId)!;
  const selection = { rect: { x: 0, y: 0, w: 1, h: 1 } };
  const selectedRequest = { ...request, smallTask: { ...request.smallTask, target, selection } };
  const paint = (x: number): Call => ({ name: "paint_tiles", args: { mapId, layer: "2", mode: "cells", tile: 0, cells: [{ x, y: 0 }] } });
  const outside = await runPiAgent(selectedRequest, { streamFn: scripted([paint(0), paint(1)]) });
  expect(outside.stoppedEarly).toContain("선택 영역 바깥 타일");
  expect(outside.stats).toMatchObject({ toolCalls: 2, toolErrors: 0 });
  expect(outside.changedKeys).toEqual([]);
  expect(outside.project).toBe(project);
  expect(layerTileAt(project.maps[mapId], 2, 0)).toBe(-1);
  expect(layerTileAt(project.maps[mapId], 2, 1)).toBe(-1);

  const inside = await runPiAgent(selectedRequest, { streamFn: scripted([paint(0)]) });
  expect(inside.stoppedEarly).toBeUndefined();
  expect(inside.changedKeys).toEqual([`maps.${mapId}`]);
  expect(layerTileAt(inside.project.maps[mapId], 2, 0)).toBe(0);
  expect(layerTileAt(inside.project.maps[mapId], 2, 1)).toBe(-1);
});

test("작은 일 Pi 실행은 다른 이벤트를 읽으려 하면 앞선 쓰기까지 버린다", async () => {
  const { request, project, mapId, commands } = fixture();
  const done = await runPiAgent(request, { streamFn: scripted([
    apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(commands[0]!) }),
    { name: "get_event", args: { mapId, eventId: "event_other" } },
  ]) });
  expect(done.stoppedEarly).toBe(SMALL_TASK_SCOPE_REFUSAL);
  expect(done.stats.toolCalls).toBe(2);
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 동작도 호출 상한에 포함하고 상한을 넘으면 앞선 쓰기를 버린다", async () => {
  const { request, project, commands } = fixture();
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, maxToolCalls: 1 } }, { streamFn: scripted([
    apply("cmd.delete", { index: 0, expectedHash: eventCommandHash(commands[0]!) }),
    { name: LIST_SMALL_TASK_PRIMITIVES, args: {} },
  ]) });
  expect(done.stoppedEarly).toContain("작업 수를 넘었어요");
  expect(done.stats.toolCalls).toBe(2);
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 Pi 실행은 새 이벤트 초안에서 사용하는 출현 이름을 유지한다", async () => {
  const { request, project, mapId, event, commands } = fixture();
  const spawn: Command = { kind: "spawnFieldEnemy", spawn: {
    id: "spawn_trial", troopId: project.database.troops[0]!.id, area: { x: 0, y: 0, w: 1, h: 1 },
  } };
  event.pages = [event.pages[0]!, { ...event.pages[1]!, commands: [...commands, spawn] }];
  const draft = { ...event, id: "event_draft", pages: undefined, draft: { kind: "new" } as const,
    commands: [{ kind: "despawnFieldEnemy", spawnId: spawn.spawn.id } satisfies Command] };
  const rename = apply("cmd.spawnFieldEnemy.update", { index: 3, expectedHash: eventCommandHash(spawn), spawnId: "spawn_renamed" });
  const blocked = await runPiAgent({ ...request, smallTask: {
    ...request.smallTask, draftSource: { maps: { [mapId]: { events: [draft] } } },
  } }, { streamFn: scripted([rename]) });
  expect(blocked.stoppedEarly).toContain("이 출현 이름을 쓰는 명령이나 조건");
  expect(blocked.changedKeys).toEqual([]);
  expect(blocked.project).toBe(project);

  const allowed = await runPiAgent(request, { streamFn: scripted([rename]) });
  expect(allowed.stoppedEarly).toBeUndefined();
  expect(allowed.project.maps[mapId].events[0]!.pages![1]!.commands[3]).toMatchObject({ spawn: { id: "spawn_renamed" } });
});

for (const delivery of ["delivered", "omitted", "same-turn", "outside-selection"] as const) {
  test(`작은 일의 타일 칠하기는 먼저 전달된 참고문서가 필요하다 (${delivery})`, async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tilesetId = map.tilesetId;
    const categoryId = "fixture-floor";
    const tileset = project.tilesets[tilesetId];
    project.tilesets = { [tilesetId]: { ...tileset, referenceSourceTilesetId: undefined, referenceDocuments: [{
      id: categoryId, name: "바닥", description: "바닥 칸을 고르는 자료", images: [],
      documents: [{ id: "fixture-guide", name: "바닥 안내", markdown: "시험에서는 바닥을 한 칸 비운다." }],
    }] } };
    const read = { type: "toolCall", id: "read-floor", name: "read_tileset_reference", arguments: { mapId, tilesetId, categoryId } } as const;
    const paint = { type: "toolCall", id: "paint-floor", name: "paint_tiles", arguments: {
      mapId, referencePurpose: categoryId, layer: "lower", mode: "cells", tile: -1, cells: [{ x: 1, y: 1 }],
    } } as const;
    const paintIndex = map.width + 1;
    expect(map.lowerTiles[paintIndex]).not.toBe(-1);
    let turn = 0;
    const streamFn: StreamFn = (model, context, options) => {
      const toolOutput = context.messages.flatMap(message => message.role === "toolResult"
        ? message.content.flatMap(part => part.type === "text" ? [{ type: "function_call_output", output: part.text }] : [])
        : []);
      void options?.onPayload?.({ input: delivery === "omitted" ? [] : toolOutput }, model, options.signal);
      const calls = turn++ === 0 ? (delivery === "same-turn" ? [read, paint] : [read]) : turn === 2 ? [paint] : [];
      const stopReason = calls.length ? "toolUse" : "stop";
      const content = calls.length ? calls : [{ type: "text", text: "끝" }];
      const message = { role: "assistant", content, api: model.api, provider: model.provider, model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, stopReason, timestamp: Date.now() } as never;
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({ type: "start", partial: message });
        stream.push({ type: "done", reason: stopReason, message });
      });
      return stream;
    };
    const done = await runPiAgent({
      provider: "openai-codex", model: "gpt-6.2-sol", task: "참고문서를 읽고 바닥 한 칸을 비워 줘",
      mapIds: [mapId], project, smallTask: {
        target: { kind: "map", mapId, label: "시험 맵" }, maxToolCalls: 4,
        selection: { rect: { x: delivery === "outside-selection" ? 0 : 1, y: 1, w: 1, h: 1 } },
      },
    }, { streamFn });
    if (delivery === "delivered") {
      expect(done.stoppedEarly).toBeUndefined();
      expect(done.stats.toolCalls).toBe(2);
      expect(done.project.maps[mapId].lowerTiles[paintIndex]).toBe(-1);
    } else {
      expect(done.stoppedEarly).toContain(delivery === "outside-selection"
        ? "선택 영역 바깥 타일" : "타일셋 참고문서 선행 읽기 필요");
      expect(done.project).toBe(project);
    }
  }, 20_000);
}
