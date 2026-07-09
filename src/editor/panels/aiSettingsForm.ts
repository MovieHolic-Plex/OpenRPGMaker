// editor/panels/aiSettingsForm.ts
// AI 어시스턴트 설정 폼(접이식). 입력 변경 시 localStorage 자동 저장.

import {
  DEFAULT_BASE_URL,
  DEFAULT_LITE_MODEL,
  DEFAULT_MODEL,
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
} from "@/ai/llmClient";
import {
  loadAiFontSize,
  saveAiFontSize,
  type AiFontSize,
} from "./aiPanelLayout";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function renderSettingsForm(
  onSaved: (config: AiConfig) => void,
  onFontSizeChange: (size: AiFontSize) => void = () => {}
): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void } {
  const config = loadAiConfig();
  const baseUrl = textField("엔드포인트", config.baseUrl, "ai-config-baseurl", "text", DEFAULT_BASE_URL);
  const model = textField("감독 모델(계획·검수)", config.model, "ai-config-model", "text", DEFAULT_MODEL);
  const liteModel = textField("실행 모델(툴 작업)", config.liteModel ?? DEFAULT_LITE_MODEL, "ai-config-lite-model", "text", DEFAULT_LITE_MODEL);
  const apiKey = textField("API 키", config.apiKey, "ai-config-apikey", "password", "sk-or-…");
  // 사용자 제한은 출력 토큰 예산 하나뿐 — 툴콜 깊이는 AI가 필요한 만큼 쓴다.
  const maxTokens = textField("최대 토큰", String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute("title", "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산(기본 32768). 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다.");

  // 추론(reasoning) 강도 — 모델이 답하기 전에 생각하는 정도. 기본 '보통'(reasoning 켜짐).
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

  // 글자 크기 3단(V3C) — AiConfig와 별개로 localStorage(rpg-zzu:ai-font-size)에 즉시 영속.
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
    attrs: { title: "AI가 만든 변경 제안을 검토 없이 즉시 프로젝트에 적용합니다. 되돌리기는 Ctrl+Z." },
    children: [el("span", { class: "ai-config-label", text: "자동 승인" }), autoApprove],
  });

  const savedHint = el("span", {
    class: "ai-config-saved-hint",
    text: "",
    dataset: { testid: "ai-config-saved-hint" },
  });

  const collect = (): AiConfig => ({
    // 비워 두면 기본값으로 저장한다.
    baseUrl: baseUrl.input.value.trim() || DEFAULT_BASE_URL,
    model: model.input.value.trim() || DEFAULT_MODEL,
    liteModel: liteModel.input.value.trim() || DEFAULT_LITE_MODEL,
    apiKey: apiKey.input.value,
    maxToolCalls: defaultAiConfig().maxToolCalls,
    maxTokens: Math.max(256, Number(maxTokens.input.value) || defaultAiConfig().maxTokens),
    reasoningEffort: (reasoningSelect.value as AiConfig["reasoningEffort"]) || "medium",
    autoApprove: autoApprove.checked,
  });

  let autoSaveTimer: number | null = null;
  const persist = (showToast: boolean): void => {
    const next = collect();
    saveAiConfig(next);
    onSaved(next);
    savedHint.textContent = "자동 저장됨";
    if (showToast) toast("어시스턴트 설정을 저장했습니다.", "ok");
  };
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
  autoApprove.addEventListener("change", () => persist(false));
  reasoningSelect.addEventListener("change", () => persist(false));

  const saveButton = el("button", {
    class: "ai-assistant-action",
    text: "설정 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-config-save" },
    on: { click: () => persist(true) },
  });

  const details = el("details", {
    class: "ai-config-form",
    dataset: { testid: "ai-config" },
    children: [
      el("summary", { text: "설정 (엔드포인트/모델/API 키)" }),
      baseUrl.row,
      model.row,
      liteModel.row,
      apiKey.row,
      maxTokens.row,
      reasoningRow,
      fontSizeRow,
      autoApproveRow,
      el("div", { class: "ai-config-actions", children: [saveButton, savedHint] }),
    ],
  });
  return {
    element: details,
    focusFirstInput: () => baseUrl.input.focus(),
    focusApiKey: () => apiKey.input.focus(),
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
