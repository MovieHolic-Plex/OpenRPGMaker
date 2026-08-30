// AI 어시스턴트 채팅 패널 — 접기 토글 + 설정 자동 저장 + 세션 설정 반영.
// 사용자 불만 회귀 테스트: (1) 패널을 접을 수 없었다, (2) API 키/설정이 저장되지 않는 것처럼
// 보였다(세션이 생성 시점 설정을 캐시), (3) 감독/실행 모델 기본값이 DEFAULT_MODEL 과 일치한다.
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

// 칩 접힘(`is-collapsed`)은 side·float 축이다 — glass 는 입력줄을 남기는 fold 로 갈라졌다
// (test/aiGlassFold.test.ts).
function renderPanel(dock: "glass" | "side" | "float" = "side"): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel({ getChatDock: () => dock }));
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
    // 예전에는 68종을 종류 구분 없이 한 줄로 나열했다(감독이 고를 수 없는 제공자까지 섞였다).
    // 지금 목록은 로그인 경로가 실재하는 두 구독 제공자뿐이다.
    expect(providers?.querySelectorAll("option").length).toBe(2);
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

  it("설정 제공자 목록은 종류와 무관하게 두 구독 제공자만 담는다", () => {
    // optgroup 으로 묶여 있으므로 childNodes 가 아니라 querySelectorAll("option") 으로 관통해 읽는다.
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-oh-my-pi-provider");
    if (!select) throw new Error("provider select missing");
    const values = (): readonly string[] =>
      select.querySelectorAll("option").map((option) => option.getAttribute("value") ?? "");

    expect(values()).toEqual(["google-antigravity", "openai-codex"]);

    findByTestId(modal, "ai-auth-api-key")?.click();

    // 자격 종류를 눌러도 목록은 그대로다 — 두 제공자가 모두 구독 로그인이라 갈릴 목록이 없다.
    expect(values()).toEqual(["google-antigravity", "openai-codex"]);
    expect(providersForKind("oauth")).toEqual(providersForKind("apiKey"));
  });

  it("Codex 를 고르면 저장·재로드를 살아남는다 (제공자 선택이 실제로 반영된다)", () => {
    // 옛 계약은 "무엇을 골라도 Antigravity 로 되돌린다" 였다. 감독 요구가 바뀌어 Codex 도
    // 1급 선택지이므로, 고른 값이 blob 에 적히고 재로드에서도 유지되는지가 새 회귀선이다.
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const select = findByTestId(modal, "ai-oh-my-pi-provider") as unknown as HTMLSelectElement;
    if (!select) throw new Error("provider select missing");

    select.value = "openai-codex";
    select.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.providerId).toBe("openai-codex");
    // 제공자를 바꾸면 그 제공자의 기본 모델을 채택한다(남의 카탈로그 모델을 남기지 않는다).
    expect(stored.model).toBe("gpt-5.6-sol");
    const reloaded = loadAiConfig();
    expect(reloaded.providerId).toBe("openai-codex");
    expect(reloaded.model).toBe("gpt-5.6-sol");

    // 되돌리기도 된다 — 잠긴 축이 아니라 진짜 선택이다.
    select.value = "google-antigravity";
    select.dispatchEvent(new Event("change"));
    expect(loadAiConfig().providerId).toBe("google-antigravity");
  });

  it("키 입력칸이 아예 없고 저장된 blob 의 apiKey 는 빈 문자열이다", () => {
    // 옛 스펙은 "API 키 입력만으로 즉시 localStorage 에 저장된다" 였다 — 그게 평문 키가 남던
    // 경로다. 고를 수 있는 두 제공자가 모두 구독 로그인이라 키 입력 자체가 사라졌고, 남는
    // 보안 계약은 그대로다: **브라우저 저장소에 비밀이 닿지 않는다.**
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    findByTestId(modal, "ai-auth-api-key")?.click();

    // 숨은 input 도 두지 않는다 — 자동완성·미래 collect 경로가 값을 읽을 수 있는 표면이다.
    expect(findByTestId(modal, "ai-config-apikey")).toBeNull();
    expect(findByTestId(modal, "ai-companion-api-key")).toBeNull();
    expect(findByTestId(modal, "ai-companion-save-key")).toBeNull();

    // 저장 경로를 한 번 태워도 blob 에는 비밀이 없다.
    const maxTokens = findByTestId(modal, "ai-config-maxtokens");
    if (!maxTokens) throw new Error("maxTokens field missing");
    maxTokens.value = "4096";
    maxTokens.dispatchEvent(new Event("change"));

    const raw = storage.get(AI_CONFIG_STORAGE_KEY) ?? "";
    const stored = JSON.parse(raw || "{}");
    expect(stored.apiKey).toBe("");
    expect(stored.baseUrl).toBe("");
    expect(raw).not.toContain("sk-");
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
    expect(DEFAULT_MODEL).toBe("gemini-3.7-flash");
    expect(loadAiConfig().model).toBe("gemini-3.7-flash");
    expect(loadAiConfig().liteModel).toBe("gemini-3.7-flash");
  });

  it("모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const model = findByTestId(modal, "ai-config-model");
    if (!model) throw new Error("model field missing");
    model.value = "custom/free-form-model";
    model.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.model).toBe("custom/free-form-model");
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
    expect(DEFAULT_LITE_MODEL).toBe("gemini-3.7-flash");
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

  it("모델 선택기는 선택된 제공자의 모델만 노출하고 제공자를 바꾸면 목록도 바뀐다", () => {
    // 회귀 가치는 그대로다: 남의 제공자 모델이 목록에 섞이면 고른 모델이 조용히 강등된다.
    // 달라진 것은 기준이다 — "gemini 만" 이 아니라 "**선택된** 제공자의 카탈로그만".
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    const select = findByTestId(modal, "ai-oh-my-pi-provider") as unknown as HTMLSelectElement;
    if (!preset || !select) throw new Error("model preset or provider select missing");

    // 기본 제공자(Antigravity): gemini 계열이 보이고 Codex 모델은 없다.
    expect(preset.textContent).toContain("gemini-3.7-flash");
    for (const foreign of ["gpt-5.6-sol", "gpt-5.6-terra", "glm-", "grok-"]) {
      expect(preset.textContent, foreign).not.toContain(foreign);
    }

    // Codex 로 전환하면 목록이 Codex 카탈로그로 교체된다.
    select.value = "openai-codex";
    select.dispatchEvent(new Event("change"));

    expect(preset.textContent).toContain("gpt-5.6-sol");
    expect(preset.textContent).toContain("gpt-5.6-terra");
    for (const foreign of ["gemini-3.7-flash", "claude-opus", "glm-", "grok-"]) {
      expect(preset.textContent, foreign).not.toContain(foreign);
    }
  });

  it("두 제공자 카탈로그 밖 모델은 제시되지도, 살아남지도 않는다", () => {
    // 옛 계약("API/게이트웨이 모드에서 Claude·Gemini·Grok 목록을 제공한다")이 지켰던 동작은
    // 사라졌다: 그 모델들에 닿을 게이트웨이 제공자가 레지스트리에 없다. 같은 자리에서 지켜야
    // 할 새 보증은 이것이다 — 카탈로그 밖 ID 는 목록에 없고, 저장돼 있었다면 로드 시 선택된
    // 제공자의 기본 모델로 교정된다(그대로 실려 나가면 400/조용한 강등이 된다).
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...defaultAiConfig(),
      model: "claude-opus-4-8",
      liteModel: "grok-4.6",
    }));

    const corrected = loadAiConfig();
    expect(corrected.providerId).toBe("google-antigravity");
    expect(corrected.model).toBe(DEFAULT_MODEL);
    expect(corrected.liteModel).toBe(DEFAULT_LITE_MODEL);

    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const preset = findByTestId(modal, "ai-config-model-preset");
    if (!preset) throw new Error("model preset missing");

    // 자격 종류를 눌러도 사라진 게이트웨이 목록이 되살아나지 않는다.
    findByTestId(modal, "ai-auth-api-key")?.click();
    for (const gone of ["claude-opus-4-8", "grok-4.3", "grok-4.6", "glm-5.2-ultrafast", "cpen/"]) {
      expect(preset.textContent, gone).not.toContain(gone);
    }
  });

  it("실행 모델 필드는 자유 입력이 가능하고 입력값이 그대로 저장된다", () => {
    const panel = renderPanel();
    const modal = openSettingsSurface(panel);
    const liteModel = findByTestId(modal, "ai-config-lite-model");
    if (!liteModel) throw new Error("lite model field missing");
    liteModel.value = "custom/free-form-model";
    liteModel.dispatchEvent(new Event("input"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.liteModel).toBe("custom/free-form-model");
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
    const json = combineAuditJson(history, null, "custom/free-form-model");
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.model).toBe("custom/free-form-model");
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

    session.updateConfig({ ...defaultAiConfig(), apiKey: "sk-or-new", model: "custom/free-form-model" });
    expect(JSON.parse(session.exportAudit()).model).toBe("custom/free-form-model");
  });
});
