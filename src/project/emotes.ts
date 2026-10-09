// 정수리 이모트 — 캐릭터 머리 위에 잠깐 뜨는 표현 아이콘의 어휘 단일 소스.
//
// 이 배열 순서가 곧 시트 프레임 인덱스다. PNG 는 scripts/gen-emote-sheet.mjs 가 코드로 그리고,
// 목록 ↔ 페인터 대조는 test/emoteSheet.test.ts 가 기계적으로 잡는다. 순서를 바꾸면 시트를
// 다시 생성해야 한다(--check 가 드리프트를 막는다).
import type { GiftPreferenceRank } from "@/project/types/events";

export const EMOTE_KINDS = [
  "heart",
  "heartBroken",
  "smile",
  "exclamation",
  "question",
  "music",
  "sweat",
  "anger",
  "ellipsis",
  "sleep",
  "sparkle",
  "idea",
] as const;

export type EmoteKind = (typeof EMOTE_KINDS)[number];

export const EMOTE_LABELS: Record<EmoteKind, string> = {
  heart: "하트",
  heartBroken: "깨진 하트",
  smile: "미소",
  exclamation: "놀람",
  question: "물음표",
  music: "노래",
  sweat: "땀",
  anger: "화남",
  ellipsis: "말줄임",
  sleep: "졸음",
  sparkle: "반짝임",
  idea: "생각났다",
};

export const EMOTE_FRAME_SIZE = 16;
export const EMOTE_TEXTURE_KEY = "tex_generated_emotes";
export const EMOTE_ASSET_PATH = "assets/generated-emotes.png";

/** 기본 표시 시간. 대사 한 줄을 읽기 전에 사라지지 않고, 이동을 막지도 않는 길이. */
export const EMOTE_DEFAULT_DURATION_MS = 1200;
export const EMOTE_MIN_DURATION_MS = 200;
export const EMOTE_MAX_DURATION_MS = 10_000;

export function isEmoteKind(value: unknown): value is EmoteKind {
  return typeof value === "string" && (EMOTE_KINDS as readonly string[]).includes(value);
}

export function emoteFrameIndex(kind: EmoteKind): number {
  return EMOTE_KINDS.indexOf(kind);
}

export function emoteLabel(kind: EmoteKind): string {
  return EMOTE_LABELS[kind];
}

export function clampEmoteDurationMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return EMOTE_DEFAULT_DURATION_MS;
  return Math.min(EMOTE_MAX_DURATION_MS, Math.max(EMOTE_MIN_DURATION_MS, Math.trunc(value)));
}

/** 선물 반응 등급 → 이모트. 저작자가 손대지 않아도 선물의 결과가 머리 위에 보인다. */
export function giftRankEmote(rank: GiftPreferenceRank): EmoteKind {
  switch (rank) {
    case "loved":
      return "heart";
    case "liked":
      return "smile";
    case "neutral":
      return "ellipsis";
    case "disliked":
      return "anger";
  }
}

/** 호감도 변화량 → 이모트. 대화로 오른 경우처럼 등급이 없는 경로에 쓴다. */
export function friendshipDeltaEmote(delta: number): EmoteKind {
  if (delta > 0) return "heart";
  if (delta < 0) return "anger";
  return "ellipsis";
}
