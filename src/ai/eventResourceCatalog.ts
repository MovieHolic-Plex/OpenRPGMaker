// ai/eventResourceCatalog.ts
// 이벤트 명령이 요구하는 resourceId 를 **종류별로** 열거한다(브라우저 DOM 접근 금지).
//
// 왜 종류별인가 (실측): 예전에는 프롬프트가 `collectResourceIds(project)` 를 한 덩어리로
// 실었다. 블랭크 프로젝트에서 그 집합은 1851개이고 앞 40개가 전부 `tex_*` 칩셋·캐릭셋과
// `cc0-jetrel-*` 아이콘이라 **얼굴·음악·효과음·그림 id 가 한 개도 안 보였다**. 게다가 참조
// 검증은 순수 집합 소속 검사(io/commandReferenceValidation)라서
// `{"kind":"playAudio","resourceId":"tex_easyrpg_chipset_dungeon"}` 가 통과해 조용히 깨진
// 이벤트로 출하됐다 — 자가수정 루프가 볼 수 있는 오류가 아예 발생하지 않았다.
//
// 목록의 출처는 **에디터 폼이 쓰는 카탈로그 그대로**다(databaseResourcePickerDialog 의
// faceset/music/sound 분기, showPicture 의 sprites, playMoviePreview 의 업로드 동영상).
// 여기서 새 목록을 발명하면 저작 UI 가 제시하는 선택지와 AI 가 아는 선택지가 갈라진다.
// 픽커 모듈 자체를 import 하지 않는 이유는 그쪽이 오디오 엔진·모달·store 를 끌어오는
// 표시면 코드이고, 이 파일은 프롬프트 조립·검증에 쓰이는 순수 로직이기 때문이다.

import { BGM_CATALOG, bgmTrackLabel } from "@/assets/bgmCatalog";
import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { SE_CATALOG } from "@/assets/seCatalog";
import { listMovieResources } from "@/editor/panels/eventEditor/playMoviePreview";
import type { Project } from "@/project/types";

/** 이벤트 명령의 resourceId 칸이 실제로 요구하는 리소스 종류. */
export type EventResourceSlot = "faceset" | "music" | "sound" | "picture" | "movie";

export type EventResourceOption = {
  readonly id: string;
  readonly name: string;
};

/** 사람이 읽는 슬롯 이름. 프롬프트 절 제목과 검증 오류 문구가 같은 낱말을 쓴다. */
export const EVENT_RESOURCE_SLOT_LABELS: Record<EventResourceSlot, string> = {
  faceset: "얼굴",
  music: "음악(BGM)",
  sound: "효과음(SE)",
  picture: "그림",
  movie: "동영상",
};

function collect(
  slot: EventResourceSlot,
  project: Pick<Project, "assets" | "resourceProfiles" | "tilesets">,
): EventResourceOption[] {
  const options = new Map<string, EventResourceOption>();
  const add = (id: string, name: string): void => {
    if (!id || options.has(id)) return;
    options.set(id, { id, name: name || id });
  };

  switch (slot) {
    case "faceset":
      // 낱장 얼굴 112장. 분할 전 4×4 시트 id 는 저장본 호환으로 등록만 남아 있으므로 뺀다 —
      // 시트를 얼굴 한 장으로 지정하면 대화창에 엉뚱한 칸이 뜬다.
      for (const asset of FACESET_FACE_ASSETS) add(asset.id, asset.name);
      break;
    case "music":
      // 카탈로그(281곡)가 이 에디터의 기본 BGM 세트다.
      for (const track of BGM_CATALOG) add(track.id, bgmTrackLabel(track));
      for (const asset of CC0_MUSIC_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_MUSIC_ASSETS) add(asset.id, asset.name);
      break;
    case "sound":
      for (const entry of SE_CATALOG) add(entry.id, `${entry.title} — ${entry.category}`);
      for (const asset of CC0_SOUND_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_SOUND_ASSETS) add(asset.id, asset.name);
      break;
    case "picture":
      // showPicture 는 폼이 자유 입력 + `resolveAssetResourceUrl` 해석이라 **해석되는 이미지면 다** 그린다.
      // 그래서 칩셋 이미지도 유효하다 — `newCommand("showPicture")` 의 기본값이 실제로
      // `tex_tiles_default` 다. 이걸 배제하면 프롬프트가 실은 자기 예시를 검증이 반려하는
      // 모순으로 돌아간다. 오디오·얼굴처럼 재생 경로가 좀은 종류만 엄감하게 닫는다.
      for (const id of Object.keys(project.assets.sprites)) add(id, id);
      for (const tileset of Object.values(project.tilesets ?? {})) {
        if (tileset.image?.id) add(tileset.image.id, `${tileset.name || tileset.image.id} (칩셋 이미지)`);
      }
      break;
    case "movie":
      // 동영상은 업로드로만 들어온다 — 판정 근거는 playMoviePreview 가 소유한다.
      for (const entry of listMovieResources(project)) add(entry.id, entry.name);
      break;
  }

  // 생성 자산과 업로드는 선언한 종류로 붙는다. 저작자가 올린 것이 카탈로그보다 앞선 의도이므로
  // 목록에서 빼지 않는다.
  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status !== "promoted") continue;
    if (matchesSlot(slot, asset.resourceKind, asset.resourceId)) add(asset.resourceId, asset.resourceId);
  }
  for (const id of builtinGeneratedResourceIds()) {
    if (matchesSlot(slot, undefined, id)) add(id, id);
  }
  for (const profile of project.resourceProfiles) {
    if (profile.assetId && matchesSlot(slot, profile.kind, profile.assetId)) {
      add(profile.assetId, profile.name || profile.assetId);
    }
  }
  for (const [id, uploaded] of Object.entries(project.assets.uploaded ?? {})) {
    if (matchesSlot(slot, uploaded.kind, id)) add(id, uploaded.name || id);
  }
  return [...options.values()];
}

/**
 * 종류 판정. 문자열 접두어 규칙은 databaseResourcePickerDialog 의 `matchesGeneratedKind`
 * 와 같은 근거를 쓴다 — 생성 자산은 선언된 `resourceKind` 가 없을 수 있어서다.
 */
function matchesSlot(slot: EventResourceSlot, kind: string | undefined, id: string): boolean {
  switch (slot) {
    case "faceset":
      if (LEGACY_FACESET_SHEET_IDS.includes(id)) return false;
      return kind === "faceset" || (id.startsWith("generated-actor-") && id.endsWith("-face"));
    case "music":
      return (
        kind === "music"
        || id.startsWith("easyrpg-music-")
        || id.startsWith("cc0-music-")
        || id.startsWith("cc0-bgm-")
      );
    case "sound":
      return (
        kind === "sound"
        || id.startsWith("easyrpg-sound-")
        || id.startsWith("cc0-sound-")
        || id.startsWith("cc0-se-")
      );
    case "picture":
      return kind === "picture" || kind === "sprite";
    case "movie":
      return kind === "movie";
  }
}

/** 이 슬롯에 실제로 고를 수 있는 리소스 목록(등장 순서 = 에디터 픽커 순서). */
export function listEventResourceOptions(
  slot: EventResourceSlot,
  project: Pick<Project, "assets" | "resourceProfiles" | "tilesets">,
): readonly EventResourceOption[] {
  return collect(slot, project);
}

/** 이 슬롯의 유효 id 집합. 프롬프트가 실은 목록과 검증이 보는 집합이 같아야 한다. */
export function eventResourceIdSet(
  slot: EventResourceSlot,
  project: Pick<Project, "assets" | "resourceProfiles" | "tilesets">,
): Set<string> {
  return new Set(collect(slot, project).map((option) => option.id));
}
