import type Phaser from "phaser";
import { ensurePhaser } from "@/app/phaserRuntime";
import type { PlaySession } from "@/project/session";
import { resolvePlayResolution } from "@/project/playResolution";
import { store } from "@/project/store";

export type PlayGameBootOptions = {
  readonly initialEventTestId?: string;
  /** PlayScene preload progress 0..1 (optional UI hook). */
  readonly onPlayLoadProgress?: (ratio: number) => void;
  /** PlayScene create stages for boot UI. */
  readonly onPlayLoadStage?: (stage: "map" | "ready") => void;
  /** Fired when PlayScene.create finishes. */
  readonly onPlaySceneReady?: () => void;
};

export async function createPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: PlayGameBootOptions = {}
): Promise<Phaser.Game> {
  const PhaserRuntime = await ensurePhaser();
  const { PlayScene } = await import("@/player/PlayScene");
  const resolution = resolvePlayResolution(store.getCurrent().system);
  return new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    backgroundColor: "#000",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    scale: {
      mode: PhaserRuntime.Scale.NONE,
      width: resolution.width,
      height: resolution.height,
      parent,
    },
    scene: [PlayScene],
    callbacks: {
      preBoot: (game) => {
        if (initialSession) {
          game.registry.set("initialSession", initialSession);
        }
        if (options.initialEventTestId) {
          game.registry.set("initialEventTestId", options.initialEventTestId);
        }
        if (options.onPlayLoadProgress) {
          game.registry.set("onPlayLoadProgress", options.onPlayLoadProgress);
        }
        if (options.onPlayLoadStage) {
          game.registry.set("onPlayLoadStage", options.onPlayLoadStage);
        }
        if (options.onPlaySceneReady) {
          game.registry.set("onPlaySceneReady", options.onPlaySceneReady);
        }
      },
    },
  });
}
