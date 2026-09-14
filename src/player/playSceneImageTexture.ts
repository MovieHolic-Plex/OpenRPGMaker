import type Phaser from "phaser";

/**
 * 실행 중인 씬에 이미지 텍스처를 **한 번만** 실어 주는 로더.
 *
 * 왜 필요한가: `preload` 는 부팅 때 한 번뿐이고(`loadBundledAssets`), 프로젝트가 참조하는
 * 그림을 전부 미리 실을 수는 없다. `scene.load.image` 에 같은 키를 두 번 넣으면 로더가
 * 거부하므로, 진행 중인 약속을 **씬별로** 들고 있다가 같은 키의 두 번째 요청에는 그 약속을
 * 돌려준다(씬마다 따로 두는 이유: 전역 맵이면 A 씬의 로드 결과를 B 씬이 받는다).
 */
type SceneImageHost = {
  readonly textures: Pick<Phaser.Textures.TextureManager, "exists">;
  readonly load: Pick<Phaser.Loader.LoaderPlugin, "image" | "once" | "off" | "on" | "start" | "isLoading">;
};

const pendingLoads = new WeakMap<object, Map<string, Promise<string | undefined>>>();

/** 성공하면 그 텍스처 키를, 로드 실패면 `undefined` 를 돌려준다(예외를 던지지 않는다). */
export function ensureSceneImageTexture(
  scene: SceneImageHost,
  textureKey: string,
  url: string,
): Promise<string | undefined> {
  if (scene.textures.exists(textureKey)) return Promise.resolve(textureKey);
  const inFlight = pendingLoads.get(scene) ?? new Map<string, Promise<string | undefined>>();
  pendingLoads.set(scene, inFlight);
  const existing = inFlight.get(textureKey);
  if (existing) return existing;

  const promise = new Promise<string | undefined>((resolve) => {
    const finish = (): void => {
      scene.load.off(`filecomplete-image-${textureKey}`, onComplete);
      scene.load.off("loaderror", onError);
      inFlight.delete(textureKey);
    };
    const onComplete = (): void => {
      finish();
      resolve(textureKey);
    };
    const onError = (file: { readonly key?: string }): void => {
      if (file.key !== textureKey) return;
      finish();
      resolve(undefined);
    };
    scene.load.once(`filecomplete-image-${textureKey}`, onComplete);
    scene.load.on("loaderror", onError);
    scene.load.image(textureKey, url);
    if (!scene.load.isLoading()) scene.load.start();
  });
  inFlight.set(textureKey, promise);
  return promise;
}
