import type Phaser from "phaser";
import { createPlayGame, type PlayGameBootOptions } from "@/player/createPlayGame";
import type { PlaySession } from "@/project/session";

let currentGame: Phaser.Game | null = null;
// @/app/mode 와 같은 계약 — 부트 도중 destroyGame/새 시작이 스치면 만들어진 게임을
// 입양하지 않고 파괴한다(고아 KeyboardManager 가 window keydown 을 계속 받는 함정).
let gameGeneration = 0;

export type StartPlayGameOptions = PlayGameBootOptions & {
  readonly trackGlobalGame?: boolean;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const tracked = options.trackGlobalGame !== false;
  const generation = tracked ? ++gameGeneration : 0;
  const game = await createPlayGame(parent, initialSession, options);
  if (!tracked) return game;
  if (generation !== gameGeneration) {
    game.destroy(true);
    return game;
  }
  currentGame?.destroy(true);
  currentGame = game;
  return game;
}

export function destroyGame(): void {
  ++gameGeneration;
  currentGame?.destroy(true);
  currentGame = null;
}
