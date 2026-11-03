// editor/ui/aiConnectGate.ts
// 프리셋 시작 전 AI 연결 관문 — 연결이 없으면 먼저 연결하도록 안내하고, 연결되면 그대로 이어 간다.
//
// 왜 관문인가 (2026-09-27): 새 프로젝트는 대부분 프리셋 포스터·「새 프로젝트」 장르로 시작한다. 그 경로는
// 기획 인터뷰 → 저장 → 첫 생성을 AI 팀에 맡기는데, AI 가 없으면 인터뷰를 다 하고 나서야 「입력창에 담았습니다」
// 토스트와 빈 맵만 남았다. 프리셋의 약속(팀이 첫 마을·이벤트를 만든다)은 AI 없이는 지킬 수 없으므로,
// 메뉴·웰컴은 인터뷰 전에, 런처는 최종 확정 뒤에 연결을 안내한다. AI 없이 시작하는 길(⚙ 시스템 프리셋·빈 프로젝트)은
// 이 관문을 지나지 않는다.
//
// 2026-11-03: 관문 안에 빠른 연결 카드(aiQuickConnect — OpenRouter 키 또는 OpenAI 호환 주소·키·모델)를 바로 둔다.
// 키를 붙여 넣고 「연결」 하면 실제 채팅 한 번이 통과할 때만 저장하고 곧바로 이어 간다. 첫 실행 화면은 ensureAiConnected() 를 부른다.
// 같은 날 자동 감지: 이 PC 에 이미 로그인된 구독이 있으면 「연결됨: <이름> · 이걸로 시작」 한 장을 위에 둔다(findSignedInPlans,
// 요금제별 기본값은 src/ai/planDefaults.ts).
//
// 「다른 방법으로 연결」 흐름: 관문을 숨기고 AI 설정을 연다 → 설정이 닫히면 연결을 다시 조회한다 →
// 연결됐으면 관문을 닫고 true(호출부가 인터뷰로 넘어간다), 아니면 관문을 다시 보이며 현재 상태를 적는다.

import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { t } from "@/i18n";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForProviderSelection } from "@/ai/providerSelection";
import { fetchChatGptAuthStatus } from "@/ai/chatgptOAuthClient";
import { loadAssistantEngine, saveAssistantEngine } from "@/ai/localCliEngine";
import { CODEX_ACCOUNT_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID, planCandidates, type DetectedAccount, type DetectedCli, type PlanCandidate } from "@/ai/planDefaults";
import { createLocalAgentsApi, localAgentsEnabled } from "@/start/settings/localAgents";
import { renderAiQuickConnect } from "@/editor/panels/aiQuickConnect";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { getAiConnectionStatus, refreshAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { AI_SETTINGS_CLOSED_EVENT } from "@/editor/panels/aiSettingsEvents";
import { registerModal, unregisterModal } from "./modalStack";
import "@/styles/components/app-modal.css";

export const AI_CONNECT_GATE_TESTIDS = {
  host: "ai-connect-gate",
  connect: "ai-connect-gate-connect",
  later: "ai-connect-gate-later",
  quick: "ai-connect-gate-quick",
  status: "ai-connect-gate-status",
  detected: "ai-connect-gate-detected",
  start: "ai-connect-gate-start",
  plan: "ai-connect-gate-plan",
  useKey: "ai-connect-gate-use-key",
} as const;

/**
 * 감지를 기다리는 상한. 관문은 감지를 기다리지 않는다 — 열리자마자 OpenRouter 카드가 보이고, 찾으면 그때 카드가 올라온다.
 * 따뜻한 감지는 1.5초 안팎이지만 앱을 켜고 첫 감지는 동반 워커를 띄우느라 3초를 넘기도 해서(2026-11-03 실측 3.1초)
 * 3초로 자르면 로그인된 사람에게도 키 카드만 남는다.
 */
export const PLAN_DETECT_TIMEOUT_MS = 10_000;

/**
 * 이 PC 에 이미 로그인된 구독(Claude Code CLI 구독 · Codex CLI ChatGPT 로그인 · 편집기 안 ChatGPT/Google 로그인)을
 * Claude → ChatGPT → 나머지 순으로 돌려준다(src/ai/planDefaults.ts). 엔진을 이미 고른 사용자는 빈 목록(기본값을 바꾸지 않는다).
 * 감지는 fresh 로 한 번, timeoutMs 안에 끝나지 않으면 빈 목록. 환경 변수 키는 보지 않는다(동의 규칙은 동반 서비스가 지킨다).
 * 첫 실행 화면도 이것과 startWithPlan 으로 같은 카드를 만들 수 있다.
 */
export async function findSignedInPlans(timeoutMs = PLAN_DETECT_TIMEOUT_MS): Promise<PlanCandidate[]> {
  if (loadAssistantEngine()) return [];
  const clis: Promise<readonly DetectedCli[]> = localAgentsEnabled()
    ? createLocalAgentsApi().detect(true).then((report) => report.clis, () => [])
    : Promise.resolve([]);
  const accounts: Promise<DetectedAccount[]> = Promise.all([CODEX_ACCOUNT_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID].map((providerId) =>
    fetchChatGptAuthStatus(providerId).then((status): DetectedAccount => ({ providerId, ...status }), () => null),
  )).then((rows) => rows.filter((row): row is DetectedAccount => row !== null));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  const found = await Promise.race([Promise.all([clis, accounts]), timeout]);
  clearTimeout(timer);
  return found ? planCandidates(found[0], found[1]) : [];
}

/** 보여 줄 한 줄 — 카드와 시작 뒤 알림에 같은 글을 쓴다. */
export function planSummaryLine(plan: PlanCandidate): string {
  return t("{0} 설정에서 바꿀 수 있어요.").replace("{0}", t(plan.setup));
}

/** 그 로그인으로 조수를 맞춘다. 실제로 연결이 서면 true, 아니면 엔진 선택을 되돌리고 false. */
export async function startWithPlan(plan: PlanCandidate): Promise<boolean> {
  if (plan.kind === "local-cli") saveAssistantEngine(plan.engine);
  else saveAiConfig(configForProviderSelection(loadAiConfig(), plan.providerId));
  if (await connectedNow()) return true;
  if (plan.kind === "local-cli") saveAssistantEngine(undefined);
  return false;
}

export type AiConnectGateOptions = {
  /** 고른 프리셋 이름. 제목 위 눈썹줄에 그대로 보인다. */
  readonly presetLabel?: string;
};

function domReady(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && Boolean(document.body);
}

/**
 * 연결을 한 번 새로 조회한 뒤 판정한다. 캐시가 차가운 `checking` 을 그대로 쓰면 로그인된 사용자도 통과시키고
 * (조회 전이라), 반대로 조회 없이 막으면 멀쩡한 사용자를 가둔다. 그래서 먼저 조회한다.
 * 조회 자체가 실패해도 판정은 캐시가 한다 — 조회 실패는 캐시에 `offline` 으로 남는다.
 */
async function connectedNow(): Promise<boolean> {
  try {
    await refreshAiConnectionStatus();
  } catch {
    /* 판정은 아래 캐시가 한다 */
  }
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}

/**
 * AI 가 연결돼 있으면 곧바로 true. 아니면 연결 안내 창을 띄우고, 연결을 마치면 true, 「나중에」 면 false.
 * DOM 이 없는 환경(노드 스크립트)에서는 막지 않는다.
 */
export async function ensureAiConnectedForPreset(options: AiConnectGateOptions = {}): Promise<boolean> {
  if (!domReady()) return true;
  if (await connectedNow()) return true;
  return new Promise((resolve) => {
    const opener = document.activeElement;
    let settled = false;
    let waitingForSettings = false;

    const status = el("p", {
      class: "ai-connect-gate-status",
      attrs: { role: "status", "aria-live": "polite" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.status },
    });
    const paintStatus = (retry: boolean): void => {
      const current = getAiConnectionStatus(loadAiConfig());
      status.textContent = retry
        ? `아직 연결되지 않았어요 · ${current.label}`
        : `지금 상태 · ${current.label}`;
    };

    // 빠른 연결 카드(OpenRouter 키·OpenAI 호환)를 관문 안에 바로 둔다 — 설정 창을 열지 않고 여기서 끝낼 수 있다.
    // 저장되면 그 엔드포인트를 기본 연결로 고르고(설정 창의 카드 선택과 같은 configForProviderSelection), 다시 판정한다.
    const quick = renderAiQuickConnect({
      onConnected: async (endpoint) => {
        saveAiConfig(configForProviderSelection(loadAiConfig(), endpoint.id));
        const connected = await connectedNow();
        if (settled) return;
        if (connected) finish(true);
        else paintStatus(true);
      },
    });
    quick.element.dataset.testid = AI_CONNECT_GATE_TESTIDS.quick;

    // 이미 로그인된 구독을 찾는 동안에도 키 카드는 보인다. 찾으면 그 카드 한 장을 위에 두고 키 카드는 「키로 연결」 뒤로 접는다.
    const detected = el("section", {
      class: "ai-connect-gate-detected",
      attrs: { "aria-label": "이 PC 에 로그인된 AI", "aria-live": "polite" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.detected, state: "finding" },
      children: [el("p", { class: "ai-connect-gate-status", text: "이 PC 에 로그인된 AI 를 찾는 중이에요…" })],
    });
    const keyToggle = el("button", {
      class: "app-modal-button ai-connect-gate-link",
      text: "API 키로 연결",
      attrs: { type: "button" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.useKey },
    });
    keyToggle.hidden = true;
    keyToggle.addEventListener("click", () => { quick.element.hidden = false; keyToggle.hidden = true; quick.focus(); });
    let starting = false;
    const paintPlans = (plans: readonly PlanCandidate[], index: number): void => {
      const plan = plans[index];
      if (!plan) { detected.hidden = true; detected.dataset.state = "none"; return; }
      detected.dataset.state = "found";
      detected.dataset.plan = plan.key;
      const start = el("button", {
        class: "app-modal-button is-confirm ai-connect-gate-start",
        text: t("연결됨: {0} · 이걸로 시작").replace("{0}", t(plan.name)),
        attrs: { type: "button" },
        dataset: { testid: AI_CONNECT_GATE_TESTIDS.start },
      });
      start.addEventListener("click", async () => {
        if (starting || settled) return;
        starting = true;
        start.disabled = true;
        status.textContent = "연결을 확인하고 있어요…";
        const ok = await startWithPlan(plan);
        starting = false;
        if (settled) return;
        if (ok) { toast(t("{0}(으)로 시작해요. {1}").replace("{0}", t(plan.name)).replace("{1}", planSummaryLine(plan)), "ok"); finish(true); return; }
        start.disabled = false;
        paintStatus(true);
      });
      const others = plans.flatMap((other, i) => (i === index ? [] : [el("button", {
        class: "ai-connect-gate-switch",
        text: other.name,
        attrs: { type: "button" },
        dataset: { plan: other.key },
        on: { click: () => paintPlans(plans, i) },
      })]));
      detected.replaceChildren(
        start,
        el("p", { class: "ai-connect-gate-plan", text: planSummaryLine(plan), dataset: { testid: AI_CONNECT_GATE_TESTIDS.plan } }),
        ...(others.length ? [el("div", { class: "ai-connect-gate-switches", children: [el("span", { class: "ai-connect-gate-status", text: "다른 로그인으로:" }), ...others] })] : []),
      );
      quick.element.hidden = true;
      keyToggle.hidden = false;
    };
    void findSignedInPlans().then((plans) => {
      if (settled) return;
      const typing = quick.element.contains(document.activeElement) && Boolean((document.activeElement as HTMLInputElement | null)?.value);
      paintPlans(plans, 0);
      // 키를 이미 치고 있었으면 카드를 접지 않는다.
      if (typing) { quick.element.hidden = false; keyToggle.hidden = true; }
      if (plans.length && !typing) detected.querySelector<HTMLButtonElement>("button")?.focus();
    });

    const laterButton = el("button", {
      class: "app-modal-button",
      text: "나중에",
      attrs: { type: "button" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.later },
    });
    const connectButton = el("button", {
      class: "app-modal-button is-confirm",
      text: "다른 방법으로 연결",
      attrs: { type: "button" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.connect },
    });

    const card = el("div", {
      class: "app-modal-card ai-connect-gate-card",
      attrs: {
        role: "alertdialog",
        "aria-modal": "true",
        "aria-labelledby": "ai-connect-gate-title",
        "aria-describedby": "ai-connect-gate-message",
      },
      children: [
        ...(options.presetLabel
          ? [el("span", { class: "ai-connect-gate-kicker", text: `${options.presetLabel} 프리셋` })]
          : []),
        el("div", { class: "app-modal-title", text: "AI 를 연결하고 시작해요", attrs: { id: "ai-connect-gate-title" } }),
        el("div", {
          class: "app-modal-message",
          text: "AI 팀이 기획을 나누고, 맵·이벤트를 만들고, 결과를 검수해요. 연결을 마치면 선택한 내용으로 이어서 진행해요.",
          attrs: { id: "ai-connect-gate-message" },
        }),
        detected,
        quick.element,
        keyToggle,
        el("p", { class: "ai-connect-gate-status", text: "Google·ChatGPT 계정 로그인이나 다른 제공자는 「다른 방법으로 연결」 에서 고를 수 있어요." }),
        status,
        el("div", { class: "app-modal-actions", children: [laterButton, connectButton] }),
      ],
    });
    const overlay = el("div", {
      class: "app-modal-overlay ai-connect-gate-overlay",
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.host },
      children: [card],
    });

    const finish = (connected: boolean): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener(AI_SETTINGS_CLOSED_EVENT, onSettingsClosed);
      unregisterModal(overlay);
      overlay.remove();
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
      resolve(connected);
    };

    // 설정 창이 닫히는 순간이 로그인 결과를 확인할 시점이다(aiLockScrim 과 같은 신호).
    async function onSettingsClosed(): Promise<void> {
      if (!waitingForSettings || settled) return;
      waitingForSettings = false;
      connectButton.disabled = true;
      status.textContent = "연결을 확인하고 있어요…";
      overlay.hidden = false;
      const connected = await connectedNow();
      if (settled) return;
      if (connected) { finish(true); return; }
      connectButton.disabled = false;
      paintStatus(true);
      connectButton.focus();
    }

    connectButton.addEventListener("click", async () => {
      if (settled || connectButton.disabled) return;
      connectButton.disabled = true;
      let openAiSettingsModal: typeof import("@/editor/panels/aiSettingsModal").openAiSettingsModal;
      try {
        ({ openAiSettingsModal } = await import("@/editor/panels/aiSettingsModal"));
      } catch {
        if (!settled) { connectButton.disabled = false; status.textContent = "연결 설정을 열지 못했어요. 다시 눌러 주세요."; }
        return;
      }
      if (settled) return;
      connectButton.disabled = false;
      // 관문은 숨기기만 한다 — 설정 창 위아래로 두 창이 겹쳐 보이지 않게 하고, 닫히면 같은 자리로 돌아온다.
      overlay.hidden = true;
      // 대기 표시는 설정 창을 **연 뒤에** 켠다. openAiSettingsModal 은 먼저 closeAiSettingsModal() 을 불러
      // 열린 창이 없어도 닫힘 신호를 한 번 쏜다 — 그 전에 켜 두면 그 신호를 로그인 결과로 읽고 곧바로 되돌아온다
      // (2026-09-27 브라우저 실측: 관문이 설정 창 뒤에 다시 떠 있었고, 실제 닫힘은 무시됐다).
      const settings = openAiSettingsModal();
      waitingForSettings = true;
      // 설정 창은 --z-modal-overlay(2200) 층이라 「새 프로젝트」 다이얼로그(--z-app-modal 2600) 뒤에 깔린다.
      // 관문이 연 설정 창만 앱 모달 위로 올린다. 지연 툴팁(2650)·토스트(2700)보다는 아래다.
      settings.style.zIndex = "calc(var(--z-app-modal, 2600) + 2)";
    });
    laterButton.addEventListener("click", () => finish(false));
    card.addEventListener("click", (event) => event.stopPropagation());
    overlay.addEventListener("click", () => { if (!overlay.hidden) finish(false); });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusables = [...card.querySelectorAll<HTMLElement>("button, input, a[href]")].filter((node) => !node.hidden && !node.closest("[hidden]") && !(node as HTMLButtonElement).disabled);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener(AI_SETTINGS_CLOSED_EVENT, onSettingsClosed);

    paintStatus(false);
    document.body.append(overlay);
    registerModal(overlay, () => finish(false));
    quick.focus();
  });
}

/**
 * 첫 실행 화면용 입구. 연결돼 있으면 곧바로 true, 아니면 빠른 연결 카드가 든 관문을 띄워 연결되면 true, 「나중에」 면 false.
 * presetLabel 은 선택이다(눈썹줄). DOM 이 없는 환경에서는 막지 않는다(true).
 */
export function ensureAiConnected(options: AiConnectGateOptions = {}): Promise<boolean> {
  return ensureAiConnectedForPreset(options);
}
