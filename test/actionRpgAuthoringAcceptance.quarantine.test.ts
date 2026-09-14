import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

type Call = { readonly name: string; readonly args: Record<string, unknown> };

function acceptanceSession(action: boolean, failsScene: boolean) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const target = { mapId: map.id };
  const intent = {
    mode: "modify" as const,
    targetMapId: map.id,
    ...(action ? { actionCombat: { targets: [target] } } : {}),
  };
  const rounds: readonly (readonly Call[])[] = [
    [{
      name: "set_work_plan",
      args: {
        goal: "Verify the requested arena",
        layers: [{
          title: "Verification",
          items: [{ id: "verify-arena", title: "Verify arena", instruction: "Check the requested behavior", successTools: ["run_scene_test"] }],
        }],
        acceptance: [{
          id: "arena-shape", title: "Arena",
          criteria: [{ kind: "mapDimensions", target, width: map.width, height: map.height }],
        }],
      },
    }],
    [{
      name: "run_scene_test",
      args: {
        mapId: map.id, start: project.startPos,
        steps: failsScene
          ? [{ kind: "expect", playerAt: { x: 0, y: 0 } }]
          : [{ kind: "wait", ticks: 1 }],
      },
    }, { name: "skip_work_item", args: {} }],
  ];
  let cursor = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
    declareIntent: fixedDeclarer(intent),
    chat: async (): Promise<ChatResult> => {
      const batch = rounds[cursor++];
      return batch ? {
        message: {
          role: "assistant", content: null,
          tool_calls: batch.map((call, index) => ({
            id: `round-${cursor}-${index}`, type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.args) },
          })),
        },
        finishReason: "tool_calls",
      } : { message: { role: "assistant", content: "SCRIPTED_COMPLETE" }, finishReason: "stop" };
    },
  });
  return {
    session, events,
    run: () => session.sendUserMessage("Check the requested arena", event => events.push(event)),
  };
}

describe("action authoring acceptance through the real session", () => {
  it("does not replace declared attack and dodge proof with a passing wait-only scene", async () => {
    const fixture = acceptanceSession(true, false);

    const result = await fixture.run();

    expect(fixture.events.some(event => event.type === "tool_call" && event.name === "run_scene_test" && event.result.ok)).toBe(true);
    expect(fixture.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(result.assistantText).not.toBe("SCRIPTED_COMPLETE");
  });

  it("keeps a failed mandatory scene unverified even when spatial criteria pass and work is skipped", async () => {
    const fixture = acceptanceSession(false, true);

    await fixture.run();

    expect(fixture.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("skipped");
    expect(fixture.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
  });
});
