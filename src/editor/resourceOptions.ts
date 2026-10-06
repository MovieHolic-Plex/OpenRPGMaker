// editor/resourceOptions.ts
// 리소스 종류별 후보 목록의 단일 정본 — DB 피커와 AI 툴이 같은 목록을 봐야 한다.
// DOM/스토어를 모르는 순수 모듈이라 툴 레이어(headless 포함)에서도 쓸 수 있다.
import { findSharedPortrait } from "@/assets/sharedPortraitAssets";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import {
  EASYRPG_BACKDROP_ASSETS,
  EASYRPG_BATTLE_ASSETS,
  EASYRPG_SYSTEM2_ASSETS,
  EASYRPG_SYSTEM_ASSETS,
  EASYRPG_TITLE_ASSETS,
} from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { GENERATED_EFFECT_SHEET_ASSETS } from "@/assets/generatedEffectSheets";
import { charsetBattler } from "@/assets/charsetBattlers";
import { partyPixelLabel, partyPixelSheet } from "@/assets/partyPixelSheets";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { listOpeningStillMoods } from "@/assets/openingStillMoods";
import { OGA_BACKDROP_ASSETS } from "@/assets/ogaBackdropAssets";
import { OGA_CRAFTPIX_BACKDROP_ASSETS } from "@/assets/ogaCraftpixBackgrounds";
import {
  SCARLOXY_BACKDROP_ASSETS,
  SCARLOXY_MONSTER_ICON_ASSETS,
  SCARLOXY_UI_ICON_ASSETS,
} from "@/assets/scarloxyPack";
import type { Project, ResourceKind } from "@/project/types";
import { faceReferenceMetadata, isAuthorableFaceReference } from "@/project/faceReferenceMetadata";

export type DatabaseResourcePickerKind =
  | "icon"
  | "image"
  /**
   * 시네마틱 스틸(오프닝·게임 오버 배경) 전용. 전체화면 아트를 앞에 두고, 뒤에 image 카탈로그를
   * 통째로 이어 붙여 기존 저장본의 아이콘 참조도 계속 유효하게 둔다.
   */
  | "still"
  | "movie"
  | "picture"
  | "monster"
  | "faceset"
  | "charset"
  | "battleCharset"
  | "title"
  | "music"
  | "sound"
  | "system"
  | "system2"
  | "backdrop"
  | "battle";

export type DatabaseResourceOption = {
  readonly id: string;
  readonly name: string;
  /**
   * 검색 전용 보조 낱말(카테고리·감정·악기 등). 라벨에 다 적으면 목록이 읽히지 않으므로
   * 표시에서 빼고 검색에만 쓴다. BGM 카탈로그 281곡을 "던전"/"보스"로 찾게 하는 배선이다.
   */
  readonly searchTerms?: readonly string[];
};

export function prettyId(id: string): string {
  return id.replace(/^generated-(actor|enemy|item|equipment)-/u, "").replaceAll("-", " ");
}

/**
 * 고르는 목록에서 뺀 옛 전투 그림(2026-10-03 deprecated/). 은퇴 스킨 배경 전부, 옛 숲 레퍼런스, AI 고치·씨앗,
 * 배경 목록에 끼던 슬라임 미리보기, EasyRPG Hornet. id 는 저장본·공용 장소가 들고 있어 리졸버에 별칭으로
 * 남기고(지금 그림을 가리킨다), 새로 고르는 목록에서만 뺀다.
 */
const RETIRED_PICKER_IDS: ReadonlySet<string> = new Set([
  ...["rm2000", "rm2003", "dragonquest", "mother", "mv", "vxace", "ff", "chrono", "octopath", "bravely", "goldensun", "pokemon"]
    .map((skin) => `battle-skin-${skin}-backdrop`),
  "generated-battle-reference-forest",
  "generated-enemy-reference-cocoon",
  "generated-enemy-reference-seed-back",
  "generated-troop-preview-slime",
  "easyrpg-monster-hornet",
]);

/**
 * 데이터베이스 피커와 이벤트 명령 폼, 그리고 AI 오프닝 툴이 함께 쓰는 리소스 목록의 단일 정본이다.
 * 표시 순서와 장면어 검색 태그가 저작 표면마다 어긋나지 않게 한다.
 */
export function listDatabaseResourceOptions(
  kind: DatabaseResourcePickerKind,
  project: Project
): readonly DatabaseResourceOption[] {
  const options = new Map<string, DatabaseResourceOption>();
  const add = (id: string, name: string, searchTerms?: readonly string[]): void => {
    if (!id || options.has(id)) return;
    if (kind === "faceset") {
      if (!isAuthorableFaceReference(id, project)) return;
      const metadata = faceReferenceMetadata(id, name, project);
      name = metadata.name;
      searchTerms = [...metadata.searchTerms, metadata.description];
    }
    options.set(id, { id, name, searchTerms });
  };

  switch (kind) {
    case "movie":
      for (const profile of project.resourceProfiles) {
        if (profile.kind === "movie" && profile.assetId) {
          add(profile.assetId, profile.name || profile.assetId);
        }
      }
      break;
    case "faceset":
      // 낱장 얼굴 — 분할 전 시트 id 는 저장본 호환으로 등록만 남고 피커에서는 빠진다.
      // 생성 시리즈(hero-XX-face)도 리소스 관리자와 같은 규칙으로 목록에서 내린다.
      for (const asset of AUTHORABLE_FACESET_FACE_ASSETS) add(asset.id, asset.name);
      break;
    case "charset":
      for (const asset of CHARSET_ASSETS) add(asset.id, asset.name);
      break;
    case "monster":
      return listMonsterResources(project).map(resource => ({
        id: resource.resourceId,
        name: resource.name,
        searchTerms: [...resource.tags, resource.description],
      }));
    case "title":
      for (const asset of EASYRPG_TITLE_ASSETS) add(asset.id, asset.name);
      break;
    case "music":
    case "sound":
      return listAudioResources(kind, project).map(resource => ({
        ...resource,
        searchTerms: [...resource.tags, resource.description],
      }));
    case "system":
      for (const asset of EASYRPG_SYSTEM_ASSETS) add(asset.id, asset.name);
      break;
    case "system2":
      for (const asset of EASYRPG_SYSTEM2_ASSETS) add(asset.id, asset.name);
      break;
    case "backdrop":
      for (const asset of EASYRPG_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of OGA_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of OGA_CRAFTPIX_BACKDROP_ASSETS) add(asset.id, asset.name);
      break;
    case "still":
      // 전체화면 연출용 아트가 먼저다 — 아이템 아이콘이 첫 화면을 채우면 AI도 사람도 못 고른다.
      for (const mood of listOpeningStillMoods()) add(mood.id, mood.name,
        [...mood.tags, mood.description, ...mood.mood, ...mood.useCases, mood.series]);
      for (const asset of EASYRPG_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of OGA_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of OGA_CRAFTPIX_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_TITLE_ASSETS) add(asset.id, asset.name);
      for (const profile of project.resourceProfiles) {
        if (profile.kind === "gameOver" && profile.assetId) add(profile.assetId, profile.name || profile.assetId);
      }
      break;
    case "battle":
      for (const asset of EASYRPG_BATTLE_ASSETS) add(asset.id, asset.name);
      for (const asset of GENERATED_EFFECT_SHEET_ASSETS) add(asset.id, asset.name);
      break;
    case "icon":
    case "image":
      for (const asset of CC0_ICON_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_MONSTER_ICON_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_UI_ICON_ASSETS) add(asset.id, asset.name);
      break;
    case "battleCharset":
    case "picture":
      break;
  }

  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status !== "promoted" || RETIRED_PICKER_IDS.has(asset.resourceId)) continue;
    if (matchesGeneratedKind(kind, asset.resourceKind, asset.resourceId)) {
      add(asset.resourceId, `${prettyId(asset.resourceId)} <생성>`);
    }
  }
  for (const id of builtinGeneratedResourceIds()) {
    if (RETIRED_PICKER_IDS.has(id)) continue;
    if (matchesGeneratedKind(kind, undefined, id)) add(id, charsetBattler(id)?.label ?? findSharedPortrait(id)?.name ?? (partyPixelSheet(id) ? partyPixelLabel(partyPixelSheet(id)!) : `${prettyId(id)} <생성>`));
  }
  for (const [id, uploaded] of Object.entries(project.assets.uploaded ?? {})) {
    if (uploadedMatchesKind(kind, uploaded.kind, id)) {
      add(id, uploaded.name || id);
    }
  }
  if (kind === "faceset") for (const profile of project.resourceProfiles) {
    if (profile.kind === "faceset" && profile.assetId) add(profile.assetId, profile.name || profile.assetId);
  }
  if (kind === "picture") {
    // Static map objects use the same whole-image resource as item pictures.
    // Keep existing browse order, and make actual objects discoverable by name/id.
    for (const asset of CC0_ICON_ASSETS) add(asset.id, asset.name);
  }
  if (kind === "still") {
    // 호환 꼬리: 아이콘으로 저작된 기존 오프닝·게임 오버 배경이 "종류 불일치"로 사라지지 않게 한다.
    for (const option of listDatabaseResourceOptions("image", project)) {
      add(option.id, option.name, option.searchTerms);
    }
  }
  return Array.from(options.values());
}

export function matchesGeneratedKind(kind: DatabaseResourcePickerKind, resourceKind: ResourceKind | undefined, id: string): boolean {
  if (kind === "still") {
    // 아이콘 규칙은 여기서 빼고 호환 꼬리에서만 받는다(앞자리는 전체화면 아트 몫).
    return matchesGeneratedKind("backdrop", resourceKind, id)
      || matchesGeneratedKind("title", resourceKind, id)
      || matchesGeneratedKind("picture", resourceKind, id);
  }
  if (kind === "movie") return resourceKind === "movie";
  if (kind === "picture") {
    // 공용 흉상·전신은 기본 표정 한 장씩만 고르게 한다 — 대사의 표정이 나머지를 고른다(sharedPortraitAssets.ts).
    return resourceKind === "picture" || id === "generated-face-actor1-bust" || id === "generated-face-actor1-full"
      || findSharedPortrait(id)?.expression === "base";
  }
  if (kind === "faceset") {
    // 분할 전 4×4 시트는 얼굴 한 장이 아니다 — 등록만 남기고 피커 목록에서는 제외한다.
    if (LEGACY_FACESET_SHEET_IDS.includes(id)) return false;
    return resourceKind === "faceset" || Boolean(findSharedPortrait(id))
      || id === "generated-face-actor1-bust" || id === "generated-face-actor1-full"
      || (id.startsWith("generated-actor-") && id.endsWith("-face"));
  }
  if (kind === "charset") return resourceKind === "charset" || (id.startsWith("generated-actor-") && id.endsWith("-charset"));
  if (kind === "battleCharset") {
    return resourceKind === "battleCharset" || Boolean(charsetBattler(id)) || Boolean(partyPixelSheet(id)) || id === "hero" || (id.startsWith("generated-actor-") && id.endsWith("-battle"));
  }
  if (kind === "monster") return resourceKind === "monster" || id.startsWith("generated-enemy-");
  if (kind === "title") return resourceKind === "title" || id.includes("title");
  if (kind === "music") {
    return resourceKind === "music" || id.startsWith("easyrpg-music-") || id.startsWith("cc0-music-") || id.startsWith("cc0-bgm-");
  }
  if (kind === "sound") {
    return (
      resourceKind === "sound" ||
      id.startsWith("easyrpg-sound-") ||
      id.startsWith("cc0-sound-") ||
      // 456개 효과음 카탈로그. 이게 빠지면 카탈로그 항목을 고른 뒤 피커가 다시 열릴 때
      // 현재 선택이 "종류 불일치"로 판정돼 (없음) 으로 보인다.
      id.startsWith("cc0-se-")
    );
  }
  if (kind === "system") return resourceKind === "system";
  if (kind === "system2") return resourceKind === "system2";
  if (kind === "backdrop") return resourceKind === "backdrop" || id.includes("backdrop") || id.startsWith("battle-scenery-");
  if (kind === "battle") return resourceKind === "battle" || id.startsWith("easyrpg-battle-") || id.includes("battle-anim");
  if (kind === "icon") {
    return (
      id.includes("-icon") ||
      id.startsWith("cc0-jetrel-") ||
      id.startsWith("generated-item-") ||
      id.startsWith("generated-equipment-")
    );
  }
  if (kind === "image") {
    return (
      id.includes("-image") ||
      id.startsWith("cc0-jetrel-") ||
      id.startsWith("generated-item-") ||
      id.startsWith("generated-equipment-") ||
      id.startsWith("generated-enemy-")
    );
  }
  return false;
}

export function uploadedMatchesKind(
  kind: DatabaseResourcePickerKind,
  uploadedKind: string | undefined,
  id: string
): boolean {
  if (!uploadedKind) return matchesGeneratedKind(kind, undefined, id);
  if (kind === "still") {
    return uploadedKind === "picture" || uploadedKind === "backdrop" || uploadedKind === "title" || uploadedKind === "gameOver";
  }
  if (kind === "movie") return uploadedKind === "movie";
  if (kind === "picture") return uploadedKind === "picture";
  if (kind === "icon" || kind === "image") {
    return uploadedKind === "picture" || uploadedKind === "monster" || uploadedKind === "system" || matchesGeneratedKind(kind, undefined, id);
  }
  if (kind === "monster") return uploadedKind === "monster" || uploadedKind === "picture";
  if (kind === "faceset") return uploadedKind === "faceset";
  if (kind === "charset") return uploadedKind === "charset";
  if (kind === "battleCharset") return uploadedKind === "battleCharset" || uploadedKind === "charset";
  if (kind === "title") return uploadedKind === "title" || uploadedKind === "picture";
  if (kind === "music") return uploadedKind === "music";
  if (kind === "sound") return uploadedKind === "sound";
  if (kind === "system") return uploadedKind === "system";
  if (kind === "system2") return uploadedKind === "system2";
  if (kind === "backdrop") return uploadedKind === "backdrop" || uploadedKind === "picture";
  if (kind === "battle") return uploadedKind === "battle" || uploadedKind === "picture";
  return false;
}
