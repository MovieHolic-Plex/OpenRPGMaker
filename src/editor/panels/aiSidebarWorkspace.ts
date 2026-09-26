import { el } from "@/util/dom";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { ruleAuditViolationCountCached, RULE_AUDIT_UPDATED_EVENT } from "@/editor/panels/ruleAuditPanel";
import { openSidebarInspection } from "@/editor/panels/tileToolbarMenus";

import { createMapSidebarSection } from "./mapSidebarSection";

const COLLAPSED_KEY = "oprn:ai-sidebar-collapsed";
const PANE_KEY = "oprn:left-activity-pane";
type Pane = "maps" | "tools";

/**
 * 왼쪽 활동 막대(48px 세로) + 패널 하나. 조수는 오른쪽 도크(editor.ts)에 있어 팔레트와 동시에 쓴다.
 * 켜진 아이콘을 다시 누르면 접히고, 「검사」는 패널이 아니라 규칙 감사를 여는 명령이다.
 */
export function createAiSidebarWorkspace(tools: HTMLElement, _host: HTMLElement | null = null, onResize: () => void = () => {}): { root: HTMLElement; isCollapsed(): boolean; dispose(): void } {
  let collapsed = false;
  let pane: Pane = "tools";
  try {
    collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
    if (localStorage.getItem(PANE_KEY) === "maps") pane = "maps";
  } catch { /* restricted storage */ }
  const maps = createMapSidebarSection();
  tools.classList.add("ai-chat-sidebar-tools");
  const item = (icon: DeckIconName, label: string, testid: string, onClick: () => void): HTMLButtonElement => el("button", {
    class: "ai-chat-sidebar-tab left-activity-item",
    children: [deckIcon(icon), el("span", { class: "ai-chat-sidebar-tab-label", text: label })],
    attrs: { type: "button", "aria-label": label, title: label },
    dataset: { testid },
    on: { click: onClick },
  }) as HTMLButtonElement;
  const toolsButton = item("brush", "그리기", "sidebar-tools", () => activate("tools"));
  const mapsButton = item("map", "맵", "sidebar-maps", () => activate("maps"));
  const badge = el("span", { class: "left-activity-badge", attrs: { "aria-hidden": "true" }, dataset: { testid: "sidebar-inspect-badge" } });
  const inspectButton = item("alert", "검사", "sidebar-inspect", () => {
    show("tools");
    openSidebarInspection("ruleAudit");
  });
  inspectButton.append(badge);
  for (const button of [toolsButton, mapsButton]) button.setAttribute("aria-pressed", "false");
  const content = el("div", { class: "ai-chat-sidebar-content", attrs: { id: "ai-sidebar-content" }, children: [tools, maps.root] });
  const bar = el("nav", {
    class: "ai-chat-sidebar-tabs left-activity-bar",
    attrs: { "aria-label": "왼쪽 활동 막대" },
    dataset: { testid: "left-activity-bar" },
    children: [
      el("div", { class: "left-activity-group", attrs: { role: "group", "aria-label": "왼쪽 패널 보기" }, children: [toolsButton, mapsButton] }),
      el("div", { class: "left-activity-spacer", attrs: { "aria-hidden": "true" } }),
      inspectButton,
    ],
  });
  const root = el("aside", {
    class: "ai-chat-sidebar has-activity-bar", dataset: { testid: "editor-ai-sidebar" },
    children: [bar, content],
  });
  function syncBadge(): void {
    const count = ruleAuditViolationCountCached();
    badge.textContent = count > 0 ? String(count > 99 ? "99+" : count) : "";
    badge.hidden = count === 0;
    inspectButton.setAttribute("aria-label", count > 0 ? `검사 — 규칙 위반 ${count}건` : "검사");
    inspectButton.dataset.count = String(count);
  }
  function sync(): void {
    root.classList.toggle("is-collapsed", collapsed);
    content.hidden = collapsed;
    tools.hidden = pane !== "tools";
    maps.root.hidden = pane !== "maps";
    root.dataset.pane = pane;
    toolsButton.setAttribute("aria-pressed", String(!collapsed && pane === "tools"));
    mapsButton.setAttribute("aria-pressed", String(!collapsed && pane === "maps"));
    toolsButton.setAttribute("aria-expanded", String(!collapsed && pane === "tools"));
    mapsButton.setAttribute("aria-expanded", String(!collapsed && pane === "maps"));
  }
  function persist(): void {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
      localStorage.setItem(PANE_KEY, pane);
    } catch { /* restricted storage */ }
  }
  function show(next: Pane): void {
    const wasCollapsed = collapsed;
    pane = next;
    collapsed = false;
    sync();
    persist();
    if (pane === "maps") maps.show();
    if (wasCollapsed) onResize();
  }
  function activate(next: Pane): void {
    if (!collapsed && pane === next) {
      collapsed = true;
      sync();
      persist();
      onResize();
      return;
    }
    show(next);
  }
  const showTools = (): void => show("tools");
  window.addEventListener("oprn:ai-sidebar-tools", showTools);
  window.addEventListener(RULE_AUDIT_UPDATED_EVENT, syncBadge);
  sync();
  // 배지는 규칙 감사가 끝났다고 알릴 때(RULE_AUDIT_UPDATED_EVENT) 채운다. 올리면서 직접 세지 않는다 —
  // 도구줄 ⋯ 배지가 같은 캐시를 데우고 그 알림을 낸다.
  badge.hidden = true;
  if (!collapsed && pane === "maps") maps.show();
  installDelayedTooltips(root);
  return { root, isCollapsed: () => collapsed, dispose: () => {
    maps.dispose();
    window.removeEventListener("oprn:ai-sidebar-tools", showTools);
    window.removeEventListener(RULE_AUDIT_UPDATED_EVENT, syncBadge);
  } };
}
