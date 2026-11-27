/** @vitest-environment happy-dom */
// 설정 모달에 브라우저 보관 키·엔드포인트 입력이 없다는 것을 고정한다.
//
// 배경: `ai-config-apikey` 에 입력한 키는 saveAiConfig 를 통해
// localStorage["rpg-zzu:ai-config"] 에 **평문으로** 저장됐다 — 같은 다이얼로그의 인증 패널이
// "브라우저에는 두지 않습니다" 라고 약속하는 중에. 두 연결 종류 모두 자격을 동반 서비스가
// 보관하므로 이 칸들은 존재 이유가 없고, 남겨 두면 약속이 거짓이 된다.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

// 역할 배정 표는 모달을 열 때 연결된 경로를 비동기로 가져와 다시 그린다. 오프라인에서도 그 약속은 테스트가 끝난 뒤에
// 풀려 복원된 happy-dom document 로 옵션을 만들고 가짜 select 에 붙이다 미처리 오류를 낸다 — 이 파일은 경로 조회를 보지 않는다.
vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()),
  fetchConnectedRoutes: () => new Promise<never>(() => undefined),
}));
// 도구 사용량 패널도 같은 사정이다: 열자마자 IndexedDB·대화 기록을 읽고 나중에 자기 보고서를 그려 넣는다.
vi.mock("@/editor/panels/aiToolUsagePanel", () => ({
  renderAiToolUsagePanel: () => document.createElement("div"),
}));

const fetchChatGptAuthStatus = vi.fn();
const connectOpenAiCompatEndpoint = vi.fn();
vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    connectOpenAiCompatEndpoint: (...args: unknown[]) => connectOpenAiCompatEndpoint(...args),
    startChatGptLogin: vi.fn(),
    saveCompanionApiKey: vi.fn(),
    refreshCompanionAuth: vi.fn(),
  };
});

const AI_CONFIG_KEY = "oprn:ai-config";
let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

// aiSettingsModal 은 import 그래프가 무거워 첫 동적 import 가 15초 시험 상한을 넘길 수 있다(aiSettingsModalLayout 과 동일).
// 모듈 로드를 hookTimeout 쪽으로 옮겨 시험 시간에서 뺀다.
beforeAll(async () => { await import("@/editor/panels/aiSettingsModal"); });

beforeEach(() => {
  vi.clearAllMocks();
  fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
});

async function renderForm(): Promise<{ root: FakeElement; dispose: () => void }> {
  const { renderAiSettingsForm } = await import("@/editor/panels/aiSettingsModal");
  let view!: ReturnType<typeof renderAiSettingsForm>;
  const root = renderWithFakeDom(() => {
    view = renderAiSettingsForm({});
    return view.element;
  });
  return { root, dispose: () => view.dispose() };
}

describe("저장되는 blob 에 비밀이 남지 않는다", () => {
  it("자동 저장 결과의 apiKey·baseUrl 이 빈 문자열이다", async () => {
    const { root, dispose } = await renderForm();
    const maxTokens = findByTestId(root, "ai-config-maxtokens");
    if (!maxTokens) throw new Error("maxTokens field missing");

    maxTokens.value = "4096";
    maxTokens.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_KEY) ?? "{}");
    expect(stored.maxTokens).toBe(4096);
    expect(stored.apiKey).toBe("");
    expect(stored.baseUrl).toBe("");
    expect(stored.authMode).toBe("chatgpt");
    dispose();
  });

  it("직접 연결은 저장된 로컬 CLI 엔진을 끄고 그 엔드포인트를 남긴다", async () => {
    storage.set("oprn:assistant-engine", JSON.stringify({
      kind: "local-cli", cli: "claude", routineModel: "claude-opus-5-5", deepModel: "claude-opus-5-5", effort: "medium", policyVersion: 2,
    }));
    connectOpenAiCompatEndpoint.mockResolvedValueOnce({
      ok: true, code: "ok", message: "연결됐어요", model: "deepseek-v4.1-flash-eco",
      endpoint: {
        id: "openai-compat:opendesign", name: "OpenDesign", baseUrl: "https://amr-link.open-design.ai/v1",
        hasKey: true, headerNames: [], reasoningMode: "none", allowModels: [], blockModels: [],
        supportsImages: false, maxOutputTokens: 16384, contextWindow: 128000, firstTokenTimeoutSec: 180,
        allowInsecurePublic: false, models: ["deepseek-v4.1-flash-eco"], defaultModel: "deepseek-v4.1-flash-eco",
      },
    });
    const { root, dispose } = await renderForm();
    const preset = findByTestId(root, "ai-openai-direct-preset");
    const key = findByTestId(root, "ai-openai-direct-key");
    const use = findByTestId(root, "ai-openai-direct-use");
    if (!preset || !key || !use) throw new Error("직접 입력 칸이 없다");
    preset.value = "opendesign";
    preset.dispatchEvent(new Event("change"));
    key.value = "sk-test-secret-123";
    use.click();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(storage.has("oprn:assistant-engine")).toBe(false);
    const stored = JSON.parse(storage.get(AI_CONFIG_KEY) ?? "{}");
    expect(stored.providerId).toBe("openai-compat:opendesign");
    expect(stored.model).toBe("deepseek-v4.1-flash-eco");
    expect(stored.apiKey).toBe("");
    expect(JSON.stringify(stored)).not.toContain("sk-test-secret-123");
    dispose();
  });

  it("옛 blob 에 평문 키가 있어도 저장 한 번으로 지워진다", async () => {
    storage.set(AI_CONFIG_KEY, JSON.stringify({
      authMode: "apiKey",
      apiKey: "sk-legacy-LEAK",
      baseUrl: "/api/cliproxy",
      model: "gpt-5.6-sol",
    }));
    const { root, dispose } = await renderForm();
    const maxTokens = findByTestId(root, "ai-config-maxtokens");
    maxTokens!.value = "8192";
    maxTokens!.dispatchEvent(new Event("change"));

    const raw = storage.get(AI_CONFIG_KEY) ?? "";
    expect(raw).not.toContain("sk-legacy-LEAK");
    expect(raw).not.toContain("/api/cliproxy");
    dispose();
  });
});

describe("모델 프리셋과 경고", () => {
  it("프리셋에서 고르면 경고가 그 자리에서 재평가된다", async () => {
    // 제공자는 Antigravity 로 강제된다(감독 지시 2026-08-26) — 유효/무효 축도 gemini 네임스페이스다.
    storage.set(AI_CONFIG_KEY, JSON.stringify({}));
    const { root, dispose } = await renderForm();
    const input = findByTestId(root, "ai-config-model");
    const preset = findByTestId(root, "ai-config-model-preset");
    if (!input || !preset) throw new Error("model field missing");

    // 카탈로그 밖 값을 넣어 경고를 띄운다.
    input.value = "no-such-model";
    input.dispatchEvent(new Event("input"));
    expect(findByTestId(root, "ai-config-model-warning")?.hidden).toBe(false);

    // 목록에서 유효한 값을 고르면 경고가 즉시 사라져야 한다(옛 구현은 저장 시점까지 남았다).
    preset.value = "gemini-3.7-flash";
    preset.dispatchEvent(new Event("change"));

    expect(input.value).toBe("gemini-3.7-flash");
    expect(findByTestId(root, "ai-config-model-warning")?.hidden).toBe(true);
    dispose();
  });

});
