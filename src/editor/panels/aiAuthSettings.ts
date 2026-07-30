import { fetchChatGptAuthStatus, isChatGptCompanionResponseError, startChatGptLogin } from "@/ai/chatgptOAuthClient";
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
  // (A) 서버에 아예 닿지 못함 — 동반 서비스가 켜져 있지 않을 때만 보이는 힌트.
  const companionHint = el("div", {
    class: "ai-oauth-companion-hint",
    text: "로컬 연결 서비스가 필요합니다. 터미널에서 npm run ai:oauth 를 한 번 실행하세요.",
  });
  // (B) 서버가 응답했지만 내부 오류 — 서버가 알려준 원인을 그대로 보여준다.
  // npm run ai:oauth 힌트는 이 경우 절대 띄우지 않는다(아래 showServerError 주석 참고).
  const serverError = el("div", {
    class: "ai-oauth-companion-hint ai-oauth-server-error",
    attrs: { hidden: "" },
    dataset: { testid: "ai-oauth-server-error" },
  });
  // 서버가 준 원인은 공백 없는 긴 문자열일 수 있다 — 패널 폭을 넘지 않게 어디서든 줄바꿈 허용.
  serverError.style.overflowWrap = "anywhere";
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
      serverError,
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

  // (B) 서버가 응답했지만 내부 오류인 경우의 표시. 서버가 준 원인을 그대로 보여준다.
  // npm run ai:oauth 힌트는 숨긴다 — dev 서버(codexOAuthPlugin)와 단독 동반 서비스
  // (scripts/chatgpt-oauth-companion.mjs)는 같은 spawnCodexSession() 을 쓰므로, 동반 서비스를
  // 따로 실행해도 같은 지점에서 똑같이 죽는다. 안내를 따르면 시간만 버린다.
  const showServerError = (error: unknown): void => {
    const detail = isChatGptCompanionResponseError(error) && error.serverMessage
      ? error.serverMessage
      : error instanceof Error && error.message
        ? error.message
        : "알 수 없는 오류";
    status.textContent = "연결 서비스 내부 오류";
    status.dataset.tone = "offline";
    companionHint.hidden = true;
    serverError.hidden = false;
    // 안내 문구 + 서버가 준 원인 문자열. 원인은 길 수 있어 줄바꿈으로 감싼다(레이아웃 보호).
    const isCodexError = /codex/iu.test(detail);
    const guidance = isCodexError
      ? "codex 프로그램 쪽 문제일 수 있어요. 개발 서버를 껐다 켜 보세요. 그래도 안 되면 codex CLI 가 설치돼 있는지 확인하세요."
      : "개발 서버를 껐다 켜 보세요. 그래도 안 되면 이 화면을 복사해 개발자에게 알려주세요.";
    serverError.textContent = `연결 서비스가 응답했지만 오류가 났어요. ${guidance} 오류 내용: ${detail}`;
  };
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
      serverError.hidden = true;
    } catch (error) {
      if (isChatGptCompanionResponseError(error)) {
        // (B) 서버가 응답했지만 실패 — 원인을 그대로 보여준다.
        showServerError(error);
        return;
      }
      // (A) 서버에 아예 닿지 못함 — 동반 서비스가 켜져 있지 않다는 뜻.
      status.textContent = "로컬 연결 서비스 필요";
      status.dataset.tone = "offline";
      companionHint.hidden = false;
      serverError.hidden = true;
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
      .catch((error: unknown) => {
        if (isChatGptCompanionResponseError(error)) {
          // (B) 서버가 응답했지만 실패 — 로그인도 같은 spawnCodexSession 을 쓰므로 여기서 깨진 것이다.
          showServerError(error);
          return;
        }
        // (A) 서버에 아예 닿지 못함 — 동반 서비스가 켜져 있지 않다는 뜻.
        status.textContent = "로컬 연결 서비스를 먼저 실행하세요";
        status.dataset.tone = "offline";
        companionHint.hidden = false;
        serverError.hidden = true;
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
