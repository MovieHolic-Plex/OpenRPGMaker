// evals/runner.ts
// 골든 태스크 러너. solver(프로젝트를 완성하는 함수)를 주입받아 채점한다.
// - toolSequenceSolver: 결정적 툴 호출 시퀀스(오프라인 테스트/골든 정답).
// - llmSolver: AssistantSession으로 실제/모킹 LLM 툴콜 루프 구동.

import { AssistantSession } from "@/ai/assistantSession";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { scoreProject, type EvalScore, type GoldenTask } from "./goldenTask";

export interface ToolCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface SolveResult {
  readonly project: Project;
  readonly audit?: string;
}

export type Solver = (task: GoldenTask) => Promise<SolveResult> | SolveResult;

// 결정적 툴 시퀀스 solver(골든 정답/오프라인).
export function toolSequenceSolver(calls: readonly ToolCall[]): Solver {
  return (task) => {
    const ctx: ToolContext = { project: task.initialProject() };
    for (const call of calls) {
      const result = runTool(ctx, call.name, call.args, { dryRun: false });
      if (!result.ok) throw new Error(`툴 실패 ${call.name}: ${JSON.stringify(result.issues)}`);
    }
    return { project: ctx.project };
  };
}

export interface LlmSolverOptions {
  readonly config: AiConfig;
  // 테스트용 모킹 chat. 없으면 실제 OpenRouter 호출(chatCompletion).
  readonly chat?: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;
}

// LLM 툴콜 루프 solver. AssistantSession의 누적 draft(getProposedProject)를 최종 프로젝트로 채점한다.
export function llmSolver(options: LlmSolverOptions): Solver {
  return async (task) => {
    const session = new AssistantSession(task.initialProject(), { config: options.config, chat: options.chat });
    await session.sendUserMessage(task.prompt);
    return { project: session.getProposedProject(), audit: session.exportAudit() };
  };
}

export interface EvalRunResult {
  readonly score: EvalScore;
  readonly audit?: string;
  readonly error?: string;
}

// 단일 태스크 실행 + 채점.
export async function runGoldenTask(task: GoldenTask, solve: Solver): Promise<EvalRunResult> {
  try {
    const solved = await solve(task);
    return { score: scoreProject(solved.project, task), audit: solved.audit };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    // 실패도 0점 결과로 기록(러너가 죽지 않도록).
    return {
      score: { taskId: task.id, passed: false, score: 0, lintErrors: -1, matcherResults: [], reachabilityPassed: false },
      error,
    };
  }
}

// 여러 태스크를 순차 실행하고 요약을 반환한다.
export async function runGoldenSuite(tasks: readonly GoldenTask[], solverFor: (task: GoldenTask) => Solver): Promise<{ results: EvalRunResult[]; passRate: number; avgScore: number }> {
  const results: EvalRunResult[] = [];
  for (const task of tasks) results.push(await runGoldenTask(task, solverFor(task)));
  const passRate = results.filter((result) => result.score.passed).length / Math.max(1, results.length);
  const avgScore = results.reduce((sum, result) => sum + result.score.score, 0) / Math.max(1, results.length);
  return { results, passRate, avgScore };
}
