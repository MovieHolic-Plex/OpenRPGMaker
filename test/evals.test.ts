// test/evals.test.ts
// 골든 태스크 프레임워크 검증: 오프라인 정답 시퀀스 채점 + 모킹 LLM 툴콜 루프 채점.
// 실제 LLM 호출은 하지 않는다(chat 주입).

import { describe, expect, it } from "vitest";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import type { ReviewInput } from "@/ai/independentReview";
import { toOpenAiTools } from "@/editor/tools";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";
import { scoreProject } from "@/evals/goldenTask";
import { GOLDEN_TASKS, GOLDEN_SOLUTIONS, GOLDEN_INN, GOLDEN_INN_SOLUTION, GOLDEN_SESSION } from "@/evals/goldenTasks";
import { llmSolver, runGoldenSuite, runGoldenTask, toolSequenceSolver } from "@/evals/runner";

// Allow writer, final response, and independent review/repair rounds in one budget.
const TEST_CONFIG: AiConfig = { authMode: "apiKey", baseUrl: "https://example.test/v1", model: "stub-model", apiKey: "test", agentMode: "chat", maxToolCalls: 10, maxTokens: 16000 };

describe("evals", () => {
  it("모든 골든 태스크가 정답 시퀀스로 통과한다(오프라인)", async () => {
    const { results, passRate, avgScore } = await runGoldenSuite(GOLDEN_TASKS, (task) => toolSequenceSolver(GOLDEN_SOLUTIONS[task.id] ?? []));
    for (const result of results) {
      expect(result.score.passed, `${result.score.taskId}: ${result.error ?? JSON.stringify(result.score.matcherResults)}`).toBe(true);
      expect(result.score.lintErrors).toBe(0);
    }
    expect(passRate).toBe(1);
    expect(avgScore).toBe(1);
    // 15,000ms → 60,000ms. 수정 과제 2종(road-fix / npc-line-fix)이 붙으며 스위트가 한계선에
    // 걸터앉았다(실측 15.7초/15초) — 두 과제 모두 잿불 마을 프로젝트 전체를 생성해 채점한다.
    // 병렬 실행 부하에 따라 통과/실패가 갈리는 경계값이라 여유를 준다. 이 테스트는 벽시계
    // 성능이 아니라 정답 시퀀스의 정합을 보는 것이므로 상한을 늘려도 잃는 신호가 없다.
  }, 60000);

  it("빈 프로젝트(아무 것도 안 함)는 태스크를 통과하지 못한다", async () => {
    const result = await runGoldenTask(GOLDEN_INN, (task) => ({ project: task.initialProject() }));
    expect(result.score.passed).toBe(false);
    expect(result.score.score).toBeLessThan(1);
  });

  it("모킹 LLM 여관 시퀀스는 렌더 증거 없이 성공으로 채점되지 않는다", async () => {
    // Preserve the inn tool loop, but a writer's completion and even a reviewer
    // approval cannot replace actual rendered coverage of the newly authored map.
    const reviews: ReviewInput[] = [];
    const spec = {
      mapId: "m_town",
      title: "여관 밑그림",
      assets: [{ id: "여관 전체", kind: "house", x: 0, y: 0, w: 18, h: 14 }],
    };
    const lastCreateMapIndex = GOLDEN_INN_SOLUTION.reduce((lastIndex, call, index) => (call.name === "create_map" ? index : lastIndex), -1);
    const solutionWithSpec = [
      ...GOLDEN_INN_SOLUTION.slice(0, lastCreateMapIndex + 1),
      { name: "set_build_spec", args: spec },
      ...GOLDEN_INN_SOLUTION.slice(lastCreateMapIndex + 1),
    ];
    let round = 0;
    const chat = async (_config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
      const review = independentReviewPayload(request);
      const approval = approvedReviewResponse(request);
      if (review && approval) {
        expect(request.tools).toEqual([]);
        expect(request.tool_choice).toBe("none");
        expect(request.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
          .filter(part => part.type === "image_url")).toEqual([]);
        reviews.push(review);
        return approval;
      }
      round += 1;
      if (round === 1) {
        return {
          message: {
            role: "assistant",
            content: "밑그림을 제출하고 정답 시퀀스로 진행합니다.",
            tool_calls: solutionWithSpec.map((call, index) => ({
              id: `call_${index}`,
              type: "function" as const,
              function: { name: call.name, arguments: JSON.stringify(call.args) },
            })),
          },
          finishReason: "tool_calls",
        };
      }
      return { message: { role: "assistant", content: "여관을 지었습니다." }, finishReason: "stop" };
    };
    const result = await runGoldenTask(GOLDEN_INN, llmSolver({ config: TEST_CONFIG, chat }));
    expect(result.score.matcherResults).toEqual(GOLDEN_INN.matchers.map(matcher => ({ describe: matcher.describe, passed: true })));
    expect(result.score.passed).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.review?.status).toBe("changes_requested");
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0]?.originalRequest).toBe(GOLDEN_INN.prompt);
    expect(reviews[0]?.requiredProblems.some(problem => problem.includes("show_map_region"))).toBe(true);
    expect(result.review?.findings.some(finding => finding.target === "required-evidence" && finding.problem.includes("show_map_region"))).toBe(true);
    expect(result.audit).toBeDefined();
  });

  it.each(["write", "read-only"] as const)("모킹 LLM 시작 상태 설정은 실제 변경과 독립 검수를 요구한다: %s", async mode => {
    // Only the golden solution's map setup is pre-authored. All requested title,
    // item and starting inventory changes must still come from the real LLM loop.
    const solution = GOLDEN_SOLUTIONS[GOLDEN_SESSION.id]!;
    expect(solution.slice(0, 2).map(call => call.name)).toEqual(["create_map", "set_start_position"]);
    const { project: initial } = await toolSequenceSolver(solution.slice(0, 2))(GOLDEN_SESSION);
    const task = { ...GOLDEN_SESSION, initialProject: () => structuredClone(initial) };
    expect(scoreProject(initial, task).passed).toBe(false);
    const mapId = initial.startMapId;
    const calls = mode === "write" ? [
      solution[2]!,
      { name: "get_database_records", args: { collection: "items", ids: ["it_potion"], include: "full" } },
      ...solution.slice(3),
    ] : [{ name: "get_project_summary", args: {} }];
    const reviews: ReviewInput[] = [];
    const writerRequests: ChatRequest[] = [];
    const result = await runGoldenTask(task, llmSolver({ config: TEST_CONFIG, chat: async (_config, request) => {
      const review = independentReviewPayload(request);
      const approval = approvedReviewResponse(request);
      if (review && approval) {
        expect(request.tools).toEqual([]);
        expect(request.tool_choice).toBe("none");
        expect(request.messages).toHaveLength(2);
        reviews.push(review);
        return approval;
      }
      writerRequests.push(request);
      if (writerRequests.length === 1) {
        expect(request.tools?.map(tool => tool.function.name)).toEqual(expect.arrayContaining(toOpenAiTools().map(tool => tool.function.name)));
        const originalMessage = request.messages.find(message => typeof message.content === "string" && message.content.startsWith('{"originalContext":'));
        expect(originalMessage).toBeDefined();
        const context: unknown = JSON.parse(String(originalMessage!.content));
        expect(context).toMatchObject({ originalContext: { target: { mapId }, entries: expect.arrayContaining([
          expect.objectContaining({ entryId: "/project", value: expect.objectContaining({ meta: initial.meta, startMapId: mapId }) }),
          expect.objectContaining({ entryId: "/system", value: initial.system }),
        ]) } });
      }
      const index = writerRequests.length - 1;
      const call = calls[index];
      if (call) return { message: { role: "assistant", content: null, tool_calls: [{
        id: `start_${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      }] }, finishReason: "tool_calls" };
      return { message: { role: "assistant", content: "시작 상태를 확인했습니다." }, finishReason: "stop" };
    } }));
    expect(writerRequests.length).toBeGreaterThanOrEqual(2);
    for (const [index, call] of calls.entries()) {
      const reply = writerRequests[index + 1]?.messages.find(message => message.role === "tool" && message.tool_call_id === `start_${index}`);
      expect(reply).toMatchObject({ name: call.name });
      const output: unknown = JSON.parse(String(reply!.content));
      expect(output).toMatchObject({ ok: true });
    }
    expect(result.audit).toBeDefined();
    if (mode === "read-only") {
      expect(result.score.passed).toBe(false);
      expect(result.score.matcherResults.some(matcher => !matcher.passed)).toBe(true);
      expect(reviews).toEqual([]);
      expect(result.review?.status).not.toBe("approved");
    } else {
      expect(result.error, result.audit).toBeUndefined();
      expect(result.score.passed, JSON.stringify(result.score)).toBe(true);
      expect(result.score.score).toBe(1);
      expect(result.score.lintErrors).toBe(0);
      expect(reviews).toHaveLength(1);
      expect(result.review).toMatchObject({ status: "approved", revision: reviews[0]!.revision, findings: [] });
      expect(reviews[0]?.originalRequest).toBe(task.prompt);
      expect(reviews[0]?.requiredProblems).toEqual([]);
      expect(reviews[0]?.toolResults).toEqual(expect.arrayContaining(calls.map(call => expect.objectContaining({
        name: call.name, args: call.args, result: expect.objectContaining({ ok: true }),
      }))));
      expect(reviews[0]?.changes.some(change => change.path === "/maps")).toBe(false);
      expect(reviews[0]?.changes).toContainEqual(expect.objectContaining({
        path: "/session", before: initial.session,
        after: expect.objectContaining({ gold: 200, inventory: { it_potion: 3 } }),
      }));
      expect(reviews[0]?.changes).toContainEqual(expect.objectContaining({
        path: "/system", before: initial.system,
        after: expect.objectContaining({ titleScreen: expect.objectContaining({ title: "작은 모험" }) }),
      }));
    }
  }, 60000);

  it("scoreProject가 부분 점수를 산출한다", () => {
    const project = GOLDEN_INN.initialProject();
    const score = scoreProject(project, GOLDEN_INN);
    // 빈 프로젝트: lint는 통과(시작맵 없음 → error)일 수 있으나 매처는 실패 → score<1.
    expect(score.score).toBeLessThan(1);
    expect(score.matcherResults.length).toBe(GOLDEN_INN.matchers.length);
  });
});
