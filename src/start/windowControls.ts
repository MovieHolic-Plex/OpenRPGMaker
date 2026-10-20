// 데스크톱 앱 오른쪽 위 창 단추(Windows·Linux): 전체화면 · 최소화 · 최대화/복원 · 닫기.
// macOS 는 OS 신호등이 왼쪽 위에 있으므로 단추를 그리지 않고 왼쪽 여백만 비운다.
// 브라우저·팀 페이지에는 window.oprn.windowControl 이 없어 아무것도 마운트되지 않는다.
// 설계·플랫폼 결정: openwiki/desktop-window-controls.md
import { el } from "@/util/dom";
import { desktopWindowChrome } from "@/app/windowChrome";
import { attachDelayedTooltip, hideDelayedTooltip } from "@/editor/delayedTooltip";
import type { WindowControlAction, WindowState } from "../../electron/shared/windowControl";
import "@/styles/shell/window-controls.css";

const SVG_NS = "http://www.w3.org/2000/svg";

/** 12×12 격자, 1.2 선 — Windows 캡션 기호 계열(가는 선). 안쪽 한 화면에서 같은 굵기로 보이게 한다. */
function glyph(paths: readonly string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "swc-glyph");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.2");
  svg.setAttribute("stroke-linecap", "square");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) {
    const node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("d", d);
    svg.append(node);
  }
  return svg;
}

const GLYPHS = {
  expand: ["M1.5 4.5v-3h3", "M7.5 1.5h3v3", "M10.5 7.5v3h-3", "M4.5 10.5h-3v-3"],
  collapse: ["M4.5 1.5v3h-3", "M10.5 4.5h-3v-3", "M7.5 10.5v-3h3", "M1.5 7.5h3v3"],
  minimize: ["M1.5 6h9"],
  maximize: ["M2 2h8v8H2z"],
  restore: ["M2 4h6v6H2z", "M4 4V2h6v6H8"],
  close: ["M1.5 1.5l9 9", "M10.5 1.5l-9 9"],
} as const;

type ButtonSpec = { readonly action: WindowControlAction; readonly testid: string; readonly cls: string };

function setBodyState(state: WindowState): void {
  document.body.classList.toggle("is-window-fullscreen", state.fullscreen);
  document.body.classList.toggle("is-window-maximized", state.maximized && !state.fullscreen);
}

export function mountWindowControls(): void {
  const chrome = desktopWindowChrome();
  // 시작 화면 진입점과 편집기 진입점이 둘 다 부른다 — 한 번만 단다.
  if (!chrome || document.body.classList.contains("has-window-chrome")) return;
  document.body.classList.add("has-window-chrome", `window-chrome-${chrome.platform}`);
  document.body.classList.toggle("has-window-buttons", chrome.drawsOwnButtons);
  const bridge = window.oprn;
  let state: WindowState = { fullscreen: false, maximized: false };
  if (!chrome.drawsOwnButtons) {
    // macOS: 신호등은 OS 가 그린다. 전체화면에서는 신호등이 숨으므로 왼쪽 여백을 거두려고 상태만 따라간다.
    const follow = (next: WindowState): void => setBodyState({ fullscreen: Boolean(next.fullscreen), maximized: Boolean(next.maximized) });
    bridge?.onWindowState?.(follow);
    void bridge?.windowState?.().then(follow).catch(() => {});
    return;
  }

  const buttons = new Map<WindowControlAction, HTMLButtonElement>();
  const content = new Map<WindowControlAction, { label: () => string; icon: () => readonly string[] }>();

  const make = (spec: ButtonSpec, label: () => string, icon: () => readonly string[]): HTMLButtonElement => {
    const button = el("button", {
      class: `swc-button ${spec.cls}`,
      attrs: { type: "button", "aria-label": label() },
      dataset: { testid: spec.testid },
      // 누르면 툴팁부터 거둔다 — 창이 숨겨졌다(닫기·최소화) 돌아오면 대상 위치가 0 으로 읽혀 툴팁이 왼쪽 위에 남았다(2026-10-20).
      on: { click: () => { hideDelayedTooltip(); void chrome.control(spec.action).catch(() => false); } },
    });
    button.append(glyph(icon()));
    buttons.set(spec.action, button);
    content.set(spec.action, { label, icon });
    // 라벨이 상태에 따라 바뀌는 단추(최대화↔이전 크기, 전체화면↔해제)라 툴팁 글자는 눌렀을 때 읽는다.
    attachDelayedTooltip(button, { get label() { return label(); } });
    return button;
  };

  const fullscreen = make({ action: "toggle-fullscreen", testid: "window-toggle-fullscreen", cls: "is-fullscreen" },
    () => state.fullscreen ? "전체화면 해제" : "전체화면",
    () => state.fullscreen ? GLYPHS.collapse : GLYPHS.expand);
  const minimize = make({ action: "minimize", testid: "window-minimize", cls: "is-minimize" }, () => "최소화", () => GLYPHS.minimize);
  const maximize = make({ action: "toggle-maximize", testid: "window-toggle-maximize", cls: "is-maximize" },
    () => state.maximized || state.fullscreen ? "이전 크기로" : "최대화",
    () => state.maximized || state.fullscreen ? GLYPHS.restore : GLYPHS.maximize);
  const closeButton = make({ action: "close", testid: "window-close", cls: "is-close" }, () => "닫기", () => GLYPHS.close);

  const paint = (): void => {
    for (const [action, button] of buttons) {
      const spec = content.get(action);
      if (!spec) continue;
      button.setAttribute("aria-label", spec.label());
      button.replaceChildren(glyph(spec.icon()));
    }
    fullscreen.setAttribute("aria-pressed", String(state.fullscreen));
    maximize.dataset.state = state.fullscreen ? "fullscreen" : state.maximized ? "maximized" : "normal";
    setBodyState(state);
  };

  const apply = (next: WindowState): void => {
    state = { fullscreen: Boolean(next.fullscreen), maximized: Boolean(next.maximized) };
    paint();
  };

  document.body.append(el("nav", {
    class: `studio-window-controls is-${chrome.platform}`,
    attrs: { "aria-label": "앱 창" },
    dataset: { testid: "studio-window-controls", platform: chrome.platform },
    children: [fullscreen, el("span", { class: "swc-separator", attrs: { role: "presentation" } }), minimize, maximize, closeButton],
  }));
  paint();
  window.addEventListener("blur", () => hideDelayedTooltip());
  document.addEventListener("visibilitychange", () => { if (document.hidden) hideDelayedTooltip(); });
  bridge?.onWindowState?.(apply);
  void bridge?.windowState?.().then(apply).catch(() => {});
}
