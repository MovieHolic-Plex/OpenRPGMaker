import type { CinematicPresentation } from '@/project/cinematicPresentation';
// editor/openingPresets.ts
// 오프닝 프리셋 — 한 번 눌러 «완성된 연출»이 들어오게 하는 카탈로그.
//
// 왜 그림을 박아 두나: 빈 프로젝트의 오프닝 저작은 지금까지 «장면 추가 → 글 쓰기»뿐이라
// 결과가 검은 배경에 글자 한 줄이었다. 화려한 오프닝의 재료(전체화면 배경화, 움직임, 곡)는
// 이미 번들로 들어 있는데 작성자가 그 id 를 알 길이 없었다. 프리셋이 그 재료를 엮어 준다.
//
// 참조하는 리소스 id 는 전부 `builtinGeneratedResourceIds()` 에 등록된 번들 자산이다.
// 등록되지 않은 id 를 쓰면 프로젝트 역직렬화가 통째로 실패한다(resourceReferenceValidation).
// 곡도 레포에 파일이 함께 커밋된 스타터 3곡 중 하나만 쓴다 — CDN 미설정 환경에서 무음이 되지
// 않아야 «프리셋을 눌렀더니 화려하다»가 성립한다.
import { STARTER_TITLE_BGM_ID } from "@/assets/bgmStarterTracks";
import type {
  CinematicMotion,
  CinematicScene,
  CinematicSequence,
} from "@/project/cinematicSettings";
import { genId } from "@/util/id";

/** 내레이션 안에서 프로젝트 제목으로 치환되는 자리표시자. */
export const OPENING_PRESET_TITLE_TOKEN = "{제목}";

/** 제목이 비어 있는 프로젝트에도 타이틀 카드가 빈칸으로 남지 않게 한다. */
export const OPENING_PRESET_TITLE_FALLBACK = "이름 없는 이야기";

export type OpeningPresetSceneSpec = {
  readonly narration: string;
  readonly durationMs: number;
  /** 있으면 이미지 장면, 없으면 텍스트 장면. */
  readonly resourceId?: string;
  readonly motion?: CinematicMotion;
  readonly presentation?: CinematicPresentation;
};

export type OpeningPreset = {
  readonly id: string;
  readonly name: string;
  /** 카드에 적는 한 줄 성격 — 작성자가 고르는 기준이다. */
  readonly mood: string;
  readonly musicResourceId?: string;
  readonly scenes: readonly OpeningPresetSceneSpec[];
};

const TITLE_CARD_MS = 4200;

/** 타이틀 카드로 닫는다 — 마지막 한 장이 있어야 «오프닝»처럼 끝난다. */
function titleCard(): OpeningPresetSceneSpec {
  return { narration: `— ${OPENING_PRESET_TITLE_TOKEN} —`, durationMs: TITLE_CARD_MS, presentation: { preset: "chapter" } };
}

export const OPENING_PRESETS: readonly OpeningPreset[] = [
  { id: 'written-prologue', name: '편지로 시작하는 이야기', mood: '명조 서문 · 한 글자씩 · 암전', musicResourceId: STARTER_TITLE_BGM_ID, scenes: [
    { narration: '그날, 나에게 한 통의 편지가 도착했다.', durationMs: 4000, presentation: { preset: 'prologue' } },
    { narration: '잊었다고 생각했던 이름.\n다시는 돌아갈 수 없었던 장소.', durationMs: 4500, presentation: { preset: 'memory' } },
    { narration: '{제목}\n첫 번째 이야기', durationMs: 3500, presentation: { preset: 'chapter' } },
  ] },
  { id: 'film-opening', name: '영화처럼 열리는 장면', mood: '와이프 · 자막 등장 · 디졸브', musicResourceId: STARTER_TITLE_BGM_ID, scenes: [
    { narration: '누군가 이 길을 먼저 걸었다.', resourceId: 'oprn-still-forest-path', motion: 'pan', durationMs: 4200, presentation: { preset: 'subtitle', transition: { enter: 'wipe', enterMs: 900 } } },
    { narration: '남겨진 빛을 따라, 이야기가 시작된다.', resourceId: 'oprn-still-hero-dawn', motion: 'zoom', durationMs: 4300, presentation: { preset: 'subtitle' } },
    { narration: '{제목}', durationMs: 3500, presentation: { preset: 'chapter' } },
  ] },
  { id: 'opening-credits', name: '흐르는 오프닝 크레딧', mood: '스크롤 글자 · 장면 페이드', musicResourceId: STARTER_TITLE_BGM_ID, scenes: [
    { narration: '{제목}\n\n기억을 걷는 사람들\n\n이야기 · 당신\n세계 · 당신\n\n그리고, 지금 시작하는 모험', resourceId: 'oprn-still-moon-meadow', motion: 'none', durationMs: 8500, presentation: { preset: 'credits' } },
    { narration: '첫 번째 아침', durationMs: 3500, presentation: { preset: 'chapter', transition: { enter: 'fade', enterMs: 700 } } },
  ] },
  {
    id: "kingdom-prologue",
    name: "왕국의 서막",
    mood: "정통 판타지 · 평화에서 균열로",
    musicResourceId: STARTER_TITLE_BGM_ID,
    scenes: [
      {
        narration: "강을 낀 왕국에는 오래도록 전쟁이 없었다.",
        resourceId: "oprn-still-kingdom-day",
        motion: "zoom",
        durationMs: 5200,
      },
      {
        narration: "하늘이 갈라지던 날, 빛은 산 너머로 물러났다.",
        resourceId: "oprn-still-dark-citadel",
        motion: "pan",
        durationMs: 5200,
      },
      {
        narration: "달빛만 남은 호숫가에서, 한 사람이 검을 집어 들었다.",
        resourceId: "oprn-still-hero-dawn",
        motion: "zoom",
        durationMs: 5200,
      },
      titleCard(),
    ],
  },
  {
    id: "forgotten-ruins",
    name: "잊힌 폐허",
    mood: "탐사 · 지도에 없는 길",
    musicResourceId: STARTER_TITLE_BGM_ID,
    scenes: [
      {
        narration: "천 년 전, 이 길 끝에는 도시가 있었다.",
        resourceId: "oprn-still-desert-ruin",
        motion: "zoom",
        durationMs: 5200,
      },
      {
        narration: "지도에 없는 사막을 건너 우리는 그 이름을 쫓았다.",
        resourceId: "oprn-still-forest-path",
        motion: "pan",
        durationMs: 5000,
      },
      {
        narration: "돌은 아직 따뜻했다. 폐허는 누군가를 기다리고 있었다.",
        resourceId: "oprn-still-corridor",
        motion: "fade",
        durationMs: 4800,
      },
      titleCard(),
    ],
  },
  {
    id: "midnight-manor",
    name: "한밤의 저택",
    mood: "호러 · 미스터리 · 초대장",
    musicResourceId: STARTER_TITLE_BGM_ID,
    scenes: [
      {
        narration: "초대장에는 날짜가 적혀 있지 않았다.",
        resourceId: "oprn-still-manor-night",
        motion: "zoom",
        durationMs: 5400,
      },
      {
        narration: "마을 사람들은 언덕 위 그 집 이야기를 하지 않는다.",
        resourceId: "oprn-still-quiet-room",
        motion: "pan",
        durationMs: 5000,
      },
      {
        narration: "그날 밤, 호수에 비친 달이 두 개였다.",
        resourceId: "oprn-still-moon-meadow",
        motion: "fade",
        durationMs: 4800,
      },
      titleCard(),
    ],
  },
  {
    id: "night-the-star-fell",
    name: "별이 떨어진 밤",
    mood: "이세계 · 각성 · 하루 만의 전복",
    musicResourceId: STARTER_TITLE_BGM_ID,
    scenes: [
      {
        narration: "그날 밤, 하늘에 구멍이 뚫렸다.",
        resourceId: "oprn-still-metropolis",
        motion: "zoom",
        durationMs: 5000,
      },
      {
        narration: "호수가 별을 삼키고, 세계는 다른 이름을 얻었다.",
        resourceId: "oprn-still-dream",
        motion: "pan",
        durationMs: 5200,
      },
      {
        narration: "아침은 아무 일 없었다는 듯 찾아왔다. 단 한 사람만 빼고.",
        resourceId: "oprn-still-moon-meadow",
        motion: "fade",
        durationMs: 5000,
      },
      titleCard(),
    ],
  },
];

/** 카드 썸네일에 쓸 대표 그림. 텍스트뿐인 프리셋이면 없다. */
export function openingPresetCoverResourceId(preset: OpeningPreset): string | undefined {
  return preset.scenes.find(scene => scene.resourceId)?.resourceId;
}

export function findOpeningPreset(id: string): OpeningPreset | undefined {
  return OPENING_PRESETS.find(preset => preset.id === id);
}

function fillTitle(narration: string, title: string | undefined): string {
  const resolved = title?.trim() || OPENING_PRESET_TITLE_FALLBACK;
  return narration.replaceAll(OPENING_PRESET_TITLE_TOKEN, resolved);
}

/**
 * 프리셋을 그대로 저장 가능한 시퀀스로 편다. 여기서 만든 장면 id 는 매번 새로 뽑는다 —
 * 같은 프리셋을 두 번 적용해도 편집 중인 선택 상태가 옛 장면을 가리키지 않아야 한다.
 *
 * 켜 둔 채로 돌려준다: 프리셋을 고르는 행위가 곧 «오프닝을 쓰겠다»는 뜻이고, 사용 스위치를
 * 따로 켜야 한다면 눌러도 아무 일이 없는 것처럼 보인다.
 */
export function buildOpeningPresetSequence(
  preset: OpeningPreset,
  options: { readonly title?: string } = {},
): CinematicSequence {
  const scenes: CinematicScene[] = preset.scenes.map(spec => {
    const narration = fillTitle(spec.narration, options.title);
    const id = genId("cinematic-scene");
    if (!spec.resourceId) return { id, kind: "text", narration, durationMs: spec.durationMs, presentation: structuredClone(spec.presentation ?? { preset: "prologue" }) };
    return {
      id,
      kind: "image",
      resourceId: spec.resourceId,
      narration,
      durationMs: spec.durationMs,
      motion: spec.motion ?? "none",
      presentation: structuredClone(spec.presentation ?? { preset: "subtitle" }),
    };
  });
  return {
    enabled: true,
    skippable: true,
    ...(preset.musicResourceId ? { musicResourceId: preset.musicResourceId } : {}),
    scenes,
  };
}

/** 카드에 적는 «약 N초» — 자동 넘김 시간의 합. */
export function openingPresetDurationSeconds(preset: OpeningPreset): number {
  return Math.round(preset.scenes.reduce((total, scene) => total + scene.durationMs, 0) / 1000);
}
