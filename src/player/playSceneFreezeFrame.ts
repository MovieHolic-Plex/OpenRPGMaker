import { screenOverlayHost } from "@/player/playSceneScreenEffects";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { FreezeStyle } from "@/player/interpreter/screenEffectPlan";
import { el } from "@/util/dom";

/**
 * 정지 화면(만화식 프리즈 프레임) — 「화면 효과」 freeze/unfreeze.
 *
 * 켜는 순간의 필드 캔버스를 Phaser renderer.snapshot 으로 한 장 찍어(WebGL 은 프레임이 끝나면 버퍼가 비어 캔버스를
 * 직접 읽을 수 없다) DOM 그림으로 세운다. 들어올 때 하얗게 한 번 번쩍이고 살짝 커지며 멈춘다. 그림 위(26)·화면 효과(27)
 * 사이 z 26.5 가 아니라 레터박스(28) 아래 27 바로 위 — 레터박스 띠와 대사창(39)은 그 위에 뜬다.
 * 뒤의 맵·인물은 계속 돈다(흐름이 멈추지 않는다). 그래서 정지 화면 뒤에 무대를 다시 세우고 풀면 바로 이어진다.
 * 불러오기 뒤에는 그때 화면을 다시 찍는다(찍은 그림은 세이브에 남기지 않는다).
 */
const FREEZE_Z = 27;
const TESTID = "runtime-freeze-frame";

const STYLE_FILTER: Record<FreezeStyle, string> = {
  none: "none",
  mono: "grayscale(1) contrast(1.15)",
  sepia: "sepia(0.85) contrast(1.05)",
  warm: "sepia(0.6) saturate(1.35) hue-rotate(-8deg) contrast(1.06) brightness(1.08)",
  cool: "saturate(0.7) hue-rotate(-12deg) brightness(1.02) contrast(1.1)",
};

type FreezeView = { at: number; pending: boolean };
const shown = new WeakMap<HTMLElement, FreezeView>();

function snapshot(scene: PlaySceneContext): Promise<string | undefined> {
  const renderer = scene.game?.renderer as unknown as { snapshot?: (cb: (image: unknown) => void, type?: string, quality?: number) => void } | undefined;
  if (!renderer || typeof renderer.snapshot !== "function") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 400);
    try {
      renderer.snapshot!((image) => {
        clearTimeout(timer);
        resolve(image instanceof HTMLImageElement && image.src ? image.src : undefined);
      }, "image/png");
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

function layerFor(host: HTMLElement): HTMLElement {
  let layer = host.querySelector<HTMLElement>(`[data-testid='${TESTID}']`);
  if (layer) return layer;
  layer = el("div", { class: "runtime-freeze-frame", dataset: { testid: TESTID } });
  Object.assign(layer.style, { position: "absolute", inset: "0", zIndex: String(FREEZE_Z), pointerEvents: "none", overflow: "hidden", opacity: "0" });
  const still = el("img", { class: "runtime-freeze-still", attrs: { alt: "", draggable: "false" } }) as HTMLImageElement;
  Object.assign(still.style, { position: "absolute", inset: "0", width: "100%", height: "100%", imageRendering: "pixelated", transformOrigin: "50% 50%" });
  const flash = el("div", { class: "runtime-freeze-flash" });
  Object.assign(flash.style, { position: "absolute", inset: "0", background: "#fff", opacity: "0" });
  layer.append(still, flash);
  host.append(layer);
  return layer;
}

/** 매 프레임 — 세션의 정지 화면 상태와 DOM 을 맞춘다. */
export function syncFreezeFrame(scene: PlaySceneContext): void {
  const host = screenOverlayHost(scene);
  if (!host) return;
  const screen = scene.session.m2Runtime?.screen;
  const freeze = screen?.freeze;
  const view = shown.get(host);
  const ms = Math.max(0, screen?.freezeDurationMs ?? 0);
  if (!freeze) {
    if (!view) return;
    shown.delete(host);
    const layer = host.querySelector<HTMLElement>(`[data-testid='${TESTID}']`);
    if (!layer) return;
    layer.style.transition = `opacity ${ms}ms ease-out`;
    layer.style.opacity = "0";
    layer.dataset.state = "off";
    setTimeout(() => { if (!shown.has(host)) layer.remove(); }, ms + 40);
    return;
  }
  if (view && view.at === freeze.at) return;
  shown.set(host, { at: freeze.at, pending: true });
  const at = freeze.at, style = freeze.style;
  void snapshot(scene).then((src) => {
    const current = shown.get(host);
    if (!current || current.at !== at || !src) return;
    current.pending = false;
    const layer = layerFor(host);
    // 무대(.play-stage) 안에서 캔버스가 차지한 자리에 맞춘다 — 크롭·여백이 있으면 무대 전체(inset 0)에 깔면 그림이 어긋난다.
    const canvas = scene.game?.canvas;
    if (canvas instanceof HTMLElement) {
      // 무대가 CSS 로 확대돼 있으면(정수 배율 맞춤) getBoundingClientRect 는 확대 뒤 화소다 — 무대 안 좌표(확대 전)로 되돌린다.
      // 안 되돌리면 정지 그림이 배율만큼 한 번 더 커져 화면 한 귀퉁이만 보였다(QA 2026-10-25 d1-arrive).
      const hr = host.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
      const sx = host.offsetWidth > 0 ? hr.width / host.offsetWidth : 1, sy = host.offsetHeight > 0 ? hr.height / host.offsetHeight : 1;
      if (cr.width > 0 && cr.height > 0) Object.assign(layer.style, { inset: "auto", left: `${(cr.left - hr.left) / sx}px`, top: `${(cr.top - hr.top) / sy}px`, width: `${cr.width / sx}px`, height: `${cr.height / sy}px` });
    }
    const still = layer.querySelector<HTMLImageElement>(".runtime-freeze-still")!;
    const flash = layer.querySelector<HTMLElement>(".runtime-freeze-flash")!;
    still.src = src;
    still.style.filter = STYLE_FILTER[style] ?? "none";
    layer.dataset.state = "on";
    layer.dataset.style = style;
    // 들어오기: 하얀 번쩍임이 빠지며 그림이 1.00 → 1.04 로 살짝 다가선다(멈춘 느낌).
    layer.style.transition = "none";
    layer.style.opacity = "1";
    still.style.transition = "none";
    still.style.transform = "scale(1)";
    flash.style.transition = "none";
    flash.style.opacity = "0.9";
    requestAnimationFrame(() => {
      const dur = Math.max(120, ms || 500);
      flash.style.transition = `opacity ${dur}ms ease-out`;
      flash.style.opacity = "0";
      still.style.transition = `transform ${dur * 2}ms ease-out`;
      still.style.transform = "scale(1.04)";
    });
  });
}
