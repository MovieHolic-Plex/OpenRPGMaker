// 기본 모드 아이콘 레일 플라이아웃 — 열림/전환/핀 상태 머신과 셸 DOM.
// 캔버스를 리사이즈하지 않는 오버레이(스펙 §2). 상태는 순수 리듀서로 관리해 단위테스트한다.
import { el } from "@/util/dom";

export type BasicFlyoutId = "tiles" | "maps";

export interface BasicFlyoutState {
  readonly open: BasicFlyoutId | null;
  readonly pinned: boolean;
}

export type BasicFlyoutAction =
  | { readonly type: "toggle"; readonly id: BasicFlyoutId }
  /**
   * 사용자가 닫기를 누른 것이 아니라 «볼 일이 끝났다»고 앱이 판단한 자동 닫기.
   * 바깥 클릭과 "타일을 골랐다" 가 같은 뜻이므로 한 이름을 쓴다 — 핀은 존중한다.
   */
  | { readonly type: "dismiss" }
  | { readonly type: "escape" }
  | { readonly type: "pin-toggle" };

export const INITIAL_BASIC_FLYOUT_STATE: BasicFlyoutState = { open: null, pinned: false };

export function basicFlyoutReducer(state: BasicFlyoutState, action: BasicFlyoutAction): BasicFlyoutState {
  switch (action.type) {
    case "toggle":
      if (state.open === action.id) return { open: null, pinned: false };
      // 다른 패널로 전환하면 pinned 는 따라가지 않는다 — 사용자가 고정한 것은 이전 패널이다.
      return { open: action.id, pinned: false };
    case "dismiss":
      if (state.open === null || state.pinned) return state;
      return { open: null, pinned: false };
    case "escape":
      if (state.open === null) return state;
      return { open: null, pinned: false };
    case "pin-toggle":
      if (state.open === null) return state;
      return { open: state.open, pinned: !state.pinned };
  }
}

export interface FlyoutShellOptions {
  readonly title: string;
  readonly pinned: boolean;
  /** 닫을 때 포커스를 되돌려줄 토글의 data-testid (플라이아웃을 연 그 버튼). */
  readonly anchorTestId: string;
  readonly onPinToggle: () => void;
  readonly onClose: () => void;
  readonly body: HTMLElement;
}

export function buildFlyoutShell(options: FlyoutShellOptions): HTMLElement {
  // 핀 버튼의 상태 문구는 한 군데에서 정해 title 과 aria-label 이 갈라지지 않게 한다.
  // 이모지(📌)는 장식이므로 aria-hidden 으로 숨겼다 — 이전엔 이게 유일한 접근명이었다.
  const pinStateLabel = options.pinned ? "고정 해제" : "열어두기(고정)";
  const pin = el("button", {
    class: "basic-flyout-pin" + (options.pinned ? " is-pinned" : ""),
    attrs: {
      type: "button",
      title: pinStateLabel,
      "aria-label": `${options.title} ${pinStateLabel}`,
      "aria-pressed": String(options.pinned),
    },
    dataset: { testid: "basic-flyout-pin" },
    on: { click: options.onPinToggle },
    children: [el("span", { text: "\u{1F4CC}", attrs: { "aria-hidden": "true" } })],
  });
  const close = el("button", {
    class: "basic-flyout-close",
    text: "✕",
    attrs: { type: "button", title: "닫기", "aria-label": "플라이아웃 닫기" },
    dataset: { testid: "basic-flyout-close" },
    on: { click: options.onClose },
  });
  return el("div", {
    class: "basic-rail-flyout",
    // 모달이 아니다 — 포커스를 가두지도, 밖을 inert 로 만들지도 않는다. role="dialog" 는
    // 스크린리더에게 트랩과 모달 반환 계약을 약속하므로 라벨 있는 group 을 쓴다.
    attrs: { role: "group", "aria-label": options.title },
    dataset: { testid: "basic-rail-flyout", focusFallbackAnchor: options.anchorTestId },
    children: [
      el("div", {
        class: "basic-flyout-head",
        children: [el("span", { class: "basic-flyout-title", text: options.title }), pin, close],
      }),
      el("div", { class: "basic-flyout-body", children: [options.body] }),
    ],
  });
}
