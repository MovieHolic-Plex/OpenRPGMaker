/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
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

const fetchChatGptAuthStatus = vi.fn();
vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
  };
});

const REQUIRED_TEST_IDS = [
  "ai-settings-modal",
  "ai-settings-close",
  "ai-settings-body",
  "ai-settings-advanced",
  "ai-config-ultrabrain-model",
  "ai-config-vision-model",
  "ai-config-writer-provider",
  "ai-config-deep-provider",
  "ai-config",
  "ai-config-model",
  "ai-config-model-preset",
  "ai-config-lite-model",
  "ai-config-lite-model-preset",
  "ai-config-maxtokens",
  "ai-config-reasoning",
  "ai-config-agentmode",
  "ai-font-size",
  "ai-config-saved-hint",
  "ai-config-model-warning",
  "ai-config-lite-model-warning",
] as const;

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

// aiSettingsModal 은 import 그래프가 무겁다 — 첫 시험의 동적 import 가 ci(워커 1개)에서 45초 걸려 15초 상한을 넘겼고, 나머지 일곱 시험은 각각 30~80ms 였다
// (ci-vitest-files 42446009926). 모듈 로드를 hookTimeout(90초) 쪽으로 옮겨 시험 시간에서 뺀다.
beforeAll(async () => { await import("@/editor/panels/aiSettingsModal"); });

beforeEach(() => {
  vi.clearAllMocks();
  fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
  restoreDom = installFakeDom();
  resetModalStackForTest();
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
});

afterEach(async () => {
  const { closeAiSettingsModal } = await import("@/editor/panels/aiSettingsModal");
  closeAiSettingsModal();
  resetModalStackForTest();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
});

async function openModal(): Promise<FakeElement> {
  const { openAiSettingsModal } = await import("@/editor/panels/aiSettingsModal");
  openAiSettingsModal();
  const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
  if (!modal) throw new Error("ai-settings-modal missing");
  return modal;
}

describe("AI 설정 모달 섹션 레이아웃", () => {
  it("연결·동작 버튼만 표시하고 역할과 상세 설정은 고급 시트에 둔다", async () => {
    const modal = await openModal();
    const rail = findByTestId(modal, "ai-settings-rail");
    expect(rail?.querySelectorAll("button").map(button => button.dataset.testid)).toEqual([
      "ai-settings-tab-connection", "ai-settings-tab-behavior",
    ]);
    expect(findByTestId(modal, "ai-settings-tab-connection")?.getAttribute("aria-current")).toBe("page");
    expect(findByTestId(modal, "ai-settings-pane-behavior")?.hidden).toBe(true);
    expect(findByTestId(modal, "ai-settings-chatgpt-hero")?.hidden).toBe(false);
    expect(findByTestId(modal, "ai-settings-chatgpt-account")?.hidden).toBe(true);
    expect(findByTestId(modal, "ai-settings-other-ways")?.parentElement?.hasAttribute("open")).toBe(false);

    const sheet = findByTestId(modal, "ai-settings-advanced");
    expect(sheet?.hidden).toBe(true);
    findByTestId(modal, "ai-settings-tab-behavior")?.click();
    expect(findByTestId(modal, "ai-settings-tab-behavior")?.getAttribute("aria-current")).toBe("page");
    findByTestId(modal, "ai-settings-open-advanced")?.click();
    expect(sheet?.hidden).toBe(false);
    expect(sheet?.getAttribute("role")).toBe("dialog");
    const roles = findByTestId(modal, "ai-settings-section-roles");
    for (const role of ["progress", "advisor", "screen", "image", "pixel"]) {
      expect(findByTestId(roles!, `ai-settings-model-${role}`)?.tagName).toBe("DETAILS");
    }
    for (const role of ["ultrabrain", "vision", "writer", "deep", "build"]) {
      expect(findByTestId(sheet!, `ai-settings-role-${role}`), role).not.toBeNull();
    }
    for (const id of ["image", "work", "specialists", "role-matrix", "display", "usage"]) {
      expect(findByTestId(sheet!, `ai-settings-section-${id}`), id).not.toBeNull();
    }
    findByTestId(modal, "ai-settings-advanced-done")?.click();
    expect(sheet?.hidden).toBe(true);
    expect(findByTestId(modal, "ai-settings-pane-behavior")?.hidden).toBe(false);
  });

  it("로그인하면 GPT-6.2 Sol 품질을 고르고 역할을 따로 바꾸면 선택을 푼다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, accountEmail: "you@example.com" });
    const modal = await openModal();
    const account = findByTestId(modal, "ai-settings-chatgpt-account");
    await vi.waitFor(() => expect(account?.hidden).toBe(false));
    expect(account?.textContent).toContain("you@example.com");
    const presets = findByTestId(modal, "ai-model-presets");
    expect(presets?.getAttribute("role")).toBe("radiogroup");
    expect(presets?.querySelectorAll("button")).toHaveLength(2);
    const balanced = findByTestId(modal, "ai-model-preset-balanced");
    const quality = findByTestId(modal, "ai-model-preset-quality");
    expect(balanced?.getAttribute("aria-checked")).toBe("true");

    quality?.click();
    const stored = JSON.parse(storage.get("oprn:ai-config") ?? "{}");
    expect(stored.model).toBe("gpt-6.2-sol");
    expect(stored.ultrabrainModel).toBe("gpt-6.2-sol");
    expect(stored.ultrabrainReasoningEffort).toBe("high");
    expect(stored.roleModels?.deep).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "high" });
    expect(quality?.getAttribute("aria-checked")).toBe("true");

    const vision = findByTestId(modal, "ai-config-vision-model")!;
    vision.value = "gpt-6.2-astra";
    vision.dispatchEvent(new Event("change"));
    expect(balanced?.getAttribute("aria-checked")).toBe("false");
    expect(quality?.getAttribute("aria-checked")).toBe("false");
    expect(presets?.parentElement?.parentElement?.textContent).toContain("고급에서 역할별로 직접 골랐어요.");

    balanced?.click();
    const updated = JSON.parse(storage.get("oprn:ai-config") ?? "{}");
    expect(updated.roleModels?.deep).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "medium" });
    expect(balanced?.getAttribute("aria-checked")).toBe("true");
  });

  it("동작 스위치는 기존 키를 저장하고 상세 적용 모드를 되살릴 수 있다", async () => {
    storage.set("oprn:ai-config", JSON.stringify({ piApply: "step", piApplyPolicyVersion: 1 }));
    const modal = await openModal();
    const apply = findByTestId(modal, "ai-config-apply-immediately");
    const polish = findByTestId(modal, "ai-config-dialogue-polish");
    const image = findByTestId(modal, "ai-config-image-plan");
    for (const control of [apply, polish, image]) expect(control?.getAttribute("role")).toBe("switch");
    expect(apply?.getAttribute("aria-checked")).toBe("false");
    apply?.click();
    expect(JSON.parse(storage.get("oprn:ai-config") ?? "{}").piApply).toBe("default");
    apply?.click();
    polish?.click();
    image?.click();
    expect(JSON.parse(storage.get("oprn:ai-config") ?? "{}")).toMatchObject({
      piApply: "step", dialoguePolishAfterBuild: false, imagePlanBuild: false,
    });
    const modes = findByTestId(modal, "ai-config-pi-apply")!;
    expect(modes.options.map(option => option.value)).toEqual(["yolo", "auto", "default", "review", "step"]);
    modes.value = "auto";
    modes.dispatchEvent(new Event("change"));
    expect(apply?.getAttribute("aria-checked")).toBe("true");
  });

  it("모든 설정 행의 설명을 화면 텍스트로 제공한다", async () => {
    const modal = await openModal();
    for (const description of [
      "목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요.",
      "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산",
      "기존 영역 작업 경로의 추론 설정입니다.",
      "자율 모드는 요청을 작업 계획으로 나누고, 채팅 모드는 대화 중심으로 진행합니다.",
      "채팅 로그, 제안 카드, 도구 로그의 글자 크기입니다.",
    ]) {
      expect(modal.textContent).toContain(description);
    }
  });

  it("다른 연결에서 기존 상태를 다시 확인할 수 있다", async () => {
    const modal = await openModal();
    const summary = findByTestId(modal, "ai-settings-connection-summary");
    const check = findByTestId(modal, "ai-settings-connection-check");

    expect(summary).not.toBeNull();
    expect(check?.textContent).toContain("연결 확인");
    fetchChatGptAuthStatus.mockClear();
    check?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchChatGptAuthStatus).toHaveBeenCalledWith("openai-codex");
  });

  it("다른 연결의 요약은 인증 패널 상태를 공유한다", async () => {
    // 옛 헤더는 열 때 따로 한 번 조회해서 패널과 다른 말을 했다(패널 「로그인 대기 중」, 헤더 「로그인이 필요합니다」).
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const modal = await openModal();
    await vi.waitFor(() => {
      expect(findByTestId(modal, "ai-oauth-status")?.textContent).toBe("로그인 필요");
    });
    const summary = findByTestId(modal, "ai-settings-connection-summary");
    expect(summary?.textContent).toBe("ChatGPT · 로그인 필요");
    expect(summary?.dataset.tone).toBe("warning");

    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, authKind: "oauth" });
    findByTestId(modal, "ai-settings-connection-check")?.click();
    await vi.waitFor(() => {
      // 「연결 확인」 뒤에는 확인 시각이 붙는다(C-67, 92a6aba61e) — 시각 문자열은 로케일·시계에 따라 달라 형식만 본다.
      expect(summary?.textContent).toMatch(/^ChatGPT · 사용 준비됨 · .+ 확인함$/u);
    });
    expect(summary?.dataset.tone).toBe("ready");
    expect(findByTestId(modal, "ai-oauth-status")?.textContent).toBe("연결됨");
  });

  it("고급 시트에서 자동 저장 상태를 제공한다", async () => {
    const modal = await openModal();
    findByTestId(modal, "ai-settings-tab-behavior")?.click();
    findByTestId(modal, "ai-settings-open-advanced")?.click();
    const hint = findByTestId(modal, "ai-config-saved-hint");

    // 「지금 저장」버튼은 없다 — 수동 저장이 있으면 자동 저장이 안 되는 것처럼 보인다.
    expect(findByTestId(modal, "ai-config-save")).toBeNull();
    expect(hint?.textContent).toBe("자동 저장");

    const maxTokens = findByTestId(modal, "ai-config-maxtokens");
    if (!maxTokens) throw new Error("maxTokens field missing");
    maxTokens.value = "54321";
    maxTokens.dispatchEvent(new Event("change"));
    expect(hint?.textContent).toMatch(/^자동 저장됨 · .+\d{1,2}:\d{2}/u);
    expect(JSON.parse(storage.get("oprn:ai-config") ?? "{}").maxTokens).toBe(54321);
  });

  it("디바운스 중 닫아도 입력값을 저장한다", async () => {
    const modal = await openModal();
    const maxTokens = findByTestId(modal, "ai-config-maxtokens");
    const close = findByTestId(modal, "ai-settings-close");
    if (!maxTokens || !close) throw new Error("AI settings controls missing");
    // 닫힘 신호(notifyAiSettingsClosed)가 window.dispatchEvent 를 부른다 — 빠지면 afterEach 의
    // closeAiSettingsModal 이 던져 뒤 정리(unstub·restoreDom)가 건너뛰어지고 다음 테스트까지 깨진다.
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    });

    maxTokens.value = "54321";
    maxTokens.dispatchEvent(new Event("input"));
    close.click();

    expect(JSON.parse(storage.get("oprn:ai-config") ?? "{}").maxTokens).toBe(54321);
  });

  it("기존 testid 전량을 유지하고 modalStack 한 계층으로 등록한다", async () => {
    const modal = await openModal();
    for (const testId of REQUIRED_TEST_IDS) {
      expect(findByTestId(document.body as unknown as FakeElement, testId), testId).not.toBeNull();
    }
    expect(modalStackDepthForTest()).toBe(1);

    findByTestId(modal, "ai-settings-close")?.click();
    expect(modalStackDepthForTest()).toBe(0);
  });
});
