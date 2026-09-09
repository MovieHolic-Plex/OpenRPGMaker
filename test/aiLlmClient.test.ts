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
    // env 는 더 이상 authMode 를 정하지 못한다(OAuth 전용). stub 은 그 사실을 보이기 위해 남긴다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    installLocalStorage();
    const { loadAiConfig, saveAiConfig, DEFAULT_LITE_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_MODEL } = await loadClient();

    const initial = loadAiConfig();
    // 인증은 무조건 OAuth — 환경과 무관하게 chatgpt 하나다.
    expect(initial.authMode).toBe("chatgpt");
    expect(initial.model).toBe(DEFAULT_MODEL);
    expect(initial.liteModel).toBe(DEFAULT_LITE_MODEL);
    // OAuth 는 클라이언트 키를 쓰지 않는다 — env 키 폴백도 없앴다.
    expect(initial.apiKey).toBe("");
    expect(initial.maxTokens).toBe(DEFAULT_MAX_TOKENS); // 사용자 제한은 출력 토큰 예산 하나.
    expect(initial.maxToolCalls).toBe(2000);

    // 병합 자체를 보는 테스트. 모델은 Codex 카탈로그 안의 값이어야 교정에 걸리지 않는다.
    saveAiConfig({ ...initial, maxTokens: 4000 });
    const reloaded = loadAiConfig();
    expect(reloaded.maxTokens).toBe(4000);
    expect(reloaded.model).toBe(DEFAULT_MODEL);
    expect(reloaded.liteModel).toBe(DEFAULT_LITE_MODEL);
    // 기본 모델은 OAuth(Codex) 카탈로그 ID 여야 한다. 옛 기본값 cpen/gpt-5-6-luna 는 게이트웨이
    // ID 라서, OAuth 경로에서 오류 없이 제공자 기본 모델로 강등됐다(감독이 고른 모델이 답하지 않음).
    expect(DEFAULT_MODEL).toBe("gemini-3.7-flash");
    expect(DEFAULT_LITE_MODEL).toBe("gemini-3.7-flash");
  });

  it("옛 공장 기본 토큰·툴콜은 새 기본으로 승격하고, 사용자가 고른 값은 존중한다", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const store = installLocalStorage();
    const { loadAiConfig, AI_CONFIG_STORAGE_KEY, DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOOL_CALLS } = await loadClient();

    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt", maxTokens: 32768, maxToolCalls: 200,
    }));
    const promoted = loadAiConfig();
    expect(promoted.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    expect(promoted.maxToolCalls).toBe(DEFAULT_MAX_TOOL_CALLS);

    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt", maxTokens: 48000, maxToolCalls: 50,
    }));
    const kept = loadAiConfig();
    expect(kept.maxTokens).toBe(48000);
    expect(kept.maxToolCalls).toBe(50);
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
    // 제공자가 Antigravity 로 강제된 뒤에도 교정은 살아 있다 — 목표만 gemini 기본으로 바뀐다.
    expect(loaded.model).toBe("gemini-3.7-flash");
    expect(loaded.liteModel).toBe("gemini-3.7-flash");
  });

  it("저장된 다른 제공자와 그 모델은 Antigravity 로 끌어온다 (제공자 강제 통일)", async () => {
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
    expect(loaded.providerId).toBe("google-antigravity");
    expect(loaded.model).toBe("gemini-3.7-flash");
  });

  it("env VITE_LLM_API_URL 이 있어도 OAuth 로 부팅한다 (env 가 authMode 를 정하지 못한다)", async () => {
    // 이 스펙이 막는 장애(2026-08-21 실측): env 한 줄이 authMode 를 apiKey 로 강제하고
    // baseUrl 을 죽은 프록시 경로(/api/cliproxy)로 박아, 에디터의 모든 AI 가 POST 404 로 죽었다.
    // 반대 방향의 옛 스펙("env 가 있으면 apiKey 로 부팅한다")을 의도적으로 뒤집은 것이다 —
    // 인증 경로가 하나뿐이므로 '조용한 OAuth 폴백' 이라는 위험 자체가 없어졌다.
    vi.stubEnv("VITE_LLM_API_URL", "/api/cliproxy");
    vi.stubEnv("VITE_LLM_API_KEY", "sk-should-be-ignored");
    installLocalStorage();
    const { defaultAiConfig } = await loadClient();
    const cfg = defaultAiConfig();
    expect(cfg.authMode).toBe("chatgpt");
    expect(cfg.providerId).toBe("google-antigravity");
    expect(cfg.model).toBe("gemini-3.7-flash");
    expect(cfg.baseUrl).toBe("");
    expect(cfg.apiKey).toBe("");
  });

  it("저장된 apiKey 설정은 OAuth 로 승격하고 죽은 baseUrl·키를 버린다", async () => {
    // 장애의 절반은 이것이었다: 한 번이라도 게이트웨이를 저장한 브라우저는 env 를 고쳐도
    // 저장값이 authMode 를 apiKey 로 되돌려 계속 죽은 경로를 쳤다.
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "apiKey",
      apiKey: "sk-existing",
      baseUrl: "/api/cliproxy",
      model: "cpen/gpt-5-6-luna",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.authMode).toBe("chatgpt");
    expect(reloaded.baseUrl).toBe("");
    expect(reloaded.apiKey).toBe("");
    // 게이트웨이 모델 ID 는 Antigravity 네임스페이스 밖 → 강제 기본으로 교정된다(조용한 오배송 방지).
    expect(reloaded.model).toBe("gemini-3.7-flash");
  });

  it("authMode 가 없는 옛 설정도 OAuth 로 승격한다", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, loadAiConfig } = await loadClient();
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      apiKey: "sk-existing",
      baseUrl: "https://example.invalid/v1",
      model: "existing-model",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.authMode).toBe("chatgpt");
    expect(reloaded.baseUrl).toBe("");
    expect(reloaded.model).toBe("gemini-3.7-flash");
  });

  it("저장된 사용자 model은 존중하고 liteModel 누락은 감독 model로 보강한다 (일원화)", async () => {
    const store = installLocalStorage();
    const { AI_CONFIG_STORAGE_KEY, loadAiConfig } = await loadClient();
    // 제공자가 Antigravity 하나로 강제된 뒤에는 gemini 네임스페이스가 존중 대상이다.
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      model: "gemini-3.1-pro",
    }));

    const reloaded = loadAiConfig();
    expect(reloaded.model).toBe("gemini-3.1-pro");
    expect(reloaded.liteModel).toBe("gemini-3.1-pro");
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
    // 제공자는 Antigravity 로 강제되므로 남의 제공자 모델은 강제 기본으로 교정된다.
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      providerId: "anthropic",
      model: "claude-opus-4-8",
    }));
    const foreign = configForLiteModel(loadAiConfig());
    expect(foreign.model).toBe("gemini-3.7-flash");
    expect(foreign.liteModel).toBe("gemini-3.7-flash");

    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt",
      model: "gemini-3.1-pro",
    }));
    const oauth = configForLiteModel(loadAiConfig());
    expect(oauth.model).toBe("gemini-3.1-pro");
    expect(oauth.liteModel).toBe("gemini-3.1-pro");
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
      "X-Rpgzzu-Provider": "google-antigravity",
    });
  });

  it("공급자 제약이 없으면 메시지의 name 을 보존한다", async () => {
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

  // 이 케이스가 지키는 것: **사용자가 고른 제공자가 그대로 헤더로 나간다.** 예전에는 레지스트리에
  // 있던 groq 로 확인했지만 제공자가 Antigravity·Codex 둘로 줄었으므로, 기본값이 아닌 쪽(Codex)을
  // 골라 같은 계약을 본다 — 기본값으로 확인하면 "무엇을 골라도 기본값" 인 버그를 놓친다.
  it("chatgpt 모드는 선택한 oh-my-pi 제공자를 동반 서비스 헤더로 보낸다", async () => {
    const { chatCompletion, usesOhMyPiCompanion } = await loadClient();
    expect(usesOhMyPiCompanion({ ...CONFIG_BASE, authMode: "chatgpt", providerId: "openai-codex" })).toBe(true);
    mockFetchOnce(new Response(JSON.stringify({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await chatCompletion(
      { ...CONFIG_BASE, authMode: "chatgpt", providerId: "openai-codex", apiKey: "" },
      { messages: [{ role: "user", content: "hi" }], stream: false },
    );
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const sent = init?.headers as Record<string, string>;
    expect(sent["X-Rpgzzu-Provider"]).toBe("openai-codex");
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
