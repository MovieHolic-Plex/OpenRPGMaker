// editor/ui/aiConnectGate.ts
// 프리셋 시작 전 AI 연결 관문 — 연결이 없으면 먼저 연결하도록 안내하고, 연결되면 그대로 이어 간다.
//
// 왜 관문인가 (2026-09-27): 새 프로젝트는 대부분 프리셋 포스터·「새 프로젝트」 장르로 시작한다. 그 경로는
// 기획 인터뷰 → 저장 → 첫 생성을 AI 팀에 맡기는데, AI 가 없으면 인터뷰를 다 하고 나서야 「입력창에 담았습니다」
// 토스트와 빈 맵만 남았다. 프리셋의 약속(팀이 첫 마을·이벤트를 만든다)은 AI 없이는 지킬 수 없으므로,
// 메뉴·웰컴은 인터뷰 전에, 런처는 최종 확정 뒤에 연결을 안내한다. AI 없이 시작하는 길(⚙ 시스템 프리셋·빈 프로젝트)은
// 이 관문을 지나지 않는다.
//
// 2026-11-04: 관문 본문은 첫 실행 설정 마법사(aiSetupWizard.ts)다 — 이 PC 에서 찾은 구독·로그인·키로 만들 수 있는 가장 좋은 AI 팀을
// 점수표(src/ai/teamScoreboard.ts)로 골라 「이걸로 시작하기」 한 번으로 맞춘다. 아무것도 없으면 쓰는 서비스를 고르게 하고
// 설치·로그인·키 붙여 넣기를 한 단계씩 안내한다. 연결됐으면 true(호출부가 인터뷰로 넘어간다), 「나중에」 면 false.

import { el } from "@/util/dom";
import { loadAiConfig } from "@/ai/llmClient";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { getAiConnectionStatus, refreshAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
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
  const [{ createAiSetupWizard }, { realWizardDeps }] = await Promise.all([import("./aiSetupWizard"), import("./aiSetupWizardDeps")]);
  return new Promise((resolve) => {
    const opener = document.activeElement;
    let settled = false;

    const finish = (connected: boolean): void => {
      if (settled) return;
      settled = true;
      unregisterModal(overlay);
      overlay.remove();
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
      resolve(connected);
    };

    const wizard = createAiSetupWizard(realWizardDeps(async (connected) => {
      if (!connected) { finish(false); return; }
      finish(await connectedNow());
    }));

    const card = el("div", {
      class: "app-modal-card ai-connect-gate-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "ai-setup-wizard-title" },
      children: [
        ...(options.presetLabel ? [el("span", { class: "ai-connect-gate-kicker", text: `${options.presetLabel} 프리셋` })] : []),
        wizard.element,
      ],
    });
    const overlay = el("div", {
      class: "app-modal-overlay ai-connect-gate-overlay",
      dataset: { testid: AI_CONNECT_GATE_TESTIDS.host },
      children: [card],
    });
    card.addEventListener("click", (event) => event.stopPropagation());
    overlay.addEventListener("click", () => finish(false));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusables = [...card.querySelectorAll<HTMLElement>("button, input, a[href], summary")].filter((node) => !node.hidden && !node.closest("[hidden]") && !(node as HTMLButtonElement).disabled);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.body.append(overlay);
    registerModal(overlay, () => finish(false));
    card.querySelector<HTMLElement>("button")?.focus();
  });
}

/**
 * 첫 실행 화면용 입구. 연결돼 있으면 곧바로 true, 아니면 빠른 연결 카드가 든 관문을 띄워 연결되면 true, 「나중에」 면 false.
 * presetLabel 은 선택이다(눈썹줄). DOM 이 없는 환경에서는 막지 않는다(true).
 */
export function ensureAiConnected(options: AiConnectGateOptions = {}): Promise<boolean> {
  return ensureAiConnectedForPreset(options);
}
