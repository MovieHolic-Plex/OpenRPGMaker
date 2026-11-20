import { describe, it, expect, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createStarterBlankProject } from "@/project/defaults";
import { eventScopeRefusal, onlyEventPageCommandsChanged, type EventCommandScope } from "@/ai/eventCommandScope";
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
  it.each(["edit", "append"] as const)("reviews an append draft with host mode %s and refuses out-of-scope calls", async mode => {
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
        expect(request.messages[0].content).toContain(round < 4 ? '"firstCommandKinds":["text"]' : '"firstCommandKinds":["text","text"]');
        expect(request.messages.filter(message => message.role === "user").map(message => message.content)).toEqual([prompt]);
        switch (round++) {
          case 0: return call("get_project_summary", {});
          case 1: return call("event_command_assist", { mapId: scope.mapId, eventId: scope.eventId, pageId: "wrong-page", prompt, mode: "append" });
          case 2: return call("get_event", { mapId: scope.mapId, eventId: scope.eventId });
          case 3: return call("event_command_assist", { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId, prompt, mode: "append" });
          default: return text("명령 초안을 만들었습니다.");
        }
      },
    });
    const result = await session.sendUserMessage(prompt, undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", autonomous: false, composerMode: "do" });
    expect(prepareProjectWiki).not.toHaveBeenCalled();
    expect(declareIntent).not.toHaveBeenCalled();
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
    expect(audit.filter(e => e.kind === "tool" && e.ok === false).map(e => e.name))
      .toEqual(["get_project_summary", "event_command_assist", "get_event"]);
  }, 60_000);

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
