// AI 연동 상태 칩 회귀 테스트.
// 영역 작업(runRegionTask)·AI 채팅은 LLM 호출을 하므로 OAuth/apiKey 미연동 시 401 로 실패.
// 상태바가 인증 상태를 알려주는지 검증한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

// openAiSettingsModal 은 무거운 의존(aiSettingsForm/modelCatalog/fetchChatGptAuthStatus)을
// 끌고 와 fakeDom 에서 깨지므로 칩 클릭 테스트에서는 호출 사실만 검증한다.
const openAiSettingsModal = vi.fn();
vi.mock("@/editor/panels/aiSettingsModal", () => ({
  openAiSettingsModal: (...args: unknown[]) => openAiSettingsModal(...args),
  closeAiSettingsModal: vi.fn(),
}));

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
  authMode: "apiKey",
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
    const status = getAiConnectionStatus(APIKEY_READY);
    expect(status.kind).toBe("ready");
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

  it("env 상대 VITE_LLM_API_URL + 키 없음 = proxyAuth ready (조용한 OAuth 폴백 방지)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "/api/ai");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus();
    expect(status.authMode).toBe("apiKey");
    expect(status.kind).toBe("ready");
    expect(status.title).toContain("프록시");
  });

  it("env 절대 VITE_LLM_API_URL + 키 없음 = disconnected (클라이언트 키 필요)", async () => {
    vi.stubEnv("VITE_LLM_API_URL", "https://gateway.example/v1");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    const { getAiConnectionStatus } = await loadModule();
    const status = getAiConnectionStatus();
    expect(status.authMode).toBe("apiKey");
    expect(status.kind).toBe("disconnected");
    expect(status.label).toContain("키");
  });
});

describe("refreshAiConnectionStatus — chatgpt OAuth 비동기 조회", () => {
  it("chatgpt 모드에서 companion 연결됨을 캐시하고 onChange 를 부른다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { authMode: "chatgpt", model: "z-ai/glm-5.2-ultrafast", maxTokens: 32768 });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, planType: "plus" });

    const { refreshAiConnectionStatus, getAiConnectionStatus } = await loadModule();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });

    expect(fetchChatGptAuthStatus).toHaveBeenCalledTimes(1);
    expect(changed).toBe(1);
    const status = getAiConnectionStatus();
    expect(status.kind).toBe("ready");
    expect(status.label).toContain("PLUS");
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

  it("apiKey 모드에서는 companion 을 호출하지 않는다", async () => {
    const store = installLocalStorage();
    saveConfig(store, APIKEY_READY);
    const { refreshAiConnectionStatus, resetAiConnectionStatusCache } = await loadModule();
    // 캐시가 남아있으면 apiKey 모드에서도 onChange 가 호출되므로 먼저 비운다.
    resetAiConnectionStatusCache();
    let changed = 0;
    await refreshAiConnectionStatus(() => { changed += 1; });
    expect(fetchChatGptAuthStatus).not.toHaveBeenCalled();
    expect(changed).toBe(0);
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

describe("renderAiConnectionStatus — 상태바 칩", () => {
  it("apiKey ready 상태에서 칩은 버튼이고 라벨에 '연결됨' 이 포함된다", async () => {
    const store = installLocalStorage();
    saveConfig(store, APIKEY_READY);
    const { renderAiConnectionStatus } = await loadModule();
    const chip = renderWithFakeDom(() => renderAiConnectionStatus(() => undefined));
    expect(chip.tagName.toLowerCase()).toBe("button");
    expect(chip.dataset.testid).toBe("ai-connection-status");
    expect(chip.textContent).toContain("연결됨");
  });

  it("칩 클릭 시 AI 설정 모달을 연다", async () => {
    const store = installLocalStorage();
    saveConfig(store, { ...APIKEY_READY, apiKey: "" }); // disconnected 상태
    const { renderAiConnectionStatus } = await loadModule();
    const chip = renderWithFakeDom(() => renderAiConnectionStatus(() => undefined)) as FakeElement;
    openAiSettingsModal.mockClear();
    chip.click();
    expect(openAiSettingsModal).toHaveBeenCalledTimes(1);
    const opts = openAiSettingsModal.mock.calls[0]?.[0] as { focusTarget?: string } | undefined;
    // apiKey 모드 미연동이면 API 키 입력란으로 포커스.
    expect(opts?.focusTarget).toBe("apiKey");
  });
});
