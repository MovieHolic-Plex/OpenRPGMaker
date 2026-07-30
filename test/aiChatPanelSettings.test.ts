// AI 어시스턴트 채팅 패널 — 접기 토글 + 설정 자동 저장 + 세션 설정 반영.
// 사용자 불만 회귀 테스트: (1) 패널을 접을 수 없었다, (2) API 키/설정이 저장되지 않는 것처럼
// 보였다(세션이 생성 시점 설정을 캐시), (3) 모델 기본값은 감독 m3 / 실행 flash-lite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig, loadAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

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
  // .env 의 VITE_LLM_API_URL 이 테스트 환경까지 로드되어 defaultAiConfig 가 apiKey 모드로
  // 바뀌는 것을 막고, 이 파일의 "chatgpt 기본" 전제를 deterministic 하게 유지한다.
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllEnvs();
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

describe("패널 접기", () => {
  it("접기 버튼 클릭으로 접히고 상태가 localStorage에 저장된다", () => {
    const panel = renderPanel();
    // 부팅 기본 접힘 → 펼친 뒤 접기/펼치기 왕복
    findByTestId(panel, "ai-collapsed-restore")?.click();
    const collapse = findByTestId(panel, "ai-collapse");
    expect(collapse).not.toBeNull();
    expect(panel.classList.contains("is-collapsed")).toBe(false);

    collapse?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBe("1");

    collapse?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBe("0");
  });

  it("부팅 시 저장된 펼침 선택('0')을 복원한다", () => {
    storage.set("rpg-zzu:ai-panel-collapsed", "0");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });
});

function openSettingsSurface(panel: FakeElement): FakeElement {
  const commandBarSettings = findByTestId(panel, "ai-settings-command-bar");
  const headerSettings = findByTestId(panel, "ai-settings-toggle");
  expect(commandBarSettings ?? headerSettings).not.toBeNull();
  (commandBarSettings ?? headerSettings)?.click();
  const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
  if (!modal) throw new Error("ai-settings-modal missing");
  return modal;
}

describe("설정 자동 저장", () => {
  it("커맨드바에서 설정 모달을 1클릭으로 연다", () => {
    const panel = renderPanel();
    expect(findByTestId(panel, "ai-settings-command-bar")).not.toBeNull();
    const modal = openSettingsSurface(panel);
    expect(findByTestId(modal, "ai-config-baseurl")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-apikey")).not.toBeNull();
    expect(findByTestId(modal, "ai-auth-chatgpt")).not.toBeNull();
    expect(findByTestId(modal, "ai-auth-api-key")).not.toBeNull();
    expect(findByTestId(modal, "ai-oauth-status")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-model-preset")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-lite-model-preset")).not.toBeNull();
    expect(modal.textContent).toContain("ChatGPT 구독으로 작업");
    const apiKey = findByTestId(modal, "ai-config-apikey");
    expect((apiKey?.parentNode as FakeElement | null)?.hidden).toBe(true);
  });

  it("새 설정은 ChatGPT 로그인이 기본이고 API 키 폴백으로 전환할 수 있다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    expect(loadAiConfig().authMode).toBe("chatgpt");

    const apiMode = findByTestId(modal, "ai-auth-api-key");
    if (!apiMode) throw new Error("API auth mode button missing");
    apiMode.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.authMode).toBe("apiKey");
    const apiKey = findByTestId(modal, "ai-config-apikey");
    expect((apiKey?.parentNode as FakeElement | null)?.hidden).toBe(false);
  });

  it("API 키 입력만으로 즉시 localStorage에 저장된다 (저장 버튼 불필요)", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const apiKey = findByTestId(modal, "ai-config-apikey");
    expect(apiKey).not.toBeNull();
    if (!apiKey) return;
    apiKey.value = "sk-or-test-abc";
    apiKey.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.apiKey).toBe("sk-or-test-abc");
  });

  it("감독 모델을 비우고 저장하면 기본값(flash-lite)으로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const model = findByTestId(modal, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "   ";
    model.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("gpt-5.6-terra");
    expect(loadAiConfig().model).toBe("gpt-5.6-terra");
    expect(loadAiConfig().liteModel).toBe(DEFAULT_LITE_MODEL);
  });

  it("모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const model = findByTestId(modal, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "minimax/minimax-m3";
    model.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe("minimax/minimax-m3");
  });

  it("실행 모델 필드는 비우면 기본 liteModel로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const liteModel = findByTestId(modal, "ai-config-lite-model");
    if (!liteModel) throw new Error("lite model field missing");
    liteModel.value = "   ";
    liteModel.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.liteModel).toBe(DEFAULT_LITE_MODEL);
    expect(DEFAULT_LITE_MODEL).toBe("gpt-5.6-terra");
  });

  it("모델 설정 라벨은 감독/실행 역할을 구분한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);

    expect(modal.textContent).toContain("감독 모델(계획·검수)");
    expect(modal.textContent).toContain("실행 모델(툴 작업)");
  });

  it("ChatGPT 모델 선택기는 GJC의 최신 Codex 모델을 바로 선택해 저장한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!preset) throw new Error("model preset missing");
    preset.value = "gpt-5.6-terra";
    preset.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe("gpt-5.6-terra");
  });

  it("ChatGPT 모델 선택기에 GPT-5.6 Sol, Terra, Luna를 모두 노출한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!preset) throw new Error("model preset missing");

    expect(preset.textContent).toContain("gpt-5.6-sol");
    expect(preset.textContent).toContain("gpt-5.6-terra");
    expect(preset.textContent).toContain("gpt-5.6-luna");
  });

  it("API/게이트웨이 모드에서는 Claude, Gemini, Grok 모델 목록을 제공한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const apiMode = findByTestId(modal, "ai-auth-api-key");
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!apiMode || !preset) throw new Error("API mode controls missing");

    apiMode.click();

    expect(preset.textContent).toContain("claude-opus-4-8");
    expect(preset.textContent).toContain("gemini-3.5-flash");
    expect(preset.textContent).toContain("grok-4.3");
  });

  it("실행 모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const liteModel = findByTestId(modal, "ai-config-lite-model");
    if (!liteModel) throw new Error("lite model field missing");
    liteModel.value = "minimax/minimax-m3";
    liteModel.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.liteModel).toBe("minimax/minimax-m3");
  });

  it("설정 저장 버튼도 동일하게 저장한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const baseUrl = findByTestId(modal, "ai-config-baseurl");
    const save = findByTestId(modal, "ai-config-save");
    if (!baseUrl || !save) throw new Error("fields missing");
    baseUrl.value = "https://example.invalid/v1";
    save.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.baseUrl).toBe("https://example.invalid/v1");
  });
});

describe("감사 로그 내보내기", () => {
  function fakeChatSession(): AssistantSession {
    return new AssistantSession(createBlankProject(), {
      config: defaultAiConfig(),
      chat: async () => ({
        message: { role: "assistant" as const, content: "완료했습니다." },
        finishReason: "stop",
      }),
    });
  }

  it("대화가 없으면 null(내보낼 것 없음)을 반환한다", async () => {
    const { combineAuditJson } = await import("@/editor/panels/aiChatPanel");
    expect(combineAuditJson([], null, "m")).toBeNull();
  });

  it("세션 폐기 후에도 누적 히스토리로 내보내기가 가능하다", async () => {
    const { combineAuditJson } = await import("@/editor/panels/aiChatPanel");
    const session = fakeChatSession();
    await session.sendUserMessage("npc 넣어줘", () => {});
    expect(session.getAuditEntries().length).toBeGreaterThanOrEqual(2); // user + assistant

    // 패널의 dropSession과 동일한 흐름: 세션 폐기 전 항목을 히스토리로 회수.
    const history = [...session.getAuditEntries()];
    const json = combineAuditJson(history, null, "minimax/minimax-m3");
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.model).toBe("minimax/minimax-m3");
    expect(parsed.entries.length).toBe(history.length);
    // at(ISO 타임스탬프)는 결함 ⑬(구조화 세션 로그)에서 추가 — 내용 필드만 고정 검증.
    expect(parsed.entries[0]).toMatchObject({ kind: "user", text: "npc 넣어줘" });
  });

  it("현재 세션과 히스토리를 합쳐 내보낸다", async () => {
    const { combineAuditJson } = await import("@/editor/panels/aiChatPanel");
    const previous = fakeChatSession();
    await previous.sendUserMessage("첫 대화", () => {});
    const current = fakeChatSession();
    await current.sendUserMessage("둘째 대화", () => {});

    const json = combineAuditJson([...previous.getAuditEntries()], current, "m");
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.entries.length).toBe(previous.getAuditEntries().length + current.getAuditEntries().length);
  });
});

describe("세션 설정 반영", () => {
  it("updateConfig가 진행 중인 세션의 설정을 교체한다", () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "", model: "old-model" },
    });
    expect(JSON.parse(session.exportAudit()).model).toBe("old-model");

    session.updateConfig({ ...defaultAiConfig(), apiKey: "sk-or-new", model: "minimax/minimax-m3" });
    expect(JSON.parse(session.exportAudit()).model).toBe("minimax/minimax-m3");
  });
});
