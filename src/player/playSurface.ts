import { el } from "@/util/dom";

const PLAY_WIDTH = 320;
const PLAY_HEIGHT = 240;
const PLAY_MARGIN = 16;
const MAX_PLAY_SCALE = 6;

export type PlaySurface = {
  readonly viewport: HTMLElement;
  readonly stage: HTMLElement;
  readonly phaserContainer: HTMLElement;
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

  const resizeObserver = new ResizeObserver(() => syncPlayScale(viewport, stage));
  resizeObserver.observe(viewport);
  syncPlayScale(viewport, stage);

  return {
    viewport,
    stage,
    phaserContainer,
    cleanup: () => resizeObserver.disconnect(),
  };
}

function syncPlayScale(viewport: HTMLElement, stage: HTMLElement): void {
  const bounds = viewport.getBoundingClientRect();
  const widthScale = Math.floor(Math.max(PLAY_WIDTH, bounds.width - PLAY_MARGIN) / PLAY_WIDTH);
  const heightScale = Math.floor(Math.max(PLAY_HEIGHT, bounds.height - PLAY_MARGIN) / PLAY_HEIGHT);
  const scale = Math.max(1, Math.min(MAX_PLAY_SCALE, widthScale, heightScale));
  stage.style.setProperty("--play-scale", String(scale));
  viewport.dataset.scale = String(scale);
}
