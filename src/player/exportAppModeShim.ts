import type Phaser from "phaser";
import { ensurePhaser } from "@/app/phaserRuntime";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySession } from "@/project/session";

let currentGame: Phaser.Game | null = null;

export type StartPlayGameOptions = {
  readonly trackGlobalGame?: boolean;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  _options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const PhaserRuntime = await ensurePhaser();
  const { PlayScene } = await import("@/player/PlayScene");
  const game = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    backgroundColor: "#000",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    scale: {
      mode: PhaserRuntime.Scale.NONE,
      width: PLAY_RESOLUTION.width,
      height: PLAY_RESOLUTION.height,
      parent,
    },
    scene: [PlayScene],
  });
  currentGame = game;
  if (initialSession) {
    game.registry.set("initialSession", initialSession);
  }
  return game;
}

export function destroyGame(): void {
  currentGame?.destroy(true);
  currentGame = null;
}
