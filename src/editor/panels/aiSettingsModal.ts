// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.

import {
  fetchChatGptAuthStatus,
  hasStoredCompanionCredential,
  isChatGptCompanionResponseError,
  type ChatGptCompanionUnreachableError,
} from "@/ai/chatgptOAuthClient";
import {
  DEFAULT_BASE_URL,
  DEFAULT_LITE_MODEL,
  DEFAULT_MODEL,
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
} from "@/ai/llmClient";
import { defaultModelForAuthMode, isModelValidForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import {
  applyAiFontSize,
  loadAiFontSize,
  saveAiFontSize,
  type AiFontSize,
} from "@/editor/panels/aiPanelLayout";
import { registerModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { renderAiAuthSettings } from "./aiAuthSettings";
import { installEventEditorCustomSelects } from "./eventEditor/customSelect";

export type AiSettingsFocus = "first" | "apiKey";

export type OpenAiSettingsModalOptions = {
  readonly focusTarget?: AiSettingsFocus;
  readonly onSaved?: (config: AiConfig) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  /** 패널 루트 — 글자 크기 즉시 반영용(선택). */
  readonly fontRoot?: HTMLElement | null;
};

let activeAiSettingsClose: (() => void) | null = null;

export function closeAiSettingsModal(): void {
  if (activeAiSettingsClose) {
    activeAiSettingsClose();
    return;
  }
  document.querySelector("[data-testid='ai-settings-modal']")?.remove();
}

export function openAiSettingsModal(options: OpenAiSettingsModalOptions = {}): HTMLElement {
  closeAiSettingsModal();
  const form = renderAiSettingsForm({
    onSaved: options.onSaved,
    onFontSizeChange: (size) => {
      options.onFontSizeChange?.(size);
      if (options.fontRoot) applyAiFontSize(options.fontRoot, size);
    },
  });

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "×",
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

  const close = registerModal(backdrop, () => {
    // 인증 패널은 기기 로그인 폴링 타이머를 들고 있다 — 정리하지 않으면 모달이 닫힌 뒤에도
    // /auth/status 를 3초마다 계속 때린다.
    customSelects.dispose();
    form.dispose();
    backdrop.remove();
    if (activeAiSettingsClose === close) activeAiSettingsClose = null;
  });
  activeAiSettingsClose = close;
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);

  if (options.focusTarget === "apiKey") form.focusApiKey();
  else form.focusFirstInput();

  return backdrop;
}

export function renderAiSettingsForm(options: {
  readonly onSaved?: (config: AiConfig) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
}): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void; dispose: () => void } {
  const onSaved = options.onSaved ?? (() => undefined);
  const onFontSizeChange = options.onFontSizeChange ?? (() => undefined);
  const config = loadAiConfig();
  let authMode = config.authMode;
  let providerId = parseOhMyPiProvider(config.providerId);
  const model = modelField("감독 모델(계획·검수)", config.model, "ai-config-model", "ai-config-model-preset", authMode, DEFAULT_MODEL, providerId);
  const liteModel = modelField(
    "실행 모델(툴 작업)",
    config.liteModel ?? DEFAULT_LITE_MODEL,
    "ai-config-lite-model",
    "ai-config-lite-model-preset",
    authMode,
    DEFAULT_LITE_MODEL,
    providerId,
  );
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
    // 제공자를 바꾸면 **그 제공자의 기본 모델을 채택한다.**
    //
    // "유효하면 사용자 선택을 존중" 이 더 친절해 보이지만 여기서는 위험하다.
    // isModelValidForAuthMode 는 openai-codex 에서만 실제 화이트리스트이고 나머지 제공자에는
    // 무조건 true 를 준다(modelCatalog.ts). 그래서 옛 모델을 "유효하다"며 남기면 동반 서비스의
    // resolveModel 이 그것을 오류 없이 다른 모델로 강등한다 — 감독이 고른 것도, 새 제공자의
    // 기본도 아닌 모델이 답한다. 검증 가능한 라이브 카탈로그가 붙기 전까지는 채택이 정직하다.
    const recommended = defaultModelForAuthMode(authMode, next);
    if (recommended) {
      model.setValue(recommended, authMode);
      liteModel.setValue(recommended, authMode);
    }
    model.refresh(authMode, next);
    liteModel.refresh(authMode, next);
    persistAuthMode();
  });
  const maxTokensDescription = "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산입니다. 기본값은 32768이며, 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다.";
  const maxTokens = textField("최대 토큰", maxTokensDescription, String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute("title", maxTokensDescription);

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
  const reasoningDescription = "모델이 답이나 도구 사용 전에 추론하는 강도입니다. 끔을 고르면 별도 추론을 하지 않습니다.";
  const reasoningRow = settingsRow("추론", reasoningDescription, reasoningSelect);
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
  });

  let autoSaveTimer: number | null = null;
  const persist = (showToast: boolean): void => {
    const next = collect();
    // 저장 전에 모델 유효성을 검사해 무효하면 눈에 보이게 알린다. 요청을 보내고 400 을 받고 나서야
    // 아는 지금 동작을 막기 위함이다. 저장 자체는 막지 않는다 — 무효 모델이 저장돼도 loadAiConfig 가
    // 로드 시점에 권장 기본으로 교정(원인 1 수정)하므로 실제로 400 요청이 나가지는 않기 때문이다.
    // 여기서 저장을 막으면 사용자 입력을 되돌리는 부작용이 생기고, 교정 안전망이 이미 있으므로
    // 경고(인라인 + 토스트)만으로 충분하다고 판단했다.
    const modelValid = model.validate(authMode, providerId);
    const liteValid = liteModel.validate(authMode, providerId);
    saveAiConfig(next);
    onSaved(next);
    savedHint.textContent = savedAtText(showToast ? "지금" : "자동");
    if (!modelValid || !liteValid) {
      toast("선택한 모델이 현재 연결 방식에서 쓸 수 없습니다. 모델 입력 아래 경고를 확인하세요.", "error");
    } else if (showToast) {
      toast("어시스턴트 설정을 저장했습니다.", "ok");
    }
  };
  persistAuthMode = () => persist(false);
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
  for (const field of [model, liteModel, maxTokens]) {
    field.input.addEventListener("input", scheduleAutoSave);
    field.input.addEventListener("change", () => persist(false));
  }
  for (const field of [model, liteModel]) {
    // 입력 즉시 유효성을 보여준다(저장까지 기다리지 않음). authMode 는 클로저의 현재 값을 쓴다.
    field.input.addEventListener("input", () => field.validate(authMode, providerId));
    field.preset.addEventListener("change", () => {
      // setValue 로 넣는다 — input.value 직접 대입은 경고 재평가를 건너뛰어, 목록에서 고른
      // 직후에는 이전 값의 경고가 그대로 남아 있었다(저장 시점에야 갱신됐다).
      if (field.preset.value) field.setValue(field.preset.value, authMode, providerId);
      persist(false);
    });
  }
  reasoningSelect.addEventListener("change", () => persist(false));

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
      el("div", {
        class: "ai-settings-advanced",
        attrs: { open: "" },
        dataset: { testid: "ai-settings-advanced" },
        children: [settingsSection(
          "model",
          "모델",
          "계획과 실행에 사용할 모델을 선택합니다.",
          [model.row, liteModel.row],
        )],
      }),
      settingsSection(
        "behavior",
        "동작",
        "응답 예산과 작업 진행 방식을 조정합니다.",
        [maxTokens.row, reasoningRow, agentModeRow],
      ),
      settingsSection(
        "display",
        "표시",
        "AI 패널의 읽기 환경을 조정합니다.",
        [fontSizeRow],
      ),
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
  id: "connection" | "model" | "behavior" | "display",
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
      "이 목록에 없는 모델 ID 는 오류 없이 다른 모델로 바뀝니다. 목록에서 골라 주세요.";
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
