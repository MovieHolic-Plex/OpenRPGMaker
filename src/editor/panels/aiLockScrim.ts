// editor/panels/aiLockScrim.ts
// AI 미연결 잠금 막 — 연결이 없으면 채팅 영역을 덮는다.
//
// 왜 오버레이인가 (2026-09-22 실측): placeholder 문구와 톱바 칩으로 알리던 것을 넘어서,
// 그건 **읽어야 아는** 신호였다. 사용자는 지시를 쓰고 보낸 뒤에야 — "의도 읽는 중…" 에서
// 멈춘 뒤에야 — 막힌다는 걸 알았다. 이 앱에서 AI 는 핵심 시스템이므로, 없으면 그 자리가
// 비어 보여야 한다.
//
// 입력 자체를 disabled 로 만들지는 않는다: 쓰다가 로그인하면 그대로 이어 쓸 수 있어야 하고,
// 무엇보다 "왜 못 쓰는지" 를 읽는 동안 커서가 살아 있으면 다시 눌러 보게 된다.
import { getAiConnectionStatus } from "./aiConnectionStatus";
import { isAiConfigReady } from "./aiChatPanelHelpers";
import { loadAiConfig } from "@/ai/llmClient";
import { el } from "@/util/dom";

export const AI_LOCK_SCRIM_TESTIDS = {
  host: "ai-lock-scrim",
  action: "ai-lock-action",
} as const;

export type AiLockScrim = {
  readonly element: HTMLElement;
  /** 연결 상태에 맞춰 막을 걷거나 덮는다. 돌려주는 값은 "지금 잠겼는가". */
  sync(): boolean;
  /** 패널 클래스까지 함께 관리하려면 이 콜백을 넘긴다. */
  dispose(): void;
};

/**
 * 잠금 막을 만든다.
 *
 * `onOpenSettings` 는 "AI 연결하기" 버튼이 부른다. `onLockChange` 는 잠금 상태가 바뀔 때
 * 패널 클래스 같은 바깥 표면을 맞추는 데 쓴다.
 */
export function createAiLockScrim(options: {
  readonly onOpenSettings: () => void;
  readonly onLockChange?: (locked: boolean) => void;
}): AiLockScrim {
  const element = el("div", {
    class: "ai-lock-scrim",
    attrs: { role: "status", "aria-live": "polite", hidden: "" },
    dataset: { testid: AI_LOCK_SCRIM_TESTIDS.host },
    children: [
      el("div", {
        class: "ai-lock-card",
        children: [
          el("span", { class: "ai-lock-icon", attrs: { "aria-hidden": "true" }, text: "✦" }),
          el("p", { class: "ai-lock-title", text: "AI 연결이 필요합니다" }),
          el("p", {
            class: "ai-lock-body",
            text: "로그인하면 마을 만들기·NPC 배치·이벤트 작성을 AI 와 함께 할 수 있습니다.",
          }),
          el("button", {
            class: "ai-lock-action",
            attrs: { type: "button" },
            dataset: { testid: AI_LOCK_SCRIM_TESTIDS.action },
            text: "AI 연결하기",
            on: { click: () => options.onOpenSettings() },
          }),
        ],
      }),
    ],
  });

  /**
   * `ready` 일 때만 걷는다. `checking` 은 아직 모르는 상태이므로 막지 않는다 —
   * 조회가 끝나기 전에 가두면 멀쩡한 사용자가 갇힌다.
   */
  const sync = (): boolean => {
    const config = loadAiConfig();
    const locked = !isAiConfigReady(config, getAiConnectionStatus(config));
    element.hidden = !locked;
    options.onLockChange?.(locked);
    return locked;
  };

  // 로그인했는데 막이 남아 있으면 그게 더 나쁘다. 설정 모달은 닫힘 이벤트를 주지 않으므로
  // **막 자체가 다시 판정의 계기**가 된다 — 누르거나 포커스를 주면 그때 최신 상태를 본다.
  // 폴링을 붙이지 않는 이유: 이 막이 떠 있는 동안 할 수 있는 일이 "설정 열기" 뿐이다.
  const reevaluate = (): void => { sync(); };
  element.addEventListener("click", reevaluate);
  element.addEventListener("focusin", reevaluate);

  return {
    element,
    sync,
    dispose: () => {
      element.removeEventListener("click", reevaluate);
      element.removeEventListener("focusin", reevaluate);
    },
  };
}

