// 플레이 시작 전 브라우저 HTTP 캐시에 번들 타일/캐릭셋 이미지를 미리 올려
// "새 게임" 직후 Phaser preload 가 디스크/네트워크를 다시 기다리지 않게 한다.
// Phaser TextureManager 와는 별개 — 씬 생성 시 동일 URL 을 로드하면 캐시 히트만 노린다.

import {
  ASSET_TILESET,
  BUNDLED_REFERENCE_CHIPSET_ASSETS,
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  collectPlayReferencedStrings,
  TEX_DIALOGUE_FRAME,
} from "@/assets/bundled";
import { hasInlineAssets } from "@/assets/inlineAssetStore";
import { imageWarmSupported, warmImageUrls } from "@/assets/imageWarmQueue";
import { resolveAssetResourceUrl } from './generatedAssetResourceResolver';
import { EASYRPG_PICTURE_ASSETS } from './easyrpgRtp';
import { EMOTE_ASSET_PATH } from "@/project/emotes";

import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import type { Project } from "@/project/types";

const DIALOGUE_FRAME_PATH = "assets/dialogue-frame.png";

let warmPromise: Promise<void> | null = null;
let warmKey = "";

/** 현재 프로젝트에 참조된 번들 이미지 경로(상대 path) 목록. */
export function listBundledPlayAssetPaths(project?: Project): readonly string[] {
  const referenced = project ? collectPlayReferencedStrings(project) : null;
  const used = referenced ? projectReferencedTextureKeys(referenced) : null;
  const paths = new Set<string>([ASSET_TILESET, DIALOGUE_FRAME_PATH, EMOTE_ASSET_PATH]);

  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (used && !used.has(asset.textureKey)) continue;
    paths.add(asset.path);
  }
  for (const asset of BUNDLED_REFERENCE_CHIPSET_ASSETS) {
    if (used && !used.has(asset.textureKey)) continue;
    paths.add(asset.path);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (used && !used.has(asset.textureKey)) continue;
    paths.add(asset.path);
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (used && !used.has(asset.id)) continue;
    paths.add(asset.path);
  }

  // Authored uploads and investigated objects were absent from the old bundle-only warmup.
  if (project && referenced) {
    const cinematicIds = new Set([project.system.titleScreen?.backgroundResourceId, ...(project.system.opening?.scenes ?? []).flatMap(scene => scene.kind === "image" ? [scene.resourceId, ...(scene.direction?.layers?.map(layer => layer.resourceId) ?? [])] : [])]);
    for (const asset of Object.values(project.assets.uploaded)) {
      if (!['charset', 'monster', 'picture', 'backdrop', 'tileset'].includes(asset.kind)) continue;
      if (!referenced.has(asset.id) || cinematicIds.has(asset.id)) continue;
      const url = resolveAssetResourceUrl(asset.id, { project });
      if (url) paths.add(url);
    }
    for (const asset of EASYRPG_PICTURE_ASSETS) if (referenced.has(asset.id)) paths.add(asset.path);
    // Existing resource resolver also owns bundled investigation icons.
    for (const id of referenced) {
      if (!id.startsWith('cc0-')) continue;
      const url = resolveAssetResourceUrl(id, { project });
      if (url && /\.(png|webp|jpe?g)(?:[?#]|$)/iu.test(url)) paths.add(url);
    }
  }

  return [...paths];
}

/**
 * 타이틀/시연 실행 진입 시 fire-and-forget 으로 호출한다.
 * 동일 프로젝트 키에 대해 in-flight 를 공유하고, 실패해도 throw 하지 않는다.
 */
export function warmBundledPlayAssets(project?: Project): Promise<void> {
  if (!imageWarmSupported()) {
    return Promise.resolve();
  }
  // 단일 HTML 빌드는 그림이 이미 문서 안 data URL 이다. 워밍은 이득이 없고(HTTP 캐시를 노리는
  // 최적화다) file:// 에서는 원본 경로를 그대로 때려 ERR_FILE_NOT_FOUND 만 36건 찍는다.
  if (hasInlineAssets()) {
    return Promise.resolve();
  }
  const paths = listBundledPlayAssetPaths(project);
  const key = paths.slice().sort().join("\n");
  if (warmPromise && warmKey === key) return warmPromise;

  warmKey = key;
  warmPromise = warmImageUrls(paths, { concurrency: 2, priority: 'low' }).catch(() => undefined);

  return warmPromise;
}

/** 테스트/디버그용 — 워밍 캐시 상태 초기화. */
export function resetBundledPlayAssetWarmup(): void {
  warmPromise = null;
  warmKey = "";
}

function projectReferencedTextureKeys(strings: Set<string>): Set<string> {
  const keys = new Set<string>([ASSET_TILESET, TEX_DIALOGUE_FRAME]);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of BUNDLED_REFERENCE_CHIPSET_ASSETS) {
    if (strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (strings.has(asset.id) || strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (strings.has(asset.id)) keys.add(asset.id);
  }
  return keys;
}
