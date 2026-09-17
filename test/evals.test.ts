// test/evals.test.ts
// 골든 태스크 프레임워크 검증: 오프라인 정답 시퀀스 채점 + 모킹 LLM 툴콜 루프 채점.
// 실제 LLM 호출은 하지 않는다(chat 주입).
// 2026-09-17: 독립 검수(LLM 재심사)·렌더 증거 승인 조건 해체 — 「여관 시퀀스는 렌더 증거 없이 성공으로 채점되지 않는다」는
// 사라진 조건을 재던 것이라 삭제. 승인 기준은 변경 맵의 run_lint error 0 하나(결정적 검사).

import { strict as assert } from "node:assert";
import { describe, expect, it } from "vitest";
import type { AiConfig, ChatRequest } from "@/ai/llmClient";
import { toOpenAiTools } from "@/editor/tools";
import { scoreProject } from "@/evals/goldenTask";
import { GOLDEN_TASKS, GOLDEN_SOLUTIONS, GOLDEN_INN, GOLDEN_SESSION } from "@/evals/goldenTasks";
import { llmSolver, runGoldenSuite, runGoldenTask, toolSequenceSolver } from "@/evals/runner";

// Allow writer and final response rounds in one budget (the deterministic check spends none).
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

  it.each(["write", "read-only"] as const)("모킹 LLM 시작 상태 설정은 실제 변경과 결정적 검사를 요구한다: %s", async mode => {
    // Only the golden solution's map setup is pre-authored. All requested title,
    // item and starting inventory changes must still come from the real LLM loop.
    const solution = GOLDEN_SOLUTIONS[GOLDEN_SESSION.id];
    assert(solution);
    expect(solution.slice(0, 2).map(call => call.name)).toEqual(["create_map", "set_start_position"]);
    const { project: initial } = await toolSequenceSolver(solution.slice(0, 2))(GOLDEN_SESSION);
    const task = { ...GOLDEN_SESSION, initialProject: () => structuredClone(initial) };
    expect(scoreProject(initial, task).passed).toBe(false);
    const mapId = initial.startMapId;
    const itemSetup = solution[2];
    assert(itemSetup);
    const calls = mode === "write" ? [
      itemSetup,
      { name: "get_database_records", args: { collection: "items", ids: ["it_potion"], include: "full" } },
      ...solution.slice(3),
    ] : [{ name: "get_project_summary", args: {} }];
    const writerRequests: ChatRequest[] = [];
    const result = await runGoldenTask(task, llmSolver({ config: TEST_CONFIG, chat: async (_config, request) => {
      writerRequests.push(request);
      if (writerRequests.length === 1) {
        expect(request.tools?.map(tool => tool.function.name)).toEqual(expect.arrayContaining(toOpenAiTools().map(tool => tool.function.name)));
        const originalMessage = request.messages.find(message => typeof message.content === "string" && message.content.startsWith('{"originalContext":'));
        expect(originalMessage).toBeDefined();
        assert(originalMessage && typeof originalMessage.content === "string");
        const context: unknown = JSON.parse(originalMessage.content);
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
      assert(reply && typeof reply.content === "string");
      const output: unknown = JSON.parse(reply.content);
      expect(output).toMatchObject({ ok: true });
    }
    expect(result.audit).toBeDefined();
    if (mode === "read-only") {
      expect(result.score.passed).toBe(false);
      expect(result.score.matcherResults.some(matcher => !matcher.passed)).toBe(true);
      // 읽기만 한 턴은 제안이 없어 검사 자체가 돌지 않는다 — 승인이 생길 수 없다.
      expect(result.review?.status).not.toBe("approved");
      expect(result.audit).not.toContain("deterministic-review ");
    } else {
      expect(result.error, result.audit).toBeUndefined();
      expect(result.score.passed, JSON.stringify(result.score)).toBe(true);
      expect(result.score.score).toBe(1);
      expect(result.score.lintErrors).toBe(0);
      // DB·시스템만 바꾼 초안: 변경 맵 0개, lint error 0건 → 결정적 검사 승인. 검수 모델 호출은 없다.
      expect(result.review).toMatchObject({ status: "approved", findings: [], summary: "결정적 검사 통과 — 변경 맵 0개, lint error 0건." });
      expect(result.audit).toContain("deterministic-review ");
      expect(result.audit).toContain("결정적 검사 통과 — 변경 맵 0개, lint error 0건.");
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
