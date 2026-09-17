import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";

import { createMapSidebarSection } from "./mapSidebarSection";

const COLLAPSED_KEY = "oprn:ai-sidebar-collapsed";

/** Keep both panes mounted so collapsing never discards an input or conversation. */
export function createAiSidebarWorkspace(tools: HTMLElement, host: HTMLElement, onResize: () => void = () => {}): { root: HTMLElement; isCollapsed(): boolean; dispose(): void } {
  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* restricted storage */ }
  const maps = createMapSidebarSection();
  tools.classList.add("ai-chat-sidebar-tools");
  const aiButton = el("button", { children: [deckIcon("spark"), el("span", { class: "ai-chat-sidebar-tab-label", text: "AI" })], attrs: { type: "button", "aria-pressed": "true" }, dataset: { testid: "sidebar-ai" }, on: { click: () => show("ai") } });
  const toolsButton = el("button", { children: [deckIcon("grid"), el("span", { class: "ai-chat-sidebar-tab-label", text: "타일" })], attrs: { type: "button", "aria-pressed": "false" }, dataset: { testid: "sidebar-tools" }, on: { click: () => show("tools") } });
  const mapsButton = el("button", { children: [deckIcon("map"), el("span", { class: "ai-chat-sidebar-tab-label", text: "맵" })], attrs: { type: "button", "aria-pressed": "false" }, dataset: { testid: "sidebar-maps" }, on: { click: () => show("maps") } });
  const toggle = el("button", { class: "ai-chat-sidebar-collapse", attrs: { type: "button", "aria-controls": "ai-sidebar-content" }, dataset: { testid: "sidebar-collapse" }, on: { click: () => setCollapsed(!collapsed) } });
  const content = el("div", { class: "ai-chat-sidebar-content", attrs: { id: "ai-sidebar-content" }, children: [tools, maps.root, host] });
  const root = el("aside", {
    class: "ai-chat-sidebar", dataset: { testid: "editor-ai-sidebar" },
    children: [el("nav", { class: "ai-chat-sidebar-tabs", attrs: { "aria-label": "왼쪽 패널" }, children: [aiButton, mapsButton, toolsButton, toggle] }), content],
  });
  function sync(): void {
    root.classList.toggle("is-collapsed", collapsed);
    content.hidden = collapsed;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.replaceChildren(deckIcon(collapsed ? "chevron-right" : "compress"));
  }
  function setCollapsed(next: boolean): void {
    collapsed = next; sync();
    try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* restricted storage */ }
    onResize();
  }
  function show(pane: "ai" | "maps" | "tools"): void {
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
  tools.hidden = true; host.hidden = false; root.dataset.pane = "ai";
  sync(); installDelayedTooltips(root);
  return { root, isCollapsed: () => collapsed, dispose: () => {
    maps.dispose();
    window.removeEventListener("oprn:ai-sidebar-show", showAi);
    window.removeEventListener("oprn:ai-sidebar-tools", showTools);
  } };
}
