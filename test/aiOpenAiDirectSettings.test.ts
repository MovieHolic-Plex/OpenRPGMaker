// 「OpenAI 호환 API (직접 입력)」 — 프리셋이 주소를 채우고, 모델 목록·연결 시험은 동반 서비스로만 가며, 키는 화면에 남지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const testEndpoint = vi.fn();
const connectEndpoint = vi.fn();

vi.mock("@/ai/chatgptOAuthClient", () => ({
  ChatGptCompanionResponseError: class ChatGptCompanionResponseError extends Error {
    readonly httpStatus: number;
    readonly serverMessage?: string;
    constructor(status: number, message?: string) {
      super(message ?? "");
      this.name = "ChatGptCompanionResponseError";
      this.httpStatus = status;
      this.serverMessage = message;
    }
  },
  testOpenAiCompatEndpoint: (...args: unknown[]) => testEndpoint(...args),
  connectOpenAiCompatEndpoint: (...args: unknown[]) => connectEndpoint(...args),
}));

const KEY = "sk-test-secret-123";
const ENDPOINT = {
  id: "openai-compat:opendesign",
  name: "OpenDesign",
  baseUrl: "https://amr-link.open-design.ai/v1",
  hasKey: true,
  headerNames: [],
  reasoningMode: "none",
  allowModels: [],
  blockModels: [],
  supportsImages: false,
  maxOutputTokens: 16384,
  contextWindow: 128000,
  firstTokenTimeoutSec: 180,
  allowInsecurePublic: false,
  models: ["deepseek-v4.1-flash-eco"],
  defaultModel: "deepseek-v4.1-flash-eco",
};

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

describe("OpenAI 호환 API 직접 입력", () => {
  let restore: (() => void) | undefined;

  beforeEach(() => {
    restore = installFakeDom();
    testEndpoint.mockReset();
    connectEndpoint.mockReset();
  });
  afterEach(() => restore?.());

  it("OpenDesign 프리셋이 주소와 모델 예를 채우고, 키는 화면에 남지 않는다", async () => {
    const { renderAiOpenAiDirectSettings } = await import("@/editor/panels/aiOpenAiDirectSettings");
    const used: Array<{ id: string; model: string }> = [];
    const view = renderAiOpenAiDirectSettings({
      onUse: (endpoint, model) => { used.push({ id: endpoint.id, model }); },
    });
    const root = view.element as unknown as FakeElement;
    const preset = findByTestId(root, "ai-openai-direct-preset")!;
    const baseUrl = findByTestId(root, "ai-openai-direct-baseurl")!;
    const key = findByTestId(root, "ai-openai-direct-key")!;
    const model = findByTestId(root, "ai-openai-direct-model")!;
    expect(key.getAttribute("type")).toBe("password");

    preset.value = "opendesign";
    preset.dispatchEvent(new Event("change"));
    expect(baseUrl.value).toBe("https://amr-link.open-design.ai/v1");
    expect(model.value).toBe("deepseek-v4.1-flash-eco");

    key.value = KEY;
    testEndpoint.mockResolvedValueOnce({
      ok: true, code: "ok", message: `목록 ${KEY}`, models: ["deepseek-v4.1-flash-eco", "glm-5.3-flash"],
      modelsAvailable: true, hiddenModels: 0, toolsOk: null, latencyMs: 12, warnings: [],
    });
    findByTestId(root, "ai-openai-direct-load-models")!.click();
    await flush();
    expect(testEndpoint).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://amr-link.open-design.ai/v1",
      apiKey: KEY,
    }));
    expect(testEndpoint.mock.calls[0][0].model).toBeUndefined();
    const status = findByTestId(root, "ai-openai-direct-status")!;
    expect(status.textContent).not.toContain(KEY);
    expect(root.textContent).not.toContain(KEY);

    testEndpoint.mockResolvedValueOnce({
      ok: true, code: "ok", message: "채팅 확인", models: ["deepseek-v4.1-flash-eco"],
      modelsAvailable: true, hiddenModels: 0, toolsOk: true, latencyMs: 20, warnings: [],
    });
    findByTestId(root, "ai-openai-direct-test")!.click();
    await flush();
    expect(testEndpoint).toHaveBeenLastCalledWith(expect.objectContaining({
      model: "deepseek-v4.1-flash-eco", probeTools: true, apiKey: KEY,
    }));
    expect(status.textContent).toContain("도구 호출 가능");
    expect(status.textContent).not.toContain(KEY);

    connectEndpoint.mockResolvedValueOnce({
      ok: true, code: "ok", message: `저장됨 ${KEY}`, model: "deepseek-v4.1-flash-eco", endpoint: ENDPOINT,
    });
    findByTestId(root, "ai-openai-direct-use")!.click();
    await flush();
    expect(connectEndpoint).toHaveBeenCalledWith(expect.objectContaining({
      kind: "custom", name: "OpenDesign", baseUrl: "https://amr-link.open-design.ai/v1",
      model: "deepseek-v4.1-flash-eco", apiKey: KEY, reasoningMode: "none",
    }));
    expect(used).toEqual([{ id: "openai-compat:opendesign", model: "deepseek-v4.1-flash-eco" }]);
    expect(key.value).toBe("");
    expect(root.textContent).not.toContain(KEY);
    expect(JSON.stringify(used)).not.toContain(KEY);
    view.dispose();
  });
});
