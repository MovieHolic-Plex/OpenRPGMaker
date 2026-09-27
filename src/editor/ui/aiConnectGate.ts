// editor/ui/aiConnectGate.ts
// 프리셋 시작 전 AI 연결 관문 — 연결이 없으면 먼저 연결하도록 안내하고, 연결되면 그대로 이어 간다.
//
// 왜 관문인가 (2026-09-27): 새 프로젝트는 대부분 프리셋 포스터·「새 프로젝트」 장르로 시작한다. 그 경로는
// 기획 인터뷰 → 저장 → 첫 생성을 AI 팀에 맡기는데, AI 가 없으면 인터뷰를 다 하고 나서야 「입력창에 담았습니다」
// 토스트와 빈 맵만 남았다. 프리셋의 약속(팀이 첫 마을·이벤트를 만든다)은 AI 없이는 지킬 수 없으므로,
// 인터뷰 **전에** 막고 어디를 누르면 되는지를 한 화면에서 말한다. AI 없이 시작하는 길(⚙ 시스템 프리셋·빈 프로젝트)은
// 이 관문을 지나지 않는다.
//
// 흐름: 「AI 연결하기」 → 관문을 숨기고 AI 설정을 연다 → 설정이 닫히면 연결을 다시 조회한다 →
// 연결됐으면 관문을 닫고 true(호출부가 인터뷰로 넘어간다), 아니면 관문을 다시 보이며 현재 상태를 적는다.

import { el } from "@/util/dom";
import { loadAiConfig } from "@/ai/llmClient";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { getAiConnectionStatus, refreshAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { AI_SETTINGS_CLOSED_EVENT, openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { registerModal, unregisterModal } from "./modalStack";

export const AI_CONNECT_GATE_TESTIDS = {
  host: "ai-connect-gate",
  connect: "ai-connect-gate-connect",
  later: "ai-connect-gate-later",
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

    const laterButton = el("button", {
      class: "app-modal-button",
      text: "나중에",
      attrs: { type: "button" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.later },
    });
    const connectButton = el("button", {
      class: "app-modal-button is-confirm",
      text: "AI 연결하기",
      attrs: { type: "button" },
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.connect },
    });

    const roster = el("ul", {
      class: "ai-connect-gate-team",
      attrs: { "aria-label": "첫 생성을 맡는 AI 팀" },
      children: [
        ["팀장", "기획을 나눠 맡긴다"],
        ["시공", "맵·이벤트·DB 를 만든다"],
        ["검수", "결과를 확인하고 고친다"],
      ].map(([role, job]) => el("li", {
        class: "ai-connect-gate-member",
        children: [
          el("span", { class: "ai-connect-gate-role", text: role! }),
          el("span", { class: "ai-connect-gate-job", text: job! }),
        ],
      })),
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
        el("div", { class: "app-modal-title", text: "AI 를 먼저 연결해 주세요", attrs: { id: "ai-connect-gate-title" } }),
        el("div", {
          class: "app-modal-message",
          text: "프리셋으로 시작하면 AI 팀이 첫 마을과 이벤트를 함께 만듭니다. 연결을 마치면 이 자리에서 바로 이어서 기획을 정해요.",
          attrs: { id: "ai-connect-gate-message" },
        }),
        roster,
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

    connectButton.addEventListener("click", () => {
      if (settled) return;
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
      const first = laterButton;
      const last = connectButton;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener(AI_SETTINGS_CLOSED_EVENT, onSettingsClosed);

    paintStatus(false);
    document.body.append(overlay);
    registerModal(overlay, () => finish(false));
    connectButton.focus();
  });
}
