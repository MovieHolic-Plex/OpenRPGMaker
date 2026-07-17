// evals/index.ts
// 골든 태스크 평가 스위트 공개 진입점(Phase 5).
//
// 오프라인(정답 시퀀스) 채점:
//   runGoldenSuite(GOLDEN_TASKS, (t) => toolSequenceSolver(GOLDEN_SOLUTIONS[t.id]))
//
// 실제 LLM 야간 배치(사용자 설정 엔드포인트):
//   const config = { ...defaultAiConfig(), apiKey: <키> };
//   runGoldenSuite(GOLDEN_TASKS, (t) => llmSolver({ config }));
//   → 비용/네트워크가 있으므로 CI 상시 실행하지 않고 수동/야간에만 돌린다.

export {
  scoreProject,
  mapCountAtLeast,
  switchNamed,
  itemExists,
  troopExists,
  questExists,
  hasEventWithCommand,
  custom,
  type GoldenTask,
  type SpecMatcher,
  type EvalScore,
} from "./goldenTask";
export {
  toolSequenceSolver,
  llmSolver,
  runGoldenTask,
  runGoldenSuite,
  type Solver,
  type ToolCall,
  type EvalRunResult,
  type LlmSolverOptions,
} from "./runner";
export { GOLDEN_TASKS, GOLDEN_SOLUTIONS } from "./goldenTasks";
