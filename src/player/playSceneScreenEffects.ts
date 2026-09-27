import { dialogueHost } from "@/player/playSceneDom";
import { el } from "@/util/dom";
import {
  interpolateRgba,
  isVisibleTint,
  parseTintColor,
  rgbaEqual,
  rgbaToCss,
  TRANSPARENT_TINT,
  type Rgba,
} from "@/player/screen/tintModel";
import { CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden } from "@/player/cutsceneControl";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  interpolateScreenFilter,
  isNeutralScreenFilter,
  NEUTRAL_SCREEN_FILTER,
  normalizeScreenFilter,
  screenFilterCss,
  screenFilterEqual,
  type ScreenFilter,
} from "@/project/eventCommands/screenFilter";

// tint/hide screen 같은 "지속형" 화면 효과를 DOM 오버레이로 반영한다.
// 날씨는 Phaser 전용 레이어가 소유하며 이 경로에서는 다루지 않는다.
// 색조는 tintDurationMs 가 있으면 목표 색으로 점진 트윈(requestAnimationFrame)한다.
// 일회형 효과(flash/shake)는 Phaser 카메라 API 로 별도 처리되며 여기서 다루지 않는다.
type FlashHold = { readonly color: Rgba; readonly until: number };
const flashHolds = new WeakMap<HTMLElement, FlashHold>();

function overlayHost(scene: PlaySceneContext): HTMLElement | undefined {
  const canvas = scene.game?.canvas;
  const stage = canvas instanceof HTMLElement ? canvas.closest(".play-stage") : null;
  if (stage instanceof HTMLElement) return stage;
  const fromRegistry = dialogueHost(scene);
  if (fromRegistry) return fromRegistry;
  const parent = canvas?.parentElement;
  return parent instanceof HTMLElement ? parent : undefined;
}

/**
 * 컷신 입력 잠금(또는 `hideHud`)에 맞춰 `.play-stage` 에 HUD 억제 클래스를 켠다/끈다.
 *
 * 대화창이 HUD 를 숨기는 방식(`.play-stage:has(> .dialogue-overlay:not(:empty)) > .hand-slot`)
 * 과 같은 계열로, 실제 `display:none` 규칙은 styles/runtime/playSurface.css 가 소유한다.
 * 대사 없이 픽처·카메라만 흐르는 비트에서는 대화창이 비어 있어 그 `:has()` 규칙이 걸리지
 * 않으므로, 잠금 자체를 보는 이 경로가 따로 필요하다.
 */
export function syncCutsceneHudVisibility(scene: PlaySceneContext): void {
  const host = overlayHost(scene);
  if (!host) return;
  const hidden = scene.session ? isCutsceneHudHidden(scene.session) : false;
  host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, hidden);
}

/** Phaser camera.flash 는 swiftshader Test Play 에서 픽셀이 안 바뀐다. DOM 오버레이로 유지한다. */
export function holdScreenFlash(scene: PlaySceneContext, color: Rgba, durationMs: number): void {
  const host = overlayHost(scene);
  if (!host) return;
  const until = nowMs() + Math.max(80, durationMs);
  flashHolds.set(host, { color, until });
  setImmediateColor(host, color, "screen-flash");
}

export function syncScreenEffects(scene: PlaySceneContext): void {
  const host = overlayHost(scene);
  if (!host) return;

  const flash = flashHolds.get(host);
  if (flash && nowMs() < flash.until) {
    setImmediateColor(host, flash.color, "screen-flash");
    return;
  }
  if (flash) flashHolds.delete(host);

  const screen = scene.session.m2Runtime?.screen;

  const hidden = screen?.hidden === true;
  // 우선순위: 화면 숨김(즉시, 불투명 검정) > 색조(트윈 가능).
  if (hidden) {
    setImmediateColor(host, { r: 0, g: 0, b: 0, a: 1 }, "screen-hidden");
    return;
  }
  const target = parseTintColor(screen?.tint);
  const durationMs = screen?.tintDurationMs ?? 0;
  applyTintColor(host, target, durationMs);
  applyScreenFilter(host, screen?.filter ? normalizeScreenFilter(screen.filter) : NEUTRAL_SCREEN_FILTER, durationMs);
}

// ---------------------------------------------------------------------------
// 색 필터(채도·흑백·세피아) — 색조 오버레이와 따로 간다. 오버레이는 색을 얹고, 필터는 아래 그림의 색을 바꾼다.
// `.play-stage` 위의 투명 레이어에 backdrop-filter 를 걸어 맵·캐릭터·픽처를 한꺼번에 거른다(대화창 위는 z 로 비켜 간다).
// 전환 시간은 색조와 같은 tintDurationMs 다.
// ---------------------------------------------------------------------------

type FilterAnim = {
  displayed: ScreenFilter;
  from: ScreenFilter;
  to: ScreenFilter;
  startedAt: number;
  durationMs: number;
  rafId: number;
};

const filterAnimations = new WeakMap<HTMLElement, FilterAnim>();

function filterAnimFor(host: HTMLElement): FilterAnim {
  let anim = filterAnimations.get(host);
  if (!anim) {
    anim = {
      displayed: NEUTRAL_SCREEN_FILTER,
      from: NEUTRAL_SCREEN_FILTER,
      to: NEUTRAL_SCREEN_FILTER,
      startedAt: 0,
      durationMs: 0,
      rafId: 0,
    };
    filterAnimations.set(host, anim);
  }
  return anim;
}

function applyScreenFilter(host: HTMLElement, target: ScreenFilter, durationMs: number): void {
  const anim = filterAnimFor(host);
  // 이미 같은 목표로 트윈 중이면 매 동기화마다 다시 시작하지 않는다.
  if (screenFilterEqual(anim.to, target) && anim.durationMs > 0) return;
  if (durationMs <= 0 || screenFilterEqual(anim.displayed, target)) {
    anim.displayed = target;
    anim.from = target;
    anim.to = target;
    anim.durationMs = 0;
    renderFilter(host, target);
    return;
  }
  anim.from = anim.displayed;
  anim.to = target;
  anim.startedAt = nowMs();
  anim.durationMs = durationMs;
  if (typeof requestAnimationFrame !== "function") {
    anim.displayed = target;
    anim.durationMs = 0;
    renderFilter(host, target);
    return;
  }
  if (anim.rafId !== 0) return;
  const tick = (): void => {
    const t = anim.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs() - anim.startedAt) / anim.durationMs));
    anim.displayed = interpolateScreenFilter(anim.from, anim.to, t);
    renderFilter(host, anim.displayed);
    if (t >= 1) {
      anim.displayed = anim.to;
      anim.from = anim.to;
      anim.durationMs = 0;
      anim.rafId = 0;
      return;
    }
    anim.rafId = requestAnimationFrame(tick);
  };
  anim.rafId = requestAnimationFrame(tick);
}

const FILTER_LAYER_TESTID = "runtime-screen-filter";

function renderFilter(host: HTMLElement, filter: ScreenFilter): void {
  const css = screenFilterCss(filter);
  let layer = host.querySelector<HTMLElement>(`[data-testid='${FILTER_LAYER_TESTID}']`);
  if (isNeutralScreenFilter(filter) || !css) {
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = el("div", {
      class: "runtime-screen-filter",
      dataset: { testid: FILTER_LAYER_TESTID },
    });
    host.append(layer);
  }
  layer.style.position = "absolute";
  layer.style.inset = "0";
  // 색조 오버레이(40) 바로 아래 — 필터가 먼저 그림을 거르고 색조가 그 위에 얹힌다. 대화창(39)보다는 위라 대사도 같이 바랜다.
  layer.style.zIndex = "39";
  layer.style.pointerEvents = "none";
  layer.style.setProperty("backdrop-filter", css);
  layer.style.setProperty("-webkit-backdrop-filter", css);
  layer.dataset.filter = css;
}

type TintAnim = {
  displayed: Rgba;
  from: Rgba;
  to: Rgba;
  startedAt: number;
  durationMs: number;
  rafId: number;
};

const tintAnimations = new WeakMap<HTMLElement, TintAnim>();

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : 0;
}

function animFor(host: HTMLElement): TintAnim {
  let anim = tintAnimations.get(host);
  if (!anim) {
    anim = {
      displayed: TRANSPARENT_TINT,
      from: TRANSPARENT_TINT,
      to: TRANSPARENT_TINT,
      startedAt: 0,
      durationMs: 0,
      rafId: 0,
    };
    tintAnimations.set(host, anim);
  }
  return anim;
}

function setImmediateColor(host: HTMLElement, color: Rgba, mode: string): void {
  const anim = animFor(host);
  anim.displayed = color;
  anim.from = color;
  anim.to = color;
  anim.durationMs = 0;
  renderColor(host, color, mode);
}

function applyTintColor(host: HTMLElement, target: Rgba, durationMs: number): void {
  const anim = animFor(host);
  if (durationMs <= 0 || rgbaEqual(anim.displayed, target)) {
    anim.displayed = target;
    anim.from = target;
    anim.to = target;
    anim.durationMs = 0;
    renderColor(host, target, "screen-tint");
    return;
  }
  anim.from = anim.displayed;
  anim.to = target;
  anim.startedAt = nowMs();
  anim.durationMs = durationMs;
  ensureTintTicker(host, anim);
}

function ensureTintTicker(host: HTMLElement, anim: TintAnim): void {
  if (typeof requestAnimationFrame !== "function") {
    anim.displayed = anim.to;
    anim.durationMs = 0;
    renderColor(host, anim.to, "screen-tint");
    return;
  }
  if (anim.rafId !== 0) return;
  const tick = (): void => {
    const t = anim.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs() - anim.startedAt) / anim.durationMs));
    anim.displayed = interpolateRgba(anim.from, anim.to, t);
    renderColor(host, anim.displayed, "screen-tint");
    if (t >= 1) {
      anim.displayed = anim.to;
      anim.from = anim.to;
      anim.durationMs = 0;
      anim.rafId = 0;
      return;
    }
    anim.rafId = requestAnimationFrame(tick);
  };
  anim.rafId = requestAnimationFrame(tick);
}

function renderColor(host: HTMLElement, color: Rgba, mode: string): void {
  if (!isVisibleTint(color)) {
    removeScreenLayer(host);
    return;
  }
  upsertScreenLayer(host, rgbaToCss(color), mode);
}

function upsertScreenLayer(host: HTMLElement, background: string, mode: string): void {
  let layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-effect']");
  if (!layer) {
    layer = el("div", {
      class: "runtime-screen-effect",
      dataset: { testid: "runtime-screen-effect" },
    });
    host.append(layer);
  }
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.zIndex = "40";
  layer.style.pointerEvents = "none";
  layer.style.background = background;
  layer.dataset.mode = mode;
}

function removeScreenLayer(host: HTMLElement): void {
  host.querySelector("[data-testid='runtime-screen-effect']")?.remove();
}
