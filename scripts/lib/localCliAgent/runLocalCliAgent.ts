// 로컬 CLI 엔진 — `runPiAgent` 와 같은 요청(PiAgentRequest)을 받아 같은 이벤트(PiAgentEvent)를 흘리고
// 같은 `done`(결과 프로젝트)을 돌려준다. 다른 점은 LLM 루프를 우리가 돌리지 않는다는 것 하나다:
// 사용자의 `claude -p` 가 루프를 돌고, 도구는 이 프로세스의 MCP 서버(작업 사본 위)를 부른다.
//
// 그래서 하류(맵 소유권 잠금 piRunRelay · 이어 받기 · 고스트 map_delta · mergeMapBundles · applyProposedProject)는
// 바뀌지 않는다. 스파이크 범위: 레지스트리 도구(createPiToolset) + 범위 가드 + show_map_region 그림.
// runPiAgent 안의 나머지 관문(체크포인트·칩셋 선택·spatialProof)은 2단계에서 공용 「도구 표면」으로 뽑아 같이 쓴다.

import { createPiToolset, type PiToolShape } from "../../../src/ai/piAgent/toolAdapter.ts";
import { PiTilesetReferenceGate } from "../../../src/ai/piAgent/tilesetReferenceGate.ts";
import { buildPiAgentSystemPrompt } from "../../../src/ai/piAgent/systemPrompt.ts";
import { diffMapsForDelta } from "../../../src/ai/piAgent/mapDelta.ts";
import { changedProjectKeys, piMapScopeGuard, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "../../../src/ai/piAgent/protocol.ts";
import type { Project } from "../../../src/project/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { startLocalMcpServer, type LocalMcpContent } from "./mcpHttpServer.ts";
import { runClaudeTurn, type ClaudeStreamMessage } from "./claudeCli.ts";

export const LOCAL_CLAUDE_PROVIDER = "local-cli:claude";

export interface RunLocalCliAgentOptions {
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
  /** 브라우저(또는 헤드리스 렌더러)가 맵 영역을 PNG(base64)로 그린다. 없으면 show_map_region 은 글만 준다. */
  readonly renderToolImage?: (project: Project, toolName: string, data: unknown) => Promise<string | null | undefined>;
  /** 노출할 도구 이름(허용 목록). 비우면 레지스트리 전부. */
  readonly toolNames?: readonly string[];
  /** 한 실행의 도구 호출 상한 — CLI 쪽 턴 상한과 별개로 우리가 지킨다. */
  readonly maxToolCalls?: number;
  readonly binary?: string;
  /** 원본 stream-json 줄(기록용). */
  readonly onRawLine?: (message: ClaudeStreamMessage) => void;
  readonly onStderr?: (text: string) => void;
}

export async function runLocalCliAgent(request: PiAgentRequest, options: RunLocalCliAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const started = Date.now();
  const emit = (event: PiAgentEvent) => options.onEvent?.({ ...event, at: Date.now() });
  const base = request.project;
  // 작업 사본. 러너는 쓰기마다 ctx.project 를 새 초안으로 갈아 끼운다(원본은 그대로).
  const ctx: ToolContext = { project: base, assistantRun: true, ...(request.currentMapId ? { currentMapId: request.currentMapId } : {}) };
  let toolCalls = 0;
  let toolErrors = 0;
  const pendingStart = new Map<string, { name: string; at: number }>();
  // 참고문서 선행 읽기 관문: Pi 경로는 «제공자에게 실제로 나간 요청 본문»을 보고 읽음을 인정한다.
  // 여기선 그 본문을 우리가 못 본다. 대신 CLI 의 stream-json 이 모델에게 넘긴 tool_result(글·그림 원문)를
  // `user` 줄로 그대로 되돌려 준다 — 그걸 같은 관문에 먹이고, 뒤이은 assistant 줄(모델이 그걸 받고 답함)에서 인정한다.
  // CLI 가 MCP 출력을 자르면(MAX_MCP_OUTPUT_TOKENS) 원문이 달라져 인정되지 않는다 — 의도한 동작이다.
  const referenceGate = new PiTilesetReferenceGate();
  // payload() 는 부를 때마다 앞 묶음을 비운다 — 병렬 도구 결과가 user 줄 여러 개로 오므로 모아서 한 번에 넘긴다.
  let delivered: unknown[] = [];
  const tools: PiToolShape[] = createPiToolset(ctx, {
    referenceGate,
    ...(options.toolNames ? { toolNames: options.toolNames } : {}),
    ...(request.readOnly ? { readOnly: true } : {}),
    ...piMapScopeGuard(request),
    onCall: (record) => {
      const id = record.toolCallId ?? `call_${toolCalls}`;
      const start = pendingStart.get(id);
      emit({ type: "tool_end", id, name: record.name, ok: record.result.ok, summary: String(record.result.summary ?? ""),
        ...(start ? { durationMs: Date.now() - start.at } : {}), ...(record.visuals?.length ? { visuals: record.visuals } : {}) });
      if (!record.result.ok) toolErrors += 1;
    },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const maxToolCalls = options.maxToolCalls ?? 120;

  const mcp = await startLocalMcpServer({
    name: "oprn-editor",
    tools: () => tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.parameters })),
    async callTool(name, args) {
      const tool = byName.get(name);
      if (!tool) return { content: [{ type: "text", text: `이 실행에서 쓸 수 없는 도구입니다: ${name}` }], isError: true };
      if (toolCalls >= maxToolCalls) return { content: [{ type: "text", text: `도구 호출 상한(${maxToolCalls})에 닿았습니다. 지금까지 한 일을 보고하고 끝내세요.` }], isError: true };
      toolCalls += 1;
      const id = `mcp_${toolCalls}`;
      pendingStart.set(id, { name, at: Date.now() });
      emit({ type: "tool_start", id, name, args });
      const before = ctx.project;
      let content: LocalMcpContent[];
      try {
        const out = await tool.execute(id, args, options.signal);
        content = [...out.content];
      } catch (error) {
        // createPiToolset 은 실패를 throw 로 낸다(본문에 issues). MCP 에선 isError 결과로 돌려준다.
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
      }
      if (ctx.project !== before) {
        const maps = diffMapsForDelta(before.maps, ctx.project.maps);
        if (maps.length > 0) emit({ type: "map_delta", maps });
      }
      // 모델이 결과를 눈으로 보게 — 편집기 캔버스와 같은 렌더러로 그린 그림을 붙인다.
      if (name === "show_map_region" && options.renderToolImage) {
        // 렌더러는 mapId·x·y·w·h 만 본다. 결과 본문(잘릴 수 있음)을 다시 파싱하지 않고 인자를 넘긴다.
        const png = await options.renderToolImage(ctx.project, name, args).catch(() => null);
        if (png) content.push({ type: "image", mimeType: "image/png", data: png });
      }
      return { content };
    },
  });

  const system = request.systemPrompt ?? buildPiAgentSystemPrompt(base, request.mapIds, request.scopeStrict !== false, { spatialWork: true });
  emit({ type: "start", provider: LOCAL_CLAUDE_PROVIDER, model: request.model ?? "(사용자 Claude Code 기본값)", toolCount: tools.length });
  let turns = 0;
  let lastText = "";
  let usage: Record<string, unknown> | undefined;
  let costUsd: number | undefined;
  try {
    const outcome = await runClaudeTurn({
      ...(options.binary ? { binary: options.binary } : {}),
      mcpUrl: mcp.url,
      mcpToken: mcp.token,
      prompt: request.task,
      appendSystemPrompt: [
        "너는 OPRN 에디터의 조수다. 프로젝트는 `mcp__oprn__*` 도구로만 읽고 고친다. 파일·셸은 없다.",
        "끝나면 사용자에게 한국어로 무엇을 바꿨는지 짧게 보고한다.",
        ...system,
      ].join("\n"),
      ...(request.model ? { model: request.model } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      onLine: (message) => {
        options.onRawLine?.(message);
        if (message.type === "user") delivered.push(message.message);
        if (message.type === "assistant" && delivered.length > 0) { referenceGate.payload(delivered); referenceGate.complete(true); delivered = []; }
        if (message.type === "assistant") {
          turns += 1;
          emit({ type: "turn", index: turns });
          const content = (message.message as { content?: { type: string; text?: string }[] } | undefined)?.content ?? [];
          for (const part of content) if (part.type === "text" && part.text?.trim()) { lastText = part.text; emit({ type: "assistant", text: part.text }); }
        }
        if (message.type === "result") {
          usage = message.usage as Record<string, unknown> | undefined;
          costUsd = typeof message.total_cost_usd === "number" ? message.total_cost_usd : undefined;
          if (message.is_error) emit({ type: "error", message: String(message.result ?? message.subtype ?? "Claude Code 실행 실패") });
        }
      },
      ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    });
    if (outcome.exitCode !== 0 && !outcome.result) emit({ type: "error", message: `Claude Code 가 코드 ${outcome.exitCode} 로 끝났습니다` });
  } finally {
    await mcp.close();
  }
  emit({ type: "execution_status", name: "local-cli.usage", summary: costUsd !== undefined ? `Claude Code 보고 비용 $${costUsd.toFixed(4)} (구독 로그인이면 실제 청구가 아니라 한도 소진량)` : "비용 보고 없음", data: { usage, costUsd, lastText: lastText.slice(0, 400) } });
  const project = ctx.project;
  const done: PiAgentDoneEvent = {
    type: "done",
    project,
    changedKeys: changedProjectKeys(base, project),
    stats: { ms: Date.now() - started, turns, toolCalls, toolErrors },
  } as PiAgentDoneEvent;
  // runPiAgent 와 같이 done 도 이벤트로 낸다 — 워커 스트림(createPiAgentNdjsonStream)은 반환값이 아니라 이 줄을 보낸다.
  emit(done);
  return done;
}
