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

/**
 * 상점 배치를 논리 해상도(게임 px)로 고른다. 예전 화면 px 문턱(460/860)은 글자가 배율만큼 커지던 시절 값이라,
 * 게임 px 12px 글자 기준으로 다시 잡았다: 320 급(창 칸·320×240 게임) = 작은 배치, 480×270·640×360 = 압축, 그보다 크면 넓은 배치.
 */
function shopFitFor(resolution: Readonly<PlayResolution>): "tiny" | "compact" | "full" {
  return resolution.width <= 360 ? "tiny" : resolution.width <= 640 || resolution.height <= 360 ? "compact" : "full";
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
  // 상점 창의 배치(넓은·압축·작은)는 화면 크기가 아니라 논리 해상도로 고른다 — 기기·방향이 달라도 같은 배치(shop.css).
  viewport.dataset.shopFit = shopFitFor(resolution);
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
    syncTouchLayout(viewport, bounds.width, bounds.height, resolution, scaleMode);
    return;
  }
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const scale = calculatePlaySurfaceScale(bounds.width, bounds.height, resolution.width, resolution.height, scaleMode, dpr);
  const crop = calculatePlaySurfaceCropMetrics(bounds.width, bounds.height, scale, resolution.width, resolution.height);
  const placement = calculatePlaySurfacePlacement(bounds.width, bounds.height, scale, resolution.width, resolution.height, dpr);
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
  // k 는 화면 px 를 논리 px 로 바꾼다 — 도트 글꼴을 화면 12px 에 정확히 맞추려고 소수 여섯 자리까지 둔다.
  viewport.style.setProperty("--mobile-ui-k", String(Math.round((1 / Math.max(scale, 0.01)) * 1e6) / 1e6));
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
  /**
   * 세로 대사 독: 무대가 1배보다 작게 그려질 때 대사·선택지 창을 무대 아래 빈 띠에 1배(게임 px = 화면 px)로 그린다.
   * 뷰포트 위에서 잰 px. 독이 없으면 null.
   */
  readonly dock: { readonly top: number; readonly left: number; readonly width: number; readonly height: number; /** 독 안 창의 화면 배율(1배 미만 무대면 1, 아니면 무대 배율). */ readonly scale: number } | null;
  /**
   * 세로 창 칸(2026-10-24): 무대가 1배보다 작을 때 ESC 메뉴·상점 창을 무대 대신 이 칸에 그린다.
   * 칸은 어느 폰이든 같은 논리 크기(WINDOW_PANEL_WIDTH×HEIGHT 게임 px)이고, 들어가면 1배(글자 12px)다.
   * top/left 는 뷰포트 위 화면 px, scale 은 칸 배율. 없으면 null.
   */
  readonly panel: { readonly top: number; readonly left: number; readonly scale: number; readonly height: number } | null;
  /**
   * 터치 메뉴 한 줄의 최소 높이(게임 px) — 화면에서 44px 가 되게(2026-10-25). 메뉴가 그려지는 배율(창 칸이면 칸 배율,
   * 아니면 무대 배율)로 나눈다. CSS(mobileUi.css)가 ESC 메뉴 명령 줄에 쓴다.
   */
  readonly menuRow: number;
};

/** 터치 대상 최소 높이(화면 px) — Apple HIG 44pt, Material 48dp 의 아래쪽. */
export const TOUCH_TARGET_MIN = 44;
/** 가로 조작 칸 폭(화면 px) — A·B 묶음 120 + 양옆 숨 쉴 틈. 무대는 이 두 칸 사이에만 그린다. */
export const LANDSCAPE_GUTTER = 128;
/** 가로 조이스틱 지름 — 칸 안에 들어가게. 누르는 칸은 왼쪽 칸 전체라 지름보다 넓다. */
export const LANDSCAPE_STICK = 108;
/** 세로 창 칸의 최대 논리 높이 — 남는 높이가 있으면 칸을 늘려 메뉴 줄을 44px 로 벌릴 자리를 만든다. */
export const WINDOW_PANEL_MAX_HEIGHT = 400;

/** 세로 창 칸의 논리 크기(게임 px). 도트 메뉴의 원래 설계 폭(320)이고, 375~430px 폭 폰 세로에 1배로 들어간다. */
export const WINDOW_PANEL_WIDTH = 320;
export const WINDOW_PANEL_HEIGHT = 300;

/** 대사 독의 최소 높이(화면 px = 게임 px) — 대사 상자(무대 높이의 27%, 480×270 에서 73px) + 위아래 숨 쉴 틈. */
export const DIALOGUE_DOCK_MIN_HEIGHT = 96;

export type TouchLayoutOptions = {
  /** 프로젝트의 배율 정책(system.playSurfaceScale). 데스크톱과 같다 — 정수 배율 + 여백, 1배 미만만 비정수. */
  readonly scaleMode?: PlaySurfaceScaleMode;
  /** 세로 대사 독을 쓸지(기본 켬). */
  readonly dialogueDock?: boolean;
  /** 세로 창 칸(메뉴·상점)을 쓸지(기본 켬). */
  readonly windowPanel?: boolean;
};

/**
 * 터치 기기의 무대·조작 배치(2026-10-24). 조작이 게임을 가리지 않게 자리를 먼저 떼고 그 나머지에 무대를 맞춘다.
 * 게임 UI(대사·선택지·메뉴·상점·전투 창)는 모두 무대 안 게임 px 이라, 기기·방향이 바뀌어도 같은 모양이 통째로 커지거나 작아질 뿐이다.
 * - 세로: 무대는 위(노치 아래), 조작은 그 아래 띠. 띠가 크게 남으면 조작을 남는 높이의 40% 지점에 둬 엄지가 닿는 곳·빈 칸이 작게.
 *   무대가 1배보다 작으면(폰 세로) 대사 창은 무대 아래 독에 1배로 내린다(dock).
 * - 가로: 좌우에 조작 칸을 떼고 가운데에 무대.
 * 배율은 데스크톱과 같은 calculatePlaySurfaceScale(정책 그대로) — 무대 왼쪽 위는 정수 화면 px 에 둔다.
 */
export function calculateTouchLayout(
  width: number,
  height: number,
  logicalW: number,
  logicalH: number,
  safe: { top: number; right: number; bottom: number; left: number },
  options: TouchLayoutOptions = {},
): TouchLayout {
  const scaleMode = options.scaleMode ?? "fit";
  const stick = touchStickSize(width, height);
  // 정사각에 가까운 화면(폴드 펼침 가로 1040×930)은 좌우 칸을 떼면 무대가 작아지고 위아래가 빈다 — 아래 띠 배치가 낫다.
  const portrait = height >= width * 0.75;
  if (portrait) {
    const controlsBlock = stick + 88; // 메뉴 줄(44 단추 + 8 틈) + 조이스틱 + 아래 숨 쉴 틈
    const reserve = controlsBlock + safe.bottom + 16;
    const topPad = Math.max(8, safe.top + 4);
    const availW = width - safe.left - safe.right;
    const availH = Math.max(40, height - reserve - topPad);
    const scale = calculatePlaySurfaceScale(availW, availH, logicalW, logicalH, scaleMode);
    const stageH = logicalH * scale;
    const stageW = logicalW * scale;
    const stageTop = Math.round(topPad);
    const stageLeft = Math.round(Math.max(safe.left, safe.left + (availW - stageW) / 2));
    const bandTop = stageTop + stageH;
    const bandBottom = height - safe.bottom;
    let free = Math.max(0, bandBottom - bandTop - controlsBlock);
    let dock: TouchLayout["dock"] = null;
    // 독 배율: 무대가 1배 미만이면 1배(글자를 키운다), 1배 이상이면 무대와 같은 배율(글자 크기는 그대로).
    // 4:3 무대(320×240)는 폰 세로에서 1.2배쯤이라 예전엔 독이 꺼지고 무대 아래 540px 가 비었다 — 대사가 지도를 덮은 채
    // 빈 띠만 남았다(2026-10-25 심판 J33). 띠가 남으면 배율과 상관없이 대사 창을 그 띠로 내린다.
    const dockScale = Math.max(1, scale);
    if (options.dialogueDock !== false && free >= (DIALOGUE_DOCK_MIN_HEIGHT + 8) * dockScale) {
      // 독 높이: 남는 띠에서 조작 자리를 뺀 만큼(선택지까지 들어가게), 단 화면 절반을 넘기지 않는다.
      const dockH = Math.floor(Math.min(free - 8, Math.max(DIALOGUE_DOCK_MIN_HEIGHT * dockScale, logicalH * 0.6 * dockScale)));
      dock = { top: Math.round(bandTop + 4), left: Math.round(safe.left), width: Math.floor(availW), height: dockH, scale: dockScale };
      free = Math.max(0, free - dockH - 8);
    }
    const controlsTop = dock ? dock.top + dock.height + 4 : bandTop;
    const controlsY = controlsTop + free * 0.4 + 52 + stick / 2;
    let panel: TouchLayout["panel"] = null;
    if (options.windowPanel !== false && scale < 1) {
      // 칸은 무대 위쪽부터 메뉴 단추 줄 바로 위까지에 들어간다. 아래(메뉴 단추 쪽)에 붙여 무대 위쪽이 되도록 많이 보이게 한다.
      const menuRowTop = controlsY - stick / 2 - 52;
      const room = { w: availW - 8, h: menuRowTop - 4 - stageTop };
      const panelScale = Math.min(1, room.w / WINDOW_PANEL_WIDTH, room.h / WINDOW_PANEL_HEIGHT);
      if (panelScale > scale) {
        // 높이가 남으면 칸을 아래로 늘린다(최대 400) — 메뉴 명령 줄을 44px 로 벌리고 돈·시간 창까지 들어가게.
        const logicalH = Math.max(WINDOW_PANEL_HEIGHT, Math.min(WINDOW_PANEL_MAX_HEIGHT, Math.floor(room.h / panelScale)));
        const h = logicalH * panelScale;
        panel = {
          top: Math.round(Math.max(stageTop, menuRowTop - 4 - h)),
          left: Math.round(safe.left + (availW - WINDOW_PANEL_WIDTH * panelScale) / 2),
          scale: panelScale,
          height: logicalH,
        };
      }
    }
    const menuRow = Math.ceil(TOUCH_TARGET_MIN / (panel ? panel.scale : scale));
    return { mode: "portrait", scale, stageLeft, stageTop, bandTop, bandBottom, controlsY, gutter: 0, stick, dock, panel, menuRow };
  }
  // 가로(2026-10-25 2판, 사용자 「가로에서 버튼도 잘 안 눌리고 경험도 구림 — 데스크톱과 같은 경험」):
  // 1판은 무대가 화면 높이를 채우고 조작을 무대 위에 반투명하게 겹쳤다 — 조이스틱·B 가 타이틀 메뉴·전투 적·창을 덮었고,
  // 대사·전투·메뉴마다 조작을 옮기거나 옅게 하거나 끄는 규칙이 붙었다. 이제 좌우 칸은 조작 전용이고 무대는 그 사이에 맞춘다.
  // 게임 화면은 데스크톱과 같은 모양 그대로 비율만 맞춰 커지고, 조작은 게임을 한 칸도 덮지 않는다.
  // 칸 폭 = 조작 묶음 폭(A 64 + 틈 4 + B 52 = 120, 조이스틱 104) + 여백. 노치·둥근 모서리(안전 영역)는 칸에 일부만 더한다 —
  // 조작은 안전 영역 안쪽 끝에 붙어도 엄지에 닿는다.
  const stickL = LANDSCAPE_STICK;
  const availH = Math.max(40, height - safe.top - safe.bottom);
  const gutterL = Math.round(LANDSCAPE_GUTTER + safe.left * 0.6);
  const gutterR = Math.round(LANDSCAPE_GUTTER + safe.right * 0.6);
  const availW = Math.max(40, width - gutterL - gutterR);
  const scale = landscapeTouchScale(availW, availH, logicalW, logicalH, scaleMode);
  const stageW = logicalW * scale;
  const stageH = logicalH * scale;
  const stageLeft = Math.round(gutterL + (availW - stageW) / 2);
  const stageTop = Math.round(safe.top + (availH - stageH) / 2);
  const controlsY = safe.top + availH * 0.62;
  return { mode: "landscape", scale, stageLeft, stageTop, bandTop: safe.top, bandBottom: height - safe.bottom, controlsY, gutter: Math.max(gutterL, gutterR), stick: stickL, dock: null, panel: null, menuRow: Math.ceil(TOUCH_TARGET_MIN / scale) };
}

/**
 * 터치 가로 배율: 화면을 채운다. 정수 배율이 채움 배율의 90% 이상이면 정수(도트가 고르다), 아니면 채움 배율 그대로.
 * 폰은 기기 화소가 3배 안팎이라 비정수 배율의 도트 굵기 차이는 기기 화소 1개(3~4 중 1)로 눈에 거의 안 띈다 —
 * 정수 1배로 화면 3분의 1을 비우는 것보다 낫다. fit 정책 프로젝트는 원래대로 채움 배율.
 */
export function landscapeTouchScale(width: number, height: number, logicalW: number, logicalH: number, scaleMode: PlaySurfaceScaleMode): number {
  const contain = Math.min(width / logicalW, height / logicalH);
  if (!(contain > 0)) return 1;
  if (scaleMode === "fit") return contain;
  const whole = Math.floor(contain + 1e-6);
  return whole >= 1 && whole >= contain * 0.9 ? whole : contain;
}

/** 대사 독 끄기(비교·디버그): localStorage 「oprn-dialogue-dock」=0. */
function dialogueDockEnabled(): boolean {
  try { return window.localStorage.getItem("oprn-dialogue-dock") !== "0"; } catch { return true; }
}

/** 세로 창 칸 끄기(비교·디버그): localStorage 「oprn-window-panel」=0. */
function windowPanelEnabled(): boolean {
  try { return window.localStorage.getItem("oprn-window-panel") !== "0"; } catch { return true; }
}

function syncTouchLayout(viewport: HTMLElement, width: number, height: number, resolution: Readonly<PlayResolution>, scaleMode: PlaySurfaceScaleMode): void {
  const safe = readSafeAreaInsets(viewport);
  const layout = calculateTouchLayout(width, height, resolution.width, resolution.height, safe, { scaleMode, dialogueDock: dialogueDockEnabled(), windowPanel: windowPanelEnabled() });
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
  viewport.style.setProperty("--touch-menu-row", cssPx(layout.menuRow));
  viewport.style.setProperty("--touch-safe-left", cssPx(safe.left));
  viewport.style.setProperty("--touch-safe-right", cssPx(safe.right));
  if (layout.dock) {
    // 독은 무대의 자식(대사 창)을 무대 좌표로 옮기고 배율을 되돌려(1/scale) 1배로 그린다 — 값은 무대 좌표(게임 px).
    viewport.dataset.dialogueDock = "true";
    // 폭·높이는 창 자신의 좌표(독 배율로 나눈 게임 px) — 1배 독이면 화면 px 그대로다.
    viewport.style.setProperty("--dock-top", cssPx((layout.dock.top - layout.stageTop) / scale));
    viewport.style.setProperty("--dock-left", cssPx((layout.dock.left - layout.stageLeft) / scale));
    viewport.style.setProperty("--dock-width", cssPx(layout.dock.width / layout.dock.scale));
    viewport.style.setProperty("--dock-height", cssPx(layout.dock.height / layout.dock.scale));
    viewport.style.setProperty("--dock-unscale", String(layout.dock.scale / scale));
    viewport.style.setProperty("--touch-controls-top", cssPx(layout.dock.top + layout.dock.height + 4));
  } else {
    delete viewport.dataset.dialogueDock;
    for (const name of ["--dock-top", "--dock-left", "--dock-width", "--dock-height", "--dock-unscale"]) viewport.style.removeProperty(name);
    viewport.style.setProperty("--touch-controls-top", cssPx(layout.bandTop));
  }
  if (layout.panel) {
    // 창 칸: 무대 자식(ESC 메뉴)은 무대 좌표·배율 되돌림으로, 뷰포트 자식(상점)은 화면 좌표·칸 배율로 옮긴다.
    const p = layout.panel;
    viewport.dataset.windowPanel = "true";
    viewport.style.setProperty("--panel-w", cssPx(WINDOW_PANEL_WIDTH));
    viewport.style.setProperty("--panel-h", cssPx(p.height));
    viewport.style.setProperty("--panel-top", cssPx((p.top - layout.stageTop) / scale));
    viewport.style.setProperty("--panel-left", cssPx((p.left - layout.stageLeft) / scale));
    viewport.style.setProperty("--panel-unscale", String(p.scale / scale));
    viewport.style.setProperty("--panel-scale", String(p.scale));
    viewport.style.setProperty("--panel-cx", cssPx(p.left + (WINDOW_PANEL_WIDTH * p.scale) / 2));
    viewport.style.setProperty("--panel-cy", cssPx(p.top + (p.height * p.scale) / 2));
  } else {
    delete viewport.dataset.windowPanel;
    for (const name of ["--panel-w", "--panel-h", "--panel-top", "--panel-left", "--panel-unscale", "--panel-scale", "--panel-cx", "--panel-cy"]) viewport.style.removeProperty(name);
  }
  // 상점 배치: 창 칸 안이면 칸 크기(320×300 = 작은 배치), 아니면 논리 해상도로 고른다.
  viewport.dataset.shopFit = layout.panel ? "tiny" : shopFitFor(resolution);
  // 가로에서 무대가 조작 칸까지 넓어지면 조작은 무대 위에 반투명하게 겹친다(mobileUi.css).
  const overlay = layout.mode === "landscape" && (layout.stageLeft < layout.gutter - 1 || layout.stageLeft + resolution.width * scale > width - layout.gutter + 1);
  if (overlay) viewport.dataset.touchOverlay = "true";
  else delete viewport.dataset.touchOverlay;
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
