// editor/newProjectChoices.ts
// 새 프로젝트 선택의 단일 정본.
//
// 왜 생겼나 (2026-09-11): "새 프로젝트 만들기" 표면이 둘로 갈라져 각자 자랐다 —
// 첫 화면 웰컴 브리핑(editorWelcome.ts)의 포스터 8장과 「새 프로젝트」 다이얼로그
// (ui/newProjectDialog.ts)의 행 7개가 같은 팩을 서로 다른 이름·설명으로 보여 줬다.
// 실측: story-cutscene 은 첫 화면에서 "회상 스토리", 다이얼로그에서 "스토리 컷신" 이었고,
// horror-chase 는 첫 화면에서 "갤러리 호러"/"학교 호러" 두 장, 다이얼로그에서 "공포 추격" 한 줄이었다.
// 사용자가 첫 화면에서 고른 이름이 두 번째 화면에서 사라진 것처럼 보이는 원인이다.
//
// 이 모듈은 라벨·설명·썸네일·프롬프트를 한 레코드로 모으고, 두 표면은 여기서 파생된다.
// 표면별 크롬(포스터 격자 vs 모달 행)과 첫 화면 전용 변형은 그대로 남는다.

import type { GenrePackId } from "@/project/genrePackId";

/**
 * 새 프로젝트 선택지의 정본 id.
 *
 * 공식 팩은 6개(GENRE_PACK_IDS)지만 선택지는 8개다 — horror-chase 와 monster-collect 는
 * "사용자가 들어오는 제목" 이 둘로 갈리기 때문이다(갤러리/학교, 수집/육성).
 * 변형은 같은 packId·recipeId 를 가리키고 저장 시 하나의 팩으로 합쳐진다.
 */
export type NewProjectChoiceId =
  | "action-rpg"
  | "monster-collect"
  | "partner-raise"
  | "farm-life"
  | "adventure-jrpg"
  | "horror-gallery"
  | "school-horror"
  | "story-cutscene";

export type NewProjectChoice = {
  readonly id: NewProjectChoiceId;
  /** 저장·런타임이 아는 유일한 장르 id. 변형은 같은 팩을 가리킨다. */
  readonly packId: GenrePackId;
  readonly systemPresetRecipeId: string;
  /** 정본 표시 이름. 두 표면이 이 값을 그대로 쓴다. */
  readonly label: string;
  /** 한 줄 설명 — 포스터 자막과 다이얼로그 행이 공유한다. */
  readonly blurb: string;
  readonly thumb: string;
  /**
   * 다이얼로그 행 전용 그림. 포스터 그림이 같은 팩 형제와 겹칠 때만 지정한다 —
   * 다이얼로그는 선택지를 한 화면에 전부 깔아 보이므로, 같은 그림이 두 행에 있으면
   * 골랐을 때 무엇이 달라지는지 읽히지 않는다. 없으면 thumb 을 쓴다.
   */
  readonly rowThumb?: string;
  /** AI 프롬프트에 주입하는 톤 한 줄. */
  readonly tone: string;
  /**
   * 원작 참조 접두("이브 같은"). 포스터 눈썹줄로만 쓰고 이름에는 넣지 않는다 —
   * 이름이 길어지면 포스터 자막이 줄바꿈으로 깨진다.
   */
  readonly reference?: string;
  /** 포스터 자막. 참조가 없으면 label 과 같다. */
  readonly posterTitle?: string;
  /** 첫 화면 격자에 노출하는가. 나머지는 「이런 세계도 있어요」 접힘 단에 남는다. */
  readonly featured?: boolean;
};

/**
 * 정본 순서 = 첫 화면 포스터 순서. featured 3장이 먼저 오고, 접힘 5장이 뒤따른다 —
 * 팩 앵커(공식 팩당 포스터 정확히 1장)가 가능한 한 보이는 포스터에 붙도록 하기 위해서다.
 */
export const NEW_PROJECT_CHOICES: readonly NewProjectChoice[] = [
  {
    id: "monster-collect",
    packId: "monster-collect",
    systemPresetRecipeId: "monster-system",
    label: "몬스터 수집",
    blurb: "수집 · 조우 · 도감",
    thumb: "/assets/generated/welcome/slide-01.png",
    tone: "포획·도감·야생 조우 중심. 스타터 몬스터와 간단한 풀숲 인카운트 흐름을 우선한다.",
    featured: true,
  },
  {
    id: "story-cutscene",
    packId: "story-cutscene",
    systemPresetRecipeId: "story-system",
    label: "회상 스토리",
    blurb: "회상 · 컷신 · 엔딩",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    tone: "투더문식 회상·감정 연출 중심. 전투보다 컷신 호흡과 엔딩 분기를 우선한다. 기존 작품 고유명/캐릭터 복제 금지.",
    featured: true,
  },
  {
    id: "adventure-jrpg",
    packId: "adventure-jrpg",
    systemPresetRecipeId: "adventure-system",
    label: "모험 JRPG",
    blurb: "파티 · 던전",
    thumb: "/assets/generated/welcome/slide-04.png",
    tone: "파티 모험·던전 탐험 중심. 시작 마을과 던전 입구, 기본 전투 적을 우선한다.",
    featured: true,
  },
  {
    id: "horror-gallery",
    packId: "horror-chase",
    systemPresetRecipeId: "horror-system",
    label: "이브 같은 갤러리 호러",
    blurb: "미술관 · 단서 · 공포",
    thumb: "/assets/generated/welcome/slide-05.png",
    tone: "미술관·회랑 탐험 호러 중심. 이상 회화/오브젝트 상호작용, 단서 아이템, 긴장감 있는 짧은 이벤트 루프를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    reference: "이브 같은",
    posterTitle: "갤러리 호러",
  },
  {
    id: "school-horror",
    packId: "horror-chase",
    systemPresetRecipeId: "horror-system",
    label: "아오오니 같은 학교 호러",
    blurb: "학교 · 추적 · 공포",
    thumb: "/assets/generated/welcome/slide-06.png",
    tone: "야간 학교 회랑 추적 호러 중심. 숨기/도주 이벤트, 단서 아이템, 위협 실루엣 조우를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    reference: "아오오니 같은",
    posterTitle: "학교 호러",
  },
  {
    id: "farm-life",
    packId: "farm-life",
    systemPresetRecipeId: "farm-system",
    label: "농장 생활",
    blurb: "농장 · 일상",
    thumb: "/assets/generated/welcome/slide-03.png",
    tone: "농장·일상·마을 NPC 중심. 밭/도구 아이템과 주민 대사를 우선한다.",
  },
  {
    id: "partner-raise",
    packId: "monster-collect",
    systemPresetRecipeId: "monster-system",
    label: "파트너 육성",
    blurb: "파트너 · 진화",
    thumb: "/assets/generated/welcome/slide-02.png",
    tone: "파트너 몬스터 육성·진화·유대 중심. 파트너 NPC/이벤트와 성장 아이템을 우선한다.",
  },
  {
    id: "action-rpg",
    packId: "action-rpg",
    systemPresetRecipeId: "action-system",
    label: "2D 액션 RPG",
    blurb: "필드 공격 · 회피 · 가드",
    thumb: "/assets/generated/welcome/slide-04.png",
    // 포스터 원반은 모험 JRPG 와 같은 slide-04 다. 필드 조작이 보이는 그림으로 행을 갈라 둔다.
    rowThumb: "/assets/generated/welcome/slide-00-hero.png",
    tone: "타일 맵에서 실시간 공격·회피·가드 중심. 기존 맵과 DB를 읽고 작은 전투 공간에서 먼저 실제 전투를 검증한다.",
  },
] as const;

export function newProjectChoiceById(id: string | undefined): NewProjectChoice | undefined {
  return NEW_PROJECT_CHOICES.find((choice) => choice.id === id);
}

export function newProjectChoiceByLabel(label: string): NewProjectChoice | undefined {
  const trimmed = label.trim();
  return NEW_PROJECT_CHOICES.find((choice) => choice.label === trimmed);
}

/** 정본 표시 이름. 다이얼로그의 행 라벨과 토스트 문구가 같은 값을 쓴다. */
export function newProjectChoiceLabelById(id: NewProjectChoiceId | undefined): string {
  return newProjectChoiceById(id)?.label ?? "빈 프로젝트";
}

/** 포스터 자막 — 참조가 있으면 짧은 쪽을 쓴다. */
export function newProjectChoicePosterTitle(choice: NewProjectChoice): string {
  return choice.posterTitle ?? choice.label;
}

/** 행 그림 — 포스터 그림을 기본으로 쓰고, 형제와 겹칠 때만 갈라진 그림을 쓴다. */
export function newProjectChoiceRowThumb(choice: NewProjectChoice): string {
  return choice.rowThumb ?? choice.thumb;
}

/**
 * 정본 순서에서 공식 팩마다 앵커를 한 번만 붙인다.
 * 앵커 = 그 팩을 대표하는 포스터. 같은 팩의 형제 변형은 앵커가 아니다 —
 * 그래야 "공식 팩당 data-pack-id 정확히 1개" DOM 게이트가 유지된다.
 */
export function newProjectChoicePackAnchors(): Readonly<Record<NewProjectChoiceId, GenrePackId | null>> {
  const anchored = new Set<GenrePackId>();
  const out = {} as Record<NewProjectChoiceId, GenrePackId | null>;
  for (const choice of NEW_PROJECT_CHOICES) {
    const anchor = anchored.has(choice.packId) ? null : choice.packId;
    if (anchor) anchored.add(anchor);
    out[choice.id] = anchor;
  }
  return out;
}

/**
 * 「새 프로젝트」 다이얼로그의 행 순서.
 *
 * 첫 화면의 featured 3장을 먼저 두고 나머지를 정본 순서로 잇는다. 다이얼로그는 한 화면에
 * 전부를 깔아 보이므로, 사용자가 첫 화면에서 고른 이름이 같은 자리에서 다시 읽혀야 한다.
 * 공식 팩 형제(horror-chase 2장, monster-collect 2장)는 라벨이 달라도 같은 팩으로 저장된다는
 * 사실이 설명줄에 이미 들어 있다.
 */
export const NEW_PROJECT_DIALOG_CHOICE_ORDER: readonly NewProjectChoiceId[] = [
  "monster-collect",
  "story-cutscene",
  "adventure-jrpg",
  "horror-gallery",
  "school-horror",
  "farm-life",
  "partner-raise",
  "action-rpg",
] as const;
