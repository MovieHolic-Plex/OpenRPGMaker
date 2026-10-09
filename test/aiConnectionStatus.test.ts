// AI 연동 상태 칩 회귀 테스트.
// 영역 작업(runRegionTask)·AI 채팅은 LLM 호출을 하므로 OAuth/apiKey 미연동 시 401 로 실패.
// 상태바가 인증 상태를 알려주는지 검증한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeDom } from "./fakeDom";

// fetchChatGptAuthStatus 를 테스트에서 제어한다.
const fetchChatGptAuthStatus = vi.fn();
vi.mock("@/ai/chatgptOAuthClient", () => ({
  fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
  startChatGptLogin: vi.fn(),
}));

// 동적 import 로 모듈 캐시 분리(테스트 간 aiOAuthCachedStatus 격리).
async function loadModule() {
  return await import("@/editor/panels/aiConnectionStatus");
}

// localStorage 모킹(Node 환경엔 없음) — loadAiConfig 가 config 를 읽도록.
function installLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

function saveConfig(store: Map<string, string>, config: Record<string, unknown>): void {
  store.set("oprn:ai-config", JSON.stringify(config));
}

const APIKEY_READY = {
  authMode: "apiKey" as const,
  baseUrl: "https://gateway.invalid/v1",
  model: "z-ai/glm-5.2-ultrafast",
  liteModel: "z-ai/glm-5.2-ultrafast",
  apiKey: "sk-test-key",
  maxToolCalls: 200,
  maxTokens: 32768,
  reasoningEffort: "off" as const,
};

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  restoreDom = installFakeDom();
  installLocalStorage();
});

afterEach(async () => {
  const { resetAiConnectionStatusCache } = await loadModule();
  resetAiConnectionStatusCache();
  restoreDom?.();
  restoreDom = null;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  vi.unstubAllEnvs();
});

describe("getAiConnectionStatus — apiKey 모드 동기 평가", () => {
  it("절대 URL + API 키가 없으면 disconnected", async () => {
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus({ ...APIKEY_READY, apiKey: "" });
    expect(status.kind).toBe("disconnected");
    expect(status.label).toContain("키");
  });

  it("baseUrl 이 없으면 disconnected", async () => {
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus({ ...APIKEY_READY, baseUrl: "" });
    expect(status.kind).toBe("disconnected");
    expect(status.label).toContain("엔드포인트");
  });

  it("절대 URL + 키와 baseUrl 이 모두 있으면 ready", async () => {
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus({ ...APIKEY_READY, providerId: "openai-codex" });
    expect(status.kind).toBe("ready");
    expect(status.providerId).toBe("openai-codex");
    expect(status.providerLabel).toBe("ChatGPT");
    expect(status.label).toContain("ChatGPT");
    expect(status.label).toContain("연결됨");
    expect(status.title).toContain("API 키로 연결됨");
  });

  it("상대 baseUrl(/api/ai) + 키 없음 = proxyAuth ready (서버가 키 주입)", async () => {
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus({ ...APIKEY_READY, baseUrl: "/api/ai", apiKey: "" });
    expect(status.kind).toBe("ready");
    expect(status.title).toContain("프록시");
  });

  it("env 가 없으면 chatgpt OAuth 기본 — 캐시가 없으면 checking", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus();
    expect(status.authMode).toBe("chatgpt");
    expect(status.kind).toBe("checking");
  });

  it("env 상대 VITE_LLM_API_URL 이 있어도 칩은 OAuth 를 가리킨다", async () => {
    // 옛 스펙은 여기서 apiKey/ready 를 기대했다. 그 배선이 곧 장애의 원인이었다 —
    // env 가 authMode 를 정하는 통로가 사라졌으므로 칩도 OAuth 하나만 말한다.
    vi.stubEnv("VITE_LLM_API_URL", "/api/ai");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus();
    expect(status.authMode).toBe("chatgpt");
  });

  it("env 절대 VITE_LLM_API_URL 이 있어도 칩은 OAuth 를 가리킨다", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "https://gateway.example/v1");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus();
    expect(status.authMode).toBe("chatgpt");
  });
});

describe("refreshAiConnectionStatus — chatgpt OAuth 비동기 조회", () => {
  it("chatgpt 모드에서 companion 연결됨을 캐시하고 onChange 를 부른다", async () => {
    const store = installLocalStorage();
    saveConfig(store, {
      authMode: "chatgpt",
      providerId: "google-antigravity",
      model: "gemini-3.1-pro-preview",
      maxTokens: 32768,
    });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, planType: "plus" });

    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });

    expect(fetchChatGptAuthStatus).toHaveBeenCalledWith("google-antigravity");
    expect(changed).toBe(1);
    const status = getAiConnectionStatus();
    expect(status.kind).toBe("ready");
    expect(status.providerLabel).toBe("Google");
    // 칩 이름은 카드·패널과 같은 계정 이름이다(옛 「Google Antigravity 연결됨」).
    expect(status.label).toBe("Google 연결됨 · PLUS");
  });

  it("진행 중인 로그인을 확인 중으로 표시하고 다음 오류 응답을 반영한다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false, pendingLogin: {
      verificationUrl: "https://example.invalid/login", userCode: "", expiresAt: Date.now() + 10000,
    } });
    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    await refreshAiConnectionStatus();
    expect(getAiConnectionStatus().kind).toBe("checking");
    expect(getAiConnectionStatus().label).toContain("로그인 진행 중");
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false, lastLoginError: "Denied" });
    await refreshAiConnectionStatus();
    expect(getAiConnectionStatus().label).toContain("로그인 실패");
  });

  it("선택 계정이 연결돼도 실제 작업 모델의 다른 계정이 없으면 ready 를 반환하지 않는다", async () => {
    const storage = installLocalStorage();
    saveConfig(storage, {
      authMode: "chatgpt", providerId: "openai-codex", model: "gpt-6-luna",
      ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6-luna",
      roleModelsPolicyVersion: 1,
      roleModels: {
        writer: { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "off" },
        deep: { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "off" },
        vision: { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "high" },
      },
    });
    fetchChatGptAuthStatus.mockImplementation(async (provider: string) => ({ connected: provider === "openai-codex" }));
    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    await refreshAiConnectionStatus();
    expect(getAiConnectionStatus().kind).toBe("disconnected");
    expect(getAiConnectionStatus().label).toBe("Google 연결 필요 · 작업 모델");
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true });
    await refreshAiConnectionStatus();
    expect(getAiConnectionStatus().kind).toBe("ready");
  });

  it("제공자를 바꾼 새 설정은 이전 제공자의 ready 캐시를 재사용하지 않는다", async () => {
    // 제공자가 둘이므로 "전환"이 다시 생겼다. 칩이 이전 제공자의 연결 상태를 새 제공자의
    // 상태로 보여 주면 로그인하지 않은 제공자가 "연결됨"이라 불리는 거짓이 된다.
    const storage = installLocalStorage();
    saveConfig(storage, {
      authMode: "chatgpt",
      providerId: "openai-codex",
      model: "gpt-5.6-sol",
      maxTokens: 32768,
    });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true });

    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    await refreshAiConnectionStatus(() => undefined);
    const codex = getAiConnectionStatus();
    expect(codex.kind).toBe("ready");
    expect(codex.providerLabel).toBe("ChatGPT");

    saveConfig(storage, {
      authMode: "chatgpt",
      providerId: "google-antigravity",
      model: "gemini-3.7-flash",
      maxTokens: 32768,
    });

    const switched = getAiConnectionStatus();
    expect(switched.providerLabel).toBe("Google");
    expect(switched.kind).toBe("checking");

    // 새 제공자로 조회하면 그 제공자 이름으로 나간다.
    await refreshAiConnectionStatus(() => undefined);
    expect(fetchChatGptAuthStatus).toHaveBeenLastCalledWith("google-antigravity");
    expect(getAiConnectionStatus().kind).toBe("ready");
  });

  it("조회는 선택된 제공자로 나가고 이전 제공자의 늦은 응답은 새 상태를 덮지 않는다", async () => {
    const storage = installLocalStorage();
    saveConfig(storage, {
      authMode: "chatgpt",
      providerId: "openai-codex",
      model: "gpt-5.6-sol",
      maxTokens: 32768,
    });
    const pending: ((value: { connected: boolean }) => void)[] = [];
    const queried: string[] = [];
    fetchChatGptAuthStatus.mockImplementation((providerId: string) => new Promise((resolve) => {
      queried.push(providerId);
      pending.push(resolve);
    }));

    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    const oldRefresh = refreshAiConnectionStatus(() => undefined);
    saveConfig(storage, {
      authMode: "chatgpt",
      providerId: "google-antigravity",
      model: "gemini-3.7-flash",
      maxTokens: 32768,
    });
    const newRefresh = refreshAiConnectionStatus(() => undefined);

    // 각 조회는 그 시점에 선택된 제공자로 나간다.
    expect(queried).toEqual(["openai-codex", "google-antigravity"]);

    pending[1]?.({ connected: true });
    await newRefresh;
    expect(getAiConnectionStatus().kind).toBe("ready");
    expect(getAiConnectionStatus().providerLabel).toBe("Google");

    // 늦게 도착한 이전(Codex) 조회의 실패 상태가 현재 제공자의 ready 를 덮어쓰지 않는다.
    pending[0]?.({ connected: false });
    await oldRefresh;
    expect(getAiConnectionStatus().kind).toBe("ready");
    expect(getAiConnectionStatus().providerLabel).toBe("Google");
  });

  it("companion 이 응답하지 않으면 offline 으로 캐시하고 onChange 를 부른다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "z-ai/glm-5.2-ultrafast", maxTokens: 32768 });
    fetchChatGptAuthStatus.mockRejectedValue(new Error("companion offline"));

    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });

    expect(changed).toBe(1);
    expect(getAiConnectionStatus().kind).toBe("offline");
  });

  it("저장된 apiKey 설정도 OAuth 로 승격되어 companion 을 조회한다", async () => {
    // 옛 스펙은 "apiKey 모드에서는 companion 을 호출하지 않는다" 였다. 이제 저장값이 authMode 를
    // 되돌리지 못하므로(loadAiConfig 승격) 게이트웨이 설정이 남은 브라우저도 OAuth 를 조회한다.
    // 이게 없으면 예전 감독의 브라우저는 칩이 영원히 apiKey 를 가리킨 채 죽어 있었다.
    const store = installLocalStorage();
    saveConfig(store, APIKEY_READY);
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, planType: "plus" });
    const { refreshAiConnectionStatus, resetAiConnectionStatusCache, getAiConnectionStatus } = await loadModule();
    resetAiConnectionStatusCache();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });
    expect(fetchChatGptAuthStatus).toHaveBeenCalledTimes(1);
    expect(changed).toBe(1);
    expect(getAiConnectionStatus().authMode).toBe("chatgpt");
  });

  it("이미 캐시된 상태와 동일하면 onChange 를 부르지 않는다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "z-ai/glm-5.2-ultrafast", maxTokens: 32768 });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true });

    const { refreshAiConnectionStatus } = await loadModule();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });
    expect(changed).toBe(1);
    // 동일 상태로 두 번째 조회 — 변경 없음.
    await refreshAiConnectionStatus(() => { changed += 1; });
    expect(changed).toBe(1);
  });
});

describe("연결 중 일시적 지연", () => {
  it("연결돼 있던 칩은 시간 초과 두 번까지 유지하고, 세 번째에 연결 확인을 안내한다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "gpt-5.6-sol", maxTokens: 32768 });
    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true });
    await refreshAiConnectionStatus(() => undefined);
    const connected = getAiConnectionStatus().kind;
    const timeout = Object.assign(new Error("OAuth companion is unreachable"), { name: "ChatGptCompanionUnreachableError", reason: "timeout" });
    fetchChatGptAuthStatus.mockRejectedValue(timeout);
    await refreshAiConnectionStatus(() => undefined);
    await refreshAiConnectionStatus(() => undefined);
    expect(getAiConnectionStatus().kind).toBe(connected);
    await refreshAiConnectionStatus(() => undefined);
    expect(getAiConnectionStatus().kind).toBe("offline");
  });
});

describe("다섯 상태를 서로 다르게 말한다", () => {
  it("도달 불가(A)와 응답 오류(B)와 로그아웃이 각각 다른 kind·라벨·이모지다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "gpt-5.6-sol", maxTokens: 32768 });
    const { refreshAiConnectionStatus, getAiConnectionStatus, resetAiConnectionStatusCache } = await loadModule();

    // (A) 닿지 못함 — 일반 Error 는 이름이 ChatGptCompanionResponseError 가 아니다.
    resetAiConnectionStatusCache();
    fetchChatGptAuthStatus.mockRejectedValue(new Error("connect ECONNREFUSED"));
    await refreshAiConnectionStatus(() => undefined);
    const unreachable = getAiConnectionStatus();
    expect(unreachable.kind).toBe("offline");
    expect(unreachable.label).toContain("연결 확인 필요");
    expect(unreachable.title).not.toMatch(/터미널|npm run|개발 서버/);

    // (B) 응답했지만 실패 — serverMessage 를 담아 error 로 간다.
    resetAiConnectionStatusCache();
    const responded = Object.assign(new Error("boom"), {
      name: "ChatGptCompanionResponseError",
      serverMessage: "codex exited",
    });
    fetchChatGptAuthStatus.mockRejectedValue(responded);
    await refreshAiConnectionStatus(() => undefined);
    const errored = getAiConnectionStatus();
    expect(errored.kind).toBe("error");
    expect(errored.label).toContain("오류");
    expect(errored.title).toContain("codex exited");

    // 그냥 로그아웃 — 위 둘과 달라야 한다.
    resetAiConnectionStatusCache();
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    await refreshAiConnectionStatus(() => undefined);
    const loggedOut = getAiConnectionStatus();
    expect(loggedOut.kind).toBe("disconnected");
    expect(loggedOut.label).toContain("로그인");
    expect(loggedOut.label).toMatch(/^(Google|ChatGPT) 로그인 필요$/u);

    // 세 라벨이 서로 겹치지 않는다 — 예전에는 전부 "AI 로그인" 이었다.
    expect(new Set([unreachable.label, errored.label, loggedOut.label]).size).toBe(3);
  });

  it("호스트가 AI 를 꺼 둔 503 은 재시작 안내 대신 서버 설정을 말한다", async () => {
    // 기본은 켜져 있다. 이 문구는 OPRN_HOST_OWNER_AI=0 으로 일부러 끈 서버만 받는다.
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "gpt-5.6-sol", maxTokens: 32768 });
    const { refreshAiConnectionStatus, getAiConnectionStatus, resetAiConnectionStatusCache } = await loadModule();
    resetAiConnectionStatusCache();
    fetchChatGptAuthStatus.mockRejectedValue(Object.assign(new Error("off"), {
      name: "ChatGptCompanionResponseError",
      serverMessage: "호스트 AI 연결이 꺼져 있습니다. OPRN_HOST_OWNER_AI=0 을 빼야 합니다.",
    }));
    await refreshAiConnectionStatus(() => undefined);
    const status = getAiConnectionStatus();
    // 응답은 왔으니 도달 불가(offline)가 아니다 — 칩이 「닿지 못했습니다」를 덧붙이면 거짓이 된다.
    expect(status.kind).toBe("error");
    expect(status.label).toContain("서버에서 꺼짐");
    expect(status.title).toContain("OPRN_HOST_OWNER_AI=0");
    expect(status.title).not.toContain("껐다 켜");
  });

  it("동의한 환경 변수 키는 연결로 센다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "gpt-5.6-sol", maxTokens: 32768 });
    const { refreshAiConnectionStatus, getAiConnectionStatus, resetAiConnectionStatusCache } = await loadModule();
    resetAiConnectionStatusCache();
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: true });

    await refreshAiConnectionStatus(() => undefined);

    const status = getAiConnectionStatus();
    expect(status.kind).toBe("ready");
    expect(status.label).toContain("환경 변수");
    expect(status.title).toContain("환경 변수");
  });

  it("만료된 자격도 연결됨이 아니다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "gpt-5.6-sol", maxTokens: 32768 });
    const { refreshAiConnectionStatus, getAiConnectionStatus, resetAiConnectionStatusCache } = await loadModule();
    resetAiConnectionStatusCache();
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, expired: true });

    await refreshAiConnectionStatus(() => undefined);

    expect(getAiConnectionStatus().kind).toBe("disconnected");
  });
});
