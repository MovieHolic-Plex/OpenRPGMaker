import { afterEach, describe, expect, it, vi } from "vitest";

// 기존 테스트 관례: 동적 await import.
async function loadClient() {
  return await import("@/ai/llmClient");
}

// 간단한 localStorage 모킹(Node 환경엔 없음).
function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

// 문자열 청크들을 ReadableStream<Uint8Array>로.
function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchOnce(response: Response): void {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => response);
}

function sentBody(): Record<string, unknown> {
  const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  if (!init) throw new Error("fetch init missing");
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

const CONFIG_BASE = { baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-3.5-flash", liteModel: "google/gemini-3.1-flash-lite", apiKey: "sk-test", maxToolCalls: 8, maxTokens: 1024 };

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

describe("aiConfig 저장/로드", () => {
  it("기본값을 반환하고 저장값을 병합한다", async () => {
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, DEFAULT_LITE_MODEL, DEFAULT_MODEL } = await loadClient();

    const initial = loadAiConfig();
    expect(initial.model).toBe(DEFAULT_MODEL);
    expect(initial.liteModel).toBe(DEFAULT_LITE_MODEL);
    expect(initial.apiKey).toBe(""); // 키 기본값은 항상 빈값.
    expect(initial.maxTokens).toBe(10240); // 사용자 제한은 출력 토큰 예산 하나(기본 10240).

    saveAiConfig({ ...initial, apiKey: "sk-user", maxTokens: 4000, autoApprove: true });
    const reloaded = loadAiConfig();
    expect(reloaded.apiKey).toBe("sk-user");
    expect(reloaded.maxTokens).toBe(4000);
    expect(reloaded.autoApprove).toBe(true);
    expect(reloaded.model).toBe(DEFAULT_MODEL);
    expect(reloaded.liteModel).toBe(DEFAULT_LITE_MODEL);
    // v3 설계(2026-07-07) 합의: 기본 세션 모델은 minimax-m3(저가 모델 전제). lite는 flash-lite 유지.
    expect(DEFAULT_MODEL).toBe("minimax/minimax-m3");
    expect(DEFAULT_LITE_MODEL).toBe("minimax/minimax-m3");
  });

  it("저장된 사용자 model은 존중하고 liteModel 누락은 기본값으로 보강한다", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, DEFAULT_LITE_MODEL, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      apiKey: "sk-user",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "user-main-model",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.model).toBe("user-main-model");
    expect(reloaded.liteModel).toBe(DEFAULT_LITE_MODEL);
  });

  it("configForLiteModel은 보조 모델을 실제 요청 모델로 승격한다", async () => {
    const { configForLiteModel, defaultAiConfig } = await loadClient();
    const config = configForLiteModel({ ...defaultAiConfig(), model: "main-model", liteModel: "batch-model" });
    expect(config.model).toBe("batch-model");
    expect(config.liteModel).toBe("batch-model");
  });

  it("maxToolCalls 저장값은 무시하고 안전핀 기본값을 쓴다 (UI에서 제거된 항목)", async () => {
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, defaultAiConfig } = await loadClient();
    saveAiConfig({ ...defaultAiConfig(), maxToolCalls: 3 });
    expect(loadAiConfig().maxToolCalls).toBe(defaultAiConfig().maxToolCalls);
  });

  it("옛 기본값 maxTokens 2048은 새 기본(10240)으로 승격된다", async () => {
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, defaultAiConfig } = await loadClient();
    saveAiConfig({ ...defaultAiConfig(), maxTokens: 2048 });
    expect(loadAiConfig().maxTokens).toBe(10240);
  });
});

describe("chatCompletion 스트리밍 SSE 파서", () => {
  it("요청 본문에는 config.model을 그대로 넣는다", async () => {
    const { chatCompletion } = await loadClient();
    mockFetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await chatCompletion({ ...CONFIG_BASE, model: "main-route-model" }, { messages: [{ role: "user", content: "hi" }], stream: false });

    expect(sentBody().model).toBe("main-route-model");
  });

  it("청크 경계로 쪼개진 content/tool_calls delta를 조립한다", async () => {
    const { chatCompletion } = await loadClient();
    // 이벤트가 청크 경계를 가로지르도록 분할.
    const chunks = [
      'data: {"choices":[{"delta":{"content":"안녕"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"하세요"}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_pro","arguments":"{\\"a\\""}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"ject_summary","arguments":":1}"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
    ];
    const response = new Response(streamFromChunks(chunks), { status: 200 });
    mockFetchOnce(response);

    const tokens: string[] = [];
    const result = await chatCompletion(CONFIG_BASE, {
      messages: [{ role: "user", content: "hi" }],
      onToken: (delta) => tokens.push(delta),
    });

    expect(tokens.join("")).toBe("안녕하세요");
    expect(result.message.content).toBe("안녕하세요");
    expect(result.finishReason).toBe("tool_calls");
    expect(result.message.tool_calls).toHaveLength(1);
    const call = result.message.tool_calls![0];
    expect(call.function.name).toBe("get_project_summary");
    expect(call.function.arguments).toBe('{"a":1}');
  });

  it("비스트리밍 응답의 tool_calls를 파싱한다", async () => {
    const { chatCompletion } = await loadClient();
    const payload = {
      choices: [
        {
          message: { content: null, tool_calls: [{ id: "c1", function: { name: "create_map", arguments: '{"name":"x"}' } }] },
          finish_reason: "tool_calls",
        },
      ],
    };
    mockFetchOnce(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await chatCompletion(CONFIG_BASE, { messages: [{ role: "user", content: "hi" }], stream: false });
    expect(result.message.tool_calls?.[0].function.name).toBe("create_map");
  });
});

describe("chatCompletion 오류 처리", () => {
  it("키가 없으면 401 LlmError", async () => {
    const { chatCompletion, LlmError } = await loadClient();
    await expect(chatCompletion({ ...CONFIG_BASE, apiKey: "" }, { messages: [] })).rejects.toBeInstanceOf(LlmError);
  });

  it("HTTP 429를 사람이 읽을 메시지로 바꾼다", async () => {
    const { chatCompletion, LlmError } = await loadClient();
    mockFetchOnce(new Response("rate limited", { status: 429 }));
    try {
      await chatCompletion(CONFIG_BASE, { messages: [{ role: "user", content: "hi" }], stream: false });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmError);
      expect((error as InstanceType<typeof LlmError>).status).toBe(429);
      expect((error as Error).message).toContain("한도 초과");
    }
  });
});
