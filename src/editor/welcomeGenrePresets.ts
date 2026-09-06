// editor/welcomeGenrePresets.ts
// Welcome genre chips → fixed AI prompt templates (map + monster/item DB seed checklist).

import {
  detectNarrativeHorrorGenre,
  templateToolInstruction,
  type NarrativeHorrorGenre,
} from "@/ai/narrativeHorrorWorkPlan";
import type { GenrePackId } from "@/project/genrePackId";
import { buildActionArenaAuthoringGuide } from "@/ai/actionArenaAuthoring";
import {
  createGenreBlankProjectSystemPresetPlan,
  type GenreBlankProjectSystemPresetPlan,
} from "@/editor/genrePacks";

export type WelcomeGenrePresetId =
  | "action-rpg"
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
  readonly systemPresetRecipeId: string;
  readonly label: string;
  /** Short tone line injected into the shared checklist template. */
  readonly tone: string;
  /** Poster thumbnail for cinematic welcome grid. */
  readonly thumb: string;
  /** One-line subtitle under the poster label. */
  readonly blurb: string;
  /**
   * Poster eyebrow — the title people arrive with ("이브 같은"). Rendered above `posterTitle`
   * so a long reference label does not wrap into the poster caption.
   */
  readonly reference?: string;
  /** Poster caption. Defaults to `label` when the world quotes no reference. */
  readonly posterTitle?: string;
  /** Optional narrative/horror template genre for required tools. */
  readonly narrativeHorrorGenre?: NarrativeHorrorGenre;
};

/**
 * Shared authoring checklist for a genre chip.
 *
 * 2026-08-30 실측으로 세 줄이 바뀌었다:
 * - 옛 1번 "이미 blank로 교체된 상태"는 **거짓**이었다. 프리셋 핸드오프는 현재 열린 프로젝트를
 *   그대로 쓴다(mode.ts 의 replaceWithBlank=false). 거짓 전제를 주면 모델이 완성된 100×100
 *   마을에 create_map/set_build_spec 을 대고 거부당한다.
 * - 자율 런에는 사용자 승인 카드가 **없다**(assistantSession.maybeAutoApplyMilestone).
 *   "제안만 하고 승인을 기다려라"는 지시는 없는 게이트를 기다리게 만들어 모델이 설명만 하고
 *   멈추게 유도한다.
 */
export const WELCOME_GENRE_CHECKLIST_LINES = [
  "지금 열려 있는 프로젝트에 이어서 작업한다 — 기존 맵·이벤트·DB 를 먼저 읽고 거기에 얹는다.",
  "장르에 맞는 무대를 마련한다 — 쓸 맵이 없으면 만들고, 있으면 그 맵을 장르에 맞게 고친다.",
  "플레이어 시작 위치를 장르에 맞는 자리로 맞춘다.",
  "장르 핵심 NPC/이벤트를 최소 2개 둔다.",
  "몬스터/적 또는 상호작용 대상 시드를 DB에 넣는다.",
  "관련 아이템 시드를 DB에 넣는다.",
  "id 를 지어내지 않는다 — 트룹·몬스터·아이템을 참조하기 전에 조회 툴로 실제 id 를 확인한다.",
  "계획 항목을 하나씩 끝낸다 — 항목이 요구하는 툴을 실제로 성공시킨 뒤 다음 항목으로 넘어간다.",
] as const;

export const WELCOME_GENRE_PRESETS: readonly WelcomeGenrePreset[] = [
  {
    id: "action-rpg",
    packId: "action-rpg",
    systemPresetRecipeId: "action-system",
    label: "2D 액션 RPG",
    tone: "타일 맵에서 실시간 공격·회피·가드 중심. 기존 맵과 DB를 읽고 작은 전투 공간에서 먼저 실제 전투를 검증한다.",
    thumb: "/assets/generated/welcome/slide-04.png",
    blurb: "필드 공격 · 회피 · 가드",
  },
  {
    id: "monster-collect",
    packId: "monster-collect",
    systemPresetRecipeId: "monster-system",
    label: "몬스터 수집",
    tone: "포획·도감·야생 조우 중심. 스타터 몬스터와 간단한 풀숲 인카운트 흐름을 우선한다.",
    thumb: "/assets/generated/welcome/slide-01.png",
    blurb: "수집 · 조우 · 도감",
  },
  {
    id: "partner-raise",
    packId: "monster-collect",
    systemPresetRecipeId: "monster-system",
    label: "파트너 육성",
    tone: "파트너 몬스터 육성·진화·유대 중심. 파트너 NPC/이벤트와 성장 아이템을 우선한다.",
    thumb: "/assets/generated/welcome/slide-02.png",
    blurb: "파트너 · 진화",
  },
  {
    id: "farm-life",
    packId: "farm-life",
    systemPresetRecipeId: "farm-system",
    label: "농장 생활",
    tone: "농장·일상·마을 NPC 중심. 밭/도구 아이템과 주민 대사를 우선한다.",
    thumb: "/assets/generated/welcome/slide-03.png",
    blurb: "농장 · 일상",
  },
  {
    id: "adventure-jrpg",
    packId: "adventure-jrpg",
    systemPresetRecipeId: "adventure-system",
    label: "모험 JRPG",
    tone: "파티 모험·던전 탐험 중심. 시작 마을과 던전 입구, 기본 전투 적을 우선한다.",
    thumb: "/assets/generated/welcome/slide-04.png",
    blurb: "파티 · 던전",
  },
  {
    id: "story-cutscene",
    packId: "story-cutscene",
    systemPresetRecipeId: "story-system",
    label: "회상 스토리",
    tone: "투더문식 회상·감정 연출 중심. 전투보다 컷신 호흡과 엔딩 분기를 우선한다. 기존 작품 고유명/캐릭터 복제 금지.",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    blurb: "회상 · 컷신 · 엔딩",
    narrativeHorrorGenre: "moon-cutscene",
  },
  {
    id: "horror-gallery",
    packId: "horror-chase",
    systemPresetRecipeId: "horror-system",
    label: "이브 같은 갤러리 호러",
    tone: "미술관·회랑 탐험 호러 중심. 이상 회화/오브젝트 상호작용, 단서 아이템, 긴장감 있는 짧은 이벤트 루프를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    thumb: "/assets/generated/welcome/slide-05.png",
    blurb: "미술관 · 단서 · 공포",
    reference: "이브 같은",
    posterTitle: "갤러리 호러",
    narrativeHorrorGenre: "ib-gallery",
  },
  {
    id: "school-horror",
    packId: "horror-chase",
    systemPresetRecipeId: "horror-system",
    label: "아오오니 같은 학교 호러",
    tone: "야간 학교 회랑 추적 호러 중심. 숨기/도주 이벤트, 단서 아이템, 위협 실루엣 조우를 우선한다. 기존 작품 캐릭터/고유명은 쓰지 않는다.",
    thumb: "/assets/generated/welcome/slide-06.png",
    blurb: "학교 · 추적 · 공포",
    reference: "아오오니 같은",
    posterTitle: "학교 호러",
    narrativeHorrorGenre: "witch-horror",
  },
] as const;

export function welcomeGenrePresetById(id: string | undefined): WelcomeGenrePreset | undefined {
  return WELCOME_GENRE_PRESETS.find((preset) => preset.id === id);
}

/** Resolve a visual welcome variant to the canonical pack id persisted in project.system.genre. */
export function officialGenrePackIdForWelcomePreset(id: WelcomeGenrePresetId): GenrePackId {
  const preset = welcomeGenrePresetById(id);
  if (!preset) throw new Error(`Unknown welcome genre preset: ${id}`);
  return preset.packId;
}

/** Pure, non-destructive card selection path. Applying the returned plan is an explicit separate action. */
export function welcomeGenreSystemPresetPlanById(id: WelcomeGenrePresetId): GenreBlankProjectSystemPresetPlan {
  const preset = welcomeGenrePresetById(id);
  if (!preset) throw new Error(`Unknown welcome genre preset: ${id}`);
  return createGenreBlankProjectSystemPresetPlan(preset.packId, preset.systemPresetRecipeId);
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
    "위 템플릿 툴을 실제로 호출하세요. 설명만 하고 끝내지 마세요.",
  ];
}

/** Build the auto-send user message for a genre chip. */
export function buildWelcomeGenrePresetPrompt(preset: WelcomeGenrePreset): string {
  if (preset.packId === "action-rpg") {
    return [
      `장르 프리셋: ${preset.label}`,
      `톤: ${preset.tone}`,
      buildActionArenaAuthoringGuide(),
      "한국어로 진행하고, 도구로 실제 2D 액션 전투 공간을 저작하세요.",
    ].join("\n\n");
  }
  const checklist = WELCOME_GENRE_CHECKLIST_LINES.map((line, index) => `${index + 1}. ${line}`).join("\n");
  return [
    `장르 프리셋: ${preset.label}`,
    `톤: ${preset.tone}`,
    "",
    "다음 체크리스트를 모두 만족하도록 실제 편집 툴을 호출해 작업하세요. 설명만 하고 끝내지 마세요.",
    checklist,
    ...requiredTemplateBlock(preset.narrativeHorrorGenre),
    "",
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성하세요.",
  ].join("\n");
}

/** Free text keeps the user's scope; structured intent selects a recipe later. */
export function buildWelcomeFreeTextPrompt(userIntent: string): string {
  const intent = userIntent.trim();
  const genre = detectNarrativeHorrorGenre(intent);
  return [
    `사용자 의도: ${intent}`,
    "",
    "지금 열려 있는 프로젝트에 이어서 작업한다 — 기존 맵·이벤트·DB 를 먼저 읽고 거기에 얹는다.",
    "사용자가 요청한 범위만 실제 편집 툴로 작성하세요. 구조화된 의도에 맞는 저작 순서를 따르고, 요청하지 않은 NPC·아이템·퀘스트·상점·보스·보상·페이지 수를 할당하지 마세요.",
    ...requiredTemplateBlock(genre ?? undefined),
    "",
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성하세요.",
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

/**
 * First-screen posters. Horror / farm / partner stay in the catalog and the collapsed
 * 「이런 세계도 있어요」 tier — they are hidden, not deleted.
 */
const WELCOME_FEATURED_POSTER_ORDER: readonly WelcomeGenrePresetId[] = [
  "monster-collect",
  "story-cutscene",
  "adventure-jrpg",
] as const;

const WELCOME_HIDDEN_POSTER_ORDER: readonly WelcomeGenrePresetId[] = [
  "horror-gallery",
  "school-horror",
  "farm-life",
  "partner-raise",
  "action-rpg",
] as const;

/** Featured first so pack anchors land on the visible posters whenever possible. */
const WELCOME_POSTER_ORDER: readonly WelcomeGenrePresetId[] = [
  ...WELCOME_FEATURED_POSTER_ORDER,
  ...WELCOME_HIDDEN_POSTER_ORDER,
] as const;

export type WelcomePosterCard = {
  readonly preset: WelcomeGenrePreset;
  /** Small line above the title, present only when the world quotes a reference. */
  readonly reference?: string;
  readonly title: string;
  /** True when the poster sits in the first-screen grid. Hidden posters stay in the collapsed tier. */
  readonly featured: boolean;
  /**
   * Anchor poster for its official pack, or null for a sibling variant of a pack already anchored.
   * Exactly one poster per GenrePackId is an anchor, so the five-official-packs DOM gate
   * (scripts/browser-verify-genre-presets.mts) keeps its exactly-once contract while variants of the
   * same pack remain peers — featured or collapsed.
   */
  readonly packAnchor: GenrePackId | null;
};

function buildPosterCards(): readonly WelcomePosterCard[] {
  const featured = new Set<WelcomeGenrePresetId>(WELCOME_FEATURED_POSTER_ORDER);
  const anchored = new Set<GenrePackId>();
  return WELCOME_POSTER_ORDER.map((id) => {
    const preset = welcomeGenrePresetById(id);
    if (!preset) throw new Error(`Unknown welcome poster preset: ${id}`);
    const packAnchor = anchored.has(preset.packId) ? null : preset.packId;
    if (packAnchor) anchored.add(packAnchor);
    return {
      preset,
      reference: preset.reference,
      title: preset.posterTitle ?? preset.label,
      featured: featured.has(id),
      packAnchor,
    };
  });
}

export const WELCOME_POSTER_CARDS: readonly WelcomePosterCard[] = buildPosterCards();
export const WELCOME_FEATURED_POSTER_CARDS: readonly WelcomePosterCard[] =
  WELCOME_POSTER_CARDS.filter((card) => card.featured);
export const WELCOME_HIDDEN_POSTER_CARDS: readonly WelcomePosterCard[] =
  WELCOME_POSTER_CARDS.filter((card) => !card.featured);

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

/**
 * Second tier of the gallery — free-text worlds, collapsed until asked for. These entries carry an
 * `intent` instead of a pack, so they run the same path as typing into the prompt row.
 */
export type WelcomeMoreWorld = {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  readonly intent: string;
};

export const WELCOME_MORE_WORLDS: readonly WelcomeMoreWorld[] = [
  ...WELCOME_INSPIRATION_MINIS,
  ...WELCOME_STARTER_TEMPLATES,
] as const;

