import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applySystemWindowSkinVariable, applyTitleScreenBackground } from "@/player/systemGraphics";
import { createTitleParticlesCanvas } from "@/player/titleParticles";
import { createTitleEffectsCanvas, titleEffectsSignature, updateTitleEffectsCanvas } from "@/player/titleEffects/renderer";
import {
  activeTitleEffects,
  normalizeTitleLogoShine,
  resolveTitleOpeningSequence,
  TITLE_LOGO_SHINE_PERIOD_MS,
  titleTransitionDurationMs,
} from "@/project/titleEffects";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type {
  Project,
  TitleBackgroundLayer,
  TitleIntroSettings,
  TitleLogoShine,
  TitleScreenSettings,
} from "@/project/types";
import { el } from "@/util/dom";

const TITLE_SCREEN_LOGICAL_WIDTH = 320;
const TITLE_SCREEN_LOGICAL_HEIGHT = 240;

/**
 * 타이틀 메뉴는 키보드(↑↓ / Z·Enter·Space / X·Esc)와 항목 클릭으로 확정한다.
 */
export type TitleScreenActions = {
  readonly onNewGame: () => void;
  readonly onNewGamePlus?: () => void;
  readonly onResume: () => void;
  readonly onContinue: () => void;
  /** 크레딧(에셋 저작자 표기) 창을 연다. 확정 연출·BGM 정지 없이 타이틀 위에 뜬다. */
  readonly onCredits: () => void;
  readonly onQuit: () => void;
};

export type TitleMenuOptionId = "newGame" | "newGamePlus" | "resume" | "continueGame" | "credits" | "quit";

export type TitleMenuOption = {
  readonly id: TitleMenuOptionId;
  readonly testId: "title-new-game" | "title-new-game-plus" | "title-resume-game" | "title-load-game" | "title-credits" | "title-quit-game";
  readonly elementId:
    | "title-option-new-game"
    | "title-option-new-game-plus"
    | "title-option-resume-game"
    | "title-option-load-game"
    | "title-option-credits"
    | "title-option-quit-game";
  readonly label: string;
};

/** 오토세이브 유무 등 세션 밖 상태. 순수 함수 유지를 위해 호출자가 주입한다. */
export type TitleMenuContext = {
  readonly autosaveAvailable?: boolean;
  /** 클리어 기록이 있고 강하게 다시 하기가 켜졌을 때만 주는 항목 이름. 생략 = 항목 없음. */
  readonly newGamePlusLabel?: string;
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
 * Visible title options in fixed order New → New Game+ → Resume → Continue → Credits → Quit. newGame is always present.
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
  if (context?.newGamePlusLabel) {
    options.push({
      id: "newGamePlus",
      testId: "title-new-game-plus",
      elementId: "title-option-new-game-plus",
      label: context.newGamePlusLabel,
    });
  }
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

/** Move only the cursor; rebuilding the stage resets background/intro animations and audio. */
export function updateTitleSelection(title: HTMLElement, selectedIndex: number): void {
  const options = Array.from(title.querySelectorAll<HTMLElement>(".rm-title-menu-button"));
  const index = clampTitleMenuIndex(selectedIndex, options.length);
  options.forEach((option, i) => {
    const selected = i === index;
    option.classList.toggle("primary", selected);
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
    option.setAttribute("tabindex", selected ? "0" : "-1");
    if (selected) option.setAttribute("aria-current", "true");
    else option.removeAttribute("aria-current");
  });
  const debug = title.querySelector("[data-testid='title-selection-json']");
  if (debug) debug.textContent = JSON.stringify({ selectedIndex: index });
  focusSelectedTitleOption(title);
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
  const firstEntry = context?.playIntro ?? true;
  // 입장 시퀀스가 있으면 레거시 intro 를 대신한다(둘을 겹치면 등장이 두 번 일어난다).
  const playSequence = firstEntry && settings.sequence !== undefined;
  const playIntro = firstEntry && !playSequence && settings.intro !== undefined;
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
  const logoAtMs = playSequence ? resolveTitleOpeningSequence(settings.sequence ?? {}).logoAtMs : 0;
  applyTitleLogoShine(title, titleNodes, settings.logoShine, firstEntry, playSequence ? logoAtMs : 0);
  if (playSequence) applyTitleOpeningSequence(title, titleNodes, menu, settings);
  return title;
}

const SEQ_ANIMATION_PREFIX = "rm-title-seq";

function seqAnimation(name: string, durationMs: number, delayMs: number, easing = "cubic-bezier(.2,.7,.2,1)"): string {
  return `${SEQ_ANIMATION_PREFIX}-${name} ${Math.max(1, Math.round(durationMs))}ms ${easing} ${Math.max(0, Math.round(delayMs))}ms both`;
}

function appendAnimation(node: HTMLElement, animation: string): void {
  node.style.animation = node.style.animation ? `${node.style.animation}, ${animation}` : animation;
}

/**
 * 입장 시퀀스: 검은 막 → 배경 페이드 + 카메라 밀기 → 빛 쓸기 → 로고 등장 → 메뉴.
 * 모두 CSS 애니메이션이고 이름이 rm-title-seq- 로 시작한다 — 건너뛰기는 그 이름만 finish() 한다.
 * 로고 그래픽은 이미 transform(translate -50%) 을 쓰므로 개별 속성(scale·translate)만 움직인다.
 */
function applyTitleOpeningSequence(
  title: HTMLElement,
  logoNodes: readonly HTMLElement[],
  menu: HTMLElement,
  settings: TitleScreenSettings,
): void {
  const seq = resolveTitleOpeningSequence(settings.sequence ?? {});
  title.classList.add("rm-title-seq");
  title.dataset.seqState = "playing";
  // 카메라 밀기 대상: 효과 canvas·fx 스택. 둘 다 없으면 루트 배경을 복제한 층을 깐다.
  const pushTargets = Array.from(title.querySelectorAll<HTMLElement>(":scope > .rm-title-effects, :scope > .rm-title-fx"));
  if (pushTargets.length === 0 && title.style.backgroundImage) {
    const bg = el("div", { class: "rm-title-seq-bg" });
    for (const prop of ["backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat", "imageRendering"] as const) {
      bg.style[prop] = title.style[prop];
    }
    title.prepend(bg);
    pushTargets.push(bg);
  }
  if (seq.push > 0) {
    for (const node of pushTargets) {
      node.style.setProperty("--seq-push", String(round3(1 + seq.push)));
      appendAnimation(node, seqAnimation("push", seq.fadeMs + seq.logoAtMs, 0, "cubic-bezier(.16,.8,.24,1)"));
    }
  }
  const veil = el("div", { class: "rm-title-seq-veil", attrs: { "aria-hidden": "true" } });
  veil.style.animation = seqAnimation("veil", seq.fadeMs, 0, "ease-out");
  if (seq.sweep) {
    const sweep = el("div", { class: "rm-title-seq-sweep", attrs: { "aria-hidden": "true" } });
    sweep.style.animation = seqAnimation("sweep", 1200, Math.max(0, seq.logoAtMs - 300), "cubic-bezier(.4,0,.2,1)");
    title.append(sweep);
  }
  const revealMs = seq.logoReveal === "wipe" ? 900 : 1000;
  for (const node of logoNodes) {
    appendAnimation(node, seqAnimation(`logo-${seq.logoReveal}`, revealMs, seq.logoAtMs));
  }
  const options = Array.from(menu.querySelectorAll<HTMLElement>(".rm-title-menu-button"));
  menu.style.animation = seqAnimation("fade", 500, seq.menuAtMs, "ease-out");
  for (const [index, option] of options.entries()) {
    option.style.animation = seqAnimation("item", 420, seq.menuAtMs + index * 90);
  }
  for (const extra of title.querySelectorAll<HTMLElement>(":scope > .rm-title-logo-subtitle, :scope > .rm-title-editorial-copy")) {
    extra.style.animation = seqAnimation("fade", 700, seq.logoAtMs + 400, "ease-out");
  }
  title.append(veil);
  wireTitleSequenceSkip(title, seq.menuAtMs + 90 * options.length + 500);
}

/** 첫 입력(키·클릭)은 메뉴를 확정하지 않고 시퀀스만 끝낸다. */
function wireTitleSequenceSkip(title: HTMLElement, totalMs: number): void {
  let done = false;
  let swallowClick = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    title.classList.add("rm-title-seq-skipped");
    for (const animation of title.getAnimations?.({ subtree: true }) ?? []) {
      const name = (animation as CSSAnimation).animationName;
      if (typeof name === "string" && name.startsWith(SEQ_ANIMATION_PREFIX)) {
        try { animation.finish(); } catch { /* 무한 반복은 finish 불가 — 클래스가 대신 멈춘다 */ }
      }
    }
    cleanup();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!title.isConnected) { cleanup(); return; }
    if (event.repeat || ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finish();
  };
  const onPointer = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowClick = true;
    finish();
  };
  const onClick = (event: Event): void => {
    if (!swallowClick && done) return;
    swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    finish();
  };
  const timer = setTimeout(() => {
    done = true;
    cleanup();
  }, totalMs);
  function cleanup(): void {
    clearTimeout(timer);
    window.removeEventListener("keydown", onKey, true);
    title.removeEventListener("pointerdown", onPointer, true);
    // pointerdown 뒤따르는 click 은 pointerup 이후에 오므로 잠시 더 붙여 두고 삼킨다.
    setTimeout(() => title.removeEventListener("click", onClick, true), 800);
    title.dataset.seqState = "done";
  }
  window.addEventListener("keydown", onKey, true);
  title.addEventListener("pointerdown", onPointer, true);
  title.addEventListener("click", onClick, true);
}

/**
 * 로고 반짝임. 생략 = 기존 CSS 반복(하위 호환). none 은 끈다. once 는 최초 진입에만 한 번,
 * loop 는 6초마다. 글자 로고는 배경 그라디언트를, 그림 로고는 로고 모양으로 가린 자식 띠를 움직인다.
 */
function applyTitleLogoShine(
  title: HTMLElement,
  nodes: readonly HTMLElement[],
  shine: TitleLogoShine | undefined,
  firstEntry: boolean,
  delayMs: number,
): void {
  if (shine === undefined) return;
  title.dataset.logoShine = shine;
  if (shine === "none") return;
  const mode = normalizeTitleLogoShine(shine);
  if (mode === "once" && !firstEntry) return;
  const start = firstEntry ? delayMs + 900 : 0;
  const shineAnimation = mode === "once"
    ? `rm-title-logo-shine-once 1400ms ease-in-out ${start}ms 1 both`
    : `rm-title-logo-shine ${TITLE_LOGO_SHINE_PERIOD_MS}ms ease-in-out ${start}ms infinite`;
  for (const node of nodes) {
    if (node.classList.contains("rm-title-screen-logo")) {
      const match = /url\(["']?(.*?)["']?\)/.exec(node.style.backgroundImage);
      if (!match) continue;
      const band = el("span", { class: "rm-title-shine", attrs: { "aria-hidden": "true" } });
      band.style.setProperty("--logo-mask", `url("${match[1]}")`);
      band.style.animation = mode === "once"
        ? `rm-title-shine-band-once 1400ms ease-in-out ${start}ms 1 both`
        : `rm-title-shine-band ${TITLE_LOGO_SHINE_PERIOD_MS}ms ease-in-out ${start}ms infinite`;
      node.append(band);
    } else {
      node.dataset.logoShine = mode;
      appendAnimation(node, shineAnimation);
    }
  }
}

/**
 * 「새 게임」 확정 전환. 루트에 전환 막을 얹고 재생 시간(ms)을 돌려준다.
 * 설정이 없으면 null — 호출자는 기존 짧은 확정 연출을 쓴다.
 */
export function playTitleTransition(title: HTMLElement | null, settings: TitleScreenSettings | undefined): number | null {
  const transition = settings?.transition;
  if (!title || !transition) return null;
  const duration = titleTransitionDurationMs(transition);
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = reduced ? Math.min(duration, 300) : duration;
  title.classList.add("rm-title-transitioning");
  title.dataset.transition = transition.kind;
  title.style.setProperty("--transition-ms", `${ms}ms`);
  const overlay = el("div", {
    class: "rm-title-transition",
    dataset: { kind: transition.kind, testid: "title-transition" },
    attrs: { "aria-hidden": "true" },
  });
  title.append(overlay);
  return ms;
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
  const depthResourceId = effects.find((effect) => effect.kind === "parallax")?.depthResourceId;
  const depthUrl = depthResourceId ? resolveAssetResourceUrl(depthResourceId, { project }) ?? undefined : undefined;
  const options = { effects, imageUrl, fit: settings.backgroundFit ?? "stretch", rendering: settings.backgroundRendering ?? 'pixelated', depthUrl };
  const signature = titleEffectsSignature(options);
  if (reuse && reuse.dataset.titleEffectsSignature === signature) return reuse;
  // 같은 그림·맞춤에서 효과 값만 바뀌면 WebGL 문맥을 새로 만들지 않고 값만 바꾼다(편집기 드래그·슬라이더).
  if (
    reuse instanceof HTMLCanvasElement &&
    reuse.dataset.titleEffectsImage === imageUrl &&
    reuse.dataset.titleEffectsFit === options.fit &&
    reuse.dataset.titleEffectsRendering === options.rendering &&
    (reuse.dataset.titleEffectsDepthUrl ?? "") === (depthUrl ?? "") &&
    updateTitleEffectsCanvas(reuse, effects)
  ) {
    reuse.dataset.titleEffectsSignature = signature;
    return reuse;
  }
  const canvas = createTitleEffectsCanvas(options);
  canvas.dataset.titleEffectsSignature = signature;
  canvas.dataset.titleEffectsImage = imageUrl;
  canvas.dataset.titleEffectsFit = options.fit;
  canvas.dataset.titleEffectsRendering = options.rendering;
  if (depthUrl) canvas.dataset.titleEffectsDepthUrl = depthUrl;
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
    newGamePlus: actions.onNewGamePlus ?? actions.onNewGame,
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
