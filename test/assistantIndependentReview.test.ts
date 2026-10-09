// 초안 검수 — 2026-09-17 독립 검수(LLM 재심사) 해체 이후 계약.
//
// 승인 기준은 하나다: 변경된 맵의 lint error 가 0 이다. 검수 모델 호출은 없다(reviewRequests 는 항상 0).
// 예산 소진은 초안 폐기가 아니다 — 결정적 검사를 통과하면 final 로 바뀌어 적용된다.
// 실측 근거: PR #892 후속 코멘트(세 런 모두 max-tool-calls 로 초안 전량 폐기, 검수 요약과 판정의 모순).
import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, deterministicDraftFindings } from "@/ai/assistantSession";
import { independentReviewPayload as payload, imageDeliveryForRequest } from "./independentReviewFixture";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getTool } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";

const text = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function call(name: string, args: object): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: `${name}_${Math.random().toString(36).slice(2, 8)}`, type: "function",
    function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}
const clean = { summary: "lint: error 0건", data: { counts: { errors: 0, warnings: 0, infos: 0 }, issues: [] } };
const broken = { summary: "lint: error 1건", data: { counts: { errors: 1, warnings: 0, infos: 0 }, issues: [
  { severity: "error", code: "start-position", mapId: createBlankProject().startMapId, x: 1, y: 1, message: "시작 위치가 통행 불가 타일입니다: (1, 1)" },
] } };


/** 결정적 검사는 기준선 → 초안 순으로 run_lint 를 두 번 부른다. 기준선은 깨끗하고 초안만 깨진 상황. */
function draftOnlyBroken() {
  let calls = 0;
  return vi.spyOn(getTool("run_lint")!, "run").mockImplementation(() => (calls++ % 2 === 0 ? clean : broken));
}

function fixture(options: { rounds?: ChatResult[]; maxToolCalls?: number; maxTokens?: number } = {}) {
  const project = createBlankProject();
  const requests: ChatRequest[] = [];
  const reviewRequests: ChatRequest[] = [];
  const rounds = options.rounds ?? [call("set_title_screen", { title: "Reviewed title" })];
  const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: options.maxToolCalls ?? 15, maxTokens: options.maxTokens ?? 16000 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: [] }),
    chat: async (_config, request) => {
      if (payload(request)) { reviewRequests.push(request); return text("검수 모델은 더 이상 호출되지 않아야 한다"); }
      requests.push(request);
      return { ...(rounds[requests.length - 1] ?? text("Writer finished")), imageDelivery: imageDeliveryForRequest(request) };
    },
  });
  return { project, session, requests, reviewRequests };
}

describe("결정적 초안 검사", () => {
  it("lint 가 깨끗한 초안은 검수 모델 없이 승인되고 final 로 끝난다", async () => {
    const f = fixture();
    const result = await f.session.sendUserMessage("Change title");
    expect(f.reviewRequests).toHaveLength(0);
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.review?.summary).toContain("lint error 0건");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    expect(result.proposedCalls.map(c => c.name)).toEqual(["set_title_screen"]);
  });

  it("lint error 가 있으면 changes_requested 로 돌려 모델이 고치게 하고, 고치면 승인한다", async () => {
    // 기준선(clean) → 초안(broken) → 수리 뒤 기준선(clean) → 초안(clean)
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValueOnce(clean).mockReturnValueOnce(broken).mockReturnValue(clean);
    // writer 가 한 번 끝내야 검사가 돈다: 쓰기 → 종료 → (검사 미통과, 수리 요청) → 쓰기 → 종료 → (검사 통과)
    const f = fixture({ rounds: [call("set_title_screen", { title: "Draft" }), text("done"),
      call("set_title_screen", { title: "Repaired" }), text("done")] });
    const result = await f.session.sendUserMessage("Change title");
    expect(f.reviewRequests).toHaveLength(0);
    // 수리 라운드의 writer 요청에는 결정적 findings 가 실려 있다.
    const repairPrompt = JSON.stringify(f.requests[2]?.messages ?? []);
    expect(repairPrompt).toContain("start-position");
    expect(repairPrompt).toContain("run_lint error 0");
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(f.session.getProposedProject().system.titleScreen?.title ?? JSON.stringify(f.session.getProposedProject().system)).toContain("Repaired");
  });

  it("같은 lint error 가 반복되면 승인 없이 정직하게 멈춘다", async () => {
    draftOnlyBroken();
    const f = fixture({ rounds: [call("set_title_screen", { title: "Draft" }), text("done"), call("set_title_screen", { title: "Draft" }), text("done"),
      call("set_title_screen", { title: "Draft" }), text("done"), call("set_title_screen", { title: "Draft" }), text("done")] });
    const result = await f.session.sendUserMessage("Change title");
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("start-position");
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });

  it("도구 예산이 소진돼도 lint 가 깨끗하면 초안을 버리지 않고 final 로 적용한다", async () => {
    const f = fixture({ maxToolCalls: 2, rounds: [call("set_title_screen", { title: "A" }), call("set_title_screen", { title: "B" }),
      call("set_title_screen", { title: "C" }), call("set_title_screen", { title: "D" })] });
    const result = await f.session.sendUserMessage("Change title many times");
    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toContain("예산이 소진되어");
    expect(result.review?.status).toBe("approved");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    expect(result.proposedCalls.length).toBeGreaterThan(0);
  });

  it("도구 예산이 소진됐는데 lint error 가 남아 있으면 적용하지 않고 이유를 싣는다", async () => {
    draftOnlyBroken();
    const f = fixture({ maxToolCalls: 2, rounds: [call("set_title_screen", { title: "A" }), call("set_title_screen", { title: "B" }),
      call("set_title_screen", { title: "C" })] });
    const result = await f.session.sendUserMessage("Change title many times");
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(result.error).toContain("결정적 검사");
    expect(f.session.isDraftReviewApproved()).toBe(false);
  });

  it("ask 모드는 검사도 쓰기도 하지 않는다", async () => {
    const f = fixture();
    const result = await f.session.sendUserMessage("What is the title?", () => {}, undefined, { composerMode: "ask" });
    expect(f.reviewRequests).toHaveLength(0);
    expect(result.proposedCalls).toEqual([]);
    expect(f.session.getProposedProject()).toEqual(f.project);
  });

  it("사전 UI 양보 중 취소된 쓰기는 거부된다", async () => {
    const f = fixture(), controller = new AbortController();
    const result = await f.session.sendUserMessage("Change title", event => {
      if (event.type === "tool_started") controller.abort();
    }, controller.signal);
    expect(result.stoppedReason).toBe("aborted");
    expect(f.session.getProposedProject()).toEqual(f.project);
  });

  it("승인 뒤 편집은 승인을 무효화하고, undo 로도 되살리지 못한다", async () => {
    const f = fixture();
    const result = await f.session.sendUserMessage("Change title");
    expect(result.review?.status).toBe("approved");
    const approved = f.session.getProposedProject(), changed = structuredClone(approved);
    changed.meta.title = "Changed after review";
    expect(f.session.isDraftReviewApproved(changed)).toBe(false);
    f.session.rebaseProject(changed);
    f.session.rebaseProject(approved);
    expect(f.session.getResultReview()?.status).toBe("unapproved");
  });
});

describe("deterministicDraftFindings", () => {
  it("변경된 맵의 error 만 findings 로 만들고 warning 은 무시한다", () => {
    const project = createBlankProject();
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue({ summary: "x", data: { counts: { errors: 1 }, issues: [
      { severity: "warning", code: "w", mapId: project.startMapId, message: "권고" },
      { severity: "error", code: "start-position", mapId: project.startMapId, x: 3, y: 4, message: "시작 위치가 통행 불가 타일입니다" },
      { severity: "error", code: "reachability", mapId: "other_map", message: "다른 맵" },
    ] } });
    const findings = deterministicDraftFindings(project, [project.startMapId]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ target: `${project.startMapId} (3,4)`, problem: expect.stringContaining("start-position") });
  });
  it("기준선에 이미 있던 error 는 초안의 책임이 아니다 — 새로 생긴 것만 남긴다", () => {
    const project = createBlankProject();
    const inherited = { severity: "error", code: "reference-validation", message: "setSwitch: switchId가 존재하지 않습니다: sw_missing_xyz" };
    const fresh = { severity: "error", code: "start-position", mapId: project.startMapId, x: 1, y: 1, message: "시작 위치가 통행 불가 타일입니다: (1, 1)" };
    const spy = vi.spyOn(getTool("run_lint")!, "run");
    // 첫 호출은 기준선, 두 번째는 초안(같은 스파이 순서를 deterministicDraftFindings 가 따른다).
    spy.mockReturnValueOnce({ summary: "x", data: { counts: { errors: 1 }, issues: [inherited] } })
      .mockReturnValueOnce({ summary: "x", data: { counts: { errors: 2 }, issues: [inherited, fresh] } });
    const findings = deterministicDraftFindings(project, [project.startMapId], structuredClone(project));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.problem).toContain("start-position");
  });
  it("맵 미지정 error 는 항상 포함한다", () => {
    const project = createBlankProject();
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue({ summary: "x", data: { counts: { errors: 1 }, issues: [
      { severity: "error", code: "reference-validation", message: "참조 검증 실패" },
    ] } });
    expect(deterministicDraftFindings(project, ["m1"])).toHaveLength(1);
  });
});
