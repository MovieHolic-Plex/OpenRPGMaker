import { createWriterTool } from "./piWriterTool.ts";
import { completeProvider } from "./ohMyPiPiAiRuntime.ts";
// Bun 전용 Pi 에이전트 런타임. `@oh-my-pi/pi-agent-core` 루프에 레지스트리 툴을 붙여 프로젝트
// 사본 위에서 작업을 끝까지 돈다. 결과 프로젝트는 `done` 이벤트로 돌려주고, 적용(커밋 게이트·
// undo·저장)은 호출자(브라우저 패널 또는 CLI)가 맡는다.
//
// 이 파일만 oh-my-pi 코어를 알고 있다. 어댑터(src/ai/piAgent/*)는 순수라서, 코어를 바꾸려면
// 이 파일 하나를 다시 쓰면 된다.

import { Agent } from "@oh-my-pi/pi-agent-core";
import { resolveOhMyPiModel } from "./ohMyPiModel.ts";
import { createPiToolset, type PiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import { createDeltaRelay } from "../../src/ai/piAgent/deltaRelay.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { changedProjectKeys, PI_AGENT_DEFAULT_TIMEOUT_MS, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { antigravityToolEnumPayload } from "./ohMyPiToolEnums.ts";
import type { Project } from "../../src/project/types.ts";

export interface RunPiAgentOptions {
  readonly apiKey?: string;
  readonly providerApiKeys?: Record<string, string | undefined>;
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  /** 전체 실행 상한(ms). 기본 PI_AGENT_DEFAULT_TIMEOUT_MS(3000초). */
  readonly timeoutMs?: number;
  /** 역할별 툴 범위. 레지스트리 선택에 더해 팀 런타임의 커스텀 툴(assign_map_agent 등)을 붙인다. */
  readonly readOnlyTools?: boolean;
  readonly toolNames?: readonly string[];
  readonly extraTools?: readonly PiToolShape[];
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_TIMEOUT_MS = PI_AGENT_DEFAULT_TIMEOUT_MS;

/** 읽기 전용 실행에 덧붙이는 한 줄. 강제는 툴 목록이 하고(쓰기 툴 미제공), 이 문장은 이유를 말한다. */
const READ_ONLY_INSTRUCTION =
  "이번 실행은 읽기 전용이다. 쓰기 도구가 제공되지 않는다. 조회한 사실과 근거만 보고하고, 고칠 거리는 문장으로만 제안한다.";

/** Shared exact model resolution for Pi and completion requests. */
export const resolvePiModel = resolveOhMyPiModel;

function trimText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function runPiAgent(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const emit = (event: PiAgentEvent) => options.onEvent?.(event);
  const base = request.project;
  const ctx = { project: structuredClone(base) as Project };
  const model = resolvePiModel(request.provider, request.model);
  // 툴 요약은 어댑터(onCall)가 알고, 호출 id 는 코어 이벤트가 안다. 이름별 FIFO 로 둘을 맞춘다.
  const pendingSummaries = new Map<string, { ok: boolean; summary: string }[]>();
  const registryTools = createPiToolset(ctx, {
    domains: request.toolDomains,
    readOnly: request.readOnly || options.readOnlyTools,
    toolNames: options.toolNames,
    onCall: ({ name, result }) => {
      const queue = pendingSummaries.get(name) ?? [];
      queue.push({ ok: result.ok, summary: trimText(result.summary, 400) });
      pendingSummaries.set(name, queue);
    },
  });
  const tools: PiToolShape[] = [...registryTools, ...(options.extraTools ?? [])];
  const writer = request.roleModels?.writer;
  if (writer && !options.toolNames) tools.push(createWriterTool(writer, completeProvider,
    options.providerApiKeys?.[writer.provider] ?? (writer.provider === request.provider ? options.apiKey : undefined)));
  const systemPrompt = request.systemPrompt ? [...request.systemPrompt] : buildPiAgentSystemPrompt(base, request.mapIds);
  // 읽기 전용은 툴 목록으로 강제된다(options.readOnlyTools). 이 한 줄은 모델이 "왜 답만 하는지" 알게 한다 —
  // 이유를 모르면 쓰기를 시도하며 턴을 태운다.
  if (request.readOnly) systemPrompt.push(READ_ONLY_INSTRUCTION);
  if (writer && tools.some(tool => tool.name === "consult_writer")) systemPrompt.push("You are Deep, responsible for careful implementation and validation. For story, lore, NPC dialogue or quest prose, consult_writer delegates authorship to Writer. Pass relevant context, then apply its output using project tools. Do not call Writer for mechanical work.");
  const apiKey = options.providerApiKeys ? options.providerApiKeys[request.provider] : options.apiKey;
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel as never } : {}),
      tools: tools as never,
    },
    ...(apiKey ? { getApiKey: () => apiKey as never } : {}),
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
  // 모델 스트림 조각은 버리지 않고 합쳐 중계한다 — 이게 없어서 모델이 생각하는 동안 와이어가 비었다(실측 2026-09-14).
  const deltas = createDeltaRelay(emit);
  const unsubscribe = agent.subscribe((event: { type: string; [key: string]: unknown }) => {
    if (event.type === "message_update") {
      const part = event.assistantMessageEvent as { type?: string; delta?: unknown } | undefined;
      if (part?.type === "thinking_delta" || part?.type === "text_delta") {
        deltas.push(part.type === "thinking_delta" ? "thinking" : "text", typeof part.delta === "string" ? part.delta : "");
      }
      return;
    }
    if (event.type === "turn_start" || event.type === "tool_execution_start" || event.type === "message_end") deltas.flush();
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
    deltas.dispose();
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
