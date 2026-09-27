// editor/panels/aiAuthSettings.ts
// AI 연결 방식 패널 — **Google 계정**(Antigravity) 과 **ChatGPT 계정**(Codex) 로그인을 고른다.
//
// 사용자가 보는 이름은 로그인하는 계정 이름 하나다(Google / ChatGPT, 레지스트리 label).
// 제품명(Gemini·Antigravity·Codex)은 카드 보조 줄에만 쓴다 — 카드·패널·칩이 제각각 다른 이름을
// 쓰던 것(2026-09-23 실측)을 막는다.
//
// 둘의 공통 계약:
//  - 전송은 로컬 동반 서비스(oh-my-pi)다.
//  - 자격 증명은 동반 서비스의 ~/.oprn/oh-my-pi-auth.json 에만 있다.
//  - 둘 다 oauth 이므로 브라우저에는 API 키 입력칸도, 저장되는 비밀도 없다.
//
// AiConnectionKindId 의 "API 키" 값은 주입 설정의 타입 호환을 위해 남아 있지만 이 레지스트리에
// apiKey 제공자는 없다. 화면에서 그 가지를 눌러도 가짜 제공자를 만들거나 키 입력을 되살리지 않고,
// 같은 두 구독 제공자를 보여 준다. `configForConnectionKind` 가 전송/비밀 정규화를 강제한다.

import {
  completeOAuthPaste,
  disconnectCompanionAuth,
  fetchChatGptAuthStatus,
  hasStoredCompanionCredential,
  hasUsableCompanionCredential,
  setCompanionEnvScan,
  isChatGptCompanionResponseError,
  refreshCompanionAuth,
  startChatGptLogin,
  type ChatGptAuthStatus,
  type ChatGptCompanionUnreachableError,
} from "@/ai/chatgptOAuthClient";
import {
  editorConnectionKind,
  providersForKind,
  type AiConnectionKindId,
} from "@/ai/aiConnectionKind";
import type { AiConfig } from "@/ai/llmClient";
import {
  getOhMyPiProvider,
  ohMyPiAuthKind,
  parseOhMyPiProvider,
} from "@/ai/ohMyPiProviders";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { HOST_AI_DISABLED_GUIDANCE, isHostAiDisabledMessage } from "@/ai/hostAiDisabled";
import {
  refreshAiConnectionStatus,
  resetAiConnectionStatusCache,
} from "@/editor/panels/aiConnectionStatus";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";
import { aiProviderIcon } from "./aiProviderIcons";

export interface AiAuthSettingsChange {
  readonly kind: AiConnectionKindId;
  readonly providerId: string;
}

export interface AiAuthStatusSnapshot {
  readonly providerId: string;
  readonly providerLabel: string;
  readonly text: string;
  readonly tone: "connected" | "disconnected" | "offline" | "checking";
}

export interface AiAuthSettingsView {
  readonly element: HTMLElement;
  readonly focus: () => void;
  /** 헤더 「연결 확인」 — 패널의 같은 상태 경로로 다시 조회한다(로그인 대기 중이면 끊지 않는다). */
  readonly recheck: () => void;
  /** 폴링 타이머·진행 중 요청을 정리한다. 모달을 닫을 때 반드시 부른다. */
  readonly dispose: () => void;
}

/**
 * 로그인 대기 폴링 간격과 전체 대기 시간. 3초마다 확인하고 10분 뒤 멈춘다.
 * 옛 상한 3분(3초 × 60)은 처음 로그인하는 사용자에게 짧았다 — 2단계 인증·비밀번호 찾기·
 * 원격 접속의 주소 복사까지 하면 3분을 넘기기 쉽다. 시도 횟수는 화면에 보이지 않는다.
 */
export const DEVICE_POLL_INTERVAL_MS = 3000;
export const DEVICE_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const DEVICE_POLL_MAX_ATTEMPTS = Math.ceil(DEVICE_LOGIN_WINDOW_MS / DEVICE_POLL_INTERVAL_MS);

/** 로그인 대기 중 문구 — 남은 횟수 같은 숫자를 보여 주지 않는다. */
const WAITING_COPY = "로그인을 기다리는 중…";
const TIMEOUT_COPY = "시간이 지나 로그인을 멈췄어요. 다시 시도해 주세요.";

type Tone = "connected" | "disconnected" | "offline" | "checking";

/**
 * OAuth 제공자 두 개의 빠른 선택 카드. 제목은 로그인하는 계정(「Google 계정」·「ChatGPT 계정」),
 * 보조 줄은 사용자가 따로 들어 봤을 제품명이다(「Gemini · Antigravity」·「Codex」) — 사용자가
 * "agy" 로 부르는 것을 카드에서 찾을 수 있게 한다. Google 쪽은 **구독을 암시하지 않는다**(CLI
 * 장르 용어도 쓰지 않는다). 이 카드는 보기 좋은 경로일 뿐 — 동일 providerId 는 아래 select 와 공유한다.
 */
const QUICK_PROVIDERS: readonly Readonly<{ id: string; label: string; sub: string; hint: string }>[] = [
  {
    id: ANTIGRAVITY_PROVIDER_ID,
    label: "Google 계정",
    sub: "Gemini · Antigravity",
    hint: "Google 계정으로 로그인합니다. 빠른 Gemini를 기본으로 사용합니다.",
  },
  {
    id: CODEX_PROVIDER_ID,
    label: "ChatGPT 계정",
    sub: "Codex",
    hint: "ChatGPT 구독 계정으로 로그인합니다. Codex 모델을 사용합니다.",
  },
];

/** 사용자에게 보이는 계정 이름(Google / ChatGPT). 레지스트리 label 이 단일 출처다. */
function accountName(id: string): string {
  return getOhMyPiProvider(id)?.label ?? id;
}

export function renderAiAuthSettings(
  config: AiConfig,
  onChange: (next: AiAuthSettingsChange) => void,
  /**
   * 패널 상태 줄이 바뀔 때마다 부른다 — 모달 헤더 요약이 패널과 **같은 한 상태**를 보이게 한다.
   * 옛 헤더는 열 때 한 번만 따로 조회해서, 패널이 「로그인 대기 중」·「연결됨」 으로 바뀌어도
   * 「로그인이 필요합니다」 에 머물렀고, 제공자를 바꾸면 「확인 중」 에서 영영 멈췄다(2026-09-26 실측).
   */
  onStatus?: (next: AiAuthStatusSnapshot) => void,
): AiAuthSettingsView {
  // 연결 종류 선택 UI 는 없다 — 이 레지스트리의 제공자는 전부 oauth 이고, 예전 「API 키」
  // 카드는 지원 제공자가 없는 죽은 선택지였다(고르면 같은 두 제공자만 다시 보였다).
  const kind = editorConnectionKind(config);
  let providerId = parseOhMyPiProvider(config.providerId);
  let stored = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pollAttempt = 0;
  let disposed = false;
  /**
   * 인증 연산 세대 카운터. 제공자/종류 변경과 명시적 취소가 이 값을 올린다 — 진행 중(나 비동기 대기)인
   * 연산은 시작 시점의 세대·제공자를 붙들고, 그게 현재와 다르면 UI 를 건드리지 않는다.
   * pi-ai 프로미스 자체를 강제로 abort 하지 않아도 된다 — 늦게 온 결과를 무시하기만 하면 된다.
   */
  let opGeneration = 0;

  // ── 상태 표시 ──────────────────────────────────────────────────────────────
  const status = el("span", {
    class: "ai-oauth-status",
    text: "연결 확인 중…",
    attrs: { role: "status" },
    dataset: { testid: "ai-oauth-status", tone: "checking" },
  });
  /** 상태 문구와 색을 **함께** 쓴다 — 하나만 바꾸면 색이 이전 상태로 남는다(옛 결함 ⑥). */
  const setStatus = (text: string, tone: Tone): void => {
    status.textContent = text;
    status.dataset.tone = tone;
    onStatus?.({ providerId, providerLabel: accountName(providerId), text, tone });
  };

  // ── 제공자 카드(radiogroup) ─────────────────────────────────────────────
  // 카드가 곧 제공자 선택 + 상태 표시다 — 옛 「연결 방식」 카드와 「제공자」 드롭다운의
  // 3중 중복을 카드 하나로 합쳤다. 카드 선택은 아래 숨은 select 의 값·change 원천과
  // 같은 providerId 로 동기화된다.
  const quickButtons = new Map<string, HTMLButtonElement>();
  const cardPills = new Map<string, HTMLElement>();
  /** 카드별 마지막으로 확인된 자격 상태 — 선택되지 않은 카드도 「연결됨」을 보여 주기 위한 캐시. */
  const cardAuth = new Map<string, ChatGptAuthStatus | "checking" | "error">();
  const quickBlock = el("div", {
    class: "ai-auth-quick-block",
    dataset: { testid: "ai-auth-quick-block" },
  });
  const quickGroup = el("div", {
    class: "ai-auth-quick",
    attrs: { role: "radiogroup", "aria-label": "AI 제공자" },
    dataset: { testid: "ai-auth-quick" },
    children: providersForKind(kind).map((row) => {
      const copy = QUICK_PROVIDERS.find((quick) => quick.id === row.id);
      const label = copy?.label ?? `${row.label} 계정`;
      const hint = copy?.hint ?? `${row.label} 계정으로 로그인합니다.`;
      const pill = el("span", {
        class: "ai-auth-card-pill",
        text: "확인 중…",
        dataset: { testid: `ai-auth-card-status-${row.id}`, tone: "checking" },
      });
      cardPills.set(row.id, pill);
      const button = el("button", {
        class: "ai-auth-quick-card ai-auth-provider-card",
        attrs: { type: "button", role: "radio", "aria-checked": "false", tabindex: "-1" },
        dataset: { testid: `ai-auth-quick-${row.id}` },
        children: [
          el("span", { class: "ai-auth-card-head", children: [
            el("span", {
              class: "ai-auth-card-brand",
              children: [aiProviderIcon(row.id, 18) ?? deckIcon("spark", { size: 15 })],
            }),
            el("span", { class: "ai-auth-card-name", children: [
              el("strong", { text: label }),
              ...(copy?.sub
                ? [el("span", {
                  class: "ai-auth-card-sub",
                  text: copy.sub,
                  dataset: { testid: `ai-auth-card-sub-${row.id}` },
                })]
                : []),
            ] }),
            el("span", {
              class: "ai-auth-card-check",
              attrs: { "aria-hidden": "true" },
              children: [deckIcon("check", { size: 15 })],
            }),
          ] }),
          el("small", { text: hint }),
          pill,
        ],
      }) as HTMLButtonElement;
      button.addEventListener("click", () => selectQuickProvider(row.id));
      quickButtons.set(row.id, button);
      return button;
    }),
  });
  quickBlock.append(quickGroup);

  /** 카드의 상태 필 하나를 캐시된 자격 상태로 다시 그린다. */
  function renderCardPill(id: string): void {
    const pill = cardPills.get(id);
    if (!pill) return;
    const auth = cardAuth.get(id);
    let text = "확인 중…";
    let tone = "checking";
    if (auth === "error") {
      text = "확인 실패";
      tone = "offline";
    } else if (auth && auth !== "checking") {
      if (hasUsableCompanionCredential(auth)) {
        text = auth.env === true
          ? "연결됨 · 환경 변수"
          : `연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`;
        tone = "connected";
      } else if (auth.expired === true) {
        text = "자격 만료";
        tone = "offline";
      } else {
        text = "로그인 필요";
        tone = "idle";
      }
    }
    pill.textContent = text;
    pill.dataset.tone = tone;
  }
  // 라디오 그룹 키보드 관례: 화살표가 옆(끝에서는 처음으로) 선택지를 고르고 **포커스도 이동한다**.
  // 현재 제공자가 퀵 카드에 없으면(드롭다운으로 다른 OAuth 제공자를 골랐다면) 결정적으로 첫 카드로 간다.
  quickGroup.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;
    event.preventDefault();
    selectQuickProvider(nextQuickProvider(key));
  });

  // ── 제공자 선택(숨은 select) ─────────────────────────────────────────────
  // 카드가 선택의 유일한 보이는 경로다. 이 select 는 값·change 이벤트의 프로그램 원천으로만
  // 남긴다 — 테스트와 커스텀 셀렉트 우회 경로가 같은 계약을 계속 쓴다.
  const providerSelect = el("select", {
    class: "ai-config-select ai-oh-my-pi-provider",
    attrs: { id: "ai-auth-provider", hidden: "", "aria-hidden": "true", tabindex: "-1" },
    dataset: { testid: "ai-oh-my-pi-provider" },
  }) as HTMLSelectElement;
  const providerHelp = el("span", {
    class: "ai-config-help",
    dataset: { testid: "ai-auth-provider-help" },
  });
  providerSelect.addEventListener("change", () => {
    const next = parseOhMyPiProvider(providerSelect.value);
    if (next === providerId) return;
    // 선택 변경 = 새 인증 연산 세대. 실행 중 폴링을 멈추고 저장된 자격 상태·연결 해제 크롬을
    // 지운 뒤 "연결 확인 중…"으로 초기화한 다음 새 제공자의 상태를 조회한다.
    beginSelectionChange();
    providerId = next;
    applyChrome();
    emit();
    void refreshStatus();
  });

  /**
   * 종류에 속한 제공자만 채운다. optgroup 라벨이 인증 종류를 **한국어로** 담으므로 옵션
   * 텍스트에는 제공자 이름만 넣는다(옛 결함 ③).
   */
  const fillProviders = (): void => {
    // 둘 다 oauth 이므로 종류와 무관하게 같은 두 제공자를 채운다. 첫 항목은 기본 제공자다.
    const rows = providersForKind(kind);
    providerSelect.replaceChildren(
      ...rows.map((row) => el("option", { text: row.label, attrs: { value: row.id } })),
    );
    providerSelect.value = providerId;
    providerSelect.disabled = rows.length <= 1;
  };

  // API 키 입력은 없다. 이 레지스트리의 두 제공자는 모두 oauth 이고 시크릿은 동반 서비스의
  // 디스크 저장소에만 있다. 숨은 input 으로 남겨도 fake DOM·브라우저 자동완성·미래 collect 경로가
  // 값을 읽을 수 있으므로 DOM 자체를 만들지 않는다.

  // ── 동작 버튼 ─────────────────────────────────────────────────────────────
  const loginButton = el("button", {
    class: "ai-assistant-action ai-oauth-login",
    text: "로그인",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-login" },
  }) as HTMLButtonElement;

  // 저장된 자격이 있을 때만 보인다 — 지울 것이 없을 때 뜨는 해제 버튼은 거짓말이다.
  // env 자격은 에디터가 지울 수 없으므로 stored 가 false 고, 따라서 이 버튼도 뜨지 않는다.
  const envScanAllow = el("button", {
    class: "ai-assistant-action",
    text: "찾아보기",
    attrs: { type: "button" },
    dataset: { testid: "ai-env-scan-allow" },
  }) as HTMLButtonElement;
  const envScanDeny = el("button", {
    class: "ai-assistant-action",
    text: "안 볼게요",
    attrs: { type: "button" },
    dataset: { testid: "ai-env-scan-deny" },
  }) as HTMLButtonElement;
  const envScanBox = el("div", {
    class: "ai-auth-env-scan",
    attrs: { hidden: "" },
    dataset: { testid: "ai-env-scan" },
    children: [
      el("p", {
        class: "ai-auth-env-scan-copy",
        text: "이 서버의 환경 변수에서 AI 키를 찾아볼까요? 키 값은 화면에 나오지 않습니다.",
      }),
      el("div", { class: "ai-auth-actions", children: [envScanAllow, envScanDeny] }),
    ],
  });
  // 로그인 흐름의 주 동작이 아니다 — 버튼 줄에 나란히 두면 「로그인」 과 같은 무게로 읽혀
  // 구독 로그인 사용자가 키를 찾아야 하나 헷갈렸다(2026-09-26 스샷). 조용한 글자 버튼으로 둔다.
  const envScanAgain = el("button", {
    class: "ai-auth-link-action",
    text: "서버 환경 변수의 키 쓰기",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-env-scan-again" },
  }) as HTMLButtonElement;

  const disconnectButton = el("button", {
    class: "ai-assistant-action ai-auth-disconnect",
    text: "연결 해제",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-auth-disconnect" },
  }) as HTMLButtonElement;
  const actionsRow = el("div", {
    class: "ai-auth-actions",
    dataset: { testid: "ai-auth-actions" },
    children: [loginButton, disconnectButton],
  });

  // ── 기기 로그인 블록 ───────────────────────────────────────────────────────
  // 로그인 주소는 **본문 글자로 보여 주지 않는다.** Google 인가 주소는 600자에 가까워 패널을
  // 주소 벽으로 덮었다(2026-09-23 실측). 창은 자동으로 열리므로 짧은 「다시 열기」 링크와
  // 팝업이 막혔을 때의 「주소 복사」만 남긴다. 주소 자체는 href 에만 있다.
  let loginUrl = "";
  const deviceUrl = el("a", {
    class: "ai-oauth-device-url",
    text: "로그인 창 다시 열기",
    attrs: { target: "_blank", rel: "noopener noreferrer" },
    dataset: { testid: "ai-oauth-device-url" },
  }) as HTMLAnchorElement;
  const copyUrlButton = el("button", {
    class: "ai-assistant-action ai-oauth-copy-url",
    text: "주소 복사",
    attrs: { type: "button", title: "창이 안 열리면 주소를 복사해 새 탭 주소창에 붙여 넣으세요." },
    dataset: { testid: "ai-oauth-copy-url" },
  }) as HTMLButtonElement;
  const deviceLinkRow = el("div", {
    class: "ai-oauth-device-link-row",
    dataset: { testid: "ai-oauth-device-link-row" },
    children: [deviceUrl, copyUrlButton],
  });
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
  const deviceCodeRow = el("div", {
    class: "ai-oauth-device-code-row",
    dataset: { testid: "ai-oauth-device-code-row" },
    children: [deviceUserCode, copyCodeButton],
  });
  const deviceStep1 = el("span", { dataset: { testid: "ai-oauth-device-step1" } });
  const deviceStep2 = el("span", { dataset: { testid: "ai-oauth-device-step2" } });
  // 셋째 단계는 원격 접속(주소 붙여넣기) 안내에서만 쓴다.
  const deviceStep3 = el("span", { attrs: { hidden: "" }, dataset: { testid: "ai-oauth-device-step3" } });
  const pasteInput = el("input", {
    class: "ai-config-input ai-oauth-paste-url",
    attrs: {
      type: "url",
      placeholder: "여기에 주소 붙여 넣기 (http://localhost:… 로 시작)",
      "aria-label": "로그인 탭의 주소",
    },
    dataset: { testid: "ai-oauth-paste-url" },
  }) as HTMLInputElement;
  const pasteButton = el("button", {
    class: "ai-assistant-action",
    text: "연결하기",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-paste-submit" },
  }) as HTMLButtonElement;
  const pasteRow = el("div", {
    class: "ai-oauth-paste-row",
    attrs: { hidden: "" },
    dataset: { testid: "ai-oauth-paste-row" },
    children: [pasteInput, pasteButton],
  });
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
        deviceStep1,
        deviceCodeRow,
        deviceStep2,
        deviceStep3,
        pasteRow,
        deviceLinkRow,
      ] }),
      el("div", { class: "ai-oauth-device-foot", children: [devicePoll, cancelButton] }),
    ],
  });

  // ── 시간 초과 ─────────────────────────────────────────────────────────────
  // 옛 구현은 상한에 닿으면 기기 블록을 조용히 접고 상태 줄만 바꿨다 — 사용자는 무엇이 끝났는지,
  // 다음에 무엇을 누를지 몰랐다. 멈춘 이유와 재시도 버튼을 한자리에 보여 준다.
  const retryButton = el("button", {
    class: "ai-assistant-action",
    text: "다시 시도",
    attrs: { type: "button" },
    dataset: { testid: "ai-oauth-timeout-retry" },
  }) as HTMLButtonElement;
  const timeoutNotice = el("div", {
    class: "ai-oauth-timeout",
    attrs: { hidden: "", role: "alert" },
    dataset: { testid: "ai-oauth-timeout" },
    children: [el("span", { text: TIMEOUT_COPY }), retryButton],
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
    // 두 제공자는 모두 oauth 이므로 키 입력 분기가 없다. 안내도 providerId 하드코딩 대신
    // 레지스트리 authKind 를 따라가 새 제공자를 추가할 때 잘못된 키 안내가 생기지 않게 한다.
    // 카드 설명을 그대로 되풀이하지 않는다 — 패널 안내는 **다음에 무슨 일이 일어나는지**를 말한다.
    const label = meta?.label ?? providerId;
    providerHelp.textContent = providerKind !== "oauth"
      ? `${label} 는 이 에디터에서 지원하지 않는 자격 종류입니다.`
      : stored
        ? `${label} 계정으로 연결되어 있어요. 다른 계정을 쓰려면 연결 해제 후 다시 로그인하세요.`
        : `로그인을 누르면 새 창이 열리고 ${label} 계정으로 로그인합니다. API 키는 필요 없어요.`;
    loginButton.textContent = stored
      ? "다시 확인"
      : providerKind === "oauth" ? "로그인" : "연결 확인";
    disconnectButton.hidden = !stored;
    // 로그인 전에는 「로그인」 이 이 화면의 유일한 다음 단계다 — 다른 회색 버튼과 같은 무게로 두지 않는다.
    loginButton.classList.toggle("is-primary", !stored && providerKind === "oauth");
    // 퀵 카드의 보이기/체크·탭 순서도 같은 크롬 갱신 경로에서 맞춘다.
    applyQuickChrome();
  };

  /**
   * 퀵 카드의 `aria-checked` 와 roving tabindex 를 쓴다 — 종류 변경까지 포함해 일반 크롬
   * 적용 경로에서 호출된다. 활성 퀵 제공자가 없으면(다른 OAuth 제공자를 드롭다운으로 골랐을 때)
   * 키보드 사용자가 돌아올 수 있도록 첫 카드만 `tabindex=0` 으로 남기고 둘 다 체크 해제로 둔다.
   */
  function applyQuickChrome(): void {
    const inOAuth = kind === "oauth";
    quickBlock.hidden = !inOAuth;
    quickGroup.hidden = !inOAuth;
    for (const [id, button] of quickButtons) {
      const active = inOAuth && providerId === id;
      button.setAttribute("aria-checked", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
    }
    if (inOAuth && !quickButtons.has(providerId)) {
      const first = [...quickButtons.keys()][0];
      if (first) quickButtons.get(first)?.setAttribute("tabindex", "0");
    }
  }

  /** 화살표 방향에 대해 다음/첫 퀵 제공자. 현재 제공자가 퀵 카드에 없으면 결정적으로 첫 카드. */
  function nextQuickProvider(key: string): string {
    const ids = [...quickButtons.keys()];
    const currentIndex = ids.indexOf(providerId);
    if (currentIndex < 0) return ids[0];
    const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
    return ids[(currentIndex + delta + ids.length) % ids.length];
  }

  /** 퀵 카드 선택 — 같은 제공자면 포커스만 옮기고, 아니면 일반 선택 경로(startChatGptLogin 라우팅 포함)를 태운다. */
  function selectQuickProvider(id: string): void {
    const target = parseOhMyPiProvider(id);
    if (target === providerId) {
      quickButtons.get(target)?.focus();
      return;
    }
    beginSelectionChange();
    providerId = target;
    providerSelect.value = providerId;
    applyChrome();
    quickButtons.get(target)?.focus();
    emit();
    void refreshStatus();
  }

  /**
   * 새 선택/명시적 취소의 공통 서막 — 인증 연산 세대를 올리고, 폴링을 멈추고, 기기 코드 블록을
   * 숨기고, 저장된 자격·연결 해제 크롬을 비우고, "연결 확인 중…"으로 초기화한다.
   * 이전 연산의 늦은 결과가 새 선택의 UI 를 덮어쓰지 못하게 하는 지점이 여기 하나다.
   */
  function beginSelectionChange(): void {
    opGeneration += 1;
    stopPolling();
    stored = false;
    setStatus("연결 확인 중…", "checking");
    // 옛 제공자/종류의 안내·오류 메시지를 새 선택 아래 남기지 않는다 — 새 상태가 올 때까지 숨겨 둔다
    // (결함 B). (A) 안내와 (B) 서버 오류 둘 다 숨기지 않으면 옛 제공자 문구가 새 제공자 곁에 남는다.
    hint.hidden = true;
    serverError.hidden = true;
    timeoutNotice.hidden = true;
    // 이전 연산이 버튼을 비활성화한 채로 남았어도(대기 중 로그인/연결 해제) 새 선택에서
    // 되살린다 — 오래된 finally 는 세대 가드 때문에 이걸 덮지 못한다.
    loginButton.disabled = false;
    disconnectButton.disabled = false;
  }

  const emit = (): void => {
    onChange({ kind, providerId });
  };

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
    cardAuth.set(providerId, "error");
    renderCardPill(providerId);
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
    if (isHostAiDisabledMessage(detail)) {
      setStatus("서버에서 AI가 꺼져 있음", "offline");
      serverError.textContent = HOST_AI_DISABLED_GUIDANCE;
      cardAuth.set(providerId, "error");
      renderCardPill(providerId);
      return;
    }
    const guidance = /codex/iu.test(detail)
      ? "codex 프로그램 쪽 문제일 수 있어요. 개발 서버를 껐다 켜 보세요."
      : "개발 서버를 껐다 켜 보세요. 그래도 안 되면 이 화면을 복사해 개발자에게 알려주세요.";
    serverError.textContent = `연결 서비스가 응답했지만 오류가 났어요. ${guidance} 오류 내용: ${detail}`;
    cardAuth.set(providerId, "error");
    renderCardPill(providerId);
  };

  const applyStatus = (auth: ChatGptAuthStatus): void => {
    // 로그인 완료(직접/폴링/붙여넣기), 재확인, 연결 해제가 모두 성공한 인증 상태를 이 한 경로로
    // 적용한다. 여기서 공유 게이트 캐시도 무효화·재조회해야 버튼별 배선 누락 없이 같은 제공자의
    // in-session 인증 변경이 모든 AI 표면에 전파된다. 공유 조회는 이 함수를 호출하지 않으므로
    // 재귀 루프가 없고, aiConnectionStatus 자체가 같은 제공자의 동시 조회를 de-dup 한다.
    resetAiConnectionStatusCache();
    void refreshAiConnectionStatus();
    stored = hasStoredCompanionCredential(auth);
    const usable = hasUsableCompanionCredential(auth);
    envScanBox.hidden = auth.envScan !== "ask" || usable;
    envScanAgain.hidden = auth.envScan !== "deny" || usable;
    if (usable && auth.env === true) {
      setStatus("연결됨 · 환경 변수", "connected");
    } else if (stored) {
      setStatus(`연결됨${auth.planType ? ` · ${auth.planType.toUpperCase()}` : ""}`, "connected");
    } else if (auth.expired === true) {
      setStatus("자격 만료 — 다시 로그인하세요", "disconnected");
    } else {
      setStatus(ohMyPiAuthKind(providerId) === "oauth" ? "로그인 필요" : "키 필요", "disconnected");
    }
    // 선택 제공자 카드의 필도 같은 상태로 맞춘다 — 카드가 곧 상태 표시다.
    cardAuth.set(providerId, auth);
    renderCardPill(providerId);
    // 성공 경로에서는 (A) 안내를 **무조건** 숨긴다. 예전에는 미로그인 사용자에게
    // "서비스가 안 켜졌다"고 오진했다(옛 결함 ⑤).
    hint.hidden = true;
    serverError.hidden = true;
    applyChrome();
  };

  const refreshStatus = async (gen = opGeneration, provider = providerId): Promise<void> => {
    if (disposed) return;
    try {
      const auth = await fetchChatGptAuthStatus(provider);
      // 늦은 응답은 무시한다 — 새 선택(세대·제공자)이 이 조회를 이미 대체했다면 UI 를 건드리지 않는다.
      if (disposed || gen !== opGeneration || provider !== providerId) return;
      applyStatus(auth);
    } catch (error) {
      if (disposed || gen !== opGeneration || provider !== providerId) return;
      if (isChatGptCompanionResponseError(error)) showServerError(error);
      else showUnreachable(error);
    }
  };

  // ── 기기 로그인 폴링 ───────────────────────────────────────────────────────
  let stopPasteWatch: (() => void) | undefined;
  let pasteSubmitted = "";

  /** 원격 로그인 탭이 남기는 localhost 콜백만 받는다. 다른 주소는 연결 시도로 보지 않는다. */
  function loopbackLoginUrl(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
    if (url.pathname !== "/oauth-callback" && url.pathname !== "/auth/callback") return "";
    if (!url.searchParams.get("code")) return "";
    return url.toString();
  }

  function submitPastedLogin(raw: string): void {
    const url = loopbackLoginUrl(raw);
    if (!url) {
      devicePoll.textContent = "로그인 탭의 주소창 전체를 붙여 넣으세요.";
      return;
    }
    if (url === pasteSubmitted || pasteButton.disabled) return;
    pasteSubmitted = url;
    pasteInput.value = url;
    pasteButton.disabled = true;
    const gen = opGeneration;
    const provider = providerId;
    void completeOAuthPaste(url)
      .then(async () => {
        if (disposed || gen !== opGeneration || provider !== providerId) return;
        devicePoll.textContent = "연결하는 중…";
        const auth = await fetchChatGptAuthStatus(provider);
        if (disposed || gen !== opGeneration || provider !== providerId) return;
        if (hasStoredCompanionCredential(auth)) {
          stopPolling();
          applyStatus(auth);
        }
      })
      .catch((error: unknown) => {
        pasteSubmitted = "";
        if (disposed || gen !== opGeneration || provider !== providerId) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(() => {
        if (!disposed && gen === opGeneration) pasteButton.disabled = false;
      });
  }

  function watchPastedLogin(): void {
    stopPasteWatch?.();
    const takeClipboard = (): void => {
      if (disposed || deviceBlock.hidden || pasteRow.hidden) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      pasteInput.focus();
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
      if (!clipboard?.readText) return;
      void clipboard.readText()
        .then((text) => {
          if (disposed || deviceBlock.hidden || pasteRow.hidden) return;
          if (loopbackLoginUrl(text)) submitPastedLogin(text);
        })
        .catch(() => undefined);
    };
    const onPaste = (event: Event): void => {
      const data = (event as ClipboardEvent).clipboardData?.getData("text") ?? "";
      if (!loopbackLoginUrl(data)) return;
      event.preventDefault();
      submitPastedLogin(data);
    };
    const onKey = (event: Event): void => {
      if ((event as KeyboardEvent).key !== "Enter") return;
      submitPastedLogin(pasteInput.value);
    };
    pasteInput.addEventListener("paste", onPaste);
    pasteInput.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", takeClipboard);
    const win = typeof window !== "undefined" ? window : undefined;
    if (typeof win?.addEventListener === "function") win.addEventListener("focus", takeClipboard);
    stopPasteWatch = () => {
      pasteInput.removeEventListener("paste", onPaste);
      pasteInput.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", takeClipboard);
      win?.removeEventListener?.("focus", takeClipboard);
      stopPasteWatch = undefined;
    };
    takeClipboard();
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
    pollAttempt = 0;
    stopPasteWatch?.();
    pasteSubmitted = "";
    setDeviceFlowVisible(false);
  }

  /**
   * 기기 로그인 블록을 열고 닫는 유일한 경로. 대기 중에는 버튼 줄(「로그인」)과 환경 변수 글자 버튼을
   * 숨긴다 — 옛 화면은 대기 블록의 「로그인 창 다시 열기」·「취소」 위에 「로그인」 이 그대로 남아
   * 무엇을 눌러야 하는지 두 갈래로 보였다. 다시 시작하려면 「취소」 뒤 「로그인」 이다.
   */
  function setDeviceFlowVisible(visible: boolean): void {
    deviceBlock.hidden = !visible;
    actionsRow.hidden = visible;
    envScanAgain.dataset.flowHidden = visible ? "true" : "false";
  }

  /**
   * 로그인 완료를 감지할 서버측 신호가 없다 — `startProviderLogin` 은 기기 코드를 한 번
   * resolve 하고 끝난다. 그래서 `/auth/status` 폴링이 유일한 완료 감지 수단이다.
   * 옛 구현은 5초 뒤 한 번만 확인해서, 그보다 오래 걸리는 로그인은 영구히 "대기 중"이었다.
   */
  function pollForLogin(): void {
    if (disposed || typeof setTimeout !== "function") return;
    const gen = opGeneration;
    const provider = providerId;
    pollTimer = setTimeout(() => {
      pollAttempt += 1;
      void fetchChatGptAuthStatus(provider)
        .then((auth) => {
          if (disposed || gen !== opGeneration || provider !== providerId) return;
          if (hasStoredCompanionCredential(auth)) {
            stopPolling();
            applyStatus(auth);
            return;
          }
          if (pollAttempt >= DEVICE_POLL_MAX_ATTEMPTS) {
            showLoginTimeout();
            return;
          }
          // 대기 문구는 시작할 때 한 번만 쓴다 — 매 틱 덮어쓰면 「주소를 복사했어요」 같은
          // 방금 한 조작의 응답이 3초 만에 지워진다.
          pollForLogin();
        })
        .catch(() => {
          // 폴링 중 일시적 실패는 흐름을 끊지 않는다 — 다음 시도에서 회복될 수 있다.
          if (disposed || gen !== opGeneration || provider !== providerId) return;
          if (pollAttempt >= DEVICE_POLL_MAX_ATTEMPTS) {
            showLoginTimeout();
            return;
          }
          pollForLogin();
        });
    }, DEVICE_POLL_INTERVAL_MS);
  }

  /** 대기 시간이 다 됐다 — 폴링을 멈추고, 멈춘 이유와 재시도 버튼을 보여 준다. */
  function showLoginTimeout(): void {
    stopPolling();
    setStatus("로그인 시간 초과", "disconnected");
    timeoutNotice.hidden = false;
  }

  retryButton.addEventListener("click", () => {
    timeoutNotice.hidden = true;
    loginButton.click();
  });

  cancelButton.addEventListener("click", () => {
    opGeneration += 1;
    stopPolling();
    setStatus("로그인을 취소했습니다", "disconnected");
  });

  copyUrlButton.addEventListener("click", () => {
    if (!loginUrl) return;
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const failed = "복사하지 못했어요. ‘로그인 창 다시 열기’를 눌러 주세요.";
    if (!clipboard?.writeText) {
      devicePoll.textContent = failed;
      return;
    }
    void clipboard.writeText(loginUrl)
      .then(() => { devicePoll.textContent = "주소를 복사했어요. 새 탭 주소창에 붙여 넣으세요."; })
      .catch(() => { devicePoll.textContent = failed; });
  });

  pasteButton.addEventListener("click", () => {
    submitPastedLogin(pasteInput.value);
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
    // 실 브라우저는 비활성 버튼의 click 을 발화하지 않는다 — fakeDom 이 발화할 수 있으므로
    // 핸들러가 자체 비활성을 다시 확인해 생성 경계를 세우기 전에 이중 연산을 배제한다.
    if (loginButton.disabled) return;
    timeoutNotice.hidden = true;
    // 새 로그인/재확인은 진행 중이던 기기 흐름(폴링 + 보이는 기기 블록 + 그 취소)을 즉시
    // 멈추고 숨긴다 — 그렇지 않으면 옛 취소가 세대를 올려 재시도를 무효화하고 버튼을 영구히
    // 잠글 수 있다. 세대 전진 전에 동기로 호출해 옛 폴링 결과가 새 경계를 건드리지 못하게 한다.
    stopPolling();
    // OAuth 액션 시작 = 새 연산 경계. 이전에 달려있던 상태 조회를 모두 무효화한다(같은 제공자라도).
    // 그래야 로그인/재확인이 사작되기 전에 달려있던 상태 응답이 기기 크롬을 덮지 않는다(결함 A).
    opGeneration += 1;
    const gen = opGeneration;
    const provider = providerId;
    const isCurrent = (): boolean => !disposed && gen === opGeneration && provider === providerId;
    // OAuth 액션 상호 배타 — 이 연산이 도는 동안 다른 OAuth 액션(재확인/로그인/연결 해제)을 모두 막는다.
    loginButton.disabled = true;
    disconnectButton.disabled = true;
    const restore = (): void => {
      if (isCurrent()) {
        loginButton.disabled = false;
        disconnectButton.disabled = false;
      }
    };
    if (stored) {
      // apiKey 자격에는 refresh 가 의미 없다 — 서버가 조용히 성공을 돌려주므로(no-op)
      // "새로 고쳤다"는 거짓 인상을 준다. oauth 일 때만 refresh 를 태운다.
      const check = ohMyPiAuthKind(provider) === "oauth"
        ? refreshCompanionAuth(provider).then(() => undefined, () => undefined)
        : Promise.resolve();
      setStatus("확인 중…", "checking");
      // 재확인은 refreshCompanionAuth 가 끝나도 그 follow-up refreshStatus 가 끝날 때까지
      // 버튼을 잠근다 — 그 사이 연결 해제가 끼어들지(supersede) 못하게(결함 A 재발).
      void check
        .then(() => (isCurrent() ? refreshStatus(gen, provider) : undefined))
        .finally(restore);
      return;
    }
    if (ohMyPiAuthKind(provider) !== "oauth") {
      // API 키 종류는 "연결 확인"이 곧 상태 재조회다. 키 저장이 연결 행위다.
      setStatus("확인 중…", "checking");
      void refreshStatus(gen, provider).finally(restore);
      return;
    }
    setStatus("로그인 준비 중…", "checking");
    void startChatGptLogin(provider)
      .then((login) => {
        if (!isCurrent()) return;
        if (login.connected) {
          // 잘못하면 finally(restore) 가 follow-up refreshStatus 보다 먼저 버튼을 되살린다
          // (연결 성공 직후 해제가 끼어드는 supersede 버그). refreshStatus 를 체인에
          // return 해서 finally 가 **그 follow-up 까지** 기다리게 한다 — 재확인 경로와 동일 결정.
          return refreshStatus(gen, provider);
        }
        if (login.needsApiKey) {
          // 레지스트리의 두 제공자는 oauth 다. 동반 서비스가 키 필요를 돌려주면 제공자 계약이
          // 어긋난 것이므로 존재하지 않는 키 입력 경로를 안내하지 않고 다시 로그인을 요구한다.
          setStatus("구독 로그인 필요", "disconnected");
          hint.textContent = login.instructions
            || "이 제공자는 구독 로그인만 지원합니다. 연결 서비스를 확인한 뒤 다시 로그인하세요.";
          hint.hidden = false;
          return;
        }
        setDeviceFlowVisible(true);
        loginUrl = login.verificationUrl || "";
        // 주소는 href 에만 둔다(본문 글자 금지 — 위 기기 로그인 블록 주석).
        // setAttribute 로 쓴다 — 속성으로 남아야 테스트·접근성 도구가 같은 값을 읽는다.
        if (loginUrl) deviceUrl.setAttribute("href", loginUrl);
        else deviceUrl.removeAttribute("href");
        deviceLinkRow.hidden = !loginUrl;
        deviceUserCode.textContent = login.userCode || "";
        copyCodeButton.hidden = !login.userCode;
        // 코드가 없는 로그인(브라우저 루프백 완료: Antigravity, 1455 를 잡은 Codex)에서는
        // 빈 코드 줄과 "이 코드를 입력하세요" 가 남으면 사용자가 없는 코드를 찾게 된다.
        deviceCodeRow.hidden = !login.userCode;
        pasteRow.hidden = login.pasteCallback !== true;
        pasteInput.value = "";
        const name = accountName(provider);
        if (login.pasteCallback) {
          // 원격 접속(다른 PC 의 서버를 여는 중): Google 은 로그인 뒤 **이 PC 의** localhost 로
          // 돌려보내므로 그 탭은 브라우저의 「연결할 수 없음」 오류 페이지가 된다. 초보자는 그걸
          // 실패로 읽는다 — 그 페이지가 정상이라는 것과, 무엇을(주소창 전체) 복사할지 먼저 말한다.
          // redirect_uri 는 데스크톱 클라이언트 제약상 localhost 여야 하므로 흐름 자체는 바꾸지 않는다.
          deviceStep1.textContent = `1. 새로 열린 탭에서 ${name} 계정으로 로그인하세요.`;
          deviceStep2.textContent = "2. 로그인 후 ‘연결할 수 없음’ 페이지가 뜨는 게 정상이에요. 그 탭의 주소창에 있는 주소 전체(http://localhost 로 시작)를 복사하세요.";
          deviceStep3.textContent = "3. 이 화면으로 돌아오면 알아서 연결해요. 안 되면 아래 칸에 붙여 넣고 ‘연결하기’를 누르세요. 로그인은 이 서버에 남으니 서버마다 한 번만 하면 돼요.";
          deviceStep3.hidden = false;
          devicePoll.textContent = WAITING_COPY;
          watchPastedLogin();
        } else {
          deviceStep1.textContent = login.userCode
            ? `${name} 로그인 창을 열었어요. 창에 아래 코드를 입력하세요.`
            : `${name} 로그인 창을 열었어요. 창에서 로그인을 마치면 자동으로 연결됩니다.`;
          deviceStep2.textContent = login.userCode
            ? "코드를 넣고 로그인을 마치면 자동으로 연결됩니다. 창이 안 보이면 ‘로그인 창 다시 열기’를 누르세요."
            : "창이 안 보이면 ‘로그인 창 다시 열기’를 누르세요.";
          deviceStep3.textContent = "";
          deviceStep3.hidden = true;
          devicePoll.textContent = WAITING_COPY;
        }
        setStatus("브라우저에서 로그인 대기 중", "checking");
        // 링크를 눌러 열 수도 있게 남겨 둔 채 자동 실행도 시도한다(팝업 차단 시 링크가 대안).
        if (login.verificationUrl && typeof window !== "undefined" && typeof window.open === "function") {
          window.open(login.verificationUrl, "_blank", "noopener,noreferrer");
        }
        pollAttempt = 0;
        pollForLogin();
        return undefined;
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(restore);
  });

  const chooseEnvScan = (decision: "allow" | "deny"): void => {
    const gen = opGeneration;
    const provider = providerId;
    void setCompanionEnvScan(decision, provider)
      .then((auth) => {
        if (disposed || gen !== opGeneration || provider !== providerId) return;
        applyStatus(auth);
      })
      .catch((error: unknown) => {
        if (disposed || gen !== opGeneration || provider !== providerId) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      });
  };
  envScanAllow.addEventListener("click", () => chooseEnvScan("allow"));
  envScanDeny.addEventListener("click", () => chooseEnvScan("deny"));
  envScanAgain.addEventListener("click", () => chooseEnvScan("allow"));

  disconnectButton.addEventListener("click", () => {
    // 실 브라우저는 비활성 버튼의 click 을 발화하지 않는다 — fakeDom 이 발화할 수 있으므로
    // 핸들러가 자체 비활성을 확인해 이중 연산(재확인 중 끼어드는 해제)을 배제한다.
    if (disconnectButton.disabled) return;
    // 해제도 OAuth 액션 경계다 — 진행 중이던 상태 조회를 무효화하고, 이후 폴링/갱신이 새 토큰을 쓴다.
    opGeneration += 1;
    const gen = opGeneration;
    const provider = providerId;
    const isCurrent = (): boolean => !disposed && gen === opGeneration && provider === providerId;
    stopPolling();
    loginButton.disabled = true;
    disconnectButton.disabled = true;
    setStatus("연결 해제 중…", "checking");
    void disconnectCompanionAuth(provider)
      .then((auth) => {
        if (!isCurrent()) return;
        applyStatus(auth);
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        if (isChatGptCompanionResponseError(error)) showServerError(error);
        else showUnreachable(error);
      })
      .finally(() => {
        // 오래된 연산의 finally 가 새 연산의 버튼을 되살리지 못하도록 세대 가드를 건다.
        // 해제가 도는 동안 잠갔던 재확인도 같은 세대·제공자에서만 되살린다.
        if (!disposed && gen === opGeneration) {
          loginButton.disabled = false;
          disconnectButton.disabled = false;
        }
      });
  });

  fillProviders();
  applyChrome();
  setStatus("연결 확인 중…", "checking");
  void refreshStatus();
  // 선택되지 않은 카드도 실제 자격 상태를 보여 준다 — 카드가 곧 상태 표시이므로 둘 다 조회한다.
  // 선택 카드는 위 refreshStatus 경로가 담당한다.
  for (const row of providersForKind(kind)) {
    if (row.id === providerId) continue;
    const idle = row.id;
    void fetchChatGptAuthStatus(idle)
      .then((auth) => {
        if (disposed) return;
        cardAuth.set(idle, auth);
        renderCardPill(idle);
      })
      .catch(() => {
        if (disposed) return;
        cardAuth.set(idle, "error");
        renderCardPill(idle);
      });
  }

  return {
    element: el("section", {
      class: "ai-auth-settings",
      attrs: { "aria-label": "AI 연결" },
      children: [
        quickBlock,
        el("div", { class: "ai-auth-panel", dataset: { testid: "ai-auth-connection" }, children: [
          el("div", { class: "ai-auth-state", children: [status] }),
          providerHelp,
          envScanBox,
          actionsRow,
          deviceBlock,
          envScanAgain,
          timeoutNotice,
          hint,
          serverError,
        ] }),
        // 숨은 제공자 select — 카드가 선택을 주도하지만 값·change 의 원천은 여기다.
        providerSelect,
      ],
    }),
    focus: () => {
      // 폼의 첫 컨트롤로 보낸다 — 로그인 버튼에 포커스를 주면 Enter 한 번에 로그인이 발사된다.
      // API 키 입력은 두 제공자 모두에게 존재하지 않는다.
      quickButtons.get(providerId)?.focus();
    },
    recheck: () => {
      if (disposed) return;
      if (!deviceBlock.hidden) {
        // 로그인 대기 중에는 흐름을 끊지 않는다 — 이미 끝났는지만 확인하고, 아니면 그대로 기다린다.
        const gen = opGeneration;
        const provider = providerId;
        void fetchChatGptAuthStatus(provider)
          .then((auth) => {
            if (disposed || gen !== opGeneration || provider !== providerId) return;
            if (hasStoredCompanionCredential(auth)) {
              stopPolling();
              applyStatus(auth);
            }
          })
          .catch(() => undefined);
        return;
      }
      opGeneration += 1;
      setStatus("연결 확인 중…", "checking");
      void refreshStatus();
    },
    dispose: () => {
      disposed = true;
      stopPolling();
    },
  };
}
