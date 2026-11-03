import { el } from "@/util/dom";
import { AI_STUDIO_CHANGE_EVENT, readStudioMode, requestAiStudioToggle } from "@/editor/aiStudioMode";
import { closeAssetStore, isAssetStoreOpen } from "@/editor/assetStore/storeWorkspace";
import { closeWorkshop, isWorkshopOpen } from "@/editor/workshop/workshopWorkspace";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { editorState } from "@/editor/editorState";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/editor/panels/commandPalette";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { isLeftDrawerId, LEFT_COLUMN_TOGGLE_EVENT, LEFT_DRAWER_EVENT, LEFT_INSPECT_EVENT, type LeftDrawerId } from "@/editor/panels/leftColumnDrawer";
import { setMapFilterQuery } from "@/editor/panels/mapList";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { ruleAuditViolationCountCached, RULE_AUDIT_UPDATED_EVENT } from "@/editor/panels/ruleAuditPanel";
import { closeSidebarSurface } from "@/editor/panels/sidebarSurface";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { closeSidebarInspectionMenus, openSidebarInspection } from "@/editor/panels/tileToolbarMenus";
import { store } from "@/project/store";

import { createLeftPropsPane } from "./leftPropsPane";
import { createLeftLinksPane } from "./leftLinksPane";
import { createLeftProgressPane } from "./leftProgressPane";
import { createLeftStorePane } from "./leftStorePane";
import { createLeftWorkshopPane } from "./leftWorkshopPane";
import { createMapSidebarSection } from "./mapSidebarSection";

const COLLAPSED_KEY = "oprn:left-column-collapsed";
type PaneSurface = { readonly root: HTMLElement; show(): void; dispose(): void };

const journeyScope = (): string => {
  const identity = store.getProjectIdentity();
  return `${identity.kind}:${identity.id}`;
};

const isMacPlatform = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform ?? "");

/**
 * 왼쪽 한 칸(목업 2026-11-03): 위에서부터 「맵·이벤트 찾기」 검색칸 → 「맵」 트리 → 「타일」 팔레트 → 아래 링크 「진행」·「기물」.
 * 세로 아이콘 막대는 없다. 진행·기물은 서랍으로 맵·타일 자리를 잠시 덮고(뒤로 단추로 돌아온다),
 * 맵 연결·공방·에셋 스토어는 ⌘K 명령이 같은 서랍을 연다(leftColumnDrawer.ts). 「검사」는 위반이 있을 때만
 * 검색칸 옆 경고 칩으로 보이고, 늘 ⌘K 「검사: 규칙 위반 보기」로 열 수 있다.
 * 접으면 12px 손잡이만 남는다. 서랍은 열릴 때만 그린다(show).
 */
export function createAiSidebarWorkspace(tools: HTMLElement, _host: HTMLElement | null = null, onResize: () => void = () => {}): { root: HTMLElement; isCollapsed(): boolean; dispose(): void } {
  let collapsed = false;
  let drawer: LeftDrawerId | null = null;
  try {
    collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch { /* restricted storage */ }

  const search = el("input", {
    class: "left-column-search-input",
    attrs: { type: "search", placeholder: "맵·이벤트 찾기", "aria-label": "맵 이름 필터", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "map-tree-filter" },
  }) as HTMLInputElement;
  const maps = createMapSidebarSection(search);
  const drawers: Record<LeftDrawerId, PaneSurface> = {
    props: createLeftPropsPane(),
    progress: createLeftProgressPane(journeyScope),
    links: createLeftLinksPane(),
    workshop: createLeftWorkshopPane(),
    store: createLeftStorePane(),
  };
  tools.classList.add("ai-chat-sidebar-tools");

  const commitSearch = (): void => {
    if (search.dataset.composing === "1") return;
    setMapFilterQuery(search.value);
  };
  search.addEventListener("compositionstart", () => { search.dataset.composing = "1"; });
  search.addEventListener("compositionend", () => { delete search.dataset.composing; commitSearch(); });
  search.addEventListener("input", commitSearch);
  search.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const query = search.value.trim();
      openMapEventSearchModal(query ? { initialQuery: query } : {});
    } else if (event.key === "Escape" && search.value) {
      event.preventDefault();
      event.stopPropagation();
      search.value = "";
      setMapFilterQuery("");
    }
  });
  const shortcut = el("button", {
    class: "left-column-search-shortcut",
    text: isMacPlatform() ? "⌘K" : "Ctrl K",
    attrs: { type: "button", title: "명령 팔레트 — 명령 실행 · 맵 이동", "aria-label": "명령 팔레트 열기" },
    dataset: { testid: "left-column-command-palette" },
    on: { click: () => window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT)) },
  });
  const badge = el("span", { class: "left-column-inspect-count", dataset: { testid: "sidebar-inspect-badge" } });
  const inspectChip = el("button", {
    class: "left-column-inspect",
    attrs: { type: "button", title: "검사: 규칙 위반 보기" },
    dataset: { testid: "sidebar-inspect" },
    children: [deckIcon("alert"), badge],
    on: { click: () => openInspection() },
  }) as HTMLButtonElement;
  inspectChip.hidden = true;
  const head = el("div", {
    class: "left-column-head",
    children: [
      el("label", {
        class: "left-column-search",
        children: [el("span", { class: "left-column-search-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon("search")] }), search],
      }),
      shortcut,
      inspectChip,
    ],
  });

  const back = el("button", {
    class: "left-column-drawer-back",
    attrs: { type: "button", title: "맵·타일로 돌아가기" },
    dataset: { testid: "left-drawer-back" },
    children: [el("span", { attrs: { "aria-hidden": "true" }, text: "←" }), el("span", { text: "맵·타일" })],
    on: { click: () => closeDrawer() },
  });
  const drawerShell = el("section", {
    class: "left-column-drawer",
    dataset: { testid: "left-column-drawer" },
    children: [el("div", { class: "left-column-drawer-head", children: [back] }), ...Object.values(drawers).map((surface) => surface.root)],
  });
  const content = el("div", {
    class: "ai-chat-sidebar-content left-column-body",
    attrs: { id: "ai-sidebar-content" },
    children: [maps.root, tools, drawerShell],
  });

  const link = (id: "progress" | "props", icon: DeckIconName, label: string): HTMLButtonElement => el("button", {
    class: "left-column-link",
    attrs: { type: "button", "aria-label": label },
    dataset: { testid: `sidebar-${id}`, leftPane: id },
    children: [deckIcon(icon), el("span", { text: label })],
    on: { click: () => (drawer === id ? closeDrawer() : openDrawer(id)) },
  }) as HTMLButtonElement;
  const links = { progress: link("progress", "flag", "진행"), props: link("props", "box", "기물") };
  const collapseButton = el("button", {
    class: "left-column-collapse",
    attrs: { type: "button", "aria-label": "왼쪽 열", title: "왼쪽 열 접기" },
    dataset: { testid: "left-column-collapse", leftPane: "column" },
    children: [deckIcon("sidebar")],
    on: { click: () => setCollapsed(!collapsed) },
  });
  const nav = el("nav", {
    class: "left-column-links",
    attrs: { "aria-label": "왼쪽 열 링크" },
    children: [links.progress, links.props, collapseButton],
  });
  const restore = el("button", {
    class: "left-column-restore",
    attrs: { type: "button", "aria-label": "왼쪽 열 펴기", title: "왼쪽 열 펴기" },
    dataset: { testid: "left-column-restore" },
    on: { click: () => setCollapsed(false) },
  });
  const root = el("aside", {
    class: "ai-chat-sidebar left-column",
    attrs: { "aria-label": "왼쪽 열" },
    dataset: { testid: "editor-ai-sidebar" },
    children: [head, content, nav, restore],
  });

  function closeAuxiliaryOverlays(except?: LeftDrawerId): void {
    if (except !== "workshop" && isWorkshopOpen()) closeWorkshop();
    if (except !== "store" && isAssetStoreOpen()) closeAssetStore();
    if (readStudioMode()) requestAiStudioToggle();
  }
  function openInspection(): void {
    closeAuxiliaryOverlays();
    const state = editorState.get();
    if (state.layer === "event" || state.tool === "relief") {
      selectSidebarLayer("lower");
      const paletteRoot = tools.dataset.testid === "left-palette-root"
        ? tools
        : tools.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
      if (paletteRoot) renderTilePalette(paletteRoot);
    }
    closeDrawer();
    openSidebarInspection("ruleAudit");
  }
  function syncBadge(): void {
    const count = ruleAuditViolationCountCached();
    badge.textContent = count > 99 ? "99+" : String(count);
    inspectChip.hidden = count === 0;
    inspectChip.setAttribute("aria-label", count > 0 ? `검사 — 규칙 위반 ${count}건` : "검사");
    inspectChip.dataset.count = String(count);
  }
  function sync(): void {
    root.classList.toggle("is-collapsed", collapsed);
    root.classList.toggle("has-drawer", drawer !== null);
    head.hidden = collapsed;
    content.hidden = collapsed;
    nav.hidden = collapsed;
    restore.hidden = !collapsed;
    const hideMain = collapsed || drawer !== null;
    if (hideMain) {
      closeSidebarSurface();
      closeSidebarInspectionMenus();
    }
    tools.hidden = hideMain;
    maps.root.hidden = hideMain;
    drawerShell.hidden = collapsed || drawer === null;
    for (const [id, surface] of Object.entries(drawers)) surface.root.hidden = collapsed || drawer !== id;
    root.dataset.pane = drawer ?? "main";
    for (const [id, button] of Object.entries(links)) {
      const open = !collapsed && drawer === id;
      button.setAttribute("aria-pressed", String(open));
      button.setAttribute("aria-expanded", String(open));
    }
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
    // 「보기」 메뉴가 이 단추를 「왼쪽 열」 패널 항목으로 비춘다(workspaceBar.syncPanelItems).
    collapseButton.setAttribute("aria-pressed", String(!collapsed));
  }
  function reveal(): void {
    if (collapsed) return;
    if (drawer) drawers[drawer].show();
    else maps.show();
  }
  function persist(): void {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* restricted storage */ }
  }
  function setCollapsed(next: boolean): void {
    if (collapsed === next) return;
    collapsed = next;
    sync();
    persist();
    reveal();
    onResize();
  }
  function openDrawer(next: LeftDrawerId): void {
    closeAuxiliaryOverlays(next);
    drawer = next;
    const wasCollapsed = collapsed;
    collapsed = false;
    sync();
    persist();
    reveal();
    if (wasCollapsed) onResize();
  }
  function closeDrawer(): void {
    const wasCollapsed = collapsed;
    if (drawer === null && !collapsed) return;
    if (drawer === "workshop" && isWorkshopOpen()) closeWorkshop();
    if (drawer === "store" && isAssetStoreOpen()) closeAssetStore();
    drawer = null;
    collapsed = false;
    sync();
    persist();
    reveal();
    if (wasCollapsed) onResize();
  }
  const showMain = (): void => closeDrawer();
  const onDrawerRequest = (event: Event): void => {
    const id = event instanceof CustomEvent ? event.detail : null;
    if (isLeftDrawerId(id)) openDrawer(id);
  };
  const onToggle = (): void => setCollapsed(!collapsed);
  const onStudioChange = (event: Event): void => {
    if (event instanceof CustomEvent && event.detail?.open) {
      closeSidebarSurface();
      closeSidebarInspectionMenus();
    }
  };
  window.addEventListener("oprn:ai-sidebar-tools", showMain);
  window.addEventListener("oprn:ai-sidebar-maps", showMain);
  window.addEventListener(LEFT_DRAWER_EVENT, onDrawerRequest);
  window.addEventListener(LEFT_COLUMN_TOGGLE_EVENT, onToggle);
  window.addEventListener(LEFT_INSPECT_EVENT, openInspection);
  window.addEventListener(AI_STUDIO_CHANGE_EVENT, onStudioChange);
  window.addEventListener(RULE_AUDIT_UPDATED_EVENT, syncBadge);
  sync();
  // 칩은 규칙 감사가 끝났다고 알릴 때(RULE_AUDIT_UPDATED_EVENT) 채운다. 올리면서 직접 세지 않는다 —
  // 도구줄 ⋯ 배지가 같은 캐시를 데우고 그 알림을 낸다.
  reveal();
  installDelayedTooltips(root);
  return { root, isCollapsed: () => collapsed, dispose: () => {
    maps.dispose();
    for (const surface of Object.values(drawers)) surface.dispose();
    window.removeEventListener("oprn:ai-sidebar-tools", showMain);
    window.removeEventListener("oprn:ai-sidebar-maps", showMain);
    window.removeEventListener(LEFT_DRAWER_EVENT, onDrawerRequest);
    window.removeEventListener(LEFT_COLUMN_TOGGLE_EVENT, onToggle);
    window.removeEventListener(LEFT_INSPECT_EVENT, openInspection);
    window.removeEventListener(AI_STUDIO_CHANGE_EVENT, onStudioChange);
    window.removeEventListener(RULE_AUDIT_UPDATED_EVENT, syncBadge);
  } };
}
