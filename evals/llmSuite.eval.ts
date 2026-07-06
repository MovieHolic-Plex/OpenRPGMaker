// evals/llmSuite.eval.ts
// 실제 LLM(OpenRouter google/gemini-3.1-flash-lite)로 골든 태스크를 헤드리스 구동·채점한다.
// evals/run.mjs가 .env.local을 process.env로 로드한 뒤 evals/vitest.config.mjs로 실행한다.
// OPENROUTER_API_KEY가 없으면 스킵(네트워크/비용). 결과는 evals/results/<ts>.json에 요약만 저장.

import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { chatCompletion, type AiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { scoreProject } from "@/evals/goldenTask";
import { GOLDEN_TASKS } from "@/evals/goldenTasks";

const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-lite";
const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const MAX_TOOL_CALLS = Number(process.env.EVAL_MAX_TOOLCALLS ?? 15);
const TASK_COUNT = Number(process.env.EVAL_TASKS ?? 4);
const PER_TASK_TIMEOUT_MS = Number(process.env.EVAL_TASK_TIMEOUT_MS ?? 120000);

function config(): AiConfig {
  return { baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, maxToolCalls: MAX_TOOL_CALLS, maxTokens: Number(process.env.EVAL_MAX_TOKENS ?? 4000) };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`타임아웃(${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface TaskOutcome {
  id: string;
  passed: boolean;
  score: number;
  lintErrors: number;
  matchers: { describe: string; passed: boolean }[];
  toolCalls: number;
  tokens: number;
  stoppedReason: string;
  error?: string;
}

// 실제 LLM으로 한 태스크를 구동·채점한다.
async function runTask(taskIndex: number): Promise<TaskOutcome> {
  const task = GOLDEN_TASKS[taskIndex];
  let tokens = 0;
  // usage 누적 래퍼(응답 원문은 저장하지 않는다).
  const chat = async (cfg: AiConfig, req: ChatRequest): Promise<ChatResult> => {
    const result = await chatCompletion(cfg, req);
    tokens += result.usage?.total_tokens ?? 0;
    return result;
  };
  const session = new AssistantSession(task.initialProject(), { config: config(), chat });
  try {
    const turn = await withTimeout(session.sendUserMessage(task.prompt), PER_TASK_TIMEOUT_MS);
    const project = session.getProposedProject();
    const score = scoreProject(project, task);
    const audit = JSON.parse(session.exportAudit()) as { entries: { kind: string }[] };
    const toolCalls = audit.entries.filter((entry) => entry.kind === "tool").length;
    return {
      id: task.id,
      passed: score.passed,
      score: score.score,
      lintErrors: score.lintErrors,
      matchers: score.matcherResults.map((result) => ({ describe: result.describe, passed: result.passed })),
      toolCalls,
      tokens,
      stoppedReason: turn.stoppedReason,
      error: turn.error,
    };
  } catch (cause) {
    return {
      id: task.id,
      passed: false,
      score: 0,
      lintErrors: -1,
      matchers: [],
      toolCalls: 0,
      tokens,
      stoppedReason: "error",
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

describe.skipIf(!API_KEY)("evals — 실제 LLM 골든 스위트", () => {
  it(`상위 ${TASK_COUNT}개 태스크를 gemini-3.1-flash-lite로 구동·채점한다`, async () => {
    const count = Math.min(TASK_COUNT, GOLDEN_TASKS.length);
    const outcomes: TaskOutcome[] = [];
    for (let i = 0; i < count; i += 1) outcomes.push(await runTask(i));

    const passRate = outcomes.filter((outcome) => outcome.passed).length / count;
    const summary = {
      model: MODEL,
      taskCount: count,
      passRate,
      avgScore: outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / count,
      totalTokens: outcomes.reduce((sum, outcome) => sum + outcome.tokens, 0),
      // 응답 원문/키는 저장하지 않는다 — 태스크별 요약만.
      tasks: outcomes,
    };

    const fs = await import("node:fs");
    fs.mkdirSync("evals/results", { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `evals/results/${stamp}.json`;
    fs.writeFileSync(path, JSON.stringify(summary, null, 2));

    // 콘솔 요약.
    // eslint-disable-next-line no-console
    console.log(`\n[evals] ${MODEL} — ${count}개 태스크, pass ${(passRate * 100).toFixed(0)}%, 총 ${summary.totalTokens} 토큰 → ${path}`);
    for (const outcome of outcomes) {
      // eslint-disable-next-line no-console
      console.log(`  ${outcome.passed ? "✓" : "✗"} ${outcome.id.padEnd(16)} score=${outcome.score.toFixed(2)} toolCalls=${outcome.toolCalls} tokens=${outcome.tokens} (${outcome.stoppedReason})${outcome.error ? " err=" + outcome.error : ""}`);
    }

    // 하네스 정상 동작 검증: 모든 태스크가 채점됐고, 최소 1개는 툴콜을 발생시켰다.
    expect(outcomes.length).toBe(count);
    expect(outcomes.some((outcome) => outcome.toolCalls > 0)).toBe(true);
  });
});
