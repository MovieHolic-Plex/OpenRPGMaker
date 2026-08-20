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

const CONFIG_BASE = { authMode: "apiKey" as const, baseUrl: "https://example.invalid/v1", model: "minimax/minimax-m3", liteModel: "minimax/minimax-m3", apiKey: "sk-test", maxToolCalls: 8, maxTokens: 1024 };

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  vi.unstubAllEnvs();
});

describe("aiConfig 저장/로드", () => {
  it("기본값을 반환하고 저장값을 병합한다", async () => {
    // .env.local 의 VITE_LLM_API_URL 이 있으면 defaultAiConfig 가 apiKey 모드로 부팅해
    // 이 테스트의 전제가 기계마다 달라진다 — 명시적으로 비워 환경 독립으로 만든다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, DEFAULT_LITE_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_MODEL } = await loadClient();

    const initial = loadAiConfig();
    // env(VITE_LLM_API_URL + VITE_LLM_API_KEY)가 있으면 apiKey, 없으면 chatgpt.
    expect(["chatgpt", "apiKey"]).toContain(initial.authMode);
    expect(initial.model).toBe(DEFAULT_MODEL);
    expect(initial.liteModel).toBe(DEFAULT_LITE_MODEL);
    // localStorage 비어 있으면 env(VITE_LLM_API_KEY 등) 폴백 가능 — 빈 문자열만 강제하지 않음.
    expect(typeof initial.apiKey).toBe("string");
    expect(initial.maxTokens).toBe(DEFAULT_MAX_TOKENS); // 사용자 제한은 출력 토큰 예산 하나.

    // 병합 자체를 보는 테스트이므로 apiKey 모드로 저장한다. chatgpt 모드로 저장하면
    // 로드 시점 모델 교정(Codex 는 gpt- 만 허용)이 끼어들어 모델 왕복을 볼 수 없다.
    saveAiConfig({ ...initial, authMode: "apiKey", apiKey: "sk-user", maxTokens: 4000, autoApprove: true });
    const reloaded = loadAiConfig();
    expect(reloaded.apiKey).toBe("sk-user");
    expect(reloaded.maxTokens).toBe(4000);
    expect(reloaded.autoApprove).toBe(true);
    expect(reloaded.model).toBe(DEFAULT_MODEL);
    expect(reloaded.liteModel).toBe(DEFAULT_LITE_MODEL);
    // 기본 모델은 cpenrouter 경로로 옮겼다 — 에디터의 45개 툴 페이로드를 실제로 통과한
    // 실측 모델이다(glm 경로는 ChatGPT/Codex 연결에서 400 을 냈다).
    expect(DEFAULT_MODEL).toBe("cpen/gpt-5-6-luna");
    expect(DEFAULT_LITE_MODEL).toBe("cpen/gpt-5-6-luna");
  });

  it("ChatGPT 모드에 저장된 비-gpt 모델은 로드 시점에 권장 기본으로 교정된다", async () => {
    // 실측 근거: {"detail":"The 'z-ai/glm-5.2-ultrafast' model is not supported when using
    // Codex with a ChatGPT account."} — 옛 기본값이 localStorage 에 남아 400 을 내던 사례.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const store = installLocalStorage();
    const { loadAiConfig, AI_CONFIG_STORAGE_KEY } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt", model: "z-ai/glm-5.2-ultrafast", liteModel: "z-ai/glm-5.2-ultrafast",
    }));

    const loaded = loadAiConfig();
    expect(loaded.authMode).toBe("chatgpt");
    expect(loaded.model.startsWith("gpt-")).toBe(true);
    expect(loaded.liteModel?.startsWith("gpt-")).toBe(true);
  });

  it("chatgpt 모드라도 다른 oh-my-pi 제공자 모델은 교정하지 않는다", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const store = installLocalStorage();
    const { loadAiConfig, AI_CONFIG_STORAGE_KEY } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt",
      providerId: "anthropic",
      model: "claude-opus-4-8",
      liteModel: "claude-opus-4-8",
    }));
    const loaded = loadAiConfig();
    expect(loaded.providerId).toBe("anthropic");
    expect(loaded.model).toBe("claude-opus-4-8");
  });

  it("apiKey 모드는 카탈로그에 없는 공급자 모델 ID 도 그대로 존중한다", async () => {
    // 카탈로그는 추천 목록이지 화이트리스트가 아니다 — 직접 입력한 ID 를 교정하면 정상 사용을 깬다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const store = installLocalStorage();
    const { loadAiConfig, AI_CONFIG_STORAGE_KEY } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "apiKey", baseUrl: "/api/ai", model: "some-vendor/brand-new-model",
    }));

    expect(loadAiConfig().model).toBe("some-vendor/brand-new-model");
  });

  it("env VITE_LLM_API_URL 이 있고 키가 없으면 apiKey 모드로 부팅한다 (조용한 OAuth 폴백 방지)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "/api/ai");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    installLocalStorage();
    const { defaultAiConfig } = await loadClient();
    const cfg = defaultAiConfig();
    expect(cfg.authMode).toBe("apiKey");
    expect(cfg.baseUrl).toBe("/api/ai");
    expect(cfg.apiKey).toBe("");
  });

  it("authMode가 없는 기존 API 키 설정은 API 모드로 마이그레이션한다", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      apiKey: "sk-existing",
      baseUrl: "https://example.invalid/v1",
      model: "existing-model",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.authMode).toBe("apiKey");
    expect(reloaded.baseUrl).toBe("https://example.invalid/v1");
    expect(reloaded.model).toBe("existing-model");
  });

  it("저장된 사용자 model은 존중하고 liteModel 누락은 감독 model로 보강한다 (일원화)", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      apiKey: "sk-user",
      baseUrl: "https://example.invalid/v1",
      model: "user-main-model",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.model).toBe("user-main-model");
    expect(reloaded.liteModel).toBe("user-main-model");
  });

  it("configForLiteModel은 보조 모델을 실제 요청 모델로 승격한다", async () => {
    const { configForLiteModel, defaultAiConfig } = await loadClient();
    const config = configForLiteModel({ ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", model: "main-model", liteModel: "batch-model" });
    expect(config.model).toBe("batch-model");
    expect(config.liteModel).toBe("batch-model");
  });

  it("liteModel 미설정 시 감독 model을 따라간다 (authMode 일원화)", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, configForLiteModel, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "apiKey",
      baseUrl: "https://glm-gateway.example/v1",
      model: "glm-5.2-ultrafast",
      apiKey: "sk-test",
    }));
    const glm = configForLiteModel(loadAiConfig());
    expect(glm.model).toBe("glm-5.2-ultrafast");
    expect(glm.liteModel).toBe("glm-5.2-ultrafast");

    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt",
      model: "gpt-5.6-terra",
    }));
    const oauth = configForLiteModel(loadAiConfig());
    expect(oauth.model).toBe("gpt-5.6-terra");
    expect(oauth.liteModel).toBe("gpt-5.6-terra");
  });

  it("빈 liteModel 문자열은 감독 model로 폴백한다", async () => {
    const { configForLiteModel, defaultAiConfig } = await loadClient();
    const config = configForLiteModel({ ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", model: "glm-5.2-ultrafast", liteModel: "   " });
    expect(config.model).toBe("glm-5.2-ultrafast");
    expect(config.liteModel).toBe("glm-5.2-ultrafast");
  });

  it("maxToolCalls 저장값을 실제 세션 안전핀으로 로드한다", async () => {
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, defaultAiConfig } = await loadClient();
    saveAiConfig({ ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", maxToolCalls: 3 });
    expect(loadAiConfig().maxToolCalls).toBe(3);
  });

  it("옛 기본값 maxTokens 2048/10240은 새 기본으로 승격된다", async () => {
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, defaultAiConfig, DEFAULT_MAX_TOKENS } = await loadClient();
    saveAiConfig({ ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", maxTokens: 2048 });
    expect(loadAiConfig().maxTokens).toBe(DEFAULT_MAX_TOKENS);
    saveAiConfig({ ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", maxTokens: 10240 });
    expect(loadAiConfig().maxTokens).toBe(DEFAULT_MAX_TOKENS);
  });
});

describe("chatCompletion 스트리밍 SSE 파서", () => {
  it("ChatGPT OAuth 모드는 브라우저 Authorization 헤더 없이 로컬 동반 서비스로 요청한다", async () => {
    // env 게이트웨이 URL 이 있으면 defaultAiConfig 가 apiKey 모드로 부팅해 이 경로를 타지
    // 않는다 — chatgpt 모드를 검증하려면 env 를 비워야 한다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { chatCompletion, defaultAiConfig, DEFAULT_CHATGPT_BASE_URL } = await loadClient();
    mockFetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const config = defaultAiConfig();
    expect(config.authMode).toBe("chatgpt");
    await chatCompletion(config, { messages: [{ role: "user", content: "hi" }], stream: false });

    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    // 하드코딩된 127.0.0.1:17832 을 단언하던 테스트였는데, 그건 prod 전용 값이다:
    // DEV 에서는 vite 가 같은 오리진에 OAuth 핸들러를 붙여 /v1 을 쓴다(DEFAULT_CHATGPT_BASE_URL).
    // 요점은 "게이트웨이 baseUrl 이 아니라 OAuth 경로로 간다" 이므로 그 상수 기준으로 본다.
    expect(String(url)).toBe(`${DEFAULT_CHATGPT_BASE_URL}/chat/completions`);
    expect(String(url)).not.toContain(config.baseUrl || " 없음");
    expect((init as RequestInit | undefined)?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Rpgzzu-Provider": "openai-codex",
    });
  });

  it("cpen 은 툴이 붙으면 gpt- 모델이라도 스트리밍을 끈다", async () => {
    // 실측 400: {"code":"unsupported_streaming_request",
    //           "message":"Streaming currently supports text-only cpen/gpt-* chat."}
    // 모델 접두사만 보고 스트리밍을 켜던 탓에 에디터의 모든 턴이 400 이었다.
    const { chatCompletion } = await loadClient();
    mockFetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await chatCompletion(
      { ...CONFIG_BASE, baseUrl: "/api/cpen", model: "cpen/gpt-5-6-luna" },
      {
        messages: [{ role: "user", content: "hi" }],
        stream: true,
        tools: [{ type: "function", function: { name: "t", description: "d", parameters: { type: "object", properties: {} } } }],
      },
    );
    expect(sentBody().stream).toBe(false);
  });

  it("cpen 은 툴이 없으면 gpt- 모델에서 스트리밍을 유지한다", async () => {
    const { chatCompletion } = await loadClient();
    mockFetchOnce(new Response("data: [DONE]\n\n", { status: 200 }));
    await chatCompletion(
      { ...CONFIG_BASE, baseUrl: "/api/cpen", model: "cpen/gpt-5-6-luna" },
      { messages: [{ role: "user", content: "hi" }], stream: true },
    );
    expect(sentBody().stream).toBe(true);
  });

  it("cpen 요청에서는 메시지의 name 을 떼어낸다", async () => {
    // 실측 400: {"code":"unsupported_field","param":"messages[3].name"}
    // 첫 요청에는 tool 메시지가 없어 200 이 나고 툴을 한 번 쓴 다음 턴부터 깨졌다.
    const { chatCompletion } = await loadClient();
    mockFetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await chatCompletion(
      { ...CONFIG_BASE, baseUrl: "/api/cpen", model: "cpen/gpt-5-6-luna" },
      {
        messages: [
          { role: "user", content: "hi" },
          { role: "tool", tool_call_id: "call_1", name: "get_project_summary", content: "{}" },
        ],
        stream: false,
      },
    );
    const messages = sentBody().messages as Record<string, unknown>[];
    expect(messages[1]?.name).toBeUndefined();
    // tool_call_id 는 남아야 어느 호출의 결과인지 알 수 있다.
    expect(messages[1]?.tool_call_id).toBe("call_1");
  });

  it("비-cpen 공급자에서는 메시지의 name 을 보존한다", async () => {
    const { chatCompletion } = await loadClient();
    mockFetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await chatCompletion(CONFIG_BASE, {
      messages: [
        { role: "user", content: "hi" },
        { role: "tool", tool_call_id: "call_1", name: "get_project_summary", content: "{}" },
      ],
      stream: false,
    });
    const messages = sentBody().messages as Record<string, unknown>[];
    expect(messages[1]?.name).toBe("get_project_summary");
  });

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

  it("chatgpt 모드는 선택한 oh-my-pi 제공자를 동반 서비스 헤더로 보낸다", async () => {
    const { chatCompletion, usesOhMyPiCompanion } = await loadClient();
    expect(usesOhMyPiCompanion({ ...CONFIG_BASE, authMode: "chatgpt", providerId: "groq" })).toBe(true);
    mockFetchOnce(new Response(JSON.stringify({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await chatCompletion(
      { ...CONFIG_BASE, authMode: "chatgpt", providerId: "groq", apiKey: "" },
      { messages: [{ role: "user", content: "hi" }], stream: false },
    );
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const sent = init?.headers as Record<string, string>;
    expect(sent["X-Rpgzzu-Provider"]).toBe("groq");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/chat/completions");
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
