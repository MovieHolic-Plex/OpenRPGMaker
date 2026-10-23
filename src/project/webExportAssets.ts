import { charsetBattler, RETRO_FALLBACK_PARTY_BATTLERS, resolvePartyBattleCharset } from "@/assets/charsetBattlers";
import { BATTLE_SCENERY_CATALOG } from "@/assets/battleSceneryCatalog";
import { findOpeningStillPackEntry } from "@/assets/openingStillPackRuntime";
import { openingStillPackUrl } from "@/assets/openingStillPackCdn";
import { BUNDLED_IMAGE_ASSETS, TEX_DIALOGUE_FRAME, TEX_TILESET } from "@/assets/bundled";
import { isKnownRetiredResource, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { sharedPortraitExpressionSiblings } from "@/assets/sharedPortraitAssets";
import { DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID } from "./cinematicSettings";
import { battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { bundledPixelEnemySheet } from "@/assets/pixelEnemySheets";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { bgmTrackUrl } from "@/assets/bgmCdn";
import { BATTLER_PLACEMENTS } from "@/battle/battlerPlacements";
import { skinPartySpriteUrl } from "@/battle/partySpriteResources";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { isTrainerPictureSize } from "@/player/trainerPictureSize";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";
import { monsterSfxRuntimeResourceIds } from "@/assets/monsterSfxAssets";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceKind } from "@/project/types";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { PLACEABLE_OVERLAY_TEXTURE_KEYS } from "@/player/placeableOverlayGraphics";
import { RETRO_PIXEL_FX_KEYS, RETRO_PIXEL_FX_SOUNDS, retroPixelFxResourceId } from "@/assets/retroPixelAnimations";
import { retroTimelineSoundIds } from "@/battle/retroSkillTimeline";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";
import type { WebExportAsset } from "@/project/webExportTypes";
import { webUploadedAssetPath } from './webUploadedAssetPath';
export { safeFileName } from './webUploadedAssetPath';

const encoder = new TextEncoder();

export function collectWebExportAssets(project: Project): readonly WebExportAsset[] {
  const ids = collectProjectStrings(project);
  // These backgrounds are selected by battleBackdrop at runtime, so they need
  // not appear in an authored troop or terrain row. Export their real bytes.
  if (project.system.battleUiStyle === "pokemon") ids.add("battle-skin-pokemon-backdrop");
  if (Object.values(project.maps).some((map) => map.climate?.mode === "fixed" && map.climate.weather === "snow")) {
    ids.add("scarloxy-backdrop-ice");
  }
  // Retro (side-view dot) battles swap bundled effects for the pixel-fx sheets and play their sounds from
  // source tables (retroPixelAnimations, retroSkillTimeline) — none of those ids are in project data.
  if (getBattleSkin(resolveSkinId(project.system.battleUiStyle)).motionStyle === "retro") {
    for (const key of RETRO_PIXEL_FX_KEYS) ids.add(retroPixelFxResourceId(key));
    for (const sound of Object.values(RETRO_PIXEL_FX_SOUNDS)) ids.add(sound);
    for (const sound of retroTimelineSoundIds()) ids.add(sound);
  }
  // Dialogue shows the reviewed face paired with a speaker's walking sprite (dialogue.ts reviewedFaceIdForCharset).
  for (const actor of project.database.actors) {
    const face = actor.characterResourceId ? reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0) : undefined;
    if (face) ids.add(face);
  }
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) {
    const spriteId = page.graphic?.sprite?.id;
    if (!spriteId) continue;
    const pattern = typeof page.graphic.pattern === "number" ? page.graphic.pattern : 0;
    const face = reviewedFaceIdForCharset(spriteId, decodeCharsetFrameIndex(pattern).characterIndex);
    if (face) ids.add(face);
  }
  // The player always loads the placeable overlay textures (rock/gem charset, tree) — see
  // projectBundledTextureKeys in bundled.ts — so the export must always ship them.
  for (const key of PLACEABLE_OVERLAY_TEXTURE_KEYS) ids.add(key);
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
    // 저작 시트(uploaded)는 public 파일이 없다 — collectUsedUploadedAssetIds 가 시트 자산을 싣는다.
    const pixelSheet = bundledPixelEnemySheet(id);
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
    const zipPath = webUploadedAssetPath(asset);
    assets.set(zipPath, { kind: "uploaded", asset, zipPath });
  }
  if (ids.has('tex_worldmap_selected')) {
    const path = 'assets/worldmap-icons/ATTRIBUTION.md';
    assets.set(path, { kind: 'public', sourcePath: path, zipPath: path });
  }
  // 저작자 표기 정본. CC BY 계열 기본 에셋(EasyRPG RTP 등)은 번들 여부와 무관하게 표기 의무가
  // 따라오므로 조건부로 돌리지 않는다 — 타이틀 화면의 라이선스 표기도 이 파일을 연다.
  assets.set("assets/ATTRIBUTION.md", { kind: "public", sourcePath: "assets/ATTRIBUTION.md", zipPath: "assets/ATTRIBUTION.md" });
  return [...assets.values()].sort((left, right) => left.zipPath.localeCompare(right.zipPath));
}

/**
 * Resource ids the project still references whose art was deleted (see retiredAssets.ts).
 * Export skips them; the caller reports them as warnings instead of failing the whole export.
 */
export function collectRetiredExportReferences(project: Project): readonly string[] {
  const authored = new Set<string>();
  collectStrings({ ...project, audioDescriptions: undefined, monsterMetadata: undefined }, authored);
  // Only ids the author's data actually references — not the implicit runtime defaults collectProjectStrings adds.
  return [...authored]
    .filter((id) => isKnownRetiredResource(id) && !resolveAssetResourceUrl(id, { project }))
    .sort();
}

export function collectUsedUploadedAssetIds(project: Project): Set<string> {
  const ids = collectProjectStrings(project);
  const uploaded = new Set<string>();
  for (const id of Object.keys(project.assets.uploaded)) {
    if (ids.has(id)) uploaded.add(id);
  }
  // 저작 적 도트 시트: 초상(=monsterResourceId)이 쓰이면 meta 로만 이어진 3×3 시트 자산도 함께 쓰인다.
  for (const id of [...uploaded]) {
    const sheetId = project.assets.uploaded[id]?.meta.pixelEnemySheet?.sheetResourceId;
    if (sheetId && Object.hasOwn(project.assets.uploaded, sheetId)) uploaded.add(sheetId);
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
// - 칩셋: 맵이 쓰는 칩셋 그림은 타일셋(tilesets[*].image)으로 이미 잡힌다. 카탈로그 행까지 세면 모든 번들 칩셋
//   시트(수십 MB)가 모든 게임에 실렸고, 2026-10-07 저작권 정리로 파일이 지워진 합본 마을 칩셋 행
//   (tex_easyrpg_chipset_combined_town, 모든 새 프로젝트의 기본 카탈로그) 때문에 빈 프로젝트까지
//   «runtime-asset-unavailable» 로 웹·HTML 내보내기가 실패했다(2026-10-23 실측).
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
          isTrainerPictureSize(asset.meta.width ?? 0, asset.meta.height ?? 0)) values.add(id);
    }
  }
  // 소스에 박힌 재생 — 프로젝트 문자열에는 없지만 플레이어가 반드시 읽는다.
  for (const id of PLAYER_RUNTIME_AUDIO_RESOURCE_IDS) values.add(id);
  // 몬스터 장르 기본 효과음 세트 — 소스에서 고르는 소리라 위 훑기로는 보이지 않는다. 다른 장르의 내보내기에는 싣지 않는다.
  for (const id of monsterSfxRuntimeResourceIds(project)) values.add(id);
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

function isChipsetCatalogRow(row: unknown): boolean {
  return typeof row === "object" && row !== null && (row as { readonly kind?: unknown }).kind === "chipset";
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
      collectStrings(child.filter((row) => !isAudioCatalogRow(row) && !isChipsetCatalogRow(row)), out);
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
