import { PI_APPLY_MODES, normalizePiApplyMode } from "@/ai/piAgent/applyMode";
import { modelForRole, type RoleModel } from "@/ai/modelRoles";
import { PIXEL_MODEL_CHOICES, resolvePixelModel } from "@/ai/pixelModel";
// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.
import { formatEditorDate } from "@/i18n";

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
import { CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
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
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { installAiModalFocus } from "./aiModalFocus";
import { el } from "@/util/dom";
import { dismissToastsByKey, toast } from "@/util/toast";

const INVALID_MODEL_TOAST_KEY = Symbol("ai-settings-invalid-model");
import { renderAiAuthSettings, type AiAuthStatusSnapshot } from "./aiAuthSettings";
import { renderAiCompatSettings, type AiCompatRoleSlot } from "./aiCompatSettings";
import { renderAiToolUsagePanel } from "./aiToolUsagePanel";
import { fetchConnectedRoutes, renderAiRoleMatrixSettings } from "./aiRoleMatrixSettings";
import { localCliOfProvider } from "@/ai/localCliEngine";
import { saveEngineChoice } from "@/start/settings/localAgents";
import { deckIcon } from "./aiDeckIcons";
import { installEventEditorCustomSelects } from "./eventEditor/customSelect";

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
    onContinue: () => closeAiSettingsModal(),
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
    ...(extraSections ? { extraSections } : {}),
  });

  const closeButton = el("button", {
    class: "database-modal-close",
    children: [deckIcon("x")],
    attrs: { type: "button", "aria-label": "설정 닫기" },
    dataset: { testid: "ai-settings-close" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop ai-settings-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-settings-modal" },
    children: [
      el("section", {
        class: "database-modal-window ai-settings-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "AI 설정" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [
              // 닫기 버튼이 DOM 첫 포커스 대상이다 — Tab 경계 계약(첫 탭 정지 = 닫기)을 지킨다.
              // 화면상 위치는 flex `order` 로 여전히 오른쪽 끝이다.
              closeButton,
              el("div", {
                class: "ai-settings-titleblock",
                children: [
                  el("h2", { text: "AI 설정" }),
                  el("div", {
                    class: "ai-settings-subtitle",
                    children: [form.connectionSummary, form.connectionCheckButton],
                  }),
                ],
              }),
            ],
          }),
          el("div", {
            class: "database-modal-body ai-settings-body",
            dataset: { testid: "ai-settings-body" },
            children: [form.element],
          }),
        ],
      }),
    ],
  });

  // 네이티브 select 는 이 모달에서 OS 크롬 그대로 떠서 주변 카드·입력과 어긋났다. 이벤트
  // 편집기와 같은 커스텀 리스트박스로 올린다 — 네이티브 요소는 값·change 원천으로 남는다.
  const customSelects = installEventEditorCustomSelects(backdrop);
  const restoreFocus = installAiModalFocus(backdrop);

  const close = registerModal(backdrop, () => {
    // 인증 패널은 기기 로그인 폴링 타이머를 들고 있다 — 정리하지 않으면 모달이 닫힌 뒤에도
    // /auth/status 를 3초마다 계속 때린다.
    customSelects.dispose();
    form.dispose();
    backdrop.remove();
    if (activeAiSettingsClose === close) activeAiSettingsClose = null;
    restoreFocus();
    notifyAiSettingsClosed();
  });
  activeAiSettingsClose = close;
  closeButton.addEventListener("click", close);
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
  readonly onSaved?: (config: AiConfig) => void;
  readonly onBackgroundOpacityChange?: (value: number) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  readonly extraSections?: readonly AiSettingsExtraSection[];
}): {
  element: HTMLElement;
  /** 모달 헤더 아래 붙는 연결 상태 요약줄(폼 밖 조립 — 탭 전환과 무관하게 항상 보인다). */
  connectionSummary: HTMLElement;
  connectionCheckButton: HTMLElement;
  focusFirstInput: () => void;
  focusApiKey: () => void;
  dispose: () => void;
} {
  const onSaved = options.onSaved ?? (() => undefined);
  const onFontSizeChange = options.onFontSizeChange ?? (() => undefined);
  const config = loadAiConfig();
  let authMode = config.authMode;
  let providerId = parseOhMyPiProvider(config.providerId);
  let modelSelectionOverrides = { ...config.modelSelectionOverrides };
  let applyAccountSelection = (_force = false): void => undefined;
  const imageProvider = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "이미지 생성 제공자" },
    dataset: { testid: "ai-config-image-provider" },
    children: [...new Map(IMAGE_MODEL_CATALOG.map((entry) => [entry.providerId, entry.providerLabel]))]
      .map(([id, label]) => el("option", { attrs: { value: id }, text: label })),
  }) as HTMLSelectElement;
  const initialImageProvider = config.imageProviderId ?? DEFAULT_IMAGE_PROVIDER_ID;
  if (!IMAGE_MODEL_CATALOG.some((entry) => entry.providerId === initialImageProvider)) {
    imageProvider.append(el("option", { attrs: { value: initialImageProvider, disabled: "" }, text: initialImageProvider + " · 지원 미확인" }));
  }
  imageProvider.value = initialImageProvider;
  const imageModel = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "이미지 생성 모델", "aria-describedby": "ai-config-image-status" },
    dataset: { testid: "ai-config-image-model" },
  }) as HTMLSelectElement;
  const imageStatus = el("p", {
    class: "ai-config-help ai-card-status",
    attrs: { id: "ai-config-image-status", role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-config-image-status" },
  });
  // 로그인·제공 방식처럼 «고른 뒤에 읽는» 문단은 카드 안 「자세히」 로 접는다. 항상 보이는 줄은 상태 한 줄뿐이다.
  const imageRouteNote = el("p", { class: "ai-config-help", dataset: { testid: "ai-config-image-route-note" } });
  // 그림은 GPT 를 강력히 추천한다(감독 지시 2026-09-27). 추천은 GPT 가 아닐 때만 한 줄로 보이고, 바꾸는 버튼이 곁에 붙는다 —
  // 이미 GPT 면 말할 것이 없으므로 숨는다(예전 상자형 배너는 로그인 안내와 같은 상자 모양이라 겹쳐 보였다).
  const recommendedImage = IMAGE_MODEL_CATALOG.find((entry) => entry.providerId === CODEX_PROVIDER_ID && entry.supported);
  const useRecommendedImage = el("button", {
    class: "ai-assistant-action ai-config-recommend-action",
    text: "GPT로 바꾸기",
    attrs: { type: "button" },
    dataset: { testid: "ai-config-image-use-gpt" },
  }) as HTMLButtonElement;
  const imageRecommendation = el("div", {
    class: "ai-config-recommend",
    attrs: { role: "note" },
    dataset: { testid: "ai-config-image-recommend" },
    children: [
      el("p", {
        class: "ai-config-recommend-text",
        text: "GPT 이미지 모델을 권장합니다. 앵글·초점 지시를 더 잘 지키고 해상도도 높습니다.",
      }),
      useRecommendedImage,
    ],
  });
  const refreshImageRecommendation = (): void => {
    const onGpt = imageProvider.value === CODEX_PROVIDER_ID;
    imageRecommendation.dataset.state = onGpt ? "active" : "suggest";
    imageRecommendation.hidden = onGpt || !recommendedImage;
    useRecommendedImage.hidden = onGpt || !recommendedImage;
  };
  const refreshImageStatus = (): void => {
    refreshImageRecommendation();
    const entry = IMAGE_MODEL_CATALOG.find((entry) => entry.providerId === imageProvider.value && entry.model === imageModel.value);
    imageStatus.dataset.availability = entry?.supported ? "supported" : "unsupported";
    imageStatus.textContent = entry?.supported
      ? `${entry.providerLabel} 로그인이 필요합니다.`
      : "이 이미지 경로는 현재 미지원 또는 검증 전입니다. 저장된 선택은 유지하며 다른 모델로 자동 전환하지 않습니다.";
    const routeNote = entry?.supported && entry.providerId !== DEFAULT_IMAGE_PROVIDER_ID
      ? "god-tibo-imagen 경로(Codex 응답 API의 그림 도구)로 생성합니다. 참조 그림을 2장까지 함께 보낼 수 있습니다. 앱에 Codex 로그인이 없으면 codex CLI 로그인(~/.codex/auth.json)을 씁니다."
      : "";
    imageRouteNote.textContent = routeNote;
    imageRouteNote.hidden = routeNote === "";
  };
  const refreshImageModels = (selected: string): void => {
    const entries = IMAGE_MODEL_CATALOG.filter((entry) => entry.providerId === imageProvider.value);
    imageModel.replaceChildren(...entries.map((entry) => el("option", {
      attrs: { value: entry.model, ...(!entry.supported ? { disabled: "" } : {}) }, text: entry.label,
    })));
    if (!entries.some((entry) => entry.model === selected)) {
      imageModel.append(el("option", { attrs: { value: selected, disabled: "" }, text: selected + " · 지원 미확인" }));
    }
    imageModel.value = selected;
    imageModel.dispatchEvent(new Event("input", { bubbles: true }));
    refreshImageStatus();
  };
  refreshImageModels(config.imageModel ?? DEFAULT_IMAGE_MODEL);

  // 추론 강도 옵션은 영어 enum 을 그대로 보여 주지 않는다 — 영역 작업 추론 셀렉트와 같은 한국어 라벨.
  const EFFORT_LABEL: Record<string, string> = { off: "끔", low: "낮음", medium: "보통", high: "높음" };
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
    children: ["off", "low", "medium", "high"].map(value => el("option", { attrs: { value }, text: EFFORT_LABEL[value] })),
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
  const model = modelField("Writer 모델", modelForRole(config, "writer").model, "ai-config-model", "ai-config-model-preset", authMode, DEFAULT_MODEL, providerId);
  const liteModel = modelField(
    "Deep 모델",
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
    attrs: { "aria-label": "Ultrabrain 제공자" },
  }) as HTMLSelectElement;
  fillProviderOptions(brainProvider, brainConfig.providerId!);
  brainProvider.value = brainConfig.providerId!;
  const brainModel = modelField("Ultrabrain 모델", brainConfig.model,
    "ai-config-ultrabrain-model", "ai-config-ultrabrain-model-preset", authMode, DEFAULT_ULTRABRAIN_MODEL, brainProvider.value);
  const brainEffort = el("select", {
    class: "ai-config-select", dataset: { testid: "ai-config-ultrabrain-reasoning" },
    attrs: { "aria-label": "Ultrabrain 추론" },
    children: ["low", "medium", "high"].map(value => el("option", { attrs: { value }, text: EFFORT_LABEL[value] })),
  }) as HTMLSelectElement;
  brainEffort.value = brainConfig.reasoningEffort!;
  const specialistControls = (["vision", "writer", "deep", "build"] as const).map(role => {
    const selected = modelForRole(config, role);
    const provider = el("select", { class: "ai-config-select", dataset: { testid: `ai-config-${role}-provider` },
      attrs: { "aria-label": `${role} 제공자` },
    }) as HTMLSelectElement;
    fillProviderOptions(provider, selected.provider);
    provider.value = selected.provider;
    const field = role === "writer" ? model : role === "deep" ? liteModel
      : role === "build" ? modelField("시공 모델", selected.model, "ai-config-build-model", "ai-config-build-model-preset", authMode, selected.model, selected.provider)
      : modelField("Vision 모델", selected.model, "ai-config-vision-model", "ai-config-vision-model-preset", authMode, selected.model, selected.provider);
    field.refresh(authMode, selected.provider);
    const effort = el("select", { class: "ai-config-select", dataset: { testid: `ai-config-${role}-reasoning` },
      attrs: { "aria-label": `${role} 추론 강도` },
      children: ["off", "low", "medium", "high"].map(value => el("option", { attrs: { value }, text: EFFORT_LABEL[value] })),
    }) as HTMLSelectElement;
    effort.value = selected.thinkingLevel;
    return { role, provider, field, effort };
  });
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
  const authSettings = renderAiAuthSettings(config, ({ providerId: next }) => {
    providerId = next;
    applyAccountSelection();
    persistAuthMode();
  }, (next) => {
    lastAuthStatus = next;
    pendingAuthStatus?.(next);
  });
  // 「사용자 지정 (OpenAI 호환)」 카드 — 로그인 카드 아래 같은 연결 탭에 둔다. 역할 칸에 꽂는 일은 아래 assignCompatRole 이 한다.
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
  const autonomyDescription = "계획만 제안할지 직접 작업할지와 작업 예산을 조정합니다. 대화 조수의 실행 단계는 이 다이얼의 추론 강도를 쓰고, 아래 역할 표에서 Deep 추론을 기본값(낮음)과 다르게 저장했으면 그 값이 이깁니다.";
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
    children: [
      el("option", { attrs: { value: "off" }, text: "끔" }),
      el("option", { attrs: { value: "low" }, text: "낮음" }),
      el("option", { attrs: { value: "medium" }, text: "보통" }),
      el("option", { attrs: { value: "high" }, text: "높음" }),
    ],
  }) as HTMLSelectElement;
  reasoningSelect.value = config.reasoningEffort ?? "medium";
  const reasoningDescription = "기존 영역 작업 경로의 추론 설정입니다. 대화 조수의 실행 단계는 위 다이얼(자율성)의 추론 강도를 쓰므로, 아래 역할 표에서 Deep 추론을 기본값(낮음)과 다르게 저장한 경우에만 그 값이 우선합니다.";
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
    children: [
      ...PI_APPLY_MODES.map(mode => el("option", { attrs: { value: mode.id, title: mode.description }, text: mode.label })),
    ],
  }) as HTMLSelectElement;
  piApplySelect.value = config.piApply ?? DEFAULT_PI_APPLY;
  piApplySelect.addEventListener("change", () => persist(false));
  // 완성 뒤 대사 윤문(src/ai/piAgent/dialoguePolishHook.ts) — 기본 켬. 끄면 요청에 dialoguePolish:false 가 실린다.
  const dialoguePolishSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-dialogue-polish" },
    children: [
      el("option", { attrs: { value: "on" }, text: "켬" }),
      el("option", { attrs: { value: "off" }, text: "끔" }),
    ],
  }) as HTMLSelectElement;
  dialoguePolishSelect.value = config.dialoguePolishAfterBuild === false ? "off" : "on";
  dialoguePolishSelect.addEventListener("change", () => persist(false));
  const dialoguePolishRow = settingsRow("완성 뒤 대사 윤문", "게임을 다 지으면 새로 쓴 대사·설명을 윤문 규칙(general-good-writing)으로 검사하고, 걸린 줄을 조수가 한 번 더 다듬습니다. 직접 쓴 대사는 바꾸지 않고 「대사」 탭 제안으로 남깁니다.", dialoguePolishSelect);
  const piApplyRow = settingsRow("결과 적용", "「바로 반영」 셋은 실제 맵을 실시간으로 편집합니다. 검토 후 적용·단계별 적용은 승인 전까지 초안으로 남습니다.", piApplySelect);
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
    text: "변경 사항은 자동으로 저장됩니다.",
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
  let roleMatrix: ReturnType<typeof renderAiRoleMatrixSettings> | undefined;
  const collect = (): AiConfig => ({
    authMode,
    providerId,
    modelSelectionOverrides,
    roleModels: withoutBuildEqualToDeep(Object.fromEntries(specialistControls.map(({ role, provider, field, effort }) => [role, {
      provider: provider.value, model: field.input.value.trim() || modelForRole(config, role).model,
      thinkingLevel: effort.value as RoleModel["thinkingLevel"],
    }]))),
    ultrabrainProviderId: brainProvider.value,
    ultrabrainModel: brainModel.input.value.trim() || DEFAULT_ULTRABRAIN_MODEL,
    ultrabrainReasoningEffort: brainEffort.value as AiConfig["ultrabrainReasoningEffort"],
    imageProviderId: imageProvider.value,
    imageModel: imageModel.value,
    // 도트 저작 칸: 「따라가기」면 저장하지 않는다(옛 동작 유지). 고른 값만 저장하고 고른 표시를 남긴다.
    ...(pixelModelSelect.value === PIXEL_FOLLOW ? {} : (() => {
      const [provider, model] = pixelModelSelect.value.split("::");
      return { pixelModel: { provider, model, thinkingLevel: pixelEffort.value as RoleModel["thinkingLevel"] } };
    })()),
    // 에디터는 동반 서비스 전송만 쓴다 — baseUrl 은 endpoint() 가 무시하고, 키는 동반 서비스가
    // 들고 있다. 여기서 빈 값으로 고정해 브라우저 저장소에 비밀·죽은 주소가 남지 않게 한다.
    baseUrl: DEFAULT_BASE_URL,
    model: model.input.value.trim() || DEFAULT_MODEL,
    liteModel: liteModel.input.value.trim() || DEFAULT_LITE_MODEL,
    apiKey: "",
    maxToolCalls: defaultAiConfig().maxToolCalls,
    maxTokens: Math.max(256, Number(maxTokens.input.value) || defaultAiConfig().maxTokens),
    reasoningEffort: (reasoningSelect.value as AiConfig["reasoningEffort"]) || "medium",
    agentMode: agentModeSelect.value === "chat" ? "chat" : "auto",
    autonomyLevel: isAutonomyLevel(autonomySelect.value) ? autonomySelect.value : "balanced",
    piTeam: config.piTeam ?? DEFAULT_PI_TEAM,
    piApply: normalizePiApplyMode(piApplySelect.value),
    ...(dialoguePolishSelect.value === "off" ? { dialoguePolishAfterBuild: false } : {}),
    ...roleMatrixSlots(),
  });
  // 역할 배정 표(잔일·검토자) — 표가 아직 없으면(첫 collect) 저장값을 그대로 둔다.
  function roleMatrixSlots(): Pick<AiConfig, "assistantRoles"> {
    if (!roleMatrix) return config.assistantRoles ? { assistantRoles: config.assistantRoles } : {};
    const picked = roleMatrix.collect();
    for (const role of ["smol", "advisor"] as const) {
      if (picked.pinned[role]) modelSelectionOverrides[role] = true;
      else delete modelSelectionOverrides[role];
    }
    return { assistantRoles: picked.assistantRoles };
  }

  /** 연결 카드의 「이 역할에 쓰기」 — 그 역할 칸만 이 엔드포인트·모델로 바꾸고 직접 지정으로 표시한다(다른 칸·기본 제공자는 그대로). */
  const assignCompatRole = (slot: AiCompatRoleSlot, endpointId: string, endpointModel: string): void => {
    if (slot === "ultrabrain") {
      fillProviderOptions(brainProvider, endpointId);
      brainProvider.value = endpointId;
      brainModel.refresh(authMode, endpointId);
      brainModel.setValue(endpointModel, authMode, endpointId);
      brainProvider.dispatchEvent(new Event("input", { bubbles: true }));
      modelSelectionOverrides.ultrabrain = true;
    } else {
      const control = specialistControls.find((entry) => entry.role === slot);
      if (!control) return;
      fillProviderOptions(control.provider, endpointId);
      control.provider.value = endpointId;
      control.field.refresh(authMode, endpointId);
      control.field.setValue(endpointModel, authMode, endpointId);
      control.provider.dispatchEvent(new Event("input", { bubbles: true }));
      control.field.preset.dispatchEvent(new Event("input", { bubbles: true }));
      modelSelectionOverrides[slot] = true;
    }
    persist(false);
    updateReadiness();
    void refreshAiConnectionStatus(updateReadiness);
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
    const next = collect();
    // Keep the selection; unsupported models are shown here and rejected by the companion.
    const modelValid = specialistControls.map(c => c.field.validate(authMode, c.provider.value)).every(Boolean);
    const liteValid = true;
    const brainValid = brainModel.validate(authMode, brainProvider.value);
    saveAiConfig(next);
    onSaved(next);
    savedHint.textContent = savedAtText();
    syncModelPresetCards();
    // 자동 저장마다 같은 경고가 쌓이지 않도록 이전 경고를 걷고 하나만 남긴다.
    dismissToastsByKey(INVALID_MODEL_TOAST_KEY);
    if (!modelValid || !liteValid || !brainValid) {
      toast("선택한 모델이 현재 연결 방식에서 쓸 수 없습니다. 모델 입력 아래 경고를 확인하세요.", {
        kind: "error",
        key: INVALID_MODEL_TOAST_KEY,
      });
    } else if (showToast) {
      toast("어시스턴트 설정을 저장했습니다.", "ok");
    }
  };
  persistAuthMode = () => persist(false);
  applyAccountSelection = (force = false) => {
    const next = configForProviderSelection(collect(), providerId, force);
    modelSelectionOverrides = { ...next.modelSelectionOverrides };
    for (const c of specialistControls) {
      const selected = modelForRole(next, c.role);
      c.provider.value = selected.provider;
      c.field.refresh(authMode, selected.provider);
      c.field.setValue(selected.model, authMode, selected.provider);
      c.provider.dispatchEvent(new Event("input", { bubbles: true }));
      c.field.preset.dispatchEvent(new Event("input", { bubbles: true }));
    }
    brainProvider.value = next.ultrabrainProviderId!;
    brainModel.refresh(authMode, brainProvider.value);
    brainModel.setValue(next.ultrabrainModel!, authMode, brainProvider.value);
    brainProvider.dispatchEvent(new Event("input", { bubbles: true }));
    brainModel.preset.dispatchEvent(new Event("input", { bubbles: true }));
    imageProvider.value = next.imageProviderId!;
    imageProvider.dispatchEvent(new Event("input", { bubbles: true }));
    refreshImageModels(next.imageModel!);
  };
  imageProvider.addEventListener("change", () => {
    modelSelectionOverrides.image = true;
    const entries = IMAGE_MODEL_CATALOG.filter((entry) => entry.providerId === imageProvider.value);
    const chosen = entries.find((entry) => entry.supported) ?? entries[0];
    if (!chosen) {
      refreshImageStatus();
      return;
    }
    refreshImageModels(chosen.model);
    persist(false);
  });
  imageModel.addEventListener("change", () => {
    modelSelectionOverrides.image = true;
    refreshImageStatus();
    persist(false);
  });
  useRecommendedImage.addEventListener("click", () => {
    if (!recommendedImage) return;
    modelSelectionOverrides.image = true;
    imageProvider.value = recommendedImage.providerId;
    refreshImageModels(recommendedImage.model);
    persist(false);
  });
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
  for (const { role, field } of specialistControls) {
    for (const event of ["input", "change"]) field.input.addEventListener(event, () => { modelSelectionOverrides[role] = true; });
  }
  for (const event of ["input", "change"]) brainModel.input.addEventListener(event, () => { modelSelectionOverrides.ultrabrain = true; });
  for (const field of [...specialistControls.map(c => c.field), brainModel, maxTokens]) {
    field.input.addEventListener("input", scheduleAutoSave);
    field.input.addEventListener("change", () => persist(false));
  }
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
  for (const { role, provider, field, effort } of specialistControls) {
    provider.addEventListener("change", () => {
      modelSelectionOverrides[role] = true;
      alignModelToProvider(field, provider.value, "fast");
      persist(false);
    });
    field.input.addEventListener("input", () => field.validate(authMode, provider.value));
    field.preset.addEventListener("change", () => {
      modelSelectionOverrides[role] = true;
      if (field.preset.value) field.setValue(field.preset.value, authMode, provider.value);
      persist(false);
    });
    effort.addEventListener("change", () => { modelSelectionOverrides[role] = true; persist(false); });
  }
  brainProvider.addEventListener("change", () => {
    modelSelectionOverrides.ultrabrain = true;
    alignModelToProvider(brainModel, brainProvider.value, "strong");
    persist(false);
  });
  brainModel.input.addEventListener("input", () => brainModel.validate(authMode, brainProvider.value));
  brainModel.preset.addEventListener("change", () => {
    modelSelectionOverrides.ultrabrain = true;
    if (brainModel.preset.value) brainModel.setValue(brainModel.preset.value, authMode, brainProvider.value);
    persist(false);
  });
  brainEffort.addEventListener("change", () => { modelSelectionOverrides.ultrabrain = true; persist(false); });
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
    class: "ai-assistant-action",
    text: "완료",
    attrs: { type: "button" },
    dataset: { testid: "ai-settings-continue" },
  }) as HTMLButtonElement;
  const modelConnectionHint = el("p", {
    class: "ai-config-help",
    dataset: { testid: "ai-settings-work-accounts" },
  });
  const alignAccountButton = el("button", {
    class: "ai-assistant-action",
    text: "이 계정으로 작업 모델 맞추기",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-settings-align-account" },
  }) as HTMLButtonElement;
  const updateReadiness = (): void => {
    const next = lastAuthStatus;
    if (!next) return;
    const current = collect();
    const workAccounts = workProviderIds(current);
    const mixed = workAccounts.some(id => id !== providerId);
    alignAccountButton.hidden = !mixed;
    modelConnectionHint.textContent = mixed
      ? "직접 지정한 작업 모델은 유지됩니다. 다른 계정을 쓰는 모델이 있으면 그 계정도 연결하세요."
      : "작업 모델은 선택한 계정을 사용합니다. 연결을 마치면 바로 시작할 수 있어요.";
    const status = getAiConnectionStatus(current);
    const valid = specialistControls.map(c => c.field.validate(authMode, c.provider.value)).every(Boolean)
      && brainModel.validate(authMode, brainProvider.value);
    const usable = next.tone === "connected" && status.kind === "ready" && !status.limited && valid;
    continueButton.classList.toggle("is-primary", usable);
    connectionSummary.dataset.tone = SUMMARY_TONE[next.tone];
    connectionSummaryCopy.textContent = `${next.providerLabel} · ${next.text}`;
    if (next.tone === "connected") {
      connectionSummary.dataset.tone = usable ? "ready" : "warning";
      connectionSummaryCopy.textContent = !valid ? "작업 모델을 확인하세요. 모델 탭에서 지원되는 모델을 선택하세요."
        : status.kind === "ready" && !status.limited ? `${next.providerLabel} · 사용 준비됨` : status.label;
    }
    // 「연결 확인」을 누른 뒤에는 결과를 같은 상태 줄(aria-live)에 시각과 함께 말한다(C-67).
    if (checkRequestedAt !== null) {
      connectionSummaryCopy.textContent = `${connectionSummaryCopy.textContent} · ${formatEditorDate(checkRequestedAt, { hour: "2-digit", minute: "2-digit" })} 확인함`;
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
  roleMatrix = renderAiRoleMatrixSettings(() => persist(false), (recommended) => {
    // 로컬 CLI 추천(Claude 가 연결돼 있으면 Opus 5.5 medium)은 조수 엔진 선택으로 넣는다 — 그래야 실제 실행이 그 모델로 간다.
    const cli = localCliOfProvider(recommended.provider);
    if (cli) {
      saveEngineChoice({ kind: "local-cli", cli, routineModel: recommended.model, deepModel: recommended.model, effort: recommended.thinkingLevel === "low" || recommended.thinkingLevel === "high" ? recommended.thinkingLevel : "medium" });
      toast(`조수 엔진을 ${recommended.model} (${recommended.thinkingLevel})로 맞췄습니다.`, "ok");
    } else {
      saveEngineChoice(null);
      for (const c of specialistControls.filter((entry) => entry.role === "deep" || entry.role === "build")) {
        fillProviderOptions(c.provider, recommended.provider);
        c.provider.value = recommended.provider;
        c.field.refresh(authMode, recommended.provider);
        c.field.setValue(recommended.model, authMode, recommended.provider);
        c.effort.value = recommended.thinkingLevel;
        modelSelectionOverrides[c.role] = true;
      }
      persist(false);
    }
    refreshRoleMatrix();
  });
  let connectedRoutes: Awaited<ReturnType<typeof fetchConnectedRoutes>> = [];
  const refreshRoleMatrix = (): void => roleMatrix?.refresh(collect(), connectedRoutes);
  const reloadConnectedRoutes = (): void => {
    // 응답이 문서가 걷힌 뒤(모달 닫힘·테스트 정리) 오면 다시 그리지 않는다.
    void fetchConnectedRoutes().then((routes) => { connectedRoutes = routes; if (typeof document !== "undefined") refreshRoleMatrix(); }, () => undefined);
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
  if (lastAuthStatus) pendingAuthStatus(lastAuthStatus);
  const connectionCheckButton = el("button", {
    class: "ai-assistant-action ai-settings-check",
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

  // 「지금 저장」버튼은 없다 — 모든 변경 경로가 persist 를 태우고 푸터는 자동 저장 상태만
  // 보여 준다. 수동 버튼이 있으면 "자동 저장이 안 되나?" 라는 혼란만 낳는다(리디자인 계약).

  // ── 모델 품질 프리셋 ──────────────────────────────────────────────────────
  // 역할 4개 × 컨트롤 3개를 상시 노출하는 대신 상위 의도(빠르게/균형/최고 품질)를 먼저 고르게
  // 한다. 프리셋 카드는 역할 컨트롤 각각을 채우는 지름길이고, 역할 컨트롤을 손대면 일치하는
  // 프리셋이 없어져 카드 체크가 자연스럽게 풀린다.
  const presetCards = new Map<ModelPreset["id"], HTMLButtonElement>();
  const presetGroup = el("div", {
    class: "ai-model-presets",
    attrs: { role: "radiogroup", "aria-label": "모델 품질 프리셋" },
    dataset: { testid: "ai-model-presets" },
    children: MODEL_PRESETS.map((preset) => {
      const card = el("button", {
        class: "ai-model-preset-card",
        attrs: { type: "button", role: "radio", "aria-checked": "false", tabindex: "-1" },
        dataset: { testid: `ai-model-preset-${preset.id}` },
        children: [
          el("strong", { text: preset.label }),
          el("small", { text: preset.description }),
          el("span", {
            class: "ai-model-preset-check",
            attrs: { "aria-hidden": "true" },
            children: [deckIcon("check", { size: 15 })],
          }),
        ],
      }) as HTMLButtonElement;
      card.addEventListener("click", () => applyModelPreset(preset));
      presetCards.set(preset.id, card);
      return card;
    }),
  });
  presetGroup.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;
    event.preventDefault();
    const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
    const index = MODEL_PRESETS.findIndex((preset) => presetCards.get(preset.id)?.getAttribute("aria-checked") === "true");
    const next = MODEL_PRESETS[(index < 0 ? 0 : index + delta + MODEL_PRESETS.length) % MODEL_PRESETS.length];
    presetCards.get(next.id)?.focus();
    applyModelPreset(next);
  });

  /** 지금 역할 컨트롤 값이 프리셋 조합과 정확히 일치하는지 — 모델 문자열과 추론 강도 둘 다 본다. */
  function modelPresetMatches(preset: ModelPreset): boolean {
    const entries: ReadonlyArray<readonly [string, string, string, { readonly tier: "fast" | "strong"; readonly thinking: string }]> = [
      [brainProvider.value, brainModel.input.value, brainEffort.value, preset.ultrabrain],
      ...specialistControls.map((c): readonly [string, string, string, { readonly tier: "fast" | "strong"; readonly thinking: string }] =>
        [c.provider.value, c.field.input.value, c.effort.value, preset.roles[c.role]]),
    ];
    return entries.every(([provider, modelValue, effort, spec]) =>
      tierModelFor(provider, spec.tier) === modelValue.trim() && effort === spec.thinking);
  }

  function syncModelPresetCards(): void {
    let first: HTMLButtonElement | undefined;
    for (const preset of MODEL_PRESETS) {
      const card = presetCards.get(preset.id);
      if (!card) continue;
      first ??= card;
      const active = modelPresetMatches(preset);
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-checked", String(active));
      card.setAttribute("tabindex", active ? "0" : "-1");
    }
    // 일치 프리셋이 없으면(직접 지정 상태) 키보드 복귀를 위해 첫 카드만 탭 순서에 남긴다.
    if (!MODEL_PRESETS.some((preset) => presetCards.get(preset.id)?.getAttribute("aria-checked") === "true")) {
      first?.setAttribute("tabindex", "0");
    }
  }

  function applyModelPreset(preset: ModelPreset): void {
    const applyTo = (
      provider: string,
      field: typeof brainModel,
      effort: HTMLSelectElement,
      spec: { readonly tier: "fast" | "strong"; readonly thinking: string },
    ): void => {
      const nextModel = tierModelFor(provider, spec.tier);
      if (nextModel) field.setValue(nextModel, authMode, provider);
      effort.value = spec.thinking;
      // 프로그래밍 대입은 input 을 쏘지 않아 커스텀 셀렉트 라벨이 옛값을 가리킨다 — 라벨만 동기화.
      effort.dispatchEvent(new Event("input", { bubbles: true }));
    };
    applyTo(brainProvider.value, brainModel, brainEffort, preset.ultrabrain);
    for (const c of specialistControls) applyTo(c.provider.value, c.field, c.effort, preset.roles[c.role]);
    persist(false);
  }

  // ── 역할별 직접 지정(고급 표) ─────────────────────────────────────────────
  const ROLE_TABLE_COPY = {
    ultrabrain: { label: "계획 · 최종 판단", eng: "Ultrabrain", desc: "작업 계획·팀 지휘·맵 검수 최종 판단" },
    vision: { label: "시각 관찰", eng: "Vision", desc: "맵 이미지의 배치·색감·경계·겹침 관찰" },
    writer: { label: "작문", eng: "Writer", desc: "이야기·세계관·NPC 대사·퀘스트 문장" },
    deep: { label: "실행 · 검증", eng: "Deep", desc: "복잡한 편집·도구 실행·수정·검증" },
    build: { label: "시공", eng: "Build", desc: "타일·맵·장소 짓기와 게임 전체 짓기(비우면 실행 모델)" },
  } as const;
  const roleTableRow = (
    key: keyof typeof ROLE_TABLE_COPY,
    provider: HTMLSelectElement,
    field: typeof brainModel,
    effort: HTMLSelectElement,
  ): HTMLElement => {
    const copy = ROLE_TABLE_COPY[key];
    return el("div", {
      class: "ai-role-row",
      dataset: { testid: `ai-settings-role-${key}` },
      children: [
        el("div", { class: "ai-role-name", children: [
          el("strong", { text: copy.label }),
          el("small", { text: `${copy.eng} — ${copy.desc}` }),
        ] }),
        el("div", { class: "ai-role-cell", children: [provider] }),
        el("div", { class: "ai-role-cell ai-role-model", children: [field.control, field.warning] }),
        el("div", { class: "ai-role-cell", children: [effort] }),
      ],
    });
  };
  const rolesDetails = el("details", {
    class: "ai-settings-roles",
    dataset: { testid: "ai-settings-advanced" },
    children: [
      el("summary", { children: [
        el("span", { class: "ai-settings-roles-summary", children: [
          el("strong", { text: "역할별 모델 직접 지정" }),
          el("small", { text: "고급 — 프리셋 선택을 덮어씁니다" }),
        ] }),
      ] }),
      el("div", { class: "ai-roles-table", children: [
        el("div", { class: "ai-roles-head", attrs: { role: "presentation" }, children:
          ["역할", "제공자", "모델", "추론 강도"].map((text) => el("span", { text })) }),
        roleTableRow("ultrabrain", brainProvider, brainModel, brainEffort),
        ...specialistControls.map((c) => roleTableRow(c.role, c.provider, c.field, c.effort)),
      ] }),
      el("p", { class: "ai-config-help ai-roles-help", text: "모델은 목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요." }),
    ],
  });

  // 자율성 다이얼이 매번 덮어쓰는 두 행은 고급 표 아래로 — 나란히 놓이면 덮어쓰기 관계가 안 보인다.
  const behaviorAdvanced = el("details", {
    class: "ai-settings-subdetails",
    children: [
      el("summary", { text: "고급 — 영역 작업 추론 · 작업 모드" }),
      el("div", { class: "ai-settings-subdetails-body", children: [reasoningRow, agentModeRow] }),
    ],
  });

  // ── 레일 + 탭 페인 ────────────────────────────────────────────────────────
  // 섹션이 일곱 줄로 나열되던 긴 단일 스크롤을 연결|모델|동작|표시 페인으로 나눈다.
  // 레일 버튼은 tablist 관례(role=tab, aria-selected, 화살표 이동)를 따른다.
  const extraSections = options.extraSections ?? [];
  const tabSpecs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly icon: Parameters<typeof deckIcon>[0] }> = [
    { id: "connection", label: "연결", icon: "link" },
    { id: "models", label: "모델", icon: "spark" },
    { id: "behavior", label: "동작", icon: "gear" },
    { id: "display", label: "표시", icon: "eye" },
    { id: "usage", label: "사용량", icon: "list" },
    ...extraSections.map((section) => ({ id: `extra-${section.id}`, label: section.title, icon: "list" as const })),
  ];
  const paneEls = new Map<string, HTMLElement>();
  const tabButtons = new Map<string, HTMLButtonElement>();
  const activatePane = (id: string, focus = false): void => {
    for (const [paneId, pane] of paneEls) pane.hidden = paneId !== id;
    for (const [tabId, button] of tabButtons) {
      const active = tabId === id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
    }
    if (focus) tabButtons.get(id)?.focus();
  };
  const rail = el("nav", {
    class: "ai-settings-rail",
    attrs: { role: "tablist", "aria-orientation": "vertical", "aria-label": "AI 설정 섹션" },
    dataset: { testid: "ai-settings-rail" },
    children: tabSpecs.map((spec) => {
      const button = el("button", {
        class: "ai-settings-tab",
        attrs: {
          type: "button", role: "tab", "aria-selected": "false", tabindex: "-1",
          id: `ai-settings-tab-${spec.id}`, "aria-controls": `ai-settings-pane-${spec.id}`,
        },
        dataset: { testid: `ai-settings-tab-${spec.id}`, pane: spec.id },
        children: [deckIcon(spec.icon, { size: 15 }), el("span", { text: spec.label })],
      }) as HTMLButtonElement;
      button.addEventListener("click", () => activatePane(spec.id));
      tabButtons.set(spec.id, button);
      return button;
    }),
  });
  rail.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
    event.preventDefault();
    const ids = tabSpecs.map((spec) => spec.id);
    const current = ids.findIndex((id) => tabButtons.get(id)?.getAttribute("aria-selected") === "true");
    const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
    activatePane(ids[(Math.max(current, 0) + delta + ids.length) % ids.length], true);
  });
  const pane = (id: string, children: readonly HTMLElement[]): HTMLElement => {
    const node = el("div", {
      class: "ai-settings-pane",
      attrs: { role: "tabpanel", id: `ai-settings-pane-${id}`, "aria-labelledby": `ai-settings-tab-${id}` },
      dataset: { testid: `ai-settings-pane-${id}`, pane: id },
      children,
    });
    paneEls.set(id, node);
    return node;
  };
  const content = el("div", {
    class: "ai-settings-content",
    children: [
      pane("connection", [
        settingsSection("connection", "연결", "AI 제공자와 로그인 상태를 관리합니다.", [authSettings.element, modelConnectionHint, alignAccountButton]),
        settingsSection("compat", "사용자 지정 연결", "OpenAI 호환 서버(예: Ollama, LiteLLM)를 직접 연결합니다. 기본 연결은 바꾸지 않아요.", [compatSettings.element]),
      ]),
      pane("models", [
        settingsSection("presets", "품질 프리셋", "역할별 모델과 추론 강도를 한 번에 맞춥니다.", [presetGroup]),
        roleMatrixSection,
        rolesDetails,
        settingsSection("image", "그림·도트 모델", "무엇을 만드느냐에 따라 쓰는 모델이 따로 있습니다.", [
          settingsCard("image-large", "그림 (타이틀·배경·컷신·초상)", "이미지 생성 모델이 한 장을 통째로 그립니다.", [
            settingsRow("제공자", "", imageProvider),
            settingsRow("모델", "", imageModel),
            imageStatus,
            imageRecommendation,
            settingsDetails([
              "인증 정보는 동반 서비스에만 보관하며 실제 생성 시 확인합니다.",
              imageRouteNote,
              "직접 지정한 이미지 모델은 계정을 바꿔도 유지됩니다.",
              "이미지를 출력하는 모델만 표시합니다. 지원 미확인 모델은 선택할 수 없습니다.",
              "이미지를 읽는 Vision 모델과는 별도로 고릅니다.",
            ]),
          ]),
          settingsCard("image-dot", "도트 (타일·캐릭터·맵 기물)", "텍스트 모델이 격자를 한 줄씩 써서 찍습니다.", [
            settingsRow("모델", "", pixelModelSelect),
            settingsRow("추론 강도", "", pixelEffort),
            pixelStatus,
            settingsDetails([
              "공방의 그리기 단계가 이 모델을 씁니다. 조수 채팅은 이 칸이 아니라 위 「역할별 모델 직접 지정」을 따릅니다.",
              "Argon 또는 Claude 계열을 고릅니다. 격자를 한 줄씩 맞추는 일이라 추론 강도는 보통 이상을 권합니다.",
              "이미지 모델은 도트 눈금·색 수·3/4 시점을 지키지 못해 이 용도에는 쓰지 않습니다.",
              "쓸 수 없으면 요청할 때 오류로 알려 주며, 다른 모델로 자동 전환하지 않습니다.",
            ]),
          ]),
        ]),
      ]),
      pane("behavior", [
        settingsSection("behavior", "동작", "응답 예산과 작업 진행 방식을 조정합니다.",
          // The autonomy dial stays first: it is the only way to reach the read-only (ask)
          // rail now that the composer has no mode chips, so it must not be pushed down.
          [autonomyRow, piApplyRow, dialoguePolishRow, maxTokens.row, behaviorAdvanced]),
      ]),
      pane("display", [
        settingsSection("display", "표시", "AI 패널의 읽기 환경과 화면 무게를 조정합니다.", [renderWeightRow, fontSizeRow, backgroundOpacityRow]),
      ]),
      pane("usage", [
        settingsSection("usage", "도구 사용량", "조수가 부른 도구를 횟수·실패·검색어로 보고, JSON으로 보낼 수 있습니다.", [renderAiToolUsagePanel()]),
      ]),
      ...extraSections.map((section) =>
        pane(`extra-${section.id}`, [settingsSection(section.id, section.title, section.description, [section.content])])),
    ],
  });

  // "AI 가 기억한 내 성향" 은 **의도적으로 여기 없다** (2026-08-30 감독 지시). 진입점은 채팅
  // 컴포저의 ⌾ 버튼이 여는 팝오버다 — 성향은 대화에서 배우고 배웠다는 알림도 채팅 버블로 뜨니,
  // 확인·삭제가 이 모달에 있으면 배운 자리와 고치는 자리가 갈라진다. 여기 추가하지 말 것.
  // 이 폼에 `projectScopeKey` 옵션이 없는 것도 그래서다(성향이 유일한 사용처였다).
  const form = el("div", {
    class: "ai-config-form ai-settings-form",
    dataset: { testid: "ai-config" },
    children: [
      rail,
      content,
      el("div", { class: "ai-config-actions", children: [savedHint, ...(options.onContinue ? [continueButton] : [])] }),
    ],
  });

  activatePane("connection");
  syncModelPresetCards();

  return {
    element: form,
    connectionSummary,
    connectionCheckButton,
    dispose: () => {
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, updateReadiness);
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, reloadConnectedRoutes);
      win?.removeEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfigChanged);
      window.removeEventListener(OPENAI_COMPAT_CHANGED_EVENT, onCompatChanged);
      compatSettings.dispose();
      if (autoSaveTimer !== null) {
        if (typeof window !== "undefined") window.clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
        persist(false);
      }
      authSettings.dispose();
    },
    focusFirstInput: () => authSettings.focus(),
    // focusTarget:"apiKey" 는 이제 **동반 서비스 키 입력**을 뜻한다. 브라우저 보관 키 필드가
    // 사라졌으므로 인증 패널의 focus() 로 넘긴다 — 그쪽이 "지금 키를 넣어야 하는가"를 알고
    // (API 키 종류 + 미연결) 그 칸으로 보내거나, 아니면 폼 첫 컨트롤로 보낸다.
    // aiChatPanel 이 이 값을 여러 곳에서 넘기므로 합법 값으로 유지한다(그 파일은 동시 작업 중).
    focusApiKey: () => authSettings.focus(),
  };
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
          el("p", { text: description }),
        ],
      }),
      el("div", { class: "ai-settings-section-body", children }),
    ],
  });
}

/**
 * 한 절 안의 «용도 카드» — 용도(제목 한 줄 + 설명 한 줄) 아래 모델 선택만 둔다.
 * 그림과 도트처럼 같은 위계의 용도를 나란히 놓되, 서로 다른 상자 안에 가둬 컨트롤이 섞여 읽히지 않게 한다.
 */
function settingsCard(id: string, title: string, description: string, children: readonly HTMLElement[]): HTMLElement {
  const titleId = `ai-settings-card-${id}-title`;
  return el("div", {
    class: "ai-settings-card",
    attrs: { role: "group", "aria-labelledby": titleId },
    dataset: { testid: `ai-settings-group-${id}` },
    children: [
      el("div", { class: "ai-settings-card-head", children: [
        el("h4", { text: title, attrs: { id: titleId } }),
        el("p", { text: description }),
      ] }),
      ...children,
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
    attrs: { type: "text", placeholder },
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
        children: group.models.map((model) => el("option", { attrs: { value: model }, text: model })),
      })),
    ];
    preset.replaceChildren(...options);
    preset.value = groups.some((group) => group.models.includes(input.value)) ? input.value : "";
  };
  // 현재 입력값이 해당 authMode 에서 유효한지 판정하고, 무효하면 경고 문구를 보여준다.
  // 유효하면 경고를 숨긴다. true = 유효.
  const validate = (mode: AiConfig["authMode"], providerId?: string): boolean => {
    const value = input.value.trim();
    if (isModelValidForAuthMode(mode, value, providerId)) {
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
    warning.textContent = blockReason
      ? `${blockReason} 다른 모델로 자동 대체하지 않습니다.`
      : "현재 제공자에서 지원을 확인하지 못한 모델입니다. 다른 모델로 자동 대체하지 않습니다.";
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
