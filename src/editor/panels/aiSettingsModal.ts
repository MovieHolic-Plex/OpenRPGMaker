import { modelForRole, type SpecialistRole, type RoleModel } from "@/ai/modelRoles";
// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.

import { configForUltrabrain, DEFAULT_ULTRABRAIN_MODEL } from "@/ai/ultrabrainConfig";
import { DEFAULT_PI_APPLY, DEFAULT_PI_TEAM } from "@/ai/piAgent/executionRoute";
import {
  fetchChatGptAuthStatus,
  hasStoredCompanionCredential,
  isChatGptCompanionResponseError,
  type ChatGptCompanionUnreachableError,
} from "@/ai/chatgptOAuthClient";
import {
  DEFAULT_BASE_URL,
  DEFAULT_LITE_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  defaultAiConfig,
  isAutonomyLevel,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
} from "@/ai/llmClient";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { isModelValidForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { OH_MY_PI_PROVIDERS, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID, IMAGE_MODEL_CATALOG } from "@/ai/imageModelCatalog";
import {
  AI_BACKGROUND_OPACITY_LIMITS,
  applyAiBackgroundOpacity,
  clampAiBackgroundOpacity,
  loadAiBackgroundOpacity,
  saveAiBackgroundOpacity,
  applyAiFontSize,
  loadAiFontSize,
  saveAiFontSize,
  type AiFontSize,
} from "@/editor/panels/aiPanelLayout";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { installAiModalFocus } from "./aiModalFocus";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { renderAiAuthSettings } from "./aiAuthSettings";
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
            children: [el("h2", { text: "AI 설정" }), closeButton],
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
  readonly onSaved?: (config: AiConfig) => void;
  readonly onBackgroundOpacityChange?: (value: number) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  readonly extraSections?: readonly AiSettingsExtraSection[];
}): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void; dispose: () => void } {
  const onSaved = options.onSaved ?? (() => undefined);
  const onFontSizeChange = options.onFontSizeChange ?? (() => undefined);
  const config = loadAiConfig();
  let authMode = config.authMode;
  let providerId = parseOhMyPiProvider(config.providerId);
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
  const refreshImageStatus = (): void => {
    const entry = IMAGE_MODEL_CATALOG.find((entry) => entry.providerId === imageProvider.value && entry.model === imageModel.value);
    imageStatus.dataset.availability = entry?.supported ? "supported" : "unsupported";
    imageStatus.textContent = entry?.supported
      ? entry.providerLabel + " 로그인이 필요합니다. 인증 정보는 동반 서비스에만 보관하며 실제 생성 시 확인합니다."
        + (entry.providerId === DEFAULT_IMAGE_PROVIDER_ID ? "" : " GPT Image 2(gpt-image-2)를 명시적으로 요청합니다. 날짜가 붙은 세부 스냅샷 버전은 제공자가 알려 주지 않습니다. 현재 텍스트 설명만 지원합니다. 참조 그림이 있는 생성은 Gemini를 선택해 주세요.")
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
    children: ["low", "medium", "high"].map(value => el("option", { attrs: { value }, text: value })),
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
      children: ["off", "low", "medium", "high"].map(value => el("option", { attrs: { value }, text: value })),
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
  const authSettings = renderAiAuthSettings(config, ({ providerId: next }) => {
    providerId = next;
    persistAuthMode();
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
  const autonomyDescription = "계획만 제안할지 직접 작업할지와 작업 예산을 조정합니다. 역할별 모델과 추론 강도는 유지됩니다.";
  const autonomyRow = settingsRow("자율성", autonomyDescription, autonomySelect);
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
  const reasoningDescription = "기존 영역 작업 경로의 추론 설정입니다. 대화 조수는 위에서 선택한 역할별 추론 강도를 사용합니다.";
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
  const piTeamRow = settingsRow("Pi 팀 실행", "팀은 팀장이 맵을 나눠 시공·검수 에이전트를 띄운다 — 검수와 수정 배정이 붙지만 느립니다. 컴포저의 「팀」 토글과 같은 값입니다.", piTeamSelect);
  const piApplySelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-pi-apply" },
    children: [
      el("option", { attrs: { value: "review" }, text: "검토 후 적용" }),
      el("option", { attrs: { value: "auto" }, text: "바로 적용" }),
    ],
  }) as HTMLSelectElement;
  piApplySelect.value = config.piApply ?? DEFAULT_PI_APPLY;
  piApplySelect.addEventListener("change", () => persist(false));
  const piApplyRow = settingsRow("Pi 결과 적용", "검토 후 적용은 보드의 검토 카드에서 승인해야 프로젝트가 바뀝니다. 바로 적용은 게이트만 통과하면 즉시 반영합니다.", piApplySelect);
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
  const savedAtText = (kind: "자동" | "지금"): string => `${kind} 저장됨 · ${new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  fontSizeSelect.addEventListener("change", () => {
    const raw = fontSizeSelect.value;
    const size: AiFontSize = raw === "small" || raw === "large" ? raw : "normal";
    saveAiFontSize(size);
    onFontSizeChange(size);
    savedHint.textContent = savedAtText("자동");
  });

  const collect = (): AiConfig => ({
    authMode,
    providerId,
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
    piApply: piApplySelect.value === "auto" ? "auto" : DEFAULT_PI_APPLY,
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
    savedHint.textContent = savedAtText(showToast ? "지금" : "자동");
    if (!modelValid || !liteValid || !brainValid) {
      toast("선택한 모델이 현재 연결 방식에서 쓸 수 없습니다. 모델 입력 아래 경고를 확인하세요.", "error");
    } else if (showToast) {
      toast("어시스턴트 설정을 저장했습니다.", "ok");
    }
  };
  persistAuthMode = () => persist(false);
  imageProvider.addEventListener("change", () => {
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
    refreshImageStatus();
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
  for (const field of [...specialistControls.map(c => c.field), brainModel, maxTokens]) {
    field.input.addEventListener("input", scheduleAutoSave);
    field.input.addEventListener("change", () => persist(false));
  }
  for (const { provider, field, effort } of specialistControls) {
    provider.addEventListener("change", () => {
      field.refresh(authMode, provider.value);
      field.validate(authMode, provider.value);
      persist(false);
    });
    field.input.addEventListener("input", () => field.validate(authMode, provider.value));
    field.preset.addEventListener("change", () => {
      if (field.preset.value) field.setValue(field.preset.value, authMode, provider.value);
      persist(false);
    });
    effort.addEventListener("change", () => persist(false));
  }
  brainProvider.addEventListener("change", () => {
    brainModel.refresh(authMode, brainProvider.value);
    brainModel.validate(authMode, brainProvider.value);
    persist(false);
  });
  brainModel.input.addEventListener("input", () => brainModel.validate(authMode, brainProvider.value));
  brainModel.preset.addEventListener("change", () => {
    if (brainModel.preset.value) brainModel.setValue(brainModel.preset.value, authMode, brainProvider.value);
    persist(false);
  });
  brainEffort.addEventListener("change", () => persist(false));
  reasoningSelect.addEventListener("change", () => persist(false));
  autonomySelect.addEventListener("change", () => {
    const level: AutonomyLevel = isAutonomyLevel(autonomySelect.value) ? autonomySelect.value : "balanced";
    autonomySelect.value = level;
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
  let connectionCheckGeneration = 0;
  let disposed = false;
  const setConnectionSummary = (text: string, tone: "checking" | "ready" | "warning" | "error"): void => {
    connectionSummary.dataset.tone = tone;
    connectionSummaryCopy.textContent = text;
  };
  const checkConnection = async (): Promise<void> => {
    const generation = ++connectionCheckGeneration;
    const checkedProvider = providerId;
    setConnectionSummary("연결 상태를 확인하고 있습니다…", "checking");
    try {
      const auth = await fetchChatGptAuthStatus(checkedProvider);
      if (disposed || generation !== connectionCheckGeneration || checkedProvider !== providerId) return;
      if (hasStoredCompanionCredential(auth)) {
        setConnectionSummary(`연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`, "ready");
      } else if (auth.env === true) {
        setConnectionSummary("환경 변수만 있어 에디터 로그인이 필요합니다.", "warning");
      } else if (auth.expired === true) {
        setConnectionSummary("로그인이 만료되었습니다. 다시 로그인하세요.", "warning");
      } else {
        setConnectionSummary("로그인이 필요합니다.", "warning");
      }
    } catch (error) {
      if (disposed || generation !== connectionCheckGeneration || checkedProvider !== providerId) return;
      if (isChatGptCompanionResponseError(error)) {
        setConnectionSummary("연결 서비스가 응답했지만 내부 오류가 났습니다. 개발 서버를 다시 시작해 보세요.", "error");
        return;
      }
      const reason = (error as ChatGptCompanionUnreachableError | undefined)?.reason;
      setConnectionSummary(
        reason === "timeout"
          ? "연결 서비스가 응답하지 않습니다. 개발 서버를 다시 시작해 보세요."
          : "연결 서비스에 닿지 않습니다. npm run ai:oauth 실행 상태를 확인하세요.",
        "error",
      );
    }
  };
  const connectionCheckButton = el("button", {
    class: "ai-assistant-action ai-settings-check",
    text: "연결 확인",
    attrs: { type: "button" },
    dataset: { testid: "ai-settings-connection-check" },
    on: { click: () => void checkConnection() },
  });

  const saveButton = el("button", {
    class: "ai-assistant-action ai-settings-save-now",
    text: "지금 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-config-save" },
    on: { click: () => persist(true) },
  });

  // "AI 가 기억한 내 성향" 은 **의도적으로 여기 없다** (2026-08-30 감독 지시). 진입점은 채팅
  // 컴포저의 ⌾ 버튼이 여는 팝오버다 — 성향은 대화에서 배우고 배웠다는 알림도 채팅 버블로 뜨니,
  // 확인·삭제가 이 모달에 있으면 배운 자리와 고치는 자리가 갈라진다. 여기 추가하지 말 것.
  // 이 폼에 `projectScopeKey` 옵션이 없는 것도 그래서다(성향이 유일한 사용처였다).
  const form = el("div", {
    class: "ai-config-form ai-settings-form",
    dataset: { testid: "ai-config" },
    children: [
      el("div", {
        class: "ai-settings-overview",
        children: [
          connectionSummary,
          connectionCheckButton,
        ],
      }),
      settingsSection(
        "connection",
        "연결",
        "AI 제공자와 로그인 상태를 관리합니다.",
        [authSettings.element],
      ),
      el("div", { class: "ai-settings-advanced", attrs: { open: "" },
        dataset: { testid: "ai-settings-advanced" }, children: [
      settingsSection(
        "ultrabrain", "Ultrabrain · 계획과 최종 판단",
        "최고 지능 역할입니다. 작업 계획과 팀 지휘를 맡고, 맵 검수에서는 전체 이미지를 직접 보고 최종 판단합니다. 맵 검수 시 이미지 입력을 지원해야 합니다.",
        [settingsRow("제공자", "선택한 제공자의 OAuth 로그인을 사용합니다.", brainProvider),
          brainModel.row, settingsRow("추론 강도", "작성 모델의 자율성 설정과 별도로 유지됩니다.", brainEffort)],
      ),
      ...specialistControls.map(({ role, provider, field, effort }) => settingsSection(role,
        ({ vision: "Vision · 시각 관찰", writer: "Writer · 작문", deep: "Deep · 깊은 작업과 실행" } satisfies Record<SpecialistRole, string>)[role],
        ({ vision: "전체 맵 이미지의 배치·색감·경계·겹침을 관찰합니다. 이미지 입력을 지원하는 LLM을 선택하세요. 실제 이미지 전달을 확인하며 미지원 모델로는 검수를 통과시키지 않습니다.",
          writer: "이야기·세계관·NPC 대사·퀘스트 문장을 작성합니다. Deep이 필요한 작업에서 호출합니다.",
          deep: "Ultrabrain의 계획에 따라 복잡한 편집·도구 실행·수정·검증을 담당합니다." } satisfies Record<SpecialistRole, string>)[role],
        [settingsRow("제공자", "역할별로 독립적으로 선택합니다.", provider), field.row,
          settingsRow("추론 강도", "자율성 다이얼과 별도로 유지됩니다.", effort)],
      )),
      settingsSection(
        "image",
        "Image · 이미지 생성",
        "그림을 생성하는 모델입니다. 이미지를 읽는 Vision과 별도로 선택합니다.",
        [
          settingsRow("이미지 생성 제공자", "대화 제공자를 바꿔도 이 선택은 유지됩니다.", imageProvider),
          settingsRow("이미지 생성 모델", "이미지를 출력하는 모델만 표시합니다. 지원 미확인 모델은 선택할 수 없습니다.", imageModel),
          imageStatus,
        ],
      ),
      ] }),
      settingsSection(
        "behavior",
        "동작",
        "응답 예산과 작업 진행 방식을 조정합니다.",
        // The autonomy dial stays first: it is the only way to reach the read-only (ask)
        // rail now that the composer has no mode chips, so it must not be pushed down.
        [autonomyRow, piTeamRow, piApplyRow, maxTokens.row, reasoningRow, agentModeRow],
      ),
      settingsSection(
        "display",
        "표시",
        "AI 패널의 읽기 환경을 조정합니다.",
        [fontSizeRow, backgroundOpacityRow],
      ),
      ...(options.extraSections ?? []).map((section) =>
        settingsSection(section.id, section.title, section.description, [section.content])),
      el("div", { class: "ai-config-actions", children: [savedHint, saveButton] }),
    ],
  });

  void checkConnection();

  return {
    element: form,
    dispose: () => {
      disposed = true;
      connectionCheckGeneration += 1;
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
  row: HTMLElement;
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
  // 무효 모델 경고. 스타일은 styles/editor/ai-auth-connection.css 의 .ai-model-warning 이 맡는다
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
  const row = el("label", {
    class: "ai-config-row ai-model-row",
    children: [
      el("span", { class: "ai-config-row-copy", children: [
        el("span", { class: "ai-config-label", text: label }),
        el("span", { class: "ai-model-help ai-config-help", text: "목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요." }),
      ] }),
      el("div", { class: "ai-model-control", children: [preset, input] }),
      warning,
    ],
  });
  refresh(authMode, providerId);
  return { row, input, preset, refresh, validate, setValue };
}
