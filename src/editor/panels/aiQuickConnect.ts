// editor/panels/aiQuickConnect.ts
// 빠른 AI 연결 — 처음 쓰는 사람이 OpenRouter 키 하나(또는 OpenAI 호환 서버 주소·키·모델)로 바로 시작하는 카드.
//
// 「연결」 을 누르면 동반 서비스가 도구 달린 채팅을 한 번 보내 보고, 통과할 때만 키를 저장 파일(0600)에 넣는다
// (/auth/openai-compat/connect). 키는 브라우저 저장소·프로젝트 파일에 남지 않는다 — 입력칸은 성공하면 비운다.
// 쓰는 곳: AI 설정 「연결」 탭 맨 위, 연결 관문(aiConnectGate) 안. 첫 실행 화면도 이 카드를 그대로 끼울 수 있다.

import { connectOpenAiCompatEndpoint, ChatGptCompanionResponseError } from "@/ai/chatgptOAuthClient";
import { OPENROUTER_DEFAULT_MODEL, OPENROUTER_KEYS_URL, type OpenAiCompatEndpointPublic } from "@/ai/openAiCompat";
import { el } from "@/util/dom";
import "@/styles/components/ai-quick-connect.css";

export const AI_QUICK_CONNECT_TESTIDS = {
  host: "ai-quick-connect",
  kindOpenRouter: "ai-quick-connect-kind-openrouter",
  kindCustom: "ai-quick-connect-kind-custom",
  key: "ai-quick-connect-key",
  baseUrl: "ai-quick-connect-baseurl",
  model: "ai-quick-connect-model",
  submit: "ai-quick-connect-submit",
  status: "ai-quick-connect-status",
} as const;

export interface AiQuickConnectOptions {
  /** 시험을 통과해 저장된 뒤 한 번 불린다. 호출부가 이 엔드포인트를 기본 연결로 고른다. */
  readonly onConnected: (endpoint: OpenAiCompatEndpointPublic, model: string) => void | Promise<void>;
}

export interface AiQuickConnectView {
  readonly element: HTMLElement;
  readonly focus: () => void;
}

type Kind = "openrouter" | "custom";

function field(label: string, input: HTMLInputElement, hint?: HTMLElement): HTMLElement {
  return el("label", {
    class: "ai-quick-connect-field",
    children: [el("span", { class: "ai-quick-connect-label", text: label }), input, ...(hint ? [hint] : [])],
  });
}

function textInput(testid: string, type: string, placeholder: string, value = ""): HTMLInputElement {
  const input = el("input", {
    class: "ai-quick-connect-input",
    attrs: { type, placeholder, autocomplete: "off", spellcheck: "false" },
    dataset: { testid },
  }) as HTMLInputElement;
  input.value = value;
  return input;
}

export function renderAiQuickConnect(options: AiQuickConnectOptions): AiQuickConnectView {
  let kind: Kind = "openrouter";
  let busy = false;

  const kindButton = (id: Kind, text: string, testid: string) => el("button", {
    class: "ai-quick-connect-kind",
    text,
    attrs: { type: "button", role: "radio", "aria-checked": String(id === kind) },
    dataset: { testid, kind: id },
  }) as HTMLButtonElement;
  const openRouterButton = kindButton("openrouter", "OpenRouter 키", AI_QUICK_CONNECT_TESTIDS.kindOpenRouter);
  const customButton = kindButton("custom", "다른 OpenAI 호환 서버", AI_QUICK_CONNECT_TESTIDS.kindCustom);

  const keyInput = textInput(AI_QUICK_CONNECT_TESTIDS.key, "password", "sk-or-…");
  const baseUrlInput = textInput(AI_QUICK_CONNECT_TESTIDS.baseUrl, "url", "https://example.com/v1");
  const modelInput = textInput(AI_QUICK_CONNECT_TESTIDS.model, "text", OPENROUTER_DEFAULT_MODEL, OPENROUTER_DEFAULT_MODEL);
  const keysLink = el("a", {
    class: "ai-quick-connect-link",
    text: "OpenRouter 에서 키 만들기",
    attrs: { href: OPENROUTER_KEYS_URL, target: "_blank", rel: "noopener noreferrer" },
  });
  const keyField = field("API 키", keyInput, keysLink);
  const baseUrlField = field("기본 주소", baseUrlInput);
  const modelHint = el("span", { class: "ai-quick-connect-hint", text: "도구 호출을 지원하는 모델이어야 해요. 나중에 바꿀 수 있어요." });
  const modelField = field("모델", modelInput, modelHint);

  const submit = el("button", {
    class: "ai-quick-connect-submit",
    text: "연결",
    attrs: { type: "submit" },
    dataset: { testid: AI_QUICK_CONNECT_TESTIDS.submit },
  }) as HTMLButtonElement;
  const status = el("p", {
    class: "ai-quick-connect-status",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: AI_QUICK_CONNECT_TESTIDS.status, tone: "idle" },
  });
  const setStatus = (text: string, tone: "idle" | "busy" | "ok" | "error"): void => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const applyKind = (next: Kind): void => {
    kind = next;
    openRouterButton.setAttribute("aria-checked", String(kind === "openrouter"));
    customButton.setAttribute("aria-checked", String(kind === "custom"));
    baseUrlField.hidden = kind === "openrouter";
    keysLink.hidden = kind !== "openrouter";
    keyInput.placeholder = kind === "openrouter" ? "sk-or-…" : "필요 없으면 비워 두세요";
    modelInput.placeholder = kind === "openrouter" ? OPENROUTER_DEFAULT_MODEL : "서버의 모델 ID";
    if (kind === "custom" && modelInput.value === OPENROUTER_DEFAULT_MODEL) modelInput.value = "";
    if (kind === "openrouter" && !modelInput.value.trim()) modelInput.value = OPENROUTER_DEFAULT_MODEL;
    setStatus("", "idle");
  };
  openRouterButton.addEventListener("click", () => { if (!busy) applyKind("openrouter"); });
  customButton.addEventListener("click", () => { if (!busy) applyKind("custom"); });

  const form = el("form", {
    class: "ai-quick-connect",
    attrs: { "aria-label": "빠른 AI 연결", novalidate: "" },
    dataset: { testid: AI_QUICK_CONNECT_TESTIDS.host },
    children: [
      el("div", { class: "ai-quick-connect-title", text: "키 하나로 바로 연결" }),
      el("p", { class: "ai-quick-connect-lead", text: "API 키를 붙여 넣고 연결을 누르세요. 실제로 한 번 물어보고, 대답이 오면 저장해요." }),
      el("div", { class: "ai-quick-connect-kinds", attrs: { role: "radiogroup", "aria-label": "연결 방법" }, children: [openRouterButton, customButton] }),
      baseUrlField,
      keyField,
      modelField,
      el("div", { class: "ai-quick-connect-actions", children: [submit, status] }),
    ],
  }) as HTMLFormElement;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) return;
    const apiKey = keyInput.value.trim();
    const model = modelInput.value.trim();
    const baseUrl = baseUrlInput.value.trim();
    if (kind === "openrouter" && !apiKey) { setStatus("OpenRouter API 키를 붙여 넣어 주세요.", "error"); keyInput.focus(); return; }
    if (kind === "custom" && !baseUrl) { setStatus("서버의 기본 주소를 넣어 주세요.", "error"); baseUrlInput.focus(); return; }
    if (!model) { setStatus("쓸 모델 ID 를 넣어 주세요.", "error"); modelInput.focus(); return; }
    busy = true;
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    setStatus("모델에게 한 번 물어보는 중이에요…", "busy");
    void connectOpenAiCompatEndpoint({ kind, model, ...(apiKey ? { apiKey } : {}), ...(kind === "custom" ? { baseUrl } : {}) })
      .then(async (result) => {
        if (!result.ok || !result.endpoint) { setStatus(result.message || "연결하지 못했어요. 키와 모델을 확인해 주세요.", "error"); return; }
        keyInput.value = "";
        setStatus(result.message, "ok");
        await options.onConnected(result.endpoint, result.model || model);
      })
      .catch((error: unknown) => {
        const text = error instanceof ChatGptCompanionResponseError && error.serverMessage
          ? error.serverMessage
          : "연결 서비스에 닿지 못했어요. 앱을 다시 켜고 시도해 주세요.";
        setStatus(text, "error");
      })
      .finally(() => {
        busy = false;
        submit.disabled = false;
        form.removeAttribute("aria-busy");
      });
  });

  applyKind("openrouter");
  return { element: form, focus: () => (kind === "custom" ? baseUrlInput : keyInput).focus() };
}
