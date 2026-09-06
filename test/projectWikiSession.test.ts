import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ProjectWorld } from "@/project/world/types";
import { fixedDeclarer } from "./intentFixture";

describe("project wiki session checkpoint", () => {
  it("awaits the persisted wiki before intent and authoring consume the project", async () => {
    const project = createEmptyToolProject("Wiki checkpoint");
    const order: string[] = [];
    const world: ProjectWorld = {
      entities: [{
        id: "w_combat",
        type: "guideline",
        name: "Combat decision",
        summary: "Visible monsters open a battle on contact.",
        body: "The player can walk around monsters.",
        origin: "user",
      }],
      relations: [],
    };
    const requests: ChatRequest[] = [];
    const options = {
      config: { ...defaultAiConfig(), agentMode: "chat" as const },
      prepareProjectWiki: async () => {
        order.push("persisted");
        return world;
      },
      declareIntent: async (...args: Parameters<ReturnType<typeof fixedDeclarer>>) => {
        order.push("intent");
        return fixedDeclarer({ mode: "question" })(...args);
      },
      chat: async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
        order.push("authoring");
        requests.push(request);
        return { message: { role: "assistant", content: "Ready." }, finishReason: "stop" };
      },
    };
    const session = new AssistantSession(project, options);

    await session.sendUserMessage("Tell me about this game.");

    expect(order).toEqual(["persisted", "intent", "authoring"]);
    expect(session.getProposedProject().world).toEqual(world);
    expect(requests).toHaveLength(1);
  });

  it("does not start authoring when its wiki persistence checkpoint fails", async () => {
    const calls: string[] = [];
    const options = {
      config: { ...defaultAiConfig(), agentMode: "chat" as const },
      declareIntent: fixedDeclarer({ mode: "question" }),
      prepareProjectWiki: async (): Promise<ProjectWorld> => {
        throw new Error("wiki-save-failed");
      },
      chat: async (): Promise<ChatResult> => {
        calls.push("authoring");
        return { message: { role: "assistant", content: "Ready." }, finishReason: "stop" };
      },
    };
    const session = new AssistantSession(createEmptyToolProject("Wiki failure"), options);

    const result = await session.sendUserMessage("Place a monster.");

    expect(calls).toEqual([]);
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("wiki-save-failed");
  });
});
