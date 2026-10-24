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
  options: { readonly topAlignPortrait?: boolean } = {},
): PlaySurface {
  const topAlignPortrait = options.topAlignPortrait === true;
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
  if (topAlignPortrait) viewport.dataset.rotateHint = rotateHintText();
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

  const resizeObserver = new ResizeObserver(() => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait));
  resizeObserver.observe(viewport);
  const animationFrameId = requestAnimationFrame(() => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait));

  return {
    viewport,
    stage,
    phaserContainer,
    sync: () => syncPlaySurfaceMetrics(viewport, resolution, scaleMode, topAlignPortrait),
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
): void {
  const bounds = viewport.getBoundingClientRect();
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
function syncMobileUiMetrics(viewport: HTMLElement, width: number, height: number, scale: number): void {
  viewport.style.setProperty("--play-viewport-width", cssPx(width));
  viewport.style.setProperty("--play-viewport-height", cssPx(height));
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const phone = coarse && Math.min(width, height) < 900;
  if (!phone) {
    delete viewport.dataset.mobileUi;
    viewport.style.removeProperty("--mobile-ui-z");
    viewport.style.removeProperty("--mobile-ui-k");
    return;
  }
  const portrait = width < height;
  viewport.dataset.mobileUi = portrait ? "portrait" : "landscape";
  // 노치·다이내믹 아일랜드: 세로에서는 무대를 위쪽 안전 영역 아래로 내린다(무대 위 12px 여백만으로는 노치에 가린다).
  if (portrait && viewport.dataset.layout === "portrait") {
    const stageTop = Number.parseFloat(viewport.style.getPropertyValue("--play-stage-top")) || PORTRAIT_TOP_MARGIN;
    viewport.style.setProperty("--play-stage-top", `max(${stageTop}px, env(safe-area-inset-top, 0px))`);
  }
  // UI 확대 배율 z: 겹침 층을 "화면 px × z" 좌표계로 다시 깔아, 논리 6.5px 글자가 화면에서 읽히는 크기(약 12~13px)가 되게 한다.
  const z = Math.min(2.4, Math.max(1.5, Math.min(width, height) / (portrait ? 195 : 215)));
  viewport.style.setProperty("--mobile-ui-z", String(Math.round(z * 1000) / 1000));
  viewport.style.setProperty("--mobile-ui-k", String(Math.round((1 / Math.max(scale, 0.01)) * 1000) / 1000));
}

const PORTRAIT_TOP_MARGIN = 12;

/** 세로 화면 안내문 — 브라우저 언어(ko/ja/zh/그 외 en)로. 게임 글자는 아니므로 프로젝트 언어와 무관하다. */
function rotateHintText(): string {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (lang.startsWith("ko")) return "가로로 돌리면 더 크게 보여요";
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
