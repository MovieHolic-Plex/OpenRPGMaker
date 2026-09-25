import { el } from "@/util/dom";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";

import { createMapSidebarSection } from "./mapSidebarSection";

const COLLAPSED_KEY = "oprn:ai-sidebar-collapsed";
type Pane = "ai" | "maps" | "tools";

/** Keep both panes mounted so collapsing never discards an input or conversation. */
export function createAiSidebarWorkspace(tools: HTMLElement, host: HTMLElement, onResize: () => void = () => {}): { root: HTMLElement; isCollapsed(): boolean; dispose(): void } {
  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* restricted storage */ }
  const maps = createMapSidebarSection();
  tools.classList.add("ai-chat-sidebar-tools");
  // 탭 하나 = 질문 하나: 맵(어느 맵?) · 그리기(무엇으로?) · AI(뭐라고 할까?). 이름은 레이어에 따라
  // 바뀌지 않는다 — 예전 「타일」↔「이벤트」 전환은 탭이 사라진 것처럼 읽혔다.
  const tab = (pane: Pane, icon: DeckIconName, label: string, testid: string): HTMLButtonElement => el("button", {
    class: "ai-chat-sidebar-tab",
    children: [deckIcon(icon), el("span", { class: "ai-chat-sidebar-tab-label", text: label })],
    attrs: { type: "button", "aria-pressed": "false", "aria-label": label },
    dataset: { testid, sidebarPane: pane },
    on: { click: () => show(pane) },
  }) as HTMLButtonElement;
  const mapsButton = tab("maps", "map", "맵", "sidebar-maps");
  const toolsButton = tab("tools", "brush", "그리기", "sidebar-tools");
  const aiButton = tab("ai", "spark", "AI", "sidebar-ai");
  const toggle = el("button", { class: "ai-chat-sidebar-collapse", attrs: { type: "button", "aria-controls": "ai-sidebar-content" }, dataset: { testid: "sidebar-collapse" }, on: { click: () => setCollapsed(!collapsed) } });
  const tabs = el("div", { class: "ai-chat-sidebar-segments", attrs: { role: "group", "aria-label": "왼쪽 패널 보기" }, children: [mapsButton, toolsButton, aiButton] });
  const content = el("div", { class: "ai-chat-sidebar-content", attrs: { id: "ai-sidebar-content" }, children: [tools, maps.root, host] });
  const root = el("aside", {
    class: "ai-chat-sidebar", dataset: { testid: "editor-ai-sidebar" },
    children: [el("nav", { class: "ai-chat-sidebar-tabs", attrs: { "aria-label": "왼쪽 패널" }, children: [tabs, toggle] }), content],
  });
  function sync(): void {
    root.classList.toggle("is-collapsed", collapsed);
    content.hidden = collapsed;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.replaceChildren(deckIcon("sidebar"));
    // 접힌 레일에서는 탭 글자가 숨으므로 이름을 도구설명으로 보인다.
    for (const button of [mapsButton, toolsButton, aiButton]) {
      if (collapsed) button.title = button.getAttribute("aria-label") ?? "";
      else button.removeAttribute("title");
    }
  }
  function setCollapsed(next: boolean): void {
    collapsed = next; sync();
    try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* restricted storage */ }
    onResize();
  }
  function show(pane: Pane): void {
    tools.hidden = pane !== "tools"; host.hidden = pane !== "ai"; maps.root.hidden = pane !== "maps";
    root.dataset.pane = pane;
    aiButton.setAttribute("aria-pressed", String(pane === "ai"));
    mapsButton.setAttribute("aria-pressed", String(pane === "maps"));
    toolsButton.setAttribute("aria-pressed", String(pane === "tools"));
    if (collapsed) setCollapsed(false);
    if (pane === "maps") maps.show();
  }
  const showAi = (): void => show("ai");
  const showTools = (): void => show("tools");
  window.addEventListener("oprn:ai-sidebar-show", showAi);
  window.addEventListener("oprn:ai-sidebar-tools", showTools);
  tools.hidden = true; host.hidden = false; root.dataset.pane = "ai"; aiButton.setAttribute("aria-pressed", "true");
  sync(); installDelayedTooltips(root);
  return { root, isCollapsed: () => collapsed, dispose: () => {
    maps.dispose();
    window.removeEventListener("oprn:ai-sidebar-show", showAi);
    window.removeEventListener("oprn:ai-sidebar-tools", showTools);
  } };
}
