// project/dialogueStyles.ts — 대화창 스타일 · 대사 종류 · 화자 목소리의 단일 진실 공급원.
//
// 네 겹이 위에서 아래로 빈 칸만 채운다(Ren'Py Character · Dialogic Style 과 같은 구조):
//   ① 프로젝트 기본      system.dialogueStyle · dialogueFont · dialogueSpeed · dialoguePunctuationPause
//   ② 화자 프로필        project.characters[id].dialogue  (창 스타일 · 이름색 · 목소리 · 빠르기 · 글꼴 ·
//                        그릇 · 표정별 얼굴/음높이/이모트 · 입 벌린 얼굴)
//   ③ 대사 한 줄         Command "text" 의 style / context / container / emotion
//   ④ 본문 태그          [흔들]…[/] 같은 인라인 태그 — DIALOGUE_INLINE_TAGS, 해석은 player/dialogue.ts
// resolveDialogueLook() 이 셋을 합쳐 런타임 대화창·에디터 미리보기·AI 가 같은 답을 보게 한다.
//
// DOM·WebAudio 를 만지지 않는다. 합성 수치(목소리)도 여기서 선언하고 재생은 player/dialogueVoice.ts 가 한다.
// 라벨은 그 창이 실제로 어떻게 보이는지를 말하고 타사 프랜차이즈 이름을 쓰지 않는다
// (test/detsukuruBrandStrings.test.ts 규약, menuSkins/registry.ts 와 같다).
// 조사 근거: ~/claude-viz/dialogue-research/ (2026-09-24, 50여 게임·20여 엔진).

import { isEmoteKind, type EmoteKind } from "@/project/emotes";
import { isFontFamilyId, type FontFamilyId } from "@/project/fontRegistry";
import type { GamePresetId } from "@/project/gameDesignBrief";

export const DIALOGUE_STYLE_IDS = [
  "glass",
  "classic",
  "retro-black",
  "retro-blue",
  "handheld",
  "double-line",
  "mono-heavy",
  "white-card",
  "wood",
  "cream",
  "gold",
  "skew",
  "float",
  "terminal",
] as const;
export type DialogueStyleId = (typeof DIALOGUE_STYLE_IDS)[number];

export const DIALOGUE_VOICE_IDS = [
  "none",
  "blip",
  "soft",
  "bright",
  "deep",
  "gruff",
  "squeak",
  "chatter",
  "robot",
  "ghost",
  "typewriter",
] as const;
export type DialogueVoiceId = (typeof DIALOGUE_VOICE_IDS)[number];

export const DIALOGUE_CONTEXT_IDS = [
  "speech",
  "narration",
  "thought",
  "whisper",
  "shout",
  "radio",
  "sign",
  "letter",
  "system",
] as const;
export type DialogueContextId = (typeof DIALOGUE_CONTEXT_IDS)[number];

export interface DialogueStyleDefinition {
  readonly id: DialogueStyleId;
  readonly label: string;
  readonly description: string;
  /** AI·추천 문구용 한 줄 — 어떤 게임 톤에 맞는가. */
  readonly fit: string;
  /** 화자가 목소리를 정하지 않았을 때 이 스타일이 내는 소리. */
  readonly defaultVoice: DialogueVoiceId;
}

export const DIALOGUE_STYLES: Readonly<Record<DialogueStyleId, DialogueStyleDefinition>> = {
  glass: {
    id: "glass", label: "유리 · 기본", defaultVoice: "none",
    description: "반투명 남색 유리창과 가는 테두리. 지금까지의 기본 대화창입니다.",
    fit: "무난한 기본값. 어떤 장르에도 튀지 않는다.",
  },
  classic: {
    id: "classic", label: "고전 · 윈도스킨", defaultVoice: "none",
    description: "자료집 → 시스템 그래픽의 윈도스킨 그림으로 틀과 바탕을 그립니다. 스킨을 바꾸면 대화창도 같이 바뀝니다.",
    fit: "2000년대 PC 고전 RPG 느낌, 직접 만든 윈도스킨 그림을 쓰고 싶을 때.",
  },
  "retro-black": {
    id: "retro-black", label: "레트로 흑창 · 흰 선", defaultVoice: "blip",
    description: "검은 바탕에 둥근 흰 선 하나, 픽셀 글꼴, 글자마다 짧은 삑 소리. 8비트 모험의 창입니다.",
    fit: "정통 8비트·16비트 판타지 모험, 마을 주민 대화가 많은 고전 JRPG.",
  },
  "retro-blue": {
    id: "retro-blue", label: "청색 그라데이션 · 입체 테두리", defaultVoice: "none",
    description: "위는 밝고 아래는 짙은 파란 창에 밝은 위·어두운 아래 입체 테두리. 16비트 판타지의 창입니다.",
    fit: "왕국·기사·크리스탈 같은 서사형 판타지 JRPG.",
  },
  handheld: {
    id: "handheld", label: "휴대기 흰 창 · 굵은 틀", defaultVoice: "none",
    description: "흰 바탕에 굵고 둥근 이중 틀, 짙은 회색 글씨. 휴대용 게임기의 밝은 창입니다.",
    fit: "몬스터 수집·트레이너 여행, 밝고 가벼운 모험.",
  },
  "double-line": {
    id: "double-line", label: "겹선 흑창 · 둥근 모서리", defaultVoice: "blip",
    description: "검은 창에 흰·회색 두 줄 테두리. 문단 앞에 • 를 찍는 엉뚱한 현대 모험의 창입니다.",
    fit: "현대 배경의 엉뚱한 모험, 유머와 쓸쓸함이 섞인 이야기.",
  },
  "mono-heavy": {
    id: "mono-heavy", label: "굵은 흑백 · 픽셀", defaultVoice: "blip",
    description: "새까만 바탕과 굵은 흰 테두리, 흑백 초상, 큰 픽셀 글꼴. 캐릭터마다 목소리를 달리 줄 때 가장 잘 삽니다.",
    fit: "개성 강한 괴물·유령이 나오는 코믹·기괴 RPG, 학교 괴담.",
  },
  "white-card": {
    id: "white-card", label: "흰 카드 · 둥근", defaultVoice: "soft",
    description: "둥근 흰 카드에 짙은 글씨. 초상이 또렷하게 뜨고 흔들림·물결 효과가 잘 보입니다.",
    fit: "감정 중심 플랫포머·액션, 인물 성장 이야기.",
  },
  wood: {
    id: "wood", label: "나무틀 양피지", defaultVoice: "none",
    description: "갈색 나무틀 안의 따뜻한 양피지. 시골 마을과 농장 생활의 창입니다.",
    fit: "농장·생활·마을 공동체, 계절과 선물이 있는 게임.",
  },
  cream: {
    id: "cream", label: "말랑 크림 · 이름 알약", defaultVoice: "chatter",
    description: "출렁이는 크림색 말랑 상자와 화자 색의 이름 알약. 재잘거리는 목소리가 기본입니다.",
    fit: "귀여운 동물 마을·육성·힐링 게임.",
  },
  gold: {
    id: "gold", label: "금장 흑판", defaultVoice: "none",
    description: "짙은 반투명 판에 금빛 가는 선과 마름모 장식. 신화·저승·궁정의 무게감 있는 창입니다.",
    fit: "신화·비극·정치극, 대사가 중요한 스토리 컷신.",
  },
  skew: {
    id: "skew", label: "기울인 흑백 · 강렬", defaultVoice: "none",
    description: "기울어진 검은 다각형과 흰 외곽선, 붉은 강조. 빠르고 도발적인 현대 활극의 창입니다.",
    fit: "현대 도시 활극·괴도·학원 액션, 강한 개성.",
  },
  float: {
    id: "float", label: "떠 있는 글 · 명조", defaultVoice: "ghost",
    description: "창을 칠하지 않고 어둠 위에 명조 글씨만 띄웁니다. 위아래 가는 장식선.",
    fit: "쓸쓸한 폐허·유령·고딕 공포, 조용한 탐험.",
  },
  terminal: {
    id: "terminal", label: "단말기 · 녹색 주사선", defaultVoice: "typewriter",
    description: "녹색 주사선이 흐르는 검은 단말기 화면. 타자기 소리로 글자가 찍힙니다.",
    fit: "SF·사이버펑크·연구소 공포, 기계와 교신하는 장면.",
  },
};

export const DEFAULT_DIALOGUE_STYLE_ID: DialogueStyleId = "glass";

export interface DialogueVoiceDefinition {
  readonly id: DialogueVoiceId;
  readonly label: string;
  /** 합성 파형. */
  readonly wave: "square" | "triangle" | "sine" | "sawtooth";
  /** 기본 주파수(Hz). 화자 pitch(반음)로 옮긴다. */
  readonly frequency: number;
  /** 음 높이 무작위 흔들림 비율(0.06 = ±6%). 같은 소리가 기관총처럼 들리지 않게 한다. */
  readonly variance: number;
  /** 한 번 울리는 길이(초). */
  readonly duration: number;
  /** 최대 음량 0~1 (플레이어 효과음 음량을 한 번 더 곱한다). */
  readonly gain: number;
  /** 소리 사이 최소 간격(ms). 빠른 글자에서 윙윙거리지 않게. */
  readonly minGapMs: number;
  /** syllable=음절마다 · initial=초성에 따라 음을 바꿈 · alternate=두 음절마다. */
  readonly mode: "syllable" | "initial" | "alternate";
  /** 좁은 대역(무전기·기계). */
  readonly bandpass?: boolean;
}

export const DIALOGUE_VOICES: Readonly<Record<Exclude<DialogueVoiceId, "none">, DialogueVoiceDefinition>> = {
  blip:       { id: "blip", label: "기본 삑", wave: "square", frequency: 620, variance: 0.03, duration: 0.03, gain: 0.35, minGapMs: 45, mode: "syllable" },
  soft:       { id: "soft", label: "부드러움", wave: "sine", frequency: 440, variance: 0.06, duration: 0.07, gain: 0.7, minGapMs: 70, mode: "syllable" },
  bright:     { id: "bright", label: "밝고 높음", wave: "square", frequency: 760, variance: 0.07, duration: 0.035, gain: 0.32, minGapMs: 55, mode: "syllable" },
  deep:       { id: "deep", label: "낮고 굵음", wave: "triangle", frequency: 190, variance: 0.03, duration: 0.06, gain: 0.8, minGapMs: 75, mode: "syllable" },
  gruff:      { id: "gruff", label: "거칠고 낮음", wave: "sawtooth", frequency: 110, variance: 0.05, duration: 0.08, gain: 0.35, minGapMs: 95, mode: "syllable" },
  squeak:     { id: "squeak", label: "작고 앙증맞음", wave: "triangle", frequency: 1100, variance: 0.1, duration: 0.03, gain: 0.55, minGapMs: 40, mode: "syllable" },
  chatter:    { id: "chatter", label: "재잘재잘 (초성)", wave: "triangle", frequency: 560, variance: 0.08, duration: 0.05, gain: 0.6, minGapMs: 45, mode: "initial" },
  robot:      { id: "robot", label: "기계음", wave: "square", frequency: 300, variance: 0, duration: 0.04, gain: 0.4, minGapMs: 55, mode: "syllable", bandpass: true },
  ghost:      { id: "ghost", label: "희미한 영혼", wave: "sine", frequency: 880, variance: 0.2, duration: 0.09, gain: 0.45, minGapMs: 90, mode: "alternate" },
  typewriter: { id: "typewriter", label: "타자기", wave: "square", frequency: 2000, variance: 0.15, duration: 0.012, gain: 0.3, minGapMs: 35, mode: "syllable" },
};

export const DIALOGUE_VOICE_LABELS: Readonly<Record<DialogueVoiceId, string>> = {
  none: "소리 없음",
  ...Object.fromEntries(Object.values(DIALOGUE_VOICES).map((voice) => [voice.id, voice.label])),
} as Record<DialogueVoiceId, string>;

export interface DialogueContextDefinition {
  readonly id: DialogueContextId;
  readonly label: string;
  readonly description: string;
  /** 이름표를 숨긴다. */
  readonly hideName: boolean;
  /** 얼굴·초상을 숨긴다. */
  readonly hideFace: boolean;
  /** 흘리지 않고 한 번에 보인다(표지판·편지·안내). */
  readonly instant: boolean;
  /** 목소리 음량 배율. 0 이면 소리 없음. */
  readonly voiceGain: number;
  /** 목소리 음 높이 이동(반음). */
  readonly voicePitch: number;
  /** 이름표 뒤에 붙는 말. */
  readonly nameSuffix?: string;
  /** 창을 한 번 흔든다. */
  readonly shake?: boolean;
}

export const DIALOGUE_CONTEXTS: Readonly<Record<DialogueContextId, DialogueContextDefinition>> = {
  speech:    { id: "speech", label: "일반 대사", description: "이름표·얼굴·화자 목소리를 그대로 씁니다.", hideName: false, hideFace: false, instant: false, voiceGain: 1, voicePitch: 0 },
  narration: { id: "narration", label: "내레이션", description: "이름·얼굴 없이 가운데 정렬, 짙은 바탕. 소리 없음.", hideName: true, hideFace: true, instant: false, voiceGain: 0, voicePitch: 0 },
  thought:   { id: "thought", label: "속마음", description: "흐린 색과 점선 둥근 틀. 소리는 아주 작게.", hideName: false, hideFace: false, instant: false, voiceGain: 0.3, voicePitch: -1 },
  whisper:   { id: "whisper", label: "속삭임", description: "회색 글씨와 점선 테두리, 낮고 작은 소리.", hideName: false, hideFace: false, instant: false, voiceGain: 0.35, voicePitch: -3 },
  shout:     { id: "shout", label: "외침", description: "뾰족한 틀과 굵은 글씨, 창을 한 번 흔들고 소리를 키웁니다.", hideName: false, hideFace: false, instant: false, voiceGain: 1.6, voicePitch: 2, shake: true },
  radio:     { id: "radio", label: "무전·전화", description: "주사선 바탕, 이름 뒤 (무전), 좁은 대역 소리.", hideName: false, hideFace: false, instant: false, voiceGain: 0.9, voicePitch: 0, nameSuffix: " (무전)" },
  sign:      { id: "sign", label: "표지판", description: "나무판 모양, 가운데 정렬, 한 번에 표시, 소리 없음.", hideName: true, hideFace: true, instant: true, voiceGain: 0, voicePitch: 0 },
  letter:    { id: "letter", label: "편지·책", description: "양피지 종이에 명조 글씨, 한 번에 표시, 소리 없음.", hideName: true, hideFace: true, instant: true, voiceGain: 0, voicePitch: 0 },
  system:    { id: "system", label: "시스템 안내", description: "대사와 구별되는 중립 창, 한 번에 표시.", hideName: true, hideFace: true, instant: true, voiceGain: 0, voicePitch: 0 },
};

/** 화자 프로필의 대화 설정. 전부 선택 — 비우면 위 겹(스타일·프로젝트 기본)을 따른다. */
export interface SpeakerDialogueProfile {
  readonly style?: DialogueStyleId;
  /** 이름표 글자색(#rrggbb). */
  readonly nameColor?: string;
  readonly voice?: DialogueVoiceId;
  /** 목소리 음 높이 이동(반음, -12~12). */
  readonly pitch?: number;
  /** 말 빠르기 배율(0.5~2, 1=보통, 클수록 빠르다). */
  readonly speed?: number;
  readonly font?: FontFamilyId;
  /** 이 인물이 말할 때 기본 그릇(상자·말풍선·흘림·코너). 대사 한 줄이 덮어쓴다. */
  readonly container?: DialogueContainerId;
  /** 표정(감정)마다 얼굴 칸·목소리 높이·머리 위 이모트를 한 번에 바꾼다(셀레스트 방식). */
  readonly expressions?: Partial<Record<DialogueEmotionId, SpeakerExpression>>;
  /** 말하는 동안 평소 얼굴과 번갈아 보일 「입 벌린」 얼굴 그림(얼굴 리소스 id). 없으면 입 움직임 없음. */
  readonly talkFace?: string;
}

/** 표정 하나. 비운 칸은 바꾸지 않는다. */
export interface SpeakerExpression {
  /** 이 표정일 때 쓸 얼굴 그림(얼굴 리소스 id). 얼굴은 낱장이라 칸 번호가 아니라 그림 하나다. */
  readonly face?: string;
  /** 목소리 음 높이 추가 이동(반음). */
  readonly pitch?: number;
  /** 말할 때 머리 위에 띄우는 이모트. */
  readonly emote?: EmoteKind;
}

/**
 * 대사를 담는 그릇.
 * - box: 화면 아래(위) 대사 상자 — 기본.
 * - balloon: 말하는 캐릭터 머리 위 말풍선. 화면 가장자리에 붙고, 위가 모자라면 꼬리를 뒤집고,
 *   세 줄을 넘거나 캐릭터를 못 찾으면 상자로 바뀐다.
 * - bark: 게임을 멈추지 않는 한 줄 말풍선(흘림 대사). 입력을 막지 않고 잠시 뒤 사라진다.
 * - corner: 화면 구석의 작은 얼굴+한 줄 — 동료가 걸으며 하는 말. 멈추지 않는다.
 */
export const DIALOGUE_CONTAINER_IDS = ["box", "balloon", "bark", "corner"] as const;
export type DialogueContainerId = (typeof DIALOGUE_CONTAINER_IDS)[number];
export const DIALOGUE_CONTAINER_LABELS: Readonly<Record<DialogueContainerId, string>> = {
  box: "대사 상자",
  balloon: "말풍선",
  bark: "흘림 대사",
  corner: "코너 대사",
};
export const DIALOGUE_CONTAINER_DESCRIPTIONS: Readonly<Record<DialogueContainerId, string>> = {
  box: "화면 아래 대사 상자. 키를 눌러 넘긴다.",
  balloon: "말하는 캐릭터 머리 위 말풍선. 길면 자동으로 상자가 된다.",
  bark: "게임을 멈추지 않는 한 줄 말풍선. 잠시 뒤 저절로 사라진다.",
  corner: "화면 구석에 얼굴과 한 줄. 동료가 걸으며 하는 말. 멈추지 않는다.",
};
export function isDialogueContainerId(value: unknown): value is DialogueContainerId {
  return typeof value === "string" && (DIALOGUE_CONTAINER_IDS as readonly string[]).includes(value);
}
/** 이 그릇은 인터프리터를 멈추지 않는다(입력을 기다리지 않는다). */
export function isNonBlockingContainer(value: DialogueContainerId): boolean {
  return value === "bark" || value === "corner";
}

/** 「문장 표시」 말투·연출(emotion) 과 같은 어휘. 표정 태그 [표정:기쁨] 도 이 값으로 읽는다. */
export const DIALOGUE_EMOTION_IDS = ["happy", "sad", "angry", "surprised"] as const;
export type DialogueEmotionId = (typeof DIALOGUE_EMOTION_IDS)[number];
export const DIALOGUE_EMOTION_LABELS: Readonly<Record<DialogueEmotionId, string>> = {
  happy: "기쁨",
  sad: "슬픔",
  angry: "분노",
  surprised: "놀람",
};
export function isDialogueEmotionId(value: unknown): value is DialogueEmotionId {
  return typeof value === "string" && (DIALOGUE_EMOTION_IDS as readonly string[]).includes(value);
}
/** 한국어 이름·영어 id 모두 받는다. */
export function parseDialogueEmotion(value: string): DialogueEmotionId | undefined {
  const trimmed = value.trim();
  if (isDialogueEmotionId(trimmed)) return trimmed;
  const found = DIALOGUE_EMOTION_IDS.find((id) => DIALOGUE_EMOTION_LABELS[id] === trimmed);
  return found;
}

/** 프로젝트 기본 말 빠르기 배율 범위(화자 speed 와 곱한다). */
export const DIALOGUE_PROJECT_SPEED_LIMITS = { min: 0.5, max: 2 } as const;
/**
 * 하단 대사창 뒤에 서는 전신 초상의 배치. 값은 모두 백분율(정수)이다.
 *   height — 초상 높이 = 화면 높이의 몇 % (그림은 9:16 이라 폭은 따라온다)
 *   drop   — 초상 높이의 몇 % 를 화면 아래로 내려 자르나(다리를 얼마나 숨기나)
 * 프로젝트 기본(system.dialogueFullPortrait)에 장면별 배율(FaceGraphic.fullScale)이 한 번 더 곱해진다.
 */
export const DIALOGUE_FULL_PORTRAIT_DEFAULTS = { height: 125, drop: 20 } as const;
export const DIALOGUE_FULL_PORTRAIT_LIMITS = {
  height: { min: 40, max: 200 },
  drop: { min: 0, max: 60 },
  scale: { min: 40, max: 200 },
} as const;
export interface DialogueFullPortraitSettings {
  readonly height?: number;
  readonly drop?: number;
}
export interface DialogueFullPortraitLayout {
  /** 화면 높이 대비 초상 높이 배율(1.25 = 125%). 장면 배율까지 곱한 값. */
  readonly heightRatio: number;
  /** 초상 높이 대비 화면 밖으로 내리는 비율. */
  readonly dropRatio: number;
}

function clampPercent(value: unknown, limit: { readonly min: number; readonly max: number }): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(clamp(value, limit.min, limit.max));
}

/** 저장용 정규화 — 기본값과 같은 칸은 지운다. 남는 칸이 없으면 undefined. */
export function normalizeDialogueFullPortraitSettings(value: unknown): DialogueFullPortraitSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const height = clampPercent(record.height, DIALOGUE_FULL_PORTRAIT_LIMITS.height);
  const drop = clampPercent(record.drop, DIALOGUE_FULL_PORTRAIT_LIMITS.drop);
  const out = {
    ...(height !== undefined && height !== DIALOGUE_FULL_PORTRAIT_DEFAULTS.height ? { height } : {}),
    ...(drop !== undefined && drop !== DIALOGUE_FULL_PORTRAIT_DEFAULTS.drop ? { drop } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 장면 배율(%) 정규화 — 100 과 무효값은 undefined(저장하지 않음). */
export function normalizeDialogueFullScale(value: unknown): number | undefined {
  const scale = clampPercent(value, DIALOGUE_FULL_PORTRAIT_LIMITS.scale);
  return scale === undefined || scale === 100 ? undefined : scale;
}

/** 런타임·에디터 미리보기가 같이 쓰는 전신 배치. */
export function resolveDialogueFullPortraitLayout(
  settings: unknown,
  fullScale?: unknown,
): DialogueFullPortraitLayout {
  const normalized = normalizeDialogueFullPortraitSettings(settings);
  const height = normalized?.height ?? DIALOGUE_FULL_PORTRAIT_DEFAULTS.height;
  const drop = normalized?.drop ?? DIALOGUE_FULL_PORTRAIT_DEFAULTS.drop;
  const scale = normalizeDialogueFullScale(fullScale) ?? 100;
  return { heightRatio: (height / 100) * (scale / 100), dropRatio: drop / 100 };
}
/** 구두점 뒤 쉼(ms). 기본 글자 간격과 같이 화자 빠르기로 늘고 준다. */
export const DIALOGUE_PUNCTUATION_PAUSE_MS = { comma: 120, stop: 300 } as const;
const COMMA_CHARS = new Set([",", "、", "，"]);
const STOP_CHARS = new Set([".", "。", "!", "?", "！", "？", "…", "~", "～"]);
/**
 * 방금 보인 글자 뒤에 쉴 시간. 연속된 문장부호(「...」「?!」)는 마지막 글자에서만 쉰다 —
 * 매 글자마다 쉬면 말줄임표가 느릿느릿 기어간다.
 */
export function punctuationPauseMs(char: string, next: string | undefined): number {
  if (next !== undefined && (COMMA_CHARS.has(next) || STOP_CHARS.has(next))) return 0;
  if (COMMA_CHARS.has(char)) return DIALOGUE_PUNCTUATION_PAUSE_MS.comma;
  if (STOP_CHARS.has(char)) return DIALOGUE_PUNCTUATION_PAUSE_MS.stop;
  return 0;
}

export const DIALOGUE_SPEED_LIMITS = { min: 0.5, max: 2 } as const;
export const DIALOGUE_PITCH_LIMITS = { min: -12, max: 12 } as const;

export function isDialogueStyleId(value: unknown): value is DialogueStyleId {
  return typeof value === "string" && (DIALOGUE_STYLE_IDS as readonly string[]).includes(value);
}

export function isDialogueVoiceId(value: unknown): value is DialogueVoiceId {
  return typeof value === "string" && (DIALOGUE_VOICE_IDS as readonly string[]).includes(value);
}

export function isDialogueContextId(value: unknown): value is DialogueContextId {
  return typeof value === "string" && (DIALOGUE_CONTEXT_IDS as readonly string[]).includes(value);
}

export function resolveDialogueStyleId(value: unknown): DialogueStyleId {
  return isDialogueStyleId(value) ? value : DEFAULT_DIALOGUE_STYLE_ID;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 저장용 정규화. 모르는 값·기본과 같은 값은 버리고, 남는 게 없으면 undefined. */
export function normalizeSpeakerDialogueProfile(value: unknown): SpeakerDialogueProfile | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const out: {
    style?: DialogueStyleId; nameColor?: string; voice?: DialogueVoiceId;
    pitch?: number; speed?: number; font?: FontFamilyId;
    container?: DialogueContainerId; expressions?: SpeakerDialogueProfile["expressions"]; talkFace?: string;
  } = {};
  if (isDialogueStyleId(source.style)) out.style = source.style;
  if (typeof source.nameColor === "string" && HEX_COLOR.test(source.nameColor.trim())) out.nameColor = source.nameColor.trim().toLowerCase();
  if (isDialogueVoiceId(source.voice)) out.voice = source.voice;
  if (typeof source.pitch === "number" && Number.isFinite(source.pitch) && Math.round(source.pitch) !== 0) {
    out.pitch = clamp(Math.round(source.pitch), DIALOGUE_PITCH_LIMITS.min, DIALOGUE_PITCH_LIMITS.max);
  }
  if (typeof source.speed === "number" && Number.isFinite(source.speed) && source.speed !== 1) {
    out.speed = Math.round(clamp(source.speed, DIALOGUE_SPEED_LIMITS.min, DIALOGUE_SPEED_LIMITS.max) * 100) / 100;
  }
  if (isFontFamilyId(source.font)) out.font = source.font;
  if (isDialogueContainerId(source.container) && source.container !== "box") out.container = source.container;
  const expressions = normalizeSpeakerExpressions(source.expressions);
  if (expressions) out.expressions = expressions;
  const talk = resourceIdOf(source.talkFace);
  if (talk !== undefined) out.talkFace = talk;
  return Object.keys(out).length > 0 ? out : undefined;
}

function resourceIdOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200 ? value.trim() : undefined;
}

function normalizeSpeakerExpressions(value: unknown): SpeakerDialogueProfile["expressions"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const out: Partial<Record<DialogueEmotionId, SpeakerExpression>> = {};
  for (const id of DIALOGUE_EMOTION_IDS) {
    const raw = source[id] ?? source[DIALOGUE_EMOTION_LABELS[id]];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const next: { face?: string; pitch?: number; emote?: EmoteKind } = {};
    const face = resourceIdOf(entry.face);
    if (face !== undefined) next.face = face;
    if (typeof entry.pitch === "number" && Number.isFinite(entry.pitch) && Math.round(entry.pitch) !== 0) {
      next.pitch = clamp(Math.round(entry.pitch), DIALOGUE_PITCH_LIMITS.min, DIALOGUE_PITCH_LIMITS.max);
    }
    if (isEmoteKind(entry.emote)) next.emote = entry.emote;
    if (Object.keys(next).length > 0) out[id] = next;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 새 프로젝트의 장르에 어울리는 기본 대화창. 첫 제작(인터뷰 → 생성) 때 코드가 먼저 깔고,
 * AI 는 기획 톤을 보고 set_project_settings 로 바꿀 수 있다 — 엔진 토글은 코드가 보장한다는
 * welcomeGenrePresetApply 의 원칙과 같다.
 */
export const RECOMMENDED_DIALOGUE_STYLE_BY_PRESET: Readonly<Record<GamePresetId, DialogueStyleId>> = {
  "monster-collect": "handheld",
  "story-cutscene": "gold",
  "adventure-jrpg": "retro-blue",
  "horror-gallery": "float",
  "school-horror": "mono-heavy",
  "farm-life": "wood",
  "partner-raise": "cream",
  "action-rpg": "white-card",
};

/** 장르 팩 id(genrePresets) 중 기획 프리셋 id 와 이름이 다른 것. */
const GENRE_PACK_PRESET_ALIASES: Readonly<Record<string, GamePresetId>> = { "horror-chase": "horror-gallery" };

/** 기획 프리셋 id 와 장르 팩 id 를 둘 다 받는다. 모르는 값은 기본 유리창. */
export function recommendedDialogueStyleForPreset(presetId: string | undefined): DialogueStyleId {
  const key = presetId ? GENRE_PACK_PRESET_ALIASES[presetId] ?? presetId : undefined;
  return key && key in RECOMMENDED_DIALOGUE_STYLE_BY_PRESET
    ? RECOMMENDED_DIALOGUE_STYLE_BY_PRESET[key as GamePresetId]
    : DEFAULT_DIALOGUE_STYLE_ID;
}

/** AI 도구 설명에 싣는 짧은 선택 안내 — 스타일마다 한 줄. */
export function dialogueStyleGuideLines(): string[] {
  return DIALOGUE_STYLE_IDS.map((id) => `${id}: ${DIALOGUE_STYLES[id].label} — ${DIALOGUE_STYLES[id].fit}`);
}

export function dialogueVoiceGuideLines(): string[] {
  return DIALOGUE_VOICE_IDS.map((id) => `${id}: ${DIALOGUE_VOICE_LABELS[id]}`);
}

export function dialogueContextGuideLines(): string[] {
  return DIALOGUE_CONTEXT_IDS.map((id) => `${id}: ${DIALOGUE_CONTEXTS[id].label} — ${DIALOGUE_CONTEXTS[id].description}`);
}

/** 런타임 대화창이 한 줄을 그릴 때 쓰는 최종 모양. */
export interface DialogueLook {
  readonly style: DialogueStyleId;
  readonly context: DialogueContextId;
  readonly nameColor?: string;
  readonly font?: FontFamilyId;
  /** null = 소리 없음. */
  readonly voice: DialogueVoiceDefinition | null;
  /** 반음. 화자 pitch + 대사 종류 이동. */
  readonly voicePitch: number;
  /** 대사 종류가 곱하는 음량. */
  readonly voiceGain: number;
  /** 글자 지연 배율(작을수록 빠르다) = 1 / 화자 speed. */
  readonly delayScale: number;
  readonly instant: boolean;
  readonly hideName: boolean;
  readonly hideFace: boolean;
  readonly nameSuffix: string;
  readonly shake: boolean;
  /** 대사를 담는 그릇. 말풍선을 못 그리면 런타임이 상자로 되돌린다. */
  readonly container: DialogueContainerId;
  /** 구두점 뒤에 쉰다(프로젝트 설정, 기본 켜짐). */
  readonly punctuationPause: boolean;
  /** 표정이 고른 얼굴 그림(리소스 id). 이 줄에 얼굴이 있을 때 그 얼굴을 바꾼다. */
  readonly expressionFace?: string;
  /** 입 벌린 얼굴 그림 — 말하는 동안 평소 얼굴과 번갈아 보인다. */
  readonly talkFace?: string;
  /** 표정이 고른 머리 위 이모트. */
  readonly emote?: EmoteKind;
  /** 이 줄의 표정. */
  readonly emotion?: DialogueEmotionId;
  /** 본문 태그 [표정:…] 가 한 줄 도중에 표정을 바꿀 때 쓰는 화자 표정 표. */
  readonly expressions?: SpeakerDialogueProfile["expressions"];
  /** 표정 이동을 빼고 남은 기본 음 높이(반음). 표정 태그가 바뀔 때 여기서 다시 더한다. */
  readonly basePitch: number;
}

type LookProject = {
  readonly system: {
    readonly dialogueStyle?: string;
    readonly dialogueFont?: string;
    readonly dialogueSpeed?: number;
    readonly dialoguePunctuationPause?: boolean;
  };
  readonly characters?: Readonly<Record<string, { readonly displayName?: string; readonly dialogue?: SpeakerDialogueProfile }>>;
};

/**
 * 화자 프로필 찾기: 이벤트의 characterId 가 먼저, 없으면 대사의 화자 이름과 같은 표시 이름.
 * 화자 칸은 자유 문자열이라 이름으로도 찾아 준다 — AI 가 characterId 를 빼먹어도 목소리가 산다.
 */
export function findSpeakerDialogueProfile(
  project: LookProject,
  query: { readonly characterId?: string | null; readonly speaker?: string },
): SpeakerDialogueProfile | undefined {
  const characters = project.characters ?? {};
  const id = query.characterId?.trim();
  if (id && characters[id]) return normalizeSpeakerDialogueProfile(characters[id]!.dialogue);
  const name = query.speaker?.trim();
  if (!name) return undefined;
  for (const profile of Object.values(characters)) {
    if (profile.displayName?.trim() === name) return normalizeSpeakerDialogueProfile(profile.dialogue);
  }
  return undefined;
}

export function resolveDialogueLook(
  project: LookProject,
  line: {
    readonly speaker?: string;
    readonly characterId?: string | null;
    readonly style?: unknown;
    readonly context?: unknown;
    readonly container?: unknown;
    readonly emotion?: unknown;
  } = {},
): DialogueLook {
  const speaker = findSpeakerDialogueProfile(project, line);
  const style = isDialogueStyleId(line.style)
    ? line.style
    : speaker?.style ?? resolveDialogueStyleId(project.system.dialogueStyle);
  const context: DialogueContextId = isDialogueContextId(line.context) ? line.context : "speech";
  const ctx = DIALOGUE_CONTEXTS[context];
  const voiceId: DialogueVoiceId = speaker?.voice ?? DIALOGUE_STYLES[style].defaultVoice;
  const voice = voiceId === "none" || ctx.voiceGain <= 0 ? null : DIALOGUE_VOICES[voiceId];
  const speed = clamp(speaker?.speed ?? 1, DIALOGUE_SPEED_LIMITS.min, DIALOGUE_SPEED_LIMITS.max);
  const projectSpeed = typeof project.system.dialogueSpeed === "number" && Number.isFinite(project.system.dialogueSpeed)
    ? clamp(project.system.dialogueSpeed, DIALOGUE_PROJECT_SPEED_LIMITS.min, DIALOGUE_PROJECT_SPEED_LIMITS.max)
    : 1;
  const font = speaker?.font ?? (isFontFamilyId(project.system.dialogueFont) ? project.system.dialogueFont : undefined);
  const container: DialogueContainerId = isDialogueContainerId(line.container)
    ? line.container
    : speaker?.container ?? "box";
  const emotion = typeof line.emotion === "string" ? parseDialogueEmotion(line.emotion) : undefined;
  const expression = emotion ? speaker?.expressions?.[emotion] : undefined;
  const basePitch = (speaker?.pitch ?? 0) + ctx.voicePitch;
  return {
    style,
    context,
    ...(speaker?.nameColor ? { nameColor: speaker.nameColor } : {}),
    ...(font ? { font } : {}),
    voice: voice ? (context === "radio" ? { ...voice, bandpass: true } : voice) : null,
    voicePitch: basePitch + (expression?.pitch ?? 0),
    basePitch,
    voiceGain: ctx.voiceGain,
    delayScale: 1 / (speed * projectSpeed),
    instant: ctx.instant,
    hideName: ctx.hideName,
    hideFace: ctx.hideFace,
    nameSuffix: ctx.nameSuffix ?? "",
    shake: ctx.shake === true,
    container,
    punctuationPause: project.system.dialoguePunctuationPause !== false,
    ...(expression?.face ? { expressionFace: expression.face } : {}),
    ...(speaker?.talkFace ? { talkFace: speaker.talkFace } : {}),
    ...(expression?.emote ? { emote: expression.emote } : {}),
    ...(emotion ? { emotion } : {}),
    ...(speaker?.expressions ? { expressions: speaker.expressions } : {}),
  };
}

/**
 * 본문 인라인 태그. 한국어 이름과 영어 별칭을 둘 다 받는다. 여는 태그는 [/] 로 닫는다.
 * 에디터 문장 도구 버튼·AI 도구 설명·런타임 해석이 이 표 하나를 본다.
 */
export interface DialogueInlineTagDefinition {
  readonly id: string;
  readonly label: string;
  /** 본문에 넣을 예시. */
  readonly sample: string;
  readonly description: string;
}

export const DIALOGUE_INLINE_TAGS: readonly DialogueInlineTagDefinition[] = [
  { id: "shake", label: "흔들", sample: "[흔들]진짜라니까![/]", description: "글자가 떨린다. 움직임 줄이기면 멈춘다." },
  { id: "wave", label: "물결", sample: "[물결]우우우~[/]", description: "글자가 물결친다. 움직임 줄이기면 멈춘다." },
  { id: "big", label: "크게", sample: "[크게]무섭지?[/]", description: "글자를 키운다." },
  { id: "small", label: "작게", sample: "[작게]누가 서 있대[/]", description: "글자를 줄인다." },
  { id: "color", label: "색", sample: "[색:노랑]보물[/]", description: "빨강·주황·노랑·초록·파랑·보라·분홍·회색·흰색 또는 #rrggbb." },
  { id: "pause", label: "쉼", sample: "[쉼:0.5]", description: "초 단위로 잠깐 멈춘다(최대 5초)." },
  { id: "fast", label: "빠르게", sample: "[빠르게]후다닥[/]", description: "이 구간을 두 배 빠르게 흘린다." },
  { id: "slow", label: "느리게", sample: "[느리게]천…천…히[/]", description: "이 구간을 절반 빠르기로 흘린다." },
  { id: "face", label: "표정", sample: "[표정:놀람]", description: "기쁨·슬픔·분노·놀람. 화자 프로필의 표정(얼굴 그림·목소리 높이·이모트)으로 바꾼다." },
  { id: "sound", label: "소리", sample: "[소리:효과음id]", description: "그 글자에서 효과음을 한 번 낸다(자료집 효과음 id)." },
  { id: "screenShake", label: "화면흔들", sample: "[화면흔들]", description: "그 글자에서 화면을 한 번 흔든다." },
  { id: "noSkip", label: "넘기기금지", sample: "[넘기기금지]…[/]", description: "이 구간은 키를 눌러도 한 번에 채우지 않는다." },
];

/** 색 태그 이름 → CSS 색. */
export const DIALOGUE_TAG_COLORS: Readonly<Record<string, string>> = {
  빨강: "rgb(255, 110, 110)", red: "rgb(255, 110, 110)",
  주황: "rgb(255, 170, 90)", orange: "rgb(255, 170, 90)",
  노랑: "rgb(255, 225, 100)", yellow: "rgb(255, 225, 100)",
  초록: "rgb(120, 230, 140)", green: "rgb(120, 230, 140)",
  파랑: "rgb(120, 190, 255)", blue: "rgb(120, 190, 255)",
  보라: "rgb(200, 150, 255)", purple: "rgb(200, 150, 255)",
  분홍: "rgb(255, 150, 210)", pink: "rgb(255, 150, 210)",
  회색: "rgb(170, 176, 190)", gray: "rgb(170, 176, 190)",
  흰색: "rgb(255, 255, 255)", white: "rgb(255, 255, 255)",
};

export function dialogueInlineTagGuideLines(): string[] {
  return DIALOGUE_INLINE_TAGS.map((tag) => `${tag.sample} — ${tag.description}`);
}

export function dialogueContainerGuideLines(): string[] {
  return DIALOGUE_CONTAINER_IDS.map((id) => `${id}: ${DIALOGUE_CONTAINER_LABELS[id]} — ${DIALOGUE_CONTAINER_DESCRIPTIONS[id]}`);
}
