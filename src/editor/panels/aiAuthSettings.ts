// editor/panels/aiAuthSettings.ts
// AI 연결 방식 패널 — **구독 로그인(OAuth)** 과 **API 키** 두 종류를 엄격히 구분한다.
//
// 두 종류의 공통점과 차이(설계 근거):
//  - 공통: 전송은 항상 로컬 동반 서비스(oh-my-pi)다. 자격 증명도 항상 동반 서비스가 보관한다
//    (~/.rpg-zzu/oh-my-pi-auth.json). 그래서 **브라우저에는 어떤 비밀도 남지 않는다** —
//    이 약속을 `configForConnectionKind` 가 코드로 강제한다.
//  - 차이: 제공자를 무엇으로 인증하느냐. 구독 로그인은 기기 코드 흐름, API 키는 키 저장이다.
//    이 종류는 providerId 의 authKind 에서 **파생**하고 따로 저장하지 않는다.
//
// 이 파일이 고친 옛 결함(전부 2026-08-21 실측):
//  ① 키 입력칸이 "ChatGPT 구독" 패널 안에 있었고, "API / 게이트웨이" 패널에는 입력이 하나도
//     없었다 — 라벨과 내용이 뒤집혀 있었다.
//  ② 키 칸을 `id === "openai-codex"` 로만 숨겨서 나머지 OAuth 제공자 13종에 불필요한 키 칸이 떴다.
//  ③ 제공자 68종을 인증 종류 구분 없이 한 줄로 나열하고, 옵션 텍스트에 영어 enum(`· oauth`)이 샜다.
//  ④ 기기 로그인이 5초 뒤 딱 한 번 폴링해서, 20~60초 걸리는 로그인은 "대기 중"에서 영구히 멈췄다.
//     코드 복사 버튼도, URL 링크도, 취소도 없었다.
//  ⑤ `companionHint`("npm run ai:oauth")에 hidden 이 없어 열 때마다 번쩍였고, 성공 경로에서도
//     미로그인 사용자에게 "서비스가 안 켜졌다"고 오진했다.
//  ⑥ 상태 문구만 바꾸고 tone 을 안 바꾸는 분기가 있어 색 점이 이전 상태로 남았다.

import {
  disconnectCompanionAuth,
  fetchChatGptAuthStatus,
  hasStoredCompanionCredential,
  isChatGptCompanionResponseError,
  refreshCompanionAuth,
  saveCompanionApiKey,
  startChatGptLogin,
  type ChatGptAuthStatus,
  type ChatGptCompanionUnreachableError,
} from "@/ai/chatgptOAuthClient";
import {
  configForConnectionKind,
  defaultProviderForKind,
  editorConnectionKind,
  providersForKind,
  type AiConnectionKindId,
} from "@/ai/aiConnectionKind";
import type { AiConfig } from "@/ai/llmClient";
import {
  OH_MY_PI_AUTH_KIND_LABEL,
  getOhMyPiProvider,
  ohMyPiAuthKind,
  parseOhMyPiProvider,
} from "@/ai/ohMyPiProviders";
import { el } from "@/util/dom";

export interface AiAuthSettingsChange {
  readonly kind: AiConnectionKindId;
  readonly providerId: string;
}

export interface AiAuthSettingsView {
  readonly element: HTMLElement;
  readonly focus: () => void;
  /** 폴링 타이머·진행 중 요청을 정리한다. 모달을 닫을 때 반드시 부른다. */
  readonly dispose: () => void;
}

/** 기기 로그인 폴링 간격·최대 시도. 3초 × 60 = 3분 — 기기 코드 로그인의 현실적 상한이다. */
const DEVICE_POLL_INTERVAL_MS = 3000;
const DEVICE_POLL_MAX_ATTEMPTS = 60;

type Tone = "connected" | "disconnected" | "offline" | "checking";

const KIND_COPY: Record<AiConnectionKindId, { label: string; hint: string }> = {
  oauth: {
    label: "구독 로그인",
    hint: "구독 계정으로 로그인합니다. 키를 입력하지 않습니다.",
  },
  apiKey: {
    label: "API 키",
    hint: "제공자에서 받은 키를 이 PC의 연결 서비스에만 저장합니다.",
  },
};

export function renderAiAuthSettings(
  config: AiConfig,
  onChange: (next: AiAuthSettingsChange) => void,
): AiAuthSettingsView {
  let kind = editorConnectionKind(config);
  let providerId = parseOhMyPiProvider(config.providerId);
  let stored = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pollAttempt = 0;
  let disposed = false;

  // ── 상태 표시 ──────────────────────────────────────────────────────────────
  const status = el("span", {
    class: "ai-oauth-status",
    text: "연결 확인 중…",
    attrs: { role: "status" },
    dataset: { testid: "ai-oauth-status", tone: "checking" },
  });
  const kindBadge = el("span", {
    class: "ai-auth-kind-badge",
    dataset: { testid: "ai-auth-kind-badge" },
  });
  /** 상태 문구와 색을 **함께** 쓴다 — 하나만 바꾸면 색이 이전 상태로 남는다(옛 결함 ⑥). */
  const setStatus = (text: string, tone: Tone): void => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  // ── 종류 선택(radiogroup) ─────────────────────────────────────────────────
  const heading = el("h3", {
    class: "ai-config-label",
    text: "연결 방식",
    attrs: { id: "ai-auth-kind-heading" },
  });
  const kindButtons = new Map<AiConnectionKindId, HTMLButtonElement>();
  const kindGroup = el("div", {
    class: "ai-auth-kinds",
    attrs: { role: "radiogroup", "aria-labelledby": "ai-auth-kind-heading" },
    children: (["oauth", "apiKey"] as const).map((id) => {
      const button = el("button", {
        class: "ai-auth-kind",
        attrs: { type: "button", role: "radio", "aria-checked": "false", tabindex: "-1" },
        dataset: { testid: id === "oauth" ? "ai-auth-oauth" : "ai-auth-api-key" },
        children: [
          el("strong", { text: KIND_COPY[id].label }),
          el("small", { text: KIND_COPY[id].hint }),
        ],
      }) as HTMLButtonElement;
      button.addEventListener("click", () => selectKind(id));
      kindButtons.set(id, button);
      return button;
    }),
  });
  // 라디오 그룹 키보드 관례: 화살표로 선택이 이동한다. 옛 구현은 aria-pressed 토글 두 개를
  // role="group" 에 넣어, 상호배타인데도 독립 토글 두 개로 읽혔다.
  kindGroup.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;
    event.preventDefault();
    selectKind(kind === "oauth" ? "apiKey" : "oauth");
  });

  // ── 제공자 선택 ───────────────────────────────────────────────────────────
  const providerSelect = el("select", {
    class: "ai-config-select ai-oh-my-pi-provider",
    attrs: { id: "ai-auth-provider" },
    dataset: { testid: "ai-oh-my-pi-provider" },
  }) as HTMLSelectElement;
  const providerHelp = el("span", {
    class: "ai-config-help",
    dataset: { testid: "ai-auth-provider-help" },
  });
  providerSelect.addEventListener("change", () => {
    providerId = parseOhMyPiProvider(providerSelect.value);
    applyChrome();
    emit();
    void refreshStatus();
  });

  /**
   * 종류에 속한 제공자만 채운다. optgroup 라벨이 인증 종류를 **한국어로** 담으므로 옵션
   * 텍스트에는 제공자 이름만 넣는다(옛 결함 ③).
   */
  const fillProviders = (): void => {
    const rows = providersForKind(kind);
    const groups = kind === "oauth"
      ? [{ kindKey: "oauth" as const, rows }]
      : [
        { kindKey: "apiKey" as const, rows: rows.filter((row) => row.authKind === "apiKey") },
        { kindKey: "local" as const, rows: rows.filter((row) => row.authKind === "local") },
      ];
    providerSelect.replaceChildren(...groups.flatMap((group) => {
      if (group.rows.length === 0) return [];
      const label = group.kindKey === "local"
        ? `${OH_MY_PI_AUTH_KIND_LABEL.local} (키 불필요)`
        : OH_MY_PI_AUTH_KIND_LABEL[group.kindKey];
      return [el("optgroup", {
        attrs: { label },
        children: group.rows.map((row) => el("option", { text: row.label, attrs: { value: row.id } })),
      })];
    }));
    providerSelect.value = providerId;
  };

  // ── API 키 입력(동반 서비스 보관) ──────────────────────────────────────────
  const companionKey = el("input", {
    class: "ai-config-input ai-companion-key",
    attrs: { type: "password", placeholder: "제공자에서 받은 키", "aria-label": "제공자 API 키" },
    dataset: { testid: "ai-companion-api-key" },
  }) as HTMLInputElement;
  const saveKeyButton = el("button", {
    class: "ai-assistant-action",
    text: "키 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-companion-save-key" },
  }) as HTMLButtonElement;
  const keyRow = el("div", {
    class: "ai-auth-key-row",
    attrs: { hidden: "" },
    dataset: { testid: "ai-companion-key-row" },
    children: [companionKey, saveKeyButton],
  });

  // ── 동작 버튼 ─────────────────────────────────────────────────────────────
  const loginButton = el("button", {
    class: "ai-assistant-action ai-oauth-login",
    text: "로그인",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-login" },
  }) as HTMLButtonElement;

  // 저장된 자격이 있을 때만 보인다 — 지울 것이 없을 때 뜨는 해제 버튼은 거짓말이다.
  // env 자격은 에디터가 지울 수 없으므로 stored 가 false 고, 따라서 이 버튼도 뜨지 않는다.
  const disconnectButton = el("button", {
    class: "ai-assistant-action ai-auth-disconnect",
    text: "연결 해제",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-auth-disconnect" },
  }) as HTMLButtonElement;

  // ── 기기 로그인 블록 ───────────────────────────────────────────────────────
  const deviceUrl = el("a", {
    class: "ai-oauth-device-url",
    attrs: { target: "_blank", rel: "noopener noreferrer" },
    dataset: { testid: "ai-oauth-device-url" },
  }) as HTMLAnchorElement;
  const deviceUserCode = el("code", {
    class: "ai-oauth-device-usercode",
    dataset: { testid: "ai-oauth-device-usercode" },
  });
  const copyCodeButton = el("button", {
    class: "ai-assistant-action",
    text: "코드 복사",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-copy-code" },
  }) as HTMLButtonElement;
  const devicePoll = el("span", {
    class: "ai-oauth-device-poll",
    attrs: { role: "status" },
    dataset: { testid: "ai-oauth-device-poll" },
  });
  const cancelButton = el("button", {
    class: "ai-assistant-action",
    text: "취소",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-device-cancel" },
  }) as HTMLButtonElement;
  const deviceBlock = el("div", {
    class: "ai-oauth-device",
    attrs: { hidden: "" },
    dataset: { testid: "ai-oauth-device-code" },
    children: [
      el("div", { class: "ai-oauth-device-steps", children: [
        el("span", { text: "1. 아래 주소를 열고" }),
        deviceUrl,
        el("span", { text: "2. 이 코드를 입력하세요" }),
        el("div", { class: "ai-oauth-device-code-row", children: [deviceUserCode, copyCodeButton] }),
      ] }),
      el("div", { class: "ai-oauth-device-foot", children: [devicePoll, cancelButton] }),
    ],
  });

  // ── 안내(A) / 오류(B) ─────────────────────────────────────────────────────
  // 두 상자를 나누는 이유: (A) 는 "동반 서비스가 안 켜졌다"라서 npm run ai:oauth 가 해결책이고,
  // (B) 는 서비스가 응답했지만 내부에서 깨진 것이라 그 안내가 시간만 버리게 한다.
  const hint = el("div", {
    class: "ai-auth-hint",
    attrs: { hidden: "" },
    dataset: { testid: "ai-auth-hint" },
  });
  const serverError = el("div", {
    class: "ai-auth-error",
    attrs: { hidden: "", role: "alert" },
    dataset: { testid: "ai-oauth-server-error" },
  });

  // ── 크롬 갱신 ─────────────────────────────────────────────────────────────
  const applyChrome = (): void => {
    const meta = getOhMyPiProvider(providerId);
    const providerKind = ohMyPiAuthKind(providerId);
    for (const [id, button] of kindButtons) {
      const active = id === kind;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
    }
    // 키 칸은 **자격 종류**로 가른다 — 하드코딩된 제공자 id 가 아니다(옛 결함 ②).
    keyRow.hidden = providerKind !== "apiKey";
    providerHelp.textContent = providerKind === "oauth"
      ? `${meta?.label ?? providerId} 계정으로 로그인합니다. 키는 입력하지 않습니다.`
      : providerKind === "local"
        ? `${meta?.label ?? providerId} 는 이 PC에서 도는 로컬 서버라 키가 필요 없습니다.`
        : `${meta?.label ?? providerId} 에서 받은 키가 필요합니다. 키는 이 PC의 연결 서비스에만 저장됩니다.`;
    kindBadge.textContent = stored
      ? OH_MY_PI_AUTH_KIND_LABEL[providerKind]
      : KIND_COPY[kind].label;
    loginButton.textContent = stored
      ? "다시 확인"
      : providerKind === "oauth" ? "로그인" : "연결 확인";
    disconnectButton.hidden = !stored;
  };

  const emit = (): void => {
    onChange({ kind, providerId });
  };

  function selectKind(next: AiConnectionKindId): void {
    if (next === kind) {
      kindButtons.get(next)?.focus();
      return;
    }
    stopPolling();
    kind = next;
    // 종류를 바꾸면 제공자도 그 종류 안으로 스냅한다 — 모순 상태(oauth 종류 + apiKey 제공자)를
    // 만들지 않는다. configForConnectionKind 가 그 규칙의 단일 출처다.
    providerId = parseOhMyPiProvider(
      configForConnectionKind(config, next, defaultProviderForKind(next)).providerId,
    );
    fillProviders();
    applyChrome();
    kindButtons.get(next)?.focus();
    emit();
    void refreshStatus();
  }

  // ── 상태 조회 ─────────────────────────────────────────────────────────────
  const showUnreachable = (error: unknown): void => {
    const reason = (error as ChatGptCompanionUnreachableError | undefined)?.reason;
    setStatus(reason === "timeout" ? "연결 서비스 응답 없음" : "연결 서비스 필요", "offline");
    hint.textContent = reason === "timeout"
      ? "연결 서비스가 응답하지 않습니다. 개발 서버를 껐다 켜 보세요."
      : reason === "not-mounted"
        ? "연결 서비스 경로가 등록되지 않았습니다. 개발 서버를 껐다 켜 보세요."
        : "로컬 연결 서비스가 필요합니다. 터미널에서 npm run ai:oauth 를 한 번 실행하세요.";
    hint.hidden = false;
    serverError.hidden = true;
  };

  const showServerError = (error: unknown): void => {
    const detail = isChatGptCompanionResponseError(error) && error.serverMessage
      ? error.serverMessage
      : error instanceof Error && error.message
        ? error.message
        : "알 수 없는 오류";
    setStatus("연결 서비스 내부 오류", "offline");
    // (A) 안내는 숨긴다 — dev 서버와 단독 동반 서비스는 같은 pi-ai 워커를 쓰므로 재실행해도
    // 같은 지점에서 똑같이 죽는다. 안내를 따르면 시간만 버린다.
    hint.hidden = true;
    serverError.hidden = false;
    const guidance = /codex/iu.test(detail)
      ? "codex 프로그램 쪽 문제일 수 있어요. 개발 서버를 껐다 켜 보세요."
      : "개발 서버를 껐다 켜 보세요. 그래도 안 되면 이 화면을 복사해 개발자에게 알려주세요.";
    serverError.textContent = `연결 서비스가 응답했지만 오류가 났어요. ${guidance} 오류 내용: ${detail}`;
  };

  const applyStatus = (auth: ChatGptAuthStatus): void => {
    // 감독 결정: env 자격은 무시한다. 셸 환경 변수로 얻은 연결은 에디터가 만들지도 지우지도
    // 못하므로 "연결됨"이라 말하지 않는다(hasStoredCompanionCredential 에 근거가 있다).
    stored = hasStoredCompanionCredential(auth);
    if (stored) {
      setStatus(`연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`, "connected");
    } else if (auth.env === true) {
      setStatus("환경 변수만 있음 — 로그인 필요", "disconnected");
    } else if (auth.expired === true) {
      setStatus("자격 만료 — 다시 로그인하세요", "disconnected");
    } else {
      setStatus(ohMyPiAuthKind(providerId) === "oauth" ? "로그인 필요" : "키 필요", "disconnected");
    }
    // 성공 경로에서는 (A) 안내를 **무조건** 숨긴다. 예전에는 미로그인 사용자에게
    // "서비스가 안 켜졌다"고 오진했다(옛 결함 ⑤).
    hint.hidden = true;
    serverError.hidden = true;
    applyChrome();
  };

  const refreshStatus = async (): Promise<void> => {
    if (disposed) return;
    try {
      applyStatus(await fetchChatGptAuthStatus(providerId));
    } catch (error) {
      if (disposed) return;
      if (isChatGptCompanionResponseError(error)) showServerError(error);
      else showUnreachable(error);
    }
  };

  // ── 기기 로그인 폴링 ───────────────────────────────────────────────────────
  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
    pollAttempt = 0;
    deviceBlock.hidden = true;
  }

  /**
   * 로그인 완료를 감지할 서버측 신호가 없다 — `startProviderLogin` 은 기기 코드를 한 번
   * resolve 하고 끝난다. 그래서 `/auth/status` 폴링이 유일한 완료 감지 수단이다.
   * 옛 구현은 5초 뒤 한 번만 확인해서, 그보다 오래 걸리는 로그인은 영구히 "대기 중"이었다.
   */
  function pollForLogin(): void {
    if (disposed || typeof setTimeout !== "function") return;
    pollTimer = setTimeout(() => {
      pollAttempt += 1;
      void fetchChatGptAuthStatus(providerId)
        .then((auth) => {
          if (disposed) return;
          if (hasStoredCompanionCredential(auth)) {
            stopPolling();
            applyStatus(auth);
            return;
          }
          if (pollAttempt >= DEVICE_POLL_MAX_ATTEMPTS) {
            stopPolling();
            setStatus("로그인이 확인되지 않았습니다", "disconnected");
            return;
          }
          devicePoll.textContent = `로그인 확인 중… (${pollAttempt}/${DEVICE_POLL_MAX_ATTEMPTS})`;
          pollForLogin();
        })
        .catch(() => {
          // 폴링 중 일시적 실패는 흐름을 끊지 않는다 — 다음 시도에서 회복될 수 있다.
          if (disposed) return;
          if (pollAttempt >= DEVICE_POLL_MAX_ATTEMPTS) {
            stopPolling();
            setStatus("로그인이 확인되지 않았습니다", "disconnected");
            return;
          }
          pollForLogin();
        });
    }, DEVICE_POLL_INTERVAL_MS);
  }

  cancelButton.addEventListener("click", () => {
    stopPolling();
    setStatus("로그인을 취소했습니다", "disconnected");
  });

  copyCodeButton.addEventListener("click", () => {
    const code = deviceUserCode.textContent?.trim() ?? "";
    if (!code) return;
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      devicePoll.textContent = "코드를 직접 복사해 주세요.";
      return;
    }
    void clipboard.writeText(code)
      .then(() => { devicePoll.textContent = "코드를 복사했습니다."; })
      .catch(() => { devicePoll.textContent = "코드를 직접 복사해 주세요."; });
  });

  loginButton.addEventListener("click", () => {
    if (stored) {
      // apiKey 자격에는 refresh 가 의미 없다 — 서버가 조용히 성공을 돌려주므로(no-op)
      // "새로 고쳤다"는 거짓 인상을 준다. oauth 일 때만 refresh 를 태운다.
      const check = ohMyPiAuthKind(providerId) === "oauth"
        ? refreshCompanionAuth(providerId).then(() => undefined, () => undefined)
        : Promise.resolve();
      setStatus("확인 중…", "checking");
      void check.then(() => refreshStatus());
      return;
    }
    if (ohMyPiAuthKind(providerId) !== "oauth") {
      // API 키 종류는 "연결 확인"이 곧 상태 재조회다. 키 저장이 연결 행위다.
      setStatus("확인 중…", "checking");
      void refreshStatus();
      return;
    }
    loginButton.disabled = true;
    setStatus("로그인 준비 중…", "checking");
    void startChatGptLogin(providerId)
      .then((login) => {
        if (disposed) return;
        if (login.connected) {
          void refreshStatus();
          return;
        }
        if (login.needsApiKey) {
          // 이 제공자는 기기 흐름이 없다 — 키 종류로 안내한다.
          setStatus("키 필요", "disconnected");
          hint.textContent = login.instructions
            || "이 제공자는 키가 필요합니다. 연결 방식을 'API 키'로 바꾸고 키를 저장하세요.";
          hint.hidden = false;
          return;
        }
        deviceBlock.hidden = false;
        deviceUrl.textContent = login.verificationUrl || "(주소를 받지 못했습니다)";
        // setAttribute 로 쓴다 — 속성으로 남아야 테스트·접근성 도구가 같은 값을 읽는다.
        if (login.verificationUrl) deviceUrl.setAttribute("href", login.verificationUrl);
        deviceUserCode.textContent = login.userCode || "";
        copyCodeButton.hidden = !login.userCode;
        devicePoll.textContent = `로그인 확인 중… (0/${DEVICE_POLL_MAX_ATTEMPTS})`;
        setStatus("브라우저에서 로그인 대기 중", "checking");
        // 링크를 눌러 열 수도 있게 남겨 둔 채 자동 실행도 시도한다(팝업 차단 시 링크가 대안).
        if (login.verificationUrl && typeof window !== "undefined" && typeof window.open === "function") {
          window.open(login.verificationUrl, "_blank", "noopener,noreferrer");
        }
        pollAttempt = 0;
        pollForLogin();
      })
      .catch((error: unknown) => {
        if (disposed) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(() => {
        loginButton.disabled = false;
      });
  });

  disconnectButton.addEventListener("click", () => {
    stopPolling();
    disconnectButton.disabled = true;
    setStatus("연결 해제 중…", "checking");
    void disconnectCompanionAuth(providerId)
      .then((auth) => {
        if (disposed) return;
        companionKey.value = "";
        applyStatus(auth);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(() => {
        disconnectButton.disabled = false;
      });
  });

  saveKeyButton.addEventListener("click", () => {
    const key = companionKey.value.trim();
    if (!key) {
      // 상태 문구를 덮어쓰지 않는다 — 입력 오류는 입력 옆에서 말한다.
      providerHelp.textContent = "키를 입력하세요.";
      companionKey.focus();
      return;
    }
    saveKeyButton.disabled = true;
    setStatus("키 저장 중…", "checking");
    void saveCompanionApiKey(providerId, key)
      .then((auth) => {
        if (disposed) return;
        companionKey.value = "";
        applyStatus(auth);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(() => {
        saveKeyButton.disabled = false;
      });
  });

  fillProviders();
  applyChrome();
  void refreshStatus();

  return {
    element: el("section", {
      class: "ai-auth-settings",
      attrs: { "aria-label": "AI 연결 방식" },
      children: [
        heading,
        kindGroup,
        el("div", { class: "ai-auth-provider-row", children: [
          el("label", { class: "ai-config-label", text: "제공자", attrs: { for: "ai-auth-provider" } }),
          providerSelect,
          providerHelp,
        ] }),
        el("div", { class: "ai-auth-panel", dataset: { testid: "ai-auth-connection" }, children: [
          el("div", { class: "ai-auth-state", children: [status, kindBadge] }),
          keyRow,
          el("div", { class: "ai-auth-actions", children: [loginButton, disconnectButton] }),
          deviceBlock,
          hint,
          serverError,
        ] }),
      ],
    }),
    focus: () => {
      // 지금 해야 할 일이 "키 입력"인 경우에만 그 칸으로 보낸다. 그 외에는 폼의 첫 컨트롤
      // (종류 라디오)로 보낸다 — 로그인 버튼에 포커스를 주면 Enter 한 번에 로그인이 발사된다.
      if (kind === "apiKey" && !stored && !keyRow.hidden) companionKey.focus();
      else kindButtons.get(kind)?.focus();
    },
    dispose: () => {
      disposed = true;
      stopPolling();
    },
  };
}
