import joseonAssets from "./joseonFolkloreAssets.json";
import { PIXEL_ENEMY_PORTRAIT_URLS } from "./pixelEnemyPortraits";
import { pixelEnemySheet } from "./pixelEnemySheets";
import { CHARSET_BATTLERS } from "./charsetBattlers";
import { PARTY_PIXEL_SHEETS } from "./partyPixelSheets";
import { BATTLE_SCENERY_CATALOG } from "./battleSceneryCatalog";
import { RETRO_PIXEL_FX_URLS } from "./retroPixelAnimations";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { withInlineAsset } from "./inlineAssetStore";
import { resolveCc0IconAssetUrl } from "./cc0IconAssets";
import { resolveCc0AudioAssetUrl } from "./cc0AudioAssets";
import { resolveBgmCatalogAssetUrl } from "./bgmCatalogResolver";
import { openingStillPackUrl } from "./openingStillPackCdn";
import { findOpeningStillPackEntry } from "./openingStillPackRuntime";
import { resolveSeCatalogAssetUrl } from "./seCatalogResolver";
import { resolveFarmingAssetUrl } from "./farmingSprites";
import { resolveOprnMonsterCharsetUrl } from "./oprnMonsterCharsets";
import { resolveGeneratedEffectAssetUrl } from "./generatedEffectSheets";
import { resolveScarloxyAssetUrl } from "./scarloxyPack";
import { resolveOgaBackdropAssetUrl } from "./ogaBackdropAssets";
import { resolveOgaCraftpixAssetUrl } from "./ogaCraftpixBackgrounds";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { SHARED_PORTRAIT_ASSETS, resolveSharedPortraitUrl } from "@/assets/sharedPortraitAssets";
import type { GeneratedAssetManifest } from "./generatedAssetManifest";
import type { Project } from "@/project/types";

const FALLBACK_SKIN_ENEMY_URL = PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-slime-01"]!;
const BATTLE_SCENERY_PREVIEW = Object.fromEntries(BATTLE_SCENERY_CATALOG.map((entry) => [entry.biome, entry.preview])) as Record<"plains" | "forest", string>;

// 타이틀 리소스 id 개명(2026-08-21) — 새 id 를 정본으로 쓰고, 구 id 는 **별칭으로
// 남긴다**. 이 값은 프로젝트 파일의 titleResourceId/backgroundResourceId 에 저장되므로
// 구 id 를 지우면 사용자가 만든 기존 프로젝트의 타이틀 화면이 빈 화면이 된다.
// 파일 경로(*.png) 자체는 안 옮겼다 — 에셋 파일 개명은 별도 라운드(Phase 5).
// null entries preserve saved IDs of the removed starter artwork.
const BUILTIN_GENERATED_RESOURCE_URLS: Record<string, string | null> = {
  ...Object.fromEntries((joseonAssets.icons as { resourceId: string; path: string }[]).map(asset => [asset.resourceId, `/${asset.path}`])),
  ...Object.fromEntries(CHARSET_BATTLERS.flatMap((entry) => [
    [entry.resourceId, `/${entry.path}`],
    [`${entry.resourceId}-cast`, `/${entry.castPath}`],
  ])),
  // 파티원 몬스터 9칸 시트(2차 로스터). 배우 battleCharacterResourceId 로 참조한다.
  ...Object.fromEntries(PARTY_PIXEL_SHEETS.map((entry) => [entry.resourceId, `/${entry.path}`])),
  // 미설치 팩도 id 는 유지한다. 파일 실패는 전투 배경의 네 장 로드 가드가 처리한다.
  // 단일 그림으로 풀 때는 네 겹을 합친 미리보기 한 장이다(예전엔 땅 겹만이라 썸네일·몬스터 대치에서 하늘이 비었다).
  ...Object.fromEntries(BATTLE_SCENERY_CATALOG.map((entry) => [entry.resourceId, `/${entry.preview}`])),
  // 도트 측면 전투의 도트 효과 시트(anim_px_* 레코드가 쓴다).
  ...RETRO_PIXEL_FX_URLS,
  hero: null,
  "oprn-title-bright": "/assets/generated/title/oprn-title-bright-v2.png",
  "oprn-title-blue": "/assets/generated/title/default-title-blue.png",
  "oprn-title-field": "/assets/generated/title/oprn-title-field.png",
  "horror-mystery-blue-gallery": "/assets/generated/title/horror-mystery-blue-gallery.png",
  // ── 구 id 별칭 (읽기 호환. 새로 쓸 때는 위 id 를 쓴다) ──────────────
  "rpg-zzu-title-bright": "/assets/generated/title/oprn-title-bright-v2.png",
  "rpg-zzu-title-blue": "/assets/generated/title/default-title-blue.png",
  "rpg-zzu-title-field": "/assets/generated/title/oprn-title-field.png",
  "modern-nocturne-title": "/assets/modern-exteriors/modern-nocturne-title.png",
  "modern-nocturne-logo": "/assets/modern-exteriors/modern-nocturne-logo.png",
  "modern-nocturne-battle-city": "/assets/modern-exteriors/modern-nocturne-battle-city.png",
  "modern-nocturne-battle-rooftop": "/assets/modern-exteriors/modern-nocturne-battle-rooftop.png",
  "oprn-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  "rpg-zzu-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  // ── 오프닝 무드 슬라이드 (2026-09-22) ─────────────────────────────────
  // 에디터 첫 화면(웰컴 브리핑)의 장르 포스터 그림을 시네마틱 스틸로도 쓴다.
  // 1408×768 · 16:9 라 전체화면 오프닝 무드컷에 맞고, 웰컴 표면과 같은 파일을
  // 가리키므로 레포 용량 증가가 없다. "오프닝 무드 슬라이드"는 still 피커와
  // list_opening_media 의 배경화 그룹에 잡히고, 검색어는 openingStillMoods.ts 가 담는다.
  "oprn-still-hero-dawn": "/assets/generated/welcome/slide-00-hero.png",
  "oprn-still-rally": "/assets/generated/welcome/slide-01.png",
  "oprn-still-corridor": "/assets/generated/welcome/slide-02.png",
  "oprn-still-harbor": "/assets/generated/welcome/slide-03.png",
  "oprn-still-forest-path": "/assets/generated/welcome/slide-04.png",
  "oprn-still-festival": "/assets/generated/welcome/slide-05.png",
  "oprn-still-ride": "/assets/generated/welcome/slide-06.png",
  "oprn-still-moon-meadow": "/assets/generated/welcome/mini-03-moon.png",
  "oprn-still-manor-night": "/assets/generated/welcome/mini-04-mansion.png",
  "oprn-still-dream": "/assets/generated/welcome/mini-02-yume.png",
  "oprn-still-metropolis": "/assets/generated/welcome/mini-05-meta.png",
  "oprn-still-lullaby": "/assets/generated/welcome/mini-06-mother.png",
  "oprn-still-quiet-room": "/assets/generated/welcome/mini-01-omori.png",
  // tibo(gemini-3.1-flash-image) 로 새로 만든 무드 슬라이드 — 웰컴 팩에 없던 축을 채운다.
  "oprn-still-farm-golden": "/assets/generated/opening/farm-golden.png",
  "oprn-still-snow-village": "/assets/generated/opening/snow-village.png",
  "oprn-still-desert-ruin": "/assets/generated/opening/desert-ruin.png",
  "oprn-still-kingdom-day": "/assets/generated/opening/kingdom-day.png",
  "oprn-still-dark-citadel": "/assets/generated/opening/dark-citadel.png",
  "generated-actor-hero-01-battle": null,
  "generated-actor-hero-01-charset": null,
  "generated-actor-hero-01-face": null,
  "generated-actor-hero-02-battle": null,
  "generated-actor-hero-02-face": null,
  "generated-face-actor1-bust": "/assets/generated/faces/actor1-bust.png",
  "generated-face-actor1-full": "/assets/generated/faces/actor1-bust.png",
  "generated-actor-hero-03-battle": null,
  // Keep the saved ID recognized; retired starter faces have no runtime URL.
  "generated-actor-hero-03-face": null,
  "generated-actor-hero-04-battle": null,
  // 성직자·궁수 배틀러(2026-08-29). DB 액터 actor_cleric / actor_ranger 가 여태 hero-02 /
  // hero-01 시트를 돌려 썼다 — 시작 파티는 아니지만 작성자가 파티에 넣으면 전투 화면에
  // 같은 그림이 두 번 선다.
  // charset/face 는 아직 없다 — hero-03 처럼 없는 파일을 등록하면 404 가드에 의존해야 하므로
  // 만들 때 같이 등록한다.
  "generated-actor-hero-05-battle": null,
  "generated-actor-hero-06-battle": null,
  "generated-equipment-bronze-sword-icon": null,
  "generated-equipment-bronze-sword-image": null,
  "generated-equipment-oak-shield-icon": null,
  "generated-equipment-oak-shield-image": null,
  "generated-item-ether-blue-icon": null,
  "generated-item-ether-blue-image": null,
  "generated-item-potion-red-icon": null,
  "generated-item-potion-red-image": null,
  "generated-troop-preview-slime": PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-slime-01"],
  // The existing human selection from monster-collect-species/ledger.json.
  "generated-enemy-sparkit-fire": "/assets/harnesses/monster-collect-species/sparkit/front.png",
  // 옛 전투 배경(은퇴 스킨 13장·숲 레퍼런스)은 2026-10-03 deprecated/ 로 옮겼다. id 는 저장본·공용 장소가
  // 들고 있으므로 지금 그림으로 돌린다: 도트 측면은 겹 배경 미리보기, 포켓몬은 Scarloxy 숲.
  "battle-skin-pokemon-backdrop": "/assets/scarloxy/scarloxy-backdrop-forest.png",
  ...Object.fromEntries(["mv", "vxace", "rm2003", "rm2000", "octopath", "chrono", "bravely", "dragonquest", "ff", "mother", "goldensun"]
    .map((skin) => [`battle-skin-${skin}-backdrop`, `/${BATTLE_SCENERY_PREVIEW.plains}`])),
  "battle-skin-demo-battler": "/assets/generated/battle-skins/demo-battler-alpha.png",
  // Per-skin battler sprites (chroma-keyed #00FF00 -> alpha) — themed enemy + party (front/back).
  // 스킨 공용 정면 적 그림은 2026-10-02 지웠다 — 옛 id 는 남겨 두고(참조 검증) 도트 슬라임 초상으로 돌린다.
  "bskin-enemy-pokemon": "/assets/scarloxy/scarloxy-monster-larvea.png",
  // 옛 AI 고치·씨앗 그림(2026-10-03 deprecated/)은 도트 그림으로 돌린다 — 고르기 목록에서는 뺐다.
  "generated-enemy-reference-cocoon": PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-sylph-hornet"] ?? FALLBACK_SKIN_ENEMY_URL,
  "generated-enemy-reference-seed-back": "/assets/scarloxy/scarloxy-monster-mossling.png",
  // EasyRPG Hornet(2026-10-03 deprecated/)도 같은 말벌의 도트 초상으로 돌린다.
  "easyrpg-monster-hornet": PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-sylph-hornet"] ?? FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-rm2003": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-rm2000": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-octopath": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-chrono": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-bravely": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-dragonquest": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-ff": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-mother": FALLBACK_SKIN_ENEMY_URL,
  "bskin-enemy-goldensun": FALLBACK_SKIN_ENEMY_URL,
  "bskin-ally-creature-back": "/assets/scarloxy/scarloxy-monster-mossling.png",
  // 액터별 뒷모습 배틀러(2026-08-29). 위의 `bskin-ally-creature-back` 은 **파티 전원이 돌려 쓰는
  // 한 장**이라 어느 액터를 넣어도 같은 보라색 생물이 뒤통수를 보였다. 액터마다 하나씩 나눈다.
  //
  // 규격은 `bskin-ally-creature-back` 과 같은 712×712 통짜 이미지다 — 144×384 전투 캐릭터셋이
  // 아니므로 oprnGeneratedAssetPlan.json 에는 넣지 않는다(기존 `bskin-*` 스프라이트도 전부
  // 리졸버 전용이다). 만든 방법은 scripts/asset-gen/gen-hero-back-grok.mjs 에 있다.
  "generated-actor-hero-01-back": "/assets/generated/battle-skins/sprites/hero-01-back.png",
  "generated-actor-hero-02-back": "/assets/generated/battle-skins/sprites/hero-02-back.png",
  "generated-actor-hero-03-back": "/assets/generated/battle-skins/sprites/hero-03-back.png",
  "generated-actor-hero-04-back": "/assets/generated/battle-skins/sprites/hero-04-back.png",
  "generated-actor-hero-05-back": "/assets/generated/battle-skins/sprites/hero-05-back.png",
  "generated-actor-hero-06-back": "/assets/generated/battle-skins/sprites/hero-06-back.png",
  // 옛 숲 레퍼런스 그림(2026-10-03 deprecated/) — 도트 숲 겹 배경 미리보기로 돌린다.
  "generated-battle-reference-forest": `/${BATTLE_SCENERY_PREVIEW.forest}`,
  // CSS 9-slice windowskin (EasyRPG System/*.png sheets are icon strips, not windowskins).
  // 창 스킨 리소스 id 개명(2026-08-21). 새 id 가 정본이고 구 id 는 **읽기 별칭**이다 —
  // project.system.systemResourceId 에 저장되므로 지우면 기존 프로젝트의 대사창이 깨진다.
  // 그림 자체는 우리가 생성한 9-slice 다(public/assets/ATTRIBUTION.md).
  "windowskin-default": "/assets/ui/windowskin-default.png",
  "windowskin-warm": "/assets/ui/windowskin-warm.png",
  "windowskin-rm2003": "/assets/ui/windowskin-default.png",
  // 생성 얼굴 낱장 32장(hero-01-face / hero-02-face × 16). 분할 산출물 목록에서 펼쳐 넣는다 —
  // 그래야 builtinGeneratedResourceIds() 에도 실려 collectResourceIds 가 알아본다.
  ...PIXEL_ENEMY_PORTRAIT_URLS,
  ...generatedFacesetFaceUrls(),
  ...Object.fromEntries([1, 2].flatMap((hero) =>
    Array.from({ length: 16 }, (_, cell) => [
      `generated-actor-hero-0${hero}-face-${String(cell).padStart(2, "0")}`, null,
    ])
  )),
  // 공용 표정 세트 76종의 흉상·전신 760장(sharedPortraitAssets.ts). 같은 이유로 여기 싣는다.
  ...Object.fromEntries(SHARED_PORTRAIT_ASSETS.map((asset) => [asset.id, `/${asset.path}`])),
};

function generatedFacesetFaceUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const face of FACESET_FACE_ASSETS) {
    if (!face.sheetResourceId.startsWith("easyrpg-")) urls[face.id] = `/${face.path}`;
  }
  return urls;
}

// 얼굴 낱장 112장 전부. EasyRPG 낱장은 EASYRPG_RTP_ASSETS 표에 넣지 않았다(생성기가
// 다시 돌면 지워진다) — 그래서 경로 해석은 이 표가 맡는다.
const FACESET_FACE_RESOURCE_URLS: Record<string, string> = Object.fromEntries(
  FACESET_FACE_ASSETS.map((face) => [face.id, `/${face.path}`])
);

export function resolveFacesetFaceAssetUrl(resourceId: string): string | null {
  return FACESET_FACE_RESOURCE_URLS[resourceId] ?? null;
}

const LEGACY_PACKAGED_RESOURCE_URLS: Record<string, string> = {
  sample_title: "/assets/easyrpg/title/Title1.png",
};

export type AssetResourceResolutionOptions = {
  readonly project?: Pick<Project, "assets">;
  readonly manifest?: GeneratedAssetManifest;
};

export function resolveAssetResourceUrl(resourceId: string | undefined, options: AssetResourceResolutionOptions = {}): string | null {
  if (!hasResourceId(resourceId)) return null;
  const packagedUrl =
    LEGACY_PACKAGED_RESOURCE_URLS[resourceId] ??
    resolveEasyRpgRuntimeAssetUrl(resourceId) ??
    resolveFacesetFaceAssetUrl(resourceId) ??
    resolveSharedPortraitUrl(resourceId) ??
    resolveScarloxyAssetUrl(resourceId) ??
    resolveGeneratedEffectAssetUrl(resourceId) ??
    resolveFarmingAssetUrl(resourceId) ??
    resolveOprnMonsterCharsetUrl(resourceId) ??
    resolveCc0IconAssetUrl(resourceId) ??
    resolveOgaBackdropAssetUrl(resourceId) ??
    resolveOgaCraftpixAssetUrl(resourceId) ??
    resolveCc0AudioAssetUrl(resourceId) ??
    // 281곡 CC0 BGM 카탈로그. 파일이 레포에 없고 CDN 에서 오므로 절대 URL 이 나올 수 있다.
    resolveBgmCatalogAssetUrl(resourceId) ??
    // 오프닝 스틸 릴리스 팩. 파일이 레포에 없고 CDN/설치 경로에서 온다.
    resolveOpeningStillPackUrl(resourceId) ??
    // 456개 CC0 효과음 카탈로그. 파일이 레포에 있어(public/assets/se/) 항상 동일 출처 경로다.
    resolveSeCatalogAssetUrl(resourceId);
  if (packagedUrl !== null) return withInlineAsset(packagedUrl);
  const uploaded = options.project?.assets.uploaded[resourceId];
  if (uploaded?.ref) return uploadedAssetUrl(uploaded) || null;
  const uploadedUrl = uploaded?.dataUrl;
  if (uploadedUrl !== undefined) return safeUploadedResourceUrl(uploadedUrl);
  const generated = options.manifest !== undefined
    ? resolveGeneratedAssetResourceUrl(resourceId, options.manifest)
    : resolveGeneratedAssetResourceUrl(resourceId);
  return generated === null ? null : withInlineAsset(generated);
}

export function builtinGeneratedResourceIds(includeRetired = false): string[] {
  return Object.keys(BUILTIN_GENERATED_RESOURCE_URLS).filter(
    (id) => includeRetired || BUILTIN_GENERATED_RESOURCE_URLS[id] !== null
  );
}

/** 릴리스 팩 스틸 — 설치되지 않은 환경에서도 경로는 결정론적이다(그림이 404 나면 onerror 처리). */
export function resolveOpeningStillPackUrl(resourceId: string): string | null {
  const entry = findOpeningStillPackEntry(resourceId);
  return entry ? openingStillPackUrl(entry.fileName) : null;
}

export function resolveGeneratedAssetResourceUrl(resourceId: string, manifest?: GeneratedAssetManifest): string | null {
  // Reserved bundled enemy IDs always use the current native portrait, including stale manifests.
  const nativeSheet = pixelEnemySheet(resourceId);
  const portrait = nativeSheet ? PIXEL_ENEMY_PORTRAIT_URLS[nativeSheet.resourceId] : undefined;
  if (portrait) return portrait;
  if (manifest === undefined) {
    const direct = Object.hasOwn(BUILTIN_GENERATED_RESOURCE_URLS, resourceId) ? BUILTIN_GENERATED_RESOURCE_URLS[resourceId] : undefined;
    if (Object.hasOwn(BUILTIN_GENERATED_RESOURCE_URLS, resourceId)) return direct ?? null;
    // Unknown names/numbers have no verified species mapping. Never guess a slime.
    return null;
  }
  const entry = manifest.assets.find((asset) => asset.resourceId === resourceId);
  if (entry === undefined) return null;
  if (entry.status !== "promoted") return null;
  return generatedAssetPromotedPathToUrl(entry.promotedPath);
}

export function generatedAssetPromotedPathToUrl(promotedPath: string | null): string | null {
  if (promotedPath === null) return null;
  const normalizedPath = promotedPath.trim().replaceAll("\\", "/");
  const runtimePath = stripPublicPrefix(stripLeadingSlash(normalizedPath));
  // Imported manifests may still contain these retired painting paths.
  const oldStarter = runtimePath.match(/^assets\/generated\/starter\/monster-([^/]+)\.png$/);
  const oldCorrected = runtimePath.match(/^assets\/generated\/monsters\/corrected\/([^/]+)\.png$/);
  const retiredSlug = oldStarter?.[1] ?? oldCorrected?.[1];
  if (retiredSlug) return BUILTIN_GENERATED_RESOURCE_URLS[`generated-enemy-${retiredSlug}`] ?? null;
  if (runtimePath === "assets/generated/starter/sylph-hornet-transparent.png") return PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-sylph-hornet"] ?? null;
  if (runtimePath === "assets/generated/starter/troop-preview-slime.png") return PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-slime-01"];
  if (runtimePath.startsWith("assets/generated/monsters/") || /^assets\/generated\/starter\/idle\/monster-/.test(runtimePath)) return null;
  if (!isAllowedGeneratedRuntimePath(runtimePath)) return null;
  return `/${runtimePath}`;
}

export function resolveEasyRpgRuntimeAssetUrl(resourceId: string): string | null {
  const entry = EASYRPG_RTP_ASSETS.find(
    (asset) => asset.id === resourceId || ("textureKey" in asset && asset.textureKey === resourceId)
  );
  if (entry !== undefined) return `/${entry.path}`;
  if (resourceId.startsWith("tex_easyrpg_chipset_")) {
    const suffix = resourceId.replace("tex_easyrpg_chipset_", "");
    return `/assets/easyrpg-chipset-${suffix.replace(/_/g, "-")}-transparent.png`;
  }
  if (resourceId === "tex_tiles_default") {
    return "/assets/easyrpg-chipset-exterior.png";
  }
  return null;
}

function hasResourceId(resourceId: string | undefined): resourceId is string {
  return resourceId !== undefined && resourceId.trim().length > 0;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function stripPublicPrefix(path: string): string {
  const publicPrefix = "public/";
  return path.startsWith(publicPrefix) ? path.slice(publicPrefix.length) : path;
}

function isAllowedGeneratedRuntimePath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return (
    normalizedPath.startsWith("assets/generated/") &&
    !normalizedPath.startsWith("assets/generated/starter/") &&
    normalizedPath.endsWith(".png") &&
    !normalizedPath.includes("assets/easyrpg/") &&
    !hasUnsafePathSegment(normalizedPath)
  );
}

function safeUploadedResourceUrl(dataUrl: string): string | null {
  const normalizedUrl = dataUrl.trim().toLowerCase();
  if (normalizedUrl.startsWith("data:image/png;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/jpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/webp;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/gif;")) return dataUrl;
  if (/^data:audio\/(?:x-wav|wave|vnd\.wave);/i.test(normalizedUrl)) {
    return dataUrl.trim().replace(/^data:audio\/[^;]+/i, "data:audio/wav");
  }
  if (/^data:audio\/mp3;/i.test(normalizedUrl)) {
    return dataUrl.trim().replace(/^data:audio\/mp3/i, "data:audio/mpeg");
  }
  if (normalizedUrl.startsWith("data:audio/mpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/wav;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/ogg;")) return dataUrl;
  if (/^data:video\/(mp4|webm|ogg);/.test(normalizedUrl)) return dataUrl;
  return null;
}

function hasUnsafePathSegment(path: string): boolean {
  if (path.includes("%2e") || path.includes("%2f") || path.includes("%5c")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}
