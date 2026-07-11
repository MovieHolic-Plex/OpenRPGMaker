import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_CONFIG_STORAGE_KEY,
  chatCompletion,
  configForLiteModel,
  configWithReasoningPolicy,
  defaultAiConfig,
  loadAiConfig,
} from "@/ai/llmClient";

type ResponseLike = Pick<Response, "body" | "json" | "ok" | "status" | "text">;
type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<ResponseLike>;
type FetchMock = ReturnType<typeof vi.fn<FetchStub>>;

let fetchDescriptor: PropertyDescriptor | undefined;
let localStorageDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fetchDescriptor) {
    Object.defineProperty(globalThis, "fetch", fetchDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "fetch");
  }
  if (localStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

function jsonResponse(payload: unknown): ResponseLike {
  return {
    body: null,
    json: async () => payload,
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

function stubFetch(response: ResponseLike): FetchMock {
  const fetchMock = vi.fn<FetchStub>(async () => response);
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  return fetchMock;
}

function sentBody(fetchMock: FetchMock): unknown {
  const init = fetchMock.mock.calls[0]?.[1];
  if (!init) throw new Error("fetch init missing");
  return JSON.parse(String(init.body));
}

function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      if (chunk) {
        controller.enqueue(encoder.encode(chunk));
        index += 1;
        return;
      }
      controller.close();
    },
  });
}

function installLocalStorage(value: unknown): void {
  const store = new Map([[AI_CONFIG_STORAGE_KEY, JSON.stringify(value)]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, nextValue: string) => void store.set(key, nextValue),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}

describe("OpenRouter reasoning 요청", () => {
  it("비-minimax 모델에서 reasoningEffort high면 요청 본문에 high를 넣는다", async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    const config = {
      ...defaultAiConfig(),
      apiKey: "sk-test",
      model: "openai/gpt-4o",
      reasoningEffort: "high" as const,
    };

    await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

    expect(sentBody(fetchMock)).toMatchObject({ reasoning: { effort: "high" } });
  });

  it("minimax + medium 설정은 요청 시 low로 캡한다(장문 추론 완화)", async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    const config = {
      ...defaultAiConfig(),
      apiKey: "sk-test",
      model: "minimax/minimax-m3",
      reasoningEffort: "medium" as const,
    };

    await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

    expect(sentBody(fetchMock)).toMatchObject({ reasoning: { effort: "low" } });
  });

  it("configForLiteModel은 reasoning을 off로 끈다", () => {
    const lite = configForLiteModel({
      ...defaultAiConfig(),
      model: "minimax/minimax-m3",
      liteModel: "google/gemini-3.1-flash-lite",
      reasoningEffort: "high",
    });
    expect(lite.reasoningEffort).toBe("off");
    expect(configWithReasoningPolicy(lite).reasoningEffort).toBe("off");
  });

  it("reasoningEffort가 off이면 요청 본문에 reasoning 키를 넣지 않는다", async () => {
    // Given: reasoning을 끈 OpenRouter 설정.
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    const config = { ...defaultAiConfig(), apiKey: "sk-test", reasoningEffort: "off" as const };

    // When: 실제 chatCompletion 경로로 요청한다.
    await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

    // Then: fetch에 전달된 JSON에는 reasoning 키가 없다.
    expect(sentBody(fetchMock)).not.toHaveProperty("reasoning");
  });
});

describe("OpenRouter reasoning 응답 파싱", () => {
  it("비스트리밍 message.reasoning 문자열을 assistant 메시지에 보존한다", async () => {
    // Given: OpenRouter 비스트리밍 응답에 reasoning이 있다.
    stubFetch(jsonResponse({ choices: [{ message: { content: "hi", reasoning: "내가 생각한 것" } }] }));

    // When: 실제 chatCompletion 경로로 파싱한다.
    const result = await chatCompletion(defaultAiConfigWithKey(), { messages: [{ role: "user", content: "hi" }] });

    // Then: assistant 메시지에 reasoning이 남는다.
    expect(result.message.reasoning).toBe("내가 생각한 것");
  });

  it("스트리밍 delta.reasoning을 누적하고 콜백으로 전달한다", async () => {
    // Given: SSE가 reasoning과 content delta를 나눠서 보낸다.
    const response = new Response(
      streamFromChunks([
        'data: {"choices":[{"delta":{"reasoning":"생각"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"답"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
      { status: 200 }
    );
    const reasoning: string[] = [];
    stubFetch(response);

    // When: 실제 스트리밍 chatCompletion 경로로 파싱한다.
    const result = await chatCompletion(defaultAiConfigWithKey(), {
      messages: [{ role: "user", content: "hi" }],
      stream: true,
      onReasoning: (delta) => reasoning.push(delta),
    });

    // Then: reasoning과 content가 각각 조립된다.
    expect(result.message.reasoning).toBe("생각");
    expect(result.message.content).toBe("답");
    expect(reasoning).toEqual(["생각"]);
  });
});

describe("AI reasoning 설정 로드", () => {
  it("저장된 reasoningEffort low를 그대로 읽는다", () => {
    // Given: localStorage에 low 설정이 저장되어 있다.
    installLocalStorage({ reasoningEffort: "low" });

    // When: 설정을 로드한다.
    const config = loadAiConfig();

    // Then: 저장된 reasoning effort를 보존한다.
    expect(config.reasoningEffort).toBe("low");
  });

  it("잘못된 reasoningEffort는 기본(low)으로 되돌린다", () => {
    installLocalStorage({ reasoningEffort: "max" });
    const config = loadAiConfig();
    expect(config.reasoningEffort).toBe("low");
  });

  it("기본 reasoningEffort는 low이다(MiniMax 장문 추론 완화)", () => {
    const config = defaultAiConfig();
    expect(config.reasoningEffort).toBe("low");
  });
});

function defaultAiConfigWithKey(): ReturnType<typeof defaultAiConfig> {
  return { ...defaultAiConfig(), apiKey: "sk-test" };
}
