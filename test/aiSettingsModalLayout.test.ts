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
  it("레일 탭과 페인으로 연결·모델·동작·표시를 나눈다", async () => {
    // 리디자인 계약: 긴 단일 스크롤 대신 좌측 레일(tablist) + 페인. 역할 섹션 4개는
    // 「역할별 모델 직접 지정」 표로 압축됐고, 모델 페인은 품질 프리셋으로 시작한다.
    const modal = await openModal();
    const expected = [
      ["connection", "연결", "AI 제공자와 로그인 상태를 관리합니다."],
      ["presets", "품질 프리셋", "역할별 모델과 추론 강도를 한 번에 맞춥니다."],
      ["image", "이미지 생성", "그림을 생성하는 모델"],
      ["behavior", "동작", "응답 예산과 작업 진행 방식을 조정합니다."],
      ["display", "표시", "AI 패널의 읽기 환경과 화면 무게를 조정합니다."],
    ] as const;

    for (const [id, title, description] of expected) {
      const section = findByTestId(modal, `ai-settings-section-${id}`);
      expect(section, id).not.toBeNull();
      expect(section?.textContent).toContain(title);
      expect(section?.textContent).toContain(description);
    }

    // 레일 탭 — 연결이 기본 활성, 나머지 페인은 숨겨져 있다.
    expect(findByTestId(modal, "ai-settings-rail")?.getAttribute("role")).toBe("tablist");
    for (const id of ["connection", "models", "behavior", "display"]) {
      expect(findByTestId(modal, `ai-settings-tab-${id}`), `tab ${id}`).not.toBeNull();
      expect(findByTestId(modal, `ai-settings-pane-${id}`), `pane ${id}`).not.toBeNull();
    }
    expect(findByTestId(modal, "ai-settings-tab-connection")?.getAttribute("aria-selected")).toBe("true");
    expect(findByTestId(modal, "ai-settings-pane-models")?.hidden).toBe(true);

    // 역할 4행은 details 안의 표로 압축 — 섹션 단위가 아니다.
    const roles = findByTestId(modal, "ai-settings-advanced");
    expect(roles?.tagName.toLowerCase()).toBe("details");
    for (const role of ["ultrabrain", "vision", "writer", "deep", "build"]) {
      expect(findByTestId(modal, `ai-settings-role-${role}`), role).not.toBeNull();
    }
  });

  it("모델 품질 프리셋이 역할 컨트롤을 한 번에 채운다", async () => {
    const modal = await openModal();
    const presets = findByTestId(modal, "ai-model-presets");
    expect(presets?.getAttribute("role")).toBe("radiogroup");
    for (const id of ["fast", "balanced", "quality"]) {
      expect(findByTestId(modal, `ai-model-preset-${id}`), id).not.toBeNull();
    }

    // 「최고 품질」을 고르면 역할 모델이 상위 티어로 채워지고 저장된다.
    findByTestId(modal, "ai-model-preset-quality")?.click();
    const modelInput = findByTestId(modal, "ai-config-model") as unknown as HTMLInputElement | null;
    expect(modelInput?.value).toBe("gemini-3-pro");
    const stored = JSON.parse(storage.get("oprn:ai-config") ?? "{}");
    expect(stored.model).toBe("gemini-3-pro");
    expect(stored.ultrabrainModel).toBe("gemini-3-pro");
    expect(stored.roleModels?.writer?.thinkingLevel).toBe("high");
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

  it("헤더 요약은 연결 패널과 같은 상태를 말한다", async () => {
    // 옛 헤더는 열 때 따로 한 번 조회해서 패널과 다른 말을 했다(패널 「로그인 대기 중」, 헤더 「로그인이 필요합니다」).
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const modal = await openModal();
    await vi.waitFor(() => {
      expect(findByTestId(modal, "ai-oauth-status")?.textContent).toBe("로그인 필요");
    });
    const summary = findByTestId(modal, "ai-settings-connection-summary");
    expect(summary?.textContent).toBe("Google · 로그인 필요");
    expect(summary?.dataset.tone).toBe("warning");

    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, authKind: "oauth" });
    findByTestId(modal, "ai-settings-connection-check")?.click();
    await vi.waitFor(() => {
      expect(summary?.textContent).toBe("Google · 사용 준비됨");
    });
    expect(summary?.dataset.tone).toBe("ready");
    expect(findByTestId(modal, "ai-oauth-status")?.textContent).toBe("연결됨");
  });

  it("자동 저장과 연결 후 계속 동작을 푸터에서 제공한다", async () => {
    const modal = await openModal();
    const hint = findByTestId(modal, "ai-config-saved-hint");

    // 「지금 저장」버튼은 없다 — 수동 저장이 있으면 자동 저장이 안 되는 것처럼 보인다.
    expect(findByTestId(modal, "ai-config-save")).toBeNull();
    expect(hint?.textContent).toBe("변경 사항은 자동으로 저장됩니다.");

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
