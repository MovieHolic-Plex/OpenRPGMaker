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
import type { Command, EventPage } from "../src/project/types.ts";

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
  const commands: Command[] = ["처음", "둘째", "마지막"].map(body => ({ kind: "text", body }));
  const page: EventPage = {
    id: "page_selected", name: "인사", commands, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  const event = { id: "event_selected", name: "안내인", x: 2, y: 3, trigger: page.trigger, commands: [],
    pages: [{ ...page, id: "page_other" }, page] };
  project.maps[mapId].events = [event, { ...event, id: "event_other" }];
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

test("작은 일 Pi 실행은 맵 대상에 cmd.delete를 쓰면 거절한다", async () => {
  const { request, project, mapId } = fixture();
  const target = mapTarget(project, mapId)!;
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, target } },
    { streamFn: scripted([apply("cmd.delete", { index: 0 })]) });
  expect(done.stoppedEarly).toContain("범위 밖");
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 Pi 실행은 범위 밖 줄로 이동하면 앞선 삭제도 버린다", async () => {
  const { request, project } = fixture();
  const done = await runPiAgent(request, { streamFn: scripted([
    apply("cmd.delete", { index: 0 }),
    apply("cmd.move", { index: 0, toIndex: 2 }),
  ]) });

  expect(done.stoppedEarly).toContain("도착 위치를 찾을 수 없어요");
  expect(done.stats).toMatchObject({ toolCalls: 2, toolErrors: 1 });
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 Pi 실행은 다른 이벤트를 읽으려 하면 앞선 쓰기까지 버린다", async () => {
  const { request, project, mapId } = fixture();
  const done = await runPiAgent(request, { streamFn: scripted([
    apply("cmd.delete", { index: 0 }),
    { name: "get_event", args: { mapId, eventId: "event_other" } },
  ]) });
  expect(done.stoppedEarly).toBe(SMALL_TASK_SCOPE_REFUSAL);
  expect(done.stats.toolCalls).toBe(2);
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});

test("작은 일 동작도 호출 상한에 포함하고 상한을 넘으면 앞선 쓰기를 버린다", async () => {
  const { request, project } = fixture();
  const done = await runPiAgent({ ...request, smallTask: { ...request.smallTask, maxToolCalls: 1 } }, { streamFn: scripted([
    apply("cmd.delete", { index: 0 }),
    { name: LIST_SMALL_TASK_PRIMITIVES, args: {} },
  ]) });
  expect(done.stoppedEarly).toContain("작업 수를 넘었어요");
  expect(done.stats.toolCalls).toBe(2);
  expect(done.changedKeys).toEqual([]);
  expect(done.project).toBe(project);
});
