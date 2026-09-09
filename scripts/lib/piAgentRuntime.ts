// Bun 전용 Pi 에이전트 런타임. `@oh-my-pi/pi-agent-core` 루프에 레지스트리 툴을 붙여 프로젝트
// 사본 위에서 작업을 끝까지 돈다. 결과 프로젝트는 `done` 이벤트로 돌려주고, 적용(커밋 게이트·
// undo·저장)은 호출자(브라우저 패널 또는 CLI)가 맡는다.
//
// 이 파일만 oh-my-pi 코어를 알고 있다. 어댑터(src/ai/piAgent/*)는 순수라서, 코어를 바꾸려면
// 이 파일 하나를 다시 쓰면 된다.

import { Agent } from "@oh-my-pi/pi-agent-core";
import { getBundledModel, getBundledModels } from "@oh-my-pi/pi-catalog";
import { createPiToolset } from "../../src/ai/piAgent/toolAdapter.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";
import { antigravityToolEnumPayload } from "./ohMyPiToolEnums.ts";
import type { Project } from "../../src/project/types.ts";

export interface RunPiAgentOptions {
  readonly apiKey?: string;
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  /** 전체 실행 상한(ms). 기본 10분. */
  readonly timeoutMs?: number;
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

function resolveModel(provider: string, modelId?: string) {
  const wanted = modelId?.trim() || getOhMyPiProvider(provider)?.defaultModel || "";
  const exact = wanted ? getBundledModel(provider as never, wanted) : undefined;
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  const fallback = getBundledModels(provider as never)[0];
  if (!fallback) throw new Error(`oh-my-pi 카탈로그에 ${provider} 모델이 없습니다`);
  return fallback;
}

function trimText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function runPiAgent(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const emit = (event: PiAgentEvent) => options.onEvent?.(event);
  const base = request.project;
  const ctx = { project: structuredClone(base) as Project };
  const model = resolveModel(request.provider, request.model);
  // 툴 요약은 어댑터(onCall)가 알고, 호출 id 는 코어 이벤트가 안다. 이름별 FIFO 로 둘을 맞춘다.
  const pendingSummaries = new Map<string, { ok: boolean; summary: string }[]>();
  const tools = createPiToolset(ctx, {
    domains: request.toolDomains,
    onCall: ({ name, result }) => {
      const queue = pendingSummaries.get(name) ?? [];
      queue.push({ ok: result.ok, summary: trimText(result.summary, 400) });
      pendingSummaries.set(name, queue);
    },
  });
  const systemPrompt = request.systemPrompt ? [...request.systemPrompt] : buildPiAgentSystemPrompt(base, request.mapIds);
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel as never } : {}),
      tools: tools as never,
    },
    ...(options.apiKey ? { getApiKey: () => options.apiKey as never } : {}),
    ...(request.provider === "google-antigravity"
      ? { onPayload: antigravityToolEnumPayload(String((model as { id?: string }).id ?? ""), tools) as never }
      : {}),
  });
  const maxTurns = request.maxTurns ?? DEFAULT_MAX_TURNS;
  let turns = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let usage: unknown;
  let fatal: string | undefined;
  const started = Date.now();
  emit({ type: "start", provider: request.provider, model: String((model as { id?: string }).id ?? ""), toolCount: tools.length });
  const unsubscribe = agent.subscribe((event: { type: string; [key: string]: unknown }) => {
    if (event.type === "turn_start") {
      turns += 1;
      emit({ type: "turn", index: turns });
      if (turns > maxTurns) {
        fatal = `턴 상한(${maxTurns})을 넘어 중단했습니다.`;
        agent.abort();
      }
      return;
    }
    if (event.type === "tool_execution_start") {
      toolCalls += 1;
      emit({ type: "tool_start", id: String(event.toolCallId ?? ""), name: String(event.toolName ?? ""), args: event.args });
      return;
    }
    if (event.type === "tool_execution_end") {
      if (event.isError) toolErrors += 1;
      const name = String(event.toolName ?? "");
      const record = pendingSummaries.get(name)?.shift();
      emit({
        type: "tool_end",
        id: String(event.toolCallId ?? ""),
        name,
        ok: record ? record.ok : !event.isError,
        summary: record?.summary ?? (event.isError ? "실행 실패(인자 검증 또는 예외)" : ""),
      });
      return;
    }
    if (event.type === "message_end") {
      const message = event.message as { role?: string; content?: unknown[]; usage?: unknown; stopReason?: string; errorMessage?: string } | undefined;
      if (!message || message.role !== "assistant") return;
      const text = (message.content ?? [])
        .filter((part): part is { type: "text"; text: string } => !!part && typeof part === "object" && (part as { type?: string }).type === "text")
        .map((part) => part.text)
        .join("");
      if (text.trim()) emit({ type: "assistant", text });
      if (message.usage) usage = message.usage;
      if (message.stopReason === "error" || message.errorMessage) {
        fatal = message.errorMessage ?? "제공자 오류";
        emit({ type: "error", message: fatal });
      }
    }
  });
  const timer = setTimeout(() => {
    fatal = fatal ?? "시간 상한을 넘어 중단했습니다.";
    agent.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => {
    fatal = fatal ?? "클라이언트가 중단했습니다.";
    console.error(`[pi-agent] aborted by client after ${turns} turns / ${toolCalls} tool calls`);
    agent.abort();
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await agent.prompt(request.task);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    unsubscribe();
  }
  if (fatal && toolCalls === 0) throw Object.assign(new Error(fatal), { status: 502 });
  const done: PiAgentDoneEvent = {
    type: "done",
    project: ctx.project,
    stats: { ms: Date.now() - started, turns, toolCalls, toolErrors, ...(usage ? { usage } : {}) },
    changedKeys: changedProjectKeys(base, ctx.project),
  };
  emit(done);
  return done;
}
