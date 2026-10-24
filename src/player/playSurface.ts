import { el } from "@/util/dom";
import { DISPLAY_FILTER_TESTID, syncDisplayFilter } from "@/player/displayFilterDom";
import {
  calculatePlaySurfaceCropMetrics,
  calculatePlaySurfacePlacement,
  calculatePlaySurfaceScale,
  type PlaySurfaceScaleMode,
} from "@/player/playSurfaceScale";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlayResolution } from "@/project/types";

export type PlaySurface = {
  readonly viewport: HTMLElement;
  readonly stage: HTMLElement;
  readonly phaserContainer: HTMLElement;
  readonly sync: () => void;
  readonly cleanup: () => void;
};

export function createPlaySurface(
  resolution: Readonly<PlayResolution> = PLAY_RESOLUTION,
  scaleMode: PlaySurfaceScaleMode = "integer",
  displayFilter?: unknown,
  options: { readonly topAlignPortrait?: boolean; readonly touchUi?: boolean } = {},
): PlaySurface {
  const topAlignPortrait = options.topAlignPortrait === true;
  const touchUi = options.touchUi === true;
  const viewport = el("div", {
    class: "play-viewport",
    dataset: { testid: "play-viewport", scaleMode },
  });
  const stage = el("div", {
    class: "play-stage",
    dataset: { testid: "play-stage" },
  });
  const phaserContainer = el("div", {
    class: "phaser-container",
    dataset: { testid: "play-canvas" },
  });
  applyPlaySurfaceResolution(viewport, stage, phaserContainer, resolution);
  if (topAlignPortrait || touchUi) viewport.dataset.rotateHint = rotateHintText();
  if (touchUi) viewport.dataset.touchUi = "true";
  stage.append(phaserContainer);
  viewport.append(stage);
  syncDisplayFilter(stage, displayFilter);
  // 전투·메뉴 층이 나중에 붙어도 필터가 맨 위에 남도록 — 무대의 직계 자식이 바뀔 때 다시 끝으로 옮긴다.
  const filterObserver = displayFilter
    ? new MutationObserver(() => {
        const last = stage.lastElementChild;
        if (last instanceof HTMLElement && last.dataset.testid !== DISPLAY_FILTER_TESTID) syncDisplayFilter(stage, displayFilter);
      })
    : null;
  filterObserver?.observe(stage, { childList: true });

  const resizeObserver = new ResizeObserver(() => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait, touchUi));
  resizeObserver.observe(viewport);
  const animationFrameId = requestAnimationFrame(() => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait, touchUi));

  return {
    viewport,
    stage,
    phaserContainer,
    sync: () => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait, touchUi),
    cleanup: () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      filterObserver?.disconnect();
    },
  };
}

function applyPlaySurfaceResolution(
  viewport: HTMLElement,
  stage: HTMLElement,
  phaserContainer: HTMLElement,
  resolution: Readonly<PlayResolution>,
): void {
  const width = `${resolution.width}px`;
  const height = `${resolution.height}px`;
  viewport.style.setProperty("--play-logical-width", width);
  viewport.style.setProperty("--play-logical-height", height);
  viewport.style.setProperty("--play-logical-half-width", `${resolution.width / 2}px`);
  viewport.style.setProperty("--play-logical-half-height", `${resolution.height / 2}px`);
  stage.style.width = width;
  stage.style.height = height;
  phaserContainer.style.width = width;
  phaserContainer.style.height = height;
}

function syncPlaySurfaceMetrics(
  viewport: HTMLElement,
  resolution: Readonly<PlayResolution>,
  scaleMode: PlaySurfaceScaleMode,
  topAlignPortrait: boolean,
  touchUi = false,
): void {
  const bounds = viewport.getBoundingClientRect();
  if (touchUi) {
    syncTouchLayout(viewport, bounds.width, bounds.height, resolution);
    return;
  }
  const scale = calculatePlaySurfaceScale(bounds.width, bounds.height, resolution.width, resolution.height, scaleMode);
  const crop = calculatePlaySurfaceCropMetrics(bounds.width, bounds.height, scale, resolution.width, resolution.height);
  const placement = calculatePlaySurfacePlacement(bounds.width, bounds.height, scale, resolution.width, resolution.height);
  let stageTop = placement.top;
  // 세로로 긴 화면(폰 세로): 무대를 위쪽에 붙이고 아래 띠는 터치 패드·여백에 남긴다. 가운데 두면 위아래 검은 띠 둘로 갈라져 둘 다 못 쓴다(D16).
  if (topAlignPortrait) {
    const portrait = isPortraitViewport(bounds.width, bounds.height, resolution.width, resolution.height, scale);
    viewport.dataset.layout = portrait ? "portrait" : "landscape";
    if (portrait) stageTop = Math.min(stageTop, PORTRAIT_TOP_MARGIN);
  }
  viewport.style.setProperty("--play-scale", String(scale));
  viewport.style.setProperty("--play-scale-x", String(scale));
  viewport.style.setProperty("--play-scale-y", String(scale));
  viewport.style.setProperty("--play-crop-top", cssPx(crop.top));
  viewport.style.setProperty("--play-crop-right", cssPx(crop.right));
  viewport.style.setProperty("--play-crop-bottom", cssPx(crop.bottom));
  viewport.style.setProperty("--play-crop-left", cssPx(crop.left));
  viewport.style.setProperty("--play-visible-width", cssPx(crop.visibleWidth));
  viewport.style.setProperty("--play-visible-height", cssPx(crop.visibleHeight));
  viewport.style.setProperty("--play-stage-left", cssPx(placement.left));
  viewport.style.setProperty("--play-stage-top", cssPx(stageTop));
  viewport.dataset.scale = scale.toFixed(3);
  syncMobileUiMetrics(viewport, bounds.width, bounds.height, scale);
}

/**
 * 폰(거친 포인터 + 짧은 변 900px 미만)이면 `data-mobile-ui` 를 켠다. 무대가 작게 줄어 UI 글자가 6px 로 보이는 문제를
 * CSS(mobileUi.css)가 `--mobile-ui-z`(UI 확대 배율)로 겹침 층을 화면 px 좌표계로 다시 깔아 푼다(무대 배율 `--play-scale` 로 나눠 상쇄).
 * 데스크톱(마우스)은 속성 자체가 없어 모양이 그대로다.
 */
function syncMobileUiMetrics(viewport: HTMLElement, width: number, height: number, scale: number, touchUi = false): void {
  viewport.style.setProperty("--play-viewport-width", cssPx(width));
  viewport.style.setProperty("--play-viewport-height", cssPx(height));
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  // 터치 UI 는 기기 판정(isTouchDevice)을 이미 통과했다 — 폴드처럼 짧은 변이 900px 를 넘는 접는 폰·태블릿도 휴대폰 UI 를 쓴다.
  const phone = touchUi ? Math.min(width, height) < 1400 : coarse && Math.min(width, height) < 900;
  if (!phone) {
    delete viewport.dataset.mobileUi;
    viewport.style.removeProperty("--mobile-ui-z");
    viewport.style.removeProperty("--mobile-ui-k");
    return;
  }
  const portrait = touchUi ? viewport.dataset.touchLayout === "portrait" : width < height;
  viewport.dataset.mobileUi = portrait ? "portrait" : "landscape";
  // 노치·다이내믹 아일랜드: 세로에서는 무대를 위쪽 안전 영역 아래로 내린다(무대 위 12px 여백만으로는 노치에 가린다).
  if (!touchUi && portrait && viewport.dataset.layout === "portrait") {
    const stageTop = Number.parseFloat(viewport.style.getPropertyValue("--play-stage-top")) || PORTRAIT_TOP_MARGIN;
    viewport.style.setProperty("--play-stage-top", `max(${stageTop}px, env(safe-area-inset-top, 0px))`);
  }
  // UI 확대 배율 z: 겹침 층을 "화면 px × z" 좌표계로 다시 깔아, 논리 6.5px 글자가 화면에서 읽히는 크기(약 12~13px)가 되게 한다.
  const z = Math.min(2.4, Math.max(1.5, Math.min(width, height) / (portrait ? 195 : 215)));
  viewport.style.setProperty("--mobile-ui-z", String(Math.round(z * 1000) / 1000));
  viewport.style.setProperty("--mobile-ui-k", String(Math.round((1 / Math.max(scale, 0.01)) * 1000) / 1000));
}

const PORTRAIT_TOP_MARGIN = 12;

/** 안전 영역(노치·홈 막대). iframe 안에서는 늘 0 이다 — 품는 페이지가 비켜 준다. */
function readSafeAreaInsets(viewport: HTMLElement): { top: number; right: number; bottom: number; left: number } {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return zero;
  let probe = viewport.querySelector<HTMLElement>(":scope > .play-safe-area-probe");
  if (!probe) {
    probe = document.createElement("div");
    probe.className = "play-safe-area-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);";
    viewport.append(probe);
  }
  const style = getComputedStyle(probe);
  const read = (value: string): number => { const n = Number.parseFloat(value); return Number.isFinite(n) ? n : 0; };
  return { top: read(style.paddingTop), right: read(style.paddingRight), bottom: read(style.paddingBottom), left: read(style.paddingLeft) };
}

/** 터치 조작 크기(css px). 조이스틱은 120~140, 화면이 작으면 줄인다. */
export function touchStickSize(width: number, height: number): number {
  return Math.round(Math.min(136, Math.max(112, Math.min(width, height) * 0.32)));
}

export type TouchLayout = {
  readonly mode: "portrait" | "landscape";
  readonly scale: number;
  readonly stageLeft: number;
  readonly stageTop: number;
  /** 조작이 앉는 띠(세로: 무대 아래, 가로: 화면 전체 높이). 뷰포트 위에서 잰 px. */
  readonly bandTop: number;
  readonly bandBottom: number;
  /** 조작 중심선 y(뷰포트 위에서 잰 px). */
  readonly controlsY: number;
  /** 가로: 좌우 조작 칸 폭(안전 영역 포함). 세로는 0. */
  readonly gutter: number;
  readonly stick: number;
};

/**
 * 터치 기기의 무대·조작 배치(2026-10-24). 조작이 게임을 가리지 않게 자리를 먼저 떼고 그 나머지에 무대를 맞춘다.
 * - 세로: 무대는 위(노치 아래), 조작은 그 아래 띠. 띠가 크게 남으면 조작을 남는 높이의 40% 지점에 둬 엄지가 닿는 곳·빈 칸이 작게.
 * - 가로: 좌우에 조작 칸을 떼고 가운데에 무대. 칸이 무대보다 좁으면 조작이 무대 가장자리에 조금 겹친다.
 */
export function calculateTouchLayout(
  width: number,
  height: number,
  logicalW: number,
  logicalH: number,
  safe: { top: number; right: number; bottom: number; left: number },
): TouchLayout {
  const stick = touchStickSize(width, height);
  const portrait = height >= width * 0.9;
  if (portrait) {
    const controlsBlock = stick + 80; // 메뉴 줄(44) + 조이스틱 + 아래 숨 쉴 틈
    const reserve = controlsBlock + safe.bottom + 16;
    const topPad = Math.max(8, safe.top + 4);
    const availH = Math.max(40, height - reserve - topPad);
    const scale = calculatePlaySurfaceScale(width - safe.left - safe.right, availH, logicalW, logicalH, "fit");
    const stageH = logicalH * scale;
    const stageW = logicalW * scale;
    const stageTop = topPad;
    const bandTop = stageTop + stageH;
    const bandBottom = height - safe.bottom;
    const free = Math.max(0, bandBottom - bandTop - controlsBlock);
    const controlsY = bandTop + free * 0.4 + 44 + stick / 2;
    return { mode: "portrait", scale, stageLeft: Math.max(safe.left, (width - stageW) / 2), stageTop, bandTop, bandBottom, controlsY, gutter: 0, stick };
  }
  // 칸은 조이스틱보다 넓어야 한다(좁으면 조이스틱이 화면 밖으로 잘린다 — 아이폰 가로 iframe 734px 에서 실측).
  const gutterBase = Math.round(Math.min(stick + 40, Math.max(stick + 12, width * 0.15)));
  const gutterL = gutterBase + safe.left;
  const gutterR = gutterBase + safe.right;
  const availW = Math.max(40, width - gutterL - gutterR);
  const availH = Math.max(40, height - safe.top - safe.bottom);
  const scale = calculatePlaySurfaceScale(availW, availH, logicalW, logicalH, "fit");
  const stageW = logicalW * scale;
  const stageH = logicalH * scale;
  const stageLeft = gutterL + (availW - stageW) / 2;
  const stageTop = safe.top + (availH - stageH) / 2;
  const controlsY = safe.top + availH * 0.62;
  return { mode: "landscape", scale, stageLeft, stageTop, bandTop: safe.top, bandBottom: height - safe.bottom, controlsY, gutter: Math.max(gutterL, gutterR), stick };
}

function syncTouchLayout(viewport: HTMLElement, width: number, height: number, resolution: Readonly<PlayResolution>): void {
  const safe = readSafeAreaInsets(viewport);
  const layout = calculateTouchLayout(width, height, resolution.width, resolution.height, safe);
  const scale = layout.scale;
  viewport.dataset.layout = layout.mode;
  viewport.dataset.touchLayout = layout.mode;
  viewport.style.setProperty("--play-scale", String(scale));
  viewport.style.setProperty("--play-scale-x", String(scale));
  viewport.style.setProperty("--play-scale-y", String(scale));
  for (const side of ["top", "right", "bottom", "left"]) viewport.style.setProperty(`--play-crop-${side}`, "0px");
  viewport.style.setProperty("--play-visible-width", cssPx(resolution.width));
  viewport.style.setProperty("--play-visible-height", cssPx(resolution.height));
  viewport.style.setProperty("--play-stage-left", cssPx(layout.stageLeft));
  viewport.style.setProperty("--play-stage-top", cssPx(layout.stageTop));
  viewport.style.setProperty("--play-stage-width", cssPx(resolution.width * scale));
  viewport.style.setProperty("--play-stage-height", cssPx(resolution.height * scale));
  viewport.style.setProperty("--touch-band-top", cssPx(layout.bandTop));
  viewport.style.setProperty("--touch-band-bottom", cssPx(height - layout.bandBottom));
  viewport.style.setProperty("--touch-controls-y", cssPx(layout.controlsY));
  viewport.style.setProperty("--touch-gutter", cssPx(layout.gutter));
  viewport.style.setProperty("--touch-stick", cssPx(layout.stick));
  viewport.style.setProperty("--touch-safe-left", cssPx(safe.left));
  viewport.style.setProperty("--touch-safe-right", cssPx(safe.right));
  viewport.dataset.scale = scale.toFixed(3);
  syncMobileUiMetrics(viewport, width, height, scale, true);
}

/** 세로 화면 안내문 — 브라우저 언어(ko/ja/zh/그 외 en)로. 게임 글자는 아니므로 프로젝트 언어와 무관하다. */
function rotateHintText(): string {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (lang.startsWith("ko")) return "가로로 돌리면 화면이 커져요";
  if (lang.startsWith("ja")) return "横向きにすると大きく表示されます";
  if (lang.startsWith("zh")) return "横屏显示画面更大";
  return "Rotate your phone for a bigger screen";
}

/** 가로 폭이 무대를 겨우 덮고 세로가 한참 남을 때만 세로 배치(남는 높이가 무대의 절반 이상). */
function isPortraitViewport(w: number, h: number, logicalW: number, logicalH: number, scale: number): boolean {
  return h - logicalH * scale >= logicalH * scale * 0.5 && w < logicalW * scale * 1.5 + 1;
}

function cssPx(value: number): string {
  return `${Math.round(value * 1000) / 1000}px`;
}
