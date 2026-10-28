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
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus, refreshAiConnectionStatus } from "./aiConnectionStatus";
import { isAiConfigReady } from "./aiChatPanelHelpers";
import { AI_SETTINGS_CLOSED_EVENT } from "./aiSettingsModal";
import { loadAiConfig } from "@/ai/llmClient";
import { el } from "@/util/dom";

export const AI_LOCK_SCRIM_TESTIDS = {
  host: "ai-lock-scrim",
  action: "ai-lock-action",
} as const;

/** 막의 설명 문장 id. 패널·스튜디오 입력이 잠겨 있을 때 aria-describedby 로 가리킨다. */
export const AI_LOCK_REASON_ID = "ai-lock-reason";
export const AI_LOCK_TITLE_ID = "ai-lock-title";
/** 잠긴 입력의 aria-describedby — 막의 제목(무엇이 필요한지)과 설명(왜)을 함께 읽는다. */
export const AI_LOCK_DESCRIBEDBY = `${AI_LOCK_TITLE_ID} ${AI_LOCK_REASON_ID}`;

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
  const titleEl = el("p", { class: "ai-lock-title", attrs: { id: AI_LOCK_TITLE_ID }, text: "AI 연결이 필요합니다" });
  // 입력창들이 aria-describedby 로 이 문장을 가리킨다 — 「왜 못 쓰는지」를 막과 입력이 같은 말로 한다(C-60).
  const bodyEl = el("p", {
    class: "ai-lock-body",
    attrs: { id: AI_LOCK_REASON_ID },
    text: "로그인하면 마을 만들기·NPC 배치·이벤트 작성을 AI 와 함께 할 수 있습니다.",
  });
  const actionEl = el("button", {
    class: "ai-lock-action",
    attrs: { type: "button" },
    dataset: { testid: AI_LOCK_SCRIM_TESTIDS.action },
    text: "AI 연결하기",
    on: { click: () => options.onOpenSettings() },
  });
  const element = el("div", {
    class: "ai-lock-scrim",
    attrs: { role: "status", "aria-live": "polite", hidden: "" },
    dataset: { testid: AI_LOCK_SCRIM_TESTIDS.host },
    children: [
      el("div", {
        class: "ai-lock-card",
        children: [
          titleEl,
          bodyEl,
          actionEl,
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
    // 톱바 칩과 같은 말을 한다 — 서버가 AI 를 꺼 둔 경우 로그인 버튼은 막다른 길이라 숨긴다(2차 UI/UX 검수 F24).
    const hostOff = locked && getAiConnectionStatus(config).hostAiDisabled === true;
    titleEl.textContent = hostOff ? "AI 서버에서 꺼짐" : "AI 연결이 필요합니다";
    bodyEl.textContent = hostOff
      ? "이 서버에서는 AI 가 꺼져 있어요. 서버 관리자에게 AI 를 켜 달라고 요청하세요."
      : "로그인하면 마을 만들기·NPC 배치·이벤트 작성을 AI 와 함께 할 수 있습니다.";
    actionEl.hidden = hostOff;
    options.onLockChange?.(locked);
    return locked;
  };

  /**
   * 캐시를 새로 읽고 다시 칠한다.
   *
   * 왜 `sync()` 만으로는 부족한가 (2026-09-22 실측): `getAiConnectionStatus` 는 동반 서비스
   * 조회의 **캐시**를 읽는다. 그 캐시는 `refreshAiConnectionStatus` 로만 갱신되므로, 막을
   * 누르거나 설정 모달이 닫혀도 캐시가 낡아 있으면 여전히 "로그인 필요" 로 판정한다.
   * 실측에서 이벤트가 2번 정상 발화했는데도 막이 걷히지 않았다 — 원인은 이벤트가 아니라 캐시였다.
   *
   * `checking`(캐시가 차가움)으로 판정되는 동안에는 막지 않는다: 조회 중에 가두면
   * 멀쩡한 사용자가 갇힌다.
   */
  const revalidate = (): void => {
    void refreshAiConnectionStatus(() => { sync(); }).then(() => { sync(); }).catch(() => { sync(); });
  };

  // 로그인했는데 막이 남아 있으면 그게 더 나쁘다. 설정 모달이 닫히는 순간 다시 판정한다 —
  // 이게 주 경로다. 막을 누르는 것은 모달을 거치지 않고 상태가 바뀐 경우(다른 창에서 로그인,
  // 토큰 만료 등)를 위한 보조 계기다. 폴링은 붙이지 않는다: 감시할 시점이 둘로 좁혀졌다.
  const onSettingsClosed = (): void => { revalidate(); };
  // 다른 호출부(부팅 warm-up·설정 모달·칩)가 한 조회로 캐시가 바뀌어도 막을 다시 칠한다.
  const onStatusChanged = (): void => { sync(); };
  // window 가 없는 환경(노드 렌더 테스트의 fakeDom)에서도 패널을 그릴 수 있게 리스너만 건너뛴다.
  const win = typeof window === "undefined" ? null : window;
  win?.addEventListener(AI_SETTINGS_CLOSED_EVENT, onSettingsClosed);
  win?.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, onStatusChanged);
  const reevaluate = (): void => { revalidate(); };
  element.addEventListener("click", reevaluate);
  element.addEventListener("focusin", reevaluate);

  return {
    element,
    sync,
    dispose: () => {
      win?.removeEventListener(AI_SETTINGS_CLOSED_EVENT, onSettingsClosed);
      win?.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, onStatusChanged);
      element.removeEventListener("click", reevaluate);
      element.removeEventListener("focusin", reevaluate);
    },
  };
}
