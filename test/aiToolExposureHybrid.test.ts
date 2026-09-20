import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { activeTools, runTool } from "@/editor/tools";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { buildSessionRegistryTools } from "@/ai/sessionToolExposure";
import { declaredIntent, fixedDeclarer } from "./intentFixture";

const CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "stub-model",
  liteModel: "stub-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
  agentMode: "chat" as const,
};

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

function toolCall(name: string, args: Record<string, unknown>): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function names(request: ChatRequest | undefined): string[] {
  return request?.tools?.map((tool) => tool.function.name) ?? [];
}

describe("hybrid assistant tool exposure", () => {
  it("keeps the first catalog small while retaining RPG foundation tools", () => {
    const tools = buildSessionRegistryTools({
      requestText: "중세 게임 RPG를 만들어줘",
      intent: declaredIntent({
        needsPlan: true,
        adventure: { village: true, dungeon: true, party: true, battle: true, world: true, characters: true, appearance: true },
      }),
    });
    const exposed = new Set(tools.map((tool) => tool.function.name));

    expect([...exposed]).toEqual(expect.arrayContaining(["find_tools", "get_project_summary", "get_database_records", "set_world_canon", "upsert_character_profile", "upsert_actor", "set_party", "set_session_start"]));
    expect(tools.length).toBeLessThan(activeTools().length);
    expect(tools.length).toBeLessThan(80);
    const selectedChars = JSON.stringify(tools.map(tool => tool.function)).length;
    const fullChars = JSON.stringify(activeTools().map(({ name, description, parameters }) => ({ name, description, parameters }))).length;
    expect(selectedChars).toBeLessThan(fullChars * 0.4);
  });

  it("restores the complete registry only when fallback is requested", () => {
    const tools = buildSessionRegistryTools({
      requestText: "알 수 없는 편집 기능",
      intent: declaredIntent(),
      fullCatalogFallback: true,
    });
    expect(tools.map((tool) => tool.function.name)).toEqual(activeTools().map((tool) => tool.name));
    expect(buildSessionRegistryTools({ requestText: "중립 요청", intent: null }).map((tool) => tool.function.name))
      .toEqual(activeTools().map((tool) => tool.name));
  });

  it("adds discovered schemas on the next round", () => {
    const first = buildSessionRegistryTools({ requestText: "엔딩을 만들어줘", intent: declaredIntent() });
    const second = buildSessionRegistryTools({
      requestText: "엔딩을 만들어줘",
      intent: declaredIntent(),
      discoveredToolNames: ["define_ending"],
    });
    expect(first.map((tool) => tool.function.name)).not.toContain("define_ending");
    expect(second.map((tool) => tool.function.name)).toContain("define_ending");
  });

  it("switches to the full catalog after a successful empty discovery", async () => {
    const direct = runTool({ project: createBlankProject() }, "find_tools", { query: "쀍쀍쀍쀍쀍" });
    expect(direct.ok).toBe(true);
    expect(direct.data).toEqual({ matches: [] });
    const requests: ChatRequest[] = [];
    const responses = [
      toolCall("find_tools", { query: "쀍쀍쀍쀍쀍" }),
      final("전체 기능을 확인했습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: async (_config, request) => {
        requests.push(request);
        const response = responses.shift();
        if (!response) throw new Error("scripted chat exhausted");
        return response;
      },
    });

    await session.sendUserMessage("존재하지 않는 기능을 찾아줘", () => {});

    expect(requests).toHaveLength(2);
    expect(names(requests[0])).toContain("find_tools");
    expect(names(requests[0]).length).toBeLessThan(activeTools().length);
    expect(names(requests[1])).toEqual(expect.arrayContaining(activeTools().map((tool) => tool.name)));
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.includes("tools:fallback full-catalog"))).toBe(true);
  });

  it("promotes a searched schema without sending the full catalog", async () => {
    const requests: ChatRequest[] = [];
    const responses = [
      toolCall("find_tools", { query: "엔딩" }),
      final("엔딩 툴을 찾았습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: async (_config, request) => {
        requests.push(request);
        const response = responses.shift();
        if (!response) throw new Error("scripted chat exhausted");
        return response;
      },
    });

    await session.sendUserMessage("엔딩을 찾아줘", () => {});

    expect(requests).toHaveLength(2);
    expect(names(requests[1])).toContain("define_ending");
    expect(names(requests[1]).length).toBeLessThan(activeTools().length);
  });
});
