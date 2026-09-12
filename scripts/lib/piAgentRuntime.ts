// Bun 전용 Pi 에이전트 런타임. `@oh-my-pi/pi-agent-core` 루프에 레지스트리 툴을 붙여 프로젝트
// 사본 위에서 작업을 끝까지 돈다. 결과 프로젝트는 `done` 이벤트로 돌려주고, 적용(커밋 게이트·
// undo·저장)은 호출자(브라우저 패널 또는 CLI)가 맡는다.
//
// 이 파일만 oh-my-pi 코어를 알고 있다. 어댑터(src/ai/piAgent/*)는 순수라서, 코어를 바꾸려면
// 이 파일 하나를 다시 쓰면 된다.

import { Agent, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { getBundledModel, getBundledModels } from "@oh-my-pi/pi-catalog";
import {
  createPiToolset,
  harvestFindToolsNames,
  resolvePiToolShape,
  type PiToolCallRecord,
  type PiToolShape,
} from "../../src/ai/piAgent/toolAdapter.ts";
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
  /** 역할별 툴 범위. 레지스트리 선택에 더해 팀 런타임의 커스텀 툴(assign_map_agent 등)을 붙인다. */
  readonly readOnlyTools?: boolean;
  readonly toolNames?: readonly string[];
  readonly extraTools?: readonly PiToolShape[];
  /** 모델 스트림 대체 — 테스트가 네트워크 없이 진짜 Agent 루프를 돌릴 때 쓰는 시임. */
  readonly streamFn?: StreamFn;
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
/** 한 실행에 에스컬레이션으로 얹을 수 있는 툴 상한 — 세션 경로의 16개 계약과 같다(발견은 무제한이 아니다). */
const MAX_ESCALATED_TOOLS = 16;

/** 읽기 전용 실행에 덧붙이는 한 줄. 강제는 툴 목록이 하고(쓰기 툴 미제공), 이 문장은 이유를 말한다. */
const READ_ONLY_INSTRUCTION =
  "이번 실행은 읽기 전용이다. 쓰기 도구가 제공되지 않는다. 조회한 사실과 근거만 보고하고, 고칠 거리는 문장으로만 제안한다.";

/** 요청 모델 해석. 번들에 없는 저장 ID 는 제공자 기본 모델로 떨어진다 — 번들 첫 항목으로
 * 조용히 바꾸면(구 동작) CCA 에 없는 와이어 ID 로 첫 호출부터 404 가 난다(실측 2026-09-10:
 * gemini-3.8-flash 저장 → claude-opus-4-5 → claude-opus-4-5-thinking 와이어 404).
 * 세션 경로(ohMyPiPiAiRuntime.resolveModel)와 같은 폴백이다. */
export function resolvePiModel(provider: string, modelId?: string) {
  const wanted = modelId?.trim() || getOhMyPiProvider(provider)?.defaultModel || "";
  const exact = wanted ? getBundledModel(provider as never, wanted) : undefined;
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  const providerDefault = getOhMyPiProvider(provider)?.defaultModel;
  const providerFallback = providerDefault ? getBundledModel(provider as never, providerDefault) : undefined;
  if (providerFallback && typeof providerFallback === "object" && "id" in providerFallback) return providerFallback;
  const first = getBundledModels(provider as never)[0];
  if (!first) throw new Error(`oh-my-pi 카탈로그에 ${provider} 모델이 없습니다`);
  return first;
}

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
  // `tools` 는 Agent.initialState 에 참조로 들어가 state.tools === context.tools 가 된다.
  // 코어 루프가 매 턴 이 배열에서 요청을 만들므로, in-place push 가 곧 다음 턴의 선언이다 —
  // 배열 교체(setTools)는 진행 중 루프에 닿지 않는다(컨텍스트가 같은 배열을 잡고 있어서다).
  const tools: PiToolShape[] = [];
  const exposed = new Set<string>();
  let escalatedCount = 0;
  const shapeFor = (name: string): PiToolShape | undefined =>
    resolvePiToolShape(ctx, name, {
      readOnly: options.readOnlyTools,
      toolNames: options.toolNames,
      onCall: recordCall,
    });
  // 선언 승격 — find_tools 수확과 폴백 구제가 공유. 상한은 프롬프트가 커지는 것만 묶는다.
  const declare = (shape: PiToolShape): void => {
    if (escalatedCount >= MAX_ESCALATED_TOOLS) return;
    tools.push(shape);
    exposed.add(shape.name);
    escalatedCount += 1;
  };
  const recordCall = (record: PiToolCallRecord): void => {
    const queue = pendingSummaries.get(record.name) ?? [];
    queue.push({ ok: record.result.ok, summary: trimText(record.result.summary, 400) });
    pendingSummaries.set(record.name, queue);
    // find_tools 수확 — 발견된 이름을 다음 턴 요청부터 실제로 선언한다(세션의 에스컬레이션 이식).
    if (record.name === "find_tools") {
      for (const name of harvestFindToolsNames(record.result)) {
        if (exposed.has(name)) continue;
        const shape = shapeFor(name);
        if (shape) declare(shape);
      }
    }
  };
  const registryTools = createPiToolset(ctx, {
    domains: request.toolDomains,
    readOnly: options.readOnlyTools,
    toolNames: options.toolNames,
    onCall: recordCall,
  });
  tools.push(...registryTools, ...(options.extraTools ?? []));
  for (const tool of tools) exposed.add(tool.name);
  const systemPrompt = request.systemPrompt ? [...request.systemPrompt] : buildPiAgentSystemPrompt(base, request.mapIds);
  // 읽기 전용은 툴 목록으로 강제된다(options.readOnlyTools). 이 한 줄은 모델이 "왜 답만 하는지" 알게 한다 —
  // 이유를 모르면 쓰기를 시도하며 턴을 태운다.
  if (request.readOnly) systemPrompt.push(READ_ONLY_INSTRUCTION);
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel as never } : {}),
      tools: tools as never,
    },
    ...(options.apiKey ? { getApiKey: () => options.apiKey as never } : {}),
    ...(options.streamFn ? { streamFn: options.streamFn } : {}),
    ...(request.provider === "google-antigravity"
      ? { onPayload: antigravityToolEnumPayload(String((model as { id?: string }).id ?? ""), tools) as never }
      : {}),
    // 미노출 툴 호출 구제 — 축소 노출(core+도메인) 아래서 모델이 find_tools 없이 곧바로 이름을
    // 쳐도, 레지스트리에 있고 실행 경계(readOnly·toolNames) 안이면 실제로 실행된다.
    // 경계 밖 이름은 undefined → 평범한 "tool not found" 결과가 모델의 자가수정을 돌린다.
    resolveFallbackTool: (name: string) => {
      const shape = shapeFor(name);
      if (shape && !exposed.has(name)) declare(shape);
      return shape as never;
    },
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
