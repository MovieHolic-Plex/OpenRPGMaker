// omp-to-pi 시제품(2026-11-26): 원조 pi(@earendil-works/pi-ai·pi-agent-core 1.6.1) 위에 우리가 쓰던 omp 모양만 맞춘 얇은 층.
//
// 워커가 omp(@oh-my-pi/*, Rust 애드온 136MB + Bun 전용 import)를 싣지 않게 하려고 만들었다. 이 파일만 원조 pi 를 import 한다.
// omp 에만 있던 것과 메우는 방법:
// - getToolChoice("required"·{type:"tool",name}): 원조 pi 의 toolChoice 는 "auto"|"none" 뿐이라 onPayload 로 제공자 요청에 직접 넣는다.
// - soft 도구 선택(reminder): 그 호출의 문맥 끝에 리마인더 메시지를 붙인다(대화 기록에는 남지 않는다).
// - 도구 concurrency "exclusive": executionMode "sequential" 로 옮긴다. 원조 pi 는 한 묶음에 sequential 이 하나라도 있으면 묶음 전체를 차례로 돈다.
// - resolveFallbackTool·lenientArgValidation·deadline: 대응이 없다. 받기만 하고 쓰지 않는다(시제품 한계, 보고서 「동작 차이」).
import * as pi from "@earendil-works/pi-ai/compat";
import { Agent as PiAgent, type StreamFn as PiStreamFn } from "@earendil-works/pi-agent-core";

export type { AssistantMessage, ImageContent, TextContent } from "@earendil-works/pi-ai";
export type Effort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type StreamFn = PiStreamFn;

type WatchedOptions = Parameters<typeof pi.streamSimple>[2] & { streamFirstEventTimeoutMs?: number; streamIdleTimeoutMs?: number };

// 원조 pi 는 streamFirstEventTimeoutMs·streamIdleTimeoutMs 를 모른다. 감시를 여기서 다시 건다(문구는 providerRetry.ts MODEL_STALL_PATTERN 과 맞춘다).
export function streamSimple(model: Parameters<typeof pi.streamSimple>[0], context: Parameters<typeof pi.streamSimple>[1], options?: WatchedOptions) {
  const firstMs = options?.streamFirstEventTimeoutMs;
  const idleMs = options?.streamIdleTimeoutMs;
  if (!firstMs && !idleMs) return pi.streamSimple(model, context, options);
  const controller = new AbortController();
  options?.signal?.addEventListener("abort", () => controller.abort(options.signal?.reason), { once: true });
  const inner = pi.streamSimple(model, context, { ...options, signal: controller.signal });
  const outer = pi.createAssistantMessageEventStream();
  let stalled: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number | undefined, text: string) => {
    clearTimeout(timer);
    if (ms) timer = setTimeout(() => { stalled = text; controller.abort(new Error(text)); }, ms);
  };
  arm(firstMs, `stream timed out while waiting for the first event (${firstMs}ms)`);
  void (async () => {
    let last: any;
    try {
      for await (const event of inner) {
        arm(idleMs, `stream stalled while waiting for the next event (${idleMs}ms)`);
        last = event;
        if (stalled && event.type === "error") break;
        outer.push(event);
      }
    } catch {
      last = undefined;
    } finally {
      clearTimeout(timer);
    }
    if (stalled) {
      const error = { ...(last?.error ?? last?.partial ?? {}), role: "assistant", content: last?.partial?.content ?? [], stopReason: "error", errorMessage: stalled, timestamp: Date.now() };
      outer.push({ type: "error", reason: "error", error } as never);
    }
    outer.end();
  })();
  return outer;
}
export const complete = pi.complete;
export const completeSimple = pi.completeSimple;
export const validateToolArguments = pi.validateToolArguments;
export const createAssistantMessageEventStream = pi.createAssistantMessageEventStream;

// 원조 pi 의 모델은 평범한 객체다 — omp catalog 의 buildModel 이 하던 규칙 덮어쓰기는 없다.
export function buildModel<T>(spec: T): T {
  return spec;
}

export function getBundledModel(provider: string, id: string): any {
  try {
    return pi.getModel(provider as never, id as never) ?? undefined;
  } catch {
    return undefined;
  }
}

export function getBundledModels(provider: string): any[] {
  try {
    return pi.getModels(provider as never) as any[];
  } catch {
    return [];
  }
}

type ForcedChoice = "required" | { readonly type: "tool"; readonly name: string };
type SoftChoice = { readonly soft: true; readonly reminder: readonly unknown[] };
type ToolChoiceDirective = ForcedChoice | SoftChoice | undefined;

/** 강제 도구 선택을 제공자 요청 본문에 넣는다. 모르는 API 면 손대지 않는다(강제 없이 나간다). */
function forceToolChoice(payload: unknown, api: string | undefined, choice: ForcedChoice): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const body = { ...(payload as Record<string, unknown>) };
  const named = choice === "required" ? undefined : choice.name;
  switch (api) {
    case "anthropic-messages":
      body.tool_choice = named ? { type: "tool", name: named } : { type: "any" };
      return body;
    case "openai-completions":
      body.tool_choice = named ? { type: "function", function: { name: named } } : "required";
      return body;
    case "openai-responses":
    case "openai-codex-responses":
    case "azure-openai-responses":
      body.tool_choice = named ? { type: "function", name: named } : "required";
      return body;
    default:
      return undefined;
  }
}

type OmpTool = { concurrency?: "shared" | "exclusive"; [key: string]: unknown };

function toPiTools(tools: unknown): any[] | undefined {
  if (!Array.isArray(tools)) return undefined;
  return (tools as OmpTool[]).map((tool) => (tool.concurrency === "exclusive" ? { ...tool, executionMode: "sequential" } : tool));
}

type OmpAgentOptions = {
  initialState?: { systemPrompt?: string | string[]; tools?: unknown; [key: string]: unknown };
  getToolChoice?: () => ToolChoiceDirective;
  transformContext?: (messages: any[], signal?: AbortSignal) => Promise<any[]>;
  onPayload?: (payload: unknown, model: any) => unknown;
  getApiKey?: (model: any) => unknown;
  streamFn?: StreamFn;
  resolveFallbackTool?: unknown;
  [key: string]: unknown;
};

export class Agent {
  readonly #inner: PiAgent;

  constructor(options: OmpAgentOptions) {
    const { initialState, getToolChoice, transformContext, onPayload, getApiKey, streamFn, resolveFallbackTool: _unused, ...rest } = options;
    let forced: ForcedChoice | undefined;
    const systemPrompt = Array.isArray(initialState?.systemPrompt) ? initialState.systemPrompt.join("\n\n") : initialState?.systemPrompt;
    this.#inner = new PiAgent({
      ...(rest as object),
      initialState: { ...(initialState as object), ...(systemPrompt !== undefined ? { systemPrompt } : {}), tools: toPiTools(initialState?.tools) } as never,
      transformContext: async (messages, signal) => {
        let out = transformContext ? await transformContext(messages, signal) : messages;
        const choice = getToolChoice?.();
        forced = undefined;
        if (choice && typeof choice === "object" && "soft" in choice) out = [...out, ...(choice.reminder as any[])];
        else if (choice) forced = choice;
        return out;
      },
      onPayload: async (payload, model) => {
        const own = onPayload ? await onPayload(payload, model) : undefined;
        const shaped = own ?? payload;
        const withChoice = forced ? forceToolChoice(shaped, (model as { api?: string }).api, forced) : undefined;
        forced = undefined;
        return withChoice ?? own;
      },
      ...(getApiKey ? { getApiKey: () => getApiKey(this.#inner.state.model) as never } : {}),
      streamFn: streamFn ?? ((model, context, opts) => {
        const compat = (model as { compat?: { streamFirstEventTimeoutMs?: number; streamIdleTimeoutMs?: number } }).compat;
        return streamSimple(model, context as never, { ...opts, streamFirstEventTimeoutMs: compat?.streamFirstEventTimeoutMs, streamIdleTimeoutMs: compat?.streamIdleTimeoutMs });
      }),
    });
  }

  get state() {
    return this.#inner.state;
  }

  subscribe(listener: (event: { type: string; [key: string]: unknown }) => void): () => void {
    return this.#inner.subscribe((event) => listener(event as never));
  }

  prompt(text: string, images?: any[]): Promise<void> {
    return images?.length ? this.#inner.prompt(text, images) : this.#inner.prompt(text);
  }

  steer(message: any): void {
    this.#inner.steer(message);
  }

  abort(_reason?: string): void {
    this.#inner.abort();
  }
}
