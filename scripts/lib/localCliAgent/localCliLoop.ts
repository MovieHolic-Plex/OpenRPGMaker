// 로컬 CLI 루프 — `@oh-my-pi/pi-agent-core` 의 Agent 와 같은 얼굴(subscribe·prompt·steer·abort)을 한 운전기.
//
// runPiAgent 는 이것을 Agent 자리에 끼운다. 그래서 도구 표면 전부 — 실시간 체크포인트·참고문서/칩셋 관문·spatialProof·
// 시공 고스트(map_delta)·반복 차단·완료 검사·배치 품질 권고·팀 모드 — 가 두 엔진에서 «같은 코드»로 돈다(D1 동등성).
// 다른 점은 하나: LLM 루프를 우리가 돌리지 않고 사용자의 CLI 가 돈다. 도구는 이 프로세스의 MCP 서버로 부른다.
//
// 코어 사건 흉내:
// - CLI 가 새 모델 요청의 응답을 내면 turn_start, 응답 덩어리마다 message_end(글).
// - MCP tools/call → tool_execution_start / tool_execution_end(실패면 isError + 오류 글). 결과 본문은 도구가 낸 것 그대로.
// - CLI 가 «모델에게 넘겼다»고 되돌려 준 도구 결과(delivered)는 다음 응답 직전에 onPayload 로 관문에 먹인다 —
//   Pi 의 onPayload(제공자 요청 본문)와 같은 자리다. 우리가 보낸 것이 아니라 CLI 가 받았다고 말한 것만 인정한다.
// - 한 차례 끝(result)의 사용량은 내용 없는 message_end 하나로 합산한다.

import type { PiToolShape } from "../../../src/ai/piAgent/toolAdapter.ts";
import { startLocalMcpServer, type LocalMcpContent, type LocalMcpServer } from "./mcpHttpServer.ts";
import { localCliBinary, LOCAL_CLI_ADAPTERS } from "./registry.ts";
import type { LocalCliBilling, LocalCliEvent, LocalCliId, LocalCliSession, LocalCliUsage } from "./types.ts";

type CoreEvent = { type: string; [key: string]: unknown };

export interface LocalCliLoopSetup {
  readonly cli: LocalCliId;
  readonly systemPrompt: readonly string[];
  /** runPiAgent 의 살아 있는 도구 배열 — find_tools 수확이 push 하면 다음 tools/list 에 나온다(list_changed 알림). */
  readonly tools: PiToolShape[];
  readonly onPayload: (payload: unknown) => unknown;
  /** 목록에 없지만 이 실행 경계 안의 이름(폴백 구제). 선언까지 해 준다. */
  readonly resolveFallbackTool: (name: string) => PiToolShape | undefined;
  readonly model?: string;
  readonly effort?: "low" | "medium" | "high";
  readonly signal?: AbortSignal;
  readonly onRaw?: (line: unknown) => void;
  readonly onStatus?: (name: string, summary: string, data?: unknown) => void;
}

export interface LocalCliLoopStats {
  readonly engine: string;
  readonly billing: LocalCliBilling;
  readonly costUsd?: number;
  readonly usage?: LocalCliUsage;
  readonly toolsListed: number;
  readonly listChanged: number;
  /** 무게 재기(토큰 절감 근거): 지시문·도구 목록 글자 수, 도구별 결과 글자·그림 수. */
  readonly weight: LocalCliWeight;
}

export interface LocalCliWeight {
  systemChars: number;
  /** 마지막 tools/list 의 JSON 글자 수와 도구 수. */
  listChars: number;
  listCount: number;
  results: Record<string, { calls: number; textChars: number; images: number; imageBytes: number }>;
}

export interface LocalCliLoop {
  subscribe(listener: (event: CoreEvent) => void): () => void;
  prompt(text: string): Promise<void>;
  steer(message: { content?: readonly { type: string; text?: string }[] } | string): void;
  abort(reason?: string): void;
  dispose(): Promise<void>;
  stats(): LocalCliLoopStats;
}

/** 쓰기(배타) 도구는 혼자, 읽기 도구는 겹쳐 돈다 — Pi 코어의 순서 규칙과 같다. CLI 가 병렬로 불러도 지킨다. */
class ToolGate {
  private shared = 0;
  private exclusive = false;
  private waiters: (() => void)[] = [];
  async acquire(exclusive: boolean): Promise<() => void> {
    for (;;) {
      if (exclusive ? !this.exclusive && this.shared === 0 : !this.exclusive) break;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    if (exclusive) this.exclusive = true; else this.shared += 1;
    return () => {
      if (exclusive) this.exclusive = false; else this.shared -= 1;
      const waiting = this.waiters; this.waiters = [];
      waiting.forEach((wake) => wake());
    };
  }
}

/** MCP 도구 설명 — 스키마는 레지스트리 그대로(D4: 같은 스키마). 묶음 이름만 제목에 붙인다. */
function mcpToolOf(tool: PiToolShape): { name: string; description: string; inputSchema: unknown } {
  return { name: tool.name, description: tool.description, inputSchema: tool.parameters ?? { type: "object", properties: {} } };
}

export async function createLocalCliLoop(setup: LocalCliLoopSetup): Promise<LocalCliLoop> {
  const adapter = LOCAL_CLI_ADAPTERS[setup.cli];
  const binary = localCliBinary(setup.cli);
  const status = await adapter.detect(binary);
  if (status.state !== "ready") {
    throw Object.assign(new Error(`${status.label}: ${status.stateLabel}${status.problem ? ` — ${status.problem}` : ""}. ${status.state === "not-installed" ? status.install.help : status.login.help}`), { status: 412 });
  }
  const listeners = new Set<(event: CoreEvent) => void>();
  const emit = (event: CoreEvent) => { for (const listener of listeners) listener(event); };
  const gate = new ToolGate();
  let aborted = false;
  let callSeq = 0;
  let listChanged = 0;
  let costUsd: number | undefined;
  let usage: LocalCliUsage | undefined;
  let pendingDelivered: unknown[] = [];
  let stderrTail = "";
  const signature = () => setup.tools.map((tool) => tool.name).join("\n");
  let listed = signature();
  let mcp: LocalMcpServer | undefined;
  const weight: LocalCliWeight = { systemChars: setup.systemPrompt.join("\n\n").length, listChars: 0, listCount: 0, results: {} };
  const weigh = (name: string, content: readonly { type: string; text?: string; data?: string }[]) => {
    const row = weight.results[name] ??= { calls: 0, textChars: 0, images: 0, imageBytes: 0 };
    row.calls += 1;
    for (const part of content) {
      if (part.type === "text") row.textChars += part.text?.length ?? 0;
      if (part.type === "image") { row.images += 1; row.imageBytes += Math.round((part.data?.length ?? 0) * 0.75); }
    }
  };

  const findTool = (name: string): PiToolShape | undefined => setup.tools.find((tool) => tool.name === name) ?? setup.resolveFallbackTool(name);
  const announceToolChanges = () => {
    const now = signature();
    if (now === listed) return;
    listed = now;
    listChanged += 1;
    mcp?.notifyToolsChanged();
  };

  mcp = await startLocalMcpServer({
    name: "oprn-editor",
    tools: () => {
      listed = signature();
      const list = setup.tools.map(mcpToolOf);
      weight.listChars = JSON.stringify(list).length;
      weight.listCount = list.length;
      return list;
    },
    async callTool(name, args) {
      if (aborted || setup.signal?.aborted) return { content: [{ type: "text", text: "실행이 중단되었습니다." }], isError: true };
      const tool = findTool(name);
      if (!tool) return { content: [{ type: "text", text: `이 실행에서 쓸 수 없는 도구입니다: ${name}. find_tools 로 찾으세요.` }], isError: true };
      const id = `mcp_${++callSeq}`;
      const release = await gate.acquire(tool.concurrency === "exclusive");
      emit({ type: "tool_execution_start", toolCallId: id, toolName: name, args });
      try {
        const result = await tool.execute(id, args, setup.signal);
        emit({ type: "tool_execution_end", toolCallId: id, toolName: name, isError: false, result });
        weigh(name, result.content as never);
        if (!adapter.echoesResults) sentResults.push({ name, content: result.content as never, isError: false });
        return { content: result.content as LocalMcpContent[] };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        emit({ type: "tool_execution_end", toolCallId: id, toolName: name, isError: true, result: { content: [{ type: "text", text }] } });
        if (!adapter.echoesResults) sentResults.push({ name, content: [{ type: "text", text }], isError: true });
        return { content: [{ type: "text", text }], isError: true };
      } finally {
        release();
        // find_tools 수확·폴백 선언으로 도구가 늘었으면 CLI 에 목록이 바뀌었다고 알린다.
        announceToolChanges();
      }
    },
  });

  // 원문을 되돌려 주지 않는 CLI 용 — 우리가 돌려준 결과를 호출 순서대로 둔다(같은 이름끼리 먼저 온 것부터 짝짓는다).
  const sentResults: { name: string; content: readonly { type: string; text?: string; data?: string; mimeType?: string }[]; isError: boolean }[] = [];
  const asDelivered = (row: (typeof sentResults)[number]) => ({
    type: "tool_result", ...(row.isError ? { is_error: true } : {}),
    content: row.content.map((part) => part.type === "image" ? { type: "image", source: { type: "base64", media_type: part.mimeType ?? "image/png", data: part.data ?? "" } } : { type: "text", text: part.text ?? "" }),
  });
  const onCliEvent = (event: LocalCliEvent) => {
    if (event.kind === "delivered") { pendingDelivered.push(...event.payload); return; }
    if (event.kind === "acknowledged") {
      const index = sentResults.findIndex((row) => event.toolName === row.name || event.toolName.endsWith(`_${row.name}`) || event.toolName.endsWith(`__${row.name}`));
      if (index >= 0) { const [row] = sentResults.splice(index, 1); if (event.ok && !row!.isError) pendingDelivered.push(asDelivered(row!)); }
      return;
    }
    if (event.kind === "stderr") { stderrTail = (stderrTail + event.text).slice(-2000); return; }
    if (event.kind === "assistant") {
      if (event.newRequest) emit({ type: "turn_start" });
      // 이 응답은 직전 도구 결과를 받은 모델이 낸 것이다 — 관문에 «실제로 넘어간 것»을 보여 준 뒤 완료로 친다.
      if (pendingDelivered.length) { setup.onPayload({ messages: [{ role: "user", content: pendingDelivered }] }); pendingDelivered = []; }
      for (const block of event.blocks) if (block.type === "thinking" && block.text) emit({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: block.text } });
      const text = event.blocks.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join("");
      emit({ type: "message_end", message: { role: "assistant", content: text ? [{ type: "text", text }] : [], stopReason: "stop" } });
      return;
    }
    // result — 사용량 합산(내용 없는 message_end 하나), 실패면 오류로.
    if (event.costUsd !== undefined) costUsd = (costUsd ?? 0) + event.costUsd;
    if (event.usage) usage = usage ? { input: usage.input + event.usage.input, output: usage.output + event.usage.output, cacheRead: usage.cacheRead + event.usage.cacheRead, cacheWrite: usage.cacheWrite + event.usage.cacheWrite, calls: usage.calls + event.usage.calls } : event.usage;
    pendingDelivered = [];
    const errorMessage = !event.ok && !aborted ? `${event.error ?? "CLI 실행 실패"}${stderrTail.trim() ? ` (${stderrTail.trim().split("\n").slice(-2).join(" / ").slice(0, 300)})` : ""}` : undefined;
    emit({ type: "message_end", message: { role: "assistant", content: [], ...(event.usage ? { usage: { ...event.usage, totalTokens: event.usage.input + event.usage.output + event.usage.cacheRead + event.usage.cacheWrite } } : {}), stopReason: errorMessage ? "error" : "stop", ...(errorMessage ? { errorMessage } : {}) } });
  };

  let session: LocalCliSession | undefined;
  const open = () => session ??= adapter.openSession({
    mcpUrl: mcp!.url, mcpToken: mcp!.token, systemPrompt: setup.systemPrompt.join("\n\n"), binary,
    ...(setup.model ? { model: setup.model } : {}), ...(setup.effort ? { effort: setup.effort } : {}),
    ...(setup.signal ? { signal: setup.signal } : {}), ...(setup.onRaw ? { onRaw: setup.onRaw } : {}),
    onEvent: onCliEvent,
  });

  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async prompt(text) {
      if (aborted) return;
      await open().prompt(text);
    },
    steer(message) {
      const text = typeof message === "string" ? message : (message.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
      if (text) session?.steer(text);
    },
    abort() { aborted = true; session?.kill(); },
    async dispose() {
      await session?.close().catch(() => undefined);
      await mcp?.close();
      setup.onStatus?.("local-cli.usage", costUsd !== undefined
        ? `${status.label} 보고 ${status.billing === "subscription" ? "구독 한도 사용(청구 아님) · 환산" : "비용"} $${costUsd.toFixed(4)}`
        : `${status.label} ${status.billing === "subscription" ? "구독 한도 사용(청구 아님)" : "사용"} · 토큰 ${usage ? usage.input + usage.output + usage.cacheRead + usage.cacheWrite : 0}`, { usage, costUsd, billing: status.billing, listChanged, weight });
    },
    stats: () => ({ engine: `local-cli:${setup.cli}`, billing: status.billing, ...(costUsd !== undefined ? { costUsd } : {}), ...(usage ? { usage } : {}), toolsListed: setup.tools.length, listChanged, weight }),
  };
}
