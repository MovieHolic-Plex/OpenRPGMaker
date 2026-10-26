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

import { capResultImages, compactCliToolList, CLI_CONTEXT_EXHAUSTED_PREFIX, isCliContextExhaustedText } from "../../../src/ai/piAgent/cliContextBudget.ts";
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
  /** 지시문 조각별 글자 수(앞 40자로 이름) — 어느 지시가 무거운지. */
  systemSections?: { head: string; chars: number }[];
  /** 마지막 tools/list 에서 설명+스키마가 가장 긴 도구 12개. */
  listTop?: { name: string; chars: number }[];
  /**
   * 모델 요청마다: 실행 시작부터 첫 응답 줄까지(startMs), 직전 도구 끝·차례 시작부터 기다린 시간(waitMs = 모델 생각·생성),
   * 그 요청의 출력·캐시 토큰과 부른 도구. 시간 대부분이 어디서 가는지(생각 대 도구) 재는 근거.
   */
  requests?: { startMs: number; waitMs: number; out: number; cacheRead: number; cacheWrite: number; input: number; tools: string[] }[];
}

export interface LocalCliLoop {
  subscribe(listener: (event: CoreEvent) => void): () => void;
  prompt(text: string): Promise<void>;
  steer(message: { content?: readonly { type: string; text?: string }[] } | string): void;
  abort(reason?: string): void;
  dispose(): Promise<void>;
  stats(): LocalCliLoopStats;
  /** 지금 CLI 대화를 닫는다 — 다음 prompt 는 빈 대화(같은 시스템 지시·같은 MCP 도구)로 시작한다. */
  resetSession(): Promise<void>;
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
  const weight: LocalCliWeight = { systemChars: setup.systemPrompt.join("\n\n").length, listChars: 0, listCount: 0, results: {},
    systemSections: setup.systemPrompt.map((part) => ({ head: part.slice(0, 40).replace(/\s+/gu, " "), chars: part.length })).sort((a, b) => b.chars - a.chars).slice(0, 12),
    requests: [] };
  const loopStarted = Date.now();
  let lastActivity = loopStarted;
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
      // 목록만 가볍게(깊은 설명 걷기·같은 큰 하위 스키마 한 줄) — J79: 24만 자 목록이 Claude 문맥의 80% 를 먹었다.
      const list = compactCliToolList(setup.tools.map(mcpToolOf));
      weight.listChars = JSON.stringify(list).length;
      weight.listCount = list.length;
      weight.listTop = list.map((tool) => ({ name: tool.name, chars: JSON.stringify(tool).length })).sort((a, b) => b.chars - a.chars).slice(0, 12);
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
        const raw = await tool.execute(id, args, setup.signal);
        // 짓기 동사가 그림을 여러 장 돌려주면 CLI 에는 첫 장만 보낸다(J79). 실행기·관문이 보는 사건은 원본 그대로.
        emit({ type: "tool_execution_end", toolCallId: id, toolName: name, isError: false, result: raw });
        const result = { ...raw, content: capResultImages(name, raw.content) };
        weigh(name, result.content as never);
        sentResults.push({ name, content: result.content as never, isError: false });
        return { content: result.content as LocalMcpContent[] };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        emit({ type: "tool_execution_end", toolCallId: id, toolName: name, isError: true, result: { content: [{ type: "text", text }] } });
        sentResults.push({ name, content: [{ type: "text", text }], isError: true });
        return { content: [{ type: "text", text }], isError: true };
      } finally {
        lastActivity = Date.now();
        release();
        // find_tools 수확·폴백 선언으로 도구가 늘었으면 CLI 에 목록이 바뀌었다고 알린다.
        announceToolChanges();
      }
    },
  });

  // 우리가 돌려준 결과(호출 순서). 원문을 되돌려 주지 않는 CLI 는 acknowledged 와 짝짓고(같은 이름끼리 먼저 온 것부터),
  // 되돌려 주는 CLI 는 그림을 다시 인코딩했을 때 짝짓는다(아래 restoreReencodedImages).
  const sentResults: { name: string; content: readonly { type: string; text?: string; data?: string; mimeType?: string }[]; isError: boolean }[] = [];
  const asDelivered = (row: (typeof sentResults)[number]) => ({
    type: "tool_result", ...(row.isError ? { is_error: true } : {}),
    content: row.content.map((part) => part.type === "image" ? { type: "image", source: { type: "base64", media_type: part.mimeType ?? "image/png", data: part.data ?? "" } } : { type: "text", text: part.text ?? "" }),
  });
  /**
   * CLI 가 큰 그림을 스스로 줄여 다시 인코딩해 넘긴다(실측 2026-10-20: Claude Code 는 긴 변 2000px 초과를 2000px 로 줄인다 —
   * 2304×288 농장 아틀라스가 2000×250 으로 넘어가 바이트가 달라지고, 관문이 「이미지 전달 필요」로 영영 막았다).
   * CLI 가 «그 도구 결과의 그 자리에 그림을 넘겼다»고 되돌려 준 것은 전달 증거다(D5) — 글이 우리 결과와 똑같고 그림 수가 같을 때만
   * 우리가 보낸 원본으로 바꿔 관문에 넘긴다. 글이 잘렸거나 그림 수가 다르면 그대로 두어 인정하지 않는다.
   */
  const ourImageData = (row: (typeof sentResults)[number]) => row.content.filter((part) => part.type === "image").map((part) => part.data ?? "");
  const textOf = (parts: readonly { type?: string; text?: string }[]) => parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
  const restoreReencodedImages = (payload: readonly unknown[]): unknown[] => payload.map((item) => {
    const result = item as { type?: string; content?: unknown };
    if (result?.type !== "tool_result" || !Array.isArray(result.content)) return item;
    const parts = result.content as { type?: string; text?: string; source?: { data?: string; media_type?: string } }[];
    const echoed = parts.filter((part) => part.type === "image").map((part) => part.source?.data ?? "");
    if (!echoed.length) return item;
    const index = sentResults.findIndex((row) => { const ours = ourImageData(row); return ours.length === echoed.length && textOf(row.content) === textOf(parts); });
    if (index < 0) return item;
    const [row] = sentResults.splice(index, 1);
    const ours = ourImageData(row!);
    if (ours.every((data, i) => data === echoed[i])) return item;
    let next = 0;
    return { ...result, content: parts.map((part) => part.type === "image" ? { type: "image", source: { type: "base64", media_type: part.source?.media_type ?? "image/png", data: ours[next++] ?? "" } } : part) };
  });
  const onCliEvent = (event: LocalCliEvent) => {
    if (event.kind === "delivered") { pendingDelivered.push(...restoreReencodedImages(event.payload)); return; }
    if (event.kind === "acknowledged") {
      const index = sentResults.findIndex((row) => event.toolName === row.name || event.toolName.endsWith(`_${row.name}`) || event.toolName.endsWith(`__${row.name}`));
      if (index >= 0) { const [row] = sentResults.splice(index, 1); if (event.ok && !row!.isError) pendingDelivered.push(asDelivered(row!)); }
      return;
    }
    if (event.kind === "stderr") { stderrTail = (stderrTail + event.text).slice(-2000); return; }
    if (event.kind === "assistant") {
      if (event.newRequest) {
        const now = Date.now();
        weight.requests!.push({ startMs: now - loopStarted, waitMs: now - lastActivity, out: 0, cacheRead: 0, cacheWrite: 0, input: 0, tools: [] });
        lastActivity = now;
      }
      const current = weight.requests!.at(-1);
      if (current) {
        if (event.usage) { current.out = Math.max(current.out, event.usage.output); current.cacheRead = Math.max(current.cacheRead, event.usage.cacheRead); current.cacheWrite = Math.max(current.cacheWrite, event.usage.cacheWrite); current.input = Math.max(current.input, event.usage.input); }
        for (const block of event.blocks) if (block.type === "tool_use") current.tools.push(block.name.replace(/^mcp__[^_]+__/u, ""));
      }
      if (event.newRequest) emit({ type: "turn_start" });
      // 이 응답은 직전 도구 결과를 받은 모델이 낸 것이다 — 관문에 «실제로 넘어간 것»을 보여 준 뒤 완료로 친다.
      if (pendingDelivered.length) { setup.onPayload({ messages: [{ role: "user", content: pendingDelivered }] }); pendingDelivered = []; }
      for (const block of event.blocks) if (block.type === "thinking" && block.text) emit({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: block.text } });
      const text = event.blocks.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join("");
      // CLI 가 문맥 한도로 멈추고 그 사정을 답 글로 돌려줬다 — 보고가 아니라 실패다(J79). 실행기가 세션을 비우고 한 번 이어 한다.
      if (text && isCliContextExhaustedText(text)) {
        emit({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: `${CLI_CONTEXT_EXHAUSTED_PREFIX} ${text.slice(0, 300)}` } });
        return;
      }
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
      lastActivity = Date.now();
      await open().prompt(text);
    },
    steer(message) {
      const text = typeof message === "string" ? message : (message.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
      if (text) session?.steer(text);
    },
    abort() { aborted = true; session?.kill(); },
    async resetSession() {
      const previous = session;
      session = undefined;
      await previous?.close().catch(() => undefined);
    },
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
