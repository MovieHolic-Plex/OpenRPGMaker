import { el } from "@/util/dom";
import {
  calculatePlaySurfaceCropMetrics,
  calculatePlaySurfacePlacement,
  calculatePlaySurfaceScale,
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

export function createPlaySurface(resolution: Readonly<PlayResolution> = PLAY_RESOLUTION): PlaySurface {
  const viewport = el("div", {
    class: "play-viewport",
    dataset: { testid: "play-viewport" },
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
  stage.append(phaserContainer);
  viewport.append(stage);

  const resizeObserver = new ResizeObserver(() => syncPlaySurfaceMetrics(viewport, resolution));
  resizeObserver.observe(viewport);
  const animationFrameId = requestAnimationFrame(() => syncPlaySurfaceMetrics(viewport, resolution));

  return {
    viewport,
    stage,
    phaserContainer,
    sync: () => syncPlaySurfaceMetrics(viewport, resolution),
    cleanup: () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
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

function syncPlaySurfaceMetrics(viewport: HTMLElement, resolution: Readonly<PlayResolution>): void {
  const bounds = viewport.getBoundingClientRect();
  const scale = calculatePlaySurfaceScale(bounds.width, bounds.height, resolution.width, resolution.height);
  const crop = calculatePlaySurfaceCropMetrics(bounds.width, bounds.height, scale, resolution.width, resolution.height);
  const placement = calculatePlaySurfacePlacement(bounds.width, bounds.height, scale, resolution.width, resolution.height);
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
  viewport.style.setProperty("--play-stage-top", cssPx(placement.top));
  viewport.dataset.scale = scale.toFixed(3);
}

function cssPx(value: number): string {
  return `${Math.round(value * 1000) / 1000}px`;
}
