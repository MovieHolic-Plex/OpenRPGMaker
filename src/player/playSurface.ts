import { el } from "@/util/dom";

const PLAY_WIDTH = 320;
const PLAY_HEIGHT = 240;

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
  const scaleX = bounds.width / PLAY_WIDTH;
  const scaleY = bounds.height / PLAY_HEIGHT;
  viewport.style.setProperty("--play-scale-x", String(scaleX));
  viewport.style.setProperty("--play-scale-y", String(scaleY));
  viewport.dataset.scale = `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`;
}
