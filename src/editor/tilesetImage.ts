import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  BUNDLED_REFERENCE_CHIPSET_ASSETS,
  registerTilesetTextureFrames,
  TEX_TILESET,
  TILE_FRAME_COUNT,
} from "@/assets/bundled";
import { graftedTilesetImageUrl, setUploadedGraftSourceUrlResolver } from "@/assets/tileGraftImageCache";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { setUploadedGraftGeometryResolver, tileGraftsTextureSuffix, uploadedGraftGeometryIn } from "@/assets/tileGrafts";
import { bakeTilesetTextureCanvas, planTilesetTextureBakeSteps, planTilesetTextureBakeStepsFromKeys, tilesetTextureNeedsBake } from "@/assets/tileGraftTexture";
import { addStagedTexture, stageTextureUpload, type StagedTextureUpload } from "@/assets/tilesetGpuStaging";
import { bakeGraftPlanOffthread, offthreadTilesetBakeAvailable, type OffthreadBakeOptions } from "@/assets/tilesetBakeOffthread";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { isColorKeyedChipsetTextureKey, rawChipsetTextureKey } from "@/assets/chipsetTransparency";
import { INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import { isWorldTileset, isWorldAnimatedTile } from "@/project/defaults/worldCoastMapping";
import { isCombinedTownHalfTile, isCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";
import { isDefaultTilesetTexture, supportsChipsetQuarterComposition, usesCombinedTownWaterBlock } from "@/editor/chipsetComposition";
import { store } from "@/project/store";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { Project, TilesetDef } from "@/project/types";
import type Phaser from "phaser";
import { animationKeyForTile, animationStripForTile } from "@/project/defaults/chipsetAnimation";
import { registerTilesetStripAnimations, registerUploadedTilesetFrames, tilesetStripAnimationName, uploadedTilesetAnimationName, uploadedTilesetTextureKey } from "@/assets/uploadedTilesets";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

/** Graft-free atlas URL (uploaded bytes or bundled path). Editor and evidence share this base. */
export function tilesetBaseImageUrl(tileset: TilesetDef, project?: Project): string {
  const uploaded = tileset.image.type === "uploaded" ? (project ?? store.getCurrent()).assets.uploaded[tileset.image.id] : undefined;
  if (project && tileset.image.type === "uploaded" && !uploaded) throw new Error("map-rendering-unavailable: draft atlas missing");
  if (project && uploaded && !uploadedAssetUrl(uploaded)) throw new Error("map-rendering-unavailable: draft atlas bytes unresolved");
  return withInlineAsset(
    tileset.image.type === "uploaded"
      ? (uploaded ? uploadedAssetUrl(uploaded) : "") || DEFAULT_TILESET_IMAGE_URL
      : bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL,
  );
}

setUploadedGraftGeometryResolver((sourceChipset) => uploadedGraftGeometryIn(store.getCurrent().tilesets, sourceChipset));
setUploadedGraftSourceUrlResolver((textureKey) => {
  const asset = store.getCurrent().assets.uploaded[textureKey];
  const url = asset ? uploadedAssetUrl(asset) : "";
  return url ? withInlineAsset(url) : null;
});

export function tilesetImageUrl(tileset: TilesetDef): string {
  const baseUrl = tilesetBaseImageUrl(tileset);
  // 타일 이식이 있으면 베이크 결과(dataURL)를 반환 — 팔레트/DB 미리보기에도 이식 타일이 보인다.
  // 아직 베이크 전이면 베이스 URL 을 임시 반환(베이크는 예약되어 다음 리렌더에 반영).
  // Evidence rendering must not use this transient fallback; see toolImageCanvas.loadTilesetImage.
  return graftedTilesetImageUrl(tileset, baseUrl) ?? baseUrl;
}

export function tilesetTextureKey(tileset: TilesetDef): string {
  const baseKey = baseTilesetTextureKey(tileset);
  const transparentColor = normalizeRgbHexColor(tileset.transparentColor ?? "");
  const transparentSuffix = transparentColor ? `__transparent_${transparentColor.slice(1)}` : "";
  return `${baseKey}${transparentSuffix}${tileGraftsTextureSuffix(tileset)}`;
}

const BUNDLED_CHIPSET_KEYS: ReadonlySet<string> = new Set([...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS].map((asset) => asset.textureKey));

/**
 * 워커가 미리 구워 둔 아틀라스(텍스처 키별). ensureTilesetTexture 가 등록하면서 꺼낸다.
 * stage 가 있으면 GPU 에 띠씩 올리는 중이거나 다 올린 것이다(tilesetGpuStaging.ts) — 등록만 남는다.
 */
type OffthreadEntry = { readonly bitmap: ImageBitmap; stage?: StagedTextureUpload; readonly game: Phaser.Game };
const offthreadBaked = new Map<string, OffthreadEntry>();
const offthreadPending = new Map<string, Promise<boolean>>();
/** 장소 이동이 기다리는 굽기 — 유휴 굽기 중이었어도 쉬지 않고 이어 간다. */
const offthreadUrgent = new Set<string>();

/** 그림 파일을 그대로 실은 텍스처의 절대 주소 — 워커가 같은 파일을 받아 푼다(loadBundledAssets 와 같은 주소). */
function textureFileUrl(textureKey: string): string | null {
  let path: string | null = null;
  if (textureKey === TEX_TILESET) path = withInlineAsset(ASSET_TILESET);
  else {
    const uploaded = store.getCurrent().assets.uploaded[textureKey];
    if (uploaded) path = uploadedAssetUrl(uploaded) || null;
    else {
      const asset = [...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS].find((candidate) => candidate.textureKey === textureKey);
      // 투명색 키 칩셋은 원본(raw)을 실은 뒤 처리한 캔버스가 텍스처다 — 파일과 픽셀이 달라 주소로 넘기지 않는다.
      if (asset && !isColorKeyedChipsetTextureKey(asset.textureKey)) path = withInlineAsset(asset.path);
    }
  }
  if (!path) return null;
  try { return new URL(path, document.baseURI).href; } catch { return null; }
}

/** 이식 소스 그림판이 아직 안 실렸으면 굽지 않는다(빠진 칸이 든 텍스처가 캐시로 남는다). 이식 목록을 정렬하지 않고 한 번만 훑는다. */
function bakeSourcesMissing(scene: Phaser.Scene, tileset: TilesetDef): boolean {
  const uploaded = store.getCurrent().assets.uploaded;
  const checked = new Set<string>();
  for (const graft of tileset.tileGrafts ?? []) {
    const key = graft?.sourceChipset;
    if (typeof key !== "string" || checked.has(key)) continue;
    checked.add(key);
    // 업로드 그림판에서 이식하는 칸은 그 그림판이 실린 뒤에만 굽는다 — 먼저 구우면 빠진 칸이 든 텍스처가 캐시로 남는다.
    if (uploaded[key] && !scene.textures.exists(key)) return true;
    // 번들 그림판도 같다 — 부팅 뒤에 들어온 이식(장소 가져오기 등)의 소스 칩셋은 ensureBundledProjectTextures 가 뒤늦게 싣는다.
    // 그 전에 구우면 폭포·다리 칸이 빈칸으로 캐시에 남는다(2026-09-25 너울목 가져오기).
    if (BUNDLED_CHIPSET_KEYS.has(key) && !scene.textures.exists(key) && !scene.textures.exists(rawChipsetTextureKey(key))) return true;
  }
  return false;
}

export function ensureTilesetTexture(scene: Phaser.Scene, tileset: TilesetDef): string {
  const textureKey = tilesetTextureKey(tileset);
  if (scene.textures.exists(textureKey)) return textureKey;
  if (!tilesetTextureNeedsBake(tileset)) return textureKey;

  const baseKey = baseTilesetTextureKey(tileset);
  if (bakeSourcesMissing(scene, tileset)) return baseKey;
  // 워커가 먼저 구워 두었으면(prepareTilesetTexture) 올리기만 한다.
  const ready = offthreadBaked.get(textureKey);
  offthreadBaked.delete(textureKey);
  // GPU 에 띠씩 올리던 중이면 남은 띠만 마저 올리고 그 텍스처를 쓴다. GL 텍스처는 그 게임(문맥) 것이라
  // 다른 게임(편집기에서 플레이를 다시 연 경우)이면 버리고 비트맵을 통째로 올린다.
  const sameGame = ready?.game === scene.sys.game;
  const staged = ready?.stage && sameGame && (ready.stage.done || ready.stage.finish()) ? addStagedTexture(scene, textureKey, ready.stage) : null;
  if (ready?.stage && !staged && sameGame) ready.stage.cancel();
  const source = staged ? null : ready?.bitmap ?? bakeTilesetTextureCanvas(scene, tileset, baseKey);
  if (!staged && !source) return baseKey;

  // addCanvas 는 CanvasTexture 를 만들며 캔버스 전체를 getImageData 로 읽는다(버들항 시트 40MB) — 아틀라스는 그 픽셀 사본을
  // 쓰지 않으므로 그림 텍스처로 올린다. Phaser 의 TextureSource 는 캔버스·ImageBitmap 을 그대로 GPU 에 올린다.
  const texture = staged ?? scene.textures.addImage(textureKey, source as unknown as HTMLImageElement);
  if (!texture) return baseKey;

  // 확장 타일셋(count > 480)은 확장분 프레임까지 등록한다(기본 480 은 불변).
  if (tileset.image.type === "uploaded") registerUploadedTilesetFrames(scene, tileset, textureKey);
  else {
    registerTilesetTextureFrames(scene, textureKey, Math.max(TILE_FRAME_COUNT, tileset.count), tileset.tileSize, tileset.tilesPerRow);
    registerTilesetStripAnimations(scene, tileset, textureKey);
  }
  return textureKey;
}

export interface PrepareTilesetOptions extends OffthreadBakeOptions {
  /** 그림판이 아직 안 실렸어도 그림 파일 주소로 굽는다(첫 맵 로딩과 겹치기). tilesetBakeFilesKnown 이 참일 때만. */
  readonly fromFiles?: boolean;
}

/** 베이스와 이식 소스가 모두 그림 파일 그대로라 워커가 주소로 받을 수 있는가. */
export function tilesetBakeFilesKnown(tileset: TilesetDef): boolean {
  if ((tileset.tileGrafts?.length ?? 0) === 0 || normalizeRgbHexColor(tileset.transparentColor ?? "")) return false;
  if (!textureFileUrl(baseTilesetTextureKey(tileset))) return false;
  const checked = new Set<string>();
  for (const graft of tileset.tileGrafts ?? []) {
    const key = graft?.sourceChipset;
    if (typeof key !== "string" || checked.has(key)) continue;
    checked.add(key);
    if (!textureFileUrl(key)) return false;
  }
  return true;
}

/**
 * 이 타일셋의 이식 아틀라스를 워커에서 미리 굽는다(메인 스레드를 막지 않는다). 다 구우면 다음 ensureTilesetTexture 가
 * 올리기만 한다. 굽기가 필요 없거나 이미 올라갔으면 바로 true. 워커를 못 쓰면 false(그때는 ensureTilesetTexture 가 예전처럼 굽는다).
 * options 를 주면 유휴 시간 굽기다 — 계획 세우기를 시간 상한마다 끊는다(tilesetBakeOffthread.ts).
 * 유휴 굽기는 화소 바이트도 받아 GPU 에 띠씩 올려 둔다(tilesetGpuStaging.ts).
 */
export function prepareTilesetTexture(scene: Phaser.Scene, tileset: TilesetDef, options?: PrepareTilesetOptions): Promise<boolean> {
  const textureKey = tilesetTextureKey(tileset);
  if (scene.textures.exists(textureKey) || offthreadBaked.has(textureKey)) return Promise.resolve(true);
  if (!options) offthreadUrgent.add(textureKey);
  const pending = offthreadPending.get(textureKey);
  if (pending) return pending;
  if ((tileset.tileGrafts?.length ?? 0) === 0) return Promise.resolve(!tilesetTextureNeedsBake(tileset));
  const fromFiles = options?.fromFiles === true && tilesetBakeFilesKnown(tileset);
  if (!offthreadTilesetBakeAvailable() || (!fromFiles && bakeSourcesMissing(scene, tileset))) return Promise.resolve(false);
  // 투명색 키 시트는 베이스를 메인 스레드에서 한 번 더 처리한다 — 유휴 굽기에서는 건너뛴다.
  if (options && normalizeRgbHexColor(tileset.transparentColor ?? "")) return Promise.resolve(false);
  const steps = fromFiles
    ? planTilesetTextureBakeStepsFromKeys(tileset, baseTilesetTextureKey(tileset))
    : planTilesetTextureBakeSteps(scene, tileset, baseTilesetTextureKey(tileset));
  if (!steps) return Promise.resolve(false);
  const idle = options?.nextSlice;
  const budget = options?.sliceBudgetMs;
  const sliced = idle ? { ...options, wantPixels: true, nextSlice: () => offthreadUrgent.has(textureKey) ? Promise.resolve() : idle() } : options;
  const finishJob = (): void => { offthreadPending.delete(textureKey); offthreadUrgent.delete(textureKey); };
  const job = bakeGraftPlanOffthread(steps, baseTilesetTextureKey(tileset), textureFileUrl, sliced).then(async (baked) => {
    if (!baked) { finishJob(); return false; }
    // 그사이 메인 스레드가 먼저 구웠으면(대기 상한을 넘긴 이동) 버린다.
    if (scene.textures.exists(textureKey)) { baked.bitmap.close(); finishJob(); return true; }
    const entry: OffthreadEntry = { bitmap: baked.bitmap, game: scene.sys.game };
    offthreadBaked.set(textureKey, entry);
    // 유휴 굽기는 GPU 올리기도 띠씩 나눈다 — 통째로 올리면 그 한 번이 플레이 중 끊김이 된다.
    const stage = idle && budget !== undefined && baked.pixels
      ? stageTextureUpload(scene, baked.bitmap, baked.pixels, baked.bitmap.width, baked.bitmap.height)
      : null;
    if (stage && idle && budget !== undefined) {
      entry.stage = stage;
      while (!stage.done && !stage.cancelled && offthreadBaked.get(textureKey) === entry) {
        // 게임이 닫혔으면 그만둔다(문맥과 함께 GL 텍스처도 사라진다).
        if (!scene.sys.game || (scene.sys.game as { pendingDestroy?: boolean }).pendingDestroy) { delete entry.stage; break; }
        // 장소 이동이 이 텍스처를 기다리면 남은 띠를 한 번에.
        if (offthreadUrgent.has(textureKey)) { stage.finish(); break; }
        stage.step(budget);
        if (!stage.done) await idle();
      }
      if (stage.cancelled && offthreadBaked.get(textureKey) === entry) delete entry.stage;
    }
    finishJob();
    return true;
  }, () => { finishJob(); return false; });
  offthreadPending.set(textureKey, job);
  return job;
}

/** 이 타일셋의 미리 굽기를 서두르게 한다 — 남은 계획·GPU 띠를 쉬지 않고 이어 간다(첫 맵 로딩이 이것만 남았을 때). */
export function hurryTilesetTexture(tileset: TilesetDef): void {
  const textureKey = tilesetTextureKey(tileset);
  if (offthreadPending.has(textureKey)) offthreadUrgent.add(textureKey);
}

/** 굽기에 쓸 그림판(베이스·이식 소스)이 다 실렸는가. */
export function tilesetBakeSourcesLoaded(scene: Phaser.Scene, tileset: TilesetDef): boolean {
  const baseKey = baseTilesetTextureKey(tileset);
  return scene.textures.exists(baseKey) && !bakeSourcesMissing(scene, tileset);
}

export { isDefaultTilesetTexture, supportsChipsetQuarterComposition };

/**
 * Interior fire and ungrafted World strips animate without enabling town road/tree rules.
 * The combined-town + retro-world sheet animates only its combined-town half (same tile ids,
 * same water strips); the retro-world half stays still exactly like the standalone retro-world sheet.
 */
export function supportsChipsetTileAnimation(tileset: TilesetDef, tile: number): boolean {
  return isDefaultTilesetTexture(tileset)
    || (isCombinedTownRetroWorldTileset(tileset) && isCombinedTownHalfTile(tile))
    || (isWorldTileset(tileset) && isWorldAnimatedTile(tile, tileset))
    || (usesCombinedTownWaterBlock(tileset) && animationStripForTile(tile)?.key.startsWith("chipset_tile_") === true)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY
      && animationStripForTile(tile)?.baseTile === 124);
}

function baseTilesetTextureKey(tileset: TilesetDef): string {
  return tileset.image.type === "bundled" ? tileset.image.id : uploadedTilesetTextureKey(tileset);
}

/** The renderer and the preload registry must agree on project-authored animation names. */
export function tilesetAnimationKeyForTile(tileset: TilesetDef, tile: number): string | null {
  return uploadedTilesetAnimationName(tileset, tile)
    ?? (tileset.image.type === "bundled" ? tilesetStripAnimationName(tileset, tile) : null)
    ?? (supportsChipsetTileAnimation(tileset, tile) ? animationKeyForTile(tile) : null);
}

export function tilesetCssImageValue(imageUrl: string): string {
  return cssUrl(imageUrl);
}

export function tilesetTileBackgroundStyle(
  tileset: TilesetDef,
  tile: number,
  previewSize: number | string,
  imageUrl = tilesetImageUrl(tileset),
  imageVariable?: string,
): string {
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  const cellSize = previewSizeCss(previewSize);
  return [
    imageVariable ? `background-image:var(${imageVariable})` : `background-image:${cssUrl(imageUrl)}`,
    `background-size:calc(${tileset.tilesPerRow} * ${cellSize}) auto`,
    `background-position:calc(${-column} * ${cellSize}) calc(${-row} * ${cellSize})`,
  ].join(";");
}

function previewSizeCss(previewSize: number | string): string {
  return typeof previewSize === "number" ? `${previewSize}px` : previewSize;
}

/** 타일셋에 붙이기 전 후보 그래픽의 URL — 그래픽 고르기 미리보기가 쓴다. */
export function tilesetImageSourceUrl(image: TilesetDef["image"]): string {
  if (image.type === "uploaded") {
    const asset = store.getCurrent().assets.uploaded[image.id];
    return withInlineAsset(asset ? uploadedAssetUrl(asset) || DEFAULT_TILESET_IMAGE_URL : DEFAULT_TILESET_IMAGE_URL);
  }
  return withInlineAsset(bundledTilesetImageUrl(image.id) ?? DEFAULT_TILESET_IMAGE_URL);
}

function bundledTilesetImageUrl(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return DEFAULT_TILESET_IMAGE_URL;
  const asset = [...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS]
    .find((candidate) => candidate.textureKey === textureKey);
  return asset ? `/${asset.path}` : null;
}

function cssUrl(url: string): string {
  return `url("${url.replaceAll("\"", "\\\"")}")`;
}
