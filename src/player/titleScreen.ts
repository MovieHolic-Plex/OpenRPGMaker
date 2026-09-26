import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applySystemWindowSkinVariable, applyTitleScreenBackground } from "@/player/systemGraphics";
import { createTitleParticlesCanvas } from "@/player/titleParticles";
import { createTitleEffectsCanvas, titleEffectsSignature } from "@/player/titleEffects/renderer";
import { activeTitleEffects } from "@/project/titleEffects";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project, TitleBackgroundLayer, TitleIntroSettings, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

const TITLE_SCREEN_LOGICAL_WIDTH = 320;
const TITLE_SCREEN_LOGICAL_HEIGHT = 240;

/**
 * 타이틀 메뉴는 키보드(↑↓ / Z·Enter·Space / X·Esc)와 항목 클릭으로 확정한다.
 */
export type TitleScreenActions = {
  readonly onNewGame: () => void;
  readonly onResume: () => void;
  readonly onContinue: () => void;
  /** 크레딧(에셋 저작자 표기) 창을 연다. 확정 연출·BGM 정지 없이 타이틀 위에 뜬다. */
  readonly onCredits: () => void;
  readonly onQuit: () => void;
};

export type TitleMenuOptionId = "newGame" | "resume" | "continueGame" | "credits" | "quit";

export type TitleMenuOption = {
  readonly id: TitleMenuOptionId;
  readonly testId: "title-new-game" | "title-resume-game" | "title-load-game" | "title-credits" | "title-quit-game";
  readonly elementId:
    | "title-option-new-game"
    | "title-option-resume-game"
    | "title-option-load-game"
    | "title-option-credits"
    | "title-option-quit-game";
  readonly label: string;
};

/** 오토세이브 유무 등 세션 밖 상태. 순수 함수 유지를 위해 호출자가 주입한다. */
export type TitleMenuContext = {
  readonly autosaveAvailable?: boolean;
  /** intro 등장 연출 재생 여부 — 최초 진입만 true. 생략 = true. 방향키 재렌더는 false 로 넘긴다. */
  readonly playIntro?: boolean;
  /** 설정 서명이 같으면 재사용할 기존 fx 스택(파티클 canvas 상태/rAF 보존). */
  readonly reuseFx?: HTMLElement | null;
  /** 서명이 같으면 재사용할 기존 영역 효과 canvas(WebGL 컨텍스트·rAF 보존). */
  readonly reuseEffects?: HTMLElement | null;
};

const DEFAULT_RESUME_LABEL = "이어하기";
export const DEFAULT_CREDITS_LABEL = "크레딧";

/**
 * Visible title options in fixed order New → Resume → Continue → Credits → Quit. newGame is always present.
 * 크레딧은 숨길 수 없다 — CC BY 계열 에셋의 저작자 표기를 여는 유일한 입구다(예전 하단 한 줄 표기를 대신한다).
 * "이어하기"(resume)는 오토세이브가 실제로 존재하고 menuVisibility.resume !== false 일 때만 노출된다.
 */
export function listTitleMenuOptions(settings: TitleScreenSettings, context?: TitleMenuContext): TitleMenuOption[] {
  const visibility = settings.menuVisibility;
  const options: TitleMenuOption[] = [
    {
      id: "newGame",
      testId: "title-new-game",
      elementId: "title-option-new-game",
      label: settings.menuLabels.newGame,
    },
  ];
  if (context?.autosaveAvailable === true && visibility?.resume !== false) {
    options.push({
      id: "resume",
      testId: "title-resume-game",
      elementId: "title-option-resume-game",
      label: settings.menuLabels.resume?.trim() || DEFAULT_RESUME_LABEL,
    });
  }
  if (visibility?.continueGame !== false) {
    options.push({
      id: "continueGame",
      testId: "title-load-game",
      elementId: "title-option-load-game",
      label: settings.menuLabels.continueGame,
    });
  }
  options.push({
    id: "credits",
    testId: "title-credits",
    elementId: "title-option-credits",
    label: settings.menuLabels.credits?.trim() || DEFAULT_CREDITS_LABEL,
  });
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

export function renderTitleScreen(
  project: Project,
  actions: TitleScreenActions,
  selectedIndex = 0,
  context?: TitleMenuContext,
): HTMLElement {
  const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
  const backgroundResourceId = settings.backgroundResourceId ?? project.system.titleResourceId;
  const options = listTitleMenuOptions(settings, context);
  const clampedIndex = clampTitleMenuIndex(selectedIndex, options.length);
  const title = el("div", {
    class: "title-screen rm-title-screen rm-title-screen-editorial",
    dataset: { testid: "title-screen" },
  });
  applyTitleScreenBackground(title, backgroundResourceId, project, {
    fit: settings.backgroundFit,
    rendering: settings.backgroundRendering,
  });
  // 영역 효과(빛내림·물결·안개…)는 배경 그림을 직접 다시 그리는 WebGL canvas 다.
  // 어두운 막(::before, z1)보다 아래(z0)여야 하므로 fx 스택과 분리해 루트 첫 자식으로 둔다.
  const effects = renderTitleEffectsLayer(settings, backgroundResourceId, project, context?.reuseEffects ?? null);
  if (effects) title.append(effects);
  // The full-screen title root owns the key art. Menu chrome consumes the runtime
  // windowskin CSS variable without applying the 9-slice fill over the artwork.
  applyTitleMenuGraphic(title, project);
  // 배경 레이어 + 파티클 fx 스택 — 서명이 같은 재렌더에서는 기존 노드를 그대로 옮겨
  // canvas 상태(rAF/프레임)를 보존한다(방향키 전체 re-render 대응).
  const fx = renderTitleFxStack(settings, project, context?.reuseFx ?? null);
  if (fx) title.append(fx);
  const playIntro = (context?.playIntro ?? true) && settings.intro !== undefined;
  const titleNodes = renderTitleNodes(settings, project);
  if (settings.logoStyle) {
    for (const node of titleNodes) node.dataset.logoStyle = settings.logoStyle;
    title.dataset.logoStyle = settings.logoStyle;
  }
  if (playIntro) applyTitleIntroToLogoNodes(titleNodes, settings.intro);
  title.append(...titleNodes);
  // 조작 안내 줄은 그리지 않는다 — 키아트 하단을 가리고, 메뉴 커서가 이미 선택을 보여 준다.
  const menu = renderMenu(settings, options, clampedIndex, false);
  wireTitleOptionClicks(menu, options, actions);
  if (playIntro) applyTitleIntroToMenu(menu, settings.intro);
  title.append(menu);
  // 로고 질감을 고른 오프닝은 키아트와 부딪히는 기본 문구 대신 저자의 부제만 쓴다.
  if (settings.logoStyle) {
    if (settings.logoSubtitle) title.append(renderTitleLogoSubtitle(settings));
  } else {
    title.append(renderTitleEditorialCopy());
  }
  title.append(titleSelectionDebug(clampedIndex));
  return title;
}

/** 영역 효과 canvas. 켜진 효과나 배경 그림이 없으면 null(레거시 DOM 불변). */
export function renderTitleEffectsLayer(
  settings: TitleScreenSettings,
  backgroundResourceId: string | undefined,
  project: Project,
  reuse: HTMLElement | null,
): HTMLElement | null {
  const effects = activeTitleEffects(settings.effects);
  if (!effects.length || !backgroundResourceId) return null;
  const imageUrl = resolveAssetResourceUrl(backgroundResourceId, { project });
  if (!imageUrl) return null;
  const options = { effects, imageUrl, fit: settings.backgroundFit ?? "stretch" };
  const signature = titleEffectsSignature(options);
  if (reuse && reuse.dataset.titleEffectsSignature === signature) return reuse;
  const canvas = createTitleEffectsCanvas(options);
  canvas.dataset.titleEffectsSignature = signature;
  return canvas;
}

function renderTitleLogoSubtitle(settings: TitleScreenSettings): HTMLElement {
  const node = el("div", {
    class: "rm-title-logo-subtitle",
    text: settings.logoSubtitle ?? "",
    dataset: { testid: "title-logo-subtitle", logoStyle: settings.logoStyle ?? "plain" },
  });
  node.style.left = logicalX(settings.layout.titleX);
  node.style.top = `calc(${logicalY(settings.layout.titleY)} + 3.4em)`;
  return node;
}

/** fx 스택 재사용 판별용 서명 — 레이어/파티클 저작값이 같으면 DOM 을 다시 만들지 않는다. */
export function titleFxSignature(settings: TitleScreenSettings): string {
  return JSON.stringify({
    layers: settings.backgroundLayers ?? [],
    particles: settings.particles ?? null,
  });
}

/**
 * 배경 레이어 + 파티클 canvas 를 담는 fx 컨테이너. 연출이 하나도 없으면 null
 * (레거시 타이틀 DOM 불변). `reuse` 의 서명이 같으면 그 노드를 그대로 돌려준다.
 */
export function renderTitleFxStack(
  settings: TitleScreenSettings,
  project: Project,
  reuse: HTMLElement | null,
): HTMLElement | null {
  const layers = settings.backgroundLayers ?? [];
  const particles = settings.particles;
  if (layers.length === 0 && !particles) return null;
  const signature = titleFxSignature(settings);
  if (reuse && reuse.dataset?.titleFxSignature === signature) return reuse;
  const fx = el("div", { class: "rm-title-fx", dataset: { testid: "title-fx" } });
  fx.dataset.titleFxSignature = signature;
  fx.append(...renderTitleBackgroundLayers(layers, project));
  if (particles) fx.append(createTitleParticlesCanvas(particles));
  return fx;
}

/** 레이어 스택 렌더 — 순서 보존, 속도는 인라인 CSS 변수/애니메이션으로 주입. */
export function renderTitleBackgroundLayers(
  layers: readonly TitleBackgroundLayer[],
  project: Project,
): HTMLElement[] {
  return layers.map((layer, index) => {
    const node = el("div", {
      class: "rm-title-bg-layer",
      dataset: {
        testid: "title-bg-layer",
        titleLayerResource: layer.resourceId,
        titleLayerIndex: String(index),
      },
    });
    const url = resolveAssetResourceUrl(layer.resourceId, { project });
    if (url) node.style.backgroundImage = `url("${url}")`;
    if (layer.opacity !== undefined) node.style.opacity = String(layer.opacity);
    // parallax 는 스크롤 속도 배율(깊이감) — 정지 레이어에는 아무 효과가 없다.
    const factor = layer.parallax ?? 1;
    const vx = (layer.scrollXPerSec ?? 0) * factor;
    const vy = (layer.scrollYPerSec ?? 0) * factor;
    node.style.setProperty("--title-layer-scroll-x", String(round3(vx)));
    node.style.setProperty("--title-layer-scroll-y", String(round3(vy)));
    const animations: string[] = [];
    // 한 타일(320/240 논리 px)을 |v| px/s 로 지나는 시간 = 무한 스크롤 주기.
    if (vx !== 0) animations.push(`rm-title-layer-scroll-x ${round3(320 / Math.abs(vx))}s linear infinite${vx < 0 ? " reverse" : ""}`);
    if (vy !== 0) animations.push(`rm-title-layer-scroll-y ${round3(240 / Math.abs(vy))}s linear infinite${vy < 0 ? " reverse" : ""}`);
    if (animations.length > 0) node.style.animation = animations.join(", ");
    return node;
  });
}

const DEFAULT_TITLE_INTRO_STAGGER_MS = 90;

/** intro 설정 → 등장 애니메이션 CSS 클래스. 미설정/none 은 null. */
export function titleIntroClass(part: "logo" | "menu", intro: TitleIntroSettings | undefined): string | null {
  if (!intro) return null;
  if (part === "logo") {
    if (intro.logo === "fadeIn") return "rm-title-intro-fade-in";
    if (intro.logo === "riseIn") return "rm-title-intro-rise-in";
    return null;
  }
  if (intro.menu === "fadeIn") return "rm-title-intro-fade-in";
  if (intro.menu === "slideUp") return "rm-title-intro-slide-up";
  return null;
}

function applyTitleIntroToLogoNodes(nodes: readonly HTMLElement[], intro: TitleIntroSettings | undefined): void {
  const className = titleIntroClass("logo", intro);
  if (!className) return;
  const delayMs = intro?.delayMs ?? 0;
  for (const node of nodes) {
    node.classList.add(className);
    if (delayMs > 0) node.style.animationDelay = `${delayMs}ms`;
  }
}

function applyTitleIntroToMenu(menu: HTMLElement, intro: TitleIntroSettings | undefined): void {
  const className = titleIntroClass("menu", intro);
  if (!className) return;
  const delayMs = intro?.delayMs ?? 0;
  const staggerMs = intro?.staggerMs ?? DEFAULT_TITLE_INTRO_STAGGER_MS;
  const options = Array.from(menu.querySelectorAll<HTMLElement>(".rm-title-menu-button"));
  for (const [index, option] of options.entries()) {
    option.classList.add(className);
    const delay = delayMs + index * staggerMs;
    if (delay > 0) option.style.animationDelay = `${delay}ms`;
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function applyTitleMenuGraphic(node: HTMLElement, project: Project): void {
  // 윈도스킨 정본 파이프를 그대로 쓴다 — 이전에는 이 함수가 `systemResourceId ||
  // "windowskin-default"` 로 자기만의 정관화를 해서, 자료집이 셀정한 윈도스킨 id 가
  // 필드 메뉴·전투·상점(normalizeSystemWindowSkinId 경로)와 타이틀에서 어긍날 수 있었다.
  // 변수만 심는다: 전면 루트에 9-slice fill 을 컬면 타이틀 키아트를 덮는다.
  applySystemWindowSkinVariable(node, project);
}

function renderTitleNodes(settings: TitleScreenSettings, project: Project): HTMLElement[] {
  const graphic = settings.titleGraphic;
  const mode = graphic?.mode ?? "text";
  const nodes: HTMLElement[] = [];

  if (mode === "text" || mode === "both" || !graphic) {
    const node = el("h1", {
      class: "rm-title-screen-title",
      text: settings.title,
      dataset: { testid: "title-text" },
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
      dataset: { testid: "title-text" },
    });
    fallback.style.left = logicalX(settings.layout.titleX);
    fallback.style.top = logicalY(settings.layout.titleY);
    nodes.push(fallback);
  }

  return nodes;
}

function renderTitleEditorialCopy(): HTMLElement {
  return el("div", {
    class: "rm-title-editorial-copy",
    children: [
      el("span", {
        class: "rm-title-kicker",
        text: "A NEW ADVENTURE",
        dataset: { testid: "title-kicker" },
      }),
      el("span", {
        class: "rm-title-subtitle",
        text: "이야기가 시작되는 곳",
        dataset: { testid: "title-subtitle" },
      }),
    ],
  });
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
const TITLE_MENU_BOTTOM_MARGIN = 8;

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
  if (optionCount <= 0) return menuY;
  // 안내 창이 없어도 크레딧까지 4~5 항목이면 기본 menuY(148)에서 무대 밖으로 나간다 — 아래 여백만 남긴다.
  const reserve = hintVisible ? TITLE_INPUT_HINT_RESERVE : TITLE_MENU_BOTTOM_MARGIN;
  const maxTop = TITLE_SCREEN_LOGICAL_HEIGHT - reserve - titleMenuHeight(optionCount);
  return Math.max(0, Math.min(menuY, maxTop));
}

function renderMenu(
  settings: TitleScreenSettings,
  options: readonly TitleMenuOption[],
  selectedIndex: number,
  hintVisible: boolean,
): HTMLElement {
  const menu = el("div", {
    class: "rm-title-menu rm-title-menu-open",
    attrs: { "aria-label": "게임 시작 메뉴", role: "listbox" },
  });
  if (settings.menuStyle) menu.dataset.menuStyle = settings.menuStyle;
  menu.style.left = logicalX(settings.layout.menuX);
  menu.style.top = logicalY(titleMenuTop(settings.layout.menuY, options.length, hintVisible));
  for (const [index, option] of options.entries()) {
    menu.append(
      titleOption(
        option.label,
        option.testId,
        option.elementId,
        index === selectedIndex,
      ),
    );
  }
  return menu;
}

function wireTitleOptionClicks(
  menu: HTMLElement,
  options: readonly TitleMenuOption[],
  actions: TitleScreenActions,
): void {
  const buttons = Array.from(menu.querySelectorAll<HTMLElement>(".rm-title-menu-button"));
  const run: Record<TitleMenuOptionId, () => void> = {
    newGame: actions.onNewGame,
    resume: actions.onResume,
    continueGame: actions.onContinue,
    credits: actions.onCredits,
    quit: actions.onQuit,
  };
  buttons.forEach((button, index) => {
    const option = options[index];
    if (!option) return;
    button.setAttribute("data-play-input-owner", "play-ui");
    button.addEventListener("click", () => run[option.id]());
  });
}

function titleOption(
  label: string,
  testId: string,
  elementId: string,
  selected: boolean,
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
