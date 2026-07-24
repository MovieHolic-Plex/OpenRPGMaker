import { fetchChatGptAuthStatus, startChatGptLogin } from "@/ai/chatgptOAuthClient";
import type { AiConfig } from "@/ai/llmClient";
import { el } from "@/util/dom";

export interface AiAuthSettingsView {
  readonly element: HTMLElement;
  readonly focus: () => void;
  readonly setMode: (mode: AiConfig["authMode"]) => void;
}

export function renderAiAuthSettings(
  initialMode: AiConfig["authMode"],
  onModeChange: (mode: AiConfig["authMode"]) => void
): AiAuthSettingsView {
  const status = el("span", {
    class: "ai-oauth-status",
    text: "연결 확인 중…",
    attrs: { role: "status" },
    dataset: { testid: "ai-oauth-status" },
  });
  const deviceCode = el("div", {
    class: "ai-oauth-device-code",
    attrs: { hidden: "" },
    dataset: { testid: "ai-oauth-device-code" },
  });
  const loginButton = el("button", {
    class: "ai-assistant-action ai-oauth-login",
    text: "구독 연결",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-login" },
  });
  const companionHint = el("div", {
    class: "ai-oauth-companion-hint",
    text: "로컬 연결 서비스가 필요합니다. 터미널에서 npm run ai:oauth 를 한 번 실행하세요.",
  });
  const chatGptPanel = el("div", {
    class: "ai-auth-panel",
    children: [
      el("div", { class: "ai-auth-panel-copy", children: [
        el("span", { class: "ai-auth-kicker", text: "CHATGPT · OAUTH" }),
        el("strong", { text: "ChatGPT 구독으로 작업" }),
        el("span", { text: "Codex가 토큰을 보관·갱신합니다. 브라우저에는 토큰을 저장하지 않습니다." }),
      ] }),
      el("div", { class: "ai-oauth-actions", children: [status, loginButton] }),
      deviceCode,
      companionHint,
    ],
  });
  const apiPanel = el("div", {
    class: "ai-auth-panel ai-auth-api-note",
    children: [
      el("div", { class: "ai-auth-panel-copy", children: [
        el("span", { class: "ai-auth-kicker", text: "API · GATEWAY" }),
        el("strong", { text: "공급자 키 또는 OpenAI 호환 게이트웨이" }),
        el("span", { text: "Claude, Gemini, Grok 등은 공식 API 또는 OpenRouter 같은 호환 게이트웨이 키로 연결합니다." }),
      ] }),
      el("span", { class: "ai-auth-api-cost", text: "요청 비용은 연결한 공급자 계정에 청구됩니다." }),
    ],
  });
  const chatGptButton = authButton("ChatGPT 구독", "ai-auth-chatgpt");
  const apiKeyButton = authButton("API / 게이트웨이", "ai-auth-api-key");
  let mode = initialMode;
  let connected = false;

  const applyMode = (next: AiConfig["authMode"]): void => {
    mode = next;
    const chatGptActive = mode === "chatgpt";
    chatGptButton.classList.toggle("is-active", chatGptActive);
    apiKeyButton.classList.toggle("is-active", !chatGptActive);
    chatGptButton.setAttribute("aria-pressed", String(chatGptActive));
    apiKeyButton.setAttribute("aria-pressed", String(!chatGptActive));
    chatGptPanel.hidden = !chatGptActive;
    apiPanel.hidden = chatGptActive;
  };
  const setMode = (next: AiConfig["authMode"]): void => {
    applyMode(next);
    onModeChange(next);
  };
  chatGptButton.addEventListener("click", () => setMode("chatgpt"));
  apiKeyButton.addEventListener("click", () => setMode("apiKey"));

  const refreshStatus = async (): Promise<void> => {
    try {
      const auth = await fetchChatGptAuthStatus();
      connected = auth.connected;
      status.textContent = auth.connected
        ? `연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`
        : "로그인 필요";
      status.dataset.tone = auth.connected ? "connected" : "disconnected";
      loginButton.textContent = auth.connected ? "상태 확인" : "구독 연결";
      companionHint.hidden = auth.connected;
    } catch {
      status.textContent = "로컬 연결 서비스 필요";
      status.dataset.tone = "offline";
      companionHint.hidden = false;
    }
  };
  loginButton.addEventListener("click", () => {
    if (connected) {
      void refreshStatus();
      return;
    }
    loginButton.disabled = true;
    status.textContent = "로그인 준비 중…";
    void startChatGptLogin()
      .then((login) => {
        deviceCode.hidden = false;
        deviceCode.textContent = `코드 ${login.userCode} · ${login.verificationUrl}`;
        if (typeof window.open === "function") window.open(login.verificationUrl, "_blank", "noopener,noreferrer");
        status.textContent = "브라우저에서 코드 입력 대기 중";
        if (typeof window.setTimeout === "function") window.setTimeout(() => void refreshStatus(), 5000);
      })
      .catch(() => {
        status.textContent = "로컬 연결 서비스를 먼저 실행하세요";
        status.dataset.tone = "offline";
      })
      .finally(() => {
        loginButton.disabled = false;
      });
  });

  applyMode(initialMode);
  void refreshStatus();
  return {
    element: el("section", {
      class: "ai-auth-settings",
      attrs: { "aria-label": "AI 연결 방식" },
      children: [
        el("span", { class: "ai-config-label", text: "연결 방식" }),
        el("div", { class: "ai-auth-mode", attrs: { role: "group" }, children: [chatGptButton, apiKeyButton] }),
        chatGptPanel,
        apiPanel,
      ],
    }),
    focus: () => chatGptButton.focus(),
    setMode: applyMode,
  };
}

function authButton(text: string, testid: string): HTMLButtonElement {
  return el("button", {
    class: "ai-auth-mode-button",
    text,
    attrs: { type: "button" },
    dataset: { testid },
  }) as HTMLButtonElement;
}
