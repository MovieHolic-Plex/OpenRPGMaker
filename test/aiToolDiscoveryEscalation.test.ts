import { describe, expect, it } from "vitest";
import { AssistantSession, isWriteToolName, SET_BUILD_SPEC_TOOL, WORK_PLAN_TOOLS, CORRECT_VERIFICATION_TOOL } from "@/ai/assistantSession";
import { activeTools, allTools, runTool, toOpenAiTools } from "@/editor/tools";
import { LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { GET_ORIGINAL_CONTEXT_TOOL } from "@/ai/originalContext";
import { injectToolReasonIntoOpenAiTool } from "@/ai/toolReason";
import { fixedDeclarer } from "./intentFixture";

const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
  agentMode: "chat" as const,
};

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

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

describe("AI tool discovery escalation", () => {
  it.each(["google-antigravity", "openai-codex"])("exposes every active native schema on the first %s request without evicting core reads", async (providerId) => {
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: { ...CHAT_CONFIG, authMode: "chatgpt", providerId, baseUrl: "/v1" },
      chat: async (_config, request) => { requests.push(request); return final("확인했습니다."); },
    });
    await session.sendUserMessage("타이틀 화면 바꿔줘", () => {});
    const tools = requests[0]?.tools ?? [];
    const byName = new Map(tools.map((tool) => [tool.function.name, tool]));
    expect(activeTools().length).toBeGreaterThan(128);
    for (const tool of [...toOpenAiTools(), GET_ORIGINAL_CONTEXT_TOOL, SET_BUILD_SPEC_TOOL].map(injectToolReasonIntoOpenAiTool)) {
      expect(byName.get(tool.function.name)).toEqual(tool);
    }
    for (const name of ["get_database_records", "get_project_summary", "list_resources"]) expect(byName.has(name)).toBe(true);
    for (const tool of allTools().filter((tool) => tool.deprecated)) expect(byName.has(tool.name)).toBe(false);
    expect(byName.size).toBe(tools.length);
  });

  it("retains build, plan and acceptance schemas alongside the full catalog under a minimal prompt budget", async () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(project, {
      config: { ...CHAT_CONFIG, agentMode: "auto" },
      contextOptions: { budgetChars: 1 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, targetMapId: map.id }),
      chat: async (_config, request) => {
        requests.push(request);
        if (!request.tools?.length) return final(JSON.stringify({
          action: "new_plan",
          goal: "Inspect the original map",
          layers: [{ title: "Inspect", items: [{ title: "Read map", instruction: "get_map_region", successTools: ["get_map_region"] }] }],
          acceptance: [{ id: "dimensions", title: "Keep dimensions", criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] }],
        }));
        throw new LlmError("fixture stops after complete request assembly", 422);
      },
    });
    const result = await session.sendUserMessage("Inspect the map and keep its dimensions.", () => {});
    expect(result.stoppedReason).toBe("error");
    expect(session.getAcceptanceSnapshot()).not.toBeNull();
    const firstWorkingRequest = requests.find((request) => request.tools?.length);
    const expected = [...toOpenAiTools(), GET_ORIGINAL_CONTEXT_TOOL, CORRECT_VERIFICATION_TOOL, SET_BUILD_SPEC_TOOL, ...WORK_PLAN_TOOLS, ...ACCEPTANCE_TOOLS]
      .map(injectToolReasonIntoOpenAiTool);
    expect(firstWorkingRequest?.tools).toEqual(expected);
    expect(new Set(firstWorkingRequest?.tools?.map((tool) => tool.function.name)).size).toBe(expected.length);
    expect(JSON.stringify(firstWorkingRequest?.tools).length).toBeGreaterThan(100_000);

    // An existing plan/acceptance ledger must not leak session-owned write tools into ask mode.
    const beforeAsk = requests.length;
    await session.sendUserMessage("What are the current dimensions?", () => {}, undefined, { composerMode: "ask" });
    const askRequest = requests.slice(beforeAsk).find((request) => request.tools?.length);
    expect(askRequest).toBeDefined();
    expect(askRequest?.tools?.filter((tool) => isWriteToolName(tool.function.name))).toEqual([]);
    expect(session.getProposedProject()).toEqual(project);
  });

  it("exposes every active read schema and no writes in question mode", async () => {
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: async (_config, request) => { requests.push(request); return final("확인했습니다."); },
    });
    await session.sendUserMessage("전체 도구와 프로젝트를 확인해줘", () => {}, undefined, { composerMode: "ask" });
    const tools = requests[0]?.tools ?? [];
    const names = tools.map((tool) => tool.function.name);
    expect(names).toEqual(expect.arrayContaining(activeTools().filter((tool) => tool.mode === "read").map((tool) => tool.name)));
    expect(names.filter(isWriteToolName)).toEqual([]);
  });

  it("reports provider rejection instead of retrying with a pruned catalog", async () => {
    const project = createBlankProject();
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(project, {
      config: CHAT_CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        throw new LlmError("tool catalog rejected by fixture upstream", 422);
      },
    });
    const result = await session.sendUserMessage("전체 도구를 확인해줘", () => {});
    expect(requests).toHaveLength(1);
    expect(requests[0]?.tools?.map((tool) => tool.function.name)).toEqual(expect.arrayContaining(activeTools().map((tool) => tool.name)));
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("tool catalog rejected by fixture upstream");
    expect(session.getProposedProject()).toEqual(project);
  });

  it("finds the project-settings facade from Korean and field-name queries", () => {
    for (const query of ["프로젝트 설정", "제목 저자 용어", "terms author"]) {
      const result = runTool({ project: createBlankProject() }, "find_tools", { query });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.data), query).toContain("set_project_settings");
    }
  });

  it("keeps discovered schemas available without changing the complete working catalog", async () => {
    const requests: ChatRequest[] = [];
    const responses = [toolCall("find_tools", { query: "엔딩" }), final("찾았습니다.")];
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        const response = responses.shift();
        if (!response) throw new Error("scripted chat exhausted");
        return response;
      },
    });

    await session.sendUserMessage("마을 만들고 NPC 넣고 퀘스트 주고 상성표 만들고 엔딩 조건까지", () => {});

    const firstNames = requests[0]?.tools?.map((tool) => tool.function.name) ?? [];
    const secondNames = requests[1]?.tools?.map((tool) => tool.function.name) ?? [];
    expect(firstNames).toContain("find_tools");
    expect(firstNames).toEqual(expect.arrayContaining(activeTools().map((tool) => tool.name)));
    const sessionControls = new Set(["correct_verification"]);
    expect(getTool("correct_verification")).toBeUndefined();
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      const controls = request.tools?.filter((tool) => sessionControls.has(tool.function.name)) ?? [];
      expect(controls).toHaveLength(1);
      expect(controls[0]).toMatchObject({ type: "function", function: {
        name: "correct_verification",
        parameters: {
          type: "object", additionalProperties: false,
          required: ["checkId", "args", "reason"],
          properties: {
            checkId: { type: "string" },
            args: { type: "object", additionalProperties: true },
            reason: { type: "string", minLength: 1 },
          },
        },
      } });
      expect(request.tools!.length).toBeGreaterThanOrEqual(activeTools().length);
    }
    expect(secondNames).toContain("define_ending");
    expect(secondNames).toEqual(firstNames);
    const statusTexts = session.getAuditEntries().flatMap((entry) => entry.kind === "status" ? [entry.text] : []);
    expect(statusTexts.filter((text) => text.startsWith("tools:exposed")).length).toBe(2);
    expect(statusTexts.some((text) => text.startsWith("tools:escalated ") && text.includes("define_ending"))).toBe(true);
  });
});
