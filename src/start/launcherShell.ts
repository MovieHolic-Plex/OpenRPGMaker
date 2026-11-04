// start/launcherShell.ts
// 시작 화면의 「둘러보기」 틀(2026-11-04 서브화면 재설계, 시안 B http://mdc-server:18301/studio-subscreens-mock.html).
// 홈은 입력창 한 장(src/start/firstRun/promptHome.ts)이고, 「내 게임 · 예제 · 아이디어」는 이 틀 안의 탭 셋이다.
// 왼쪽 레일(홈·내 게임·예제·새로 만들기·스토어·AI 상태·설정·판 번호)은 없앴다 — AI 상태·언어·설정·스토어는 홈의 오른쪽 위에 있다.
// 지금 칸의 주인은 startScreen.ts 하나다(go/mount/leave/refresh). 이 틀은 위 막대와 본문 한 칸만 그린다.
import "./launcher.css";
import { BRAND_MARK_SVG } from "./brandMark";
import { el } from "@/util/dom";
import { startIcon, type StartIconName } from "./icons";

export type LauncherNav = "home" | "games" | "builtin" | "create";
export type LauncherTab = Exclude<LauncherNav, "home">;

export const LAUNCHER_TESTIDS = {
  rail: "start-rail",
  nav: "start-nav",
  top: "start-top",
  body: "start-body",
} as const;

/** 위 막대 오른쪽의 글자 단추(폴더 열기·게임 파일 열기·팀에 참여 — 팀에 참여는 @deprecated, 2026-10-21 팀 협업 접힘). */
export function topButton(label: string, testid: string, icon: StartIconName, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "ln-tbtn", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [startIcon(icon, "ln-icon"), label],
  });
}

const TABS: readonly { readonly id: LauncherTab; readonly label: string }[] = [
  { id: "games", label: "내 게임" },
  { id: "builtin", label: "예제" },
  { id: "create", label: "아이디어" },
];

export type LauncherShell = {
  readonly element: HTMLElement;
  /** 탭 표시만 바꾼다. null = 탭 밖 칸(팀에 참여). */
  setActive(nav: LauncherNav | null): void;
  /** 탭 옆 작은 숫자(「내 게임 12」). 0 이하·null 이면 숫자를 지운다. */
  setCount(tab: LauncherTab, count: number | null): void;
  /** 위 막대 오른쪽 단추와 본문을 한 번에 바꾼다. */
  show(top: { readonly actions: readonly HTMLElement[] }, body: HTMLElement): void;
};

export function createLauncherShell(options: { readonly onNav: (nav: LauncherNav) => void }): LauncherShell {
  const counts = new Map<LauncherTab, HTMLElement>();
  const tabButtons = TABS.map((tab) => {
    const count = el("small", { class: "ln-tab-count", attrs: { hidden: "" } });
    counts.set(tab.id, count);
    return el("button", {
      class: "ln-tab", attrs: { type: "button" }, dataset: { testid: `${LAUNCHER_TESTIDS.nav}-${tab.id}`, nav: tab.id },
      on: { click: () => options.onNav(tab.id) },
      children: [el("span", { text: tab.label }), count],
    });
  });
  const back = el("button", {
    class: "ln-back", attrs: { type: "button", "aria-label": "홈으로" }, dataset: { testid: `${LAUNCHER_TESTIDS.nav}-home` },
    on: { click: () => options.onNav("home") }, children: [startIcon("back", "ln-icon")],
  });
  const actionSlot = el("div", { class: "ln-top-actions" });
  const top = el("header", { class: "ln-top", dataset: { testid: LAUNCHER_TESTIDS.top }, children: [
    el("div", { class: "ln-brand", children: [
      back,
      el("span", { class: "ln-brand-mark", html: BRAND_MARK_SVG }),
      el("strong", { text: "OPRN Studio", attrs: { translate: "no" } }),
    ] }),
    el("nav", { class: "ln-tabs", attrs: { "aria-label": "둘러보기" }, dataset: { testid: LAUNCHER_TESTIDS.rail }, children: tabButtons }),
    actionSlot,
  ] });
  const content = el("div", { class: "ln-content", dataset: { testid: LAUNCHER_TESTIDS.body } });
  const element = el("div", { class: "ln-root", children: [top, content] });

  const setActive = (nav: LauncherNav | null): void => {
    for (const button of tabButtons) {
      if (button.dataset.nav === nav) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  };
  setActive("games");

  return {
    element,
    setActive,
    setCount(tab, count) {
      const node = counts.get(tab);
      if (!node) return;
      node.hidden = count === null || count <= 0;
      node.textContent = count !== null && count > 0 ? String(count) : "";
    },
    show(nextTop, body) {
      actionSlot.replaceChildren(...nextTop.actions);
      content.replaceChildren(body);
    },
  };
}
