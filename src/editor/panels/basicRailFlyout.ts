// 기본 모드 아이콘 레일 플라이아웃 — 열림/전환/핀 상태 머신과 셸 DOM.
// 캔버스를 리사이즈하지 않는 오버레이(스펙 §2). 상태는 순수 리듀서로 관리해 단위테스트한다.
import { el } from "@/util/dom";

export type BasicFlyoutId = "tiles" | "layers" | "maps";

export interface BasicFlyoutState {
  readonly open: BasicFlyoutId | null;
  readonly pinned: boolean;
}

export type BasicFlyoutAction =
  | { readonly type: "toggle"; readonly id: BasicFlyoutId }
  | { readonly type: "outside-click" }
  | { readonly type: "escape" }
  | { readonly type: "pin-toggle" };

export const INITIAL_BASIC_FLYOUT_STATE: BasicFlyoutState = { open: null, pinned: false };

export function basicFlyoutReducer(state: BasicFlyoutState, action: BasicFlyoutAction): BasicFlyoutState {
  switch (action.type) {
    case "toggle":
      if (state.open === action.id) return { open: null, pinned: false };
      return { open: action.id, pinned: state.pinned };
    case "outside-click":
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
  readonly onPinToggle: () => void;
  readonly onClose: () => void;
  readonly body: HTMLElement;
}

export function buildFlyoutShell(options: FlyoutShellOptions): HTMLElement {
  const pin = el("button", {
    class: "basic-flyout-pin" + (options.pinned ? " is-pinned" : ""),
    text: "📌",
    attrs: {
      type: "button",
      title: options.pinned ? "고정 해제" : "열어두기(고정)",
      "aria-pressed": String(options.pinned),
    },
    dataset: { testid: "basic-flyout-pin" },
    on: { click: options.onPinToggle },
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
    attrs: { role: "dialog", "aria-label": options.title },
    dataset: { testid: "basic-rail-flyout" },
    children: [
      el("div", {
        class: "basic-flyout-head",
        children: [el("span", { class: "basic-flyout-title", text: options.title }), pin, close],
      }),
      el("div", { class: "basic-flyout-body", children: [options.body] }),
    ],
  });
}
