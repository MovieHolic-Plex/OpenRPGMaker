import type Phaser from "phaser";
import { createPlayGame, type PlayGameBootOptions } from "@/player/createPlayGame";
import type { PlaySession } from "@/project/session";

let currentGame: Phaser.Game | null = null;

export type StartPlayGameOptions = PlayGameBootOptions & {
  readonly trackGlobalGame?: boolean;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const game = await createPlayGame(parent, initialSession, options);
  if (options.trackGlobalGame !== false) {
    currentGame = game;
  }
  return game;
}

export function destroyGame(): void {
  currentGame?.destroy(true);
  currentGame = null;
}
