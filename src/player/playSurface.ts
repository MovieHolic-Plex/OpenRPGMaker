import { el } from "@/util/dom";
import { PLAY_RESOLUTION } from "@/player/playResolution";

export type PlaySurface = {
  readonly viewport: HTMLElement;
  readonly stage: HTMLElement;
  readonly phaserContainer: HTMLElement;
  readonly sync: () => void;
  readonly cleanup: () => void;
};

export function createPlaySurface(): PlaySurface {
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
  stage.append(phaserContainer);
  viewport.append(stage);

  const resizeObserver = new ResizeObserver(() => syncPlaySurfaceMetrics(viewport));
  resizeObserver.observe(viewport);
  const animationFrameId = requestAnimationFrame(() => syncPlaySurfaceMetrics(viewport));

  return {
    viewport,
    stage,
    phaserContainer,
    sync: () => syncPlaySurfaceMetrics(viewport),
    cleanup: () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    },
  };
}

function syncPlaySurfaceMetrics(viewport: HTMLElement): void {
  const bounds = viewport.getBoundingClientRect();
  const containScale = Math.min(bounds.width / PLAY_RESOLUTION.width, bounds.height / PLAY_RESOLUTION.height);
  const inFullscreenTestPlay = viewport.closest("[data-testid='test-play-window'][data-window-mode='fullscreen']") !== null;
  const containedScale = containScale >= 1 ? Math.max(1, Math.floor(containScale)) : containScale;
  const scale = inFullscreenTestPlay ? containedScale : Math.min(2, containedScale);
  viewport.style.setProperty("--play-scale", String(scale));
  viewport.style.setProperty("--play-scale-x", String(scale));
  viewport.style.setProperty("--play-scale-y", String(scale));
  viewport.dataset.scale = scale.toFixed(3);
}
