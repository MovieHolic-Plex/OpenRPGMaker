import { charsetBattler, RETRO_FALLBACK_PARTY_BATTLERS, resolvePartyBattleCharset } from "@/assets/charsetBattlers";
import { BATTLE_SCENERY_CATALOG } from "@/assets/battleSceneryCatalog";
import { findOpeningStillPackEntry } from "@/assets/openingStillPackRuntime";
import { openingStillPackUrl } from "@/assets/openingStillPackCdn";
import { BUNDLED_IMAGE_ASSETS, TEX_DIALOGUE_FRAME, TEX_TILESET } from "@/assets/bundled";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { sharedPortraitExpressionSiblings } from "@/assets/sharedPortraitAssets";
import { DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID } from "./cinematicSettings";
import { battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { pixelEnemySheet } from "@/assets/pixelEnemySheets";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { bgmTrackUrl } from "@/assets/bgmCdn";
import { BATTLER_PLACEMENTS } from "@/battle/battlerPlacements";
import { skinPartySpriteUrl } from "@/battle/partySpriteResources";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceKind } from "@/project/types";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import type { Project } from "@/project/types";
import type { WebExportAsset } from "@/project/webExportTypes";
import { CASTLE_REFERENCE_TILESET_TEXTURE_KEY, CASTLE_TILESET_TEXTURE_KEY, LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY } from "./defaults/constants";

const encoder = new TextEncoder();

export function collectWebExportAssets(project: Project): readonly WebExportAsset[] {
  const ids = collectProjectStrings(project);
  // These backgrounds are selected by battleBackdrop at runtime, so they need
  // not appear in an authored troop or terrain row. Export their real bytes.
  if (project.system.battleUiStyle === "pokemon") ids.add("battle-skin-pokemon-backdrop");
  if (Object.values(project.maps).some((map) => map.climate?.mode === "fixed" && map.climate.weather === "snow")) {
    ids.add("scarloxy-backdrop-ice");
  }
  // 공용 흉상·전신은 대사의 표정에 따라 런타임이 같은 모양의 다른 표정 그림으로 바꾼다 — 참조된 모양의 5표정을 같이 싣는다.
  for (const id of [...ids]) for (const sibling of sharedPortraitExpressionSiblings(id)) ids.add(sibling);
  const usedUploadedIds = collectUsedUploadedAssetIds(project);
  const assets = new Map<string, WebExportAsset>();
  for (const path of requiredRuntimeAssetPaths(project)) {
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  if (getBattleSkin(resolveSkinId(project.system.battleUiStyle)).scenery === "layered") {
    // 겹 배경 5지형 × 4레이어는 저장소에 커밋된 번들 그림이다(public/assets/generated/battle-scenery).
    // 지형은 전투마다 위치·기후로 정해지므로 전부 싣는다(약 1.3MB).
    for (const entry of BATTLE_SCENERY_CATALOG) {
      for (const path of Object.values(entry.layers)) {
        assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
      }
    }
  }
  // 종류 id(battle-scenery-*)의 단일 그림 — 몬스터 대치에서 이 id 를 고르면 이 한 장을 깐다(다섯 장 약 35KB).
  for (const entry of BATTLE_SCENERY_CATALOG) {
    assets.set(entry.preview, { kind: "public", sourcePath: entry.preview, zipPath: entry.preview });
  }
  for (const asset of BUNDLED_IMAGE_ASSETS) {
    if (asset.textureKey === TEX_TILESET || asset.textureKey === TEX_DIALOGUE_FRAME || ids.has(asset.textureKey)) {
      assets.set(asset.path, {
        kind: "public",
        sourcePath: asset.path,
        zipPath: asset.path,
        resourceId: asset.textureKey,
      });
    }
  }
  if ([...ids].some((id) => charsetBattler(id))) {
    const path = "assets/easyrpg/AUTHORS.md";
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  for (const id of ids) {
    const charset = charsetBattler(id);
    if (charset) {
      // The caster's element-specific pose sheet is selected at runtime, never stored in the actor row.
      assets.set(charset.castPath, {
        kind: "public", sourcePath: charset.castPath, zipPath: charset.castPath,
        resourceId: `${charset.resourceId}-cast`,
      });
    }
    const idle = battlerIdleAnimation(id);
    if (idle) assets.set(idle.path, { kind: "public", sourcePath: idle.path, zipPath: idle.path });
    // 도트 측면 전투의 적 도트 시트도 경로로만 참조된다(pixelEnemySheets.ts) — 같은 id 면 함께 싣는다.
    const pixelSheet = pixelEnemySheet(id);
    if (pixelSheet) assets.set(pixelSheet.path, { kind: "public", sourcePath: pixelSheet.path, zipPath: pixelSheet.path });
    const bundled = BUNDLED_IMAGE_ASSETS.find((asset) => asset.textureKey === id);
    if (bundled) {
      assets.set(bundled.path, { kind: "public", sourcePath: bundled.path, zipPath: bundled.path, resourceId: id });
      continue;
    }
    const url = resolveAssetResourceUrl(id, { project });
    // The editor may stream catalog music from a CDN; the shipped player uses its local path.
    const catalogTrack = findBgmRuntimeEntry(id);
    const catalogStill = findOpeningStillPackEntry(id);
    const path = localPublicPath(catalogTrack ? bgmTrackUrl(catalogTrack.fileName, {})
      : catalogStill ? openingStillPackUrl(catalogStill.fileName, {}) : url);
    if (path && url) assets.set(path, { kind: "public", sourcePath: localPublicPath(url) ?? url, zipPath: path, resourceId: id });
  }
  for (const id of usedUploadedIds) {
    const asset = project.assets.uploaded[id];
    if (!asset) continue;
    const zipPath = `assets/uploaded/${safeFileName(asset.id)}.${asset.ref ? asset.ref.extension : uploadedAssetExtension(asset.dataUrl ?? "")}`;
    assets.set(zipPath, { kind: "uploaded", asset, zipPath });
  }
  if (ids.has(CASTLE_TILESET_TEXTURE_KEY)) {
    const path = "assets/opengameart-castle-tiles-CREDITS.txt";
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  if (ids.has(CASTLE_REFERENCE_TILESET_TEXTURE_KEY)) {
    const path = "assets/opengameart-castle-reference-composite-CREDITS.txt";
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  if (ids.has(LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY)) {
    const path = "assets/opengameart-lpc-wooden-furniture-CREDITS.txt";
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  if (ids.has('tex_harbor_kit')) {
    const path = 'assets/harbor-kit/CREDITS.txt';
    assets.set(path, { kind: 'public', sourcePath: path, zipPath: path });
  }
  if (ids.has('castle_courtyard_harbor_atlas')) {
    const path = 'assets/castle-surroundings/CREDITS.txt';
    assets.set(path, { kind: 'public', sourcePath: path, zipPath: path });
  }
  // 저작자 표기 정본. CC BY 계열 기본 에셋(EasyRPG RTP 등)은 번들 여부와 무관하게 표기 의무가
  // 따라오므로 조건부로 돌리지 않는다 — 타이틀 화면의 라이선스 표기도 이 파일을 연다.
  assets.set("assets/ATTRIBUTION.md", { kind: "public", sourcePath: "assets/ATTRIBUTION.md", zipPath: "assets/ATTRIBUTION.md" });
  return [...assets.values()].sort((left, right) => left.zipPath.localeCompare(right.zipPath));
}

export function collectUsedUploadedAssetIds(project: Project): Set<string> {
  const ids = collectProjectStrings(project);
  const uploaded = new Set<string>();
  for (const id of Object.keys(project.assets.uploaded)) {
    if (ids.has(id)) uploaded.add(id);
  }
  return uploaded;
}

export function estimateAssetBytes(asset: WebExportAsset): number {
  return asset.kind === "uploaded" ? (asset.asset.ref ? asset.asset.ref.bytes : dataUrlBytes(asset.asset.dataUrl ?? "").length) : 0;
}

export function exportAssetSourceUrl(sourcePath: string): string {
  return /^https?:\/\//i.test(sourcePath) ? sourcePath : `/${sourcePath.replace(/^\//, "")}`;
}

export function invalidExportDependencyBytes(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  return bytes.length === 0 || /^(?:<!doctype\s+html\b|<(?:html|head|body)\b)/i.test(prefix);
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return encoder.encode(dataUrl);
  const meta = dataUrl.slice(0, comma).toLowerCase();
  const body = dataUrl.slice(comma + 1);
  if (meta.endsWith(";base64")) return base64ToBytes(body);
  return encoder.encode(decodeURIComponent(body));
}

export function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return safe || "oprn";
}

// 바이너리 dataUrl 문자열 폭발·오탐 방지(기존).
const USAGE_WALK_SKIPPED_KEYS: readonly string[] = ["uploaded"];

// resourceProfiles 는 저작자가 고를 수 있는 리소스 **카탈로그** 다 — 「쓸 수 있는 것」 이지
// 「쓰는 것」 이 아니다. 그래서 오디오 행만 사용처 집계에서 뺀다.
//
// - 오디오: 빈 프로젝트에 100개 20.2MB 가 등록돼 있는데 실제 재생은 두 트랙뿐이다. 진짜 재생은
//   system.defaultBgmResourceId 처럼 별도 필드에 박혀 있어 그쪽에서 잡힌다.
// - 이미지: 그대로 센다. webExportFacesetFaces.test.ts 가 "등록만 하고 대사에 안 쓴 얼굴도
//   함께 나간다" 를 현재 계약으로 못 박아 뒀고, 그 이유("저작 중 고른 얼굴이 빠지는 사고를
//   막는다")가 타당하다. 전량이 0.37MB 라 이걸 뒤집어 벌 이득도 없다.
//
// 어느 쪽이든 카탈로그 행 자체는 project.json 에 그대로 남으므로 id→파일 해석은 계속 동작한다.
const USAGE_WALK_CATALOG_KEY = "resourceProfiles";

function collectProjectStrings(project: Project): Set<string> {
  const values = new Set<string>();
  if ([project.system.gameOver, ...(project.system.gameOvers ?? []).map(row => row.settings)].some(settings => !settings?.backgroundResourceId)) values.add(DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID);
  collectStrings({ ...project, audioDescriptions: undefined, monsterMetadata: undefined }, values);
  // This resource is read only by the persistent confirm-page portrait controller.
  // Keep it explicit even if export's general project-string walk changes later.
  if (project.meta.oprnOpeningBook?.portraitMotion?.resourceId) values.add(project.meta.oprnOpeningBook.portraitMotion.resourceId);
  // Party menus resolve a separately authored sibling icon at runtime. Retain
  // those indirect dependencies when pruning uploaded assets for publication.
  if (isEmeraldMonsterStyle(project)) for (const species of project.database.monsterSpecies ?? []) {
    const front = species.graphic.monsterResourceId;
    const icon = front?.replace(/_front$/u, '_icon');
    if (icon && icon !== front && project.assets.uploaded[icon]) values.add(icon);
  }
  // Trainer portraits are resolved from the event's shared charset slot at runtime.
  // Their resource IDs are implicit, just like sibling party icons.
  if (isEmeraldMonsterStyle(project) && ['oprn_emerald_field_cast_1', 'oprn_emerald_field_cast_2'].some(id => values.has(id))) {
    for (const [id, asset] of Object.entries(project.assets.uploaded)) {
      if (id.startsWith('oprn_emerald_trainer_') && asset.kind === 'picture' &&
          asset.meta.width === 64 && (asset.meta.height === 64 || asset.meta.height === 96)) values.add(id);
    }
  }
  // 소스에 박힌 재생 — 프로젝트 문자열에는 없지만 플레이어가 반드시 읽는다.
  for (const id of PLAYER_RUNTIME_AUDIO_RESOURCE_IDS) values.add(id);
  const skinId = resolveSkinId(project.system.battleUiStyle);
  const facing = BATTLER_PLACEMENTS[skinId].partyFacing;
  // Include reserve actors too: party membership/order can change after export.
  for (const actor of project.database.actors) {
    if (facing === "front") {
      const retro = getBattleSkin(skinId).motionStyle === "retro";
      const sheet = resolvePartyBattleCharset(actor, retro);
      if (sheet) { values.add(sheet); continue; }
      // 칩 대응이 없으면 자리 순서에 따라 두 기본 도트 중 하나가 선다 — 파티 순서는 내보낸 뒤에도 바뀐다.
      if (retro) { for (const fallback of RETRO_FALLBACK_PARTY_BATTLERS) values.add(fallback); continue; }
    }
    // Either fallback slot can be selected after reordering the party.
    for (const index of [0, 1]) {
      const sprite = skinPartySpriteUrl(project, skinId, index, facing, actor);
      if (sprite) values.add(sprite.resourceId);
    }
  }
  return values;
}

export function isAudioCatalogRow(row: unknown): boolean {
  if (typeof row !== "object" || row === null) return false;
  const kind = (row as { readonly kind?: unknown }).kind;
  // 모르는 kind 는 getResourceProfileSpec 이 이미지 스펙으로 떨어뜨린다 — 안전한 쪽 기본값.
  return typeof kind === "string" && getResourceProfileSpec(kind as ResourceKind).media === "audio";
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
    if (USAGE_WALK_SKIPPED_KEYS.includes(key)) continue;
    if (key === USAGE_WALK_CATALOG_KEY && Array.isArray(child)) {
      collectStrings(child.filter((row) => !isAudioCatalogRow(row)), out);
      continue;
    }
    collectStrings(child, out);
  }
}

function localPublicPath(url: string | null): string | null {
  if (!url?.startsWith("/")) return null;
  const path = url.slice(1);
  return path.includes("://") || path.includes("..") ? null : path;
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== "function") return encoder.encode(value);
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function uploadedAssetExtension(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  const media = dataUrl.slice(0, comma >= 0 ? comma : dataUrl.length).toLowerCase();
  if (media.includes("image/jpeg")) return "jpg";
  if (media.includes("image/webp")) return "webp";
  if (media.includes("image/gif")) return "gif";
  if (media.includes("video/mp4")) return "mp4";
  if (media.includes("video/webm")) return "webm";
  if (media.includes("video/ogg")) return "ogv";
  if (media.includes("audio/mpeg")) return "mp3";
  if (media.includes("audio/wav")) return "wav";
  if (media.includes("audio/ogg")) return "ogg";
  return "png";
}
