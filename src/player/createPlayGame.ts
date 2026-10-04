import type Phaser from "phaser";
import { ensurePhaser } from "@/app/phaserRuntime";
import type { PlaySession } from "@/project/session";
import { resolveCameraZoom } from "@/project/cameraZoom";
import { playPixelDensity } from "@/project/mapViewScale";
import { resolvePlayResolution } from "@/project/playResolution";
import { store } from "@/project/store";
import { importWithRetry } from "@/util/dynamicImport";
import { installRuntimeQaFrames } from "@/player/runtimeQaFrames";
import { PLAY_PIXEL_DENSITY_KEY } from "@/player/runtimeViewScale";

export type PlayGameBootOptions = {
  /** Enables export-player QA locators and mutation hooks. Never enabled by normal export boot. */
  readonly qaInstrumentation?: boolean;
  /** Keyboard-only play disables Phaser's independent mouse/touch input managers. */
  readonly keyboardOnly?: boolean;
  readonly initialEventTestId?: string;
  /** PlayScene preload progress 0..1 (optional UI hook). */
  readonly onPlayLoadProgress?: (ratio: number) => void;
  /** PlayScene create stages for boot UI. */
  readonly onPlayLoadStage?: (stage: "map" | "ready") => void;
  /** Fired when PlayScene.create finishes. */
  readonly onPlaySceneReady?: () => void;
};

let runtimeWarmup: Promise<{ PhaserRuntime: typeof Phaser; PlayScene: typeof import('@/player/PlayScene')['PlayScene'] }> | undefined;
function preparePlayRuntime() {
  return runtimeWarmup ??= Promise.all([ensurePhaser(), importWithRetry(() => import('@/player/PlayScene'))])
    .then(([PhaserRuntime, { PlayScene }]) => ({ PhaserRuntime, PlayScene }))
    .catch(error => { runtimeWarmup = undefined; throw error; });
}
/** Fetch/parse engine chunks while the title is visible; never creates a game/session. */
export async function warmPlayGameRuntime(): Promise<void> { await preparePlayRuntime(); }

export async function createPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: PlayGameBootOptions = {}
): Promise<Phaser.Game> {
  const { PhaserRuntime, PlayScene } = await preparePlayRuntime();
  const project = store.getCurrent();
  const resolution = resolvePlayResolution(project.system);
  // 타일 크기가 섞인 프로젝트는 큰 칸의 맵을 도트 손실 없이 그리도록 캔버스만 촘촘하게 만든다.
  // 캔버스 CSS 는 논리 해상도에 맞춰지므로(playSurface.css) 레이아웃·DOM 좌표는 그대로다.
  const density = playPixelDensity(project, resolution, resolveCameraZoom(project.system));
  return new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    backgroundColor: "#000",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    input: options.keyboardOnly === false
      ? undefined
      : { mouse: false, touch: false },
    scale: {
      mode: PhaserRuntime.Scale.NONE,
      width: resolution.width * density,
      height: resolution.height * density,
      parent,
    },
    scene: [PlayScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set(PLAY_PIXEL_DENSITY_KEY, density);
        if (options.qaInstrumentation === true) {
          game.registry.set("qaInstrumentation", true);
          installRuntimeQaFrames(game);
        }
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
