import { el } from "@/util/dom";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { ruleAuditViolationCountCached, RULE_AUDIT_UPDATED_EVENT } from "@/editor/panels/ruleAuditPanel";
import { openSidebarInspection } from "@/editor/panels/tileToolbarMenus";
import { store } from "@/project/store";

import { createLeftFavoritesPane } from "./leftFavoritesPane";
import { createLeftLinksPane } from "./leftLinksPane";
import { createLeftProgressPane } from "./leftProgressPane";
import { createLeftWorkshopPane } from "./leftWorkshopPane";
import { createMapSidebarSection } from "./mapSidebarSection";

const COLLAPSED_KEY = "oprn:ai-sidebar-collapsed";
const PANE_KEY = "oprn:left-activity-pane";
const PANES = ["tools", "maps", "favorites", "progress", "links", "workshop"] as const;
type Pane = (typeof PANES)[number];
type PaneSurface = { readonly root: HTMLElement; show(): void; dispose(): void };

const isPane = (value: string | null): value is Pane => (PANES as readonly string[]).includes(value ?? "");
const journeyScope = (): string => {
  const identity = store.getProjectIdentity();
  return `${identity.kind}:${identity.id}`;
};

/**
 * 왼쪽 활동 막대(48px 세로) + 패널 하나. 조수는 오른쪽 도크(editor.ts)에 있어 팔레트와 동시에 쓴다.
 * 켜진 아이콘을 다시 누르면 접히고, 「검사」는 패널이 아니라 규칙 감사를 여는 명령이다.
 * 패널은 펼쳐질 때만 그린다(show) — 숨은 패널은 store 알림을 받아도 root.hidden 에서 돌아선다.
 */
export function createAiSidebarWorkspace(tools: HTMLElement, _host: HTMLElement | null = null, onResize: () => void = () => {}): { root: HTMLElement; isCollapsed(): boolean; dispose(): void } {
  let collapsed = false;
  let pane: Pane = "tools";
  try {
    collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
    const saved = localStorage.getItem(PANE_KEY);
    if (isPane(saved)) pane = saved;
  } catch { /* restricted storage */ }
  const surfaces: Record<Exclude<Pane, "tools">, PaneSurface> = {
    maps: createMapSidebarSection(),
    favorites: createLeftFavoritesPane(),
    progress: createLeftProgressPane(journeyScope),
    links: createLeftLinksPane(),
    workshop: createLeftWorkshopPane(),
  };
  tools.classList.add("ai-chat-sidebar-tools");
  const item = (icon: DeckIconName, label: string, testid: string, onClick: () => void, shortLabel = label): HTMLButtonElement => el("button", {
    class: "ai-chat-sidebar-tab left-activity-item",
    children: [deckIcon(icon), el("span", { class: "ai-chat-sidebar-tab-label", text: shortLabel })],
    attrs: { type: "button", "aria-label": label, title: label },
    dataset: { testid },
    on: { click: onClick },
  }) as HTMLButtonElement;
  const paneButtons: Record<Pane, HTMLButtonElement> = {
    tools: item("brush", "그리기", "sidebar-tools", () => activate("tools")),
    maps: item("map", "맵", "sidebar-maps", () => activate("maps")),
    favorites: item("pin", "즐겨찾기", "sidebar-favorites", () => activate("favorites"), "즐찾"),
    progress: item("flag", "진행", "sidebar-progress", () => activate("progress")),
    links: item("link", "연결", "sidebar-links", () => activate("links")),
    workshop: item("wrench", "공방", "sidebar-workshop", () => activate("workshop")),
  };
  const badge = el("span", { class: "left-activity-badge", attrs: { "aria-hidden": "true" }, dataset: { testid: "sidebar-inspect-badge" } });
  const inspectButton = item("alert", "검사", "sidebar-inspect", () => {
    show("tools");
    openSidebarInspection("ruleAudit");
  });
  inspectButton.append(badge);
  const content = el("div", {
    class: "ai-chat-sidebar-content",
    attrs: { id: "ai-sidebar-content" },
    children: [tools, ...Object.values(surfaces).map((surface) => surface.root)],
  });
  const bar = el("nav", {
    class: "ai-chat-sidebar-tabs left-activity-bar",
    attrs: { "aria-label": "왼쪽 활동 막대" },
    dataset: { testid: "left-activity-bar" },
    children: [
      el("div", { class: "left-activity-group", attrs: { role: "group", "aria-label": "왼쪽 패널 보기" }, children: PANES.map((id) => paneButtons[id]) }),
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
    for (const [id, surface] of Object.entries(surfaces)) surface.root.hidden = pane !== id;
    root.dataset.pane = pane;
    for (const id of PANES) {
      const open = !collapsed && pane === id;
      paneButtons[id].setAttribute("aria-pressed", String(open));
      paneButtons[id].setAttribute("aria-expanded", String(open));
    }
  }
  function persist(): void {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
      localStorage.setItem(PANE_KEY, pane);
    } catch { /* restricted storage */ }
  }
  function reveal(): void {
    if (collapsed || pane === "tools") return;
    surfaces[pane].show();
  }
  function show(next: Pane): void {
    const wasCollapsed = collapsed;
    pane = next;
    collapsed = false;
    sync();
    persist();
    reveal();
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
  reveal();
  installDelayedTooltips(root);
  return { root, isCollapsed: () => collapsed, dispose: () => {
    for (const surface of Object.values(surfaces)) surface.dispose();
    window.removeEventListener("oprn:ai-sidebar-tools", showTools);
    window.removeEventListener(RULE_AUDIT_UPDATED_EVENT, syncBadge);
  } };
}
