// editor/panels/aiConnectionChip.ts
// 톱바에 상시 붙는 AI 연결 상태 칩.
//
// 왜 필요한가 (2026-09-22 실측): 연결 상태를 계산하는 코드는 `aiConnectionStatus.ts` 에
// 갖춰져 있는데, 그걸 **상시 보여주는 자리가 없었다.** 하단 상태바 폐지(2026-08-25)로
// 호스트를 잃었고, 톱바에는 「⚙ AI 설정」 아이콘 버튼만 남았다. 그래서 사용자는 들어가자마자
// OAuth 가 붙었는지 알 수 없었고, 첫 문장을 보내고 나서야("의도 읽는 중…" 에서 멈추거나
// 실패 토스트가 뜬 뒤에야) 알았다 — 이 앱에서 AI 는 핵심 시스템인데 상태가 사후에만 보였다.
//
// 저장 상태 칩(`renderTopbarSaveStatus`)과 같은 이유·같은 방식이다. 그쪽 주석의 실측
// ("호스트를 잃어 프로덕션 호출 사이트가 0건")과 같은 사고가 AI 쪽에서 반복됐다.
//
// 설계 원칙 셋:
//  1. **평상시에도 보인다.** ready 일 때 숨기면 "안 보이면 정상" 을 배워야 하고, 그 학습이
//     끝난 사용자는 진짜 문제일 때도 못 본다. 저장 칩이 조용할 때 접는 것과 반대다 —
//     저장은 성공이 기본값이지만 AI 연결은 **처음 한 번 반드시 물어봐야 하는 것**이다.
//  2. **누를 수 있다.** 상태만 보여주고 끝내면 "확인 중…" 에서 사용자가 할 게 없다.
//     ready 가 아니면 누를 때 설정을 연다.
//  3. **거짓말하지 않는다.** 캐시가 차가우면 "확인 중" 이라고 말한다 — "연결됨" 이라고
//     단정했다가 첫 요청이 404 로 죽는 사고(2026-08-19 적대 평가 P0)를 반복하지 않는다.
import {
  getAiConnectionStatus,
  refreshAiConnectionStatus,
  type AiConnectionStatus,
} from "@/editor/panels/aiConnectionStatus";
import { el } from "@/util/dom";

export const AI_CONNECTION_CHIP_TESTIDS = {
  host: "ai-connection-chip",
  label: "ai-connection-label",
} as const;

/** 상태별로 사용자가 다음에 할 일. ready 만 "할 일 없음" 이다. */
function actionHint(status: AiConnectionStatus): string | null {
  switch (status.kind) {
    case "ready":
      return null;
    case "checking":
      return "로그인 상태를 확인하는 중입니다.";
    case "disconnected":
      return "AI 설정에서 로그인하세요.";
    case "offline":
      return "동반 서비스에 닿지 못했습니다. AI 설정에서 연결을 확인하세요.";
    case "error":
      return "동반 서비스가 오류를 돌려줬습니다. AI 설정을 확인하세요.";
  }
}

/**
 * 칩 하나를 만든다. `openSettings` 는 ready 가 아닐 때 눌렀을 때 불린다.
 *
 * 구독은 호출자가 하나만 살린다 — `renderTopbar` 가 다시 그릴 때마다 리스너가 쌓이면
 * 상태 변경 한 번에 옛 칩이 전부 갱신되며 낭비한다(저장 칩이 같은 이유로 dispose 를 든다).
 */
export function renderAiConnectionChip(openSettings: () => void): {
  readonly element: HTMLElement;
  readonly dispose: () => void;
} {
  const label = el("span", {
    class: "ai-connection-label",
    dataset: { testid: AI_CONNECTION_CHIP_TESTIDS.label },
  });
  const button = el("button", {
    class: "ai-connection-chip",
    attrs: { type: "button" },
    dataset: { testid: AI_CONNECTION_CHIP_TESTIDS.host },
    children: [
      el("span", { class: "ai-connection-dot", attrs: { "aria-hidden": "true" } }),
      label,
    ],
    on: {
      click: () => {
        // ready 일 때는 설정을 열 이유가 없다 — 열어도 할 게 없다.
        if (paint(button, label, openSettings) !== "ready") openSettings();
      },
    },
  }) as HTMLButtonElement;

  const repaint = (): void => { paint(button, label, openSettings); };
  // **먼저 칠한다.** refreshAiConnectionStatus 는 chatgpt 모드가 아니면 콜백을 부르지 않으므로,
  // 그 콜백만 기대면 칩이 빈 채로 남는다(2026-09-22 실측: text:"" — 존재하지만 라벨이 없었다).
  repaint();
  // 캐시가 차가우면 여기서 "확인 중" 이 보이고, 조회가 끝나면 repaint 로 실제 상태가 된다.
  void refreshAiConnectionStatus(repaint).catch(() => repaint());

  return { element: button, dispose: () => undefined };
}

/** 칩을 현재 상태로 칠하고, 그 상태를 돌려준다(클릭 핸들러가 재판정에 쓴다). */
function paint(button: HTMLButtonElement, label: HTMLElement, _openSettings: () => void): AiConnectionStatus["kind"] {
  const status = getAiConnectionStatus();
  button.dataset.kind = status.kind;
  label.textContent = status.label;
  const hint = actionHint(status);
  button.setAttribute("title", hint ? `${status.title} — ${hint}` : status.title);
  button.setAttribute("aria-label", hint ? `${status.label}. ${hint}` : status.label);
  button.classList.toggle("is-actionable", hint !== null);
  return status.kind;
}
