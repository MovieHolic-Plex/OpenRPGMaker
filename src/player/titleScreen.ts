import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applySystemGraphic, applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

const TITLE_SCREEN_LOGICAL_WIDTH = 320;
const TITLE_SCREEN_LOGICAL_HEIGHT = 240;

/**
 * 타이틀 메뉴는 키보드(↑↓ / Z·Enter / X·Esc)가 기본이고,
 * 마우스 클릭으로도 동일 동작을 실행한다(실사용자 UX).
 * E2E 는 여전히 `startNewGameFromTitle`(Enter) 경로를 쓴다.
 */
export type TitleScreenActions = {
  readonly onNewGame: () => void;
  readonly onContinue: () => void;
  readonly onQuit: () => void;
};

export type TitleMenuOptionId = "newGame" | "continueGame" | "quit";

export type TitleMenuOption = {
  readonly id: TitleMenuOptionId;
  readonly testId: "title-new-game" | "title-load-game" | "title-quit-game";
  readonly label: string;
};

/** Visible title options in fixed order New → Continue → Quit. newGame is always present. */
export function listTitleMenuOptions(settings: TitleScreenSettings): TitleMenuOption[] {
  const visibility = settings.menuVisibility;
  const options: TitleMenuOption[] = [
    {
      id: "newGame",
      testId: "title-new-game",
      label: settings.menuLabels.newGame,
    },
  ];
  if (visibility?.continueGame !== false) {
    options.push({
      id: "continueGame",
      testId: "title-load-game",
      label: settings.menuLabels.continueGame,
    });
  }
  if (visibility?.quit !== false) {
    options.push({
      id: "quit",
      testId: "title-quit-game",
      label: settings.menuLabels.quit,
    });
  }
  return options;
}

/** Clamp selection into the visible list; count is coerced to ≥1. */
export function clampTitleMenuIndex(index: number, count: number): number {
  const safeCount = Math.max(1, count | 0);
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), safeCount - 1);
}

export function renderTitleScreen(project: Project, actions: TitleScreenActions, selectedIndex = 0): HTMLElement {
  const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
  const backgroundResourceId = settings.backgroundResourceId ?? project.system.titleResourceId;
  const options = listTitleMenuOptions(settings);
  const clampedIndex = clampTitleMenuIndex(selectedIndex, options.length);
  const title = el("div", {
    class: "title-screen rm-title-screen",
    dataset: { testid: "title-screen" },
  });
  applyTitleScreenBackground(title, backgroundResourceId, project);
  // Title menu window chrome follows systemResourceId (same as field menus).
  applySystemGraphic(title, project);
  title.append(...renderTitleNodes(settings, project));
  title.append(renderMenu(settings, options, clampedIndex, actions));
  if (settings.showInputHint !== false) {
    title.append(renderInputHint());
  }
  title.append(titleSelectionDebug(clampedIndex));
  return title;
}

function renderTitleNodes(settings: TitleScreenSettings, project: Project): HTMLElement[] {
  const graphic = settings.titleGraphic;
  const mode = graphic?.mode ?? "text";
  const nodes: HTMLElement[] = [];

  if (mode === "text" || mode === "both" || !graphic) {
    const node = el("h1", {
      class: "rm-title-screen-title",
      text: settings.title,
    });
    node.style.left = logicalX(settings.layout.titleX);
    node.style.top = logicalY(settings.layout.titleY);
    nodes.push(node);
  }

  if ((mode === "graphic" || mode === "both") && graphic?.resourceId) {
    nodes.push(renderTitleLogo(graphic, project));
  }

  // graphic mode without a resolvable logo still needs a stable title node for layout tests.
  if (nodes.length === 0) {
    const fallback = el("h1", {
      class: "rm-title-screen-title",
      text: settings.title,
    });
    fallback.style.left = logicalX(settings.layout.titleX);
    fallback.style.top = logicalY(settings.layout.titleY);
    nodes.push(fallback);
  }

  return nodes;
}

function renderTitleLogo(
  graphic: NonNullable<TitleScreenSettings["titleGraphic"]>,
  project: Project,
): HTMLElement {
  const node = el("div", {
    class: "rm-title-screen-logo",
    dataset: {
      testid: "title-logo",
      ...(graphic.resourceId ? { titleLogoResource: graphic.resourceId } : {}),
    },
  });
  node.style.left = logicalX(graphic.x);
  node.style.top = logicalY(graphic.y);
  // Logo uses titleGraphic.resourceId only — never applyTitleGraphic (system title bg).
  const url = resolveAssetResourceUrl(graphic.resourceId, { project });
  if (url) {
    node.style.backgroundImage = `url("${url}")`;
    node.style.backgroundSize = "contain";
    node.style.backgroundRepeat = "no-repeat";
    node.style.backgroundPosition = "center";
    node.style.imageRendering = "pixelated";
  }
  return node;
}

function renderMenu(
  settings: TitleScreenSettings,
  options: readonly TitleMenuOption[],
  selectedIndex: number,
  actions: TitleScreenActions,
): HTMLElement {
  const menu = el("div", {
    class: "rm-title-menu",
    attrs: { "aria-label": "게임 시작 메뉴", role: "listbox" },
  });
  menu.style.left = logicalX(settings.layout.menuX);
  menu.style.top = logicalY(settings.layout.menuY);
  for (const [index, option] of options.entries()) {
    menu.append(
      titleOption(
        option.label,
        option.testId,
        index === selectedIndex,
        activateForOption(option.id, actions),
      ),
    );
  }
  return menu;
}

function activateForOption(id: TitleMenuOptionId, actions: TitleScreenActions): () => void {
  switch (id) {
    case "newGame":
      return actions.onNewGame;
    case "continueGame":
      return actions.onContinue;
    case "quit":
      return actions.onQuit;
  }
}

function titleOption(
  label: string,
  testId: string,
  selected: boolean,
  onActivate: () => void,
): HTMLElement {
  const attrs: Record<string, string> = {
    role: "option",
    "aria-selected": selected ? "true" : "false",
    // div+role 유지: 키보드 네비는 player.ts 가 담당, 클릭만 여기서 연결.
    tabindex: "-1",
  };
  if (selected) attrs["aria-current"] = "true";
  return el("div", {
    class: `rm-title-menu-button ${selected ? "primary selected" : ""}`.trim(),
    text: label,
    attrs,
    dataset: { testid: testId },
    on: {
      click: (event: Event) => {
        event.preventDefault();
        onActivate();
      },
    },
  });
}

function renderInputHint(): HTMLElement {
  return el("div", {
    class: "rm-title-input-hint",
    text: "↑↓ 이동   Z/Enter·클릭 결정   X/Esc 취소",
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
