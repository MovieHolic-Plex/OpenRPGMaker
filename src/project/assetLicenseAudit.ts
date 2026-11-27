// project/assetLicenseAudit.ts
// 프로젝트가 실제로 참조·사용하는 에셋의 라이선스·출처·Steam AI 공시 필요 여부를 순수 함수로 감사한다.
// 에디터·AI·하네스 모듈을 import 하지 않으므로 출하 플레이어 번들에서도 안전하게 실행된다.
import { aiMaker, storeItemsInProject } from "@/assetStore/pack";
import type { StoreLicense } from "@/assetStore/format";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { BUNDLED_IMAGE_ASSETS } from "@/assets/bundled";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { findOpeningStillPackEntry } from "@/assets/openingStillPackRuntime";
import { OPRN_BGM_ASSETS, type OprnBgmAsset } from "@/assets/oprnBgmAssets";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { transitVehicle } from "@/project/mapTransit";
import type { Project, UploadedAsset } from "@/project/types";

export interface AiBgmTrackUsage {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly source: "oprn-lyria" | "uploaded-ai";
}

export interface StoreCreditAuditEntry {
  readonly itemSlug: string;
  readonly title: string;
  readonly author: string;
  readonly license: StoreLicense;
  readonly aiGenerated: boolean;
  readonly credits: string;
  readonly url: string;
  readonly requiresAttribution: boolean;
}

export interface SteamAiDisclosureReason {
  readonly code: "ai-bgm" | "ai-images" | "ai-uploaded" | "ai-store";
  readonly ko: string;
  readonly en: string;
}

export interface ProjectAssetLicenseAudit {
  /** EasyRPG RTP (CC BY 4.0) 사용 여부(그림 또는 효과음/음악). */
  readonly usesEasyRpgRtp: boolean;
  /** EasyRPG RTP 그림·칩셋·캐릭셋·초상 사용 여부. */
  readonly usesEasyRpgRtpGraphics: boolean;
  /** EasyRPG RTP 오디오(효과음·음악) 사용 여부. */
  readonly usesEasyRpgRtpAudio: boolean;
  /** Scarloxy (CC BY 4.0) 사용 여부. */
  readonly usesScarloxy: boolean;
  /** REFMAP 변형 칩/에셋 사용 여부. */
  readonly usesRefmap: boolean;
  /** OPRN AI BGM (Google Lyria 등) 사용 여부. */
  readonly usesAiBgm: boolean;
  /** 사용된 AI BGM 트랙 목록. */
  readonly aiBgmTracks: readonly AiBgmTrackUsage[];
  /** AI 생성 이미지(오프닝 스틸·생성형 초상/트레이너/몬스터·업로드 AI 에셋 등) 사용 여부. */
  readonly usesAiGeneratedImages: boolean;
  /** 감지된 AI 생성 이미지 리소스 ID 목록. */
  readonly aiGeneratedImageIds: readonly string[];
  /** CC0 번들/카탈로그/스토어 에셋 사용 여부. */
  readonly usesCc0Assets: boolean;
  /** CC0 오디오(음악·효과음) 사용 여부. */
  readonly usesCc0Audio: boolean;
  /** CC0 그림(타일·아이콘·탈것 등) 사용 여부. */
  readonly usesCc0Graphics: boolean;
  /** 프로젝트에 설치된 에셋 스토어 상품 크레딧 목록. */
  readonly storeCredits: readonly StoreCreditAuditEntry[];
  /** 법적 표기 의무(CC BY 4.0, CC BY-SA 4.0, REFMAP, 크레딧 필수 스토어 에셋) 존재 여부. */
  readonly requiresAttribution: boolean;
  /** Steam AI 생성 콘텐츠 공시 필요 여부. */
  readonly requiresSteamAiDisclosure: boolean;
  /** Steam AI 공시 상세 사유 목록(한국어·영어). */
  readonly steamAiDisclosureReasons: readonly SteamAiDisclosureReason[];
}

const OPRN_BGM_BY_ID: ReadonlyMap<string, OprnBgmAsset> = new Map(OPRN_BGM_ASSETS.map((entry) => [entry.id, entry]));
const CC0_AUDIO_BY_ID = new Map(CC0_AUDIO_ASSETS.map((entry) => [entry.id, entry]));
const BUNDLED_PATH_BY_KEY = new Map(BUNDLED_IMAGE_ASSETS.map((entry) => [entry.textureKey, entry.path]));

/** public/assets/ATTRIBUTION.md 기준 EasyRPG RTP 픽셀을 포함한 번들 버들항 칩셋. */
const EASYRPG_RTP_DERIVED_SHEET_KEYS = new Set([
  "tex_beodeul_city",
  "tex_beodeul_architecture",
  "tex_beodeul_forms",
  "tex_beodeul_reviewed",
]);

const EASYRPG_RTP_DERIVED_PATHS = [
  "assets/beodeul-city/beodeul-city-chipset.png",
  "assets/beodeul-architecture/chipset.png",
  "assets/beodeul-forms/chipset.png",
  "assets/beodeul-reviewed/chipset.png",
];

/** public/assets/ATTRIBUTION.md 기준 Scarloxy 디렉터리에 있지만 AI 생성 몬스터 스프라이트(Scarloxy CC BY 아님). */
const AI_GENERATED_SCARLOXY_PREFIX_IDS = new Set([
  "scarloxy-monster-mossling",
  "scarloxy-monster-icon-mossling",
  "scarloxy-monster-emberkit",
  "scarloxy-monster-icon-emberkit",
  "scarloxy-monster-puddlup",
  "scarloxy-monster-icon-puddlup",
]);

/** public/assets/ATTRIBUTION.md 기준 AI 생성 오프닝 무드 스틸 5종. */
const AI_GENERATED_OPENING_STILL_IDS = new Set([
  "oprn-still-farm-golden",
  "oprn-still-snow-village",
  "oprn-still-desert-ruin",
  "oprn-still-kingdom-day",
  "oprn-still-dark-citadel",
]);

/** 저작물 문자열 수집 시 제외할 비참조/카탈로그/메타 키. */
const SKIPPED_WALK_KEYS = new Set([
  "uploaded",
  "resourceProfiles",
  "audioDescriptions",
  "monsterMetadata",
  "aiDocuments",
  "aiAuthoring",
  "assistantTodo",
  "dialogueDesk",
  "customCredits",
  "localizations",
  "tilesets",
]);

function collectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (value.length > 0 && value.length <= 256) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (SKIPPED_WALK_KEYS.has(key)) continue;
    collectStrings(child, out);
  }
}

function collectAuthoredAssetReferences(project: Project): Set<string> {
  const refs = new Set<string>();
  const maps = project.maps ?? {};
  const tilesets = project.tilesets ?? {};

  // 프로젝트 전체에서 카탈로그/업로드/비참조 메타를 제외하고 문자열 수집.
  collectStrings(project, refs);

  // 실제로 맵에서 쓰이는 타일셋의 그림·이식·겉모습만 수집한다(미사용 번들 타일셋은 제외).
  const mapList = Object.values(maps);
  const usedTilesetIds = mapList.length > 0
    ? new Set(mapList.map((map) => map.tilesetId).filter((id): id is string => typeof id === "string" && id.length > 0))
    : new Set(Object.keys(tilesets));

  for (const tilesetId of usedTilesetIds) {
    const tileset = tilesets[tilesetId];
    if (!tileset) continue;
    if (tileset.image?.id) refs.add(tileset.image.id);
    for (const graft of tileset.tileGrafts ?? []) {
      if (graft.sourceChipset) refs.add(graft.sourceChipset);
    }
    if (tileset.look?.textureKey) refs.add(tileset.look.textureKey);
    if (tileset.look?.standKey) refs.add(tileset.look.standKey);
    if (tileset.look?.waterKey) refs.add(tileset.look.waterKey);
  }

  // 액터·이벤트 걷기 칩에 자동 짝지어지는 얼굴(reviewedFaceIdForCharset) 반영.
  for (const actor of project.database?.actors ?? []) {
    const face = actor.characterResourceId
      ? reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0)
      : undefined;
    if (face) refs.add(face);
  }
  for (const map of mapList) {
    for (const event of map.events ?? []) {
      for (const page of event.pages ?? []) {
        const spriteId = page.graphic?.sprite?.id;
        if (!spriteId) continue;
        const pattern = typeof page.graphic?.pattern === "number" ? page.graphic.pattern : 0;
        const face = reviewedFaceIdForCharset(spriteId, decodeCharsetFrameIndex(pattern).characterIndex);
        if (face) refs.add(face);
      }
    }
    for (const route of map.transit?.routes ?? []) {
      if (route.enabled === false) continue;
      for (const id of route.vehicles ?? []) {
        const image = transitVehicle(id)?.image;
        if (image) refs.add(image.replace(/^\/+/u, ""));
      }
    }
  }

  // 오프닝 북 초상 모션
  if (project.meta?.oprnOpeningBook?.portraitMotion?.resourceId) {
    refs.add(project.meta.oprnOpeningBook.portraitMotion.resourceId);
  }

  // 에메랄드 몬스터 전투 배경 / 트레이너 스프라이트(저작된 트룹에 실제로 지정된 경우만)
  for (const troop of project.database?.troops ?? []) {
    const sprite = troop.trainerSprite;
    if (!sprite) continue;
    for (const role of [sprite.front, sprite.back, sprite.throw, sprite.backThrow]) {
      if (role && !Object.hasOwn(project.assets?.uploaded ?? {}, role)) {
        refs.add(`assets/battle-trainers/${role}`);
      }
    }
  }

  if (project.system?.battleUiStyle === "pokemon") {
    refs.add("battle-skin-pokemon-backdrop");
  }
  // 이 함수의 다른 읽기처럼 meta 가 없는 프로젝트 조각(크레딧 미리보기·시험)에서도 멈추지 않는다.
  if (project.meta && isEmeraldMonsterStyle(project)) {
    refs.add("assets/emerald-monster/battle");
  }

  return refs;
}

function normalizePath(raw: string): string {
  return raw.replace(/^\/+/u, "");
}

function resolveCandidatePath(id: string, project: Project): string | null {
  const bundledPath = BUNDLED_PATH_BY_KEY.get(id);
  if (bundledPath) return normalizePath(bundledPath);
  const oprnBgm = OPRN_BGM_BY_ID.get(id);
  if (oprnBgm) return normalizePath(oprnBgm.path);
  const cc0Audio = CC0_AUDIO_BY_ID.get(id);
  if (cc0Audio) return normalizePath(cc0Audio.path);
  try {
    const url = resolveAssetResourceUrl(id, { project });
    if (url && !url.startsWith("data:") && !url.startsWith("blob:")) {
      return normalizePath(url);
    }
  } catch {
    // ignore unresolved synthetic IDs
  }
  if (id.startsWith("assets/") || id.startsWith("/assets/")) return normalizePath(id);
  return null;
}

function isAiGeneratedScarloxyPathOrId(id: string, path: string | null): boolean {
  if (AI_GENERATED_SCARLOXY_PREFIX_IDS.has(id)) return true;
  if (!path) return false;
  return /assets\/scarloxy\/scarloxy-monster-(?:icon-)?(?:mossling|emberkit|puddlup)\.png$/iu.test(path);
}

function storeLicenseRequiresAttribution(license: StoreLicense, credits: string): boolean {
  if (license === "CC-BY-4.0" || license === "CC-BY-SA-4.0" || license === "REFMAP-MODIFIED") return true;
  if (license === "CC0") return false;
  return credits.trim().length > 0;
}

function isAudioUploadedAsset(asset: UploadedAsset): boolean {
  return asset.kind === "music" || asset.kind === "sound";
}

/**
 * 프로젝트가 실제로 사용하는 에셋을 기준으로 라이선스·출처·Steam AI 공시 의무를 감사한다.
 * 100% 자체 업로드 에셋만 쓰는 게임은 EasyRPG/Scarloxy/REFMAP/AI BGM/AI 이미지가 모두 false 로 판정된다.
 */
export function auditProjectAssetLicenses(project: Project): ProjectAssetLicenseAudit {
  const refs = collectAuthoredAssetReferences(project);
  const uploadedMap = project.assets?.uploaded ?? {};

  let usesEasyRpgRtpGraphics = false;
  let usesEasyRpgRtpAudio = false;
  let usesScarloxy = false;
  let usesRefmap = false;
  let usesCc0Audio = false;
  let usesCc0Graphics = false;

  const aiBgmMap = new Map<string, AiBgmTrackUsage>();
  const aiImageSet = new Set<string>();

  for (const id of refs) {
    // 업로드 에셋 ID 는 별도 업로드 루프에서 검사하므로 번들 규칙 오탐을 피한다.
    if (Object.hasOwn(uploadedMap, id)) continue;

    const path = resolveCandidatePath(id, project);
    const lowerId = id.toLowerCase();
    const lowerPath = path?.toLowerCase() ?? "";

    // 1. OPRN AI BGM (Google Lyria)
    const oprnTrack = OPRN_BGM_BY_ID.get(id);
    if (oprnTrack) {
      aiBgmMap.set(oprnTrack.id, {
        id: oprnTrack.id,
        name: oprnTrack.name,
        path: oprnTrack.path,
        source: "oprn-lyria",
      });
      continue;
    }
    if (lowerPath.startsWith("assets/oprn-bgm/")) {
      aiBgmMap.set(id, { id, name: id, path: path ?? id, source: "oprn-lyria" });
      continue;
    }

    // 2. CC0 BGM / SE / 카탈로그
    const cc0Audio = CC0_AUDIO_BY_ID.get(id);
    if (cc0Audio) {
      usesCc0Audio = true;
      continue;
    }
    if (findBgmRuntimeEntry(id) || lowerId.startsWith("cc0-bgm-") || lowerId.startsWith("cc0-se-") || lowerId.startsWith("cc0-music-") || lowerId.startsWith("cc0-sound-")) {
      usesCc0Audio = true;
      continue;
    }
    if (lowerPath.startsWith("assets/cc0/audio/") || lowerPath.startsWith("assets/se/")) {
      usesCc0Audio = true;
      continue;
    }

    // 3. CC0 그림 (jetrel 아이콘, JasonPerry CC0 차량/월드맵 아이콘 등)
    if (
      lowerId.startsWith("cc0-jetrel-")
      || lowerId.startsWith("cc0-icon-")
      || lowerPath.startsWith("assets/cc0/")
      || id === "tex_oprn_atlas_vehicles"
      || lowerPath === "assets/atlas-scenes/vehicles.png"
      || id === "tex_worldmap_selected"
      || lowerPath === "assets/worldmap-icons/worldmap-selected.png"
    ) {
      usesCc0Graphics = true;
    }

    // 4. AI 생성 몬스터(scarloxy/ 접두사에 있지만 Scarloxy CC BY 아님)
    if (isAiGeneratedScarloxyPathOrId(id, path)) {
      aiImageSet.add(id);
      continue;
    }

    // 5. REFMAP 변형 칩/배틀러
    if (lowerId.includes("refmap") || lowerPath.includes("refmap")) {
      usesRefmap = true;
    }

    // 6. Scarloxy (CC BY 4.0)
    if (
      lowerId.startsWith("scarloxy-")
      || lowerId.startsWith("tex_scarloxy_")
      || lowerId.includes("scarloxypeople")
      || lowerPath.startsWith("assets/scarloxy/")
      || lowerPath.includes("generated/charsets/scarloxypeople")
      || lowerPath.includes("generated/faceset/missing-scarloxy")
      || lowerId.startsWith("generated-faceset-missing-scarloxy")
    ) {
      usesScarloxy = true;
    }

    // 7. EasyRPG RTP (CC BY 4.0) — 오디오 vs 그림 구분
    if (
      lowerId.startsWith("easyrpg-sound-")
      || lowerId.startsWith("easyrpg-music-")
      || lowerPath.startsWith("assets/easyrpg/sound/")
      || lowerPath.startsWith("assets/easyrpg/music/")
    ) {
      usesEasyRpgRtpAudio = true;
    } else if (
      lowerId.startsWith("easyrpg-")
      || lowerId.startsWith("tex_easyrpg_")
      || lowerPath.startsWith("assets/easyrpg/")
      || EASYRPG_RTP_DERIVED_SHEET_KEYS.has(id)
      || EASYRPG_RTP_DERIVED_PATHS.includes(lowerPath)
      || lowerId === "tex_heroes1"
      || /^tex_modern[123]$/u.test(lowerId)
      || lowerPath.includes("generated/charsets/heroes1")
      || /generated\/charsets\/modern[123]/u.test(lowerPath)
      || lowerPath.startsWith("assets/shared/faceset/")
      || lowerPath.startsWith("assets/shared/portraits/")
      || lowerId.startsWith("shared-faceset-")
      || lowerId.startsWith("shared-portrait-")
      || lowerId.startsWith("generated-faceset-missing-people")
      || lowerId.startsWith("generated-faceset-missing-monster")
      || lowerPath.includes("generated/faceset/missing-people")
      || lowerPath.includes("generated/faceset/missing-monster")
    ) {
      usesEasyRpgRtpGraphics = true;
    }

    // 8. AI 생성 이미지(오프닝 스틸, 스틸 팩, 생성 초상/얼굴, 트레이너 스프라이트, 에메랄드 몬스터 v4)
    if (
      AI_GENERATED_OPENING_STILL_IDS.has(id)
      || lowerId.startsWith("oprn-pack-still-")
      || Boolean(findOpeningStillPackEntry(id))
      || lowerPath.startsWith("assets/generated/opening/")
      || lowerPath.startsWith("assets/stills/pack/")
      || lowerPath.startsWith("assets/shared/portraits/")
      || lowerId.startsWith("shared-portrait-")
      || lowerPath.startsWith("assets/generated/faceset/missing-")
      || lowerId.startsWith("generated-faceset-missing-")
      || lowerPath.startsWith("assets/battle-trainers/")
      || lowerPath.startsWith("assets/emerald-monster/species-v4/")
    ) {
      aiImageSet.add(id);
    }
  }

  // 9. 업로드 에셋(직접 업로드 / 공방 / AI 생성 / 스토어) 감사
  const uploadedAiImageIds: string[] = [];
  for (const asset of Object.values(uploadedMap)) {
    const maker = aiMaker(asset);
    if (!maker) continue;
    // 스토어 origin.aiGenerated 는 아래 storeCredits 에서 따로 사유를 생성하므로 중복 방지(직접 generatedBy 가 있는 경우만 여기서 집계).
    if (maker === "store" && !asset.generatedBy) continue;
    if (isAudioUploadedAsset(asset)) {
      aiBgmMap.set(asset.id, {
        id: asset.id,
        name: asset.name,
        path: asset.id,
        source: "uploaded-ai",
      });
    } else {
      aiImageSet.add(asset.id);
      uploadedAiImageIds.push(asset.id);
    }
  }

  // 10. 에셋 스토어 상품 감사
  const storeItems = storeItemsInProject({
    tilesets: project.tilesets ?? {},
    assets: { sprites: project.assets?.sprites ?? {}, uploaded: uploadedMap },
  } as Project);

  const storeCredits: StoreCreditAuditEntry[] = storeItems.map(({ origin }) => {
    const reqAttr = storeLicenseRequiresAttribution(origin.license, origin.credits);
    if (origin.license === "REFMAP-MODIFIED") usesRefmap = true;
    if (origin.license === "CC0") usesCc0Graphics = true;
    return {
      itemSlug: origin.itemSlug,
      title: origin.title,
      author: origin.author,
      license: origin.license,
      aiGenerated: origin.aiGenerated,
      credits: origin.credits,
      url: origin.url,
      requiresAttribution: reqAttr,
    };
  });

  const aiBgmTracks = [...aiBgmMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  const aiGeneratedImageIds = [...aiImageSet].sort();

  const usesEasyRpgRtp = usesEasyRpgRtpGraphics || usesEasyRpgRtpAudio;
  const usesAiBgm = aiBgmTracks.length > 0;
  const usesAiGeneratedImages = aiGeneratedImageIds.length > 0;
  const usesCc0Assets = usesCc0Audio || usesCc0Graphics;
  const storeAiItems = storeCredits.filter((entry) => entry.aiGenerated);

  const requiresAttribution =
    usesEasyRpgRtp
    || usesScarloxy
    || usesRefmap
    || storeCredits.some((entry) => entry.requiresAttribution);

  const steamAiDisclosureReasons: SteamAiDisclosureReason[] = [];
  if (usesAiBgm) {
    const names = aiBgmTracks.map((track) => track.name).join(", ");
    steamAiDisclosureReasons.push({
      code: "ai-bgm",
      ko: `AI 생성 음악(OPRN BGM / Google Lyria 등) ${aiBgmTracks.length}곡 사용: ${names}`,
      en: `Uses ${aiBgmTracks.length} AI-generated music track(s) (e.g. OPRN BGM / Google Lyria): ${names}`,
    });
  }
  const bundledAiImages = aiGeneratedImageIds.filter((id) => !uploadedAiImageIds.includes(id));
  if (bundledAiImages.length > 0) {
    steamAiDisclosureReasons.push({
      code: "ai-images",
      ko: `AI 생성 번들 이미지(오프닝 스틸·초상·트레이너·생성 몬스터 등) ${bundledAiImages.length}종 사용`,
      en: `Uses ${bundledAiImages.length} AI-generated bundled image asset(s) (opening stills, portraits, trainers, or generated sprites)`,
    });
  }
  if (uploadedAiImageIds.length > 0) {
    steamAiDisclosureReasons.push({
      code: "ai-uploaded",
      ko: `프로젝트 내 AI 생성/공방 이미지 에셋 ${uploadedAiImageIds.length}종 포함`,
      en: `Includes ${uploadedAiImageIds.length} AI-generated or workshop-generated uploaded image asset(s)`,
    });
  }
  if (storeAiItems.length > 0) {
    const titles = storeAiItems.map((item) => item.title).join(", ");
    steamAiDisclosureReasons.push({
      code: "ai-store",
      ko: `AI 생성 표시가 있는 에셋 스토어 팩 ${storeAiItems.length}종 포함: ${titles}`,
      en: `Includes ${storeAiItems.length} Asset Store pack(s) marked as AI-generated: ${titles}`,
    });
  }

  return {
    usesEasyRpgRtp,
    usesEasyRpgRtpGraphics,
    usesEasyRpgRtpAudio,
    usesScarloxy,
    usesRefmap,
    usesAiBgm,
    aiBgmTracks,
    usesAiGeneratedImages,
    aiGeneratedImageIds,
    usesCc0Assets,
    usesCc0Audio,
    usesCc0Graphics,
    storeCredits,
    requiresAttribution,
    requiresSteamAiDisclosure: steamAiDisclosureReasons.length > 0,
    steamAiDisclosureReasons,
  };
}
