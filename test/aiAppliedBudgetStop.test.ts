import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, truncatedTurnText } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";

const config = {
  authMode: "apiKey" as const, agentMode: "auto" as const,
  baseUrl: "x", model: "supervisor-model", liteModel: "executor-model", apiKey: "sk",
  maxToolCalls: 3, maxTokens: 1024,
};
const plan = {
  goal: "타이틀을 두 번 고쳐 확정",
  layers: [{ title: "타이틀", items: [
    { title: "초안", instruction: "set_title_screen으로 초안", successTools: ["set_title_screen"] },
    { title: "확정", instruction: "set_title_screen으로 확정", successTools: ["set_title_screen"] },
  ] }],
};
function tool(name: string, args: unknown, id: string, tokens = 0): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
    usage: { prompt_tokens: 1, completion_tokens: tokens, total_tokens: tokens + 1 },
  } as ChatResult;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("이미 적용된 변경이 있는 예산 중단", () => {
  it.each(["max-tool-calls", "token-budget"] as const)("%s에서 적용 2건·미적용 0건을 정확히 보고한다", async (stop) => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
    const project = createBlankProject();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
    const script: ChatResult[] = [
      { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", ...plan }) }, finishReason: "stop" } as ChatResult,
      tool("set_work_plan", plan, "plan"),
      tool("set_title_screen", { title: "초안" }, "draft"),
      tool("set_title_screen", { title: "확정" }, "final", stop === "token-budget" ? 1024 : 0),
    ];
    const session = new AssistantSession(project, {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async () => {
        const next = script.shift();
        if (!next) throw Object.assign(new Error("script exhausted"), { status: 401, name: "LlmError" });
        return next;
      },
    });
    const result = await session.sendUserMessage(plan.goal, () => {}, undefined, { autonomous: true });
    expect(result.stoppedReason).toBe(stop);
    expect(result.appliedCalls).toHaveLength(2);
    expect(result.proposedCalls).toHaveLength(0);
    expect(store.getCurrent().meta?.title).toBe("확정");
    expect(result.assistantText).toContain("변경 2건은 이미 프로젝트에 적용했습니다");
    expect(result.assistantText).not.toMatch(/만들지 못했습니다|변경 없음|승인 대기|수락하면/);
  }, 30000);

  it("적용과 미적용 제안을 구분하고 승인 여부를 추측하지 않는다", () => {
    const text = truncatedTurnText("", 3, "도구 호출 예산", 7);
    expect(text).toContain("변경 7건은 이미 프로젝트에 적용했습니다");
    expect(text).toContain("적용 전인 제안 3건");
    expect(text).not.toMatch(/승인 대기|수락하면/);
  });
});
