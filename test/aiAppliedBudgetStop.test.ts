import { clearTimeout, setTimeout } from "node:timers";
import { setImmediate } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, truncatedTurnText, type SessionEvent } from "@/ai/assistantSession";
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

async function bounded<T>(pending: Promise<T>, controller: AbortController): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error("Budget fixture deadline")); }, 20_000);
    })]);
  } finally { clearTimeout(deadline); }
}

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
    const raw = '타이틀을 두 번 고쳐 "확정"';
    const events: SessionEvent[] = [];
    const checks: { at: string; passed: boolean[] }[] = [];
    const checkedPlan = stop === "max-tool-calls" ? { ...plan, acceptance: [{
      id: "title-integrity", title: "Verify the current title project with native lint",
      criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }],
    }] } : plan;
    const read = tool("get_project_summary", {}, "read");
    const final = tool("set_title_screen", { title: "확정" }, "final", stop === "token-budget" ? 1024 : 0);
    if (stop === "max-tool-calls") {
      // Real new checker evidence changes round-three acceptance; a repeated summary alone cannot.
      read.message.tool_calls!.push(...tool("run_lint", {}, "check-draft").message.tool_calls!);
    }
    const script: ChatResult[] = [
      { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", ...checkedPlan }) }, finishReason: "stop" } as ChatResult,
      tool("set_work_plan", checkedPlan, "plan"),
      tool("set_title_screen", { title: "초안" }, "draft", stop === "token-budget" ? 1024 : 0),
      read,
      final,
      // Native application invalidates pre-apply verdicts too; verify the accepted final revision.
      ...(stop === "max-tool-calls" ? [tool("run_lint", {}, "check-final")] : []),
    ];
    const session = new AssistantSession(project, {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, requestRequirements: { entries: [{
        source: [{ start: 0, end: raw.length, quote: raw }],
        criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "확정" }],
        bindings: [{ source: { start: raw.indexOf('"'), end: raw.length, quote: '"확정"' }, role: "value", criterionIndex: 0, fieldPath: ["value"] }],
      }] } }),
      yieldToUi: () => setImmediate(),
      chat: async () => {
        const next = script.shift();
        if (!next) throw Object.assign(new Error("script exhausted"), { status: 401, name: "LlmError" });
        return next;
      },
    });
    const controller = new AbortController();
    const pending = session.sendUserMessage(raw, event => {
      events.push(event);
      if (stop !== "max-tool-calls") return;
      const row = session.getAcceptanceSnapshot()?.items.find(item => item.id === "title-integrity");
      if (event.type === "tool_call" && (event.name === "run_lint" || event.name === "set_title_screen")) {
        checks.push({ at: event.name === "set_title_screen" ? String(event.args.title) : "lint", passed: row?.evidence.map(evidence => evidence.passed) ?? [] });
      }
      if (event.type === "run_state" && event.execution.segment === 2 && event.execution.rounds === 0) {
        checks.push({ at: "segment-2", passed: row?.evidence.map(evidence => evidence.passed) ?? [] });
      }
    }, controller.signal, { autonomous: true });
    let result;
    try { result = await bounded(pending, controller); }
    finally { controller.abort(); await bounded(pending, controller); }
    expect(result.stoppedReason, JSON.stringify({ error: result.error, events: events.filter(event => event.type === "run_state"), audit: session.getAuditEntries().filter(entry => entry.kind === "status") })).toBe("final");
    expect(result.appliedCalls).toHaveLength(2);
    expect(result.proposedCalls).toHaveLength(0);
    expect(store.getCurrent().meta?.title).toBe("확정");
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["초안", "확정"]);
    expect(events.filter(event => event.type === "tool_call").map(event => event.name)).toEqual(stop === "max-tool-calls"
      ? ["set_work_plan", "set_title_screen", "get_project_summary", "run_lint", "set_title_screen", "run_lint", "run_lint"]
      : ["set_work_plan", "set_title_screen", "get_project_summary", "set_title_screen", "run_lint"]);
    for (const id of ["plan", "draft", "read", "final", ...(stop === "max-tool-calls" ? ["check-draft", "check-final"] : [])]) {
      expect(session.getMessages().filter(message => message.role === "tool" && message.tool_call_id === id)).toHaveLength(1);
    }
    if (stop === "max-tool-calls") {
      expect(checks).toEqual([
        { at: "초안", passed: [false] }, { at: "lint", passed: [true] },
        { at: "segment-2", passed: [true] }, { at: "확정", passed: [false] },
        { at: "lint", passed: [false] }, { at: "lint", passed: [true] },
      ]);
      expect(session.getAcceptanceSnapshot()?.items.map(item => [item.id, item.status])).toEqual([
        ["request-1:source:0", "verified"], ["title-integrity", "verified"],
      ]);
      expect(events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call" && event.name === "run_lint").map(event => event.result)).toEqual([
        expect.objectContaining({ ok: true, data: expect.objectContaining({ counts: expect.objectContaining({ errors: 0 }) }) }),
        expect.objectContaining({ ok: true, data: expect.objectContaining({ counts: expect.objectContaining({ errors: 0 }) }) }),
        expect.objectContaining({ ok: true, data: expect.objectContaining({ counts: expect.objectContaining({ errors: 0 }) }) }),
      ]);
    }
    expect(config.maxToolCalls).toBe(3);
    expect(config.maxTokens).toBe(1024);
    expect(session.getHarnessSnapshot().requests).toMatchObject([{ requestId: "request-1", rawInstruction: raw, units: [{ id: "request-1:source:0", coverage: "declared" }] }]);
    expect(new Set(events.filter(event => event.type === "run_state").map(event => event.execution.requestId))).toEqual(new Set(["request-1"]));
    expect(events.filter(event => event.type === "run_state").some(event => event.execution.segment > 1)).toBe(true);
    const boundaries = session.getAuditEntries().flatMap(entry => entry.kind === "status" ? [entry.text] : []).filter(text => /^턴 종료\((max-tool-calls|token-budget)\)/u.test(text));
    expect(boundaries, JSON.stringify(session.getAuditEntries().filter(entry => entry.kind === "status"))).toContainEqual(expect.stringMatching(new RegExp(`^턴 종료\\(${stop}\\)`)));
    expect(script).toEqual([]);
  }, 30000);

  it("적용과 미적용 제안을 구분하고 승인 여부를 추측하지 않는다", () => {
    const text = truncatedTurnText("", 3, "도구 호출 예산", 7);
    expect(text).toContain("변경 7건은 이미 프로젝트에 적용했습니다");
    expect(text).toContain("적용 전인 제안 3건");
    expect(text).not.toMatch(/승인 대기|수락하면/);
    const appliedOnly = truncatedTurnText("", 0, "도구 호출 예산", 2);
    expect(appliedOnly.match(/\d+건/gu)).toEqual(["2건"]);
  });
});
