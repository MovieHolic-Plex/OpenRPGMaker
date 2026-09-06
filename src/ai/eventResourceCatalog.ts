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
import { SE_CATALOG, SE_CATALOG_CATEGORIES } from "@/assets/seCatalog";
import { listMovieResources } from "@/assets/movieResourceCatalog";
import { resolvePictureSource } from "@/player/pictures/pictureResources";
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

/** 흉상·전신 대형 초상 id 의 공통 접두사(`generated-face-actor1-bust` 등). */
const GENERATED_FACE_PREFIX = "generated-face-";

/**
 * 프롬프트가 실을 장면 축. 카탈로그 머리 40곡을 그대로 자르면 모델이 항상 같은
 * 40곡만 보고, 마을/필드/숲/던전/밤/전투/타이틀이 한두 곡씩만 섞인 채 끝난다.
 * 검증 집합은 카탈로그 전체를 그대로 받는다 — 여기는 절단 앞에 살아남을 순서만 바꾼다.
 */
const BGM_PROMPT_SCENES = ["village", "field", "forest", "dungeon", "night", "battle", "title"] as const;
type BgmPromptScene = (typeof BGM_PROMPT_SCENES)[number];

/**
 * Phase 1 `THEME_RULES.categoryNeedles` (bgmThemeRecommendation.ts) 그대로.
 * 맵 자동 BGM 과 프롬프트 머리가 같은 곡을 장면으로 보게 한다.
 * cave 는 프롬프트 7축에 없어서 dungeon 으로 접고, title 만 프롬프트 전용이다.
 */
const BGM_PROMPT_SCENE_RULES: readonly { scene: BgmPromptScene; needles: readonly string[] }[] = [
  { scene: "title", needles: ["타이틀", "메뉴"] },
  { scene: "battle", needles: ["전투", "보스"] },
  { scene: "night", needles: ["야간 · 휴식", "밤"] },
  { scene: "dungeon", needles: ["던전", "유적", "동굴", "광산", "광물"] },
  {
    scene: "village",
    needles: ["마을", "광장", "길드", "회관", "시장 · 아침 생활", "축제", "과수원", "어촌", "찻집", "공원", "양봉"],
  },
  { scene: "forest", needles: ["숲 · 탐험", "잎다리", "소나무", "양치식물", "사과꽃"] },
  { scene: "field", needles: ["필드", "초원", "장거리"] },
];

function bgmPromptScene(category: string): BgmPromptScene | null {
  for (const rule of BGM_PROMPT_SCENE_RULES) {
    if (rule.needles.some((needle) => category.includes(needle))) return rule.scene;
  }
  return null;
}

function addRoundRobin<T>(
  items: readonly T[],
  keys: readonly string[],
  keyOf: (item: T) => string | null,
  addItem: (item: T) => void,
): void {
  const buckets = new Map<string, T[]>();
  for (const key of keys) buckets.set(key, []);
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) continue;
    buckets.get(key)?.push(item);
  }
  let index = 0;
  for (;;) {
    let addedAny = false;
    for (const key of keys) {
      const item = buckets.get(key)?.[index];
      if (!item) continue;
      addItem(item);
      addedAny = true;
    }
    if (!addedAny) break;
    index += 1;
  }
}

/**
 * 상자·동전·징글·문·발소리. SE 카탈로그 머리는 UI 클릭이라 MAX_REF_ENTRIES(40) 에
 * 잘리면 맵 이벤트에 쓸 기능음이 프롬프트에서 사라진다. id 는 seCatalog 에 있다.
 */
const PROMPT_SE_HEAD_IDS = [
  "cc0-se-osx-wooded-box-open",
  "cc0-se-orp-inventory-coin",
  "cc0-se-kjg-8-bit-jingles-jingles-nes09",
  "cc0-se-kra-dooropen-1",
  "cc0-se-kra-doorclose-1",
  "cc0-se-kis-footstep-wood-000",
] as const;

function collect(
  slot: EventResourceSlot,
  project: Pick<Project, "assets" | "resourceProfiles">,
): EventResourceOption[] {
  const options = new Map<string, EventResourceOption>();
  const add = (id: string, name: string): void => {
    if (!id || options.has(id)) return;
    options.set(id, { id, name: name || id });
  };

  switch (slot) {
    case "faceset":
      // 흉상·전신 프리셋을 **맨 앞에** 둔다. 낱장 얼굴이 112장이라 뒤에 붙이면
      // MAX_REF_ENTRIES(40) 에 잘려 프롬프트에서 사라진다 — 그러면 「초상을 크게 띄우기」가
      // 가능하다는 사실을 모델이 알 수가 없다. 이 둘이 대사창 위 대형 초상
      // 레이아웃(facesetPreview.faceDisplayModeOf)을 여는 유일한 열쇠다.
      for (const id of builtinGeneratedResourceIds()) {
        if (id.startsWith(GENERATED_FACE_PREFIX)) add(id, `${id} (대형 초상 레이아웃)`);
      }
      // 낱장 얼굴 112장. 분할 전 4×4 시트 id 는 저장본 호환으로 등록만 남아 있으므로 뺀다 —
      // 시트를 얼굴 한 장으로 지정하면 대화창에 엉뚱한 칸이 뜬다.
      for (const asset of FACESET_FACE_ASSETS) add(asset.id, asset.name);
      break;
    case "music": {
      // 장면 축을 라운드로빈으로 **맨 앞에** 둔다. 카탈로그 순서를 그대로 실으면
      // slice(0, 40) 이 항상 같은 머리 40곡이다. add 는 중복을 건너뛰므로 아래
      // 전체 카탈로그 add 가 검증 집합을 그대로 채운다.
      addRoundRobin(
        BGM_CATALOG,
        BGM_PROMPT_SCENES,
        (track) => bgmPromptScene(track.category),
        (track) => add(track.id, bgmTrackLabel(track)),
      );
      // 카탈로그(281곡)가 이 에디터의 기본 BGM 세트다.
      for (const track of BGM_CATALOG) add(track.id, bgmTrackLabel(track));
      for (const asset of CC0_MUSIC_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_MUSIC_ASSETS) add(asset.id, asset.name);
      break;
    }
    case "sound":
      for (const id of PROMPT_SE_HEAD_IDS) {
        const entry = SE_CATALOG.find((item) => item.id === id);
        if (entry) add(entry.id, `${entry.title} — ${entry.category}`);
      }
      // 카탈로그 머리는 UI 클릭이라 그대로 실으면 나머지 34개가 한 분류다.
      addRoundRobin(
        SE_CATALOG,
        SE_CATALOG_CATEGORIES,
        (entry) => entry.category,
        (entry) => add(entry.id, `${entry.title} — ${entry.category}`),
      );
      for (const entry of SE_CATALOG) add(entry.id, `${entry.title} — ${entry.category}`);
      for (const asset of CC0_SOUND_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_SOUND_ASSETS) add(asset.id, asset.name);
      break;
    case "picture":
      // 그림 칸은 **제안용 목록**이다. 유효성 판정은 런타임 해석기가 한다
      // (eventCommandAssist 의 walkResourceSlots -> resolvePictureSource) — 폼이 자유 입력이고
      // 「그림 선택」 픽커는 `kind: "image"` 로 454개를 제시하므로, 이 목록을 검증 기준으로
      // 쓰면 픽커가 권한 164개를 반려한다(실측).
      //
      // 목록에는 **런타임이 실제로 그릴 수 있는 id 만** 담는다(아래에서 걸러낸다). 칩셋 이미지
      // 10개는 `resolvePictureSource` 가 해석하지 못해 화면에 아무것도 안 나오므로 뺀다 —
      // `newCommand("showPicture")` 의 기본값 `tex_tiles_default` 도 그중 하나다(실측 resolves=false).
      // 제안이 검증을 통과하지 못하면 그것이 곧 프롬프트의 자기모순이다.
      for (const id of Object.keys(project.assets.sprites)) add(id, id);
      break;
    case "movie":
      // 동영상은 업로드로만 들어온다 — 판정 근거는 movieResourceCatalog 가 소유한다.
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
  const collected = [...options.values()];
  // 제안 목록은 검증이 받아 주는 집합의 부분집합이어야 한다. 그림 칸의 판정 권위는 런타임
  // 해석기이므로 여기서 같은 함수로 걸러, "권했는데 반려" 가 구조적으로 불가능해진다.
  if (slot === "picture") {
    return collected.filter((option) => resolvePictureSource(option.id, project) !== null);
  }
  return collected;
}

/**
 * 종류 판정. 문자열 접두어 규칙은 databaseResourcePickerDialog 의 `matchesGeneratedKind`
 * 와 같은 근거를 쓴다 — 생성 자산은 선언된 `resourceKind` 가 없을 수 있어서다.
 */
function matchesSlot(slot: EventResourceSlot, kind: string | undefined, id: string): boolean {
  switch (slot) {
    case "faceset":
      if (LEGACY_FACESET_SHEET_IDS.includes(id)) return false;
      // 폼의 프리셋 버튼이 지정하는 `generated-face-*`(흉상·전신)을 반드시 받는다 — 이전
      // 구현은 이 둘을 반려해서, UI 가 스스로 권하는 리소스로 「초상 띄우기」를 시키면
      // 자가수정 3회를 다 태운 뒤 하드 실패했다. 같은 접두사 판정을 폼(faceDisplayModeOf)도 쓴다.
      return (
        kind === "faceset"
        || id.startsWith(GENERATED_FACE_PREFIX)
        || (id.startsWith("generated-actor-") && id.endsWith("-face"))
      );
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
  project: Pick<Project, "assets" | "resourceProfiles">,
): readonly EventResourceOption[] {
  return collect(slot, project);
}

/** 이 슬롯의 유효 id 집합. 프롬프트가 실은 목록과 검증이 보는 집합이 같아야 한다. */
export function eventResourceIdSet(
  slot: EventResourceSlot,
  project: Pick<Project, "assets" | "resourceProfiles">,
): Set<string> {
  return new Set(collect(slot, project).map((option) => option.id));
}
