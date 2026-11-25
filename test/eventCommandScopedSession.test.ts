import { describe, it, expect, vi } from "vitest";
import { AssistantSession, type ChatFn } from "@/ai/assistantSession";
import { resolveContextWindow } from "@/ai/contextCompaction";
import { emptyIntentDeclaration, type IntentDeclaration } from "@/ai/intentDeclaration";
import { defaultAiConfig, type ChatMessage, type ChatResult } from "@/ai/llmClient";
import { buildSessionRegistryTools } from "@/ai/sessionToolExposure";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { createStarterBlankProject } from "@/project/defaults";
import { toolHiddenByMonsterLock } from "@/project/genreLockMonsterAssets";
import { eventScopeRefusal, eventScopeToolCall, onlyEventPageCommandsChanged, type EventCommandScope } from "@/ai/eventCommandScope";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import type { JsonSchema } from "@/editor/tools/types";
import type { Command } from "@/project/types";

const text = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const call = (name: string, args: object): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify({ ...args, reason: "현재 페이지 명령 수정" }) } }] }, finishReason: "tool_calls" });

const target = { mapId: "map-scope", eventId: "event-scope", pageId: "page-scope" };

function fixture() {
  const project = createStarterBlankProject();
  const scope = { ...target, mapId: project.startMapId, selection: [0], selectionLabel: "이전 대사" };
  const map = project.maps[scope.mapId];
  project.tilesets = { [map.tilesetId]: project.tilesets[map.tilesetId] };
  const original: Command[] = [{ kind: "text", body: "이전 대사" }];
  map.events.push({ id: scope.eventId, x: 2, y: 2, trigger: { kind: "action" }, commands: original, pages: [{
    id: scope.pageId, name: "페이지", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: original,
  }] });
  return { project, scope, original };
}

describe("event editor shared assistant scope", () => {
  it("keeps the origin/main tool catalog for a non-scoped event request", async () => {
    const { project } = fixture();
    const prompt = "Review this event's commands";
    const config = { ...defaultAiConfig(), agentMode: "chat" as const };
    const intent: IntentDeclaration = { ...emptyIntentDeclaration(), source: "llm", tools: ["run_lint", "event_command_assist"] };
    const chat = vi.fn<ChatFn>(async () => text("검토했습니다."));
    const session = new AssistantSession(project, { config, chat, declareIntent: async () => ({ intent, elapsedMs: 0 }) });
    const result = await session.sendUserMessage(prompt, undefined, undefined, { autonomous: false });

    expect(result.stoppedReason, result.error).toBe("final");
    expect(chat).toHaveBeenCalledTimes(1);
    const exposed = chat.mock.calls[0][1].tools?.map(tool => tool.function.name);
    // origin/main's non-scoped path uses the registry plus the session control tools.
    const registry = buildSessionRegistryTools({ requestText: prompt, intent, contextWindow: resolveContextWindow(config.model),
      requiredReadTools: new ToolReadEvidence().requiredReadTools(),
      hideTool: name => toolHiddenByMonsterLock(project, name, { monsterTurn: false }) });
    expect(exposed).toEqual([...registry.map(tool => tool.function.name), "get_original_context", "correct_verification", "set_build_spec"]);
    expect(exposed).toEqual(expect.arrayContaining([
      "get_map_region", "get_project_summary", "find_events", "find_layout_regions", "list_resources",
      "get_event", "get_database_records", "run_lint",
    ]));
  }, 60_000);

  it.each(["with no system message", "with oversized shared history"])("writes the current dock request without the outer model %s", async history => {
    const { project, scope } = fixture();
    const prompt = "대사를 한 줄 추가해 줘";
    const rejected = call("get_event", scope);
    const chat = vi.fn<ChatFn>(async () => text('[{"kind":"text","body":"새 대사"}]'));
    const session = new AssistantSession(project, { config: defaultAiConfig(), chat });
    const prior: ChatMessage[] = history === "with no system message" ? [] : [
      { role: "system", content: "공용 조수 시스템 지시" },
      { role: "user", content: "지난 요청 ".repeat(400_000) },
      { role: "system", content: "지난 시스템 지시" },
      rejected.message,
      { role: "tool", tool_call_id: "call-get_event", content: "지난 조회" },
    ];
    session["messages"].splice(0, session["messages"].length, ...prior);

    const result = await session.sendUserMessage(prompt, undefined, undefined, { eventCommandScope: scope, goalAction: "new-goal" });

    expect(result.stoppedReason, result.error).toBe("final");
    // 한 번뿐: 도구 안의 명령 생성기(도구 없는 요청). 로컬 CLI 처럼 도구를 못 부르는 바깥 모델은 거치지 않는다(#5099).
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][1].tools ?? []).toEqual([]);
    expect(JSON.stringify(chat.mock.calls[0][1].messages)).not.toContain("지난 요청");
    expect(result.proposedCalls.map(c => c.name)).toEqual(["event_command_assist"]);
    expect(session.getProposedProject().maps[scope.mapId].events.find(e => e.id === scope.eventId)?.pages?.[0].commands.at(-1)).toEqual({ kind: "text", body: "새 대사" });
    expect(session.getMessages().slice(0, prior.length)).toEqual(prior);
  }, 60_000);

  it.each(["edit", "append"] as const)("reviews an append draft with host mode %s from one generator call", async mode => {
    const { project, scope: eventScope, original } = fixture();
    const scope: EventCommandScope = { ...eventScope, mode };
    const baseline = structuredClone(project);
    let round = 0;
    let generatorCalls = 0;
    const prepareProjectWiki = vi.fn();
    const declareIntent = vi.fn();
    const prompt = "add a Show Text command saying hello";
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12, maxTokens: 50000 },
      prepareProjectWiki, declareIntent,
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          generatorCalls += 1;
          expect(JSON.stringify(request.messages)).toContain("뒤에 붙일 커맨드 JSON 배열");
          return text('[{"kind":"text","body":"hello"}]');
        }
        expect(request.tools.map(t => t.function.name)).toEqual(["event_command_assist"]);
        const tool = request.tools[0].function;
        expect(tool.description).not.toContain("get_event");
        const schema = tool.parameters as JsonSchema;
        expect(schema.properties?.mode?.enum).toEqual(mode === "append" ? ["append"] : ["edit", "append"]);
        expect(schema.required?.includes("mode")).toBe(mode === "append");
        expect(request.messages[0].role).toBe("system");
        expect(request.messages[0].content).toContain(JSON.stringify({
          mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId,
        }));
        expect(request.messages[0].content).toContain(schema.properties?.mode?.description);
        expect(request.messages[0].content).toContain('"firstCommandKinds":["text"]');
        expect(request.messages.filter(message => message.role === "user").map(message => message.content)).toEqual([prompt]);
        switch (round++) {
          case 0: return call("get_project_summary", {});
          case 1: return call("event_command_assist", { mapId: scope.mapId, eventId: scope.eventId, pageId: "wrong-page", prompt, mode: "append" });
          case 2: return call("event_command_assist", { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId, prompt, mode: "append" });
          default: return text("명령 초안을 만들었습니다.");
        }
      },
    });
    const result = await session.sendUserMessage(prompt, undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", autonomous: false, composerMode: "do" });
    expect(prepareProjectWiki).not.toHaveBeenCalled();
    expect(declareIntent).not.toHaveBeenCalled();
    expect(round).toBe(0);
    expect(generatorCalls).toBe(1);
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.proposedCalls.map(c => c.name)).toEqual(["event_command_assist"]);
    const proposed = session.getProposedProject();
    expect(onlyEventPageCommandsChanged(baseline, proposed, scope)).toBe(true);
    const proposedEvent = proposed.maps[scope.mapId].events[0];
    expect(proposedEvent.pages?.[0].commands).toEqual([...original, { kind: "text", body: "hello" }]);
    expect(proposedEvent.commands).toEqual(original);
    expect(project).toEqual(baseline);
    const audit = session.getAuditEntries();
    expect(audit.filter(e => e.kind === "user").map(e => e.text)).toEqual([prompt]);
    expect(audit.filter(e => e.kind === "tool" && e.ok === false).map(e => e.name)).toEqual([]);
  }, 60_000);

  it.each([false, true])("stops after the first successful switch draft (duplicate in batch: %s)", async duplicateInBatch => {
    const { project, scope, original } = fixture();
    const prompt = "스위치 1번을 켜는 명령 추가";
    const switchId = project.switches[0].id;
    const setSwitch: Command = { kind: "setSwitch", switchId, value: true };
    const fork: Command = { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [setSwitch], else: [] };
    const args = { ...target, mapId: scope.mapId, prompt, mode: "append" };
    const writerCall = call("event_command_assist", args);
    const followupCall = call("event_command_assist", { ...args, prompt: "분기 명령 추가" }).message.tool_calls![0];
    const extraCall = { ...followupCall, id: "extra-writer" };
    let outerCalls = 0;
    let generatorCalls = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "auto", maxToolCalls: 8, maxTokens: 50000 },
      chat: async (_config, request) => {
        if (!request.tools?.length) return text(JSON.stringify([++generatorCalls === 1 ? setSwitch : fork]));
        if (++outerCalls === 1) {
          if (duplicateInBatch) writerCall.message.tool_calls!.push(extraCall);
          return writerCall;
        }
        return outerCalls === 2 ? { ...writerCall, message: { ...writerCall.message, tool_calls: [extraCall] } } : text("완료");
      },
    });
    const result = await session.sendUserMessage(prompt, undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", autonomous: true, composerMode: "do" });
    expect(outerCalls).toBe(0);
    expect(generatorCalls).toBe(1);
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.assistantText).toContain("명령 초안");
    expect(result.review?.status).toBe("approved");
    expect(result.runOutcome?.delivery).toBe("draft");
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(result.proposedCalls.map(c => c.name)).toEqual(["event_command_assist"]);
    expect(session.getProposedProject().maps[scope.mapId].events[0].pages?.[0].commands).toEqual([...original, setSwitch]);
    expect(project.maps[scope.mapId].events[0].pages?.[0].commands).toEqual(original);
    const messages = session.getHarnessSnapshot().messages;
    const callIds = messages.flatMap(message => message.tool_calls?.map(tc => tc.id) ?? []);
    expect(messages.filter(message => message.role === "tool").map(message => message.tool_call_id)).toEqual(callIds);
    expect(messages.some(message => message.tool_call_id === extraCall.id)).toBe(false);
  }, 60_000);

  it("ends a successful no-op without creating a proposal", async () => {
    const { project, scope, original } = fixture();
    const prompt = "명령을 그대로 유지해 줘";
    const chat = vi.fn<ChatFn>(async (_config, request) => request.tools?.length
      ? call("event_command_assist", { ...target, mapId: scope.mapId, prompt })
      : text(JSON.stringify(original)));
    const session = new AssistantSession(project, { config: defaultAiConfig(), chat });
    const result = await session.sendUserMessage(prompt, undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", composerMode: "do" });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("변경 없음");
    expect(result.proposedCalls).toEqual([]);
    expect(result.runOutcome?.delivery).toBe("no-change");
    expect(session.getAuditEntries().filter(entry => entry.kind === "assistant").at(-1)).toMatchObject({ text: "변경 없음" });
  }, 60_000);

  it("reports a failed writer after three attempts across batches", async () => {
    const { project, scope, original } = fixture();
    const prompt = "명령 추가";
    let outerCalls = 0;
    let generatorCalls = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), maxToolCalls: 8, maxTokens: 50000 },
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          generatorCalls += 1;
          throw new Error("생성기 테스트 오류");
        }
        outerCalls += 1;
        const response = call("event_command_assist", { ...target, mapId: scope.mapId, prompt });
        const toolCall = response.message.tool_calls![0];
        response.message.tool_calls = [{ ...toolCall, id: `writer-${outerCalls}` }, { ...toolCall, id: `duplicate-${outerCalls}` }];
        return response;
      },
    });
    const result = await session.sendUserMessage(prompt, undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", composerMode: "do" });
    expect(outerCalls).toBe(1);
    expect(generatorCalls).toBe(3);
    expect(result.stoppedReason).toBe("error");
    expect(result.assistantText).toContain("다시 시도해 주세요");
    expect(result.assistantText).toContain("생성기 테스트 오류");
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject().maps[scope.mapId].events[0].pages?.[0].commands).toEqual(original);
  }, 60_000);

  it("picks append for add requests and keeps the user's words as the prompt", () => {
    const args = (text: string, mode?: "edit" | "append") => JSON.parse(eventScopeToolCall({ ...target, ...(mode ? { mode } : {}) }, text).function.arguments);
    expect(args("  상점 주인 말투를 반말로 ")).toEqual({ ...target, prompt: "상점 주인 말투를 반말로" });
    expect(args("대사 한 줄 추가해 줘").mode).toBe("append");
    expect(args("컷신에서 3번째 대사 지워", "append").mode).toBe("append");
    expect(eventScopeRefusal(target, "event_command_assist", args("대사 한 줄 추가해 줘"))).toBeNull();
  });

  it("rejects out-of-page changes", () => {
    const { project, scope } = fixture();
    const after = structuredClone(project);
    after.meta.title = "다른 변경";
    expect(onlyEventPageCommandsChanged(project, after, scope)).toBe(false);
  });

  it.each(["mapId", "eventId", "pageId"] as const)("refuses to append with a different %s", key => {
    const result = eventScopeRefusal(target, "event_command_assist", { ...target, [key]: "wrong-target", mode: "append" });
    expect(result?.issues?.[0]?.code).toBe("event-page-scope");
  });

  it("defaults to edit only when the host permits editing", () => {
    expect(eventScopeRefusal(target, "event_command_assist", target)).toBeNull();
    expect(eventScopeRefusal(target, "event_command_assist", { ...target, mode: "edit" })).toBeNull();
    const appendScope: EventCommandScope = { ...target, mode: "append" };
    for (const args of [target, { ...target, mode: "edit" }]) {
      const result = eventScopeRefusal(appendScope, "event_command_assist", args);
      expect(result?.issues?.[0]?.code).toBe("event-page-scope");
      expect(result?.summary).toContain("mode에 append를 명시하세요");
    }
  });

  it.each(["get_event", "get_map_region", "get_project_summary", "find_events", "get_database_records", "upsert_event", "set_title_screen"])("refuses %s and explains how to call the scoped tool", (name) => {
    const refusal = eventScopeRefusal(target, name, target);
    expect(refusal?.ok).toBe(false);
    expect(refusal?.issues?.[0]?.code).toBe("event-page-scope");
    expect(refusal?.summary).toContain("event_command_assist에");
    expect(refusal?.summary).toContain(target.pageId);
    expect(refusal?.summary).toContain("다시 호출하세요");
  });

  it("also rejects out-of-scope tools at the async execution boundary", async () => {
    const { project, scope } = fixture();
    const result = await runToolAsync({ project }, "get_event", scope, { eventCommandScope: scope });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("event-page-scope");
  });

  it("refuses an edit in append scope before the async runner generates anything", async () => {
    const { project, scope } = fixture();
    const generate = vi.fn();
    const result = await runToolAsync({ project }, "event_command_assist", { ...scope, mode: "edit", prompt: "대사를 고쳐 줘" }, {
      eventCommandScope: { ...scope, mode: "append" }, generate,
    });
    expect(result.issues?.[0]?.code).toBe("event-page-scope");
    expect(generate).not.toHaveBeenCalled();
  });
});
