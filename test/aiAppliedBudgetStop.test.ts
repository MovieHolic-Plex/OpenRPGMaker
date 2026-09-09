import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, truncatedTurnText, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type AiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";

const config: AiConfig = {
  ...defaultAiConfig(),
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
  };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("독립 검수 전 예산 중단", () => {
  it.each(["max-tool-calls", "token-budget"])("%s에서 적용 0건과 검수 전 제안 2건을 구분한다", async (stop) => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
    const project = createBlankProject();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
    const baseline = structuredClone(store.getCurrent());
    const commit = vi.spyOn(commits, "recordProjectCommit");
    const events: SessionEvent[] = [];
    const reviewer = vi.fn(approvedReviewResponse);
    const script: ChatResult[] = [
      tool("set_work_plan", plan, "plan"),
      tool("set_title_screen", { title: "초안" }, "draft"),
      tool("set_title_screen", { title: "확정" }, "final", stop === "token-budget" ? 1024 : 0),
    ];
    const session = new AssistantSession(project, {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          const review = reviewer(request);
          if (review) return review;
          return { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", ...plan }) }, finishReason: "stop" };
        }
        const next = script.shift();
        if (!next) throw Object.assign(new Error("script exhausted"), { status: 401, name: "LlmError" });
        return next;
      },
    });
    const result = await session.sendUserMessage(plan.goal, event => events.push(event), undefined, { autonomous: true });
    expect(result.stoppedReason).toBe(stop);
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(result.proposedCalls.map(call => ({ name: call.name, title: call.args.title, ok: call.result.ok }))).toEqual([
      { name: "set_title_screen", title: "초안", ok: true },
      { name: "set_title_screen", title: "확정", ok: true },
    ]);
    expect(result.review?.status).toBe("unapproved");
    expect(session.isDraftReviewApproved()).toBe(false);
    expect(session.getProposedProject().meta.title).toBe("확정");
    expect(store.getCurrent()).toEqual(baseline);
    expect(getMapEditHistoryEntries()).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
    expect(events.filter(event => event.type === "milestone_applied" || event.type === "result_review")).toEqual([]);
    expect(reviewer.mock.results.every(result => result.value === null)).toBe(true);
  }, 30000);

  it("적용과 미적용 제안을 구분하고 승인 여부를 추측하지 않는다", () => {
    const text = truncatedTurnText("", 3, "도구 호출 예산", 7);
    expect(text).toContain("변경 7건은 이미 프로젝트에 적용했습니다");
    expect(text).toContain("적용 전인 제안 3건");
    expect(text).not.toMatch(/승인 대기|수락하면/);
  });
});
