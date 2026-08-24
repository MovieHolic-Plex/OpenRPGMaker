// editor/welcomeGenrePresets.ts
// Welcome genre chips → fixed AI prompt templates (map + monster/item DB seed checklist).

import {
  detectNarrativeHorrorGenre,
  templateToolInstruction,
  type NarrativeHorrorGenre,
} from "@/ai/narrativeHorrorWorkPlan";
import type { GenrePackId } from "@/project/genrePackId";
import { createGenreStarterPlan, type GenreStarterPlan } from "@/editor/genrePacks";

export type WelcomeGenrePresetId =
  | "monster-collect"
  | "partner-raise"
  | "farm-life"
  | "adventure-jrpg"
  | "horror-gallery"
  | "school-horror"
  | "story-cutscene";

export type WelcomeGenrePreset = {
  readonly id: WelcomeGenrePresetId;
  /** Deterministic authoring contract. AI may enhance it, but is not required to select it. */
  readonly packId: GenrePackId;
  readonly starterRecipeId: string;
  readonly label: string;
  /** Short tone line injected into the shared checklist template. */
  readonly tone: string;
  /** Poster thumbnail for cinematic welcome grid. */
  readonly thumb: string;
  /** One-line subtitle under the poster label. */
  readonly blurb: string;
  /** Optional narrative/horror template genre for required tools. */
  readonly narrativeHorrorGenre?: NarrativeHorrorGenre;
};

/** Shared 8-item checklist from deep-interview welcome-genre-preset-pipeline. */
export const WELCOME_GENRE_CHECKLIST_LINES = [
  "새 blank 프로젝트를 전제로 작업한다 (이미 blank로 교체된 상태).",
  "장르에 맞는 시작 맵 1장을 만든다 (타일 분위기 포함).",
  "플레이어 시작 위치를 설정한다.",
  "장르 핵심 NPC/이벤트를 최소 2개 둔다.",
  "몬스터/적 또는 상호작용 대상 시드를 DB에 넣는다.",
  "관련 아이템 시드를 DB에 넣는다.",
  "모든 쓰기는 제안(changeset)으로만 제시하고, 사용자 승인 전에는 커밋하지 않는다.",
  "작업이 끝나면 사용자에게 제안 승인/거부를 요청하는 문장으로 마친다.",
] as const;

export const WELCOME_GENRE_PRESETS: readonly WelcomeGenrePreset[] = [
  {
    id: "monster-collect",
    packId: "monster-collect",
    starterRecipeId: "monster-journey",
    label: "몬스터 수집",
    tone: "포획·도감·야생 조우 중심. 스타터 몬스터와 간단한 풀숲 인카운트 흐름을 우선한다.",
    thumb: "/assets/generated/welcome/slide-01.png",
    blurb: "수집 · 조우 · 도감",
  },
  {
    id: "partner-raise",
    packId: "monster-collect",
    starterRecipeId: "partner-raise",
    label: "파트너 육성",
    tone: "파트너 몬스터 육성·진화·유대 중심. 파트너 NPC/이벤트와 성장 아이템을 우선한다.",
    thumb: "/assets/generated/welcome/slide-02.png",
    blurb: "파트너 · 진화",
  },
  {
    id: "farm-life",
    packId: "farm-life",
    starterRecipeId: "farm-blank",
    label: "농장 생활",
    tone: "농장·일상·마을 NPC 중심. 밭/도구 아이템과 주민 대사를 우선한다.",
    thumb: "/assets/generated/welcome/slide-03.png",
    blurb: "농장 · 일상",
  },
  {
    id: "adventure-jrpg",
    packId: "adventure-jrpg",
    starterRecipeId: "adventure-village",
    label: "모험 JRPG",
    tone: "파티 모험·던전 탐험 중심. 시작 마을과 던전 입구, 기본 전투 적을 우선한다.",
    thumb: "/assets/generated/welcome/slide-04.png",
    blurb: "파티 · 던전",
  },
  {
    id: "story-cutscene",
    packId: "story-cutscene",
    starterRecipeId: "memory-story",
    label: "회상 스토리",
    tone: "투더문식 회상·감정 연출 중심. 전투보다 컷신 호흡과 엔딩 분기를 우선한다. 기존 작품 고유명/캐릭터 복제 금지.",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    blurb: "회상 · 컷신 · 엔딩",
    narrativeHorrorGenre: "moon-cutscene",
  },
  {
    id: "horror-gallery",
    packId: "horror-chase",
    starterRecipeId: "horror-gallery",
    label: "이브 같은 갤러리 호러",
    tone: "미술관·회랑 탐험 호러 중심. 이상 회화/오브젝트 상호작용, 단서 아이템, 긴장감 있는 짧은 이벤트 루프를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    thumb: "/assets/generated/welcome/slide-05.png",
    blurb: "미술관 · 단서 · 공포",
    narrativeHorrorGenre: "ib-gallery",
  },
  {
    id: "school-horror",
    packId: "horror-chase",
    starterRecipeId: "school-horror",
    label: "아오오니 같은 학교 호러",
    tone: "야간 학교 회랑 추적 호러 중심. 숨기/도주 이벤트, 단서 아이템, 위협 실루엣 조우를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    thumb: "/assets/generated/welcome/slide-06.png",
    blurb: "학교 · 추적 · 공포",
    narrativeHorrorGenre: "witch-horror",
  },
] as const;

export function welcomeGenrePresetById(id: string | undefined): WelcomeGenrePreset | undefined {
  return WELCOME_GENRE_PRESETS.find((preset) => preset.id === id);
}

/** Pure, non-destructive card selection path. Applying the returned plan is an explicit separate action. */
export function welcomeGenreStarterPlanById(id: WelcomeGenrePresetId): GenreStarterPlan {
  const preset = welcomeGenrePresetById(id);
  if (!preset) throw new Error(`Unknown welcome genre preset: ${id}`);
  return createGenreStarterPlan(preset.packId, preset.starterRecipeId);
}

export function welcomeGenrePresetByLabel(label: string): WelcomeGenrePreset | undefined {
  const trimmed = label.trim();
  return WELCOME_GENRE_PRESETS.find((preset) => preset.label === trimmed);
}

function requiredTemplateBlock(genre: NarrativeHorrorGenre | undefined): string[] {
  if (!genre) return [];
  return [
    "",
    "## 필수 템플릿 툴 (원큐 조립 — upsert_event thrash 금지)",
    templateToolInstruction(genre),
    "위 템플릿 툴을 실제로 호출해 제안(changeset)에 포함하세요. 설명만 하고 끝내지 마세요.",
  ];
}

/** Build the auto-send user message for a genre chip. */
export function buildWelcomeGenrePresetPrompt(preset: WelcomeGenrePreset): string {
  const checklist = WELCOME_GENRE_CHECKLIST_LINES.map((line, index) => `${index + 1}. ${line}`).join("\n");
  return [
    `장르 프리셋: ${preset.label}`,
    `톤: ${preset.tone}`,
    "",
    "다음 체크리스트를 모두 만족하는 변경을 **제안**으로 작성하세요. 승인 전 커밋 금지.",
    checklist,
    ...requiredTemplateBlock(preset.narrativeHorrorGenre),
    "",
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성한 뒤 제안 카드로 제출하세요.",
  ].join("\n");
}

/** Free-text path: same checklist, user intent replaces fixed tone. */
export function buildWelcomeFreeTextPrompt(userIntent: string): string {
  const intent = userIntent.trim();
  const checklist = WELCOME_GENRE_CHECKLIST_LINES.map((line, index) => `${index + 1}. ${line}`).join("\n");
  const genre = detectNarrativeHorrorGenre(intent);
  return [
    `사용자 의도: ${intent}`,
    "",
    "위 의도에 맞는 장르 스타터를 다음 체크리스트로 **제안**하세요. 승인 전 커밋 금지.",
    checklist,
    ...requiredTemplateBlock(genre ?? undefined),
    "",
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성한 뒤 제안 카드로 제출하세요.",
  ].join("\n");
}

/** Secondary inspirations — compact chips in the unified worlds row. */
export type WelcomeInspirationMini = {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  /** Free-text intent used when user starts from this mini. */
  readonly intent: string;
};

export const WELCOME_INSPIRATION_MINIS: readonly WelcomeInspirationMini[] = [
  {
    id: "dream-psych",
    label: "심리·꿈 탐험",
    blurb: "안전한 방과 이상한 꿈세계",
    thumb: "/assets/generated/welcome/mini-01-omori.png",
    intent: "안전한 방과 이상한 꿈세계를 오가는 심리 탐험 게임",
  },
  {
    id: "surreal-doors",
    label: "초현실 꿈 워프",
    blurb: "문으로 이어지는 기묘한 세계",
    thumb: "/assets/generated/welcome/mini-02-yume.png",
    intent: "방에서 문으로 이상한 세계를 탐험하는 초현실 어드벤처",
  },
  {
    id: "memory-story",
    label: "감동 스토리",
    blurb: "회상과 감정이 중심",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    intent: "전투보다 회상과 감정이 중심인 스토리 어드벤처. script_cutscene_preset 필수.",
  },
  {
    id: "mansion-horror",
    label: "저택 호러",
    blurb: "고전 저택 탐험",
    thumb: "/assets/generated/welcome/mini-04-mansion.png",
    intent: "저택을 탐험하는 고전 도트 호러. make_horror_loop로 트랩+체크포인트+추격 (기존 작품 고유명/캐릭터 복제 금지)",
  },
  {
    id: "meta-choice",
    label: "메타 선택 서사",
    blurb: "대화와 선택",
    thumb: "/assets/generated/welcome/mini-05-meta.png",
    intent: "대화와 선택이 중요한 메타 감성 JRPG (기존 작품 고유명/캐릭터 복제 금지)",
  },
  {
    id: "modern-psi",
    label: "현대 초능력 JRPG",
    blurb: "현대 마을 배경",
    thumb: "/assets/generated/welcome/mini-06-mother.png",
    intent: "현대 마을을 배경으로 한 초능력 JRPG (고유명 복제 금지)",
  },
] as const;

export const WELCOME_BLANK_CONFIRM = {
  title: "새 뼈대로 시작할까요?",
  message:
    "선택한 장르로 새 blank 프로젝트를 만들고 AI 생성을 제안합니다. 현재 열려 있는 프로젝트는 이 세션에서 유지되지 않을 수 있습니다(원격 저장본을 덮어쓰지 않도록 메모리 분기로 엽니다).",
  confirmLabel: "새 뼈대로 시작",
  cancelLabel: "취소",
  danger: true,
} as const;

export const WELCOME_QUICK_PICKS: readonly { readonly label: string; readonly intent: string }[] = [
  { label: "눈 내리는 마을 + 여관", intent: "눈 내리는 마을 여관에서 단골손님이 머무는 따뜻한 이야기 — 여관주인 NPC와 저녁 컷신" },
  { label: "숲속 던전 탐험", intent: "숲속 던전 입구에서 시작해 보물상자와 적을 배치한 모험 JRPG" },
  { label: "추억의 재회 컷신", intent: "오랜 친구와의 재회 컷신 — 대화와 감정 연출 중심, 엔딩 분기 포함" },
  { label: "항구 시장 하루", intent: "항구 시장과 상점가가 있는 마을 — 상인과 손님 NPC가 하루 일과로 움직이는 생활 시뮬" },
  { label: "학교 괴담 밤", intent: "밤 학교를 탐험하는 호러 — 숨기와 추격 이벤트, 단서 아이템" },
  { label: "달빛 호수 마을", intent: "달빛 호수 옆 작은 마을 — 고요한 분위기와 호수 던전" },
] as const;

/** First-visit canvas briefing — three visual results, not a genre catalog. */
export type DirectorBriefingCard = {
  readonly id: WelcomeGenrePresetId;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
};

export const DIRECTOR_BRIEFING_CARDS: readonly DirectorBriefingCard[] = [
  {
    id: "adventure-jrpg",
    label: "모험 마을",
    blurb: "집과 길, 던전 입구",
    thumb: "/assets/generated/welcome/slide-04.png",
  },
  {
    id: "farm-life",
    label: "농장 하루",
    blurb: "밭과 주민, 일상",
    thumb: "/assets/generated/welcome/slide-03.png",
  },
  {
    id: "monster-collect",
    label: "몬스터 수집",
    blurb: "풀숲 조우와 도감",
    thumb: "/assets/generated/welcome/slide-01.png",
  },
] as const;

export type WelcomeStarterTemplateId = "snow-village-inn" | "forest-dungeon" | "reunion-cutscene" | "harbor-market";

export type WelcomeStarterTemplate = {
  readonly id: WelcomeStarterTemplateId;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  readonly intent: string;
};

export const WELCOME_STARTER_TEMPLATES: readonly WelcomeStarterTemplate[] = [
  { id: "snow-village-inn", label: "눈 마을 여관", blurb: "따뜻한 불빛과 단골손님", thumb: "/assets/generated/welcome/slide-00-hero.png", intent: "눈 내리는 마을 한가운데 여관 — 여관주인과 단골손님이 등장하는 오프닝 컷신과 밤 이벤트" },
  { id: "forest-dungeon", label: "숲속 던전", blurb: "입구부터 보스까지", thumb: "/assets/generated/welcome/slide-04.png", intent: "숲속 던전 입구부터 보스 방까지 이어지는 짧은 모험 — 보물상자·전투·열쇠 이벤트 포함" },
  { id: "reunion-cutscene", label: "재회 컷신", blurb: "대사와 감정 중심", thumb: "/assets/generated/welcome/mini-03-moon.png", intent: "오랜 친구와의 재회 컷신 — 대화, 회상 연출, 선택지로 갈리는 엔딩" },
  { id: "harbor-market", label: "항구 시장", blurb: "상인과 손님의 하루", thumb: "/assets/generated/welcome/slide-03.png", intent: "항구 시장이 있는 마을 — 상점, 손님 NPC, 낮/밤 일과가 있는 생활 마을" },
] as const;

