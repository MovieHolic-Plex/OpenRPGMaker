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
//
// 「다른 방법으로 연결」 흐름: 관문을 숨기고 AI 설정을 연다 → 설정이 닫히면 연결을 다시 조회한다 →
// 연결됐으면 관문을 닫고 true(호출부가 인터뷰로 넘어간다), 아니면 관문을 다시 보이며 현재 상태를 적는다.

import { el } from "@/util/dom";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForProviderSelection } from "@/ai/providerSelection";
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
} as const;

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
        quick.element,
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
