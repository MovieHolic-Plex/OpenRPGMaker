import { PI_APPLY_MODES, normalizePiApplyMode } from "@/ai/piAgent/applyMode";
import { modelForRole, type RoleModel } from "@/ai/modelRoles";
// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.

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
import { OH_MY_PI_PROVIDERS, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
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
import { renderAiToolUsagePanel } from "./aiToolUsagePanel";
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
export const AI_SETTINGS_CLOSED_EVENT = "oprn:ai-settings-closed";

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
    class: "ai-config-help",
    attrs: { id: "ai-config-image-status", role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-config-image-status" },
  });
  // 그림은 GPT 를 강력히 추천한다(감독 지시 2026-09-27). 선택과 무관하게 항상 보이고, GPT 가 아닌 동안에만
  // 한 번에 바꾸는 버튼을 둔다 — 추천만 있고 바꿀 길이 제공자·모델 두 셀렉트를 차례로 건드리는 것뿐이면 불편하다.
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
        children: [
          el("strong", { text: "그림은 GPT 모델을 강력히 추천합니다." }),
          el("span", { text: " 픽셀 타일·캐릭터의 형태와 색이 더 안정적입니다. ChatGPT 계정 연결이 필요합니다." }),
        ],
      }),
      useRecommendedImage,
    ],
  });
  const refreshImageRecommendation = (): void => {
    const onGpt = imageProvider.value === CODEX_PROVIDER_ID;
    imageRecommendation.dataset.state = onGpt ? "active" : "suggest";
    useRecommendedImage.hidden = onGpt || !recommendedImage;
  };
  const refreshImageStatus = (): void => {
    refreshImageRecommendation();
    const entry = IMAGE_MODEL_CATALOG.find((entry) => entry.providerId === imageProvider.value && entry.model === imageModel.value);
    imageStatus.dataset.availability = entry?.supported ? "supported" : "unsupported";
    imageStatus.textContent = entry?.supported
      ? entry.providerLabel + " 로그인이 필요합니다. 인증 정보는 동반 서비스에만 보관하며 실제 생성 시 확인합니다."
        + (entry.providerId === DEFAULT_IMAGE_PROVIDER_ID ? "" : " god-tibo-imagen 경로(Codex 응답 API의 그림 도구)로 생성합니다. 참조 그림을 2장까지 함께 보낼 수 있습니다. 앱에 Codex 로그인이 없으면 codex CLI 로그인(~/.codex/auth.json)을 씁니다.")
      : "이 이미지 경로는 현재 미지원 또는 검증 전입니다. 저장된 선택은 유지하며 다른 모델로 자동 전환하지 않습니다.";
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
  // 추론 강도 옵션은 영어 enum 을 그대로 보여 주지 않는다 — 영역 작업 추론 셀렉트와 같은 한국어 라벨.
  const EFFORT_LABEL: Record<string, string> = { off: "끔", low: "낮음", medium: "보통", high: "높음" };
  const brainProvider = el("select", {
    class: "ai-config-select", dataset: { testid: "ai-config-ultrabrain-provider" },
    attrs: { "aria-label": "Ultrabrain 제공자" },
    children: OH_MY_PI_PROVIDERS.map(p => el("option", { attrs: { value: p.id }, text: p.label })),
  }) as HTMLSelectElement;
  brainProvider.value = brainConfig.providerId!;
  const brainModel = modelField("Ultrabrain 모델", brainConfig.model,
    "ai-config-ultrabrain-model", "ai-config-ultrabrain-model-preset", authMode, DEFAULT_ULTRABRAIN_MODEL, brainProvider.value);
  const brainEffort = el("select", {
    class: "ai-config-select", dataset: { testid: "ai-config-ultrabrain-reasoning" },
    attrs: { "aria-label": "Ultrabrain 추론" },
    children: ["low", "medium", "high"].map(value => el("option", { attrs: { value }, text: EFFORT_LABEL[value] })),
  }) as HTMLSelectElement;
  brainEffort.value = brainConfig.reasoningEffort!;
  const specialistControls = (["vision", "writer", "deep"] as const).map(role => {
    const selected = modelForRole(config, role);
    const provider = el("select", { class: "ai-config-select", dataset: { testid: `ai-config-${role}-provider` },
      attrs: { "aria-label": `${role} 제공자` },
      children: OH_MY_PI_PROVIDERS.map(p => el("option", { attrs: { value: p.id }, text: p.label })),
    }) as HTMLSelectElement;
    provider.value = selected.provider;
    const field = role === "writer" ? model : role === "deep" ? liteModel
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
    const effort = ({ off: "끔", low: "낮음", medium: "보통", high: "높음" } as const)[resolved.reasoningEffort];
    const mode = resolved.agentMode === "auto" ? "자율 모드" : "채팅 모드";
    const extra = resolved.readOnly ? " · 쓰기 없음" : resolved.planOnly ? " · 실행 전 승인" : "";
    autonomyDerived.textContent = `→ 추론 ${effort} · ${mode}${extra}`;
  };
  setAutonomyDerived(initialAutonomyLevel);
  const autonomyRow = settingsRow(
    "자율성",
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

  // Pi 팀 실행: 팀은 경로가 아니라 Pi 루프의 실행 모드다(executionRoute.ts 머리말). 컴포저의 「팀」
  // 토글과 같은 값을 읽고 쓴다 — 둘 중 하나가 유일한 진실이면 다른 쪽이 조용히 어긋난다.
  const piTeamSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-pi-team" },
    children: [
      el("option", { attrs: { value: "single" }, text: "에이전트 하나" }),
      el("option", { attrs: { value: "team" }, text: "팀(팀장·시공·검수)" }),
    ],
  }) as HTMLSelectElement;
  piTeamSelect.value = (config.piTeam ?? DEFAULT_PI_TEAM) ? "team" : "single";
  piTeamSelect.addEventListener("change", () => persist(false));
  const piTeamRow = settingsRow("팀으로 작업", "팀은 팀장이 맵을 나눠 시공·검수 에이전트를 띄운다 — 검수와 수정 배정이 붙지만 느립니다. 컴포저의 「팀」 토글과 같은 값입니다.", piTeamSelect);
  const piApplySelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-pi-apply" },
    children: [
      ...PI_APPLY_MODES.map(mode => el("option", { attrs: { value: mode.id, title: mode.description }, text: mode.label })),
    ],
  }) as HTMLSelectElement;
  piApplySelect.value = config.piApply ?? DEFAULT_PI_APPLY;
  piApplySelect.addEventListener("change", () => persist(false));
  const piApplyRow = settingsRow("결과 적용", "YOLO·AUTO·DEFAULT는 실제 맵을 실시간 편집합니다. 검토 후 적용·단계별 적용은 승인 전까지 초안으로 남습니다.", piApplySelect);
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
  const savedAtText = (): string => `자동 저장됨 · ${new Date().toLocaleTimeString("ko-KR", {
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

  const collect = (): AiConfig => ({
    authMode,
    providerId,
    modelSelectionOverrides,
    roleModels: Object.fromEntries(specialistControls.map(({ role, provider, field, effort }) => [role, {
      provider: provider.value, model: field.input.value.trim() || modelForRole(config, role).model,
      thinkingLevel: effort.value as RoleModel["thinkingLevel"],
    }])),
    ultrabrainProviderId: brainProvider.value,
    ultrabrainModel: brainModel.input.value.trim() || DEFAULT_ULTRABRAIN_MODEL,
    ultrabrainReasoningEffort: brainEffort.value as AiConfig["ultrabrainReasoningEffort"],
    imageProviderId: imageProvider.value,
    imageModel: imageModel.value,
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
    piTeam: piTeamSelect.value === "team",
    piApply: normalizePiApplyMode(piApplySelect.value),
  });

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
  const continueButton = el("button", {
    class: "ai-assistant-action is-primary",
    text: "연결하고 계속",
    attrs: { type: "button", disabled: "" },
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
    continueButton.disabled = next.tone !== "connected" || status.kind !== "ready" || !valid;
    connectionSummary.dataset.tone = SUMMARY_TONE[next.tone];
    connectionSummaryCopy.textContent = `${next.providerLabel} · ${next.text}`;
    if (next.tone === "connected") {
      connectionSummary.dataset.tone = continueButton.disabled ? "warning" : "ready";
      connectionSummaryCopy.textContent = !valid ? "작업 모델을 확인하세요. 모델 탭에서 지원되는 모델을 선택하세요."
        : status.kind === "ready" ? `${next.providerLabel} · 사용 준비됨` : status.label;
    }
  };
  continueButton.addEventListener("click", () => {
    updateReadiness();
    if (!continueButton.disabled) options.onContinue?.();
  });
  alignAccountButton.addEventListener("click", () => {
    applyAccountSelection(true);
    persist(false);
    authSettings.recheck();
  });
  const onConfigChanged = (): void => {
    updateReadiness();
    void refreshAiConnectionStatus(updateReadiness);
  };
  const win = typeof window === "undefined" ? undefined : window;
  win?.addEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, updateReadiness);
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
    on: { click: () => authSettings.recheck() },
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
      ]),
      pane("models", [
        settingsSection("presets", "품질 프리셋", "역할별 모델과 추론 강도를 한 번에 맞춥니다.", [presetGroup]),
        rolesDetails,
        settingsSection("image", "이미지 생성", "그림을 생성하는 모델입니다. 이미지를 읽는 Vision과 별도로 선택합니다.", [
          settingsRow("이미지 생성 제공자", "직접 지정한 이미지 모델은 계정을 바꿔도 유지됩니다.", imageProvider),
          settingsRow("이미지 생성 모델", "이미지를 출력하는 모델만 표시합니다. 지원 미확인 모델은 선택할 수 없습니다.", imageModel),
          imageRecommendation,
          imageStatus,
        ]),
      ]),
      pane("behavior", [
        settingsSection("behavior", "동작", "응답 예산과 작업 진행 방식을 조정합니다.",
          // The autonomy dial stays first: it is the only way to reach the read-only (ask)
          // rail now that the composer has no mode chips, so it must not be pushed down.
          [autonomyRow, piTeamRow, piApplyRow, maxTokens.row, behaviorAdvanced]),
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
      win?.removeEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfigChanged);
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

function settingsRow(label: string, description: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "ai-config-row",
    children: [
      el("span", { class: "ai-config-row-copy", children: [
        el("span", { class: "ai-config-label", text: label }),
        el("span", { class: "ai-config-help", text: description }),
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
    warning.textContent =
      "현재 제공자에서 지원을 확인하지 못한 모델입니다. 다른 모델로 자동 대체하지 않습니다.";
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
