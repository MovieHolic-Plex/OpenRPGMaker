// AI 어시스턴트 채팅 패널 — 접기 토글 + 설정 자동 저장 + 세션 설정 반영.
// 사용자 불만 회귀 테스트: (1) 패널을 접을 수 없었다, (2) API 키/설정이 저장되지 않는 것처럼
// 보였다(세션이 생성 시점 설정을 캐시), (3) 모델 기본값은 google/gemini-3.5-flash.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

describe("패널 접기", () => {
  it("접기 버튼 클릭으로 접히고 상태가 localStorage에 저장된다", () => {
    const panel = renderPanel();
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

  it("저장된 접힘 상태가 다음 렌더에서 복원된다", () => {
    storage.set("rpg-zzu:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
  });
});

describe("설정 자동 저장", () => {
  it("API 키 입력만으로 즉시 localStorage에 저장된다 (저장 버튼 불필요)", () => {
    const panel = renderPanel();
    const apiKey = findByTestId(panel, "ai-config-apikey");
    expect(apiKey).not.toBeNull();
    if (!apiKey) return;
    apiKey.value = "sk-or-test-abc";
    apiKey.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.apiKey).toBe("sk-or-test-abc");
  });

  it("모델을 비우고 저장하면 기본값(google/gemini-3.5-flash)으로 저장된다", () => {
    const panel = renderPanel();
    const model = findByTestId(panel, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "   ";
    model.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("google/gemini-3.5-flash");
    expect(loadAiConfig().model).toBe("google/gemini-3.5-flash");
    expect(loadAiConfig().liteModel).toBe(DEFAULT_LITE_MODEL);
  });

  it("모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const model = findByTestId(panel, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "google/gemini-3.1-pro";
    model.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe("google/gemini-3.1-pro");
  });

  it("보조 모델 필드는 비우면 기본 liteModel로 저장된다", () => {
    const panel = renderPanel();
    const liteModel = findByTestId(panel, "ai-config-lite-model");
    if (!liteModel) throw new Error("lite model field missing");
    liteModel.value = "   ";
    liteModel.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.liteModel).toBe(DEFAULT_LITE_MODEL);
    expect(DEFAULT_LITE_MODEL).toBe("google/gemini-3.1-flash-lite");
  });

  it("보조 모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const liteModel = findByTestId(panel, "ai-config-lite-model");
    if (!liteModel) throw new Error("lite model field missing");
    liteModel.value = "google/gemini-3.1-flash-lite-preview";
    liteModel.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.liteModel).toBe("google/gemini-3.1-flash-lite-preview");
  });

  it("설정 저장 버튼도 동일하게 저장한다", () => {
    const panel = renderPanel();
    const baseUrl = findByTestId(panel, "ai-config-baseurl");
    const save = findByTestId(panel, "ai-config-save");
    if (!baseUrl || !save) throw new Error("fields missing");
    baseUrl.value = "https://openrouter.ai/api/v1";
    save.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.baseUrl).toBe("https://openrouter.ai/api/v1");
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
    const json = combineAuditJson(history, null, "google/gemini-3.5-flash");
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.model).toBe("google/gemini-3.5-flash");
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

    session.updateConfig({ ...defaultAiConfig(), apiKey: "sk-or-new", model: "google/gemini-3.5-flash" });
    expect(JSON.parse(session.exportAudit()).model).toBe("google/gemini-3.5-flash");
  });
});
