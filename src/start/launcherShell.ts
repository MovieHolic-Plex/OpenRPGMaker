// start/launcherShell.ts
// 데스크톱 첫 화면의 틀(2026-10-17): 왼쪽 레일의 두 갈래 「플레이」·「만들기」 + 갈래마다 다른 위 막대 + 본문 한 칸.
// 본문은 갈래가 채운다 — 만들기는 컨셉 피드(src/start/conceptFeed), 플레이는 월드 목록(src/start/playFeed).
// 이 앱은 샌드박스로 간다. 처음부터 「만드는 홈」 하나로 두면 나중에 플레이를 끼울 자리가 없다.
import "./launcher.css";
import { el } from "@/util/dom";
import { startIcon, type StartIconName } from "./icons";

export type LauncherMode = "play" | "make";

export const LAUNCHER_MODE_KEY = "oprn:start-mode";

export const LAUNCHER_TESTIDS = {
  rail: "start-rail",
  mode: "start-mode",
  top: "start-top",
  body: "start-body",
} as const;

/** 마지막으로 고른 갈래. 고른 적이 없으면 만들기 — 처음 켠 사람은 아직 플레이할 것이 없다. */
export function readLauncherMode(storage: Pick<Storage, "getItem"> | null): LauncherMode | null {
  try {
    const saved = storage?.getItem(LAUNCHER_MODE_KEY);
    return saved === "play" || saved === "make" ? saved : null;
  } catch {
    return null;
  }
}

export function writeLauncherMode(storage: Pick<Storage, "setItem"> | null, mode: LauncherMode): void {
  try { storage?.setItem(LAUNCHER_MODE_KEY, mode); } catch { /* 저장을 못 해도 이번 화면은 그대로 바뀐다. */ }
}

const BRAND_MARK = '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><rect width="28" height="28" rx="7" fill="#4a57d6"/><rect x="6" y="6" width="7" height="7" rx="1.5" fill="#fff"/><rect x="15" y="6" width="7" height="7" rx="1.5" fill="#fff" fill-opacity=".55"/><rect x="6" y="15" width="7" height="7" rx="1.5" fill="#fff" fill-opacity=".55"/><rect x="15" y="15" width="7" height="7" rx="1.5" fill="#fff"/></svg>';

/** 위 막대 오른쪽의 글자 단추(게임 파일 열기·폴더 열기·팀에 참여). */
export function topButton(label: string, testid: string, icon: StartIconName, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "ln-tbtn", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [startIcon(icon, "ln-icon"), label],
  });
}

const MODES: readonly { readonly id: LauncherMode; readonly label: string; readonly sub: string }[] = [
  { id: "play", label: "플레이", sub: "만든 게임, 받은 게임" },
  { id: "make", label: "만들기", sub: "새 게임, 작업 중인 게임" },
];

export type LauncherShell = {
  readonly element: HTMLElement;
  /** 레일 표시만 바꾼다. 위 막대·본문은 호출부가 show 로 채운다. */
  setMode(mode: LauncherMode): void;
  /** 위 막대(왼쪽 입력 칸 + 오른쪽 단추)와 본문을 한 번에 바꾼다. */
  show(top: { readonly search: HTMLElement | null; readonly actions: readonly HTMLElement[] }, body: HTMLElement): void;
};

export function createLauncherShell(options: {
  readonly mode: LauncherMode;
  readonly onMode: (mode: LauncherMode) => void;
  /** 레일 바닥 — 언어 고르기·판 번호. */
  readonly foot: readonly HTMLElement[];
}): LauncherShell {
  const modeButtons = MODES.map((mode) => el("button", {
    class: "ln-mode",
    attrs: { type: "button" },
    dataset: { testid: `${LAUNCHER_TESTIDS.mode}-${mode.id}`, mode: mode.id },
    on: { click: () => options.onMode(mode.id) },
    children: [startIcon(mode.id, "ln-icon"), el("b", { text: mode.label }), el("small", { text: mode.sub })],
  }));
  const rail = el("aside", { class: "ln-rail", attrs: { "aria-label": "주 탐색" }, dataset: { testid: LAUNCHER_TESTIDS.rail }, children: [
    el("div", { class: "ln-brand", children: [
      el("span", { class: "ln-brand-mark", html: BRAND_MARK }),
      el("strong", { text: "OPRN Studio", attrs: { translate: "no" } }),
    ] }),
    el("nav", { class: "ln-modes", attrs: { "aria-label": "시작 화면 갈래" }, children: modeButtons }),
    el("div", { class: "ln-rail-foot", children: [...options.foot] }),
  ] });
  const searchSlot = el("div", { class: "ln-search-slot" });
  const actionSlot = el("div", { class: "ln-top-actions" });
  const top = el("header", { class: "ln-top", dataset: { testid: LAUNCHER_TESTIDS.top }, children: [searchSlot, actionSlot] });
  const content = el("div", { class: "ln-content", dataset: { testid: LAUNCHER_TESTIDS.body } });
  const element = el("div", { class: "ln-root", children: [rail, el("div", { class: "ln-main", children: [top, content] })] });

  const setMode = (mode: LauncherMode): void => {
    element.dataset.mode = mode;
    for (const button of modeButtons) {
      if (button.dataset.mode === mode) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  };
  setMode(options.mode);

  return {
    element,
    setMode,
    show(nextTop, body) {
      searchSlot.replaceChildren(...(nextTop.search ? [nextTop.search] : []));
      actionSlot.replaceChildren(...nextTop.actions);
      content.replaceChildren(body);
    },
  };
}
