// AI 어시스턴트 채팅 패널 — 접기 토글 + 설정 자동 저장 + 세션 설정 반영.
// 사용자 불만 회귀 테스트: (1) 패널을 접을 수 없었다, (2) API 키/설정이 저장되지 않는 것처럼
// 보였다(세션이 생성 시점 설정을 캐시), (3) 모델 기본값은 감독 m3 / 실행 flash-lite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig, loadAiConfig } from "@/ai/llmClient";
import { OH_MY_PI_PROVIDERS, ohMyPiAuthKind } from "@/ai/ohMyPiProviders";
import { providersForKind } from "@/ai/aiConnectionKind";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
    // First visit boots open; restore click is a no-op if already expanded.
    if (panel.classList.contains("is-collapsed")) {
      findByTestId(panel, "ai-collapsed-restore")?.click();
    }
    const collapse = findByTestId(panel, "ai-collapse");
    expect(collapse).not.toBeNull();
    expect(panel.classList.contains("is-collapsed")).toBe(false);

    collapse?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");

    collapse?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("부팅 시 저장된 펼침 선택('0')을 복원한다", () => {
    storage.set("oprn:ai-panel-collapsed", "0");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });
});

function openSettingsSurface(panel: FakeElement): FakeElement {
  expect(findByTestId(panel, "ai-settings-command-bar")).toBeNull();
  expect(findByTestId(panel, "ai-settings-toggle")).toBeNull();
  openAiSettingsModal();
  const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
  if (!modal) throw new Error("ai-settings-modal missing");
  return modal;
}

describe("설정 자동 저장", () => {
  it("AI 패널 밖의 전용 설정 모달을 열고 고급 설정을 바로 펼친다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    // 브라우저 보관 키·엔드포인트 입력은 제거됐다 — 평문 키가 localStorage 에 남던 근원이다.
    // 부재 자체가 회귀 방지선이므로 단언으로 고정한다(자세한 계약은 aiSettingsModalNoBrowserKey).
    expect(findByTestId(modal, "ai-config-baseurl")).toBeNull();
    expect(findByTestId(modal, "ai-config-apikey")).toBeNull();
    expect(findByTestId(modal, "ai-auth-oauth")).not.toBeNull();
    expect(findByTestId(modal, "ai-auth-api-key")).not.toBeNull();
    const providers = findByTestId(modal, "ai-oh-my-pi-provider");
    expect(providers).not.toBeNull();
    // 기본은 구독 로그인 종류라 OAuth 제공자 14종만 담는다 — 예전에는 68종을 종류 구분 없이
    // 한 줄로 나열했다(감독이 고를 수 없는 제공자까지 섞여 있었다).
    expect(providers?.querySelectorAll("option").length).toBe(14);
    expect(findByTestId(modal, "ai-oauth-status")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-model-preset")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-lite-model-preset")).not.toBeNull();
    expect(modal.textContent).toContain("구독 로그인");
    expect(findByTestId(modal, "ai-settings-advanced")?.getAttribute("open")).not.toBeNull();
  });

  it("API 키 종류로 바꿔도 전송 축은 동반 서비스로 남는다", () => {
    // 옛 스펙은 여기서 stored.authMode === "apiKey" 를 기대했다. 그 배선이 장애의 원인이었다 —
    // authMode 는 전송 축(동반 서비스 vs 직접 게이트웨이)이고, 사용자가 고르는 것은 자격 증명
    // 종류다. 두 종류 모두 동반 서비스가 자격을 보관하므로 전송은 바뀌지 않는다.
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    expect(loadAiConfig().authMode).toBe("chatgpt");

    const apiMode = findByTestId(modal, "ai-auth-api-key");
    if (!apiMode) throw new Error("API auth mode button missing");
    apiMode.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.authMode).toBe("chatgpt");
    // 제공자는 Antigravity 하나로 강제되므로 종류 축도 항상 oauth 다 — 자격 종류를 눌러도
    // 제공자가 바뀌지 않는다(감독 지시 2026-08-26: 잔여 경로 없음).
    expect(stored.providerId).toBe("google-antigravity");
    expect(ohMyPiAuthKind(stored.providerId)).toBe("oauth");
    // 브라우저에는 비밀이 남지 않는다.
    expect(stored.apiKey ?? "").toBe("");
    expect(stored.baseUrl ?? "").toBe("");
  });

  it("설정 제공자 목록은 고른 연결 종류의 제공자만 담는다", () => {
    // optgroup 으로 묶여 있으므로 childNodes 가 아니라 querySelectorAll("option") 으로 관통해 읽는다.
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-oh-my-pi-provider");
    if (!select) throw new Error("provider select missing");
    const values = (): readonly string[] =>
      select.querySelectorAll("option").map((option) => option.getAttribute("value") ?? "");

    expect(values()).toEqual(providersForKind("oauth").map((provider) => provider.id));

    findByTestId(modal, "ai-auth-api-key")?.click();

    expect(values()).toEqual(providersForKind("apiKey").map((provider) => provider.id));
    // 합치면 카탈로그 전체다 — 필터가 제공자를 잃어버리지 않는다.
    expect(providersForKind("oauth").length + providersForKind("apiKey").length)
      .toBe(OH_MY_PI_PROVIDERS.length);
  });

  it("제공자 선택을 건드려도 Antigravity 로 남는다 (되돌릴 구멍 없음)", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-oh-my-pi-provider") as unknown as HTMLSelectElement;
    if (!select) throw new Error("provider select missing");
    select.value = "anthropic";
    select.dispatchEvent(new Event("change"));
    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.providerId).toBe("google-antigravity");
    expect(loadAiConfig().providerId).toBe("google-antigravity");
  });

  it("동반 서비스 키 입력은 localStorage 에 저장되지 않는다", () => {
    // 옛 스펙은 "API 키 입력만으로 즉시 localStorage 에 저장된다" 였다 — 그게 평문 키가 남던
    // 경로다. 키는 이제 동반 서비스로만 가고, 브라우저 저장소에는 흔적이 없어야 한다.
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    findByTestId(modal, "ai-auth-api-key")?.click();
    const key = findByTestId(modal, "ai-companion-api-key");
    expect(key).not.toBeNull();
    if (!key) return;
    key.value = "sk-or-test-abc";
    key.dispatchEvent(new Event("input"));

    expect(storage.get(AI_CONFIG_STORAGE_KEY) ?? "").not.toContain("sk-or-test-abc");
  });

  it("감독 모델을 비우고 저장하면 기본값(OAuth 카탈로그)으로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const model = findByTestId(modal, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "   ";
    model.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe(DEFAULT_MODEL);
    // 기본 모델은 OAuth(Codex) 카탈로그 ID 다 — 인증이 OAuth 하나뿐이므로 게이트웨이 ID
    // (옛 기본값 cpen/gpt-5-6-luna)는 쓸 수 없다. 카탈로그 밖 ID 는 오류 없이 제공자 기본
    // 모델로 강등되므로, 저장 시점 기본값 자체가 카탈로그 안이어야 한다.
    expect(DEFAULT_MODEL).toBe("gemini-3.7-flash-high");
    expect(loadAiConfig().model).toBe("gemini-3.7-flash-high");
    expect(loadAiConfig().liteModel).toBe("gemini-3.7-flash-high");
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
    // 실행 모델 기본값도 감독과 동일(단일 모델 기본) — 예전 flash-lite pin 이 아니다.
    expect(DEFAULT_LITE_MODEL).toBe("gemini-3.7-flash-high");
  });

  it("모델 설정 라벨은 감독/실행 역할을 구분한다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);

    expect(modal.textContent).toContain("감독 모델(계획·검수)");
    expect(modal.textContent).toContain("실행 모델(툴 작업)");
  });

  it("ChatGPT 모델 선택기는 GJC의 최신 Codex 모델을 바로 선택해 저장한다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...defaultAiConfig(),
      providerId: "openai-codex",
      model: "gpt-5.6-sol",
      liteModel: "gpt-5.6-sol",
    }));
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!preset) throw new Error("model preset missing");
    preset.value = "gpt-5.6-terra";
    preset.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe("gpt-5.6-terra");
  });

  it("모델 선택기는 gemini 만 노출한다 — 남의 제공자 모델은 남기지 않는다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...defaultAiConfig(),
      providerId: "openai-codex",
      model: "gpt-5.6-sol",
      liteModel: "gpt-5.6-sol",
    }));
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!preset) throw new Error("model preset missing");

    expect(preset.textContent).toContain("gemini-3.7-flash-high");
    for (const foreign of ["gpt-5.6-sol", "gpt-5.6-terra", "claude", "glm-"]) {
      expect(preset.textContent, foreign).not.toContain(foreign);
    }
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
    // baseUrl 필드가 사라졌으므로 남아 있는 필드(최대 토큰)로 저장 경로를 확인한다.
    const maxTokens = findByTestId(modal, "ai-config-maxtokens");
    const save = findByTestId(modal, "ai-config-save");
    if (!maxTokens || !save) throw new Error("fields missing");
    maxTokens.value = "12345";
    save.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.maxTokens).toBe(12345);
    expect(stored.baseUrl).toBe("");
  });
});

describe("agentMode 설정", () => {
  it("agentMode 키가 없는 옛 설정 blob은 로드 시 'auto'로 백필된다", () => {
    // 이 변경 전에 저장된 blob — agentMode 필드가 없다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: undefined }));
    const loaded = loadAiConfig();
    expect(loaded.agentMode).toBe("auto");
  });

  it("agentMode가 이상한 값이면 'auto'로 정규화된다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "weird" }));
    expect(loadAiConfig().agentMode).toBe("auto");
  });

  it("설정 모달에서 agentMode를 chat으로 바꾸면 blob에 저장되고 재렌더 시 값이 유지된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-config-agentmode");
    if (!select) throw new Error("agentMode select missing");
    // 기본값 auto 가 선택돼 있다.
    expect(select.value).toBe("auto");

    select.value = "chat";
    select.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.agentMode).toBe("chat");

    // 재로드(재렌더) 후에도 저장된 값이 토글에 다시 그려진다.
    expect(loadAiConfig().agentMode).toBe("chat");
    const reopened = openSettingsSurface(renderPanel());
    const reselect = findByTestId(reopened, "ai-config-agentmode");
    expect(reselect?.value).toBe("chat");
  });

  it("설정 저장 버튼으로도 agentMode가 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-config-agentmode");
    const save = findByTestId(modal, "ai-config-save");
    if (!select || !save) throw new Error("agentMode controls missing");
    select.value = "chat";
    save.click();

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.agentMode).toBe("chat");
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
