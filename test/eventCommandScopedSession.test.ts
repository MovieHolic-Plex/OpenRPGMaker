import { describe, it, expect, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { eventScopeRefusal, onlyEventPageCommandsChanged } from "@/ai/eventCommandScope";
import { fixedDeclarer } from "./intentFixture";

const text = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const call = (name: string, args: object): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify({ ...args, reason: "현재 페이지 명령 수정" }) } }] }, finishReason: "tool_calls" });

function fixture() {
  const project = createBlankProject();
  const scope = { mapId: project.startMapId, eventId: "event-scope", pageId: "page-scope", selection: [0], selectionLabel: "이전 대사" };
  project.maps[scope.mapId].events.push({ id: scope.eventId, x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{
    id: scope.pageId, name: "페이지", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "이전 대사" }],
  }] });
  return { project, scope };
}

describe("event editor shared assistant scope", () => {
  it("uses the session tool loop, enforces scope on hallucinated calls, and reviews the command draft", async () => {
    const { project, scope } = fixture();
    const baseline = structuredClone(project);
    let round = 0;
    let generatorCalls = 0;
    const prepareProjectWiki = vi.fn();
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12, maxTokens: 50000 },
      prepareProjectWiki, declareIntent: fixedDeclarer({ mode: "modify", tools: ["event_command_assist"] }),
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          generatorCalls += 1;
          expect(JSON.stringify(request.messages)).toContain("이전 대사");
          return text('[{"kind":"text","body":"새 대사"}]');
        }
        expect(request.tools.map(t => t.function.name)).not.toContain("upsert_event");
        switch (round++) {
          case 0: return call("upsert_event", { mapId: scope.mapId, event: { id: scope.eventId, x: 99 } });
          case 1: return call("event_command_assist", { ...scope, pageId: "wrong-page", prompt: "수정" });
          case 2: return call("get_event", { mapId: scope.mapId, eventId: scope.eventId });
          case 3: return call("event_command_assist", { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId, prompt: "대사를 고쳐 줘" });
          default: return text("명령 초안을 만들었습니다.");
        }
      },
    });
    const result = await session.sendUserMessage("현재 페이지 대사를 고쳐 줘", undefined, undefined,
      { eventCommandScope: scope, goalAction: "new-goal", autonomous: false, composerMode: "do" });
    expect(prepareProjectWiki).not.toHaveBeenCalled();
    expect(generatorCalls).toBe(1);
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.proposedCalls.map(c => c.name)).toEqual(["event_command_assist"]);
    expect(onlyEventPageCommandsChanged(baseline, session.getProposedProject(), scope)).toBe(true);
    expect(project).toEqual(baseline);
    expect(session.getAuditEntries().filter(e => e.kind === "tool" && e.ok === false)).toHaveLength(2);
  });

  it("rejects out-of-page changes and host mode changes", () => {
    const { project, scope } = fixture();
    const after = structuredClone(project);
    after.meta.title = "다른 변경";
    expect(onlyEventPageCommandsChanged(project, after, scope)).toBe(false);
    expect(eventScopeRefusal(scope, "event_command_assist", { ...scope, mode: "append" })?.ok).toBe(false);
    expect(eventScopeRefusal(scope, "set_title_screen", {})?.ok).toBe(false);
  });
});
