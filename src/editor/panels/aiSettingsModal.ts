import { PI_APPLY_MODES, isLiveApplyMode, normalizePiApplyMode } from "@/ai/piAgent/applyMode";
import { agentModeAvailable, isAgentModeEnabled, setAgentModeEnabled } from "@/editor/agentMode/agentModeSetting";
import { modelDisplayName } from "@/ai/modelDisplayName";
import { modelForRole, type RoleModel } from "@/ai/modelRoles";
import { PIXEL_MODEL_CHOICES, resolvePixelModel } from "@/ai/pixelModel";
// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.
import { formatEditorDate, t } from "@/i18n";

import { configForUltrabrain, DEFAULT_ULTRABRAIN_MODEL } from "@/ai/ultrabrainConfig";
import { DEFAULT_PI_APPLY, DEFAULT_PI_TEAM } from "@/ai/piAgent/executionRoute";
import {
  DEFAULT_BASE_URL,
  DEFAULT_LITE_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  defaultAiConfig,
  isAutonomyLevel,
  loadAiConfig,
  saveAiConfig,
  AI_CONFIG_CHANGED_EVENT,
  type AiConfig,
} from "@/ai/llmClient";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { MODEL_PRESETS, tierModelFor, type ModelPreset } from "@/ai/modelPresets";
import { isModelValidForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { getOhMyPiProvider, parseOhMyPiProvider, selectableOhMyPiProviders, type OhMyPiProvider } from "@/ai/ohMyPiProviders";
import { OPENAI_COMPAT_CHANGED_EVENT, getKnownOpenAiCompatEndpoint, isOpenAiCompatProviderId, openAiCompatModelBlockReason } from "@/ai/openAiCompat";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID, IMAGE_MODEL_CATALOG } from "@/ai/imageModelCatalog";
import { configForProviderSelection, workProviderIds } from "@/ai/providerSelection";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus, refreshAiConnectionStatus } from "./aiConnectionStatus";
import {
  AI_BACKGROUND_OPACITY_LIMITS,
  applyAiBackgroundOpacity,
  clampAiBackgroundOpacity,
  loadAiBackgroundOpacity,
  saveAiBackgroundOpacity,
  applyAiFontSize,
  applyAiRenderWeight,
  loadAiFontSize,
  loadAiRenderWeight,
  saveAiFontSize,
  saveAiRenderWeight,
  type AiFontSize,
  type AiRenderWeight,
} from "@/editor/panels/aiPanelLayout";
import { modalCloseButton } from "@/editor/ui/modal";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { installAiModalFocus } from "./aiModalFocus";
import { el } from "@/util/dom";
import { dismissToastsByKey, toast } from "@/util/toast";

const INVALID_MODEL_TOAST_KEY = Symbol("ai-settings-invalid-model");
import { renderAiAuthSettings, type AiAuthStatusSnapshot } from "./aiAuthSettings";
import { AI_COMPAT_ROLE_SLOTS, renderAiCompatSettings, type AiCompatRoleSlot } from "./aiCompatSettings";
import { renderAiOpenAiDirectSettings } from "./aiOpenAiDirectSettings";
import { renderAiQuickConnect } from "./aiQuickConnect";
import { renderAiToolUsagePanel } from "./aiToolUsagePanel";
import { fetchConnectedRoutes, renderAiRoleMatrixSettings } from "./aiRoleMatrixSettings";
import { localCliOfProvider } from "@/ai/localCliEngine";
import { ASSISTANT_ENGINE_CHANGED_EVENT, loadEngineChoice, localAgentsEnabled, saveEngineChoice } from "@/start/settings/localAgents";
import { renderAiLocalProgramSettings } from "./aiLocalProgramSettings";
import { renderAiSettingsOverview } from "./aiSettingsOverview";
import { deckIcon } from "./aiDeckIcons";
import { aiProviderIcon } from "./aiProviderIcons";
import { ASSISTANT_CHATGPT_MODEL, isLegacyTerraModel } from "@/ai/chatgptDefault";
import { hasStoredCompanionCredential, hasUsableCompanionCredential } from "@/ai/chatgptOAuthClient";
import { CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { installEventEditorCustomSelects } from "./eventEditor/customSelect";

const ROLE_LABELS = {
  ultrabrain: "계획 · 최종 판단",
  vision: "시각 관찰",
  writer: "작문",
  deep: "실행 · 검증",
  build: "시공",
} as const;

export type AiSettingsFocus = "first" | "apiKey";

/** 패널이 소유하는 컨트롤을 설정 모달의 한 절로 싣는다(예: 대기 화면 3분기 — 제안서 D6). */
export type AiSettingsExtraSection = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly content: HTMLElement;
};

export type OpenAiSettingsModalOptions = {
  readonly focusTarget?: AiSettingsFocus;
  readonly nativeSelects?: boolean;
  readonly onSaved?: (config: AiConfig) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  /** 패널 루트 — 글자 크기 즉시 반영용(선택). */
  readonly fontRoot?: HTMLElement | null;
  readonly extraSections?: readonly AiSettingsExtraSection[];
};

let activeAiSettingsClose: (() => void) | null = null;
let panelSettings: (() => OpenAiSettingsModalOptions) | null = null;

/** The single mounted chat panel supplies the same settings context to every entry. */
export function registerAiSettingsPanel(getOptions: () => OpenAiSettingsModalOptions): () => void {
  panelSettings = getOptions;
  return () => {
    if (panelSettings !== getOptions) return;
    closeAiSettingsModal();
    panelSettings = null;
  };
}

export function closeAiSettingsModal(): void {
  if (activeAiSettingsClose) {
    activeAiSettingsClose();
    return;
  }
  document.querySelector("[data-testid='ai-settings-modal']")?.remove();
  notifyAiSettingsClosed();
}

/**
 * 설정 모달이 닫혔다는 신호. **닫힘 경로가 둘 이상이라 이벤트가 필요하다** —
 * `closeAiSettingsModal()` 직접 호출과, 모달 내부의 `close()`(닫기 버튼·배경 클릭·Escape).
 *
 * 왜 필요한가 (2026-09-22): AI 미연결 잠금 막은 막을 누를 때만 다시 판정했다. 그래서
 * "AI 연결하기 → 로그인 → 모달 닫기 → 막 아무 데나 누르기" 라는 한 단계가 더 있었다.
 * 로그인을 마친 사람이 막이 걷히지 않은 화면을 보면 그게 더 나쁘다.
 */
import { AI_SETTINGS_CLOSED_EVENT } from "./aiSettingsEvents";
export { AI_SETTINGS_CLOSED_EVENT } from "./aiSettingsEvents";

export function notifyAiSettingsClosed(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_CLOSED_EVENT));
}

export function openAiSettingsModal(options: OpenAiSettingsModalOptions = {}): HTMLElement {
  closeAiSettingsModal();
  const panelOptions = panelSettings?.();
  const extraSections = options.extraSections ?? panelOptions?.extraSections;
  const form = renderAiSettingsForm({
    onSaved: (config) => {
      panelOptions?.onSaved?.(config);
      options.onSaved?.(config);
    },
    onBackgroundOpacityChange: (value) => {
      // Topbar settings has no injected panel; update mounted roots as well.
      const roots = new Set(document.querySelectorAll<HTMLElement>(".ai-chat-panel"));
      if (panelOptions?.fontRoot) roots.add(panelOptions.fontRoot);
      if (options.fontRoot) roots.add(options.fontRoot);
      for (const root of roots) applyAiBackgroundOpacity(root, value);
    },
    onFontSizeChange: (size) => {
      panelOptions?.onFontSizeChange?.(size);
      options.onFontSizeChange?.(size);
      if (panelOptions?.fontRoot) applyAiFontSize(panelOptions.fontRoot, size);
      if (options.fontRoot) applyAiFontSize(options.fontRoot, size);
    },
    extraSections,
    onAdvancedChange: (open) => { titlebar.inert = open; },
  });

  const closeButton = modalCloseButton("ai-settings-close", () => close(), {
    label: "설정 닫기", testid: "ai-settings-close", icon: deckIcon("x"),
  });

  const titlebar = el("header", {
    class: "ai-settings-titlebar",
    // Keep Close as the first tab stop, even when an entry directs initial focus to the form.
    children: [closeButton, el("h2", { text: "AI 설정" })],
  });
  const backdrop = el("div", {
    class: "ai-settings-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-settings-modal" },
    children: [
      el("section", {
        class: "ai-settings-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "AI 설정" },
        children: [
          titlebar,
          el("div", {
            class: "ai-settings-body",
            dataset: { testid: "ai-settings-body" },
            children: [form.element],
          }),
        ],
      }),
    ],
  });

  // 네이티브 select 는 이 모달에서 OS 크롬 그대로 떠서 주변 카드·입력과 어긋났다. 이벤트
  // 편집기와 같은 커스텀 리스트박스로 올린다 — 네이티브 요소는 값·change 원천으로 남는다.
  const customSelects = options.nativeSelects ? undefined : installEventEditorCustomSelects(backdrop);
  const restoreFocus = installAiModalFocus(backdrop);

  const close = registerModal(backdrop, () => {
    // 인증 패널은 기기 로그인 폴링 타이머를 들고 있다 — 정리하지 않으면 모달이 닫힌 뒤에도
    // /auth/status 를 3초마다 계속 때린다.
    customSelects?.dispose();
    form.dispose();
    backdrop.remove();
    if (activeAiSettingsClose === close) activeAiSettingsClose = null;
    restoreFocus();
    notifyAiSettingsClosed();
  });
  activeAiSettingsClose = close;
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && isTopModal(backdrop)) close();
  });
  document.body.append(backdrop);

  if (options.focusTarget === "apiKey") form.focusApiKey();
  else form.focusFirstInput();

  return backdrop;
}

export function renderAiSettingsForm(options: {
  readonly onContinue?: () => void;
  readonly onAdvancedChange?: (open: boolean) => void;
  readonly onSaved?: (config: AiConfig) => void;
  readonly onBackgroundOpacityChange?: (value: number) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  readonly extraSections?: readonly AiSettingsExtraSection[];
}): {
  element: HTMLElement;
  focusFirstInput: () => void;
  focusApiKey: () => void;
  dispose: () => void;
} {
  const onSaved = options.onSaved ?? (() => undefined);
  const onFontSizeChange = options.onFontSizeChange ?? (() => undefined);
  const config = loadAiConfig();
  let disposed = false;
  const authMode = config.authMode;
  let providerId = parseOhMyPiProvider(config.providerId);
  let modelSelectionOverrides = { ...config.modelSelectionOverrides };
  let applyAccountSelection = (_force = false): void => undefined;
  const [imageEntry] = IMAGE_MODEL_CATALOG;
  const imageProvider = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "이미지 생성 제공자", disabled: "" },
    dataset: { testid: "ai-config-image-provider" },
    children: [el("option", { attrs: { value: imageEntry.providerId }, text: imageEntry.providerLabel })],
  }) as HTMLSelectElement;
  imageProvider.value = imageEntry.providerId;
  const imageModel = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "이미지 생성 모델", "aria-describedby": "ai-config-image-status", disabled: "" },
    dataset: { testid: "ai-config-image-model" },
    children: [el("option", { attrs: { value: imageEntry.model }, text: imageEntry.label })],
  }) as HTMLSelectElement;
  imageModel.value = imageEntry.model;
  const imageStatus = el("p", {
    class: "ai-config-help ai-card-status",
    attrs: { id: "ai-config-image-status" },
    dataset: { testid: "ai-config-image-status" },
    text: "그림은 ChatGPT 로만 그려요. 생성할 때 ChatGPT 로그인을 확인합니다.",
  });

  // 추론 강도 옵션은 영어 enum 을 그대로 보여 주지 않는다 — 영역 작업 추론 셀렉트와 같은 한국어 라벨.
  const effortLabels = { off: "끔", low: "낮음", medium: "보통", high: "높음", xhigh: "매우 높음", max: "최대" } as const;
  const effortEntries = Object.entries(effortLabels);
  const effortOptions = (minimum: "off" | "low" | "medium") => effortEntries
    .slice(effortEntries.findIndex(([value]) => value === minimum))
    .map(([value, text]) => el("option", { attrs: { value }, text }));
  // ── 도트 저작 모델(텍스트 모델) ───────────────────────────────────────────────
  // 도트는 이미지 모델이 아니라 텍스트 모델이 격자 문자열·좌표로 직접 찍는다. 그래서 이 칸은 이미지 모델 목록이 아니라
  // 텍스트 모델 목록이고, 비워 두면(따라가기) 옛 동작 그대로 계획·최종 판단 모델이 공방 그리기를 맡는다.
  const PIXEL_FOLLOW = "";
  const pixelKey = (provider: string, model: string): string => `${provider}::${model}`;
  const initialPixel = resolvePixelModel(config);
  const pixelModelSelect = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "도트 저작 모델", "aria-describedby": "ai-config-pixel-status" },
    dataset: { testid: "ai-config-pixel-model" },
  }) as HTMLSelectElement;
  const pixelEffort = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "도트 저작 추론 강도" },
    dataset: { testid: "ai-config-pixel-reasoning" },
    children: effortOptions("off"),
  }) as HTMLSelectElement;
  const pixelStatus = el("p", {
    class: "ai-config-help ai-card-status",
    attrs: { id: "ai-config-pixel-status", role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-config-pixel-status" },
  });
  const refreshPixelModels = (selected: string): void => {
    const brain = `${configForUltrabrain(config).model}`;
    pixelModelSelect.replaceChildren(
      el("option", { attrs: { value: PIXEL_FOLLOW }, text: `계획 모델과 같게 (${brain})` }),
      ...PIXEL_MODEL_CHOICES.map(choice => el("option", {
        attrs: { value: pixelKey(choice.provider, choice.model) }, text: `${choice.providerLabel} · ${choice.label}`,
      })),
    );
    if (selected !== PIXEL_FOLLOW && !PIXEL_MODEL_CHOICES.some(choice => pixelKey(choice.provider, choice.model) === selected)) {
      pixelModelSelect.append(el("option", { attrs: { value: selected, disabled: "" }, text: `${selected.replace("::", " · ")} · 목록에 없음` }));
    }
    pixelModelSelect.value = selected;
    pixelModelSelect.dispatchEvent(new Event("input", { bubbles: true }));
    refreshPixelStatus();
  };
  const refreshPixelStatus = (): void => {
    const following = pixelModelSelect.value === PIXEL_FOLLOW;
    pixelEffort.disabled = following;
    const choice = PIXEL_MODEL_CHOICES.find(entry => pixelKey(entry.provider, entry.model) === pixelModelSelect.value);
    pixelStatus.textContent = following
      ? "따로 고르지 않아 계획·최종 판단 모델이 그립니다."
      : choice?.model.startsWith("claude")
        ? "Claude 모델은 Google 계정 연결로 씁니다."
        : "선택한 모델의 계정 로그인이 필요합니다.";
  };
  refreshPixelModels(initialPixel.follows ? PIXEL_FOLLOW : pixelKey(initialPixel.model.provider, initialPixel.model.model));
  pixelEffort.value = initialPixel.model.thinkingLevel;
  const model = modelField("작문 모델", modelForRole(config, "writer").model, "ai-config-model", "ai-config-model-preset", authMode, DEFAULT_MODEL, providerId);
  const liteModel = modelField(
    "실행 모델",
    modelForRole(config, "deep").model,
    "ai-config-lite-model",
    "ai-config-lite-model-preset",
    authMode,
    DEFAULT_LITE_MODEL,
    providerId,
  );
  const brainConfig = configForUltrabrain(config);
  const brainProvider = el("select", {
    class: "ai-config-select", dataset: { testid: "ai-config-ultrabrain-provider" },
    attrs: { "aria-label": "계획 모델 제공자" },
  }) as HTMLSelectElement;
  fillProviderOptions(brainProvider, brainConfig.providerId!);
  brainProvider.value = brainConfig.providerId!;
  const brainModel = modelField("계획 모델", brainConfig.model,
    "ai-config-ultrabrain-model", "ai-config-ultrabrain-model-preset", authMode, DEFAULT_ULTRABRAIN_MODEL, brainProvider.value);
  const brainEffort = el("select", {
    class: "ai-config-select", dataset: { testid: "ai-config-ultrabrain-reasoning" },
    attrs: { "aria-label": "계획 모델 추론 강도" },
  }) as HTMLSelectElement;
  const specialistControls = (["vision", "writer", "deep", "build"] as const).map(role => {
    const selected = modelForRole(config, role);
    const provider = el("select", { class: "ai-config-select", dataset: { testid: `ai-config-${role}-provider` },
      attrs: { "aria-label": `${ROLE_LABELS[role]} 제공자` },
    }) as HTMLSelectElement;
    fillProviderOptions(provider, selected.provider);
    provider.value = selected.provider;
    const field = role === "writer" ? model : role === "deep" ? liteModel
      : role === "build" ? modelField("시공 모델", selected.model, "ai-config-build-model", "ai-config-build-model-preset", authMode, selected.model, selected.provider)
      : modelField("시각 관찰 모델", selected.model, "ai-config-vision-model", "ai-config-vision-model-preset", authMode, selected.model, selected.provider);
    field.refresh(authMode, selected.provider);
    const effort = el("select", { class: "ai-config-select", dataset: { testid: `ai-config-${role}-reasoning` },
      attrs: { "aria-label": `${ROLE_LABELS[role]} 추론 강도` },
    }) as HTMLSelectElement;
    return { role, provider, field, effort };
  });
  const brainControl = { role: "ultrabrain", provider: brainProvider, field: brainModel, effort: brainEffort } as const;
  const mainRoles = [brainControl, ...specialistControls] as const;
  type RoleControl = typeof mainRoles[number];
  const roleModelValue = ({ role, provider, field }: RoleControl): string => field.input.value.trim() || (
    role === "ultrabrain" ? getOhMyPiProvider(provider.value)?.defaultModel || DEFAULT_ULTRABRAIN_MODEL
      : modelForRole(config, role).model
  );
  const syncSelect = (select: HTMLSelectElement): void => {
    select.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const setRoleEffort = (control: RoleControl, value = control.effort.value): void => {
    const { role, effort } = control;
    const requiresMedium = (role === "ultrabrain" || role === "deep" || role === "build")
      && roleModelValue(control) === ASSISTANT_CHATGPT_MODEL;
    const minimum = requiresMedium ? "medium" : role === "ultrabrain" ? "low" : "off";
    const optionsChanged = effort.options[0]?.value !== minimum;
    if (optionsChanged) effort.replaceChildren(...effortOptions(minimum));
    const next = Array.from(effort.options).some(option => option.value === value) ? value : minimum;
    if (optionsChanged || effort.value !== next) {
      effort.value = next;
      syncSelect(effort);
    }
  };
  const setRoleModel = (control: RoleControl, provider: string, model: string, effort?: RoleModel["thinkingLevel"]): void => {
    fillProviderOptions(control.provider, provider);
    control.field.refresh(authMode, provider);
    control.field.setValue(model, authMode, provider);
    setRoleEffort(control, effort);
    syncSelect(control.provider);
    syncSelect(control.field.preset);
  };
  const validateRoleModel = (control: RoleControl): boolean => {
    const valid = control.field.validate(authMode, control.provider.value);
    setRoleEffort(control);
    return valid;
  };
  const validateRoleModels = (): boolean => mainRoles.map(validateRoleModel).every(Boolean);
  setRoleEffort(brainControl, brainConfig.reasoningEffort);
  for (const control of specialistControls) setRoleEffort(control, modelForRole(config, control.role).thinkingLevel);
  // 엔드포인트(ai-config-baseurl)와 API 키(ai-config-apikey) 입력은 **의도적으로 없다.**
  //
  // 두 필드는 브라우저가 직접 게이트웨이를 치던 시절의 것이고, 입력한 키는 saveAiConfig 를 통해
  // localStorage["oprn:ai-config"] 에 **평문으로** 저장됐다 — 같은 다이얼로그의 인증 패널이
  // "브라우저에는 두지 않습니다" 라고 약속하는 중에. 지금은 두 연결 종류 모두 자격을 동반
  // 서비스가 보관하므로(ai-companion-api-key 입력이 그 경로다) 이 칸들은 존재 이유가 없다.
  // 게이트웨이가 필요한 소비자(노드 스크립트·evals·벤치마크)는 설정을 직접 주입한다.
  let persistAuthMode = (): void => undefined;
  // 인증 패널은 연결 종류와 제공자만 돌려준다 — 전송 축(authMode)은 에디터에서 항상
  // 동반 서비스이므로 UI 가 정할 것이 없다(근거: llmClient.aiTransport).
  // 패널은 헤더 요약보다 먼저 만들어진다 — 그 사이 온 상태는 마지막 값만 기억해 두었다가 적는다.
  let lastAuthStatus: AiAuthStatusSnapshot | null = null;
  let pendingAuthStatus: ((next: AiAuthStatusSnapshot) => void) | null = null;
  const primaryFeedback = el("div", { class: "ai-settings-primary-feedback", attrs: { hidden: "" } });
  const disconnectError = el("p", { class: "ai-auth-error", attrs: { hidden: "", role: "alert" } });
  let chatGptAccount: Parameters<typeof hasUsableCompanionCredential>[0] | undefined;
  let chatGptCheckFailed = false;
  let chatGptAccountChecking = true;
  const authSettings = renderAiAuthSettings(config, ({ providerId: next }) => {
    providerId = next;
    applyAccountSelection();
    persistAuthMode();
  }, (next) => {
    lastAuthStatus = next;
    pendingAuthStatus?.(next);
  }, {
    feedback: primaryFeedback,
    disconnectError,
    onAccount: (status, failed, checking) => {
      chatGptAccount = status;
      chatGptCheckFailed = failed;
      chatGptAccountChecking = checking;
      syncChatGptAccount();
    },
  });
  // 「사용자 지정 (OpenAI 호환)」 카드 — 「계정 추가」 안 「다른 방법으로 연결」에 둔다. 역할 칸에 꽂는 일은 아래 assignCompatRole 이 한다.
  const compatSettings = renderAiCompatSettings({
    getAssignment: (slot) => {
      if (slot === "ultrabrain") return { provider: brainProvider.value, model: brainModel.input.value.trim() };
      const control = specialistControls.find((entry) => entry.role === slot);
      return { provider: control?.provider.value ?? providerId, model: control?.field.input.value.trim() ?? "" };
    },
    getMainProvider: () => providerId,
    selectMain: (endpointId) => authSettings.selectProvider(endpointId),
    assign: (slot, endpointId, endpointModel) => assignCompatRole(slot, endpointId, endpointModel),
  });
  // 빠른 연결(OpenRouter 키·OpenAI 호환) — 「계정 추가」 맨 위에 있다(연결이 없으면 펼쳐진 채 열린다). 저장되면 그 엔드포인트를 기본 연결로 고른다.
  const quickConnect = renderAiQuickConnect({
    onConnected: (endpoint) => {
      authSettings.selectProvider(endpoint.id);
      compatSettings.refresh();
    },
  });
  // 「계정 추가」 안 「고급: 직접 입력」. 저장된 뒤 모든 역할 칸을 그 모델로 맞춘다.
  let applyDirectConnection: (endpointId: string, model: string) => void = () => undefined;
  const directSettings = renderAiOpenAiDirectSettings({
    onUse: (endpoint, model) => applyDirectConnection(endpoint.id, model),
  });
  const quickConnectSection = settingsSection("quick-connect", "빠른 연결", "처음이라면 여기서 시작하세요.", [quickConnect.element]);
  const maxTokensDescription = `한 요청에서 AI가 쓸 수 있는 출력 토큰 예산입니다. 기본값은 ${DEFAULT_MAX_TOKENS}이며, 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다.`;
  const maxTokens = textField("최대 토큰", maxTokensDescription, String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute("title", maxTokensDescription);

  const initialAutonomyLevel: AutonomyLevel = isAutonomyLevel(config.autonomyLevel) ? config.autonomyLevel : "balanced";
  const autonomySelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-autonomy" },
    children: AUTONOMY_LEVELS.map((level) =>
      el("option", { attrs: { value: level.id }, text: level.label }),
    ),
  }) as HTMLSelectElement;
  autonomySelect.value = initialAutonomyLevel;
  const autonomyDescription = "계획만 제안할지 직접 작업할지와 작업 예산을 조정합니다. 역할 표에서 실행 모델의 추론 강도를 낮음 이외의 값으로 지정하면 그 값이 우선합니다.";
  // 다이얼이 덮어쓰는 파생값(추론 강도·작업 모드·플랜 게이트)을 셀렉트 아래 한 줄로 노출한다 —
  // 예전에는 세 컨트롤이 나란히 놓여 "누가 누구를 덮는지"가 보이지 않았다.
  const autonomyDerived = el("span", {
    class: "ai-config-derived",
    dataset: { testid: "ai-config-autonomy-derived" },
  });
  const setAutonomyDerived = (level: AutonomyLevel): void => {
    const resolved = resolveAutonomy(level);
    const effort = ({ off: "끔", low: "낮음", medium: "보통", high: "높음", xhigh: "매우 높음", max: "최대" } as const)[resolved.reasoningEffort];
    const mode = resolved.agentMode === "auto" ? "자율 모드" : "채팅 모드";
    // 경우마다 한 템플릿으로 쓴다 — 빈 꼬리(${extra}="")를 잇던 옛 문장은 번역 템플릿이 맞지 않아 「추론 낮음」 이
    // 한국어로 남았다(UI 감사 09-ai-07). 옛 키 「→ 추론 {0} · {1}{2}」 와 겹치지 않게 「추론 강도」 로 쓴다.
    autonomyDerived.textContent = resolved.readOnly
      ? `→ 추론 강도 ${effort} · ${mode} · 쓰기 없음`
      : resolved.planOnly
        ? `→ 추론 강도 ${effort} · ${mode} · 실행 전 승인`
        : `→ 추론 강도 ${effort} · ${mode}`;
  };
  setAutonomyDerived(initialAutonomyLevel);
  const autonomyRow = settingsRow(
    "일하는 방식",
    autonomyDescription,
    el("span", { class: "ai-config-stack", children: [autonomySelect, autonomyDerived] }),
  );
  autonomyRow.setAttribute("title", autonomyDescription);

  const reasoningSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-reasoning" },
    children: effortOptions("off"),
  }) as HTMLSelectElement;
  reasoningSelect.value = config.reasoningEffort ?? "medium";
  const reasoningDescription = "기존 영역 작업 경로의 추론 강도를 설정합니다. 대화 조수는 위의 일하는 방식 설정을 따르며, 역할 표에서 실행 모델의 추론 강도를 낮음 이외의 값으로 지정하면 그 값이 우선합니다.";
  const reasoningRow = settingsRow("영역 작업 추론", reasoningDescription, reasoningSelect);
  reasoningRow.setAttribute("title", reasoningDescription);

  // agentMode(작업 모드): auto = 플래너(작업 분해) 상시, chat = 종래 채팅(모델 이원화 시에만 플래너).
  const agentModeSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-agentmode" },
    children: [
      el("option", { attrs: { value: "auto" }, text: "자율(플래너 상시)" }),
      el("option", { attrs: { value: "chat" }, text: "채팅(종래)" }),
    ],
  }) as HTMLSelectElement;
  agentModeSelect.value = config.agentMode ?? "auto";
  agentModeSelect.addEventListener("change", () => persist(false));
  const agentModeDescription = "자율 모드는 요청을 작업 계획으로 나누고, 채팅 모드는 대화 중심으로 진행합니다.";
  const agentModeRow = settingsRow("작업 모드", agentModeDescription, agentModeSelect);
  agentModeRow.setAttribute(
    "title",
    "자율: AI가 요청을 스스로 작업 계획으로 분해해 진행합니다. 채팅: 종래처럼 대화로 진행합니다(감독·실행 모델이 다를 때만 계획 단계 사용).",
  );

  const piApplySelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-pi-apply" },
    children: PI_APPLY_MODES.map(mode => el("option", { attrs: { value: mode.id, title: mode.description }, text: mode.label })),
  });
  piApplySelect.value = config.piApply ?? DEFAULT_PI_APPLY;
  // Keep the last choice on each side of the switch while the dialog is open.
  const initialApply = normalizePiApplyMode(piApplySelect.value);
  const initiallyLive = isLiveApplyMode(initialApply);
  let liveApply = initiallyLive ? initialApply : DEFAULT_PI_APPLY;
  let stagedApply = initiallyLive ? "review" : initialApply;
  const applySwitch = settingsSwitch("ai-config-apply-immediately", "변경 바로 적용", "큰 삭제는 확인한 뒤에 반영해요.",
    initiallyLive, (checked) => {
      piApplySelect.value = checked ? liveApply : stagedApply;
      piApplySelect.dispatchEvent(new Event("input", { bubbles: true }));
      persist(false);
    });
  piApplySelect.addEventListener("change", () => {
    const mode = normalizePiApplyMode(piApplySelect.value);
    const live = isLiveApplyMode(mode);
    if (live) liveApply = mode;
    else stagedApply = mode;
    applySwitch.row.setAttribute("aria-checked", String(live));
    persist(false);
  });
  const applyRow = settingsRow("결과 적용", "「바로 반영」 셋은 실제 맵을 실시간으로 편집합니다. 검토 후 적용·단계별 적용은 승인 전까지 초안으로 남습니다.", piApplySelect);
  const dialoguePolish = settingsSwitch("ai-config-dialogue-polish", "완성 후 대사 다듬기", "새로 쓴 대사와 설명을 한 번 더 살펴요.",
    config.dialoguePolishAfterBuild !== false, () => persist(false));
  const imagePlan = settingsSwitch("ai-config-image-plan", "이미지 콘셉트부터 시작", "그림을 그리기 전에 콘셉트를 먼저 정해요.",
    config.imagePlanBuild !== false, () => persist(false));
  const piTeam = settingsSwitch("ai-config-pi-team", "Pi 팀 실행", "여러 작업을 조수 팀에 나누어 맡겨요.",
    config.piTeam ?? DEFAULT_PI_TEAM, () => persist(false));
  const imagePlanCountSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-image-plan-count" },
    children: [
      el("option", { attrs: { value: "1" }, text: "1장" }),
      el("option", { attrs: { value: "2" }, text: "2장 중 선택" }),
      el("option", { attrs: { value: "3" }, text: "3장 중 선택" }),
    ],
  }) as HTMLSelectElement;
  imagePlanCountSelect.value = String(config.imagePlanCandidates ?? 1);
  imagePlanCountSelect.addEventListener("change", () => persist(false));
  const imagePlanCountRow = settingsRow("도안 장 수", "여러 장을 동시에 그려 비전 판정자가 고릅니다. 측정에서는 1장보다 나아지지 않았고 시간만 늘어 기본은 1장입니다.", imagePlanCountSelect);
  const externalAgentSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-agent-mode" },
    children: [
      el("option", { attrs: { value: "off" }, text: "끔" }),
      el("option", { attrs: { value: "on" }, text: "켬" }),
    ],
  }) as HTMLSelectElement;
  externalAgentSelect.value = isAgentModeEnabled() ? "on" : "off";
  externalAgentSelect.addEventListener("change", () => setAgentModeEnabled(externalAgentSelect.value === "on"));
  const externalAgentRow = settingsRow("에이전트 모드", agentModeAvailable()
    ? "코딩 에이전트(Claude Code·Codex·opencode)를 조수 창의 「에이전트」 탭에서 앱 안에 설치·로그인해 씁니다. 로그인은 각 에이전트의 공식 창에서 하고 OPRN 은 토큰을 보지 않습니다."
    : "데스크톱 앱(또는 이 PC 의 로컬 호스트)에서만 쓸 수 있습니다.", externalAgentSelect);
  const fontSizeSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-font-size" },
    children: [
      el("option", { attrs: { value: "small" }, text: "작게" }),
      el("option", { attrs: { value: "normal" }, text: "보통" }),
      el("option", { attrs: { value: "large" }, text: "크게" }),
    ],
  }) as HTMLSelectElement;
  fontSizeSelect.value = loadAiFontSize();
  const fontSizeDescription = "채팅 로그, 제안 카드, 도구 로그의 글자 크기입니다. 바꾸면 즉시 적용되고 저장됩니다.";
  const renderWeightSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-render-weight" },
    children: [
      el("option", { attrs: { value: "light" }, text: "가볍게" }),
      el("option", { attrs: { value: "heavy" }, text: "무겁게" }),
      el("option", { attrs: { value: "off" }, text: "끄기" }),
    ],
  }) as HTMLSelectElement;
  renderWeightSelect.value = loadAiRenderWeight();
  applyAiRenderWeight(loadAiRenderWeight());
  const renderWeightDescription = "조수 창이 맵 위를 어떻게 그릴지입니다. 가볍게는 흐림 없이 반투명, 무겁게는 유리 블러, 끄기는 불투명한 판입니다. 내장 GPU에서는 무겁게가 마우스를 움직일 때마다 느려집니다.";
  const renderWeightRow = settingsRow("화면 무게", renderWeightDescription, renderWeightSelect);
  renderWeightSelect.addEventListener("change", () => {
    const raw = renderWeightSelect.value;
    const weight: AiRenderWeight = raw === "heavy" || raw === "off" ? raw : "light";
    saveAiRenderWeight(weight);
    applyAiRenderWeight(weight);
    savedHint.textContent = savedAtText();
  });

  const fontSizeRow = settingsRow("글자 크기", fontSizeDescription, fontSizeSelect);
  fontSizeRow.setAttribute("title", fontSizeDescription);

  const backgroundOpacity = el("input", {
    class: "ai-background-opacity-range",
    attrs: {
      id: "ai-background-opacity", type: "range",
      min: String(AI_BACKGROUND_OPACITY_LIMITS.min), max: String(AI_BACKGROUND_OPACITY_LIMITS.max), step: "1",
      "aria-describedby": "ai-background-opacity-help",
    },
    value: String(loadAiBackgroundOpacity()),
    dataset: { testid: "ai-background-opacity" },
  }) as HTMLInputElement;
  const backgroundOpacityValue = el("output", {
    attrs: { for: "ai-background-opacity" },
    text: `${backgroundOpacity.value}%`,
    dataset: { testid: "ai-background-opacity-value" },
  });
  const backgroundOpacityRow = el("div", {
    class: "ai-config-row",
    children: [
      el("span", { class: "ai-config-row-copy", children: [
        el("label", { class: "ai-config-label", attrs: { for: "ai-background-opacity" }, text: "배경 농도" }),
        el("span", { class: "ai-config-help", attrs: { id: "ai-background-opacity-help" }, text: "78–100%. 높을수록 배경이 불투명해집니다. 글자는 흐려지지 않습니다." }),
      ] }),
      el("span", { class: "ai-config-control ai-background-opacity-control", children: [backgroundOpacity, backgroundOpacityValue] }),
    ],
  });
  const persistBackgroundOpacity = (): void => {
    const value = clampAiBackgroundOpacity(Number(backgroundOpacity.value));
    backgroundOpacity.value = String(value);
    backgroundOpacityValue.textContent = `${value}%`;
    saveAiBackgroundOpacity(value);
    options.onBackgroundOpacityChange?.(value);
  };
  backgroundOpacity.addEventListener("input", persistBackgroundOpacity);
  backgroundOpacity.addEventListener("change", persistBackgroundOpacity);

  const savedHint = el("span", {
    class: "ai-config-saved-hint",
    text: "자동 저장",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-config-saved-hint" },
  });
  const savedAtText = (): string => `자동 저장됨 · ${formatEditorDate(new Date(), {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  fontSizeSelect.addEventListener("change", () => {
    const raw = fontSizeSelect.value;
    const size: AiFontSize = raw === "small" || raw === "large" ? raw : "normal";
    saveAiFontSize(size);
    onFontSizeChange(size);
    savedHint.textContent = savedAtText();
  });

  // 시공 행이 실행 행과 같으면 저장하지 않는다 — 저장하면 나중에 실행 모델만 바꿨을 때 시공이 옛 값에 남는다(비우면 실행 모델을 따른다).
  const withoutBuildEqualToDeep = (roles: Record<string, RoleModel>): Record<string, RoleModel> => {
    const { build, deep } = roles;
    if (!build || !deep || build.provider !== deep.provider || build.model !== deep.model || build.thinkingLevel !== deep.thinkingLevel) return roles;
    const { build: _same, ...rest } = roles;
    return rest;
  };
  let syncModelDisplay = (): void => undefined;
  const collect = (): AiConfig => ({
    ...config,
    authMode,
    providerId,
    modelSelectionOverrides,
    roleModels: withoutBuildEqualToDeep(Object.fromEntries(specialistControls.map(control => [control.role, {
      provider: control.provider.value, model: roleModelValue(control),
      thinkingLevel: control.effort.value as RoleModel["thinkingLevel"],
    }]))),
    ultrabrainProviderId: brainProvider.value,
    // 빈 칸은 그 칸 제공자의 기본 모델로 채운다 — 공장 기본이 Claude 가 된 뒤(2026-11-16) Google 의 기본 모델 이름을 다른 계정 칸에 적지 않게.
    ultrabrainModel: roleModelValue(brainControl),
    ultrabrainReasoningEffort: brainEffort.value as AiConfig["ultrabrainReasoningEffort"],
    imageProviderId: DEFAULT_IMAGE_PROVIDER_ID,
    imageModel: DEFAULT_IMAGE_MODEL,
    // 도트 저작 칸: 「따라가기」면 저장하지 않는다(옛 동작 유지). 고른 값만 저장하고 고른 표시를 남긴다.
    ...(pixelModelSelect.value === PIXEL_FOLLOW ? { pixelModel: undefined } : (() => {
      const [provider, model] = pixelModelSelect.value.split("::");
      return { pixelModel: { provider, model, thinkingLevel: pixelEffort.value as RoleModel["thinkingLevel"] } };
    })()),
    // 에디터는 동반 서비스 전송만 쓴다 — baseUrl 은 endpoint() 가 무시하고, 키는 동반 서비스가
    // 들고 있다. 여기서 빈 값으로 고정해 브라우저 저장소에 비밀·죽은 주소가 남지 않게 한다.
    baseUrl: DEFAULT_BASE_URL,
    model: model.input.value.trim() || getOhMyPiProvider(providerId)?.defaultModel || DEFAULT_MODEL,
    liteModel: liteModel.input.value.trim() || getOhMyPiProvider(providerId)?.defaultModel || DEFAULT_LITE_MODEL,
    apiKey: "",
    maxTokens: Math.max(256, Number(maxTokens.input.value) || defaultAiConfig().maxTokens),
    reasoningEffort: (reasoningSelect.value as AiConfig["reasoningEffort"]) || "medium",
    agentMode: agentModeSelect.value === "chat" ? "chat" : "auto",
    autonomyLevel: isAutonomyLevel(autonomySelect.value) ? autonomySelect.value : "balanced",
    piTeam: piTeam.checked(),
    piApply: normalizePiApplyMode(piApplySelect.value),
    dialoguePolishAfterBuild: dialoguePolish.checked() ? undefined : false,
    imagePlanBuild: imagePlan.checked() ? undefined : false,
    // 묘사 끄기는 설정 화면에 칸이 없다(측정용) — 저장할 때 지우지 않고 그대로 넘긴다.
    ...(config.imagePlanDescribe === false ? { imagePlanDescribe: false } : {}),
    imagePlanCandidates: imagePlanCountSelect.value === "2" || imagePlanCountSelect.value === "3" ? Number(imagePlanCountSelect.value) : undefined,
    ...roleMatrixSlots(),
  });
  // 역할 배정 표의 직접 지정 상태를 저장한다.
  function roleMatrixSlots(): Pick<AiConfig, "assistantRoles"> {
    const picked = roleMatrix.collect();
    for (const role of ["smol", "advisor"] as const) {
      if (picked.pinned[role]) modelSelectionOverrides[role] = true;
      else delete modelSelectionOverrides[role];
    }
    return { assistantRoles: picked.assistantRoles };
  }

  /** 연결 카드의 「이 역할에 쓰기」 — 그 역할 칸만 이 엔드포인트·모델로 바꾸고 직접 지정으로 표시한다(다른 칸·기본 제공자는 그대로). */
  const assignCompatRole = (slot: AiCompatRoleSlot, endpointId: string, endpointModel: string): void => {
    const control = mainRoles.find(entry => entry.role === slot);
    if (!control) return;
    setRoleModel(control, endpointId, endpointModel);
    modelSelectionOverrides[slot] = true;
    persist(false);
    updateReadiness();
    void refreshAiConnectionStatus(updateReadiness);
  };
  applyDirectConnection = (endpointId, model) => {
    // 로컬 CLI 엔진이 남아 있으면 loadAiConfig 가 방금 고른 엔드포인트를 그 CLI 로 덮어 쓴다.
    saveEngineChoice(null);
    authSettings.selectProvider(endpointId, { focus: false });
    for (const slot of AI_COMPAT_ROLE_SLOTS) assignCompatRole(slot.id, endpointId, model);
    compatSettings.refresh();
  };
  // 엔드포인트를 만들고 지우면 제공자 선택지와 모델 목록을 다시 채운다.
  const onCompatChanged = (): void => {
    for (const select of [brainProvider, ...specialistControls.map((entry) => entry.provider)]) fillProviderOptions(select, select.value);
    brainModel.refresh(authMode, brainProvider.value);
    for (const entry of specialistControls) entry.field.refresh(authMode, entry.provider.value);
    compatSettings.refresh();
  };
  window.addEventListener(OPENAI_COMPAT_CHANGED_EVENT, onCompatChanged);

  let autoSaveTimer: number | null = null;
  const persist = (showToast: boolean): void => {
    // Keep the selection; unsupported models are shown here and rejected by the companion.
    const modelsValid = validateRoleModels();
    saveAiConfig(collect());
    onSaved(loadAiConfig());
    savedHint.textContent = savedAtText();
    syncModelDisplay();
    // 자동 저장마다 같은 경고가 쌓이지 않도록 이전 경고를 걷고 하나만 남긴다.
    dismissToastsByKey(INVALID_MODEL_TOAST_KEY);
    if (!modelsValid) {
      toast(t("선택한 모델이 현재 연결 방식에서 쓸 수 없습니다. 모델 입력 아래 경고를 확인하세요."), {
        kind: "error",
        key: INVALID_MODEL_TOAST_KEY,
      });
    } else if (showToast) {
      toast(t("어시스턴트 설정을 저장했습니다."), "ok");
    }
  };
  persistAuthMode = () => persist(false);
  applyAccountSelection = (force = false) => {
    const next = configForProviderSelection(collect(), providerId, force);
    modelSelectionOverrides = { ...next.modelSelectionOverrides };
    for (const control of specialistControls) {
      const selected = modelForRole(next, control.role);
      setRoleModel(control, selected.provider, selected.model, selected.thinkingLevel);
    }
    const brain = configForUltrabrain(next);
    setRoleModel(brainControl, brain.providerId!, brain.model, brain.reasoningEffort);
  };
  pixelModelSelect.addEventListener("change", () => {
    if (pixelModelSelect.value === PIXEL_FOLLOW) delete modelSelectionOverrides.pixel;
    else modelSelectionOverrides.pixel = true;
    refreshPixelStatus();
    persist(false);
  });
  pixelEffort.addEventListener("change", () => { modelSelectionOverrides.pixel = true; persist(false); });
  const scheduleAutoSave = (): void => {
    if (typeof window === "undefined") {
      persist(false);
      return;
    }
    if (autoSaveTimer !== null) window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      autoSaveTimer = null;
      persist(false);
    }, 350);
  };
  maxTokens.input.addEventListener("input", scheduleAutoSave);
  maxTokens.input.addEventListener("change", () => persist(false));
  // 사용자가 제공자를 **직접** 바꾸면 이전 제공자의 모델 ID(예: gemini-3.8-flash)는 새 제공자에서
  // 무효다. 그대로 두면 모든 행이 빨간 경고·오류 토스트로 덮여 "연결이 고장났다"처럼 보인다.
  // 그때만 새 제공자의 추천 모델로 맞춘다. 저장돼 있던 카탈로그 밖 ID 를 열 때 조용히 바꾸지
  // 않는 계약("자동 대체하지 않습니다")은 그대로다 — 이건 사용자 조작에 따른 교체다.
  const alignModelToProvider = (field: typeof brainModel, providerId: string, tier: "fast" | "strong"): void => {
    field.refresh(authMode, providerId);
    if (isOpenAiCompatProviderId(providerId)) {
      // 다른 제공자의 모델 ID(예: gemini-4-argon)는 이 서버에 없을 가능성이 크다. 시험에서 받은 목록이 있으면 그 밖의 값은
      // 이 서버의 기본 모델로 맞추고, 목록이 없으면(직접 입력 서버) 사용자가 입력하도록 비운다.
      const known = getKnownOpenAiCompatEndpoint(providerId);
      const current = field.input.value.trim();
      if (!known || known.models.includes(current) || known.defaultModel === current) return;
      field.setValue(tierModelFor(providerId, tier) ?? "", authMode, providerId);
      return;
    }
    if (field.validate(authMode, providerId)) return;
    const next = tierModelFor(providerId, tier);
    if (next) field.setValue(next, authMode, providerId);
  };
  for (const control of mainRoles) {
    const { role, provider, field, effort } = control;
    provider.addEventListener("change", () => {
      modelSelectionOverrides[role] = true;
      alignModelToProvider(field, provider.value, role === "ultrabrain" ? "strong" : "fast");
      persist(false);
    });
    field.input.addEventListener("input", () => {
      modelSelectionOverrides[role] = true;
      validateRoleModel(control);
      scheduleAutoSave();
    });
    field.input.addEventListener("change", () => {
      modelSelectionOverrides[role] = true;
      persist(false);
    });
    field.preset.addEventListener("change", () => {
      modelSelectionOverrides[role] = true;
      if (field.preset.value) field.setValue(field.preset.value, authMode, provider.value);
      persist(false);
    });
    effort.addEventListener("change", () => { modelSelectionOverrides[role] = true; persist(false); });
  }
  reasoningSelect.addEventListener("change", () => persist(false));
  autonomySelect.addEventListener("change", () => {
    const level: AutonomyLevel = isAutonomyLevel(autonomySelect.value) ? autonomySelect.value : "balanced";
    autonomySelect.value = level;
    setAutonomyDerived(level);
    const resolved = resolveAutonomy(level);
    reasoningSelect.value = resolved.reasoningEffort;
    agentModeSelect.value = resolved.agentMode;
    // 프로그래밍 대입은 input/change 을 쏘지 않아 커스텀 셀렉트 라벨이 옛값을 가리킨다 —
    // input 을 쏴 라벨만 동기화한다(change 는 persist 리스너를 한 번 더 태운다).
    reasoningSelect.dispatchEvent(new Event("input", { bubbles: true }));
    agentModeSelect.dispatchEvent(new Event("input", { bubbles: true }));
    persist(false);
  });

  const connectionSummary = el("div", {
    class: "ai-settings-connection-summary",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-settings-connection-summary", tone: "checking" },
    children: [
      el("span", { class: "ai-settings-status-mark", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "ai-settings-status-copy", text: "연결 상태를 확인하고 있습니다…" }),
    ],
  });
  const connectionSummaryCopy = connectionSummary.querySelector(".ai-settings-status-copy") as HTMLElement;
  let checkRequestedAt: Date | null = null;
  // 바꾼 값은 자동 저장된다 — 바닥 버튼은 확정이 아니라 창을 닫는 「완료」다(C-70).
  // 예전 「연결하고 계속」은 연결 전이면 이유 없이 회색으로 막혀 본문의 「로그인」과 주 행동을 다퉜다.
  // 연결돼 사용할 수 있을 때만 주 버튼 무게를 갖는다. 그 전에는 본문의 로그인이 주 행동이다.
  const continueButton = el("button", {
    class: "ai-settings-button",
    text: "완료",
    attrs: { type: "button" },
    dataset: { testid: "ai-settings-continue" },
  }) as HTMLButtonElement;
  const modelConnectionHint = el("p", {
    class: "ai-config-help",
    dataset: { testid: "ai-settings-work-accounts" },
  });
  const alignAccountButton = el("button", {
    class: "ai-settings-button",
    text: "이 계정으로 작업 모델 맞추기",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-settings-align-account" },
  }) as HTMLButtonElement;
  const updateReadiness = (): void => {
    if (disposed) return;
    const next = lastAuthStatus;
    if (!next) return;
    const valid = validateRoleModels();
    const current = collect();
    const workAccounts = workProviderIds(current);
    const mixed = workAccounts.some(id => id !== providerId);
    alignAccountButton.hidden = !mixed;
    modelConnectionHint.textContent = mixed
      ? "직접 지정한 작업 모델은 유지됩니다. 다른 계정을 쓰는 모델이 있으면 그 계정도 연결하세요."
      : "연결되면 이 계정으로 바로 시작해요.";
    const status = getAiConnectionStatus(current);
    const usable = next.tone === "connected" && status.kind === "ready" && !status.limited && valid;
    continueButton.classList.toggle("is-primary", usable);
    connectionSummary.dataset.tone = SUMMARY_TONE[next.tone];
    connectionCheckButton.textContent = next.tone === "offline" ? "다시 시도" : "연결 확인";
    connectionSummaryCopy.textContent = `${next.providerLabel} · ${next.text}`;
    if (next.tone === "connected") {
      connectionSummary.dataset.tone = usable ? "ready" : "warning";
      connectionSummaryCopy.textContent = !valid ? "작업 모델을 확인하세요. 고급에서 지원되는 모델을 선택하세요."
        : status.kind === "ready" && !status.limited ? `${next.providerLabel} · 사용 준비됨` : status.label;
    }
    // 「연결 확인」을 누른 뒤에는 결과를 같은 상태 줄(aria-live)에 시각과 함께 말한다(C-67).
    if (checkRequestedAt !== null) {
      connectionSummaryCopy.append(" · ", el("span", {
        text: `${formatEditorDate(checkRequestedAt, { hour: "2-digit", minute: "2-digit" })} 확인함`,
      }));
    }
  };
  continueButton.addEventListener("click", () => {
    options.onContinue?.();
  });
  alignAccountButton.addEventListener("click", () => {
    applyAccountSelection(true);
    persist(false);
    authSettings.recheck();
  });
  // ── 역할 배정(연결된 계정으로 자동) ─────────────────────────────────────────
  const roleMatrix = renderAiRoleMatrixSettings(() => persist(false), (recommended) => {
    // 로컬 CLI 추천(Claude 가 연결돼 있으면 Sonnet 5.5 high)은 조수 엔진 선택으로 넣는다 — 그래야 실제 실행이 그 모델로 간다.
    const cli = localCliOfProvider(recommended.provider);
    if (cli) {
      saveEngineChoice({ kind: "local-cli", cli, routineModel: recommended.model, deepModel: recommended.model, effort: recommended.thinkingLevel === "low" || recommended.thinkingLevel === "high" ? recommended.thinkingLevel : "medium" });
      toast(t("조수 엔진을 {0} ({1})로 맞췄습니다.").replace("{0}", recommended.model).replace("{1}", recommended.thinkingLevel), "ok");
    } else {
      saveEngineChoice(null);
      for (const c of specialistControls.filter((entry) => entry.role === "deep" || entry.role === "build")) {
        setRoleModel(c, recommended.provider, recommended.model, recommended.thinkingLevel);
        modelSelectionOverrides[c.role] = true;
      }
      persist(false);
    }
    refreshRoleMatrix();
  });
  let connectedRoutes: Awaited<ReturnType<typeof fetchConnectedRoutes>> = [];
  const routeStatusRequests = new AbortController();
  const refreshRoleMatrix = (): void => {
    roleMatrix.refresh(collect(), connectedRoutes);
    syncModelDisplay();
  };
  const reloadConnectedRoutes = (): void => {
    // 응답이 문서가 걷힌 뒤(모달 닫힘·테스트 정리) 오면 다시 그리지 않는다.
    void fetchConnectedRoutes(routeStatusRequests.signal).then((routes) => {
      if (disposed) return;
      connectedRoutes = routes;
      refreshRoleMatrix();
    }, () => undefined);
  };
  roleMatrix.refresh(config, connectedRoutes);
  reloadConnectedRoutes();
  const roleMatrixSection = settingsSection("role-matrix", "역할 배정",
    "연결된 계정으로 역할마다 모델을 고릅니다. 채울 수 없는 역할은 무엇으로 대신하는지 보여 줍니다.", [roleMatrix.element]);

  const onConfigChanged = (): void => {
    refreshRoleMatrix();
    updateReadiness();
    void refreshAiConnectionStatus(updateReadiness);
  };
  const win = typeof window === "undefined" ? undefined : window;
  win?.addEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, updateReadiness);
  win?.addEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, reloadConnectedRoutes);
  win?.addEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfigChanged);
  const SUMMARY_TONE = {
    connected: "ready",
    disconnected: "warning",
    offline: "error",
    checking: "checking",
  } as const;
  pendingAuthStatus = (next) => {
    lastAuthStatus = next;
    updateReadiness();
  };
  const connectionCheckButton = el("button", {
    class: "ai-settings-button ai-settings-check",
    text: "연결 확인",
    attrs: { type: "button" },
    dataset: { testid: "ai-settings-connection-check" },
    on: {
      click: () => {
        checkRequestedAt = new Date();
        connectionSummary.dataset.tone = "checking";
        connectionSummaryCopy.textContent = "연결을 확인하는 중…";
        authSettings.recheck();
        void refreshAiConnectionStatus(updateReadiness).finally(updateReadiness);
      },
    },
  });
  if (lastAuthStatus) pendingAuthStatus(lastAuthStatus);

  const qualityCaption = el("p", {
    class: "ai-settings-caption",
    attrs: { id: "ai-settings-quality-caption", "aria-live": "polite" },
  });
  const qualities = [
    { id: "balanced", effort: "medium", title: "균형", caption: "속도와 품질을 함께 보는 기본 설정이에요." },
    { id: "quality", effort: "high", title: "최고 품질", caption: "더 오래 생각해서 큰 작업을 꼼꼼히 만들어요." },
  ] as const;
  const qualityButtons = qualities.map(({ id, effort, title }) => el("button", {
    class: "ai-model-preset-card",
    text: title,
    attrs: { type: "button", role: "radio", "aria-checked": "false", tabindex: "-1" },
    dataset: { testid: `ai-model-preset-${id}` },
    on: { click: () => applyQuality(effort) },
  }));
  const presetGroup = el("div", {
    class: "ai-model-presets",
    attrs: { role: "radiogroup", "aria-label": "품질", "aria-describedby": "ai-settings-quality-caption" },
    dataset: { testid: "ai-model-presets" },
    children: qualityButtons,
  });
  presetGroup.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const current = qualityButtons.findIndex(button => button === document.activeElement);
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = (current + step + qualityButtons.length) % qualityButtons.length;
    qualityButtons[next].click();
    qualityButtons[next].focus();
  });

  function applyQuality(effort: "medium" | "high"): void {
    saveEngineChoice(null);
    providerId = CODEX_PROVIDER_ID;
    authSettings.selectProvider(providerId, { focus: false, notify: false });
    for (const control of mainRoles) {
      setRoleModel(control, providerId, ASSISTANT_CHATGPT_MODEL, effort);
      modelSelectionOverrides[control.role] = true;
    }
    persist(false);
  }

  // Retain the provider-relative presets for users connected to other accounts.
  function applyProviderPreset(preset: ModelPreset): void {
    for (const control of mainRoles) {
      const spec = control.role === "ultrabrain" ? preset.ultrabrain : preset.roles[control.role];
      const provider = control.provider.value;
      setRoleModel(control, provider, tierModelFor(provider, spec.tier) ?? control.field.input.value, spec.thinking);
    }
    persist(false);
  }

  const roleControls = (
    key: typeof mainRoles[number]["role"],
  ): HTMLElement => {
    const control = mainRoles.find(entry => entry.role === key)!;
    return el("div", {
      class: "ai-settings-role-controls",
      dataset: { testid: `ai-settings-role-${key}` },
      children: [
        el("h4", { text: ROLE_LABELS[key] }),
        settingsRow("제공자", "", control.provider),
        settingsRow("모델", "", el("div", { children: [control.field.control, control.field.warning] })),
        settingsRow("추론 강도", "", control.effort),
      ],
    });
  };

  const execution = roleDetails("progress", "진행", "게임을 기획하고 만들어요.", [
    roleControls("ultrabrain"),
    roleControls("deep"),
    roleControls("build"),
  ]);
  const advisor = roleDetails("advisor", "검토", "바뀐 내용을 다시 살펴요.", [roleMatrix.advisorControls]);
  const vision = roleDetails("screen", "화면 이해", "맵과 컷신 그림을 읽어요.", [
    roleControls("vision"),
  ]);
  const image = roleDetails("image", "이미지 생성", "제목, 배경, 컷신, 초상화를 그려요.", [
    settingsRow("모델", "", imageModel),
    imageStatus,
    settingsDetails([
      "인증 정보는 동반 서비스에만 보관하며 실제 생성 시 확인합니다.",
      "god-tibo-imagen 경로(Codex 응답 API의 그림 도구)로 생성합니다. 참조 그림을 2장까지 함께 보낼 수 있습니다. 앱에 Codex 로그인이 없으면 codex CLI 로그인(~/.codex/auth.json)을 씁니다.",
    ]),
  ]);
  const pixel = roleDetails("pixel", "픽셀 아트", "타일과 캐릭터를 그려요.", [
    settingsRow("모델", "", pixelModelSelect),
    settingsRow("추론 강도", "", pixelEffort),
    pixelStatus,
    settingsDetails([
      "공방의 그리기 단계가 이 모델을 씁니다.",
      "Argon 또는 Claude 계열을 고릅니다. 격자를 한 줄씩 맞추는 일이라 추론 강도는 보통 이상을 권합니다.",
      "이미지 모델은 도트 눈금·색 수·3/4 시점을 지키지 못해 이 용도에는 쓰지 않습니다.",
      "쓸 수 없으면 요청할 때 오류로 알려 주며, 다른 모델로 자동 전환하지 않습니다.",
    ]),
  ]);
  const imageSource = roleDetails("image-provider", "제공자", "", [settingsRow("이미지 생성 제공자", "", imageProvider)]);
  image.value.textContent = imageEntry.providerLabel;
  imageSource.value.textContent = imageEntry.providerLabel;

  syncModelDisplay = (): void => {
    const current = qualities.find(({ effort }) => providerId === CODEX_PROVIDER_ID && !loadEngineChoice()
      && mainRoles.every(control => control.provider.value === CODEX_PROVIDER_ID
        && control.field.input.value.trim() === ASSISTANT_CHATGPT_MODEL && control.effort.value === effort));
    qualityButtons.forEach((button, i) => {
      const selected = qualities[i] === current;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected || (!current && i === 0) ? 0 : -1;
    });
    qualityCaption.textContent = loadEngineChoice()
      ? "이 PC에 설치한 AI 프로그램을 사용 중이에요."
      : current?.caption ?? "고급에서 역할별로 직접 골랐어요.";
    const executionModel = liteModel.input.value.trim();
    const planningModel = brainModel.input.value.trim();
    // 「진행」 행은 계획·실행·시공 세 칸을 묶는다 — 한 칸만 바꿔도 요약이 따라오게 셋을 다 본다.
    const buildModel = specialistControls.find(control => control.role === "build")!.field.input.value.trim() || executionModel;
    const [planningName, executionName, buildName] = [planningModel, executionModel, buildModel].map(settingsModelName) as [string, string, string];
    execution.value.textContent = planningName === executionName && executionName === buildName ? executionName
      : buildName === executionName ? `계획 ${planningName} · 실행 ${executionName}`
        : `계획 ${planningName} · 실행 ${executionName} · 시공 ${buildName}`;
    const reviewer = roleMatrix.advisorModel();
    advisor.value.textContent = reviewer === "off" ? "끔" : settingsModelName(reviewer?.model ?? executionModel);
    vision.value.textContent = settingsModelName(specialistControls.find(control => control.role === "vision")!.field.input.value.trim());
    pixel.value.textContent = settingsModelName(pixelModelSelect.value === PIXEL_FOLLOW
      ? planningModel : pixelModelSelect.value.split("::")[1]);
    // Following the planner should show the current planner after it is edited.
    pixelModelSelect.options[0].textContent = `계획 모델과 같게 (${settingsModelName(planningModel)})`;
  };

  const loginButton = el("button", {
    class: "ai-settings-login",
    text: "ChatGPT로 로그인",
    attrs: { type: "button" },
    dataset: { testid: "ai-settings-chatgpt-login" },
    on: { click: () => authSettings.startPrimaryLogin() },
  });
  const hero = el("section", {
    class: "ai-settings-hero",
    dataset: { testid: "ai-settings-chatgpt-hero" },
    children: [
      el("span", { class: "ai-settings-hero-mark", children: [deckIcon("spark", { size: 22 })] }),
      el("h3", { text: "ChatGPT로 로그인" }),
      el("p", { text: "게임 제작은 GPT-6.2 Sol, 그림은 ChatGPT가 맡아요." }),
      loginButton,
    ],
  });
  const accountLabel = el("span", { attrs: { translate: "no" } });
  const logout = el("button", {
    class: "ai-settings-link",
    text: "로그아웃",
    attrs: { type: "button", "aria-label": "ChatGPT에서 로그아웃" },
    dataset: { testid: "ai-settings-chatgpt-logout" },
    on: { click: () => authSettings.disconnectChatGpt() },
  });
  const accountRow = el("div", {
    class: "ai-settings-inset ai-settings-row ai-settings-account",
    attrs: { hidden: "" },
    dataset: { testid: "ai-settings-chatgpt-account" },
    children: [
      el("span", { class: "ai-settings-avatar", children: [aiProviderIcon(CODEX_PROVIDER_ID) ?? deckIcon("spark", { size: 18 })] }),
      el("div", { class: "ai-settings-row-copy", children: [
        el("span", { text: "ChatGPT" }),
        el("span", { class: "ai-settings-account-status", attrs: { role: "status" }, children: [
          el("span", { class: "ai-settings-connected", text: "연결됨" }), accountLabel,
        ] }),
      ] }),
      logout,
    ],
  });
  const accountChecking = el("p", {
    class: "ai-config-help", attrs: { role: "status", tabindex: "-1" },
    dataset: { testid: "ai-settings-chatgpt-checking" }, text: "연결 확인 중…",
  });
  const accountCheckError = el("div", {
    class: "ai-auth-error ai-auth-actions", attrs: { role: "status" }, dataset: { testid: "ai-settings-chatgpt-check-error" },
    children: [
      el("span", { text: "ChatGPT 연결 상태를 확인하지 못했어요." }),
      el("button", {
        class: "ai-settings-link", text: "다시 시도", attrs: { type: "button" },
        dataset: { testid: "ai-settings-chatgpt-check-retry" },
        on: { click: () => {
          chatGptCheckFailed = false;
          chatGptAccountChecking = true;
          accountChecking.focus();
          syncChatGptAccount();
          authSettings.recheckChatGpt();
        } },
      }),
    ],
  });
  const qualitySection = settingsSection("presets", "품질", "", [presetGroup]);
  qualitySection.append(qualityCaption);
  function syncChatGptAccount(): void {
    const status = getAiConnectionStatus();
    const sharesAccount = status.providerId === CODEX_PROVIDER_ID && status.authMode === "chatgpt";
    const account = (sharesAccount ? status.account : undefined) ?? chatGptAccount;
    const connected = (sharesAccount && status.kind === "ready") || (!!account && hasUsableCompanionCredential(account));
    const active = document.activeElement;
    const focusedFeedback = primaryFeedback.contains(active);
    const label = account?.accountEmail || account?.accountLabel || account?.planType?.toUpperCase();
    accountLabel.textContent = label ? ` · ${label}` : "";
    // 다른 계정(Claude·Grok 등)으로 조수가 이미 돌면 ChatGPT 로그인 큰 카드를 띄우지 않는다 — 한 계정 사용자에게는 소음이다(2026-11-23).
    hero.hidden = connected || chatGptAccountChecking || (status.kind === "ready" && status.providerId !== CODEX_PROVIDER_ID);
    accountRow.hidden = !connected;
    accountChecking.hidden = connected || !chatGptAccountChecking;
    accountCheckError.hidden = !chatGptCheckFailed;
    qualitySection.hidden = !connected;
    logout.hidden = !account || !hasStoredCompanionCredential(account);
    if (connected && (active === loginButton || focusedFeedback)) {
      (logout.hidden ? qualityButtons.find(button => button.tabIndex === 0) : logout)?.focus();
    } else if (!connected && (active === logout
      || (focusedFeedback && chatGptAccount && !chatGptAccount.pendingLogin && !chatGptAccount.lastLoginError))) loginButton.focus();
  }

  const localPrograms = localAgentsEnabled() ? renderAiLocalProgramSettings() : undefined;
  const alternativeSummary = el("summary", {
    class: "ai-settings-row",
    dataset: { testid: "ai-settings-other-ways" },
    children: [rowCopy("다른 방법으로 연결", "Claude, Google, 다른 계정"), chevron()],
  });
  const alternatives = el("details", {
    class: "ai-settings-alternatives",
    children: [
      alternativeSummary,
      el("div", { class: "ai-settings-alternative-body", children: [
        settingsSection("connection", "계정 연결", "", [
          authSettings.element, modelConnectionHint, alignAccountButton,
          el("div", { class: "ai-settings-connection-actions", children: [connectionSummary, connectionCheckButton] }),
        ]),
        settingsSection("compat", "사용자 지정 연결", "OpenAI 호환 서버(OpenRouter 등)", [compatSettings.element]),
        ...(localPrograms ? [localPrograms.element] : []),
        ...(options.onContinue ? [el("div", { class: "ai-config-actions", children: [continueButton] })] : []),
      ] }),
    ],
  });

  // 기본 주소·키·모델을 직접 넣는 폼은 「빠른 연결」 아래 접힌 고급으로 둔다(대부분은 키 하나로 끝난다).
  const directAdvanced = el("details", {
    class: "ai-settings-alternatives",
    dataset: { testid: "ai-settings-direct-advanced" },
    children: [
      el("summary", { class: "ai-settings-row", children: [rowCopy("고급: 직접 입력", "기본 주소, API 키, 모델을 직접 넣어요"), chevron()] }),
      el("div", { class: "ai-settings-alternative-body", children: [
        settingsSection("openai-direct", "OpenAI 호환 API (직접 입력)", "기본 주소, API 키, 모델을 넣으면 조수가 그 서버를 씁니다.", [directSettings.element]),
      ] }),
    ],
  });

  const usageContent = el("div");
  const overview = renderAiSettingsOverview();
  // 계정 추가 — 연결이 없으면 펼쳐 둔다(할 일이 그것뿐). 연결된 사용자에게는 접힌 한 줄이다(다른 길 안내가 시끄럽게 뜨지 않게).
  const addAccount = el("details", {
    class: "ai-settings-alternatives",
    dataset: { testid: "ai-settings-add-account" },
    children: [
      el("summary", { class: "ai-settings-row", dataset: { testid: "ai-settings-add-account-toggle" },
        children: [rowCopy("계정 추가", "API 키 · ChatGPT · Claude · Google · 내 PC 프로그램"), chevron()] }),
      el("div", { class: "ai-settings-alternative-body", children: [
        quickConnectSection, hero, accountRow, accountChecking, accountCheckError, primaryFeedback, disconnectError,
        directAdvanced,
        alternatives,
      ] }),
    ],
  }) as HTMLDetailsElement;
  if (getAiConnectionStatus().kind !== "ready") addAccount.setAttribute("open", "");

  // 왼쪽 메뉴 다섯(2026-11-23 오너: 「왼쪽 사이드바에 메뉴를 여러 개 넣는 기존 안이 더 깔끔하다. 다 분배해라.」).
  // 예전 고급 시트(겹쳐 뜨는 두 번째 창)는 없앴다 — 모든 설정이 메뉴 하나씩에 놓인다.
  const panes = {
    account: settingsPane("account", [overview.accounts, addAccount]),
    model: settingsPane("model", [
      overview.current,
      qualitySection,
      settingsSection("roles", "역할별 모델", "필요할 때만 역할마다 모델을 직접 고르면 돼요.",
        [execution.element, advisor.element, vision.element, image.element, pixel.element]),
      settingsSection("specialists", "추가 모델 설정", "", [
        roleControls("writer"),
        el("p", { class: "ai-config-help ai-roles-help", text: "모델은 목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요." }),
        settingsRow("제공자별 품질 프리셋", "현재 역할의 제공자에 맞춰 모델과 추론 강도를 조정해요.",
          el("div", { class: "ai-settings-preset-actions", children: MODEL_PRESETS.map(preset => el("button", {
            class: "ai-settings-button",
            text: preset.label,
            attrs: { type: "button", title: preset.description },
            dataset: { testid: `ai-model-provider-preset-${preset.id}` },
            on: { click: () => applyProviderPreset(preset) },
          })) })),
      ]),
      roleMatrixSection,
    ]),
    work: settingsPane("work", [
      settingsSection("behavior", "자주 바꾸는 것", "", [applySwitch.row, dialoguePolish.row, imagePlan.row]),
      settingsSection("work", "작업 방식", "", [
        autonomyRow, applyRow, externalAgentRow, piTeam.row, imagePlanCountRow, maxTokens.row, reasoningRow, agentModeRow,
      ]),
      settingsSection("image", "그림 제공자", "", [imageSource.element]),
      ...(options.extraSections ?? []).map(section => settingsSection(section.id, section.title, section.description, [section.content])),
    ]),
    display: settingsPane("display", [
      settingsSection("display", "표시", "AI 패널의 읽기 환경과 화면 무게를 조정합니다.", [renderWeightRow, fontSizeRow, backgroundOpacityRow]),
    ]),
    usage: settingsPane("usage", [
      settingsSection("usage", "도구 사용량", "조수가 부른 도구를 횟수·실패·검색어로 보고, JSON으로 보낼 수 있습니다.", [usageContent]),
    ]),
  };
  type PaneId = keyof typeof panes;
  const tabs: Record<PaneId, HTMLButtonElement> = {
    account: settingsTab("account", "계정", "user", () => activatePane("account")),
    model: settingsTab("model", "모델", "spark", () => activatePane("model")),
    work: settingsTab("work", "작업", "gear", () => activatePane("work")),
    display: settingsTab("display", "표시", "eye", () => activatePane("display")),
    usage: settingsTab("usage", "사용량", "list", () => activatePane("usage")),
  };
  const rail = el("nav", {
    class: "ai-settings-rail",
    attrs: { "aria-label": "AI 설정 메뉴" },
    dataset: { testid: "ai-settings-rail" },
    children: Object.values(tabs),
  });
  const content = el("div", { class: "ai-settings-content", children: [...Object.values(panes), savedHint] });
  let activePane: PaneId = "account";
  function activatePane(id: PaneId): void {
    activePane = id;
    for (const key of Object.keys(panes) as PaneId[]) {
      panes[key].hidden = key !== id;
      if (key === id) tabs[key].setAttribute("aria-current", "page");
      else tabs[key].removeAttribute("aria-current");
    }
    if (id === "usage" && !usageContent.firstChild) usageContent.append(renderAiToolUsagePanel());
    content.scrollTop = 0;
  }
  const form = el("div", {
    class: "ai-config-form ai-settings-form",
    dataset: { testid: "ai-config" },
    children: [rail, content],
  });
  // 연결돼 있으면 지금 쓰는 모델부터, 아니면 계정 연결부터 보인다.
  activatePane(getAiConnectionStatus().kind === "ready" ? "model" : "account");

  syncModelDisplay();
  syncChatGptAccount();
  win?.addEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, syncChatGptAccount);
  const onEngineChanged = (): void => {
    syncModelDisplay();
    void refreshAiConnectionStatus();
  };
  win?.addEventListener?.(ASSISTANT_ENGINE_CHANGED_EVENT, onEngineChanged);

  return {
    element: form,
    dispose: () => {
      disposed = true;
      overview.dispose();
      localPrograms?.dispose();
      win?.removeEventListener?.(ASSISTANT_ENGINE_CHANGED_EVENT, onEngineChanged);
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, updateReadiness);
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, syncChatGptAccount);
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, reloadConnectedRoutes);
      win?.removeEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfigChanged);
      window.removeEventListener(OPENAI_COMPAT_CHANGED_EVENT, onCompatChanged);
      directSettings.dispose();
      compatSettings.dispose();
      routeStatusRequests.abort();
      if (autoSaveTimer !== null) {
        win?.clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
        persist(false);
      }
      authSettings.dispose();
    },
    focusFirstInput: () => tabs[activePane].focus(),
    focusApiKey: () => {
      directSettings.focusKey();
    },
  };
}

function settingsModelName(model: string): string {
  if (model === ASSISTANT_CHATGPT_MODEL || isLegacyTerraModel(model)) return "GPT-6.2 Sol";
  return PIXEL_MODEL_CHOICES.find(choice => choice.model === model)?.label ?? modelDisplayName(model).replace(/^GPT (?=\d)/u, "GPT-");
}

function rowCopy(title: string, description = ""): HTMLElement {
  return el("span", {
    class: "ai-settings-row-copy",
    children: [
      el("span", { text: title }),
      ...(description ? [el("small", { text: description })] : []),
    ],
  });
}

function chevron(): HTMLElement {
  return el("span", { class: "ai-settings-chevron", attrs: { "aria-hidden": "true" } });
}

function roleDetails(id: string, title: string, description: string, children: readonly HTMLElement[]) {
  const value = el("span", { class: "ai-settings-role-value" });
  const element = el("details", {
    class: "ai-settings-role-details",
    dataset: { testid: `ai-settings-model-${id}` },
    children: [
      el("summary", { class: "ai-settings-row", children: [rowCopy(title, description), value, chevron()] }),
      el("div", { class: "ai-settings-role-detail-body", children }),
    ],
  });
  return { element, value };
}

function settingsSwitch(testid: string, title: string, description: string, initial: boolean, onChange: (checked: boolean) => void) {
  const descriptionId = `${testid}-help`;
  const copy = rowCopy(title, description);
  copy.querySelector("small")?.setAttribute("id", descriptionId);
  const button = el("button", {
    class: "ai-settings-row ai-settings-row-button ai-settings-switch-row",
    attrs: { type: "button", role: "switch", "aria-checked": String(initial), "aria-label": title, "aria-describedby": descriptionId },
    dataset: { testid },
    children: [copy, el("span", { class: "ai-settings-switch", attrs: { "aria-hidden": "true" } })],
  });
  const checked = (): boolean => button.getAttribute("aria-checked") === "true";
  button.addEventListener("click", () => {
    const next = !checked();
    button.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return { row: button, checked };
}

function settingsTab(id: string, label: string, icon: Parameters<typeof deckIcon>[0], onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "ai-settings-tab",
    attrs: { type: "button", id: `ai-settings-tab-${id}`, "aria-controls": `ai-settings-pane-${id}` },
    dataset: { testid: `ai-settings-tab-${id}`, pane: id },
    children: [el("span", { class: "ai-settings-nav-icon", children: [deckIcon(icon, { size: 15 })] }), el("span", { text: label })],
    on: { click: onClick },
  });
}

function settingsPane(id: string, children: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "ai-settings-pane",
    attrs: { role: "region", id: `ai-settings-pane-${id}`, "aria-labelledby": `ai-settings-tab-${id}` },
    dataset: { testid: `ai-settings-pane-${id}`, pane: id },
    children,
  });
}

function settingsSection(
  id: string,
  title: string,
  description: string,
  children: readonly HTMLElement[],
): HTMLElement {
  return el("section", {
    class: `ai-settings-section ai-settings-section-${id}`,
    attrs: { "aria-labelledby": `ai-settings-${id}-title` },
    dataset: { testid: `ai-settings-section-${id}`, section: id },
    children: [
      el("header", {
        class: "ai-settings-section-header",
        children: [
          el("h3", { text: title, attrs: { id: `ai-settings-${id}-title` } }),
          ...(description ? [el("p", { text: description })] : []),
        ],
      }),
      el("div", { class: "ai-settings-section-body", children }),
    ],
  });
}

/** 카드 안 「자세히」 — 고른 뒤에 읽는 안내 문단을 접는다. 문자열은 문단으로 감싸고 요소는 그대로 넣는다. */
function settingsDetails(items: ReadonlyArray<string | HTMLElement>): HTMLElement {
  return el("details", {
    class: "ai-settings-subdetails ai-card-details",
    children: [
      el("summary", { text: "자세히" }),
      el("div", { class: "ai-card-details-body", children: items.map((item) =>
        typeof item === "string" ? el("p", { class: "ai-config-help", text: item }) : item) }),
    ],
  });
}

function settingsRow(label: string, description: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "ai-config-row",
    children: [
      el("span", { class: "ai-config-row-copy", children: [
        el("span", { class: "ai-config-label", text: label }),
        ...(description ? [el("span", { class: "ai-config-help", text: description })] : []),
      ] }),
      el("span", { class: "ai-config-control", children: [control] }),
    ],
  });
}

function textField(
  label: string,
  description: string,
  value: string,
  testid: string,
  type = "text",
  placeholder = ""
): { row: HTMLElement; input: HTMLInputElement } {
  const input = el("input", {
    class: "ai-config-input",
    attrs: placeholder ? { type, placeholder } : { type },
    value,
    dataset: { testid },
  }) as HTMLInputElement;
  const row = settingsRow(label, description, input);
  return { row, input };
}

function modelField(
  label: string,
  value: string,
  inputTestid: string,
  presetTestid: string,
  authMode: AiConfig["authMode"],
  placeholder: string,
  providerId?: string,
): {
  /** 프리셋 셀렉트 + 입력 칸 묶음 — 역할 표의 「모델」 셀에 들어간다. */
  control: HTMLElement;
  warning: HTMLElement;
  input: HTMLInputElement;
  preset: HTMLSelectElement;
  refresh: (mode: AiConfig["authMode"], providerId?: string) => void;
  validate: (mode: AiConfig["authMode"], providerId?: string) => boolean;
  setValue: (value: string, mode: AiConfig["authMode"], providerId?: string) => void;
} {
  const input = el("input", {
    class: "ai-config-input",
    attrs: { type: "text", placeholder, "aria-label": label },
    value,
    dataset: { testid: inputTestid },
  }) as HTMLInputElement;
  const preset = el("select", {
    class: "ai-config-select ai-model-preset",
    dataset: { testid: presetTestid },
    attrs: { "aria-label": `${label} 추천 모델` },
  }) as HTMLSelectElement;
  // 무효 모델 경고. 스타일은 styles/shell/dialogs/ai-settings-modal.css 의 .ai-model-warning 이 맡는다
  // (예전에는 이 파일이 CSS 를 편집할 수 없다는 이유로 색·크기를 인라인 style 로 칠했다 —
  //  테마를 따라가지 못하는 값이었다).
  const warning = el("div", {
    class: "ai-model-warning",
    attrs: { hidden: "", role: "alert" },
    dataset: { testid: `${inputTestid}-warning` },
  });
  const refresh = (nextMode: AiConfig["authMode"], providerId?: string): void => {
    const groups = modelCatalogForAuthMode(nextMode, providerId);
    const options = [
      el("option", { attrs: { value: "" }, text: "목록에서 모델 고르기" }),
      ...groups.map((group) => el("optgroup", {
        attrs: { label: group.label },
        children: group.models.filter(model => !isLegacyTerraModel(model))
          .map(model => el("option", { attrs: { value: model }, text: model })),
      })),
    ];
    preset.replaceChildren(...options);
    preset.value = groups.some((group) => group.models.includes(input.value)) ? input.value : "";
  };
  // 현재 입력값이 해당 authMode 에서 유효한지 판정하고, 무효하면 경고 문구를 보여준다.
  // 유효하면 경고를 숨긴다. true = 유효.
  const validate = (mode: AiConfig["authMode"], providerId?: string): boolean => {
    const value = input.value.trim();
    if (isLegacyTerraModel(value)) {
      input.value = ASSISTANT_CHATGPT_MODEL;
      preset.value = ASSISTANT_CHATGPT_MODEL;
      preset.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (isModelValidForAuthMode(mode, input.value.trim(), providerId)) {
      warning.hidden = true;
      warning.textContent = "";
      return true;
    }
    warning.hidden = false;
    // 옛 문구는 "gpt- 로 시작하는 모델만" 이라고 했지만 검사는 접두사가 아니라 **정확한 카탈로그
    // 소속**이다(modelCatalog.isModelValidForAuthMode). 그래서 gpt-5.1-codex-max 처럼 gpt- 로
    // 시작하는데도 거부되는 ID 에 "gpt- 는 괜찮다"고 안내하는 모순이 있었다. 게다가 remedy 로
    // 제시한 "연결 방식을 API/게이트웨이로 바꾸세요" 는 이제 존재하지 않는 경로다.
    const blockReason = providerId ? openAiCompatModelBlockReason(providerId, value) : null;
    if (blockReason) {
      warning.replaceChildren(document.createTextNode(blockReason), " ", el("span", { text: "다른 모델로 자동 대체하지 않습니다." }));
    } else {
      warning.textContent = "현재 제공자에서 지원을 확인하지 못한 모델입니다. 다른 모델로 자동 대체하지 않습니다.";
    }
    return false;
  };
  // 값을 바꾸는 공개 수단. input.value 직접 대입은 드롭다운 하이라이트와 경고 표시가 어긋난다.
  // setValue 는 입력값 교체 → 드롭다운 동기화 → 경고 재평가를 한꺼번에 처리한다.
  // (authMode 전환 시 무효 모델을 권장 기본으로 교정할 때 이 setter 를 쓴다.)
  // mode 를 인자로 받는 이유: 이 함수의 authMode 매개변수는 생성 시점 초기값이라 전환 후엔
  // stale 하다 — 호출 쪽이 현재 authMode 를 넘겨야 경고가 올바른 기준으로 재평가된다.
  const setValue = (value: string, mode: AiConfig["authMode"], providerId?: string): void => {
    input.value = value;
    preset.value = value;
    validate(mode, providerId);
  };
  const control = el("div", {
    class: "ai-model-control",
    attrs: { title: `${label} — 목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요.` },
    children: [preset, input],
  });
  refresh(authMode, providerId);
  return { control, warning, input, preset, refresh, validate, setValue };
}

/**
 * 역할 표의 제공자 선택지를 채운다 — 로그인 제공자 둘 뒤에 사용자 지정 엔드포인트가 이어진다.
 * 저장돼 있는데 목록에 없는 값(지운 엔드포인트)은 그대로 보여 준다: 말없이 다른 제공자로 바꾸지 않고, 요청 시점에 「없는 엔드포인트」 오류가 말한다.
 */
function fillProviderOptions(select: HTMLSelectElement, current: string): void {
  const rows: OhMyPiProvider[] = [...selectableOhMyPiProviders()];
  if (current && !rows.some((row) => row.id === current)) {
    const row = getOhMyPiProvider(current);
    rows.push(row ? { ...row, label: `${row.label} (지워짐)` } : { id: current, label: current, defaultModel: "", envVars: [], authKind: "apiKey" });
  }
  select.replaceChildren(...rows.map((row) => el("option", { attrs: { value: row.id }, text: row.label })));
  select.value = current;
}
