// AI 설정 전용 모달 — 채팅 본문과 분리된 설정 표면.
// loadAiConfig/saveAiConfig 자동 저장 계약을 유지한다.

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
import {
  applyAiFontSize,
  loadAiFontSize,
  saveAiFontSize,
  type AiFontSize,
} from "@/editor/panels/aiPanelLayout";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { renderAiAuthSettings } from "./aiAuthSettings";

export type AiSettingsFocus = "first" | "apiKey";

export type OpenAiSettingsModalOptions = {
  readonly focusTarget?: AiSettingsFocus;
  readonly onSaved?: (config: AiConfig) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
  /** 패널 루트 — 글자 크기 즉시 반영용(선택). */
  readonly fontRoot?: HTMLElement | null;
};

export function closeAiSettingsModal(): void {
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

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener?.("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener?.("keydown", onKeyDown);
  document.body.append(backdrop);

  if (options.focusTarget === "apiKey") form.focusApiKey();
  else form.focusFirstInput();

  return backdrop;
}

export function renderAiSettingsForm(options: {
  readonly onSaved?: (config: AiConfig) => void;
  readonly onFontSizeChange?: (size: AiFontSize) => void;
}): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void } {
  const onSaved = options.onSaved ?? (() => undefined);
  const onFontSizeChange = options.onFontSizeChange ?? (() => undefined);
  const config = loadAiConfig();
  let authMode = config.authMode;
  const baseUrl = textField("엔드포인트", config.baseUrl, "ai-config-baseurl", "text", DEFAULT_BASE_URL);
  const model = modelField("감독 모델(계획·검수)", config.model, "ai-config-model", "ai-config-model-preset", authMode, DEFAULT_MODEL);
  const liteModel = modelField(
    "실행 모델(툴 작업)",
    config.liteModel ?? DEFAULT_LITE_MODEL,
    "ai-config-lite-model",
    "ai-config-lite-model-preset",
    authMode,
    DEFAULT_LITE_MODEL
  );
  const apiKey = textField("API 키", config.apiKey, "ai-config-apikey", "password", "sk-or-…");
  let persistAuthMode = (): void => undefined;
  const authSettings = renderAiAuthSettings(authMode, (next) => {
    authMode = next;
    updateAuthVisibility();
    // 연결 방식을 바꾸면 모델 드롭다운 목록만 갈아끼우고 선택된 값은 그대로 두던 결함이 있었다.
    // 그래서 ChatGPT(Codex)로 전환해도 게이트웨이 모델 ID 가 남아 400 이 났다. 새 authMode 에서
    // 현재 값이 무효하면 권장 기본값으로 따라오게 한다. 유효하면 사용자 선택을 존중해 그대로 둔다.
    // setValue 를 써야 드롭다운 하이라이트 동기화와 경고 재평가가 함께 일어난다.
    // defaultModelForAuthMode 는 방어적으로 "" 를 줄 수 있어(카탈로그 빈 경우) DEFAULT_* 로 폴백한다.
    const recommended = defaultModelForAuthMode(authMode);
    if (!isModelValidForAuthMode(authMode, model.input.value.trim())) {
      model.setValue(recommended || DEFAULT_MODEL, authMode);
    }
    if (!isModelValidForAuthMode(authMode, liteModel.input.value.trim())) {
      liteModel.setValue(recommended || DEFAULT_LITE_MODEL, authMode);
    }
    model.refresh(authMode);
    liteModel.refresh(authMode);
    persistAuthMode();
  });
  const updateAuthVisibility = (): void => {
    const apiMode = authMode === "apiKey";
    baseUrl.row.hidden = !apiMode;
    apiKey.row.hidden = !apiMode;
  };
  updateAuthVisibility();
  const maxTokens = textField("최대 토큰", String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute(
    "title",
    "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산(기본 32768). 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다."
  );

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
  const reasoningRow = el("label", {
    class: "ai-config-row",
    attrs: { title: "모델이 답/도구 사용 전에 추론(생각)하는 강도. 끔=추론 안 함." },
    children: [el("span", { class: "ai-config-label", text: "추론" }), reasoningSelect],
  });

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
  const agentModeRow = el("label", {
    class: "ai-config-row",
    attrs: {
      title: "자율: AI가 요청을 스스로 작업 계획으로 분해해 진행합니다. 채팅: 종래처럼 대화로 진행합니다(감독·실행 모델이 다를 때만 계획 단계 사용).",
    },
    children: [el("span", { class: "ai-config-label", text: "작업 모드" }), agentModeSelect],
  });

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
  fontSizeSelect.addEventListener("change", () => {
    const raw = fontSizeSelect.value;
    const size: AiFontSize = raw === "small" || raw === "large" ? raw : "normal";
    saveAiFontSize(size);
    onFontSizeChange(size);
  });
  const fontSizeRow = el("label", {
    class: "ai-config-row",
    attrs: { title: "채팅 로그·제안 카드·도구 로그의 글자 크기. 즉시 적용되고 저장됩니다." },
    children: [el("span", { class: "ai-config-label", text: "글자 크기" }), fontSizeSelect],
  });

  const autoApprove = el("input", {
    class: "ai-config-checkbox",
    attrs: { type: "checkbox" },
    dataset: { testid: "ai-config-autoapprove" },
  }) as HTMLInputElement;
  autoApprove.checked = config.autoApprove === true;
  const autoApproveRow = el("label", {
    class: "ai-config-row ai-config-check-row",
    attrs: {
      title: "현재 맵의 같은 크기 타일만 바꾸는 안전한 꾸미기 제안에만 적용됩니다. 이벤트·DB·퀘스트·전투·삭제·맵 생성/크기 변경·경고가 있는 제안은 항상 검토합니다.",
    },
    children: [
      el("span", { class: "ai-config-label", text: "안전한 맵 꾸미기 자동 적용" }),
      autoApprove,
      el("span", {
        class: "ai-config-help",
        text: "타일 꾸미기만 바로 반영합니다. 이벤트·데이터·삭제·여러 맵 변경은 항상 먼저 보여 드립니다.",
      }),
    ],
  });

  const savedHint = el("span", {
    class: "ai-config-saved-hint",
    text: "",
    dataset: { testid: "ai-config-saved-hint" },
  });

  const collect = (): AiConfig => ({
    authMode,
    baseUrl: baseUrl.input.value.trim() || DEFAULT_BASE_URL,
    model: model.input.value.trim() || DEFAULT_MODEL,
    liteModel: liteModel.input.value.trim() || DEFAULT_LITE_MODEL,
    apiKey: apiKey.input.value,
    maxToolCalls: defaultAiConfig().maxToolCalls,
    maxTokens: Math.max(256, Number(maxTokens.input.value) || defaultAiConfig().maxTokens),
    reasoningEffort: (reasoningSelect.value as AiConfig["reasoningEffort"]) || "medium",
    agentMode: agentModeSelect.value === "chat" ? "chat" : "auto",
    autoApprove: autoApprove.checked,
  });

  let autoSaveTimer: number | null = null;
  const persist = (showToast: boolean): void => {
    const next = collect();
    // 저장 전에 모델 유효성을 검사해 무효하면 눈에 보이게 알린다. 요청을 보내고 400 을 받고 나서야
    // 아는 지금 동작을 막기 위함이다. 저장 자체는 막지 않는다 — 무효 모델이 저장돼도 loadAiConfig 가
    // 로드 시점에 권장 기본으로 교정(원인 1 수정)하므로 실제로 400 요청이 나가지는 않기 때문이다.
    // 여기서 저장을 막으면 사용자 입력을 되돌리는 부작용이 생기고, 교정 안전망이 이미 있으므로
    // 경고(인라인 + 토스트)만으로 충분하다고 판단했다.
    const modelValid = model.validate(authMode);
    const liteValid = liteModel.validate(authMode);
    saveAiConfig(next);
    onSaved(next);
    savedHint.textContent = "자동 저장됨";
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
  for (const field of [baseUrl, model, liteModel, apiKey, maxTokens]) {
    field.input.addEventListener("input", scheduleAutoSave);
    field.input.addEventListener("change", () => persist(false));
  }
  for (const field of [model, liteModel]) {
    // 입력 즉시 유효성을 보여준다(저장까지 기다리지 않음). authMode 는 클로저의 현재 값을 쓴다.
    field.input.addEventListener("input", () => field.validate(authMode));
    field.preset.addEventListener("change", () => {
      if (field.preset.value) field.input.value = field.preset.value;
      persist(false);
    });
  }
  autoApprove.addEventListener("change", () => persist(false));
  reasoningSelect.addEventListener("change", () => persist(false));

  const saveButton = el("button", {
    class: "ai-assistant-action",
    text: "설정 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-config-save" },
    on: { click: () => persist(true) },
  });

  const form = el("div", {
    class: "ai-config-form ai-settings-form",
    dataset: { testid: "ai-config" },
    children: [
      authSettings.element,
      apiKey.row,
      el("details", {
        class: "ai-settings-advanced",
        dataset: { testid: "ai-settings-advanced" },
        children: [
          el("summary", { text: "고급 설정" }),
          el("div", {
            class: "ai-settings-advanced-body",
            children: [
              baseUrl.row,
              model.row,
              liteModel.row,
              maxTokens.row,
              reasoningRow,
              agentModeRow,
              autoApproveRow,
              fontSizeRow,
            ],
          }),
        ],
      }),
      el("div", { class: "ai-config-actions", children: [saveButton, savedHint] }),
    ],
  });

  return {
    element: form,
    focusFirstInput: () => authSettings.focus(),
    focusApiKey: () => authMode === "apiKey" ? apiKey.input.focus() : authSettings.focus(),
  };
}

function textField(
  label: string,
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
  const row = el("label", {
    class: "ai-config-row",
    children: [el("span", { class: "ai-config-label", text: label }), input],
  });
  return { row, input };
}

function modelField(
  label: string,
  value: string,
  inputTestid: string,
  presetTestid: string,
  authMode: AiConfig["authMode"],
  placeholder: string
): {
  row: HTMLElement;
  input: HTMLInputElement;
  preset: HTMLSelectElement;
  refresh: (mode: AiConfig["authMode"]) => void;
  validate: (mode: AiConfig["authMode"]) => boolean;
  setValue: (value: string, mode: AiConfig["authMode"]) => void;
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
  // 무효 모델 경고. aiAuthSettings 의 serverError(companion-hint) 관례를 따라 인라인 div 로 표시한다.
  // companion-hint 의 글자 크기(11px)·여백은 CSS 를 따르고, 경고색은 이 패널의 위험 표시 관례
  // (tabs-b-assistant-panel.css 의 --danger 사용)를 인라인으로 적용한다 — 이 파일은 CSS 를 편집할 수
  // 없으므로 새 클래스 스타일을 발명하지 않고 기존 토큰을 그대로 쓴다.
  const warning = el("div", {
    class: "ai-model-warning",
    attrs: { hidden: "", role: "alert" },
    dataset: { testid: `${inputTestid}-warning` },
  });
  warning.style.color = "var(--danger, #d85c5c)";
  warning.style.fontSize = "11px";
  warning.style.marginTop = "4px";
  const refresh = (nextMode: AiConfig["authMode"]): void => {
    const groups = modelCatalogForAuthMode(nextMode);
    const options = [
      el("option", { attrs: { value: "" }, text: "GJC 모델 목록에서 선택" }),
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
  const validate = (mode: AiConfig["authMode"]): boolean => {
    const value = input.value.trim();
    if (isModelValidForAuthMode(mode, value)) {
      warning.hidden = true;
      warning.textContent = "";
      return true;
    }
    warning.hidden = false;
    warning.textContent =
      mode === "chatgpt"
        ? "ChatGPT 구독(Codex)은 gpt- 로 시작하는 모델만 쓸 수 있습니다. 목록에서 gpt- 모델을 고르거나 연결 방식을 API/게이트웨이로 바꾸세요."
        : "이 연결 방식에서 쓸 수 없는 모델입니다. 목록에서 모델을 고르세요.";
    return false;
  };
  // 값을 바꾸는 공개 수단. input.value 직접 대입은 드롭다운 하이라이트와 경고 표시가 어긋난다.
  // setValue 는 입력값 교체 → 드롭다운 동기화 → 경고 재평가를 한꺼번에 처리한다.
  // (authMode 전환 시 무효 모델을 권장 기본으로 교정할 때 이 setter 를 쓴다.)
  // mode 를 인자로 받는 이유: 이 함수의 authMode 매개변수는 생성 시점 초기값이라 전환 후엔
  // stale 하다 — 호출 쪽이 현재 authMode 를 넘겨야 경고가 올바른 기준으로 재평가된다.
  const setValue = (value: string, mode: AiConfig["authMode"]): void => {
    input.value = value;
    preset.value = value;
    validate(mode);
  };
  const row = el("label", {
    class: "ai-config-row ai-model-row",
    children: [
      el("span", { class: "ai-config-label", text: label }),
      el("span", { class: "ai-model-help", text: "목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요." }),
      el("div", { class: "ai-model-control", children: [preset, input] }),
      warning,
    ],
  });
  refresh(authMode);
  return { row, input, preset, refresh, validate, setValue };
}
