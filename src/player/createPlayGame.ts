import type Phaser from "phaser";
import { preloadScriptEngine, projectUsesScripts } from "@/player/script/engine";
import { ensurePhaser } from "@/app/phaserRuntime";
import type { PlaySession } from "@/project/session";
import { resolveCameraZoom } from "@/project/cameraZoom";
import { playPixelDensity, smallMapFillDensity } from "@/project/mapViewScale";
import { resolveSmallMapFill } from "@/project/smallMapFill";
import { resolvePlayResolution } from "@/project/playResolution";
import { store } from "@/project/store";
import { importWithRetry } from "@/util/dynamicImport";
import { installRuntimeQaFrames } from "@/player/runtimeQaFrames";
import { PLAY_PIXEL_DENSITY_KEY } from "@/player/runtimeViewScale";

export type PlayGameBootOptions = {
  /** Build textures/map behind the opening without advancing gameplay or audio. */
  readonly initialPresentationPending?: boolean;
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

/**
 * Phaser 의 XHR 그림 처리(ImageFile.onProcess)는 <img>.onload 에서 곧바로 텍스처를 올린다. onload 는 디코드를 기다리지 않아
 * texImage2D 가 메인 스레드에서 큰 칩셋(2048×4256 등)을 풀며 0.4~1초씩 멈췄다 — 오프닝 위에서 그대로 보인 끊김(2026-11-05 폴른 스타·첫사랑 실측).
 * decode() 는 디코드를 다른 스레드에서 끝내 두므로, 끝난 뒤에 올리면 업로드만 남는다. 한 번만 깔다.
 */
function decodeImagesBeforeUpload(PhaserRuntime: typeof Phaser): void {
  type ImageFileProto = { onProcess: () => void; onProcessComplete: () => void; onProcessError: () => void; data: HTMLImageElement; xhrLoader: XMLHttpRequest; crossOrigin?: string; state: number; __oprnDecode?: true };
  const proto = (PhaserRuntime.Loader.FileTypes.ImageFile as unknown as { prototype: ImageFileProto }).prototype;
  if (proto.__oprnDecode) return;
  proto.__oprnDecode = true;
  const PROCESSING = PhaserRuntime.Loader.FILE_PROCESSING;
  proto.onProcess = function (this: ImageFileProto): void {
    this.state = PROCESSING;
    const image = new Image();
    if (this.crossOrigin !== undefined) image.crossOrigin = this.crossOrigin;
    this.data = image;
    const url = URL.createObjectURL(this.xhrLoader.response as Blob);
    image.src = url;
    const finish = (ok: boolean): void => { URL.revokeObjectURL(url); if (ok) this.onProcessComplete(); else this.onProcessError(); };
    // WebKit 등은 멀쩡한 큰 그림에도 decode() 를 거절한다 — 그때는 예전처럼 load 를 기다려 텍스처가 빠지지 않게 한다.
    image.decode().then(() => finish(true), () => {
      if (image.complete) { finish(image.naturalWidth > 0); return; }
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
    });
  };
}

/**
 * Phaser 3 의 setTextureFilter 는 필터만 바꿔도 텍스처 전체를 texImage2D 로 다시 올린다. antialias:false 면 모든 그림이
 * 만들자마자(이미 NEAREST 로 올라간 뒤) setFilter(1) 을 한 번 더 불러, 큰 칩셋이 두 번씩 올라갔다(2026-11-05 폴른 스타 오프닝 중
 * 1.3초 멈춤의 절반). 같은 필터면 다시 올리지 않고, 다르면 파라미터만 바꾼다(픽셀은 그대로다).
 */
function skipFilterReupload(PhaserRuntime: typeof Phaser): void {
  type Wrapper = { webGLTexture: WebGLTexture | null; minFilter: number; magFilter: number };
  type Renderer = { gl: WebGLRenderingContext; glTextureUnits: { units: (Wrapper | null)[]; bind(texture: Wrapper | null, unit: number): void }; setTextureFilter(texture: Wrapper, filter: number): unknown; __oprnFilter?: true };
  const proto = (PhaserRuntime.Renderer.WebGL.WebGLRenderer as unknown as { prototype: Renderer }).prototype;
  if (proto.__oprnFilter) return;
  proto.__oprnFilter = true;
  proto.setTextureFilter = function (this: Renderer, texture: Wrapper, filter: number) {
    const gl = this.gl, glFilter = filter === 0 ? gl.LINEAR : gl.NEAREST;
    if (!texture?.webGLTexture || (texture.minFilter === glFilter && texture.magFilter === glFilter)) return this;
    const current = this.glTextureUnits.units[0] ?? null;
    this.glTextureUnits.bind(texture, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter);
    texture.minFilter = glFilter; texture.magFilter = glFilter;
    if (current) this.glTextureUnits.bind(current, 0);
    return this;
  };
}

let runtimeWarmup: Promise<{ PhaserRuntime: typeof Phaser; PlayScene: typeof import('@/player/PlayScene')['PlayScene'] }> | undefined;
function preparePlayRuntime() {
  // PlayScene reads getLoadedPhaser() during module evaluation; this dependency is ordered.
  return runtimeWarmup ??= ensurePhaser().then(async PhaserRuntime => {
      decodeImagesBeforeUpload(PhaserRuntime);
      skipFilterReupload(PhaserRuntime);
      const { PlayScene } = await importWithRetry(() => import('@/player/PlayScene'));
      return { PhaserRuntime, PlayScene };
    })
    .catch(error => { runtimeWarmup = undefined; throw error; });
}
/** Fetch/parse engine chunks while the title is visible; never creates a game/session. */
export async function warmPlayGameRuntime(): Promise<void> { await preparePlayRuntime(); }

/**
 * 오프닝이 덮고 있는 동안 엔진은 맵을 짓기만 하고 그리지 않는다(update 는 돌고 render 는 건너뛴다).
 * 가려진 WebGL 캔버스를 매 프레임 그리면 합성기가 그 캔버스를 되읽어(소프트웨어 합성 ReadPixels) 오프닝이 프레임마다
 * 50~130ms 씩 끊겼다(2026-11-05 폴른 스타 1.17 실측: 50ms 넘는 프레임 467/512). 넘겨받을 때(pending=false) 원래 step 으로 돌아간다.
 * loop.start 가 texturesReady 에서 this.step 을 묶기 전에(preBoot) 바꿔 끼운다.
 */
export function holdRenderWhilePresentationPending(game: Phaser.Game): void {
  const step = game.step;
  // 맵이 다 지어지면 덮개 뒤에서 딱 한 번 그려 둔다(셰이더·타일 묶음·텍스처 바인딩 준비). 안 그리면 그 일이 오프닝이 끝난 뒤 첫 프레임에
  // 한꺼번에 몰려 넘겨받기가 300ms 멈췄다(2026-11-05 폴른 스타 실측).
  let warmRender = false;
  game.events.once('playscene-ready', () => { warmRender = true; });
  game.step = function (this: Phaser.Game, time: number, delta: number): void {
    if ((this as unknown as { pendingDestroy?: boolean }).pendingDestroy || this.isPaused || this.registry.get('initialPresentationPending') !== true || warmRender) { warmRender = false; step.call(this, time, delta); return; }
    this.events.emit('prestep', time, delta);
    this.events.emit('step', time, delta);
    this.scene.update(time, delta);
    this.events.emit('poststep', time, delta);
  };
}

export async function createPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: PlayGameBootOptions = {}
): Promise<Phaser.Game> {
  const { PhaserRuntime, PlayScene } = await preparePlayRuntime();
  const project = store.getCurrent();
  // `script` commands run in QuickJS-wasm; the interpreter is synchronous, so load it before the first event.
  if (projectUsesScripts(project)) await preloadScriptEngine().catch((error: unknown) => console.error("[script] engine load failed", error));
  const resolution = resolvePlayResolution(project.system);
  // 타일 크기가 섞인 프로젝트는 큰 칸의 맵을 도트 손실 없이 그리도록 캔버스만 촘촘하게 만든다.
  // 캔버스 CSS 는 논리 해상도에 맞춰지므로(playSurface.css) 레이아웃·DOM 좌표는 그대로다.
  // 한 크기뿐인 프로젝트에 작은 방이 있으면 그 방을 정수 캔버스 배율로 화면에 채울 밀도를 고른다(smallMapFillDensity).
  const mixedDensity = playPixelDensity(project, resolution, resolveCameraZoom(project.system));
  const density = mixedDensity > 1 ? mixedDensity : resolveSmallMapFill(project) ? smallMapFillDensity(project, resolution, resolveCameraZoom(project.system)) : 1;
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
        game.registry.set('initialPresentationPending', options.initialPresentationPending === true);
        if (options.initialPresentationPending === true) holdRenderWhilePresentationPending(game);
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
