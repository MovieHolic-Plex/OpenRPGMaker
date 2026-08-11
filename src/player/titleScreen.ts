import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";
import { TITLE_KEY_PROMPT } from "@/player/keyBindings";

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
  readonly elementId: "title-option-new-game" | "title-option-load-game" | "title-option-quit-game";
  readonly label: string;
};

/** Visible title options in fixed order New → Continue → Quit. newGame is always present. */
export function listTitleMenuOptions(settings: TitleScreenSettings): TitleMenuOption[] {
  const visibility = settings.menuVisibility;
  const options: TitleMenuOption[] = [
    {
      id: "newGame",
      testId: "title-new-game",
      elementId: "title-option-new-game",
      label: settings.menuLabels.newGame,
    },
  ];
  if (visibility?.continueGame !== false) {
    options.push({
      id: "continueGame",
      testId: "title-load-game",
      elementId: "title-option-load-game",
      label: settings.menuLabels.continueGame,
    });
  }
  if (visibility?.quit !== false) {
    options.push({
      id: "quit",
      testId: "title-quit-game",
      elementId: "title-option-quit-game",
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

export function focusSelectedTitleOption(title: HTMLElement): void {
  const option = Array.from(title.querySelectorAll<HTMLElement>(".rm-title-menu-button"))
    .find((candidate) => candidate.getAttribute("tabindex") === "0");
  option?.focus({ preventScroll: true });
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
  // The full-screen title root owns the key art. Menu chrome consumes the runtime
  // windowskin CSS variable without applying the 9-slice fill over the artwork.
  applyTitleMenuGraphic(title, project);
  title.append(...renderTitleNodes(settings, project));
  const showInputHint = settings.showInputHint !== false;
  title.append(renderMenu(settings, options, clampedIndex, actions, showInputHint));
  if (showInputHint) {
    title.append(renderInputHint());
  }
  title.append(titleSelectionDebug(clampedIndex));
  return title;
}

function applyTitleMenuGraphic(node: HTMLElement, project: Project): void {
  const resourceId = project.system.systemResourceId || "windowskin-rm2003";
  node.dataset.systemResource = resourceId;
  // CSS keeps the menu's existing border-image contract; set only the variable so
  // the full-screen root cannot paint a 9-slice fill over the key art.
  const url = resolveAssetResourceUrl(resourceId, { project }) ?? "/assets/ui/windowskin-rm2003.png";
  node.style.setProperty("--runtime-window-skin", `url("${url}")`);
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

// 조작 안내 창은 화면 하단에 고정 배치(bottom 8px + 높이 약 29px)라 아래쪽 영역을 쓴다.
// 기본 menuY(148)는 항목 2개 기준이어서, "종료"까지 3개가 되면 마지막 항목이
// 안내 창에 **완전히 가려져 보이지도 선택 상태도 확인되지 않았다**(실측: 항목 629~669, 안내 631~689).
// 그래서 안내 창을 띄울 때는 메뉴 아래끝이 안내 영역 위에서 끝나도록 menuY 를 끌어올린다.
// 항목이 적어 원래 위치에 들어가면 프로젝트 설정값을 그대로 존중한다.
const TITLE_MENU_ROW_HEIGHT = 20;
const TITLE_MENU_ROW_GAP = 4;
const TITLE_MENU_PADDING_Y = 4;
// 창 테두리(border-image)가 위아래로 각 6px 를 더 차지한다 — 빼먹으면 4px 가 여전히 겹친다.
const TITLE_MENU_BORDER_Y = 12;
// 안내 창 자리(하단 여백 8 + 높이 29) + 숨 쉴 틈 3.
const TITLE_INPUT_HINT_RESERVE = 40;

export function titleMenuHeight(optionCount: number): number {
  if (optionCount <= 0) return 0;
  return (
    optionCount * TITLE_MENU_ROW_HEIGHT
    + (optionCount - 1) * TITLE_MENU_ROW_GAP
    + TITLE_MENU_PADDING_Y
    + TITLE_MENU_BORDER_Y
  );
}

export function titleMenuTop(menuY: number, optionCount: number, hintVisible: boolean): number {
  if (!hintVisible || optionCount <= 0) return menuY;
  const maxTop = TITLE_SCREEN_LOGICAL_HEIGHT - TITLE_INPUT_HINT_RESERVE - titleMenuHeight(optionCount);
  return Math.max(0, Math.min(menuY, maxTop));
}

function renderMenu(
  settings: TitleScreenSettings,
  options: readonly TitleMenuOption[],
  selectedIndex: number,
  actions: TitleScreenActions,
  hintVisible: boolean,
): HTMLElement {
  const menu = el("div", {
    class: "rm-title-menu",
    attrs: { "aria-label": "게임 시작 메뉴", role: "listbox" },
    dataset: { playInputOwner: "title-controls" },
  });
  menu.style.left = logicalX(settings.layout.menuX);
  menu.style.top = logicalY(titleMenuTop(settings.layout.menuY, options.length, hintVisible));
  for (const [index, option] of options.entries()) {
    menu.append(
      titleOption(
        option.label,
        option.testId,
        option.elementId,
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
  elementId: string,
  selected: boolean,
  onActivate: () => void,
): HTMLElement {
  const attrs: Record<string, string> = {
    role: "option",
    "aria-selected": selected ? "true" : "false",
    id: elementId,
    // div+role 유지: 키보드 네비는 player.ts 가 담당, 클릭만 여기서 연결.
    tabindex: selected ? "0" : "-1",
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
    text: TITLE_KEY_PROMPT,
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
