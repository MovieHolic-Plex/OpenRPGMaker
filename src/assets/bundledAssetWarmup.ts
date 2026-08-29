// 플레이 시작 전 브라우저 HTTP 캐시에 번들 타일/캐릭셋 이미지를 미리 올려
// "새 게임" 직후 Phaser preload 가 디스크/네트워크를 다시 기다리지 않게 한다.
// Phaser TextureManager 와는 별개 — 씬 생성 시 동일 URL 을 로드하면 캐시 히트만 노린다.

import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  TEX_DIALOGUE_FRAME,
} from "@/assets/bundled";
import { EMOTE_ASSET_PATH } from "@/project/emotes";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import type { Project } from "@/project/types";

const DIALOGUE_FRAME_PATH = "assets/dialogue-frame.png";

let warmPromise: Promise<void> | null = null;
let warmKey = "";

/** 현재 프로젝트에 참조된 번들 이미지 경로(상대 path) 목록. */
export function listBundledPlayAssetPaths(project?: Project): readonly string[] {
  const used = project ? projectReferencedTextureKeys(project) : null;
  const paths = new Set<string>([ASSET_TILESET, DIALOGUE_FRAME_PATH, EMOTE_ASSET_PATH]);

  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
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

  return [...paths];
}

/**
 * 타이틀/시연 실행 진입 시 fire-and-forget 으로 호출한다.
 * 동일 프로젝트 키에 대해 in-flight 를 공유하고, 실패해도 throw 하지 않는다.
 */
export function warmBundledPlayAssets(project?: Project): Promise<void> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve();
  }
  const paths = listBundledPlayAssetPaths(project);
  const key = paths.slice().sort().join("\n");
  if (warmPromise && warmKey === key) return warmPromise;

  warmKey = key;
  warmPromise = Promise.all(paths.map((path) => preloadImage(path)))
    .then(() => undefined)
    .catch(() => undefined);

  return warmPromise;
}

/** 테스트/디버그용 — 워밍 캐시 상태 초기화. */
export function resetBundledPlayAssetWarmup(): void {
  warmPromise = null;
  warmKey = "";
}

function preloadImage(path: string): Promise<void> {
  return new Promise((resolve) => {
    // happy-dom / 일부 테스트 환경에서는 Image onload 가 영원히 안 올 수 있어 상한을 둔다.
    const timeout = globalThis.setTimeout(() => resolve(), 2_000);
    const finish = (): void => {
      globalThis.clearTimeout(timeout);
      resolve();
    };
    try {
      const image = new Image();
      image.onload = finish;
      image.onerror = finish;
      // Vite public/ 루트 기준 절대 경로 — Phaser scene.load.image 와 동일한 URL 공간.
      image.src = path.startsWith("/") || /^https?:/i.test(path) ? path : `/${path}`;
      // 이미 캐시된 경우 complete 가 동기 true 일 수 있다.
      if (image.complete) finish();
    } catch {
      finish();
    }
  });
}

function projectReferencedTextureKeys(project: Project): Set<string> {
  const strings = new Set<string>();
  collectStrings(project, strings);
  const keys = new Set<string>([ASSET_TILESET, TEX_DIALOGUE_FRAME]);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
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

function collectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    // 업로드 바이너리 dataUrl 은 문자열 폭발·오탐 방지용으로 스킵.
    if (key === "uploaded") continue;
    collectStrings(child, out);
  }
}
