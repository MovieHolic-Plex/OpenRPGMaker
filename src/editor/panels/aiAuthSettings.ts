import { fetchChatGptAuthStatus, isChatGptCompanionResponseError, refreshCompanionAuth, saveCompanionApiKey, startChatGptLogin } from "@/ai/chatgptOAuthClient";
import type { AiConfig } from "@/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER, getOhMyPiProvider, OH_MY_PI_PROVIDERS, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { el } from "@/util/dom";

export interface AiAuthSettingsView {
  readonly element: HTMLElement;
  readonly focus: () => void;
  readonly setMode: (mode: AiConfig["authMode"]) => void;
}

export function renderAiAuthSettings(
  initialMode: AiConfig["authMode"],
  onModeChange: (mode: AiConfig["authMode"]) => void,
  options?: {
    readonly initialProviderId?: string;
    readonly onProviderChange?: (providerId: string) => void;
  },
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
  const providerCopy = el("span", { text: "선택한 제공자의 토큰·키는 로컬 동반 서비스가 보관·갱신합니다. 브라우저에는 두지 않습니다." });
  const companionKey = el("input", {
    class: "ai-companion-key",
    attrs: { type: "password", placeholder: "제공자 키 (동반 서비스에만 저장)", "aria-label": "동반 서비스 API 키" },
    dataset: { testid: "ai-companion-api-key" },
  }) as HTMLInputElement;
  const saveKeyButton = el("button", {
    class: "ai-assistant-action",
    text: "키 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-companion-save-key" },
  });
  const companionKeyRow = el("div", {
    class: "ai-oauth-actions",
    children: [companionKey, saveKeyButton],
  });
  const chatGptPanel = el("div", {
    class: "ai-auth-panel",
    children: [
      el("div", { class: "ai-auth-panel-copy", children: [
        el("span", { class: "ai-auth-kicker", text: "OH-MY-PI · 로컬 인증" }),
        el("strong", { text: "제공자 로그인 또는 키" }),
        providerCopy,
      ] }),
      el("div", { class: "ai-oauth-actions", children: [status, loginButton] }),
      companionKeyRow,
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
  const providerSelect = el("select", {
    class: "ai-oh-my-pi-provider",
    attrs: { "aria-label": "oh-my-pi 제공자" },
    dataset: { testid: "ai-oh-my-pi-provider" },
    children: OH_MY_PI_PROVIDERS.map((provider) =>
      el("option", {
        text: `${provider.label} · ${provider.authKind}`,
        attrs: { value: provider.id },
      }),
    ),
  }) as HTMLSelectElement;
  let providerId = parseOhMyPiProvider(options?.initialProviderId, DEFAULT_OH_MY_PI_PROVIDER);
  let connected = false;
  providerSelect.value = providerId;
  const applyProviderChrome = (): void => {
    const meta = getOhMyPiProvider(providerId);
    companionKeyRow.hidden = meta?.id === "openai-codex";
    loginButton.textContent = connected ? "상태 확인" : (meta?.authKind === "oauth" ? "로그인" : "연결");
    providerCopy.textContent = meta
      ? `${meta.label} · ${meta.authKind === "oauth" ? "OAuth/로그인" : meta.authKind === "local" ? "로컬 서버" : "API 키"} — 시크릿은 이 PC의 동반 서비스만 보관합니다.`
      : providerCopy.textContent;
  };
  providerSelect.addEventListener("change", () => {
    providerId = parseOhMyPiProvider(providerSelect.value);
    options?.onProviderChange?.(providerId);
    applyProviderChrome();
    void refreshStatus();
  });
  const chatGptButton = authButton("ChatGPT 구독", "ai-auth-chatgpt");
  const apiKeyButton = authButton("API / 게이트웨이", "ai-auth-api-key");
  let mode = initialMode;

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
      const auth = await fetchChatGptAuthStatus(providerId);
      connected = auth.connected;
      status.textContent = auth.connected
        ? `연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`
        : "로그인 필요";
      status.dataset.tone = auth.connected ? "connected" : "disconnected";
      applyProviderChrome();
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
      void refreshCompanionAuth(providerId)
        .then(() => refreshStatus())
        .catch(() => void refreshStatus());
      return;
    }
    loginButton.disabled = true;
    status.textContent = "로그인 준비 중…";
    void startChatGptLogin(providerId, companionKey.value)
      .then((login) => {
        if (login.connected) {
          status.textContent = "연결됨";
          status.dataset.tone = "connected";
          connected = true;
          applyProviderChrome();
          return;
        }
        if (login.needsApiKey) {
          deviceCode.hidden = false;
          deviceCode.textContent = login.instructions || "이 제공자는 아래 칸에 키를 넣고 키 저장 또는 연결을 누르세요.";
          status.textContent = "키 필요";
          return;
        }
        deviceCode.hidden = false;
        deviceCode.textContent = login.userCode
          ? `코드 ${login.userCode} · ${login.verificationUrl}`
          : login.verificationUrl || login.instructions || "브라우저에서 로그인을 마치면 연결됩니다.";
        if (login.verificationUrl && typeof window.open === "function") {
          window.open(login.verificationUrl, "_blank", "noopener,noreferrer");
        }
        status.textContent = "브라우저에서 로그인 대기 중";
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

  saveKeyButton.addEventListener("click", () => {
    const key = companionKey.value.trim();
    if (!key) {
      status.textContent = "키를 입력하세요";
      return;
    }
    saveKeyButton.disabled = true;
    void saveCompanionApiKey(providerId, key)
      .then((auth) => {
        connected = auth.connected;
        status.textContent = auth.connected ? "연결됨 · 키 저장됨" : "키 저장 실패";
        status.dataset.tone = auth.connected ? "connected" : "disconnected";
        applyProviderChrome();
      })
      .catch((error: unknown) => {
        if (isChatGptCompanionResponseError(error)) {
          showServerError(error);
          return;
        }
        status.textContent = "로컬 연결 서비스를 먼저 실행하세요";
        status.dataset.tone = "offline";
        companionHint.hidden = false;
      })
      .finally(() => {
        saveKeyButton.disabled = false;
      });
  });

  applyMode(initialMode);
  applyProviderChrome();
  void refreshStatus();
  return {
    element: el("section", {
      class: "ai-auth-settings",
      attrs: { "aria-label": "AI 연결 방식" },
      children: [
        el("span", { class: "ai-config-label", text: "연결 방식" }),
        el("span", { class: "ai-config-label", text: "oh-my-pi 제공자" }),
        providerSelect,
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
