// 설정 모달에 브라우저 보관 키·엔드포인트 입력이 없다는 것을 고정한다.
//
// 배경: `ai-config-apikey` 에 입력한 키는 saveAiConfig 를 통해
// localStorage["rpg-zzu:ai-config"] 에 **평문으로** 저장됐다 — 같은 다이얼로그의 인증 패널이
// "브라우저에는 두지 않습니다" 라고 약속하는 중에. 두 연결 종류 모두 자격을 동반 서비스가
// 보관하므로 이 칸들은 존재 이유가 없고, 남겨 두면 약속이 거짓이 된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const fetchChatGptAuthStatus = vi.fn();
vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
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

describe("브라우저 보관 키·엔드포인트 입력이 없다", () => {
  it("API 키 입력 필드가 DOM 에 존재하지 않는다", async () => {
    const { root, dispose } = await renderForm();
    // 숨기는 것으로는 부족하다 — 숨은 채로도 값이 collect() 를 통해 저장됐다.
    expect(findByTestId(root, "ai-config-apikey")).toBeNull();
    dispose();
  });

  it("엔드포인트 입력 필드가 DOM 에 존재하지 않는다", async () => {
    const { root, dispose } = await renderForm();
    expect(findByTestId(root, "ai-config-baseurl")).toBeNull();
    dispose();
  });

  it("동반 서비스 키 입력은 인증 패널 쪽에 남아 있다", async () => {
    // 키를 넣을 자리가 아예 없어지면 API 키 종류를 쓸 수 없다 — 그 자리는 인증 패널이다.
    const { root, dispose } = await renderForm();
    findByTestId(root, "ai-auth-api-key")?.click();
    expect(findByTestId(root, "ai-companion-api-key")).not.toBeNull();
    dispose();
  });
});

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

  it("경고 문구가 없는 규칙(gpt- 접두사)을 주장하지 않는다", async () => {
    storage.set(AI_CONFIG_KEY, JSON.stringify({ providerId: "openai-codex" }));
    const { root, dispose } = await renderForm();
    const input = findByTestId(root, "ai-config-model");
    input!.value = "gpt-5.1-codex-max"; // gpt- 로 시작하지만 카탈로그 밖이다
    input!.dispatchEvent(new Event("input"));

    const warning = findByTestId(root, "ai-config-model-warning");
    expect(warning?.hidden).toBe(false);
    // "gpt- 로 시작하는 모델만" 은 사실이 아니었다 — 검사는 정확한 카탈로그 소속이다.
    expect(warning?.textContent ?? "").not.toContain("gpt-");
    // 이제 없는 경로를 remedy 로 제시하지 않는다.
    expect(warning?.textContent ?? "").not.toContain("게이트웨이");
    dispose();
  });

  it("프리셋 첫 항목은 설명되지 않는 약어를 쓰지 않는다", async () => {
    const { root, dispose } = await renderForm();
    const preset = findByTestId(root, "ai-config-model-preset");
    const first = preset?.querySelectorAll("option")[0];
    expect(first?.textContent ?? "").not.toContain("GJC");
    dispose();
  });
});
