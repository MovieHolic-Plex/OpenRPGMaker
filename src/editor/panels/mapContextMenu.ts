import type { MapId } from "@/project/types";
import { el } from "@/util/dom";

export type MapContextMenuPoint = {
  readonly x: number;
  readonly y: number;
};

export type MapContextMenuItem = {
  readonly action: () => void;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly id: string;
  readonly label: string;
  readonly separatorBefore?: boolean;
  readonly shortcut?: string;
  readonly testId: string;
};

export type MapContextMenuRequest = {
  readonly items: readonly MapContextMenuItem[];
  readonly mapId: MapId;
  readonly mapName: string;
  readonly point: MapContextMenuPoint;
};

let activeMenu: HTMLElement | null = null;
let activeCleanup: (() => void) | null = null;

export function openMapContextMenu(request: MapContextMenuRequest): void {
  closeMapContextMenu();
  const menu = el("div", {
    class: "map-context-menu",
    attrs: {
      "aria-label": `${request.mapName} 맵 메뉴`,
      role: "menu",
      tabindex: "-1",
    },
    dataset: { testid: `map-context-menu-${request.mapId}` },
  });
  for (const item of request.items) {
    menu.append(renderMenuItem(item));
  }
  document.body.append(menu);
  activeMenu = menu;
  positionMenu(menu, request.point);

  const onPointerDown = (event: PointerEvent): void => {
    if (!activeMenu || !(event.target instanceof Node)) return;
    if (!activeMenu.contains(event.target)) closeMapContextMenu();
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMapContextMenu();
    }
  };
  const onMenuKeyDown = (event: KeyboardEvent): void => handleMenuKeyDown(menu, event);
  const closeOnLayoutChange = (): void => closeMapContextMenu();

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onDocumentKeyDown);
  window.addEventListener("resize", closeOnLayoutChange);
  window.addEventListener("scroll", closeOnLayoutChange, true);
  menu.addEventListener("keydown", onMenuKeyDown);
  activeCleanup = () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onDocumentKeyDown);
    window.removeEventListener("resize", closeOnLayoutChange);
    window.removeEventListener("scroll", closeOnLayoutChange, true);
    menu.removeEventListener("keydown", onMenuKeyDown);
  };

  const firstItem = enabledMenuItems(menu)[0];
  if (firstItem) firstItem.focus();
  else menu.focus();
}

export function closeMapContextMenu(): void {
  activeCleanup?.();
  activeCleanup = null;
  activeMenu?.remove();
  activeMenu = null;
}

function renderMenuItem(item: MapContextMenuItem): HTMLButtonElement {
  const classes = [
    "map-context-menu-item",
    item.disabled ? "disabled" : "",
    item.separatorBefore ? "separator-before" : "",
  ].filter(Boolean).join(" ");
  return el("button", {
    class: classes,
    attrs: {
      "aria-disabled": String(Boolean(item.disabled)),
      "aria-label": item.shortcut ? `${item.label} ${item.shortcut}` : item.label,
      role: "menuitem",
      tabindex: "-1",
      title: item.label,
      type: "button",
    },
    children: [
      el("span", { class: `rm-tool-icon rm-tool-icon-${item.icon}`, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "map-context-menu-label", text: item.label }),
      el("span", { class: "map-context-menu-shortcut", text: item.shortcut ?? "" }),
    ],
    dataset: { testid: item.testId },
    on: {
      click: (event) => {
        event.preventDefault();
        if (item.disabled) return;
        closeMapContextMenu();
        item.action();
      },
    },
  });
}

function positionMenu(menu: HTMLElement, point: MapContextMenuPoint): void {
  const margin = 4;
  const left = Math.max(margin, Math.min(point.x, window.innerWidth - menu.offsetWidth - margin));
  const statusBar = document.querySelector<HTMLElement>('[data-testid="editor-statusbar"]');
  const bottomEdge = statusBar?.getBoundingClientRect().top ?? window.innerHeight;
  const top = Math.max(margin, Math.min(point.y, bottomEdge - menu.offsetHeight - margin));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function handleMenuKeyDown(menu: HTMLElement, event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveMenuFocus(menu, 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveMenuFocus(menu, -1);
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    enabledMenuItems(menu)[0]?.focus();
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    const items = enabledMenuItems(menu);
    items[items.length - 1]?.focus();
  }
}

function moveMenuFocus(menu: HTMLElement, delta: -1 | 1): void {
  const items = enabledMenuItems(menu);
  if (items.length === 0) {
    menu.focus();
    return;
  }
  const currentIndex = document.activeElement instanceof HTMLButtonElement ? items.indexOf(document.activeElement) : -1;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + items.length) % items.length;
  items[nextIndex]?.focus();
}

function enabledMenuItems(menu: HTMLElement): readonly HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).filter(
    (item) => item.getAttribute("aria-disabled") !== "true"
  );
}
