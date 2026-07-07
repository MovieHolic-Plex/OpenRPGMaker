import { el } from "@/util/dom";

export interface CommandBarElements {
  readonly commandBar: HTMLElement;
  readonly commandMenu: HTMLElement;
  readonly commandMenuToggle: HTMLButtonElement;
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
  const commandMenuToggle = el("button", {
    class: "ai-command-menu-toggle",
    text: "⌃",
    attrs: { type: "button", title: "AI 메뉴", "aria-label": "AI 메뉴", "aria-expanded": "false" },
    dataset: { testid: "ai-command-menu-toggle" },
    on: {
      click: () => {
        commandMenu.hidden = !commandMenu.hidden;
        commandMenuToggle.setAttribute("aria-expanded", String(!commandMenu.hidden));
      },
    },
  }) as HTMLButtonElement;
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
  return { commandBar, commandMenu, commandMenuToggle };
}
