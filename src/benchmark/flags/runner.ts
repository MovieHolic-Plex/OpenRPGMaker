import { AssistantSession } from "@/ai/assistantSession";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { chatCompletion } from "@/ai/llmClient";
import { summarizeAuthoredEvents } from "./analyze";
import { scoreFlagLiteracy } from "./score";
import type { FlagBenchTask } from "./tasks";
import type { AuthoredEventShape, FlagAxisId, FlagLiteracyMetrics } from "./types";

export interface FlagRunToolCall {
  readonly name: string;
  readonly ok: boolean;
  readonly summary: string;
}

export interface FlagAxisOutcome {
  readonly id: FlagAxisId;
  readonly label: string;
  readonly weight: number;
  readonly score: number;
  readonly detail: string;
  readonly evidence: readonly string[];
  readonly targeted: boolean;
}

export interface FlagTaskOutcome {
  readonly taskId: string;
  readonly title: string;
  readonly summary: string;
  readonly prompt: string;
  readonly model: string;
  readonly total: number;
  readonly grade: string;
  readonly targetedTotal: number;
  readonly axes: readonly FlagAxisOutcome[];
  readonly metrics: FlagLiteracyMetrics;
  readonly events: readonly AuthoredEventShape[];
  readonly toolCalls: readonly FlagRunToolCall[];
  readonly assistantText: string;
  readonly stoppedReason: string;
  readonly rounds: number;
  readonly tokens: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface FlagRunSuite {
  readonly startedAt: string;
  readonly model: string;
  readonly maxToolCalls: number;
  readonly taskTimeoutMs: number;
  readonly maxRounds: number;
  readonly outcomes: readonly FlagTaskOutcome[];
}

export interface FlagRunnerOptions {
  readonly config: AiConfig;
  readonly timeoutMs?: number;
  readonly chat?: (config: AiConfig, request: ChatRequest) => Promise<ChatResult>;
  readonly onProgress?: (message: string) => void;
  /** 태스크는 서로 독립된 세션·프로젝트라 병렬로 돌려도 결과가 섞이지 않는다. */
  readonly concurrency?: number;
  /**
   * 사용자가 한 번 말하고 끝내는 일은 거의 없다 — 라운드 사이에 「계속」을 보내 에이전트가
   * 실제로 산출할 여지를 준다. 에디터의 autonomous 드라이버는 Node 에서 쉼 수 없다
   * (마일스톤 자동 적용이 에디터 store · Supabase · import.meta.env 를 토굴다).
   */
  readonly maxRounds?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`타임아웃(${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function auditToolCalls(audit: string): FlagRunToolCall[] {
  try {
    const parsed = JSON.parse(audit) as { entries?: { kind: string; name?: string; ok?: boolean; summary?: string }[] };
    return (parsed.entries ?? [])
      .filter((entry) => entry.kind === "tool")
      .map((entry) => ({ name: entry.name ?? "?", ok: entry.ok === true, summary: entry.summary ?? "" }));
  } catch {
    return [];
  }
}

export async function runFlagTask(task: FlagBenchTask, options: FlagRunnerOptions): Promise<FlagTaskOutcome> {
  const targeted = new Set(task.axes);
  const startedAt = Date.now();
  let tokens = 0;
  const chat = async (config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
    const result = await (options.chat ?? chatCompletion)(config, request);
    tokens += result.usage?.total_tokens ?? 0;
    return result;
  };
  const session = new AssistantSession(task.initialProject(), { config: options.config, chat });

  let assistantText = "";
  let stoppedReason = "error";
  let error: string | undefined;
  let rounds = 0;
  const deadline = startedAt + (options.timeoutMs ?? 600_000);
  const maxRounds = Math.max(1, options.maxRounds ?? 1);
  const toolCallsSoFar = (): number => auditToolCalls(session.exportAudit()).length;
  try {
    let message = task.prompt;
    while (rounds < maxRounds) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`총 예산 소진(${options.timeoutMs ?? 600_000}ms)`);
      const before = toolCallsSoFar();
      const turn = await withTimeout(session.sendUserMessage(message, () => {}, undefined, { autonomous: false }), remaining);
      rounds += 1;
      assistantText = turn.assistantText;
      stoppedReason = turn.stoppedReason;
      error = turn.error;
      if (turn.stoppedReason === "error" || turn.stoppedReason === "aborted") break;
      if (rounds > 1 && toolCallsSoFar() === before) break;
      message = "계속";
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  const proposed = session.getProposedProject();
  const card = scoreFlagLiteracy(proposed);
  const axes: FlagAxisOutcome[] = card.axes.map((axis) => ({
    id: axis.id,
    label: axis.label,
    weight: axis.weight,
    score: axis.score,
    detail: axis.detail,
    evidence: axis.evidence,
    targeted: targeted.has(axis.id),
  }));
  const targetedAxes = axes.filter((axis) => axis.targeted);
  const targetedWeight = targetedAxes.reduce((sum, axis) => sum + axis.weight, 0);
  const targetedTotal =
    targetedWeight > 0
      ? Math.round((targetedAxes.reduce((sum, axis) => sum + axis.score * axis.weight, 0) / targetedWeight) * 1000) / 10
      : 0;

  return {
    taskId: task.id,
    title: task.title,
    summary: task.summary,
    prompt: task.prompt,
    model: options.config.model,
    total: card.total,
    grade: card.grade,
    targetedTotal,
    axes,
    metrics: card.metrics,
    events: summarizeAuthoredEvents(proposed),
    toolCalls: auditToolCalls(session.exportAudit()),
    assistantText,
    stoppedReason,
    rounds,
    tokens,
    durationMs: Date.now() - startedAt,
    error,
  };
}

export async function runFlagSuite(
  tasks: readonly FlagBenchTask[],
  options: FlagRunnerOptions
): Promise<FlagRunSuite> {
  const startedAt = new Date().toISOString();
  const outcomes: FlagTaskOutcome[] = new Array<FlagTaskOutcome>(tasks.length);
  const limit = Math.max(1, options.concurrency ?? 1);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index]!;
      options.onProgress?.(`▶ ${task.id} — ${task.title}`);
      const outcome = await runFlagTask(task, options);
      options.onProgress?.(
        `  ${outcome.error ? "⚠" : "✓"} ${task.id} total=${outcome.total} grade=${outcome.grade} rounds=${outcome.rounds} tools=${outcome.toolCalls.length} ${outcome.error ?? ""}`
      );
      outcomes[index] = outcome;
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return {
    startedAt,
    model: options.config.model,
    maxToolCalls: options.config.maxToolCalls,
    taskTimeoutMs: options.timeoutMs ?? 600_000,
    maxRounds: Math.max(1, options.maxRounds ?? 1),
    outcomes,
  };
}
