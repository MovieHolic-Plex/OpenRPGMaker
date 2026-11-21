// editor/panels/aiOpenAiDirectSettings.ts
// 「OpenAI 호환 API (직접 입력)」 — 기본 주소·API 키·모델만으로 조수를 붙이는 연결 칸.
//
// 키는 이 화면의 password 칸에만 잠시 있고, 「모델 불러오기」·「연결 시험」·「이 연결로 조수 사용」이
// 동반 서비스(/auth/openai-compat/test · /connect)로 한 번 보낸다. 브라우저는 사용자가 적은 주소를
// 직접 부르지 않는다(OpenDesign 은 브라우저 CORS 사전 요청을 405 로 거절한다). 저장본은
// ~/.oprn/openai-compat-endpoints.json(0600)이고, 응답·localStorage·프로젝트 내보내기에는 키가 없다.
// 성공하면 입력칸을 비운다. 상태 문장에 키가 섞여 오면 화면에서 지운다.

import {
  ChatGptCompanionResponseError,
  connectOpenAiCompatEndpoint,
  testOpenAiCompatEndpoint,
  type OpenAiCompatConnectRequest,
  type OpenAiCompatTestResponse,
} from "@/ai/chatgptOAuthClient";
import { isLegacyTerraModel } from "@/ai/chatgptDefault";
import { HOST_AI_DISABLED_GUIDANCE, isHostAiDisabledMessage } from "@/ai/hostAiDisabled";
import {
  OPENAI_COMPAT_PRESETS,
  checkOpenAiCompatBaseUrl,
  type OpenAiCompatEndpointPublic,
  type OpenAiCompatPreset,
} from "@/ai/openAiCompat";
import { el } from "@/util/dom";

export const AI_OPENAI_DIRECT_TESTIDS = {
  host: "ai-openai-direct",
  preset: "ai-openai-direct-preset",
  baseUrl: "ai-openai-direct-baseurl",
  key: "ai-openai-direct-key",
  model: "ai-openai-direct-model",
  modelList: "ai-openai-direct-model-list",
  loadModels: "ai-openai-direct-load-models",
  test: "ai-openai-direct-test",
  use: "ai-openai-direct-use",
  status: "ai-openai-direct-status",
} as const;

export interface AiOpenAiDirectSettingsOptions {
  /** 도구 호출 시험까지 통과해 서버에 저장된 뒤. 호출부가 이 엔드포인트와 모델을 조수의 모든 역할에 꽂는다. */
  readonly onUse: (endpoint: OpenAiCompatEndpointPublic, model: string) => void | Promise<void>;
}

export interface AiOpenAiDirectSettingsView {
  readonly element: HTMLElement;
  readonly focusKey: () => void;
  readonly dispose: () => void;
}

const KEY_MASK = "••••••••";

function describeError(error: unknown): string {
  if (error instanceof ChatGptCompanionResponseError) {
    if (error.serverMessage && isHostAiDisabledMessage(error.serverMessage)) return HOST_AI_DISABLED_GUIDANCE;
    return error.serverMessage ?? `연결 서비스가 ${error.httpStatus} 로 응답했어요.`;
  }
  const reason = (error as { reason?: string } | undefined)?.reason;
  return reason === "timeout"
    ? "연결 서비스의 응답이 늦어요. 잠시 뒤 다시 시도하세요."
    : "연결 서비스에 닿지 못했어요. 앱을 다시 열거나 서버 관리자에게 알려 주세요.";
}

/** 상태 문장에 사용자가 방금 넣은 키가 섞여 있으면 마스크로 바꾼다. 로그에는 이 함수 앞의 원문을 남기지 않는다. */
export function redactOpenAiDirectSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    const value = secret.trim();
    if (value.length < 6) continue;
    out = out.split(value).join(KEY_MASK);
  }
  return out;
}

/** 프리셋이 적어 둔 정책만 붙인다. 없는 칸은 보내지 않아 이미 저장된 허용·그림 설정을 빈 값으로 덮지 않는다. */
function presetRequest(entry: OpenAiCompatPreset | undefined): Pick<OpenAiCompatConnectRequest, "reasoningMode" | "allowModels" | "blockModels" | "supportsImages" | "imageModels"> {
  if (!entry) return {};
  return {
    ...(entry.reasoningMode ? { reasoningMode: entry.reasoningMode } : {}),
    ...(entry.allowModels?.length ? { allowModels: [...entry.allowModels] } : {}),
    ...(entry.blockModels?.length ? { blockModels: [...entry.blockModels] } : {}),
    ...(entry.supportsImages !== undefined ? { supportsImages: entry.supportsImages } : {}),
    ...(entry.imageModels?.length ? { imageModels: [...entry.imageModels] } : {}),
  };
}

function field(label: string, control: HTMLElement, hint?: HTMLElement): HTMLElement {
  return el("label", {
    class: "ai-quick-connect-field",
    children: [
      el("span", { class: "ai-quick-connect-label", text: label }),
      control,
      ...(hint ? [hint] : []),
    ],
  });
}

export function renderAiOpenAiDirectSettings(options: AiOpenAiDirectSettingsOptions): AiOpenAiDirectSettingsView {
  let disposed = false;
  let busy = false;
  let appliedSuggestion = "";

  const preset = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "프리셋" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.preset },
    children: [
      el("option", { attrs: { value: "" }, text: "직접 입력" }),
      ...OPENAI_COMPAT_PRESETS.map((entry) => el("option", { attrs: { value: entry.id }, text: entry.label })),
    ],
  }) as HTMLSelectElement;
  const baseUrl = el("input", {
    class: "ai-quick-connect-input",
    attrs: { type: "url", placeholder: "https://example.com/v1", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.baseUrl },
  }) as HTMLInputElement;
  const apiKey = el("input", {
    class: "ai-quick-connect-input",
    attrs: {
      type: "password", autocomplete: "new-password", spellcheck: "false", name: "oprn-openai-direct-key",
      placeholder: "sk-…",
    },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.key },
  }) as HTMLInputElement;
  const model = el("input", {
    class: "ai-quick-connect-input",
    attrs: { type: "text", placeholder: "서버의 모델 ID", autocomplete: "off", spellcheck: "false", list: "ai-openai-direct-models" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.model },
  }) as HTMLInputElement;
  const modelList = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "불러온 모델", hidden: "" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.modelList },
  }) as HTMLSelectElement;
  const hint = el("span", { class: "ai-quick-connect-hint", text: "기본 주소는 보통 /v1 로 끝나요. 키는 이 PC에만 저장돼요." });
  const status = el("p", {
    class: "ai-quick-connect-status",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.status, tone: "idle" },
  });
  const loadButton = el("button", {
    class: "ai-assistant-action",
    text: "모델 불러오기",
    attrs: { type: "button" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.loadModels },
  }) as HTMLButtonElement;
  const testButton = el("button", {
    class: "ai-assistant-action",
    text: "연결 시험",
    attrs: { type: "button" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.test },
  }) as HTMLButtonElement;
  const useButton = el("button", {
    class: "ai-assistant-action is-primary",
    text: "이 연결로 조수 사용",
    attrs: { type: "button" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.use },
  }) as HTMLButtonElement;

  const setStatus = (text: string, tone: "idle" | "busy" | "ok" | "error"): void => {
    status.textContent = redactOpenAiDirectSecrets(text, [apiKey.value]);
    status.dataset.tone = tone;
  };
  const selectedPreset = (): OpenAiCompatPreset | undefined =>
    OPENAI_COMPAT_PRESETS.find((entry) => entry.id === preset.value);
  const root = el("div", {
    class: "ai-quick-connect",
    attrs: { "aria-label": "OpenAI 호환 API (직접 입력)" },
    dataset: { testid: AI_OPENAI_DIRECT_TESTIDS.host },
    children: [
      el("p", {
        class: "ai-quick-connect-lead",
        text: "OpenAI 호환 서버의 주소와 키, 모델을 넣으세요. 조수의 대화와 도구 호출은 앱 서버를 거쳐 나갑니다.",
      }),
      field("프리셋", preset),
      field("기본 주소", baseUrl),
      field("API 키", apiKey, el("span", { class: "ai-quick-connect-hint", text: "가려서 표시됩니다. 프로젝트 파일에는 저장되지 않아요." })),
      field("모델", el("span", { class: "ai-config-stack", children: [model, modelList] }), hint),
      el("div", { class: "ai-quick-connect-actions", children: [loadButton, testButton, useButton] }),
      status,
    ],
  });
  const setBusy = (next: boolean): void => {
    busy = next;
    for (const button of [loadButton, testButton, useButton]) button.disabled = next;
    // 응답이 오기 전에 프리셋을 바꾸면, 끝난 요청이 다른 주소의 목록을 채우거나 방금 넣은 키를 지운다.
    for (const control of [preset, baseUrl, apiKey, model, modelList]) control.disabled = next;
    root.setAttribute("aria-busy", next ? "true" : "false");
  };
  const requireBase = (): string | null => {
    const check = checkOpenAiCompatBaseUrl(baseUrl.value);
    if (!check.ok || !check.url) {
      setStatus(check.error ?? "기본 주소를 확인해 주세요.", "error");
      baseUrl.focus();
      return null;
    }
    if (check.hostKind === "public" && !apiKey.value.trim()) {
      setStatus("공개 주소에는 API 키를 넣어 주세요.", "error");
      apiKey.focus();
      return null;
    }
    return check.url;
  };
  const requireModel = (): string | null => {
    const id = model.value.trim();
    if (!id) {
      setStatus("쓸 모델 ID 를 넣거나 목록에서 고르세요.", "error");
      model.focus();
      return null;
    }
    if (isLegacyTerraModel(id)) {
      setStatus("지원되는 다른 모델 ID를 골라 주세요.", "error");
      model.focus();
      return null;
    }
    return id;
  };
  const fillModels = (models: readonly string[]): void => {
    const choices = models.filter((id) => !isLegacyTerraModel(id));
    modelList.hidden = choices.length === 0;
    modelList.replaceChildren(
      el("option", { attrs: { value: "" }, text: choices.length ? `목록에서 고르기 (${choices.length}개)` : "받은 목록 없음" }),
      ...choices.map((id) => el("option", { attrs: { value: id }, text: id })),
    );
    const current = model.value.trim();
    modelList.value = choices.includes(current) ? current : "";
    if (!current && choices.includes(appliedSuggestion)) model.value = appliedSuggestion;
  };
  const showTest = (response: OpenAiCompatTestResponse, probed: boolean): void => {
    if (response.models.length) fillModels(response.models);
    const tools = response.toolsOk === true ? "도구 호출 가능"
      : response.toolsOk === false ? "도구 호출 불가 — 조수는 도구로 맵을 고치므로 이 모델은 쓸 수 없어요"
      : probed ? "도구 호출은 확인하지 못했어요" : "";
    const head = response.ok ? "연결됨" : "연결 실패";
    setStatus([head, response.message, tools].filter(Boolean).join(" · "), response.ok && response.toolsOk !== false ? "ok" : "error");
  };

  preset.addEventListener("change", () => {
    const entry = selectedPreset();
    hint.textContent = entry?.hint ?? "기본 주소는 보통 /v1 로 끝나요. 키는 이 PC에만 저장돼요.";
    if (!entry) return;
    baseUrl.value = entry.baseUrl;
    const suggestion = entry.suggestedModel ?? "";
    if (!model.value.trim() || model.value.trim() === appliedSuggestion) model.value = suggestion;
    appliedSuggestion = suggestion;
    setStatus("", "idle");
  });
  modelList.addEventListener("change", () => {
    if (modelList.value) model.value = modelList.value;
  });

  loadButton.addEventListener("click", () => {
    if (busy || disposed) return;
    const url = requireBase();
    if (!url) return;
    const entry = selectedPreset();
    const policy = presetRequest(entry);
    setBusy(true);
    setStatus("서버에서 모델 목록을 가져오는 중…", "busy");
    // 모델 ID 를 보내지 않으면 동반 서비스는 GET {base}/models 만 한다. 채팅은 나가지 않는다.
    void testOpenAiCompatEndpoint({
      name: entry?.name ?? "OpenAI 호환",
      baseUrl: url,
      ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
      ...(policy.allowModels ? { allowModels: policy.allowModels } : {}),
      ...(policy.blockModels ? { blockModels: policy.blockModels } : {}),
    }).then((response) => {
      if (disposed) return;
      showTest(response, false);
    }).catch((error: unknown) => {
      if (!disposed) setStatus(describeError(error), "error");
    }).finally(() => { if (!disposed) setBusy(false); });
  });

  testButton.addEventListener("click", () => {
    if (busy || disposed) return;
    const url = requireBase();
    const id = url ? requireModel() : null;
    if (!url || !id) return;
    const entry = selectedPreset();
    const policy = presetRequest(entry);
    setBusy(true);
    setStatus("채팅과 도구 호출을 시험하는 중…", "busy");
    void testOpenAiCompatEndpoint({
      name: entry?.name ?? "OpenAI 호환",
      baseUrl: url,
      ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
      model: id,
      probeTools: true,
      ...(policy.allowModels ? { allowModels: policy.allowModels } : {}),
      ...(policy.blockModels ? { blockModels: policy.blockModels } : {}),
    }).then((response) => {
      if (disposed) return;
      showTest(response, true);
    }).catch((error: unknown) => {
      if (!disposed) setStatus(describeError(error), "error");
    }).finally(() => { if (!disposed) setBusy(false); });
  });

  useButton.addEventListener("click", () => {
    if (busy || disposed) return;
    const url = requireBase();
    const id = url ? requireModel() : null;
    if (!url || !id) return;
    const entry = selectedPreset();
    setBusy(true);
    setStatus("도구 호출을 확인하고 이 PC에 저장하는 중…", "busy");
    void connectOpenAiCompatEndpoint({
      kind: "custom",
      name: entry?.name ?? "OpenAI 호환",
      baseUrl: url,
      model: id,
      ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
      ...presetRequest(entry),
    }).then(async (result) => {
      if (disposed) return;
      if (!result.ok || !result.endpoint) {
        setStatus(result.message || "저장하지 못했어요. 키와 모델을 확인해 주세요.", "error");
        return;
      }
      const secret = apiKey.value;
      apiKey.value = "";
      status.textContent = redactOpenAiDirectSecrets(result.message, [secret]);
      status.dataset.tone = "ok";
      await options.onUse(result.endpoint, result.model || id);
    }).catch((error: unknown) => {
      if (!disposed) setStatus(describeError(error), "error");
    }).finally(() => { if (!disposed) setBusy(false); });
  });

  return {
    element: root,
    focusKey: () => apiKey.focus(),
    dispose: () => { disposed = true; },
  };
}
