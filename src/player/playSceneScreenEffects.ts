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
import type { PlaySceneContext } from "@/player/playSceneTypes";

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
