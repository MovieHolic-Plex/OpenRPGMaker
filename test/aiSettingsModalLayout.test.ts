import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
  "ai-config-save",
  "ai-config-saved-hint",
  "ai-config-model-warning",
  "ai-config-lite-model-warning",
] as const;

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

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
  it("연결·모델·동작·표시 카드를 제목과 설명으로 구분한다", async () => {
    const modal = await openModal();
    const expected = [
      ["connection", "연결", "AI 제공자와 로그인 상태를 관리합니다."],
      ["ultrabrain", "Ultrabrain · 계획과 최종 판단", "최고 지능 역할입니다."],
      ["vision", "Vision · 시각 관찰", "이미지 입력을 지원하는 LLM"],
      ["writer", "Writer · 작문", "이야기·세계관·NPC 대사·퀘스트 문장"],
      ["deep", "Deep · 깊은 작업과 실행", "Ultrabrain의 계획"],
      ["image", "Image · 이미지 생성", "그림을 생성하는 모델"],
      ["behavior", "동작", "응답 예산과 작업 진행 방식을 조정합니다."],
      ["display", "표시", "AI 패널의 읽기 환경을 조정합니다."],
    ] as const;

    for (const [id, title, description] of expected) {
      const section = findByTestId(modal, `ai-settings-section-${id}`);
      expect(section, id).not.toBeNull();
      expect(section?.textContent).toContain(title);
      expect(section?.textContent).toContain(description);
    }
  });

  it("모든 설정 행의 설명을 화면 텍스트로 제공한다", async () => {
    const modal = await openModal();
    for (const description of [
      "목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요.",
      "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산",
      "대화 조수는 위에서 선택한 역할별 추론 강도를 사용합니다.",
      "자율 모드는 요청을 작업 계획으로 나누고, 채팅 모드는 대화 중심으로 진행합니다.",
      "채팅 로그, 제안 카드, 도구 로그의 글자 크기입니다.",
    ]) {
      expect(modal.textContent).toContain(description);
    }
  });

  it("상단 연결 요약과 기존 상태 경로를 다시 확인하는 액션을 제공한다", async () => {
    const modal = await openModal();
    const summary = findByTestId(modal, "ai-settings-connection-summary");
    const check = findByTestId(modal, "ai-settings-connection-check");

    expect(summary).not.toBeNull();
    expect(check?.textContent).toContain("연결 확인");
    check?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchChatGptAuthStatus).toHaveBeenCalledWith("google-antigravity");
  });

  it("자동 저장과 지금 저장을 하나의 저장 모델과 시각으로 설명한다", async () => {
    const modal = await openModal();
    const hint = findByTestId(modal, "ai-config-saved-hint");
    const save = findByTestId(modal, "ai-config-save");

    expect(hint?.textContent).toBe("변경 사항은 자동으로 저장됩니다.");
    expect(save?.textContent).toBe("지금 저장");
    save?.click();
    expect(hint?.textContent).toMatch(/^지금 저장됨 · .+\d{1,2}:\d{2}/u);
  });

  it("디바운스 중 닫아도 입력값을 저장한다", async () => {
    const modal = await openModal();
    const maxTokens = findByTestId(modal, "ai-config-maxtokens");
    const close = findByTestId(modal, "ai-settings-close");
    if (!maxTokens || !close) throw new Error("AI settings controls missing");
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
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
