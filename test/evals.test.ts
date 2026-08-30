// test/evals.test.ts
// 골든 태스크 프레임워크 검증: 오프라인 정답 시퀀스 채점 + 모킹 LLM 툴콜 루프 채점.
// 실제 LLM 호출은 하지 않는다(chat 주입).

import { describe, expect, it } from "vitest";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { scoreProject } from "@/evals/goldenTask";
import { GOLDEN_TASKS, GOLDEN_SOLUTIONS, GOLDEN_INN, GOLDEN_INN_SOLUTION } from "@/evals/goldenTasks";
import { llmSolver, runGoldenSuite, runGoldenTask, toolSequenceSolver } from "@/evals/runner";

const TEST_CONFIG: AiConfig = { baseUrl: "https://example.test/v1", model: "stub-model", apiKey: "test", maxToolCalls: 5, maxTokens: 2000 };

describe("evals", () => {
  it("모든 골든 태스크가 정답 시퀀스로 통과한다(오프라인)", async () => {
    const { results, passRate, avgScore } = await runGoldenSuite(GOLDEN_TASKS, (task) => toolSequenceSolver(GOLDEN_SOLUTIONS[task.id] ?? []));
    for (const result of results) {
      expect(result.score.passed, `${result.score.taskId}: ${JSON.stringify(result.score.matcherResults)}`).toBe(true);
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

  it("모킹 LLM 툴콜 루프가 골든 태스크를 완성한다", async () => {
    // 1라운드: 정답 시퀀스를 tool_calls로 방출 → 2라운드: 최종 응답(툴콜 없음).
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
    const chat = async (_config: AiConfig, _req: ChatRequest): Promise<ChatResult> => {
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
    expect(result.score.passed).toBe(true);
    expect(result.audit).toBeDefined();
  });

  it("scoreProject가 부분 점수를 산출한다", () => {
    const project = GOLDEN_INN.initialProject();
    const score = scoreProject(project, GOLDEN_INN);
    // 빈 프로젝트: lint는 통과(시작맵 없음 → error)일 수 있으나 매처는 실패 → score<1.
    expect(score.score).toBeLessThan(1);
    expect(score.matcherResults.length).toBe(GOLDEN_INN.matchers.length);
  });
});
