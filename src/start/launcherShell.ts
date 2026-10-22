// start/launcherShell.ts
// 데스크톱 첫 화면의 틀(2026-10-20 「라이브러리 홈」, 설계 http://mdc-server:18301/home-redesign-1.html A안):
// 왼쪽 레일(홈 · 내 게임 · 기본 게임 · 새로 만들기 · 에셋 스토어, 바닥에 AI 상태 줄 · 설정 · 판 번호) + 위 막대 + 본문 한 칸.
//
// 2026-10-17 판의 「플레이」·「만들기」 두 갈래는 없앴다 — 내 게임 카드마다 「플레이」와 「편집」이 같이 있어서 갈래를 나눌 이유가 없다.
// 레일의 홈·내 게임·기본 게임·새로 만들기는 본문 칸을 바꾼다(2026-10-21). 예전에는 한 긴 본문 안의 선반으로 스크롤했는데,
// 스크롤 위치가 레일 표시를 다시 정해 누른 단추와 표시가 어긋나고, 앞 칸의 검색·상세가 남았다. 지금 칸의 주인은 startScreen.ts 하나다.
import "./launcher.css";
import { el } from "@/util/dom";
import { startIcon, type StartIconName } from "./icons";

export type LauncherNav = "home" | "games" | "builtin" | "create" | "store";

export const LAUNCHER_TESTIDS = {
  rail: "start-rail",
  nav: "start-nav",
  top: "start-top",
  body: "start-body",
  aiStatus: "start-ai-status",
  settings: "start-settings-open",
} as const;

const BRAND_MARK = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><rect width="16" height="16" fill="#4a57d6"/><rect x="3" y="3" width="4" height="4" fill="#fff"/><rect x="9" y="3" width="4" height="4" fill="#fff" fill-opacity=".55"/><rect x="3" y="9" width="4" height="4" fill="#fff" fill-opacity=".55"/><rect x="9" y="9" width="4" height="4" fill="#f3c34f"/></svg>';

/** 위 막대 오른쪽의 글자 단추(폴더 열기·팀에 참여 — 팀에 참여는 @deprecated, 2026-10-21 팀 협업 접힘). */
export function topButton(label: string, testid: string, icon: StartIconName, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "ln-tbtn", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [startIcon(icon, "ln-icon"), label],
  });
}

const NAV: readonly { readonly id: LauncherNav; readonly label: string; readonly icon: StartIconName }[] = [
  { id: "home", label: "홈", icon: "home" },
  { id: "games", label: "내 게임", icon: "games" },
  { id: "builtin", label: "기본 게임", icon: "play" },
  { id: "create", label: "새로 만들기", icon: "plus" },
];

export type LauncherShell = {
  readonly element: HTMLElement;
  /** 레일 표시만 바꾼다. null = 레일 밖 칸(팀에 참여). */
  setActive(nav: LauncherNav | null): void;
  /** 레일 바닥 AI 상태 줄. */
  setAiStatus(status: { readonly tone: "ok" | "warn" | "off"; readonly text: string }): void;
  /** 위 막대(왼쪽 입력 칸 + 오른쪽 단추)와 본문을 한 번에 바꾼다. */
  show(top: { readonly search: HTMLElement | null; readonly actions: readonly HTMLElement[] }, body: HTMLElement): void;
};

export function createLauncherShell(options: {
  readonly onNav: (nav: LauncherNav) => void;
  readonly onSettings: () => void;
  /** 레일 바닥 맨 아래 줄 — 판 번호 · 언어. */
  readonly foot: readonly HTMLElement[];
}): LauncherShell {
  const navButton = (item: { readonly id: LauncherNav; readonly label: string; readonly icon: StartIconName }): HTMLButtonElement => el("button", {
    class: "ln-nav",
    attrs: { type: "button" },
    dataset: { testid: `${LAUNCHER_TESTIDS.nav}-${item.id}`, nav: item.id },
    on: { click: () => options.onNav(item.id) },
    children: [startIcon(item.icon, "ln-icon"), el("span", { text: item.label })],
  });
  const navButtons = NAV.map(navButton);
  const storeButton = navButton({ id: "store", label: "에셋 스토어", icon: "store" });
  const aiDot = el("span", { class: "ln-dot is-off", attrs: { "aria-hidden": "true" } });
  const aiText = el("span", { class: "ln-ai-text", text: "AI 엔진 · 설정" });
  const aiStatus = el("button", {
    class: "ln-ai-status", attrs: { type: "button" }, dataset: { testid: LAUNCHER_TESTIDS.aiStatus },
    on: { click: options.onSettings }, children: [aiDot, aiText],
  });
  const settings = el("button", {
    class: "ln-nav", attrs: { type: "button" }, dataset: { testid: LAUNCHER_TESTIDS.settings },
    on: { click: options.onSettings }, children: [startIcon("gear", "ln-icon"), el("span", { text: "설정" })],
  });
  const rail = el("aside", { class: "ln-rail", attrs: { "aria-label": "주 탐색" }, dataset: { testid: LAUNCHER_TESTIDS.rail }, children: [
    el("div", { class: "ln-brand", children: [
      el("span", { class: "ln-brand-mark", html: BRAND_MARK }),
      el("strong", { text: "OPRN Studio", attrs: { translate: "no" } }),
    ] }),
    el("nav", { class: "ln-navs", attrs: { "aria-label": "첫 화면" }, children: [...navButtons, el("span", { class: "ln-navsep", attrs: { role: "presentation" } }), storeButton] }),
    el("div", { class: "ln-rail-foot", children: [aiStatus, settings, el("div", { class: "ln-foot-line", children: [...options.foot] })] }),
  ] });
  const searchSlot = el("div", { class: "ln-search-slot" });
  const actionSlot = el("div", { class: "ln-top-actions" });
  const top = el("header", { class: "ln-top", dataset: { testid: LAUNCHER_TESTIDS.top }, children: [searchSlot, actionSlot] });
  const content = el("div", { class: "ln-content", dataset: { testid: LAUNCHER_TESTIDS.body } });
  const element = el("div", { class: "ln-root", children: [rail, el("div", { class: "ln-main", children: [top, content] })] });

  const setActive = (nav: LauncherNav | null): void => {
    for (const button of navButtons) {
      if (button.dataset.nav === nav) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  };
  setActive("home");

  return {
    element,
    setActive,
    setAiStatus(status) {
      aiDot.className = `ln-dot is-${status.tone}`;
      aiText.textContent = status.text;
      aiStatus.dataset.tone = status.tone;
    },
    show(nextTop, body) {
      searchSlot.replaceChildren(...(nextTop.search ? [nextTop.search] : []));
      actionSlot.replaceChildren(...nextTop.actions);
      content.replaceChildren(body);
    },
  };
}
