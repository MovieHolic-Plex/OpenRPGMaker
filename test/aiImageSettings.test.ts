/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { renderAiSettingsForm } from "@/editor/panels/aiSettingsModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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

vi.mock("@/ai/chatgptOAuthClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/chatgptOAuthClient")>(),
  fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }),
}));

let restoreDom: () => void;
let dispose: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => { dispose?.(); dispose = undefined; restoreDom(); vi.unstubAllGlobals(); });

function form() {
  const view = renderAiSettingsForm({});
  dispose = view.dispose;
  const get = (id: string) => {
    const control = findByTestId(view.element as unknown as FakeElement, id);
    if (!control) throw new Error(id);
    return control;
  };
  return { get };
}

describe("ChatGPT image settings", () => {
  it.each([
    ["google-antigravity", "gemini-3.1-flash-image"],
    ["openai-codex", "gpt-image-1"],
    ["unknown-provider", "unknown-image"],
    [undefined, undefined],
  ])("옛 그림 설정(%s / %s)을 읽을 때 ChatGPT 로 맞춘다", (imageProviderId, imageModel) => {
    const before = { ...defaultAiConfig(), providerId: "google-antigravity", model: "gemini-4-argon", imageProviderId, imageModel };
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(before));
    const migrated = loadAiConfig();
    expect(migrated).toMatchObject({
      providerId: before.providerId, model: before.model,
      imageProviderId: "openai-codex", imageModel: "codex-image-default",
    });
    expect(loadAiConfig()).toEqual(migrated);
    saveAiConfig(migrated);
    expect(JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!)).toMatchObject({
      imageProviderId: "openai-codex", imageModel: "codex-image-default",
    });
    expect(loadAiConfig()).toMatchObject({
      providerId: before.providerId, model: before.model,
      imageProviderId: "openai-codex", imageModel: "codex-image-default",
    });
  });

  it("제공자와 모델 선택에 ChatGPT 한 항목만 보인다", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image" }));
    const view = form();
    expect(view.get("ai-settings-model-image-provider").textContent).toContain("ChatGPT");
    expect(view.get("ai-settings-model-image").textContent).toContain("ChatGPT");
    expect(view.get("ai-config-image-provider").getAttribute("disabled")).not.toBeNull();
    expect(view.get("ai-config-image-provider").options.map((option) => option.value)).toEqual(["openai-codex"]);
    expect(view.get("ai-config-image-model").options.map((option) => option.value)).toEqual(["codex-image-default"]);
    expect(view.get("ai-config-image-model").value).toBe("codex-image-default");
    expect(view.get("ai-config-image-status").textContent).toContain("그림은 ChatGPT 로만 그려요");
  });

  it("ChatGPT 요청에 참조 그림과 취소를 전달하고 실제 응답 모델을 기록한다", async () => {
    const controller = new AbortController();
    const referenceImages = [{ data: "AAAA", mimeType: "image/png" as const }];
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      new Response(JSON.stringify({ image: { dataUrl: "data:image/png;base64,AAAA", model: "gpt-image-2-codex" } })));
    const result = await generateAiImage({ prompt: "test", referenceImages, signal: controller.signal }, { fetch });
    const init = fetch.mock.calls[0]![1]!;
    expect(new Headers(init.headers).get("X-Oprn-Provider")).toBe("openai-codex");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "codex-image-default", referenceImages });
    expect(result).toMatchObject({ provider: "openai-codex", model: "gpt-image-2-codex" });
    controller.abort();
    expect(init.signal?.aborted).toBe(true);
  });
});
