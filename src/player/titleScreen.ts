import { applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

const TITLE_SCREEN_LOGICAL_WIDTH = 320;
const TITLE_SCREEN_LOGICAL_HEIGHT = 240;

export type TitleScreenActions = {
  readonly onNewGame: () => void;
  readonly onContinue: () => void;
  readonly onQuit: () => void;
};

export function renderTitleScreen(project: Project, actions: TitleScreenActions, selectedIndex = 0): HTMLElement {
  const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
  const backgroundResourceId = settings.backgroundResourceId ?? project.system.titleResourceId;
  const title = el("div", {
    class: "title-screen rm-title-screen",
    dataset: { testid: "title-screen" },
  });
  applyTitleScreenBackground(title, backgroundResourceId);
  title.append(
    renderTitle(settings),
    renderMenu(settings, actions, selectedIndex),
    renderInputHint(),
    titleSelectionDebug(selectedIndex)
  );
  return title;
}

function renderTitle(settings: TitleScreenSettings): HTMLElement {
  const node = el("h1", {
    class: "rm-title-screen-title",
    text: settings.title,
  });
  node.style.left = logicalX(settings.layout.titleX);
  node.style.top = logicalY(settings.layout.titleY);
  return node;
}

function renderMenu(settings: TitleScreenSettings, actions: TitleScreenActions, selectedIndex: number): HTMLElement {
  const menu = el("div", {
    class: "rm-title-menu",
    attrs: { "aria-label": "게임 시작 메뉴" },
  });
  menu.style.left = logicalX(settings.layout.menuX);
  menu.style.top = logicalY(settings.layout.menuY);
  menu.append(
    titleButton(settings.menuLabels.newGame, "title-new-game", selectedIndex === 0, actions.onNewGame),
    titleButton(settings.menuLabels.continueGame, "title-load-game", selectedIndex === 1, actions.onContinue),
    titleButton(settings.menuLabels.quit, "title-quit-game", selectedIndex === 2, actions.onQuit),
  );
  return menu;
}

function titleButton(label: string, testId: string, selected: boolean, onClick: () => void): HTMLButtonElement {
  const attrs: Record<string, string> = { type: "button" };
  if (selected) attrs["aria-current"] = "true";
  return el("button", {
    class: `rm-title-menu-button ${selected ? "primary selected" : ""}`.trim(),
    text: label,
    attrs,
    dataset: { testid: testId },
    on: { click: onClick },
  });
}

function renderInputHint(): HTMLElement {
  return el("div", {
    class: "rm-title-input-hint",
    text: "↑↓ 이동   Z/Enter 결정   X/Esc 취소",
    dataset: { testid: "title-input-hint" },
  });
}

function titleSelectionDebug(selectedIndex: number): HTMLElement {
  return el("script", {
    text: JSON.stringify({ selectedIndex }),
    attrs: { type: "application/json" },
    dataset: { testid: "title-selection-json" },
  });
}

function logicalX(value: number): string {
  return `${formatPercent(value / TITLE_SCREEN_LOGICAL_WIDTH)}%`;
}

function logicalY(value: number): string {
  return `${formatPercent(value / TITLE_SCREEN_LOGICAL_HEIGHT)}%`;
}

function formatPercent(ratio: number): number {
  return Number.parseFloat((ratio * 100).toFixed(4));
}
