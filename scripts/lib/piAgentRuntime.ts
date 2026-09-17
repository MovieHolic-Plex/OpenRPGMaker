import { createWriterTool } from "./piWriterTool.ts";
import { completeProvider } from "./ohMyPiPiAiRuntime.ts";
// Bun 전용 Pi 에이전트 런타임. `@oh-my-pi/pi-agent-core` 루프에 레지스트리 툴을 붙여 프로젝트
// 사본 위에서 작업을 끝까지 돈다. 결과 프로젝트는 `done` 이벤트로 돌려주고, 적용(커밋 게이트·
// undo·저장)은 호출자(브라우저 패널 또는 CLI)가 맡는다.
//
// 이 파일만 oh-my-pi 코어를 알고 있다. 어댑터(src/ai/piAgent/*)는 순수라서, 코어를 바꾸려면
// 이 파일 하나를 다시 쓰면 된다.

import { Agent, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { resolveOhMyPiModel } from "./ohMyPiModel.ts";
import {
  createPiToolset,
  harvestFindToolsNames,
  resolvePiToolShape,
  type PiToolCallRecord,
  type PiToolShape,
} from "../../src/ai/piAgent/toolAdapter.ts";
import { exportSpatialToolProof } from "../../src/editor/tools/spatialToolState.ts";
import { createDeltaRelay } from "../../src/ai/piAgent/deltaRelay.ts";
import { applyMapDeltas, diffMapsForDelta } from "../../src/ai/piAgent/mapDelta.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { changedProjectKeys, PI_AGENT_DEFAULT_TIMEOUT_MS, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { antigravityToolEnumPayload } from "./ohMyPiToolEnums.ts";
import type { GameMap, Project } from "../../src/project/types.ts";

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
  /** 모델 스트림 대체 — 테스트가 네트워크 없이 진짜 Agent 루프를 돌릴 때 쓰는 시임. */
  readonly streamFn?: StreamFn;
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_TIMEOUT_MS = PI_AGENT_DEFAULT_TIMEOUT_MS;
/** 한 실행에 에스컬레이션으로 얹을 수 있는 툴 상한 — 세션 경로의 16개 계약과 같다(발견은 무제한이 아니다). */
const MAX_ESCALATED_TOOLS = 16;

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
    readOnly: request.readOnly || options.readOnlyTools,
    toolNames: options.toolNames,
    onCall: recordCall,
  });
  tools.push(...registryTools, ...(options.extraTools ?? []));
  for (const tool of tools) exposed.add(tool.name);
  const writer = request.roleModels?.writer;
  if (writer && !options.toolNames) {
    const writerTool = createWriterTool(writer, completeProvider,
      options.providerApiKeys?.[writer.provider] ?? (writer.provider === request.provider ? options.apiKey : undefined));
    tools.push(writerTool);
    exposed.add(writerTool.name);
  }
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
  // 모델 스트림 조각은 버리지 않고 합쳐 중계한다 — 이게 없어서 모델이 생각하는 동안 와이어가 비었다(실측 2026-09-14).
  const deltas = createDeltaRelay(emit);
  // 캔버스 시공 표시(고스트)의 재료. 결과 프로젝트는 맨 끝 `done` 에만 실리므로, 툴마다 «바뀐 칸만»
  // 흘리지 않으면 브라우저 캔버스는 턴이 끝날 때까지 조용하다(2026-09-17 회귀: Pi 가 조수 채팅의
  // 유일한 실행 경로가 된 뒤 시공 표시가 통째로 사라졌다).
  //
  // 섀도우를 한 번만 복제하고 증분으로 따라가는 이유: 툴마다 전체를 다시 복제하면 43맵 프로젝트에서
  // 툴 호출 하나가 수십 MB 복제가 된다. 여기서는 diff 가 어차피 훑는 것만 훑고, 적용은 바뀐 칸뿐이다.
  let ghostShadow = structuredClone(base.maps ?? {}) as Record<string, GameMap>;
  const emitMapDelta = (): void => {
    const changes = diffMapsForDelta(ghostShadow, ctx.project.maps ?? {});
    if (changes.length === 0) return;
    ghostShadow = applyMapDeltas(ghostShadow, changes);
    emit({ type: "map_delta", maps: changes });
  };
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
      // 순서 계약: 무엇을 했나(tool_end) 다음에 무엇이 바뀌었나(map_delta). 브라우저 다리가
      // 실행 중 도구 이름을 먼저 세우고 그 아래 칸을 그린다.
      emitMapDelta();
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
  // 마지막 한 방울 — 툴 경계 밖에서 바뀐 것까지 캔버스에 닿게 한다. 이미 보낸 것은 diff 가 걸러낸다.
  emitMapDelta();
  if (fatal && toolCalls === 0) throw Object.assign(new Error(fatal), { status: 502 });
  const done: PiAgentDoneEvent = {
    type: "done",
    project: ctx.project,
    stats: { ms: Date.now() - started, turns, toolCalls, toolErrors, ...(usage ? { usage } : {}) },
    changedKeys: changedProjectKeys(base, ctx.project),
    // 정본 증거는 이 프로세스 안에만 살아 있다 — 브라우저 수용 게이트가 쓸 수 있게 다이제스트로 내보낸다.
    spatialProof: exportSpatialToolProof(ctx.project),
  };
  emit(done);
  return done;
}
