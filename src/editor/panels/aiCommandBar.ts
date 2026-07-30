import { el } from "@/util/dom";

export interface CommandBarElements {
  readonly commandBar: HTMLElement;
  readonly commandMenu: HTMLElement;
  readonly commandMenuToggle: HTMLButtonElement;
  readonly dispose: () => void;
}

export function createCommandBarElements(options: {
  readonly slashHost: HTMLElement;
  readonly contextChips: HTMLElement;
  readonly queueIndicator: HTMLElement;
  readonly inputRow: HTMLElement;
  readonly statusGroup: HTMLElement;
}): CommandBarElements {
  const commandMenu = el("div", {
    class: "ai-command-menu",
    attrs: { role: "menu" },
    dataset: { testid: "ai-command-menu" },
  });
  commandMenu.hidden = true;
  const setMenuOpen = (open: boolean): void => {
    commandMenu.hidden = !open;
    commandMenuToggle.setAttribute("aria-expanded", String(open));
  };
  const commandMenuToggle = el("button", {
    class: "ai-command-menu-toggle",
    text: "⌃",
    attrs: { type: "button", title: "AI 메뉴", "aria-label": "AI 메뉴", "aria-expanded": "false" },
    dataset: { testid: "ai-command-menu-toggle" },
    on: {
      click: () => setMenuOpen(commandMenu.hidden),
    },
  }) as HTMLButtonElement;
  // 열린 메뉴는 Escape/바깥 클릭으로 닫힌다 — 이전엔 닫을 방법이 토글 재클릭뿐이라
  // 절대배치 메뉴가 좌측 맵트리를 계속 덮은 채 클릭을 가로챘다.
  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (commandMenu.hidden) return;
    if (event.target instanceof Node && (commandMenu.contains(event.target) || commandMenuToggle.contains(event.target))) return;
    setMenuOpen(false);
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (commandMenu.hidden || event.key !== "Escape") return;
    setMenuOpen(false);
  };
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
  }
  const commandBar = el("div", {
    class: "ai-command-bar",
    dataset: { testid: "ai-command-bar" },
    children: [
      commandMenu,
      commandMenuToggle,
      el("div", {
        class: "ai-command-input-stack",
        children: [options.slashHost, options.contextChips, options.queueIndicator, options.inputRow],
      }),
      options.statusGroup,
    ],
  });
  return {
    commandBar,
    commandMenu,
    commandMenuToggle,
    dispose: () => {
      if (typeof document === "undefined" || typeof document.removeEventListener !== "function") return;
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    },
  };
}
